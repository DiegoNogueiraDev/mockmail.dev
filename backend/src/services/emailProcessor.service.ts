import fs from "fs";
import path from "path";
import { simpleParser, ParsedMail } from "mailparser";
import logger from "../utils/logger";
import { saveEmail } from "./email.service";
import { findEmailBoxByAddress, findOrCreateEmailBox } from "./emailBox.service";
import { extractEmail, extractTokenSubject } from "../utils/emailParser";
import { parseBody } from "../utils/bodyParser";
import User from "../models/User";
import { incrementUserDailyUsage } from "../middlewares/dailyUserLimit";
import EmailBox from "../models/EmailBox";

// Configurações via variáveis de ambiente
const FIFO_PATH = process.env.MOCKMAIL_FIFO_PATH || "/var/spool/email-processor";
const OUTPUT_FILE = process.env.MOCKMAIL_OUTPUT_FILE || "/var/log/mockmail/emails.json";
const POLL_INTERVAL = parseInt(process.env.MOCKMAIL_POLL_INTERVAL || "1000", 10);
const DEBUG_MODE = process.env.MOCKMAIL_DEBUG === "true";

interface ParsedEmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  contentType: string;
  body: string;
  processedAt: string;
}

/**
 * Parseia o email raw usando mailparser
 */
async function parseRawEmail(rawEmail: string): Promise<ParsedEmailData> {
  try {
    const parsed: ParsedMail = await simpleParser(rawEmail);

    const fromAddress = parsed.from?.value?.[0]?.address || "";
    const toAddress = Array.isArray(parsed.to)
      ? parsed.to[0]?.value?.[0]?.address || ""
      : parsed.to?.value?.[0]?.address || "";

    const emailData: ParsedEmailData = {
      id: parsed.messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subject: parsed.subject || "(sem assunto)",
      from: fromAddress,
      to: toAddress,
      date: parsed.date?.toISOString() || new Date().toISOString(),
      contentType: parsed.html ? "text/html" : "text/plain",
      body: parsed.html || parsed.text || "",
      processedAt: new Date().toISOString(),
    };

    logger.info(`EMAIL-PROCESSOR - Email parseado: ${emailData.subject}`);
    return emailData;
  } catch (error) {
    logger.error(`EMAIL-PROCESSOR - Erro ao parsear email: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Salva o email em arquivo JSON para backup/debug
 */
async function saveToJsonFile(emailData: ParsedEmailData): Promise<void> {
  try {
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(emailData) + "\n";
    fs.appendFileSync(OUTPUT_FILE, line, { encoding: "utf-8" });

    if (DEBUG_MODE) {
      logger.debug(`EMAIL-PROCESSOR - Email salvo em JSON: ${emailData.id}`);
    }
  } catch (error) {
    logger.error(`EMAIL-PROCESSOR - Erro ao salvar JSON: ${(error as Error).message}`);
  }
}

/**
 * Reativa uma caixa expirada estendendo a expiração por 24 horas.
 */
async function reactivateIfExpired(emailBox: any): Promise<void> {
  const now = new Date();
  const isExpired = emailBox.expiresAt && new Date(emailBox.expiresAt) <= now;

  if (isExpired || !emailBox.expiresAt) {
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await EmailBox.updateOne(
      { _id: emailBox._id },
      { $set: { expiresAt: newExpiresAt } }
    );
    logger.info(
      `EMAIL-PROCESSOR - Caixa reativada: ${emailBox.address} - Nova expiração: ${newExpiresAt.toISOString()}`
    );
  }
}

/**
 * Processa o email e persiste no MongoDB
 * Busca o EmailBox pelo endereço de destino para encontrar o usuário
 */
async function processAndPersistEmail(emailData: ParsedEmailData): Promise<void> {
  try {
    // Extrai e valida os emails
    let from: string;
    let to: string;

    try {
      from = extractEmail(emailData.from);
      to = extractEmail(emailData.to);
    } catch {
      logger.warn(`EMAIL-PROCESSOR - Emails inválidos: from=${emailData.from}, to=${emailData.to}`);
      await saveToJsonFile(emailData);
      return;
    }

    // PRIORIDADE 1: Busca o EmailBox pelo endereço de destino (TO)
    // Se a caixa TO existe, o email vai para ela independente do FROM
    let emailBox = await findEmailBoxByAddress(to);
    let userId: string;

    if (emailBox) {
      // Caixa TO existe - usa ela (ignora FROM)
      userId = (emailBox.userId as any)?._id?.toString() || emailBox.userId?.toString();
      
      if (!userId) {
        logger.warn(`EMAIL-PROCESSOR - Usuário não encontrado para EmailBox existente: ${to}`);
        await saveToJsonFile(emailData);
        return;
      }
      
      // Reativar caixa se estiver expirada (novo email = caixa deve ficar ativa)
      await reactivateIfExpired(emailBox);

      logger.info(`EMAIL-PROCESSOR - Caixa ${to} encontrada. Destinando email para ela (FROM: ${from})`);
    } else {
      // PRIORIDADE 2: Caixa TO não existe - tentar criar baseado no remetente (FROM)
      logger.info(`EMAIL-PROCESSOR - EmailBox não encontrada para: ${to}. Verificando remetente...`);
      
      // Busca usuário pelo email do remetente
      const senderUser = await User.findOne({ email: from });
      
      if (senderUser) {
        // FROM é usuário cadastrado - cria a caixa TO para ele
        logger.info(`EMAIL-PROCESSOR - Criando caixa ${to} para usuário ${senderUser.email}`);
        emailBox = await findOrCreateEmailBox(to, senderUser._id.toString());
        userId = senderUser._id.toString();
        logger.info(`EMAIL-PROCESSOR - Caixa ${to} criada com sucesso!`);
      } else {
        // PRIORIDADE 3: Nem TO nem FROM existem - descartar e logar detalhadamente
        logger.warn(
          `EMAIL-PROCESSOR - EMAIL DESCARTADO | ` +
          `FROM: ${from} (não cadastrado) | ` +
          `TO: ${to} (caixa inexistente) | ` +
          `SUBJECT: ${emailData.subject} | ` +
          `DATE: ${emailData.date}`
        );
        await saveToJsonFile(emailData);
        return;
      }
    }

    // Parseia o body do email
    const parsedBody = parseBody(emailData.body);

    // Extrai token do assunto (se existir)
    const token = extractTokenSubject(emailData.subject);

    // Verificar limite diário ANTES de salvar o email
    try {
      const hasQuota = await incrementUserDailyUsage(userId);
      if (!hasQuota) {
        logger.warn(
          `EMAIL-PROCESSOR - Usuário ${userId} excedeu limite diário de interações. ` +
          `Email descartado: FROM=${from}, TO=${to}, SUBJECT=${emailData.subject}`
        );
        await saveToJsonFile(emailData);
        return;
      }
    } catch (usageError) {
      // fail-open: se falhar ao verificar limite, permite o email
      logger.warn(`EMAIL-PROCESSOR - Falha ao verificar uso diário: ${(usageError as Error).message}`);
    }

    // Salva o email no MongoDB
    const savedEmail = await saveEmail({
      from,
      to,
      subject: emailData.subject,
      body: {
        rawHtml: parsedBody.rawHtml,
        plainText: parsedBody.plainText,
        metadata: { links: parsedBody.links, images: parsedBody.images },
      },
      id: emailData.id,
      date: emailData.date,
      token,
      content_type: emailData.contentType,
      processed_at: emailData.processedAt,
      emailBox: emailBox._id,
    });

    logger.info(`EMAIL-PROCESSOR - Email persistido: ${savedEmail._id} para ${to}`);

    // Invalidar cache do usuário para refletir novo email
    try {
      const { invalidateUserEmailsCache, invalidateUserBoxesCache } = await import("./cache.service");
      await invalidateUserEmailsCache(userId);
      await invalidateUserBoxesCache(userId);
      logger.debug(`EMAIL-PROCESSOR - Cache invalidado para usuário ${userId}`);
    } catch (cacheError) {
      logger.warn(`EMAIL-PROCESSOR - Falha ao invalidar cache: ${(cacheError as Error).message}`);
    }

    // Salva cópia em JSON para backup
    if (DEBUG_MODE) {
      await saveToJsonFile(emailData);
    }
  } catch (error) {
    logger.error(`EMAIL-PROCESSOR - Erro ao persistir email: ${(error as Error).message}`);
    // Salva em arquivo para não perder o email
    await saveToJsonFile(emailData);
  }
}

/**
 * Lê emails do FIFO e processa
 */
/**
 * Lê emails do FIFO de forma contínua e bloqueante
 * Esta abordagem mantém o FIFO aberto e espera por dados,
 * evitando o erro "Broken pipe" do Postfix
 */
async function readFromFifoContinuous(): Promise<void> {
  logger.info(`EMAIL-PROCESSOR - Abrindo FIFO em modo bloqueante: ${FIFO_PATH}`);
  
  // Verifica se o FIFO existe
  if (!fs.existsSync(FIFO_PATH)) {
    logger.error(`EMAIL-PROCESSOR - FIFO não existe: ${FIFO_PATH}`);
    throw new Error(`FIFO not found: ${FIFO_PATH}`);
  }

  // Abre o FIFO em modo de leitura BLOQUEANTE (sem O_NONBLOCK)
  // Isso mantém o FIFO aberto aguardando escritores
  const stream = fs.createReadStream(FIFO_PATH, { encoding: "utf-8" });
  
  let buffer = "";

  stream.on("data", async (chunk: Buffer | string) => {
    const data = chunk.toString();
    logger.debug(`EMAIL-PROCESSOR - Recebidos ${data.length} bytes`);
    
    buffer += data;
    
    // Processa emails quando encontra uma linha vazia dupla (fim do email)
    // ou quando o buffer fica muito grande
    const parts = buffer.split(/\n\n\n/); // Três quebras = separador entre emails
    
    if (parts.length > 1) {
      // Processa todos os emails completos
      for (let i = 0; i < parts.length - 1; i++) {
        const emailRaw = parts[i].trim();
        if (emailRaw) {
          try {
            logger.info(`EMAIL-PROCESSOR - Processando email (${emailRaw.length} bytes)`);
            const emailData = await parseRawEmail(emailRaw);
            await processAndPersistEmail(emailData);
            logger.info(`EMAIL-PROCESSOR - Email processado com sucesso`);
          } catch (error) {
            logger.error(`EMAIL-PROCESSOR - Erro no processamento: ${(error as Error).message}`);
          }
        }
      }
      // Mantém a última parte (incompleta) no buffer
      buffer = parts[parts.length - 1];
    }
  });

  stream.on("end", async () => {
    // Processa qualquer email restante no buffer antes de reabrir
    if (buffer.trim()) {
      try {
        logger.info(`EMAIL-PROCESSOR - Processando email pendente (${buffer.length} bytes)`);
        const emailData = await parseRawEmail(buffer);
        await processAndPersistEmail(emailData);
        logger.info(`EMAIL-PROCESSOR - Email processado com sucesso`);
        buffer = "";
      } catch (error) {
        logger.error(`EMAIL-PROCESSOR - Erro no processamento: ${(error as Error).message}`);
      }
    }
    logger.warn(`EMAIL-PROCESSOR - Stream do FIFO encerrado, reabrindo...`);
    setTimeout(() => readFromFifoContinuous(), 1000);
  });
  stream.on("error", (error) => {
    logger.error(`EMAIL-PROCESSOR - Erro no stream do FIFO: ${error.message}`);
    // Reabrir após erro
    setTimeout(() => readFromFifoContinuous(), 2000);
  });

  logger.info(`EMAIL-PROCESSOR - FIFO aberto, aguardando emails...`);
}

/**
 * Inicia o processador
 */
async function startProcessor(): Promise<void> {
  logger.info(`EMAIL-PROCESSOR - Iniciando processador de emails`);
  logger.info(`EMAIL-PROCESSOR - FIFO: ${FIFO_PATH}`);
  logger.info(`EMAIL-PROCESSOR - Modo debug: ${DEBUG_MODE}`);
  
  // Inicia leitura contínua do FIFO
  await readFromFifoContinuous();
}

export { parseRawEmail, processAndPersistEmail, startProcessor };

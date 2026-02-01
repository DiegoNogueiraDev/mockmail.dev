import fs from "fs";
import path from "path";
import { simpleParser, ParsedMail } from "mailparser";
import logger from "../utils/logger";
import { saveEmail } from "./email.service";
import { findEmailBoxByAddress, findOrCreateEmailBox } from "./emailBox.service";
import { extractEmail, extractTokenSubject } from "../utils/emailParser";
import { parseBody } from "../utils/bodyParser";

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

    // Busca o EmailBox pelo endereço de destino
    const emailBox = await findEmailBoxByAddress(to);

    if (!emailBox) {
      logger.warn(`EMAIL-PROCESSOR - EmailBox não encontrada para: ${to}`);
      // Salva em arquivo para não perder o email
      await saveToJsonFile(emailData);
      return;
    }

    // O userId vem populado do findEmailBoxByAddress
    const userId = (emailBox.userId as any)?._id || emailBox.userId;

    if (!userId) {
      logger.warn(`EMAIL-PROCESSOR - Usuário não encontrado para EmailBox: ${to}`);
      await saveToJsonFile(emailData);
      return;
    }

    // Parseia o body do email
    const parsedBody = parseBody(emailData.body);

    // Extrai token do assunto (se existir)
    const token = extractTokenSubject(emailData.subject);

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

    logger.info(`EMAIL-PROCESSOR - Email persistido: ${savedEmail.id} para ${to}`);

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
async function readFromFifo(): Promise<void> {
  return new Promise((resolve) => {
    try {
      // Verifica se o FIFO existe
      if (!fs.existsSync(FIFO_PATH)) {
        logger.warn(`EMAIL-PROCESSOR - FIFO não existe: ${FIFO_PATH}`);
        resolve();
        return;
      }

      logger.debug(`EMAIL-PROCESSOR - Lendo FIFO: ${FIFO_PATH}`);

      // Abre o FIFO em modo de leitura não-bloqueante
      const fd = fs.openSync(FIFO_PATH, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
      const stream = fs.createReadStream("", { fd, encoding: "utf-8" });

      let buffer = "";

      stream.on("data", (chunk: Buffer | string) => {
        buffer += chunk.toString();
      });

      stream.on("end", async () => {
        if (buffer.trim()) {
          try {
            const emailData = await parseRawEmail(buffer);
            await processAndPersistEmail(emailData);
          } catch (error) {
            logger.error(`EMAIL-PROCESSOR - Erro no processamento: ${(error as Error).message}`);
          }
        }
        resolve();
      });

      stream.on("error", (error) => {
        logger.error(`EMAIL-PROCESSOR - Erro na leitura do FIFO: ${error.message}`);
        resolve();
      });
    } catch (error) {
      logger.error(`EMAIL-PROCESSOR - Erro ao abrir FIFO: ${(error as Error).message}`);
      resolve();
    }
  });
}

/**
 * Loop principal do processador
 */
async function startProcessor(): Promise<void> {
  logger.info(`EMAIL-PROCESSOR - Iniciando monitoramento do FIFO: ${FIFO_PATH}`);
  logger.info(`EMAIL-PROCESSOR - Intervalo de polling: ${POLL_INTERVAL}ms`);
  logger.info(`EMAIL-PROCESSOR - Modo debug: ${DEBUG_MODE}`);

  while (true) {
    try {
      await readFromFifo();
    } catch (error) {
      logger.error(`EMAIL-PROCESSOR - Erro no loop: ${(error as Error).message}`);
    }

    // Aguarda antes do próximo poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

export { parseRawEmail, processAndPersistEmail, startProcessor };

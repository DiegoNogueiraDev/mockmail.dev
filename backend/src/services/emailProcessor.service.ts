import fs from "fs";
import path from "path";
import { simpleParser, ParsedMail } from "mailparser";
import logger from "../utils/logger";
import { saveEmail } from "./email.service";
import { findEmailBoxByAddress, findOrCreateEmailBox } from "./emailBox.service";
import { extractEmail, extractTokenSubject } from "../utils/emailParser";
import { parseBody, rewriteLinks } from "../utils/bodyParser";
import Email from "../models/Email";
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
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }>;
  headers?: Record<string, string>;
  // Threading fields
  inReplyTo?: string;
  references?: string[];
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

    const attachments = (parsed.attachments || []).map(att => ({
      filename: att.filename || "unnamed",
      contentType: att.contentType || "application/octet-stream",
      size: att.size || 0,
      content: att.content,
    }));

    // Extrair headers SMTP relevantes
    const headers: Record<string, string> = {};
    if (parsed.headers) {
      const interestingHeaders = [
        'return-path', 'received', 'dkim-signature', 'authentication-results',
        'received-spf', 'x-mailer', 'x-originating-ip', 'reply-to',
        'list-unsubscribe', 'mime-version', 'content-transfer-encoding',
        'x-spam-status', 'x-spam-score', 'arc-seal',
      ];
      for (const [key, value] of parsed.headers) {
        const lowerKey = key.toLowerCase();
        if (interestingHeaders.includes(lowerKey) || lowerKey.startsWith('x-')) {
          headers[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
    }

    // Extrair campos de threading
    const inReplyTo = parsed.inReplyTo || undefined;
    const references = Array.isArray(parsed.references)
      ? parsed.references
      : parsed.references ? [parsed.references] : [];

    const emailData: ParsedEmailData = {
      id: parsed.messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subject: parsed.subject || "(sem assunto)",
      from: fromAddress,
      to: toAddress,
      date: parsed.date?.toISOString() || new Date().toISOString(),
      contentType: parsed.html ? "text/html" : "text/plain",
      body: parsed.html || parsed.text || "",
      processedAt: new Date().toISOString(),
      attachments,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      inReplyTo,
      references: references.length > 0 ? references : undefined,
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
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Operação atômica: só atualiza se expirado ou sem expiresAt
  const result = await EmailBox.findOneAndUpdate(
    {
      _id: emailBox._id,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $lte: now } },
      ],
    },
    { $set: { expiresAt: newExpiresAt } },
    { new: true }
  );

  if (result) {
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

        // Disparar webhook para evento de caixa criada
        try {
          const { triggerWebhooks } = await import("./webhook.service");
          const { WebhookEvent } = await import("../models/Webhook");
          await triggerWebhooks(userId, WebhookEvent.BOX_CREATED, {
            boxId: emailBox._id.toString(),
            address: emailBox.address,
            isCustom: emailBox.isCustom || false,
            expiresAt: emailBox.expiresAt,
          });
        } catch (webhookError) {
          logger.warn(`EMAIL-PROCESSOR - Falha ao disparar webhook BOX_CREATED: ${(webhookError as Error).message}`);
        }
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

    // Calcular threadId para agrupamento de conversas
    let threadId = emailData.id; // Por default, email é sua própria thread
    if (emailData.inReplyTo) {
      const parent = await Email.findOne({ messageId: emailData.inReplyTo }).select('threadId').lean();
      if (parent) {
        threadId = (parent as any).threadId || emailData.inReplyTo;
      }
    } else if (emailData.references && emailData.references.length > 0) {
      const root = await Email.findOne({ messageId: emailData.references[0] }).select('threadId').lean();
      if (root) {
        threadId = (root as any).threadId || emailData.references[0];
      }
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
      attachments: emailData.attachments,
      headers: emailData.headers,
      inReplyTo: emailData.inReplyTo,
      references: emailData.references,
      threadId,
    });

    logger.info(`EMAIL-PROCESSOR - Email persistido: ${savedEmail._id} para ${to}`);

    // Inject tracking pixel and rewrite links
    try {
      const baseUrl = process.env.TRACKING_BASE_URL || "https://mockmail.dev";
      const emailIdStr = savedEmail._id.toString();
      let trackedHtml = parsedBody.rawHtml;
      trackedHtml = rewriteLinks(trackedHtml, emailIdStr, baseUrl);
      const pixelTag = `<img src="${baseUrl}/api/mail/track/open/${emailIdStr}" width="1" height="1" style="display:none" alt="" />`;
      if (trackedHtml.includes("</body>")) {
        trackedHtml = trackedHtml.replace("</body>", `${pixelTag}</body>`);
      } else {
        trackedHtml += pixelTag;
      }
      await Email.updateOne({ _id: emailIdStr }, { "body.rawHtml": trackedHtml });
      logger.info(`EMAIL-PROCESSOR - Tracking injected for email ${emailIdStr}`);
    } catch (trackError) {
      logger.warn(`EMAIL-PROCESSOR - Failed to inject tracking: ${(trackError as Error).message}`);
    }

    // Invalidar cache do usuário para refletir novo email
    try {
      const { invalidateUserEmailsCache, invalidateUserBoxesCache, invalidateBoxEmailsCache } = await import("./cache.service");
      await invalidateUserEmailsCache(userId);
      await invalidateUserBoxesCache(userId);
      await invalidateBoxEmailsCache(emailBox._id.toString());
      logger.debug(`EMAIL-PROCESSOR - Cache invalidado para usuário ${userId} e box ${emailBox._id}`);
    } catch (cacheError) {
      logger.warn(`EMAIL-PROCESSOR - Falha ao invalidar cache: ${(cacheError as Error).message}`);
    }

    // Disparar webhooks para evento de email recebido
    try {
      const { triggerWebhooks } = await import("./webhook.service");
      const { WebhookEvent } = await import("../models/Webhook");
      await triggerWebhooks(userId, WebhookEvent.EMAIL_RECEIVED, {
        emailId: savedEmail._id.toString(),
        from,
        to,
        subject: emailData.subject,
        date: emailData.date,
        boxId: emailBox._id.toString(),
      });
    } catch (webhookError) {
      logger.warn(`EMAIL-PROCESSOR - Falha ao disparar webhooks: ${(webhookError as Error).message}`);
    }

    // Notificar usuário por email real (se configurado)
    try {
      const { notifyEmailReceived } = await import("./notification.service");
      notifyEmailReceived(userId, {
        from,
        to,
        subject: emailData.subject,
        date: emailData.date,
      }).catch(err => {
        logger.warn(`EMAIL-PROCESSOR - Notification error: ${err.message}`);
      });
    } catch (notifError) {
      logger.warn(`EMAIL-PROCESSOR - Notification import failed: ${(notifError as Error).message}`);
    }

    // Verificar regras de auto-forward
    try {
      const ForwardRule = (await import("../models/ForwardRule")).default;
      const rules = await ForwardRule.find({
        emailBoxId: emailBox._id,
        active: true,
      });

      for (const rule of rules) {
        if (rule.filterFrom && !from.includes(rule.filterFrom)) continue;
        if (rule.filterSubject) {
          const regex = new RegExp(rule.filterSubject, "i");
          if (!regex.test(emailData.subject)) continue;
        }

        const { forwardEmail } = await import("./mailer.service");
        forwardEmail({
          originalFrom: from,
          originalTo: to,
          originalSubject: emailData.subject,
          htmlBody: parsedBody.rawHtml,
          textBody: parsedBody.plainText,
          forwardTo: rule.forwardTo,
          forwardedBy: "auto-forward",
        }).then(() => {
          ForwardRule.findByIdAndUpdate(rule._id, {
            $inc: { forwardCount: 1 },
            $set: { lastForwardedAt: new Date() },
          }).exec();
        }).catch(err => {
          logger.warn(`EMAIL-PROCESSOR - Auto-forward error: ${err.message}`);
        });
      }
    } catch (fwdError) {
      logger.warn(`EMAIL-PROCESSOR - Auto-forward check failed: ${(fwdError as Error).message}`);
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

  // Promise chain garante processamento sequencial entre chunks
  // Evita race condition quando múltiplos chunks chegam antes do anterior terminar
  let processing = Promise.resolve();

  stream.on("data", (chunk: Buffer | string) => {
    const data = chunk.toString();
    logger.debug(`EMAIL-PROCESSOR - Recebidos ${data.length} bytes`);
    
    buffer += data;
    
    // Processa emails quando encontra uma linha vazia dupla (fim do email)
    // ou quando o buffer fica muito grande
    const parts = buffer.split(/\n\n\n/); // Três quebras = separador entre emails
    
    if (parts.length > 1) {
      // Enfileira processamento sequencial de todos os emails completos
      for (let i = 0; i < parts.length - 1; i++) {
        const emailRaw = parts[i].trim();
        if (emailRaw) {
          processing = processing.then(async () => {
            try {
              logger.info(`EMAIL-PROCESSOR - Processando email (${emailRaw.length} bytes)`);
              const emailData = await parseRawEmail(emailRaw);
              await processAndPersistEmail(emailData);
              logger.info(`EMAIL-PROCESSOR - Email processado com sucesso`);
            } catch (error) {
              logger.error(`EMAIL-PROCESSOR - Erro no processamento: ${(error as Error).message}`);
            }
          });
        }
      }
      // Mantém a última parte (incompleta) no buffer
      buffer = parts[parts.length - 1];
    }
  });

  stream.on("end", () => {
    // Aguarda fila terminar, depois processa buffer restante e reabre
    processing = processing.then(async () => {
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

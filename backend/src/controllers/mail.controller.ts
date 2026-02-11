import { Request, Response } from "express";
import { findUserByEmail, generateToken } from "../services/user.service";
import {
  findOrCreateEmailBox,
  getLatestEmailBySubjectService,
} from "../services/emailBox.service";
import { saveEmail } from "../services/email.service";
import logger from "../utils/logger";
import { parseBody, rewriteLinks } from "../utils/bodyParser";
import { getLatestEmailFromBox } from "../services/email.service";
import { extractEmail as extractEmailUtil } from "../utils/emailParser";
import Email from "../models/Email";
import EmailBox from "../models/EmailBox";
import {
  getFromCache,
  setInCache,
  getUserEmailsCacheKey,
  invalidateUserEmailsCache,
  invalidateUserBoxesCache,
  invalidateBoxEmailsCache,
  CACHE_TTL,
} from "../services/cache.service";

// Function to extract email from `from` field
const extractEmail = (rawFrom: string): string => {
  try {
    return extractEmailUtil(rawFrom);
  } catch (error) {
    logger.warn(`UTILS-EXTRACT - Failed to extract email from: ${rawFrom}`);
    throw new Error("Invalid email format in 'from' field");
  }
};

// Function to extract token from subject
const extractTokenSubject = (subject: string): string => {
  const match = subject.match(/Token:\s*([A-Z0-9]+)/i);
  if (!match) {
    logger.warn(
      `UTILS-EXTRACT - Falha ao extrair token do assunto: ${subject}`
    );
    return subject; // Retorna o subject original se não encontrar o padrão
  }
  return match[1]; // Retorna apenas o token (QRGSNX)
};

/**
 * Controller to process incoming emails.
 */
export const processMail = async (req: Request, res: Response) => {
  logger.info("CONTROL-MAIL - Request received:", req.body);

  try {
    // Destructure and validate payload
    const {
      from: rawFrom,
      to,
      subject,
      body: rawHtml,
      id,
      date,
      content_type,
      processed_at,
    } = req.body;

    if (
      !rawFrom ||
      !to ||
      !subject ||
      typeof rawHtml !== "string" ||
      rawHtml.trim() === ""
    ) {
      logger.warn(
        "CONTROL-MAIL - Missing or invalid required fields in payload."
      );
      return res.status(400).json({
        message: "Missing or invalid required fields in payload.",
      });
    }

    // Extract and validate email
    let from: string;
    try {
      from = extractEmail(rawFrom);
    } catch (error) {
      logger.warn(`CONTROL-MAIL - Invalid 'from' field: ${rawFrom}`);
      return res.status(400).json({
        message: "Invalid 'from' field.",
      });
    }

    // Find user by email
    let user;
    try {
      user = await findUserByEmail(from);
    } catch (error) {
      logger.error(
        `SERVICE-USER - Error while finding user: ${(error as Error).message}`
      );
      throw new Error("Internal server error while validating user.");
    }

    if (!user) {
      logger.warn(`CONTROL-MAIL - User not found for email: ${from}`);
      return res.status(401).json({
        message:
          "User not found. Please register, log in, and provide a valid token.",
      });
    }

    // Validar e processar o corpo do e-mail
    let parsedBody;
    try {
      if (typeof rawHtml !== "string" || rawHtml.trim() === "") {
        logger.warn("CONTROL-MAIL - Campo 'body' inválido ou vazio.");
        return res.status(400).json({
          message: "CONTROL-MAIL - Campo 'body' inválido ou vazio.",
        });
      }

      parsedBody = parseBody(rawHtml);
    } catch (error) {
      logger.error(
        `UTILS-BODYPARSER - Error parsing email body: ${
          (error as Error).message
        }`
      );
      return res.status(400).json({
        message: "CONTROL-MAIL - Falha ao processar o corpo do e-mail.",
      });
    }

    // Associate or create email box
    let emailBox;
    try {
      emailBox = await findOrCreateEmailBox(to, user.id);
    } catch (error) {
      logger.error(
        `SERVICE-EMAILBOX - Error creating or finding email box: ${
          (error as Error).message
        }`
      );
      throw new Error("Internal server error while processing email box.");
    }

    // Verificar limite diário ANTES de salvar o email
    try {
      const { incrementUserDailyUsage } = await import("../middlewares/dailyUserLimit");
      const hasQuota = await incrementUserDailyUsage(user.id);
      if (!hasQuota) {
        logger.warn(
          `CONTROL-MAIL - Usuário ${user.id} excedeu limite diário. Email rejeitado: FROM=${from}, TO=${to}`
        );
        return res.status(429).json({
          message: "Daily usage limit exceeded.",
        });
      }
    } catch (usageError) {
      // fail-open: se falhar ao verificar limite, permite o email
      logger.warn(`CONTROL-MAIL - Failed to check daily usage: ${(usageError as Error).message}`);
    }

    // Generate token
    const token = extractTokenSubject(subject);

    // Save email
    let email;

    try {
      email = await saveEmail({
        from,
        to,
        subject,
        body: {
          rawHtml: parsedBody.rawHtml,
          plainText: parsedBody.plainText,
          metadata: { links: parsedBody.links, images: parsedBody.images },
        },
        id,
        date,
        token,
        content_type,
        processed_at,
        emailBox: emailBox.id,
      });
    } catch (error) {
      logger.error(
        `SERVICE-EMAIL - Error saving email: ${(error as Error).message}`
      );
      throw new Error("Internal server error while saving email.");
    }

    // Inject tracking pixel and rewrite links
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const emailIdStr = email._id.toString();
      let trackedHtml = parsedBody.rawHtml;
      // Rewrite links for click tracking
      trackedHtml = rewriteLinks(trackedHtml, emailIdStr, baseUrl);
      // Inject open tracking pixel before </body> or at end
      const pixelTag = `<img src="${baseUrl}/api/mail/track/open/${emailIdStr}" width="1" height="1" style="display:none" alt="" />`;
      if (trackedHtml.includes("</body>")) {
        trackedHtml = trackedHtml.replace("</body>", `${pixelTag}</body>`);
      } else {
        trackedHtml += pixelTag;
      }
      await Email.updateOne({ _id: emailIdStr }, { "body.rawHtml": trackedHtml });
      logger.info(`CONTROL-MAIL - Tracking injected for email ${emailIdStr}`);
    } catch (trackError) {
      logger.warn(`CONTROL-MAIL - Failed to inject tracking: ${(trackError as Error).message}`);
    }

    // Invalidate cache so frontend sees updated counts
    try {
      await invalidateUserEmailsCache(user.id);
      await invalidateUserBoxesCache(user.id);
      await invalidateBoxEmailsCache(emailBox.id);
      logger.info(`CONTROL-MAIL - Cache invalidated for user ${user.id} and box ${emailBox.id}`);
    } catch (cacheError) {
      logger.warn(
        `CONTROL-MAIL - Failed to invalidate cache: ${(cacheError as Error).message}`
      );
      // Don't fail the request if cache invalidation fails
    }

    // Disparar webhooks para evento de email recebido
    try {
      const { triggerWebhooks } = await import("../services/webhook.service");
      const { WebhookEvent } = await import("../models/Webhook");
      await triggerWebhooks(user.id, WebhookEvent.EMAIL_RECEIVED, {
        emailId: email._id.toString(),
        from,
        to,
        subject,
        date,
        boxId: emailBox.id,
      });
    } catch (webhookError) {
      logger.warn(
        `CONTROL-MAIL - Failed to trigger webhooks: ${(webhookError as Error).message}`
      );
    }

    logger.info(
      `CONTROL-MAIL - Email processed successfully for user ${user.id}`
    );
    return res
      .status(201)
      .json({ message: "Email processed successfully", email });
  } catch (error) {
    logger.error(
      `CONTROL-MAIL - Unexpected error: ${(error as Error).message}`
    );
    return res.status(500).json({
      message: "Internal server error while processing the email.",
    });
  }
};

export const getLatestEmail = async (req: Request, res: Response) => {
  const { address } = req.params;
  const { from } = req.query;

  try {
    if (!from) {
      logger.warn('CONTROL-MAIL - Campo "from" não fornecido');
      return res.status(400).json({ message: 'Campo "from" é obrigatório' });
    }

    // Busca o email mais recente usando o service
    const latestEmail = await getLatestEmailFromBox(address, from as string);

    return res.status(200).json({ email: latestEmail });
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (
      errorMessage.includes("não encontrada") ||
      errorMessage.includes("Nenhum email")
    ) {
      return res.status(404).json({ message: errorMessage });
    }

    logger.error(`CONTROL-MAIL - Erro ao buscar último email: ${errorMessage}`);
    return res.status(500).json({ message: "Erro ao buscar último email" });
  }
};

// Função para obter o e-mail mais novo por assunto
export const getLatestEmailBySubject = async (req: Request, res: Response) => {
  const { address, subject } = req.params;
  const userEmail = req.query.from as string; // Capturando o e-mail do remetente a partir da query

  logger.info(
    `CONTROL-MAIL - Buscando e-mail mais recente por assunto: ${subject} para o usuário: ${userEmail} e endereço: ${address}`
  );

  if (!userEmail) {
    return res
      .status(400)
      .json({ message: "O parâmetro 'from' é obrigatório." });
  }

  try {
    const emailSubject = await getLatestEmailBySubjectService(
      userEmail,
      address,
      subject
    );
    if (!emailSubject) {
      logger.warn(
        `CONTROL-MAIL - E-mail não encontrado para o assunto: ${subject}`
      );
      return res.status(404).json({ message: "E-mail não encontrado." });
    }
    return res.status(200).json({ email: emailSubject });
  } catch (error) {
    logger.error(
      `MAIL-ROUTE - Erro ao obter e-mail por assunto: ${
        (error as Error).message
      }`
    );
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
};


/**
 * List all emails for the authenticated user (across all boxes)
 */
export const listEmails = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || "").trim();
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const hasAttachments = req.query.hasAttachments as string;
    const sortParam = (req.query.sort as string || "date_desc").toLowerCase();

    // Try to get from cache first
    const cacheKey = getUserEmailsCacheKey(userId.toString(), page, limit, search || undefined);
    // Skip cache when advanced filters are active
    const useCache = !dateFrom && !dateTo && !hasAttachments && sortParam === "date_desc";

    if (useCache) {
      const cached = await getFromCache<{
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(cacheKey);

      if (cached) {
        logger.info(`CONTROL-MAIL - Cache HIT for user ${userId} emails (page ${page}, search=${search || 'none'})`);
        return res.status(200).json({ success: true, ...cached });
      }
    }

    // Get user's boxes
    const userBoxes = await EmailBox.find({ userId }).select('address').lean();
    const boxAddresses = userBoxes.map(box => box.address);

    if (boxAddresses.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Build filter
    const filter: any = { to: { $in: boxAddresses } };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { from: { $regex: escaped, $options: 'i' } },
        { to: { $regex: escaped, $options: 'i' } },
        { subject: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    // Attachments filter
    if (hasAttachments === 'true') {
      filter['attachments.0'] = { $exists: true };
    } else if (hasAttachments === 'false') {
      filter['attachments.0'] = { $exists: false };
    }

    // Sort
    const sortMap: Record<string, any> = {
      date_desc: { date: -1, processedAt: -1 },
      date_asc: { date: 1, processedAt: 1 },
    };
    const sort = sortMap[sortParam] || sortMap.date_desc;

    const [emails, total] = await Promise.all([
      Email.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('from to subject date processedAt attachments readAt')
        .lean(),
      Email.countDocuments(filter),
    ]);

    const formattedEmails = emails.map((email: any) => ({
      id: email._id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      receivedAt: email.date || email.processedAt,
      boxAddress: email.to,
      hasAttachments: Array.isArray(email.attachments) && email.attachments.length > 0,
      read: !!email.readAt,
    }));

    const responseData = {
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache only default queries
    if (useCache) {
      await setInCache(cacheKey, responseData, CACHE_TTL.SHORT);
    }

    logger.info(`CONTROL-MAIL - Listed ${emails.length} emails for user ${userId}${search ? ` (search: ${search})` : ''}`);
    res.status(200).json({
      success: true,
      ...responseData,
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error listing emails: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};;

/**
 * Export emails as JSON or CSV.
 */
export const exportEmails = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const format = (req.query.format as string || "json").toLowerCase();
    if (!["json", "csv"].includes(format)) {
      return res.status(400).json({ success: false, message: "Format must be 'json' or 'csv'" });
    }

    const search = (req.query.search as string || "").trim();
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 1000), 5000);

    // Get user's boxes
    const userBoxes = await EmailBox.find({ userId }).select("address").lean();
    const boxAddresses = userBoxes.map(box => box.address);

    if (boxAddresses.length === 0) {
      if (format === "csv") {
        res.set({ "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=emails.csv" });
        return res.send("id,from,to,subject,date,boxAddress\n");
      }
      return res.json([]);
    }

    const filter: any = { to: { $in: boxAddresses } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { from: { $regex: escaped, $options: "i" } },
        { to: { $regex: escaped, $options: "i" } },
        { subject: { $regex: escaped, $options: "i" } },
      ];
    }

    const emails = await Email.find(filter)
      .sort({ date: -1, processedAt: -1 })
      .limit(limit)
      .select("from to subject date processedAt body.plainText")
      .lean();

    const rows = emails.map((email: any) => ({
      id: email._id.toString(),
      from: email.from,
      to: email.to,
      subject: email.subject,
      date: email.date || email.processedAt,
      boxAddress: email.to,
      plainText: email.body?.plainText || "",
    }));

    if (format === "csv") {
      const escapeCsv = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;
      const header = "id,from,to,subject,date,boxAddress,plainText";
      const lines = rows.map(r =>
        [r.id, r.from, r.to, r.subject, r.date, r.boxAddress, r.plainText].map(v => escapeCsv(String(v || ""))).join(",")
      );
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=mockmail-emails-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      return res.send([header, ...lines].join("\n"));
    }

    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=mockmail-emails-${new Date().toISOString().slice(0, 10)}.json`,
    });
    return res.json(rows);
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error exporting emails: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Get a single email by ID
 */
export const getEmailById = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Get user's boxes to verify ownership
    const userBoxes = await EmailBox.find({ userId }).select('address').lean();
    const boxAddresses = userBoxes.map(box => box.address);

    // Find email and verify it belongs to one of user's boxes
    const email = await Email.findOne({
      _id: id,
      to: { $in: boxAddresses }
    }).lean();

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    // Auto-mark as read on first view
    if (!(email as any).readAt) {
      await Email.updateOne({ _id: id }, { $set: { readAt: new Date() } });
    }

    // Convert Map to plain object for headers
    const headersRaw = (email as any).headers;
    let headers: Record<string, string> = {};
    if (headersRaw instanceof Map) {
      headersRaw.forEach((value: string, key: string) => { headers[key] = value; });
    } else if (headersRaw && typeof headersRaw === 'object') {
      headers = headersRaw;
    }

    logger.info(`CONTROL-MAIL - Retrieved email ${id} for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        id: email._id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        date: email.date,
        contentType: email.contentType,
        processedAt: email.processedAt,
        boxAddress: email.to,
        readAt: (email as any).readAt || new Date(),
        attachments: ((email as any).attachments || []).map((att: any) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
        })),
        tracking: {
          openedAt: (email as any).openedAt || null,
          openCount: (email as any).openCount || 0,
          clickCount: (email as any).clickCount || 0,
          clicks: (email as any).clicks || [],
        },
        headers,
      },
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error getting email: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getEmailThread = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Get user's boxes to verify ownership
    const userBoxes = await EmailBox.find({ userId }).select('address').lean();
    const boxAddresses = userBoxes.map(box => box.address);

    // Find the email and verify ownership
    const email = await Email.findOne({
      _id: id,
      to: { $in: boxAddresses }
    }).select('threadId').lean();

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const threadId = (email as any).threadId;
    if (!threadId) {
      return res.json({ success: true, data: [], threadId: null });
    }

    // Find all emails in the same thread that belong to this user
    const thread = await Email.find({
      threadId,
      to: { $in: boxAddresses }
    })
      .sort({ date: 1 })
      .select('from to subject date readAt')
      .lean();

    res.json({
      success: true,
      data: thread.map(e => ({
        id: e._id,
        from: e.from,
        to: e.to,
        subject: e.subject,
        date: e.date,
        readAt: (e as any).readAt,
      })),
      threadId,
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error getting email thread: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const forwardEmailById = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;
    const { forwardTo } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    if (!forwardTo || typeof forwardTo !== 'string') {
      return res.status(400).json({ success: false, message: "forwardTo is required" });
    }

    // Block forwarding to mockmail.dev addresses
    if (forwardTo.toLowerCase().endsWith('@mockmail.dev')) {
      return res.status(400).json({ success: false, message: "Cannot forward to @mockmail.dev addresses" });
    }

    // Rate limit: max 10 forwards per day per user
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const forwardCount = await Email.countDocuments({
      to: { $in: (await EmailBox.find({ userId }).select('address').lean()).map(b => b.address) },
      'forwardedAt': { $gte: today },
    });
    if (forwardCount >= 10) {
      return res.status(429).json({ success: false, message: "Forward limit reached (10/day)" });
    }

    // Get user's boxes to verify ownership
    const userBoxes = await EmailBox.find({ userId }).select('address').lean();
    const boxAddresses = userBoxes.map(box => box.address);

    const email = await Email.findOne({
      _id: id,
      to: { $in: boxAddresses }
    }).lean();

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const { forwardEmail } = await import("../services/mailer.service");
    await forwardEmail({
      originalFrom: email.from,
      originalTo: email.to,
      originalSubject: email.subject,
      htmlBody: email.body?.rawHtml || '',
      textBody: email.body?.plainText || '',
      forwardTo,
      forwardedBy: (user as any).email || userId.toString(),
    });

    // Mark email as forwarded
    await Email.updateOne({ _id: id }, { $set: { forwardedAt: new Date(), forwardedTo: forwardTo } });

    logger.info(`CONTROL-MAIL - Email ${id} forwarded to ${forwardTo} by user ${userId}`);
    res.json({ success: true, message: "Email forwarded successfully" });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error forwarding email: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Delete an email by ID
 */
export const deleteEmail = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Get user's boxes to verify ownership
    const userBoxes = await EmailBox.find({ userId }).select('address').lean();
    const boxAddresses = userBoxes.map(box => box.address);

    // Find and delete email
    const email = await Email.findOneAndDelete({
      _id: id,
      to: { $in: boxAddresses }
    });

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    // Find the box for this email to invalidate its cache
    const emailBox = await EmailBox.findOne({ address: email.to, userId }).select('_id').lean();

    // Invalidate user's emails and boxes cache (email count changed)
    await Promise.all([
      invalidateUserEmailsCache(userId.toString()),
      invalidateUserBoxesCache(userId.toString()),
      emailBox ? invalidateBoxEmailsCache(emailBox._id.toString()) : Promise.resolve(),
    ]);

    logger.info(`CONTROL-MAIL - Deleted email ${id} for user ${userId}`);
    res.status(200).json({
      success: true,
      message: "Email deleted successfully",
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error deleting email: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Bulk delete emails by IDs.
 */
export const bulkDeleteEmails = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { emailIds } = req.body;
    if (!Array.isArray(emailIds) || emailIds.length === 0 || emailIds.length > 100) {
      return res.status(400).json({ success: false, message: "Provide 1-100 email IDs" });
    }

    // Verify ownership
    const userBoxes = await EmailBox.find({ userId }).select("address").lean();
    const boxAddresses = userBoxes.map(box => box.address);

    const result = await Email.deleteMany({
      _id: { $in: emailIds },
      to: { $in: boxAddresses },
    });

    // Invalidate caches
    await Promise.all([
      invalidateUserEmailsCache(userId.toString()),
      invalidateUserBoxesCache(userId.toString()),
    ]);

    logger.info(`CONTROL-MAIL - Bulk deleted ${result.deletedCount}/${emailIds.length} emails for user ${userId}`);
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} emails deletados`,
      deletedCount: result.deletedCount,
      requestedCount: emailIds.length,
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error bulk deleting emails: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Download an attachment by email ID and attachment index.
 */
export const downloadAttachment = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id, index } = req.params;
    const attIndex = parseInt(index, 10);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    if (isNaN(attIndex) || attIndex < 0) {
      return res.status(400).json({ success: false, message: "Invalid attachment index" });
    }

    // Verify ownership
    const userBoxes = await EmailBox.find({ userId }).select("address").lean();
    const boxAddresses = userBoxes.map(box => box.address);

    const email = await Email.findOne({
      _id: id,
      to: { $in: boxAddresses },
    }).select("attachments").lean();

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const attachments = (email as any).attachments || [];
    if (attIndex >= attachments.length) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    const att = attachments[attIndex];
    if (!att.content) {
      return res.status(404).json({ success: false, message: "Attachment content not available" });
    }

    res.set({
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename || "file")}"`,
      "Content-Length": String(att.content.length),
    });
    return res.send(att.content);
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error downloading attachment: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Toggle read/unread status of an email.
 */
export const toggleReadStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Verify ownership
    const userBoxes = await EmailBox.find({ userId }).select("address").lean();
    const boxAddresses = userBoxes.map(box => box.address);

    const email = await Email.findOne({
      _id: id,
      to: { $in: boxAddresses },
    });

    if (!email) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const newReadAt = email.readAt ? null : new Date();
    await Email.updateOne({ _id: id }, { $set: { readAt: newReadAt } });

    // Invalidate cache
    await invalidateUserEmailsCache(userId.toString());

    logger.info(`CONTROL-MAIL - Toggled read status for email ${id}: ${newReadAt ? "read" : "unread"}`);
    res.status(200).json({
      success: true,
      data: { id, read: !!newReadAt, readAt: newReadAt },
    });
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error toggling read status: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 1x1 transparent GIF pixel (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Track email open via 1x1 pixel image.
 * Public endpoint - no auth required.
 */
export const trackEmailOpen = async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;

    const email = await Email.findById(emailId);
    if (!email) {
      // Return pixel anyway to not break email rendering
      res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
      return res.status(200).end(TRACKING_PIXEL);
    }

    // Update tracking data
    const updateData: Record<string, unknown> = { $inc: { openCount: 1 } };
    if (!email.openedAt) {
      updateData.$set = { openedAt: new Date() };
    }
    await Email.updateOne({ _id: emailId }, updateData);

    // Trigger webhook
    try {
      const emailBox = await EmailBox.findOne({ address: email.to }).select("userId").lean();
      if (emailBox) {
        const userId = (emailBox.userId as any)?.toString();
        if (userId) {
          const { triggerWebhooks } = await import("../services/webhook.service");
          const { WebhookEvent } = await import("../models/Webhook");
          await triggerWebhooks(userId, WebhookEvent.EMAIL_OPENED, {
            emailId: email._id.toString(),
            from: email.from,
            to: email.to,
            subject: email.subject,
            openCount: (email.openCount || 0) + 1,
          });
        }
      }
    } catch (webhookError) {
      logger.warn(`CONTROL-MAIL - Failed to trigger open webhook: ${(webhookError as Error).message}`);
    }

    logger.info(`CONTROL-MAIL - Email ${emailId} open tracked`);
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
    return res.status(200).end(TRACKING_PIXEL);
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error tracking email open: ${(error as Error).message}`);
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
    return res.status(200).end(TRACKING_PIXEL);
  }
};

/**
 * Track email link click and redirect to original URL.
 * Public endpoint - no auth required.
 */
export const trackEmailClick = async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;
    const url = req.query.url as string;

    if (!url) {
      return res.status(400).json({ message: "Missing 'url' query parameter" });
    }

    // Validate URL to prevent open redirect
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ message: "Invalid URL protocol" });
      }
    } catch {
      return res.status(400).json({ message: "Invalid URL" });
    }

    const email = await Email.findById(emailId);
    if (email) {
      // Register click
      await Email.updateOne(
        { _id: emailId },
        {
          $inc: { clickCount: 1 },
          $push: { clicks: { url: parsedUrl.href, clickedAt: new Date() } },
        }
      );

      // Trigger webhook
      try {
        const emailBox = await EmailBox.findOne({ address: email.to }).select("userId").lean();
        if (emailBox) {
          const userId = (emailBox.userId as any)?.toString();
          if (userId) {
            const { triggerWebhooks } = await import("../services/webhook.service");
            const { WebhookEvent } = await import("../models/Webhook");
            await triggerWebhooks(userId, WebhookEvent.EMAIL_CLICKED, {
              emailId: email._id.toString(),
              from: email.from,
              to: email.to,
              subject: email.subject,
              clickedUrl: parsedUrl.href,
              clickCount: (email.clickCount || 0) + 1,
            });
          }
        }
      } catch (webhookError) {
        logger.warn(`CONTROL-MAIL - Failed to trigger click webhook: ${(webhookError as Error).message}`);
      }

      logger.info(`CONTROL-MAIL - Email ${emailId} click tracked: ${parsedUrl.href}`);
    }

    return res.redirect(302, parsedUrl.href);
  } catch (error) {
    logger.error(`CONTROL-MAIL - Error tracking email click: ${(error as Error).message}`);
    const fallbackUrl = req.query.url as string;
    if (fallbackUrl) {
      return res.redirect(302, fallbackUrl);
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Controller to get email boxes statistics by user.
 */

/**
 * Controller to get email boxes statistics by user.
 */
export const getEmailBoxesByUser = async (req: Request, res: Response) => {
  try {
    logger.info("CONTROL-MAIL - Fetching email boxes statistics by user");

    // Agregação para obter estatísticas das caixas por usuário
    const pipeline = [
      {
        $lookup: {
          from: "users", // Nome da coleção de usuários
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $group: {
          _id: "$user.email",
          userName: { $first: "$user.name" },
          userId: { $first: "$user._id" },
          totalBoxes: { $sum: 1 },
          boxes: {
            $push: {
              address: "$address",
              createdAt: "$createdAt",
              updatedAt: "$updatedAt"
            }
          }
        }
      },
      {
        $sort: { totalBoxes: -1 } // Ordenar por número de caixas (decrescente)
      }
    ];

    const EmailBox = require("../models/EmailBox").default;
    const result: any[] = await EmailBox.aggregate(pipeline);

    // Calcular estatísticas gerais
    const totalUsers = result.length;
    const totalBoxes = result.reduce((sum: number, user: any) => sum + user.totalBoxes, 0);
    const averageBoxesPerUser = totalUsers > 0 ? parseFloat((totalBoxes / totalUsers).toFixed(2)) : 0;

    const response = {
      summary: {
        totalUsers,
        totalBoxes,
        averageBoxesPerUser
      },
      users: result.map((user: any) => ({
        email: user._id,
        name: user.userName,
        userId: user.userId,
        totalBoxes: user.totalBoxes,
        boxes: user.boxes
      }))
    };

    logger.info(`CONTROL-MAIL - Email boxes statistics fetched successfully: ${totalUsers} users, ${totalBoxes} boxes`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      `CONTROL-MAIL - Error fetching email boxes statistics: ${(error as Error).message}`
    );
    return res.status(500).json({
      message: "Internal server error while fetching email boxes statistics.",
    });
  }
};

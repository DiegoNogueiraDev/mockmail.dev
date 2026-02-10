/**
 * Rotas Internas - Não expostas publicamente
 * Usadas para comunicação entre serviços internos
 */
import { Router, Request, Response } from "express";
import crypto from "crypto";
import logger from "../utils/logger";
import { parseRawEmail, processAndPersistEmail } from "../services/emailProcessor.service";

const router = Router();

// Token interno para autenticação entre serviços
if (!process.env.INTERNAL_API_TOKEN) {
  throw new Error("FATAL: INTERNAL_API_TOKEN não configurado. Defina INTERNAL_API_TOKEN no .env");
}
const INTERNAL_TOKEN: string = process.env.INTERNAL_API_TOKEN;

/**
 * Middleware de autenticação interna
 * Verifica token no header X-Internal-Token
 */
const internalAuthMiddleware = (req: Request, res: Response, next: Function) => {
  const token = req.headers["x-internal-token"];

  if (
    !token ||
    typeof token !== "string" ||
    token.length !== INTERNAL_TOKEN.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(INTERNAL_TOKEN))
  ) {
    logger.warn(`INTERNAL-API - Tentativa de acesso não autorizado: ${req.ip}`);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
};

// Aplicar middleware em todas as rotas internas
router.use(internalAuthMiddleware);

/**
 * @route POST /internal/process-email
 * @desc Recebe email raw do distribuidor e processa
 * @access Internal only (requer X-Internal-Token)
 */
router.post("/process-email", async (req: Request, res: Response) => {
  try {
    const { rawEmail } = req.body;

    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({
        success: false,
        message: "rawEmail is required and must be a string"
      });
    }

    logger.info(`INTERNAL-API - Recebido email para processamento (${rawEmail.length} bytes)`);

    // Parseia e processa o email
    const emailData = await parseRawEmail(rawEmail);
    await processAndPersistEmail(emailData);

    logger.info(`INTERNAL-API - Email processado com sucesso: ${emailData.subject}`);

    res.status(200).json({
      success: true,
      message: "Email processed successfully",
      emailId: emailData.id
    });
  } catch (error) {
    logger.error(`INTERNAL-API - Erro ao processar email: ${(error as Error).message}`);
    res.status(500).json({
      success: false,
      message: "Error processing email"
    });
  }
});

/**
 * @route GET /internal/health
 * @desc Health check interno
 * @access Internal only
 */
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "mockmail-api",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

export default router;

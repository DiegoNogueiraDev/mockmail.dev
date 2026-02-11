import { Router } from "express";
import {
  processMail,
  getLatestEmail,
  getLatestEmailBySubject,
  getEmailBoxesByUser,
  listEmails,
  getEmailById,
  getEmailThread,
  forwardEmailById,
  deleteEmail,
  bulkDeleteEmails,
  downloadAttachment,
  toggleReadStatus,
  exportEmails,
  trackEmailOpen,
  trackEmailClick,
} from "../controllers/mail.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validateEmailRequest } from "../middlewares/validateEmailRequest";
import logger from "../utils/logger";

const emailRouter = Router();

/** @route GET /api/mail/track/open/:emailId
 *  @desc Track email open via 1x1 pixel (public, no auth)
 */
emailRouter.get("/track/open/:emailId", async (req, res, next) => {
  try {
    await trackEmailOpen(req, res);
  } catch (error) {
    next(error);
  }
});

/** @route GET /api/mail/track/click/:emailId
 *  @desc Track email link click and redirect (public, no auth)
 */
emailRouter.get("/track/click/:emailId", async (req, res, next) => {
  try {
    await trackEmailClick(req, res);
  } catch (error) {
    next(error);
  }
});

/** @route POST /api/mail/process
 *  @desc Processa e-mails recebidos, associando caixas e salvando os dados.
 *  @access Internal only (requer X-Internal-Token)
 */
emailRouter.post("/process", (req, res, next) => {
  const token = req.headers["x-internal-token"];
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (!expectedToken || !token || token !== expectedToken) {
    logger.warn(`MAIL-ROUTE - POST /api/mail/process - Acesso não autorizado: ${req.ip}`);
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}, validateEmailRequest, async (req, res, next) => {
  try {
    logger.info(`MAIL-ROUTE - POST /api/mail/process - Iniciando requisição`);
    await processMail(req, res);
    logger.info(`MAIL-ROUTE - POST /api/mail/process - Concluído com sucesso`);
  } catch (error) {
    logger.error(
      `MAIL-ROUTE - POST /api/mail/process - Erro: ${(error as Error).message}`
    );
    next(error);
  }
});

/** @route GET /api/mail/boxes-by-user
 *  @desc Retorna estatísticas de caixas temporárias agrupadas por usuário
 *  @access Private (requer autenticação)
 */
emailRouter.get("/boxes-by-user", authMiddleware, async (req, res, next) => {
  try {
    logger.info(`MAIL-ROUTE - GET /api/mail/boxes-by-user - Iniciando requisição`);
    await getEmailBoxesByUser(req, res);
    logger.info(`MAIL-ROUTE - GET /api/mail/boxes-by-user - Concluído com sucesso`);
  } catch (error) {
    logger.error(
      `MAIL-ROUTE - GET /api/mail/boxes-by-user - Erro: ${(error as Error).message}`
    );
    next(error);
  }
});

emailRouter.get("/latest/:address", authMiddleware, getLatestEmail);

emailRouter.get(
  "/latest/:address/subject/:subject",
  authMiddleware,
  getLatestEmailBySubject
);

/** @route GET /api/mail/emails
 *  @desc Lista todos os emails do usuário autenticado
 *  @access Private
 */
emailRouter.get("/emails", authMiddleware, async (req, res, next) => {
  try {
    logger.info("MAIL-ROUTE - GET /api/mail/emails - Listing emails");
    await listEmails(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - GET /api/mail/emails - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /api/mail/emails/export
 *  @desc Exporta emails em JSON ou CSV
 *  @access Private
 */
emailRouter.get("/emails/export", authMiddleware, async (req, res, next) => {
  try {
    logger.info("MAIL-ROUTE - GET /api/mail/emails/export - Exporting emails");
    await exportEmails(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - GET /api/mail/emails/export - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /api/mail/emails/:id
 *  @desc Retorna um email específico por ID
 *  @access Private
 */
emailRouter.get("/emails/:id", authMiddleware, async (req, res, next) => {
  try {
    logger.info(`MAIL-ROUTE - GET /api/mail/emails/${req.params.id} - Getting email`);
    await getEmailById(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - GET /api/mail/emails/:id - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /api/mail/emails/:id/thread
 *  @desc Retorna emails da mesma conversa/thread
 *  @access Private
 */
emailRouter.get("/emails/:id/thread", authMiddleware, async (req, res, next) => {
  try {
    await getEmailThread(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - GET /api/mail/emails/:id/thread - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /api/mail/emails/:id/forward
 *  @desc Forward email to external address
 *  @access Private
 */
emailRouter.post("/emails/:id/forward", authMiddleware, async (req, res, next) => {
  try {
    await forwardEmailById(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - POST /api/mail/emails/:id/forward - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route PATCH /api/mail/emails/:id/read
 *  @desc Toggle read/unread status
 *  @access Private
 */
emailRouter.patch("/emails/:id/read", authMiddleware, async (req, res, next) => {
  try {
    await toggleReadStatus(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - PATCH /api/mail/emails/:id/read - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /api/mail/emails/:id/attachments/:index
 *  @desc Download de anexo por índice
 *  @access Private
 */
emailRouter.get("/emails/:id/attachments/:index", authMiddleware, async (req, res, next) => {
  try {
    await downloadAttachment(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - GET /api/mail/emails/:id/attachments/:index - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /api/mail/emails/bulk-delete
 *  @desc Deleta múltiplos emails por IDs
 *  @access Private
 */
emailRouter.post("/emails/bulk-delete", authMiddleware, async (req, res, next) => {
  try {
    logger.info("MAIL-ROUTE - POST /api/mail/emails/bulk-delete");
    await bulkDeleteEmails(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - POST /api/mail/emails/bulk-delete - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route DELETE /api/mail/emails/:id
 *  @desc Deleta um email específico por ID
 *  @access Private
 */
emailRouter.delete("/emails/:id", authMiddleware, async (req, res, next) => {
  try {
    logger.info(`MAIL-ROUTE - DELETE /api/mail/emails/${req.params.id} - Deleting email`);
    await deleteEmail(req, res);
  } catch (error) {
    logger.error(`MAIL-ROUTE - DELETE /api/mail/emails/:id - Error: ${(error as Error).message}`);
    next(error);
  }
});

export default emailRouter;

import { Router } from "express";
import {
  processMail,
  getLatestEmail,
  getLatestEmailBySubject,
  getEmailBoxesByUser,
  listEmails,
  getEmailById,
  deleteEmail,
} from "../controllers/mail.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validateEmailRequest } from "../middlewares/validateEmailRequest";
import logger from "../utils/logger";

const emailRouter = Router();

/** @route POST /api/mail/process
 *  @desc Processa e-mails recebidos, associando caixas e salvando os dados.
 *  @access Private (JWT necessário)
 */
emailRouter.post("/process", validateEmailRequest, async (req, res, next) => {
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

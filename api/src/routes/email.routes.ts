import { Router } from "express";
import {
  processMail,
  getLatestEmail,
  getLatestEmailBySubject,
  getEmailBoxesByUser,
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

export default emailRouter;

import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { validateRequest } from "../middlewares/validateRequest";
// import { authLimiter } from "../middlewares/rateLimiter";
import Joi from "joi";
import logger from "../utils/logger";

const router = Router();

/** @route POST /auth/login */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

router.post(
  "/login",
  // authLimiter, // Rate limiting específico para autenticação
  validateRequest(loginSchema),
  async (req, res, next) => {
    try {
      logger.info(`ROUTE-AUTH - POST /auth/login - Iniciando requisição`);
      await login(req, res);
      logger.info(`ROUTE-AUTH - POST /auth/login - Concluído com sucesso`);
    } catch (error) {
      logger.error(`ROUTE-AUTH - POST /auth/login - Erro: ${(error as Error).message}`);
      next(error);
    }
  }
);

/** @route POST /auth/register */
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(3).required(),
});

router.post(
  "/register",
  // authLimiter, // Rate limiting específico para registro
  validateRequest(registerSchema),
  async (req, res, next) => {
    try {
      logger.info(`ROUTE-AUTH - POST /auth/register - Iniciando requisição`);
      await register(req, res);
      logger.info(`ROUTE-AUTH - POST /auth/register - Concluído com sucesso`);
    } catch (error) {
      logger.error(`ROUTE-AUTH - POST /auth/register - Erro: ${(error as Error).message}`);
      next(error);
    }
  }
);

export default router;

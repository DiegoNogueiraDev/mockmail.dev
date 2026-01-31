import { Router } from "express";
import { login, register, me, refresh, logout } from "../controllers/auth.controller";
import { validateRequest } from "../middlewares/validateRequest";
import { authLimiter } from "../middlewares/rateLimiter";
import { authMiddleware } from "../middlewares/authMiddleware";
import { refreshTokens, blacklistToken, revokeAllUserTokens } from "../services/token.service";
import Joi from "joi";
import logger from "../utils/logger";

const router = Router();

/** @route GET /auth/verify
 *  @desc Verifica se o token JWT é válido (usado pelo Watch dashboard)
 *  @access Private
 */
router.get("/verify", authMiddleware, (req, res) => {
  const user = (req as any).user;
  logger.info(`ROUTE-AUTH - GET /auth/verify - Token válido para: ${user?.email}`);
  res.json({
    valid: true,
    user: {
      id: user?._id || user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role || 'user'
    }
  });
});

/** @route GET /auth/me
 *  @desc Retorna o usuário autenticado (via httpOnly cookie ou Authorization header)
 *  @access Private
 */
router.get("/me", async (req, res, next) => {
  try {
    logger.info(`ROUTE-AUTH - GET /auth/me - Buscando usuário`);
    await me(req, res);
  } catch (error) {
    logger.error(`ROUTE-AUTH - GET /auth/me - Erro: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /auth/login */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(), // Login aceita qualquer senha (validação no banco)
});

router.post(
  "/login",
  authLimiter, // Rate limiting específico para autenticação
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
  password: Joi.string()
    .min(12)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'number')
    .pattern(/[!@#$%^&*(),.?":{}|<>]/, 'special')
    .required()
    .messages({
      'string.min': 'Password must be at least 12 characters',
      'string.pattern.name': 'Password must contain at least one {#name} character',
    }),
  name: Joi.string().min(3).max(100).required(),
});

router.post(
  "/register",
  authLimiter, // Rate limiting específico para registro
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

/** @route POST /auth/refresh
 *  @desc Renova tokens usando refresh token (body ou httpOnly cookie)
 *  @access Public (requer refresh token válido)
 */
router.post(
  "/refresh",
  authLimiter,
  async (req, res, next) => {
    try {
      logger.info(`ROUTE-AUTH - POST /auth/refresh - Tentativa de refresh`);
      await refresh(req, res);
    } catch (error) {
      logger.error(`ROUTE-AUTH - POST /auth/refresh - Erro: ${(error as Error).message}`);
      next(error);
    }
  }
);

/** @route POST /auth/logout
 *  @desc Invalida o token atual e limpa cookies
 *  @access Public (não requer autenticação para logout)
 */
router.post("/logout", async (req, res, next) => {
  try {
    logger.info(`ROUTE-AUTH - POST /auth/logout - Iniciando logout`);
    await logout(req, res);
  } catch (error) {
    logger.error(`ROUTE-AUTH - POST /auth/logout - Erro: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /auth/logout-all
 *  @desc Invalida todos os tokens do usuário
 *  @access Private
 */
router.post("/logout-all", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;

    if (userId) {
      await revokeAllUserTokens(userId);

      // Também invalidar o token atual
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      if (token) {
        await blacklistToken(token);
      }

      logger.info(`ROUTE-AUTH - POST /auth/logout-all - Todos os tokens invalidados para: ${user?.email}`);
    }

    res.json({ message: 'All sessions logged out successfully' });
  } catch (error) {
    logger.error(`ROUTE-AUTH - POST /auth/logout-all - Erro: ${(error as Error).message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// src/router.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import logger from "../utils/logger"; // Importando o logger
import emailRoutes from "./email.routes";
import emailBoxRoutes from "./emailBox.routes";
import webhookRoutes from "./webhook.routes";
import apiKeyRoutes from "./apiKey.routes";
import profileRoutes from "./profile.routes";
import { csrfTokenHandler, csrfProtection } from "../middlewares/csrfMiddleware";
import dashboardRoutes from "./dashboard.routes";
import adminRoutes from "./admin.routes";
import { dailyUserLimitMiddleware } from "../middlewares/dailyUserLimit";
import internalRoutes from "./internal.routes";

const router = Router();

// Rotas internas (sem limite diário, autenticação própria via token)
try {
  router.use("/internal", internalRoutes);
  logger.info("ROUTE-ROUTER - Rotas internas (/internal) carregadas com sucesso.");
} catch (error) {
  logger.error(`ROUTE-ROUTER - Erro ao carregar rotas internas: ${(error as Error).message}`);
}

// Aplica limite diário de 500 requisições por usuário em todas as rotas
// (exceto auth que precisa funcionar antes do login)
router.use(dailyUserLimitMiddleware);
logger.info("ROUTE-ROUTER - Middleware de limite diário (500 req/dia) configurado");

// CSRF Token endpoint (must be before CSRF protection)
router.get("/csrf-token", csrfTokenHandler);
logger.info("ROUTE-ROUTER - Endpoint CSRF token (/api/csrf-token) configurado");

// Aplica proteção CSRF em todas as rotas de mutação (POST, PUT, DELETE)
// Skips: GET/HEAD/OPTIONS, /auth/login, /auth/register, /mail/process, requests com X-Internal-Token
router.use(csrfProtection);
logger.info("ROUTE-ROUTER - Middleware CSRF protection configurado");

try {
  // Agrupando rotas de autenticação
  router.use("/auth", authRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de autenticação (/auth) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de autenticação: ${
      (error as Error).message
    }`
  );
}

try {
  // Agrupando rotas de email
  router.use("/mail", emailRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de email (/mail) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de mail: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de caixas de email
  router.use("/boxes", emailBoxRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de caixas de email (/boxes) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de boxes: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de webhooks
  router.use("/webhooks", webhookRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de webhooks (/webhooks) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de webhooks: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de API keys
  router.use("/api-keys", apiKeyRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de API keys (/api-keys) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de API keys: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de perfil
  router.use("/profile", profileRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de perfil (/profile) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de perfil: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de dashboard
  router.use("/dashboard", dashboardRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de dashboard (/dashboard) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de dashboard: ${(error as Error).message}`
  );
}

try {
  // Agrupando rotas de administração
  router.use("/admin", adminRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de administração (/admin) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de admin: ${(error as Error).message}`
  );
}

export default router;

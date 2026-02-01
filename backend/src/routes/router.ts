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

const router = Router();

// CSRF Token endpoint (must be before CSRF protection)
router.get("/csrf-token", csrfTokenHandler);
logger.info("ROUTE-ROUTER - Endpoint CSRF token (/api/csrf-token) configurado");

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

export default router;

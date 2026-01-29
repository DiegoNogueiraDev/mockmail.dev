// src/router.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import logger from "../utils/logger"; // Importando o logger
import emailRoutes from "./email.routes";
const router = Router();

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
  // Agrupando rotas de autenticação
  router.use("/mail", emailRoutes);
  logger.info(
    "ROUTE-ROUTER - Rotas de autenticação (/mail) carregadas com sucesso."
  );
} catch (error) {
  logger.error(
    `ROUTE-ROUTER - Erro ao carregar rotas de mail: ${(error as Error).message}`
  );
}

export default router;

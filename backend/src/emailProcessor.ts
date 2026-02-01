/**
 * MockMail.dev - Email Processor (Standalone)
 * 
 * Este é o entry point para o processador de emails.
 * Pode ser executado diretamente pelo PM2 ou Node.js.
 * 
 * Fluxo: Postfix → email-handler.sh → FIFO → emailProcessor.ts → MongoDB
 */
import dotenv from "dotenv";
import path from "path";

// Carrega variáveis de ambiente baseado no NODE_ENV
const envFile = process.env.NODE_ENV === "production" 
  ? ".env.homologacao" 
  : ".env";

dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

import { connectToMongoDB } from "./config/mongodb";
import logger from "./utils/logger";
import { startProcessor } from "./services/emailProcessor.service";

// IMPORTANTE: Importar os modelos para registrá-los no Mongoose
// O populate("userId") requer que o modelo User esteja registrado
import "./models/User";
import "./models/EmailBox";
import "./models/Email";

async function main(): Promise<void> {
  logger.info("═".repeat(60));
  logger.info("EMAIL-PROCESSOR - MockMail.dev Email Processor");
  logger.info("═".repeat(60));
  logger.info(`EMAIL-PROCESSOR - Ambiente: ${process.env.NODE_ENV || "development"}`);
  logger.info(`EMAIL-PROCESSOR - Arquivo .env: ${envFile}`);

  try {
    // Conecta ao MongoDB
    logger.info("EMAIL-PROCESSOR - Conectando ao MongoDB...");
    await connectToMongoDB();
    logger.info("EMAIL-PROCESSOR - MongoDB conectado com sucesso!");

    // Inicia o processador de emails
    await startProcessor();
  } catch (error) {
    logger.error(`EMAIL-PROCESSOR - Erro fatal: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Tratamento de sinais para graceful shutdown
process.on("SIGINT", () => {
  logger.info("EMAIL-PROCESSOR - Recebido SIGINT, encerrando...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("EMAIL-PROCESSOR - Recebido SIGTERM, encerrando...");
  process.exit(0);
});

// Tratamento de erros não capturados
process.on("uncaughtException", (error) => {
  logger.error(`EMAIL-PROCESSOR - Uncaught Exception: ${error.message}`);
  logger.error(error.stack || "");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`EMAIL-PROCESSOR - Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Inicia
main();

import dotenv from "dotenv";
import { validateEnv } from "../utils/validateEnv";
import logger from "../utils/logger";

// Carrega as variáveis de ambiente - .env
dotenv.config();
validateEnv();

if (!process.env.JWT_SECRET) {
  throw new Error(
    "CONFIG-ENV - JWT_SECRET não está configurada nas variáveis de ambiente"
  );
}
if (!process.env.MONGO_URI) {
  throw new Error(
    "CONFIG-ENV - MONGO_URI não está configurada nas variáveis de ambiente"
  );
}
if (!process.env.NODE_ENV) {
  throw new Error(
    "CONFIG-ENV - NODE_ENV não está configurada nas variáveis de ambiente"
  );
}

if (!process.env.PORT) {
  throw new Error(
    "CONFIG-ENV - PORT não está configurada nas variáveis de ambiente"
  );
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    "CONFIG-ENV - JWT_REFRESH_SECRET não está configurada nas variáveis de ambiente"
  );
}
if (!process.env.CSRF_SECRET) {
  throw new Error(
    "CONFIG-ENV - CSRF_SECRET não está configurada nas variáveis de ambiente"
  );
}
if (!process.env.INTERNAL_API_TOKEN) {
  throw new Error(
    "CONFIG-ENV - INTERNAL_API_TOKEN não está configurada nas variáveis de ambiente"
  );
}
logger.info("CONFIG-ENV - Variáveis de ambiente carregadas com sucesso");

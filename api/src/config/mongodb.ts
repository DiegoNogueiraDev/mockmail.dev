import mongoose from "mongoose";
import logger from "../utils/logger"; // Importação do logger

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mockmail";

export const connectToMongoDB = async (): Promise<void> => {
  try {
    logger.info("CONFIG-MONGO - Tentando conectar ao MongoDB...");


    await mongoose.connect(MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== "production", // Desativa auto-index em produção
    });

    logger.info(`CONFIG-MONGO - Conectado ao MongoDB com sucesso - URI: ${MONGO_URI}`);
  } catch (error) {
    logger.error("CONFIG-MONGO - Erro ao conectar ao MongoDB");
    logger.error(`Detalhes do erro: ${(error as Error).message}`);
    process.exit(1); // Termina o processo com erro
  }

};

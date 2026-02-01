import mongoose from "mongoose";
import logger from "../utils/logger";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mockmail";

// Mascara credenciais na URI para logs seguros
function maskUri(uri: string): string {
  try {
    // Substituir senha por asteriscos
    return uri.replace(/:([^:@]+)@/, ':****@');
  } catch {
    return 'mongodb://****@****/****';
  }
}

export const connectToMongoDB = async (): Promise<void> => {
  try {
    logger.info("CONFIG-MONGO - Tentando conectar ao MongoDB...");

    await mongoose.connect(MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== "production",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Log seguro sem expor credenciais
    logger.info(`CONFIG-MONGO - Conectado ao MongoDB com sucesso - URI: ${maskUri(MONGO_URI)}`);
  } catch (error) {
    logger.error("CONFIG-MONGO - Erro ao conectar ao MongoDB");
    // Não logar detalhes que possam expor credenciais
    logger.error(`CONFIG-MONGO - Tipo do erro: ${(error as Error).name}`);
    process.exit(1);
  }
};

// Eventos de conexão para monitoramento
mongoose.connection.on('disconnected', () => {
  logger.warn('CONFIG-MONGO - Conexão com MongoDB perdida');
});

mongoose.connection.on('reconnected', () => {
  logger.info('CONFIG-MONGO - Reconectado ao MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error(`CONFIG-MONGO - Erro na conexão: ${err.name}`);
});

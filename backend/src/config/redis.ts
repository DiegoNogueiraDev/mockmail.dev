import { createClient } from 'redis';
import logger from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export type RedisClient = ReturnType<typeof createClient>;
let redisClient: RedisClient | null = null;

export const connectToRedis = async (): Promise<RedisClient> => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on('error', (err: Error) => {
      logger.error(`CONFIG-REDIS - Erro na conexão: ${err.message}`);
    });

    redisClient.on('connect', () => {
      logger.info('CONFIG-REDIS - Conectando ao Redis...');
    });

    redisClient.on('ready', () => {
      logger.info('CONFIG-REDIS - Conexão estabelecida com sucesso');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error(`CONFIG-REDIS - Erro ao conectar: ${(error as Error).message}`);
    throw error;
  }
};

export const getRedisClient = (): RedisClient | null => {
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
    logger.info('CONFIG-REDIS - Desconectado com sucesso');
  }
};

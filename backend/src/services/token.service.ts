import jwt, { JwtPayload } from 'jsonwebtoken';
import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET não configurado. Defina JWT_SECRET no .env");
}
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';

// Token durations
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutos
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 dias
const BLACKLIST_PREFIX = 'token:blacklist:';
const REFRESH_PREFIX = 'token:refresh:';

interface TokenPayload {
  id: string;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Gera par de tokens (access + refresh)
 */
export const generateTokenPair = async (userId: string): Promise<TokenPair> => {
  try {
    const accessToken = jwt.sign(
      { id: userId, type: 'access' },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { id: userId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Armazenar refresh token no Redis
    const redis = getRedisClient();
    if (redis) {
      const decoded = jwt.decode(refreshToken) as JwtPayload;
      const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60;
      await redis.setEx(`${REFRESH_PREFIX}${userId}`, ttl, refreshToken);
    }

    logger.info(`TOKEN-SERVICE - Par de tokens gerado para usuário: ${userId}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutos em segundos
    };
  } catch (error) {
    logger.error(`TOKEN-SERVICE - Erro ao gerar tokens: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Verifica se um token está na blacklist
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn('TOKEN-SERVICE - Redis não disponível, blacklist ignorada');
      return false;
    }

    const jti = getTokenIdentifier(token);
    const exists = await redis.exists(`${BLACKLIST_PREFIX}${jti}`);
    return exists === 1;
  } catch (error) {
    logger.error(`TOKEN-SERVICE - Erro ao verificar blacklist: ${(error as Error).message}`);
    return false;
  }
};

/**
 * Adiciona token à blacklist (logout)
 */
export const blacklistToken = async (token: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn('TOKEN-SERVICE - Redis não disponível, token não adicionado à blacklist');
      return;
    }

    const decoded = jwt.decode(token) as JwtPayload;
    if (!decoded?.exp) {
      logger.warn('TOKEN-SERVICE - Token sem expiração, não será adicionado à blacklist');
      return;
    }

    const jti = getTokenIdentifier(token);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await redis.setEx(`${BLACKLIST_PREFIX}${jti}`, ttl, 'revoked');
      logger.info(`TOKEN-SERVICE - Token adicionado à blacklist (TTL: ${ttl}s)`);
    }
  } catch (error) {
    logger.error(`TOKEN-SERVICE - Erro ao adicionar à blacklist: ${(error as Error).message}`);
  }
};

/**
 * Renova tokens usando refresh token
 */
export const refreshTokens = async (refreshToken: string): Promise<TokenPair | null> => {
  try {
    // Verificar se refresh token está na blacklist
    if (await isTokenBlacklisted(refreshToken)) {
      logger.warn('TOKEN-SERVICE - Tentativa de uso de refresh token revogado');
      return null;
    }

    // Verificar validade do refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;

    if (decoded.type !== 'refresh') {
      logger.warn('TOKEN-SERVICE - Token não é do tipo refresh');
      return null;
    }

    // Verificar se o refresh token ainda está armazenado no Redis
    const redis = getRedisClient();
    if (redis) {
      const storedToken = await redis.get(`${REFRESH_PREFIX}${decoded.id}`);
      if (storedToken !== refreshToken) {
        logger.warn('TOKEN-SERVICE - Refresh token não encontrado ou inválido');
        return null;
      }
    }

    // Revogar o refresh token atual
    await blacklistToken(refreshToken);

    // Gerar novo par de tokens
    return await generateTokenPair(decoded.id);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('TOKEN-SERVICE - Refresh token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('TOKEN-SERVICE - Refresh token inválido');
    } else {
      logger.error(`TOKEN-SERVICE - Erro ao renovar tokens: ${(error as Error).message}`);
    }
    return null;
  }
};

/**
 * Revoga todos os tokens de um usuário (logout de todas as sessões)
 */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    // Remover refresh token armazenado
    await redis.del(`${REFRESH_PREFIX}${userId}`);
    logger.info(`TOKEN-SERVICE - Todos os tokens do usuário ${userId} foram revogados`);
  } catch (error) {
    logger.error(`TOKEN-SERVICE - Erro ao revogar tokens: ${(error as Error).message}`);
  }
};

/**
 * Gera identificador único para o token (baseado no hash)
 */
function getTokenIdentifier(token: string): string {
  // Usa os últimos 32 caracteres do token como identificador
  return token.slice(-32);
}

/**
 * Verifica access token
 */
export const verifyAccessToken = async (token: string): Promise<TokenPayload | null> => {
  try {
    // Verificar blacklist
    if (await isTokenBlacklisted(token)) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

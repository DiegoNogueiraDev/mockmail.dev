import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

// Limite de requisições por dia por usuário
const DAILY_REQUEST_LIMIT = 500;

// Interface para o request com user (compatível com authMiddleware)
interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    _id?: string;
  };
}

/**
 * Calcula os segundos até a meia-noite (UTC)
 */
function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Gera a chave Redis para o contador diário do usuário
 */
function getDailyLimitKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `daily_limit:${userId}:${today}`;
}

/**
 * Middleware que limita requisições a 500 por dia por usuário
 * 
 * Características:
 * - Usa Redis para contagem distribuída
 * - Reset automático à meia-noite UTC
 * - Headers informativos: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * - Falha silenciosa se Redis não disponível (permite requisição)
 */
export async function dailyUserLimitMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extrai userId do req.user (compatível com authMiddleware)
  const userId = req.user?.id || req.user?._id?.toString();

  // Se não há userId (usuário não autenticado), pula o middleware
  if (!userId) {
    return next();
  }

  const redis = getRedisClient();

  // Se Redis não está disponível, permite a requisição (fail-open)
  if (!redis) {
    logger.warn('DAILY-LIMIT - Redis não disponível, permitindo requisição');
    return next();
  }

  const key = getDailyLimitKey(userId);

  try {
    // Incrementa o contador e obtém o novo valor
    const currentCount = await redis.incr(key);

    // Se é a primeira requisição do dia, define o TTL até meia-noite
    if (currentCount === 1) {
      const ttl = getSecondsUntilMidnight();
      await redis.expire(key, ttl);
    }

    // Calcula requisições restantes
    const remaining = Math.max(0, DAILY_REQUEST_LIMIT - currentCount);
    const resetTime = new Date();
    resetTime.setUTCHours(24, 0, 0, 0);

    // Adiciona headers informativos
    res.setHeader('X-RateLimit-Limit', DAILY_REQUEST_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString());
    res.setHeader('X-RateLimit-Policy', `${DAILY_REQUEST_LIMIT};w=86400`);

    // Verifica se excedeu o limite
    if (currentCount > DAILY_REQUEST_LIMIT) {
      logger.warn(`DAILY-LIMIT - Usuário ${userId} excedeu limite diário: ${currentCount}/${DAILY_REQUEST_LIMIT}`);
      
      res.status(429).json({
        success: false,
        error: 'Limite diário de requisições excedido',
        message: `Você atingiu o limite de ${DAILY_REQUEST_LIMIT} requisições por dia. O limite será resetado à meia-noite UTC.`,
        limit: DAILY_REQUEST_LIMIT,
        used: currentCount,
        remaining: 0,
        resetAt: resetTime.toISOString(),
      });
      return;
    }

    // Log a cada 100 requisições para monitoramento
    if (currentCount % 100 === 0) {
      logger.info(`DAILY-LIMIT - Usuário ${userId}: ${currentCount}/${DAILY_REQUEST_LIMIT} requisições hoje`);
    }

    next();
  } catch (error) {
    // Em caso de erro no Redis, permite a requisição (fail-open)
    logger.error(`DAILY-LIMIT - Erro ao verificar limite: ${(error as Error).message}`);
    next();
  }
}

/**
 * Função para obter o uso atual de um usuário (útil para dashboard)
 */
export async function getUserDailyUsage(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}> {
  const redis = getRedisClient();
  const key = getDailyLimitKey(userId);

  let used = 0;
  if (redis) {
    const count = await redis.get(key);
    used = count ? parseInt(count, 10) : 0;
  }

  const resetTime = new Date();
  resetTime.setUTCHours(24, 0, 0, 0);

  return {
    used,
    limit: DAILY_REQUEST_LIMIT,
    remaining: Math.max(0, DAILY_REQUEST_LIMIT - used),
    resetAt: resetTime.toISOString(),
  };
}

/**
 * Constante exportada para uso em outros lugares
 */
export const DAILY_LIMIT = DAILY_REQUEST_LIMIT;

export default dailyUserLimitMiddleware;

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

/**
 * Cria um store Redis para rate limiting, com fallback para memória
 */
const createStore = (prefix: string) => {
  const redisClient = getRedisClient();
  
  if (!redisClient) {
    logger.warn(`RATE-LIMIT - Redis não disponível para ${prefix}, usando memória (pode causar memory leak!)`);
    return undefined; // express-rate-limit usará MemoryStore por padrão
  }

  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: `rate-limit:${prefix}:`,
  });
};

/**
 * Rate limiter para endpoints de autenticação
 * Limite: 20 requisições por 15 minutos por IP
 * (Ajustado de 5 para 20 - permite uso normal sem bloqueios frequentes)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Aumentado de 5 para 20
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: createStore('auth'),
  keyGenerator: (req) => {
    // Prioriza X-Forwarded-For (HAProxy) sobre req.ip
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.ip || 'unknown';
    return ip;
  },
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    logger.warn(`RATE-LIMIT - Limite de autenticação excedido para IP: ${ip}`);
    res.status(429).json({
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip para health checks
    return req.path === '/api/health';
  }
});

/**
 * Rate limiter para criação de email boxes
 * Limite: 10 requisições por hora por IP
 */
export const emailBoxCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('emailbox'),
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.ip || 'unknown';
    return ip;
  },
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    logger.warn(`RATE-LIMIT - Limite de criação de email box excedido para IP: ${ip}`);
    res.status(429).json({
      message: 'Too many email boxes created. Please try again later.',
      retryAfter: '1 hour'
    });
  }
});

/**
 * Rate limiter geral para API
 * Limite: 100 requisições por 15 minutos por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('general'),
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.ip || 'unknown';
    return ip;
  },
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    logger.warn(`RATE-LIMIT - Limite geral excedido para IP: ${ip} em ${req.path}`);
    res.status(429).json({
      message: 'Too many requests. Please try again later.',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    return req.path === '/api/health';
  }
});

/**
 * Rate limiter estrito para operações sensíveis
 * Limite: 3 requisições por minuto por IP
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('strict'),
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.ip || 'unknown';
    return ip;
  },
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    logger.warn(`RATE-LIMIT - Limite estrito excedido para IP: ${ip} em ${req.path}`);
    res.status(429).json({
      message: 'Too many requests. Please slow down.',
      retryAfter: '1 minute'
    });
  }
});

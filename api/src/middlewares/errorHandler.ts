import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import logger from "../utils/logger";

// Erros conhecidos que podem ter mensagens seguras para o cliente
const SAFE_ERROR_CODES: Record<string, { status: number; message: string }> = {
  'VALIDATION_ERROR': { status: 400, message: 'Invalid request data' },
  'UNAUTHORIZED': { status: 401, message: 'Authentication required' },
  'FORBIDDEN': { status: 403, message: 'Access denied' },
  'NOT_FOUND': { status: 404, message: 'Resource not found' },
  'RATE_LIMITED': { status: 429, message: 'Too many requests' },
};

// Interface para erros customizados
interface AppError extends Error {
  code?: string;
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Gerar ID único para rastreamento (sem expor detalhes)
  const requestId = randomUUID().substring(0, 8);
  const ip = req.headers['x-forwarded-for'] || req.ip;

  // Log detalhado do erro (apenas no servidor)
  logger.error(`ERROR [${requestId}] - ${req.method} ${req.originalUrl} - IP: ${ip}`);
  logger.error(`ERROR [${requestId}] - Message: ${err.message}`);

  // Stack trace apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    logger.error(`ERROR [${requestId}] - Stack: ${err.stack}`);
  }

  // Verificar se é um erro conhecido/seguro
  if (err.code && SAFE_ERROR_CODES[err.code]) {
    const safeError = SAFE_ERROR_CODES[err.code];
    return res.status(safeError.status).json({
      error: safeError.message,
      requestId,
    });
  }

  // Verificar statusCode customizado
  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      error: 'Request error',
      requestId,
    });
  }

  // Resposta genérica ao cliente (sem expor detalhes internos)
  res.status(500).json({
    error: 'Internal server error',
    requestId, // ID para suporte/debug sem expor detalhes
  });
};

// Helper para criar erros seguros
export const createAppError = (
  message: string,
  code: keyof typeof SAFE_ERROR_CODES
): AppError => {
  const error: AppError = new Error(message);
  error.code = code;
  return error;
};

import { Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../types/express";
import { isTokenBlacklisted } from "../services/token.service";
import User from "../models/User";

// Carregando a chave secreta do JWT das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "MIDDLE-AUTH - JWT_SECRET não está configurada nas variáveis de ambiente"
  );
}

/**
 * Middleware para autenticar requisições usando JWT.
 * Verifica se o token é válido e não está na blacklist.
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Extraindo o token do cabeçalho Authorization
  const token = req.header("Authorization")?.replace("Bearer ", "");

  // Verificando se o token foi enviado
  if (!token) {
    logger.warn(
      `MIDDLE-AUTH - Tentativa de acesso sem token - Método: ${req.method}, Rota: ${req.originalUrl}`
    );
    return res
      .status(401)
      .json({ message: "Token não fornecido" });
  }

  try {
    // Verificar se token está na blacklist (logout)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      logger.warn(
        `MIDDLE-AUTH - Token revogado - Método: ${req.method}, Rota: ${req.originalUrl}`
      );
      return res.status(401).json({ message: "Token revogado" });
    }

    // Verificando e decodificando o token usando a chave secreta
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Buscar usuário completo para ter acesso a role e permissions
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    } else {
      req.user = decoded;
    }

    // Log informativo (sem expor dados sensíveis)
    logger.info(
      `MIDDLE-AUTH - Token válido - User ID: ${decoded.id}`
    );

    // Passa para o próximo middleware ou rota
    next();
  } catch (error) {
    // Tratamento de erros no caso de token inválido ou expirado
    if ((error as Error).name === "TokenExpiredError") {
      logger.warn(
        `MIDDLE-AUTH - Token expirado - Método: ${req.method}, Rota: ${req.originalUrl}`
      );
      return res.status(401).json({ message: "Token expirado" });
    }

    logger.error(
      `MIDDLE-AUTH - Erro ao validar token - Método: ${req.method}, Rota: ${
        req.originalUrl
      }`
    );

    return res.status(401).json({ message: "Token inválido" });
  }
};

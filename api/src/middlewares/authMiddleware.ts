import { Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import logger from "../utils/logger";
import { AuthenticatedRequest } from "../types/express";

// Carregando a chave secreta do JWT das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "MIDDLE-AUTH - JWT_SECRET não está configurada nas variáveis de ambiente"
  );
}

/**
 * Middleware para autenticar requisições usando JWT.
 *
 * @param req - Objeto da requisição HTTP.
 * @param res - Objeto da resposta HTTP.
 * @param next - Função que passa para o próximo middleware ou rota.
 */
export const authMiddleware = (
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
      .json({ message: "MIDDLE-AUTH - Token não fornecido" });
  }

  try {
    // Verificando e decodificando o token usando a chave secreta
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Adicionando o payload decodificado ao objeto da requisição
    req.user = decoded;

    // Log informativo sobre o usuário associado ao token
    logger.info(
      `MIDDLE-AUTH - Token válido - Usuário associado: ${JSON.stringify(
        decoded
      )}`
    );

    // Passa para o próximo middleware ou rota
    next();
  } catch (error) {
    // Tratamento de erros no caso de token inválido ou expirado
    if ((error as Error).name === "TokenExpiredError") {
      logger.warn(
        `MIDDLE-AUTH - Token expirado - Método: ${req.method}, Rota: ${req.originalUrl}`
      );
      return res.status(401).json({ message: "MIDDLE-AUTH - Token expirado" });
    }

    logger.error(
      `MIDDLE-AUTH - Erro ao validar token - Método: ${req.method}, Rota: ${
        req.originalUrl
      }, Erro: ${(error as Error).message}`
    );

    return res.status(401).json({ message: "MIDDLE-AUTH - Token inválido" });
  }
};

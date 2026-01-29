import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger"; // Importação do logger

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log detalhado do erro
  logger.error(`MIDDLE-ERROR - Erro na rota ${req.method} ${req.originalUrl}`);
  logger.error(`MIDDLE-ERROR - Mensagem do erro: ${err.message}`);
  logger.error(`MIDDLE-ERROR - Stack trace: ${err.stack}`);


  // Resposta ao cliente
  res.status(500).json({
    message: "MIDDLE-ERROR - Erro interno do servidor",
    details: err.message,
  });

};

import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
import logger from "../utils/logger"; // Importação do logger

export const validateRequest = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.info(
      `MIDDLE-VALIDATE - Validando requisição para a rota: ${req.method} ${req.originalUrl}`
    );

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      logger.warn(
        `MIDDLE-VALIDATE - Erro de validação na rota: ${req.method} ${req.originalUrl}`
      );
      logger.warn(
        `MIDDLE-VALIDATE - Detalhes do erro: ${JSON.stringify(error.details)}`
      );

      return res.status(400).json({
        message: "Erro de validação",
        details: error.details.map((d) => d.message),
      });
    }

    logger.info(
      `MIDDLE-VALIDATE - Requisição validada com sucesso para a rota: ${req.method} ${req.originalUrl}`
    );
    next();
  };
};

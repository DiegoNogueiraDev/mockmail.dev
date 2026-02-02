import { Request, Response, NextFunction } from "express";
import { emailSchema } from "../validations/email.validation";
import logger from "../utils/logger";

export const validateEmailRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  
  // Log do payload recebido (para debug) - apenas preview para evitar logs excessivos
  logger.debug(`MIDDLE-VALIDATE-MAIL - Payload recebido:`, {
    from: req.body.from ? `${req.body.from.substring(0, 50)}...` : 'undefined',
    to: req.body.to ? `${req.body.to.substring(0, 50)}...` : 'undefined', 
    subject: req.body.subject ? `${req.body.subject.substring(0, 50)}...` : 'undefined',
    bodyLength: req.body.body ? req.body.body.length : 0,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 100)
  });

  const { error } = emailSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
      value: detail.context?.value ? String(detail.context.value).substring(0, 100) + '...' : 'undefined'
    }));

    // CORREÇÃO: Log detalhado de validação com informações específicas
    logger.error(`MIDDLE-VALIDATE-MAIL - Erro de validação detalhado:`, {
      errors: errorDetails,
      originalPayload: {
        from: req.body.from,
        to: req.body.to,
        subject: req.body.subject,
        bodyPreview: req.body.body ? req.body.body.substring(0, 200) + '...' : null,
        contentType: req.body.content_type,
        id: req.body.id
      },
      validationTime: Date.now() - startTime,
      requestInfo: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl
      }
    });

    // Log específico para cada campo que falhou
    errorDetails.forEach(err => {
      if (err.field === 'from' || err.field === 'to') {
        logger.warn(`MIDDLE-VALIDATE-MAIL - Campo '${err.field}' rejeitado:`, {
          field: err.field,
          originalValue: req.body[err.field],
          reason: err.message,
          containsDangerousChars: req.body[err.field] && /[<>]/.test(req.body[err.field]),
          length: req.body[err.field] ? req.body[err.field].length : 0
        });
      }
    });

    return res.status(400).json({
      message: "Erro de validação",
      errors: errorDetails.map(err => ({
        field: err.field,
        message: err.message
      })),
      timestamp: new Date().toISOString(),
      requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }

  // Log de sucesso com métricas
  logger.info(`MIDDLE-VALIDATE-MAIL - Payload validado com sucesso:`, {
    from: req.body.from ? req.body.from.substring(0, 50) + '...' : null,
    to: req.body.to ? req.body.to.substring(0, 50) + '...' : null,
    subject: req.body.subject ? req.body.subject.substring(0, 50) + '...' : null,
    bodyLength: req.body.body ? req.body.body.length : 0,
    validationTime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
  
  next();
};

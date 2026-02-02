// src/utils/logger.ts
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    // Rotação diária de logs - previne crescimento indefinido
    new DailyRotateFile({
      filename: "logs/server-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",      // Máximo 20MB por arquivo
      maxFiles: "7d",      // Mantém últimos 7 dias
      zippedArchive: true, // Comprime arquivos antigos
    }),
  ],
});;

export default logger;

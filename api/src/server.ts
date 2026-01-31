// server.ts - MockMail API Server com Segurança Reforçada
import "./config/env";
import express from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import { connectToMongoDB } from "./config/mongodb";
import { connectToRedis } from "./config/redis";
import { errorHandler } from "./middlewares/errorHandler";
import cors from "cors";
import router from "./routes/router";
import "./tasks/cleanupTask";
import { cleanupOldEmails } from "./tasks/cleanupTask";
import logger from "./utils/logger";
import { sanitizeMiddleware } from "./utils/sanitize";
import { generalLimiter } from "./middlewares/rateLimiter";
import { healthCheck, readinessCheck, livenessCheck } from "./middlewares/healthCheck";

const app = express();

app.set("trust proxy", true);

logger.info("=== Iniciando MockMail API Server ===");

// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Para compatibilidade
}));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
logger.info("✓ Helmet security headers ativado");

// NoSQL Injection Prevention
app.use(mongoSanitize());
logger.info("✓ MongoDB sanitization ativado");

// HTTP Parameter Pollution Prevention
app.use(hpp());
logger.info("✓ HPP protection ativado");

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie Parser (required for CSRF and httpOnly auth cookies)
app.use(cookieParser());
logger.info("✓ Cookie parser ativado");

// CORS
const allowedOrigins = [
  "https://mockmail.dev",
  "https://watch.mockmail.dev",
  "http://localhost:3000",
  "http://localhost:3001"
];

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
logger.info("✓ CORS configurado");

// Rate Limiting
app.use(generalLimiter);
logger.info("✓ Rate limiting ativado");

// Sanitização
app.use(sanitizeMiddleware);
logger.info("✓ Sanitização ativada");

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.ip;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel](`${req.method} ${req.originalUrl} - ${res.statusCode} - IP: ${ip} - ${duration}ms`);
  });
  
  next();
});

// Health Checks
app.get("/api/health", healthCheck);
app.get("/api/ready", readinessCheck);
app.get("/api/alive", livenessCheck);

logger.info("✓ Health checks configurados");

// Rotas
app.use("/api", router);
logger.info("✓ Rotas configuradas");

// Cleanup Test
app.get("/test-cleanup", async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: "Endpoint disponível apenas em desenvolvimento" });
    }
    await cleanupOldEmails();
    res.status(200).json({ message: "Limpeza executada com sucesso" });
  } catch (error) {
    logger.error(`TEST-CLEANUP - Erro: ${(error as Error).message}`);
    res.status(500).json({ message: "Erro ao executar limpeza" });
  }
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Inicializar conexões
async function startServer() {
  try {
    // Conectar ao MongoDB
    await connectToMongoDB();
    logger.info("✓ MongoDB conectado");

    // Conectar ao Redis (opcional - para token blacklist)
    try {
      await connectToRedis();
      logger.info("✓ Redis conectado");
    } catch (redisError) {
      logger.warn(`⚠ Redis não disponível: ${(redisError as Error).message}`);
      logger.warn("⚠ Token blacklist desabilitada");
    }

    app.listen(PORT, () => {
      logger.info("=".repeat(60));
      logger.info(`✓ Servidor rodando na porta ${PORT}`);
      logger.info(`✓ Ambiente: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`✓ Health: http://localhost:${PORT}/api/health`);
      logger.info("=".repeat(60));
    });
  } catch (err) {
    logger.error(`✗ Erro ao iniciar servidor: ${(err as Error).message}`);
    process.exit(1);
  }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;

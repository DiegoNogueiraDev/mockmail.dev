import { Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    api: ServiceStatus;
    mongodb: ServiceStatus;
    memory: MemoryStatus;
  };
}

interface ServiceStatus {
  status: 'ok' | 'error' | 'degraded';
  message?: string;
  responseTime?: number;
}

interface MemoryStatus {
  status: 'ok' | 'warning' | 'critical';
  used: string;
  total: string;
  percentage: number;
}

const checkMongoDBHealth = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  
  try {
    const state = mongoose.connection.readyState;
    const responseTime = Date.now() - start;
    
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
      // Não fazemos ping aqui pois pode falhar por timeout e causar falsos negativos
      // O readyState === 1 já indica que a conexão está ativa
      return {
        status: 'ok',
        message: 'Connected',
        responseTime
      };
    } else if (state === 2) {
      return {
        status: 'degraded',
        message: 'Connecting',
        responseTime
      };
    } else {
      return {
        status: 'error',
        message: state === 0 ? 'Disconnected' : 'Disconnecting',
        responseTime
      };
    }
  } catch (error) {
    logger.error(`HEALTH-CHECK - Erro ao verificar MongoDB: ${(error as Error).message}`);
    return {
      status: 'error',
      message: (error as Error).message,
      responseTime: Date.now() - start
    };
  }
};

const checkMemoryHealth = (): MemoryStatus => {
  const usage = process.memoryUsage();
  
  // Usar RSS (Resident Set Size) que é mais estável que heapUsed/heapTotal
  // RSS representa a memória física real usada pelo processo
  const rssMemory = usage.rss;
  
  // Limite configurável via env (default: 512MB para corresponder ao --max-old-space-size)
  const memoryLimitMB = parseInt(process.env.MEMORY_LIMIT_MB || '512', 10);
  const memoryLimitBytes = memoryLimitMB * 1024 * 1024;
  
  const percentage = Math.round((rssMemory / memoryLimitBytes) * 100);
  
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  
  // Thresholds mais relaxados para evitar falsos positivos
  // 85% warning, 95% critical
  if (percentage > 95) {
    status = 'critical';
  } else if (percentage > 85) {
    status = 'warning';
  }
  
  return {
    status,
    used: `${Math.round(rssMemory / 1024 / 1024)}MB`,
    total: `${memoryLimitMB}MB`,
    percentage: Math.min(percentage, 100) // Cap at 100% for display
  };
};

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const mongoHealth = await checkMongoDBHealth();
    const memoryHealth = checkMemoryHealth();
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (mongoHealth.status === 'error' || memoryHealth.status === 'critical') {
      overallStatus = 'unhealthy';
    } else if (mongoHealth.status === 'degraded' || memoryHealth.status === 'warning') {
      overallStatus = 'degraded';
    }
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: require('../../package.json').version || 'unknown',
      services: {
        api: {
          status: 'ok',
          message: 'Running'
        },
        mongodb: mongoHealth,
        memory: memoryHealth
      }
    };
    
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    logger.error(`HEALTH-CHECK - Erro: ${(error as Error).message}`);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};

export const readinessCheck = async (req: Request, res: Response) => {
  try {
    // Verifica apenas o readyState do mongoose (mais rápido e confiável)
    const state = mongoose.connection.readyState;
    
    if (state === 1) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Database not ready' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Service not ready' });
  }
};

export const livenessCheck = (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
};

export default {
  healthCheck,
  readinessCheck,
  livenessCheck
};

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
    
    if (state === 1) {
      // Verifica se db está disponível antes de usar
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
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
        message: 'Disconnected',
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
  const totalMemory = usage.heapTotal;
  const usedMemory = usage.heapUsed;
  const percentage = Math.round((usedMemory / totalMemory) * 100);
  
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (percentage > 90) {
    status = 'critical';
  } else if (percentage > 75) {
    status = 'warning';
  }
  
  return {
    status,
    used: `${Math.round(usedMemory / 1024 / 1024)}MB`,
    total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
    percentage
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
    const mongoHealth = await checkMongoDBHealth();
    
    if (mongoHealth.status === 'ok') {
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

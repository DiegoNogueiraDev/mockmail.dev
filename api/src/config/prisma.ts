/**
 * Prisma Client Configuration
 *
 * Singleton pattern to ensure a single database connection instance.
 * Handles development hot-reload scenarios and production optimizations.
 */

import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

// Declare global variable for development hot-reload
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with logging configuration
const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [
          { emit: 'event', level: 'error' },
        ],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      logger.debug(`PRISMA Query: ${e.query}`, {
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  // Log errors
  client.$on('error', (e) => {
    logger.error('PRISMA Error:', e);
  });

  // Log warnings
  client.$on('warn', (e) => {
    logger.warn('PRISMA Warning:', e);
  });

  return client;
};

// Singleton instance
export const prisma = global.prisma ?? createPrismaClient();

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('PRISMA: Disconnecting from database...');
  await prisma.$disconnect();
});

export default prisma;

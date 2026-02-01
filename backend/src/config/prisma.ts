/**
 * Prisma Client Configuration - DESATIVADO
 *
 * Este arquivo foi desativado pois o PostgreSQL foi removido do projeto.
 * O sistema agora usa exclusivamente MongoDB (Mongoose) para persistência.
 *
 * Para reativar no futuro:
 * 1. Adicionar PostgreSQL ao docker-compose
 * 2. Descomentar o código abaixo
 * 3. Adicionar POSTGRES_URI ao .env
 * 4. Executar: npx prisma migrate deploy
 */

// import { PrismaClient, Prisma } from '../generated/prisma';
// import logger from '../utils/logger';

// declare global {
//   var prisma: PrismaClient | undefined;
// }

// const createPrismaClient = (): PrismaClient => {
//   const client = new PrismaClient({
//     log: process.env.NODE_ENV === 'development'
//       ? [
//           { emit: 'event', level: 'query' },
//           { emit: 'event', level: 'error' },
//           { emit: 'event', level: 'warn' },
//         ]
//       : [
//           { emit: 'event', level: 'error' },
//         ],
//   });

//   if (process.env.NODE_ENV === 'development') {
//     client.$on('query', (e: Prisma.QueryEvent) => {
//       logger.debug(`PRISMA Query: ${e.query}`, {
//         params: e.params,
//         duration: `${e.duration}ms`,
//       });
//     });
//   }

//   client.$on('error', (e: Prisma.LogEvent) => {
//     logger.error('PRISMA Error:', e);
//   });

//   client.$on('warn', (e: Prisma.LogEvent) => {
//     logger.warn('PRISMA Warning:', e);
//   });

//   return client;
// };

// export const prisma = global.prisma ?? createPrismaClient();

// if (process.env.NODE_ENV !== 'production') {
//   global.prisma = prisma;
// }

// process.on('beforeExit', async () => {
//   logger.info('PRISMA: Disconnecting from database...');
//   await prisma.$disconnect();
// });

// export default prisma;

// Placeholder export para evitar erros de importação
export const prisma = null;
export default prisma;

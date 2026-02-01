import cron from "node-cron";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import logger from "../utils/logger";

/**
 * Limpa emails órfãos - emails cujas caixas foram deletadas pelo TTL do MongoDB.
 *
 * Quando o TTL do MongoDB deleta uma EmailBox automaticamente (quando expiresAt < now),
 * os emails associados ficam órfãos no banco. Esta função remove esses emails.
 */
export const cleanupOrphanEmails = async (): Promise<number> => {
  try {
    // Buscar todos os endereços de caixas existentes
    const existingBoxAddresses = await EmailBox.distinct("address");

    // Deletar emails cujo "to" não corresponde a nenhuma caixa existente
    const result = await Email.deleteMany({
      to: { $nin: existingBoxAddresses }
    });

    if (result.deletedCount > 0) {
      logger.info(`CLEANUP - ${result.deletedCount} emails órfãos removidos`);
    }

    return result.deletedCount;
  } catch (error) {
    logger.error(`CLEANUP - Erro ao limpar emails órfãos: ${(error as Error).message}`);
    return 0;
  }
};

/**
 * Cleanup de emails muito antigos como failsafe.
 * Isso garante que emails não fiquem indefinidamente caso algo falhe.
 *
 * Remove emails com mais de 48 horas (buffer de segurança além das 24h da caixa).
 */
export const cleanupOldEmails = async (): Promise<number> => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const result = await Email.deleteMany({
      createdAt: { $lt: fortyEightHoursAgo }
    });

    if (result.deletedCount > 0) {
      logger.info(`CLEANUP - ${result.deletedCount} emails antigos (>48h) removidos`);
    }

    return result.deletedCount;
  } catch (error) {
    logger.error(`CLEANUP - Erro ao limpar emails antigos: ${(error as Error).message}`);
    return 0;
  }
};

/**
 * Executa todas as tarefas de limpeza
 */
export const runCleanup = async () => {
  logger.info("CLEANUP - Iniciando tarefas de limpeza...");

  const orphansDeleted = await cleanupOrphanEmails();
  const oldDeleted = await cleanupOldEmails();

  logger.info(`CLEANUP - Limpeza concluída. Órfãos: ${orphansDeleted}, Antigos: ${oldDeleted}`);
};

// Agendar a tarefa para ser executada a cada 15 minutos
// Mais frequente para garantir que emails órfãos não acumulem
cron.schedule("*/15 * * * *", runCleanup);

// Exportar para uso em testes ou execução manual
export default { cleanupOrphanEmails, cleanupOldEmails, runCleanup };

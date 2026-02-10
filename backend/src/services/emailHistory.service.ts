import EmailHistory, { IEmailHistory, IArchivedEmail } from "../models/EmailHistory";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import User from "../models/User";
import logger from "../utils/logger";

/**
 * Serviço de histórico de emails
 *
 * Responsável por arquivar emails de caixas expiradas e
 * fornecer acesso ao histórico para administradores.
 */

/**
 * Arquiva todos os emails de uma caixa expirada
 * Move os emails para EmailHistory e deleta os originais
 */
export const archiveExpiredBoxEmails = async (
  boxId: string,
  reason: 'expired' | 'manual' | 'system' = 'expired'
): Promise<IEmailHistory | null> => {
  try {
    const box = await EmailBox.findById(boxId).lean();
    if (!box) {
      logger.warn(`SERVICE-HISTORY - Caixa não encontrada: ${boxId}`);
      return null;
    }

    const user = await User.findById(box.userId).lean();
    if (!user) {
      logger.warn(`SERVICE-HISTORY - Usuário não encontrado para caixa: ${boxId}`);
      return null;
    }

    // Buscar todos os emails da caixa
    const emails = await Email.find({ emailBox: boxId }).lean();

    if (emails.length === 0) {
      logger.info(`SERVICE-HISTORY - Caixa ${box.address} sem emails para arquivar`);
      return null;
    }

    // Converter emails para formato de arquivo
    const archivedEmails: IArchivedEmail[] = emails.map((email: any) => ({
      originalId: email._id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      date: email.date,
      token: email.token,
      contentType: email.contentType,
      processedAt: email.processedAt,
      originalCreatedAt: email.createdAt,
    }));

    // Extrair remetentes únicos
    const uniqueSenders = [...new Set(emails.map((e: any) => e.from))];

    // Criar documento de histórico
    const history = new EmailHistory({
      boxId: box._id,
      boxAddress: box.address,
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      emails: archivedEmails,
      emailCount: emails.length,
      archivedAt: new Date(),
      expirationReason: reason,
      boxCreatedAt: box.createdAt,
      boxExpiredAt: box.expiresAt || new Date(),
      totalEmailsReceived: emails.length,
      uniqueSenders,
    });

    await history.save();

    // Deletar emails originais
    const deleteResult = await Email.deleteMany({ emailBox: boxId });

    logger.info(
      `SERVICE-HISTORY - Arquivados ${emails.length} emails da caixa ${box.address}. ` +
      `Deletados: ${deleteResult.deletedCount}. History ID: ${history._id}`
    );

    return history;
  } catch (error) {
    logger.error(`SERVICE-HISTORY - Erro ao arquivar emails: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Processa todas as caixas expiradas e arquiva seus emails
 * Deve ser executado periodicamente (cron job)
 */
export const processExpiredBoxes = async (): Promise<{
  processed: number;
  archived: number;
  errors: number;
}> => {
  const stats = { processed: 0, archived: 0, errors: 0 };

  try {
    const now = new Date();

    // Buscar caixas expiradas que ainda têm emails
    const expiredBoxes = await EmailBox.find({
      expiresAt: { $exists: true, $lt: now }
    }).lean();

    logger.info(`SERVICE-HISTORY - Encontradas ${expiredBoxes.length} caixas expiradas`);

    for (const box of expiredBoxes) {
      try {
        // Verificar se tem emails para arquivar
        const emailCount = await Email.countDocuments({ emailBox: box._id });

        if (emailCount > 0) {
          const history = await archiveExpiredBoxEmails(box._id.toString(), 'expired');
          if (history) {
            stats.archived++;
          }
        }

        stats.processed++;
      } catch (error) {
        logger.error(`SERVICE-HISTORY - Erro ao processar caixa ${box.address}: ${(error as Error).message}`);
        stats.errors++;
      }
    }

    logger.info(
      `SERVICE-HISTORY - Processamento concluído: ${stats.processed} processadas, ` +
      `${stats.archived} arquivadas, ${stats.errors} erros`
    );

    return stats;
  } catch (error) {
    logger.error(`SERVICE-HISTORY - Erro no processamento: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Remove emails órfãos cujas EmailBoxes foram deletadas (ex: TTL auto-delete)
 * 
 * Quando o MongoDB TTL index deleta EmailBoxes expiradas, os emails associados
 * permanecem na coleção Email sem referência válida. Esta função identifica
 * e remove esses emails órfãos.
 */
const cleanupOrphanedEmails = async (): Promise<{
  orphanedCount: number;
  deletedCount: number;
}> => {
  try {
    // Buscar todos os emailBox IDs distintos referenciados por emails
    const referencedBoxIds = await Email.distinct("emailBox");

    if (referencedBoxIds.length === 0) {
      logger.info("SERVICE-HISTORY - Nenhum email encontrado para verificar órfãos");
      return { orphanedCount: 0, deletedCount: 0 };
    }

    // Verificar quais desses IDs ainda existem na coleção EmailBox
    const existingBoxIds = await EmailBox.find(
      { _id: { $in: referencedBoxIds } },
      { _id: 1 }
    ).lean();

    const existingIdSet = new Set(existingBoxIds.map((b: any) => b._id.toString()));

    // Filtrar IDs que não existem mais
    const orphanedBoxIds = referencedBoxIds.filter(
      (id: any) => !existingIdSet.has(id.toString())
    );

    if (orphanedBoxIds.length === 0) {
      logger.info("SERVICE-HISTORY - Nenhum email órfão encontrado");
      return { orphanedCount: 0, deletedCount: 0 };
    }

    // Contar antes de deletar (para log)
    const orphanedCount = await Email.countDocuments({
      emailBox: { $in: orphanedBoxIds }
    });

    // Deletar emails órfãos
    const result = await Email.deleteMany({
      emailBox: { $in: orphanedBoxIds }
    });

    logger.info(
      `SERVICE-HISTORY - Cleanup: ${result.deletedCount} emails órfãos removidos ` +
      `de ${orphanedBoxIds.length} caixas inexistentes`
    );

    return {
      orphanedCount,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    logger.error(`SERVICE-HISTORY - Erro no cleanup de órfãos: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Busca histórico de emails para admin
 */
export const getEmailHistoryForAdmin = async (options: {
  page?: number;
  limit?: number;
  userId?: string;
  boxAddress?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  data: IEmailHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = {};

  if (options.userId) {
    query.userId = options.userId;
  }

  if (options.boxAddress) {
    query.boxAddress = { $regex: options.boxAddress, $options: 'i' };
  }

  if (options.startDate || options.endDate) {
    query.archivedAt = {};
    if (options.startDate) query.archivedAt.$gte = options.startDate;
    if (options.endDate) query.archivedAt.$lte = options.endDate;
  }

  const [data, total] = await Promise.all([
    EmailHistory.find(query)
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EmailHistory.countDocuments(query),
  ]);

  return {
    data: data as unknown as IEmailHistory[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Busca um histórico específico por ID
 */
export const getEmailHistoryById = async (historyId: string): Promise<IEmailHistory | null> => {
  return EmailHistory.findById(historyId).lean() as Promise<IEmailHistory | null>;
};

/**
 * Arquiva uma caixa quando ela é deletada manualmente pelo usuário
 * Registra informações detalhadas sobre quem deletou e quando
 */
export const archiveBoxOnDeletion = async (
  boxId: string,
  deletedBy: {
    userId: string;
    userEmail: string;
    userName: string;
    userRole?: string;
  },
  reason: 'manual' | 'admin' = 'manual'
): Promise<IEmailHistory | null> => {
  try {
    const box = await EmailBox.findById(boxId).lean();
    if (!box) {
      logger.warn(`SERVICE-HISTORY - Caixa não encontrada para arquivamento: ${boxId}`);
      return null;
    }

    const boxOwner = await User.findById(box.userId).lean();
    if (!boxOwner) {
      logger.warn(`SERVICE-HISTORY - Dono da caixa não encontrado: ${box.userId}`);
      return null;
    }

    // Buscar todos os emails da caixa (por endereço, não por boxId)
    const emails = await Email.find({ to: box.address }).lean();

    // Converter emails para formato de arquivo
    const archivedEmails: IArchivedEmail[] = emails.map((email: any) => ({
      originalId: email._id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      date: email.date,
      token: email.token,
      contentType: email.contentType,
      processedAt: email.processedAt,
      originalCreatedAt: email.createdAt,
    }));

    // Extrair remetentes únicos
    const uniqueSenders = [...new Set(emails.map((e: any) => e.from))];

    // Criar documento de histórico com informações de exclusão
    const history = new EmailHistory({
      boxId: box._id,
      boxAddress: box.address,
      userId: boxOwner._id,
      userEmail: boxOwner.email,
      userName: boxOwner.name,
      emails: archivedEmails,
      emailCount: emails.length,
      archivedAt: new Date(),
      expirationReason: reason,
      boxCreatedAt: box.createdAt,
      boxExpiredAt: box.expiresAt || new Date(),
      totalEmailsReceived: emails.length,
      uniqueSenders,
      // Informações adicionais de exclusão
      deletionInfo: {
        deletedBy: deletedBy.userId,
        deletedByEmail: deletedBy.userEmail,
        deletedByName: deletedBy.userName,
        deletedByRole: deletedBy.userRole || 'user',
        deletedAt: new Date(),
        wasExpired: box.expiresAt ? new Date(box.expiresAt) < new Date() : false,
      },
    });

    await history.save();

    logger.info(
      `SERVICE-HISTORY - Caixa ${box.address} arquivada antes da exclusão. ` +
      `${emails.length} emails preservados. Deletado por: ${deletedBy.userEmail}. ` +
      `History ID: ${history._id}`
    );

    return history;
  } catch (error) {
    logger.error(`SERVICE-HISTORY - Erro ao arquivar caixa para exclusão: ${(error as Error).message}`);
    // Não lançar erro para não bloquear a exclusão
    return null;
  }
};

/**
 * Estatísticas globais para dashboard admin
 */
export const getHistoryStats = async (): Promise<{
  totalArchived: number;
  totalEmails: number;
  totalUsers: number;
  last24Hours: number;
  last7Days: number;
}> => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalArchived, totalEmails, uniqueUsers, last24Hours, last7Days] = await Promise.all([
    EmailHistory.countDocuments(),
    EmailHistory.aggregate([
      { $group: { _id: null, total: { $sum: "$emailCount" } } }
    ]),
    EmailHistory.distinct('userId'),
    EmailHistory.countDocuments({ archivedAt: { $gte: yesterday } }),
    EmailHistory.countDocuments({ archivedAt: { $gte: lastWeek } }),
  ]);

  return {
    totalArchived,
    totalEmails: totalEmails[0]?.total || 0,
    totalUsers: uniqueUsers.length,
    last24Hours,
    last7Days,
  };
};

export default {
  archiveExpiredBoxEmails,
  archiveBoxOnDeletion,
  processExpiredBoxes,
  cleanupOrphanedEmails,
  getEmailHistoryForAdmin,
  getEmailHistoryById,
  getHistoryStats,
};

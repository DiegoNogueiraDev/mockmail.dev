import { Request, Response } from "express";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import logger from "../utils/logger";
import {
  getFromCache,
  setInCache,
  getUserBoxesCacheKey,
  getBoxEmailsCacheKey,
  invalidateUserBoxesCache,
  invalidateUserEmailsCache,
  invalidateBoxEmailsCache,
  CACHE_TTL,
} from "../services/cache.service";
import {
  generateRandomAddress,
  generateCustomAddress,
  createEmailBoxForUser,
} from "../services/emailBox.service";
import { archiveBoxOnDeletion } from "../services/emailHistory.service";

/**
 * Formata o tempo restante em formato legível.
 */
function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "Expirada";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * List all email boxes for the authenticated user
 */
export const listBoxes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = getUserBoxesCacheKey(userId.toString(), page, limit);
    const cached = await getFromCache<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(cacheKey);

    if (cached) {
      // Recalcular timeLeft para dados cacheados (tempo é dinâmico)
      const now = new Date();
      cached.data = cached.data.map((box: any) => {
        if (box.expiresAt) {
          // Caixa com expiração definida
          const expiresAt = new Date(box.expiresAt);
          const timeLeftMs = expiresAt.getTime() - now.getTime();
          const expired = timeLeftMs <= 0;
          const timeLeftSeconds = expired ? 0 : Math.floor(timeLeftMs / 1000);
          return {
            ...box,
            expired,
            timeLeftSeconds,
            timeLeftFormatted: expired ? "Expirada" : formatTimeLeft(timeLeftSeconds),
          };
        } else {
          // Caixa legado (sem expiresAt) - considerar expirada se criada há mais de 24h
          const createdAt = new Date(box.createdAt);
          const ageMs = now.getTime() - createdAt.getTime();
          const maxAgeMs = 24 * 60 * 60 * 1000; // 24 horas
          const expired = ageMs > maxAgeMs;
          return {
            ...box,
            expired,
            timeLeftSeconds: expired ? 0 : null,
            timeLeftFormatted: expired ? "Expirada (legado)" : null,
          };
        }
      });
      logger.info(`CONTROL-EMAILBOX - Cache HIT for user ${userId} boxes (page ${page})`);
      return res.status(200).json({ success: true, ...cached });
    }

    // Buscar TODAS as caixas do usuário (sem filtrar por expiração)
    // O frontend irá mostrar status de "expirada" quando necessário
    const [boxes, total] = await Promise.all([
      EmailBox.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailBox.countDocuments({ userId }),
    ]);

    const now = new Date();

    // Get email count for each box and calculate time left
    const boxesWithDetails = await Promise.all(
      boxes.map(async (box: any) => {
        const emailCount = await Email.countDocuments({ to: box.address });

        // Calcular tempo restante e status de expiração
        let timeLeftSeconds = null;
        let timeLeftFormatted = null;
        let expired = false;

        if (box.expiresAt) {
          // Caixa com expiração definida
          const expiresAt = new Date(box.expiresAt);
          const timeLeftMs = expiresAt.getTime() - now.getTime();
          expired = timeLeftMs <= 0;
          timeLeftSeconds = expired ? 0 : Math.floor(timeLeftMs / 1000);
          timeLeftFormatted = expired ? "Expirada" : formatTimeLeft(timeLeftSeconds);
        } else {
          // Caixa legada (sem expiresAt) - considerar expirada se criada há mais de 24h
          const createdAt = new Date(box.createdAt);
          const ageMs = now.getTime() - createdAt.getTime();
          const maxAgeMs = 24 * 60 * 60 * 1000; // 24 horas
          expired = ageMs > maxAgeMs;
          if (expired) {
            timeLeftSeconds = 0;
            timeLeftFormatted = "Expirada (legado)";
          }
        }

        return {
          id: box._id,
          address: box.address,
          isCustom: box.isCustom || false,
          emailCount,
          createdAt: box.createdAt,
          expiresAt: box.expiresAt || null,
          expired,
          timeLeftSeconds,
          timeLeftFormatted,
        };
      })
    );

    // Ordenar: caixas ativas primeiro (não expiradas), depois expiradas
    // Dentro de cada grupo, ordenar por data de criação (mais recentes primeiro)
    const sortedBoxes = boxesWithDetails.sort((a, b) => {
      // Primeiro critério: ativas antes de expiradas
      if (a.expired !== b.expired) {
        return a.expired ? 1 : -1; // Ativas (false) vêm antes de expiradas (true)
      }
      // Segundo critério: mais recentes primeiro (dentro do mesmo grupo)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Contar caixas ativas e expiradas para o frontend saber onde fazer a divisão
    const activeCount = sortedBoxes.filter(b => !b.expired).length;
    const expiredCount = sortedBoxes.filter(b => b.expired).length;

    const responseData = {
      data: sortedBoxes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        activeCount,
        expiredCount,
        firstExpiredIndex: activeCount, // Índice onde começam as expiradas
      },
    };

    // Cache the result (short TTL because of time calculations)
    await setInCache(cacheKey, responseData, CACHE_TTL.SHORT);

    logger.info(`CONTROL-EMAILBOX - Listed ${boxes.length} boxes for user ${userId}`);
    res.status(200).json({
      success: true,
      ...responseData,
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error listing boxes: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Get a single email box by ID
 */
export const getBox = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const box = await EmailBox.findOne({ _id: id, userId }).lean();

    if (!box) {
      return res.status(404).json({ success: false, message: "Email box not found" });
    }

    const emailCount = await Email.countDocuments({ to: box.address });

    // Calcular tempo restante
    const now = new Date();
    const expiresAt = new Date((box as any).expiresAt || now.getTime() + 24 * 60 * 60 * 1000);
    const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
    const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

    logger.info(`CONTROL-EMAILBOX - Retrieved box ${id} for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        id: box._id,
        address: box.address,
        isCustom: (box as any).isCustom || false,
        emailCount,
        createdAt: box.createdAt,
        expiresAt: expiresAt,
        timeLeftSeconds,
        timeLeftFormatted: formatTimeLeft(timeLeftSeconds),
      },
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error getting box: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Create a new email box
 */
export const createBox = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { customName } = req.body;

    // Gerar endereço: personalizado se customName fornecido, randômico senão
    let address: string;
    let isCustom = false;

    try {
      if (customName && typeof customName === 'string' && customName.trim()) {
        address = await generateCustomAddress(customName.trim());
        isCustom = true;
      } else {
        address = await generateRandomAddress();
      }
    } catch (genError) {
      logger.error(`CONTROL-EMAILBOX - Error generating address: ${(genError as Error).message}`);
      return res.status(400).json({
        success: false,
        message: (genError as Error).message || "Erro ao gerar endereço"
      });
    }

    // Operação atômica: criar ou reativar caixa
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Primeiro verifica se existe e pertence a outro usuário
    const existingBox = await EmailBox.findOne({ address }).lean();
    if (existingBox && existingBox.userId.toString() !== userId.toString()) {
      return res.status(409).json({
        success: false,
        message: "Endereço já está em uso por outro usuário."
      });
    }

    // findOneAndUpdate atômico: atualiza se existe, cria se não
    const box = await EmailBox.findOneAndUpdate(
      { address, userId },
      { $set: { expiresAt, isCustom }, $setOnInsert: { address, userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (existingBox) {
      logger.info(`CONTROL-EMAILBOX - Reactivated box ${address} for user ${userId} (new expiry: ${expiresAt.toISOString()})`);
    } else {
      logger.info(`CONTROL-EMAILBOX - Created box ${address} for user ${userId} (expires: ${expiresAt.toISOString()})`);
    }

    // Invalidate user's boxes cache
    await invalidateUserBoxesCache(userId.toString());

    const boxExpiresAt = new Date(box.expiresAt);
    const timeLeftMs = boxExpiresAt.getTime() - now.getTime();
    const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

    const emailCount = await Email.countDocuments({ to: box.address });

    res.status(201).json({
      success: true,
      data: {
        id: box._id,
        address: box.address,
        isCustom: box.isCustom,
        emailCount,
        createdAt: box.createdAt,
        expiresAt: box.expiresAt,
        timeLeftSeconds,
        timeLeftFormatted: formatTimeLeft(timeLeftSeconds),
      },
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error creating box: ${(error as Error).message}`);

    // Check for duplicate key error
    if ((error as any).code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Endereço já existe. Tente novamente."
      });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Delete an email box and all its emails
 * Arquiva os emails no histórico antes de deletar
 */
export const deleteBox = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const box = await EmailBox.findOne({ _id: id, userId });

    if (!box) {
      return res.status(404).json({ success: false, message: "Email box not found" });
    }

    // Arquivar a caixa e seus emails no histórico antes de deletar
    const emailCount = await Email.countDocuments({ to: box.address });
    let archivedHistory: any = null;

    if (emailCount > 0) {
      archivedHistory = await archiveBoxOnDeletion(id, {
        userId: userId.toString(),
        userEmail: user.email || 'unknown',
        userName: user.name || 'Unknown User',
        userRole: user.role || 'user',
      });
    }

    const deletedEmails = await Email.deleteMany({ to: box.address });
    const deletedCount = deletedEmails.deletedCount;

    await EmailBox.deleteOne({ _id: id });

    // Invalidate caches after successful transaction
    await Promise.all([
      invalidateUserBoxesCache(userId.toString()),
      invalidateUserEmailsCache(userId.toString()),
      invalidateBoxEmailsCache(id),
    ]);

    logger.info(
      `CONTROL-EMAILBOX - Deleted box ${box.address} and ${deletedCount} emails for user ${userId}. ` +
      `${archivedHistory ? `Archived to history: ${archivedHistory._id}` : 'No emails to archive'}`
    );

    res.status(200).json({
      success: true,
      message: "Email box deleted successfully",
      deletedEmails: deletedCount,
      archived: archivedHistory ? true : false,
      historyId: archivedHistory?._id || null,
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error deleting box: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Clear all emails from a box
 */
export const clearBox = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const box = await EmailBox.findOne({ _id: id, userId });

    if (!box) {
      return res.status(404).json({ success: false, message: "Email box not found" });
    }

    const deletedEmails = await Email.deleteMany({ to: box.address });

    // Invalidate user's boxes and emails cache (email count changed)
    await Promise.all([
      invalidateUserBoxesCache(userId.toString()),
      invalidateUserEmailsCache(userId.toString()),
      invalidateBoxEmailsCache(id),
    ]);

    logger.info(`CONTROL-EMAILBOX - Cleared ${deletedEmails.deletedCount} emails from box ${box.address}`);
    res.status(200).json({
      success: true,
      message: "Emails cleared successfully",
      deletedCount: deletedEmails.deletedCount,
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error clearing box: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Get emails for a specific box
 */
export const getBoxEmails = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const box = await EmailBox.findOne({ _id: id, userId });

    if (!box) {
      return res.status(404).json({ success: false, message: "Email box not found" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Check cache first
    const cacheKey = getBoxEmailsCacheKey(id, page, limit);
    const cached = await getFromCache<{ data: any[]; pagination: any }>(cacheKey);
    if (cached) {
      logger.info(`CONTROL-EMAILBOX - Cache HIT for box ${id} emails page ${page}`);
      return res.status(200).json({ success: true, ...cached });
    }

    const [emails, total] = await Promise.all([
      Email.find({ to: box.address })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('from subject date processedAt')
        .lean(),
      Email.countDocuments({ to: box.address }),
    ]);

    const formattedEmails = emails.map((email: any) => ({
      id: email._id,
      from: email.from,
      subject: email.subject,
      receivedAt: email.date || email.processedAt,
      read: false,
    }));

    const responseData = {
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the response (SHORT TTL - 1 min)
    await setInCache(cacheKey, responseData, CACHE_TTL.SHORT);

    logger.info(`CONTROL-EMAILBOX - Retrieved ${emails.length} emails for box ${box.address}`);
    res.status(200).json({ success: true, ...responseData });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error getting box emails: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

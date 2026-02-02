import { Request, Response } from "express";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import logger from "../utils/logger";
import {
  getFromCache,
  setInCache,
  getUserBoxesCacheKey,
  invalidateUserBoxesCache,
  invalidateUserEmailsCache,
  CACHE_TTL,
} from "../services/cache.service";
import {
  generateRandomAddress,
  generateCustomAddress,
  createEmailBoxForUser,
} from "../services/emailBox.service";

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
        const expiresAt = new Date(box.expiresAt);
        const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
        return {
          ...box,
          timeLeftSeconds,
          timeLeftFormatted: formatTimeLeft(timeLeftSeconds),
        };
      });
      logger.info(`CONTROL-EMAILBOX - Cache HIT for user ${userId} boxes (page ${page})`);
      return res.status(200).json({ success: true, ...cached });
    }

    // Buscar apenas caixas não expiradas
    const [boxes, total] = await Promise.all([
      EmailBox.find({ 
        userId,
        expiresAt: { $gt: new Date() }, // Apenas não expiradas
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailBox.countDocuments({ 
        userId,
        expiresAt: { $gt: new Date() },
      }),
    ]);

    const now = new Date();

    // Get email count for each box and calculate time left
    const boxesWithDetails = await Promise.all(
      boxes.map(async (box: any) => {
        const emailCount = await Email.countDocuments({ to: box.address });
        const expiresAt = new Date(box.expiresAt);
        const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
        
        return {
          id: box._id,
          address: box.address,
          isCustom: box.isCustom || false,
          emailCount,
          createdAt: box.createdAt,
          expiresAt: box.expiresAt,
          timeLeftSeconds,
          timeLeftFormatted: formatTimeLeft(timeLeftSeconds),
        };
      })
    );

    const responseData = {
      data: boxesWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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

    // Calcular expiração: 24 horas
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const box = new EmailBox({
      address,
      userId,
      isCustom,
      expiresAt,
    });

    await box.save();

    // Invalidate user's boxes cache
    await invalidateUserBoxesCache(userId.toString());

    const now = new Date();
    const timeLeftMs = expiresAt.getTime() - now.getTime();
    const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

    logger.info(`CONTROL-EMAILBOX - Created box ${address} for user ${userId} (expires: ${expiresAt.toISOString()})`);
    res.status(201).json({
      success: true,
      data: {
        id: box._id,
        address: box.address,
        isCustom: box.isCustom,
        emailCount: 0,
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

    // Delete all emails for this box
    const deletedEmails = await Email.deleteMany({ to: box.address });
    
    // Delete the box
    await EmailBox.deleteOne({ _id: id });

    // Invalidate user's boxes and emails cache
    await Promise.all([
      invalidateUserBoxesCache(userId.toString()),
      invalidateUserEmailsCache(userId.toString()),
    ]);

    logger.info(`CONTROL-EMAILBOX - Deleted box ${box.address} and ${deletedEmails.deletedCount} emails for user ${userId}`);
    res.status(200).json({
      success: true,
      message: "Email box deleted successfully",
      deletedEmails: deletedEmails.deletedCount,
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
      read: false, // Campo read não existe no modelo atual
    }));

    logger.info(`CONTROL-EMAILBOX - Retrieved ${emails.length} emails for box ${box.address}`);
    res.status(200).json({
      success: true,
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error getting box emails: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

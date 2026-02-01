import { Request, Response } from "express";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import logger from "../utils/logger";
import crypto from "crypto";
import {
  getFromCache,
  setInCache,
  getUserBoxesCacheKey,
  invalidateUserBoxesCache,
  CACHE_TTL,
} from "../services/cache.service";

// Helper to generate random email addresses
const generateRandomAddress = (domain: string = 'mockmail.dev'): string => {
  const prefix = crypto.randomBytes(6).toString('hex');
  return `${prefix}@${domain}`;
};

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
      logger.info(`CONTROL-EMAILBOX - Cache HIT for user ${userId} boxes (page ${page})`);
      return res.status(200).json({ success: true, ...cached });
    }

    const [boxes, total] = await Promise.all([
      EmailBox.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailBox.countDocuments({ userId }),
    ]);

    // Get email count for each box
    const boxesWithCounts = await Promise.all(
      boxes.map(async (box) => {
        const emailCount = await Email.countDocuments({ to: box.address });
        return {
          id: box._id,
          address: box.address,
          emailCount,
          createdAt: box.createdAt,
          updatedAt: box.updatedAt,
        };
      })
    );

    const responseData = {
      data: boxesWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result
    await setInCache(cacheKey, responseData, CACHE_TTL.MEDIUM);

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

    logger.info(`CONTROL-EMAILBOX - Retrieved box ${id} for user ${userId}`);
    res.status(200).json({
      success: true,
      data: {
        id: box._id,
        address: box.address,
        emailCount,
        createdAt: box.createdAt,
        updatedAt: box.updatedAt,
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

    let { address, domain } = req.body;

    // If no address provided, generate a random one
    if (!address) {
      address = generateRandomAddress(domain || 'mockmail.dev');
    } else {
      // Ensure address has domain
      if (!address.includes('@')) {
        address = `${address}@${domain || 'mockmail.dev'}`;
      }
    }

    // Check if address already exists for this user
    const existingBox = await EmailBox.findOne({ address, userId });
    if (existingBox) {
      return res.status(409).json({ 
        success: false, 
        message: "Email box with this address already exists" 
      });
    }

    const box = new EmailBox({
      address,
      userId,
    });

    await box.save();

    // Invalidate user's boxes cache
    await invalidateUserBoxesCache(userId.toString());

    logger.info(`CONTROL-EMAILBOX - Created box ${address} for user ${userId}`);
    res.status(201).json({
      success: true,
      data: {
        id: box._id,
        address: box.address,
        emailCount: 0,
        createdAt: box.createdAt,
        updatedAt: box.updatedAt,
      },
    });
  } catch (error) {
    logger.error(`CONTROL-EMAILBOX - Error creating box: ${(error as Error).message}`);
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

    // Invalidate user's boxes cache
    await invalidateUserBoxesCache(userId.toString());

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

    // Invalidate user's boxes cache (email count changed)
    await invalidateUserBoxesCache(userId.toString());

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

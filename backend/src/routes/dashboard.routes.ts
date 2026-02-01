import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import Webhook from "../models/Webhook";
import logger from "../utils/logger";
import { getUserDailyUsage, DAILY_LIMIT } from "../middlewares/dailyUserLimit";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route GET /dashboard/stats
 * @desc Get dashboard statistics for the authenticated user
 * @access Private
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;

    logger.info(`ROUTE-DASHBOARD - GET /dashboard/stats - User: ${user?.email}`);

    // First, get all user's email boxes
    const userBoxes = await EmailBox.find({ userId }).select('_id').lean();
    const boxIds = userBoxes.map(box => box._id);

    // Get counts for the user
    const [totalBoxes, totalEmails, emailsToday, activeWebhooks] = await Promise.all([
      EmailBox.countDocuments({ userId }),
      // Count emails by emailBox reference (Email model doesn't have userId field)
      Email.countDocuments({ emailBox: { $in: boxIds } }),
      Email.countDocuments({
        emailBox: { $in: boxIds },
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      Webhook.countDocuments({ userId, isActive: true }),
    ]);

    // Calculate percent change (comparing to yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const [boxesYesterday, emailsYesterday] = await Promise.all([
      EmailBox.countDocuments({
        userId,
        createdAt: { $lt: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Email.countDocuments({
        emailBox: { $in: boxIds },
        createdAt: {
          $gte: yesterday,
          $lt: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    const boxesChange = boxesYesterday > 0 
      ? Math.round(((totalBoxes - boxesYesterday) / boxesYesterday) * 100) 
      : 0;
    const emailsChange = emailsYesterday > 0 
      ? Math.round(((emailsToday - emailsYesterday) / emailsYesterday) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        totalBoxes,
        totalEmails,
        emailsToday,
        activeWebhooks,
        percentChange: {
          boxes: boxesChange,
          emails: emailsChange,
        },
      },
    });
  } catch (error) {
    logger.error(`ROUTE-DASHBOARD - GET /dashboard/stats - Error: ${(error as Error).message}`);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * @route GET /dashboard/recent-emails
 * @desc Get recent emails for the authenticated user
 * @access Private
 */
router.get("/recent-emails", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id;
    const limit = parseInt(req.query.limit as string) || 5;

    logger.info(`ROUTE-DASHBOARD - GET /dashboard/recent-emails - User: ${user?.email}`);

    // First, get all user's email boxes
    const userBoxes = await EmailBox.find({ userId }).select('_id address').lean();
    const boxIds = userBoxes.map(box => box._id);

    // Get recent emails for user's boxes
    const recentEmails = await Email.find({ emailBox: { $in: boxIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('emailBox', 'address')
      .lean();

    const formattedEmails = recentEmails.map((email: any) => ({
      id: email._id.toString(),
      from: email.from || 'Unknown',
      subject: email.subject || '(No subject)',
      receivedAt: email.createdAt?.toISOString() || new Date().toISOString(),
      boxAddress: email.emailBox?.address || email.to || 'Unknown box',
    }));

    res.json({ success: true, data: formattedEmails });
  } catch (error) {
    logger.error(`ROUTE-DASHBOARD - GET /dashboard/recent-emails - Error: ${(error as Error).message}`);
    res.status(500).json({ error: "Failed to fetch recent emails" });
  }
});

/**
 * @route GET /dashboard/usage
 * @desc Get daily API usage for the authenticated user
 * @access Private
 */
router.get("/usage", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?._id?.toString() || user?.id;

    logger.info(`ROUTE-DASHBOARD - GET /dashboard/usage - User: ${user?.email}`);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const usage = await getUserDailyUsage(userId);

    res.json({
      success: true,
      data: {
        ...usage,
        percentage: Math.round((usage.used / usage.limit) * 100),
      },
    });
  } catch (error) {
    logger.error(`ROUTE-DASHBOARD - GET /dashboard/usage - Error: ${(error as Error).message}`);
    res.status(500).json({ error: "Failed to fetch usage stats" });
  }
});

export default router;

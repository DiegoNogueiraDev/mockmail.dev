import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import logger from "../utils/logger";
import EmailHistory from "../models/EmailHistory";
import EmailBox from "../models/EmailBox";
import Email from "../models/Email";
import User from "../models/User";
import {
  getEmailHistoryForAdmin,
  getEmailHistoryById,
  getHistoryStats,
  processExpiredBoxes,
  archiveExpiredBoxEmails,
} from "../services/emailHistory.service";
import {
  getFromCache,
  setInCache,
  getAdminStatsCacheKey,
  getAdminChartsCacheKey,
  getAdminUsersCacheKey,
  getAdminUserDetailsCacheKey,
  getAdminBoxesCacheKey,
  getAdminHistoryCacheKey,
  getAdminHistoryDetailsCacheKey,
  invalidateAdminStatsCache,
  CACHE_TTL,
} from "../services/cache.service";

const router = Router();

// Middleware para verificar se é admin
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Verificar role
  if (!['admin', 'system'].includes(user.role)) {
    logger.warn(`ADMIN-ROUTE - Acesso negado para ${user.email} (role: ${user.role})`);
    return res.status(403).json({ success: false, message: "Acesso negado. Requer permissão de administrador." });
  }

  next();
};

// Aplicar auth middleware em todas as rotas
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * @route GET /admin/stats
 * @desc Estatísticas gerais da plataforma
 * @access Admin only
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    logger.info(`ADMIN-ROUTE - GET /admin/stats - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminStatsCacheKey();
    const cached = await getFromCache<{ platform: any; history: any; usersByRole: any }>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for stats`);
      return res.json({ success: true, data: cached });
    }

    // Estatísticas em tempo real
    const [
      totalUsers,
      totalBoxes,
      totalEmails,
      activeBoxes,
      expiredBoxes,
      historyStats,
    ] = await Promise.all([
      User.countDocuments(),
      EmailBox.countDocuments(),
      Email.countDocuments(),
      EmailBox.countDocuments({
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }),
      EmailBox.countDocuments({
        expiresAt: { $exists: true, $lte: new Date() },
      }),
      getHistoryStats(),
    ]);

    // Usuários por role
    const usersByRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const responseData = {
      platform: {
        totalUsers,
        totalBoxes,
        totalEmails,
        activeBoxes,
        expiredBoxes,
      },
      history: historyStats,
      usersByRole: usersByRole.reduce((acc, cur) => {
        acc[cur._id] = cur.count;
        return acc;
      }, {} as Record<string, number>),
    };

    // Cache the response
    await setInCache(cacheKey, responseData, CACHE_TTL.STATS);

    res.json({ success: true, data: responseData });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/stats - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/charts
 * @desc Dados para gráficos de estatísticas por período
 * @access Admin only
 */
router.get("/charts", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const period = (req.query.period as string) || 'week';

    logger.info(`ADMIN-ROUTE - GET /admin/charts?period=${period} - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminChartsCacheKey(period);
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for charts:${period}`);
      return res.json({ success: true, data: cached });
    }

    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    let dateFormat: string;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        groupFormat = '%H:00';
        dateFormat = 'hour';
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        groupFormat = '%Y-%m-%d';
        dateFormat = 'day';
        break;
      case 'lastWeek':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 14);
        const endLastWeek = new Date(now);
        endLastWeek.setDate(now.getDate() - 7);
        groupFormat = '%Y-%m-%d';
        dateFormat = 'day';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupFormat = '%Y-%m-%d';
        dateFormat = 'day';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupFormat = '%Y-%m';
        dateFormat = 'month';
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        groupFormat = '%Y-%m-%d';
        dateFormat = 'day';
    }

    // Emails por período
    const emailsByPeriod = await Email.aggregate([
      {
        $match: {
          receivedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$receivedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Caixas criadas por período
    const boxesByPeriod = await EmailBox.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Usuários criados por período
    const usersByPeriod = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Combinar dados em formato adequado para gráficos
    const allDates = new Set([
      ...emailsByPeriod.map((e) => e._id),
      ...boxesByPeriod.map((b) => b._id),
      ...usersByPeriod.map((u) => u._id),
    ]);

    const chartData = Array.from(allDates)
      .sort()
      .map((date) => ({
        date,
        emails: emailsByPeriod.find((e) => e._id === date)?.count || 0,
        boxes: boxesByPeriod.find((b) => b._id === date)?.count || 0,
        users: usersByPeriod.find((u) => u._id === date)?.count || 0,
      }));

    // Totais do período
    const totals = {
      emails: emailsByPeriod.reduce((sum, e) => sum + e.count, 0),
      boxes: boxesByPeriod.reduce((sum, b) => sum + b.count, 0),
      users: usersByPeriod.reduce((sum, u) => sum + u.count, 0),
    };

    const responseData = {
      period,
      dateFormat,
      startDate,
      chartData,
      totals,
    };

    // Cache the response (SHORT TTL for frequently changing data)
    await setInCache(cacheKey, responseData, CACHE_TTL.SHORT);

    res.json({ success: true, data: responseData });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/charts - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/users
 * @desc Lista todos os usuários
 * @access Admin only
 */
router.get("/users", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    logger.info(`ADMIN-ROUTE - GET /admin/users - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminUsersCacheKey(page, limit);
    const cached = await getFromCache<{ data: any[]; pagination: any }>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for users list page:${page}`);
      return res.json({ success: true, ...cached });
    }

    const [users, total] = await Promise.all([
      User.find()
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    // Adicionar contagem de caixas para cada usuário
    const usersWithStats = await Promise.all(
      users.map(async (u: any) => {
        const boxCount = await EmailBox.countDocuments({ userId: u._id });
        const emailCount = await Email.countDocuments({
          emailBox: { $in: await EmailBox.find({ userId: u._id }).select("_id") },
        });
        return {
          ...u,
          boxCount,
          emailCount,
        };
      })
    );

    const responseData = {
      data: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the response
    await setInCache(cacheKey, responseData, CACHE_TTL.MEDIUM);

    res.json({ success: true, ...responseData });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/users - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/users/:id
 * @desc Detalhes de um usuário específico com estatísticas
 * @access Admin only
 */
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user;
    const userId = req.params.id;

    logger.info(`ADMIN-ROUTE - GET /admin/users/${userId} - Admin: ${adminUser.email}`);

    // Check cache first
    const cacheKey = getAdminUserDetailsCacheKey(userId);
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for user details:${userId}`);
      return res.json({ success: true, data: cached });
    }

    // Buscar usuário
    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado" });
    }

    // Buscar estatísticas do usuário
    const [
      totalBoxes,
      activeBoxes,
      expiredBoxes,
      totalEmails,
      recentBoxes,
      emailsByDay,
    ] = await Promise.all([
      // Total de caixas
      EmailBox.countDocuments({ userId: user._id }),
      // Caixas ativas
      EmailBox.countDocuments({
        userId: user._id,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }),
      // Caixas expiradas
      EmailBox.countDocuments({
        userId: user._id,
        expiresAt: { $exists: true, $lte: new Date() },
      }),
      // Total de emails
      Email.countDocuments({
        emailBox: { $in: await EmailBox.find({ userId: user._id }).select("_id") },
      }),
      // Últimas 5 caixas
      EmailBox.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      // Emails por dia (últimos 7 dias)
      Email.aggregate([
        {
          $lookup: {
            from: "emailboxes",
            localField: "emailBox",
            foreignField: "_id",
            as: "box",
          },
        },
        { $unwind: "$box" },
        { $match: { "box.userId": user._id } },
        {
          $match: {
            receivedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$receivedAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Adicionar contagem de emails para cada caixa recente
    const recentBoxesWithStats = await Promise.all(
      recentBoxes.map(async (box: any) => {
        const emailCount = await Email.countDocuments({ emailBox: box._id });
        const expired = box.expiresAt ? new Date(box.expiresAt) <= new Date() : false;
        return {
          ...box,
          emailCount,
          expired,
        };
      })
    );

    const responseData = {
      user,
      stats: {
        totalBoxes,
        activeBoxes,
        expiredBoxes,
        totalEmails,
      },
      recentBoxes: recentBoxesWithStats,
      emailsByDay,
    };

    // Cache the response
    await setInCache(cacheKey, responseData, CACHE_TTL.MEDIUM);

    res.json({ success: true, data: responseData });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/users/:id - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/boxes
 * @desc Lista todas as caixas (de todos os usuários)
 * @access Admin only
 */
router.get("/boxes", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || 'all';

    logger.info(`ADMIN-ROUTE - GET /admin/boxes - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminBoxesCacheKey(page, limit, status);
    const cached = await getFromCache<{ data: any[]; pagination: any }>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for boxes list page:${page}`);
      return res.json({ success: true, ...cached });
    }

    let query: any = {};
    const now = new Date();

    if (status === 'active') {
      query.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } },
      ];
    } else if (status === 'expired') {
      query.expiresAt = { $exists: true, $lte: now };
    }

    const [boxes, total] = await Promise.all([
      EmailBox.find(query)
        .populate("userId", "email name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailBox.countDocuments(query),
    ]);

    // Adicionar contagem de emails e status
    const boxesWithStats = await Promise.all(
      boxes.map(async (box: any) => {
        const emailCount = await Email.countDocuments({ emailBox: box._id });
        const expired = box.expiresAt ? new Date(box.expiresAt) <= now : false;
        return {
          ...box,
          emailCount,
          expired,
          user: box.userId,
        };
      })
    );

    const responseData = {
      data: boxesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the response (SHORT TTL since box status changes frequently)
    await setInCache(cacheKey, responseData, CACHE_TTL.SHORT);

    res.json({ success: true, ...responseData });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/boxes - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/history
 * @desc Lista histórico de emails arquivados
 * @access Admin only
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.query.userId as string;
    const boxAddress = req.query.boxAddress as string;

    logger.info(`ADMIN-ROUTE - GET /admin/history - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminHistoryCacheKey(page, limit, userId, boxAddress);
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for history list page:${page}`);
      return res.json({ success: true, ...cached });
    }

    const result = await getEmailHistoryForAdmin({
      page,
      limit,
      userId,
      boxAddress,
    });

    // Cache the response
    await setInCache(cacheKey, result, CACHE_TTL.MEDIUM);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/history - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /admin/history/:id
 * @desc Detalhes de um histórico específico
 * @access Admin only
 */
router.get("/history/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const historyId = req.params.id;

    logger.info(`ADMIN-ROUTE - GET /admin/history/${historyId} - Admin: ${user.email}`);

    // Check cache first
    const cacheKey = getAdminHistoryDetailsCacheKey(historyId);
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      logger.debug(`ADMIN-ROUTE - Cache HIT for history details:${historyId}`);
      return res.json({ success: true, data: cached });
    }

    const history = await getEmailHistoryById(historyId);

    if (!history) {
      return res.status(404).json({ success: false, message: "Histórico não encontrado" });
    }

    // Cache the response (LONG TTL since history is immutable)
    await setInCache(cacheKey, history, CACHE_TTL.LONG);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - GET /admin/history/:id - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route POST /admin/archive-expired
 * @desc Força o arquivamento de caixas expiradas
 * @access System only
 */
router.post("/archive-expired", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Apenas system pode executar
    if (user.role !== 'system') {
      return res.status(403).json({
        success: false,
        message: "Apenas usuários system podem executar esta ação"
      });
    }

    logger.info(`ADMIN-ROUTE - POST /admin/archive-expired - System: ${user.email}`);

    const stats = await processExpiredBoxes();

    // Invalidate admin cache after archiving
    await invalidateAdminStatsCache();

    res.json({
      success: true,
      message: `Processamento concluído: ${stats.processed} caixas processadas, ${stats.archived} arquivadas`,
      data: stats,
    });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - POST /admin/archive-expired - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route POST /admin/archive-box/:id
 * @desc Arquiva emails de uma caixa específica
 * @access Admin only
 */
router.post("/archive-box/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const boxId = req.params.id;
    const reason = req.body.reason || 'manual';

    logger.info(`ADMIN-ROUTE - POST /admin/archive-box/${boxId} - Admin: ${user.email}`);

    const history = await archiveExpiredBoxEmails(boxId, reason);

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Caixa não encontrada ou sem emails para arquivar"
      });
    }

    // Invalidate admin cache after archiving
    await invalidateAdminStatsCache();

    res.json({
      success: true,
      message: `${history.emailCount} emails arquivados com sucesso`,
      data: {
        historyId: history._id,
        boxAddress: history.boxAddress,
        emailCount: history.emailCount,
      },
    });
  } catch (error) {
    logger.error(`ADMIN-ROUTE - POST /admin/archive-box/:id - Error: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;

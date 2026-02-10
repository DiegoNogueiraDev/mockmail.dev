import { Request, Response } from "express";
import Webhook, { IWebhook, WebhookEvent, WebhookStatus } from "../models/Webhook";
import WebhookDelivery from "../models/WebhookDelivery";
import {
  generateWebhookSecret,
  testWebhook as testWebhookService,
  getWebhookStats,
} from "../services/webhook.service";
import logger from "../utils/logger";
import {
  getFromCache,
  setInCache,
  getUserWebhooksCacheKey,
  invalidateUserWebhooksCache,
  CACHE_TTL,
} from "../services/cache.service";

/**
 * List all webhooks for the authenticated user
 */
export const listWebhooks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = getUserWebhooksCacheKey(userId!, page, limit);
    const cached = await getFromCache<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(cacheKey);

    if (cached) {
      logger.info(`WEBHOOK - Cache HIT for user ${userId} webhooks (page ${page})`);
      return res.json({ success: true, ...cached });
    }

    const [webhooks, total] = await Promise.all([
      Webhook.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-secret"), // Never expose secret in list
      Webhook.countDocuments({ userId }),
    ]);

    // Get stats for each webhook
    const webhooksWithStats = await Promise.all(
      webhooks.map(async (webhook) => {
        const webhookId = String(webhook._id);
        const stats = await getWebhookStats(webhookId);
        return {
          ...webhook.toObject(),
          stats,
        };
      })
    );

    const responseData = {
      data: webhooksWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result
    await setInCache(cacheKey, responseData, CACHE_TTL.MEDIUM);

    res.json({
      success: true,
      ...responseData,
    });
  } catch (error) {
    logger.error("Error listing webhooks:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao listar webhooks",
    });
  }
};

/**
 * Get a single webhook by ID
 */
export const getWebhook = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const webhook = await Webhook.findOne({ _id: id, userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    // Get recent deliveries
    const deliveries = await WebhookDelivery.find({ webhookId: id })
      .sort({ createdAt: -1 })
      .limit(20);

    const stats = await getWebhookStats(id);

    res.json({
      success: true,
      data: {
        ...webhook.toObject(),
        deliveries,
        stats,
      },
    });
  } catch (error) {
    logger.error("Error getting webhook:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar webhook",
    });
  }
};

/**
 * Create a new webhook
 */
export const createWebhook = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, url, events, headers, retryCount } = req.body;

    // Validate required fields
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: "Nome e URL são obrigatórios",
      });
    }

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
      // SSRF protection: block internal/private IPs
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '[::1]'];
      if (blockedPatterns.some(p => hostname === p || hostname.startsWith(p))) {
        return res.status(400).json({
          success: false,
          error: "URLs internas/privadas não são permitidas",
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: "URL inválida. Deve começar com http:// ou https://",
      });
    }

    // Validate events
    const validEvents = events?.filter((e: string) =>
      Object.values(WebhookEvent).includes(e as WebhookEvent)
    ) || [WebhookEvent.EMAIL_RECEIVED];

    // Check webhook limit per user (max 10)
    const existingCount = await Webhook.countDocuments({ userId });
    if (existingCount >= 10) {
      return res.status(400).json({
        success: false,
        error: "Limite máximo de 10 webhooks atingido",
      });
    }

    // Generate secure secret
    const secret = generateWebhookSecret();

    const webhook = await Webhook.create({
      userId,
      name: name.trim(),
      url: url.trim(),
      secret,
      events: validEvents,
      headers: headers || {},
      retryCount: Math.min(Math.max(retryCount || 3, 0), 10),
    });

    // Invalidate user's webhooks cache
    await invalidateUserWebhooksCache(userId!);

    logger.info(`Webhook created: ${webhook.name} for user ${userId}`);

    // Return webhook with secret (only on creation)
    res.status(201).json({
      success: true,
      data: webhook.toObject(),
      message: "Webhook criado com sucesso. Guarde o secret, ele não será exibido novamente!",
    });
  } catch (error) {
    logger.error("Error creating webhook:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao criar webhook",
    });
  }
};

/**
 * Update a webhook
 */
export const updateWebhook = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, url, events, headers, retryCount, status } = req.body;

    const webhook = await Webhook.findOne({ _id: id, userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    // Validate URL if provided
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
        // SSRF protection: block internal/private IPs
        const hostname = parsedUrl.hostname.toLowerCase();
        const blockedPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '[::1]'];
        if (blockedPatterns.some(p => hostname === p || hostname.startsWith(p))) {
          return res.status(400).json({
            success: false,
            error: "URLs internas/privadas não são permitidas",
          });
        }
      } catch {
        return res.status(400).json({
          success: false,
          error: "URL inválida",
        });
      }
    }

    // Validate events if provided
    let validEvents;
    if (events) {
      validEvents = events.filter((e: string) =>
        Object.values(WebhookEvent).includes(e as WebhookEvent)
      );
      if (validEvents.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Pelo menos um evento válido é necessário",
        });
      }
    }

    // Validate status if provided
    if (status && !Object.values(WebhookStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status inválido",
      });
    }

    // Update fields
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (url) updateData.url = url.trim();
    if (validEvents) updateData.events = validEvents;
    if (headers !== undefined) updateData.headers = headers;
    if (retryCount !== undefined) {
      updateData.retryCount = Math.min(Math.max(retryCount, 0), 10);
    }
    if (status) {
      updateData.status = status;
      // Clear error when reactivating
      if (status === WebhookStatus.ACTIVE) {
        updateData.lastError = null;
      }
    }

    const updatedWebhook = await Webhook.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).select("-secret");

    // Invalidate user's webhooks cache
    await invalidateUserWebhooksCache(userId!);

    logger.info(`Webhook updated: ${updatedWebhook?.name}`);

    res.json({
      success: true,
      data: updatedWebhook,
    });
  } catch (error) {
    logger.error("Error updating webhook:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao atualizar webhook",
    });
  }
};

/**
 * Delete a webhook
 */
export const deleteWebhook = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const webhook = await Webhook.findOneAndDelete({ _id: id, userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    // Delete associated deliveries
    await WebhookDelivery.deleteMany({ webhookId: id });

    // Invalidate user's webhooks cache
    await invalidateUserWebhooksCache(userId!);

    logger.info(`Webhook deleted: ${webhook.name}`);

    res.json({
      success: true,
      message: "Webhook excluído com sucesso",
    });
  } catch (error) {
    logger.error("Error deleting webhook:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao excluir webhook",
    });
  }
};

/**
 * Test a webhook by sending a test payload
 */
export const testWebhook = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Verify ownership
    const webhook = await Webhook.findOne({ _id: id, userId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    const result = await testWebhookService(id);

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? "Webhook testado com sucesso!"
        : `Falha no teste: ${result.error || `HTTP ${result.responseCode}`}`,
    });
  } catch (error) {
    logger.error("Error testing webhook:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao testar webhook",
    });
  }
};

/**
 * Regenerate webhook secret
 */
export const regenerateSecret = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const webhook = await Webhook.findOne({ _id: id, userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    const newSecret = generateWebhookSecret();

    await Webhook.updateOne({ _id: id }, { $set: { secret: newSecret } });

    // Invalidate cache after updating secret
    await invalidateUserWebhooksCache(userId!);

    logger.info(`Webhook secret regenerated: ${webhook.name}`);

    res.json({
      success: true,
      data: { secret: newSecret },
      message: "Secret regenerado com sucesso. Atualize suas integrações!",
    });
  } catch (error) {
    logger.error("Error regenerating webhook secret:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao regenerar secret",
    });
  }
};

/**
 * Get webhook deliveries history
 */
export const getDeliveries = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    // Verify ownership
    const webhook = await Webhook.findOne({ _id: id, userId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook não encontrado",
      });
    }

    const [deliveries, total] = await Promise.all([
      WebhookDelivery.find({ webhookId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WebhookDelivery.countDocuments({ webhookId: id }),
    ]);

    res.json({
      success: true,
      data: deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error getting deliveries:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar entregas",
    });
  }
};

/**
 * Get available webhook events
 */
export const getAvailableEvents = async (_req: Request, res: Response) => {
  const events = [
    { value: WebhookEvent.EMAIL_RECEIVED, label: "Email Recebido", description: "Disparado quando um novo email chega" },
    { value: WebhookEvent.EMAIL_OPENED, label: "Email Aberto", description: "Disparado quando um email é visualizado" },
    { value: WebhookEvent.EMAIL_CLICKED, label: "Link Clicado", description: "Disparado quando um link no email é clicado" },
    { value: WebhookEvent.BOX_CREATED, label: "Caixa Criada", description: "Disparado quando uma nova caixa é criada" },
    { value: WebhookEvent.BOX_DELETED, label: "Caixa Excluída", description: "Disparado quando uma caixa é excluída" },
  ];

  res.json({
    success: true,
    data: events,
  });
};

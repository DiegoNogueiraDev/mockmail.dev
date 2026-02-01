import { Request, Response } from "express";
import { ApiKeyPermission } from "../models/ApiKey";
import {
  listUserApiKeys,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyStats,
} from "../services/apiKey.service";
import logger from "../utils/logger";

/**
 * List all API keys for the authenticated user
 */
export const listApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await listUserApiKeys(userId!, page, limit);

    // Add stats to each key
    const keysWithStats = await Promise.all(
      result.keys.map(async (key) => {
        const stats = await getApiKeyStats(String(key._id));
        return {
          ...key.toObject(),
          stats,
        };
      })
    );

    res.json({
      success: true,
      data: keysWithStats,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    logger.error("Error listing API keys:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao listar API keys",
    });
  }
};

/**
 * Get a single API key by ID
 */
export const getApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await listUserApiKeys(userId!, 1, 1);
    const apiKey = result.keys.find((k) => String(k._id) === id);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: "API key não encontrada",
      });
    }

    const stats = await getApiKeyStats(id);

    res.json({
      success: true,
      data: {
        ...apiKey.toObject(),
        stats,
      },
    });
  } catch (error) {
    logger.error("Error getting API key:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar API key",
    });
  }
};

/**
 * Create a new API key
 */
export const createApiKeyHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, permissions, scopes, rateLimit, expiresInDays } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Nome é obrigatório",
      });
    }

    // Validate permissions
    let validPermissions: ApiKeyPermission[] = [ApiKeyPermission.READ_EMAILS];
    if (permissions && Array.isArray(permissions)) {
      validPermissions = permissions.filter((p: string) =>
        Object.values(ApiKeyPermission).includes(p as ApiKeyPermission)
      );
      if (validPermissions.length === 0) {
        validPermissions = [ApiKeyPermission.READ_EMAILS];
      }
    }

    const { apiKey, rawKey } = await createApiKey(userId!, name, {
      permissions: validPermissions,
      scopes,
      rateLimit: rateLimit ? Math.min(Math.max(rateLimit, 10), 10000) : 1000,
      expiresInDays: expiresInDays ? Math.min(Math.max(expiresInDays, 1), 365) : undefined,
    });

    logger.info(`API key created: ${apiKey.keyPrefix} for user ${userId}`);

    // Return API key with the raw key (shown only once!)
    res.status(201).json({
      success: true,
      data: {
        ...apiKey.toObject(),
        rawKey, // This is the only time the raw key is returned
      },
      message: "API key criada com sucesso. Guarde a key, ela não será exibida novamente!",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao criar API key";
    logger.error("Error creating API key:", error);

    if (errorMsg.includes("Maximum of 10")) {
      return res.status(400).json({
        success: false,
        error: "Limite máximo de 10 API keys atingido",
      });
    }

    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
};

/**
 * Update an API key
 */
export const updateApiKeyHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, permissions, scopes, rateLimit, isActive } = req.body;

    // Validate permissions if provided
    let validPermissions: ApiKeyPermission[] | undefined;
    if (permissions && Array.isArray(permissions)) {
      validPermissions = permissions.filter((p: string) =>
        Object.values(ApiKeyPermission).includes(p as ApiKeyPermission)
      );
      if (validPermissions.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Pelo menos uma permissão válida é necessária",
        });
      }
    }

    const updatedKey = await updateApiKey(id, userId!, {
      name,
      permissions: validPermissions,
      scopes,
      rateLimit,
      isActive,
    });

    if (!updatedKey) {
      return res.status(404).json({
        success: false,
        error: "API key não encontrada",
      });
    }

    res.json({
      success: true,
      data: updatedKey,
    });
  } catch (error) {
    logger.error("Error updating API key:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao atualizar API key",
    });
  }
};

/**
 * Revoke (deactivate) an API key
 */
export const revokeApiKeyHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const success = await revokeApiKey(id, userId!);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "API key não encontrada",
      });
    }

    res.json({
      success: true,
      message: "API key revogada com sucesso",
    });
  } catch (error) {
    logger.error("Error revoking API key:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao revogar API key",
    });
  }
};

/**
 * Delete an API key permanently
 */
export const deleteApiKeyHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const success = await deleteApiKey(id, userId!);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "API key não encontrada",
      });
    }

    res.json({
      success: true,
      message: "API key excluída com sucesso",
    });
  } catch (error) {
    logger.error("Error deleting API key:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao excluir API key",
    });
  }
};

/**
 * Get available permissions
 */
export const getAvailablePermissions = async (_req: Request, res: Response) => {
  const permissions = [
    {
      value: ApiKeyPermission.READ_EMAILS,
      label: "Ler Emails",
      description: "Permite ler emails e listar caixas",
    },
    {
      value: ApiKeyPermission.WRITE_EMAILS,
      label: "Escrever Emails",
      description: "Permite deletar emails",
    },
    {
      value: ApiKeyPermission.MANAGE_BOXES,
      label: "Gerenciar Caixas",
      description: "Permite criar, editar e deletar caixas",
    },
    {
      value: ApiKeyPermission.WEBHOOKS,
      label: "Webhooks",
      description: "Permite gerenciar webhooks",
    },
  ];

  res.json({
    success: true,
    data: permissions,
  });
};

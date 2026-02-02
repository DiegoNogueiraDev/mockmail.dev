import crypto from "crypto";
import ApiKey, { IApiKey, ApiKeyPermission } from "../models/ApiKey";
import logger from "../utils/logger";

const API_KEY_PREFIX = "mm_live_";

/**
 * Generate a new API key
 * Returns both the raw key (shown once) and the hash (stored)
 */
export const generateApiKey = (): { rawKey: string; keyHash: string; keyPrefix: string } => {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const rawKey = `${API_KEY_PREFIX}${randomBytes}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 12); // "mm_live_xxxx"

  return { rawKey, keyHash, keyPrefix };
};

/**
 * Hash an API key for lookup
 */
export const hashApiKey = (key: string): string => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

/**
 * Validate an API key and return the associated key document
 */
export const validateApiKey = async (rawKey: string): Promise<IApiKey | null> => {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await ApiKey.findOne({
    keyHash,
    isActive: true,
  });

  if (!apiKey) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    logger.warn(`API key expired: ${apiKey.keyPrefix}`);
    return null;
  }

  // Update usage statistics
  await ApiKey.updateOne(
    { _id: apiKey._id },
    {
      $set: { lastUsedAt: new Date() },
      $inc: { usageCount: 1 },
    }
  );

  return apiKey;
};

/**
 * Check if API key has required permission
 */
export const hasPermission = (apiKey: IApiKey, permission: ApiKeyPermission): boolean => {
  return apiKey.permissions.includes(permission);
};

/**
 * Check if API key has access to a specific box
 */
export const hasBoxAccess = (apiKey: IApiKey, boxId: string): boolean => {
  // If no scopes defined, access to all boxes
  if (!apiKey.scopes || apiKey.scopes.length === 0) {
    return true;
  }
  return apiKey.scopes.includes(boxId);
};

/**
 * Get API key usage statistics
 */
export const getApiKeyStats = async (keyId: string): Promise<{
  usageCount: number;
  lastUsedAt?: Date;
  isExpired: boolean;
  daysUntilExpiry?: number;
}> => {
  const apiKey = await ApiKey.findById(keyId);
  if (!apiKey) {
    throw new Error("API key not found");
  }

  const now = new Date();
  const isExpired = apiKey.expiresAt ? apiKey.expiresAt < now : false;
  let daysUntilExpiry: number | undefined;

  if (apiKey.expiresAt && !isExpired) {
    daysUntilExpiry = Math.ceil(
      (apiKey.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    usageCount: apiKey.usageCount,
    lastUsedAt: apiKey.lastUsedAt,
    isExpired,
    daysUntilExpiry,
  };
};

/**
 * List all API keys for a user (without exposing the actual key)
 */
export const listUserApiKeys = async (
  userId: string,
  page = 1,
  limit = 10
): Promise<{
  keys: IApiKey[];
  total: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const [keys, total] = await Promise.all([
    ApiKey.find({ userId })
      .select("-keyHash") // Never expose the hash
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ApiKey.countDocuments({ userId }),
  ]);

  return {
    keys,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Create a new API key
 */
export const createApiKey = async (
  userId: string,
  name: string,
  options: {
    permissions?: ApiKeyPermission[];
    scopes?: string[];
    rateLimit?: number;
    expiresInDays?: number;
  } = {}
): Promise<{ apiKey: IApiKey; rawKey: string }> => {
  // Check limit (max 10 keys per user)
  const existingCount = await ApiKey.countDocuments({ userId });
  if (existingCount >= 10) {
    throw new Error("Maximum of 10 API keys allowed per user");
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const apiKey = await ApiKey.create({
    userId,
    name: name.trim(),
    keyHash,
    keyPrefix,
    permissions: options.permissions || [ApiKeyPermission.READ_EMAILS],
    scopes: options.scopes || [],
    rateLimit: options.rateLimit || 1000,
    expiresAt,
  });

  logger.info(`API key created: ${keyPrefix} for user ${userId}`);

  return { apiKey, rawKey };
};

/**
 * Revoke (deactivate) an API key
 */
export const revokeApiKey = async (keyId: string, userId: string): Promise<boolean> => {
  const result = await ApiKey.updateOne(
    { _id: keyId, userId },
    { $set: { isActive: false } }
  );

  if (result.modifiedCount > 0) {
    logger.info(`API key revoked: ${keyId}`);
    return true;
  }
  return false;
};

/**
 * Delete an API key permanently
 */
export const deleteApiKey = async (keyId: string, userId: string): Promise<boolean> => {
  const result = await ApiKey.deleteOne({ _id: keyId, userId });
  if (result.deletedCount > 0) {
    logger.info(`API key deleted: ${keyId}`);
    return true;
  }
  return false;
};

/**
 * Update API key settings
 */
export const updateApiKey = async (
  keyId: string,
  userId: string,
  updates: {
    name?: string;
    permissions?: ApiKeyPermission[];
    scopes?: string[];
    rateLimit?: number;
    isActive?: boolean;
  }
): Promise<IApiKey | null> => {
  const updateData: Record<string, unknown> = {};

  if (updates.name) updateData.name = updates.name.trim();
  if (updates.permissions) updateData.permissions = updates.permissions;
  if (updates.scopes !== undefined) updateData.scopes = updates.scopes;
  if (updates.rateLimit) updateData.rateLimit = Math.min(Math.max(updates.rateLimit, 10), 10000);
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

  const apiKey = await ApiKey.findOneAndUpdate(
    { _id: keyId, userId },
    { $set: updateData },
    { new: true }
  ).select("-keyHash");

  return apiKey;
};

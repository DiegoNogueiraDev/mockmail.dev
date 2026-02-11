import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

/**
 * Cache Service - Provides generic caching functionality using Redis
 *
 * Patterns used:
 * - Cache-aside: Application checks cache first, fetches from DB if miss
 * - TTL-based expiration: Automatic cache invalidation after timeout
 * - Key prefixes: Organized namespacing for different data types
 */

// Cache configuration
const CACHE_CONFIG = {
  // Default TTLs in seconds
  TTL: {
    SHORT: 60,        // 1 minute - for frequently changing data
    MEDIUM: 300,      // 5 minutes - for moderately changing data
    LONG: 900,        // 15 minutes - for rarely changing data
    STATS: 120,       // 2 minutes - for statistics/dashboard
  },
  // Key prefixes for organization
  PREFIX: {
    USER: 'cache:user:',
    BOXES: 'cache:boxes:',
    EMAILS: 'cache:emails:',
    STATS: 'cache:stats:',
    WEBHOOKS: 'cache:webhooks:',
    API_KEYS: 'cache:apikeys:',
    ADMIN: 'cache:admin:',
    DASHBOARD: 'cache:dashboard:',
  },
};

/**
 * Get data from cache
 * @param key - Cache key
 * @returns Parsed data or null if not found
 */
export const getFromCache = async <T>(key: string): Promise<T | null> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return null;
    }

    const cached = await redis.get(key);
    if (!cached) {
      return null;
    }

    logger.debug(`CACHE-SERVICE - Cache HIT: ${key}`);
    return JSON.parse(cached) as T;
  } catch (error) {
    logger.error(`CACHE-SERVICE - Error getting from cache: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Set data in cache
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds (default: MEDIUM)
 */
export const setInCache = async <T>(
  key: string,
  data: T,
  ttl: number = CACHE_CONFIG.TTL.MEDIUM
): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    await redis.setEx(key, ttl, JSON.stringify(data));
    logger.debug(`CACHE-SERVICE - Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    logger.error(`CACHE-SERVICE - Error setting cache: ${(error as Error).message}`);
  }
};

/**
 * Delete specific key from cache
 * @param key - Cache key to delete
 */
export const deleteFromCache = async (key: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    await redis.del(key);
    logger.debug(`CACHE-SERVICE - Cache DELETE: ${key}`);
  } catch (error) {
    logger.error(`CACHE-SERVICE - Error deleting from cache: ${(error as Error).message}`);
  }
};

/**
 * Invalidate all cache entries matching a pattern
 * Uses SCAN for production-safe pattern matching (non-blocking)
 * @param pattern - Pattern to match (e.g., "cache:user:123:*")
 */
export const invalidatePattern = async (pattern: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    let cursor: string = '0';
    let deletedCount = 0;

    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = String(result.cursor);

      if (result.keys.length > 0) {
        await redis.del(result.keys);
        deletedCount += result.keys.length;
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      logger.info(`CACHE-SERVICE - Invalidated ${deletedCount} keys matching: ${pattern}`);
    }
  } catch (error) {
    logger.error(`CACHE-SERVICE - Error invalidating pattern: ${(error as Error).message}`);
  }
};

/**
 * Cache-aside pattern helper: get from cache or fetch and cache
 * @param key - Cache key
 * @param fetcher - Function to fetch data if not in cache
 * @param ttl - Time to live in seconds
 */
export const getOrSet = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.TTL.MEDIUM
): Promise<T> => {
  // Try to get from cache first
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from source
  const data = await fetcher();

  // Cache the result
  await setInCache(key, data, ttl);

  return data;
};

// =====================================================
// User-specific cache helpers
// =====================================================

/**
 * Get cache key for user's boxes list
 */
export const getUserBoxesCacheKey = (userId: string, page: number, limit: number, search?: string): string => {
  const base = `${CACHE_CONFIG.PREFIX.BOXES}${userId}:list:${page}:${limit}`;
  return search ? `${base}:s:${search.substring(0, 30)}` : base;
};;

/**
 * Get cache key for user's emails list
 */
export const getUserEmailsCacheKey = (userId: string, page: number, limit: number, search?: string): string => {
  const base = `${CACHE_CONFIG.PREFIX.EMAILS}${userId}:list:${page}:${limit}`;
  return search ? `${base}:s:${search.substring(0, 30)}` : base;
};;

/**
 * Get cache key for a specific box's emails
 */
export const getBoxEmailsCacheKey = (boxId: string, page: number, limit: number, search?: string): string => {
  const base = `${CACHE_CONFIG.PREFIX.EMAILS}box:${boxId}:${page}:${limit}`;
  return search ? `${base}:s:${search.substring(0, 30)}` : base;
};;

/**
 * Invalidate cache for a specific box's emails
 */
export const invalidateBoxEmailsCache = async (boxId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.EMAILS}box:${boxId}:*`);
};

/**
 * Get cache key for dashboard stats
 */
export const getStatsCacheKey = (userId: string): string => {
  return `${CACHE_CONFIG.PREFIX.STATS}${userId}:dashboard`;
};

/**
 * Get cache key for user's webhooks list
 */
export const getUserWebhooksCacheKey = (userId: string, page: number, limit: number): string => {
  return `${CACHE_CONFIG.PREFIX.WEBHOOKS}${userId}:list:${page}:${limit}`;
};

/**
 * Get cache key for user's API keys list
 */
export const getUserApiKeysCacheKey = (userId: string, page: number, limit: number): string => {
  return `${CACHE_CONFIG.PREFIX.API_KEYS}${userId}:list:${page}:${limit}`;
};

/**
 * Invalidate all cache for a user's boxes
 */
export const invalidateUserBoxesCache = async (userId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.BOXES}${userId}:*`);
  // Also invalidate stats and dashboard since boxes affect them
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.STATS}${userId}:*`);
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:*`);
};

/**
 * Invalidate all cache for a user's emails
 */
export const invalidateUserEmailsCache = async (userId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.EMAILS}${userId}:*`);
  // Also invalidate stats and dashboard since emails affect them
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.STATS}${userId}:*`);
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:*`);
};

/**
 * Invalidate all cache for a user's webhooks
 */
export const invalidateUserWebhooksCache = async (userId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.WEBHOOKS}${userId}:*`);
};

/**
 * Invalidate all cache for a user's API keys
 */
export const invalidateUserApiKeysCache = async (userId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.API_KEYS}${userId}:*`);
};

/**
 * Invalidate all cache for a user
 */
export const invalidateAllUserCache = async (userId: string): Promise<void> => {
  await Promise.all([
    invalidateUserBoxesCache(userId),
    invalidateUserEmailsCache(userId),
    invalidateUserWebhooksCache(userId),
    invalidateUserApiKeysCache(userId),
  ]);
};

// =====================================================
// Admin-specific cache helpers
// =====================================================

/**
 * Get cache key for admin platform stats
 */
export const getAdminStatsCacheKey = (): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}platform:stats`;
};

/**
 * Get cache key for admin charts data
 */
export const getAdminChartsCacheKey = (period: string): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}charts:${period}`;
};

/**
 * Get cache key for admin users list
 */
export const getAdminUsersCacheKey = (page: number, limit: number): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}users:list:${page}:${limit}`;
};

/**
 * Get cache key for admin user details
 */
export const getAdminUserDetailsCacheKey = (userId: string): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}users:${userId}:details`;
};

/**
 * Get cache key for admin boxes list
 */
export const getAdminBoxesCacheKey = (page: number, limit: number, status: string): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}boxes:list:${page}:${limit}:${status}`;
};

/**
 * Get cache key for admin history list
 */
export const getAdminHistoryCacheKey = (page: number, limit: number, userId?: string, boxAddress?: string): string => {
  const userPart = userId || 'all';
  const boxPart = boxAddress || 'all';
  return `${CACHE_CONFIG.PREFIX.ADMIN}history:list:${page}:${limit}:${userPart}:${boxPart}`;
};

/**
 * Get cache key for admin history details
 */
export const getAdminHistoryDetailsCacheKey = (historyId: string): string => {
  return `${CACHE_CONFIG.PREFIX.ADMIN}history:${historyId}`;
};

/**
 * Invalidate all admin cache
 */
export const invalidateAdminCache = async (): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.ADMIN}*`);
};

/**
 * Invalidate admin stats cache
 */
export const invalidateAdminStatsCache = async (): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.ADMIN}platform:*`);
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.ADMIN}charts:*`);
};

/**
 * Invalidate admin users cache
 */
export const invalidateAdminUsersCache = async (): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.ADMIN}users:*`);
};

/**
 * Invalidate admin boxes cache
 */
export const invalidateAdminBoxesCache = async (): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.ADMIN}boxes:*`);
};

// =====================================================
// Dashboard-specific cache helpers
// =====================================================

/**
 * Get cache key for user dashboard stats
 */
export const getDashboardStatsCacheKey = (userId: string): string => {
  return `${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:stats`;
};

/**
 * Get cache key for user recent emails
 */
export const getDashboardRecentEmailsCacheKey = (userId: string, limit: number): string => {
  return `${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:recent:${limit}`;
};

/**
 * Get cache key for user usage stats
 */
export const getDashboardUsageCacheKey = (userId: string): string => {
  return `${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:usage`;
};

/**
 * Invalidate all dashboard cache for a user
 */
export const invalidateDashboardCache = async (userId: string): Promise<void> => {
  await invalidatePattern(`${CACHE_CONFIG.PREFIX.DASHBOARD}${userId}:*`);
};

// Export configuration for use in other modules
export const CACHE_TTL = CACHE_CONFIG.TTL;
export const CACHE_PREFIX = CACHE_CONFIG.PREFIX;

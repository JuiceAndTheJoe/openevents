/**
 * Redis/Valkey Client Module
 *
 * Provides a singleton Redis client for:
 * - Rate limiting
 * - Caching frequently accessed data
 * - Session revocation (future)
 *
 * Uses lazy initialization to avoid connection errors when Redis is not configured.
 */
import Redis from 'ioredis'

let redis: Redis | null = null

/**
 * Get Redis client instance (lazy initialization)
 * Returns null if REDIS_URL is not configured
 */
export function getRedisClient(): Redis | null {
  if (redis) return redis

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured - rate limiting and caching disabled')
    return null
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000)
        return delay
      },
    })

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })

    return redis
  } catch (error) {
    console.error('[Redis] Failed to create client:', error)
    return null
  }
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    await client.ping()
    return true
  } catch {
    return false
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

// =============================================================================
// Caching Utilities
// =============================================================================

const DEFAULT_CACHE_TTL = 300 // 5 minutes

/**
 * Get a cached value or fetch and cache it
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch the value if not cached
 * @param ttl - Time to live in seconds (default: 300)
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<T> {
  const client = getRedisClient()

  // If Redis is not available, just fetch directly
  if (!client) {
    return fetcher()
  }

  try {
    // Try to get cached value
    const cached = await client.get(key)
    if (cached) {
      return JSON.parse(cached) as T
    }

    // Fetch and cache
    const value = await fetcher()
    await client.setex(key, ttl, JSON.stringify(value))
    return value
  } catch (error) {
    console.error('[Redis] Cache error:', error)
    // Fallback to direct fetch on error
    return fetcher()
  }
}

/**
 * Invalidate a cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client) return

  try {
    await client.del(key)
  } catch (error) {
    console.error('[Redis] Failed to invalidate cache:', error)
  }
}

/**
 * Invalidate all cache keys matching a pattern
 *
 * @param pattern - Redis key pattern (e.g., "events:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const client = getRedisClient()
  if (!client) return

  try {
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch (error) {
    console.error('[Redis] Failed to invalidate cache pattern:', error)
  }
}

// =============================================================================
// Cache Key Generators
// =============================================================================

export const cacheKeys = {
  /** Published events list (paginated) */
  eventsList: (page: number, limit: number) => `events:published:${page}:${limit}`,

  /** Single event by slug */
  eventBySlug: (slug: string) => `event:slug:${slug}`,

  /** Event by ID */
  eventById: (id: string) => `event:id:${id}`,

  /** Organizer's events */
  organizerEvents: (organizerId: string) => `events:organizer:${organizerId}`,
}

export { redis }

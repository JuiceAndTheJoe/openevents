/**
 * Rate Limiting with Valkey/Redis
 *
 * Uses sliding window algorithm for smooth rate limiting.
 * Falls back to allowing requests if Redis is unavailable.
 */
import { getRedisClient } from '@/lib/redis'

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
  /** Prefix for the Redis key */
  prefix: string
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean
  /** Number of remaining requests in the window */
  remaining: number
  /** Seconds until the rate limit resets */
  resetIn: number
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  /** Login: 5 attempts per 15 minutes per IP */
  login: {
    maxRequests: 5,
    windowSeconds: 15 * 60,
    prefix: 'rl:login',
  },
  /** Registration: 10 per hour per IP */
  register: {
    maxRequests: 10,
    windowSeconds: 60 * 60,
    prefix: 'rl:register',
  },
  /** Forgot password: 3 per hour per email */
  forgotPassword: {
    maxRequests: 3,
    windowSeconds: 60 * 60,
    prefix: 'rl:forgot',
  },
  /** Discount code validation: 10 per minute per IP */
  discountValidation: {
    maxRequests: 10,
    windowSeconds: 60,
    prefix: 'rl:discount',
  },
  /** General API: 100 per minute per IP */
  api: {
    maxRequests: 100,
    windowSeconds: 60,
    prefix: 'rl:api',
  },
} as const

/**
 * Check rate limit for a given identifier using sliding window algorithm
 *
 * @param identifier - Unique identifier (e.g., IP address, email, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient()

  // If Redis is not available, allow the request (fail-open for availability)
  if (!redis) {
    return {
      success: true,
      remaining: config.maxRequests,
      resetIn: 0,
    }
  }

  const key = `${config.prefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  try {
    // Use a transaction for atomic operations
    const pipeline = redis.pipeline()

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Count current requests in window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`)

    // Set expiry on the key
    pipeline.expire(key, config.windowSeconds)

    const results = await pipeline.exec()

    if (!results) {
      // Pipeline failed, allow request
      return { success: true, remaining: config.maxRequests, resetIn: 0 }
    }

    // Get the count (second command result)
    const count = (results[1]?.[1] as number) || 0

    const remaining = Math.max(0, config.maxRequests - count - 1)
    const success = count < config.maxRequests

    if (!success) {
      // Get the oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const oldestTime = oldest.length >= 2 ? parseInt(oldest[1], 10) : now
      const resetIn = Math.ceil((oldestTime + config.windowSeconds * 1000 - now) / 1000)

      return {
        success: false,
        remaining: 0,
        resetIn: Math.max(1, resetIn),
      }
    }

    return {
      success: true,
      remaining,
      resetIn: config.windowSeconds,
    }
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error)
    // Fail-open: allow request on error
    return { success: true, remaining: config.maxRequests, resetIn: 0 }
  }
}

/**
 * Create rate limit headers for HTTP response
 */
export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): HeadersInit {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + result.resetIn),
    ...(result.success ? {} : { 'Retry-After': String(result.resetIn) }),
  }
}

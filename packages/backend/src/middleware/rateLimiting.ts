import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { loggerService } from '../services/LoggerService';
import { redis } from '../database/redis';

/**
 * Custom rate limit store using Redis
 */
class RedisStore {
  private prefix: string;

  constructor(prefix: string = 'rl:') {
    this.prefix = prefix;
  }

  async increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const client = redis.getClient();
      const current = await client.get(redisKey);
      const hits = current ? parseInt(current, 10) + 1 : 1;
      
      if (hits === 1) {
        // Set expiration for new keys
        await client.setEx(redisKey, 900, hits.toString()); // 15 minutes
        return { totalHits: hits, timeToExpire: 900000 };
      } else {
        await client.set(redisKey, hits.toString());
        const ttl = await client.ttl(redisKey);
        return { totalHits: hits, timeToExpire: ttl * 1000 };
      }
    } catch (error) {
      loggerService.error('Redis rate limit store error', error as Error);
      // Fallback to allowing the request if Redis fails
      return { totalHits: 1 };
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const client = redis.getClient();
      const current = await client.get(redisKey);
      if (current) {
        const hits = Math.max(0, parseInt(current, 10) - 1);
        if (hits === 0) {
          await client.del(redisKey);
        } else {
          await client.set(redisKey, hits.toString());
        }
      }
    } catch (error) {
      loggerService.error('Redis rate limit decrement error', error as Error);
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const client = redis.getClient();
      await client.del(redisKey);
    } catch (error) {
      loggerService.error('Redis rate limit reset error', error as Error);
    }
  }
}

/**
 * Enhanced key generator that includes user ID when available
 */
const keyGenerator = (req: Request): string => {
  const userId = req.user?.id;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (userId) {
    return `user:${userId}`;
  }
  
  return `ip:${ip}`;
};

/**
 * Rate limit handler with detailed logging
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const userId = req.user?.id;
  const ip = req.ip || req.connection.remoteAddress;
  
  loggerService.warn('Rate limit exceeded', {
    userId,
    ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: res.get('Retry-After')
  });
};

/**
 * General API rate limiting (100 requests per 15 minutes)
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('general:') as any
});

/**
 * Authentication rate limiting (5 attempts per 15 minutes)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body.email || 'unknown';
    return `auth:${ip}:${email}`;
  },
  handler: (req: Request, res: Response) => {
    loggerService.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      path: req.path,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: '900'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('auth:') as any
});

/**
 * OAuth rate limiting (10 attempts per hour)
 */
export const oauthRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('oauth:') as any
});

/**
 * Post creation rate limiting (20 posts per hour)
 */
export const postCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator,
  handler: (req: Request, res: Response) => {
    loggerService.warn('Post creation rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      error: 'Too many posts created. Please try again in an hour.',
      retryAfter: '3600'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('posts:') as any
});

/**
 * File upload rate limiting (50 uploads per hour)
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyGenerator,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('upload:') as any
});

/**
 * Password reset rate limiting (3 attempts per hour)
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body.email || 'unknown';
    return `reset:${ip}:${email}`;
  },
  handler: (req: Request, res: Response) => {
    loggerService.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts. Please try again in an hour.',
      retryAfter: '3600'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('reset:') as any
});

/**
 * Webhook rate limiting (100 requests per minute)
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req: Request) => {
    // For webhooks, use IP and User-Agent combination
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `webhook:${ip}:${userAgent}`;
  },
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('webhook:') as any
});

/**
 * Health check rate limiting (very permissive - 1000 per minute)
 */
export const healthCheckRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `health:${ip}`;
  },
  handler: rateLimitHandler,
  standardHeaders: false,
  legacyHeaders: false,
  store: new RedisStore('health:') as any
});
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

/**
 * Adaptive rate limiting based on user behavior
 */
export class AdaptiveRateLimit {
  private static instance: AdaptiveRateLimit;
  private suspiciousIPs: Set<string> = new Set();
  private trustedUsers: Set<string> = new Set();

  static getInstance(): AdaptiveRateLimit {
    if (!AdaptiveRateLimit.instance) {
      AdaptiveRateLimit.instance = new AdaptiveRateLimit();
    }
    return AdaptiveRateLimit.instance;
  }

  /**
   * Mark IP as suspicious
   */
  markSuspicious(ip: string): void {
    this.suspiciousIPs.add(ip);
    // Remove after 1 hour
    setTimeout(() => {
      this.suspiciousIPs.delete(ip);
    }, 60 * 60 * 1000);
  }

  /**
   * Mark user as trusted
   */
  markTrusted(userId: string): void {
    this.trustedUsers.add(userId);
  }

  /**
   * Get adaptive rate limit based on user/IP reputation
   */
  getAdaptiveLimit(req: Request, baseLimit: number): number {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id;

    // Reduce limit for suspicious IPs
    if (this.suspiciousIPs.has(ip)) {
      return Math.floor(baseLimit * 0.1); // 10% of normal limit
    }

    // Increase limit for trusted users
    if (userId && this.trustedUsers.has(userId)) {
      return Math.floor(baseLimit * 2); // 200% of normal limit
    }

    return baseLimit;
  }

  /**
   * Create adaptive rate limiter
   */
  createAdaptiveRateLimit(options: {
    windowMs: number;
    baseMax: number;
    keyGenerator?: (req: Request) => string;
    storePrefix: string;
  }) {
    return rateLimit({
      windowMs: options.windowMs,
      max: (req: Request) => {
        return this.getAdaptiveLimit(req, options.baseMax);
      },
      keyGenerator: options.keyGenerator || keyGenerator,
      handler: (req: Request, res: Response) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        
        // Mark IP as suspicious after rate limit hit
        this.markSuspicious(ip);
        
        loggerService.warn('Adaptive rate limit exceeded', {
          ip,
          userId: req.user?.id,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent')
        });

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Your request frequency has been restricted.',
          retryAfter: res.get('Retry-After')
        });
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore(options.storePrefix) as any
    });
  }
}

/**
 * Strict rate limiting for sensitive endpoints
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Very restrictive
  keyGenerator,
  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    loggerService.error('Strict rate limit exceeded', new Error('Rate limit exceeded'), {
      ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    // Mark IP as suspicious
    AdaptiveRateLimit.getInstance().markSuspicious(ip);

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for sensitive operation. Please contact support if you believe this is an error.',
      retryAfter: '3600'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('strict:') as any
});

/**
 * Progressive rate limiting that increases restrictions on repeated violations
 */
export const progressiveRateLimit = (baseLimit: number, windowMs: number, storePrefix: string) => {
  return rateLimit({
    windowMs,
    max: async (req: Request) => {
      const key = keyGenerator(req);
      const violationKey = `violations:${key}`;
      
      try {
        const client = redis.getClient();
        const violations = await client.get(violationKey);
        const violationCount = violations ? parseInt(violations, 10) : 0;
        
        // Reduce limit based on violation history
        const multiplier = Math.max(0.1, 1 - (violationCount * 0.2));
        return Math.floor(baseLimit * multiplier);
      } catch (error) {
        loggerService.error('Error getting violation count', error as Error);
        return baseLimit;
      }
    },
    handler: async (req: Request, res: Response) => {
      const key = keyGenerator(req);
      const violationKey = `violations:${key}`;
      
      try {
        const client = redis.getClient();
        await client.incr(violationKey);
        await client.expire(violationKey, 24 * 60 * 60); // 24 hours
      } catch (error) {
        loggerService.error('Error recording rate limit violation', error as Error);
      }

      loggerService.warn('Progressive rate limit exceeded', {
        key,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Continued violations will result in further restrictions.',
        retryAfter: res.get('Retry-After')
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(storePrefix) as any
  });
};
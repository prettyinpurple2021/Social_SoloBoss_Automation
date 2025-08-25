/**
 * API Analytics Service
 * 
 * Tracks API usage, performance metrics, and provides insights for developers
 * and administrators. Includes rate limit monitoring and usage analytics.
 */

import { Request, Response } from 'express';
import { redis } from '../database/redis';
import { loggerService } from './LoggerService';

export interface ApiUsageMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestId: string;
  errorCode?: string;
  rateLimited?: boolean;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  lastAccessed: Date;
  rateLimitHits: number;
}

export interface UserUsageStats {
  userId: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
  rateLimitHits: number;
  lastActivity: Date;
}

export interface RateLimitStatus {
  endpoint: string;
  method: string;
  limit: number;
  remaining: number;
  resetTime: Date;
  windowStart: Date;
  userId?: string;
  ipAddress?: string;
}

export interface ApiAnalyticsSummary {
  totalRequests: number;
  totalUsers: number;
  averageResponseTime: number;
  successRate: number;
  topEndpoints: EndpointStats[];
  topUsers: UserUsageStats[];
  errorBreakdown: Record<string, number>;
  rateLimitStats: {
    totalHits: number;
    topLimitedEndpoints: Array<{
      endpoint: string;
      method: string;
      hits: number;
    }>;
  };
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class ApiAnalyticsService {
  private static instance: ApiAnalyticsService;
  private metricsBuffer: ApiUsageMetric[] = [];
  private readonly BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startFlushTimer();
  }

  public static getInstance(): ApiAnalyticsService {
    if (!ApiAnalyticsService.instance) {
      ApiAnalyticsService.instance = new ApiAnalyticsService();
    }
    return ApiAnalyticsService.instance;
  }

  /**
   * Track API usage metric
   */
  public trackApiUsage(
    req: Request,
    res: Response,
    responseTime: number,
    errorCode?: string
  ): void {
    const metric: ApiUsageMetric = {
      endpoint: this.normalizeEndpoint(req.path),
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.headers['x-request-id'] as string || 'unknown',
      errorCode,
      rateLimited: res.statusCode === 429
    };

    this.metricsBuffer.push(metric);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushMetrics();
    }
  }

  /**
   * Track rate limit hit
   */
  public async trackRateLimit(
    endpoint: string,
    method: string,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    const key = `rate_limit_hit:${endpoint}:${method}:${new Date().toISOString().slice(0, 10)}`;
    
    try {
      await redis.incr(key);
      await redis.expire(key, 86400); // 24 hours

      // Track user-specific rate limits
      if (userId) {
        const userKey = `user_rate_limit:${userId}:${new Date().toISOString().slice(0, 10)}`;
        await redis.incr(userKey);
        await redis.expire(userKey, 86400);
      }

      // Track IP-specific rate limits
      if (ipAddress) {
        const ipKey = `ip_rate_limit:${ipAddress}:${new Date().toISOString().slice(0, 10)}`;
        await redis.incr(ipKey);
        await redis.expire(ipKey, 86400);
      }
    } catch (error) {
      loggerService.error('Failed to track rate limit', error as Error);
    }
  }

  /**
   * Get rate limit status for endpoint
   */
  public async getRateLimitStatus(
    endpoint: string,
    method: string,
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitStatus> {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const key = `rate_limit:${endpoint}:${method}:${identifier}:${windowStart.getTime()}`;

    try {
      const current = await redis.get(key);
      const remaining = Math.max(0, limit - (parseInt(current || '0')));
      const resetTime = new Date(windowStart.getTime() + windowMs);

      return {
        endpoint,
        method,
        limit,
        remaining,
        resetTime,
        windowStart,
        userId: identifier.startsWith('user:') ? identifier.replace('user:', '') : undefined,
        ipAddress: identifier.startsWith('ip:') ? identifier.replace('ip:', '') : undefined
      };
    } catch (error) {
      loggerService.error('Failed to get rate limit status', error as Error);
      
      // Return safe defaults on error
      return {
        endpoint,
        method,
        limit,
        remaining: limit,
        resetTime: new Date(Date.now() + windowMs),
        windowStart
      };
    }
  }

  /**
   * Get API analytics summary
   */
  public async getAnalyticsSummary(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ApiAnalyticsSummary> {
    try {
      const metrics = await this.getMetricsFromStorage(startDate, endDate, userId);
      
      const totalRequests = metrics.length;
      const successRequests = metrics.filter(m => m.statusCode < 400).length;
      const errorRequests = totalRequests - successRequests;
      const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
      const successRate = totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;

      // Calculate endpoint stats
      const endpointMap = new Map<string, EndpointStats>();
      metrics.forEach(metric => {
        const key = `${metric.method} ${metric.endpoint}`;
        const existing = endpointMap.get(key) || {
          endpoint: metric.endpoint,
          method: metric.method,
          totalRequests: 0,
          successRequests: 0,
          errorRequests: 0,
          averageResponseTime: 0,
          minResponseTime: Infinity,
          maxResponseTime: 0,
          successRate: 0,
          lastAccessed: metric.timestamp,
          rateLimitHits: 0
        };

        existing.totalRequests++;
        if (metric.statusCode < 400) existing.successRequests++;
        else existing.errorRequests++;
        
        existing.averageResponseTime = (existing.averageResponseTime + metric.responseTime) / 2;
        existing.minResponseTime = Math.min(existing.minResponseTime, metric.responseTime);
        existing.maxResponseTime = Math.max(existing.maxResponseTime, metric.responseTime);
        existing.successRate = (existing.successRequests / existing.totalRequests) * 100;
        existing.lastAccessed = metric.timestamp > existing.lastAccessed ? metric.timestamp : existing.lastAccessed;
        
        if (metric.rateLimited) existing.rateLimitHits++;

        endpointMap.set(key, existing);
      });

      const topEndpoints = Array.from(endpointMap.values())
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10);

      // Calculate user stats
      const userMap = new Map<string, UserUsageStats>();
      metrics.forEach(metric => {
        if (!metric.userId) return;

        const existing = userMap.get(metric.userId) || {
          userId: metric.userId,
          totalRequests: 0,
          successRequests: 0,
          errorRequests: 0,
          averageResponseTime: 0,
          topEndpoints: [],
          rateLimitHits: 0,
          lastActivity: metric.timestamp
        };

        existing.totalRequests++;
        if (metric.statusCode < 400) existing.successRequests++;
        else existing.errorRequests++;
        
        existing.averageResponseTime = (existing.averageResponseTime + metric.responseTime) / 2;
        existing.lastActivity = metric.timestamp > existing.lastActivity ? metric.timestamp : existing.lastActivity;
        
        if (metric.rateLimited) existing.rateLimitHits++;

        userMap.set(metric.userId, existing);
      });

      const topUsers = Array.from(userMap.values())
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10);

      // Calculate error breakdown
      const errorBreakdown = metrics
        .filter(m => m.errorCode)
        .reduce((acc, m) => {
          acc[m.errorCode!] = (acc[m.errorCode!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      // Calculate rate limit stats
      const rateLimitHits = metrics.filter(m => m.rateLimited).length;
      const rateLimitedEndpoints = new Map<string, number>();
      
      metrics.filter(m => m.rateLimited).forEach(metric => {
        const key = `${metric.method} ${metric.endpoint}`;
        rateLimitedEndpoints.set(key, (rateLimitedEndpoints.get(key) || 0) + 1);
      });

      const topLimitedEndpoints = Array.from(rateLimitedEndpoints.entries())
        .map(([endpoint, hits]) => {
          const [method, path] = endpoint.split(' ', 2);
          return { endpoint: path, method, hits };
        })
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5);

      return {
        totalRequests,
        totalUsers: userMap.size,
        averageResponseTime,
        successRate,
        topEndpoints,
        topUsers,
        errorBreakdown,
        rateLimitStats: {
          totalHits: rateLimitHits,
          topLimitedEndpoints
        },
        timeRange: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      loggerService.error('Failed to get analytics summary', error as Error);
      throw error;
    }
  }

  /**
   * Get user-specific analytics
   */
  public async getUserAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserUsageStats> {
    const metrics = await this.getMetricsFromStorage(startDate, endDate, userId);
    
    const totalRequests = metrics.length;
    const successRequests = metrics.filter(m => m.statusCode < 400).length;
    const errorRequests = totalRequests - successRequests;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
    const rateLimitHits = metrics.filter(m => m.rateLimited).length;
    const lastActivity = metrics.length > 0 ? 
      metrics.reduce((latest, m) => m.timestamp > latest ? m.timestamp : latest, metrics[0].timestamp) :
      new Date();

    // Calculate top endpoints
    const endpointCounts = new Map<string, number>();
    metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1);
    });

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => {
        const [method, path] = endpoint.split(' ', 2);
        return { endpoint: path, method, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      userId,
      totalRequests,
      successRequests,
      errorRequests,
      averageResponseTime,
      topEndpoints,
      rateLimitHits,
      lastActivity
    };
  }

  /**
   * Get real-time API metrics
   */
  public getRealTimeMetrics(): {
    currentBuffer: number;
    recentRequests: ApiUsageMetric[];
    averageResponseTime: number;
    errorRate: number;
  } {
    const recentRequests = this.metricsBuffer.slice(-50); // Last 50 requests
    const averageResponseTime = recentRequests.reduce((sum, m) => sum + m.responseTime, 0) / recentRequests.length || 0;
    const errorRate = recentRequests.length > 0 ? 
      (recentRequests.filter(m => m.statusCode >= 400).length / recentRequests.length) * 100 : 0;

    return {
      currentBuffer: this.metricsBuffer.length,
      recentRequests,
      averageResponseTime,
      errorRate
    };
  }

  /**
   * Normalize endpoint path for analytics
   */
  private normalizeEndpoint(path: string): string {
    // Replace UUIDs and IDs with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/{id}');
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flushMetrics();
      }
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Flush metrics to storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Store metrics in Redis with expiration
      const pipeline = redis.pipeline();
      
      metricsToFlush.forEach(metric => {
        const key = `api_metric:${metric.timestamp.getTime()}:${metric.requestId}`;
        const data = JSON.stringify(metric);
        
        pipeline.setex(key, 86400 * 7, data); // Keep for 7 days
      });

      await pipeline.exec();

      loggerService.info('Flushed API metrics to storage', {
        count: metricsToFlush.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      loggerService.error('Failed to flush API metrics', error as Error);
      
      // Put metrics back in buffer to retry later
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Get metrics from storage
   */
  private async getMetricsFromStorage(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ApiUsageMetric[]> {
    try {
      const keys = await redis.keys('api_metric:*');
      const pipeline = redis.pipeline();
      
      keys.forEach(key => {
        pipeline.get(key);
      });

      const results = await pipeline.exec();
      const metrics: ApiUsageMetric[] = [];

      results?.forEach(result => {
        if (result && result[1]) {
          try {
            const metric = JSON.parse(result[1] as string) as ApiUsageMetric;
            metric.timestamp = new Date(metric.timestamp);
            
            // Filter by date range
            if (metric.timestamp >= startDate && metric.timestamp <= endDate) {
              // Filter by user if specified
              if (!userId || metric.userId === userId) {
                metrics.push(metric);
              }
            }
          } catch (parseError) {
            // Skip invalid metrics
          }
        }
      });

      return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      loggerService.error('Failed to get metrics from storage', error as Error);
      return [];
    }
  }

  /**
   * Cleanup old metrics
   */
  public async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const keys = await redis.keys('api_metric:*');
      
      const keysToDelete = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[1]);
        return timestamp < cutoffDate.getTime();
      });

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        loggerService.info('Cleaned up old API metrics', {
          deletedCount: keysToDelete.length
        });
      }
    } catch (error) {
      loggerService.error('Failed to cleanup old metrics', error as Error);
    }
  }

  /**
   * Shutdown service
   */
  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining metrics
    if (this.metricsBuffer.length > 0) {
      this.flushMetrics();
    }
  }
}

// Middleware to track API usage
export const apiAnalyticsMiddleware = (req: Request, res: Response, next: any) => {
  const startTime = Date.now();
  const analyticsService = ApiAnalyticsService.getInstance();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    // Track the API usage
    analyticsService.trackApiUsage(req, res, responseTime);
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};
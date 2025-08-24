import { Request, Response, NextFunction } from 'express';
import { performanceService } from '../services/PerformanceService';
import { loggerService } from '../services/LoggerService';

export interface PerformanceMiddlewareOptions {
  enableLoadBalancing?: boolean;
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
  skipPaths?: string[];
}

/**
 * Performance monitoring and load balancing middleware
 */
export function performanceMiddleware(options: PerformanceMiddlewareOptions = {}) {
  const {
    enableLoadBalancing = true,
    priority = 'normal',
    timeout = 30000,
    skipPaths = ['/health', '/metrics']
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip performance monitoring for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    
    // Add performance context to request
    (req as any).performanceContext = {
      startTime,
      priority,
      requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Set request ID header if not present
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = (req as any).performanceContext.requestId;
    }

    try {
      if (enableLoadBalancing) {
        // Execute request with load balancing
        await performanceService.executeWithLoadBalancing(async () => {
          return new Promise<void>((resolve, reject) => {
            // Override next function to resolve promise
            const originalNext = next;
            const wrappedNext = (error?: any) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            };

            // Call original next with wrapped function
            originalNext();
          });
        }, priority);
      } else {
        next();
      }
    } catch (error) {
      loggerService.error('Performance middleware error', error as Error, {
        requestId: (req as any).performanceContext.requestId,
        path: req.path,
        method: req.method
      });
      
      // Return appropriate error response
      if (error instanceof Error && error.message.includes('timeout')) {
        return res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process',
          requestId: (req as any).performanceContext.requestId
        });
      }
      
      if (error instanceof Error && error.message.includes('queue timeout')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Server is currently overloaded, please try again later',
          requestId: (req as any).performanceContext.requestId
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        requestId: (req as any).performanceContext.requestId
      });
    }

    // Add response time header
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Request-ID', (req as any).performanceContext.requestId);
      
      loggerService.debug('Request completed', {
        requestId: (req as any).performanceContext.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.headers['user-agent']
      });
    });
  };
}

/**
 * Performance metrics endpoint middleware
 */
export function performanceMetricsMiddleware() {
  return async (req: Request, res: Response) => {
    try {
      const metrics = performanceService.getPerformanceMetrics();
      const healthStatus = performanceService.getHealthStatus();
      
      res.json({
        timestamp: new Date().toISOString(),
        performance: metrics,
        health: healthStatus,
        system: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      });
    } catch (error) {
      loggerService.error('Failed to get performance metrics', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve performance metrics',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeoutMiddleware(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: `Request exceeded ${timeout}ms timeout`,
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
}

/**
 * Resource monitoring middleware
 */
export function resourceMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    
    res.on('finish', () => {
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);
      
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      const cpuTime = (endCpu.user + endCpu.system) / 1000; // Convert to milliseconds
      
      if (memoryDelta > 10 * 1024 * 1024) { // More than 10MB
        loggerService.warn('High memory usage detected for request', {
          path: req.path,
          method: req.method,
          memoryDelta,
          cpuTime
        });
      }
      
      if (cpuTime > 1000) { // More than 1 second
        loggerService.warn('High CPU usage detected for request', {
          path: req.path,
          method: req.method,
          memoryDelta,
          cpuTime
        });
      }
    });
    
    next();
  };
}
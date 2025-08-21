import { db } from '../database/connection';
import { redis } from '../database/redis';
import { loggerService } from './LoggerService';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: HealthCheckResult[];
  summary: {
    healthy: number;
    unhealthy: number;
    degraded: number;
    total: number;
  };
}

export class HealthCheckService {
  private static readonly TIMEOUT_MS = 5000; // 5 seconds timeout for health checks

  /**
   * Perform comprehensive health check
   */
  static async performHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();
    const services: HealthCheckResult[] = [];

    // Check all services
    const checks = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemoryUsage(),
      this.checkDiskSpace(),
      this.checkExternalAPIs(),
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        services.push(result.value);
      } else {
        services.push({
          service: ['database', 'redis', 'memory', 'disk', 'external_apis'][index],
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: result.reason?.message || 'Health check failed',
        });
      }
    });

    // Calculate overall status
    const summary = {
      healthy: services.filter(s => s.status === 'healthy').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      total: services.length,
    };

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      summary,
    };

    // Log health check results
    if (overallStatus !== 'healthy') {
      loggerService.warn('System health check failed', { health });
    } else {
      loggerService.debug('System health check passed', { 
        status: overallStatus, 
        responseTime: Date.now() - startTime 
      });
    }

    return health;
  }

  /**
   * Check database connectivity and performance
   */
  private static async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await Promise.race([
        db.query('SELECT 1 as test'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), this.TIMEOUT_MS)
        ),
      ]);

      const responseTime = Date.now() - startTime;
      
      // Check if response time is acceptable
      const status = responseTime > 2000 ? 'degraded' : 'healthy';
      
      return {
        service: 'database',
        status,
        responseTime,
        details: {
          connectionPool: {
            // Pool stats not directly accessible from DatabaseConnection
            status: 'connected',
          },
        },
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  private static async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await Promise.race([
        redis.healthCheck(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis timeout')), this.TIMEOUT_MS)
        ),
      ]);

      const responseTime = Date.now() - startTime;
      
      // Get Redis info (simplified since info method not available)
      const memoryUsage = { status: 'available' };
      
      // Check if response time is acceptable
      const status = responseTime > 1000 ? 'degraded' : 'healthy';
      
      return {
        service: 'redis',
        status,
        responseTime,
        details: {
          memoryUsage,
          connected: redis.isReady,
        },
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check memory usage
   */
  private static async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUtilization = (usedMemory / totalMemory) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryUtilization > 90) {
        status = 'unhealthy';
      } else if (memoryUtilization > 75) {
        status = 'degraded';
      }
      
      return {
        service: 'memory',
        status,
        responseTime: Date.now() - startTime,
        details: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          utilization: Math.round(memoryUtilization),
        },
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check disk space (simplified check)
   */
  private static async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This is a simplified check - in production, you'd want to check actual disk usage
      // For now, we'll just check if we can write to the logs directory
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const testFile = path.join(process.cwd(), 'logs', '.health-check');
      await fs.writeFile(testFile, 'health check');
      await fs.unlink(testFile);
      
      return {
        service: 'disk',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          writable: true,
        },
      };
    } catch (error) {
      return {
        service: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check external API connectivity
   */
  private static async checkExternalAPIs(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This is a simplified check - you could ping actual social media APIs
      // For now, we'll just check internet connectivity
      const axios = await import('axios');
      
      await Promise.race([
        axios.default.get('https://httpbin.org/status/200', { timeout: 3000 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('External API timeout')), this.TIMEOUT_MS)
        ),
      ]);
      
      const responseTime = Date.now() - startTime;
      const status = responseTime > 3000 ? 'degraded' : 'healthy';
      
      return {
        service: 'external_apis',
        status,
        responseTime,
        details: {
          internetConnectivity: true,
        },
      };
    } catch (error) {
      return {
        service: 'external_apis',
        status: 'degraded', // External API issues shouldn't mark system as unhealthy
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get basic health status (lightweight check)
   */
  static async getBasicHealth(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Check if a specific service is healthy
   */
  static async checkService(serviceName: string): Promise<HealthCheckResult> {
    switch (serviceName) {
      case 'database':
        return this.checkDatabase();
      case 'redis':
        return this.checkRedis();
      case 'memory':
        return this.checkMemoryUsage();
      case 'disk':
        return this.checkDiskSpace();
      case 'external_apis':
        return this.checkExternalAPIs();
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  /**
   * Parse Redis memory info
   */
  private static parseRedisMemoryInfo(info: string): any {
    const lines = info.split('\r\n');
    const memoryInfo: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('memory')) {
          memoryInfo[key] = value;
        }
      }
    }
    
    return memoryInfo;
  }
}
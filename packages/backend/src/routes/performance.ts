import { Router } from 'express';
import { performanceService } from '../services/PerformanceService';
import { cacheService } from '../services/CacheService';
import { queryOptimizationService } from '../services/QueryOptimizationService';
import { performanceMetricsMiddleware } from '../middleware/performance';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /performance/metrics
 * Get comprehensive performance metrics
 */
router.get('/metrics', authMiddleware, performanceMetricsMiddleware());

/**
 * GET /performance/health
 * Get system health status
 */
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const healthStatus = performanceService.getHealthStatus();
    const cacheStats = await cacheService.getStats();
    const queryMetrics = queryOptimizationService.getQueryMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      status: healthStatus.status,
      components: {
        performance: {
          status: healthStatus.status,
          issues: healthStatus.issues,
          recommendations: healthStatus.recommendations
        },
        cache: {
          status: cacheStats.hitRate > 70 ? 'healthy' : 'degraded',
          hitRate: cacheStats.hitRate,
          totalKeys: cacheStats.totalKeys,
          memoryUsage: cacheStats.memoryUsage
        },
        database: {
          status: queryMetrics.averageExecutionTime < 1000 ? 'healthy' : 'degraded',
          averageExecutionTime: queryMetrics.averageExecutionTime,
          slowQueries: queryMetrics.slowQueries,
          totalQueries: queryMetrics.totalQueries
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get health status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /performance/cache
 * Get cache performance metrics
 */
router.get('/cache', authMiddleware, async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      cache: stats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cache metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /performance/database
 * Get database performance metrics
 */
router.get('/database', authMiddleware, async (req, res) => {
  try {
    const metrics = queryOptimizationService.getQueryMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      database: metrics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /performance/benchmarks
 * Update performance benchmarks
 */
router.post('/benchmarks', authMiddleware, async (req, res) => {
  try {
    const { maxResponseTime, maxConcurrentRequests, maxMemoryUsage, maxCpuUsage } = req.body;
    
    const benchmarks: any = {};
    if (maxResponseTime !== undefined) benchmarks.maxResponseTime = maxResponseTime;
    if (maxConcurrentRequests !== undefined) benchmarks.maxConcurrentRequests = maxConcurrentRequests;
    if (maxMemoryUsage !== undefined) benchmarks.maxMemoryUsage = maxMemoryUsage;
    if (maxCpuUsage !== undefined) benchmarks.maxCpuUsage = maxCpuUsage;
    
    performanceService.updateBenchmarks(benchmarks);
    
    res.json({
      message: 'Performance benchmarks updated successfully',
      benchmarks: performanceService.getPerformanceMetrics().benchmarks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update benchmarks',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /performance/load-balancing
 * Update load balancing configuration
 */
router.post('/load-balancing', authMiddleware, async (req, res) => {
  try {
    const { maxConcurrentRequests, requestTimeout, queueTimeout, enableThrottling } = req.body;
    
    const config: any = {};
    if (maxConcurrentRequests !== undefined) config.maxConcurrentRequests = maxConcurrentRequests;
    if (requestTimeout !== undefined) config.requestTimeout = requestTimeout;
    if (queueTimeout !== undefined) config.queueTimeout = queueTimeout;
    if (enableThrottling !== undefined) config.enableThrottling = enableThrottling;
    
    performanceService.updateLoadBalancingConfig(config);
    
    res.json({
      message: 'Load balancing configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update load balancing configuration',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /performance/metrics
 * Clear performance metrics history
 */
router.delete('/metrics', authMiddleware, async (req, res) => {
  try {
    performanceService.clearMetrics();
    
    res.json({
      message: 'Performance metrics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /performance/cache/warm-up
 * Warm up cache with frequently accessed data
 */
router.post('/cache/warm-up', authMiddleware, async (req, res) => {
  try {
    // Define common warm-up functions
    const warmUpFunctions = [
      {
        key: 'user_settings_default',
        fn: async () => ({ theme: 'light', notifications: true }),
        ttl: 3600
      },
      {
        key: 'platform_configs',
        fn: async () => ({
          facebook: { apiVersion: 'v18.0' },
          instagram: { apiVersion: 'v18.0' },
          twitter: { apiVersion: '2.0' }
        }),
        ttl: 7200
      }
    ];
    
    await cacheService.warmUp(warmUpFunctions);
    
    res.json({
      message: 'Cache warm-up completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to warm up cache',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
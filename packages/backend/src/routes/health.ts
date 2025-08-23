import { Router, Request, Response } from 'express';
import { HealthCheckService } from '../services/HealthCheckService';
import { RetryQueueService, retryQueueService } from '../services/RetryQueueService';
import { NotificationService } from '../services/NotificationService';
import { monitoringService } from '../services/MonitoringService';
import { circuitBreakerService } from '../services/CircuitBreakerService';
import { loggerService } from '../services/LoggerService';
import { ErrorHandlerMiddleware } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { AppError, ErrorCode } from '../types/errors';

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get('/', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const health = await HealthCheckService.getBasicHealth();
  res.json({
    success: true,
    data: health,
  });
}));

/**
 * Comprehensive health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const health = await HealthCheckService.performHealthCheck();
  
  // Set appropriate status code based on health
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    success: health.status !== 'unhealthy',
    data: health,
  });
}));

/**
 * Check specific service health
 * GET /health/service/:serviceName
 */
router.get('/service/:serviceName', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  
  try {
    const result = await HealthCheckService.checkService(serviceName);
    
    const statusCode = result.status === 'healthy' ? 200 : 
                      result.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: result.status !== 'unhealthy',
      data: result,
    });
  } catch (error) {
    throw new AppError(
      `Invalid service name: ${serviceName}`,
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }
}));

/**
 * Get retry queue statistics
 * GET /health/retry-queue/stats
 */
router.get('/retry-queue/stats', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const stats = retryQueueService.getStats();
  
  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * Get retry jobs
 * GET /health/retry-queue/jobs
 */
router.get('/retry-queue/jobs', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { type, status } = req.query;
  const userId = req.user?.id;
  
  const jobs = retryQueueService.getRetryJobs(
    type as string,
    userId,
    status as 'pending' | 'failed' | 'exhausted'
  );
  
  res.json({
    success: true,
    data: jobs,
  });
}));

/**
 * Manually retry a specific job
 * POST /health/retry-queue/jobs/:jobId/retry
 */
router.post('/retry-queue/jobs/:jobId/retry', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const success = await retryQueueService.manualRetry(jobId);
  
  if (!success) {
    throw new AppError(
      'Retry job not found or cannot be retried',
      ErrorCode.VALIDATION_ERROR,
      404
    );
  }
  
  res.json({
    success: true,
    message: 'Job scheduled for retry',
  });
}));

/**
 * Cancel a retry job
 * DELETE /health/retry-queue/jobs/:jobId
 */
router.delete('/retry-queue/jobs/:jobId', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const success = retryQueueService.cancelRetry(jobId);
  
  if (!success) {
    throw new AppError(
      'Retry job not found',
      ErrorCode.VALIDATION_ERROR,
      404
    );
  }
  
  res.json({
    success: true,
    message: 'Retry job cancelled',
  });
}));

/**
 * Get error notifications
 * GET /health/notifications/errors
 */
router.get('/notifications/errors', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { acknowledged } = req.query;
  
  const notifications = NotificationService.getErrorNotifications(
    acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined
  );
  
  res.json({
    success: true,
    data: notifications,
  });
}));

/**
 * Get post failure notifications
 * GET /health/notifications/post-failures
 */
router.get('/notifications/post-failures', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  const notifications = NotificationService.getPostFailureNotifications(userId);
  
  res.json({
    success: true,
    data: notifications,
  });
}));

/**
 * Acknowledge error notification
 * POST /health/notifications/errors/:notificationId/acknowledge
 */
router.post('/notifications/errors/:notificationId/acknowledge', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new AppError(
      'User ID required',
      ErrorCode.UNAUTHORIZED,
      401
    );
  }
  
  const success = NotificationService.acknowledgeErrorNotification(notificationId, userId);
  
  if (!success) {
    throw new AppError(
      'Notification not found',
      ErrorCode.VALIDATION_ERROR,
      404
    );
  }
  
  res.json({
    success: true,
    message: 'Notification acknowledged',
  });
}));

/**
 * Comprehensive monitoring dashboard endpoint
 * GET /health/monitoring
 */
router.get('/monitoring', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await monitoringService.getMonitoringDashboard();
  res.json({
    success: true,
    data: dashboard,
  });
}));

/**
 * System metrics endpoint
 * GET /health/metrics/system
 */
router.get('/metrics/system', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const systemMetrics = await monitoringService.getSystemMetrics();
  res.json({
    success: true,
    data: systemMetrics,
  });
}));

/**
 * Application metrics endpoint
 * GET /health/metrics/application
 */
router.get('/metrics/application', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const appMetrics = monitoringService.getApplicationMetrics();
  res.json({
    success: true,
    data: appMetrics,
  });
}));

/**
 * Circuit breaker status endpoint
 * GET /health/circuit-breakers
 */
router.get('/circuit-breakers', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const circuitBreakers = circuitBreakerService.getAllStats();
  res.json({
    success: true,
    data: circuitBreakers,
  });
}));

/**
 * Reset circuit breaker endpoint
 * POST /health/circuit-breakers/:name/reset
 */
router.post('/circuit-breakers/:name/reset', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const success = circuitBreakerService.reset(name);
  
  if (success) {
    loggerService.info(`Circuit breaker manually reset: ${name}`, { 
      action: 'manual_reset',
      circuitBreaker: name,
      userId: req.user?.id
    });
    res.json({ 
      success: true, 
      message: `Circuit breaker ${name} reset successfully` 
    });
  } else {
    throw new AppError(
      `Circuit breaker ${name} not found`,
      ErrorCode.VALIDATION_ERROR,
      404
    );
  }
}));

/**
 * Reset all circuit breakers endpoint
 * POST /health/circuit-breakers/reset-all
 */
router.post('/circuit-breakers/reset-all', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  circuitBreakerService.resetAll();
  loggerService.info('All circuit breakers manually reset', { 
    action: 'manual_reset_all',
    userId: req.user?.id
  });
  res.json({ 
    success: true, 
    message: 'All circuit breakers reset successfully' 
  });
}));

/**
 * Active alerts endpoint
 * GET /health/alerts
 */
router.get('/alerts', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const alerts = monitoringService.getActiveAlerts();
  res.json({
    success: true,
    data: alerts,
  });
}));

/**
 * Alert rules endpoint
 * GET /health/alerts/rules
 */
router.get('/alerts/rules', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const rules = monitoringService.getAlertRules();
  res.json({
    success: true,
    data: rules,
  });
}));

/**
 * Resolve alert endpoint
 * POST /health/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const success = monitoringService.resolveAlert(alertId);
  
  if (success) {
    res.json({ 
      success: true, 
      message: `Alert ${alertId} resolved successfully` 
    });
  } else {
    throw new AppError(
      `Alert ${alertId} not found or already resolved`,
      ErrorCode.VALIDATION_ERROR,
      404
    );
  }
}));

/**
 * Specific metric endpoint
 * GET /health/metrics/:metricName
 */
router.get('/metrics/:metricName', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const { metricName } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  
  const metrics = monitoringService.getMetrics(metricName, limit);
  res.json({
    success: true,
    data: {
      name: metricName,
      data: metrics,
      count: metrics.length
    }
  });
}));

/**
 * Available metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const metricNames = monitoringService.getMetricNames();
  res.json({
    success: true,
    data: {
      metrics: metricNames,
      count: metricNames.length
    }
  });
}));

/**
 * Logger statistics endpoint
 * GET /health/logger/stats
 */
router.get('/logger/stats', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const stats = loggerService.getStats();
  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * Readiness probe (for Kubernetes)
 * GET /health/ready
 */
router.get('/ready', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const health = await HealthCheckService.performHealthCheck();
  
  if (health.status === 'unhealthy') {
    res.status(503).json({ 
      ready: false, 
      reason: 'System unhealthy',
      status: health.status
    });
  } else {
    res.json({ 
      ready: true, 
      status: health.status 
    });
  }
}));

/**
 * Liveness probe (for Kubernetes)
 * GET /health/live
 */
router.get('/live', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({ 
    alive: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}));

export default router;
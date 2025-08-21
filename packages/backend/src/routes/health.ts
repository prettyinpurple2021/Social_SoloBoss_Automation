import { Router } from 'express';
import { HealthCheckService } from '../services/HealthCheckService';
import { RetryQueueService, retryQueueService } from '../services/RetryQueueService';
import { NotificationService } from '../services/NotificationService';
import { ErrorHandlerMiddleware } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { AppError, ErrorCode } from '../types/errors';

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get('/', ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/detailed', ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/service/:serviceName', ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/retry-queue/stats', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/retry-queue/jobs', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.post('/retry-queue/jobs/:jobId/retry', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.delete('/retry-queue/jobs/:jobId', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/notifications/errors', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.get('/notifications/post-failures', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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
router.post('/notifications/errors/:notificationId/acknowledge', authMiddleware, ErrorHandlerMiddleware.asyncHandler(async (req, res) => {
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

export default router;
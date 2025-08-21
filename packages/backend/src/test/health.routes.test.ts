import request from 'supertest';
import express from 'express';
import healthRoutes from '../routes/health';
import { HealthCheckService } from '../services/HealthCheckService';
import { RetryQueueService } from '../services/RetryQueueService';
import { NotificationService } from '../services/NotificationService';
import { authMiddleware } from '../middleware/auth';
import { ErrorHandlerMiddleware } from '../middleware/errorHandler';

// Mock dependencies
jest.mock('../services/HealthCheckService');
jest.mock('../services/RetryQueueService');
jest.mock('../services/NotificationService');
jest.mock('../middleware/auth');

describe('Health Routes', () => {
  let app: express.Application;
  let mockRetryQueueService: jest.Mocked<RetryQueueService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
    app.use(ErrorHandlerMiddleware.handle);

    // Mock auth middleware to pass through
    (authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'user123' };
      next();
    });

    // Create mock retry queue service
    mockRetryQueueService = {
      getStats: jest.fn(),
      getRetryJobs: jest.fn(),
      manualRetry: jest.fn(),
      cancelRetry: jest.fn(),
    } as any;

    // Mock the singleton instance
    jest.spyOn(RetryQueueService, 'getInstance').mockReturnValue(mockRetryQueueService);

    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 3600,
      };

      (HealthCheckService.getBasicHealth as jest.Mock).mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockHealth,
      });
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status with 200 for healthy system', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: [
          { service: 'database', status: 'healthy', responseTime: 50 },
          { service: 'redis', status: 'healthy', responseTime: 30 },
        ],
        summary: { healthy: 2, unhealthy: 0, degraded: 0, total: 2 },
      };

      (HealthCheckService.performHealthCheck as jest.Mock).mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockHealth,
      });
    });

    it('should return detailed health status with 200 for degraded system', async () => {
      const mockHealth = {
        status: 'degraded',
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: [
          { service: 'database', status: 'degraded', responseTime: 2500 },
          { service: 'redis', status: 'healthy', responseTime: 30 },
        ],
        summary: { healthy: 1, unhealthy: 0, degraded: 1, total: 2 },
      };

      (HealthCheckService.performHealthCheck as jest.Mock).mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockHealth,
      });
    });

    it('should return detailed health status with 503 for unhealthy system', async () => {
      const mockHealth = {
        status: 'unhealthy',
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        services: [
          { service: 'database', status: 'unhealthy', responseTime: 5000, error: 'Connection failed' },
          { service: 'redis', status: 'healthy', responseTime: 30 },
        ],
        summary: { healthy: 1, unhealthy: 1, degraded: 0, total: 2 },
      };

      (HealthCheckService.performHealthCheck as jest.Mock).mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        data: mockHealth,
      });
    });
  });

  describe('GET /health/service/:serviceName', () => {
    it('should return specific service health with 200 for healthy service', async () => {
      const mockResult = {
        service: 'database',
        status: 'healthy',
        responseTime: 50,
        details: { connectionPool: { total: 10, idle: 5, waiting: 0 } },
      };

      (HealthCheckService.checkService as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/health/service/database')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });
      expect(HealthCheckService.checkService).toHaveBeenCalledWith('database');
    });

    it('should return specific service health with 503 for unhealthy service', async () => {
      const mockResult = {
        service: 'database',
        status: 'unhealthy',
        responseTime: 5000,
        error: 'Connection failed',
      };

      (HealthCheckService.checkService as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/health/service/database')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        data: mockResult,
      });
    });

    it('should return 400 for invalid service name', async () => {
      (HealthCheckService.checkService as jest.Mock).mockRejectedValue(
        new Error('Unknown service: invalid-service')
      );

      const response = await request(app)
        .get('/health/service/invalid-service')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /health/retry-queue/stats', () => {
    it('should return retry queue statistics', async () => {
      const mockStats = {
        totalJobs: 10,
        pendingJobs: 5,
        failedJobs: 3,
        completedJobs: 2,
        jobsByType: {
          post_publish: 8,
          platform_connection: 2,
        },
      };

      mockRetryQueueService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/health/retry-queue/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats,
      });
    });

    it('should require authentication', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      });

      await request(app)
        .get('/health/retry-queue/stats')
        .expect(401);
    });
  });

  describe('GET /health/retry-queue/jobs', () => {
    it('should return retry jobs without filters', async () => {
      const mockJobs = [
        {
          id: 'job1',
          type: 'post_publish',
          data: { postId: 'post1', userId: 'user123', platform: 'facebook' },
          attempts: 1,
          maxAttempts: 3,
          nextRetryAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRetryQueueService.getRetryJobs.mockReturnValue(mockJobs);

      const response = await request(app)
        .get('/health/retry-queue/jobs')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockJobs,
      });
      expect(mockRetryQueueService.getRetryJobs).toHaveBeenCalledWith(
        undefined,
        'user123',
        undefined
      );
    });

    it('should return retry jobs with filters', async () => {
      const mockJobs = [
        {
          id: 'job1',
          type: 'post_publish',
          data: { postId: 'post1', userId: 'user123', platform: 'facebook' },
          attempts: 1,
          maxAttempts: 3,
          nextRetryAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRetryQueueService.getRetryJobs.mockReturnValue(mockJobs);

      const response = await request(app)
        .get('/health/retry-queue/jobs?type=post_publish&status=failed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockJobs,
      });
      expect(mockRetryQueueService.getRetryJobs).toHaveBeenCalledWith(
        'post_publish',
        'user123',
        'failed'
      );
    });
  });

  describe('POST /health/retry-queue/jobs/:jobId/retry', () => {
    it('should manually retry a job', async () => {
      mockRetryQueueService.manualRetry.mockResolvedValue(true);

      const response = await request(app)
        .post('/health/retry-queue/jobs/job123/retry')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Job scheduled for retry',
      });
      expect(mockRetryQueueService.manualRetry).toHaveBeenCalledWith('job123');
    });

    it('should return 404 for non-existent job', async () => {
      mockRetryQueueService.manualRetry.mockResolvedValue(false);

      const response = await request(app)
        .post('/health/retry-queue/jobs/non-existent/retry')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /health/retry-queue/jobs/:jobId', () => {
    it('should cancel a retry job', async () => {
      mockRetryQueueService.cancelRetry.mockReturnValue(true);

      const response = await request(app)
        .delete('/health/retry-queue/jobs/job123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Retry job cancelled',
      });
      expect(mockRetryQueueService.cancelRetry).toHaveBeenCalledWith('job123');
    });

    it('should return 404 for non-existent job', async () => {
      mockRetryQueueService.cancelRetry.mockReturnValue(false);

      const response = await request(app)
        .delete('/health/retry-queue/jobs/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /health/notifications/errors', () => {
    it('should return error notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          error: { code: 'DATABASE_ERROR', message: 'DB failed' },
          timestamp: new Date(),
          acknowledged: false,
        },
      ];

      (NotificationService.getErrorNotifications as jest.Mock).mockReturnValue(mockNotifications);

      const response = await request(app)
        .get('/health/notifications/errors')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockNotifications,
      });
      expect(NotificationService.getErrorNotifications).toHaveBeenCalledWith(undefined);
    });

    it('should filter error notifications by acknowledged status', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          error: { code: 'DATABASE_ERROR', message: 'DB failed' },
          timestamp: new Date(),
          acknowledged: false,
        },
      ];

      (NotificationService.getErrorNotifications as jest.Mock).mockReturnValue(mockNotifications);

      const response = await request(app)
        .get('/health/notifications/errors?acknowledged=false')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockNotifications,
      });
      expect(NotificationService.getErrorNotifications).toHaveBeenCalledWith(false);
    });
  });

  describe('GET /health/notifications/post-failures', () => {
    it('should return post failure notifications for user', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          postId: 'post123',
          userId: 'user123',
          platform: 'facebook',
          error: { code: 'POST_PUBLISHING_FAILED', message: 'Post failed' },
          retryCount: 1,
          timestamp: new Date(),
        },
      ];

      (NotificationService.getPostFailureNotifications as jest.Mock).mockReturnValue(mockNotifications);

      const response = await request(app)
        .get('/health/notifications/post-failures')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockNotifications,
      });
      expect(NotificationService.getPostFailureNotifications).toHaveBeenCalledWith('user123');
    });
  });

  describe('POST /health/notifications/errors/:notificationId/acknowledge', () => {
    it('should acknowledge error notification', async () => {
      (NotificationService.acknowledgeErrorNotification as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/health/notifications/errors/notif123/acknowledge')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Notification acknowledged',
      });
      expect(NotificationService.acknowledgeErrorNotification).toHaveBeenCalledWith('notif123', 'user123');
    });

    it('should return 404 for non-existent notification', async () => {
      (NotificationService.acknowledgeErrorNotification as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/health/notifications/errors/non-existent/acknowledge')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when user ID is missing', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
        req.user = {}; // No ID
        next();
      });

      const response = await request(app)
        .post('/health/notifications/errors/notif123/acknowledge')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      (HealthCheckService.getBasicHealth as jest.Mock).mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle retry queue service errors', async () => {
      mockRetryQueueService.getStats.mockImplementation(() => {
        throw new Error('Queue service error');
      });

      const response = await request(app)
        .get('/health/retry-queue/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
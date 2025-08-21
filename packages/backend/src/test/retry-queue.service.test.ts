import { RetryQueueService } from '../services/RetryQueueService';
import { PostService } from '../services/PostService';
import { IntegrationService } from '../services/IntegrationService';
import { NotificationService } from '../services/NotificationService';
import { AppError, ErrorCode, ErrorSeverity, PlatformError } from '../types/errors';
import { Platform, PostStatus } from '../types/database';
import { loggerService } from '../services/LoggerService';

// Mock dependencies
jest.mock('../services/PostService');
jest.mock('../services/IntegrationService');
jest.mock('../services/NotificationService');
jest.mock('../services/LoggerService');

describe('RetryQueueService', () => {
  let retryQueueService: RetryQueueService;

  beforeEach(() => {
    retryQueueService = RetryQueueService.getInstance();
    jest.clearAllMocks();
    
    // Clear retry jobs between tests
    (retryQueueService as any).retryJobs.clear();
  });

  afterEach(() => {
    retryQueueService.stop();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RetryQueueService.getInstance();
      const instance2 = RetryQueueService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop the service', () => {
      expect((retryQueueService as any).isProcessing).toBe(false);
      
      retryQueueService.start();
      expect((retryQueueService as any).isProcessing).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith('Retry queue service started');
      
      retryQueueService.stop();
      expect((retryQueueService as any).isProcessing).toBe(false);
      expect(loggerService.info).toHaveBeenCalledWith('Retry queue service stopped');
    });

    it('should not start if already processing', () => {
      retryQueueService.start();
      const firstCallCount = (loggerService.info as jest.Mock).mock.calls.length;
      
      retryQueueService.start(); // Second start should be ignored
      expect((loggerService.info as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });

    it('should not stop if not processing', () => {
      retryQueueService.stop(); // Stop when not started
      expect(loggerService.info).not.toHaveBeenCalledWith('Retry queue service stopped');
    });
  });

  describe('Post Retry Management', () => {
    it('should add post retry job', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      
      const jobId = await retryQueueService.addPostRetry(
        'post123',
        'user123',
        Platform.FACEBOOK,
        error,
        3
      );

      expect(jobId).toMatch(/^post_post123_facebook_\d+$/);
      expect(NotificationService.sendPostFailureNotification).toHaveBeenCalledWith(
        'post123',
        'user123',
        Platform.FACEBOOK,
        error,
        0,
        expect.any(Date)
      );
      expect(loggerService.info).toHaveBeenCalledWith(
        'Post added to retry queue',
        expect.objectContaining({
          jobId,
          postId: 'post123',
          platform: Platform.FACEBOOK,
        })
      );
    });

    it('should get retry jobs with filtering', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      
      await retryQueueService.addPostRetry('post1', 'user1', Platform.FACEBOOK, error);
      await retryQueueService.addPostRetry('post2', 'user2', Platform.INSTAGRAM, error);
      await retryQueueService.addPlatformConnectionRetry('user1', Platform.X, error);

      // Get all jobs
      const allJobs = retryQueueService.getRetryJobs();
      expect(allJobs).toHaveLength(3);

      // Filter by type
      const postJobs = retryQueueService.getRetryJobs('post_publish');
      expect(postJobs).toHaveLength(2);

      // Filter by user
      const user1Jobs = retryQueueService.getRetryJobs(undefined, 'user1');
      expect(user1Jobs).toHaveLength(2); // 1 post + 1 platform connection
    });

    it('should manually retry a job', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error);

      // Mock successful post retrieval and publishing
      const mockPost = {
        id: 'post123',
        user_id: 'user123',
        content: 'Test post',
        platformPosts: [{ platform: Platform.FACEBOOK, content: 'Test post' }],
      };
      (PostService.getPost as jest.Mock).mockResolvedValue(mockPost);
      const mockIntegrationService = {
        publishPost: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Publishing failed',
          retryable: true 
        })
      };
      (IntegrationService.getInstance as jest.Mock).mockReturnValue(mockIntegrationService);
      (PostService.updatePostStatus as jest.Mock).mockResolvedValue(true);

      const success = await retryQueueService.manualRetry(jobId);
      expect(success).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith('Job scheduled for manual retry', { jobId });
    });

    it('should return false for manual retry of non-existent job', async () => {
      const success = await retryQueueService.manualRetry('non-existent-job');
      expect(success).toBe(false);
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Retry job not found for manual retry',
        { jobId: 'non-existent-job' }
      );
    });

    it('should cancel retry job', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error);

      const success = retryQueueService.cancelRetry(jobId);
      expect(success).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith('Retry job cancelled', { jobId });

      const jobs = retryQueueService.getRetryJobs();
      expect(jobs).toHaveLength(0);
    });

    it('should return false when canceling non-existent job', () => {
      const success = retryQueueService.cancelRetry('non-existent-job');
      expect(success).toBe(false);
    });
  });

  describe('Platform Connection Retry', () => {
    it('should add platform connection retry job', async () => {
      const error = new PlatformError('Connection failed', ErrorCode.PLATFORM_AUTHENTICATION_FAILED);
      
      const jobId = await retryQueueService.addPlatformConnectionRetry(
        'user123',
        Platform.FACEBOOK,
        error,
        3
      );

      expect(jobId).toMatch(/^platform_user123_facebook_\d+$/);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Platform connection added to retry queue',
        expect.objectContaining({
          jobId,
          userId: 'user123',
          platform: Platform.FACEBOOK,
        })
      );
    });
  });

  describe('Integration Retry', () => {
    it('should add integration retry job', async () => {
      const error = new AppError('Integration failed', ErrorCode.BLOGGER_CONNECTION_FAILED);
      const data = { blogId: 'blog123' };
      
      const jobId = await retryQueueService.addIntegrationRetry(
        'user123',
        'blogger',
        data,
        error,
        3
      );

      expect(jobId).toMatch(/^integration_user123_blogger_\d+$/);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Integration sync added to retry queue',
        expect.objectContaining({
          jobId,
          userId: 'user123',
          integration: 'blogger',
        })
      );
    });
  });

  describe('Retry Queue Statistics', () => {
    it('should return correct statistics', async () => {
      const error = new PlatformError('Failed', ErrorCode.POST_PUBLISHING_FAILED);
      
      // Add jobs with different types
      await retryQueueService.addPostRetry('post1', 'user1', Platform.FACEBOOK, error);
      await retryQueueService.addPostRetry('post2', 'user1', Platform.INSTAGRAM, error);
      await retryQueueService.addPlatformConnectionRetry('user1', Platform.X, error);

      const stats = retryQueueService.getStats();
      
      expect(stats.totalJobs).toBe(3);
      expect(stats.pendingJobs).toBe(3); // All jobs are pending initially
      expect(stats.failedJobs).toBe(0);
      expect(stats.completedJobs).toBe(0);
      expect(stats.jobsByType).toEqual({
        post_publish: 2,
        platform_connection: 1,
      });
    });

    it('should categorize jobs by status correctly', async () => {
      const error = new PlatformError('Failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post1', 'user1', Platform.FACEBOOK, error);

      // Manually set job to be ready for retry (past nextRetryAt)
      const jobs = (retryQueueService as any).retryJobs;
      const job = jobs.get(jobId);
      job.nextRetryAt = new Date(Date.now() - 1000); // 1 second ago

      const failedJobs = retryQueueService.getRetryJobs(undefined, undefined, 'failed');
      expect(failedJobs).toHaveLength(1);

      const pendingJobs = retryQueueService.getRetryJobs(undefined, undefined, 'pending');
      expect(pendingJobs).toHaveLength(0);
    });
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
      const service = retryQueueService as any;
      
      const retry1 = service.calculateNextRetryTime(1);
      const retry2 = service.calculateNextRetryTime(2);
      const retry3 = service.calculateNextRetryTime(3);
      
      const now = Date.now();
      
      // First retry: 1 minute
      expect(retry1.getTime()).toBeCloseTo(now + 60 * 1000, -3);
      
      // Second retry: 5 minutes
      expect(retry2.getTime()).toBeCloseTo(now + 300 * 1000, -3);
      
      // Third retry: 15 minutes
      expect(retry3.getTime()).toBeCloseTo(now + 900 * 1000, -3);
    });

    it('should handle successful post retry', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error);

      // Mock successful post retrieval and publishing
      const mockPost = {
        id: 'post123',
        user_id: 'user123',
        content: 'Test post',
        platformPosts: [{ platform: Platform.FACEBOOK, content: 'Test post' }],
      };
      (PostService.getPost as jest.Mock).mockResolvedValue(mockPost);
      const mockIntegrationService = {
        publishPost: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Publishing failed',
          retryable: true 
        })
      };
      (IntegrationService.getInstance as jest.Mock).mockReturnValue(mockIntegrationService);
      (PostService.updatePostStatus as jest.Mock).mockResolvedValue(true);

      // Process the job
      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      await service.processRetryJob(job);

      // Job should be removed from queue after success
      expect(service.retryJobs.has(jobId)).toBe(false);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Retry job completed successfully',
        expect.objectContaining({ jobId, attempts: 1 })
      );
    });

    it('should handle failed post retry', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error, 2);

      // Mock failed publishing
      const mockPost = {
        id: 'post123',
        user_id: 'user123',
        content: 'Test post',
        platformPosts: [{ platform: Platform.FACEBOOK, content: 'Test post' }],
      };
      (PostService.getPost as jest.Mock).mockResolvedValue(mockPost);
      const mockIntegrationService2 = {
        publishPost: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Publishing failed',
          retryable: true 
        })
      };
      (IntegrationService.getInstance as jest.Mock).mockReturnValue(mockIntegrationService2);

      // Process the job
      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      await service.processRetryJob(job);

      // Job should still be in queue with updated attempt count
      expect(service.retryJobs.has(jobId)).toBe(true);
      const updatedJob = service.retryJobs.get(jobId);
      expect(updatedJob.attempts).toBe(1);
      expect(updatedJob.nextRetryAt).toBeInstanceOf(Date);
    });

    it('should exhaust retry attempts and send final notification', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error, 1);

      // Mock failed publishing
      const mockPost = {
        id: 'post123',
        user_id: 'user123',
        content: 'Test post',
        platformPosts: [{ platform: Platform.FACEBOOK, content: 'Test post' }],
      };
      (PostService.getPost as jest.Mock).mockResolvedValue(mockPost);
      const mockIntegrationService2 = {
        publishPost: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Publishing failed',
          retryable: true 
        })
      };
      (IntegrationService.getInstance as jest.Mock).mockReturnValue(mockIntegrationService2);

      // Process the job (should exhaust attempts)
      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      await service.processRetryJob(job);

      // Should send final notification
      expect(NotificationService.sendPostFailureNotification).toHaveBeenCalledWith(
        'post123',
        'user123',
        Platform.FACEBOOK,
        expect.any(AppError),
        1
      );
      expect(loggerService.error).toHaveBeenCalledWith(
        'Retry job exhausted',
        expect.any(AppError),
        expect.objectContaining({ jobId, attempts: 1, maxAttempts: 1 })
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old exhausted jobs', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error, 1);

      // Manually exhaust the job and set old timestamp
      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      job.attempts = 1; // Exhausted
      job.updatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

      service.cleanup();

      expect(service.retryJobs.has(jobId)).toBe(false);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Retry queue cleanup completed',
        { removedCount: 1 }
      );
    });

    it('should keep recent exhausted jobs during cleanup', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error, 1);

      // Manually exhaust the job but keep recent timestamp
      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      job.attempts = 1; // Exhausted
      job.updatedAt = new Date(); // Recent

      service.cleanup();

      expect(service.retryJobs.has(jobId)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during job processing', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error);

      // Mock PostService to throw error
      (PostService.getPost as jest.Mock).mockRejectedValue(new Error('Database error'));

      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      
      // Should not throw
      await expect(service.processRetryJob(job)).resolves.not.toThrow();
      
      expect(job.lastError).toBeInstanceOf(AppError);
      expect(job.attempts).toBe(1);
    });

    it('should handle missing post during retry', async () => {
      const error = new PlatformError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const jobId = await retryQueueService.addPostRetry('post123', 'user123', Platform.FACEBOOK, error);

      // Mock post not found
      (PostService.getPost as jest.Mock).mockResolvedValue(null);

      const service = retryQueueService as any;
      const job = service.retryJobs.get(jobId);
      const success = await service.retryPostPublish(job);

      expect(success).toBe(false);
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Post not found for retry',
        { postId: 'post123', userId: 'user123' }
      );
    });
  });
});
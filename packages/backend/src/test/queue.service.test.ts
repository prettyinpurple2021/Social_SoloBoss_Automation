import { QueueService, PostExecutionJobData, RetryJobData } from '../services/QueueService';
import Bull, { Queue, Job } from 'bull';

// Mock Bull
jest.mock('bull');
jest.mock('../database/redis');

const MockBull = Bull as jest.MockedClass<typeof Bull>;

describe('QueueService', () => {
  let queueService: QueueService;
  let mockPostQueue: jest.Mocked<Queue<PostExecutionJobData>>;
  let mockRetryQueue: jest.Mocked<Queue<RetryJobData>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock queue instances
    mockPostQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      process: jest.fn()
    } as any;

    mockRetryQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      process: jest.fn()
    } as any;

    // Mock Bull constructor to return our mocked queues
    MockBull.mockImplementation((name: string) => {
      if (name === 'post-execution') {
        return mockPostQueue as any;
      } else if (name === 'post-retry') {
        return mockRetryQueue as any;
      }
      return {} as any;
    });

    queueService = QueueService.getInstance();
  });

  describe('schedulePost', () => {
    it('should schedule a post for future execution', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const scheduledTime = new Date(Date.now() + 60000); // 1 minute from now
      const mockJob = { id: 'job-123' } as Job<PostExecutionJobData>;

      mockPostQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.schedulePost(postId, userId, scheduledTime);

      expect(mockPostQueue.add).toHaveBeenCalledWith(
        'execute-post',
        {
          postId,
          userId,
          scheduledTime,
          retryCount: 0
        },
        {
          delay: expect.any(Number),
          jobId: `post-${postId}`
        }
      );
      expect(result).toBe(mockJob);
    });

    it('should schedule a post for immediate execution when time is in the past', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const scheduledTime = new Date(Date.now() - 60000); // 1 minute ago
      const mockJob = { id: 'job-123' } as Job<PostExecutionJobData>;

      mockPostQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.schedulePost(postId, userId, scheduledTime);

      expect(mockPostQueue.add).toHaveBeenCalledWith(
        'execute-post',
        expect.any(Object),
        {
          delay: 0, // Should be 0 for past times
          jobId: `post-${postId}`
        }
      );
      expect(result).toBe(mockJob);
    });
  });

  describe('executePostNow', () => {
    it('should execute a post immediately', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const mockJob = { id: 'job-123' } as Job<PostExecutionJobData>;

      mockPostQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.executePostNow(postId, userId);

      expect(mockPostQueue.add).toHaveBeenCalledWith(
        'execute-post',
        {
          postId,
          userId,
          scheduledTime: expect.any(Date),
          retryCount: 0
        }
      );
      expect(result).toBe(mockJob);
    });
  });

  describe('scheduleRetry', () => {
    it('should schedule a retry with exponential backoff', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const originalError = 'API rate limit exceeded';
      const retryCount = 2;
      const scheduledTime = new Date();
      const mockJob = { id: 'retry-job-123' } as Job<RetryJobData>;

      mockRetryQueue.add.mockResolvedValue(mockJob);

      const result = await queueService.scheduleRetry(
        postId,
        userId,
        originalError,
        retryCount,
        scheduledTime
      );

      expect(mockRetryQueue.add).toHaveBeenCalledWith(
        'retry-post',
        {
          postId,
          userId,
          scheduledTime,
          retryCount,
          originalError,
          lastAttemptAt: expect.any(Date)
        },
        {
          delay: 300000, // 5 minutes for retry count 2 (60000 * 5^1)
          jobId: `retry-${postId}-${retryCount}`
        }
      );
      expect(result).toBe(mockJob);
    });

    it('should calculate correct exponential backoff delays', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const originalError = 'API error';
      const scheduledTime = new Date();
      const mockJob = { id: 'retry-job-123' } as Job<RetryJobData>;

      mockRetryQueue.add.mockResolvedValue(mockJob);

      // Test retry count 1 (first retry)
      await queueService.scheduleRetry(postId, userId, originalError, 1, scheduledTime);
      expect(mockRetryQueue.add).toHaveBeenLastCalledWith(
        'retry-post',
        expect.any(Object),
        expect.objectContaining({
          delay: 60000 // 1 minute (60000 * 5^0)
        })
      );

      // Test retry count 2 (second retry)
      await queueService.scheduleRetry(postId, userId, originalError, 2, scheduledTime);
      expect(mockRetryQueue.add).toHaveBeenLastCalledWith(
        'retry-post',
        expect.any(Object),
        expect.objectContaining({
          delay: 300000 // 5 minutes (60000 * 5^1)
        })
      );

      // Test retry count 3 (third retry)
      await queueService.scheduleRetry(postId, userId, originalError, 3, scheduledTime);
      expect(mockRetryQueue.add).toHaveBeenLastCalledWith(
        'retry-post',
        expect.any(Object),
        expect.objectContaining({
          delay: 1500000 // 25 minutes (60000 * 5^2)
        })
      );
    });
  });

  describe('cancelScheduledPost', () => {
    it('should cancel a scheduled post successfully', async () => {
      const postId = 'post-123';
      const mockJob = {
        remove: jest.fn().mockResolvedValue(undefined)
      } as any;

      mockPostQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.cancelScheduledPost(postId);

      expect(mockPostQueue.getJob).toHaveBeenCalledWith(`post-${postId}`);
      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when job not found', async () => {
      const postId = 'post-123';

      mockPostQueue.getJob.mockResolvedValue(null);

      const result = await queueService.cancelScheduledPost(postId);

      expect(mockPostQueue.getJob).toHaveBeenCalledWith(`post-${postId}`);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const postId = 'post-123';

      mockPostQueue.getJob.mockRejectedValue(new Error('Queue error'));

      const result = await queueService.cancelScheduledPost(postId);

      expect(result).toBe(false);
    });
  });

  describe('cancelRetries', () => {
    it('should cancel all retry jobs for a post', async () => {
      const postId = 'post-123';
      const mockJobs = [
        {
          data: { postId: 'post-123' },
          remove: jest.fn().mockResolvedValue(undefined)
        },
        {
          data: { postId: 'post-456' },
          remove: jest.fn().mockResolvedValue(undefined)
        },
        {
          data: { postId: 'post-123' },
          remove: jest.fn().mockResolvedValue(undefined)
        }
      ] as any[];

      mockRetryQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await queueService.cancelRetries(postId);

      expect(mockRetryQueue.getJobs).toHaveBeenCalledWith(['delayed', 'waiting']);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled(); // Different post ID
      expect(mockJobs[2].remove).toHaveBeenCalled();
      expect(result).toBe(2); // Should cancel 2 jobs
    });

    it('should handle errors gracefully', async () => {
      const postId = 'post-123';

      mockRetryQueue.getJobs.mockRejectedValue(new Error('Queue error'));

      const result = await queueService.cancelRetries(postId);

      expect(result).toBe(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockPostQueueJobs = {
        waiting: [1, 2, 3],
        active: [1],
        completed: Array(50).fill(1),
        failed: [1, 2],
        delayed: [1, 2, 3, 4, 5]
      };

      const mockRetryQueueJobs = {
        waiting: [1],
        active: [],
        completed: Array(10).fill(1),
        failed: [1],
        delayed: [1, 2]
      };

      mockPostQueue.getWaiting.mockResolvedValue(mockPostQueueJobs.waiting as any);
      mockPostQueue.getActive.mockResolvedValue(mockPostQueueJobs.active as any);
      mockPostQueue.getCompleted.mockResolvedValue(mockPostQueueJobs.completed as any);
      mockPostQueue.getFailed.mockResolvedValue(mockPostQueueJobs.failed as any);
      mockPostQueue.getDelayed.mockResolvedValue(mockPostQueueJobs.delayed as any);

      mockRetryQueue.getWaiting.mockResolvedValue(mockRetryQueueJobs.waiting as any);
      mockRetryQueue.getActive.mockResolvedValue(mockRetryQueueJobs.active as any);
      mockRetryQueue.getCompleted.mockResolvedValue(mockRetryQueueJobs.completed as any);
      mockRetryQueue.getFailed.mockResolvedValue(mockRetryQueueJobs.failed as any);
      mockRetryQueue.getDelayed.mockResolvedValue(mockRetryQueueJobs.delayed as any);

      const stats = await queueService.getQueueStats();

      expect(stats).toEqual({
        postQueue: {
          waiting: 3,
          active: 1,
          completed: 50,
          failed: 2,
          delayed: 5
        },
        retryQueue: {
          waiting: 1,
          active: 0,
          completed: 10,
          failed: 1,
          delayed: 2
        }
      });
    });
  });

  describe('cleanupJobs', () => {
    it('should clean up old jobs', async () => {
      mockPostQueue.clean.mockResolvedValue(undefined as any);
      mockRetryQueue.clean.mockResolvedValue(undefined as any);

      await queueService.cleanupJobs();

      // Should clean completed jobs older than 24 hours
      expect(mockPostQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 'completed');
      expect(mockRetryQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 'completed');

      // Should clean failed jobs older than 7 days
      expect(mockPostQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 'failed');
      expect(mockRetryQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 'failed');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPostQueue.clean.mockRejectedValue(new Error('Cleanup error'));

      // Should not throw error
      await expect(queueService.cleanupJobs()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should close all queues', async () => {
      mockPostQueue.close.mockResolvedValue(undefined);
      mockRetryQueue.close.mockResolvedValue(undefined);

      await queueService.close();

      expect(mockPostQueue.close).toHaveBeenCalled();
      expect(mockRetryQueue.close).toHaveBeenCalled();
    });
  });
});
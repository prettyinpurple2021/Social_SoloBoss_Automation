import { SchedulerService } from '../services/SchedulerService';
import { QueueService } from '../services/QueueService';
import { PostService } from '../services/PostService';
import { IntegrationService } from '../services/IntegrationService';
import { PostStatus, Platform } from '../types/database';

// Mock dependencies
jest.mock('../services/QueueService');
jest.mock('../services/PostService');
jest.mock('../services/IntegrationService');
jest.mock('../models/PlatformPost');

const mockQueueService = QueueService as jest.Mocked<typeof QueueService>;
const mockPostService = PostService as jest.Mocked<typeof PostService>;
const mockIntegrationService = IntegrationService as jest.Mocked<typeof IntegrationService>;

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let mockQueueInstance: any;
  let mockIntegrationInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock queue service instance
    mockQueueInstance = {
      schedulePost: jest.fn(),
      executePostNow: jest.fn(),
      cancelScheduledPost: jest.fn(),
      scheduleRetry: jest.fn(),
      getQueueStats: jest.fn(),
      getPostQueue: jest.fn(() => ({
        process: jest.fn()
      })),
      getRetryQueue: jest.fn(() => ({
        process: jest.fn()
      }))
    };
    mockQueueService.getInstance = jest.fn(() => mockQueueInstance);

    // Mock integration service instance
    mockIntegrationInstance = {
      publishPost: jest.fn()
    };
    mockIntegrationService.getInstance = jest.fn(() => mockIntegrationInstance);

    schedulerService = SchedulerService.getInstance();
  });

  describe('schedulePost', () => {
    it('should schedule a post successfully', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const scheduledTime = new Date('2024-01-01T12:00:00Z');

      mockPostService.updatePostStatus = jest.fn().mockResolvedValue({
        id: postId,
        status: PostStatus.SCHEDULED
      });
      mockQueueInstance.schedulePost.mockResolvedValue({ id: 'job-123' });

      await schedulerService.schedulePost(postId, userId, scheduledTime);

      expect(mockPostService.updatePostStatus).toHaveBeenCalledWith(
        postId, 
        userId, 
        PostStatus.SCHEDULED
      );
      expect(mockQueueInstance.schedulePost).toHaveBeenCalledWith(
        postId, 
        userId, 
        scheduledTime
      );
    });

    it('should handle scheduling errors', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const scheduledTime = new Date('2024-01-01T12:00:00Z');

      mockPostService.updatePostStatus = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        schedulerService.schedulePost(postId, userId, scheduledTime)
      ).rejects.toThrow('Database error');
    });
  });

  describe('executePostNow', () => {
    it('should execute a post immediately', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post',
        images: [],
        hashtags: ['test'],
        platforms: [Platform.FACEBOOK],
        status: PostStatus.DRAFT,
        platformPosts: [{
          id: 'platform-post-123',
          platform: Platform.FACEBOOK,
          content: 'Test post #test',
          status: PostStatus.DRAFT
        }]
      };

      mockPostService.getPost = jest.fn().mockResolvedValue(mockPost);
      mockPostService.updatePostStatus = jest.fn().mockResolvedValue(mockPost);
      mockIntegrationInstance.publishPost.mockResolvedValue({
        success: true,
        platformPostId: 'fb-123',
        retryable: false
      });

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(true);
      expect(result.postId).toBe(postId);
      expect(result.platformResults).toHaveLength(1);
      expect(result.platformResults[0].success).toBe(true);
    });

    it('should handle post not found', async () => {
      const postId = 'post-123';
      const userId = 'user-123';

      mockPostService.getPost = jest.fn().mockResolvedValue(null);

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle platform publishing failures', async () => {
      const postId = 'post-123';
      const userId = 'user-123';
      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post',
        images: [],
        hashtags: ['test'],
        platforms: [Platform.FACEBOOK],
        status: PostStatus.DRAFT,
        platformPosts: [{
          id: 'platform-post-123',
          platform: Platform.FACEBOOK,
          content: 'Test post #test',
          status: PostStatus.DRAFT
        }]
      };

      mockPostService.getPost = jest.fn().mockResolvedValue(mockPost);
      mockPostService.updatePostStatus = jest.fn().mockResolvedValue(mockPost);
      mockIntegrationInstance.publishPost.mockResolvedValue({
        success: false,
        error: 'API rate limit exceeded',
        retryable: true
      });

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.platformResults).toHaveLength(1);
      expect(result.platformResults[0].success).toBe(false);
      expect(result.platformResults[0].retryable).toBe(true);
    });
  });

  describe('cancelScheduledPost', () => {
    it('should cancel a scheduled post successfully', async () => {
      const postId = 'post-123';
      const userId = 'user-123';

      mockQueueInstance.cancelScheduledPost.mockResolvedValue(true);
      mockPostService.updatePostStatus = jest.fn().mockResolvedValue({
        id: postId,
        status: PostStatus.DRAFT
      });

      const result = await schedulerService.cancelScheduledPost(postId, userId);

      expect(result).toBe(true);
      expect(mockQueueInstance.cancelScheduledPost).toHaveBeenCalledWith(postId);
      expect(mockPostService.updatePostStatus).toHaveBeenCalledWith(
        postId, 
        userId, 
        PostStatus.DRAFT
      );
    });

    it('should handle cancellation when job not found', async () => {
      const postId = 'post-123';
      const userId = 'user-123';

      mockQueueInstance.cancelScheduledPost.mockResolvedValue(false);

      const result = await schedulerService.cancelScheduledPost(postId, userId);

      expect(result).toBe(false);
      expect(mockPostService.updatePostStatus).not.toHaveBeenCalled();
    });

    it('should handle cancellation errors', async () => {
      const postId = 'post-123';
      const userId = 'user-123';

      mockQueueInstance.cancelScheduledPost.mockRejectedValue(
        new Error('Queue error')
      );

      const result = await schedulerService.cancelScheduledPost(postId, userId);

      expect(result).toBe(false);
    });
  });

  describe('processScheduledPosts', () => {
    it('should process all scheduled posts', async () => {
      const scheduledPosts = [
        {
          id: 'post-1',
          user_id: 'user-1',
          scheduled_time: new Date('2024-01-01T12:00:00Z'),
          status: PostStatus.SCHEDULED,
          platformPosts: []
        },
        {
          id: 'post-2',
          user_id: 'user-2',
          scheduled_time: new Date('2024-01-01T13:00:00Z'),
          status: PostStatus.SCHEDULED,
          platformPosts: []
        }
      ];

      mockPostService.getScheduledPostsForExecution = jest.fn()
        .mockResolvedValue(scheduledPosts);
      mockQueueInstance.executePostNow.mockResolvedValue({ id: 'job-123' });

      await schedulerService.processScheduledPosts();

      expect(mockPostService.getScheduledPostsForExecution).toHaveBeenCalled();
      expect(mockQueueInstance.executePostNow).toHaveBeenCalledTimes(2);
      expect(mockQueueInstance.executePostNow).toHaveBeenCalledWith('post-1', 'user-1');
      expect(mockQueueInstance.executePostNow).toHaveBeenCalledWith('post-2', 'user-2');
    });

    it('should handle errors when processing individual posts', async () => {
      const scheduledPosts = [
        {
          id: 'post-1',
          user_id: 'user-1',
          scheduled_time: new Date('2024-01-01T12:00:00Z'),
          status: PostStatus.SCHEDULED,
          platformPosts: []
        }
      ];

      mockPostService.getScheduledPostsForExecution = jest.fn()
        .mockResolvedValue(scheduledPosts);
      mockQueueInstance.executePostNow.mockRejectedValue(
        new Error('Queue error')
      );

      // Should not throw error, just log it
      await expect(schedulerService.processScheduledPosts()).resolves.not.toThrow();
    });

    it('should handle errors when fetching scheduled posts', async () => {
      mockPostService.getScheduledPostsForExecution = jest.fn()
        .mockRejectedValue(new Error('Database error'));

      // Should not throw error, just log it
      await expect(schedulerService.processScheduledPosts()).resolves.not.toThrow();
    });
  });

  describe('getSchedulerStats', () => {
    it('should return scheduler statistics', async () => {
      const mockQueueStats = {
        postQueue: {
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 3,
          delayed: 10
        },
        retryQueue: {
          waiting: 1,
          active: 0,
          completed: 20,
          failed: 2,
          delayed: 3
        }
      };

      const mockScheduledPosts = [
        { id: 'post-1', status: PostStatus.SCHEDULED },
        { id: 'post-2', status: PostStatus.SCHEDULED }
      ];

      mockQueueInstance.getQueueStats.mockResolvedValue(mockQueueStats);
      mockPostService.getScheduledPostsForExecution = jest.fn()
        .mockResolvedValue(mockScheduledPosts);

      const stats = await schedulerService.getSchedulerStats();

      expect(stats.queueStats).toEqual(mockQueueStats);
      expect(stats.scheduledPostsCount).toBe(2);
    });
  });
});
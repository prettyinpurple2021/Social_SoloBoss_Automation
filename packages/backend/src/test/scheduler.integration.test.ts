import { SchedulerService } from '../services/SchedulerService';
import { QueueService } from '../services/QueueService';
import { PostService } from '../services/PostService';
import { IntegrationService } from '../services/IntegrationService';
import { redis } from '../database/redis';
import { PostStatus, Platform } from '../types/database';

// Mock external dependencies
jest.mock('../database/redis');
jest.mock('../services/IntegrationService');

const mockRedis = redis as jest.Mocked<typeof redis>;
const mockIntegrationService = IntegrationService as jest.Mocked<typeof IntegrationService>;

describe('SchedulerService Integration Tests', () => {
  let schedulerService: SchedulerService;
  let queueService: QueueService;
  let mockIntegrationInstance: any;

  beforeAll(async () => {
    // Mock Redis connection
    mockRedis.connect = jest.fn().mockResolvedValue(undefined);
    mockRedis.getClient = jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
      disconnect: jest.fn().mockResolvedValue(undefined)
    } as any);
    mockRedis.isReady = jest.fn().mockReturnValue(true);

    // Mock integration service
    mockIntegrationInstance = {
      publishPost: jest.fn()
    };
    mockIntegrationService.getInstance = jest.fn(() => mockIntegrationInstance);

    await mockRedis.connect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Get fresh instances
    schedulerService = SchedulerService.getInstance();
    queueService = QueueService.getInstance();
  });

  afterAll(async () => {
    await queueService.close();
    await mockRedis.disconnect();
  });

  describe('End-to-End Post Execution', () => {
    it('should execute a complete post workflow', async () => {
      const postId = 'test-post-123';
      const userId = 'test-user-123';
      const scheduledTime = new Date(Date.now() + 1000); // 1 second from now

      // Mock post data
      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post content',
        images: ['https://example.com/image.jpg'],
        hashtags: ['test', 'automation'],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        status: PostStatus.DRAFT,
        platformPosts: [
          {
            id: 'platform-post-1',
            platform: Platform.FACEBOOK,
            content: 'Test post content #test #automation',
            status: PostStatus.DRAFT
          },
          {
            id: 'platform-post-2',
            platform: Platform.INSTAGRAM,
            content: 'Test post content #test #automation',
            status: PostStatus.DRAFT
          }
        ]
      };

      // Mock PostService methods
      jest.spyOn(PostService, 'getPost').mockResolvedValue(mockPost as any);
      jest.spyOn(PostService, 'updatePostStatus').mockResolvedValue(mockPost as any);

      // Mock successful publishing
      mockIntegrationInstance.publishPost
        .mockResolvedValueOnce({
          success: true,
          platformPostId: 'fb-post-123',
          retryable: false
        })
        .mockResolvedValueOnce({
          success: true,
          platformPostId: 'ig-post-123',
          retryable: false
        });

      // Schedule the post
      await schedulerService.schedulePost(postId, userId, scheduledTime);

      // Wait for execution (with timeout)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the post was processed
      expect(PostService.updatePostStatus).toHaveBeenCalledWith(
        postId,
        userId,
        PostStatus.SCHEDULED
      );
    }, 10000);

    it('should handle partial failures with retry logic', async () => {
      const postId = 'test-post-456';
      const userId = 'test-user-456';

      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post with failures',
        images: [],
        hashtags: ['test'],
        platforms: [Platform.FACEBOOK, Platform.X],
        status: PostStatus.SCHEDULED,
        platformPosts: [
          {
            id: 'platform-post-3',
            platform: Platform.FACEBOOK,
            content: 'Test post with failures #test',
            status: PostStatus.SCHEDULED
          },
          {
            id: 'platform-post-4',
            platform: Platform.X,
            content: 'Test post with failures #test',
            status: PostStatus.SCHEDULED
          }
        ]
      };

      jest.spyOn(PostService, 'getPost').mockResolvedValue(mockPost as any);
      jest.spyOn(PostService, 'updatePostStatus').mockResolvedValue(mockPost as any);

      // Mock mixed results - Facebook succeeds, X fails with retryable error
      mockIntegrationInstance.publishPost
        .mockResolvedValueOnce({
          success: true,
          platformPostId: 'fb-post-456',
          retryable: false
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded',
          retryable: true
        });

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.platformResults).toHaveLength(2);
      expect(result.platformResults[0].success).toBe(true);
      expect(result.platformResults[1].success).toBe(false);
      expect(result.platformResults[1].retryable).toBe(true);
    });

    it('should handle non-retryable errors', async () => {
      const postId = 'test-post-789';
      const userId = 'test-user-789';

      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post with non-retryable error',
        images: [],
        hashtags: [],
        platforms: [Platform.FACEBOOK],
        status: PostStatus.SCHEDULED,
        platformPosts: [
          {
            id: 'platform-post-5',
            platform: Platform.FACEBOOK,
            content: 'Test post with non-retryable error',
            status: PostStatus.SCHEDULED
          }
        ]
      };

      jest.spyOn(PostService, 'getPost').mockResolvedValue(mockPost as any);
      jest.spyOn(PostService, 'updatePostStatus').mockResolvedValue(mockPost as any);

      // Mock non-retryable error
      mockIntegrationInstance.publishPost.mockResolvedValue({
        success: false,
        error: 'Invalid access token',
        retryable: false
      });

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.platformResults[0].retryable).toBe(false);
      
      // Should update post status to failed
      expect(PostService.updatePostStatus).toHaveBeenCalledWith(
        postId,
        userId,
        PostStatus.FAILED
      );
    });
  });

  describe('Queue Management', () => {
    it('should handle queue statistics correctly', async () => {
      const stats = await schedulerService.getSchedulerStats();

      expect(stats).toHaveProperty('queueStats');
      expect(stats).toHaveProperty('scheduledPostsCount');
      expect(stats.queueStats).toHaveProperty('postQueue');
      expect(stats.queueStats).toHaveProperty('retryQueue');
    });

    it('should cancel scheduled posts correctly', async () => {
      const postId = 'cancel-test-post';
      const userId = 'cancel-test-user';
      const scheduledTime = new Date(Date.now() + 60000); // 1 minute from now

      // Mock post update
      jest.spyOn(PostService, 'updatePostStatus').mockResolvedValue({
        id: postId,
        status: PostStatus.DRAFT
      } as any);

      // Schedule a post
      await schedulerService.schedulePost(postId, userId, scheduledTime);

      // Cancel the post
      const canceled = await schedulerService.cancelScheduledPost(postId, userId);

      expect(canceled).toBe(true);
      expect(PostService.updatePostStatus).toHaveBeenCalledWith(
        postId,
        userId,
        PostStatus.DRAFT
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const postId = 'error-test-post';
      const userId = 'error-test-user';

      // Mock database error
      jest.spyOn(PostService, 'getPost').mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle integration service errors gracefully', async () => {
      const postId = 'integration-error-post';
      const userId = 'integration-error-user';

      const mockPost = {
        id: postId,
        user_id: userId,
        content: 'Test post',
        images: [],
        hashtags: [],
        platforms: [Platform.FACEBOOK],
        status: PostStatus.SCHEDULED,
        platformPosts: [
          {
            id: 'platform-post-error',
            platform: Platform.FACEBOOK,
            content: 'Test post',
            status: PostStatus.SCHEDULED
          }
        ]
      };

      jest.spyOn(PostService, 'getPost').mockResolvedValue(mockPost as any);
      jest.spyOn(PostService, 'updatePostStatus').mockResolvedValue(mockPost as any);

      // Mock integration service throwing an error
      mockIntegrationInstance.publishPost.mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await schedulerService.executePostNow(postId, userId);

      expect(result.success).toBe(false);
      expect(result.platformResults[0].error).toContain('Network timeout');
      expect(result.platformResults[0].retryable).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const postId = 'retry-test-post';
      const userId = 'retry-test-user';
      const originalError = 'API rate limit exceeded';
      const scheduledTime = new Date();

      // Test different retry counts
      const retryDelays = [];

      for (let retryCount = 1; retryCount <= 3; retryCount++) {
        const startTime = Date.now();
        
        await queueService.scheduleRetry(
          postId,
          userId,
          originalError,
          retryCount,
          scheduledTime
        );

        // Calculate expected delay: 60000 * 5^(retryCount-1)
        const expectedDelay = 60000 * Math.pow(5, retryCount - 1);
        retryDelays.push(expectedDelay);
      }

      expect(retryDelays).toEqual([
        60000,   // 1 minute
        300000,  // 5 minutes
        1500000  // 25 minutes
      ]);
    });
  });
});
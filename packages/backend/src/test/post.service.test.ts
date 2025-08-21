import { PostService } from '../services/PostService';
import { PostModel } from '../models/Post';
import { PlatformPostModel } from '../models/PlatformPost';
import { PostStatus, PostSource, Platform } from '../types/database';

// Mock the models
jest.mock('../models/Post');
jest.mock('../models/PlatformPost');

const MockPostModel = PostModel as jest.Mocked<typeof PostModel>;
const MockPlatformPostModel = PlatformPostModel as jest.Mocked<typeof PlatformPostModel>;

describe('PostService', () => {
  const mockUserId = 'user-123';
  const mockPostId = 'post-123';
  
  const mockPostRow = {
    id: mockPostId,
    user_id: mockUserId,
    content: 'Test post content',
    images: [],
    hashtags: ['test', 'social'],
    platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
    scheduled_time: undefined,
    status: PostStatus.DRAFT,
    source: PostSource.MANUAL,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockPlatformPost = {
    id: 'platform-post-123',
    post_id: mockPostId,
    platform: Platform.FACEBOOK,
    platform_post_id: undefined,
    content: 'Test post content\n\n#test #social',
    status: PostStatus.DRAFT,
    published_at: undefined,
    error: undefined,
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a post with valid data', async () => {
      const postData = {
        content: 'Test post content',
        hashtags: ['test', 'social'],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
      };

      MockPostModel.create.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.create.mockResolvedValue(mockPlatformPost);

      const result = await PostService.createPost(mockUserId, postData);

      expect(MockPostModel.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        content: 'Test post content',
        images: [],
        hashtags: ['test', 'social'],
        platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
        scheduled_time: undefined,
        status: PostStatus.DRAFT,
        source: PostSource.MANUAL
      });

      expect(MockPlatformPostModel.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockPostRow,
        platformPosts: expect.any(Array)
      });
    });

    it('should set status to SCHEDULED when scheduledTime is provided', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const postData = {
        content: 'Scheduled post',
        platforms: [Platform.FACEBOOK],
        scheduledTime: futureDate
      };

      const scheduledPost = { ...mockPostRow, status: PostStatus.SCHEDULED, scheduled_time: futureDate };
      MockPostModel.create.mockResolvedValue(scheduledPost);
      MockPlatformPostModel.create.mockResolvedValue(mockPlatformPost);

      await PostService.createPost(mockUserId, postData);

      expect(MockPostModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PostStatus.SCHEDULED,
          scheduled_time: futureDate
        })
      );
    });

    it('should validate and reject empty content', async () => {
      const postData = {
        content: '',
        platforms: [Platform.FACEBOOK]
      };

      await expect(PostService.createPost(mockUserId, postData))
        .rejects.toThrow('Post content cannot be empty');
    });

    it('should validate and reject content that is too long', async () => {
      const postData = {
        content: 'a'.repeat(10001),
        platforms: [Platform.FACEBOOK]
      };

      await expect(PostService.createPost(mockUserId, postData))
        .rejects.toThrow('Post content cannot exceed 10,000 characters');
    });

    it('should validate and reject empty platforms array', async () => {
      const postData = {
        content: 'Test content',
        platforms: []
      };

      await expect(PostService.createPost(mockUserId, postData))
        .rejects.toThrow('At least one platform must be selected');
    });

    it('should validate and reject too many hashtags', async () => {
      const postData = {
        content: 'Test content',
        platforms: [Platform.FACEBOOK],
        hashtags: Array(31).fill('tag')
      };

      await expect(PostService.createPost(mockUserId, postData))
        .rejects.toThrow('Cannot have more than 30 hashtags');
    });

    it('should validate and reject too many images', async () => {
      const postData = {
        content: 'Test content',
        platforms: [Platform.FACEBOOK],
        images: Array(11).fill('image.jpg')
      };

      await expect(PostService.createPost(mockUserId, postData))
        .rejects.toThrow('Cannot have more than 10 images');
    });

    it('should sanitize content by removing script tags', async () => {
      const postData = {
        content: 'Test content <script>alert("xss")</script>',
        platforms: [Platform.FACEBOOK]
      };

      MockPostModel.create.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.create.mockResolvedValue(mockPlatformPost);

      await PostService.createPost(mockUserId, postData);

      expect(MockPostModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test content'
        })
      );
    });

    it('should sanitize hashtags by removing special characters', async () => {
      const postData = {
        content: 'Test content',
        platforms: [Platform.FACEBOOK],
        hashtags: ['#test!@#', 'social$%^', 'valid_tag']
      };

      MockPostModel.create.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.create.mockResolvedValue(mockPlatformPost);

      await PostService.createPost(mockUserId, postData);

      expect(MockPostModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hashtags: ['test', 'social', 'valid_tag']
        })
      );
    });
  });

  describe('getPost', () => {
    it('should return post with platform posts for authorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.findByPostId.mockResolvedValue([mockPlatformPost]);

      const result = await PostService.getPost(mockPostId, mockUserId);

      expect(result).toEqual({
        ...mockPostRow,
        platformPosts: [mockPlatformPost]
      });
    });

    it('should return null for non-existent post', async () => {
      MockPostModel.findById.mockResolvedValue(null);

      const result = await PostService.getPost(mockPostId, mockUserId);

      expect(result).toBeNull();
    });

    it('should return null for unauthorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);

      const result = await PostService.getPost(mockPostId, 'different-user');

      expect(result).toBeNull();
    });
  });

  describe('updatePost', () => {
    it('should update post content and regenerate platform posts', async () => {
      const updateData = {
        content: 'Updated content',
        hashtags: ['updated']
      };

      MockPostModel.findById.mockResolvedValue(mockPostRow);
      MockPostModel.update.mockResolvedValue({ ...mockPostRow, content: 'Updated content' });
      MockPlatformPostModel.deleteByPostId.mockResolvedValue(2);
      MockPlatformPostModel.create.mockResolvedValue(mockPlatformPost);

      const result = await PostService.updatePost(mockPostId, mockUserId, updateData);

      expect(MockPostModel.update).toHaveBeenCalledWith(mockPostId, {
        content: 'Updated content',
        hashtags: ['updated']
      });
      expect(MockPlatformPostModel.deleteByPostId).toHaveBeenCalledWith(mockPostId);
      expect(result).toBeDefined();
    });

    it('should return null for unauthorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);

      const result = await PostService.updatePost(mockPostId, 'different-user', { content: 'Updated' });

      expect(result).toBeNull();
      expect(MockPostModel.update).not.toHaveBeenCalled();
    });

    it('should update scheduled time and status', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updateData = { scheduledTime: futureDate };

      MockPostModel.findById.mockResolvedValue(mockPostRow);
      MockPostModel.update.mockResolvedValue({ ...mockPostRow, scheduled_time: futureDate, status: PostStatus.SCHEDULED });
      MockPlatformPostModel.findByPostId.mockResolvedValue([mockPlatformPost]);

      const result = await PostService.updatePost(mockPostId, mockUserId, updateData);

      expect(MockPostModel.update).toHaveBeenCalledWith(mockPostId, {
        scheduled_time: futureDate,
        status: PostStatus.SCHEDULED
      });
    });
  });

  describe('deletePost', () => {
    it('should delete post for authorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.deleteByPostId.mockResolvedValue(2);
      MockPostModel.delete.mockResolvedValue(true);

      const result = await PostService.deletePost(mockPostId, mockUserId);

      expect(result).toBe(true);
      expect(MockPlatformPostModel.deleteByPostId).toHaveBeenCalledWith(mockPostId);
      expect(MockPostModel.delete).toHaveBeenCalledWith(mockPostId);
    });

    it('should return false for unauthorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);

      const result = await PostService.deletePost(mockPostId, 'different-user');

      expect(result).toBe(false);
      expect(MockPostModel.delete).not.toHaveBeenCalled();
    });

    it('should return false for non-existent post', async () => {
      MockPostModel.findById.mockResolvedValue(null);

      const result = await PostService.deletePost(mockPostId, mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('updatePostStatus', () => {
    it('should update post and platform post statuses', async () => {
      const newStatus = PostStatus.PUBLISHED;
      
      MockPostModel.findById.mockResolvedValue(mockPostRow);
      MockPostModel.updateStatus.mockResolvedValue({ ...mockPostRow, status: newStatus });
      MockPlatformPostModel.findByPostId.mockResolvedValue([mockPlatformPost]);
      MockPlatformPostModel.updateStatus.mockResolvedValue({ ...mockPlatformPost, status: newStatus });

      const result = await PostService.updatePostStatus(mockPostId, mockUserId, newStatus);

      expect(MockPostModel.updateStatus).toHaveBeenCalledWith(mockPostId, newStatus);
      expect(MockPlatformPostModel.updateStatus).toHaveBeenCalledWith(mockPlatformPost.id, newStatus);
      expect(result?.status).toBe(newStatus);
    });

    it('should return null for unauthorized user', async () => {
      MockPostModel.findById.mockResolvedValue(mockPostRow);

      const result = await PostService.updatePostStatus(mockPostId, 'different-user', PostStatus.PUBLISHED);

      expect(result).toBeNull();
    });
  });

  describe('getScheduledPostsForExecution', () => {
    it('should return scheduled posts ready for execution', async () => {
      const scheduledPost = { ...mockPostRow, status: PostStatus.SCHEDULED, scheduled_time: new Date() };
      
      MockPostModel.findScheduledPosts.mockResolvedValue([scheduledPost]);
      MockPlatformPostModel.findByPostId.mockResolvedValue([mockPlatformPost]);

      const result = await PostService.getScheduledPostsForExecution();

      expect(MockPostModel.findScheduledPosts).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...scheduledPost,
        platformPosts: [mockPlatformPost]
      });
    });
  });

  describe('content formatting for platforms', () => {
    it('should format content for X (Twitter) with character limits', async () => {
      const longContent = 'a'.repeat(300);
      const postData = {
        content: longContent,
        platforms: [Platform.X],
        hashtags: ['test']
      };

      MockPostModel.create.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.create.mockImplementation((input) => 
        Promise.resolve({ ...mockPlatformPost, content: input.content })
      );

      await PostService.createPost(mockUserId, postData);

      const createCall = MockPlatformPostModel.create.mock.calls[0][0];
      expect(createCall.content.length).toBeLessThanOrEqual(280);
      expect(createCall.content).toContain('...');
    });

    it('should format content with hashtags for Instagram', async () => {
      const postData = {
        content: 'Instagram post',
        platforms: [Platform.INSTAGRAM],
        hashtags: ['instagram', 'social']
      };

      MockPostModel.create.mockResolvedValue(mockPostRow);
      MockPlatformPostModel.create.mockImplementation((input) => 
        Promise.resolve({ ...mockPlatformPost, content: input.content })
      );

      await PostService.createPost(mockUserId, postData);

      const createCall = MockPlatformPostModel.create.mock.calls[0][0];
      expect(createCall.content).toContain('#instagram #social');
    });
  });

  describe('getUserPostStats', () => {
    it('should return user post statistics', async () => {
      const mockStats = {
        total: 10,
        draft: 3,
        scheduled: 2,
        published: 4,
        failed: 1
      };

      MockPostModel.getPostStats.mockResolvedValue(mockStats);

      const result = await PostService.getUserPostStats(mockUserId);

      expect(MockPostModel.getPostStats).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockStats);
    });
  });
});
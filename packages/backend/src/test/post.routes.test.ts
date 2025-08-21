import request from 'supertest';
import express from 'express';
import postsRoutes from '../routes/posts';
import { PostService } from '../services/PostService';
import { PostStatus, Platform, PostSource } from '../types/database';

// Mock the PostService
jest.mock('../services/PostService');
const MockPostService = PostService as jest.Mocked<typeof PostService>;

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/posts', postsRoutes);

describe('Posts Routes', () => {
  const mockUserId = 'user-123';
  const mockPostId = '123e4567-e89b-12d3-a456-426614174000';
  
  const mockPost = {
    id: mockPostId,
    user_id: mockUserId,
    content: 'Test post content',
    images: [],
    hashtags: ['test'],
    platforms: [Platform.FACEBOOK],
    scheduled_time: undefined as Date | undefined,
    status: PostStatus.DRAFT,
    source: PostSource.MANUAL,
    created_at: new Date('2025-08-21T05:27:24.697Z'),
    updated_at: new Date('2025-08-21T05:27:24.697Z'),
    platformPosts: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/posts', () => {
    it('should create a new post with valid data', async () => {
      const postData = {
        content: 'Test post content',
        platforms: [Platform.FACEBOOK],
        hashtags: ['test']
      };

      MockPostService.createPost.mockResolvedValue(mockPost);

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post created successfully');
      expect(response.body.data).toEqual(mockPost);
      expect(MockPostService.createPost).toHaveBeenCalledWith(mockUserId, postData);
    });

    it('should validate required content field', async () => {
      const postData = {
        platforms: [Platform.FACEBOOK]
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Content is required' })
      );
    });

    it('should validate platforms array', async () => {
      const postData = {
        content: 'Test content',
        platforms: []
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'At least one platform must be selected' })
      );
    });

    it('should validate content length', async () => {
      const postData = {
        content: 'a'.repeat(10001),
        platforms: [Platform.FACEBOOK]
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Content cannot exceed 10,000 characters' })
      );
    });

    it('should validate scheduled time is in the future', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const postData = {
        content: 'Test content',
        platforms: [Platform.FACEBOOK],
        scheduledTime: pastDate.toISOString()
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Scheduled time must be in the future' })
      );
    });

    it('should validate platform values', async () => {
      const postData = {
        content: 'Test content',
        platforms: ['invalid-platform']
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid platform specified' })
      );
    });

    it('should handle service errors', async () => {
      const postData = {
        content: 'Test content',
        platforms: [Platform.FACEBOOK]
      };

      MockPostService.createPost.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/posts')
        .send(postData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /api/posts', () => {
    it('should get user posts with default pagination', async () => {
      const mockPosts = [mockPost];
      MockPostService.getUserPosts.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPosts);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        count: 1
      });
      expect(MockPostService.getUserPosts).toHaveBeenCalledWith(mockUserId, 50, 0, undefined);
    });

    it('should get user posts with custom pagination', async () => {
      const mockPosts = [mockPost];
      MockPostService.getUserPosts.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/posts?limit=10&offset=20')
        .expect(200);

      expect(MockPostService.getUserPosts).toHaveBeenCalledWith(mockUserId, 10, 20, undefined);
    });

    it('should get user posts filtered by status', async () => {
      const mockPosts = [mockPost];
      MockPostService.getUserPosts.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get(`/api/posts?status=${PostStatus.DRAFT}`)
        .expect(200);

      expect(MockPostService.getUserPosts).toHaveBeenCalledWith(mockUserId, 50, 0, PostStatus.DRAFT);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/posts?limit=101&offset=-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Limit must be between 1 and 100' })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Offset must be a non-negative integer' })
      );
    });

    it('should validate status filter', async () => {
      const response = await request(app)
        .get('/api/posts?status=invalid-status')
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid status filter' })
      );
    });
  });

  describe('GET /api/posts/:id', () => {
    it('should get a specific post by ID', async () => {
      MockPostService.getPost.mockResolvedValue(mockPost);

      const response = await request(app)
        .get(`/api/posts/${mockPostId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPost);
      expect(MockPostService.getPost).toHaveBeenCalledWith(mockPostId, mockUserId);
    });

    it('should return 404 for non-existent post', async () => {
      MockPostService.getPost.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/posts/${mockPostId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Post not found');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/posts/invalid-uuid')
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid post ID format' })
      );
    });
  });

  describe('PUT /api/posts/:id', () => {
    it('should update a post with valid data', async () => {
      const updateData = {
        content: 'Updated content',
        hashtags: ['updated']
      };

      const updatedPost = { ...mockPost, content: 'Updated content' };
      MockPostService.updatePost.mockResolvedValue(updatedPost);

      const response = await request(app)
        .put(`/api/posts/${mockPostId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post updated successfully');
      expect(response.body.data).toEqual(updatedPost);
      expect(MockPostService.updatePost).toHaveBeenCalledWith(mockPostId, mockUserId, updateData);
    });

    it('should return 404 for non-existent post', async () => {
      MockPostService.updatePost.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/posts/${mockPostId}`)
        .send({ content: 'Updated content' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Post not found');
    });

    it('should validate update data', async () => {
      const updateData = {
        content: 'a'.repeat(10001),
        platforms: []
      };

      const response = await request(app)
        .put(`/api/posts/${mockPostId}`)
        .send(updateData)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Content must be between 1 and 10,000 characters' })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'At least one platform must be selected' })
      );
    });

    it('should handle service errors', async () => {
      MockPostService.updatePost.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put(`/api/posts/${mockPostId}`)
        .send({ content: 'Updated content' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Update failed');
    });
  });

  describe('PATCH /api/posts/:id/status', () => {
    it('should update post status', async () => {
      const updatedPost = { ...mockPost, status: PostStatus.PUBLISHED };
      MockPostService.updatePostStatus.mockResolvedValue(updatedPost);

      const response = await request(app)
        .patch(`/api/posts/${mockPostId}/status`)
        .send({ status: PostStatus.PUBLISHED })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post status updated successfully');
      expect(response.body.data).toEqual(updatedPost);
      expect(MockPostService.updatePostStatus).toHaveBeenCalledWith(mockPostId, mockUserId, PostStatus.PUBLISHED);
    });

    it('should validate status value', async () => {
      const response = await request(app)
        .patch(`/api/posts/${mockPostId}/status`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid status value' })
      );
    });

    it('should return 404 for non-existent post', async () => {
      MockPostService.updatePostStatus.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/posts/${mockPostId}/status`)
        .send({ status: PostStatus.PUBLISHED })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Post not found');
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should delete a post', async () => {
      MockPostService.deletePost.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/posts/${mockPostId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post deleted successfully');
      expect(MockPostService.deletePost).toHaveBeenCalledWith(mockPostId, mockUserId);
    });

    it('should return 404 for non-existent post', async () => {
      MockPostService.deletePost.mockResolvedValue(false);

      const response = await request(app)
        .delete(`/api/posts/${mockPostId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Post not found');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .delete('/api/posts/invalid-uuid')
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid post ID format' })
      );
    });
  });

  describe('GET /api/posts/stats', () => {
    it('should get user post statistics', async () => {
      const mockStats = {
        total: 10,
        draft: 3,
        scheduled: 2,
        published: 4,
        failed: 1
      };

      MockPostService.getUserPostStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/posts/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(MockPostService.getUserPostStats).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle service errors', async () => {
      MockPostService.getUserPostStats.mockRejectedValue(new Error('Stats error'));

      const response = await request(app)
        .get('/api/posts/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch post statistics');
    });
  });
});
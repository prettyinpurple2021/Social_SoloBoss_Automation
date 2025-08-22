import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createSoloBossRoutes } from '../routes/soloboss';
import { authMiddleware } from '../middleware/auth';
import { testDb } from './setup';
import crypto from 'crypto';

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

// Mock PostService
jest.mock('../services/PostService', () => ({
  PostService: {
    createPost: jest.fn(),
    getPostsByUserAndSource: jest.fn(),
    getPost: jest.fn(),
    updatePost: jest.fn(),
    updatePostStatus: jest.fn(),
    deletePost: jest.fn()
  }
}));

describe('SoloBoss Routes', () => {
  let app: express.Application;
  let testUserId: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/soloboss', createSoloBossRoutes(testDb as any));

    // Create test user
    const userResult = await testDb.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['test@example.com', 'Test User', 'hashedpassword']
    );
    testUserId = userResult.rows[0].id;

    // Update mock to use the actual test user ID
    (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: testUserId };
      next();
    });
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.query('DELETE FROM soloboss_integrations WHERE user_id = $1', [testUserId]);
    await testDb.query('DELETE FROM users WHERE id = $1', [testUserId]);
    jest.clearAllMocks();
  });

  describe('POST /api/soloboss/connect', () => {
    it('should connect SoloBoss integration successfully', async () => {
      const connectionData = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const response = await request(app)
        .post('/api/soloboss/connect')
        .send(connectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('SoloBoss integration connected successfully');
      expect(response.body.configId).toBeDefined();
    });

    it('should reject connection with missing API key', async () => {
      const connectionData = {
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const response = await request(app)
        .post('/api/soloboss/connect')
        .send(connectionData)
        .expect(400);

      expect(response.body.error).toBe('API key and webhook secret are required');
    });

    it('should reject connection with invalid API key', async () => {
      const connectionData = {
        apiKey: 'short',
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const response = await request(app)
        .post('/api/soloboss/connect')
        .send(connectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key format');
    });
  });

  describe('DELETE /api/soloboss/disconnect', () => {
    beforeEach(async () => {
      // Set up an integration to disconnect
      await request(app)
        .post('/api/soloboss/connect')
        .send({
          apiKey: 'test-api-key-12345',
          webhookSecret: 'test-webhook-secret-16chars'
        });
    });

    it('should disconnect SoloBoss integration successfully', async () => {
      const response = await request(app)
        .delete('/api/soloboss/disconnect')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('SoloBoss integration disconnected successfully');
    });

    it('should handle disconnection when no integration exists', async () => {
      // First disconnect the existing integration
      await request(app).delete('/api/soloboss/disconnect');

      // Try to disconnect again
      const response = await request(app)
        .delete('/api/soloboss/disconnect')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active SoloBoss integration found');
    });
  });

  describe('GET /api/soloboss/status', () => {
    it('should return status when integration exists', async () => {
      // Connect integration first
      await request(app)
        .post('/api/soloboss/connect')
        .send({
          apiKey: 'test-api-key-12345',
          webhookSecret: 'test-webhook-secret-16chars'
        });

      const response = await request(app)
        .get('/api/soloboss/status')
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(response.body.integration).toBeDefined();
      expect(response.body.integration.id).toBeDefined();
      expect(response.body.integration.isActive).toBe(true);
    });

    it('should return status when no integration exists', async () => {
      const response = await request(app)
        .get('/api/soloboss/status')
        .expect(200);

      expect(response.body.connected).toBe(false);
      expect(response.body.integration).toBeNull();
    });
  });

  describe('GET /api/soloboss/pending-posts', () => {
    it('should return pending SoloBoss posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Test post 1',
          images: [],
          hashtags: ['#test'],
          platforms: ['facebook'],
          platformSpecificContent: {},
          createdAt: new Date(),
          source: 'soloboss'
        }
      ];

      const { PostService } = await import('../services/PostService');
      (PostService.getPostsByUserAndSource as any).mockResolvedValue(mockPosts);

      const response = await request(app)
        .get('/api/soloboss/pending-posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].id).toBe('post-1');
      expect(PostService.getPostsByUserAndSource).toHaveBeenCalledWith(testUserId, 'soloboss', 'draft');
    });
  });

  describe('PUT /api/soloboss/posts/:postId/customize', () => {
    it('should customize a SoloBoss post successfully', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: testUserId,
        source: 'soloboss',
        content: 'Original content',
        images: [],
        hashtags: [],
        platforms: ['facebook'],
        platformPosts: []
      };

      const updatedPost = {
        ...mockPost,
        content: 'Updated content',
        hashtags: ['#updated']
      };

      const { PostService } = await import('../services/PostService');
      (PostService.getPost as any).mockResolvedValue(mockPost);
      (PostService.updatePost as any).mockResolvedValue(updatedPost);

      const customizations = {
        content: 'Updated content',
        hashtags: ['#updated']
      };

      const response = await request(app)
        .put('/api/soloboss/posts/post-1/customize')
        .send(customizations)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post customized successfully');
      expect(response.body.post.content).toBe('Updated content');
      expect(PostService.updatePost).toHaveBeenCalledWith('post-1', testUserId, customizations);
    });

    it('should reject customization of non-SoloBoss post', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: testUserId,
        source: 'manual', // Not a SoloBoss post
        content: 'Original content'
      };

      const { PostService } = await import('../services/PostService');
      (PostService.getPost as any).mockResolvedValue(mockPost);

      const response = await request(app)
        .put('/api/soloboss/posts/post-1/customize')
        .send({ content: 'Updated content' })
        .expect(404);

      expect(response.body.error).toBe('Post not found or not accessible');
    });
  });

  describe('POST /api/soloboss/posts/:postId/approve', () => {
    it('should approve and schedule a SoloBoss post', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: testUserId,
        source: 'soloboss',
        status: 'draft'
      };

      const scheduledPost = {
        ...mockPost,
        status: 'scheduled',
        scheduledTime: new Date('2024-01-20T10:00:00Z')
      };

      const { PostService } = await import('../services/PostService');
      (PostService.getPost as any).mockResolvedValue(mockPost);
      (PostService.updatePost as any).mockResolvedValue(scheduledPost);
      (PostService.updatePostStatus as any).mockResolvedValue(scheduledPost);

      const response = await request(app)
        .post('/api/soloboss/posts/post-1/approve')
        .send({ scheduledTime: '2024-01-20T10:00:00Z' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post approved and scheduled successfully');
    });

    it('should approve post without scheduling', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: testUserId,
        source: 'soloboss',
        status: 'draft'
      };

      const approvedPost = {
        ...mockPost,
        status: 'scheduled'
      };

      const { PostService } = await import('../services/PostService');
      (PostService.getPost as any).mockResolvedValue(mockPost);
      (PostService.updatePostStatus as any).mockResolvedValue(approvedPost);

      const response = await request(app)
        .post('/api/soloboss/posts/post-1/approve')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(PostService.updatePostStatus).toHaveBeenCalledWith('post-1', testUserId, 'scheduled');
    });
  });

  describe('DELETE /api/soloboss/posts/:postId', () => {
    it('should delete a SoloBoss post successfully', async () => {
      const mockPost = {
        id: 'post-1',
        user_id: testUserId,
        source: 'soloboss'
      };

      const { PostService } = await import('../services/PostService');
      (PostService.getPost as any).mockResolvedValue(mockPost);
      (PostService.deletePost as any).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/soloboss/posts/post-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post rejected and deleted successfully');
      expect(PostService.deletePost).toHaveBeenCalledWith('post-1', testUserId);
    });
  });

  describe('POST /api/soloboss/webhook', () => {
    beforeEach(async () => {
      // Set up integration for webhook tests
      await request(app)
        .post('/api/soloboss/connect')
        .send({
          apiKey: 'test-api-key-12345',
          webhookSecret: 'test-webhook-secret-16chars'
        });
    });

    it('should process valid webhook successfully', async () => {
      const webhookPayload = {
        id: 'soloboss-content-123',
        title: 'Test Blog Post',
        content: 'This is a test blog post content.',
        seoSuggestions: ['content', 'marketing'],
        socialMediaText: 'Check out my latest blog post!',
        images: ['https://example.com/image.jpg'],
        publishedAt: '2024-01-15T10:00:00Z',
        userId: testUserId,
        signature: crypto
          .createHmac('sha256', 'test-webhook-secret-16chars')
          .update(JSON.stringify({
            id: 'soloboss-content-123',
            title: 'Test Blog Post',
            content: 'This is a test blog post content.',
            seoSuggestions: ['content', 'marketing'],
            socialMediaText: 'Check out my latest blog post!',
            images: ['https://example.com/image.jpg'],
            publishedAt: '2024-01-15T10:00:00Z',
            userId: testUserId,
            signature: '' // Will be replaced
          }))
          .digest('hex')
      };

      const { PostService } = await import('../services/PostService');
      (PostService.createPost as any).mockResolvedValue({
        id: 'created-post-id',
        user_id: testUserId,
        content: 'Check out my latest blog post!',
        images: ['https://example.com/image.jpg'],
        hashtags: [],
        platforms: ['facebook'],
        scheduled_time: null,
        status: 'draft',
        source: 'soloboss',
        created_at: new Date(),
        updated_at: new Date(),
        platformPosts: []
      } as any);

      const response = await request(app)
        .post('/api/soloboss/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Content processed successfully');
      expect(response.body.postsCreated).toBeGreaterThan(0);
      expect(response.body.requiresReview).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 'soloboss-content-124',
        title: 'Test Blog Post',
        content: 'This is a test blog post content.',
        seoSuggestions: ['content'],
        socialMediaText: 'Check out my blog!',
        images: [],
        publishedAt: '2024-01-15T11:00:00Z',
        userId: testUserId,
        signature: 'invalid-signature'
      };

      const response = await request(app)
        .post('/api/soloboss/webhook')
        .send(webhookPayload)
        .expect(401);

      expect(response.body.error).toBe('Invalid webhook signature');
    });

    it('should reject webhook with missing required fields', async () => {
      const webhookPayload = {
        title: 'Test Blog Post',
        content: 'This is a test blog post content.',
        // Missing id, userId, and signature
      };

      const response = await request(app)
        .post('/api/soloboss/webhook')
        .send(webhookPayload)
        .expect(400);

      expect(response.body.error).toBe('Missing required fields: userId, id, or signature');
    });
  });
});
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import { SoloBossService } from '../services/SoloBossService';
import { EncryptionService } from '../services/EncryptionService';
import { PostService } from '../services/PostService';
import { SoloBossWebhookPayload } from '../types/soloboss';
import { testDb } from './setup';

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

describe('SoloBossService', () => {
  let soloBossService: SoloBossService;
  let encryptionService: EncryptionService;
  let testUserId: string;

  beforeEach(async () => {
    soloBossService = new SoloBossService(testDb);
    
    // Create test user
    const userResult = await testDb.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['test@example.com', 'Test User', 'hashedpassword']
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.query('DELETE FROM soloboss_integrations WHERE user_id = $1', [testUserId]);
    await testDb.query('DELETE FROM users WHERE id = $1', [testUserId]);
    jest.clearAllMocks();
  });

  describe('connectSoloBoss', () => {
    it('should successfully connect SoloBoss integration', async () => {
      const request = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const result = await soloBossService.connectSoloBoss(testUserId, request);

      expect(result.success).toBe(true);
      expect(result.configId).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify integration was created
      const integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration).toBeDefined();
      expect(integration?.isActive).toBe(true);
    });

    it('should reject invalid API key', async () => {
      const request = {
        apiKey: 'short',
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const result = await soloBossService.connectSoloBoss(testUserId, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should reject short webhook secret', async () => {
      const request = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'short'
      };

      const result = await soloBossService.connectSoloBoss(testUserId, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook secret must be at least 16 characters');
    });

    it('should update existing integration', async () => {
      // Create initial integration
      const initialRequest = {
        apiKey: 'initial-api-key-12345',
        webhookSecret: 'initial-webhook-secret-16chars'
      };
      await soloBossService.connectSoloBoss(testUserId, initialRequest);

      // Update with new credentials
      const updateRequest = {
        apiKey: 'updated-api-key-12345',
        webhookSecret: 'updated-webhook-secret-16chars'
      };
      const result = await soloBossService.connectSoloBoss(testUserId, updateRequest);

      expect(result.success).toBe(true);

      // Verify the integration was updated, not duplicated
      const integrations = await testDb.query(
        'SELECT COUNT(*) as count FROM soloboss_integrations WHERE user_id = $1 AND is_active = true',
        [testUserId]
      );
      expect(parseInt(integrations.rows[0].count)).toBe(1);
    });
  });

  describe('disconnectSoloBoss', () => {
    it('should successfully disconnect SoloBoss integration', async () => {
      // First connect
      const request = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'test-webhook-secret-16chars'
      };
      await soloBossService.connectSoloBoss(testUserId, request);

      // Then disconnect
      const result = await soloBossService.disconnectSoloBoss(testUserId);

      expect(result).toBe(true);

      // Verify integration is deactivated
      const integration = await soloBossService.getSoloBossIntegration(testUserId);
      expect(integration).toBeNull();
    });

    it('should return false when no integration exists', async () => {
      const result = await soloBossService.disconnectSoloBoss(testUserId);
      expect(result).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    beforeEach(async () => {
      // Set up integration for signature verification tests
      const request = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'test-webhook-secret-16chars'
      };
      await soloBossService.connectSoloBoss(testUserId, request);
    });

    it('should verify valid webhook signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const crypto = await import('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', 'test-webhook-secret-16chars')
        .update(payload)
        .digest('hex');

      const isValid = await soloBossService.verifyWebhookSignature(
        payload,
        expectedSignature,
        testUserId
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid-signature';

      const isValid = await soloBossService.verifyWebhookSignature(
        payload,
        invalidSignature,
        testUserId
      );

      expect(isValid).toBe(false);
    });

    it('should return false when no integration exists', async () => {
      // Use a different user ID with no integration
      const otherUserResult = await testDb.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['other@example.com', 'Other User', 'hashedpassword']
      );
      const otherUserId = otherUserResult.rows[0].id;

      const payload = JSON.stringify({ test: 'data' });
      const signature = 'any-signature';

      const isValid = await soloBossService.verifyWebhookSignature(
        payload,
        signature,
        otherUserId
      );

      expect(isValid).toBe(false);

      // Clean up
      await testDb.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('processWebhookContent', () => {
    beforeEach(() => {
      // Mock PostService.createPost to return a mock post
      (PostService.createPost as jest.Mock).mockResolvedValue({
        id: 'mock-post-id',
        user_id: testUserId,
        content: 'Mock content',
        images: [],
        hashtags: [],
        platforms: ['facebook'],
        scheduled_time: null,
        status: 'draft',
        source: 'soloboss',
        created_at: new Date(),
        updated_at: new Date(),
        platformPosts: []
      });
    });

    it('should process webhook content successfully', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-123',
        title: 'Test Blog Post',
        content: 'This is a test blog post content with valuable information.',
        seoSuggestions: ['content marketing', 'blog writing', 'SEO tips'],
        socialMediaText: 'Check out my latest blog post about content marketing!',
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        publishedAt: '2024-01-15T10:00:00Z',
        userId: testUserId,
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.requiresReview).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.originalContent.id).toBe('soloboss-content-123');
      expect(result.originalContent.title).toBe('Test Blog Post');

      const post = result.posts[0];
      expect(post.userId).toBe(testUserId);
      expect(post.content).toBe('Check out my latest blog post about content marketing!');
      expect(post.images).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.jpg']);
      expect(post.hashtags).toContain('#content');
      expect(post.hashtags).toContain('#marketing');
      expect(post.platforms).toEqual(['facebook', 'instagram', 'pinterest', 'x']);
    });

    it('should handle content without social media text', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-124',
        title: 'Another Test Post',
        content: 'This is another test blog post with a longer content that should be truncated when generating social media content automatically.',
        seoSuggestions: ['testing', 'automation'],
        socialMediaText: '', // Empty social media text
        images: [],
        publishedAt: '2024-01-15T11:00:00Z',
        userId: testUserId,
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      expect(post.content).toContain('Another Test Post');
      expect(post.content.length).toBeLessThanOrEqual(250); // Should be truncated
    });

    it('should process images and filter invalid URLs', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-125',
        title: 'Image Test Post',
        content: 'Testing image processing',
        seoSuggestions: ['images', 'testing'],
        socialMediaText: 'Testing images',
        images: [
          'https://example.com/valid-image.jpg',
          'invalid-url',
          'https://example.com/another-valid.png',
          'not-a-url-at-all'
        ],
        publishedAt: '2024-01-15T12:00:00Z',
        userId: testUserId,
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      expect(post.images).toEqual([
        'https://example.com/valid-image.jpg',
        'https://example.com/another-valid.png'
      ]);
    });

    it('should generate platform-specific content', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-126',
        title: 'Platform Specific Test',
        content: 'Testing platform-specific content generation',
        seoSuggestions: ['social media', 'platforms', 'content strategy'],
        socialMediaText: 'This is a very long social media text that should be truncated for Twitter/X platform because it exceeds the character limit of 280 characters. This text is intentionally long to test the truncation functionality and ensure that different platforms receive appropriately formatted content.',
        images: ['https://example.com/image.jpg'],
        publishedAt: '2024-01-15T13:00:00Z',
        userId: testUserId,
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      
      expect(post.platformSpecificContent).toBeDefined();
      expect(post.platformSpecificContent?.x.content.length).toBeLessThanOrEqual(280);
      expect(post.platformSpecificContent?.instagram.hashtags.length).toBeGreaterThan(0);
      expect(post.platformSpecificContent?.pinterest.images).toHaveLength(1);
    });
  });

  describe('createDraftPostsFromSoloBoss', () => {
    it('should create draft posts from processed content', async () => {
      const processedContent = {
        posts: [
          {
            userId: testUserId,
            platforms: ['facebook', 'instagram'],
            content: 'Test social media post',
            images: ['https://example.com/image.jpg'],
            hashtags: ['#test', '#content'],
            scheduledTime: undefined
          }
        ],
        requiresReview: true,
        originalContent: {
          id: 'soloboss-123',
          title: 'Test Post',
          content: 'Test content',
          seoSuggestions: ['test'],
          socialMediaText: 'Test social media post',
          images: ['https://example.com/image.jpg'],
          publishedAt: new Date()
        }
      };

      // Mock PostService.createPost
      (PostService.createPost as jest.Mock).mockResolvedValue({
        id: 'created-post-id',
        user_id: testUserId,
        content: 'Test social media post',
        images: ['https://example.com/image.jpg'],
        hashtags: ['#test', '#content'],
        platforms: ['facebook', 'instagram'],
        scheduled_time: null,
        status: 'draft',
        source: 'soloboss',
        created_at: new Date(),
        updated_at: new Date(),
        platformPosts: []
      });

      const postIds = await soloBossService.createDraftPostsFromSoloBoss(testUserId, processedContent);

      expect(postIds).toHaveLength(1);
      expect(postIds[0]).toBe('created-post-id');
      expect(PostService.createPost).toHaveBeenCalledWith(testUserId, {
        userId: testUserId,
        platforms: ['facebook', 'instagram'],
        content: 'Test social media post',
        images: ['https://example.com/image.jpg'],
        hashtags: ['#test', '#content'],
        source: 'soloboss'
      });
    });

    it('should handle errors gracefully when creating posts', async () => {
      const processedContent = {
        posts: [
          {
            userId: testUserId,
            platforms: ['facebook'],
            content: 'Test post 1',
            images: [],
            hashtags: [],
            scheduledTime: undefined
          },
          {
            userId: testUserId,
            platforms: ['instagram'],
            content: 'Test post 2',
            images: [],
            hashtags: [],
            scheduledTime: undefined
          }
        ],
        requiresReview: true,
        originalContent: {
          id: 'soloboss-124',
          title: 'Test Post',
          content: 'Test content',
          seoSuggestions: [],
          socialMediaText: 'Test',
          images: [],
          publishedAt: new Date()
        }
      };

      // Mock first call to succeed, second to fail
      (PostService.createPost as jest.Mock)
        .mockResolvedValueOnce({
          id: 'success-post-id',
          user_id: testUserId,
          content: 'Test post 1',
          images: [],
          hashtags: [],
          platforms: ['facebook'],
          scheduled_time: null,
          status: 'draft',
          source: 'soloboss',
          created_at: new Date(),
          updated_at: new Date(),
          platformPosts: []
        })
        .mockRejectedValueOnce(new Error('Database error'));

      const postIds = await soloBossService.createDraftPostsFromSoloBoss(testUserId, processedContent);

      // Should return only the successful post ID
      expect(postIds).toHaveLength(1);
      expect(postIds[0]).toBe('success-post-id');
    });
  });
});
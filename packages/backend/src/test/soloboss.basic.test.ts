import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SoloBossService } from '../services/SoloBossService';
import { SoloBossWebhookPayload } from '../types/soloboss';

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

// Mock database
const mockDb = {
  query: jest.fn()
} as any;

describe('SoloBoss Basic Tests', () => {
  let soloBossService: SoloBossService;

  beforeEach(() => {
    soloBossService = new SoloBossService(mockDb);
    jest.clearAllMocks();
  });

  describe('connectSoloBoss', () => {
    it('should reject invalid API key', async () => {
      const request = {
        apiKey: 'short',
        webhookSecret: 'test-webhook-secret-16chars'
      };

      const result = await soloBossService.connectSoloBoss('test-user-id', request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should reject short webhook secret', async () => {
      const request = {
        apiKey: 'test-api-key-12345',
        webhookSecret: 'short'
      };

      const result = await soloBossService.connectSoloBoss('test-user-id', request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook secret must be at least 16 characters');
    });
  });

  describe('processWebhookContent', () => {
    it('should process webhook content successfully', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-123',
        title: 'Test Blog Post',
        content: 'This is a test blog post content with valuable information.',
        seoSuggestions: ['content marketing', 'blog writing', 'SEO tips'],
        socialMediaText: 'Check out my latest blog post about content marketing!',
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        publishedAt: '2024-01-15T10:00:00Z',
        userId: 'test-user-id',
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.requiresReview).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.originalContent.id).toBe('soloboss-content-123');
      expect(result.originalContent.title).toBe('Test Blog Post');

      const post = result.posts[0];
      expect(post.userId).toBe('test-user-id');
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
        userId: 'test-user-id',
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      expect(post.content).toContain('Another Test Post');
      expect(post.content.length).toBeLessThanOrEqual(250); // Should be truncated
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
        userId: 'test-user-id',
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      
      expect(post.platformSpecificContent).toBeDefined();
      expect(post.platformSpecificContent?.x.content.length).toBeLessThanOrEqual(280);
      expect(post.platformSpecificContent?.instagram.hashtags?.length).toBeGreaterThan(0);
      expect(post.platformSpecificContent?.pinterest.images).toHaveLength(1);
    });
  });

  describe('Image Processing', () => {
    it('should process and filter invalid image URLs', async () => {
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
        userId: 'test-user-id',
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
  });

  describe('SEO Processing', () => {
    it('should extract hashtags from SEO suggestions', async () => {
      const webhookPayload: SoloBossWebhookPayload = {
        id: 'soloboss-content-127',
        title: 'SEO Test Post',
        content: 'Testing SEO processing',
        seoSuggestions: [
          'digital marketing strategies',
          'content creation tips',
          'social media optimization',
          'SEO best practices'
        ],
        socialMediaText: 'Testing SEO hashtag generation',
        images: [],
        publishedAt: '2024-01-15T14:00:00Z',
        userId: 'test-user-id',
        signature: 'webhook-signature'
      };

      const result = await soloBossService.processWebhookContent(webhookPayload);

      expect(result.posts).toHaveLength(1);
      const post = result.posts[0];
      
      // Should have generated hashtags from SEO suggestions
      expect(post.hashtags?.length).toBeGreaterThan(0);
      expect(post.hashtags?.some((tag: string) => tag.includes('marketing'))).toBe(true);
      expect(post.hashtags?.some((tag: string) => tag.includes('content'))).toBe(true);
    });
  });
});
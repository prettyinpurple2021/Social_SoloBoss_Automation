import { ContentTransformationService, TransformationContext } from '../services/ContentTransformationService';
import { IntegrationErrorService, IntegrationErrorType, ErrorSeverity } from '../services/IntegrationErrorService';
import { WebhookValidationService } from '../services/WebhookValidationService';
import { Platform } from '../types/database';
import { BloggerPost } from '../types/blogger';
import { SoloBossContent } from '../../../shared/src/types/post';

describe('Enhanced Integration Features', () => {
  let transformationService: ContentTransformationService;
  let errorService: IntegrationErrorService;
  let webhookValidationService: WebhookValidationService;

  beforeAll(() => {
    transformationService = ContentTransformationService.getInstance();
    errorService = IntegrationErrorService.getInstance();
    webhookValidationService = WebhookValidationService.getInstance();
  });

  describe('ContentTransformationService', () => {
    it('should transform blogger content with templates', async () => {
      const bloggerPost: BloggerPost = {
        id: 'test-blog-1',
        title: 'Test Blog Post',
        content: 'This is a test blog post content with some HTML <p>tags</p>.',
        url: 'https://example.com/test-post',
        publishedAt: new Date(),
        author: 'Test Author',
        excerpt: 'This is a test excerpt',
        categories: ['Technology', 'Web Development']
      };

      const context: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.FACEBOOK,
        sourceType: 'blogger',
        sourceData: bloggerPost
      };

      const result = await transformationService.transformContent(context);

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(result.hashtags).toBeInstanceOf(Array);
      expect(result.images).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
    });

    it('should transform SoloBoss content with AI optimization', async () => {
      const soloBossContent: SoloBossContent = {
        id: 'test-soloboss-1',
        title: 'AI Generated Content',
        content: 'This is AI-generated content for social media optimization.',
        seoSuggestions: ['social media', 'content marketing', 'AI optimization'],
        socialMediaText: 'Optimized social media text for engagement',
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        publishedAt: new Date()
      };

      const context: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.INSTAGRAM,
        sourceType: 'soloboss',
        sourceData: soloBossContent
      };

      const result = await transformationService.transformContent(context);

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(result.hashtags.length).toBeGreaterThan(0);
      expect(result.images.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    it('should optimize content for different platforms', async () => {
      const bloggerPost: BloggerPost = {
        id: 'test-blog-2',
        title: 'Long Blog Post Title That Exceeds Twitter Character Limits',
        content: 'This is a very long blog post content that would exceed Twitter character limits and needs to be truncated properly while maintaining readability and ensuring that the most important information is preserved.',
        url: 'https://example.com/long-post',
        publishedAt: new Date(),
        author: 'Test Author'
      };

      // Test Twitter optimization
      const twitterContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.X,
        sourceType: 'blogger',
        sourceData: bloggerPost
      };

      const twitterResult = await transformationService.transformContent(twitterContext);
      expect(twitterResult.content.length).toBeLessThanOrEqual(280);

      // Test Instagram optimization
      const instagramContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.INSTAGRAM,
        sourceType: 'blogger',
        sourceData: bloggerPost
      };

      const instagramResult = await transformationService.transformContent(instagramContext);
      expect(instagramResult.content.length).toBeLessThanOrEqual(2200);
    });

    it('should register and apply custom filters', () => {
      const customFilter = {
        name: 'test_filter',
        description: 'Test filter for unit testing',
        apply: (content: string) => content.toUpperCase()
      };

      transformationService.registerFilter(customFilter);
      const availableFilters = transformationService.getAvailableFilters();
      
      expect(availableFilters.some(filter => filter.name === 'test_filter')).toBe(true);
    });
  });

  describe('WebhookValidationService', () => {
    it('should validate webhook signatures correctly', async () => {
      const secret = 'test-webhook-secret';
      const payload = { test: 'data', timestamp: Date.now() };
      const rawBody = JSON.stringify(payload);
      
      // Create a valid signature
      const crypto = require('crypto');
      const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const webhookPayload = {
        headers: {
          'x-soloboss-signature': `sha256=${signature}`,
          'x-soloboss-event': 'content.created',
          'content-type': 'application/json'
        },
        body: payload,
        rawBody
      };

      const result = await webhookValidationService.validateSoloBossWebhook(
        webhookPayload,
        secret,
        'test-user-1'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid webhook signatures', async () => {
      const secret = 'test-webhook-secret';
      const payload = { test: 'data', timestamp: Date.now() };
      const rawBody = JSON.stringify(payload);

      const webhookPayload = {
        headers: {
          'x-soloboss-signature': 'sha256=invalid-signature',
          'x-soloboss-event': 'content.created',
          'content-type': 'application/json'
        },
        body: payload,
        rawBody
      };

      const result = await webhookValidationService.validateSoloBossWebhook(
        webhookPayload,
        secret,
        'test-user-1'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed webhook data', async () => {
      const malformedPayload = {
        headers: { 'content-type': 'application/json' },
        body: null,
        rawBody: 'invalid json {'
      };

      const result = await webhookValidationService.handleMalformedData(
        malformedPayload,
        'test-user-1',
        'soloboss'
      );

      expect(result.recovered).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Content Filters', () => {
    it('should apply built-in filters correctly', () => {
      const filters = transformationService.getAvailableFilters();
      
      // Test uppercase filter
      const uppercaseFilter = filters.find(f => f.name === 'uppercase');
      expect(uppercaseFilter).toBeDefined();
      expect(uppercaseFilter!.apply('test content')).toBe('TEST CONTENT');

      // Test truncate filter
      const truncateFilter = filters.find(f => f.name === 'truncate');
      expect(truncateFilter).toBeDefined();
      expect(truncateFilter!.apply('This is a long text', { length: 10 })).toBe('This is a ...');

      // Test HTML strip filter
      const stripHtmlFilter = filters.find(f => f.name === 'strip_html');
      expect(stripHtmlFilter).toBeDefined();
      expect(stripHtmlFilter!.apply('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    });
  });

  describe('Platform-specific optimizations', () => {
    it('should generate appropriate hashtags for different platforms', async () => {
      const soloBossContent: SoloBossContent = {
        id: 'test-hashtag-1',
        title: 'Social Media Marketing',
        content: 'Content about social media marketing strategies',
        seoSuggestions: ['marketing', 'social media', 'strategy', 'engagement'],
        socialMediaText: 'Learn effective social media marketing strategies',
        images: [],
        publishedAt: new Date()
      };

      // Instagram allows more hashtags
      const instagramContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.INSTAGRAM,
        sourceType: 'soloboss',
        sourceData: soloBossContent
      };

      const instagramResult = await transformationService.transformContent(instagramContext);

      // Twitter prefers fewer hashtags
      const twitterContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.X,
        sourceType: 'soloboss',
        sourceData: soloBossContent
      };

      const twitterResult = await transformationService.transformContent(twitterContext);

      // Instagram should have more hashtags than Twitter
      expect(instagramResult.hashtags.length).toBeGreaterThanOrEqual(twitterResult.hashtags.length);
    });

    it('should handle image limits for different platforms', async () => {
      const soloBossContent: SoloBossContent = {
        id: 'test-images-1',
        title: 'Multiple Images Test',
        content: 'Content with multiple images',
        seoSuggestions: ['images', 'content'],
        socialMediaText: 'Check out these images',
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
          'https://example.com/img3.jpg',
          'https://example.com/img4.jpg',
          'https://example.com/img5.jpg',
          'https://example.com/img6.jpg'
        ],
        publishedAt: new Date()
      };

      // Twitter has 4 image limit
      const twitterContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.X,
        sourceType: 'soloboss',
        sourceData: soloBossContent
      };

      const twitterResult = await transformationService.transformContent(twitterContext);
      expect(twitterResult.images.length).toBeLessThanOrEqual(4);

      // Pinterest typically uses 1 image
      const pinterestContext: TransformationContext = {
        userId: 'test-user-1',
        platform: Platform.PINTEREST,
        sourceType: 'soloboss',
        sourceData: soloBossContent
      };

      const pinterestResult = await transformationService.transformContent(pinterestContext);
      expect(pinterestResult.images.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Error handling and recovery', () => {
    it('should provide fallback transformation when templates fail', async () => {
      const invalidContext: TransformationContext = {
        userId: 'non-existent-user',
        platform: Platform.FACEBOOK,
        sourceType: 'blogger',
        sourceData: {} as BloggerPost // Invalid data
      };

      const result = await transformationService.transformContent(invalidContext);

      // Should still return a result with fallback
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metadata.defaultTransformation).toBe(true);
    });
  });
});

// Mock implementations for testing without database
jest.mock('../database', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [] })
  }
}));

jest.mock('../models/ContentTemplate', () => ({
  ContentTemplateModel: {
    findActiveTemplates: jest.fn().mockResolvedValue([]),
    getAvailableVariables: jest.fn().mockReturnValue([
      { name: 'title', description: 'Post title', required: false },
      { name: 'content', description: 'Post content', required: false }
    ])
  }
}));

jest.mock('../services/LoggerService', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/NotificationService', () => ({
  NotificationService: {
    getInstance: jest.fn().mockReturnValue({
      sendNotification: jest.fn().mockResolvedValue(true)
    })
  }
}));
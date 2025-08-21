import request from 'supertest';
import express from 'express';
import bloggerRoutes from '../routes/blogger';
import { BloggerService } from '../services/BloggerService';
import { Platform } from '../types/database';

// Mock the BloggerService
jest.mock('../services/BloggerService');
const mockBloggerService = BloggerService as jest.Mocked<typeof BloggerService>;

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/blogger', bloggerRoutes);

describe('Blogger Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/blogger/setup', () => {
    const validSetupData = {
      blogUrl: 'https://example.blogspot.com',
      autoApprove: false,
      defaultPlatforms: [Platform.FACEBOOK, Platform.X],
      customHashtags: ['tech', 'blog'],
      enabled: true
    };

    it('should setup blogger integration successfully', async () => {
      const mockIntegration = {
        id: 'integration-123',
        blog_url: validSetupData.blogUrl,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: validSetupData.autoApprove,
        default_platforms: validSetupData.defaultPlatforms,
        custom_hashtags: validSetupData.customHashtags,
        enabled: validSetupData.enabled,
        last_checked: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockBloggerService.setupBloggerIntegration.mockResolvedValue(mockIntegration as any);

      const response = await request(app)
        .post('/api/blogger/setup')
        .send(validSetupData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockIntegration.id);
      expect(response.body.data.blogUrl).toBe(validSetupData.blogUrl);
      expect(response.body.data.autoApprove).toBe(validSetupData.autoApprove);

      expect(mockBloggerService.setupBloggerIntegration).toHaveBeenCalledWith(
        'user-123',
        validSetupData
      );
    });

    it('should validate blog URL', async () => {
      const invalidData = {
        ...validSetupData,
        blogUrl: 'not-a-valid-url'
      };

      const response = await request(app)
        .post('/api/blogger/setup')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Valid blog URL is required'
          })
        ])
      );
    });

    it('should validate platform values', async () => {
      const invalidData = {
        ...validSetupData,
        defaultPlatforms: ['invalid-platform']
      };

      const response = await request(app)
        .post('/api/blogger/setup')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Invalid platform specified'
          })
        ])
      );
    });

    it('should handle service errors', async () => {
      mockBloggerService.setupBloggerIntegration.mockRejectedValue(
        new Error('RSS feed is not accessible')
      );

      const response = await request(app)
        .post('/api/blogger/setup')
        .send(validSetupData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('RSS feed is not accessible');
    });
  });

  describe('GET /api/blogger/settings', () => {
    it('should return blogger integration settings', async () => {
      const mockIntegration = {
        id: 'integration-123',
        blog_url: 'https://example.blogspot.com',
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: false,
        default_platforms: [Platform.FACEBOOK],
        custom_hashtags: ['tech'],
        enabled: true,
        last_checked: new Date('2023-01-01'),
        created_at: new Date(),
        updated_at: new Date()
      };

      mockBloggerService.getBloggerIntegration.mockResolvedValue(mockIntegration as any);

      const response = await request(app)
        .get('/api/blogger/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockIntegration.id);
      expect(response.body.data.blogUrl).toBe(mockIntegration.blog_url);
      expect(response.body.data.enabled).toBe(mockIntegration.enabled);

      expect(mockBloggerService.getBloggerIntegration).toHaveBeenCalledWith('user-123');
    });

    it('should return null when no integration exists', async () => {
      mockBloggerService.getBloggerIntegration.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/blogger/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('POST /api/blogger/test', () => {
    it('should test blogger integration and return recent posts', async () => {
      const mockRecentPosts = [
        {
          id: 'post-1',
          title: 'Recent Post 1',
          content: 'This is the full content of the first post...',
          excerpt: 'This is the first post...',
          url: 'https://example.blogspot.com/post-1',
          publishedAt: new Date('2023-01-02'),
          author: 'John Doe',
          categories: ['Tech']
        },
        {
          id: 'post-2',
          title: 'Recent Post 2',
          content: 'This is the full content of the second post...',
          excerpt: 'This is the second post...',
          url: 'https://example.blogspot.com/post-2',
          publishedAt: new Date('2023-01-01'),
          author: 'Jane Doe',
          categories: ['Programming']
        }
      ];

      mockBloggerService.testBloggerIntegration.mockResolvedValue(mockRecentPosts);

      const response = await request(app)
        .post('/api/blogger/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recentPosts).toHaveLength(2);
      expect(response.body.data.recentPosts[0].title).toBe('Recent Post 1');
      expect(response.body.data.recentPosts[1].title).toBe('Recent Post 2');

      expect(mockBloggerService.testBloggerIntegration).toHaveBeenCalledWith('user-123');
    });

    it('should handle test errors', async () => {
      mockBloggerService.testBloggerIntegration.mockRejectedValue(
        new Error('No blogger integration found for user')
      );

      const response = await request(app)
        .post('/api/blogger/test')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No blogger integration found for user');
    });
  });

  describe('POST /api/blogger/monitor', () => {
    it('should manually trigger monitoring and return results', async () => {
      const mockIntegration = {
        id: 'integration-123',
        enabled: true
      };

      const mockMonitorResult = {
        newPosts: [
          {
            id: 'post-1',
            title: 'New Post',
            content: 'Full content of the new post...',
            excerpt: 'New post excerpt...',
            url: 'https://example.blogspot.com/post-1',
            publishedAt: new Date('2023-01-02'),
            author: 'Test Author'
          }
        ],
        lastChecked: new Date(),
        error: undefined
      };

      mockBloggerService.getBloggerIntegration.mockResolvedValue(mockIntegration as any);
      mockBloggerService.monitorBloggerFeed.mockResolvedValue(mockMonitorResult);

      const response = await request(app)
        .post('/api/blogger/monitor')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newPostsFound).toBe(1);
      expect(response.body.data.newPosts).toHaveLength(1);
      expect(response.body.data.newPosts[0].title).toBe('New Post');

      expect(mockBloggerService.getBloggerIntegration).toHaveBeenCalledWith('user-123');
      expect(mockBloggerService.monitorBloggerFeed).toHaveBeenCalledWith(mockIntegration);
    });

    it('should return 404 when no integration found', async () => {
      mockBloggerService.getBloggerIntegration.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/blogger/monitor')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No blogger integration found');
    });

    it('should return 400 when integration is disabled', async () => {
      const mockIntegration = {
        id: 'integration-123',
        enabled: false
      };

      mockBloggerService.getBloggerIntegration.mockResolvedValue(mockIntegration as any);

      const response = await request(app)
        .post('/api/blogger/monitor')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Blogger integration is disabled');
    });
  });

  describe('POST /api/blogger/disable', () => {
    it('should disable blogger integration successfully', async () => {
      mockBloggerService.disableBloggerIntegration.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/blogger/disable')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Blogger integration disabled successfully');

      expect(mockBloggerService.disableBloggerIntegration).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 when no integration found', async () => {
      mockBloggerService.disableBloggerIntegration.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/blogger/disable')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No blogger integration found');
    });
  });
});
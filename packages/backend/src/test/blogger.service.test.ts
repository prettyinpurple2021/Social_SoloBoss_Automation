import { BloggerService } from '../services/BloggerService';
import { BloggerIntegrationModel } from '../models/BloggerIntegration';
import { PostService } from '../services/PostService';
import { Platform, PostSource } from '../types/database';
import axios from 'axios';

// Mock dependencies
jest.mock('../models/BloggerIntegration');
jest.mock('../services/PostService');
jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockBloggerIntegrationModel = BloggerIntegrationModel as jest.Mocked<typeof BloggerIntegrationModel>;
const mockPostService = PostService as jest.Mocked<typeof PostService>;

// Mock RSS Parser
const mockParseURL = jest.fn();
const mockParseString = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
    parseString: mockParseString
  }));
});

describe('BloggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupBloggerIntegration', () => {
    const userId = 'user-123';
    const settings = {
      blogUrl: 'https://example.blogspot.com',
      autoApprove: false,
      defaultPlatforms: [Platform.FACEBOOK, Platform.X],
      customHashtags: ['tech', 'blog'],
      enabled: true
    };

    it('should create new integration when none exists', async () => {
      const mockIntegration = {
        id: 'integration-123',
        user_id: userId,
        blog_url: settings.blogUrl,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(null);
      mockBloggerIntegrationModel.create.mockResolvedValue(mockIntegration);
      
      // Mock RSS feed validation
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseString.mockResolvedValue({});

      const result = await BloggerService.setupBloggerIntegration(userId, settings);

      expect(mockBloggerIntegrationModel.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockBloggerIntegrationModel.create).toHaveBeenCalledWith({
        user_id: userId,
        blog_url: settings.blogUrl,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled
      });
      expect(result).toEqual(mockIntegration);
    });

    it('should update existing integration', async () => {
      const existingIntegration = {
        id: 'integration-123',
        user_id: userId,
        blog_url: 'https://old-blog.com',
        rss_feed_url: 'https://old-blog.com/rss',
        auto_approve: true,
        default_platforms: [Platform.FACEBOOK],
        custom_hashtags: ['old'],
        enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      const updatedIntegration = {
        ...existingIntegration,
        blog_url: settings.blogUrl,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled
      };

      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(existingIntegration);
      mockBloggerIntegrationModel.update.mockResolvedValue(updatedIntegration);
      
      // Mock RSS feed validation
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseString.mockResolvedValue({});

      const result = await BloggerService.setupBloggerIntegration(userId, settings);

      expect(mockBloggerIntegrationModel.update).toHaveBeenCalledWith(existingIntegration.id, {
        blog_url: settings.blogUrl,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled
      });
      expect(result).toEqual(updatedIntegration);
    });

    it('should throw error for invalid RSS feed', async () => {
      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(null);
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(BloggerService.setupBloggerIntegration(userId, settings))
        .rejects.toThrow('Invalid or inaccessible RSS feed');
    });
  });

  describe('monitorBloggerFeed', () => {
    const integration = {
      id: 'integration-123',
      user_id: 'user-123',
      blog_url: 'https://example.blogspot.com',
      rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
      auto_approve: false,
      default_platforms: [Platform.FACEBOOK, Platform.X],
      custom_hashtags: ['tech', 'blog'],
      enabled: true,
      last_checked: new Date('2023-01-01'),
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should detect and process new posts', async () => {
      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'post-1',
            title: 'New Blog Post',
            content: 'This is the content of the new blog post.',
            contentSnippet: 'This is the content...',
            link: 'https://example.blogspot.com/post-1',
            pubDate: '2023-01-02T10:00:00Z',
            creator: 'John Doe',
            categories: ['Technology', 'Programming']
          },
          {
            guid: 'post-2',
            title: 'Old Blog Post',
            content: 'This is an old post.',
            link: 'https://example.blogspot.com/post-2',
            pubDate: '2022-12-31T10:00:00Z', // Before last_checked
            creator: 'John Doe'
          }
        ]
      };

      const mockCreatedPost = {
        id: 'created-post-123',
        user_id: integration.user_id,
        content: '📝 New blog post: New Blog Post\n\nThis is the content...\n\nRead more: https://example.blogspot.com/post-1',
        platforms: [Platform.FACEBOOK, Platform.X],
        status: 'draft',
        source: PostSource.BLOGGER,
        platformPosts: []
      };

      mockParseURL.mockResolvedValue(mockFeed);
      mockPostService.createPost.mockResolvedValue(mockCreatedPost as any);

      const result = await BloggerService.monitorBloggerFeed(integration);

      expect(mockParseURL).toHaveBeenCalledWith(integration.rss_feed_url);
      expect(result.newPosts).toHaveLength(1);
      expect(result.newPosts[0].title).toBe('New Blog Post');
      expect(result.newPosts[0].url).toBe('https://example.blogspot.com/post-1');
      
      expect(mockPostService.createPost).toHaveBeenCalledWith(
        integration.user_id,
        expect.objectContaining({
          content: expect.stringContaining('New Blog Post'),
          hashtags: expect.arrayContaining(['tech', 'blog', 'technology', 'programming']),
          platforms: [Platform.FACEBOOK, Platform.X],
          source: PostSource.BLOGGER,
          scheduledTime: undefined // Should be undefined since auto_approve is false
        })
      );
    });

    it('should schedule posts immediately when auto_approve is enabled', async () => {
      const autoApproveIntegration = {
        ...integration,
        auto_approve: true
      };

      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'post-1',
            title: 'New Blog Post',
            content: 'Content',
            link: 'https://example.blogspot.com/post-1',
            pubDate: '2023-01-02T10:00:00Z',
            creator: 'John Doe'
          }
        ]
      };

      mockParseURL.mockResolvedValue(mockFeed);
      mockPostService.createPost.mockResolvedValue({} as any);

      await BloggerService.monitorBloggerFeed(autoApproveIntegration);

      expect(mockPostService.createPost).toHaveBeenCalledWith(
        autoApproveIntegration.user_id,
        expect.objectContaining({
          scheduledTime: expect.any(Date) // Should have a scheduled time for immediate posting
        })
      );
    });

    it('should handle RSS parsing errors', async () => {
      mockParseURL.mockRejectedValue(new Error('RSS parsing failed'));

      await expect(BloggerService.monitorBloggerFeed(integration))
        .rejects.toThrow('Failed to monitor blogger feed: RSS parsing failed');
    });
  });

  describe('generateRssFeedUrl', () => {
    it('should generate correct RSS URL for Blogger/Blogspot', () => {
      const blogUrl = 'https://example.blogspot.com';
      const rssFeedUrl = (BloggerService as any).generateRssFeedUrl(blogUrl);
      expect(rssFeedUrl).toBe('https://example.blogspot.com/feeds/posts/default');
    });

    it('should generate correct RSS URL for WordPress.com', () => {
      const blogUrl = 'https://example.wordpress.com';
      const rssFeedUrl = (BloggerService as any).generateRssFeedUrl(blogUrl);
      expect(rssFeedUrl).toBe('https://example.wordpress.com/feed/');
    });

    it('should generate correct RSS URL for Medium', () => {
      const blogUrl = 'https://medium.com/@username';
      const rssFeedUrl = (BloggerService as any).generateRssFeedUrl(blogUrl);
      expect(rssFeedUrl).toBe('https://medium.com/@username/feed');
    });

    it('should generate generic RSS URL for other platforms', () => {
      const blogUrl = 'https://example.com/blog';
      const rssFeedUrl = (BloggerService as any).generateRssFeedUrl(blogUrl);
      expect(rssFeedUrl).toBe('https://example.com/blog/rss');
    });
  });

  describe('extractExcerpt', () => {
    it('should extract plain text from HTML content', () => {
      const htmlContent = '<p>This is a <strong>test</strong> paragraph with <a href="#">links</a>.</p>';
      const excerpt = (BloggerService as any).extractExcerpt(htmlContent);
      expect(excerpt).toBe('This is a test paragraph with links.');
    });

    it('should truncate long content at sentence boundaries', () => {
      const longContent = 'This is the first sentence. This is the second sentence. This is a very long third sentence that goes on and on and should be truncated.';
      const excerpt = (BloggerService as any).extractExcerpt(longContent, 50);
      expect(excerpt).toBe('This is the first sentence.');
    });

    it('should truncate at word boundaries when no sentence break found', () => {
      const longContent = 'This is a very long paragraph without any sentence breaks that should be truncated at word boundaries';
      const excerpt = (BloggerService as any).extractExcerpt(longContent, 50);
      expect(excerpt).toMatch(/\.\.\.$|..$/);
      expect(excerpt.length).toBeLessThanOrEqual(53); // 50 + '...'
    });
  });

  describe('testBloggerIntegration', () => {
    it('should return recent posts for testing', async () => {
      const userId = 'user-123';
      const integration = {
        id: 'integration-123',
        user_id: userId,
        rss_feed_url: 'https://example.blogspot.com/feeds/posts/default',
        enabled: true
      };

      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'post-1',
            title: 'Recent Post 1',
            content: 'Content 1',
            contentSnippet: 'Snippet 1',
            link: 'https://example.blogspot.com/post-1',
            pubDate: '2023-01-02T10:00:00Z',
            creator: 'John Doe',
            categories: ['Tech']
          },
          {
            guid: 'post-2',
            title: 'Recent Post 2',
            content: 'Content 2',
            link: 'https://example.blogspot.com/post-2',
            pubDate: '2023-01-01T10:00:00Z',
            creator: 'Jane Doe'
          }
        ]
      };

      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(integration as any);
      mockParseURL.mockResolvedValue(mockFeed);

      const result = await BloggerService.testBloggerIntegration(userId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Recent Post 1');
      expect(result[0].excerpt).toBe('Snippet 1');
      expect(result[1].title).toBe('Recent Post 2');
    });

    it('should throw error when no integration found', async () => {
      const userId = 'user-123';
      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(null);

      await expect(BloggerService.testBloggerIntegration(userId))
        .rejects.toThrow('No blogger integration found for user');
    });
  });
});

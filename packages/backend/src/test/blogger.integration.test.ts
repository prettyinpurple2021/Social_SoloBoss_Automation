import { BloggerService } from '../services/BloggerService';
import { BloggerIntegrationModel } from '../models/BloggerIntegration';
import { PostService } from '../services/PostService';
import { Platform, PostSource } from '../types/database';
import { db } from '../database';

// Mock external dependencies
jest.mock('axios');
jest.mock('rss-parser');



const mockParseURL = jest.fn();
const mockParseString = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
    parseString: mockParseString
  }));
});

describe('Blogger Integration Tests', () => {
  const testUserId = 'test-user-123';
  const testBlogUrl = 'https://test-blog.blogspot.com';

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Clean up test data
    await db.query('DELETE FROM blogger_integrations WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM posts WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM blogger_integrations WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM posts WHERE user_id = $1', [testUserId]);
  });

  describe('End-to-End Blogger Integration Workflow', () => {
    it('should complete full workflow: setup -> monitor -> generate posts', async () => {
      // Step 1: Setup blogger integration
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: false,
        defaultPlatforms: [Platform.FACEBOOK, Platform.X],
        customHashtags: ['tech', 'blog'],
        enabled: true
      };

      // Mock RSS feed validation
      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      expect(integration).toBeDefined();
      expect(integration.user_id).toBe(testUserId);
      expect(integration.blog_url).toBe(testBlogUrl);
      expect(integration.enabled).toBe(true);

      // Step 2: Mock RSS feed with new posts
      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'post-1',
            title: 'How to Build a REST API',
            content: '<p>This is a comprehensive guide on building REST APIs with Node.js and Express...</p>',
            contentSnippet: 'This is a comprehensive guide on building REST APIs...',
            link: 'https://test-blog.blogspot.com/2023/01/rest-api-guide',
            pubDate: new Date().toISOString(), // Recent post
            creator: 'John Developer',
            categories: ['Programming', 'Node.js', 'API']
          },
          {
            guid: 'post-2',
            title: 'Understanding Database Indexing',
            content: '<p>Database indexing is crucial for performance...</p>',
            contentSnippet: 'Database indexing is crucial for performance...',
            link: 'https://test-blog.blogspot.com/2023/01/database-indexing',
            pubDate: new Date().toISOString(),
            creator: 'Jane Database',
            categories: ['Database', 'Performance']
          }
        ]
      };

      mockParseURL.parseURL.mockResolvedValue(mockFeed);

      // Step 3: Monitor the feed
      const monitorResult = await BloggerService.monitorBloggerFeed(integration);

      expect(monitorResult.newPosts).toHaveLength(2);
      expect(monitorResult.newPosts[0].title).toBe('How to Build a REST API');
      expect(monitorResult.newPosts[1].title).toBe('Understanding Database Indexing');

      // Step 4: Verify posts were created in the database
      const userPosts = await PostService.getUserPosts(testUserId);

      expect(userPosts).toHaveLength(2);
      
      const restApiPost = userPosts.find(post => post.content.includes('REST API'));
      expect(restApiPost).toBeDefined();
      expect(restApiPost!.source).toBe(PostSource.BLOGGER);
      expect(restApiPost!.platforms).toEqual(expect.arrayContaining([Platform.FACEBOOK, Platform.X]));
      expect(restApiPost!.hashtags).toEqual(expect.arrayContaining(['tech', 'blog', 'programming', 'nodejs', 'api']));
      expect(restApiPost!.status).toBe('draft'); // Should be draft since auto_approve is false

      const databasePost = userPosts.find(post => post.content.includes('Database Indexing'));
      expect(databasePost).toBeDefined();
      expect(databasePost!.source).toBe(PostSource.BLOGGER);
      expect(databasePost!.hashtags).toEqual(expect.arrayContaining(['tech', 'blog', 'database', 'performance']));
    });

    it('should auto-approve and schedule posts when enabled', async () => {
      // Setup integration with auto-approve enabled
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: true,
        defaultPlatforms: [Platform.FACEBOOK],
        customHashtags: ['autoblog'],
        enabled: true
      };

      // Mock RSS feed validation
      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      // Mock RSS feed with new post
      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'auto-post-1',
            title: 'Auto-Approved Post',
            content: '<p>This post should be auto-approved...</p>',
            contentSnippet: 'This post should be auto-approved...',
            link: 'https://test-blog.blogspot.com/2023/01/auto-approved',
            pubDate: new Date().toISOString(),
            creator: 'Auto Author'
          }
        ]
      };

      mockParseURL.parseURL.mockResolvedValue(mockFeed);

      // Monitor the feed
      await BloggerService.monitorBloggerFeed(integration);

      // Verify post was created with scheduled time (for immediate posting)
      const userPosts = await PostService.getUserPosts(testUserId);
      const autoPost = userPosts.find(post => post.content.includes('Auto-Approved Post'));

      expect(autoPost).toBeDefined();
      expect(autoPost!.scheduled_time).toBeDefined();
      expect(autoPost!.scheduled_time).toBeInstanceOf(Date);
    });

    it('should handle duplicate posts correctly', async () => {
      // Setup integration
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: false,
        defaultPlatforms: [Platform.FACEBOOK],
        customHashtags: ['test'],
        enabled: true
      };

      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'duplicate-post',
            title: 'Duplicate Post Test',
            content: '<p>This is a test post...</p>',
            link: 'https://test-blog.blogspot.com/2023/01/duplicate',
            pubDate: new Date().toISOString(),
            creator: 'Test Author'
          }
        ]
      };

      mockParseURL.parseURL.mockResolvedValue(mockFeed);

      // First monitoring run
      await BloggerService.monitorBloggerFeed(integration);
      let userPosts = await PostService.getUserPosts(testUserId);
      expect(userPosts).toHaveLength(1);

      // Update last_checked to simulate time passing
      await BloggerIntegrationModel.updateLastChecked(integration.id, new Date(Date.now() - 60000));

      // Second monitoring run with same post (should not create duplicate)
      await BloggerService.monitorBloggerFeed(integration);
      userPosts = await PostService.getUserPosts(testUserId);
      expect(userPosts).toHaveLength(1); // Should still be 1, no duplicates
    });

    it('should handle RSS feed errors gracefully', async () => {
      // Setup integration
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: false,
        defaultPlatforms: [Platform.FACEBOOK],
        customHashtags: ['test'],
        enabled: true
      };

      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      // Mock RSS parsing error
      mockParseURL.parseURL.mockRejectedValue(new Error('Network timeout'));

      // Monitor should throw error
      await expect(BloggerService.monitorBloggerFeed(integration))
        .rejects.toThrow('Failed to monitor blogger feed: Network timeout');

      // Verify no posts were created
      const userPosts = await PostService.getUserPosts(testUserId);
      expect(userPosts).toHaveLength(0);
    });
  });

  describe('Content Generation Tests', () => {
    it('should generate appropriate content for different platforms', async () => {
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: false,
        defaultPlatforms: [Platform.X, Platform.FACEBOOK, Platform.INSTAGRAM],
        customHashtags: ['tech'],
        enabled: true
      };

      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'long-post',
            title: 'This is a Very Long Blog Post Title That Might Need Truncation for Some Social Media Platforms',
            content: '<p>This is a very long blog post content that goes on and on with lots of details about various technical topics including programming, databases, APIs, and much more content that would exceed Twitter character limits...</p>',
            contentSnippet: 'This is a very long blog post content that goes on and on...',
            link: 'https://test-blog.blogspot.com/2023/01/long-post',
            pubDate: new Date().toISOString(),
            creator: 'Verbose Author',
            categories: ['Programming', 'Technical Writing']
          }
        ]
      };

      mockParseURL.parseURL.mockResolvedValue(mockFeed);

      await BloggerService.monitorBloggerFeed(integration);

      const userPosts = await PostService.getUserPosts(testUserId);
      expect(userPosts).toHaveLength(1);

      const post = userPosts[0];
      expect(post.content).toContain('📝 New blog post:');
      expect(post.content).toContain('Read more:');
      expect(post.hashtags).toEqual(expect.arrayContaining(['tech', 'programming', 'technicalwriting']));

      // Verify platform-specific posts were created
      expect(post.platformPosts).toHaveLength(3);
      expect(post.platformPosts.map(pp => pp.platform)).toEqual(
        expect.arrayContaining([Platform.X, Platform.FACEBOOK, Platform.INSTAGRAM])
      );
    });

    it('should extract meaningful excerpts from HTML content', async () => {
      const integrationSettings = {
        blogUrl: testBlogUrl,
        autoApprove: false,
        defaultPlatforms: [Platform.FACEBOOK],
        customHashtags: [],
        enabled: true
      };

      const axios = require('axios');
      axios.get.mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><rss><channel><title>Test Blog</title></channel></rss>'
      });
      mockParseURL.parseString.mockResolvedValue({});

      const integration = await BloggerService.setupBloggerIntegration(testUserId, integrationSettings);

      const mockFeed = {
        title: 'Test Blog',
        items: [
          {
            guid: 'html-post',
            title: 'HTML Content Test',
            content: '<h1>Introduction</h1><p>This is the <strong>first paragraph</strong> with <em>formatting</em>.</p><p>This is the second paragraph with <a href="https://example.com">a link</a>.</p><script>alert("malicious");</script>',
            link: 'https://test-blog.blogspot.com/2023/01/html-content',
            pubDate: new Date().toISOString(),
            creator: 'HTML Author'
          }
        ]
      };

      mockParseURL.parseURL.mockResolvedValue(mockFeed);

      await BloggerService.monitorBloggerFeed(integration);

      const userPosts = await PostService.getUserPosts(testUserId);
      const post = userPosts[0];

      // Verify HTML was stripped and content is clean
      expect(post.content).not.toContain('<script>');
      expect(post.content).not.toContain('<h1>');
      expect(post.content).not.toContain('<strong>');
      expect(post.content).toContain('Introduction');
      expect(post.content).toContain('first paragraph');
      expect(post.content).toContain('formatting');
    });
  });
});

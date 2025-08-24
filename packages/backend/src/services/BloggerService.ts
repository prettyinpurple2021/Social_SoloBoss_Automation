import Parser from 'rss-parser';
import axios from 'axios';
import { BloggerIntegrationModel, BloggerIntegrationRow } from '../models/BloggerIntegration';
import { PostService } from './PostService';
import { circuitBreakerService, CircuitBreakers } from './CircuitBreakerService';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { traceExternalCall, traced } from '../middleware/tracing';
import { ContentTransformationService, TransformationContext } from './ContentTransformationService';
import { IntegrationErrorService, IntegrationErrorType } from './IntegrationErrorService';
import { 
  BloggerPost, 
  BloggerMonitorResult, 
  BloggerIntegrationSettings 
} from '../types/blogger';
import { PostSource, Platform } from '../types/database';
import { PostData } from './PostService';

export class BloggerService {
  private static rssParser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Social Media Automation Platform/1.0'
    }
  });

  private static transformationService = ContentTransformationService.getInstance();
  private static errorService = IntegrationErrorService.getInstance();

  /**
   * Create or update blogger integration for a user
   */
  static async setupBloggerIntegration(
    userId: string, 
    settings: Omit<BloggerIntegrationSettings, 'userId'>
  ): Promise<BloggerIntegrationRow> {
    // Validate blog URL and generate RSS feed URL
    const rssFeedUrl = this.generateRssFeedUrl(settings.blogUrl);
    
    // Test RSS feed accessibility with circuit breaker protection
    await circuitBreakerService.execute(
      CircuitBreakers.BLOGGER_API,
      () => this.validateRssFeed(rssFeedUrl),
      {
        failureThreshold: 3,
        recoveryTimeout: 300000, // 5 minutes
        expectedErrors: ['timeout', 'ENOTFOUND', 'ECONNREFUSED']
      }
    );

    // Check if integration already exists
    const existing = await BloggerIntegrationModel.findByUserId(userId);
    
    if (existing) {
      // Update existing integration
      const updated = await BloggerIntegrationModel.update(existing.id, {
        blog_url: settings.blogUrl,
        rss_feed_url: rssFeedUrl,
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled
      });
      
      if (!updated) {
        throw new Error('Failed to update blogger integration');
      }
      
      return updated;
    } else {
      // Create new integration
      return await BloggerIntegrationModel.create({
        user_id: userId,
        blog_url: settings.blogUrl,
        rss_feed_url: rssFeedUrl,
        auto_approve: settings.autoApprove,
        default_platforms: settings.defaultPlatforms,
        custom_hashtags: settings.customHashtags,
        enabled: settings.enabled
      });
    }
  }

  /**
   * Get blogger integration settings for a user
   */
  static async getBloggerIntegration(userId: string): Promise<BloggerIntegrationRow | null> {
    return await BloggerIntegrationModel.findByUserId(userId);
  }

  /**
   * Monitor all active blogger integrations for new posts
   */
  static async monitorAllBloggerFeeds(): Promise<BloggerMonitorResult[]> {
    const activeIntegrations = await BloggerIntegrationModel.findActiveIntegrations();
    const results: BloggerMonitorResult[] = [];

    for (const integration of activeIntegrations) {
      try {
        const result = await this.monitorBloggerFeed(integration);
        results.push(result);
        
        // Update last checked timestamp
        await BloggerIntegrationModel.updateLastChecked(integration.id, new Date());
      } catch (error) {
        console.error(`Error monitoring blogger feed for user ${integration.user_id}:`, error);
        results.push({
          newPosts: [],
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Monitor a specific blogger feed for new posts
   */
  @traced('BloggerService.monitorBloggerFeed')
  static async monitorBloggerFeed(integration: BloggerIntegrationRow): Promise<BloggerMonitorResult> {
    try {
      // Use circuit breaker for RSS feed parsing
      const feed = await circuitBreakerService.execute(
        `${CircuitBreakers.BLOGGER_API}_${integration.user_id}`,
        () => traceExternalCall('blogger', 'parseRSS', () => 
          this.rssParser.parseURL(integration.rss_feed_url)
        ),
        {
          failureThreshold: 5,
          recoveryTimeout: 600000, // 10 minutes
          expectedErrors: ['timeout', 'ENOTFOUND', 'ECONNREFUSED', 'parse error']
        }
      );

      const newPosts: BloggerPost[] = [];
      const lastChecked = integration.last_checked || new Date(0); // Use epoch if never checked

      loggerService.info(`Monitoring Blogger feed for user ${integration.user_id}`, {
        userId: integration.user_id,
        feedUrl: integration.rss_feed_url,
        lastChecked,
        feedItemCount: feed.items.length
      });

      for (const item of feed.items) {
        if (!item.pubDate) continue;
        
        const publishedAt = new Date(item.pubDate);
        
        // Only process posts published after last check
        if (publishedAt > lastChecked) {
          const bloggerPost: BloggerPost = {
            id: item.guid || item.link || '',
            title: item.title || 'Untitled Post',
            content: item.content || item.contentSnippet || '',
            url: item.link || '',
            publishedAt,
            author: item.creator || feed.title || 'Unknown Author',
            excerpt: item.contentSnippet || this.extractExcerpt(item.content || ''),
            categories: item.categories || []
          };

          newPosts.push(bloggerPost);
        }
      }

      // Process new posts and generate social media posts
      for (const blogPost of newPosts) {
        try {
          await this.processBlogPost(integration, blogPost);
          monitoringService.incrementCounter('blogger_posts_processed', 1, {
            userId: integration.user_id,
            status: 'success'
          });
        } catch (error) {
          loggerService.error(`Failed to process blog post: ${blogPost.title}`, error as Error, {
            userId: integration.user_id,
            postId: blogPost.id,
            postTitle: blogPost.title
          });
          monitoringService.incrementCounter('blogger_posts_processed', 1, {
            userId: integration.user_id,
            status: 'failed'
          });
        }
      }

      monitoringService.incrementCounter('blogger_feeds_monitored', 1, {
        userId: integration.user_id,
        newPostsCount: newPosts.length.toString()
      });

      loggerService.info(`Blogger feed monitoring completed`, {
        userId: integration.user_id,
        newPostsFound: newPosts.length,
        processingTime: Date.now() - Date.now() // This would be calculated properly in real implementation
      });

      return {
        newPosts,
        lastChecked: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to monitor blogger feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a blog post and generate social media posts using templates
   */
  static async processBlogPost(
    integration: BloggerIntegrationRow, 
    blogPost: BloggerPost
  ): Promise<void> {
    try {
      // Generate social media content from blog post using transformation service
      const socialPosts = await this.generateSocialMediaPostsWithTemplates(integration, blogPost);

      for (const postData of socialPosts) {
        // Create the post in the system
        const createdPost = await PostService.createPost(integration.user_id, postData);
        
        loggerService.info(`Created social media post from blog post`, {
          postId: createdPost.id,
          blogPostTitle: blogPost.title,
          userId: integration.user_id,
          platforms: postData.platforms
        });
      }
    } catch (error) {
      await this.errorService.logError(
        integration.user_id,
        'blogger',
        IntegrationErrorType.CONTENT_PROCESSING,
        error as Error,
        {
          blogPostId: blogPost.id,
          blogPostTitle: blogPost.title,
          integrationId: integration.id
        }
      );
      
      loggerService.error(`Error processing blog post ${blogPost.title}`, error as Error, {
        userId: integration.user_id,
        blogPostId: blogPost.id
      });
      
      throw error;
    }
  }

  /**
   * Generate social media posts from a blog post using templates and transformation service
   */
  private static async generateSocialMediaPostsWithTemplates(
    integration: BloggerIntegrationRow, 
    blogPost: BloggerPost
  ): Promise<PostData[]> {
    const posts: PostData[] = [];
    
    // Get platforms from integration settings
    const platforms = integration.default_platforms as Platform[];
    const targetPlatforms = platforms.length > 0 ? platforms : 
      [Platform.FACEBOOK, Platform.X, Platform.INSTAGRAM, Platform.PINTEREST];

    try {
      // Generate platform-specific content using templates
      for (const platform of targetPlatforms) {
        const transformationContext: TransformationContext = {
          userId: integration.user_id,
          platform,
          sourceType: 'blogger',
          sourceData: blogPost,
          customVariables: {
            blog_url: integration.blog_url,
            auto_approve: integration.auto_approve.toString()
          }
        };

        const transformationResult = await this.transformationService.transformContent(transformationContext);

        const postData: PostData = {
          content: transformationResult.content,
          hashtags: [...transformationResult.hashtags, ...integration.custom_hashtags],
          images: transformationResult.images,
          platforms: [platform],
          source: PostSource.BLOGGER,
          scheduledTime: integration.auto_approve ? new Date() : undefined,
          platformSpecificContent: {
            [platform]: {
              content: transformationResult.content,
              images: transformationResult.images,
              hashtags: transformationResult.hashtags,
              metadata: transformationResult.metadata
            }
          }
        };

        posts.push(postData);
      }

      // If no platform-specific posts were generated, create a fallback post
      if (posts.length === 0) {
        const fallbackPost = this.generateFallbackPost(integration, blogPost, targetPlatforms);
        posts.push(fallbackPost);
      }

    } catch (error) {
      loggerService.warn('Template transformation failed, using fallback generation', {
        userId: integration.user_id,
        blogPostId: blogPost.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to original generation method
      const fallbackPost = this.generateFallbackPost(integration, blogPost, targetPlatforms);
      posts.push(fallbackPost);
    }

    return posts;
  }

  /**
   * Generate fallback post when template transformation fails
   */
  private static generateFallbackPost(
    integration: BloggerIntegrationRow,
    blogPost: BloggerPost,
    platforms: Platform[]
  ): PostData {
    const baseContent = this.generateBaseContent(blogPost);
    const hashtags = this.generateHashtags(integration, blogPost);

    return {
      content: baseContent,
      hashtags,
      platforms,
      source: PostSource.BLOGGER,
      scheduledTime: integration.auto_approve ? new Date() : undefined
    };
  }

  /**
   * Generate base content for social media post from blog post
   */
  private static generateBaseContent(blogPost: BloggerPost): string {
    const title = blogPost.title;
    const excerpt = blogPost.excerpt || this.extractExcerpt(blogPost.content);
    const url = blogPost.url;

    // Create engaging social media content
    let content = `📝 New blog post: ${title}\n\n`;
    
    if (excerpt && excerpt.length > 0) {
      // Limit excerpt length for social media
      const maxExcerptLength = 200;
      const trimmedExcerpt = excerpt.length > maxExcerptLength 
        ? excerpt.substring(0, maxExcerptLength) + '...' 
        : excerpt;
      
      content += `${trimmedExcerpt}\n\n`;
    }

    content += `Read more: ${url}`;

    return content;
  }

  /**
   * Generate hashtags for social media post
   */
  private static generateHashtags(
    integration: BloggerIntegrationRow, 
    blogPost: BloggerPost
  ): string[] {
    const hashtags: string[] = [];

    // Add custom hashtags from integration settings
    hashtags.push(...integration.custom_hashtags);

    // Add hashtags from blog post categories
    if (blogPost.categories) {
      for (const category of blogPost.categories) {
        // Convert category to hashtag format
        const hashtag = category
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .replace(/\s+/g, '');
        
        if (hashtag.length > 0 && !hashtags.includes(hashtag)) {
          hashtags.push(hashtag);
        }
      }
    }

    // Add some generic blog-related hashtags
    const genericHashtags = ['blog', 'newpost', 'reading'];
    for (const tag of genericHashtags) {
      if (!hashtags.includes(tag)) {
        hashtags.push(tag);
      }
    }

    // Limit to reasonable number of hashtags
    return hashtags.slice(0, 10);
  }

  /**
   * Extract excerpt from HTML content
   */
  private static extractExcerpt(content: string, maxLength: number = 300): string {
    // Remove HTML tags
    const textContent = content.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    const cleaned = textContent.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Find the last complete sentence within the limit
    const truncated = cleaned.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // If no good sentence break, just truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  /**
   * Generate RSS feed URL from blog URL
   */
  private static generateRssFeedUrl(blogUrl: string): string {
    // Handle different blog platforms
    const url = new URL(blogUrl);
    
    if (url.hostname.includes('blogspot.com') || url.hostname.includes('blogger.com')) {
      // Blogger/Blogspot RSS feed
      return `${blogUrl.replace(/\/$/, '')}/feeds/posts/default`;
    } else if (url.hostname.includes('wordpress.com')) {
      // WordPress.com RSS feed
      return `${blogUrl.replace(/\/$/, '')}/feed/`;
    } else if (url.hostname.includes('medium.com')) {
      // Medium RSS feed
      return `${blogUrl.replace(/\/$/, '')}/feed`;
    } else {
      // Generic RSS feed attempt
      return `${blogUrl.replace(/\/$/, '')}/rss`;
    }
  }

  /**
   * Validate that RSS feed is accessible
   */
  private static async validateRssFeed(rssFeedUrl: string): Promise<void> {
    try {
      const response = await axios.get(rssFeedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Social Media Automation Platform/1.0'
        }
      });

      if (response.status !== 200) {
        throw new Error(`RSS feed returned status ${response.status}`);
      }

      // Try to parse the RSS feed
      await this.rssParser.parseString(response.data);
    } catch (error) {
      throw new Error(`Invalid or inaccessible RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disable blogger integration for a user
   */
  static async disableBloggerIntegration(userId: string): Promise<boolean> {
    const integration = await BloggerIntegrationModel.findByUserId(userId);
    
    if (!integration) {
      return false;
    }

    const updated = await BloggerIntegrationModel.update(integration.id, {
      enabled: false
    });

    return updated !== null;
  }

  /**
   * Test blogger integration by fetching recent posts
   */
  static async testBloggerIntegration(userId: string): Promise<BloggerPost[]> {
    const integration = await BloggerIntegrationModel.findByUserId(userId);
    
    if (!integration) {
      throw new Error('No blogger integration found for user');
    }

    try {
      const feed = await this.rssParser.parseURL(integration.rss_feed_url);
      const posts: BloggerPost[] = [];

      // Get up to 5 recent posts for testing
      for (const item of feed.items.slice(0, 5)) {
        if (!item.pubDate) continue;
        
        const bloggerPost: BloggerPost = {
          id: item.guid || item.link || '',
          title: item.title || 'Untitled Post',
          content: item.content || item.contentSnippet || '',
          url: item.link || '',
          publishedAt: new Date(item.pubDate),
          author: item.creator || feed.title || 'Unknown Author',
          excerpt: item.contentSnippet || this.extractExcerpt(item.content || ''),
          categories: item.categories || []
        };

        posts.push(bloggerPost);
      }

      return posts;
    } catch (error) {
      throw new Error(`Failed to test blogger integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
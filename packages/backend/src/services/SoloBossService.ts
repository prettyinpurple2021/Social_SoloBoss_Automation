import { Pool } from 'pg';
import crypto from 'crypto';
import { SoloBossIntegration } from '../models/SoloBossIntegration';
import { EncryptionService } from './EncryptionService';
import { PostService } from './PostService';
import { ContentTransformationService, TransformationContext } from './ContentTransformationService';
import { IntegrationErrorService, IntegrationErrorType } from './IntegrationErrorService';
import { WebhookValidationService, WebhookPayload } from './WebhookValidationService';
import { loggerService } from './LoggerService';
import { 
  SoloBossWebhookPayload, 
  SoloBossConnectionRequest, 
  SoloBossConnectionResult 
} from '../types/soloboss';
import { SoloBossContent, ProcessedContent, PostData } from '../../../shared/src/types/post';
import { PostSource } from '../../../shared/src/types/post';
import { Platform } from '../types/database';

export class SoloBossService {
  private soloBossIntegration: SoloBossIntegration;
  private transformationService: ContentTransformationService;
  private errorService: IntegrationErrorService;
  private webhookValidationService: WebhookValidationService;

  constructor(
    private db: Pool
  ) {
    this.soloBossIntegration = new SoloBossIntegration(db);
    this.transformationService = ContentTransformationService.getInstance();
    this.errorService = IntegrationErrorService.getInstance();
    this.webhookValidationService = WebhookValidationService.getInstance();
  }

  async connectSoloBoss(userId: string, request: SoloBossConnectionRequest): Promise<SoloBossConnectionResult> {
    try {
      // Validate API key format (basic validation)
      if (!request.apiKey || request.apiKey.length < 10) {
        return {
          success: false,
          error: 'Invalid API key format'
        };
      }

      if (!request.webhookSecret || request.webhookSecret.length < 16) {
        return {
          success: false,
          error: 'Webhook secret must be at least 16 characters'
        };
      }

      // Check if user already has an active integration
      const existing = await this.soloBossIntegration.findByUserId(userId);
      if (existing) {
        // Update existing integration
        await this.soloBossIntegration.update(userId, {
          apiKey: request.apiKey,
          webhookSecret: request.webhookSecret,
          isActive: true
        });
      } else {
        // Create new integration
        await this.soloBossIntegration.create(userId, request.apiKey, request.webhookSecret);
      }

      const config = await this.soloBossIntegration.findByUserId(userId);
      
      return {
        success: true,
        configId: config?.id
      };
    } catch (error) {
      console.error('Error connecting SoloBoss:', error);
      return {
        success: false,
        error: 'Failed to connect SoloBoss integration'
      };
    }
  }

  async disconnectSoloBoss(userId: string): Promise<boolean> {
    try {
      return await this.soloBossIntegration.delete(userId);
    } catch (error) {
      console.error('Error disconnecting SoloBoss:', error);
      return false;
    }
  }

  async verifyWebhookSignature(
    webhookPayload: WebhookPayload, 
    userId: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const webhookSecret = await this.soloBossIntegration.getDecryptedWebhookSecret(userId);
      if (!webhookSecret) {
        await this.errorService.logError(
          userId,
          'soloboss',
          IntegrationErrorType.AUTHENTICATION,
          'Webhook secret not found for user',
          { userId }
        );
        return { isValid: false, error: 'Webhook secret not configured' };
      }

      const validationResult = await this.webhookValidationService.validateSoloBossWebhook(
        webhookPayload,
        webhookSecret,
        userId
      );

      if (!validationResult.isValid) {
        loggerService.warn('SoloBoss webhook validation failed', {
          userId,
          error: validationResult.error,
          errorType: validationResult.errorType
        });
      }

      return {
        isValid: validationResult.isValid,
        error: validationResult.error
      };

    } catch (error) {
      await this.errorService.logError(
        userId,
        'soloboss',
        IntegrationErrorType.WEBHOOK_VALIDATION,
        error as Error,
        { userId }
      );

      return { 
        isValid: false, 
        error: `Webhook verification error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async processWebhookContent(payload: SoloBossWebhookPayload): Promise<ProcessedContent> {
    try {
      loggerService.info('Processing SoloBoss webhook content', {
        userId: payload.userId,
        contentId: payload.id,
        title: payload.title
      });

      // Convert webhook payload to SoloBossContent
      const soloBossContent: SoloBossContent = {
        id: payload.id,
        title: payload.title,
        content: payload.content,
        seoSuggestions: payload.seoSuggestions,
        socialMediaText: payload.socialMediaText,
        images: payload.images,
        publishedAt: new Date(payload.publishedAt)
      };

      // Generate social media posts using advanced transformation
      const posts = await this.generateAdvancedSocialMediaPosts(payload.userId, soloBossContent);

      loggerService.info('SoloBoss content processed successfully', {
        userId: payload.userId,
        contentId: payload.id,
        postsGenerated: posts.length
      });

      return {
        posts,
        requiresReview: true, // Always require review for SoloBoss content
        originalContent: soloBossContent
      };
    } catch (error) {
      await this.errorService.logError(
        payload.userId,
        'soloboss',
        IntegrationErrorType.CONTENT_PROCESSING,
        error as Error,
        {
          contentId: payload.id,
          title: payload.title,
          hasImages: payload.images?.length > 0,
          hasSeoSuggestions: payload.seoSuggestions?.length > 0
        }
      );

      loggerService.error('Error processing SoloBoss webhook content', error as Error, {
        userId: payload.userId,
        contentId: payload.id
      });

      throw new Error(`Failed to process SoloBoss content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateAdvancedSocialMediaPosts(userId: string, content: SoloBossContent): Promise<PostData[]> {
    const posts: PostData[] = [];

    try {
      // Get target platforms (in production, this would come from user's connected platforms)
      const platforms = [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST, Platform.X];

      // Generate platform-specific content using templates and AI optimization
      for (const platform of platforms) {
        const transformationContext: TransformationContext = {
          userId,
          platform,
          sourceType: 'soloboss',
          sourceData: content,
          customVariables: {
            ai_optimized: 'true',
            content_type: 'soloboss_generated'
          }
        };

        const transformationResult = await this.transformationService.transformContent(transformationContext);

        // Process images and SEO data with enhanced logic
        const processedImages = await this.processImagesAdvanced(content.images, platform);
        const enhancedSeoData = await this.processSEOSuggestionsAdvanced(content.seoSuggestions, platform);

        const postData: PostData = {
          userId,
          platforms: [platform],
          content: transformationResult.content,
          images: processedImages.length > 0 ? processedImages : transformationResult.images,
          hashtags: [...transformationResult.hashtags, ...enhancedSeoData.hashtags].slice(0, 15),
          source: PostSource.SOLOBOSS,
          platformSpecificContent: {
            [platform]: {
              content: transformationResult.content,
              images: processedImages,
              hashtags: enhancedSeoData.hashtags,
              metadata: {
                ...transformationResult.metadata,
                seoKeywords: enhancedSeoData.keywords,
                aiOptimized: true,
                originalSocialText: content.socialMediaText
              }
            }
          }
        };

        posts.push(postData);
      }

      // If no posts were generated, create a fallback
      if (posts.length === 0) {
        const fallbackPost = await this.generateFallbackPost(userId, content, platforms);
        posts.push(fallbackPost);
      }

    } catch (error) {
      loggerService.warn('Advanced post generation failed, using fallback', {
        userId,
        contentId: content.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to basic generation
      const fallbackPost = await this.generateFallbackPost(userId, content, [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST, Platform.X]);
      posts.push(fallbackPost);
    }

    return posts;
  }

  /**
   * Generate fallback post when advanced generation fails
   */
  private async generateFallbackPost(userId: string, content: SoloBossContent, platforms: Platform[]): Promise<PostData> {
    const processedImages = await this.processImages(content.images);
    const seoData = await this.processSEOSuggestions(content.seoSuggestions);

    return {
      userId,
      platforms: [...platforms],
      content: content.socialMediaText || this.generateContentFromBlogPost(content),
      images: processedImages,
      hashtags: seoData.hashtags,
      source: PostSource.SOLOBOSS,
      platformSpecificContent: this.generatePlatformSpecificContent(content, seoData)
    };
  }

  private generateContentFromBlogPost(content: SoloBossContent): string {
    // If no social media text provided, create one from the blog content
    const maxLength = 200;
    let excerpt = content.content.substring(0, maxLength);
    
    if (content.content.length > maxLength) {
      excerpt = excerpt.substring(0, excerpt.lastIndexOf(' ')) + '...';
    }

    return `${content.title}\n\n${excerpt}`;
  }

  async processImages(images: string[]): Promise<string[]> {
    // Process and validate image URLs
    const processedImages: string[] = [];
    
    for (const imageUrl of images) {
      try {
        // Validate URL format
        new URL(imageUrl);
        
        // Check if image is accessible (basic validation)
        // In a real implementation, you might want to:
        // - Resize images for different platforms
        // - Convert formats if needed
        // - Store images in your own storage
        processedImages.push(imageUrl);
      } catch (error) {
        loggerService.warn(`Invalid image URL skipped: ${imageUrl}`, {
          imageUrl,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return processedImages;
  }

  /**
   * Advanced image processing with platform-specific optimizations
   */
  async processImagesAdvanced(images: string[], platform: Platform): Promise<string[]> {
    const processedImages: string[] = [];
    
    try {
      for (const imageUrl of images) {
        try {
          // Validate URL format
          new URL(imageUrl);
          
          // Platform-specific image limits and optimizations
          const shouldInclude = this.shouldIncludeImageForPlatform(imageUrl, platform, processedImages.length);
          
          if (shouldInclude) {
            // In production, you might:
            // - Resize images based on platform requirements
            // - Convert formats (e.g., WebP for web, JPEG for social)
            // - Add watermarks or branding
            // - Store in CDN for faster loading
            processedImages.push(imageUrl);
          }
        } catch (error) {
          loggerService.warn(`Invalid image URL skipped during advanced processing`, {
            imageUrl,
            platform,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      loggerService.error('Advanced image processing failed', error as Error, {
        platform,
        imageCount: images.length
      });
      
      // Fallback to basic processing
      return this.processImages(images);
    }
    
    return processedImages;
  }

  /**
   * Determine if image should be included based on platform requirements
   */
  private shouldIncludeImageForPlatform(imageUrl: string, platform: Platform, currentCount: number): boolean {
    switch (platform) {
      case Platform.INSTAGRAM:
        return currentCount < 10; // Instagram allows up to 10 images in carousel
      case Platform.X:
        return currentCount < 4; // Twitter allows up to 4 images
      case Platform.PINTEREST:
        return currentCount < 1; // Pinterest typically uses one main image
      case Platform.FACEBOOK:
        return currentCount < 10; // Facebook allows multiple images
      default:
        return currentCount < 5; // Default limit
    }
  }

  async processSEOSuggestions(seoSuggestions: string[]): Promise<{
    hashtags: string[];
    keywords: string[];
    suggestions: string[];
  }> {
    const hashtags: string[] = [];
    const keywords: string[] = [];
    const suggestions: string[] = [];

    for (const suggestion of seoSuggestions) {
      suggestions.push(suggestion);
      
      // Extract keywords from suggestions
      const words = suggestion.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
      
      keywords.push(...words);
      
      // Generate hashtags from keywords
      words.forEach(word => {
        if (/^[a-z]+$/.test(word) && word.length > 3) {
          hashtags.push(`#${word}`);
        }
      });
    }

    return {
      hashtags: [...new Set(hashtags)].slice(0, 15),
      keywords: [...new Set(keywords)].slice(0, 20),
      suggestions
    };
  }

  /**
   * Advanced SEO processing with AI-enhanced optimization
   */
  async processSEOSuggestionsAdvanced(seoSuggestions: string[], platform: Platform): Promise<{
    hashtags: string[];
    keywords: string[];
    suggestions: string[];
    platformOptimized: boolean;
  }> {
    try {
      const hashtags: string[] = [];
      const keywords: string[] = [];
      const suggestions: string[] = [];

      // Enhanced keyword extraction with NLP-like processing
      for (const suggestion of seoSuggestions) {
        suggestions.push(suggestion);
        
        // Extract keywords with better filtering
        const words = this.extractKeywordsAdvanced(suggestion);
        keywords.push(...words);
        
        // Generate platform-optimized hashtags
        const platformHashtags = this.generatePlatformOptimizedHashtags(words, platform);
        hashtags.push(...platformHashtags);
      }

      // Apply platform-specific hashtag limits and optimizations
      const optimizedHashtags = this.optimizeHashtagsForPlatform(hashtags, platform);
      const optimizedKeywords = this.optimizeKeywordsForPlatform(keywords, platform);

      return {
        hashtags: optimizedHashtags,
        keywords: optimizedKeywords,
        suggestions,
        platformOptimized: true
      };

    } catch (error) {
      loggerService.warn('Advanced SEO processing failed, using fallback', {
        platform,
        suggestionsCount: seoSuggestions.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to basic processing
      const basicResult = await this.processSEOSuggestions(seoSuggestions);
      return {
        ...basicResult,
        platformOptimized: false
      };
    }
  }

  /**
   * Extract keywords with advanced filtering
   */
  private extractKeywordsAdvanced(text: string): string[] {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'among', 'this', 'that', 'these', 'those', 'is', 'are', 'was',
      'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'shall'
    ]);

    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !stopWords.has(word) && 
        /^[a-z]+$/.test(word) &&
        !word.match(/^\d+$/) // Exclude pure numbers
      );
  }

  /**
   * Generate platform-optimized hashtags
   */
  private generatePlatformOptimizedHashtags(keywords: string[], platform: Platform): string[] {
    const hashtags: string[] = [];
    
    // Platform-specific hashtag strategies
    switch (platform) {
      case Platform.INSTAGRAM:
        // Instagram allows up to 30 hashtags, use more specific and trending tags
        keywords.forEach(keyword => {
          hashtags.push(`#${keyword}`);
          // Add variations for Instagram
          if (keyword.length > 5) {
            hashtags.push(`#${keyword}gram`);
            hashtags.push(`#${keyword}daily`);
          }
        });
        break;
        
      case Platform.X:
        // Twitter/X prefers fewer, more impactful hashtags
        keywords.slice(0, 3).forEach(keyword => {
          hashtags.push(`#${keyword}`);
        });
        break;
        
      case Platform.PINTEREST:
        // Pinterest benefits from descriptive hashtags
        keywords.forEach(keyword => {
          hashtags.push(`#${keyword}`);
          if (keyword.length > 4) {
            hashtags.push(`#${keyword}inspiration`);
            hashtags.push(`#${keyword}ideas`);
          }
        });
        break;
        
      case Platform.FACEBOOK:
        // Facebook hashtags are less critical but still useful
        keywords.slice(0, 5).forEach(keyword => {
          hashtags.push(`#${keyword}`);
        });
        break;
        
      default:
        keywords.forEach(keyword => hashtags.push(`#${keyword}`));
    }
    
    return [...new Set(hashtags)]; // Remove duplicates
  }

  /**
   * Optimize hashtags for specific platform
   */
  private optimizeHashtagsForPlatform(hashtags: string[], platform: Platform): string[] {
    const uniqueHashtags = [...new Set(hashtags)];
    
    switch (platform) {
      case Platform.INSTAGRAM:
        return uniqueHashtags.slice(0, 30); // Instagram limit
      case Platform.X:
        return uniqueHashtags.slice(0, 5); // Twitter best practice
      case Platform.PINTEREST:
        return uniqueHashtags.slice(0, 20); // Pinterest recommendation
      case Platform.FACEBOOK:
        return uniqueHashtags.slice(0, 10); // Facebook best practice
      default:
        return uniqueHashtags.slice(0, 15);
    }
  }

  /**
   * Optimize keywords for specific platform
   */
  private optimizeKeywordsForPlatform(keywords: string[], platform: Platform): string[] {
    const uniqueKeywords = [...new Set(keywords)];
    
    // Sort by length and relevance (longer keywords often more specific)
    return uniqueKeywords
      .sort((a, b) => b.length - a.length)
      .slice(0, 20);
  }

  private extractHashtagsFromSEO(seoSuggestions: string[]): string[] {
    const hashtags: string[] = [];
    
    seoSuggestions.forEach(suggestion => {
      // Extract potential hashtags from SEO suggestions
      const words = suggestion.toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Simple hashtag generation from keywords
        if (word.length > 3 && /^[a-z]+$/.test(word)) {
          hashtags.push(`#${word}`);
        }
      });
    });

    // Remove duplicates and limit to 10 hashtags
    return [...new Set(hashtags)].slice(0, 10);
  }

  private generatePlatformSpecificContent(content: SoloBossContent, seoData?: { hashtags: string[]; keywords: string[]; suggestions: string[] }): Record<string, any> {
    const hashtags = seoData?.hashtags || [];
    
    return {
      facebook: {
        content: content.socialMediaText,
        images: content.images,
        hashtags: hashtags.slice(0, 10)
      },
      instagram: {
        content: content.socialMediaText,
        images: content.images.slice(0, 10), // Instagram limit
        hashtags: hashtags.slice(0, 30) // Instagram allows up to 30 hashtags
      },
      pinterest: {
        content: content.title,
        images: content.images.slice(0, 1), // Pinterest typically uses one main image
        description: content.socialMediaText,
        hashtags: hashtags.slice(0, 20)
      },
      x: {
        content: this.truncateForTwitter(content.socialMediaText || content.title),
        images: content.images.slice(0, 4), // Twitter limit
        hashtags: hashtags.slice(0, 5) // Keep hashtags minimal for Twitter
      }
    };
  }

  private truncateForTwitter(text: string): string {
    const maxLength = 280;
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  async getSoloBossIntegration(userId: string) {
    return await this.soloBossIntegration.findByUserId(userId);
  }

  async createDraftPostsFromSoloBoss(userId: string, processedContent: ProcessedContent): Promise<string[]> {
    const postIds: string[] = [];

    for (const postData of processedContent.posts) {
      try {
        const post = await PostService.createPost(userId, {
          ...postData,
          source: PostSource.SOLOBOSS
        });
        postIds.push(post.id);
      } catch (error) {
        console.error('Error creating draft post from SoloBoss content:', error);
      }
    }

    return postIds;
  }
}
import { Pool } from 'pg';
import crypto from 'crypto';
import { SoloBossIntegration } from '../models/SoloBossIntegration';
import { EncryptionService } from './EncryptionService';
import { PostService } from './PostService';
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

  constructor(
    private db: Pool
  ) {
    this.soloBossIntegration = new SoloBossIntegration(db);
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

  async verifyWebhookSignature(payload: string, signature: string, userId: string): Promise<boolean> {
    try {
      const webhookSecret = await this.soloBossIntegration.getDecryptedWebhookSecret(userId);
      if (!webhookSecret) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  async processWebhookContent(payload: SoloBossWebhookPayload): Promise<ProcessedContent> {
    try {
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

      // Generate social media posts from the content
      const posts = await this.generateSocialMediaPosts(payload.userId, soloBossContent);

      return {
        posts,
        requiresReview: true, // Always require review for SoloBoss content
        originalContent: soloBossContent
      };
    } catch (error) {
      console.error('Error processing SoloBoss webhook content:', error);
      throw new Error('Failed to process SoloBoss content');
    }
  }

  private async generateSocialMediaPosts(userId: string, content: SoloBossContent): Promise<PostData[]> {
    const posts: PostData[] = [];

    // Process images and SEO suggestions
    const processedImages = await this.processImages(content.images);
    const seoData = await this.processSEOSuggestions(content.seoSuggestions);

    // Get user's connected platforms (this would typically come from platform connections)
    // For now, we'll create posts for all platforms and let the user customize
    const platforms = [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST, Platform.X];

    // Create a base post using the social media text from SoloBoss
    const basePost: PostData = {
      userId,
      platforms: [...platforms],
      content: content.socialMediaText || this.generateContentFromBlogPost(content),
      images: processedImages,
      hashtags: seoData.hashtags,
      platformSpecificContent: this.generatePlatformSpecificContent(content, seoData)
    };

    posts.push(basePost);

    return posts;
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
        console.warn(`Invalid image URL skipped: ${imageUrl}`);
      }
    }
    
    return processedImages;
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
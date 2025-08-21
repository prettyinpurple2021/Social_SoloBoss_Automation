import axios, { AxiosResponse } from 'axios';
import { Platform } from '../types/database';
import { OAuthToken } from '../types/oauth';
import { PlatformConnectionModel } from '../models/PlatformConnection';
import { EncryptionService } from './EncryptionService';

export interface PostData {
  userId: string;
  platforms: Platform[];
  content: string;
  images?: string[];
  hashtags?: string[];
  scheduledTime?: Date;
  platformSpecificContent?: Record<Platform, PlatformContent>;
}

export interface PlatformContent {
  content: string;
  images?: string[];
  hashtags?: string[];
  metadata?: Record<string, any>;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  retryable: boolean;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
}

export class IntegrationService {
  private static instance: IntegrationService;
  private encryptionService: EncryptionService;

  private constructor() {
    this.encryptionService = new EncryptionService();
  }

  public static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * Publish a post to a specific platform
   */
  async publishPost(userId: string, platform: Platform, postContent: {
    content: string;
    images?: string[];
    hashtags?: string[];
  }): Promise<PublishResult> {
    try {
      // Get platform connection for user
      const connection = await PlatformConnectionModel.findByUserAndPlatform(userId, platform);
      if (!connection || !connection.is_active) {
        return {
          success: false,
          error: `No active ${platform} connection found`,
          retryable: false
        };
      }

      // Decrypt tokens
      const accessToken = EncryptionService.decrypt(connection.access_token);
      const refreshToken = connection.refresh_token ? 
        EncryptionService.decrypt(connection.refresh_token) : undefined;

      const token: OAuthToken = {
        accessToken,
        refreshToken,
        expiresAt: connection.token_expires_at,
        scope: []
      };

      // Create post data
      const postData: PostData = {
        userId,
        platforms: [platform],
        content: postContent.content,
        images: postContent.images,
        hashtags: postContent.hashtags
      };

      // Publish to specific platform
      switch (platform) {
        case Platform.FACEBOOK:
          return await this.publishToFacebook(postData, token);
        case Platform.INSTAGRAM:
          return await this.publishToInstagram(postData, token);
        case Platform.PINTEREST:
          return await this.publishToPinterest(postData, token);
        case Platform.X:
          return await this.publishToX(postData, token);
        default:
          return {
            success: false,
            error: `Unsupported platform: ${platform}`,
            retryable: false
          };
      }
    } catch (error) {
      console.error(`Error publishing to ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  /**
   * Publish post to Facebook Business Page
   */
  async publishToFacebook(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      // Get user's Facebook pages
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts`,
        {
          params: {
            access_token: token.accessToken,
            fields: 'id,name,access_token'
          }
        }
      );

      const pages: FacebookPageInfo[] = pagesResponse.data.data;
      if (!pages || pages.length === 0) {
        return {
          success: false,
          error: 'No Facebook Business Pages found',
          retryable: false
        };
      }

      // Use the first page (in production, this should be configurable)
      const page = pages[0];
      const content = this.getPlatformContent(post, Platform.FACEBOOK);

      let postData: any = {
        message: content.content,
        access_token: page.access_token
      };

      // Handle image uploads
      if (content.images && content.images.length > 0) {
        if (content.images.length === 1) {
          // Single image post
          postData.url = content.images[0];
        } else {
          // Multiple images - create album
          return this.createFacebookAlbumPost(page, content);
        }
      }

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${page.id}/feed`,
        postData
      );

      return {
        success: true,
        platformPostId: response.data.id,
        retryable: false
      };

    } catch (error: any) {
      return this.handleApiError(error, 'Facebook');
    }
  }

  /**
   * Publish post to Instagram
   */
  async publishToInstagram(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      // Get user's Instagram Business Account
      const accountResponse = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts`,
        {
          params: {
            access_token: token.accessToken,
            fields: 'instagram_business_account'
          }
        }
      );

      const pages = accountResponse.data.data;
      const instagramAccount = pages.find((page: any) => page.instagram_business_account);
      
      if (!instagramAccount) {
        return {
          success: false,
          error: 'No Instagram Business Account found',
          retryable: false
        };
      }

      const igAccountId = instagramAccount.instagram_business_account.id;
      const content = this.getPlatformContent(post, Platform.INSTAGRAM);

      // Instagram requires images
      if (!content.images || content.images.length === 0) {
        return {
          success: false,
          error: 'Instagram posts require at least one image',
          retryable: false
        };
      }

      // Create media container
      const mediaData: any = {
        image_url: content.images[0],
        caption: this.formatInstagramCaption(content.content, content.hashtags),
        access_token: token.accessToken
      };

      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igAccountId}/media`,
        mediaData
      );

      const containerId = containerResponse.data.id;

      // Publish the media
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: token.accessToken
        }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        retryable: false
      };

    } catch (error: any) {
      return this.handleApiError(error, 'Instagram');
    }
  }

  /**
   * Publish post to Pinterest
   */
  async publishToPinterest(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      // Get user's boards
      const boardsResponse = await axios.get(
        'https://api.pinterest.com/v5/boards',
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`
          }
        }
      );

      const boards: PinterestBoard[] = boardsResponse.data.items;
      if (!boards || boards.length === 0) {
        return {
          success: false,
          error: 'No Pinterest boards found',
          retryable: false
        };
      }

      // Use the first board (in production, this should be configurable)
      const board = boards[0];
      const content = this.getPlatformContent(post, Platform.PINTEREST);

      // Pinterest requires images
      if (!content.images || content.images.length === 0) {
        return {
          success: false,
          error: 'Pinterest posts require at least one image',
          retryable: false
        };
      }

      const pinData = {
        board_id: board.id,
        media_source: {
          source_type: 'image_url',
          url: content.images[0]
        },
        description: this.formatPinterestDescription(content.content, content.hashtags),
        title: content.content.substring(0, 100) // Pinterest title limit
      };

      const response = await axios.post(
        'https://api.pinterest.com/v5/pins',
        pinData,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        platformPostId: response.data.id,
        retryable: false
      };

    } catch (error: any) {
      return this.handleApiError(error, 'Pinterest');
    }
  }

  /**
   * Publish post to X (Twitter)
   */
  async publishToX(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      const content = this.getPlatformContent(post, Platform.X);
      let tweetText = content.content;

      // Handle hashtags
      if (content.hashtags && content.hashtags.length > 0) {
        const hashtagText = content.hashtags.map(tag => 
          tag.startsWith('#') ? tag : `#${tag}`
        ).join(' ');
        tweetText = `${tweetText} ${hashtagText}`;
      }

      // Handle character limit (280 characters for X)
      tweetText = this.truncateForX(tweetText);

      let tweetData: any = {
        text: tweetText
      };

      // Handle image uploads
      if (content.images && content.images.length > 0) {
        // For X API v2, we need to upload media first
        const mediaIds = await this.uploadMediaToX(content.images, token);
        if (mediaIds.length > 0) {
          tweetData.media = { media_ids: mediaIds };
        }
      }

      const response = await axios.post(
        'https://api.twitter.com/2/tweets',
        tweetData,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        platformPostId: response.data.data.id,
        retryable: false
      };

    } catch (error: any) {
      return this.handleApiError(error, 'X');
    }
  }

  /**
   * Get platform-specific content or fallback to default
   */
  private getPlatformContent(post: PostData, platform: Platform): PlatformContent {
    if (post.platformSpecificContent && post.platformSpecificContent[platform]) {
      return post.platformSpecificContent[platform];
    }

    return {
      content: post.content,
      images: post.images,
      hashtags: post.hashtags
    };
  }

  /**
   * Create Facebook album post for multiple images
   */
  private async createFacebookAlbumPost(page: FacebookPageInfo, content: PlatformContent): Promise<PublishResult> {
    try {
      // Create album
      const albumResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${page.id}/albums`,
        {
          name: 'Social Media Post',
          message: content.content,
          access_token: page.access_token
        }
      );

      const albumId = albumResponse.data.id;

      // Upload photos to album
      for (const imageUrl of content.images!) {
        await axios.post(
          `https://graph.facebook.com/v18.0/${albumId}/photos`,
          {
            url: imageUrl,
            access_token: page.access_token
          }
        );
      }

      return {
        success: true,
        platformPostId: albumId,
        retryable: false
      };

    } catch (error: any) {
      return this.handleApiError(error, 'Facebook Album');
    }
  }

  /**
   * Format Instagram caption with hashtags
   */
  private formatInstagramCaption(content: string, hashtags?: string[]): string {
    let caption = content;
    
    if (hashtags && hashtags.length > 0) {
      const formattedHashtags = hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
      caption = `${caption}\n\n${formattedHashtags}`;
    }

    // Instagram caption limit is 2200 characters
    return caption.length > 2200 ? caption.substring(0, 2197) + '...' : caption;
  }

  /**
   * Format Pinterest description with hashtags
   */
  private formatPinterestDescription(content: string, hashtags?: string[]): string {
    let description = content;
    
    if (hashtags && hashtags.length > 0) {
      const formattedHashtags = hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
      description = `${description} ${formattedHashtags}`;
    }

    // Pinterest description limit is 500 characters
    return description.length > 500 ? description.substring(0, 497) + '...' : description;
  }

  /**
   * Truncate text for X character limit
   */
  private truncateForX(text: string): string {
    const limit = 280;
    if (text.length <= limit) {
      return text;
    }

    // Try to truncate at word boundary
    const truncated = text.substring(0, limit - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > limit * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Upload media to X (placeholder - would need actual implementation)
   */
  private async uploadMediaToX(images: string[], token: OAuthToken): Promise<string[]> {
    // This is a simplified placeholder
    // In a real implementation, you would:
    // 1. Download the image from the URL
    // 2. Upload it to X's media upload endpoint
    // 3. Return the media IDs
    
    const mediaIds: string[] = [];
    
    for (const imageUrl of images.slice(0, 4)) { // X allows max 4 images
      try {
        // Placeholder media ID - in real implementation, upload the actual image
        mediaIds.push(`media_${Date.now()}_${Math.random()}`);
      } catch (error) {
        console.error('Failed to upload media to X:', error);
      }
    }
    
    return mediaIds;
  }

  /**
   * Handle API errors consistently
   */
  private handleApiError(error: any, platform: string): PublishResult {
    console.error(`${platform} API Error:`, error.response?.data || error.message);

    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      // Determine if error is retryable
      const retryable = status >= 500 || status === 429; // Server errors or rate limits

      return {
        success: false,
        error: errorData?.error?.message || errorData?.message || `${platform} API error: ${status}`,
        retryable
      };
    }

    return {
      success: false,
      error: `Network error connecting to ${platform}`,
      retryable: true
    };
  }

  /**
   * Get user's Facebook pages
   */
  async getFacebookPages(token: OAuthToken): Promise<FacebookPageInfo[]> {
    try {
      const response = await axios.get(
        'https://graph.facebook.com/v18.0/me/accounts',
        {
          params: {
            access_token: token.accessToken,
            fields: 'id,name,access_token'
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
      return [];
    }
  }

  /**
   * Get user's Pinterest boards
   */
  async getPinterestBoards(token: OAuthToken): Promise<PinterestBoard[]> {
    try {
      const response = await axios.get(
        'https://api.pinterest.com/v5/boards',
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`
          }
        }
      );

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Pinterest boards:', error);
      return [];
    }
  }
}
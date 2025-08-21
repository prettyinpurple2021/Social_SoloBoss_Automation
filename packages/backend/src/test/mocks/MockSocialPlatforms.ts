import { Platform } from '../../types/database';
import { OAuthToken } from '../../types/oauth';
import { PostData, PublishResult, FacebookPageInfo, PinterestBoard } from '../../services/IntegrationService';

/**
 * Mock implementations for social media platforms for testing
 * These simulate the behavior of real platform APIs in a controlled environment
 */

export class MockFacebookAPI {
  private static pages: FacebookPageInfo[] = [
    {
      id: 'mock_page_123',
      name: 'Test Business Page',
      access_token: 'mock_page_token_123'
    },
    {
      id: 'mock_page_456',
      name: 'Another Test Page',
      access_token: 'mock_page_token_456'
    }
  ];

  private static posts: Array<{ id: string; pageId: string; content: string; images?: string[] }> = [];

  static async getPages(token: OAuthToken): Promise<FacebookPageInfo[]> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }
    return this.pages;
  }

  static async createPost(pageId: string, content: string, images?: string[], pageToken?: string): Promise<string> {
    if (!pageToken || pageToken === 'invalid_page_token') {
      throw new Error('Invalid page access token');
    }

    const postId = `mock_fb_post_${Date.now()}`;
    this.posts.push({
      id: postId,
      pageId,
      content,
      images
    });

    return postId;
  }

  static async createAlbum(pageId: string, name: string, description: string, pageToken: string): Promise<string> {
    if (!pageToken || pageToken === 'invalid_page_token') {
      throw new Error('Invalid page access token');
    }

    const albumId = `mock_fb_album_${Date.now()}`;
    return albumId;
  }

  static async addPhotoToAlbum(albumId: string, imageUrl: string, pageToken: string): Promise<string> {
    if (!pageToken || pageToken === 'invalid_page_token') {
      throw new Error('Invalid page access token');
    }

    const photoId = `mock_fb_photo_${Date.now()}`;
    return photoId;
  }

  static getPosts(): Array<{ id: string; pageId: string; content: string; images?: string[] }> {
    return [...this.posts];
  }

  static clearPosts(): void {
    this.posts = [];
  }
}

export class MockInstagramAPI {
  private static accounts = [
    {
      id: 'mock_ig_account_123',
      username: 'test_business_account'
    }
  ];

  private static posts: Array<{ id: string; accountId: string; caption: string; imageUrl: string }> = [];

  static async getBusinessAccount(token: OAuthToken): Promise<{ id: string; username: string } | null> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }
    return this.accounts[0];
  }

  static async createMediaContainer(accountId: string, imageUrl: string, caption: string, token: OAuthToken): Promise<string> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }

    if (!imageUrl) {
      throw new Error('Image URL is required for Instagram posts');
    }

    const containerId = `mock_ig_container_${Date.now()}`;
    return containerId;
  }

  static async publishMedia(accountId: string, containerId: string, token: OAuthToken): Promise<string> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }

    const postId = `mock_ig_post_${Date.now()}`;
    this.posts.push({
      id: postId,
      accountId,
      caption: 'Mock caption',
      imageUrl: 'mock_image_url'
    });

    return postId;
  }

  static getPosts(): Array<{ id: string; accountId: string; caption: string; imageUrl: string }> {
    return [...this.posts];
  }

  static clearPosts(): void {
    this.posts = [];
  }
}

export class MockPinterestAPI {
  private static boards: PinterestBoard[] = [
    {
      id: 'mock_board_123',
      name: 'Test Board',
      description: 'A test board for automation'
    },
    {
      id: 'mock_board_456',
      name: 'Another Board',
      description: 'Another test board'
    }
  ];

  private static pins: Array<{ id: string; boardId: string; title: string; description: string; imageUrl: string }> = [];

  static async getBoards(token: OAuthToken): Promise<PinterestBoard[]> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }
    return this.boards;
  }

  static async createPin(
    boardId: string,
    title: string,
    description: string,
    imageUrl: string,
    token: OAuthToken
  ): Promise<string> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }

    if (!imageUrl) {
      throw new Error('Image URL is required for Pinterest pins');
    }

    const pinId = `mock_pin_${Date.now()}`;
    this.pins.push({
      id: pinId,
      boardId,
      title,
      description,
      imageUrl
    });

    return pinId;
  }

  static getPins(): Array<{ id: string; boardId: string; title: string; description: string; imageUrl: string }> {
    return [...this.pins];
  }

  static clearPins(): void {
    this.pins = [];
  }
}

export class MockXAPI {
  private static tweets: Array<{ id: string; text: string; mediaIds?: string[] }> = [];
  private static mediaUploads: Array<{ id: string; url: string }> = [];

  static async createTweet(text: string, mediaIds?: string[], token?: OAuthToken): Promise<string> {
    if (token?.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }

    if (text.length > 280) {
      throw new Error('Tweet text exceeds 280 character limit');
    }

    const tweetId = `mock_tweet_${Date.now()}`;
    this.tweets.push({
      id: tweetId,
      text,
      mediaIds
    });

    return tweetId;
  }

  static async uploadMedia(imageUrl: string, token: OAuthToken): Promise<string> {
    if (token.accessToken === 'invalid_token') {
      throw new Error('Invalid access token');
    }

    const mediaId = `mock_media_${Date.now()}`;
    this.mediaUploads.push({
      id: mediaId,
      url: imageUrl
    });

    return mediaId;
  }

  static getTweets(): Array<{ id: string; text: string; mediaIds?: string[] }> {
    return [...this.tweets];
  }

  static getMediaUploads(): Array<{ id: string; url: string }> {
    return [...this.mediaUploads];
  }

  static clearTweets(): void {
    this.tweets = [];
  }

  static clearMediaUploads(): void {
    this.mediaUploads = [];
  }
}

/**
 * Mock Integration Service for testing
 * Uses mock APIs instead of real platform APIs
 */
export class MockIntegrationService {
  async publishToFacebook(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      const pages = await MockFacebookAPI.getPages(token);
      if (pages.length === 0) {
        return {
          success: false,
          error: 'No Facebook Business Pages found',
          retryable: false
        };
      }

      const page = pages[0];
      let postId: string;

      if (post.images && post.images.length > 1) {
        // Create album for multiple images
        const albumId = await MockFacebookAPI.createAlbum(
          page.id,
          'Social Media Post',
          post.content,
          page.access_token
        );

        for (const imageUrl of post.images) {
          await MockFacebookAPI.addPhotoToAlbum(albumId, imageUrl, page.access_token);
        }

        postId = albumId;
      } else {
        // Single post
        postId = await MockFacebookAPI.createPost(
          page.id,
          post.content,
          post.images,
          page.access_token
        );
      }

      return {
        success: true,
        platformPostId: postId,
        retryable: false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: false
      };
    }
  }

  async publishToInstagram(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      if (!post.images || post.images.length === 0) {
        return {
          success: false,
          error: 'Instagram posts require at least one image',
          retryable: false
        };
      }

      const account = await MockInstagramAPI.getBusinessAccount(token);
      if (!account) {
        return {
          success: false,
          error: 'No Instagram Business Account found',
          retryable: false
        };
      }

      const caption = this.formatInstagramCaption(post.content, post.hashtags);
      const containerId = await MockInstagramAPI.createMediaContainer(
        account.id,
        post.images[0],
        caption,
        token
      );

      const postId = await MockInstagramAPI.publishMedia(account.id, containerId, token);

      return {
        success: true,
        platformPostId: postId,
        retryable: false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: false
      };
    }
  }

  async publishToPinterest(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      if (!post.images || post.images.length === 0) {
        return {
          success: false,
          error: 'Pinterest posts require at least one image',
          retryable: false
        };
      }

      const boards = await MockPinterestAPI.getBoards(token);
      if (boards.length === 0) {
        return {
          success: false,
          error: 'No Pinterest boards found',
          retryable: false
        };
      }

      const board = boards[0];
      const description = this.formatPinterestDescription(post.content, post.hashtags);
      const title = post.content.substring(0, 100);

      const pinId = await MockPinterestAPI.createPin(
        board.id,
        title,
        description,
        post.images[0],
        token
      );

      return {
        success: true,
        platformPostId: pinId,
        retryable: false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: false
      };
    }
  }

  async publishToX(post: PostData, token: OAuthToken): Promise<PublishResult> {
    try {
      let tweetText = post.content;

      // Add hashtags
      if (post.hashtags && post.hashtags.length > 0) {
        const hashtagText = post.hashtags.map(tag => 
          tag.startsWith('#') ? tag : `#${tag}`
        ).join(' ');
        tweetText = `${tweetText} ${hashtagText}`;
      }

      // Truncate if necessary
      tweetText = this.truncateForX(tweetText);

      // Handle media uploads
      let mediaIds: string[] = [];
      if (post.images && post.images.length > 0) {
        for (const imageUrl of post.images.slice(0, 4)) {
          const mediaId = await MockXAPI.uploadMedia(imageUrl, token);
          mediaIds.push(mediaId);
        }
      }

      const tweetId = await MockXAPI.createTweet(tweetText, mediaIds, token);

      return {
        success: true,
        platformPostId: tweetId,
        retryable: false
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: false
      };
    }
  }

  private formatInstagramCaption(content: string, hashtags?: string[]): string {
    let caption = content;
    
    if (hashtags && hashtags.length > 0) {
      const formattedHashtags = hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
      caption = `${caption}\n\n${formattedHashtags}`;
    }

    return caption.length > 2200 ? caption.substring(0, 2197) + '...' : caption;
  }

  private formatPinterestDescription(content: string, hashtags?: string[]): string {
    let description = content;
    
    if (hashtags && hashtags.length > 0) {
      const formattedHashtags = hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
      description = `${description} ${formattedHashtags}`;
    }

    return description.length > 500 ? description.substring(0, 497) + '...' : description;
  }

  private truncateForX(text: string): string {
    const limit = 280;
    if (text.length <= limit) {
      return text;
    }

    const truncated = text.substring(0, limit - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > limit * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
}
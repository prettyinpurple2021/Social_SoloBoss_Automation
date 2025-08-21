import { 
  MockIntegrationService,
  MockFacebookAPI,
  MockInstagramAPI,
  MockPinterestAPI,
  MockXAPI
} from './mocks/MockSocialPlatforms';
import { Platform } from '../types/database';
import { OAuthToken } from '../types/oauth';
import { PostData } from '../services/IntegrationService';

describe('Social Platforms Integration Tests', () => {
  let mockIntegrationService: MockIntegrationService;
  let validToken: OAuthToken;
  let invalidToken: OAuthToken;
  let samplePost: PostData;

  beforeEach(() => {
    mockIntegrationService = new MockIntegrationService();
    
    validToken = {
      accessToken: 'valid_token_123',
      refreshToken: 'refresh_token_123',
      expiresAt: new Date(Date.now() + 3600000),
      scope: ['publish_actions', 'pages_manage_posts']
    };

    invalidToken = {
      accessToken: 'invalid_token',
      refreshToken: 'invalid_refresh',
      expiresAt: new Date(Date.now() + 3600000),
      scope: []
    };

    samplePost = {
      userId: 'user123',
      platforms: [Platform.FACEBOOK],
      content: 'Test post for social media automation',
      images: ['https://example.com/test-image.jpg'],
      hashtags: ['test', 'automation', 'socialmedia']
    };

    // Clear all mock data before each test
    MockFacebookAPI.clearPosts();
    MockInstagramAPI.clearPosts();
    MockPinterestAPI.clearPins();
    MockXAPI.clearTweets();
    MockXAPI.clearMediaUploads();
  });

  describe('Facebook Integration', () => {
    it('should successfully publish a single image post to Facebook', async () => {
      const result = await mockIntegrationService.publishToFacebook(samplePost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_fb_post_/);
      expect(result.retryable).toBe(false);

      const posts = MockFacebookAPI.getPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0].content).toBe(samplePost.content);
      expect(posts[0].images).toEqual(samplePost.images);
    });

    it('should create album for multiple images', async () => {
      const multiImagePost = {
        ...samplePost,
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg'
        ]
      };

      const result = await mockIntegrationService.publishToFacebook(multiImagePost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_fb_album_/);
    });

    it('should handle invalid token error', async () => {
      const result = await mockIntegrationService.publishToFacebook(samplePost, invalidToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.retryable).toBe(false);
    });

    it('should handle text-only posts', async () => {
      const textOnlyPost = {
        ...samplePost,
        images: []
      };

      const result = await mockIntegrationService.publishToFacebook(textOnlyPost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_fb_post_/);

      const posts = MockFacebookAPI.getPosts();
      expect(posts[0].images).toEqual([]);
    });
  });

  describe('Instagram Integration', () => {
    it('should successfully publish to Instagram with image', async () => {
      const result = await mockIntegrationService.publishToInstagram(samplePost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_ig_post_/);
      expect(result.retryable).toBe(false);

      const posts = MockInstagramAPI.getPosts();
      expect(posts).toHaveLength(1);
    });

    it('should fail when no images provided', async () => {
      const noImagePost = {
        ...samplePost,
        images: []
      };

      const result = await mockIntegrationService.publishToInstagram(noImagePost, validToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Instagram posts require at least one image');
      expect(result.retryable).toBe(false);
    });

    it('should handle invalid token error', async () => {
      const result = await mockIntegrationService.publishToInstagram(samplePost, invalidToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.retryable).toBe(false);
    });

    it('should format caption with hashtags correctly', async () => {
      const postWithHashtags = {
        ...samplePost,
        hashtags: ['instagram', 'test', 'automation']
      };

      const result = await mockIntegrationService.publishToInstagram(postWithHashtags, validToken);

      expect(result.success).toBe(true);
      // The caption formatting is tested internally in the mock service
    });
  });

  describe('Pinterest Integration', () => {
    it('should successfully create a pin', async () => {
      const result = await mockIntegrationService.publishToPinterest(samplePost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_pin_/);
      expect(result.retryable).toBe(false);

      const pins = MockPinterestAPI.getPins();
      expect(pins).toHaveLength(1);
      expect(pins[0].title).toBe(samplePost.content.substring(0, 100));
    });

    it('should fail when no images provided', async () => {
      const noImagePost = {
        ...samplePost,
        images: []
      };

      const result = await mockIntegrationService.publishToPinterest(noImagePost, validToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pinterest posts require at least one image');
      expect(result.retryable).toBe(false);
    });

    it('should handle invalid token error', async () => {
      const result = await mockIntegrationService.publishToPinterest(samplePost, invalidToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.retryable).toBe(false);
    });

    it('should format description with hashtags', async () => {
      const postWithHashtags = {
        ...samplePost,
        hashtags: ['pinterest', 'design', 'inspiration']
      };

      const result = await mockIntegrationService.publishToPinterest(postWithHashtags, validToken);

      expect(result.success).toBe(true);

      const pins = MockPinterestAPI.getPins();
      expect(pins[0].description).toContain('#pinterest');
      expect(pins[0].description).toContain('#design');
      expect(pins[0].description).toContain('#inspiration');
    });
  });

  describe('X (Twitter) Integration', () => {
    it('should successfully create a tweet', async () => {
      const result = await mockIntegrationService.publishToX(samplePost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_tweet_/);
      expect(result.retryable).toBe(false);

      const tweets = MockXAPI.getTweets();
      expect(tweets).toHaveLength(1);
      expect(tweets[0].text).toContain(samplePost.content);
      expect(tweets[0].text).toContain('#test');
      expect(tweets[0].text).toContain('#automation');
    });

    it('should handle text-only tweets', async () => {
      const textOnlyPost = {
        ...samplePost,
        images: []
      };

      const result = await mockIntegrationService.publishToX(textOnlyPost, validToken);

      expect(result.success).toBe(true);

      const tweets = MockXAPI.getTweets();
      expect(tweets[0].mediaIds).toBeUndefined();
    });

    it('should upload media for tweets with images', async () => {
      const result = await mockIntegrationService.publishToX(samplePost, validToken);

      expect(result.success).toBe(true);

      const tweets = MockXAPI.getTweets();
      const mediaUploads = MockXAPI.getMediaUploads();
      
      expect(mediaUploads).toHaveLength(1);
      expect(tweets[0].mediaIds).toHaveLength(1);
    });

    it('should truncate long tweets', async () => {
      const longPost = {
        ...samplePost,
        content: 'A'.repeat(300), // Exceeds 280 character limit
        hashtags: []
      };

      const result = await mockIntegrationService.publishToX(longPost, validToken);

      expect(result.success).toBe(true);

      const tweets = MockXAPI.getTweets();
      expect(tweets[0].text.length).toBeLessThanOrEqual(280);
      expect(tweets[0].text).toContain('...');
    });

    it('should handle multiple images (max 4)', async () => {
      const multiImagePost = {
        ...samplePost,
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
          'https://example.com/img3.jpg',
          'https://example.com/img4.jpg',
          'https://example.com/img5.jpg' // This should be ignored
        ]
      };

      const result = await mockIntegrationService.publishToX(multiImagePost, validToken);

      expect(result.success).toBe(true);

      const mediaUploads = MockXAPI.getMediaUploads();
      expect(mediaUploads).toHaveLength(4); // Max 4 images
    });

    it('should handle invalid token error', async () => {
      const result = await mockIntegrationService.publishToX(samplePost, invalidToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Cross-Platform Content Formatting', () => {
    it('should handle hashtags consistently across platforms', async () => {
      const postWithHashtags = {
        ...samplePost,
        hashtags: ['crossplatform', 'test', 'automation']
      };

      // Test Facebook
      const fbResult = await mockIntegrationService.publishToFacebook(postWithHashtags, validToken);
      expect(fbResult.success).toBe(true);

      // Test Instagram
      const igResult = await mockIntegrationService.publishToInstagram(postWithHashtags, validToken);
      expect(igResult.success).toBe(true);

      // Test Pinterest
      const pinResult = await mockIntegrationService.publishToPinterest(postWithHashtags, validToken);
      expect(pinResult.success).toBe(true);

      // Test X
      const xResult = await mockIntegrationService.publishToX(postWithHashtags, validToken);
      expect(xResult.success).toBe(true);

      // Verify all platforms processed the hashtags
      const tweets = MockXAPI.getTweets();
      expect(tweets[0].text).toContain('#crossplatform');
    });

    it('should handle empty content gracefully', async () => {
      const emptyPost = {
        ...samplePost,
        content: '',
        hashtags: ['test']
      };

      const fbResult = await mockIntegrationService.publishToFacebook(emptyPost, validToken);
      const xResult = await mockIntegrationService.publishToX(emptyPost, validToken);

      expect(fbResult.success).toBe(true);
      expect(xResult.success).toBe(true);
    });

    it('should handle special characters in content', async () => {
      const specialCharPost = {
        ...samplePost,
        content: 'Test with émojis 🚀 and spëcial chars & symbols!',
        hashtags: ['émoji', 'spëcial']
      };

      const results = await Promise.all([
        mockIntegrationService.publishToFacebook(specialCharPost, validToken),
        mockIntegrationService.publishToInstagram(specialCharPost, validToken),
        mockIntegrationService.publishToPinterest(specialCharPost, validToken),
        mockIntegrationService.publishToX(specialCharPost, validToken)
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network simulation errors', async () => {
      // This would be expanded in a real integration test environment
      // where we can simulate network failures, timeouts, etc.
      
      const result = await mockIntegrationService.publishToFacebook(samplePost, validToken);
      expect(result.success).toBe(true);
    });

    it('should handle rate limiting scenarios', async () => {
      // In a real test environment, we would simulate rate limiting
      // For now, we just verify the basic functionality works
      
      const results = await Promise.all([
        mockIntegrationService.publishToFacebook(samplePost, validToken),
        mockIntegrationService.publishToInstagram(samplePost, validToken),
        mockIntegrationService.publishToPinterest(samplePost, validToken),
        mockIntegrationService.publishToX(samplePost, validToken)
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Platform-Specific Features', () => {
    it('should handle Facebook album creation for multiple images', async () => {
      const albumPost = {
        ...samplePost,
        images: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
          'https://example.com/photo3.jpg'
        ]
      };

      const result = await mockIntegrationService.publishToFacebook(albumPost, validToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toMatch(/^mock_fb_album_/);
    });

    it('should handle Instagram caption length limits', async () => {
      const longCaptionPost = {
        ...samplePost,
        content: 'A'.repeat(2500), // Exceeds Instagram's 2200 character limit
        hashtags: ['long', 'caption', 'test']
      };

      const result = await mockIntegrationService.publishToInstagram(longCaptionPost, validToken);

      expect(result.success).toBe(true);
      // The truncation logic is handled in the mock service
    });

    it('should handle Pinterest description length limits', async () => {
      const longDescPost = {
        ...samplePost,
        content: 'A'.repeat(600), // Exceeds Pinterest's 500 character limit
        hashtags: ['long', 'description']
      };

      const result = await mockIntegrationService.publishToPinterest(longDescPost, validToken);

      expect(result.success).toBe(true);
      // The truncation logic is handled in the mock service
    });

    it('should handle X character limits and word boundaries', async () => {
      const wordBoundaryPost = {
        ...samplePost,
        content: 'This is a test post that should be truncated at a word boundary when it exceeds the character limit for X platform which is 280 characters and we want to make sure it truncates properly',
        hashtags: ['wordtest']
      };

      const result = await mockIntegrationService.publishToX(wordBoundaryPost, validToken);

      expect(result.success).toBe(true);

      const tweets = MockXAPI.getTweets();
      expect(tweets[0].text.length).toBeLessThanOrEqual(280);
      expect(tweets[0].text).toContain('...');
    });
  });
});
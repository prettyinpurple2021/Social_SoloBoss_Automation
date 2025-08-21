import { IntegrationService, PostData, PublishResult } from '../services/IntegrationService';
import { Platform } from '../types/database';
import { OAuthToken } from '../types/oauth';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IntegrationService', () => {
  let integrationService: IntegrationService;
  let mockToken: OAuthToken;
  let mockPostData: PostData;

  beforeEach(() => {
    integrationService = new IntegrationService();
    
    mockToken = {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      scope: ['publish_actions']
    };

    mockPostData = {
      userId: 'user123',
      platforms: [Platform.FACEBOOK],
      content: 'Test post content',
      images: ['https://example.com/image1.jpg'],
      hashtags: ['test', 'automation']
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('publishToFacebook', () => {
    it('should successfully publish a text post to Facebook', async () => {
      // Mock Facebook pages API response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123',
              name: 'Test Page',
              access_token: 'page_access_token'
            }
          ]
        }
      });

      // Mock Facebook post API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'post123'
        }
      });

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('post123');
      expect(result.retryable).toBe(false);

      // Verify API calls
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/me/accounts',
        {
          params: {
            access_token: 'mock_access_token',
            fields: 'id,name,access_token'
          }
        }
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/page123/feed',
        {
          message: 'Test post content',
          url: 'https://example.com/image1.jpg',
          access_token: 'page_access_token'
        }
      );
    });

    it('should handle Facebook API errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: {
              message: 'Invalid access token'
            }
          }
        }
      });

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.retryable).toBe(false);
    });

    it('should handle no Facebook pages found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: []
        }
      });

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Facebook Business Pages found');
      expect(result.retryable).toBe(false);
    });

    it('should create album for multiple images', async () => {
      const multiImagePost = {
        ...mockPostData,
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg'
        ]
      };

      // Mock Facebook pages API response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123',
              name: 'Test Page',
              access_token: 'page_access_token'
            }
          ]
        }
      });

      // Mock album creation
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { id: 'album123' }
        })
        .mockResolvedValueOnce({
          data: { id: 'photo1' }
        })
        .mockResolvedValueOnce({
          data: { id: 'photo2' }
        });

      const result = await integrationService.publishToFacebook(multiImagePost, mockToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('album123');
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // Album + 2 photos
    });
  });

  describe('publishToInstagram', () => {
    it('should successfully publish to Instagram', async () => {
      // Mock Facebook pages with Instagram account
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123',
              instagram_business_account: {
                id: 'ig123'
              }
            }
          ]
        }
      });

      // Mock Instagram media container creation
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { id: 'container123' }
        })
        .mockResolvedValueOnce({
          data: { id: 'ig_post123' }
        });

      const result = await integrationService.publishToInstagram(mockPostData, mockToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig_post123');

      // Verify media container creation
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/ig123/media',
        {
          image_url: 'https://example.com/image1.jpg',
          caption: 'Test post content\n\n#test #automation',
          access_token: 'mock_access_token'
        }
      );

      // Verify media publish
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/ig123/media_publish',
        {
          creation_id: 'container123',
          access_token: 'mock_access_token'
        }
      );
    });

    it('should fail when no Instagram account found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123'
              // No instagram_business_account
            }
          ]
        }
      });

      const result = await integrationService.publishToInstagram(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Instagram Business Account found');
    });

    it('should fail when no images provided', async () => {
      const noImagePost = {
        ...mockPostData,
        images: []
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123',
              instagram_business_account: {
                id: 'ig123'
              }
            }
          ]
        }
      });

      const result = await integrationService.publishToInstagram(noImagePost, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Instagram posts require at least one image');
    });
  });

  describe('publishToPinterest', () => {
    it('should successfully publish to Pinterest', async () => {
      // Mock Pinterest boards API response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'board123',
              name: 'Test Board'
            }
          ]
        }
      });

      // Mock Pinterest pin creation
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'pin123'
        }
      });

      const result = await integrationService.publishToPinterest(mockPostData, mockToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('pin123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.pinterest.com/v5/pins',
        {
          board_id: 'board123',
          media_source: {
            source_type: 'image_url',
            url: 'https://example.com/image1.jpg'
          },
          description: 'Test post content #test #automation',
          title: 'Test post content'
        },
        {
          headers: {
            'Authorization': 'Bearer mock_access_token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should fail when no Pinterest boards found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: []
        }
      });

      const result = await integrationService.publishToPinterest(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Pinterest boards found');
    });

    it('should fail when no images provided', async () => {
      const noImagePost = {
        ...mockPostData,
        images: []
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'board123',
              name: 'Test Board'
            }
          ]
        }
      });

      const result = await integrationService.publishToPinterest(noImagePost, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pinterest posts require at least one image');
    });
  });

  describe('publishToX', () => {
    it('should successfully publish to X', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            id: 'tweet123'
          }
        }
      });

      const result = await integrationService.publishToX(mockPostData, mockToken);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('tweet123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        {
          text: 'Test post content #test #automation'
        },
        {
          headers: {
            'Authorization': 'Bearer mock_access_token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should truncate long content for X', async () => {
      const longContent = 'A'.repeat(300); // Exceeds 280 character limit
      const longPost = {
        ...mockPostData,
        content: longContent,
        hashtags: []
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            id: 'tweet123'
          }
        }
      });

      const result = await integrationService.publishToX(longPost, mockToken);

      expect(result.success).toBe(true);
      
      const callArgs = mockedAxios.post.mock.calls[0];
      const tweetData = callArgs[1] as any;
      expect(tweetData.text.length).toBeLessThanOrEqual(280);
      expect(tweetData.text).toContain('...');
    });

    it('should handle X API errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            errors: [
              {
                message: 'Forbidden'
              }
            ]
          }
        }
      });

      const result = await integrationService.publishToX(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors as retryable', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error connecting to Facebook');
      expect(result.retryable).toBe(true);
    });

    it('should handle rate limit errors as retryable', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limit exceeded'
            }
          }
        }
      });

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(result.retryable).toBe(true);
    });

    it('should handle server errors as retryable', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: {
              message: 'Internal server error'
            }
          }
        }
      });

      const result = await integrationService.publishToFacebook(mockPostData, mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Platform-specific content', () => {
    it('should use platform-specific content when available', async () => {
      const postWithPlatformContent: PostData = {
        ...mockPostData,
        platformSpecificContent: {
          [Platform.FACEBOOK]: {
            content: 'Facebook specific content',
            hashtags: ['facebook', 'social']
          },
          [Platform.INSTAGRAM]: {
            content: 'Instagram specific content',
            hashtags: ['instagram', 'social']
          },
          [Platform.PINTEREST]: {
            content: 'Pinterest specific content',
            hashtags: ['pinterest', 'social']
          },
          [Platform.X]: {
            content: 'X specific content',
            hashtags: ['x', 'social']
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page123',
              name: 'Test Page',
              access_token: 'page_access_token'
            }
          ]
        }
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'post123' }
      });

      await integrationService.publishToFacebook(postWithPlatformContent, mockToken);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/page123/feed',
        expect.objectContaining({
          message: 'Facebook specific content'
        })
      );
    });
  });

  describe('Utility methods', () => {
    it('should get Facebook pages', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'page1',
              name: 'Page 1',
              access_token: 'token1'
            },
            {
              id: 'page2',
              name: 'Page 2',
              access_token: 'token2'
            }
          ]
        }
      });

      const pages = await integrationService.getFacebookPages(mockToken);

      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual({
        id: 'page1',
        name: 'Page 1',
        access_token: 'token1'
      });
    });

    it('should get Pinterest boards', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'board1',
              name: 'Board 1'
            },
            {
              id: 'board2',
              name: 'Board 2'
            }
          ]
        }
      });

      const boards = await integrationService.getPinterestBoards(mockToken);

      expect(boards).toHaveLength(2);
      expect(boards[0]).toEqual({
        id: 'board1',
        name: 'Board 1'
      });
    });

    it('should handle errors when fetching Facebook pages', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const pages = await integrationService.getFacebookPages(mockToken);

      expect(pages).toEqual([]);
    });

    it('should handle errors when fetching Pinterest boards', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const boards = await integrationService.getPinterestBoards(mockToken);

      expect(boards).toEqual([]);
    });
  });
});
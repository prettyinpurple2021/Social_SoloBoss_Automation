import { BloggerService } from '../services/BloggerService';
import { BloggerIntegrationModel } from '../models/BloggerIntegration';

// Mock dependencies
jest.mock('../models/BloggerIntegration');
jest.mock('../services/PostService');
jest.mock('axios');

const mockBloggerIntegrationModel = BloggerIntegrationModel as jest.Mocked<typeof BloggerIntegrationModel>;

// Mock RSS Parser
const mockParseURL = jest.fn();
const mockParseString = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
    parseString: mockParseString
  }));
});

describe('BloggerService Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBloggerIntegration', () => {
    it('should return blogger integration for user', async () => {
      const userId = 'user-123';
      const mockIntegration = {
        id: 'integration-123',
        user_id: userId,
        blog_url: 'https://example.blogspot.com',
        enabled: true
      };

      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(mockIntegration as any);

      const result = await BloggerService.getBloggerIntegration(userId);

      expect(mockBloggerIntegrationModel.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockIntegration);
    });

    it('should return null when no integration exists', async () => {
      const userId = 'user-123';
      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(null);

      const result = await BloggerService.getBloggerIntegration(userId);

      expect(result).toBeNull();
    });
  });

  describe('disableBloggerIntegration', () => {
    it('should disable existing integration', async () => {
      const userId = 'user-123';
      const mockIntegration = {
        id: 'integration-123',
        user_id: userId,
        enabled: true
      };

      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(mockIntegration as any);
      mockBloggerIntegrationModel.update.mockResolvedValue({ ...mockIntegration, enabled: false } as any);

      const result = await BloggerService.disableBloggerIntegration(userId);

      expect(mockBloggerIntegrationModel.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockBloggerIntegrationModel.update).toHaveBeenCalledWith(mockIntegration.id, {
        enabled: false
      });
      expect(result).toBe(true);
    });

    it('should return false when no integration exists', async () => {
      const userId = 'user-123';
      mockBloggerIntegrationModel.findByUserId.mockResolvedValue(null);

      const result = await BloggerService.disableBloggerIntegration(userId);

      expect(result).toBe(false);
    });
  });
});
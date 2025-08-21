import { ContentOptimizationService } from '../ContentOptimizationService';
import { Platform } from '../../types/platform';
import { PostData } from '../../types/post';

describe('ContentOptimizationService', () => {
  const mockPost: PostData = {
    userId: 'user123',
    platforms: [Platform.FACEBOOK],
    content: 'This is a test post about technology and innovation. It discusses the latest trends in AI and machine learning.',
    images: ['https://example.com/image1.jpg'],
    hashtags: ['#tech', '#innovation', '#AI']
  };

  describe('optimizeContentForPlatform', () => {
    it('should optimize content for Facebook', () => {
      const result = ContentOptimizationService.optimizeContentForPlatform(mockPost, Platform.FACEBOOK);
      
      expect(result.optimizedContent).toBeDefined();
      expect(result.optimizedContent.content).toContain('technology and innovation');
      expect(result.optimizedContent.hashtags).toEqual(mockPost.hashtags);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.truncated).toBe(false);
    });

    it('should optimize content for Instagram', () => {
      const shortPost: PostData = {
        ...mockPost,
        content: 'Short post' // Less than 100 characters to trigger suggestion
      };
      
      const result = ContentOptimizationService.optimizeContentForPlatform(shortPost, Platform.INSTAGRAM);
      
      expect(result.optimizedContent).toBeDefined();
      expect(result.suggestions).toContain('Instagram posts perform better with more detailed captions');
    });

    it('should optimize content for Pinterest', () => {
      const result = ContentOptimizationService.optimizeContentForPlatform(mockPost, Platform.PINTEREST);
      
      expect(result.optimizedContent).toBeDefined();
      expect(result.suggestions).toContain('Pinterest users love actionable content - consider adding "how to" or tips');
    });

    it('should optimize content for X (Twitter)', () => {
      const result = ContentOptimizationService.optimizeContentForPlatform(mockPost, Platform.X);
      
      expect(result.optimizedContent).toBeDefined();
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should truncate content when it exceeds character limits', () => {
      const longPost: PostData = {
        ...mockPost,
        content: 'A'.repeat(300), // Exceeds X character limit
        hashtags: ['#test']
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(longPost, Platform.X);
      
      expect(result.truncated).toBe(true);
      expect(result.warnings).toContain('Content was truncated to fit x character limit');
      expect(result.optimizedContent.content.length).toBeLessThan(280);
    });

    it('should handle posts with no hashtags', () => {
      const postWithoutHashtags: PostData = {
        ...mockPost,
        hashtags: []
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(postWithoutHashtags, Platform.INSTAGRAM);
      
      expect(result.suggestions.some(s => s.includes('Consider adding hashtags'))).toBe(true);
    });

    it('should handle posts with too many images', () => {
      const postWithManyImages: PostData = {
        ...mockPost,
        images: Array(15).fill('https://example.com/image.jpg') // Exceeds limits for most platforms
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(postWithManyImages, Platform.PINTEREST);
      
      expect(result.warnings).toContain('Too many images for pinterest. Maximum: 1');
    });

    it('should validate hashtag limits per platform', () => {
      const postWithManyHashtags: PostData = {
        ...mockPost,
        hashtags: Array(10).fill('#test') // Too many for X
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(postWithManyHashtags, Platform.X);
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getImageOptimizationSpecs', () => {
    it('should return image specs for each platform', () => {
      const facebookSpecs = ContentOptimizationService.getImageOptimizationSpecs(Platform.FACEBOOK);
      expect(facebookSpecs).toHaveLength(1);
      expect(facebookSpecs[0]).toHaveProperty('maxWidth', 1200);
      expect(facebookSpecs[0]).toHaveProperty('maxHeight', 630);

      const instagramSpecs = ContentOptimizationService.getImageOptimizationSpecs(Platform.INSTAGRAM);
      expect(instagramSpecs).toHaveLength(2);
      expect(instagramSpecs[0]).toHaveProperty('aspectRatio', 1);
    });
  });

  describe('validateImageForPlatform', () => {
    it('should validate valid image URLs', () => {
      const result = ContentOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.FACEBOOK
      );
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should reject invalid image URLs', () => {
      const result = ContentOptimizationService.validateImageForPlatform(
        'invalid-url',
        Platform.FACEBOOK
      );
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Invalid image URL');
    });

    it('should warn about unsupported formats', () => {
      const result = ContentOptimizationService.validateImageForPlatform(
        'https://example.com/image.bmp',
        Platform.INSTAGRAM
      );
      
      expect(result.warnings.some(w => w.includes('format may not be supported'))).toBe(true);
    });

    it('should provide platform-specific suggestions', () => {
      const instagramResult = ContentOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.INSTAGRAM
      );
      
      expect(instagramResult.suggestions).toContain('Use square (1:1) or portrait (4:5) aspect ratios for best results');

      const pinterestResult = ContentOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.PINTEREST
      );
      
      expect(pinterestResult.suggestions).toContain('Use vertical images (2:3 aspect ratio) for maximum visibility');
    });
  });

  describe('truncateContent', () => {
    it('should truncate at sentence boundaries when possible', () => {
      const longContent = 'First sentence. Second sentence. Third sentence.';
      // Access private method through any cast for testing
      const truncated = (ContentOptimizationService as any).truncateContent(longContent, 20);
      
      expect(truncated).toBe('First sentence....');
    });

    it('should truncate at word boundaries as fallback', () => {
      const longContent = 'This is a very long sentence without proper punctuation marks';
      const truncated = (ContentOptimizationService as any).truncateContent(longContent, 20);
      
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });
  });

  describe('platform-specific suggestions', () => {
    it('should suggest engagement questions for Facebook', () => {
      const postWithoutQuestion: PostData = {
        ...mockPost,
        content: 'This is a statement without questions.'
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(postWithoutQuestion, Platform.FACEBOOK);
      
      expect(result.suggestions).toContain('Consider adding a question to encourage engagement');
    });

    it('should suggest thread format for long X posts', () => {
      const longPost: PostData = {
        ...mockPost,
        content: 'A'.repeat(250) // Long content for X
      };

      const result = ContentOptimizationService.optimizeContentForPlatform(longPost, Platform.X);
      
      expect(result.suggestions).toContain('Consider breaking long content into a thread');
    });
  });
});
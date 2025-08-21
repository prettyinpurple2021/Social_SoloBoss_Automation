import { ImageOptimizationService } from '../ImageOptimizationService';
import { Platform } from '../../types/platform';

describe('ImageOptimizationService', () => {
  describe('validateImageForPlatform', () => {
    it('should validate valid image URLs', () => {
      const result = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.FACEBOOK
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should reject invalid image URLs', () => {
      const result = ImageOptimizationService.validateImageForPlatform(
        'invalid-url',
        Platform.FACEBOOK
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid image URL provided');
    });

    it('should validate supported image formats', () => {
      const jpgResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.INSTAGRAM
      );
      expect(jpgResult.isValid).toBe(true);

      const pngResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.png',
        Platform.INSTAGRAM
      );
      expect(pngResult.isValid).toBe(true);

      const bmpResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.bmp',
        Platform.INSTAGRAM
      );
      expect(bmpResult.isValid).toBe(false);
      expect(bmpResult.errors).toContain('Unsupported image format: bmp. Supported formats: jpg, jpeg, png');
    });

    it('should provide platform-specific suggestions', () => {
      const instagramResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.INSTAGRAM,
        'square'
      );
      expect(instagramResult.suggestions.length).toBeGreaterThan(0);

      const pinterestResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.PINTEREST
      );
      expect(pinterestResult.suggestions.length).toBeGreaterThan(0);

      const facebookResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.FACEBOOK,
        'feed'
      );
      expect(facebookResult.suggestions.length).toBeGreaterThan(0);

      const xResult = ImageOptimizationService.validateImageForPlatform(
        'https://example.com/image.jpg',
        Platform.X,
        'single'
      );
      expect(xResult.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('getOptimalDimensionsForPlatform', () => {
    it('should return optimal dimensions for each platform', () => {
      const facebookDimensions = ImageOptimizationService.getOptimalDimensionsForPlatform(Platform.FACEBOOK);
      expect(facebookDimensions).toEqual({ width: 1200, height: 630 });

      const instagramDimensions = ImageOptimizationService.getOptimalDimensionsForPlatform(Platform.INSTAGRAM, 'square');
      expect(instagramDimensions).toEqual({ width: 1080, height: 1080 });

      const pinterestDimensions = ImageOptimizationService.getOptimalDimensionsForPlatform(Platform.PINTEREST);
      expect(pinterestDimensions).toEqual({ width: 1000, height: 1500 });

      const xDimensions = ImageOptimizationService.getOptimalDimensionsForPlatform(Platform.X);
      expect(xDimensions).toEqual({ width: 1200, height: 675 });
    });

    it('should return null for unknown image types', () => {
      const result = ImageOptimizationService.getOptimalDimensionsForPlatform(Platform.FACEBOOK, 'unknown');
      expect(result).toBeNull();
    });
  });

  describe('calculateOptimalDimensions', () => {
    it('should maintain aspect ratio by default', () => {
      const result = ImageOptimizationService.calculateOptimalDimensions(800, 600, 400, 300);
      expect(result).toEqual({ width: 400, height: 300 });
    });

    it('should fit to width when original is wider', () => {
      const result = ImageOptimizationService.calculateOptimalDimensions(1600, 900, 800, 600);
      expect(result).toEqual({ width: 800, height: 450 });
    });

    it('should fit to height when original is taller', () => {
      const result = ImageOptimizationService.calculateOptimalDimensions(900, 1600, 600, 800);
      expect(result).toEqual({ width: 450, height: 800 });
    });

    it('should ignore aspect ratio when specified', () => {
      const result = ImageOptimizationService.calculateOptimalDimensions(800, 600, 400, 200, false);
      expect(result).toEqual({ width: 400, height: 200 });
    });
  });

  describe('generateImageOptimizationInstructions', () => {
    it('should generate platform-specific instructions', () => {
      const facebookInstructions = ImageOptimizationService.generateImageOptimizationInstructions(Platform.FACEBOOK);
      expect(facebookInstructions).toContain('Resize to 1200x630 pixels');
      expect(facebookInstructions).toContain('Use high-quality images for better engagement');
      expect(facebookInstructions).toContain('Avoid text overlay exceeding 20% of image area');

      const instagramInstructions = ImageOptimizationService.generateImageOptimizationInstructions(Platform.INSTAGRAM);
      expect(instagramInstructions).toContain('Use bright, high-contrast images');
      expect(instagramInstructions).toContain('Consider square format for feed posts');

      const pinterestInstructions = ImageOptimizationService.generateImageOptimizationInstructions(Platform.PINTEREST);
      expect(pinterestInstructions).toContain('Use vertical orientation (2:3 aspect ratio preferred)');
      expect(pinterestInstructions).toContain('Include text overlay for context');

      const xInstructions = ImageOptimizationService.generateImageOptimizationInstructions(Platform.X);
      expect(xInstructions).toContain('Use landscape orientation for single images');
      expect(xInstructions).toContain('Ensure text is readable at small sizes');
    });
  });

  describe('getImageTypeOptions', () => {
    it('should return available image types for each platform', () => {
      const facebookTypes = ImageOptimizationService.getImageTypeOptions(Platform.FACEBOOK);
      expect(facebookTypes).toContain('feed');
      expect(facebookTypes).toContain('story');
      expect(facebookTypes).toContain('cover');

      const instagramTypes = ImageOptimizationService.getImageTypeOptions(Platform.INSTAGRAM);
      expect(instagramTypes).toContain('square');
      expect(instagramTypes).toContain('portrait');
      expect(instagramTypes).toContain('landscape');
      expect(instagramTypes).toContain('story');

      const pinterestTypes = ImageOptimizationService.getImageTypeOptions(Platform.PINTEREST);
      expect(pinterestTypes).toContain('standard');
      expect(pinterestTypes).toContain('square');

      const xTypes = ImageOptimizationService.getImageTypeOptions(Platform.X);
      expect(xTypes).toContain('single');
      expect(xTypes).toContain('multiple');
      expect(xTypes).toContain('header');
    });
  });

  describe('validateImageDimensions', () => {
    it('should validate optimal dimensions', () => {
      const result = ImageOptimizationService.validateImageDimensions(1200, 630, Platform.FACEBOOK);
      expect(result.isOptimal).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about incorrect aspect ratios', () => {
      const result = ImageOptimizationService.validateImageDimensions(1000, 1000, Platform.FACEBOOK);
      expect(result.isOptimal).toBe(false);
      expect(result.warnings.some(w => w.includes('aspect ratio'))).toBe(true);
      expect(result.suggestions).toContain('Consider resizing to 1200x630 pixels');
    });

    it('should warn about low resolution images', () => {
      const result = ImageOptimizationService.validateImageDimensions(300, 150, Platform.FACEBOOK);
      expect(result.warnings).toContain('Image resolution is too low for optimal quality');
      expect(result.suggestions).toContain('Use higher resolution images for better display quality');
    });

    it('should suggest optimization for oversized images', () => {
      const result = ImageOptimizationService.validateImageDimensions(4800, 2520, Platform.FACEBOOK);
      expect(result.suggestions).toContain('Image is larger than necessary - consider optimizing file size');
    });

    it('should handle unknown image types', () => {
      const result = ImageOptimizationService.validateImageDimensions(1200, 630, Platform.FACEBOOK, 'unknown');
      expect(result.isOptimal).toBe(false);
      expect(result.warnings).toContain('Unknown image type');
    });
  });

  describe('estimateOptimizedFileSize', () => {
    it('should estimate file size with default compression', () => {
      const originalSize = 1000000; // 1MB
      const estimated = ImageOptimizationService.estimateOptimizedFileSize(originalSize);
      expect(estimated).toBe(700000); // 70% of original
    });

    it('should estimate file size with custom compression ratio', () => {
      const originalSize = 1000000; // 1MB
      const estimated = ImageOptimizationService.estimateOptimizedFileSize(originalSize, 0.5);
      expect(estimated).toBe(500000); // 50% of original
    });
  });
});
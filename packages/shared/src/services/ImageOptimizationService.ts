import { Platform } from '../types/platform';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageOptimizationOptions {
  platform: Platform;
  quality?: number; // 0-100
  format?: 'jpg' | 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

export interface OptimizedImage {
  url: string;
  width: number;
  height: number;
  format: string;
  fileSize: number;
  optimized: boolean;
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  recommendedDimensions?: ImageDimensions;
}

export class ImageOptimizationService {
  // Platform-specific image requirements
  private static readonly PLATFORM_IMAGE_SPECS = {
    [Platform.FACEBOOK]: {
      feed: { width: 1200, height: 630, aspectRatio: 1.91 },
      story: { width: 1080, height: 1920, aspectRatio: 0.56 },
      cover: { width: 1640, height: 859, aspectRatio: 1.91 },
      maxFileSize: 8 * 1024 * 1024, // 8MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif']
    },
    [Platform.INSTAGRAM]: {
      square: { width: 1080, height: 1080, aspectRatio: 1.0 },
      portrait: { width: 1080, height: 1350, aspectRatio: 0.8 },
      landscape: { width: 1080, height: 566, aspectRatio: 1.91 },
      story: { width: 1080, height: 1920, aspectRatio: 0.56 },
      maxFileSize: 30 * 1024 * 1024, // 30MB
      supportedFormats: ['jpg', 'jpeg', 'png']
    },
    [Platform.PINTEREST]: {
      standard: { width: 1000, height: 1500, aspectRatio: 0.67 },
      square: { width: 1000, height: 1000, aspectRatio: 1.0 },
      maxFileSize: 20 * 1024 * 1024, // 20MB
      supportedFormats: ['jpg', 'jpeg', 'png']
    },
    [Platform.X]: {
      single: { width: 1200, height: 675, aspectRatio: 1.78 },
      multiple: { width: 700, height: 800, aspectRatio: 0.875 },
      header: { width: 1500, height: 500, aspectRatio: 3.0 },
      maxFileSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif']
    }
  };

  public static validateImageForPlatform(
    imageUrl: string,
    platform: Platform,
    imageType: string = 'feed'
  ): ImageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic URL validation
    if (!this.isValidImageUrl(imageUrl)) {
      errors.push('Invalid image URL provided');
      return { isValid: false, errors, warnings, suggestions };
    }

    const specs = this.PLATFORM_IMAGE_SPECS[platform];
    const typeSpec = this.getImageTypeSpec(platform, imageType);

    // Check file format
    const fileExtension = this.getFileExtension(imageUrl);
    if (!specs.supportedFormats.includes(fileExtension)) {
      errors.push(`Unsupported image format: ${fileExtension}. Supported formats: ${specs.supportedFormats.join(', ')}`);
    }

    // Add platform-specific suggestions
    suggestions.push(...this.getPlatformSpecificSuggestions(platform, imageType));

    const result: ImageValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };

    if (typeSpec) {
      result.recommendedDimensions = {
        width: typeSpec.width,
        height: typeSpec.height
      };
    }

    return result;
  }

  public static getOptimalDimensionsForPlatform(
    platform: Platform,
    imageType: string = 'feed'
  ): ImageDimensions | null {
    // Use platform-specific default image types
    const defaultTypes: Record<Platform, string> = {
      [Platform.FACEBOOK]: 'feed',
      [Platform.INSTAGRAM]: 'square',
      [Platform.PINTEREST]: 'standard',
      [Platform.X]: 'single'
    };
    
    const actualImageType = imageType === 'feed' ? defaultTypes[platform] : imageType;
    const typeSpec = this.getImageTypeSpec(platform, actualImageType);
    return typeSpec ? { width: typeSpec.width, height: typeSpec.height } : null;
  }

  public static calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number,
    maintainAspectRatio: boolean = true
  ): ImageDimensions {
    if (!maintainAspectRatio) {
      return { width: targetWidth, height: targetHeight };
    }

    const originalAspectRatio = originalWidth / originalHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    if (originalAspectRatio > targetAspectRatio) {
      // Original is wider, fit to width
      return {
        width: targetWidth,
        height: Math.round(targetWidth / originalAspectRatio)
      };
    } else {
      // Original is taller, fit to height
      return {
        width: Math.round(targetHeight * originalAspectRatio),
        height: targetHeight
      };
    }
  }

  public static generateImageOptimizationInstructions(
    platform: Platform,
    imageType: string = 'feed'
  ): string[] {
    const instructions: string[] = [];
    const specs = this.PLATFORM_IMAGE_SPECS[platform];
    const typeSpec = this.getImageTypeSpec(platform, imageType);

    if (typeSpec) {
      instructions.push(`Resize to ${typeSpec.width}x${typeSpec.height} pixels`);
      instructions.push(`Maintain aspect ratio of ${typeSpec.aspectRatio.toFixed(2)}:1`);
    }

    instructions.push(`Use supported formats: ${specs.supportedFormats.join(', ')}`);
    instructions.push(`Keep file size under ${this.formatFileSize(specs.maxFileSize)}`);

    // Platform-specific instructions
    switch (platform) {
      case Platform.FACEBOOK:
        instructions.push('Use high-quality images for better engagement');
        instructions.push('Avoid text overlay exceeding 20% of image area');
        break;
      
      case Platform.INSTAGRAM:
        instructions.push('Use bright, high-contrast images');
        instructions.push('Consider square format for feed posts');
        instructions.push('Use portrait orientation for better mobile viewing');
        break;
      
      case Platform.PINTEREST:
        instructions.push('Use vertical orientation (2:3 aspect ratio preferred)');
        instructions.push('Include text overlay for context');
        instructions.push('Use bright, eye-catching colors');
        break;
      
      case Platform.X:
        instructions.push('Use landscape orientation for single images');
        instructions.push('Ensure text is readable at small sizes');
        instructions.push('Avoid cluttered compositions');
        break;
    }

    return instructions;
  }

  public static getImageTypeOptions(platform: Platform): string[] {
    const specs = this.PLATFORM_IMAGE_SPECS[platform];
    return Object.keys(specs).filter(key => 
      key !== 'maxFileSize' && key !== 'supportedFormats'
    );
  }

  public static estimateOptimizedFileSize(
    originalFileSize: number,
    compressionRatio: number = 0.7
  ): number {
    return Math.round(originalFileSize * compressionRatio);
  }

  public static validateImageDimensions(
    width: number,
    height: number,
    platform: Platform,
    imageType: string = 'feed'
  ): { isOptimal: boolean; warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const typeSpec = this.getImageTypeSpec(platform, imageType);

    if (!typeSpec) {
      return { isOptimal: false, warnings: ['Unknown image type'], suggestions: [] };
    }

    const actualAspectRatio = width / height;
    const targetAspectRatio = typeSpec.aspectRatio;
    const aspectRatioTolerance = 0.1;

    const isOptimal = Math.abs(actualAspectRatio - targetAspectRatio) <= aspectRatioTolerance;

    if (!isOptimal) {
      warnings.push(`Image aspect ratio (${actualAspectRatio.toFixed(2)}:1) doesn't match optimal ratio (${targetAspectRatio.toFixed(2)}:1)`);
      suggestions.push(`Consider resizing to ${typeSpec.width}x${typeSpec.height} pixels`);
    }

    // Check if dimensions are too small
    if (width < typeSpec.width * 0.5 || height < typeSpec.height * 0.5) {
      warnings.push('Image resolution is too low for optimal quality');
      suggestions.push('Use higher resolution images for better display quality');
    }

    // Check if dimensions are much larger than needed
    if (width > typeSpec.width * 2 || height > typeSpec.height * 2) {
      suggestions.push('Image is larger than necessary - consider optimizing file size');
    }

    return { isOptimal, warnings, suggestions };
  }

  private static getImageTypeSpec(platform: Platform, imageType: string): { width: number; height: number; aspectRatio: number } | undefined {
    const specs = this.PLATFORM_IMAGE_SPECS[platform];
    const spec = specs[imageType as keyof typeof specs];
    
    // Type guard to ensure we return the correct type
    if (spec && typeof spec === 'object' && 'width' in spec && 'height' in spec && 'aspectRatio' in spec) {
      return spec as { width: number; height: number; aspectRatio: number };
    }
    
    return undefined;
  }

  private static isValidImageUrl(url: string): boolean {
    try {
      new URL(url);
      return true; // Just validate URL format, not file extension
    } catch {
      return false;
    }
  }

  private static getFileExtension(url: string): string {
    const pathname = new URL(url).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase() || '';
    return extension === 'jpeg' ? 'jpg' : extension;
  }

  private static getPlatformSpecificSuggestions(platform: Platform, imageType: string): string[] {
    const suggestions: string[] = [];

    switch (platform) {
      case Platform.FACEBOOK:
        if (imageType === 'feed') {
          suggestions.push('Use landscape orientation for link posts');
          suggestions.push('Include minimal text overlay for better reach');
        }
        break;
      
      case Platform.INSTAGRAM:
        if (imageType === 'square') {
          suggestions.push('Square images work well for product shots');
        } else if (imageType === 'portrait') {
          suggestions.push('Portrait images get more screen real estate on mobile');
        }
        break;
      
      case Platform.PINTEREST:
        suggestions.push('Vertical images (2:3 ratio) perform best on Pinterest');
        suggestions.push('Add text overlay to provide context');
        break;
      
      case Platform.X:
        if (imageType === 'single') {
          suggestions.push('Use 16:9 aspect ratio for single images');
        }
        break;
    }

    return suggestions;
  }

  private static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
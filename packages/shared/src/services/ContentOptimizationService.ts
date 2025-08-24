import { Platform, PlatformContent } from '../types/platform';
import { PostData } from '../types/post';
import { PLATFORM_CHARACTER_LIMITS, PLATFORM_HASHTAG_LIMITS, PLATFORM_IMAGE_LIMITS } from '../constants/platforms';

export interface OptimizationResult {
  optimizedContent: PlatformContent;
  warnings: string[];
  suggestions: string[];
  truncated: boolean;
}

export interface ImageOptimizationSpec {
  maxWidth: number;
  maxHeight: number;
  aspectRatio?: number;
  maxFileSize: number; // in bytes
  formats: string[];
}

export interface PlatformOptimizationRules {
  characterLimit: number;
  hashtagLimit: number;
  imageLimit: number;
  imageSpecs: ImageOptimizationSpec[];
  contentRules: ContentRule[];
  hashtagRules: HashtagRule[];
}

export interface ContentRule {
  type: 'format' | 'style' | 'structure';
  description: string;
  apply: (content: string) => string;
}

export interface HashtagRule {
  type: 'limit' | 'format' | 'placement' | 'suggestion';
  description: string;
  validate: (hashtags: string[]) => boolean;
  suggest?: (content: string) => string[];
}

export class ContentOptimizationService {
  private static readonly PLATFORM_RULES: Record<Platform, PlatformOptimizationRules> = {
    [Platform.FACEBOOK]: {
      characterLimit: PLATFORM_CHARACTER_LIMITS[Platform.FACEBOOK],
      hashtagLimit: PLATFORM_HASHTAG_LIMITS[Platform.FACEBOOK],
      imageLimit: PLATFORM_IMAGE_LIMITS[Platform.FACEBOOK],
      imageSpecs: [
        {
          maxWidth: 1200,
          maxHeight: 630,
          aspectRatio: 1.91,
          maxFileSize: 8 * 1024 * 1024, // 8MB
          formats: ['jpg', 'jpeg', 'png', 'gif']
        }
      ],
      contentRules: [
        {
          type: 'format',
          description: 'Add line breaks for readability',
          apply: (content: string) => content.replace(/\. /g, '.\n\n')
        },
        {
          type: 'style',
          description: 'Encourage engagement with questions',
          apply: (content: string) => content
        }
      ],
      hashtagRules: [
        {
          type: 'limit',
          description: 'Use 1-3 hashtags for better engagement',
          validate: (hashtags: string[]) => hashtags.length <= 3
        },
        {
          type: 'placement',
          description: 'Place hashtags at the end of the post',
          validate: () => true
        }
      ]
    },
    [Platform.INSTAGRAM]: {
      characterLimit: PLATFORM_CHARACTER_LIMITS[Platform.INSTAGRAM],
      hashtagLimit: PLATFORM_HASHTAG_LIMITS[Platform.INSTAGRAM],
      imageLimit: PLATFORM_IMAGE_LIMITS[Platform.INSTAGRAM],
      imageSpecs: [
        {
          maxWidth: 1080,
          maxHeight: 1080,
          aspectRatio: 1,
          maxFileSize: 30 * 1024 * 1024, // 30MB
          formats: ['jpg', 'jpeg', 'png']
        },
        {
          maxWidth: 1080,
          maxHeight: 1350,
          aspectRatio: 0.8,
          maxFileSize: 30 * 1024 * 1024,
          formats: ['jpg', 'jpeg', 'png']
        }
      ],
      contentRules: [
        {
          type: 'format',
          description: 'Use line breaks and emojis for visual appeal',
          apply: (content: string) => content
        },
        {
          type: 'structure',
          description: 'Keep first line engaging as it shows in feed',
          apply: (content: string) => content
        }
      ],
      hashtagRules: [
        {
          type: 'limit',
          description: 'Use 5-10 hashtags for optimal reach',
          validate: (hashtags: string[]) => hashtags.length >= 5 && hashtags.length <= 10
        },
        {
          type: 'suggestion',
          description: 'Mix popular and niche hashtags',
          validate: () => true,
          suggest: (content: string) => ContentOptimizationService.suggestInstagramHashtags(content)
        }
      ]
    },
    [Platform.PINTEREST]: {
      characterLimit: PLATFORM_CHARACTER_LIMITS[Platform.PINTEREST],
      hashtagLimit: PLATFORM_HASHTAG_LIMITS[Platform.PINTEREST],
      imageLimit: PLATFORM_IMAGE_LIMITS[Platform.PINTEREST],
      imageSpecs: [
        {
          maxWidth: 1000,
          maxHeight: 1500,
          aspectRatio: 0.67,
          maxFileSize: 20 * 1024 * 1024, // 20MB
          formats: ['jpg', 'jpeg', 'png']
        }
      ],
      contentRules: [
        {
          type: 'format',
          description: 'Include keywords for searchability',
          apply: (content: string) => content
        },
        {
          type: 'style',
          description: 'Use descriptive, keyword-rich text',
          apply: (content: string) => content
        }
      ],
      hashtagRules: [
        {
          type: 'limit',
          description: 'Use 2-5 hashtags for best performance',
          validate: (hashtags: string[]) => hashtags.length >= 2 && hashtags.length <= 5
        },
        {
          type: 'suggestion',
          description: 'Use broad, searchable hashtags',
          validate: () => true,
          suggest: (content: string) => ContentOptimizationService.suggestPinterestHashtags(content)
        }
      ]
    },
    [Platform.X]: {
      characterLimit: PLATFORM_CHARACTER_LIMITS[Platform.X],
      hashtagLimit: PLATFORM_HASHTAG_LIMITS[Platform.X],
      imageLimit: PLATFORM_IMAGE_LIMITS[Platform.X],
      imageSpecs: [
        {
          maxWidth: 1200,
          maxHeight: 675,
          aspectRatio: 1.78,
          maxFileSize: 5 * 1024 * 1024, // 5MB
          formats: ['jpg', 'jpeg', 'png', 'gif']
        }
      ],
      contentRules: [
        {
          type: 'format',
          description: 'Keep content concise and impactful',
          apply: (content: string) => content
        },
        {
          type: 'style',
          description: 'Use threads for longer content',
          apply: (content: string) => content
        }
      ],
      hashtagRules: [
        {
          type: 'limit',
          description: 'Use 1-2 hashtags maximum',
          validate: (hashtags: string[]) => hashtags.length <= 2
        },
        {
          type: 'suggestion',
          description: 'Use trending or branded hashtags',
          validate: () => true,
          suggest: (content: string) => ContentOptimizationService.suggestXHashtags(content)
        }
      ]
    }
  };

  public static optimizeContentForPlatform(
    post: PostData,
    platform: Platform
  ): OptimizationResult {
    const rules = this.PLATFORM_RULES[platform];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let truncated = false;

    // Start with original content
    let optimizedContent = post.content;
    let optimizedHashtags = post.hashtags || [];
    const optimizedImages = post.images || [];

    // Apply content formatting rules
    for (const rule of rules.contentRules) {
      optimizedContent = rule.apply(optimizedContent);
    }

    // Check character limits and truncate if necessary
    const totalLength = optimizedContent.length + 
      (optimizedHashtags.length > 0 ? optimizedHashtags.join(' ').length + 2 : 0);

    if (totalLength > rules.characterLimit) {
      const availableSpace = rules.characterLimit - 
        (optimizedHashtags.length > 0 ? optimizedHashtags.join(' ').length + 2 : 0);
      
      if (availableSpace > 0) {
        optimizedContent = this.truncateContent(optimizedContent, availableSpace);
        truncated = true;
        warnings.push(`Content was truncated to fit ${platform} character limit`);
      } else {
        // Remove some hashtags if content + hashtags exceed limit
        const hashtagsToRemove = Math.ceil((totalLength - rules.characterLimit) / 10);
        optimizedHashtags = optimizedHashtags.slice(0, -hashtagsToRemove);
        warnings.push(`Removed ${hashtagsToRemove} hashtags to fit character limit`);
      }
    }

    // Validate and optimize hashtags
    const hashtagValidation = this.validateHashtags(optimizedHashtags, platform);
    if (!hashtagValidation.isValid) {
      warnings.push(...hashtagValidation.warnings);
      suggestions.push(...hashtagValidation.suggestions);
    }

    // Suggest hashtags if none provided or too few
    if (optimizedHashtags.length === 0) {
      const suggestedHashtags = this.suggestHashtagsForPlatform(optimizedContent, platform);
      if (suggestedHashtags.length > 0) {
        suggestions.push(`Consider adding hashtags: ${suggestedHashtags.slice(0, 3).join(', ')}`);
      }
    }

    // Validate images
    if (optimizedImages.length > rules.imageLimit) {
      warnings.push(`Too many images for ${platform}. Maximum: ${rules.imageLimit}`);
    }

    // Add platform-specific suggestions
    suggestions.push(...this.getPlatformSpecificSuggestions(platform, optimizedContent, optimizedHashtags));

    return {
      optimizedContent: {
        content: optimizedContent,
        hashtags: optimizedHashtags,
        images: optimizedImages,
        platformSpecific: this.getPlatformSpecificData(platform, post)
      },
      warnings,
      suggestions,
      truncated
    };
  }

  private static truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at sentence boundary
    const sentences = content.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence + '.').length <= maxLength - 3) {
        truncated += sentence + '.';
      } else {
        break;
      }
    }

    if (truncated.length > 0) {
      return truncated + '...';
    }

    // Fallback to word boundary
    const words = content.split(' ');
    truncated = '';
    
    for (const word of words) {
      if ((truncated + ' ' + word).length <= maxLength - 3) {
        truncated += (truncated ? ' ' : '') + word;
      } else {
        break;
      }
    }

    return truncated + '...';
  }

  private static validateHashtags(hashtags: string[], platform: Platform): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const rules = this.PLATFORM_RULES[platform];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check hashtag count
    if (hashtags.length > rules.hashtagLimit) {
      warnings.push(`Too many hashtags for ${platform}. Maximum: ${rules.hashtagLimit}`);
    }

    // Apply platform-specific hashtag rules
    for (const rule of rules.hashtagRules) {
      if (!rule.validate(hashtags)) {
        suggestions.push(rule.description);
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }

  private static suggestHashtagsForPlatform(content: string, platform: Platform): string[] {
    const rules = this.PLATFORM_RULES[platform];
    
    for (const rule of rules.hashtagRules) {
      if (rule.suggest) {
        return rule.suggest(content);
      }
    }

    return [];
  }

  private static suggestInstagramHashtags(content: string): string[] {
    // Basic keyword extraction for Instagram hashtags
    const keywords = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5);

    return keywords.map(keyword => `#${keyword}`);
  }

  private static suggestPinterestHashtags(content: string): string[] {
    // Pinterest prefers broader, searchable hashtags
    const broadKeywords = ['inspiration', 'ideas', 'design', 'lifestyle', 'tips'];
    return broadKeywords.slice(0, 3).map(keyword => `#${keyword}`);
  }

  private static suggestXHashtags(content: string): string[] {
    // X prefers fewer, more targeted hashtags
    const keywords = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 2);

    return keywords.map(keyword => `#${keyword}`);
  }

  private static getPlatformSpecificSuggestions(
    platform: Platform,
    content: string,
    hashtags: string[]
  ): string[] {
    const suggestions: string[] = [];

    switch (platform) {
      case Platform.FACEBOOK:
        if (!content.includes('?')) {
          suggestions.push('Consider adding a question to encourage engagement');
        }
        break;
      
      case Platform.INSTAGRAM:
        if (content.length < 100) {
          suggestions.push('Instagram posts perform better with more detailed captions');
        }
        break;
      
      case Platform.PINTEREST:
        if (!content.includes('how to') && !content.includes('tips')) {
          suggestions.push('Pinterest users love actionable content - consider adding "how to" or tips');
        }
        break;
      
      case Platform.X:
        if (content.length > 200) {
          suggestions.push('Consider breaking long content into a thread');
        }
        break;
    }

    return suggestions;
  }

  private static getPlatformSpecificData(platform: Platform, post: PostData): Record<string, any> {
    const platformData: Record<string, any> = {};

    switch (platform) {
      case Platform.FACEBOOK:
        platformData.linkPreview = true;
        platformData.targeting = 'broad';
        break;
      
      case Platform.INSTAGRAM:
        platformData.altText = 'Auto-generated alt text for accessibility';
        platformData.location = null;
        break;
      
      case Platform.PINTEREST:
        platformData.boardId = null;
        platformData.link = null;
        break;
      
      case Platform.X:
        platformData.replySettings = 'everyone';
        platformData.sensitive = false;
        break;
    }

    return platformData;
  }

  public static getImageOptimizationSpecs(platform: Platform): ImageOptimizationSpec[] {
    return this.PLATFORM_RULES[platform].imageSpecs;
  }

  public static validateImageForPlatform(
    imageUrl: string,
    platform: Platform
  ): { isValid: boolean; warnings: string[]; suggestions: string[] } {
    const specs = this.getImageOptimizationSpecs(platform);
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      return {
        isValid: false,
        warnings: ['Invalid image URL'],
        suggestions: ['Please provide a valid image URL']
      };
    }

    // Check file extension
    const supportedFormats = specs[0]?.formats || [];
    const hasValidFormat = supportedFormats.some(format => 
      imageUrl.toLowerCase().includes(`.${format}`)
    );

    if (!hasValidFormat) {
      warnings.push(`Image format may not be supported. Supported formats: ${supportedFormats.join(', ')}`);
    }

    // Platform-specific suggestions
    switch (platform) {
      case Platform.INSTAGRAM:
        suggestions.push('Use square (1:1) or portrait (4:5) aspect ratios for best results');
        break;
      case Platform.PINTEREST:
        suggestions.push('Use vertical images (2:3 aspect ratio) for maximum visibility');
        break;
      case Platform.FACEBOOK:
        suggestions.push('Use landscape images (1.91:1 aspect ratio) for link posts');
        break;
      case Platform.X:
        suggestions.push('Use landscape images (16:9 aspect ratio) for better display');
        break;
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }
}
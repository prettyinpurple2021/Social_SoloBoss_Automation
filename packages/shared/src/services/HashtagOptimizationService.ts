import { Platform } from '../types/platform';
import { PLATFORM_HASHTAG_LIMITS } from '../constants/platforms';

export interface HashtagSuggestion {
  hashtag: string;
  popularity: 'high' | 'medium' | 'low';
  category: string;
  reason: string;
}

export interface HashtagAnalysis {
  isOptimal: boolean;
  count: number;
  maxRecommended: number;
  suggestions: HashtagSuggestion[];
  warnings: string[];
  improvements: string[];
}

export interface HashtagValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: HashtagSuggestion[];
}

export interface HashtagOptimizationOptions {
  platform: Platform;
  contentContext: string;
  existingHashtags?: string[];
  includePopular?: boolean;
  includeNiche?: boolean;
}

export class HashtagOptimizationService {
  // Platform-specific hashtag best practices
  private static readonly PLATFORM_HASHTAG_RULES = {
    [Platform.FACEBOOK]: {
      optimal: { min: 1, max: 3 },
      placement: 'end',
      style: 'minimal',
      categories: ['branded', 'community', 'trending']
    },
    [Platform.INSTAGRAM]: {
      optimal: { min: 5, max: 10 },
      placement: 'end',
      style: 'diverse',
      categories: ['niche', 'popular', 'branded', 'community', 'location']
    },
    [Platform.PINTEREST]: {
      optimal: { min: 2, max: 5 },
      placement: 'integrated',
      style: 'descriptive',
      categories: ['broad', 'searchable', 'descriptive']
    },
    [Platform.X]: {
      optimal: { min: 1, max: 2 },
      placement: 'integrated',
      style: 'targeted',
      categories: ['trending', 'branded', 'event']
    }
  };

  // Common hashtag categories with examples
  private static readonly HASHTAG_CATEGORIES = {
    business: ['#entrepreneur', '#startup', '#business', '#marketing', '#success'],
    lifestyle: ['#lifestyle', '#wellness', '#selfcare', '#mindfulness', '#inspiration'],
    technology: ['#tech', '#innovation', '#digital', '#ai', '#software'],
    creative: ['#design', '#art', '#creative', '#photography', '#content'],
    food: ['#food', '#recipe', '#cooking', '#healthy', '#nutrition'],
    travel: ['#travel', '#adventure', '#explore', '#wanderlust', '#vacation'],
    fitness: ['#fitness', '#workout', '#health', '#gym', '#motivation'],
    fashion: ['#fashion', '#style', '#outfit', '#trend', '#beauty']
  };

  public static validateHashtags(
    hashtags: string[],
    platform: Platform,
    contentContext?: string
  ): HashtagValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: HashtagSuggestion[] = [];

    const rules = this.PLATFORM_HASHTAG_RULES[platform];
    const maxLimit = PLATFORM_HASHTAG_LIMITS[platform];

    // Check basic format
    for (const hashtag of hashtags) {
      if (!hashtag.startsWith('#')) {
        errors.push(`Hashtag "${hashtag}" must start with #`);
      }
      if (hashtag.length < 2) {
        errors.push(`Hashtag "${hashtag}" is too short`);
      }
      if (hashtag.length > 100) {
        errors.push(`Hashtag "${hashtag}" is too long (max 100 characters)`);
      }
      if (!/^#[a-zA-Z0-9_]+$/.test(hashtag)) {
        errors.push(`Hashtag "${hashtag}" contains invalid characters`);
      }
    }

    // Check count limits
    if (hashtags.length > maxLimit) {
      errors.push(`Too many hashtags (${hashtags.length}). Maximum for ${platform}: ${maxLimit}`);
    }

    if (hashtags.length < rules.optimal.min) {
      warnings.push(`Consider adding more hashtags. Optimal range for ${platform}: ${rules.optimal.min}-${rules.optimal.max}`);
    }

    if (hashtags.length > rules.optimal.max) {
      warnings.push(`Consider reducing hashtags. Optimal range for ${platform}: ${rules.optimal.min}-${rules.optimal.max}`);
    }

    // Generate suggestions if content context is provided
    if (contentContext && hashtags.length < rules.optimal.max) {
      const suggestedHashtags = this.suggestHashtagsForContent(contentContext, platform);
      suggestions.push(...suggestedHashtags.slice(0, rules.optimal.max - hashtags.length));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  public static analyzeHashtags(
    hashtags: string[],
    platform: Platform,
    contentContext?: string
  ): HashtagAnalysis {
    const rules = this.PLATFORM_HASHTAG_RULES[platform];
    const validation = this.validateHashtags(hashtags, platform, contentContext);
    
    const isOptimal = validation.isValid && 
      hashtags.length >= rules.optimal.min && 
      hashtags.length <= rules.optimal.max;

    const improvements: string[] = [];

    // Platform-specific improvements
    switch (platform) {
      case Platform.FACEBOOK:
        if (hashtags.length > 3) {
          improvements.push('Facebook posts perform better with 1-3 hashtags');
        }
        break;
      
      case Platform.INSTAGRAM:
        if (hashtags.length < 5) {
          improvements.push('Instagram posts can benefit from 5-10 relevant hashtags');
        }
        if (!this.hasMixOfPopularAndNiche(hashtags)) {
          improvements.push('Mix popular and niche hashtags for better reach');
        }
        break;
      
      case Platform.PINTEREST:
        if (!this.hasDescriptiveHashtags(hashtags)) {
          improvements.push('Use descriptive, searchable hashtags on Pinterest');
        }
        break;
      
      case Platform.X:
        if (hashtags.length > 2) {
          improvements.push('X posts work best with 1-2 focused hashtags');
        }
        break;
    }

    return {
      isOptimal,
      count: hashtags.length,
      maxRecommended: rules.optimal.max,
      suggestions: validation.suggestions,
      warnings: validation.warnings,
      improvements
    };
  }

  public static suggestHashtagsForContent(
    content: string,
    platform: Platform,
    options: Partial<HashtagOptimizationOptions> = {}
  ): HashtagSuggestion[] {
    const rules = this.PLATFORM_HASHTAG_RULES[platform];
    const suggestions: HashtagSuggestion[] = [];

    // Extract keywords from content
    const keywords = this.extractKeywords(content);
    
    // Get category-based suggestions
    const categoryHashtags = this.getCategoryHashtags(content);
    
    // Platform-specific suggestion logic
    switch (platform) {
      case Platform.FACEBOOK:
        suggestions.push(...this.getFacebookHashtags(keywords, categoryHashtags));
        break;
      
      case Platform.INSTAGRAM:
        suggestions.push(...this.getInstagramHashtags(keywords, categoryHashtags));
        break;
      
      case Platform.PINTEREST:
        suggestions.push(...this.getPinterestHashtags(keywords, categoryHashtags));
        break;
      
      case Platform.X:
        suggestions.push(...this.getXHashtags(keywords, categoryHashtags));
        break;
    }

    // Limit to optimal count
    return suggestions.slice(0, rules.optimal.max);
  }

  public static optimizeHashtagsForPlatform(
    hashtags: string[],
    platform: Platform,
    contentContext?: string
  ): { optimized: string[]; changes: string[] } {
    const rules = this.PLATFORM_HASHTAG_RULES[platform];
    const changes: string[] = [];
    let optimized = [...hashtags];

    // Remove duplicates
    const originalLength = optimized.length;
    optimized = [...new Set(optimized)];
    if (optimized.length < originalLength) {
      changes.push(`Removed ${originalLength - optimized.length} duplicate hashtags`);
    }

    // Trim to optimal count
    if (optimized.length > rules.optimal.max) {
      optimized = optimized.slice(0, rules.optimal.max);
      changes.push(`Reduced to ${rules.optimal.max} hashtags for optimal ${platform} performance`);
    }

    // Add suggestions if below minimum
    if (optimized.length < rules.optimal.min && contentContext) {
      const suggestions = this.suggestHashtagsForContent(contentContext, platform);
      const needed = rules.optimal.min - optimized.length;
      const toAdd = suggestions.slice(0, needed).map(s => s.hashtag);
      optimized.push(...toAdd);
      if (toAdd.length > 0) {
        changes.push(`Added ${toAdd.length} suggested hashtags: ${toAdd.join(', ')}`);
      }
    }

    return { optimized, changes };
  }

  private static extractKeywords(content: string): string[] {
    // Simple keyword extraction
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Get unique words and sort by frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private static getCategoryHashtags(content: string): string[] {
    const contentLower = content.toLowerCase();
    const matchedHashtags: string[] = [];

    for (const [category, hashtags] of Object.entries(this.HASHTAG_CATEGORIES)) {
      if (contentLower.includes(category) || 
          hashtags.some(tag => contentLower.includes(tag.substring(1)))) {
        matchedHashtags.push(...hashtags.slice(0, 2));
      }
    }

    return matchedHashtags;
  }

  private static getFacebookHashtags(keywords: string[], categoryHashtags: string[]): HashtagSuggestion[] {
    const suggestions: HashtagSuggestion[] = [];
    
    // Facebook prefers fewer, more targeted hashtags
    if (keywords.length > 0) {
      suggestions.push({
        hashtag: `#${keywords[0]}`,
        popularity: 'medium',
        category: 'content-based',
        reason: 'Derived from main content topic'
      });
    }

    if (categoryHashtags.length > 0 && categoryHashtags[0]) {
      suggestions.push({
        hashtag: categoryHashtags[0],
        popularity: 'high',
        category: 'community',
        reason: 'Popular community hashtag'
      });
    }

    return suggestions.slice(0, 3);
  }

  private static getInstagramHashtags(keywords: string[], categoryHashtags: string[]): HashtagSuggestion[] {
    const suggestions: HashtagSuggestion[] = [];
    
    // Mix of popular and niche hashtags
    keywords.slice(0, 5).forEach(keyword => {
      suggestions.push({
        hashtag: `#${keyword}`,
        popularity: 'medium',
        category: 'niche',
        reason: 'Content-specific niche hashtag'
      });
    });

    categoryHashtags.slice(0, 5).forEach(hashtag => {
      suggestions.push({
        hashtag,
        popularity: 'high',
        category: 'popular',
        reason: 'Popular category hashtag'
      });
    });

    return suggestions.slice(0, 10);
  }

  private static getPinterestHashtags(keywords: string[], categoryHashtags: string[]): HashtagSuggestion[] {
    const suggestions: HashtagSuggestion[] = [];
    
    // Pinterest prefers broad, searchable hashtags
    keywords.slice(0, 3).forEach(keyword => {
      suggestions.push({
        hashtag: `#${keyword}`,
        popularity: 'medium',
        category: 'searchable',
        reason: 'Searchable content hashtag'
      });
    });

    // Add broad category hashtags
    const broadHashtags = ['#ideas', '#inspiration', '#tips', '#diy', '#howto'];
    broadHashtags.slice(0, 2).forEach(hashtag => {
      suggestions.push({
        hashtag,
        popularity: 'high',
        category: 'broad',
        reason: 'Broad discovery hashtag'
      });
    });

    return suggestions.slice(0, 5);
  }

  private static getXHashtags(keywords: string[], categoryHashtags: string[]): HashtagSuggestion[] {
    const suggestions: HashtagSuggestion[] = [];
    
    // X prefers fewer, more targeted hashtags
    if (keywords.length > 0) {
      suggestions.push({
        hashtag: `#${keywords[0]}`,
        popularity: 'medium',
        category: 'targeted',
        reason: 'Main topic hashtag'
      });
    }

    // Add trending or branded hashtag
    suggestions.push({
      hashtag: '#trending',
      popularity: 'high',
      category: 'trending',
      reason: 'Trending topic hashtag'
    });

    return suggestions.slice(0, 2);
  }

  private static hasMixOfPopularAndNiche(hashtags: string[]): boolean {
    // Simple heuristic: assume shorter hashtags are more popular
    const popular = hashtags.filter(tag => tag.length <= 10).length;
    const niche = hashtags.filter(tag => tag.length > 10).length;
    return popular > 0 && niche > 0;
  }

  private static hasDescriptiveHashtags(hashtags: string[]): boolean {
    // Check if hashtags are descriptive (longer than 5 characters)
    return hashtags.some(tag => tag.length > 5);
  }

  private static isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
    return stopWords.includes(word);
  }
}
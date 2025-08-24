import { ContentTemplateModel, ContentTemplateRow, TemplateVariable } from '../models/ContentTemplate';
import { Platform } from '../types/database';
import { BloggerPost } from '../types/blogger';
import { SoloBossContent } from '../../../shared/src/types/post';
import { loggerService } from './LoggerService';

export interface TransformationContext {
  userId: string;
  platform: Platform;
  sourceType: 'blogger' | 'soloboss' | 'manual';
  sourceData: BloggerPost | SoloBossContent | Record<string, any>;
  customVariables?: Record<string, string>;
}

export interface TransformationResult {
  content: string;
  hashtags: string[];
  images: string[];
  metadata: Record<string, any>;
  templateUsed?: string;
}

export interface ContentFilter {
  name: string;
  description: string;
  apply: (content: string, options?: Record<string, any>) => string;
}

export class ContentTransformationService {
  private static instance: ContentTransformationService;
  private filters: Map<string, ContentFilter> = new Map();

  private constructor() {
    this.initializeDefaultFilters();
  }

  public static getInstance(): ContentTransformationService {
    if (!ContentTransformationService.instance) {
      ContentTransformationService.instance = new ContentTransformationService();
    }
    return ContentTransformationService.instance;
  }

  /**
   * Transform content using templates and filters
   */
  async transformContent(context: TransformationContext): Promise<TransformationResult> {
    try {
      loggerService.info('Starting content transformation', {
        userId: context.userId,
        platform: context.platform,
        sourceType: context.sourceType
      });

      // Find appropriate template
      const template = await this.findBestTemplate(context);
      
      if (!template) {
        // Fallback to default transformation
        return this.defaultTransformation(context);
      }

      // Extract variables from source data
      const variables = this.extractVariables(context.sourceData, context.sourceType);
      
      // Merge with custom variables
      const allVariables = { ...variables, ...context.customVariables };

      // Apply template
      let transformedContent = this.applyTemplate(template.template_content, allVariables);

      // Apply platform-specific optimizations
      transformedContent = this.optimizeForPlatform(transformedContent, context.platform);

      // Extract hashtags and images
      const hashtags = this.extractHashtags(context.sourceData, context.sourceType);
      const images = this.extractImages(context.sourceData, context.sourceType);

      // Apply content filters if specified in template variables
      if (template.variables.includes('filters')) {
        transformedContent = this.applyFilters(transformedContent, allVariables.filters);
      }

      loggerService.info('Content transformation completed', {
        userId: context.userId,
        templateUsed: template.name,
        contentLength: transformedContent.length
      });

      return {
        content: transformedContent,
        hashtags,
        images,
        metadata: {
          templateId: template.id,
          templateName: template.name,
          variablesUsed: Object.keys(allVariables)
        },
        templateUsed: template.name
      };

    } catch (error) {
      loggerService.error('Content transformation failed', error as Error, {
        userId: context.userId,
        platform: context.platform,
        sourceType: context.sourceType
      });

      // Fallback to default transformation
      return this.defaultTransformation(context);
    }
  }

  /**
   * Find the best template for the given context
   */
  private async findBestTemplate(context: TransformationContext): Promise<ContentTemplateRow | null> {
    // First, try to find platform-specific template
    let templates = await ContentTemplateModel.findActiveTemplates(
      context.userId,
      context.sourceType,
      context.platform
    );

    if (templates.length > 0) {
      return templates[0]; // Return the most recent one
    }

    // Fallback to general templates
    templates = await ContentTemplateModel.findActiveTemplates(
      context.userId,
      context.sourceType
    );

    return templates.length > 0 ? templates[0] : null;
  }

  /**
   * Extract variables from source data
   */
  private extractVariables(sourceData: any, sourceType: string): Record<string, string> {
    const variables: Record<string, string> = {};

    if (sourceType === 'blogger' && this.isBloggerPost(sourceData)) {
      variables.title = sourceData.title || '';
      variables.content = sourceData.excerpt || this.truncateContent(sourceData.content, 300);
      variables.url = sourceData.url || '';
      variables.author = sourceData.author || '';
      variables.date = sourceData.publishedAt ? this.formatDate(sourceData.publishedAt) : '';
      variables.blog_name = this.extractBlogName(sourceData.url);
      variables.categories = sourceData.categories ? sourceData.categories.join(', ') : '';
      variables.excerpt = sourceData.excerpt || '';
    } else if (sourceType === 'soloboss' && this.isSoloBossContent(sourceData)) {
      variables.title = sourceData.title || '';
      variables.content = sourceData.socialMediaText || this.truncateContent(sourceData.content, 300);
      variables.url = ''; // SoloBoss content might not have a URL
      variables.author = ''; // SoloBoss content might not have an author
      variables.date = sourceData.publishedAt ? this.formatDate(sourceData.publishedAt) : '';
      variables.seo_suggestions = sourceData.seoSuggestions ? sourceData.seoSuggestions.join(', ') : '';
      variables.social_text = sourceData.socialMediaText || '';
      variables.keywords = this.extractKeywords(sourceData.seoSuggestions || []);
    }

    // Add current date/time variables
    const now = new Date();
    variables.current_date = this.formatDate(now);
    variables.current_time = now.toLocaleTimeString();

    return variables;
  }

  /**
   * Apply template with variable substitution
   */
  private applyTemplate(template: string, variables: Record<string, string>): string {
    let result = template;

    // Replace variables in format {{variable_name}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, value || '');
    }

    // Handle conditional blocks {{#if variable}}content{{/if}}
    result = this.processConditionals(result, variables);

    // Handle loops {{#each array}}content{{/each}}
    result = this.processLoops(result, variables);

    // Clean up any remaining template syntax
    result = result.replace(/{{[^}]*}}/g, '');

    return result.trim();
  }

  /**
   * Process conditional blocks in templates
   */
  private processConditionals(template: string, variables: Record<string, string>): string {
    const conditionalRegex = /{{#if\s+(\w+)}}(.*?){{\/if}}/gs;
    
    return template.replace(conditionalRegex, (match, variable, content) => {
      const value = variables[variable];
      return value && value.trim() ? content : '';
    });
  }

  /**
   * Process loop blocks in templates
   */
  private processLoops(template: string, variables: Record<string, string>): string {
    const loopRegex = /{{#each\s+(\w+)}}(.*?){{\/each}}/gs;
    
    return template.replace(loopRegex, (match, variable, content) => {
      const value = variables[variable];
      if (!value) return '';

      // Split by comma and process each item
      const items = value.split(',').map(item => item.trim()).filter(item => item);
      return items.map(item => content.replace(/{{this}}/g, item)).join(' ');
    });
  }

  /**
   * Optimize content for specific platform
   */
  private optimizeForPlatform(content: string, platform: Platform): string {
    switch (platform) {
      case Platform.X:
        return this.optimizeForTwitter(content);
      case Platform.INSTAGRAM:
        return this.optimizeForInstagram(content);
      case Platform.FACEBOOK:
        return this.optimizeForFacebook(content);
      case Platform.PINTEREST:
        return this.optimizeForPinterest(content);
      default:
        return content;
    }
  }

  /**
   * Twitter-specific optimizations
   */
  private optimizeForTwitter(content: string): string {
    const maxLength = 280;
    
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at sentence boundary
    const sentences = content.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const potential = result + sentence + '.';
      if (potential.length > maxLength - 3) break;
      result = potential;
    }

    if (result.length === 0) {
      // Fallback to word boundary
      const words = content.split(' ');
      result = words.slice(0, -1).join(' ');
      while (result.length > maxLength - 3) {
        const wordArray = result.split(' ');
        wordArray.pop();
        result = wordArray.join(' ');
      }
    }

    return result + (result.length < content.length ? '...' : '');
  }

  /**
   * Instagram-specific optimizations
   */
  private optimizeForInstagram(content: string): string {
    const maxLength = 2200;
    
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Facebook-specific optimizations
   */
  private optimizeForFacebook(content: string): string {
    // Facebook has no strict character limit, but shorter posts perform better
    const optimalLength = 500;
    
    if (content.length <= optimalLength) {
      return content;
    }

    // For longer content, add a "read more" indicator
    const truncated = content.substring(0, optimalLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > optimalLength * 0.8) {
      return truncated.substring(0, lastSpace) + '... (continued)';
    }
    
    return truncated + '... (continued)';
  }

  /**
   * Pinterest-specific optimizations
   */
  private optimizeForPinterest(content: string): string {
    const maxLength = 500;
    
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Extract hashtags from source data
   */
  private extractHashtags(sourceData: any, sourceType: string): string[] {
    const hashtags: string[] = [];

    if (sourceType === 'blogger' && this.isBloggerPost(sourceData)) {
      // Extract from categories
      if (sourceData.categories) {
        sourceData.categories.forEach((category: string) => {
          const hashtag = this.sanitizeHashtag(category);
          if (hashtag) hashtags.push(hashtag);
        });
      }

      // Extract from content keywords
      const contentHashtags = this.extractHashtagsFromText(sourceData.content);
      hashtags.push(...contentHashtags);

    } else if (sourceType === 'soloboss' && this.isSoloBossContent(sourceData)) {
      // Extract from SEO suggestions
      if (sourceData.seoSuggestions) {
        sourceData.seoSuggestions.forEach((suggestion: string) => {
          const words = suggestion.toLowerCase().split(/\s+/);
          words.forEach(word => {
            const hashtag = this.sanitizeHashtag(word);
            if (hashtag && hashtag.length > 3) hashtags.push(hashtag);
          });
        });
      }
    }

    // Remove duplicates and limit
    return [...new Set(hashtags)].slice(0, 15);
  }

  /**
   * Extract images from source data
   */
  private extractImages(sourceData: any, sourceType: string): string[] {
    if (sourceType === 'blogger' && this.isBloggerPost(sourceData)) {
      // Extract images from content HTML
      return this.extractImagesFromHTML(sourceData.content);
    } else if (sourceType === 'soloboss' && this.isSoloBossContent(sourceData)) {
      return sourceData.images || [];
    }

    return [];
  }

  /**
   * Default transformation when no template is available
   */
  private defaultTransformation(context: TransformationContext): TransformationResult {
    const variables = this.extractVariables(context.sourceData, context.sourceType);
    
    let content = '';
    if (variables.title) {
      content += `📝 ${variables.title}\n\n`;
    }
    if (variables.content) {
      content += `${variables.content}\n\n`;
    }
    if (variables.url) {
      content += `Read more: ${variables.url}`;
    }

    content = this.optimizeForPlatform(content, context.platform);

    return {
      content,
      hashtags: this.extractHashtags(context.sourceData, context.sourceType),
      images: this.extractImages(context.sourceData, context.sourceType),
      metadata: { defaultTransformation: true }
    };
  }

  /**
   * Initialize default content filters
   */
  private initializeDefaultFilters(): void {
    // Uppercase filter
    this.filters.set('uppercase', {
      name: 'uppercase',
      description: 'Convert text to uppercase',
      apply: (content: string) => content.toUpperCase()
    });

    // Lowercase filter
    this.filters.set('lowercase', {
      name: 'lowercase',
      description: 'Convert text to lowercase',
      apply: (content: string) => content.toLowerCase()
    });

    // Title case filter
    this.filters.set('titlecase', {
      name: 'titlecase',
      description: 'Convert text to title case',
      apply: (content: string) => content.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
    });

    // Truncate filter
    this.filters.set('truncate', {
      name: 'truncate',
      description: 'Truncate text to specified length',
      apply: (content: string, options?: Record<string, any>) => {
        const length = options?.length || 100;
        return content.length > length ? content.substring(0, length) + '...' : content;
      }
    });

    // Remove HTML filter
    this.filters.set('strip_html', {
      name: 'strip_html',
      description: 'Remove HTML tags from content',
      apply: (content: string) => content.replace(/<[^>]*>/g, '')
    });

    // Add emojis filter
    this.filters.set('add_emojis', {
      name: 'add_emojis',
      description: 'Add relevant emojis to content',
      apply: (content: string) => this.addRelevantEmojis(content)
    });
  }

  /**
   * Apply content filters
   */
  private applyFilters(content: string, filterString?: string): string {
    if (!filterString) return content;

    const filterNames = filterString.split(',').map(f => f.trim());
    let result = content;

    for (const filterName of filterNames) {
      const filter = this.filters.get(filterName);
      if (filter) {
        result = filter.apply(result);
      }
    }

    return result;
  }

  /**
   * Register a custom filter
   */
  registerFilter(filter: ContentFilter): void {
    this.filters.set(filter.name, filter);
  }

  /**
   * Get available filters
   */
  getAvailableFilters(): ContentFilter[] {
    return Array.from(this.filters.values());
  }

  // Helper methods
  private isBloggerPost(data: any): data is BloggerPost {
    return data && typeof data.title === 'string' && typeof data.content === 'string';
  }

  private isSoloBossContent(data: any): data is SoloBossContent {
    return data && typeof data.title === 'string' && Array.isArray(data.seoSuggestions);
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.8 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private extractBlogName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private extractKeywords(seoSuggestions: string[]): string {
    return seoSuggestions
      .flatMap(suggestion => suggestion.toLowerCase().split(/\s+/))
      .filter(word => word.length > 3)
      .slice(0, 10)
      .join(', ');
  }

  private sanitizeHashtag(text: string): string {
    const cleaned = text.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
    
    return cleaned.length > 0 ? `#${cleaned}` : '';
  }

  private extractHashtagsFromText(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML
      .split(/\s+/)
      .filter(word => word.length > 3 && /^[a-z]+$/.test(word));
    
    return [...new Set(words)]
      .slice(0, 5)
      .map(word => `#${word}`);
  }

  private extractImagesFromHTML(html: string): string[] {
    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const images: string[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }

    return images;
  }

  private addRelevantEmojis(content: string): string {
    const emojiMap: Record<string, string> = {
      'blog': '📝',
      'new': '🆕',
      'post': '📄',
      'read': '📖',
      'article': '📰',
      'news': '📰',
      'update': '🔄',
      'announcement': '📢',
      'tip': '💡',
      'guide': '📋',
      'tutorial': '🎓',
      'review': '⭐',
      'launch': '🚀',
      'release': '🎉'
    };

    let result = content;
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(result) && !result.includes(emoji)) {
        result = `${emoji} ${result}`;
        break; // Only add one emoji
      }
    }

    return result;
  }
}
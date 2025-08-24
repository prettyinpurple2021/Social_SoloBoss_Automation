import { db } from '../database/connection';
import { PostModel } from '../models/Post';
import { Platform, PostStatus } from '../types/database';

export interface ContentCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  userId: string;
  postCount: number;
  avgEngagement: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTag {
  id: string;
  name: string;
  description?: string;
  userId: string;
  postCount: number;
  avgEngagement: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostFilter {
  categories?: string[];
  tags?: string[];
  platforms?: Platform[];
  status?: PostStatus;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  searchTerm?: string;
  sortBy?: 'createdAt' | 'scheduledTime' | 'engagement' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}

export interface FilteredPostsResult {
  posts: any[];
  totalCount: number;
  filters: {
    appliedCategories: string[];
    appliedTags: string[];
    appliedPlatforms: Platform[];
  };
}

export class ContentCategorizationService {
  private static instance: ContentCategorizationService;

  private constructor() {}

  public static getInstance(): ContentCategorizationService {
    if (!ContentCategorizationService.instance) {
      ContentCategorizationService.instance = new ContentCategorizationService();
    }
    return ContentCategorizationService.instance;
  }

  /**
   * Create a new content category
   */
  async createCategory(
    userId: string,
    categoryData: {
      name: string;
      description?: string;
      color?: string;
    }
  ): Promise<ContentCategory> {
    const query = `
      INSERT INTO content_categories (user_id, name, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      categoryData.name,
      categoryData.description || null,
      categoryData.color || '#2196F3'
    ]);

    const category = result.rows[0];
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      userId: category.user_id,
      postCount: 0,
      avgEngagement: 0,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  /**
   * Get all categories for a user
   */
  async getCategories(userId: string): Promise<ContentCategory[]> {
    const query = `
      SELECT 
        cc.*,
        COUNT(DISTINCT p.id) as post_count,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement
      FROM content_categories cc
      LEFT JOIN posts p ON p.user_id = cc.user_id 
        AND p.metadata->'categories' ? cc.name
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE cc.user_id = $1
      GROUP BY cc.id, cc.name, cc.description, cc.color, cc.user_id, cc.created_at, cc.updated_at
      ORDER BY cc.name ASC
    `;

    const result = await db.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      userId: row.user_id,
      postCount: parseInt(row.post_count) || 0,
      avgEngagement: parseFloat(row.avg_engagement) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Create a new content tag
   */
  async createTag(
    userId: string,
    tagData: {
      name: string;
      description?: string;
    }
  ): Promise<ContentTag> {
    const query = `
      INSERT INTO content_tags (user_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      tagData.name,
      tagData.description || null
    ]);

    const tag = result.rows[0];
    return {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      userId: tag.user_id,
      postCount: 0,
      avgEngagement: 0,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  }

  /**
   * Get all tags for a user
   */
  async getTags(userId: string): Promise<ContentTag[]> {
    const query = `
      SELECT 
        ct.*,
        COUNT(DISTINCT p.id) as post_count,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement
      FROM content_tags ct
      LEFT JOIN posts p ON p.user_id = ct.user_id 
        AND p.metadata->'tags' ? ct.name
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE ct.user_id = $1
      GROUP BY ct.id, ct.name, ct.description, ct.user_id, ct.created_at, ct.updated_at
      ORDER BY ct.name ASC
    `;

    const result = await db.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      postCount: parseInt(row.post_count) || 0,
      avgEngagement: parseFloat(row.avg_engagement) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Add categories to a post
   */
  async addCategoriesToPost(postId: string, categories: string[]): Promise<void> {
    const query = `
      UPDATE posts 
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('categories', $2::jsonb)
      WHERE id = $1
    `;

    await db.query(query, [postId, JSON.stringify(categories)]);
  }

  /**
   * Add tags to a post
   */
  async addTagsToPost(postId: string, tags: string[]): Promise<void> {
    const query = `
      UPDATE posts 
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('tags', $2::jsonb)
      WHERE id = $1
    `;

    await db.query(query, [postId, JSON.stringify(tags)]);
  }

  /**
   * Filter posts based on categories, tags, and other criteria
   */
  async filterPosts(
    userId: string,
    filters: PostFilter,
    limit: number = 50,
    offset: number = 0
  ): Promise<FilteredPostsResult> {
    let whereConditions = ['p.user_id = $1'];
    let queryParams: any[] = [userId];
    let paramIndex = 2;

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      whereConditions.push(`p.metadata->'categories' ?| $${paramIndex}`);
      queryParams.push(filters.categories);
      paramIndex++;
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`p.metadata->'tags' ?| $${paramIndex}`);
      queryParams.push(filters.tags);
      paramIndex++;
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0) {
      whereConditions.push(`p.platforms && $${paramIndex}`);
      queryParams.push(filters.platforms);
      paramIndex++;
    }

    // Status filter
    if (filters.status) {
      whereConditions.push(`p.status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    // Date range filter
    if (filters.dateRange) {
      whereConditions.push(`p.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      queryParams.push(filters.dateRange.startDate, filters.dateRange.endDate);
      paramIndex += 2;
    }

    // Search term filter
    if (filters.searchTerm) {
      whereConditions.push(`(p.content ILIKE $${paramIndex} OR p.hashtags::text ILIKE $${paramIndex})`);
      queryParams.push(`%${filters.searchTerm}%`);
      paramIndex++;
    }

    // Build ORDER BY clause
    let orderBy = 'p.created_at DESC';
    if (filters.sortBy) {
      const sortColumn = filters.sortBy === 'alphabetical' ? 'p.content' : 
                        filters.sortBy === 'engagement' ? 'avg_engagement' : 
                        `p.${filters.sortBy}`;
      const sortOrder = filters.sortOrder || 'desc';
      orderBy = `${sortColumn} ${sortOrder.toUpperCase()}`;
    }

    const query = `
      SELECT 
        p.*,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement,
        COUNT(*) OVER() as total_count
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);
    
    const posts = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      content: row.content,
      images: row.images,
      hashtags: row.hashtags,
      platforms: row.platforms,
      scheduledTime: row.scheduled_time,
      status: row.status,
      source: row.source,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      avgEngagement: parseFloat(row.avg_engagement) || 0
    }));

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    return {
      posts,
      totalCount,
      filters: {
        appliedCategories: filters.categories || [],
        appliedTags: filters.tags || [],
        appliedPlatforms: filters.platforms || []
      }
    };
  }

  /**
   * Get category performance analytics
   */
  async getCategoryAnalytics(
    userId: string,
    categoryName: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{
    totalPosts: number;
    avgEngagement: number;
    topPlatforms: Array<{ platform: Platform; postCount: number; avgEngagement: number }>;
    performanceTrend: Array<{ date: string; engagement: number; posts: number }>;
  }> {
    let dateFilter = '';
    let queryParams: any[] = [userId, categoryName];
    
    if (dateRange) {
      dateFilter = 'AND p.created_at BETWEEN $3 AND $4';
      queryParams.push(dateRange.startDate, dateRange.endDate);
    }

    // Get basic metrics
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_posts,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1 
        AND p.metadata->'categories' ? $2
        ${dateFilter}
    `;

    const metricsResult = await db.query(metricsQuery, queryParams);
    const metrics = metricsResult.rows[0];

    // Get platform performance
    const platformQuery = `
      SELECT 
        unnest(p.platforms) as platform,
        COUNT(DISTINCT p.id) as post_count,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1 
        AND p.metadata->'categories' ? $2
        ${dateFilter}
      GROUP BY platform
      ORDER BY avg_engagement DESC
    `;

    const platformResult = await db.query(platformQuery, queryParams);
    const topPlatforms = platformResult.rows.map(row => ({
      platform: row.platform,
      postCount: parseInt(row.post_count),
      avgEngagement: parseFloat(row.avg_engagement)
    }));

    // Get performance trend (last 30 days)
    const trendQuery = `
      SELECT 
        DATE(p.created_at) as date,
        COALESCE(AVG(pa.metric_value), 0) as engagement,
        COUNT(DISTINCT p.id) as posts
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id 
        AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1 
        AND p.metadata->'categories' ? $2
        AND p.created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(p.created_at)
      ORDER BY date ASC
    `;

    const trendResult = await db.query(trendQuery, [userId, categoryName]);
    const performanceTrend = trendResult.rows.map(row => ({
      date: row.date,
      engagement: parseFloat(row.engagement),
      posts: parseInt(row.posts)
    }));

    return {
      totalPosts: parseInt(metrics.total_posts) || 0,
      avgEngagement: parseFloat(metrics.avg_engagement) || 0,
      topPlatforms,
      performanceTrend
    };
  }

  /**
   * Auto-suggest categories based on content
   */
  async suggestCategories(content: string, hashtags: string[] = []): Promise<string[]> {
    // Simple keyword-based categorization
    const categoryKeywords = {
      'Marketing': ['marketing', 'promotion', 'sale', 'discount', 'offer', 'deal'],
      'Educational': ['learn', 'tutorial', 'guide', 'how to', 'tips', 'advice'],
      'Personal': ['personal', 'life', 'experience', 'story', 'journey'],
      'Business': ['business', 'entrepreneur', 'startup', 'company', 'corporate'],
      'Technology': ['tech', 'technology', 'software', 'app', 'digital', 'ai'],
      'Lifestyle': ['lifestyle', 'health', 'fitness', 'food', 'travel', 'fashion'],
      'Entertainment': ['fun', 'entertainment', 'movie', 'music', 'game', 'funny']
    };

    const suggestions: string[] = [];
    const contentLower = content.toLowerCase();
    const allHashtags = hashtags.join(' ').toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const hasKeyword = keywords.some(keyword => 
        contentLower.includes(keyword) || allHashtags.includes(keyword)
      );
      
      if (hasKeyword) {
        suggestions.push(category);
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Auto-suggest tags based on content and hashtags
   */
  async suggestTags(content: string, hashtags: string[] = []): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Extract hashtags as potential tags
    hashtags.forEach(hashtag => {
      const tag = hashtag.replace('#', '').toLowerCase();
      if (tag.length > 2) {
        suggestions.push(tag);
      }
    });

    // Extract keywords from content
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Common words to exclude
    const excludeWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'some', 'these', 'many', 'would', 'there'];

    words.forEach(word => {
      if (!excludeWords.includes(word) && !suggestions.includes(word)) {
        suggestions.push(word);
      }
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Update category
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    updates: Partial<{ name: string; description: string; color: string }>
  ): Promise<ContentCategory> {
    const setClause = [];
    const queryParams = [categoryId, userId];
    let paramIndex = 3;

    if (updates.name) {
      setClause.push(`name = $${paramIndex}`);
      queryParams.push(updates.name);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClause.push(`description = $${paramIndex}`);
      queryParams.push(updates.description);
      paramIndex++;
    }

    if (updates.color) {
      setClause.push(`color = $${paramIndex}`);
      queryParams.push(updates.color);
      paramIndex++;
    }

    setClause.push(`updated_at = NOW()`);

    const query = `
      UPDATE content_categories 
      SET ${setClause.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, queryParams);
    
    if (result.rows.length === 0) {
      throw new Error('Category not found');
    }

    const category = result.rows[0];
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      userId: category.user_id,
      postCount: 0, // Will be calculated separately if needed
      avgEngagement: 0, // Will be calculated separately if needed
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  /**
   * Delete category
   */
  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    const query = `
      DELETE FROM content_categories 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [categoryId, userId]);
    
    if (result.rowCount === 0) {
      throw new Error('Category not found');
    }
  }

  /**
   * Update tag
   */
  async updateTag(
    userId: string,
    tagId: string,
    updates: Partial<{ name: string; description: string }>
  ): Promise<ContentTag> {
    const setClause = [];
    const queryParams = [tagId, userId];
    let paramIndex = 3;

    if (updates.name) {
      setClause.push(`name = $${paramIndex}`);
      queryParams.push(updates.name);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClause.push(`description = $${paramIndex}`);
      queryParams.push(updates.description);
      paramIndex++;
    }

    setClause.push(`updated_at = NOW()`);

    const query = `
      UPDATE content_tags 
      SET ${setClause.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, queryParams);
    
    if (result.rows.length === 0) {
      throw new Error('Tag not found');
    }

    const tag = result.rows[0];
    return {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      userId: tag.user_id,
      postCount: 0, // Will be calculated separately if needed
      avgEngagement: 0, // Will be calculated separately if needed
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  }

  /**
   * Delete tag
   */
  async deleteTag(userId: string, tagId: string): Promise<void> {
    const query = `
      DELETE FROM content_tags 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [tagId, userId]);
    
    if (result.rowCount === 0) {
      throw new Error('Tag not found');
    }
  }
}

export const contentCategorizationService = ContentCategorizationService.getInstance();
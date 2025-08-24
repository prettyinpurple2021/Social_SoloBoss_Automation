import { db } from '../database/connection';
import { Platform, PostStatus } from '../types/database';

export interface AnalyticsQuery {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  platforms?: Platform[];
  categories?: string[];
  tags?: string[];
  timeRange?: '7d' | '30d' | '90d' | 'custom';
}

export interface EngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  views: number;
  impressions: number;
  reach: number;
  clicks: number;
  saves: number;
  engagementRate: number;
}

export interface PlatformPerformance {
  platform: Platform;
  metrics: EngagementMetrics;
  postCount: number;
  avgEngagementRate: number;
  topPost?: {
    id: string;
    content: string;
    engagement: number;
    publishedAt: Date;
  };
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export interface ContentAnalysis {
  topHashtags: Array<{
    hashtag: string;
    usage: number;
    avgEngagement: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  contentTypes: Array<{
    type: 'text' | 'image' | 'video' | 'carousel';
    count: number;
    avgEngagement: number;
    performance: 'high' | 'medium' | 'low';
  }>;
  optimalContentLength: {
    platform: Platform;
    minLength: number;
    maxLength: number;
    avgEngagement: number;
  }[];
}

export interface AudienceInsights {
  bestPostingTimes: Array<{
    dayOfWeek: number;
    hour: number;
    engagementRate: number;
    platform: Platform;
  }>;
  audienceActivity: Array<{
    hour: number;
    activityLevel: number;
    platform: Platform;
  }>;
  demographicData?: {
    ageGroups: Record<string, number>;
    locations: Record<string, number>;
    interests: Record<string, number>;
  };
}

export interface PerformanceRecommendations {
  contentStrategy: Array<{
    type: 'hashtag' | 'timing' | 'content_type' | 'frequency';
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
    data: any;
  }>;
  platformOptimization: Array<{
    platform: Platform;
    suggestions: string[];
    priority: 'high' | 'medium' | 'low';
  }>;
  competitiveInsights?: Array<{
    insight: string;
    actionable: string;
    source: string;
  }>;
}

export interface TrendAnalysis {
  engagementTrend: Array<{
    date: string;
    engagement: number;
    reach: number;
    impressions: number;
    posts: number;
  }>;
  hashtagTrends: Array<{
    hashtag: string;
    trend: 'rising' | 'declining' | 'stable';
    changePercentage: number;
    currentUsage: number;
  }>;
  platformTrends: Array<{
    platform: Platform;
    trend: 'growing' | 'declining' | 'stable';
    changePercentage: number;
    reason: string;
  }>;
}

export interface ComprehensiveAnalytics {
  overview: {
    totalPosts: number;
    totalEngagement: number;
    totalReach: number;
    totalImpressions: number;
    avgEngagementRate: number;
    period: {
      startDate: Date;
      endDate: Date;
    };
  };
  platformPerformance: PlatformPerformance[];
  contentAnalysis: ContentAnalysis;
  audienceInsights: AudienceInsights;
  trendAnalysis: TrendAnalysis;
  recommendations: PerformanceRecommendations;
  topPerformingPosts: Array<{
    id: string;
    content: string;
    platform: Platform;
    engagement: number;
    engagementRate: number;
    publishedAt: Date;
    categories?: string[];
    tags?: string[];
  }>;
}

export class AdvancedAnalyticsService {
  private static instance: AdvancedAnalyticsService;

  private constructor() {}

  public static getInstance(): AdvancedAnalyticsService {
    if (!AdvancedAnalyticsService.instance) {
      AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
    }
    return AdvancedAnalyticsService.instance;
  }

  /**
   * Get comprehensive analytics data
   */
  async getComprehensiveAnalytics(query: AnalyticsQuery): Promise<ComprehensiveAnalytics> {
    const { startDate, endDate } = this.getDateRange(query);
    
    const [
      overview,
      platformPerformance,
      contentAnalysis,
      audienceInsights,
      trendAnalysis,
      topPerformingPosts
    ] = await Promise.all([
      this.getOverviewMetrics(query, startDate, endDate),
      this.getPlatformPerformance(query, startDate, endDate),
      this.getContentAnalysis(query, startDate, endDate),
      this.getAudienceInsights(query, startDate, endDate),
      this.getTrendAnalysis(query, startDate, endDate),
      this.getTopPerformingPosts(query, startDate, endDate)
    ]);

    const recommendations = await this.generateRecommendations(
      platformPerformance,
      contentAnalysis,
      audienceInsights,
      trendAnalysis
    );

    return {
      overview: {
        ...overview,
        period: { startDate, endDate }
      },
      platformPerformance,
      contentAnalysis,
      audienceInsights,
      trendAnalysis,
      recommendations,
      topPerformingPosts
    };
  }

  /**
   * Get overview metrics
   */
  private async getOverviewMetrics(
    query: AnalyticsQuery,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalPosts: number;
    totalEngagement: number;
    totalReach: number;
    totalImpressions: number;
    avgEngagementRate: number;
  }> {
    const platformFilter = query.platforms ? 'AND p.platforms && $4' : '';
    const categoryFilter = query.categories ? 'AND p.metadata->>\'categories\' && $5' : '';
    
    const queryText = `
      SELECT 
        COUNT(DISTINCT p.id) as total_posts,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'likes' THEN pa.metric_value END), 0) +
        COALESCE(SUM(CASE WHEN pa.metric_type = 'shares' THEN pa.metric_value END), 0) +
        COALESCE(SUM(CASE WHEN pa.metric_type = 'comments' THEN pa.metric_value END), 0) as total_engagement,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'reach' THEN pa.metric_value END), 0) as total_reach,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'impressions' THEN pa.metric_value END), 0) as total_impressions,
        COALESCE(AVG(CASE WHEN pa.metric_type = 'engagement_rate' THEN pa.metric_value END), 0) as avg_engagement_rate
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
        ${platformFilter}
        ${categoryFilter}
    `;

    const params = [query.userId, PostStatus.PUBLISHED, startDate, endDate];
    if (query.platforms) params.push(query.platforms);
    if (query.categories) params.push(query.categories);

    const result = await db.query(queryText, params);
    const row = result.rows[0];

    return {
      totalPosts: parseInt(row.total_posts) || 0,
      totalEngagement: parseInt(row.total_engagement) || 0,
      totalReach: parseInt(row.total_reach) || 0,
      totalImpressions: parseInt(row.total_impressions) || 0,
      avgEngagementRate: parseFloat(row.avg_engagement_rate) || 0
    };
  }

  /**
   * Get platform performance data
   */
  private async getPlatformPerformance(
    query: AnalyticsQuery,
    startDate: Date,
    endDate: Date
  ): Promise<PlatformPerformance[]> {
    const queryText = `
      SELECT 
        pp.platform,
        COUNT(DISTINCT p.id) as post_count,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'likes' THEN pa.metric_value END), 0) as likes,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'shares' THEN pa.metric_value END), 0) as shares,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'comments' THEN pa.metric_value END), 0) as comments,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'views' THEN pa.metric_value END), 0) as views,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'impressions' THEN pa.metric_value END), 0) as impressions,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'reach' THEN pa.metric_value END), 0) as reach,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'clicks' THEN pa.metric_value END), 0) as clicks,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'saves' THEN pa.metric_value END), 0) as saves,
        COALESCE(AVG(CASE WHEN pa.metric_type = 'engagement_rate' THEN pa.metric_value END), 0) as avg_engagement_rate
      FROM posts p
      JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY pp.platform
      ORDER BY avg_engagement_rate DESC
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    const platformPerformance: PlatformPerformance[] = [];
    
    for (const row of result.rows) {
      const metrics: EngagementMetrics = {
        likes: parseInt(row.likes) || 0,
        shares: parseInt(row.shares) || 0,
        comments: parseInt(row.comments) || 0,
        views: parseInt(row.views) || 0,
        impressions: parseInt(row.impressions) || 0,
        reach: parseInt(row.reach) || 0,
        clicks: parseInt(row.clicks) || 0,
        saves: parseInt(row.saves) || 0,
        engagementRate: parseFloat(row.avg_engagement_rate) || 0
      };

      const topPost = await this.getTopPostForPlatform(
        query.userId,
        row.platform,
        startDate,
        endDate
      );

      const trend = await this.calculatePlatformTrend(
        query.userId,
        row.platform,
        startDate,
        endDate
      );

      platformPerformance.push({
        platform: row.platform,
        metrics,
        postCount: parseInt(row.post_count) || 0,
        avgEngagementRate: parseFloat(row.avg_engagement_rate) || 0,
        topPost,
        trend: trend.direction,
        trendPercentage: trend.percentage
      });
    }

    return platformPerformance;
  }

  /**
   * Get content analysis
   */
  private async getContentAnalysis(
    query: AnalyticsQuery,
    startDate: Date,
    endDate: Date
  ): Promise<ContentAnalysis> {
    const [topHashtags, contentTypes, optimalContentLength] = await Promise.all([
      this.getTopHashtags(query, startDate, endDate),
      this.getContentTypes(query, startDate, endDate),
      this.getOptimalContentLength(query, startDate, endDate)
    ]);

    return {
      topHashtags,
      contentTypes,
      optimalContentLength
    };
  }

  /**
   * Get audience insights
   */
  private async getAudienceInsights(
    query: AnalyticsQuery,
    startDate: Date,
    endDate: Date
  ): Promise<AudienceInsights> {
    const [bestPostingTimes, audienceActivity] = await Promise.all([
      this.getBestPostingTimes(query, startDate, endDate),
      this.getAudienceActivity(query, startDate, endDate)
    ]);

    return {
      bestPostingTimes,
      audienceActivity
    };
  }

  /**
   * Get trend analysis
   */
  private async getTrendAnalysis(
    query: AnalyticsQuery,
    startDate: Date,
    endDate: Date
  ): Promise<TrendAnalysis> {
    const [engagementTrend, hashtagTrends, platformTrends] = await Promise.all([
      this.getEngagementTrend(query, startDate, endDate),
      this.getHashtagTrends(query, startDate, endDate),
      this.getPlatformTrends(query, startDate, endDate)
    ]);

    return {
      engagementTrend,
      hashtagTrends,
      platformTrends
    };
  }

  /**
   * Generate performance recommendations
   */
  private async generateRecommendations(
    platformPerformance: PlatformPerformance[],
    contentAnalysis: ContentAnalysis,
    audienceInsights: AudienceInsights,
    trendAnalysis: TrendAnalysis
  ): Promise<PerformanceRecommendations> {
    const contentStrategy: PerformanceRecommendations['contentStrategy'] = [];
    const platformOptimization: PerformanceRecommendations['platformOptimization'] = [];

    // Hashtag recommendations
    const topHashtags = contentAnalysis.topHashtags.slice(0, 5);
    if (topHashtags.length > 0) {
      contentStrategy.push({
        type: 'hashtag',
        recommendation: `Use high-performing hashtags: ${topHashtags.map(h => `#${h.hashtag}`).join(', ')}`,
        impact: 'high',
        confidence: 0.85,
        data: topHashtags
      });
    }

    // Timing recommendations
    const bestTimes = audienceInsights.bestPostingTimes.slice(0, 3);
    if (bestTimes.length > 0) {
      contentStrategy.push({
        type: 'timing',
        recommendation: `Post during peak engagement times: ${bestTimes.map(t => 
          `${this.getDayName(t.dayOfWeek)} at ${t.hour}:00`
        ).join(', ')}`,
        impact: 'high',
        confidence: 0.8,
        data: bestTimes
      });
    }

    // Content type recommendations
    const bestContentType = contentAnalysis.contentTypes
      .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
    if (bestContentType) {
      contentStrategy.push({
        type: 'content_type',
        recommendation: `Focus on ${bestContentType.type} content - it performs ${bestContentType.performance} with ${bestContentType.avgEngagement.toFixed(1)}% avg engagement`,
        impact: 'medium',
        confidence: 0.75,
        data: bestContentType
      });
    }

    // Platform optimization
    for (const platform of platformPerformance) {
      const suggestions: string[] = [];
      
      if (platform.avgEngagementRate < 2) {
        suggestions.push('Engagement rate is below average - consider posting at different times');
      }
      if (platform.trend === 'down') {
        suggestions.push(`Performance declining by ${platform.trendPercentage}% - review content strategy`);
      }
      if (platform.postCount < 5) {
        suggestions.push('Low posting frequency - consider increasing content volume');
      }

      if (suggestions.length > 0) {
        platformOptimization.push({
          platform: platform.platform,
          suggestions,
          priority: platform.avgEngagementRate < 1 ? 'high' : 'medium'
        });
      }
    }

    return {
      contentStrategy,
      platformOptimization
    };
  }

  /**
   * Helper methods
   */
  private getDateRange(query: AnalyticsQuery): { startDate: Date; endDate: Date } {
    const endDate = query.endDate || new Date();
    let startDate = query.startDate;

    if (!startDate && query.timeRange) {
      const days = query.timeRange === '7d' ? 7 : query.timeRange === '30d' ? 30 : 90;
      startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (!startDate) {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    }

    return { startDate, endDate };
  }

  private async getTopPostForPlatform(
    userId: string,
    platform: Platform,
    startDate: Date,
    endDate: Date
  ): Promise<{ id: string; content: string; engagement: number; publishedAt: Date } | undefined> {
    const queryText = `
      SELECT p.id, p.content, p.published_at,
        COALESCE(SUM(CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') THEN pa.metric_value END), 0) as engagement
      FROM posts p
      JOIN platform_posts pp ON p.id = pp.post_id AND pp.platform = $2
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $3
        AND p.published_at BETWEEN $4 AND $5
      GROUP BY p.id, p.content, p.published_at
      ORDER BY engagement DESC
      LIMIT 1
    `;

    const result = await db.query(queryText, [userId, platform, PostStatus.PUBLISHED, startDate, endDate]);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        content: row.content,
        engagement: parseInt(row.engagement) || 0,
        publishedAt: row.published_at
      };
    }
  }

  private async calculatePlatformTrend(
    userId: string,
    platform: Platform,
    startDate: Date,
    endDate: Date
  ): Promise<{ direction: 'up' | 'down' | 'stable'; percentage: number }> {
    // Compare current period with previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getPlatformMetrics(userId, platform, startDate, endDate),
      this.getPlatformMetrics(userId, platform, previousStartDate, previousEndDate)
    ]);

    if (previousMetrics.avgEngagementRate === 0) {
      return { direction: 'stable', percentage: 0 };
    }

    const changePercentage = ((currentMetrics.avgEngagementRate - previousMetrics.avgEngagementRate) / previousMetrics.avgEngagementRate) * 100;
    
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(changePercentage) < 5) {
      direction = 'stable';
    } else if (changePercentage > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    return { direction, percentage: Math.abs(changePercentage) };
  }

  private async getPlatformMetrics(
    userId: string,
    platform: Platform,
    startDate: Date,
    endDate: Date
  ): Promise<{ avgEngagementRate: number }> {
    const queryText = `
      SELECT COALESCE(AVG(CASE WHEN pa.metric_type = 'engagement_rate' THEN pa.metric_value END), 0) as avg_engagement_rate
      FROM posts p
      JOIN platform_posts pp ON p.id = pp.post_id AND pp.platform = $2
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $3
        AND p.published_at BETWEEN $4 AND $5
    `;

    const result = await db.query(queryText, [userId, platform, PostStatus.PUBLISHED, startDate, endDate]);
    
    return {
      avgEngagementRate: parseFloat(result.rows[0]?.avg_engagement_rate) || 0
    };
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  private async getTopHashtags(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        hashtag,
        COUNT(*) as usage,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement,
        CASE 
          WHEN COUNT(*) > LAG(COUNT(*)) OVER (ORDER BY hashtag) THEN 'up'
          WHEN COUNT(*) < LAG(COUNT(*)) OVER (ORDER BY hashtag) THEN 'down'
          ELSE 'stable'
        END as trend
      FROM posts p
      CROSS JOIN LATERAL unnest(p.hashtags) as hashtag
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY hashtag
      HAVING COUNT(*) >= 2
      ORDER BY avg_engagement DESC, usage DESC
      LIMIT 20
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      hashtag: row.hashtag.replace('#', ''),
      usage: parseInt(row.usage),
      avgEngagement: parseFloat(row.avg_engagement),
      trend: row.trend as 'up' | 'down' | 'stable'
    }));
  }

  private async getContentTypes(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        CASE 
          WHEN array_length(p.images, 1) > 1 THEN 'carousel'
          WHEN array_length(p.images, 1) = 1 THEN 'image'
          WHEN p.content ~ 'http.*\\.(mp4|mov|avi)' THEN 'video'
          ELSE 'text'
        END as type,
        COUNT(*) as count,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement,
        CASE 
          WHEN COALESCE(AVG(pa.metric_value), 0) > 15 THEN 'high'
          WHEN COALESCE(AVG(pa.metric_value), 0) > 5 THEN 'medium'
          ELSE 'low'
        END as performance
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY type
      ORDER BY avg_engagement DESC
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      type: row.type as 'text' | 'image' | 'video' | 'carousel',
      count: parseInt(row.count),
      avgEngagement: parseFloat(row.avg_engagement),
      performance: row.performance as 'high' | 'medium' | 'low'
    }));
  }

  private async getOptimalContentLength(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        unnest(p.platforms) as platform,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY LENGTH(p.content)) as min_length,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY LENGTH(p.content)) as max_length,
        COALESCE(AVG(pa.metric_value), 0) as avg_engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
        AND pa.metric_value > 0
      GROUP BY platform
      ORDER BY avg_engagement DESC
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      platform: row.platform,
      minLength: Math.round(parseFloat(row.min_length)),
      maxLength: Math.round(parseFloat(row.max_length)),
      avgEngagement: parseFloat(row.avg_engagement)
    }));
  }

  private async getBestPostingTimes(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        unnest(p.platforms) as platform,
        EXTRACT(DOW FROM p.published_at) as day_of_week,
        EXTRACT(HOUR FROM p.published_at) as hour,
        COALESCE(AVG(pa.metric_value), 0) as engagement_rate
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY platform, day_of_week, hour
      HAVING COUNT(*) >= 2
      ORDER BY engagement_rate DESC
      LIMIT 20
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      platform: row.platform,
      dayOfWeek: parseInt(row.day_of_week),
      hour: parseInt(row.hour),
      engagementRate: parseFloat(row.engagement_rate)
    }));
  }

  private async getAudienceActivity(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        unnest(p.platforms) as platform,
        EXTRACT(HOUR FROM p.published_at) as hour,
        COUNT(*) as activity_level
      FROM posts p
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY platform, hour
      ORDER BY platform, hour
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      platform: row.platform,
      hour: parseInt(row.hour),
      activityLevel: parseInt(row.activity_level)
    }));
  }

  private async getEngagementTrend(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        DATE(p.published_at) as date,
        COALESCE(SUM(CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') THEN pa.metric_value END), 0) as engagement,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'reach' THEN pa.metric_value END), 0) as reach,
        COALESCE(SUM(CASE WHEN pa.metric_type = 'impressions' THEN pa.metric_value END), 0) as impressions,
        COUNT(DISTINCT p.id) as posts
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY DATE(p.published_at)
      ORDER BY date ASC
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      date: row.date,
      engagement: parseInt(row.engagement),
      reach: parseInt(row.reach),
      impressions: parseInt(row.impressions),
      posts: parseInt(row.posts)
    }));
  }

  private async getHashtagTrends(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Compare current period with previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);

    const queryText = `
      WITH current_period AS (
        SELECT 
          hashtag,
          COUNT(*) as current_usage
        FROM posts p
        CROSS JOIN LATERAL unnest(p.hashtags) as hashtag
        WHERE p.user_id = $1
          AND p.status = $2
          AND p.published_at BETWEEN $3 AND $4
        GROUP BY hashtag
      ),
      previous_period AS (
        SELECT 
          hashtag,
          COUNT(*) as previous_usage
        FROM posts p
        CROSS JOIN LATERAL unnest(p.hashtags) as hashtag
        WHERE p.user_id = $1
          AND p.status = $2
          AND p.published_at BETWEEN $5 AND $3
        GROUP BY hashtag
      )
      SELECT 
        COALESCE(c.hashtag, p.hashtag) as hashtag,
        COALESCE(c.current_usage, 0) as current_usage,
        COALESCE(p.previous_usage, 0) as previous_usage,
        CASE 
          WHEN p.previous_usage IS NULL OR p.previous_usage = 0 THEN 'rising'
          WHEN c.current_usage IS NULL OR c.current_usage = 0 THEN 'declining'
          WHEN c.current_usage > p.previous_usage THEN 'rising'
          WHEN c.current_usage < p.previous_usage THEN 'declining'
          ELSE 'stable'
        END as trend,
        CASE 
          WHEN p.previous_usage IS NULL OR p.previous_usage = 0 THEN 100
          ELSE ROUND(((c.current_usage - p.previous_usage)::float / p.previous_usage * 100)::numeric, 1)
        END as change_percentage
      FROM current_period c
      FULL OUTER JOIN previous_period p ON c.hashtag = p.hashtag
      WHERE COALESCE(c.current_usage, 0) + COALESCE(p.previous_usage, 0) >= 2
      ORDER BY current_usage DESC NULLS LAST
      LIMIT 15
    `;

    const result = await db.query(queryText, [
      query.userId, PostStatus.PUBLISHED, startDate, endDate, previousStartDate
    ]);
    
    return result.rows.map(row => ({
      hashtag: row.hashtag.replace('#', ''),
      trend: row.trend as 'rising' | 'declining' | 'stable',
      changePercentage: parseFloat(row.change_percentage) || 0,
      currentUsage: parseInt(row.current_usage) || 0
    }));
  }

  private async getPlatformTrends(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Compare current period with previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);

    const queryText = `
      WITH current_period AS (
        SELECT 
          unnest(p.platforms) as platform,
          COALESCE(AVG(pa.metric_value), 0) as current_engagement
        FROM posts p
        LEFT JOIN platform_posts pp ON p.id = pp.post_id
        LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
        WHERE p.user_id = $1
          AND p.status = $2
          AND p.published_at BETWEEN $3 AND $4
        GROUP BY platform
      ),
      previous_period AS (
        SELECT 
          unnest(p.platforms) as platform,
          COALESCE(AVG(pa.metric_value), 0) as previous_engagement
        FROM posts p
        LEFT JOIN platform_posts pp ON p.id = pp.post_id
        LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
        WHERE p.user_id = $1
          AND p.status = $2
          AND p.published_at BETWEEN $5 AND $3
        GROUP BY platform
      )
      SELECT 
        c.platform,
        c.current_engagement,
        COALESCE(p.previous_engagement, 0) as previous_engagement,
        CASE 
          WHEN p.previous_engagement IS NULL OR p.previous_engagement = 0 THEN 'growing'
          WHEN c.current_engagement > p.previous_engagement * 1.1 THEN 'growing'
          WHEN c.current_engagement < p.previous_engagement * 0.9 THEN 'declining'
          ELSE 'stable'
        END as trend,
        CASE 
          WHEN p.previous_engagement IS NULL OR p.previous_engagement = 0 THEN 100
          ELSE ROUND(((c.current_engagement - p.previous_engagement) / p.previous_engagement * 100)::numeric, 1)
        END as change_percentage
      FROM current_period c
      LEFT JOIN previous_period p ON c.platform = p.platform
      ORDER BY c.current_engagement DESC
    `;

    const result = await db.query(queryText, [
      query.userId, PostStatus.PUBLISHED, startDate, endDate, previousStartDate
    ]);
    
    return result.rows.map(row => ({
      platform: row.platform,
      trend: row.trend as 'growing' | 'declining' | 'stable',
      changePercentage: parseFloat(row.change_percentage) || 0,
      reason: this.generatePlatformTrendReason(row.trend, parseFloat(row.change_percentage) || 0)
    }));
  }

  private async getTopPerformingPosts(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    const queryText = `
      SELECT 
        p.id,
        p.content,
        unnest(p.platforms) as platform,
        COALESCE(SUM(CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') THEN pa.metric_value END), 0) as engagement,
        COALESCE(AVG(CASE WHEN pa.metric_type = 'engagement_rate' THEN pa.metric_value END), 0) as engagement_rate,
        p.published_at,
        p.metadata->'categories' as categories,
        p.metadata->'tags' as tags
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.published_at BETWEEN $3 AND $4
      GROUP BY p.id, p.content, platform, p.published_at, p.metadata
      ORDER BY engagement DESC, engagement_rate DESC
      LIMIT 20
    `;

    const result = await db.query(queryText, [query.userId, PostStatus.PUBLISHED, startDate, endDate]);
    
    return result.rows.map(row => ({
      id: row.id,
      content: row.content,
      platform: row.platform,
      engagement: parseInt(row.engagement),
      engagementRate: parseFloat(row.engagement_rate),
      publishedAt: row.published_at,
      categories: row.categories ? JSON.parse(row.categories) : [],
      tags: row.tags ? JSON.parse(row.tags) : []
    }));
  }

  private generatePlatformTrendReason(trend: string, changePercentage: number): string {
    switch (trend) {
      case 'growing':
        return `Performance improved by ${changePercentage.toFixed(1)}% compared to previous period`;
      case 'declining':
        return `Performance declined by ${Math.abs(changePercentage).toFixed(1)}% compared to previous period`;
      case 'stable':
        return 'Performance remained consistent with previous period';
      default:
        return 'Insufficient data for trend analysis';
    }
  }
}

export const advancedAnalyticsService = AdvancedAnalyticsService.getInstance();
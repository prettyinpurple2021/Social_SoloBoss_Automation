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

  // Additional helper methods would be implemented here for:
  // - getTopHashtags
  // - getContentTypes
  // - getOptimalContentLength
  // - getBestPostingTimes
  // - getAudienceActivity
  // - getEngagementTrend
  // - getHashtagTrends
  // - getPlatformTrends
  // - getTopPerformingPosts

  private async getTopHashtags(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for top hashtags analysis
    return [];
  }

  private async getContentTypes(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for content type analysis
    return [];
  }

  private async getOptimalContentLength(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for optimal content length analysis
    return [];
  }

  private async getBestPostingTimes(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for best posting times analysis
    return [];
  }

  private async getAudienceActivity(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for audience activity analysis
    return [];
  }

  private async getEngagementTrend(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for engagement trend analysis
    return [];
  }

  private async getHashtagTrends(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for hashtag trends analysis
    return [];
  }

  private async getPlatformTrends(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for platform trends analysis
    return [];
  }

  private async getTopPerformingPosts(query: AnalyticsQuery, startDate: Date, endDate: Date) {
    // Implementation for top performing posts analysis
    return [];
  }
}

export const advancedAnalyticsService = AdvancedAnalyticsService.getInstance();
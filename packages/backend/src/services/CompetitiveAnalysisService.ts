/**
 * Competitive Analysis Service
 * 
 * Provides competitive analysis features and industry benchmarking capabilities.
 * Analyzes competitor performance and provides insights for strategic positioning.
 */

import { db } from '../database/connection';
import { Platform } from '../types/database';
import { loggerService } from './LoggerService';

export interface CompetitorProfile {
  id: string;
  userId: string;
  name: string;
  description?: string;
  industry: string;
  platforms: CompetitorPlatformData[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorPlatformData {
  platform: Platform;
  handle: string;
  followerCount?: number;
  verified?: boolean;
  lastUpdated?: Date;
}

export interface CompetitiveMetrics {
  competitorId: string;
  platform: Platform;
  date: Date;
  followers: number;
  following: number;
  posts: number;
  avgEngagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  postFrequency: number; // posts per day
  topHashtags: string[];
  contentTypes: Record<string, number>;
}

export interface IndustryBenchmark {
  industry: string;
  platform: Platform;
  metrics: {
    avgFollowers: number;
    avgEngagementRate: number;
    avgPostFrequency: number;
    topContentTypes: Array<{
      type: string;
      percentage: number;
      avgEngagement: number;
    }>;
    optimalPostingTimes: Array<{
      dayOfWeek: number;
      hour: number;
      engagementMultiplier: number;
    }>;
    topHashtags: Array<{
      hashtag: string;
      usage: number;
      avgEngagement: number;
    }>;
  };
  sampleSize: number;
  lastUpdated: Date;
}

export interface CompetitiveAnalysis {
  user: {
    metrics: UserCompetitiveMetrics;
    ranking: CompetitiveRanking;
  };
  competitors: Array<{
    profile: CompetitorProfile;
    metrics: CompetitiveMetrics;
    comparison: CompetitiveComparison;
  }>;
  industryBenchmarks: IndustryBenchmark[];
  insights: CompetitiveInsight[];
  recommendations: CompetitiveRecommendation[];
}

export interface UserCompetitiveMetrics {
  platform: Platform;
  followers: number;
  engagementRate: number;
  postFrequency: number;
  avgLikes: number;
  avgComments: number;
  contentTypeDistribution: Record<string, number>;
  topHashtags: string[];
}

export interface CompetitiveRanking {
  platform: Platform;
  overallRank: number;
  totalCompetitors: number;
  percentile: number;
  metrics: {
    engagementRateRank: number;
    followerGrowthRank: number;
    postFrequencyRank: number;
    contentQualityRank: number;
  };
}

export interface CompetitiveComparison {
  metric: string;
  userValue: number;
  competitorValue: number;
  difference: number;
  percentageDifference: number;
  advantage: 'user' | 'competitor' | 'neutral';
}

export interface CompetitiveInsight {
  type: 'opportunity' | 'threat' | 'strength' | 'weakness';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  data: any;
}

export interface CompetitiveRecommendation {
  category: 'content_strategy' | 'posting_frequency' | 'engagement_tactics' | 'hashtag_strategy';
  recommendation: string;
  rationale: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
  competitorExample?: {
    name: string;
    metric: string;
    value: number;
  };
}

export class CompetitiveAnalysisService {
  private static instance: CompetitiveAnalysisService;

  private constructor() {}

  public static getInstance(): CompetitiveAnalysisService {
    if (!CompetitiveAnalysisService.instance) {
      CompetitiveAnalysisService.instance = new CompetitiveAnalysisService();
    }
    return CompetitiveAnalysisService.instance;
  }

  /**
   * Add competitor for tracking
   */
  async addCompetitor(userId: string, competitor: Omit<CompetitorProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<CompetitorProfile> {
    try {
      const query = `
        INSERT INTO competitor_profiles (user_id, name, description, industry, platforms, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        competitor.name,
        competitor.description,
        competitor.industry,
        JSON.stringify(competitor.platforms),
        competitor.isActive
      ]);

      const createdCompetitor = this.mapCompetitorRow(result.rows[0]);
      
      loggerService.info('Competitor added', {
        competitorId: createdCompetitor.id,
        userId,
        name: competitor.name
      });

      return createdCompetitor;
    } catch (error) {
      loggerService.error('Failed to add competitor', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user's competitors
   */
  async getUserCompetitors(userId: string): Promise<CompetitorProfile[]> {
    try {
      const query = `
        SELECT * FROM competitor_profiles 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapCompetitorRow(row));
    } catch (error) {
      loggerService.error('Failed to get user competitors', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update competitor metrics (would typically be called by a scheduled job)
   */
  async updateCompetitorMetrics(competitorId: string, metrics: Omit<CompetitiveMetrics, 'competitorId'>): Promise<void> {
    try {
      const query = `
        INSERT INTO competitive_metrics (
          competitor_id, platform, date, followers, following, posts, 
          avg_engagement_rate, avg_likes, avg_comments, avg_shares, 
          post_frequency, top_hashtags, content_types
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (competitor_id, platform, date) 
        DO UPDATE SET
          followers = EXCLUDED.followers,
          following = EXCLUDED.following,
          posts = EXCLUDED.posts,
          avg_engagement_rate = EXCLUDED.avg_engagement_rate,
          avg_likes = EXCLUDED.avg_likes,
          avg_comments = EXCLUDED.avg_comments,
          avg_shares = EXCLUDED.avg_shares,
          post_frequency = EXCLUDED.post_frequency,
          top_hashtags = EXCLUDED.top_hashtags,
          content_types = EXCLUDED.content_types
      `;

      await db.query(query, [
        competitorId,
        metrics.platform,
        metrics.date,
        metrics.followers,
        metrics.following,
        metrics.posts,
        metrics.avgEngagementRate,
        metrics.avgLikes,
        metrics.avgComments,
        metrics.avgShares,
        metrics.postFrequency,
        metrics.topHashtags,
        JSON.stringify(metrics.contentTypes)
      ]);

      loggerService.info('Competitor metrics updated', { competitorId });
    } catch (error) {
      loggerService.error('Failed to update competitor metrics', error as Error, { competitorId });
      throw error;
    }
  }

  /**
   * Get comprehensive competitive analysis
   */
  async getCompetitiveAnalysis(userId: string, platform?: Platform, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<CompetitiveAnalysis> {
    try {
      const competitors = await this.getUserCompetitors(userId);
      const activeCompetitors = competitors.filter(c => c.isActive);

      if (activeCompetitors.length === 0) {
        throw new Error('No active competitors found. Please add competitors to enable competitive analysis.');
      }

      const userMetrics = await this.getUserMetrics(userId, platform, timeRange);
      const competitorAnalyses = await Promise.all(
        activeCompetitors.map(competitor => this.analyzeCompetitor(competitor, userMetrics, timeRange))
      );

      const industryBenchmarks = await this.getIndustryBenchmarks(
        activeCompetitors[0].industry,
        platform
      );

      const ranking = await this.calculateUserRanking(userId, userMetrics, competitorAnalyses);
      const insights = this.generateCompetitiveInsights(userMetrics, competitorAnalyses, industryBenchmarks);
      const recommendations = this.generateCompetitiveRecommendations(userMetrics, competitorAnalyses, insights);

      return {
        user: {
          metrics: userMetrics,
          ranking
        },
        competitors: competitorAnalyses,
        industryBenchmarks,
        insights,
        recommendations
      };
    } catch (error) {
      loggerService.error('Failed to get competitive analysis', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get industry benchmarks
   */
  async getIndustryBenchmarks(industry: string, platform?: Platform): Promise<IndustryBenchmark[]> {
    try {
      let query = `
        SELECT * FROM industry_benchmarks 
        WHERE industry = $1
      `;
      const params = [industry];

      if (platform) {
        query += ' AND platform = $2';
        params.push(platform);
      }

      query += ' ORDER BY last_updated DESC';

      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        // Return default benchmarks if no data available
        return this.getDefaultBenchmarks(industry, platform);
      }

      return result.rows.map(row => this.mapBenchmarkRow(row));
    } catch (error) {
      loggerService.error('Failed to get industry benchmarks', error as Error, { industry, platform });
      return this.getDefaultBenchmarks(industry, platform);
    }
  }

  /**
   * Update industry benchmarks (would typically be called by a scheduled job)
   */
  async updateIndustryBenchmarks(benchmark: IndustryBenchmark): Promise<void> {
    try {
      const query = `
        INSERT INTO industry_benchmarks (
          industry, platform, metrics, sample_size, last_updated
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (industry, platform) 
        DO UPDATE SET
          metrics = EXCLUDED.metrics,
          sample_size = EXCLUDED.sample_size,
          last_updated = EXCLUDED.last_updated
      `;

      await db.query(query, [
        benchmark.industry,
        benchmark.platform,
        JSON.stringify(benchmark.metrics),
        benchmark.sampleSize,
        benchmark.lastUpdated
      ]);

      loggerService.info('Industry benchmark updated', {
        industry: benchmark.industry,
        platform: benchmark.platform
      });
    } catch (error) {
      loggerService.error('Failed to update industry benchmark', error as Error, {
        industry: benchmark.industry,
        platform: benchmark.platform
      });
      throw error;
    }
  }

  /**
   * Generate competitive intelligence report
   */
  async generateCompetitiveReport(userId: string, competitorIds?: string[]): Promise<{
    summary: string;
    keyFindings: string[];
    opportunities: string[];
    threats: string[];
    recommendations: string[];
  }> {
    try {
      const analysis = await this.getCompetitiveAnalysis(userId);
      
      const filteredCompetitors = competitorIds 
        ? analysis.competitors.filter(c => competitorIds.includes(c.profile.id))
        : analysis.competitors;

      const summary = this.generateAnalysisSummary(analysis.user, filteredCompetitors);
      const keyFindings = this.extractKeyFindings(analysis);
      const opportunities = analysis.insights
        .filter(i => i.type === 'opportunity')
        .map(i => i.description);
      const threats = analysis.insights
        .filter(i => i.type === 'threat')
        .map(i => i.description);
      const recommendations = analysis.recommendations
        .filter(r => r.priority === 'high')
        .map(r => r.recommendation);

      return {
        summary,
        keyFindings,
        opportunities,
        threats,
        recommendations
      };
    } catch (error) {
      loggerService.error('Failed to generate competitive report', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async getUserMetrics(userId: string, platform?: Platform, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<UserCompetitiveMetrics> {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // This would integrate with your existing analytics to get user metrics
    // For now, returning mock data
    return {
      platform: platform || Platform.FACEBOOK,
      followers: 1500,
      engagementRate: 3.2,
      postFrequency: 0.8,
      avgLikes: 45,
      avgComments: 8,
      contentTypeDistribution: {
        image: 60,
        text: 25,
        video: 15
      },
      topHashtags: ['#marketing', '#socialmedia', '#business']
    };
  }

  private async analyzeCompetitor(
    competitor: CompetitorProfile, 
    userMetrics: UserCompetitiveMetrics, 
    timeRange: string
  ): Promise<{
    profile: CompetitorProfile;
    metrics: CompetitiveMetrics;
    comparison: CompetitiveComparison[];
  }> {
    // Get latest metrics for competitor
    const metrics = await this.getLatestCompetitorMetrics(competitor.id, userMetrics.platform);
    
    // Generate comparisons
    const comparisons = this.generateComparisons(userMetrics, metrics);

    return {
      profile: competitor,
      metrics,
      comparison: comparisons
    };
  }

  private async getLatestCompetitorMetrics(competitorId: string, platform: Platform): Promise<CompetitiveMetrics> {
    try {
      const query = `
        SELECT * FROM competitive_metrics 
        WHERE competitor_id = $1 AND platform = $2 
        ORDER BY date DESC 
        LIMIT 1
      `;

      const result = await db.query(query, [competitorId, platform]);
      
      if (result.rows.length === 0) {
        // Return mock data if no metrics available
        return this.getMockCompetitorMetrics(competitorId, platform);
      }

      return this.mapMetricsRow(result.rows[0]);
    } catch (error) {
      loggerService.error('Failed to get competitor metrics', error as Error, { competitorId, platform });
      return this.getMockCompetitorMetrics(competitorId, platform);
    }
  }

  private generateComparisons(userMetrics: UserCompetitiveMetrics, competitorMetrics: CompetitiveMetrics): CompetitiveComparison[] {
    const comparisons: CompetitiveComparison[] = [];

    // Engagement rate comparison
    const engagementDiff = userMetrics.engagementRate - competitorMetrics.avgEngagementRate;
    const engagementPctDiff = competitorMetrics.avgEngagementRate > 0 
      ? (engagementDiff / competitorMetrics.avgEngagementRate) * 100 
      : 0;

    comparisons.push({
      metric: 'Engagement Rate',
      userValue: userMetrics.engagementRate,
      competitorValue: competitorMetrics.avgEngagementRate,
      difference: engagementDiff,
      percentageDifference: engagementPctDiff,
      advantage: engagementDiff > 0 ? 'user' : engagementDiff < 0 ? 'competitor' : 'neutral'
    });

    // Follower comparison
    const followerDiff = userMetrics.followers - competitorMetrics.followers;
    const followerPctDiff = competitorMetrics.followers > 0 
      ? (followerDiff / competitorMetrics.followers) * 100 
      : 0;

    comparisons.push({
      metric: 'Followers',
      userValue: userMetrics.followers,
      competitorValue: competitorMetrics.followers,
      difference: followerDiff,
      percentageDifference: followerPctDiff,
      advantage: followerDiff > 0 ? 'user' : followerDiff < 0 ? 'competitor' : 'neutral'
    });

    // Post frequency comparison
    const frequencyDiff = userMetrics.postFrequency - competitorMetrics.postFrequency;
    const frequencyPctDiff = competitorMetrics.postFrequency > 0 
      ? (frequencyDiff / competitorMetrics.postFrequency) * 100 
      : 0;

    comparisons.push({
      metric: 'Post Frequency',
      userValue: userMetrics.postFrequency,
      competitorValue: competitorMetrics.postFrequency,
      difference: frequencyDiff,
      percentageDifference: frequencyPctDiff,
      advantage: Math.abs(frequencyDiff) < 0.1 ? 'neutral' : frequencyDiff > 0 ? 'user' : 'competitor'
    });

    return comparisons;
  }

  private async calculateUserRanking(
    userId: string, 
    userMetrics: UserCompetitiveMetrics, 
    competitorAnalyses: any[]
  ): Promise<CompetitiveRanking> {
    const allMetrics = [
      { type: 'user', metrics: userMetrics },
      ...competitorAnalyses.map(c => ({ type: 'competitor', metrics: c.metrics }))
    ];

    // Sort by engagement rate
    const engagementRanking = allMetrics
      .sort((a, b) => (b.metrics.avgEngagementRate || b.metrics.engagementRate) - (a.metrics.avgEngagementRate || a.metrics.engagementRate));
    
    const userEngagementRank = engagementRanking.findIndex(m => m.type === 'user') + 1;

    // Calculate overall ranking (simplified)
    const totalCompetitors = competitorAnalyses.length + 1;
    const overallRank = Math.ceil((userEngagementRank / totalCompetitors) * totalCompetitors);
    const percentile = ((totalCompetitors - overallRank + 1) / totalCompetitors) * 100;

    return {
      platform: userMetrics.platform,
      overallRank,
      totalCompetitors,
      percentile,
      metrics: {
        engagementRateRank: userEngagementRank,
        followerGrowthRank: userEngagementRank, // Simplified
        postFrequencyRank: userEngagementRank, // Simplified
        contentQualityRank: userEngagementRank // Simplified
      }
    };
  }

  private generateCompetitiveInsights(
    userMetrics: UserCompetitiveMetrics,
    competitorAnalyses: any[],
    benchmarks: IndustryBenchmark[]
  ): CompetitiveInsight[] {
    const insights: CompetitiveInsight[] = [];

    // Engagement rate insights
    const avgCompetitorEngagement = competitorAnalyses.reduce((sum, c) => sum + c.metrics.avgEngagementRate, 0) / competitorAnalyses.length;
    
    if (userMetrics.engagementRate > avgCompetitorEngagement * 1.2) {
      insights.push({
        type: 'strength',
        title: 'Superior Engagement Rate',
        description: `Your engagement rate (${userMetrics.engagementRate.toFixed(1)}%) is significantly higher than competitors' average (${avgCompetitorEngagement.toFixed(1)}%)`,
        impact: 'high',
        confidence: 0.9,
        data: { userRate: userMetrics.engagementRate, competitorAvg: avgCompetitorEngagement }
      });
    } else if (userMetrics.engagementRate < avgCompetitorEngagement * 0.8) {
      insights.push({
        type: 'weakness',
        title: 'Below-Average Engagement',
        description: `Your engagement rate (${userMetrics.engagementRate.toFixed(1)}%) is below competitors' average (${avgCompetitorEngagement.toFixed(1)}%)`,
        impact: 'high',
        confidence: 0.9,
        data: { userRate: userMetrics.engagementRate, competitorAvg: avgCompetitorEngagement }
      });
    }

    // Content type opportunities
    const competitorContentTypes = this.analyzeCompetitorContentTypes(competitorAnalyses);
    const underutilizedTypes = this.findUnderutilizedContentTypes(userMetrics.contentTypeDistribution, competitorContentTypes);
    
    if (underutilizedTypes.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Content Type Diversification',
        description: `Consider increasing ${underutilizedTypes.join(', ')} content, which competitors use effectively`,
        impact: 'medium',
        confidence: 0.7,
        data: { underutilizedTypes, competitorContentTypes }
      });
    }

    return insights;
  }

  private generateCompetitiveRecommendations(
    userMetrics: UserCompetitiveMetrics,
    competitorAnalyses: any[],
    insights: CompetitiveInsight[]
  ): CompetitiveRecommendation[] {
    const recommendations: CompetitiveRecommendation[] = [];

    // Engagement improvement recommendations
    const weaknessInsights = insights.filter(i => i.type === 'weakness');
    if (weaknessInsights.length > 0) {
      const topCompetitor = competitorAnalyses.sort((a, b) => b.metrics.avgEngagementRate - a.metrics.avgEngagementRate)[0];
      
      recommendations.push({
        category: 'engagement_tactics',
        recommendation: 'Analyze and adopt engagement strategies from top-performing competitors',
        rationale: 'Your engagement rate is below the competitive average',
        expectedImpact: `Potential to increase engagement rate by ${((topCompetitor.metrics.avgEngagementRate - userMetrics.engagementRate) / userMetrics.engagementRate * 100).toFixed(1)}%`,
        priority: 'high',
        competitorExample: {
          name: topCompetitor.profile.name,
          metric: 'Engagement Rate',
          value: topCompetitor.metrics.avgEngagementRate
        }
      });
    }

    // Content strategy recommendations
    const opportunityInsights = insights.filter(i => i.type === 'opportunity');
    if (opportunityInsights.length > 0) {
      recommendations.push({
        category: 'content_strategy',
        recommendation: 'Diversify content types to match successful competitor strategies',
        rationale: 'Competitors are successfully using content types you\'re underutilizing',
        expectedImpact: 'Improved audience engagement and reach',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  private analyzeCompetitorContentTypes(competitorAnalyses: any[]): Record<string, number> {
    const contentTypes: Record<string, number> = {};
    
    competitorAnalyses.forEach(competitor => {
      Object.entries(competitor.metrics.contentTypes).forEach(([type, count]) => {
        contentTypes[type] = (contentTypes[type] || 0) + (count as number);
      });
    });

    // Calculate averages
    Object.keys(contentTypes).forEach(type => {
      contentTypes[type] = contentTypes[type] / competitorAnalyses.length;
    });

    return contentTypes;
  }

  private findUnderutilizedContentTypes(userTypes: Record<string, number>, competitorTypes: Record<string, number>): string[] {
    const underutilized: string[] = [];
    
    Object.entries(competitorTypes).forEach(([type, competitorUsage]) => {
      const userUsage = userTypes[type] || 0;
      if (userUsage < competitorUsage * 0.5) { // User uses less than half of competitor average
        underutilized.push(type);
      }
    });

    return underutilized;
  }

  private generateAnalysisSummary(user: any, competitors: any[]): string {
    const ranking = user.ranking;
    const totalCompetitors = competitors.length;
    
    return `You rank #${ranking.overallRank} out of ${ranking.totalCompetitors} competitors (${ranking.percentile.toFixed(1)}th percentile) with a ${user.metrics.engagementRate.toFixed(1)}% engagement rate. ${
      ranking.percentile > 75 ? 'You\'re performing well above average.' :
      ranking.percentile > 50 ? 'You\'re performing above average with room for improvement.' :
      'There\'s significant opportunity to improve your competitive position.'
    }`;
  }

  private extractKeyFindings(analysis: CompetitiveAnalysis): string[] {
    const findings: string[] = [];
    
    // Top competitor finding
    const topCompetitor = analysis.competitors.sort((a, b) => b.metrics.avgEngagementRate - a.metrics.avgEngagementRate)[0];
    if (topCompetitor) {
      findings.push(`${topCompetitor.profile.name} leads with ${topCompetitor.metrics.avgEngagementRate.toFixed(1)}% engagement rate`);
    }

    // User's strongest metric
    const userRanking = analysis.user.ranking;
    if (userRanking.percentile > 75) {
      findings.push(`You excel in engagement rate, ranking in the top ${(100 - userRanking.percentile).toFixed(0)}%`);
    }

    // Industry benchmark comparison
    if (analysis.industryBenchmarks.length > 0) {
      const benchmark = analysis.industryBenchmarks[0];
      const userVsBenchmark = ((analysis.user.metrics.engagementRate - benchmark.metrics.avgEngagementRate) / benchmark.metrics.avgEngagementRate) * 100;
      
      findings.push(`Your engagement rate is ${Math.abs(userVsBenchmark).toFixed(1)}% ${userVsBenchmark > 0 ? 'above' : 'below'} industry average`);
    }

    return findings.slice(0, 5); // Limit to top 5 findings
  }

  private getDefaultBenchmarks(industry: string, platform?: Platform): IndustryBenchmark[] {
    // Return default industry benchmarks when no data is available
    const platforms = platform ? [platform] : [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER, Platform.PINTEREST];
    
    return platforms.map(p => ({
      industry,
      platform: p,
      metrics: {
        avgFollowers: 5000,
        avgEngagementRate: 2.5,
        avgPostFrequency: 1.2,
        topContentTypes: [
          { type: 'image', percentage: 60, avgEngagement: 3.2 },
          { type: 'text', percentage: 25, avgEngagement: 2.1 },
          { type: 'video', percentage: 15, avgEngagement: 4.5 }
        ],
        optimalPostingTimes: [
          { dayOfWeek: 1, hour: 9, engagementMultiplier: 1.2 },
          { dayOfWeek: 3, hour: 15, engagementMultiplier: 1.1 },
          { dayOfWeek: 5, hour: 12, engagementMultiplier: 1.15 }
        ],
        topHashtags: [
          { hashtag: 'business', usage: 100, avgEngagement: 2.8 },
          { hashtag: 'marketing', usage: 85, avgEngagement: 3.1 },
          { hashtag: 'socialmedia', usage: 70, avgEngagement: 2.9 }
        ]
      },
      sampleSize: 100,
      lastUpdated: new Date()
    }));
  }

  private getMockCompetitorMetrics(competitorId: string, platform: Platform): CompetitiveMetrics {
    return {
      competitorId,
      platform,
      date: new Date(),
      followers: Math.floor(Math.random() * 10000) + 1000,
      following: Math.floor(Math.random() * 1000) + 100,
      posts: Math.floor(Math.random() * 500) + 50,
      avgEngagementRate: Math.random() * 5 + 1,
      avgLikes: Math.floor(Math.random() * 100) + 10,
      avgComments: Math.floor(Math.random() * 20) + 2,
      avgShares: Math.floor(Math.random() * 10) + 1,
      postFrequency: Math.random() * 2 + 0.5,
      topHashtags: ['#business', '#marketing', '#growth'],
      contentTypes: {
        image: Math.floor(Math.random() * 50) + 30,
        text: Math.floor(Math.random() * 30) + 10,
        video: Math.floor(Math.random() * 20) + 5
      }
    };
  }

  private mapCompetitorRow(row: any): CompetitorProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      industry: row.industry,
      platforms: JSON.parse(row.platforms || '[]'),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapMetricsRow(row: any): CompetitiveMetrics {
    return {
      competitorId: row.competitor_id,
      platform: row.platform,
      date: row.date,
      followers: row.followers,
      following: row.following,
      posts: row.posts,
      avgEngagementRate: row.avg_engagement_rate,
      avgLikes: row.avg_likes,
      avgComments: row.avg_comments,
      avgShares: row.avg_shares,
      postFrequency: row.post_frequency,
      topHashtags: row.top_hashtags || [],
      contentTypes: JSON.parse(row.content_types || '{}')
    };
  }

  private mapBenchmarkRow(row: any): IndustryBenchmark {
    return {
      industry: row.industry,
      platform: row.platform,
      metrics: JSON.parse(row.metrics || '{}'),
      sampleSize: row.sample_size,
      lastUpdated: row.last_updated
    };
  }
}

export const competitiveAnalysisService = CompetitiveAnalysisService.getInstance();
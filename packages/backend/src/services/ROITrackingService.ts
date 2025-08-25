/**
 * ROI Tracking Service
 * 
 * Provides ROI tracking and attribution modeling for content performance measurement.
 * Tracks conversions, revenue attribution, and campaign effectiveness.
 */

import { db } from '../database/connection';
import { Platform, PostStatus } from '../types/database';
import { loggerService } from './LoggerService';

export interface ConversionGoal {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: 'website_visit' | 'signup' | 'purchase' | 'download' | 'contact' | 'custom';
  value: number; // Monetary value of the conversion
  currency: string;
  trackingMethod: 'utm_parameters' | 'pixel_tracking' | 'api_integration' | 'manual';
  config: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    pixelId?: string;
    webhookUrl?: string;
    customParameters?: Record<string, string>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversionEvent {
  id: string;
  goalId: string;
  userId: string;
  postId?: string;
  platform?: Platform;
  sessionId?: string;
  visitorId?: string;
  value: number;
  currency: string;
  attributionData: AttributionData;
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface AttributionData {
  touchpoints: TouchPoint[];
  attributionModel: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';
  attributedValue: number;
  confidence: number;
}

export interface TouchPoint {
  postId: string;
  platform: Platform;
  timestamp: Date;
  interactionType: 'view' | 'click' | 'share' | 'comment' | 'like';
  weight: number; // Attribution weight (0-1)
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  budget?: number;
  currency: string;
  goals: string[]; // ConversionGoal IDs
  posts: string[]; // Post IDs
  platforms: Platform[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ROIMetrics {
  campaign?: Campaign;
  period: {
    startDate: Date;
    endDate: Date;
  };
  investment: {
    totalSpend: number;
    timeInvestment: number; // hours
    contentCreationCost: number;
    platformCosts: number;
    currency: string;
  };
  returns: {
    totalRevenue: number;
    conversions: number;
    averageOrderValue: number;
    lifetimeValue: number;
    currency: string;
  };
  metrics: {
    roi: number; // Return on Investment percentage
    roas: number; // Return on Ad Spend
    cpa: number; // Cost per Acquisition
    cpc: number; // Cost per Click
    cpm: number; // Cost per Mille (thousand impressions)
    conversionRate: number;
    revenuePerPost: number;
  };
  attribution: {
    model: string;
    topPerformingPosts: Array<{
      postId: string;
      platform: Platform;
      attributedRevenue: number;
      conversions: number;
      roi: number;
    }>;
    platformBreakdown: Array<{
      platform: Platform;
      revenue: number;
      conversions: number;
      spend: number;
      roi: number;
    }>;
  };
}

export interface AttributionReport {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';
  conversions: Array<{
    conversionId: string;
    goalName: string;
    value: number;
    touchpoints: TouchPoint[];
    attributedPosts: Array<{
      postId: string;
      platform: Platform;
      attributedValue: number;
      weight: number;
    }>;
  }>;
  summary: {
    totalConversions: number;
    totalValue: number;
    averagePathLength: number;
    topChannels: Array<{
      platform: Platform;
      conversions: number;
      value: number;
      percentage: number;
    }>;
  };
}

export class ROITrackingService {
  private static instance: ROITrackingService;

  private constructor() {}

  public static getInstance(): ROITrackingService {
    if (!ROITrackingService.instance) {
      ROITrackingService.instance = new ROITrackingService();
    }
    return ROITrackingService.instance;
  }

  /**
   * Create conversion goal
   */
  async createConversionGoal(userId: string, goal: Omit<ConversionGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ConversionGoal> {
    try {
      const query = `
        INSERT INTO conversion_goals (
          user_id, name, description, type, value, currency, 
          tracking_method, config, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        goal.name,
        goal.description,
        goal.type,
        goal.value,
        goal.currency,
        goal.trackingMethod,
        JSON.stringify(goal.config),
        goal.isActive
      ]);

      const createdGoal = this.mapGoalRow(result.rows[0]);
      
      loggerService.info('Conversion goal created', {
        goalId: createdGoal.id,
        userId,
        type: goal.type
      });

      return createdGoal;
    } catch (error) {
      loggerService.error('Failed to create conversion goal', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Track conversion event
   */
  async trackConversion(conversion: Omit<ConversionEvent, 'id' | 'timestamp'>): Promise<ConversionEvent> {
    try {
      const query = `
        INSERT INTO conversion_events (
          goal_id, user_id, post_id, platform, session_id, visitor_id,
          value, currency, attribution_data, event_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await db.query(query, [
        conversion.goalId,
        conversion.userId,
        conversion.postId,
        conversion.platform,
        conversion.sessionId,
        conversion.visitorId,
        conversion.value,
        conversion.currency,
        JSON.stringify(conversion.attributionData),
        JSON.stringify(conversion.eventData)
      ]);

      const trackedConversion = this.mapConversionRow(result.rows[0]);
      
      loggerService.info('Conversion tracked', {
        conversionId: trackedConversion.id,
        goalId: conversion.goalId,
        value: conversion.value
      });

      return trackedConversion;
    } catch (error) {
      loggerService.error('Failed to track conversion', error as Error, { goalId: conversion.goalId });
      throw error;
    }
  }

  /**
   * Create campaign
   */
  async createCampaign(userId: string, campaign: Omit<Campaign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
    try {
      const query = `
        INSERT INTO campaigns (
          user_id, name, description, start_date, end_date, budget, 
          currency, goals, posts, platforms, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        campaign.name,
        campaign.description,
        campaign.startDate,
        campaign.endDate,
        campaign.budget,
        campaign.currency,
        campaign.goals,
        campaign.posts,
        campaign.platforms,
        campaign.status
      ]);

      const createdCampaign = this.mapCampaignRow(result.rows[0]);
      
      loggerService.info('Campaign created', {
        campaignId: createdCampaign.id,
        userId,
        name: campaign.name
      });

      return createdCampaign;
    } catch (error) {
      loggerService.error('Failed to create campaign', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate ROI metrics
   */
  async calculateROI(userId: string, campaignId?: string, startDate?: Date, endDate?: Date): Promise<ROIMetrics> {
    try {
      const period = {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date()
      };

      let campaign: Campaign | undefined;
      if (campaignId) {
        campaign = await this.getCampaign(campaignId, userId);
        if (!campaign) {
          throw new Error('Campaign not found');
        }
      }

      const [investment, returns, attribution] = await Promise.all([
        this.calculateInvestment(userId, campaignId, period),
        this.calculateReturns(userId, campaignId, period),
        this.calculateAttribution(userId, campaignId, period)
      ]);

      const metrics = this.calculateMetrics(investment, returns);

      return {
        campaign,
        period,
        investment,
        returns,
        metrics,
        attribution
      };
    } catch (error) {
      loggerService.error('Failed to calculate ROI', error as Error, { userId, campaignId });
      throw error;
    }
  }

  /**
   * Generate attribution report
   */
  async generateAttributionReport(
    userId: string,
    model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' = 'linear',
    startDate?: Date,
    endDate?: Date
  ): Promise<AttributionReport> {
    try {
      const period = {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date()
      };

      const conversions = await this.getConversionsWithAttribution(userId, period, model);
      const summary = this.calculateAttributionSummary(conversions);

      return {
        userId,
        period,
        model,
        conversions,
        summary
      };
    } catch (error) {
      loggerService.error('Failed to generate attribution report', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get conversion funnel analysis
   */
  async getConversionFunnel(userId: string, goalId: string, startDate?: Date, endDate?: Date): Promise<{
    stages: Array<{
      name: string;
      count: number;
      conversionRate: number;
      dropoffRate: number;
    }>;
    totalVisitors: number;
    totalConversions: number;
    overallConversionRate: number;
  }> {
    try {
      const period = {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date()
      };

      // This is a simplified funnel - in a real implementation, you'd track each stage
      const stages = [
        { name: 'Impression', count: 10000, conversionRate: 100, dropoffRate: 0 },
        { name: 'Click', count: 500, conversionRate: 5, dropoffRate: 95 },
        { name: 'Landing Page View', count: 400, conversionRate: 4, dropoffRate: 20 },
        { name: 'Engagement', count: 200, conversionRate: 2, dropoffRate: 50 },
        { name: 'Conversion', count: 50, conversionRate: 0.5, dropoffRate: 75 }
      ];

      return {
        stages,
        totalVisitors: stages[0].count,
        totalConversions: stages[stages.length - 1].count,
        overallConversionRate: (stages[stages.length - 1].count / stages[0].count) * 100
      };
    } catch (error) {
      loggerService.error('Failed to get conversion funnel', error as Error, { userId, goalId });
      throw error;
    }
  }

  /**
   * Get user's conversion goals
   */
  async getUserConversionGoals(userId: string): Promise<ConversionGoal[]> {
    try {
      const query = `
        SELECT * FROM conversion_goals 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapGoalRow(row));
    } catch (error) {
      loggerService.error('Failed to get user conversion goals', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user's campaigns
   */
  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    try {
      const query = `
        SELECT * FROM campaigns 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapCampaignRow(row));
    } catch (error) {
      loggerService.error('Failed to get user campaigns', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async calculateInvestment(userId: string, campaignId?: string, period?: { startDate: Date; endDate: Date }): Promise<ROIMetrics['investment']> {
    // In a real implementation, this would calculate actual costs
    // For now, returning estimated values
    return {
      totalSpend: 500, // Platform advertising costs
      timeInvestment: 20, // Hours spent
      contentCreationCost: 200, // Content creation costs
      platformCosts: 300, // Platform-specific costs
      currency: 'USD'
    };
  }

  private async calculateReturns(userId: string, campaignId?: string, period?: { startDate: Date; endDate: Date }): Promise<ROIMetrics['returns']> {
    try {
      let query = `
        SELECT 
          COUNT(*) as conversions,
          COALESCE(SUM(value), 0) as total_revenue,
          COALESCE(AVG(value), 0) as average_order_value
        FROM conversion_events ce
        JOIN conversion_goals cg ON ce.goal_id = cg.id
        WHERE ce.user_id = $1
      `;
      
      const params = [userId];
      let paramCount = 2;

      if (period) {
        query += ` AND ce.timestamp BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(period.startDate, period.endDate);
      }

      if (campaignId) {
        query += ` AND ce.post_id IN (
          SELECT unnest(posts) FROM campaigns WHERE id = $${paramCount++}
        )`;
        params.push(campaignId);
      }

      const result = await db.query(query, params);
      const row = result.rows[0];

      return {
        totalRevenue: parseFloat(row.total_revenue) || 0,
        conversions: parseInt(row.conversions) || 0,
        averageOrderValue: parseFloat(row.average_order_value) || 0,
        lifetimeValue: parseFloat(row.average_order_value) * 3 || 0, // Estimated LTV
        currency: 'USD'
      };
    } catch (error) {
      loggerService.error('Failed to calculate returns', error as Error, { userId, campaignId });
      return {
        totalRevenue: 0,
        conversions: 0,
        averageOrderValue: 0,
        lifetimeValue: 0,
        currency: 'USD'
      };
    }
  }

  private async calculateAttribution(userId: string, campaignId?: string, period?: { startDate: Date; endDate: Date }): Promise<ROIMetrics['attribution']> {
    try {
      // Get top performing posts with attribution
      const topPerformingPosts = await this.getTopPerformingPosts(userId, campaignId, period);
      const platformBreakdown = await this.getPlatformBreakdown(userId, campaignId, period);

      return {
        model: 'linear',
        topPerformingPosts,
        platformBreakdown
      };
    } catch (error) {
      loggerService.error('Failed to calculate attribution', error as Error, { userId, campaignId });
      return {
        model: 'linear',
        topPerformingPosts: [],
        platformBreakdown: []
      };
    }
  }

  private calculateMetrics(investment: ROIMetrics['investment'], returns: ROIMetrics['returns']): ROIMetrics['metrics'] {
    const roi = investment.totalSpend > 0 ? ((returns.totalRevenue - investment.totalSpend) / investment.totalSpend) * 100 : 0;
    const roas = investment.totalSpend > 0 ? returns.totalRevenue / investment.totalSpend : 0;
    const cpa = returns.conversions > 0 ? investment.totalSpend / returns.conversions : 0;
    
    // Mock values for metrics that require additional data
    const cpc = 2.50; // Cost per click
    const cpm = 15.00; // Cost per thousand impressions
    const conversionRate = 2.5; // Conversion rate percentage
    const revenuePerPost = returns.totalRevenue / Math.max(1, 10); // Assuming 10 posts

    return {
      roi,
      roas,
      cpa,
      cpc,
      cpm,
      conversionRate,
      revenuePerPost
    };
  }

  private async getTopPerformingPosts(userId: string, campaignId?: string, period?: { startDate: Date; endDate: Date }): Promise<ROIMetrics['attribution']['topPerformingPosts']> {
    try {
      let query = `
        SELECT 
          ce.post_id,
          ce.platform,
          COALESCE(SUM(ce.value), 0) as attributed_revenue,
          COUNT(*) as conversions
        FROM conversion_events ce
        WHERE ce.user_id = $1 AND ce.post_id IS NOT NULL
      `;
      
      const params = [userId];
      let paramCount = 2;

      if (period) {
        query += ` AND ce.timestamp BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(period.startDate, period.endDate);
      }

      if (campaignId) {
        query += ` AND ce.post_id IN (
          SELECT unnest(posts) FROM campaigns WHERE id = $${paramCount++}
        )`;
        params.push(campaignId);
      }

      query += `
        GROUP BY ce.post_id, ce.platform
        ORDER BY attributed_revenue DESC
        LIMIT 10
      `;

      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        postId: row.post_id,
        platform: row.platform,
        attributedRevenue: parseFloat(row.attributed_revenue) || 0,
        conversions: parseInt(row.conversions) || 0,
        roi: 0 // Would calculate based on post-specific investment
      }));
    } catch (error) {
      loggerService.error('Failed to get top performing posts', error as Error, { userId, campaignId });
      return [];
    }
  }

  private async getPlatformBreakdown(userId: string, campaignId?: string, period?: { startDate: Date; endDate: Date }): Promise<ROIMetrics['attribution']['platformBreakdown']> {
    try {
      let query = `
        SELECT 
          ce.platform,
          COALESCE(SUM(ce.value), 0) as revenue,
          COUNT(*) as conversions
        FROM conversion_events ce
        WHERE ce.user_id = $1 AND ce.platform IS NOT NULL
      `;
      
      const params = [userId];
      let paramCount = 2;

      if (period) {
        query += ` AND ce.timestamp BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(period.startDate, period.endDate);
      }

      if (campaignId) {
        query += ` AND ce.post_id IN (
          SELECT unnest(posts) FROM campaigns WHERE id = $${paramCount++}
        )`;
        params.push(campaignId);
      }

      query += `
        GROUP BY ce.platform
        ORDER BY revenue DESC
      `;

      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        platform: row.platform,
        revenue: parseFloat(row.revenue) || 0,
        conversions: parseInt(row.conversions) || 0,
        spend: 100, // Mock spend per platform
        roi: 0 // Would calculate based on platform-specific spend
      }));
    } catch (error) {
      loggerService.error('Failed to get platform breakdown', error as Error, { userId, campaignId });
      return [];
    }
  }

  private async getConversionsWithAttribution(
    userId: string, 
    period: { startDate: Date; endDate: Date }, 
    model: string
  ): Promise<AttributionReport['conversions']> {
    try {
      const query = `
        SELECT 
          ce.id as conversion_id,
          cg.name as goal_name,
          ce.value,
          ce.attribution_data
        FROM conversion_events ce
        JOIN conversion_goals cg ON ce.goal_id = cg.id
        WHERE ce.user_id = $1 
          AND ce.timestamp BETWEEN $2 AND $3
        ORDER BY ce.timestamp DESC
      `;

      const result = await db.query(query, [userId, period.startDate, period.endDate]);
      
      return result.rows.map(row => {
        const attributionData = JSON.parse(row.attribution_data || '{}');
        
        return {
          conversionId: row.conversion_id,
          goalName: row.goal_name,
          value: parseFloat(row.value) || 0,
          touchpoints: attributionData.touchpoints || [],
          attributedPosts: this.calculatePostAttribution(attributionData.touchpoints || [], model)
        };
      });
    } catch (error) {
      loggerService.error('Failed to get conversions with attribution', error as Error, { userId });
      return [];
    }
  }

  private calculatePostAttribution(touchpoints: TouchPoint[], model: string): Array<{
    postId: string;
    platform: Platform;
    attributedValue: number;
    weight: number;
  }> {
    if (touchpoints.length === 0) return [];

    const posts = new Map<string, { platform: Platform; weight: number }>();

    touchpoints.forEach((touchpoint, index) => {
      let weight = 0;

      switch (model) {
        case 'first_touch':
          weight = index === 0 ? 1 : 0;
          break;
        case 'last_touch':
          weight = index === touchpoints.length - 1 ? 1 : 0;
          break;
        case 'linear':
          weight = 1 / touchpoints.length;
          break;
        case 'time_decay':
          weight = Math.pow(2, index - touchpoints.length + 1);
          break;
        case 'position_based':
          if (index === 0 || index === touchpoints.length - 1) {
            weight = 0.4;
          } else {
            weight = 0.2 / Math.max(1, touchpoints.length - 2);
          }
          break;
        default:
          weight = 1 / touchpoints.length;
      }

      posts.set(touchpoint.postId, {
        platform: touchpoint.platform,
        weight
      });
    });

    return Array.from(posts.entries()).map(([postId, data]) => ({
      postId,
      platform: data.platform,
      attributedValue: 0, // Would be calculated based on conversion value
      weight: data.weight
    }));
  }

  private calculateAttributionSummary(conversions: AttributionReport['conversions']): AttributionReport['summary'] {
    const totalConversions = conversions.length;
    const totalValue = conversions.reduce((sum, c) => sum + c.value, 0);
    const averagePathLength = conversions.reduce((sum, c) => sum + c.touchpoints.length, 0) / Math.max(1, totalConversions);

    const platformCounts = new Map<Platform, { conversions: number; value: number }>();
    
    conversions.forEach(conversion => {
      conversion.touchpoints.forEach(touchpoint => {
        const current = platformCounts.get(touchpoint.platform) || { conversions: 0, value: 0 };
        current.conversions += 1;
        current.value += conversion.value * touchpoint.weight;
        platformCounts.set(touchpoint.platform, current);
      });
    });

    const topChannels = Array.from(platformCounts.entries())
      .map(([platform, data]) => ({
        platform,
        conversions: data.conversions,
        value: data.value,
        percentage: (data.value / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalConversions,
      totalValue,
      averagePathLength,
      topChannels
    };
  }

  private async getCampaign(campaignId: string, userId: string): Promise<Campaign | null> {
    const query = `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`;
    const result = await db.query(query, [campaignId, userId]);
    
    return result.rows.length > 0 ? this.mapCampaignRow(result.rows[0]) : null;
  }

  private mapGoalRow(row: any): ConversionGoal {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      value: row.value,
      currency: row.currency,
      trackingMethod: row.tracking_method,
      config: JSON.parse(row.config || '{}'),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapConversionRow(row: any): ConversionEvent {
    return {
      id: row.id,
      goalId: row.goal_id,
      userId: row.user_id,
      postId: row.post_id,
      platform: row.platform,
      sessionId: row.session_id,
      visitorId: row.visitor_id,
      value: row.value,
      currency: row.currency,
      attributionData: JSON.parse(row.attribution_data || '{}'),
      eventData: JSON.parse(row.event_data || '{}'),
      timestamp: row.timestamp
    };
  }

  private mapCampaignRow(row: any): Campaign {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      budget: row.budget,
      currency: row.currency,
      goals: row.goals || [],
      posts: row.posts || [],
      platforms: row.platforms || [],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const roiTrackingService = ROITrackingService.getInstance();
/**
 * Custom Dashboard Service
 * 
 * Provides configurable analytics dashboards with custom metrics and KPI tracking.
 * Allows users to create personalized dashboard views with specific metrics and visualizations.
 */

import { db } from '../database/connection';
import { Platform, PostStatus } from '../types/database';
import { loggerService } from './LoggerService';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'progress' | 'comparison';
  title: string;
  description?: string;
  config: {
    metric?: string;
    platforms?: Platform[];
    timeRange?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    comparison?: 'previous_period' | 'target' | 'benchmark';
    target?: number;
    size: 'small' | 'medium' | 'large';
    position: { x: number; y: number; w: number; h: number };
  };
  data?: any;
  lastUpdated?: Date;
}

export interface CustomDashboard {
  id: string;
  userId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIDefinition {
  id: string;
  userId: string;
  name: string;
  description: string;
  formula: string; // SQL-like formula for calculation
  target: number;
  unit: string;
  category: 'engagement' | 'reach' | 'conversion' | 'growth' | 'efficiency';
  platforms: Platform[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIResult {
  kpiId: string;
  value: number;
  target: number;
  achievement: number; // percentage of target achieved
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  calculatedAt: Date;
}

export class CustomDashboardService {
  private static instance: CustomDashboardService;

  private constructor() {}

  public static getInstance(): CustomDashboardService {
    if (!CustomDashboardService.instance) {
      CustomDashboardService.instance = new CustomDashboardService();
    }
    return CustomDashboardService.instance;
  }

  /**
   * Create a new custom dashboard
   */
  async createDashboard(userId: string, dashboard: Omit<CustomDashboard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<CustomDashboard> {
    try {
      const query = `
        INSERT INTO custom_dashboards (user_id, name, description, widgets, is_default, is_public, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        dashboard.name,
        dashboard.description,
        JSON.stringify(dashboard.widgets),
        dashboard.isDefault,
        dashboard.isPublic,
        dashboard.tags
      ]);

      const createdDashboard = this.mapDashboardRow(result.rows[0]);
      
      loggerService.info('Custom dashboard created', {
        dashboardId: createdDashboard.id,
        userId,
        widgetCount: dashboard.widgets.length
      });

      return createdDashboard;
    } catch (error) {
      loggerService.error('Failed to create custom dashboard', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user's dashboards
   */
  async getUserDashboards(userId: string): Promise<CustomDashboard[]> {
    try {
      const query = `
        SELECT * FROM custom_dashboards 
        WHERE user_id = $1 OR is_public = true
        ORDER BY is_default DESC, updated_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapDashboardRow(row));
    } catch (error) {
      loggerService.error('Failed to get user dashboards', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(dashboardId: string, userId: string): Promise<CustomDashboard | null> {
    try {
      const query = `
        SELECT * FROM custom_dashboards 
        WHERE id = $1 AND (user_id = $2 OR is_public = true)
      `;

      const result = await db.query(query, [dashboardId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const dashboard = this.mapDashboardRow(result.rows[0]);
      
      // Populate widget data
      dashboard.widgets = await Promise.all(
        dashboard.widgets.map(widget => this.populateWidgetData(widget, userId))
      );

      return dashboard;
    } catch (error) {
      loggerService.error('Failed to get dashboard', error as Error, { dashboardId, userId });
      throw error;
    }
  }

  /**
   * Update dashboard
   */
  async updateDashboard(dashboardId: string, userId: string, updates: Partial<CustomDashboard>): Promise<CustomDashboard | null> {
    try {
      const setClause: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClause.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClause.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.widgets !== undefined) {
        setClause.push(`widgets = $${paramCount++}`);
        values.push(JSON.stringify(updates.widgets));
      }
      if (updates.isDefault !== undefined) {
        setClause.push(`is_default = $${paramCount++}`);
        values.push(updates.isDefault);
      }
      if (updates.isPublic !== undefined) {
        setClause.push(`is_public = $${paramCount++}`);
        values.push(updates.isPublic);
      }
      if (updates.tags !== undefined) {
        setClause.push(`tags = $${paramCount++}`);
        values.push(updates.tags);
      }

      if (setClause.length === 0) {
        return this.getDashboard(dashboardId, userId);
      }

      setClause.push(`updated_at = NOW()`);
      values.push(dashboardId, userId);

      const query = `
        UPDATE custom_dashboards 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount++} AND user_id = $${paramCount++}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDashboardRow(result.rows[0]);
    } catch (error) {
      loggerService.error('Failed to update dashboard', error as Error, { dashboardId, userId });
      throw error;
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(dashboardId: string, userId: string): Promise<boolean> {
    try {
      const query = `DELETE FROM custom_dashboards WHERE id = $1 AND user_id = $2`;
      const result = await db.query(query, [dashboardId, userId]);
      
      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted) {
        loggerService.info('Dashboard deleted', { dashboardId, userId });
      }

      return deleted;
    } catch (error) {
      loggerService.error('Failed to delete dashboard', error as Error, { dashboardId, userId });
      throw error;
    }
  }

  /**
   * Create KPI definition
   */
  async createKPI(userId: string, kpi: Omit<KPIDefinition, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<KPIDefinition> {
    try {
      const query = `
        INSERT INTO kpi_definitions (user_id, name, description, formula, target, unit, category, platforms, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        kpi.name,
        kpi.description,
        kpi.formula,
        kpi.target,
        kpi.unit,
        kpi.category,
        kpi.platforms,
        kpi.isActive
      ]);

      return this.mapKPIRow(result.rows[0]);
    } catch (error) {
      loggerService.error('Failed to create KPI', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user's KPIs
   */
  async getUserKPIs(userId: string): Promise<KPIDefinition[]> {
    try {
      const query = `
        SELECT * FROM kpi_definitions 
        WHERE user_id = $1 
        ORDER BY category, name
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapKPIRow(row));
    } catch (error) {
      loggerService.error('Failed to get user KPIs', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate KPI values
   */
  async calculateKPIs(userId: string, startDate: Date, endDate: Date, kpiIds?: string[]): Promise<KPIResult[]> {
    try {
      let kpis: KPIDefinition[];
      
      if (kpiIds && kpiIds.length > 0) {
        const query = `
          SELECT * FROM kpi_definitions 
          WHERE user_id = $1 AND id = ANY($2) AND is_active = true
        `;
        const result = await db.query(query, [userId, kpiIds]);
        kpis = result.rows.map(row => this.mapKPIRow(row));
      } else {
        kpis = await this.getUserKPIs(userId);
        kpis = kpis.filter(kpi => kpi.isActive);
      }

      const results: KPIResult[] = [];

      for (const kpi of kpis) {
        try {
          const value = await this.executeKPIFormula(kpi, userId, startDate, endDate);
          const previousPeriodValue = await this.calculatePreviousPeriodValue(kpi, userId, startDate, endDate);
          
          const achievement = kpi.target > 0 ? (value / kpi.target) * 100 : 0;
          const trendPercentage = previousPeriodValue > 0 ? ((value - previousPeriodValue) / previousPeriodValue) * 100 : 0;
          
          let trend: 'up' | 'down' | 'stable';
          if (Math.abs(trendPercentage) < 5) {
            trend = 'stable';
          } else if (trendPercentage > 0) {
            trend = 'up';
          } else {
            trend = 'down';
          }

          results.push({
            kpiId: kpi.id,
            value,
            target: kpi.target,
            achievement,
            trend,
            trendPercentage: Math.abs(trendPercentage),
            period: { startDate, endDate },
            calculatedAt: new Date()
          });
        } catch (kpiError) {
          loggerService.error('Failed to calculate KPI', kpiError as Error, { 
            kpiId: kpi.id, 
            userId 
          });
        }
      }

      return results;
    } catch (error) {
      loggerService.error('Failed to calculate KPIs', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get dashboard templates
   */
  async getDashboardTemplates(): Promise<Omit<CustomDashboard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]> {
    return [
      {
        name: 'Social Media Overview',
        description: 'High-level metrics across all platforms',
        widgets: [
          {
            id: 'total-engagement',
            type: 'metric',
            title: 'Total Engagement',
            config: {
              metric: 'total_engagement',
              size: 'medium',
              position: { x: 0, y: 0, w: 3, h: 2 }
            }
          },
          {
            id: 'engagement-trend',
            type: 'chart',
            title: 'Engagement Trend',
            config: {
              metric: 'engagement_over_time',
              chartType: 'line',
              timeRange: '30d',
              size: 'large',
              position: { x: 3, y: 0, w: 6, h: 4 }
            }
          },
          {
            id: 'platform-breakdown',
            type: 'chart',
            title: 'Platform Performance',
            config: {
              metric: 'platform_engagement',
              chartType: 'bar',
              size: 'medium',
              position: { x: 0, y: 2, w: 3, h: 3 }
            }
          }
        ],
        isDefault: false,
        isPublic: true,
        tags: ['overview', 'engagement', 'platforms']
      },
      {
        name: 'Content Performance',
        description: 'Detailed content analytics and optimization insights',
        widgets: [
          {
            id: 'top-posts',
            type: 'table',
            title: 'Top Performing Posts',
            config: {
              metric: 'top_posts',
              size: 'large',
              position: { x: 0, y: 0, w: 6, h: 4 }
            }
          },
          {
            id: 'content-types',
            type: 'chart',
            title: 'Content Type Performance',
            config: {
              metric: 'content_type_performance',
              chartType: 'pie',
              size: 'medium',
              position: { x: 6, y: 0, w: 3, h: 3 }
            }
          },
          {
            id: 'hashtag-performance',
            type: 'table',
            title: 'Top Hashtags',
            config: {
              metric: 'top_hashtags',
              size: 'medium',
              position: { x: 6, y: 3, w: 3, h: 3 }
            }
          }
        ],
        isDefault: false,
        isPublic: true,
        tags: ['content', 'performance', 'optimization']
      }
    ];
  }

  /**
   * Private helper methods
   */
  private mapDashboardRow(row: any): CustomDashboard {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      widgets: JSON.parse(row.widgets || '[]'),
      isDefault: row.is_default,
      isPublic: row.is_public,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapKPIRow(row: any): KPIDefinition {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      formula: row.formula,
      target: row.target,
      unit: row.unit,
      category: row.category,
      platforms: row.platforms || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private async populateWidgetData(widget: DashboardWidget, userId: string): Promise<DashboardWidget> {
    try {
      const data = await this.calculateWidgetData(widget, userId);
      return {
        ...widget,
        data,
        lastUpdated: new Date()
      };
    } catch (error) {
      loggerService.error('Failed to populate widget data', error as Error, { 
        widgetId: widget.id, 
        userId 
      });
      return widget;
    }
  }

  private async calculateWidgetData(widget: DashboardWidget, userId: string): Promise<any> {
    const { config } = widget;
    const timeRange = config.timeRange || '30d';
    const { startDate, endDate } = this.parseTimeRange(timeRange);

    switch (config.metric) {
      case 'total_engagement':
        return this.getTotalEngagement(userId, startDate, endDate, config.platforms);
      
      case 'engagement_over_time':
        return this.getEngagementOverTime(userId, startDate, endDate, config.platforms);
      
      case 'platform_engagement':
        return this.getPlatformEngagement(userId, startDate, endDate);
      
      case 'top_posts':
        return this.getTopPosts(userId, startDate, endDate, config.platforms);
      
      case 'content_type_performance':
        return this.getContentTypePerformance(userId, startDate, endDate);
      
      case 'top_hashtags':
        return this.getTopHashtags(userId, startDate, endDate);
      
      default:
        return null;
    }
  }

  private parseTimeRange(timeRange: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private async getTotalEngagement(userId: string, startDate: Date, endDate: Date, platforms?: Platform[]): Promise<number> {
    const platformFilter = platforms && platforms.length > 0 ? 'AND p.platforms && $4' : '';
    const params: any[] = [userId, PostStatus.PUBLISHED, startDate, endDate];
    if (platforms && platforms.length > 0) params.push(platforms);

    const query = `
      SELECT COALESCE(SUM(
        CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') 
        THEN pa.metric_value ELSE 0 END
      ), 0) as total_engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      ${platformFilter}
    `;

    const result = await db.query(query, params);
    return parseInt(result.rows[0]?.total_engagement) || 0;
  }

  private async getEngagementOverTime(userId: string, startDate: Date, endDate: Date, platforms?: Platform[]): Promise<any[]> {
    const platformFilter = platforms && platforms.length > 0 ? 'AND p.platforms && $4' : '';
    const params: any[] = [userId, PostStatus.PUBLISHED, startDate, endDate];
    if (platforms && platforms.length > 0) params.push(platforms);

    const query = `
      SELECT 
        DATE(p.published_at) as date,
        COALESCE(SUM(
          CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') 
          THEN pa.metric_value ELSE 0 END
        ), 0) as engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      ${platformFilter}
      GROUP BY DATE(p.published_at)
      ORDER BY date ASC
    `;

    const result = await db.query(query, params);
    return result.rows.map(row => ({
      date: row.date,
      engagement: parseInt(row.engagement) || 0
    }));
  }

  private async getPlatformEngagement(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT 
        unnest(p.platforms) as platform,
        COALESCE(SUM(
          CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') 
          THEN pa.metric_value ELSE 0 END
        ), 0) as engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      GROUP BY platform
      ORDER BY engagement DESC
    `;

    const result = await db.query(query, [userId, PostStatus.PUBLISHED, startDate, endDate]);
    return result.rows.map(row => ({
      platform: row.platform,
      engagement: parseInt(row.engagement) || 0
    }));
  }

  private async getTopPosts(userId: string, startDate: Date, endDate: Date, platforms?: Platform[]): Promise<any[]> {
    const platformFilter = platforms && platforms.length > 0 ? 'AND p.platforms && $4' : '';
    const params: any[] = [userId, PostStatus.PUBLISHED, startDate, endDate];
    if (platforms && platforms.length > 0) params.push(platforms);

    const query = `
      SELECT 
        p.id,
        p.content,
        p.platforms,
        p.published_at,
        COALESCE(SUM(
          CASE WHEN pa.metric_type IN ('likes', 'shares', 'comments') 
          THEN pa.metric_value ELSE 0 END
        ), 0) as engagement
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      ${platformFilter}
      GROUP BY p.id, p.content, p.platforms, p.published_at
      ORDER BY engagement DESC
      LIMIT 10
    `;

    const result = await db.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      content: row.content.substring(0, 100) + (row.content.length > 100 ? '...' : ''),
      platforms: row.platforms,
      publishedAt: row.published_at,
      engagement: parseInt(row.engagement) || 0
    }));
  }

  private async getContentTypePerformance(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT 
        CASE 
          WHEN array_length(p.images, 1) > 1 THEN 'carousel'
          WHEN array_length(p.images, 1) = 1 THEN 'image'
          WHEN p.content ~ 'http.*\\.(mp4|mov|avi)' THEN 'video'
          ELSE 'text'
        END as content_type,
        COUNT(*) as post_count,
        COALESCE(AVG(
          CASE WHEN pa.metric_type = 'engagement_rate' 
          THEN pa.metric_value ELSE 0 END
        ), 0) as avg_engagement_rate
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      GROUP BY content_type
      ORDER BY avg_engagement_rate DESC
    `;

    const result = await db.query(query, [userId, PostStatus.PUBLISHED, startDate, endDate]);
    return result.rows.map(row => ({
      type: row.content_type,
      postCount: parseInt(row.post_count) || 0,
      avgEngagementRate: parseFloat(row.avg_engagement_rate) || 0
    }));
  }

  private async getTopHashtags(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT 
        hashtag,
        COUNT(*) as usage_count,
        COALESCE(AVG(
          CASE WHEN pa.metric_type = 'engagement_rate' 
          THEN pa.metric_value ELSE 0 END
        ), 0) as avg_engagement_rate
      FROM posts p
      CROSS JOIN LATERAL unnest(p.hashtags) as hashtag
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      GROUP BY hashtag
      HAVING COUNT(*) >= 2
      ORDER BY avg_engagement_rate DESC
      LIMIT 10
    `;

    const result = await db.query(query, [userId, PostStatus.PUBLISHED, startDate, endDate]);
    return result.rows.map(row => ({
      hashtag: row.hashtag.replace('#', ''),
      usageCount: parseInt(row.usage_count) || 0,
      avgEngagementRate: parseFloat(row.avg_engagement_rate) || 0
    }));
  }

  private async executeKPIFormula(kpi: KPIDefinition, userId: string, startDate: Date, endDate: Date): Promise<number> {
    // This is a simplified implementation. In a real system, you'd want a more robust formula parser
    const formula = kpi.formula.toLowerCase();
    
    if (formula.includes('engagement_rate')) {
      return this.calculateEngagementRate(userId, startDate, endDate, kpi.platforms);
    } else if (formula.includes('total_engagement')) {
      return this.getTotalEngagement(userId, startDate, endDate, kpi.platforms);
    } else if (formula.includes('post_frequency')) {
      return this.calculatePostFrequency(userId, startDate, endDate, kpi.platforms);
    }
    
    return 0;
  }

  private async calculatePreviousPeriodValue(kpi: KPIDefinition, userId: string, startDate: Date, endDate: Date): Promise<number> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;
    
    return this.executeKPIFormula(kpi, userId, previousStartDate, previousEndDate);
  }

  private async calculateEngagementRate(userId: string, startDate: Date, endDate: Date, platforms: Platform[]): Promise<number> {
    const query = `
      SELECT COALESCE(AVG(
        CASE WHEN pa.metric_type = 'engagement_rate' 
        THEN pa.metric_value ELSE 0 END
      ), 0) as avg_engagement_rate
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      ${platforms.length > 0 ? 'AND p.platforms && $5' : ''}
    `;

    const params: any[] = [userId, PostStatus.PUBLISHED, startDate, endDate];
    if (platforms.length > 0) params.push(platforms);

    const result = await db.query(query, params);
    return parseFloat(result.rows[0]?.avg_engagement_rate) || 0;
  }

  private async calculatePostFrequency(userId: string, startDate: Date, endDate: Date, platforms: Platform[]): Promise<number> {
    const query = `
      SELECT COUNT(*) as post_count
      FROM posts p
      WHERE p.user_id = $1 AND p.status = $2 AND p.published_at BETWEEN $3 AND $4
      ${platforms.length > 0 ? 'AND p.platforms && $5' : ''}
    `;

    const params: any[] = [userId, PostStatus.PUBLISHED, startDate, endDate];
    if (platforms.length > 0) params.push(platforms);

    const result = await db.query(query, params);
    const postCount = parseInt(result.rows[0]?.post_count) || 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return days > 0 ? postCount / days : 0;
  }
}

export const customDashboardService = CustomDashboardService.getInstance();
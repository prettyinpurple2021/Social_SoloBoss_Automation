/**
 * Automated Reporting Service
 * 
 * Provides scheduled email reports and executive summaries with customizable
 * reporting templates and automated delivery schedules.
 */

import { db } from '../database/connection';
import { Platform, PostStatus } from '../types/database';
import { loggerService } from './LoggerService';
import { AdvancedAnalyticsService } from './AdvancedAnalyticsService';
import cron from 'node-cron';

export interface ReportTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: 'executive_summary' | 'detailed_analytics' | 'performance_report' | 'custom';
  sections: ReportSection[];
  schedule: ReportSchedule;
  recipients: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  type: 'overview' | 'platform_performance' | 'content_analysis' | 'recommendations' | 'kpi_tracking' | 'custom_chart';
  title: string;
  config: {
    timeRange?: string;
    platforms?: Platform[];
    metrics?: string[];
    chartType?: 'table' | 'chart' | 'text';
    includeComparison?: boolean;
  };
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly reports
  dayOfMonth?: number; // 1-31 for monthly reports
  time: string; // HH:MM format
  timezone: string;
  nextRun?: Date;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  userId: string;
  title: string;
  content: ReportContent;
  format: 'html' | 'pdf' | 'json';
  generatedAt: Date;
  sentAt?: Date;
  recipients: string[];
  status: 'generated' | 'sent' | 'failed';
  errorMessage?: string;
}

export interface ReportContent {
  summary: {
    period: { startDate: Date; endDate: Date };
    totalPosts: number;
    totalEngagement: number;
    avgEngagementRate: number;
    topPlatform: Platform;
    keyInsights: string[];
  };
  sections: Array<{
    id: string;
    title: string;
    type: string;
    data: any;
    insights?: string[];
  }>;
  recommendations: Array<{
    category: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    impact: string;
  }>;
}

export class AutomatedReportingService {
  private static instance: AutomatedReportingService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private analyticsService: AdvancedAnalyticsService;

  private constructor() {
    this.analyticsService = AdvancedAnalyticsService.getInstance();
    this.initializeScheduledReports();
  }

  public static getInstance(): AutomatedReportingService {
    if (!AutomatedReportingService.instance) {
      AutomatedReportingService.instance = new AutomatedReportingService();
    }
    return AutomatedReportingService.instance;
  }

  /**
   * Create a new report template
   */
  async createReportTemplate(userId: string, template: Omit<ReportTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    try {
      const query = `
        INSERT INTO report_templates (user_id, name, description, type, sections, schedule, recipients, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        template.name,
        template.description,
        template.type,
        JSON.stringify(template.sections),
        JSON.stringify(template.schedule),
        template.recipients,
        template.isActive
      ]);

      const createdTemplate = this.mapTemplateRow(result.rows[0]);
      
      if (createdTemplate.isActive) {
        await this.scheduleReport(createdTemplate);
      }

      loggerService.info('Report template created', {
        templateId: createdTemplate.id,
        userId,
        type: template.type
      });

      return createdTemplate;
    } catch (error) {
      loggerService.error('Failed to create report template', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user's report templates
   */
  async getUserReportTemplates(userId: string): Promise<ReportTemplate[]> {
    try {
      const query = `
        SELECT * FROM report_templates 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.mapTemplateRow(row));
    } catch (error) {
      loggerService.error('Failed to get user report templates', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update report template
   */
  async updateReportTemplate(templateId: string, userId: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClause.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClause.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.sections !== undefined) {
        setClause.push(`sections = $${paramCount++}`);
        values.push(JSON.stringify(updates.sections));
      }
      if (updates.schedule !== undefined) {
        setClause.push(`schedule = $${paramCount++}`);
        values.push(JSON.stringify(updates.schedule));
      }
      if (updates.recipients !== undefined) {
        setClause.push(`recipients = $${paramCount++}`);
        values.push(updates.recipients);
      }
      if (updates.isActive !== undefined) {
        setClause.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      if (setClause.length === 0) {
        return this.getReportTemplate(templateId, userId);
      }

      setClause.push(`updated_at = NOW()`);
      values.push(templateId, userId);

      const query = `
        UPDATE report_templates 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount++} AND user_id = $${paramCount++}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const updatedTemplate = this.mapTemplateRow(result.rows[0]);
      
      // Update scheduled job
      if (updates.isActive !== undefined || updates.schedule !== undefined) {
        await this.updateScheduledReport(updatedTemplate);
      }

      return updatedTemplate;
    } catch (error) {
      loggerService.error('Failed to update report template', error as Error, { templateId, userId });
      throw error;
    }
  }

  /**
   * Generate report manually
   */
  async generateReport(templateId: string, userId: string, format: 'html' | 'pdf' | 'json' = 'html'): Promise<GeneratedReport> {
    try {
      const template = await this.getReportTemplate(templateId, userId);
      if (!template) {
        throw new Error('Report template not found');
      }

      const content = await this.generateReportContent(template, userId);
      
      const query = `
        INSERT INTO generated_reports (template_id, user_id, title, content, format, recipients, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await db.query(query, [
        templateId,
        userId,
        `${template.name} - ${new Date().toLocaleDateString()}`,
        JSON.stringify(content),
        format,
        template.recipients,
        'generated'
      ]);

      const generatedReport = this.mapReportRow(result.rows[0]);

      loggerService.info('Report generated', {
        reportId: generatedReport.id,
        templateId,
        userId
      });

      return generatedReport;
    } catch (error) {
      loggerService.error('Failed to generate report', error as Error, { templateId, userId });
      throw error;
    }
  }

  /**
   * Send report via email
   */
  async sendReport(reportId: string, userId: string): Promise<boolean> {
    try {
      const report = await this.getGeneratedReport(reportId, userId);
      if (!report) {
        throw new Error('Report not found');
      }

      // In a real implementation, this would integrate with an email service
      // For now, we'll just mark it as sent
      const success = await this.mockSendEmail(report);

      if (success) {
        await db.query(
          'UPDATE generated_reports SET status = $1, sent_at = NOW() WHERE id = $2',
          ['sent', reportId]
        );

        loggerService.info('Report sent', {
          reportId,
          userId,
          recipients: report.recipients
        });
      } else {
        await db.query(
          'UPDATE generated_reports SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', 'Email delivery failed', reportId]
        );
      }

      return success;
    } catch (error) {
      loggerService.error('Failed to send report', error as Error, { reportId, userId });
      
      await db.query(
        'UPDATE generated_reports SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', (error as Error).message, reportId]
      );

      return false;
    }
  }

  /**
   * Get generated reports for user
   */
  async getUserReports(userId: string, limit: number = 50): Promise<GeneratedReport[]> {
    try {
      const query = `
        SELECT * FROM generated_reports 
        WHERE user_id = $1 
        ORDER BY generated_at DESC 
        LIMIT $2
      `;

      const result = await db.query(query, [userId, limit]);
      return result.rows.map(row => this.mapReportRow(row));
    } catch (error) {
      loggerService.error('Failed to get user reports', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get report templates
   */
  getReportTemplates(): Omit<ReportTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] {
    return [
      {
        name: 'Weekly Executive Summary',
        description: 'High-level overview of social media performance for executives',
        type: 'executive_summary',
        sections: [
          {
            id: 'overview',
            type: 'overview',
            title: 'Performance Overview',
            config: { timeRange: '7d', includeComparison: true }
          },
          {
            id: 'platform-performance',
            type: 'platform_performance',
            title: 'Platform Performance',
            config: { timeRange: '7d', chartType: 'chart' }
          },
          {
            id: 'recommendations',
            type: 'recommendations',
            title: 'Key Recommendations',
            config: {}
          }
        ],
        schedule: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
          time: '09:00',
          timezone: 'UTC'
        },
        recipients: [],
        isActive: false
      },
      {
        name: 'Monthly Performance Report',
        description: 'Comprehensive monthly analytics report',
        type: 'detailed_analytics',
        sections: [
          {
            id: 'overview',
            type: 'overview',
            title: 'Monthly Overview',
            config: { timeRange: '30d', includeComparison: true }
          },
          {
            id: 'platform-performance',
            type: 'platform_performance',
            title: 'Platform Analysis',
            config: { timeRange: '30d', chartType: 'table' }
          },
          {
            id: 'content-analysis',
            type: 'content_analysis',
            title: 'Content Performance',
            config: { timeRange: '30d' }
          },
          {
            id: 'kpi-tracking',
            type: 'kpi_tracking',
            title: 'KPI Performance',
            config: { timeRange: '30d' }
          },
          {
            id: 'recommendations',
            type: 'recommendations',
            title: 'Strategic Recommendations',
            config: {}
          }
        ],
        schedule: {
          frequency: 'monthly',
          dayOfMonth: 1,
          time: '08:00',
          timezone: 'UTC'
        },
        recipients: [],
        isActive: false
      }
    ];
  }

  /**
   * Private helper methods
   */
  private async initializeScheduledReports(): Promise<void> {
    try {
      const query = `SELECT * FROM report_templates WHERE is_active = true`;
      const result = await db.query(query);
      
      for (const row of result.rows) {
        const template = this.mapTemplateRow(row);
        await this.scheduleReport(template);
      }

      loggerService.info('Scheduled reports initialized', {
        count: result.rows.length
      });
    } catch (error) {
      loggerService.error('Failed to initialize scheduled reports', error as Error);
    }
  }

  private async scheduleReport(template: ReportTemplate): Promise<void> {
    const cronExpression = this.getCronExpression(template.schedule);
    
    if (this.scheduledJobs.has(template.id)) {
      this.scheduledJobs.get(template.id)?.destroy();
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        const report = await this.generateReport(template.id, template.userId);
        await this.sendReport(report.id, template.userId);
      } catch (error) {
        loggerService.error('Failed to execute scheduled report', error as Error, {
          templateId: template.id
        });
      }
    }, {
      scheduled: true,
      timezone: template.schedule.timezone
    });

    this.scheduledJobs.set(template.id, job);

    loggerService.info('Report scheduled', {
      templateId: template.id,
      cronExpression,
      timezone: template.schedule.timezone
    });
  }

  private async updateScheduledReport(template: ReportTemplate): Promise<void> {
    if (this.scheduledJobs.has(template.id)) {
      this.scheduledJobs.get(template.id)?.destroy();
      this.scheduledJobs.delete(template.id);
    }

    if (template.isActive) {
      await this.scheduleReport(template);
    }
  }

  private getCronExpression(schedule: ReportSchedule): string {
    const [hour, minute] = schedule.time.split(':').map(Number);

    switch (schedule.frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      
      case 'weekly':
        return `${minute} ${hour} * * ${schedule.dayOfWeek}`;
      
      case 'monthly':
        return `${minute} ${hour} ${schedule.dayOfMonth} * *`;
      
      case 'quarterly':
        // First day of quarter (Jan, Apr, Jul, Oct)
        return `${minute} ${hour} 1 1,4,7,10 *`;
      
      default:
        return `${minute} ${hour} * * 1`; // Default to weekly on Monday
    }
  }

  private async generateReportContent(template: ReportTemplate, userId: string): Promise<ReportContent> {
    const timeRange = this.getTimeRangeForTemplate(template);
    const { startDate, endDate } = timeRange;

    // Get analytics data
    const analyticsQuery = {
      userId,
      startDate,
      endDate,
      timeRange: this.getTimeRangeString(template)
    };

    const analytics = await this.analyticsService.getComprehensiveAnalytics(analyticsQuery);

    // Generate summary
    const summary = {
      period: { startDate, endDate },
      totalPosts: analytics.overview.totalPosts,
      totalEngagement: analytics.overview.totalEngagement,
      avgEngagementRate: analytics.overview.avgEngagementRate,
      topPlatform: analytics.platformPerformance[0]?.platform || Platform.FACEBOOK,
      keyInsights: this.generateKeyInsights(analytics)
    };

    // Generate sections
    const sections = [];
    for (const sectionConfig of template.sections) {
      const sectionData = await this.generateSectionData(sectionConfig, analytics, userId);
      sections.push({
        id: sectionConfig.id,
        title: sectionConfig.title,
        type: sectionConfig.type,
        data: sectionData,
        insights: this.generateSectionInsights(sectionConfig.type, sectionData)
      });
    }

    return {
      summary,
      sections,
      recommendations: analytics.recommendations.contentStrategy.map(rec => ({
        category: rec.type,
        recommendation: rec.recommendation,
        priority: rec.impact as 'high' | 'medium' | 'low',
        impact: `${rec.confidence * 100}% confidence`
      }))
    };
  }

  private getTimeRangeForTemplate(template: ReportTemplate): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (template.schedule.frequency) {
      case 'daily':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private getTimeRangeString(template: ReportTemplate): '7d' | '30d' | '90d' {
    switch (template.schedule.frequency) {
      case 'daily':
      case 'weekly':
        return '7d';
      case 'monthly':
        return '30d';
      case 'quarterly':
        return '90d';
      default:
        return '7d';
    }
  }

  private generateKeyInsights(analytics: any): string[] {
    const insights = [];

    if (analytics.overview.totalEngagement > 0) {
      insights.push(`Generated ${analytics.overview.totalEngagement.toLocaleString()} total engagements`);
    }

    if (analytics.platformPerformance.length > 0) {
      const topPlatform = analytics.platformPerformance[0];
      insights.push(`${topPlatform.platform} was the top performing platform with ${topPlatform.avgEngagementRate.toFixed(1)}% engagement rate`);
    }

    if (analytics.trendAnalysis.engagementTrend.length > 0) {
      const trend = analytics.trendAnalysis.engagementTrend;
      const recentEngagement = trend[trend.length - 1]?.engagement || 0;
      const previousEngagement = trend[trend.length - 2]?.engagement || 0;
      
      if (recentEngagement > previousEngagement) {
        insights.push('Engagement is trending upward');
      } else if (recentEngagement < previousEngagement) {
        insights.push('Engagement is trending downward');
      }
    }

    return insights.slice(0, 3); // Limit to top 3 insights
  }

  private async generateSectionData(section: ReportSection, analytics: any, userId: string): Promise<any> {
    switch (section.type) {
      case 'overview':
        return analytics.overview;
      
      case 'platform_performance':
        return analytics.platformPerformance;
      
      case 'content_analysis':
        return analytics.contentAnalysis;
      
      case 'recommendations':
        return analytics.recommendations;
      
      case 'kpi_tracking':
        // This would integrate with the CustomDashboardService for KPI data
        return { message: 'KPI tracking data would be integrated here' };
      
      default:
        return null;
    }
  }

  private generateSectionInsights(sectionType: string, data: any): string[] {
    const insights = [];

    switch (sectionType) {
      case 'platform_performance':
        if (Array.isArray(data) && data.length > 0) {
          const topPlatform = data[0];
          insights.push(`${topPlatform.platform} leads with ${topPlatform.avgEngagementRate.toFixed(1)}% engagement rate`);
        }
        break;
      
      case 'content_analysis':
        if (data.topHashtags && data.topHashtags.length > 0) {
          const topHashtag = data.topHashtags[0];
          insights.push(`#${topHashtag.hashtag} is your top performing hashtag`);
        }
        break;
    }

    return insights;
  }

  private async mockSendEmail(report: GeneratedReport): Promise<boolean> {
    // Mock email sending - in a real implementation, this would use a service like SendGrid, AWS SES, etc.
    loggerService.info('Mock email sent', {
      reportId: report.id,
      recipients: report.recipients,
      title: report.title
    });
    
    return true; // Simulate successful email delivery
  }

  private async getReportTemplate(templateId: string, userId: string): Promise<ReportTemplate | null> {
    const query = `SELECT * FROM report_templates WHERE id = $1 AND user_id = $2`;
    const result = await db.query(query, [templateId, userId]);
    
    return result.rows.length > 0 ? this.mapTemplateRow(result.rows[0]) : null;
  }

  private async getGeneratedReport(reportId: string, userId: string): Promise<GeneratedReport | null> {
    const query = `SELECT * FROM generated_reports WHERE id = $1 AND user_id = $2`;
    const result = await db.query(query, [reportId, userId]);
    
    return result.rows.length > 0 ? this.mapReportRow(result.rows[0]) : null;
  }

  private mapTemplateRow(row: any): ReportTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      sections: JSON.parse(row.sections || '[]'),
      schedule: JSON.parse(row.schedule || '{}'),
      recipients: row.recipients || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapReportRow(row: any): GeneratedReport {
    return {
      id: row.id,
      templateId: row.template_id,
      userId: row.user_id,
      title: row.title,
      content: JSON.parse(row.content || '{}'),
      format: row.format,
      generatedAt: row.generated_at,
      sentAt: row.sent_at,
      recipients: row.recipients || [],
      status: row.status,
      errorMessage: row.error_message
    };
  }
}

export const automatedReportingService = AutomatedReportingService.getInstance();
import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { advancedAnalyticsService, AnalyticsQuery } from '../services/AdvancedAnalyticsService';
import { customDashboardService } from '../services/CustomDashboardService';
import { automatedReportingService } from '../services/AutomatedReportingService';
import { competitiveAnalysisService } from '../services/CompetitiveAnalysisService';
import { roiTrackingService } from '../services/ROITrackingService';
import { predictiveAnalyticsService } from '../services/PredictiveAnalyticsService';
import { Platform } from '../types/database';

const router = express.Router();

/**
 * Get comprehensive analytics data
 */
router.get('/',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d'),
    query('platforms').optional().isArray().withMessage('Platforms must be an array'),
    query('categories').optional().isArray().withMessage('Categories must be an array'),
    query('tags').optional().isArray().withMessage('Tags must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined,
        platforms: req.query.platforms as Platform[] | undefined,
        categories: req.query.categories as string[] | undefined,
        tags: req.query.tags as string[] | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics data'
      });
    }
  }
);

/**
 * Get analytics overview only
 */
router.get('/overview',
  authenticateToken,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('timeRange').optional().isIn(['7d', '30d', '90d']),
    query('platforms').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined,
        platforms: req.query.platforms as Platform[] | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);

      res.json({
        success: true,
        data: analytics.overview
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics overview'
      });
    }
  }
);

/**
 * Get platform performance analytics
 */
router.get('/platforms',
  authenticateToken,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('timeRange').optional().isIn(['7d', '30d', '90d'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);

      res.json({
        success: true,
        data: analytics.platformPerformance
      });
    } catch (error) {
      console.error('Error fetching platform analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform analytics'
      });
    }
  }
);

/**
 * Get engagement trend data
 */
router.get('/engagement-trend',
  authenticateToken,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('timeRange').optional().isIn(['7d', '30d', '90d']),
    query('platforms').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined,
        platforms: req.query.platforms as Platform[] | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);

      res.json({
        success: true,
        data: analytics.trendAnalysis.engagementTrend
      });
    } catch (error) {
      console.error('Error fetching engagement trend:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch engagement trend'
      });
    }
  }
);

/**
 * Get top performing posts
 */
router.get('/top-posts',
  authenticateToken,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('timeRange').optional().isIn(['7d', '30d', '90d']),
    query('platforms').optional().isArray(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined,
        platforms: req.query.platforms as Platform[] | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      res.json({
        success: true,
        data: analytics.topPerformingPosts.slice(0, limit)
      });
    } catch (error) {
      console.error('Error fetching top posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top posts'
      });
    }
  }
);

/**
 * Get performance recommendations
 */
router.get('/recommendations',
  authenticateToken,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('timeRange').optional().isIn(['7d', '30d', '90d'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const analyticsQuery: AnalyticsQuery = {
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        timeRange: req.query.timeRange as '7d' | '30d' | '90d' | undefined
      };

      const analytics = await advancedAnalyticsService.getComprehensiveAnalytics(analyticsQuery);

      res.json({
        success: true,
        data: analytics.recommendations
      });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recommendations'
      });
    }
  }
);

/**
 * Get recent activity
 */
router.get('/activity',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      // For now, return mock activity data
      // In a real implementation, this would fetch from an activity log table
      const mockActivity = [
        {
          id: '1',
          type: 'post_published',
          message: 'Post published successfully to Facebook and Instagram',
          timestamp: new Date(),
          platform: Platform.FACEBOOK,
          postId: 'post-1'
        },
        {
          id: '2',
          type: 'high_engagement',
          message: 'Post received 100+ likes on Instagram',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          platform: Platform.INSTAGRAM,
          postId: 'post-2'
        },
        {
          id: '3',
          type: 'milestone_reached',
          message: 'Reached 1000 total engagements this month',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ];

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      res.json({
        success: true,
        data: mockActivity.slice(0, limit)
      });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch activity'
      });
    }
  }
);

/**
 * Get analytics for a specific post
 */
router.get('/posts/:postId',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const postId = req.params.postId;

      // For now, return mock data
      // In a real implementation, this would fetch detailed post analytics
      const mockPostAnalytics = {
        engagement: 150,
        reach: 1200,
        impressions: 2500,
        clicks: 45,
        shares: 12,
        comments: 8,
        likes: 130,
        platformBreakdown: {
          [Platform.FACEBOOK]: {
            engagement: 80,
            reach: 600,
            impressions: 1200
          },
          [Platform.INSTAGRAM]: {
            engagement: 70,
            reach: 600,
            impressions: 1300
          }
        }
      };

      res.json({
        success: true,
        data: mockPostAnalytics
      });
    } catch (error) {
      console.error('Error fetching post analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch post analytics'
      });
    }
  }
);

export default router;
/**

 * Custom Dashboard Routes
 */

/**
 * Get user's custom dashboards
 */
router.get('/dashboards',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const dashboards = await customDashboardService.getUserDashboards(userId);

      res.json({
        success: true,
        data: dashboards
      });
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboards'
      });
    }
  }
);

/**
 * Create custom dashboard
 */
router.post('/dashboards',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Dashboard name is required'),
    body('widgets').isArray().withMessage('Widgets must be an array'),
    body('isDefault').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const dashboard = await customDashboardService.createDashboard(userId, req.body);

      res.status(201).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Error creating dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dashboard'
      });
    }
  }
);

/**
 * Get specific dashboard with populated data
 */
router.get('/dashboards/:dashboardId',
  authenticateToken,
  [
    param('dashboardId').isUUID().withMessage('Invalid dashboard ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { dashboardId } = req.params;
      
      const dashboard = await customDashboardService.getDashboard(dashboardId, userId);

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard'
      });
    }
  }
);

/**
 * Update dashboard
 */
router.put('/dashboards/:dashboardId',
  authenticateToken,
  [
    param('dashboardId').isUUID().withMessage('Invalid dashboard ID'),
    body('name').optional().notEmpty(),
    body('widgets').optional().isArray(),
    body('isDefault').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { dashboardId } = req.params;
      
      const dashboard = await customDashboardService.updateDashboard(dashboardId, userId, req.body);

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Error updating dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update dashboard'
      });
    }
  }
);

/**
 * Delete dashboard
 */
router.delete('/dashboards/:dashboardId',
  authenticateToken,
  [
    param('dashboardId').isUUID().withMessage('Invalid dashboard ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { dashboardId } = req.params;
      
      const deleted = await customDashboardService.deleteDashboard(dashboardId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        message: 'Dashboard deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard'
      });
    }
  }
);

/**
 * Get dashboard templates
 */
router.get('/dashboards/templates',
  authenticateToken,
  async (req, res) => {
    try {
      const templates = await customDashboardService.getDashboardTemplates();

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching dashboard templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard templates'
      });
    }
  }
);

/**
 * KPI Management Routes
 */

/**
 * Get user's KPIs
 */
router.get('/kpis',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const kpis = await customDashboardService.getUserKPIs(userId);

      res.json({
        success: true,
        data: kpis
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KPIs'
      });
    }
  }
);

/**
 * Create KPI
 */
router.post('/kpis',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('KPI name is required'),
    body('description').notEmpty().withMessage('KPI description is required'),
    body('formula').notEmpty().withMessage('KPI formula is required'),
    body('target').isNumeric().withMessage('Target must be a number'),
    body('unit').notEmpty().withMessage('Unit is required'),
    body('category').isIn(['engagement', 'reach', 'conversion', 'growth', 'efficiency']).withMessage('Invalid category'),
    body('platforms').isArray().withMessage('Platforms must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const kpi = await customDashboardService.createKPI(userId, req.body);

      res.status(201).json({
        success: true,
        data: kpi
      });
    } catch (error) {
      console.error('Error creating KPI:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create KPI'
      });
    }
  }
);

/**
 * Calculate KPI values
 */
router.post('/kpis/calculate',
  authenticateToken,
  [
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO date'),
    body('endDate').isISO8601().withMessage('End date must be a valid ISO date'),
    body('kpiIds').optional().isArray().withMessage('KPI IDs must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { startDate, endDate, kpiIds } = req.body;
      
      const results = await customDashboardService.calculateKPIs(
        userId,
        new Date(startDate),
        new Date(endDate),
        kpiIds
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error calculating KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate KPIs'
      });
    }
  }
);

/**
 * Automated Reporting Routes
 */

/**
 * Get user's report templates
 */
router.get('/reports/templates',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const templates = await automatedReportingService.getUserReportTemplates(userId);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching report templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report templates'
      });
    }
  }
);

/**
 * Create report template
 */
router.post('/reports/templates',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('type').isIn(['executive_summary', 'detailed_analytics', 'performance_report', 'custom']).withMessage('Invalid template type'),
    body('sections').isArray().withMessage('Sections must be an array'),
    body('schedule').isObject().withMessage('Schedule must be an object'),
    body('recipients').isArray().withMessage('Recipients must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const template = await automatedReportingService.createReportTemplate(userId, req.body);

      res.status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error creating report template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create report template'
      });
    }
  }
);

/**
 * Generate report manually
 */
router.post('/reports/generate/:templateId',
  authenticateToken,
  [
    param('templateId').isUUID().withMessage('Invalid template ID'),
    body('format').optional().isIn(['html', 'pdf', 'json']).withMessage('Invalid format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { templateId } = req.params;
      const format = req.body.format || 'html';
      
      const report = await automatedReportingService.generateReport(templateId, userId, format);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }
);

/**
 * Get generated reports
 */
router.get('/reports',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const reports = await automatedReportingService.getUserReports(userId, limit);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports'
      });
    }
  }
);

/**
 * Send report via email
 */
router.post('/reports/:reportId/send',
  authenticateToken,
  [
    param('reportId').isUUID().withMessage('Invalid report ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { reportId } = req.params;
      
      const sent = await automatedReportingService.sendReport(reportId, userId);

      res.json({
        success: sent,
        message: sent ? 'Report sent successfully' : 'Failed to send report'
      });
    } catch (error) {
      console.error('Error sending report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send report'
      });
    }
  }
);

/**
 * Get report templates
 */
router.get('/reports/templates/library',
  authenticateToken,
  async (req, res) => {
    try {
      const templates = automatedReportingService.getReportTemplates();

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching report template library:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report template library'
      });
    }
  }
);

/**
 * Competitive Analysis Routes
 */

/**
 * Get user's competitors
 */
router.get('/competitive/competitors',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const competitors = await competitiveAnalysisService.getUserCompetitors(userId);

      res.json({
        success: true,
        data: competitors
      });
    } catch (error) {
      console.error('Error fetching competitors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch competitors'
      });
    }
  }
);

/**
 * Add competitor
 */
router.post('/competitive/competitors',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Competitor name is required'),
    body('industry').notEmpty().withMessage('Industry is required'),
    body('platforms').isArray().withMessage('Platforms must be an array'),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const competitor = await competitiveAnalysisService.addCompetitor(userId, req.body);

      res.status(201).json({
        success: true,
        data: competitor
      });
    } catch (error) {
      console.error('Error adding competitor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add competitor'
      });
    }
  }
);

/**
 * Get competitive analysis
 */
router.get('/competitive/analysis',
  authenticateToken,
  [
    query('platform').optional().isIn(Object.values(Platform)).withMessage('Invalid platform'),
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid time range')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const platform = req.query.platform as Platform | undefined;
      const timeRange = (req.query.timeRange as '7d' | '30d' | '90d') || '30d';
      
      const analysis = await competitiveAnalysisService.getCompetitiveAnalysis(userId, platform, timeRange);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error fetching competitive analysis:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch competitive analysis'
      });
    }
  }
);

/**
 * Get industry benchmarks
 */
router.get('/competitive/benchmarks/:industry',
  authenticateToken,
  [
    param('industry').notEmpty().withMessage('Industry is required'),
    query('platform').optional().isIn(Object.values(Platform)).withMessage('Invalid platform')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { industry } = req.params;
      const platform = req.query.platform as Platform | undefined;
      
      const benchmarks = await competitiveAnalysisService.getIndustryBenchmarks(industry, platform);

      res.json({
        success: true,
        data: benchmarks
      });
    } catch (error) {
      console.error('Error fetching industry benchmarks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch industry benchmarks'
      });
    }
  }
);

/**
 * Generate competitive intelligence report
 */
router.post('/competitive/report',
  authenticateToken,
  [
    body('competitorIds').optional().isArray().withMessage('Competitor IDs must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { competitorIds } = req.body;
      
      const report = await competitiveAnalysisService.generateCompetitiveReport(userId, competitorIds);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating competitive report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate competitive report'
      });
    }
  }
);

/**
 * ROI Tracking Routes
 */

/**
 * Get user's conversion goals
 */
router.get('/roi/goals',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const goals = await roiTrackingService.getUserConversionGoals(userId);

      res.json({
        success: true,
        data: goals
      });
    } catch (error) {
      console.error('Error fetching conversion goals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversion goals'
      });
    }
  }
);

/**
 * Create conversion goal
 */
router.post('/roi/goals',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Goal name is required'),
    body('type').isIn(['website_visit', 'signup', 'purchase', 'download', 'contact', 'custom']).withMessage('Invalid goal type'),
    body('value').isNumeric().withMessage('Value must be a number'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('trackingMethod').isIn(['utm_parameters', 'pixel_tracking', 'api_integration', 'manual']).withMessage('Invalid tracking method'),
    body('config').isObject().withMessage('Config must be an object')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const goal = await roiTrackingService.createConversionGoal(userId, req.body);

      res.status(201).json({
        success: true,
        data: goal
      });
    } catch (error) {
      console.error('Error creating conversion goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversion goal'
      });
    }
  }
);

/**
 * Track conversion event
 */
router.post('/roi/conversions',
  authenticateToken,
  [
    body('goalId').isUUID().withMessage('Invalid goal ID'),
    body('value').isNumeric().withMessage('Value must be a number'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('attributionData').isObject().withMessage('Attribution data must be an object'),
    body('eventData').optional().isObject().withMessage('Event data must be an object')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const conversionData = { ...req.body, userId };
      
      const conversion = await roiTrackingService.trackConversion(conversionData);

      res.status(201).json({
        success: true,
        data: conversion
      });
    } catch (error) {
      console.error('Error tracking conversion:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track conversion'
      });
    }
  }
);

/**
 * Calculate ROI metrics
 */
router.get('/roi/metrics',
  authenticateToken,
  [
    query('campaignId').optional().isUUID().withMessage('Invalid campaign ID'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const campaignId = req.query.campaignId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const metrics = await roiTrackingService.calculateROI(userId, campaignId, startDate, endDate);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error calculating ROI metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate ROI metrics'
      });
    }
  }
);

/**
 * Generate attribution report
 */
router.get('/roi/attribution',
  authenticateToken,
  [
    query('model').optional().isIn(['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based']).withMessage('Invalid attribution model'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const model = (req.query.model as any) || 'linear';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const report = await roiTrackingService.generateAttributionReport(userId, model, startDate, endDate);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating attribution report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate attribution report'
      });
    }
  }
);

/**
 * Get conversion funnel
 */
router.get('/roi/funnel/:goalId',
  authenticateToken,
  [
    param('goalId').isUUID().withMessage('Invalid goal ID'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { goalId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const funnel = await roiTrackingService.getConversionFunnel(userId, goalId, startDate, endDate);

      res.json({
        success: true,
        data: funnel
      });
    } catch (error) {
      console.error('Error fetching conversion funnel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversion funnel'
      });
    }
  }
);

/**
 * Get user's campaigns
 */
router.get('/roi/campaigns',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const campaigns = await roiTrackingService.getUserCampaigns(userId);

      res.json({
        success: true,
        data: campaigns
      });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch campaigns'
      });
    }
  }
);

/**
 * Create campaign
 */
router.post('/roi/campaigns',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Campaign name is required'),
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO date'),
    body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    body('budget').optional().isNumeric().withMessage('Budget must be a number'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('goals').isArray().withMessage('Goals must be an array'),
    body('posts').isArray().withMessage('Posts must be an array'),
    body('platforms').isArray().withMessage('Platforms must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const campaignData = { ...req.body, startDate: new Date(req.body.startDate) };
      if (req.body.endDate) {
        campaignData.endDate = new Date(req.body.endDate);
      }
      
      const campaign = await roiTrackingService.createCampaign(userId, campaignData);

      res.status(201).json({
        success: true,
        data: campaign
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create campaign'
      });
    }
  }
);

/**
 * Predictive Analytics Routes
 */

/**
 * Predict optimal posting times
 */
router.get('/predictive/timing',
  authenticateToken,
  [
    query('platform').isIn(Object.values(Platform)).withMessage('Platform is required'),
    query('contentType').optional().notEmpty().withMessage('Content type cannot be empty')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const platform = req.query.platform as Platform;
      const contentType = req.query.contentType as string | undefined;
      
      const predictions = await predictiveAnalyticsService.predictOptimalTiming(userId, platform, contentType);

      res.json({
        success: true,
        data: predictions
      });
    } catch (error) {
      console.error('Error predicting optimal timing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict optimal timing'
      });
    }
  }
);

/**
 * Generate content recommendations
 */
router.get('/predictive/recommendations',
  authenticateToken,
  [
    query('platform').optional().isIn(Object.values(Platform)).withMessage('Invalid platform')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const platform = req.query.platform as Platform | undefined;
      
      const recommendations = await predictiveAnalyticsService.generateContentRecommendations(userId, platform);

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Error generating content recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate content recommendations'
      });
    }
  }
);

/**
 * Predict engagement for content
 */
router.post('/predictive/engagement',
  authenticateToken,
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('platforms').isArray().withMessage('Platforms must be an array'),
    body('scheduledTime').optional().isISO8601().withMessage('Scheduled time must be a valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { content, platforms, scheduledTime } = req.body;
      
      const prediction = await predictiveAnalyticsService.predictEngagement(
        userId,
        content,
        platforms,
        scheduledTime ? new Date(scheduledTime) : undefined
      );

      res.json({
        success: true,
        data: prediction
      });
    } catch (error) {
      console.error('Error predicting engagement:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict engagement'
      });
    }
  }
);

/**
 * Predict trends
 */
router.get('/predictive/trends',
  authenticateToken,
  [
    query('platform').optional().isIn(Object.values(Platform)).withMessage('Invalid platform')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const platform = req.query.platform as Platform | undefined;
      
      const trends = await predictiveAnalyticsService.predictTrends(userId, platform);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('Error predicting trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict trends'
      });
    }
  }
);

/**
 * Generate optimal schedule
 */
router.get('/predictive/schedule',
  authenticateToken,
  [
    query('platform').isIn(Object.values(Platform)).withMessage('Platform is required'),
    query('timeframe').optional().isIn(['week', 'month']).withMessage('Invalid timeframe')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const platform = req.query.platform as Platform;
      const timeframe = (req.query.timeframe as 'week' | 'month') || 'week';
      
      const schedule = await predictiveAnalyticsService.generateOptimalSchedule(userId, platform, timeframe);

      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      console.error('Error generating optimal schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate optimal schedule'
      });
    }
  }
);

/**
 * Get comprehensive predictive insights
 */
router.get('/predictive/insights',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const insights = await predictiveAnalyticsService.getPredictiveInsights(userId);

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error('Error fetching predictive insights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch predictive insights'
      });
    }
  }
);

/**
 * Train predictive model
 */
router.post('/predictive/models/train',
  authenticateToken,
  [
    body('modelType').isIn(['optimal_timing', 'content_performance', 'engagement_prediction', 'hashtag_recommendation']).withMessage('Invalid model type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.userId;
      const { modelType } = req.body;
      
      const model = await predictiveAnalyticsService.trainModel(userId, modelType);

      res.json({
        success: true,
        data: model
      });
    } catch (error) {
      console.error('Error training model:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to train model'
      });
    }
  }
);
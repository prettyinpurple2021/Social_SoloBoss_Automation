import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { advancedAnalyticsService, AnalyticsQuery } from '../services/AdvancedAnalyticsService';
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
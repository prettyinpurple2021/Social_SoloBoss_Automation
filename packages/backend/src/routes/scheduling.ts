import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { 
  advancedSchedulingService, 
  RecurringScheduleConfig, 
  BulkScheduleOperation 
} from '../services/AdvancedSchedulingService';
import { Platform } from '../types/database';

const router = express.Router();

/**
 * Create recurring schedule for a post
 */
router.post('/recurring',
  authenticateToken,
  [
    body('postData').isObject().withMessage('Post data is required'),
    body('postData.content').notEmpty().withMessage('Post content is required'),
    body('postData.platforms').isArray({ min: 1 }).withMessage('At least one platform is required'),
    body('scheduleConfig').isObject().withMessage('Schedule configuration is required'),
    body('scheduleConfig.frequency').isIn(['daily', 'weekly', 'monthly']).withMessage('Frequency must be daily, weekly, or monthly'),
    body('scheduleConfig.interval').isInt({ min: 1 }).withMessage('Interval must be a positive integer'),
    body('scheduleConfig.timezone').notEmpty().withMessage('Timezone is required'),
    body('scheduleConfig.endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    body('scheduleConfig.maxOccurrences').optional().isInt({ min: 1 }).withMessage('Max occurrences must be a positive integer')
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
      const { postData, scheduleConfig } = req.body;

      const config: RecurringScheduleConfig = {
        frequency: scheduleConfig.frequency,
        interval: scheduleConfig.interval,
        timezone: scheduleConfig.timezone,
        daysOfWeek: scheduleConfig.daysOfWeek,
        dayOfMonth: scheduleConfig.dayOfMonth,
        endDate: scheduleConfig.endDate ? new Date(scheduleConfig.endDate) : undefined,
        maxOccurrences: scheduleConfig.maxOccurrences
      };

      const result = await advancedSchedulingService.createRecurringSchedule(
        userId,
        postData,
        config
      );

      res.json({
        success: result.success,
        data: {
          createdPosts: result.createdPosts,
          skippedDates: result.skippedDates,
          totalCreated: result.createdPosts.length,
          totalSkipped: result.skippedDates.length
        },
        error: result.error
      });
    } catch (error) {
      console.error('Error creating recurring schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create recurring schedule'
      });
    }
  }
);

/**
 * Execute bulk scheduling operation
 */
router.post('/bulk',
  authenticateToken,
  [
    body('posts').isArray({ min: 1 }).withMessage('At least one post is required'),
    body('posts.*.content').notEmpty().withMessage('Post content is required'),
    body('posts.*.platforms').isArray({ min: 1 }).withMessage('At least one platform is required per post'),
    body('posts.*.scheduledTime').isISO8601().withMessage('Scheduled time must be a valid ISO date'),
    body('options.conflictResolution').optional().isIn(['skip', 'reschedule', 'override']).withMessage('Conflict resolution must be skip, reschedule, or override'),
    body('options.rescheduleMinutes').optional().isInt({ min: 1 }).withMessage('Reschedule minutes must be a positive integer')
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
      const { posts, options } = req.body;

      const operation: BulkScheduleOperation = {
        posts: posts.map((post: any) => ({
          content: post.content,
          images: post.images || [],
          hashtags: post.hashtags || [],
          platforms: post.platforms,
          scheduledTime: new Date(post.scheduledTime),
          categories: post.categories || [],
          tags: post.tags || []
        })),
        options: options || { conflictResolution: 'skip' }
      };

      const result = await advancedSchedulingService.executeBulkScheduling(userId, operation);

      res.json({
        success: result.success,
        data: {
          createdPosts: result.createdPosts,
          conflicts: result.conflicts,
          errors: result.errors,
          totalCreated: result.createdPosts.length,
          totalConflicts: result.conflicts.length,
          totalErrors: result.errors.length
        }
      });
    } catch (error) {
      console.error('Error executing bulk scheduling:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute bulk scheduling'
      });
    }
  }
);

/**
 * Get optimal posting times
 */
router.get('/optimal-times',
  authenticateToken,
  [
    query('platforms').optional().isArray().withMessage('Platforms must be an array'),
    query('timezone').optional().notEmpty().withMessage('Timezone cannot be empty')
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
      const platforms = req.query.platforms as Platform[] || [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.X, Platform.PINTEREST];
      const timezone = req.query.timezone as string || 'UTC';

      const recommendations = await advancedSchedulingService.getOptimalPostingTimes(
        userId,
        platforms,
        timezone
      );

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Error fetching optimal times:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch optimal posting times'
      });
    }
  }
);

/**
 * Detect scheduling conflicts
 */
router.post('/conflicts',
  authenticateToken,
  [
    body('scheduledTime').isISO8601().withMessage('Scheduled time must be a valid ISO date'),
    body('platforms').isArray({ min: 1 }).withMessage('At least one platform is required')
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
      const { scheduledTime, platforms } = req.body;

      const conflicts = await advancedSchedulingService.detectSchedulingConflicts(
        userId,
        new Date(scheduledTime),
        platforms
      );

      res.json({
        success: true,
        data: {
          conflicts,
          hasConflicts: conflicts.length > 0,
          highSeverityConflicts: conflicts.filter(c => c.severity === 'high').length
        }
      });
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect scheduling conflicts'
      });
    }
  }
);

/**
 * Get scheduling suggestions
 */
router.get('/suggestions',
  authenticateToken,
  [
    query('platforms').optional().isArray().withMessage('Platforms must be an array'),
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
      const platforms = req.query.platforms as Platform[] || [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.X, Platform.PINTEREST];
      const contentType = req.query.contentType as string;

      const suggestions = await advancedSchedulingService.getSchedulingSuggestions(
        userId,
        platforms,
        contentType
      );

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Error fetching scheduling suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scheduling suggestions'
      });
    }
  }
);

/**
 * Get calendar data for a specific month
 */
router.get('/calendar',
  authenticateToken,
  [
    query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
    query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    query('timezone').optional().notEmpty().withMessage('Timezone cannot be empty')
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
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);
      const timezone = req.query.timezone as string || 'UTC';

      // Get start and end of month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // For now, return mock calendar data
      // In a real implementation, this would fetch scheduled posts for the month
      const mockCalendarData = {
        year,
        month,
        timezone,
        posts: [
          {
            id: '1',
            date: '2024-01-15',
            posts: [
              {
                id: 'post-1',
                content: 'Morning motivation post',
                scheduledTime: '2024-01-15T09:00:00Z',
                platforms: [Platform.FACEBOOK, Platform.INSTAGRAM],
                status: 'scheduled'
              }
            ]
          },
          {
            id: '2',
            date: '2024-01-16',
            posts: [
              {
                id: 'post-2',
                content: 'Weekly newsletter announcement',
                scheduledTime: '2024-01-16T14:30:00Z',
                platforms: [Platform.X],
                status: 'scheduled'
              }
            ]
          }
        ],
        summary: {
          totalScheduled: 2,
          platformBreakdown: {
            [Platform.FACEBOOK]: 1,
            [Platform.INSTAGRAM]: 1,
            [Platform.X]: 1,
            [Platform.PINTEREST]: 0
          }
        }
      };

      res.json({
        success: true,
        data: mockCalendarData
      });
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch calendar data'
      });
    }
  }
);

/**
 * Update post scheduling (for drag-and-drop functionality)
 */
router.put('/posts/:postId/reschedule',
  authenticateToken,
  [
    body('scheduledTime').isISO8601().withMessage('Scheduled time must be a valid ISO date'),
    body('checkConflicts').optional().isBoolean().withMessage('Check conflicts must be a boolean')
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
      const postId = req.params.postId;
      const { scheduledTime, checkConflicts = true } = req.body;

      // For now, return mock response
      // In a real implementation, this would update the post's scheduled time
      const mockResponse = {
        postId,
        oldScheduledTime: '2024-01-15T09:00:00Z',
        newScheduledTime: scheduledTime,
        conflicts: checkConflicts ? [] : undefined,
        updated: true
      };

      res.json({
        success: true,
        data: mockResponse
      });
    } catch (error) {
      console.error('Error rescheduling post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reschedule post'
      });
    }
  }
);

export default router;
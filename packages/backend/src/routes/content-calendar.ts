import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ContentCalendarService } from '../services/ContentCalendarService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const contentCalendarService = ContentCalendarService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get calendar view
 */
router.get('/',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('includeShared')
      .optional()
      .isBoolean()
      .withMessage('includeShared must be a boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const { startDate, endDate, includeShared = 'true' } = req.query;

      const calendarView = await contentCalendarService.getCalendarView(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        includeShared === 'true'
      );

      res.json({
        success: true,
        data: calendarView
      });
    } catch (error) {
      console.error('Error getting calendar view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get calendar view'
      });
    }
  }
);

/**
 * Create calendar event
 */
router.post('/events',
  [
    body('title')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title is required and must be 1-255 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('eventType')
      .isIn(['post', 'campaign', 'deadline', 'meeting', 'review'])
      .withMessage('Valid event type is required'),
    body('startDate')
      .isISO8601()
      .withMessage('Valid start date is required'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('allDay')
      .optional()
      .isBoolean()
      .withMessage('allDay must be a boolean'),
    body('recurrenceRule')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Recurrence rule must be less than 500 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code'),
    body('postId')
      .optional()
      .isUUID()
      .withMessage('Post ID must be a valid UUID'),
    body('assignedTo')
      .optional()
      .isUUID()
      .withMessage('Assigned to must be a valid user ID'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority level'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const {
        title,
        description,
        eventType,
        startDate,
        endDate,
        allDay,
        recurrenceRule,
        color,
        postId,
        assignedTo,
        priority,
        metadata
      } = req.body;

      const event = await contentCalendarService.createCalendarEvent({
        user_id: userId,
        title,
        description,
        event_type: eventType,
        start_date: new Date(startDate),
        end_date: endDate ? new Date(endDate) : undefined,
        all_day: allDay,
        recurrence_rule: recurrenceRule,
        color,
        post_id: postId,
        assigned_to: assignedTo,
        priority,
        metadata
      });

      res.status(201).json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create calendar event'
      });
    }
  }
);

/**
 * Update event status
 */
router.patch('/events/:eventId/status',
  [
    param('eventId')
      .isUUID()
      .withMessage('Valid event ID is required'),
    body('status')
      .isIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Valid status is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const { eventId } = req.params;
      const { status } = req.body;

      const event = await contentCalendarService.updateEventStatus(eventId, status, userId);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error updating event status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update event status'
      });
    }
  }
);

/**
 * Share calendar
 */
router.post('/share',
  [
    body('sharedWithId')
      .isUUID()
      .withMessage('Valid user ID is required'),
    body('permissionLevel')
      .isIn(['view', 'edit', 'admin'])
      .withMessage('Valid permission level is required'),
    body('permissions')
      .optional()
      .isObject()
      .withMessage('Permissions must be an object'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expires at must be a valid ISO 8601 date')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const calendarOwnerId = req.user!.id;
      const { sharedWithId, permissionLevel, permissions = {}, expiresAt } = req.body;

      const share = await contentCalendarService.shareCalendar(
        calendarOwnerId,
        sharedWithId,
        permissionLevel,
        permissions,
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.status(201).json({
        success: true,
        data: share
      });
    } catch (error) {
      console.error('Error sharing calendar:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to share calendar'
      });
    }
  }
);

/**
 * Create campaign
 */
router.post('/campaigns',
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name is required and must be 1-255 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('campaignType')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Campaign type must be less than 50 characters'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('budget')
      .optional()
      .isNumeric()
      .withMessage('Budget must be a number'),
    body('targetAudience')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Target audience must be less than 500 characters'),
    body('goals')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Goals must be less than 1000 characters'),
    body('kpis')
      .optional()
      .isObject()
      .withMessage('KPIs must be an object'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const {
        name,
        description,
        campaignType,
        startDate,
        endDate,
        budget,
        targetAudience,
        goals,
        kpis,
        color
      } = req.body;

      const campaign = await contentCalendarService.createCampaign({
        user_id: userId,
        name,
        description,
        campaign_type: campaignType,
        start_date: startDate ? new Date(startDate) : undefined,
        end_date: endDate ? new Date(endDate) : undefined,
        budget: budget ? parseFloat(budget) : undefined,
        target_audience: targetAudience,
        goals,
        kpis,
        color
      });

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
 * Add post to campaign
 */
router.post('/campaigns/:campaignId/posts',
  [
    param('campaignId')
      .isUUID()
      .withMessage('Valid campaign ID is required'),
    body('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    body('postRole')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Post role must be less than 50 characters'),
    body('sequenceOrder')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Sequence order must be a positive integer')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { campaignId } = req.params;
      const { postId, postRole, sequenceOrder } = req.body;

      const campaignPost = await contentCalendarService.addPostToCampaign(
        campaignId,
        postId,
        postRole,
        sequenceOrder
      );

      res.status(201).json({
        success: true,
        data: campaignPost
      });
    } catch (error) {
      console.error('Error adding post to campaign:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add post to campaign'
      });
    }
  }
);

/**
 * Get campaign analytics
 */
router.get('/campaigns/:campaignId/analytics',
  [
    param('campaignId')
      .isUUID()
      .withMessage('Valid campaign ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const { campaignId } = req.params;

      const analytics = await contentCalendarService.getCampaignAnalytics(campaignId, userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting campaign analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get campaign analytics'
      });
    }
  }
);

/**
 * Create workflow state
 */
router.post('/workflow-states',
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required and must be 1-100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code'),
    body('isInitialState')
      .optional()
      .isBoolean()
      .withMessage('isInitialState must be a boolean'),
    body('isFinalState')
      .optional()
      .isBoolean()
      .withMessage('isFinalState must be a boolean'),
    body('allowedTransitions')
      .optional()
      .isArray()
      .withMessage('Allowed transitions must be an array'),
    body('requiredRoles')
      .optional()
      .isArray()
      .withMessage('Required roles must be an array')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const {
        name,
        description,
        color = '#9E9E9E',
        isInitialState = false,
        isFinalState = false,
        allowedTransitions = [],
        requiredRoles = []
      } = req.body;

      const state = await contentCalendarService.createWorkflowState(
        userId,
        name,
        description,
        color,
        isInitialState,
        isFinalState,
        allowedTransitions,
        requiredRoles
      );

      res.status(201).json({
        success: true,
        data: state
      });
    } catch (error) {
      console.error('Error creating workflow state:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create workflow state'
      });
    }
  }
);

/**
 * Transition post workflow
 */
router.post('/posts/:postId/workflow/transition',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    body('toStateId')
      .isUUID()
      .withMessage('Valid state ID is required'),
    body('changeReason')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Change reason must be less than 500 characters')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const { postId } = req.params;
      const { toStateId, changeReason } = req.body;

      const transition = await contentCalendarService.transitionPostWorkflow(
        postId,
        toStateId,
        userId,
        changeReason
      );

      res.json({
        success: true,
        data: transition
      });
    } catch (error) {
      console.error('Error transitioning post workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to transition post workflow'
      });
    }
  }
);

/**
 * Add collaboration comment
 */
router.post('/posts/:postId/comments',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    body('commentText')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment text is required and must be 1-1000 characters'),
    body('commentType')
      .optional()
      .isIn(['general', 'suggestion', 'question', 'approval', 'rejection'])
      .withMessage('Invalid comment type'),
    body('isInternal')
      .optional()
      .isBoolean()
      .withMessage('isInternal must be a boolean'),
    body('parentCommentId')
      .optional()
      .isUUID()
      .withMessage('Parent comment ID must be a valid UUID'),
    body('mentions')
      .optional()
      .isArray()
      .withMessage('Mentions must be an array'),
    body('mentions.*')
      .optional()
      .isUUID()
      .withMessage('Each mention must be a valid user ID')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const commenterId = req.user!.id;
      const { postId } = req.params;
      const {
        commentText,
        commentType = 'general',
        isInternal = true,
        parentCommentId,
        mentions = []
      } = req.body;

      const comment = await contentCalendarService.addCollaborationComment(
        postId,
        commenterId,
        commentText,
        commentType,
        isInternal,
        parentCommentId,
        mentions
      );

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error('Error adding collaboration comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add collaboration comment'
      });
    }
  }
);

/**
 * Get post comments
 */
router.get('/posts/:postId/comments',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    query('includeResolved')
      .optional()
      .isBoolean()
      .withMessage('includeResolved must be a boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { postId } = req.params;
      const { includeResolved = 'true' } = req.query;

      const comments = await contentCalendarService.getPostComments(
        postId,
        includeResolved === 'true'
      );

      res.json({
        success: true,
        data: comments
      });
    } catch (error) {
      console.error('Error getting post comments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get post comments'
      });
    }
  }
);

/**
 * Resolve comment
 */
router.patch('/comments/:commentId/resolve',
  [
    param('commentId')
      .isUUID()
      .withMessage('Valid comment ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user!.id;
      const { commentId } = req.params;

      const comment = await contentCalendarService.resolveComment(commentId, userId);

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
      }

      res.json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error('Error resolving comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve comment'
      });
    }
  }
);

/**
 * Get post workflow history
 */
router.get('/posts/:postId/workflow/history',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { postId } = req.params;

      const history = await contentCalendarService.getPostWorkflowHistory(postId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting post workflow history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get post workflow history'
      });
    }
  }
);

export default router;
import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PostService, PostData } from '../services/PostService';
import { schedulerService } from '../services/SchedulerService';
import { PostStatus, Platform } from '../types/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Create a new post
 * POST /api/posts
 */
router.post('/',
  [
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ max: 10000 })
      .withMessage('Content cannot exceed 10,000 characters'),
    body('platforms')
      .isArray({ min: 1 })
      .withMessage('At least one platform must be selected')
      .custom((platforms) => {
        const validPlatforms = Object.values(Platform);
        return platforms.every((platform: string) => validPlatforms.includes(platform as Platform));
      })
      .withMessage('Invalid platform specified'),
    body('images')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Cannot have more than 10 images'),
    body('hashtags')
      .optional()
      .isArray({ max: 30 })
      .withMessage('Cannot have more than 30 hashtags'),
    body('scheduledTime')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format for scheduledTime')
      .custom((value) => {
        if (value && new Date(value) <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        return true;
      })
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postData: PostData = {
        content: req.body.content,
        images: req.body.images || [],
        hashtags: req.body.hashtags || [],
        platforms: req.body.platforms,
        scheduledTime: req.body.scheduledTime ? new Date(req.body.scheduledTime) : undefined
      };

      const post = await PostService.createPost(userId, postData);

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post
      });
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create post'
      });
    }
  }
);

/**
 * Get user's posts with pagination and filtering
 * GET /api/posts
 */
router.get('/',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('status')
      .optional()
      .isIn(Object.values(PostStatus))
      .withMessage('Invalid status filter')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as PostStatus | undefined;

      const posts = await PostService.getUserPosts(userId, limit, offset, status);

      res.json({
        success: true,
        data: posts,
        pagination: {
          limit,
          offset,
          count: posts.length
        }
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch posts'
      });
    }
  }
);

/**
 * Get user post statistics
 * GET /api/posts/stats
 */
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await PostService.getUserPostStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching post stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch post statistics'
      });
    }
  }
);

/**
 * Get a specific post by ID
 * GET /api/posts/:id
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;

      const post = await PostService.getPost(postId, userId);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Error fetching post:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch post'
      });
    }
  }
);

/**
 * Update a post
 * PUT /api/posts/:id
 */
router.put('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format'),
    body('content')
      .optional()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Content must be between 1 and 10,000 characters'),
    body('platforms')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one platform must be selected')
      .custom((platforms) => {
        if (!platforms) return true;
        const validPlatforms = Object.values(Platform);
        return platforms.every((platform: string) => validPlatforms.includes(platform as Platform));
      })
      .withMessage('Invalid platform specified'),
    body('images')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Cannot have more than 10 images'),
    body('hashtags')
      .optional()
      .isArray({ max: 30 })
      .withMessage('Cannot have more than 30 hashtags'),
    body('scheduledTime')
      .optional()
      .custom((value) => {
        if (value === null) return true; // Allow null to clear scheduled time
        if (value && !Date.parse(value)) {
          throw new Error('Invalid date format for scheduledTime');
        }
        if (value && new Date(value) <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        return true;
      })
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;

      const updateData: Partial<PostData> = {};
      
      if (req.body.content !== undefined) updateData.content = req.body.content;
      if (req.body.images !== undefined) updateData.images = req.body.images;
      if (req.body.hashtags !== undefined) updateData.hashtags = req.body.hashtags;
      if (req.body.platforms !== undefined) updateData.platforms = req.body.platforms;
      if (req.body.scheduledTime !== undefined) {
        updateData.scheduledTime = req.body.scheduledTime ? new Date(req.body.scheduledTime) : undefined;
      }

      const updatedPost = await PostService.updatePost(postId, userId, updateData);

      if (!updatedPost) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json({
        success: true,
        message: 'Post updated successfully',
        data: updatedPost
      });
    } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update post'
      });
    }
  }
);

/**
 * Update post status
 * PATCH /api/posts/:id/status
 */
router.patch('/:id/status',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format'),
    body('status')
      .isIn(Object.values(PostStatus))
      .withMessage('Invalid status value')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;
      const status = req.body.status as PostStatus;

      const updatedPost = await PostService.updatePostStatus(postId, userId, status);

      if (!updatedPost) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json({
        success: true,
        message: 'Post status updated successfully',
        data: updatedPost
      });
    } catch (error) {
      console.error('Error updating post status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update post status'
      });
    }
  }
);

/**
 * Execute a post immediately
 * POST /api/posts/:id/execute
 */
router.post('/:id/execute',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;

      const result = await schedulerService.executePostNow(postId, userId);

      res.json({
        success: result.success,
        message: result.success ? 'Post executed successfully' : 'Post execution failed',
        data: result
      });
    } catch (error) {
      console.error('Error executing post:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute post'
      });
    }
  }
);

/**
 * Cancel a scheduled post
 * POST /api/posts/:id/cancel
 */
router.post('/:id/cancel',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;

      const canceled = await schedulerService.cancelScheduledPost(postId, userId);

      if (!canceled) {
        return res.status(404).json({
          success: false,
          message: 'Scheduled post not found or already executed'
        });
      }

      res.json({
        success: true,
        message: 'Scheduled post canceled successfully'
      });
    } catch (error) {
      console.error('Error canceling scheduled post:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel scheduled post'
      });
    }
  }
);

/**
 * Get scheduler statistics
 * GET /api/posts/scheduler/stats
 */
router.get('/scheduler/stats',
  async (req: Request, res: Response) => {
    try {
      const stats = await schedulerService.getSchedulerStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching scheduler stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch scheduler statistics'
      });
    }
  }
);

/**
 * Delete a post
 * DELETE /api/posts/:id
 */
router.delete('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID format')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user!.id;
      const postId = req.params.id;

      // Cancel scheduled post if it exists
      await schedulerService.cancelScheduledPost(postId, userId);

      const deleted = await PostService.deletePost(postId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete post'
      });
    }
  }
);

export default router;
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { BloggerService } from '../services/BloggerService';
import { authenticateToken } from '../middleware/auth';
import { Platform } from '../types/database';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Setup or update blogger integration
 */
router.post('/setup',
  [
    body('blogUrl')
      .isURL()
      .withMessage('Valid blog URL is required'),
    body('autoApprove')
      .optional()
      .isBoolean()
      .withMessage('Auto approve must be a boolean'),
    body('defaultPlatforms')
      .optional()
      .isArray()
      .withMessage('Default platforms must be an array'),
    body('defaultPlatforms.*')
      .optional()
      .isIn(Object.values(Platform))
      .withMessage('Invalid platform specified'),
    body('customHashtags')
      .optional()
      .isArray()
      .withMessage('Custom hashtags must be an array'),
    body('customHashtags.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Hashtags must be 1-50 characters'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean')
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
        blogUrl,
        autoApprove = false,
        defaultPlatforms = [],
        customHashtags = [],
        enabled = true
      } = req.body;

      const integration = await BloggerService.setupBloggerIntegration(userId, {
        blogUrl,
        autoApprove,
        defaultPlatforms,
        customHashtags,
        enabled
      });

      res.json({
        success: true,
        data: {
          id: integration.id,
          blogUrl: integration.blog_url,
          rssFeedUrl: integration.rss_feed_url,
          autoApprove: integration.auto_approve,
          defaultPlatforms: integration.default_platforms,
          customHashtags: integration.custom_hashtags,
          enabled: integration.enabled,
          lastChecked: integration.last_checked,
          createdAt: integration.created_at,
          updatedAt: integration.updated_at
        }
      });
    } catch (error) {
      console.error('Error setting up blogger integration:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup blogger integration'
      });
    }
  }
);

/**
 * Get blogger integration settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const integration = await BloggerService.getBloggerIntegration(userId);

    if (!integration) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        id: integration.id,
        blogUrl: integration.blog_url,
        rssFeedUrl: integration.rss_feed_url,
        autoApprove: integration.auto_approve,
        defaultPlatforms: integration.default_platforms,
        customHashtags: integration.custom_hashtags,
        enabled: integration.enabled,
        lastChecked: integration.last_checked,
        createdAt: integration.created_at,
        updatedAt: integration.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting blogger integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blogger integration settings'
    });
  }
});

/**
 * Test blogger integration
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const recentPosts = await BloggerService.testBloggerIntegration(userId);

    res.json({
      success: true,
      data: {
        recentPosts: recentPosts.map(post => ({
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          url: post.url,
          publishedAt: post.publishedAt,
          author: post.author,
          categories: post.categories
        }))
      }
    });
  } catch (error) {
    console.error('Error testing blogger integration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test blogger integration'
    });
  }
});

/**
 * Manually trigger blogger feed monitoring
 */
router.post('/monitor', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const integration = await BloggerService.getBloggerIntegration(userId);

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'No blogger integration found'
      });
    }

    if (!integration.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Blogger integration is disabled'
      });
    }

    const result = await BloggerService.monitorBloggerFeed(integration);

    res.json({
      success: true,
      data: {
        newPostsFound: result.newPosts.length,
        newPosts: result.newPosts.map(post => ({
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          url: post.url,
          publishedAt: post.publishedAt
        })),
        lastChecked: result.lastChecked,
        error: result.error
      }
    });
  } catch (error) {
    console.error('Error monitoring blogger feed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor blogger feed'
    });
  }
});

/**
 * Disable blogger integration
 */
router.post('/disable', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const success = await BloggerService.disableBloggerIntegration(userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'No blogger integration found'
      });
    }

    res.json({
      success: true,
      message: 'Blogger integration disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling blogger integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable blogger integration'
    });
  }
});

export default router;
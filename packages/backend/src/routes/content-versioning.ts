import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ContentVersioningService } from '../services/ContentVersioningService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const contentVersioningService = ContentVersioningService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get version history for a post
 */
router.get('/posts/:postId/versions',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
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
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const history = await contentVersioningService.getVersionHistory(postId, limit);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting version history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get version history'
      });
    }
  }
);

/**
 * Compare two versions of a post
 */
router.get('/posts/:postId/versions/:version1/compare/:version2',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    param('version1')
      .isInt({ min: 1 })
      .withMessage('Version 1 must be a positive integer'),
    param('version2')
      .isInt({ min: 1 })
      .withMessage('Version 2 must be a positive integer')
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

      const { postId, version1, version2 } = req.params;

      const comparison = await contentVersioningService.compareVersions(
        postId,
        parseInt(version1),
        parseInt(version2)
      );

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error comparing versions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare versions'
      });
    }
  }
);

/**
 * Revert to a previous version
 */
router.post('/posts/:postId/versions/:versionNumber/revert',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    param('versionNumber')
      .isInt({ min: 1 })
      .withMessage('Version number must be a positive integer')
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
      const { postId, versionNumber } = req.params;

      const revertedVersion = await contentVersioningService.revertToVersion(
        postId,
        parseInt(versionNumber),
        userId
      );

      res.json({
        success: true,
        data: revertedVersion
      });
    } catch (error) {
      console.error('Error reverting to version:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revert to version'
      });
    }
  }
);

/**
 * Add revision comment
 */
router.post('/versions/:versionId/comments',
  [
    param('versionId')
      .isUUID()
      .withMessage('Valid version ID is required'),
    body('commentText')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment text is required and must be 1-1000 characters'),
    body('commentType')
      .optional()
      .isIn(['general', 'suggestion', 'issue', 'approval'])
      .withMessage('Invalid comment type')
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
      const { versionId } = req.params;
      const { commentText, commentType = 'general' } = req.body;

      const comment = await contentVersioningService.addRevisionComment(
        versionId,
        commenterId,
        commentText,
        commentType
      );

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error('Error adding revision comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add revision comment'
      });
    }
  }
);

/**
 * Create A/B test
 */
router.post('/ab-tests',
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
    body('testType')
      .isIn(['content', 'timing', 'platform', 'hashtags'])
      .withMessage('Valid test type is required'),
    body('variants')
      .isArray({ min: 2 })
      .withMessage('At least 2 variants are required'),
    body('variants.*.name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Variant name is required and must be 1-100 characters'),
    body('variants.*.postId')
      .isUUID()
      .withMessage('Valid post ID is required for each variant'),
    body('variants.*.trafficAllocation')
      .isFloat({ min: 0, max: 1 })
      .withMessage('Traffic allocation must be between 0 and 1'),
    body('duration.startDate')
      .isISO8601()
      .withMessage('Valid start date is required'),
    body('duration.endDate')
      .isISO8601()
      .withMessage('Valid end date is required'),
    body('metrics.primary')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Primary metric is required'),
    body('sampleSize')
      .isInt({ min: 100 })
      .withMessage('Sample size must be at least 100'),
    body('confidenceLevel')
      .isFloat({ min: 0.8, max: 0.99 })
      .withMessage('Confidence level must be between 0.8 and 0.99')
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
      const config = req.body;

      const test = await contentVersioningService.createABTest(userId, config);

      res.status(201).json({
        success: true,
        data: test
      });
    } catch (error) {
      console.error('Error creating A/B test:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create A/B test'
      });
    }
  }
);

/**
 * Start A/B test
 */
router.post('/ab-tests/:testId/start',
  [
    param('testId')
      .isUUID()
      .withMessage('Valid test ID is required')
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
      const { testId } = req.params;

      const test = await contentVersioningService.startABTest(testId, userId);

      res.json({
        success: true,
        data: test
      });
    } catch (error) {
      console.error('Error starting A/B test:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start A/B test'
      });
    }
  }
);

/**
 * Record A/B test result
 */
router.post('/ab-tests/:testId/variants/:variantId/results',
  [
    param('testId')
      .isUUID()
      .withMessage('Valid test ID is required'),
    param('variantId')
      .isUUID()
      .withMessage('Valid variant ID is required'),
    body('metricName')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Metric name is required and must be 1-50 characters'),
    body('metricValue')
      .isNumeric()
      .withMessage('Metric value must be a number'),
    body('sampleSize')
      .isInt({ min: 1 })
      .withMessage('Sample size must be a positive integer')
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

      const { testId, variantId } = req.params;
      const { metricName, metricValue, sampleSize } = req.body;

      await contentVersioningService.recordABTestResult(
        testId,
        variantId,
        metricName,
        parseFloat(metricValue),
        parseInt(sampleSize)
      );

      res.json({
        success: true,
        message: 'A/B test result recorded successfully'
      });
    } catch (error) {
      console.error('Error recording A/B test result:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record A/B test result'
      });
    }
  }
);

/**
 * Get A/B test results
 */
router.get('/ab-tests/:testId/results',
  [
    param('testId')
      .isUUID()
      .withMessage('Valid test ID is required')
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
      const { testId } = req.params;

      const results = await contentVersioningService.getABTestResults(testId, userId);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error getting A/B test results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get A/B test results'
      });
    }
  }
);

/**
 * Record performance metric
 */
router.post('/posts/:postId/metrics',
  [
    param('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    body('metricCategory')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Metric category is required and must be 1-50 characters'),
    body('metricName')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Metric name is required and must be 1-50 characters'),
    body('metricValue')
      .isNumeric()
      .withMessage('Metric value must be a number'),
    body('platformPostId')
      .optional()
      .isUUID()
      .withMessage('Platform post ID must be a valid UUID'),
    body('metricUnit')
      .optional()
      .isString()
      .isLength({ max: 20 })
      .withMessage('Metric unit must be less than 20 characters'),
    body('benchmarkValue')
      .optional()
      .isNumeric()
      .withMessage('Benchmark value must be a number'),
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

      const { postId } = req.params;
      const {
        metricCategory,
        metricName,
        metricValue,
        platformPostId,
        metricUnit,
        benchmarkValue,
        metadata
      } = req.body;

      const metric = await contentVersioningService.recordPerformanceMetric(
        postId,
        metricCategory,
        metricName,
        parseFloat(metricValue),
        {
          platformPostId,
          metricUnit,
          benchmarkValue: benchmarkValue ? parseFloat(benchmarkValue) : undefined,
          metadata
        }
      );

      res.status(201).json({
        success: true,
        data: metric
      });
    } catch (error) {
      console.error('Error recording performance metric:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record performance metric'
      });
    }
  }
);

/**
 * Get performance summary for a post
 */
router.get('/posts/:postId/performance',
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

      const summary = await contentVersioningService.getPerformanceSummary(postId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting performance summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance summary'
      });
    }
  }
);

export default router;
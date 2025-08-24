import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { contentCategorizationService, PostFilter } from '../services/ContentCategorizationService';
import { Platform, PostStatus } from '../types/database';

const router = express.Router();

/**
 * Get all categories for the authenticated user
 */
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const categories = await contentCategorizationService.getCategories(userId);

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
  }
);

/**
 * Create a new category
 */
router.post('/',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('name').isLength({ max: 100 }).withMessage('Category name must be 100 characters or less'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color code')
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
      const { name, description, color } = req.body;

      const category = await contentCategorizationService.createCategory(userId, {
        name,
        description,
        color
      });

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Error creating category:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        res.status(409).json({
          success: false,
          error: 'Category with this name already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create category'
        });
      }
    }
  }
);

/**
 * Update a category
 */
router.put('/:categoryId',
  authenticateToken,
  [
    body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
    body('name').optional().isLength({ max: 100 }).withMessage('Category name must be 100 characters or less'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color code')
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
      const categoryId = req.params.categoryId;
      const updates = req.body;

      const category = await contentCategorizationService.updateCategory(userId, categoryId, updates);

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Error updating category:', error);
      if (error instanceof Error && error.message === 'Category not found') {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update category'
        });
      }
    }
  }
);

/**
 * Delete a category
 */
router.delete('/:categoryId',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const categoryId = req.params.categoryId;

      await contentCategorizationService.deleteCategory(userId, categoryId);

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof Error && error.message === 'Category not found') {
        res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete category'
        });
      }
    }
  }
);

/**
 * Get category analytics
 */
router.get('/:categoryName/analytics',
  authenticateToken,
  [
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
      const categoryName = decodeURIComponent(req.params.categoryName);
      
      const dateRange = req.query.startDate && req.query.endDate ? {
        startDate: new Date(req.query.startDate as string),
        endDate: new Date(req.query.endDate as string)
      } : undefined;

      const analytics = await contentCategorizationService.getCategoryAnalytics(
        userId,
        categoryName,
        dateRange
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching category analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch category analytics'
      });
    }
  }
);

/**
 * Get all tags for the authenticated user
 */
router.get('/tags',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const tags = await contentCategorizationService.getTags(userId);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tags'
      });
    }
  }
);

/**
 * Create a new tag
 */
router.post('/tags',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Tag name is required'),
    body('name').isLength({ max: 50 }).withMessage('Tag name must be 50 characters or less'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be 500 characters or less')
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
      const { name, description } = req.body;

      const tag = await contentCategorizationService.createTag(userId, {
        name: name.toLowerCase().replace(/\s+/g, ''), // Normalize tag name
        description
      });

      res.status(201).json({
        success: true,
        data: tag
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        res.status(409).json({
          success: false,
          error: 'Tag with this name already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create tag'
        });
      }
    }
  }
);

/**
 * Update a tag
 */
router.put('/tags/:tagId',
  authenticateToken,
  [
    body('name').optional().notEmpty().withMessage('Tag name cannot be empty'),
    body('name').optional().isLength({ max: 50 }).withMessage('Tag name must be 50 characters or less'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be 500 characters or less')
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
      const tagId = req.params.tagId;
      const updates = req.body;

      // Normalize tag name if provided
      if (updates.name) {
        updates.name = updates.name.toLowerCase().replace(/\s+/g, '');
      }

      const tag = await contentCategorizationService.updateTag(userId, tagId, updates);

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      if (error instanceof Error && error.message === 'Tag not found') {
        res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update tag'
        });
      }
    }
  }
);

/**
 * Delete a tag
 */
router.delete('/tags/:tagId',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const tagId = req.params.tagId;

      await contentCategorizationService.deleteTag(userId, tagId);

      res.json({
        success: true,
        message: 'Tag deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting tag:', error);
      if (error instanceof Error && error.message === 'Tag not found') {
        res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete tag'
        });
      }
    }
  }
);

/**
 * Filter posts by categories, tags, and other criteria
 */
router.get('/posts/filter',
  authenticateToken,
  [
    query('categories').optional().isArray().withMessage('Categories must be an array'),
    query('tags').optional().isArray().withMessage('Tags must be an array'),
    query('platforms').optional().isArray().withMessage('Platforms must be an array'),
    query('status').optional().isIn(['draft', 'scheduled', 'publishing', 'published', 'failed']).withMessage('Invalid status'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('searchTerm').optional().isLength({ max: 200 }).withMessage('Search term must be 200 characters or less'),
    query('sortBy').optional().isIn(['createdAt', 'scheduledTime', 'engagement', 'alphabetical']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
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
      const filters: PostFilter = {
        categories: req.query.categories as string[],
        tags: req.query.tags as string[],
        platforms: req.query.platforms as Platform[],
        status: req.query.status as PostStatus,
        searchTerm: req.query.searchTerm as string,
        sortBy: req.query.sortBy as 'createdAt' | 'scheduledTime' | 'engagement' | 'alphabetical',
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        };
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const result = await contentCategorizationService.filterPosts(userId, filters, limit, offset);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error filtering posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to filter posts'
      });
    }
  }
);

/**
 * Add categories to a post
 */
router.post('/posts/:postId/categories',
  authenticateToken,
  [
    body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
    body('categories.*').notEmpty().withMessage('Category names cannot be empty')
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

      const postId = req.params.postId;
      const { categories } = req.body;

      await contentCategorizationService.addCategoriesToPost(postId, categories);

      res.json({
        success: true,
        message: 'Categories added to post successfully'
      });
    } catch (error) {
      console.error('Error adding categories to post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add categories to post'
      });
    }
  }
);

/**
 * Add tags to a post
 */
router.post('/posts/:postId/tags',
  authenticateToken,
  [
    body('tags').isArray({ min: 1 }).withMessage('At least one tag is required'),
    body('tags.*').notEmpty().withMessage('Tag names cannot be empty')
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

      const postId = req.params.postId;
      const { tags } = req.body;

      // Normalize tag names
      const normalizedTags = tags.map((tag: string) => tag.toLowerCase().replace(/\s+/g, ''));

      await contentCategorizationService.addTagsToPost(postId, normalizedTags);

      res.json({
        success: true,
        message: 'Tags added to post successfully'
      });
    } catch (error) {
      console.error('Error adding tags to post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add tags to post'
      });
    }
  }
);

/**
 * Get category suggestions for content
 */
router.post('/suggest-categories',
  authenticateToken,
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('hashtags').optional().isArray().withMessage('Hashtags must be an array')
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

      const { content, hashtags = [] } = req.body;

      const suggestions = await contentCategorizationService.suggestCategories(content, hashtags);

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Error suggesting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to suggest categories'
      });
    }
  }
);

/**
 * Get tag suggestions for content
 */
router.post('/suggest-tags',
  authenticateToken,
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('hashtags').optional().isArray().withMessage('Hashtags must be an array')
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

      const { content, hashtags = [] } = req.body;

      const suggestions = await contentCategorizationService.suggestTags(content, hashtags);

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Error suggesting tags:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to suggest tags'
      });
    }
  }
);

export default router;
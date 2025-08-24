import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ContentTemplateModel, TemplateVariable } from '../models/ContentTemplate';
import { authenticateToken } from '../middleware/auth';
import { Platform } from '../types/database';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get all templates for the authenticated user
 */
router.get('/',
  [
    query('type')
      .optional()
      .isIn(['blogger', 'soloboss', 'manual'])
      .withMessage('Invalid template type'),
    query('platform')
      .optional()
      .isIn([...Object.values(Platform), 'all'])
      .withMessage('Invalid platform'),
    query('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean')
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
      const { type, platform, active } = req.query;

      let templates = await ContentTemplateModel.findByUserId(
        userId,
        type as string,
        platform as Platform | 'all'
      );

      // Filter by active status if specified
      if (active !== undefined) {
        const isActive = active === 'true';
        templates = templates.filter(template => template.is_active === isActive);
      }

      res.json({
        success: true,
        data: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          templateType: template.template_type,
          platform: template.platform,
          templateContent: template.template_content,
          variables: template.variables,
          isActive: template.is_active,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }))
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch templates'
      });
    }
  }
);

/**
 * Get a specific template by ID
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid template ID')
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
      const { id } = req.params;

      const template = await ContentTemplateModel.findById(id, userId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          templateType: template.template_type,
          platform: template.platform,
          templateContent: template.template_content,
          variables: template.variables,
          isActive: template.is_active,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch template'
      });
    }
  }
);

/**
 * Create a new template
 */
router.post('/',
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
    body('templateType')
      .isIn(['blogger', 'soloboss', 'manual'])
      .withMessage('Invalid template type'),
    body('platform')
      .isIn([...Object.values(Platform), 'all'])
      .withMessage('Invalid platform'),
    body('templateContent')
      .isString()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Template content is required and must be 1-10000 characters'),
    body('variables')
      .optional()
      .isArray()
      .withMessage('Variables must be an array'),
    body('variables.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Variable names must be 1-100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
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
        templateType,
        platform,
        templateContent,
        variables = [],
        isActive = true
      } = req.body;

      const template = await ContentTemplateModel.create({
        user_id: userId,
        name,
        description,
        template_type: templateType,
        platform,
        template_content: templateContent,
        variables,
        is_active: isActive
      });

      res.status(201).json({
        success: true,
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          templateType: template.template_type,
          platform: template.platform,
          templateContent: template.template_content,
          variables: template.variables,
          isActive: template.is_active,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template'
      });
    }
  }
);

/**
 * Update a template
 */
router.put('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid template ID'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be 1-255 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('templateContent')
      .optional()
      .isString()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Template content must be 1-10000 characters'),
    body('variables')
      .optional()
      .isArray()
      .withMessage('Variables must be an array'),
    body('variables.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Variable names must be 1-100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
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
      const { id } = req.params;
      const {
        name,
        description,
        templateContent,
        variables,
        isActive
      } = req.body;

      const template = await ContentTemplateModel.update(id, userId, {
        name,
        description,
        template_content: templateContent,
        variables,
        is_active: isActive
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          templateType: template.template_type,
          platform: template.platform,
          templateContent: template.template_content,
          variables: template.variables,
          isActive: template.is_active,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update template'
      });
    }
  }
);

/**
 * Delete a template
 */
router.delete('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid template ID')
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
      const { id } = req.params;

      const success = await ContentTemplateModel.delete(id, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template'
      });
    }
  }
);

/**
 * Get available variables for a template type
 */
router.get('/variables/:templateType',
  [
    param('templateType')
      .isIn(['blogger', 'soloboss', 'manual'])
      .withMessage('Invalid template type')
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

      const { templateType } = req.params;
      const variables = ContentTemplateModel.getAvailableVariables(templateType as 'blogger' | 'soloboss' | 'manual');

      res.json({
        success: true,
        data: {
          templateType,
          variables
        }
      });
    } catch (error) {
      console.error('Error fetching template variables:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch template variables'
      });
    }
  }
);

/**
 * Preview template with sample data
 */
router.post('/:id/preview',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid template ID'),
    body('sampleData')
      .optional()
      .isObject()
      .withMessage('Sample data must be an object')
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
      const { id } = req.params;
      const { sampleData = {} } = req.body;

      const template = await ContentTemplateModel.findById(id, userId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Generate sample data based on template type
      const defaultSampleData = generateSampleData(template.template_type);
      const mergedSampleData = { ...defaultSampleData, ...sampleData };

      // Apply template with sample data (simplified version)
      let preview = template.template_content;
      
      // Replace variables
      for (const [key, value] of Object.entries(mergedSampleData)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        preview = preview.replace(regex, String(value));
      }

      // Handle simple conditionals (basic implementation)
      preview = preview.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, variable, content) => {
        const value = mergedSampleData[variable];
        return value && String(value).trim() ? content : '';
      });

      // Handle simple loops (basic implementation)
      preview = preview.replace(/{{#each\s+(\w+)}}(.*?){{\/each}}/gs, (match, variable, content) => {
        const value = mergedSampleData[variable];
        if (Array.isArray(value)) {
          return value.map(item => content.replace(/{{this}}/g, String(item))).join(' ');
        }
        if (typeof value === 'string') {
          const items = value.split(',').map(item => item.trim());
          return items.map(item => content.replace(/{{this}}/g, item)).join(' ');
        }
        return '';
      });

      // Clean up any remaining template syntax
      preview = preview.replace(/{{[^}]*}}/g, '');

      res.json({
        success: true,
        data: {
          templateId: template.id,
          templateName: template.name,
          platform: template.platform,
          preview: preview.trim(),
          sampleDataUsed: mergedSampleData
        }
      });
    } catch (error) {
      console.error('Error generating template preview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate template preview'
      });
    }
  }
);

/**
 * Generate sample data for template preview
 */
function generateSampleData(templateType: string): Record<string, any> {
  const baseData = {
    title: 'Sample Blog Post Title',
    content: 'This is a sample excerpt from a blog post that demonstrates how the template will look with real content.',
    url: 'https://example.com/blog/sample-post',
    author: 'John Doe',
    date: new Date().toLocaleDateString(),
    hashtags: ['#blogging', '#content', '#socialmedia'],
    current_date: new Date().toLocaleDateString(),
    current_time: new Date().toLocaleTimeString()
  };

  switch (templateType) {
    case 'blogger':
      return {
        ...baseData,
        blog_name: 'My Awesome Blog',
        categories: 'Technology, Web Development',
        excerpt: 'This is a sample excerpt from the blog post...'
      };
    
    case 'soloboss':
      return {
        ...baseData,
        seo_suggestions: 'SEO optimization, content marketing, social media strategy',
        social_text: 'AI-generated social media text that is optimized for engagement',
        keywords: 'AI, content, optimization, social media'
      };
    
    case 'manual':
    default:
      return baseData;
  }
}

export default router;
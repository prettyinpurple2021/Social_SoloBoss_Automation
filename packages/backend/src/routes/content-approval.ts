import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ContentApprovalService } from '../services/ContentApprovalService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const contentApprovalService = ContentApprovalService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Add team member
 */
router.post('/team-members',
  [
    body('userId')
      .isUUID()
      .withMessage('Valid user ID is required'),
    body('role')
      .isIn(['admin', 'editor', 'viewer'])
      .withMessage('Valid role is required'),
    body('permissions')
      .optional()
      .isObject()
      .withMessage('Permissions must be an object')
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

      const teamOwnerId = req.user!.id;
      const { userId, role, permissions } = req.body;

      const teamMember = await contentApprovalService.addTeamMember({
        user_id: userId,
        team_owner_id: teamOwnerId,
        role,
        permissions
      });

      res.status(201).json({
        success: true,
        data: teamMember
      });
    } catch (error) {
      console.error('Error adding team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add team member'
      });
    }
  }
);

/**
 * Create approval workflow
 */
router.post('/workflows',
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
    body('steps')
      .isArray({ min: 1 })
      .withMessage('At least one workflow step is required'),
    body('steps.*.stepNumber')
      .isInt({ min: 0 })
      .withMessage('Step number must be a non-negative integer'),
    body('steps.*.name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Step name is required and must be 1-100 characters'),
    body('steps.*.requiredRoles')
      .isArray({ min: 1 })
      .withMessage('At least one required role must be specified'),
    body('steps.*.requiredApprovers')
      .isInt({ min: 1 })
      .withMessage('At least one approver is required'),
    body('steps.*.allowSelfApproval')
      .isBoolean()
      .withMessage('allowSelfApproval must be a boolean'),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean')
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
      const { name, description, steps, isDefault } = req.body;

      const workflow = await contentApprovalService.createApprovalWorkflow({
        user_id: userId,
        name,
        description,
        steps,
        is_default: isDefault
      });

      res.status(201).json({
        success: true,
        data: workflow
      });
    } catch (error) {
      console.error('Error creating approval workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create approval workflow'
      });
    }
  }
);

/**
 * Submit post for approval
 */
router.post('/requests',
  [
    body('postId')
      .isUUID()
      .withMessage('Valid post ID is required'),
    body('workflowId')
      .isUUID()
      .withMessage('Valid workflow ID is required'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority level'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Notes must be less than 1000 characters')
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

      const requesterId = req.user!.id;
      const { postId, workflowId, priority, dueDate, notes } = req.body;

      const approvalRequest = await contentApprovalService.submitForApproval({
        post_id: postId,
        workflow_id: workflowId,
        requester_id: requesterId,
        priority,
        due_date: dueDate ? new Date(dueDate) : undefined,
        notes
      });

      res.status(201).json({
        success: true,
        data: approvalRequest
      });
    } catch (error) {
      console.error('Error submitting for approval:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit for approval'
      });
    }
  }
);

/**
 * Process approval decision
 */
router.post('/requests/:id/decision',
  [
    param('id')
      .isUUID()
      .withMessage('Valid approval request ID is required'),
    body('action')
      .isIn(['approve', 'reject', 'request_changes'])
      .withMessage('Valid action is required'),
    body('comments')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Comments must be less than 1000 characters'),
    body('skipToStep')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip to step must be a non-negative integer')
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

      const approverId = req.user!.id;
      const { id } = req.params;
      const { action, comments, skipToStep } = req.body;

      const result = await contentApprovalService.processApprovalDecision(id, approverId, {
        action,
        comments,
        skipToStep
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error processing approval decision:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process approval decision'
      });
    }
  }
);

/**
 * Get workflow progress
 */
router.get('/requests/:id/progress',
  [
    param('id')
      .isUUID()
      .withMessage('Valid approval request ID is required')
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

      const progress = await contentApprovalService.getWorkflowProgress(id, userId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('Error getting workflow progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow progress'
      });
    }
  }
);

/**
 * Get pending approvals
 */
router.get('/pending',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const pendingApprovals = await contentApprovalService.getPendingApprovals(userId);

      res.json({
        success: true,
        data: pendingApprovals
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending approvals'
      });
    }
  }
);

/**
 * Cancel approval request
 */
router.delete('/requests/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Valid approval request ID is required')
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

      const success = await contentApprovalService.cancelApprovalRequest(id, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Approval request not found'
        });
      }

      res.json({
        success: true,
        message: 'Approval request cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling approval request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel approval request'
      });
    }
  }
);

export default router;
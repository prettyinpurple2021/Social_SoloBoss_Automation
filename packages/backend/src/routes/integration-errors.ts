import { Router, Request, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { IntegrationErrorService, IntegrationErrorType, ErrorSeverity } from '../services/IntegrationErrorService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

const errorService = IntegrationErrorService.getInstance();

/**
 * Get integration errors for the authenticated user
 */
router.get('/',
  [
    query('integrationType')
      .optional()
      .isIn(['blogger', 'soloboss'])
      .withMessage('Invalid integration type'),
    query('errorType')
      .optional()
      .isIn(Object.values(IntegrationErrorType))
      .withMessage('Invalid error type'),
    query('severity')
      .optional()
      .isIn(Object.values(ErrorSeverity))
      .withMessage('Invalid severity'),
    query('resolved')
      .optional()
      .isBoolean()
      .withMessage('Resolved must be a boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
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
        integrationType,
        errorType,
        severity,
        resolved,
        limit = 20,
        offset = 0
      } = req.query;

      const integrationErrors = await errorService.getUserErrors(userId, {
        integrationType: integrationType as 'blogger' | 'soloboss',
        errorType: errorType as IntegrationErrorType,
        severity: severity as ErrorSeverity,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: integrationErrors.map(error => ({
          id: error.id,
          integrationType: error.integration_type,
          errorType: error.error_type,
          severity: error.severity,
          message: error.message,
          details: error.details,
          context: error.context,
          recoveryActions: error.recovery_actions,
          retryCount: error.retry_count,
          maxRetries: error.max_retries,
          nextRetryAt: error.next_retry_at,
          resolved: error.resolved,
          resolvedAt: error.resolved_at,
          resolutionMethod: error.resolution_method,
          createdAt: error.created_at,
          updatedAt: error.updated_at
        })),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: integrationErrors.length === parseInt(limit as string)
        }
      });
    } catch (error) {
      console.error('Error fetching integration errors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch integration errors'
      });
    }
  }
);

/**
 * Get error analytics for the authenticated user
 */
router.get('/analytics',
  [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365')
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
      const days = parseInt(req.query.days as string) || 30;

      const analytics = await errorService.getErrorAnalytics(userId, days);

      res.json({
        success: true,
        data: {
          period: `${days} days`,
          ...analytics
        }
      });
    } catch (error) {
      console.error('Error fetching error analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch error analytics'
      });
    }
  }
);

/**
 * Get a specific error by ID
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid error ID')
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

      const integrationErrors = await errorService.getUserErrors(userId, { limit: 1 });
      const error = integrationErrors.find(e => e.id === id);

      if (!error) {
        return res.status(404).json({
          success: false,
          error: 'Error not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: error.id,
          integrationType: error.integration_type,
          errorType: error.error_type,
          severity: error.severity,
          message: error.message,
          details: error.details,
          context: error.context,
          stackTrace: error.stack_trace,
          recoveryActions: error.recovery_actions,
          retryCount: error.retry_count,
          maxRetries: error.max_retries,
          nextRetryAt: error.next_retry_at,
          resolved: error.resolved,
          resolvedAt: error.resolved_at,
          resolutionMethod: error.resolution_method,
          createdAt: error.created_at,
          updatedAt: error.updated_at
        }
      });
    } catch (error) {
      console.error('Error fetching integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch integration error'
      });
    }
  }
);

/**
 * Attempt to recover from a specific error
 */
router.post('/:id/recover',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid error ID')
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

      // Verify the error belongs to the user
      const userErrors = await errorService.getUserErrors(userId, { limit: 1000 });
      const error = userErrors.find(e => e.id === id);

      if (!error) {
        return res.status(404).json({
          success: false,
          error: 'Error not found'
        });
      }

      const recoveryResult = await errorService.attemptRecovery(id);

      res.json({
        success: true,
        data: {
          errorId: id,
          recoverySuccess: recoveryResult.success,
          action: recoveryResult.action,
          message: recoveryResult.message,
          shouldRetry: recoveryResult.shouldRetry,
          retryAfter: recoveryResult.retryAfter
        }
      });
    } catch (error) {
      console.error('Error attempting recovery:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to attempt error recovery'
      });
    }
  }
);

/**
 * Get error types and their descriptions
 */
router.get('/types/list', async (req: Request, res: Response) => {
  try {
    const errorTypes = Object.values(IntegrationErrorType).map(type => ({
      type,
      description: getErrorTypeDescription(type)
    }));

    const severityLevels = Object.values(ErrorSeverity).map(severity => ({
      severity,
      description: getSeverityDescription(severity)
    }));

    res.json({
      success: true,
      data: {
        errorTypes,
        severityLevels
      }
    });
  } catch (error) {
    console.error('Error fetching error types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error types'
    });
  }
});

/**
 * Get summary of unresolved errors
 */
router.get('/summary/unresolved', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const unresolvedErrors = await errorService.getUserErrors(userId, {
      resolved: false,
      limit: 1000
    });

    const summary = {
      total: unresolvedErrors.length,
      bySeverity: {
        critical: unresolvedErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
        high: unresolvedErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        medium: unresolvedErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        low: unresolvedErrors.filter(e => e.severity === ErrorSeverity.LOW).length
      },
      byIntegrationType: {
        blogger: unresolvedErrors.filter(e => e.integration_type === 'blogger').length,
        soloboss: unresolvedErrors.filter(e => e.integration_type === 'soloboss').length
      },
      oldestError: unresolvedErrors.length > 0 ? 
        unresolvedErrors.reduce((oldest, current) => 
          new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
        ).created_at : null,
      recentErrors: unresolvedErrors
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(error => ({
          id: error.id,
          errorType: error.error_type,
          severity: error.severity,
          message: error.message,
          createdAt: error.created_at
        }))
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching unresolved errors summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unresolved errors summary'
    });
  }
});

// Helper functions
function getErrorTypeDescription(errorType: IntegrationErrorType): string {
  const descriptions: Record<IntegrationErrorType, string> = {
    [IntegrationErrorType.WEBHOOK_VALIDATION]: 'Webhook signature or payload validation failed',
    [IntegrationErrorType.CONTENT_PROCESSING]: 'Error processing content from integration source',
    [IntegrationErrorType.TEMPLATE_RENDERING]: 'Error rendering content template',
    [IntegrationErrorType.PLATFORM_PUBLISHING]: 'Error publishing to social media platform',
    [IntegrationErrorType.API_CONNECTION]: 'Connection error with external API',
    [IntegrationErrorType.DATA_TRANSFORMATION]: 'Error transforming data between formats',
    [IntegrationErrorType.AUTHENTICATION]: 'Authentication or authorization error',
    [IntegrationErrorType.RATE_LIMIT]: 'Rate limit exceeded for external service',
    [IntegrationErrorType.MALFORMED_DATA]: 'Received malformed or invalid data',
    [IntegrationErrorType.NETWORK_TIMEOUT]: 'Network timeout or connectivity issue'
  };

  return descriptions[errorType] || 'Unknown error type';
}

function getSeverityDescription(severity: ErrorSeverity): string {
  const descriptions: Record<ErrorSeverity, string> = {
    [ErrorSeverity.LOW]: 'Minor issue that does not significantly impact functionality',
    [ErrorSeverity.MEDIUM]: 'Moderate issue that may affect some features',
    [ErrorSeverity.HIGH]: 'Serious issue that significantly impacts user experience',
    [ErrorSeverity.CRITICAL]: 'Critical issue that breaks core functionality'
  };

  return descriptions[severity] || 'Unknown severity level';
}

export default router;
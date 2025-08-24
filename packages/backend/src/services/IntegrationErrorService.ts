import { db } from '../database';
import { loggerService } from './LoggerService';
import { NotificationService } from './NotificationService';

export enum IntegrationErrorType {
  WEBHOOK_VALIDATION = 'webhook_validation',
  CONTENT_PROCESSING = 'content_processing',
  TEMPLATE_RENDERING = 'template_rendering',
  PLATFORM_PUBLISHING = 'platform_publishing',
  API_CONNECTION = 'api_connection',
  DATA_TRANSFORMATION = 'data_transformation',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  MALFORMED_DATA = 'malformed_data',
  NETWORK_TIMEOUT = 'network_timeout'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryAction {
  RETRY = 'retry',
  SKIP = 'skip',
  MANUAL_REVIEW = 'manual_review',
  FALLBACK_TEMPLATE = 'fallback_template',
  NOTIFY_USER = 'notify_user',
  DISABLE_INTEGRATION = 'disable_integration'
}

export interface IntegrationError {
  id: string;
  user_id: string;
  integration_type: 'blogger' | 'soloboss';
  error_type: IntegrationErrorType;
  severity: ErrorSeverity;
  message: string;
  details: Record<string, any>;
  context: Record<string, any>;
  stack_trace?: string;
  recovery_actions: RecoveryAction[];
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  resolved: boolean;
  resolved_at?: Date;
  resolution_method?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ErrorRecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  shouldRetry: boolean;
  retryAfter?: number;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<IntegrationErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageResolutionTime: number;
  topErrorMessages: Array<{ message: string; count: number }>;
}

export class IntegrationErrorService {
  private static instance: IntegrationErrorService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): IntegrationErrorService {
    if (!IntegrationErrorService.instance) {
      IntegrationErrorService.instance = new IntegrationErrorService();
    }
    return IntegrationErrorService.instance;
  }

  /**
   * Log an integration error with context and recovery options
   */
  async logError(
    userId: string,
    integrationType: 'blogger' | 'soloboss',
    errorType: IntegrationErrorType,
    error: Error | string,
    context: Record<string, any> = {},
    customRecoveryActions?: RecoveryAction[]
  ): Promise<string> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const stackTrace = typeof error === 'object' ? error.stack : undefined;
      
      const severity = this.determineSeverity(errorType, context);
      const recoveryActions = customRecoveryActions || this.getDefaultRecoveryActions(errorType, severity);
      const maxRetries = this.getMaxRetries(errorType, severity);

      const query = `
        INSERT INTO integration_errors (
          user_id, integration_type, error_type, severity, message, details, 
          context, stack_trace, recovery_actions, retry_count, max_retries, 
          next_retry_at, resolved
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const nextRetryAt = this.calculateNextRetry(0, errorType);
      
      const values = [
        userId,
        integrationType,
        errorType,
        severity,
        errorMessage,
        JSON.stringify(context),
        JSON.stringify(context),
        stackTrace,
        recoveryActions,
        0,
        maxRetries,
        nextRetryAt,
        false
      ];

      const result = await db.query(query, values);
      const errorId = result.rows[0].id;

      // Log to application logger
      loggerService.error(`Integration error logged: ${errorType}`, error as Error, {
        userId,
        integrationType,
        errorId,
        severity,
        context
      });

      // Send notifications for high severity errors
      if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
        await this.notifyUser(userId, errorId, errorType, errorMessage, severity);
      }

      return errorId;

    } catch (logError) {
      loggerService.error('Failed to log integration error', logError as Error, {
        userId,
        integrationType,
        originalError: typeof error === 'string' ? error : error.message
      });
      throw logError;
    }
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(errorId: string): Promise<ErrorRecoveryResult> {
    try {
      const error = await this.getError(errorId);
      if (!error) {
        return {
          success: false,
          action: RecoveryAction.SKIP,
          message: 'Error not found',
          shouldRetry: false
        };
      }

      if (error.resolved) {
        return {
          success: true,
          action: RecoveryAction.SKIP,
          message: 'Error already resolved',
          shouldRetry: false
        };
      }

      // Check if we've exceeded max retries
      if (error.retry_count >= error.max_retries) {
        await this.markAsResolved(errorId, 'max_retries_exceeded');
        return {
          success: false,
          action: RecoveryAction.NOTIFY_USER,
          message: 'Maximum retry attempts exceeded',
          shouldRetry: false
        };
      }

      // Try each recovery action in order
      for (const action of error.recovery_actions) {
        const result = await this.executeRecoveryAction(error, action);
        
        if (result.success) {
          await this.markAsResolved(errorId, `recovered_via_${action}`);
          return result;
        }
      }

      // If all recovery actions failed, increment retry count
      await this.incrementRetryCount(errorId);
      
      return {
        success: false,
        action: RecoveryAction.RETRY,
        message: 'All recovery actions failed, will retry later',
        shouldRetry: true,
        retryAfter: this.calculateRetryDelay(error.retry_count + 1, error.error_type)
      };

    } catch (recoveryError) {
      loggerService.error('Error recovery attempt failed', recoveryError as Error, { errorId });
      return {
        success: false,
        action: RecoveryAction.NOTIFY_USER,
        message: 'Recovery attempt failed',
        shouldRetry: false
      };
    }
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(error: IntegrationError, action: RecoveryAction): Promise<ErrorRecoveryResult> {
    switch (action) {
      case RecoveryAction.RETRY:
        return await this.retryOriginalOperation(error);
      
      case RecoveryAction.FALLBACK_TEMPLATE:
        return await this.useFallbackTemplate(error);
      
      case RecoveryAction.SKIP:
        return {
          success: true,
          action,
          message: 'Operation skipped',
          shouldRetry: false
        };
      
      case RecoveryAction.MANUAL_REVIEW:
        await this.flagForManualReview(error);
        return {
          success: true,
          action,
          message: 'Flagged for manual review',
          shouldRetry: false
        };
      
      case RecoveryAction.NOTIFY_USER:
        await this.notifyUser(error.user_id, error.id, error.error_type, error.message, error.severity);
        return {
          success: true,
          action,
          message: 'User notified',
          shouldRetry: false
        };
      
      case RecoveryAction.DISABLE_INTEGRATION:
        await this.disableIntegration(error.user_id, error.integration_type);
        return {
          success: true,
          action,
          message: 'Integration disabled',
          shouldRetry: false
        };
      
      default:
        return {
          success: false,
          action,
          message: 'Unknown recovery action',
          shouldRetry: false
        };
    }
  }

  /**
   * Get errors for a user with filtering options
   */
  async getUserErrors(
    userId: string,
    options: {
      integrationType?: 'blogger' | 'soloboss';
      errorType?: IntegrationErrorType;
      severity?: ErrorSeverity;
      resolved?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<IntegrationError[]> {
    let query = 'SELECT * FROM integration_errors WHERE user_id = $1';
    const values: any[] = [userId];
    let paramCount = 2;

    if (options.integrationType) {
      query += ` AND integration_type = $${paramCount}`;
      values.push(options.integrationType);
      paramCount++;
    }

    if (options.errorType) {
      query += ` AND error_type = $${paramCount}`;
      values.push(options.errorType);
      paramCount++;
    }

    if (options.severity) {
      query += ` AND severity = $${paramCount}`;
      values.push(options.severity);
      paramCount++;
    }

    if (options.resolved !== undefined) {
      query += ` AND resolved = $${paramCount}`;
      values.push(options.resolved);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(options.limit);
      paramCount++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramCount}`;
      values.push(options.offset);
    }

    const result = await db.query(query, values);
    return result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context
    }));
  }

  /**
   * Get error analytics for a user
   */
  async getErrorAnalytics(userId: string, days: number = 30): Promise<ErrorAnalytics> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const query = `
      SELECT 
        COUNT(*) as total_errors,
        error_type,
        severity,
        message,
        resolved,
        created_at,
        resolved_at
      FROM integration_errors 
      WHERE user_id = $1 AND created_at >= $2
    `;

    const result = await db.query(query, [userId, since]);
    const errors = result.rows;

    const analytics: ErrorAnalytics = {
      totalErrors: errors.length,
      errorsByType: {} as Record<IntegrationErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      averageResolutionTime: 0,
      topErrorMessages: []
    };

    // Count by type and severity
    const messageCounts: Record<string, number> = {};
    let resolvedCount = 0;
    let totalResolutionTime = 0;

    for (const error of errors) {
      // Count by type
      analytics.errorsByType[error.error_type] = (analytics.errorsByType[error.error_type] || 0) + 1;
      
      // Count by severity
      analytics.errorsBySeverity[error.severity] = (analytics.errorsBySeverity[error.severity] || 0) + 1;
      
      // Count messages
      messageCounts[error.message] = (messageCounts[error.message] || 0) + 1;
      
      // Calculate resolution metrics
      if (error.resolved && error.resolved_at) {
        resolvedCount++;
        const resolutionTime = new Date(error.resolved_at).getTime() - new Date(error.created_at).getTime();
        totalResolutionTime += resolutionTime;
      }
    }

    // Calculate recovery success rate
    analytics.recoverySuccessRate = errors.length > 0 ? (resolvedCount / errors.length) * 100 : 0;

    // Calculate average resolution time (in minutes)
    analytics.averageResolutionTime = resolvedCount > 0 ? (totalResolutionTime / resolvedCount) / (1000 * 60) : 0;

    // Get top error messages
    analytics.topErrorMessages = Object.entries(messageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    return analytics;
  }

  /**
   * Process pending error recoveries
   */
  async processPendingRecoveries(): Promise<void> {
    const query = `
      SELECT id FROM integration_errors 
      WHERE resolved = false 
        AND retry_count < max_retries 
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT 50
    `;

    const result = await db.query(query);
    const errorIds = result.rows.map(row => row.id);

    for (const errorId of errorIds) {
      try {
        await this.attemptRecovery(errorId);
      } catch (error) {
        loggerService.error('Failed to process error recovery', error as Error, { errorId });
      }
    }
  }

  // Private helper methods
  private async getError(errorId: string): Promise<IntegrationError | null> {
    const query = 'SELECT * FROM integration_errors WHERE id = $1';
    const result = await db.query(query, [errorId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context
    };
  }

  private async markAsResolved(errorId: string, resolutionMethod: string): Promise<void> {
    const query = `
      UPDATE integration_errors 
      SET resolved = true, resolved_at = NOW(), resolution_method = $2, updated_at = NOW()
      WHERE id = $1
    `;
    await db.query(query, [errorId, resolutionMethod]);
  }

  private async incrementRetryCount(errorId: string): Promise<void> {
    const query = `
      UPDATE integration_errors 
      SET retry_count = retry_count + 1, 
          next_retry_at = $2,
          updated_at = NOW()
      WHERE id = $1
    `;
    
    const error = await this.getError(errorId);
    const nextRetry = error ? this.calculateNextRetry(error.retry_count + 1, error.error_type) : null;
    
    await db.query(query, [errorId, nextRetry]);
  }

  private determineSeverity(errorType: IntegrationErrorType, context: Record<string, any>): ErrorSeverity {
    // Critical errors that break core functionality
    if ([
      IntegrationErrorType.AUTHENTICATION,
      IntegrationErrorType.API_CONNECTION
    ].includes(errorType)) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors that affect user experience
    if ([
      IntegrationErrorType.WEBHOOK_VALIDATION,
      IntegrationErrorType.PLATFORM_PUBLISHING
    ].includes(errorType)) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors that can be recovered
    if ([
      IntegrationErrorType.CONTENT_PROCESSING,
      IntegrationErrorType.TEMPLATE_RENDERING,
      IntegrationErrorType.DATA_TRANSFORMATION
    ].includes(errorType)) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    return ErrorSeverity.LOW;
  }

  private getDefaultRecoveryActions(errorType: IntegrationErrorType, severity: ErrorSeverity): RecoveryAction[] {
    switch (errorType) {
      case IntegrationErrorType.WEBHOOK_VALIDATION:
        return [RecoveryAction.RETRY, RecoveryAction.NOTIFY_USER];
      
      case IntegrationErrorType.CONTENT_PROCESSING:
        return [RecoveryAction.FALLBACK_TEMPLATE, RecoveryAction.MANUAL_REVIEW];
      
      case IntegrationErrorType.TEMPLATE_RENDERING:
        return [RecoveryAction.FALLBACK_TEMPLATE, RecoveryAction.RETRY];
      
      case IntegrationErrorType.PLATFORM_PUBLISHING:
        return [RecoveryAction.RETRY, RecoveryAction.MANUAL_REVIEW];
      
      case IntegrationErrorType.API_CONNECTION:
        return [RecoveryAction.RETRY, RecoveryAction.NOTIFY_USER];
      
      case IntegrationErrorType.RATE_LIMIT:
        return [RecoveryAction.RETRY];
      
      case IntegrationErrorType.MALFORMED_DATA:
        return [RecoveryAction.SKIP, RecoveryAction.MANUAL_REVIEW];
      
      default:
        return [RecoveryAction.RETRY, RecoveryAction.NOTIFY_USER];
    }
  }

  private getMaxRetries(errorType: IntegrationErrorType, severity: ErrorSeverity): number {
    if (severity === ErrorSeverity.CRITICAL) return 5;
    if (severity === ErrorSeverity.HIGH) return 3;
    if (errorType === IntegrationErrorType.RATE_LIMIT) return 10;
    return 3;
  }

  private calculateNextRetry(retryCount: number, errorType: IntegrationErrorType): Date | null {
    if (errorType === IntegrationErrorType.RATE_LIMIT) {
      // Exponential backoff for rate limits
      const delayMinutes = Math.min(Math.pow(2, retryCount) * 5, 60); // Max 1 hour
      return new Date(Date.now() + delayMinutes * 60 * 1000);
    }

    // Standard exponential backoff
    const delayMinutes = Math.min(Math.pow(2, retryCount), 30); // Max 30 minutes
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  private calculateRetryDelay(retryCount: number, errorType: IntegrationErrorType): number {
    const nextRetry = this.calculateNextRetry(retryCount, errorType);
    return nextRetry ? nextRetry.getTime() - Date.now() : 0;
  }

  private async retryOriginalOperation(error: IntegrationError): Promise<ErrorRecoveryResult> {
    // This would implement the actual retry logic based on the error context
    // For now, we'll simulate a retry
    return {
      success: Math.random() > 0.5, // 50% success rate for simulation
      action: RecoveryAction.RETRY,
      message: 'Retry attempted',
      shouldRetry: false
    };
  }

  private async useFallbackTemplate(error: IntegrationError): Promise<ErrorRecoveryResult> {
    // This would implement fallback template logic
    return {
      success: true,
      action: RecoveryAction.FALLBACK_TEMPLATE,
      message: 'Fallback template used',
      shouldRetry: false
    };
  }

  private async flagForManualReview(error: IntegrationError): Promise<void> {
    // Add to manual review queue
    const query = `
      INSERT INTO manual_review_queue (error_id, user_id, integration_type, priority, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (error_id) DO NOTHING
    `;
    
    const priority = error.severity === ErrorSeverity.CRITICAL ? 1 : 
                    error.severity === ErrorSeverity.HIGH ? 2 : 3;
    
    await db.query(query, [error.id, error.user_id, error.integration_type, priority]);
  }

  private async notifyUser(
    userId: string, 
    errorId: string, 
    errorType: IntegrationErrorType, 
    message: string, 
    severity: ErrorSeverity
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification(userId, {
        type: 'integration_error',
        title: `Integration Error: ${errorType}`,
        message: `${message} (Error ID: ${errorId})`,
        severity: severity,
        metadata: { errorId, errorType }
      });
    } catch (notificationError) {
      loggerService.error('Failed to send error notification', notificationError as Error, {
        userId,
        errorId,
        errorType
      });
    }
  }

  private async disableIntegration(userId: string, integrationType: 'blogger' | 'soloboss'): Promise<void> {
    if (integrationType === 'blogger') {
      const query = 'UPDATE blogger_integrations SET enabled = false WHERE user_id = $1';
      await db.query(query, [userId]);
    } else if (integrationType === 'soloboss') {
      const query = 'UPDATE soloboss_integrations SET is_active = false WHERE user_id = $1';
      await db.query(query, [userId]);
    }
  }
}
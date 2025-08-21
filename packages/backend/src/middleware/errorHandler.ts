import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';
import { loggerService } from '../services/LoggerService';
import { NotificationService } from '../services/NotificationService';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
    retryAfter?: number;
  };
  requestId?: string;
  timestamp: string;
}

export class ErrorHandlerMiddleware {
  /**
   * Global error handling middleware
   */
  static handle(err: Error, req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(err);
    }

    let appError: AppError;

    // Convert known errors to AppError
    if (err instanceof AppError) {
      appError = err;
    } else {
      // Handle specific error types
      appError = ErrorHandlerMiddleware.convertToAppError(err);
    }

    // Add request context to error
    appError.context.requestId = requestId;
    appError.context.method = req.method;
    appError.context.url = req.url;
    appError.context.userAgent = req.headers['user-agent'];
    appError.context.ip = req.ip;

    // Log the error
    loggerService.error(
      `Request failed: ${appError.message}`,
      appError,
      appError.context
    );

    // Send notification for critical errors
    if (appError.severity === ErrorSeverity.CRITICAL) {
      NotificationService.sendErrorNotification(appError).catch(notificationError => {
        loggerService.error(
          'Failed to send error notification',
          notificationError,
          { originalError: appError.code }
        );
      });
    }

    // Prepare error response
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: appError.code,
        message: ErrorHandlerMiddleware.getPublicErrorMessage(appError),
        retryable: appError.retryable,
        retryAfter: ErrorHandlerMiddleware.getRetryAfter(appError),
      },
      requestId,
      timestamp: new Date().toISOString(),
    };

    // Add details for development environment
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.details = {
        stack: appError.stack,
        context: appError.context,
      };
    }

    // Send error response
    res.status(appError.statusCode).json(errorResponse);
  }

  /**
   * Convert unknown errors to AppError
   */
  private static convertToAppError(err: Error): AppError {
    // Database errors
    if (err.message.includes('database') || err.message.includes('connection')) {
      return new AppError(
        'Database operation failed',
        ErrorCode.DATABASE_ERROR,
        500,
        ErrorSeverity.HIGH,
        true,
        { originalError: err }
      );
    }

    // Network errors
    if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      return new AppError(
        'Network connection failed',
        ErrorCode.NETWORK_ERROR,
        503,
        ErrorSeverity.MEDIUM,
        true,
        { originalError: err }
      );
    }

    // Validation errors
    if (err.name === 'ValidationError' || err.message.includes('validation')) {
      return new AppError(
        err.message,
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.LOW,
        false,
        { originalError: err }
      );
    }

    // Default to internal server error
    return new AppError(
      'An unexpected error occurred',
      ErrorCode.INTERNAL_SERVER_ERROR,
      500,
      ErrorSeverity.HIGH,
      false,
      { originalError: err }
    );
  }

  /**
   * Get user-friendly error message
   */
  private static getPublicErrorMessage(error: AppError): string {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      switch (error.code) {
        case ErrorCode.UNAUTHORIZED:
          return 'Authentication required';
        case ErrorCode.FORBIDDEN:
          return 'Access denied';
        case ErrorCode.VALIDATION_ERROR:
          return error.message; // Validation messages are safe to expose
        case ErrorCode.POST_NOT_FOUND:
          return 'Post not found';
        case ErrorCode.PLATFORM_RATE_LIMIT:
          return 'Rate limit exceeded. Please try again later.';
        case ErrorCode.PLATFORM_SERVICE_UNAVAILABLE:
          return 'Social media platform is temporarily unavailable';
        case ErrorCode.DATABASE_ERROR:
          return 'Database operation failed. Please try again.';
        case ErrorCode.NETWORK_ERROR:
          return 'Network connection failed. Please check your connection.';
        default:
          return 'An error occurred. Please try again.';
      }
    }

    return error.message;
  }

  /**
   * Get retry-after header value in seconds
   */
  private static getRetryAfter(error: AppError): number | undefined {
    switch (error.code) {
      case ErrorCode.PLATFORM_RATE_LIMIT:
        return 300; // 5 minutes
      case ErrorCode.PLATFORM_SERVICE_UNAVAILABLE:
        return 600; // 10 minutes
      case ErrorCode.DATABASE_ERROR:
        return 60; // 1 minute
      case ErrorCode.NETWORK_ERROR:
        return 30; // 30 seconds
      default:
        return error.retryable ? 60 : undefined;
    }
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    ErrorCode.VALIDATION_ERROR,
    404,
    ErrorSeverity.LOW,
    false,
    {
      method: req.method,
      path: req.path,
    }
  );

  next(error);
};

/**
 * Request ID middleware
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};
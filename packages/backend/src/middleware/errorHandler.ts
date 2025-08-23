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
    guidance?: string[];
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
        guidance: ErrorHandlerMiddleware.getActionableGuidance(appError),
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
   * Get user-friendly error message with actionable guidance
   */
  private static getPublicErrorMessage(error: AppError): string {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      switch (error.code) {
        case ErrorCode.UNAUTHORIZED:
          return 'Authentication required. Please log in to continue.';
        case ErrorCode.FORBIDDEN:
          return 'Access denied. You don\'t have permission to perform this action.';
        case ErrorCode.TOKEN_EXPIRED:
          return 'Your session has expired. Please log in again.';
        case ErrorCode.INVALID_CREDENTIALS:
          return 'Invalid email or password. Please check your credentials and try again.';
        case ErrorCode.VALIDATION_ERROR:
          return error.message; // Validation messages are safe to expose
        case ErrorCode.INVALID_INPUT:
          return 'Invalid input provided. Please check your data and try again.';
        case ErrorCode.MISSING_REQUIRED_FIELD:
          return 'Required information is missing. Please fill in all required fields.';
        case ErrorCode.POST_NOT_FOUND:
          return 'The requested post could not be found. It may have been deleted or moved.';
        case ErrorCode.POST_ALREADY_PUBLISHED:
          return 'This post has already been published and cannot be modified.';
        case ErrorCode.POST_SCHEDULING_FAILED:
          return 'Failed to schedule the post. Please check your settings and try again.';
        case ErrorCode.POST_PUBLISHING_FAILED:
          return 'Failed to publish the post. Please check your platform connections and try again.';
        case ErrorCode.PLATFORM_RATE_LIMIT:
          return 'Rate limit exceeded for this platform. Please wait a few minutes before trying again.';
        case ErrorCode.PLATFORM_AUTHENTICATION_FAILED:
          return 'Platform authentication failed. Please reconnect your account in settings.';
        case ErrorCode.PLATFORM_CONTENT_REJECTED:
          return 'Content was rejected by the platform. Please review platform guidelines and modify your content.';
        case ErrorCode.PLATFORM_SERVICE_UNAVAILABLE:
          return 'The social media platform is temporarily unavailable. Please try again later.';
        case ErrorCode.BLOGGER_CONNECTION_FAILED:
          return 'Failed to connect to Blogger. Please check your blog URL and try again.';
        case ErrorCode.SOLOBOSS_CONNECTION_FAILED:
          return 'Failed to connect to SoloBoss. Please check your API credentials in settings.';
        case ErrorCode.OAUTH_FLOW_FAILED:
          return 'Authentication with the platform failed. Please try connecting your account again.';
        case ErrorCode.DATABASE_ERROR:
          return 'A database error occurred. Please try again in a few moments.';
        case ErrorCode.REDIS_ERROR:
          return 'A caching error occurred. The system may be slower than usual.';
        case ErrorCode.NETWORK_ERROR:
          return 'Network connection failed. Please check your internet connection and try again.';
        case ErrorCode.SERVICE_UNAVAILABLE:
          return 'The service is temporarily unavailable. Please try again later.';
        case ErrorCode.FILE_UPLOAD_FAILED:
          return 'File upload failed. Please check your file and try again.';
        case ErrorCode.FILE_TOO_LARGE:
          return 'File is too large. Please choose a smaller file and try again.';
        case ErrorCode.INVALID_FILE_TYPE:
          return 'Invalid file type. Please upload a supported file format.';
        default:
          return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
      }
    }

    return error.message;
  }

  /**
   * Get actionable guidance for error resolution
   */
  private static getActionableGuidance(error: AppError): string[] {
    const guidance: string[] = [];

    switch (error.code) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
        guidance.push('Log in to your account');
        guidance.push('If you just logged in, try refreshing the page');
        break;

      case ErrorCode.FORBIDDEN:
        guidance.push('Contact your administrator for access');
        guidance.push('Check if your account has the necessary permissions');
        break;

      case ErrorCode.INVALID_CREDENTIALS:
        guidance.push('Double-check your email and password');
        guidance.push('Use the "Forgot Password" link if needed');
        guidance.push('Ensure Caps Lock is not enabled');
        break;

      case ErrorCode.PLATFORM_AUTHENTICATION_FAILED:
        guidance.push('Go to Settings > Platform Connections');
        guidance.push('Disconnect and reconnect your account');
        guidance.push('Ensure you have the necessary permissions on the platform');
        break;

      case ErrorCode.PLATFORM_RATE_LIMIT:
        guidance.push('Wait for the rate limit to reset (usually 15-60 minutes)');
        guidance.push('Reduce the frequency of your posts');
        guidance.push('Consider upgrading your platform account for higher limits');
        break;

      case ErrorCode.PLATFORM_CONTENT_REJECTED:
        guidance.push('Review the platform\'s community guidelines');
        guidance.push('Remove any potentially sensitive content');
        guidance.push('Check for prohibited keywords or phrases');
        guidance.push('Ensure images meet platform requirements');
        break;

      case ErrorCode.POST_SCHEDULING_FAILED:
        guidance.push('Check that the scheduled time is in the future');
        guidance.push('Verify your platform connections are active');
        guidance.push('Ensure you have posting permissions');
        break;

      case ErrorCode.BLOGGER_CONNECTION_FAILED:
        guidance.push('Verify your blog URL is correct and accessible');
        guidance.push('Check that your blog is public or you have access');
        guidance.push('Try reconnecting your Blogger account');
        break;

      case ErrorCode.SOLOBOSS_CONNECTION_FAILED:
        guidance.push('Verify your SoloBoss API key in Settings');
        guidance.push('Check that your SoloBoss account is active');
        guidance.push('Contact SoloBoss support if the issue persists');
        break;

      case ErrorCode.FILE_TOO_LARGE:
        guidance.push('Compress your image using an online tool');
        guidance.push('Choose a different image with smaller file size');
        guidance.push('Maximum file size is typically 10MB');
        break;

      case ErrorCode.INVALID_FILE_TYPE:
        guidance.push('Use supported formats: JPG, PNG, GIF, MP4');
        guidance.push('Convert your file to a supported format');
        guidance.push('Check the file extension is correct');
        break;

      case ErrorCode.NETWORK_ERROR:
        guidance.push('Check your internet connection');
        guidance.push('Try refreshing the page');
        guidance.push('Disable VPN if you\'re using one');
        guidance.push('Try again in a few minutes');
        break;

      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.SERVICE_UNAVAILABLE:
        guidance.push('Try again in a few minutes');
        guidance.push('Check our status page for known issues');
        guidance.push('Contact support if the problem persists');
        break;

      default:
        guidance.push('Try refreshing the page');
        guidance.push('Clear your browser cache and cookies');
        guidance.push('Try using a different browser');
        guidance.push('Contact support if the problem continues');
        break;
    }

    return guidance;
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
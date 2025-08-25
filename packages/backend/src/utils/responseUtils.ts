import { Response } from 'express';
import { 
  ApiResponse, 
  ApiError, 
  PaginatedResponse, 
  ErrorCode, 
  ERROR_STATUS_CODES, 
  ERROR_MESSAGES, 
  ERROR_DOCUMENTATION,
  RateLimitInfo,
  ValidationErrorDetail
} from '../types/apiResponses';
import { loggerService } from '../services/LoggerService';

/**
 * Utility class for creating consistent API responses
 */
export class ResponseUtils {
  private static readonly API_VERSION = '1.0.0';
  private static readonly SUPPORT_EMAIL = 'support@sma-platform.com';
  private static readonly BASE_DOCS_URL = process.env.NODE_ENV === 'production' 
    ? 'https://docs.sma-platform.com' 
    : 'http://localhost:3001/docs';

  /**
   * Send a successful response
   */
  static success<T>(
    res: Response, 
    data: T, 
    statusCode: number = 200,
    meta?: Record<string, any>
  ): void {
    const requestId = res.locals.requestId || this.generateRequestId();
    const responseTime = res.locals.startTime ? Date.now() - res.locals.startTime : undefined;

    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
        responseTime,
        ...meta
      }
    };

    // Add response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-API-Version', this.API_VERSION);
    res.setHeader('X-Response-Time', responseTime?.toString() || '0');

    res.status(statusCode).json(response);

    // Log successful response
    loggerService.info('API Response', {
      requestId,
      statusCode,
      responseTime,
      endpoint: res.req.path,
      method: res.req.method
    });
  }

  /**
   * Send a paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
    },
    statusCode: number = 200
  ): void {
    const requestId = res.locals.requestId || this.generateRequestId();
    const responseTime = res.locals.startTime ? Date.now() - res.locals.startTime : undefined;

    const totalPages = Math.ceil(pagination.totalCount / pagination.limit);
    const hasNext = pagination.page < totalPages;
    const hasPrevious = pagination.page > 1;

    const response: PaginatedResponse<T> = {
      success: true,
      data,
      pagination: {
        ...pagination,
        totalPages,
        hasNext,
        hasPrevious
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
        responseTime
      }
    };

    // Add pagination headers
    res.setHeader('X-Total-Count', pagination.totalCount.toString());
    res.setHeader('X-Page', pagination.page.toString());
    res.setHeader('X-Per-Page', pagination.limit.toString());
    res.setHeader('X-Total-Pages', totalPages.toString());

    if (hasNext) {
      res.setHeader('X-Next-Page', (pagination.page + 1).toString());
    }
    if (hasPrevious) {
      res.setHeader('X-Previous-Page', (pagination.page - 1).toString());
    }

    this.success(res, response, statusCode);
  }

  /**
   * Send an error response
   */
  static error(
    res: Response,
    errorCode: ErrorCode,
    customMessage?: string,
    details?: Record<string, any>,
    field?: string
  ): void {
    const requestId = res.locals.requestId || this.generateRequestId();
    const responseTime = res.locals.startTime ? Date.now() - res.locals.startTime : undefined;
    const statusCode = ERROR_STATUS_CODES[errorCode] || 500;

    const error: ApiError = {
      code: errorCode,
      message: customMessage || ERROR_MESSAGES[errorCode] || 'An error occurred',
      details,
      field,
      retryable: this.isRetryable(errorCode),
      retryAfter: this.getRetryAfter(errorCode),
      timestamp: new Date().toISOString(),
      requestId,
      documentation: `${this.BASE_DOCS_URL}${ERROR_DOCUMENTATION[errorCode] || '/docs/errors'}`,
      supportContact: this.SUPPORT_EMAIL
    };

    const response: ApiResponse = {
      success: false,
      error,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
        responseTime
      }
    };

    // Add error headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-API-Version', this.API_VERSION);
    res.setHeader('X-Error-Code', errorCode);

    if (error.retryAfter) {
      res.setHeader('Retry-After', error.retryAfter.toString());
    }

    res.status(statusCode).json(response);

    // Log error response
    loggerService.error('API Error Response', new Error(error.message), {
      requestId,
      errorCode,
      statusCode,
      responseTime,
      endpoint: res.req.path,
      method: res.req.method,
      details
    });
  }

  /**
   * Send a validation error response
   */
  static validationError(
    res: Response,
    validationErrors: ValidationErrorDetail[],
    customMessage?: string
  ): void {
    this.error(
      res,
      ErrorCode.VALIDATION_ERROR,
      customMessage || 'Validation failed',
      { validationErrors }
    );
  }

  /**
   * Send a rate limit error response
   */
  static rateLimitError(
    res: Response,
    rateLimitInfo: RateLimitInfo,
    customMessage?: string
  ): void {
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime);

    if (rateLimitInfo.retryAfter) {
      res.setHeader('Retry-After', rateLimitInfo.retryAfter.toString());
    }

    this.error(
      res,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      customMessage || `Rate limit exceeded. Try again after ${rateLimitInfo.retryAfter || 60} seconds`,
      { rateLimitInfo }
    );
  }

  /**
   * Send a not found error response
   */
  static notFound(
    res: Response,
    resource: string = 'Resource',
    customMessage?: string
  ): void {
    this.error(
      res,
      ErrorCode.RESOURCE_NOT_FOUND,
      customMessage || `${resource} not found`
    );
  }

  /**
   * Send an unauthorized error response
   */
  static unauthorized(
    res: Response,
    customMessage?: string
  ): void {
    this.error(
      res,
      ErrorCode.INVALID_TOKEN,
      customMessage || 'Authentication required'
    );
  }

  /**
   * Send a forbidden error response
   */
  static forbidden(
    res: Response,
    customMessage?: string
  ): void {
    this.error(
      res,
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      customMessage || 'Access denied'
    );
  }

  /**
   * Send an internal server error response
   */
  static internalError(
    res: Response,
    error?: Error,
    customMessage?: string
  ): void {
    // Log the actual error for debugging
    if (error) {
      loggerService.error('Internal Server Error', error, {
        requestId: res.locals.requestId,
        endpoint: res.req.path,
        method: res.req.method
      });
    }

    this.error(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      customMessage || 'An internal server error occurred'
    );
  }

  /**
   * Determine if an error is retryable
   */
  private static isRetryable(errorCode: ErrorCode): boolean {
    const retryableErrors = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.PLATFORM_UNAVAILABLE,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.DATABASE_ERROR
    ];

    return retryableErrors.includes(errorCode);
  }

  /**
   * Get retry after time for retryable errors
   */
  private static getRetryAfter(errorCode: ErrorCode): number | undefined {
    const retryTimes: Partial<Record<ErrorCode, number>> = {
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 60,
      [ErrorCode.SERVICE_UNAVAILABLE]: 300,
      [ErrorCode.PLATFORM_UNAVAILABLE]: 600,
      [ErrorCode.NETWORK_ERROR]: 30,
      [ErrorCode.DATABASE_ERROR]: 60
    };

    return retryTimes[errorCode];
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a middleware to track response time
   */
  static responseTimeMiddleware() {
    return (req: any, res: any, next: any) => {
      res.locals.startTime = Date.now();
      res.locals.requestId = req.headers['x-request-id'] || this.generateRequestId();
      next();
    };
  }

  /**
   * Handle async route errors
   */
  static asyncHandler(fn: Function) {
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Export commonly used response methods
export const {
  success,
  paginated,
  error,
  validationError,
  rateLimitError,
  notFound,
  unauthorized,
  forbidden,
  internalError,
  responseTimeMiddleware,
  asyncHandler
} = ResponseUtils;
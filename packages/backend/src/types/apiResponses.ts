/**
 * Standardized API Response Types for Enhanced Developer Experience
 */

export enum ErrorCode {
  // Authentication & Authorization
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',
  
  // Resource Management
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // External Services
  PLATFORM_API_ERROR = 'PLATFORM_API_ERROR',
  PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE',
  OAUTH_ERROR = 'OAUTH_ERROR',
  WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',
  
  // System Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Business Logic
  POST_SCHEDULING_FAILED = 'POST_SCHEDULING_FAILED',
  PLATFORM_CONNECTION_FAILED = 'PLATFORM_CONNECTION_FAILED',
  CONTENT_PROCESSING_FAILED = 'CONTENT_PROCESSING_FAILED'
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  field?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  timestamp: string;
  requestId: string;
  documentation?: string;
  supportContact?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
    responseTime?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: string;
  retryAfter?: number;
}

// HTTP Status Code mappings for consistent responses
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.VALUE_OUT_OF_RANGE]: 400,
  [ErrorCode.WEBHOOK_VALIDATION_FAILED]: 400,
  
  // 401 Unauthorized
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.OAUTH_ERROR]: 401,
  
  // 403 Forbidden
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.ACCOUNT_LOCKED]: 403,
  
  // 404 Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  
  // 409 Conflict
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 409,
  
  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  
  // 422 Unprocessable Entity
  [ErrorCode.POST_SCHEDULING_FAILED]: 422,
  [ErrorCode.PLATFORM_CONNECTION_FAILED]: 422,
  [ErrorCode.CONTENT_PROCESSING_FAILED]: 422,
  
  // 500 Internal Server Error
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  
  // 502 Bad Gateway
  [ErrorCode.PLATFORM_API_ERROR]: 502,
  [ErrorCode.NETWORK_ERROR]: 502,
  
  // 503 Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.PLATFORM_UNAVAILABLE]: 503
};

// User-friendly error messages
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_TOKEN]: 'Authentication token is invalid or malformed',
  [ErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
  [ErrorCode.ACCOUNT_LOCKED]: 'Account has been temporarily locked due to security concerns',
  
  [ErrorCode.VALIDATION_ERROR]: 'The provided data is invalid',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'A required field is missing',
  [ErrorCode.INVALID_FORMAT]: 'The data format is invalid',
  [ErrorCode.VALUE_OUT_OF_RANGE]: 'The provided value is outside the acceptable range',
  
  [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'A resource with this identifier already exists',
  [ErrorCode.RESOURCE_CONFLICT]: 'The request conflicts with the current state of the resource',
  [ErrorCode.RESOURCE_LOCKED]: 'The resource is currently locked and cannot be modified',
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down and try again later',
  [ErrorCode.QUOTA_EXCEEDED]: 'Your usage quota has been exceeded',
  
  [ErrorCode.PLATFORM_API_ERROR]: 'An error occurred while communicating with the social media platform',
  [ErrorCode.PLATFORM_UNAVAILABLE]: 'The social media platform is currently unavailable',
  [ErrorCode.OAUTH_ERROR]: 'OAuth authentication failed',
  [ErrorCode.WEBHOOK_VALIDATION_FAILED]: 'Webhook signature validation failed',
  
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'An internal server error occurred',
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred',
  [ErrorCode.NETWORK_ERROR]: 'A network error occurred',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable',
  
  [ErrorCode.POST_SCHEDULING_FAILED]: 'Failed to schedule the post',
  [ErrorCode.PLATFORM_CONNECTION_FAILED]: 'Failed to connect to the social media platform',
  [ErrorCode.CONTENT_PROCESSING_FAILED]: 'Failed to process the content'
};

// Documentation links for error codes
export const ERROR_DOCUMENTATION: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_TOKEN]: '/docs/authentication#invalid-token',
  [ErrorCode.TOKEN_EXPIRED]: '/docs/authentication#token-expiration',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '/docs/authentication#permissions',
  [ErrorCode.ACCOUNT_LOCKED]: '/docs/security#account-lockout',
  
  [ErrorCode.VALIDATION_ERROR]: '/docs/validation#common-errors',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '/docs/validation#required-fields',
  [ErrorCode.INVALID_FORMAT]: '/docs/validation#data-formats',
  [ErrorCode.VALUE_OUT_OF_RANGE]: '/docs/validation#value-ranges',
  
  [ErrorCode.RESOURCE_NOT_FOUND]: '/docs/resources#not-found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: '/docs/resources#conflicts',
  [ErrorCode.RESOURCE_CONFLICT]: '/docs/resources#conflicts',
  [ErrorCode.RESOURCE_LOCKED]: '/docs/resources#locking',
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '/docs/rate-limiting#limits',
  [ErrorCode.QUOTA_EXCEEDED]: '/docs/rate-limiting#quotas',
  
  [ErrorCode.PLATFORM_API_ERROR]: '/docs/platforms#api-errors',
  [ErrorCode.PLATFORM_UNAVAILABLE]: '/docs/platforms#availability',
  [ErrorCode.OAUTH_ERROR]: '/docs/oauth#troubleshooting',
  [ErrorCode.WEBHOOK_VALIDATION_FAILED]: '/docs/webhooks#validation',
  
  [ErrorCode.INTERNAL_SERVER_ERROR]: '/docs/errors#server-errors',
  [ErrorCode.DATABASE_ERROR]: '/docs/errors#database-errors',
  [ErrorCode.NETWORK_ERROR]: '/docs/errors#network-errors',
  [ErrorCode.SERVICE_UNAVAILABLE]: '/docs/errors#service-unavailable',
  
  [ErrorCode.POST_SCHEDULING_FAILED]: '/docs/posts#scheduling-errors',
  [ErrorCode.PLATFORM_CONNECTION_FAILED]: '/docs/platforms#connection-errors',
  [ErrorCode.CONTENT_PROCESSING_FAILED]: '/docs/content#processing-errors'
};
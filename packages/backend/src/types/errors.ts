export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Platform errors
  PLATFORM_API_ERROR = 'PLATFORM_API_ERROR',
  PLATFORM_RATE_LIMIT = 'PLATFORM_RATE_LIMIT',
  PLATFORM_AUTHENTICATION_FAILED = 'PLATFORM_AUTHENTICATION_FAILED',
  PLATFORM_CONTENT_REJECTED = 'PLATFORM_CONTENT_REJECTED',
  PLATFORM_SERVICE_UNAVAILABLE = 'PLATFORM_SERVICE_UNAVAILABLE',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Post errors
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  POST_ALREADY_PUBLISHED = 'POST_ALREADY_PUBLISHED',
  POST_SCHEDULING_FAILED = 'POST_SCHEDULING_FAILED',
  POST_PUBLISHING_FAILED = 'POST_PUBLISHING_FAILED',

  // Integration errors
  BLOGGER_CONNECTION_FAILED = 'BLOGGER_CONNECTION_FAILED',
  SOLOBOSS_CONNECTION_FAILED = 'SOLOBOSS_CONNECTION_FAILED',
  OAUTH_FLOW_FAILED = 'OAUTH_FLOW_FAILED',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // File errors
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  userId?: string;
  postId?: string;
  platform?: string;
  requestId?: string;
  operation?: string;
  retryCount?: number;
  originalError?: Error;
  [key: string]: any;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: boolean = false,
    context: ErrorContext = {}
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      ErrorSeverity.LOW,
      false,
      context
    );
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCode.UNAUTHORIZED,
      401,
      ErrorSeverity.MEDIUM,
      false,
      context
    );
    this.name = 'AuthenticationError';
  }
}

export class PlatformError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    retryable: boolean = true,
    context: ErrorContext = {}
  ) {
    super(
      message,
      code,
      502,
      ErrorSeverity.HIGH,
      retryable,
      context
    );
    this.name = 'PlatformError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCode.DATABASE_ERROR,
      500,
      ErrorSeverity.HIGH,
      true,
      context
    );
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCode.NETWORK_ERROR,
      503,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
    this.name = 'NetworkError';
  }
}
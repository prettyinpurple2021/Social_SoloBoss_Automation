import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ErrorSeverity, ValidationError, AuthenticationError, PlatformError, DatabaseError, NetworkError } from '../types/errors';
import { ErrorHandlerMiddleware, requestIdMiddleware } from '../middleware/errorHandler';
import { loggerService } from '../services/LoggerService';
import { NotificationService } from '../services/NotificationService';

// Mock dependencies
jest.mock('../services/LoggerService');
jest.mock('../services/NotificationService');

describe('Error Handling System', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      ip: '127.0.0.1',
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      headersSent: false,
    };
    
    mockNext = jest.fn();

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('AppError Class', () => {
    it('should create AppError with all properties', () => {
      const context = { userId: 'user123', operation: 'test' };
      const error = new AppError(
        'Test error',
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.LOW,
        false,
        context
      );

      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual(context);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR);
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'AppError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', ErrorCode.VALIDATION_ERROR);
      expect(json).toHaveProperty('statusCode', 500);
      expect(json).toHaveProperty('severity', ErrorSeverity.MEDIUM);
      expect(json).toHaveProperty('retryable', false);
      expect(json).toHaveProperty('context', {});
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });
  });

  describe('Specialized Error Classes', () => {
    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError('Invalid input');

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.retryable).toBe(false);
    });

    it('should create AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError('Unauthorized');

      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.retryable).toBe(false);
    });

    it('should create PlatformError with correct defaults', () => {
      const error = new PlatformError('Platform failed', ErrorCode.PLATFORM_API_ERROR);

      expect(error.name).toBe('PlatformError');
      expect(error.code).toBe(ErrorCode.PLATFORM_API_ERROR);
      expect(error.statusCode).toBe(502);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(true);
    });

    it('should create DatabaseError with correct defaults', () => {
      const error = new DatabaseError('Database connection failed');

      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(true);
    });

    it('should create NetworkError with correct defaults', () => {
      const error = new NetworkError('Network timeout');

      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.statusCode).toBe(503);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.retryable).toBe(true);
    });
  });

  describe('ErrorHandlerMiddleware', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR, 400);
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Test error',
            retryable: false,
          }),
          timestamp: expect.any(String),
        })
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should convert unknown errors to AppError', () => {
      const error = new Error('Unknown error');
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
          }),
        })
      );
    });

    it('should handle database errors', () => {
      const error = new Error('database connection failed');
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.DATABASE_ERROR,
            retryable: true,
          }),
        })
      );
    });

    it('should handle network errors', () => {
      const error = new Error('ECONNREFUSED');
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.NETWORK_ERROR,
            retryable: true,
          }),
        })
      );
    });

    it('should send notification for critical errors', () => {
      const error = new AppError(
        'Critical error',
        ErrorCode.DATABASE_ERROR,
        500,
        ErrorSeverity.CRITICAL
      );
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(NotificationService.sendErrorNotification).toHaveBeenCalledWith(error);
    });

    it('should not send notification for non-critical errors', () => {
      const error = new AppError(
        'Low severity error',
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.LOW
      );
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(NotificationService.sendErrorNotification).not.toHaveBeenCalled();
    });

    it('should delegate to default handler if response already sent', () => {
      mockResponse.headersSent = true;
      const error = new Error('Test error');
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should include debug details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR);
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.objectContaining({
              stack: expect.any(String),
              context: expect.any(Object),
            }),
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set retry-after header for retryable errors', () => {
      const error = new AppError(
        'Rate limited',
        ErrorCode.PLATFORM_RATE_LIMIT,
        429,
        ErrorSeverity.MEDIUM,
        true
      );
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retryAfter: 300, // 5 minutes for rate limit
          }),
        })
      );
    });
  });

  describe('Request ID Middleware', () => {
    it('should add request ID to headers', () => {
      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.headers!['x-request-id']).toBeDefined();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        mockRequest.headers!['x-request-id']
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing request ID if present', () => {
      const existingId = 'existing-request-id';
      mockRequest.headers!['x-request-id'] = existingId;
      
      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.headers!['x-request-id']).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
    });
  });

  describe('Async Handler Wrapper', () => {
    it('should catch async errors and pass to next', async () => {
      const asyncError = new Error('Async error');
      const asyncHandler = jest.fn().mockRejectedValue(asyncError);
      
      const wrappedHandler = ErrorHandlerMiddleware.asyncHandler(asyncHandler);
      
      await wrappedHandler(mockRequest as any, mockResponse as any, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(asyncError);
    });

    it('should handle successful async operations', async () => {
      const asyncHandler = jest.fn().mockResolvedValue('success');
      
      const wrappedHandler = ErrorHandlerMiddleware.asyncHandler(asyncHandler);
      
      await wrappedHandler(mockRequest as any, mockResponse as any, mockNext);
      
      expect(asyncHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Message Sanitization', () => {
    it('should sanitize error messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new AppError(
        'Internal database connection string: user:pass@host',
        ErrorCode.DATABASE_ERROR
      );
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Database operation failed. Please try again.',
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should preserve validation error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new ValidationError('Email is required');
      
      ErrorHandlerMiddleware.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Email is required',
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});
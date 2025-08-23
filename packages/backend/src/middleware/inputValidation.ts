import { Request, Response, NextFunction } from 'express';
import { loggerService } from '../services/LoggerService';
import { monitoringService } from '../services/MonitoringService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

/**
 * Enhanced input validation and sanitization middleware
 */
export class InputValidationMiddleware {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly MAX_OBJECT_DEPTH = 10;
  private static readonly MAX_KEYS_PER_OBJECT = 100;

  /**
   * SQL injection patterns
   */
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /('|(\\')|(;)|(\\;)|(\|)|(\*)|(%)|(<)|(>)|(\^)|(\[)|(\])|(\{)|(\})|(\()|(\))|(\+)|(=))/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
    /((\%27)|(\'))union/gi
  ];

  /**
   * XSS patterns
   */
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
    /<svg[^>]*onload[^>]*>/gi
  ];

  /**
   * Path traversal patterns
   */
  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi
  ];

  /**
   * Command injection patterns
   */
  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]]/g,
    /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp)\b/gi,
    /\|\s*(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp)/gi
  ];

  /**
   * Validate and sanitize input recursively
   */
  private static sanitizeValue(value: any, depth: number = 0): any {
    // Prevent deep recursion
    if (depth > this.MAX_OBJECT_DEPTH) {
      throw new AppError(
        'Input object depth exceeded maximum allowed',
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.MEDIUM
      );
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      if (value.length > this.MAX_ARRAY_LENGTH) {
        throw new AppError(
          'Array length exceeded maximum allowed',
          ErrorCode.VALIDATION_ERROR,
          400,
          ErrorSeverity.MEDIUM
        );
      }
      return value.map(item => this.sanitizeValue(item, depth + 1));
    }

    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > this.MAX_KEYS_PER_OBJECT) {
        throw new AppError(
          'Object key count exceeded maximum allowed',
          ErrorCode.VALIDATION_ERROR,
          400,
          ErrorSeverity.MEDIUM
        );
      }

      const sanitized: any = {};
      for (const key of keys) {
        const sanitizedKey = this.sanitizeString(key);
        if (sanitizedKey && sanitizedKey.length > 0) {
          sanitized[sanitizedKey] = this.sanitizeValue(value[key], depth + 1);
        }
      }
      return sanitized;
    }

    return value;
  }

  /**
   * Sanitize string input
   */
  private static sanitizeString(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    // Check length
    if (value.length > this.MAX_STRING_LENGTH) {
      throw new AppError(
        'String length exceeded maximum allowed',
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.MEDIUM
      );
    }

    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize Unicode
    sanitized = sanitized.normalize('NFC');

    return sanitized;
  }

  /**
   * Detect malicious patterns in input
   */
  private static detectMaliciousPatterns(input: string): string[] {
    const detectedPatterns: string[] = [];

    // Check for SQL injection
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push('sql_injection');
        break;
      }
    }

    // Check for XSS
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push('xss');
        break;
      }
    }

    // Check for path traversal
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push('path_traversal');
        break;
      }
    }

    // Check for command injection
    for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push('command_injection');
        break;
      }
    }

    return detectedPatterns;
  }

  /**
   * Validate input against malicious patterns
   */
  private static validateInput(req: Request): void {
    const inputData = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params
    });

    const maliciousPatterns = this.detectMaliciousPatterns(inputData);

    if (maliciousPatterns.length > 0) {
      loggerService.warn('Malicious input patterns detected', {
        patterns: maliciousPatterns,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      monitoringService.incrementCounter('malicious_input_attempts_total', 1, {
        patterns: maliciousPatterns.join(','),
        path: req.path
      });

      throw new AppError(
        'Invalid input detected',
        ErrorCode.VALIDATION_ERROR,
        400,
        ErrorSeverity.HIGH,
        false,
        {
          patterns: maliciousPatterns,
          blocked: true
        }
      );
    }
  }

  /**
   * Main input validation middleware
   */
  static validate() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Validate for malicious patterns first
        this.validateInput(req);

        // Sanitize input data
        if (req.body) {
          req.body = this.sanitizeValue(req.body);
        }

        if (req.query) {
          req.query = this.sanitizeValue(req.query);
        }

        if (req.params) {
          req.params = this.sanitizeValue(req.params);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Strict validation for sensitive endpoints
   */
  static strictValidation() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // More aggressive pattern detection for sensitive endpoints
        const inputData = JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers
        });

        const maliciousPatterns = this.detectMaliciousPatterns(inputData);

        if (maliciousPatterns.length > 0) {
          loggerService.error('Malicious input on sensitive endpoint', {
            patterns: maliciousPatterns,
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            userId: req.user?.id
          });

          // Block immediately for sensitive endpoints
          throw new AppError(
            'Access denied',
            ErrorCode.VALIDATION_ERROR,
            403,
            ErrorSeverity.CRITICAL,
            false,
            {
              patterns: maliciousPatterns,
              endpoint: 'sensitive',
              blocked: true
            }
          );
        }

        // Apply regular validation
        this.validate()(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * File upload validation
   */
  static validateFileUpload(allowedTypes: string[] = [], maxSize: number = 10 * 1024 * 1024) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.file && !req.files) {
          return next();
        }

        const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];

        for (const file of files) {
          if (!file) continue;

          // Check file size
          if (file.size > maxSize) {
            throw new AppError(
              `File size exceeds maximum allowed (${maxSize} bytes)`,
              ErrorCode.VALIDATION_ERROR,
              400,
              ErrorSeverity.MEDIUM
            );
          }

          // Check file type
          if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
            throw new AppError(
              `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
              ErrorCode.VALIDATION_ERROR,
              400,
              ErrorSeverity.MEDIUM
            );
          }

          // Check for malicious file names
          const maliciousPatterns = this.detectMaliciousPatterns(file.originalname);
          if (maliciousPatterns.length > 0) {
            throw new AppError(
              'Invalid file name detected',
              ErrorCode.VALIDATION_ERROR,
              400,
              ErrorSeverity.HIGH
            );
          }

          // Validate file extension matches MIME type
          const extension = file.originalname.split('.').pop()?.toLowerCase();
          const expectedExtensions = this.getExpectedExtensions(file.mimetype);
          
          if (extension && expectedExtensions.length > 0 && !expectedExtensions.includes(extension)) {
            loggerService.warn('File extension mismatch with MIME type', {
              filename: file.originalname,
              mimetype: file.mimetype,
              extension,
              expectedExtensions
            });

            throw new AppError(
              'File extension does not match content type',
              ErrorCode.VALIDATION_ERROR,
              400,
              ErrorSeverity.MEDIUM
            );
          }
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Get expected file extensions for MIME type
   */
  private static getExpectedExtensions(mimetype: string): string[] {
    const mimeToExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'image/svg+xml': ['svg'],
      'text/plain': ['txt'],
      'application/pdf': ['pdf'],
      'application/json': ['json'],
      'text/csv': ['csv'],
      'application/zip': ['zip'],
      'application/x-zip-compressed': ['zip']
    };

    return mimeToExtensions[mimetype] || [];
  }
}

// Export middleware functions
export const inputValidation = InputValidationMiddleware.validate();
export const strictInputValidation = InputValidationMiddleware.strictValidation();
export const fileUploadValidation = InputValidationMiddleware.validateFileUpload;
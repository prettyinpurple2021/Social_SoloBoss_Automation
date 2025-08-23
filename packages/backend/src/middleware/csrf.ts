import { Request, Response, NextFunction } from 'express';
import { EncryptionService } from '../services/EncryptionService';
import { loggerService } from '../services/LoggerService';
import { monitoringService } from '../services/MonitoringService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

export interface CSRFOptions {
  headerName: string;
  cookieName: string;
  tokenLength: number;
  skipMethods: string[];
  skipPaths: string[];
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  httpOnly: boolean;
  maxAge: number;
}

export class CSRFProtection {
  private static readonly DEFAULT_OPTIONS: CSRFOptions = {
    headerName: 'X-CSRF-Token',
    cookieName: 'csrf-token',
    tokenLength: 32,
    skipMethods: ['GET', 'HEAD', 'OPTIONS'],
    skipPaths: ['/health', '/api/auth/csrf-token'],
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // Client needs to read this for CSRF token
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  };

  private options: CSRFOptions;

  constructor(options: Partial<CSRFOptions> = {}) {
    this.options = { ...CSRFProtection.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(): string {
    const timestamp = Date.now().toString();
    const randomBytes = EncryptionService.generateSecureRandom(this.options.tokenLength);
    const tokenData = `${timestamp}:${randomBytes}`;
    
    // Create HMAC signature to prevent tampering
    const signature = EncryptionService.createHMAC(tokenData, this.getCSRFSecret());
    
    return `${tokenData}:${signature}`;
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string): boolean {
    try {
      const parts = token.split(':');
      if (parts.length !== 3) {
        return false;
      }

      const [timestamp, randomBytes, signature] = parts;
      const tokenData = `${timestamp}:${randomBytes}`;
      
      // Verify signature
      const expectedSignature = EncryptionService.createHMAC(tokenData, this.getCSRFSecret());
      if (!EncryptionService.verifyHMAC(tokenData, signature, this.getCSRFSecret())) {
        return false;
      }

      // Check if token is not too old (24 hours)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (now - tokenTime > maxAge) {
        return false;
      }

      return true;
    } catch (error) {
      loggerService.warn('CSRF token validation error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get CSRF secret from environment
   */
  private getCSRFSecret(): string {
    const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('CSRF_SECRET or JWT_SECRET environment variable is required');
    }
    return secret;
  }

  /**
   * Check if request should skip CSRF validation
   */
  private shouldSkipCSRF(req: Request): boolean {
    // Skip for certain HTTP methods
    if (this.options.skipMethods.includes(req.method)) {
      return true;
    }

    // Skip for certain paths
    if (this.options.skipPaths.some(path => req.path.startsWith(path))) {
      return true;
    }

    // Skip for API endpoints that use other authentication (like API keys)
    if (req.headers['x-api-key']) {
      return true;
    }

    // Skip for webhook endpoints
    if (req.path.includes('/webhook')) {
      return true;
    }

    return false;
  }

  /**
   * CSRF protection middleware with enhanced security
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip CSRF protection for certain requests
      if (this.shouldSkipCSRF(req)) {
        return next();
      }

      // For state-changing methods, validate CSRF token
      if (!this.options.skipMethods.includes(req.method)) {
        const token = req.headers[this.options.headerName.toLowerCase()] as string ||
                     req.body._csrf ||
                     req.query._csrf as string;

        if (!token) {
          loggerService.warn('CSRF token missing', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer,
            origin: req.headers.origin
          });

          monitoringService.incrementCounter('csrf_violations_total', 1, {
            type: 'missing_token',
            method: req.method,
            path: req.path
          });

          // Log security event for missing CSRF token
          this.logCSRFViolation(req, 'missing_token', 'CSRF token is required');

          const error = new AppError(
            'CSRF token is required',
            ErrorCode.VALIDATION_ERROR,
            403,
            ErrorSeverity.MEDIUM,
            false,
            {
              type: 'csrf_missing',
              method: req.method,
              path: req.path
            }
          );

          return next(error);
        }

        if (!this.validateToken(token)) {
          loggerService.warn('Invalid CSRF token', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer,
            origin: req.headers.origin,
            token: token.substring(0, 10) + '...' // Log partial token for debugging
          });

          monitoringService.incrementCounter('csrf_violations_total', 1, {
            type: 'invalid_token',
            method: req.method,
            path: req.path
          });

          // Log security event for invalid CSRF token
          this.logCSRFViolation(req, 'invalid_token', 'Invalid CSRF token provided');

          const error = new AppError(
            'Invalid CSRF token',
            ErrorCode.VALIDATION_ERROR,
            403,
            ErrorSeverity.MEDIUM,
            false,
            {
              type: 'csrf_invalid',
              method: req.method,
              path: req.path
            }
          );

          return next(error);
        }

        // Additional validation: check origin/referer for state-changing requests
        if (process.env.NODE_ENV === 'production') {
          const origin = req.headers.origin;
          const referer = req.headers.referer;
          const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

          if (!origin && !referer) {
            loggerService.warn('State-changing request without origin or referer', {
              method: req.method,
              path: req.path,
              ip: req.ip
            });

            this.logCSRFViolation(req, 'missing_origin', 'No origin or referer header');

            const error = new AppError(
              'Origin verification failed',
              ErrorCode.VALIDATION_ERROR,
              403,
              ErrorSeverity.MEDIUM
            );

            return next(error);
          }

          if (origin && !allowedOrigins.includes(origin)) {
            loggerService.warn('State-changing request from unauthorized origin', {
              method: req.method,
              path: req.path,
              ip: req.ip,
              origin
            });

            this.logCSRFViolation(req, 'unauthorized_origin', `Unauthorized origin: ${origin}`);

            const error = new AppError(
              'Origin not allowed',
              ErrorCode.VALIDATION_ERROR,
              403,
              ErrorSeverity.MEDIUM
            );

            return next(error);
          }
        }
      }

      // Generate new token for response if needed
      let csrfToken = req.cookies[this.options.cookieName];
      if (!csrfToken || !this.validateToken(csrfToken)) {
        csrfToken = this.generateToken();
        
        // Set CSRF token cookie with enhanced security
        res.cookie(this.options.cookieName, csrfToken, {
          httpOnly: this.options.httpOnly,
          secure: this.options.secure,
          sameSite: this.options.sameSite,
          maxAge: this.options.maxAge,
          path: '/',
          domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
        });
      }

      // Make token available to request
      req.csrfToken = csrfToken;

      // Add token to response headers for client-side access
      res.setHeader('X-CSRF-Token', csrfToken);

      next();
    };
  }

  /**
   * Log CSRF violation for security monitoring
   */
  private logCSRFViolation(req: Request, violationType: string, description: string): void {
    // This would integrate with the audit service when available
    loggerService.security('CSRF violation detected', {
      type: violationType,
      description,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      origin: req.headers.origin,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Endpoint to get CSRF token
   */
  static getTokenEndpoint() {
    return (req: Request, res: Response): void => {
      const csrf = new CSRFProtection();
      const token = csrf.generateToken();
      
      res.cookie(csrf.options.cookieName, token, {
        httpOnly: csrf.options.httpOnly,
        secure: csrf.options.secure,
        sameSite: csrf.options.sameSite,
        maxAge: csrf.options.maxAge
      });

      res.json({
        success: true,
        data: {
          csrfToken: token
        }
      });
    };
  }
}

/**
 * Create CSRF protection middleware with default options
 */
export const csrfProtection = new CSRFProtection().middleware();

/**
 * Create CSRF protection middleware with custom options
 */
export const createCSRFProtection = (options: Partial<CSRFOptions> = {}) => {
  return new CSRFProtection(options).middleware();
};

/**
 * Double submit cookie pattern for additional CSRF protection
 */
export const doubleSubmitCookie = (cookieName: string = 'csrf-token') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const cookieToken = req.cookies[cookieName];
    const headerToken = req.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken) {
      loggerService.warn('Double submit CSRF validation failed - missing tokens', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken
      });

      const error = new AppError(
        'CSRF protection failed',
        ErrorCode.VALIDATION_ERROR,
        403,
        ErrorSeverity.MEDIUM
      );

      return next(error);
    }

    if (cookieToken !== headerToken) {
      loggerService.warn('Double submit CSRF validation failed - token mismatch', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });

      monitoringService.incrementCounter('csrf_violations_total', 1, {
        type: 'double_submit_mismatch',
        method: req.method,
        path: req.path
      });

      const error = new AppError(
        'CSRF protection failed',
        ErrorCode.VALIDATION_ERROR,
        403,
        ErrorSeverity.MEDIUM
      );

      return next(error);
    }

    next();
  };
};
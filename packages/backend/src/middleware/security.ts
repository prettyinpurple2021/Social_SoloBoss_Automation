import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { loggerService } from '../services/LoggerService';

/**
 * HTTPS enforcement middleware
 */
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  // Skip HTTPS enforcement in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  // Check if request is already HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Log non-HTTPS attempts in production
  loggerService.warn('Non-HTTPS request blocked', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    headers: req.headers
  });

  // Redirect to HTTPS
  const httpsUrl = `https://${req.get('host')}${req.url}`;
  res.redirect(301, httpsUrl);
};

/**
 * Enhanced helmet configuration for security headers
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.facebook.com", "https://graph.instagram.com", "https://api.pinterest.com", "https://api.twitter.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      workerSrc: ["'self'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Additional security headers can be added here if needed
});

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Remove null bytes from all string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * IP whitelist middleware for sensitive endpoints
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    const forwardedIP = req.headers['x-forwarded-for'] as string;
    
    // Get the actual client IP (considering proxies)
    const actualIP = forwardedIP ? forwardedIP.split(',')[0].trim() : clientIP;
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development') {
      const localhostIPs = ['127.0.0.1', '::1', 'localhost'];
      if (localhostIPs.includes(actualIP) || actualIP.startsWith('192.168.') || actualIP.startsWith('10.')) {
        return next();
      }
    }
    
    if (!allowedIPs.includes(actualIP)) {
      loggerService.warn('IP not in whitelist', {
        ip: actualIP,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      res.status(403).json({
        success: false,
        error: 'Access denied: IP not authorized'
      });
      return;
    }
    
    next();
  };
};

/**
 * Request size limiting middleware
 */
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      loggerService.warn('Request size exceeded limit', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
      return;
    }
    
    next();
  };
};

/**
 * User-Agent validation middleware
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    loggerService.warn('Request without User-Agent header', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(400).json({
      success: false,
      error: 'User-Agent header is required'
    });
    return;
  }
  
  // Block known malicious user agents
  const maliciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /dirb/i,
    /dirbuster/i,
    /gobuster/i,
    /wfuzz/i,
    /burp/i,
    /zap/i
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(userAgent)) {
      loggerService.warn('Malicious User-Agent detected', {
        userAgent,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }
  }
  
  next();
};

/**
 * Request method validation middleware
 */
export const validateRequestMethod = (allowedMethods: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!allowedMethods.includes(req.method)) {
      loggerService.warn('Invalid request method', {
        method: req.method,
        allowedMethods,
        ip: req.ip,
        path: req.path
      });
      
      res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
      return;
    }
    
    next();
  };
};

/**
 * CORS configuration for production
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      loggerService.warn('CORS origin not allowed', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
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
    const clientIP = req.ip || req.socket.remoteAddress || '';
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
 * Advanced input sanitization middleware
 */
export const advancedSanitization = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove null bytes
      value = value.replace(/\0/g, '');
      
      // Remove potential XSS patterns
      value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      value = value.replace(/javascript:/gi, '');
      value = value.replace(/on\w+\s*=/gi, '');
      
      // Remove SQL injection patterns
      value = value.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '');
      
      // Limit string length to prevent DoS
      if (value.length > 10000) {
        value = value.substring(0, 10000);
      }
      
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Sanitize key names too
        const cleanKey = key.replace(/[^\w\-_]/g, '').substring(0, 100);
        if (cleanKey) {
          sanitized[cleanKey] = sanitizeValue(val);
        }
      }
      return sanitized;
    }
    
    return value;
  };

  // Sanitize all input
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);

  next();
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip for GET requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    const contentType = req.headers['content-type'];
    if (!contentType) {
      loggerService.warn('Request without Content-Type header', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: 'Content-Type header is required'
      });
      return;
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    if (!isAllowed) {
      loggerService.warn('Invalid Content-Type', {
        contentType,
        allowedTypes,
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      
      res.status(415).json({
        success: false,
        error: 'Unsupported Media Type'
      });
      return;
    }

    next();
  };
};

/**
 * Request origin validation
 */
export const validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Skip for same-origin requests
  if (!origin && !referer) {
    return next();
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    loggerService.warn('Request from unauthorized origin', {
      origin,
      referer,
      path: req.path,
      ip: req.ip
    });
    
    res.status(403).json({
      success: false,
      error: 'Origin not allowed'
    });
    return;
  }

  next();
};

/**
 * Security headers middleware with enhanced configuration
 */
export const enhancedSecurityHeaders = helmet({
  // Content Security Policy with strict settings
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for some frameworks
      connectSrc: [
        "'self'", 
        "https://api.facebook.com", 
        "https://graph.instagram.com", 
        "https://api.pinterest.com", 
        "https://api.twitter.com",
        "https://graph.facebook.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      workerSrc: ["'self'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Additional security headers
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  
  // Note: Permissions Policy would be configured here if supported by helmet version
});

/**
 * CORS configuration for production with enhanced security
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // In production, be more strict about origins
    if (process.env.NODE_ENV === 'production' && !origin) {
      loggerService.warn('Request without origin in production', {
        timestamp: new Date().toISOString()
      });
      return callback(new Error('Origin required in production'));
    }
    
    // Allow requests with no origin in development (mobile apps, etc.)
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (origin && allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      loggerService.warn('CORS origin not allowed', { 
        origin,
        allowedOrigins: allowedOrigins.length 
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'X-CSRF-Token',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit', 
    'X-RateLimit-Remaining', 
    'X-RateLimit-Reset',
    'X-CSRF-Token'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * API key validation middleware
 */
export const validateAPIKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(); // API key is optional, let other auth methods handle it
  }

  // Validate API key format
  if (!apiKey.startsWith('sma_') || apiKey.length < 20) {
    loggerService.warn('Invalid API key format', {
      keyPrefix: apiKey.substring(0, 10),
      ip: req.ip,
      path: req.path
    });
    
    res.status(401).json({
      success: false,
      error: 'Invalid API key format'
    });
    return;
  }

  // In a real implementation, you would validate against stored API keys
  // For now, we'll just log and continue
  loggerService.info('API key authentication attempted', {
    keyPrefix: apiKey.substring(0, 10),
    ip: req.ip,
    path: req.path
  });

  next();
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        loggerService.warn('Request timeout', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          timeout: timeoutMs
        });
        
        res.status(408).json({
          success: false,
          error: 'Request timeout'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};
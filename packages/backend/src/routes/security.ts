import { Router, Request, Response } from 'express';
import { CSRFProtection } from '../middleware/csrf';
import { loggerService } from '../services/LoggerService';
import { authMiddleware } from '../middleware/auth';
import { strictRateLimit } from '../middleware/rateLimiting';

const router = Router();

/**
 * Get CSRF token
 */
router.get('/csrf-token', (req: Request, res: Response) => {
  try {
    const csrfToken = req.csrfToken || new CSRFProtection().generateToken();
    
    res.json({
      success: true,
      data: {
        csrfToken
      }
    });
  } catch (error) {
    loggerService.error('Failed to generate CSRF token', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token'
    });
  }
});

/**
 * Get security configuration for client
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = {
      csrfEnabled: true,
      httpsRequired: process.env.NODE_ENV === 'production',
      corsEnabled: true,
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      rateLimiting: {
        enabled: true,
        general: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100
        },
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 5
        }
      },
      security: {
        headers: {
          hsts: true,
          csp: true,
          frameOptions: 'DENY',
          contentTypeOptions: true
        }
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    loggerService.error('Failed to get security config', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security configuration'
    });
  }
});

/**
 * Security health check
 */
router.get('/health', authMiddleware, strictRateLimit, (req: Request, res: Response) => {
  try {
    const securityHealth = {
      timestamp: new Date().toISOString(),
      csrf: {
        enabled: true,
        tokenPresent: !!req.csrfToken
      },
      headers: {
        hsts: !!res.getHeader('Strict-Transport-Security'),
        csp: !!res.getHeader('Content-Security-Policy'),
        frameOptions: !!res.getHeader('X-Frame-Options')
      },
      https: req.secure || req.headers['x-forwarded-proto'] === 'https',
      rateLimit: {
        remaining: res.getHeader('X-RateLimit-Remaining'),
        limit: res.getHeader('X-RateLimit-Limit'),
        reset: res.getHeader('X-RateLimit-Reset')
      }
    };

    res.json({
      success: true,
      data: securityHealth
    });
  } catch (error) {
    loggerService.error('Failed to get security health', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security health'
    });
  }
});

export default router;
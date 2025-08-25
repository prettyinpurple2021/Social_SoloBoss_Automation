/**
 * Developer Dashboard Routes
 * 
 * Provides endpoints for developers to monitor their API usage,
 * view analytics, manage rate limits, and access development tools.
 */

import { Router, Request, Response } from 'express';
import { ApiAnalyticsService } from '../services/ApiAnalyticsService';
import { SandboxService } from '../services/SandboxService';
import { ResponseUtils } from '../utils/responseUtils';
import { ErrorCode } from '../types/apiResponses';

const router = Router();
const analyticsService = ApiAnalyticsService.getInstance();
const sandboxService = SandboxService.getInstance();

/**
 * API Usage Analytics
 */

// Get API usage analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? 
      new Date(req.query.startDate as string) : 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const endDate = req.query.endDate ? 
      new Date(req.query.endDate as string) : 
      new Date();

    const userId = req.query.userId as string;

    const analytics = await analyticsService.getAnalyticsSummary(startDate, endDate, userId);
    
    ResponseUtils.success(res, analytics);
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

// Get user-specific analytics
router.get('/analytics/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const startDate = req.query.startDate ? 
      new Date(req.query.startDate as string) : 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const endDate = req.query.endDate ? 
      new Date(req.query.endDate as string) : 
      new Date();

    const userAnalytics = await analyticsService.getUserAnalytics(userId, startDate, endDate);
    
    ResponseUtils.success(res, userAnalytics);
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

// Get real-time metrics
router.get('/analytics/realtime', (req: Request, res: Response) => {
  try {
    const realTimeMetrics = analyticsService.getRealTimeMetrics();
    
    ResponseUtils.success(res, realTimeMetrics);
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

/**
 * Rate Limiting Information
 */

// Get rate limit status for current user
router.get('/rate-limits', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return ResponseUtils.unauthorized(res);
    }

    // Get rate limit status for common endpoints
    const endpoints = [
      { path: '/posts', method: 'GET', limit: 100, window: 60000 },
      { path: '/posts', method: 'POST', limit: 10, window: 60000 },
      { path: '/auth/login', method: 'POST', limit: 5, window: 60000 },
      { path: '/oauth/connect/{platform}', method: 'POST', limit: 3, window: 300000 }
    ];

    const rateLimitStatuses = await Promise.all(
      endpoints.map(async endpoint => {
        return await analyticsService.getRateLimitStatus(
          endpoint.path,
          endpoint.method,
          `user:${userId}`,
          endpoint.limit,
          endpoint.window
        );
      })
    );

    ResponseUtils.success(res, {
      rateLimits: rateLimitStatuses,
      globalLimits: {
        general: '100 requests per minute',
        authentication: '5 requests per minute',
        postCreation: '10 requests per minute',
        oauth: '3 requests per 5 minutes'
      },
      recommendations: [
        'Implement exponential backoff for retries',
        'Cache responses when possible',
        'Use bulk operations for multiple items',
        'Monitor rate limit headers in responses'
      ]
    });
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

/**
 * API Documentation and Tools
 */

// Get API status and health
router.get('/status', async (req: Request, res: Response) => {
  try {
    const realTimeMetrics = analyticsService.getRealTimeMetrics();
    
    ResponseUtils.success(res, {
      status: 'operational',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      performance: {
        averageResponseTime: realTimeMetrics.averageResponseTime,
        errorRate: realTimeMetrics.errorRate,
        currentLoad: realTimeMetrics.currentBuffer
      },
      services: {
        database: 'healthy',
        redis: 'healthy',
        scheduler: 'healthy',
        analytics: 'healthy'
      },
      endpoints: {
        total: 50, // Mock value
        healthy: 49,
        degraded: 1,
        down: 0
      }
    });
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

// Get API changelog
router.get('/changelog', (req: Request, res: Response) => {
  const changelog = [
    {
      version: '1.0.0',
      date: '2024-01-15',
      changes: [
        'Initial API release',
        'Authentication endpoints',
        'Post management',
        'OAuth integration',
        'Analytics endpoints'
      ],
      breaking: false
    },
    {
      version: '1.0.1',
      date: '2024-01-20',
      changes: [
        'Enhanced error responses',
        'Added rate limiting',
        'Improved documentation',
        'SDK releases'
      ],
      breaking: false
    },
    {
      version: '1.1.0',
      date: '2024-02-01',
      changes: [
        'Bulk post operations',
        'Advanced analytics',
        'Sandbox environment',
        'Developer dashboard'
      ],
      breaking: false
    }
  ];

  ResponseUtils.success(res, { changelog });
});

// Get SDK information
router.get('/sdks', (req: Request, res: Response) => {
  const sdks = [
    {
      name: 'TypeScript/JavaScript SDK',
      version: '1.0.0',
      language: 'TypeScript/JavaScript',
      package: '@sma/sdk',
      installation: 'npm install @sma/sdk',
      documentation: 'https://docs.sma-platform.com/sdks/typescript',
      examples: 'https://github.com/sma-platform/sdk-examples/tree/main/typescript',
      features: [
        'Full TypeScript support',
        'Automatic token refresh',
        'Built-in retry logic',
        'Comprehensive error handling'
      ]
    },
    {
      name: 'Python SDK',
      version: '1.0.0',
      language: 'Python',
      package: 'sma-sdk',
      installation: 'pip install sma-sdk',
      documentation: 'https://docs.sma-platform.com/sdks/python',
      examples: 'https://github.com/sma-platform/sdk-examples/tree/main/python',
      features: [
        'Type hints support',
        'Async/await support',
        'Automatic retries',
        'Pythonic error handling'
      ]
    }
  ];

  ResponseUtils.success(res, { sdks });
});

/**
 * Sandbox Management
 */

// Get sandbox information
router.get('/sandbox', (req: Request, res: Response) => {
  const sandboxInfo = {
    available: true,
    baseUrl: `${req.protocol}://${req.get('host')}/sandbox`,
    description: 'Safe testing environment with mock data',
    features: [
      'Mock data for all endpoints',
      'Simulated API responses',
      'No rate limiting',
      'Realistic error scenarios',
      'Test user accounts'
    ],
    testCredentials: [
      {
        email: 'developer@example.com',
        password: 'sandbox123',
        description: 'Primary test account'
      },
      {
        email: 'demo@sma-platform.com',
        password: 'demo123',
        description: 'Demo account with sample data'
      }
    ],
    endpoints: {
      login: 'POST /sandbox/auth/login',
      posts: 'GET /sandbox/posts',
      createPost: 'POST /sandbox/posts',
      analytics: 'GET /sandbox/posts/analytics',
      info: 'GET /sandbox/info',
      reset: 'POST /sandbox/reset'
    }
  };

  ResponseUtils.success(res, sandboxInfo);
});

// Reset sandbox data
router.post('/sandbox/reset', (req: Request, res: Response) => {
  try {
    sandboxService.resetSandboxData();
    
    ResponseUtils.success(res, {
      success: true,
      message: 'Sandbox data has been reset to initial state',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    ResponseUtils.internalError(res, error as Error);
  }
});

/**
 * Developer Tools
 */

// Generate API key (mock implementation)
router.post('/api-keys', (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return ResponseUtils.unauthorized(res);
  }

  const { name, scopes } = req.body;
  
  if (!name) {
    return ResponseUtils.validationError(res, [
      { field: 'name', message: 'API key name is required', code: 'REQUIRED' }
    ]);
  }

  // Generate mock API key
  const apiKey = `sma_${Buffer.from(`${userId}_${Date.now()}`).toString('base64')}`;
  
  ResponseUtils.success(res, {
    id: `key_${Date.now()}`,
    name,
    key: apiKey,
    scopes: scopes || ['read', 'write'],
    createdAt: new Date().toISOString(),
    lastUsed: null,
    expiresAt: null // Never expires by default
  }, 201);
});

// List API keys (mock implementation)
router.get('/api-keys', (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return ResponseUtils.unauthorized(res);
  }

  // Mock API keys
  const apiKeys = [
    {
      id: 'key_1',
      name: 'Development Key',
      keyPreview: 'sma_***************',
      scopes: ['read', 'write'],
      createdAt: '2024-01-15T10:00:00Z',
      lastUsed: '2024-01-20T14:30:00Z',
      expiresAt: null
    },
    {
      id: 'key_2',
      name: 'Production Key',
      keyPreview: 'sma_***************',
      scopes: ['read'],
      createdAt: '2024-01-10T09:00:00Z',
      lastUsed: '2024-01-21T16:45:00Z',
      expiresAt: null
    }
  ];

  ResponseUtils.success(res, { apiKeys });
});

// Revoke API key (mock implementation)
router.delete('/api-keys/:keyId', (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return ResponseUtils.unauthorized(res);
  }

  ResponseUtils.success(res, {
    success: true,
    message: 'API key has been revoked'
  });
});

/**
 * Testing Tools
 */

// Validate API request
router.post('/validate-request', (req: Request, res: Response) => {
  const { method, endpoint, headers, body } = req.body;
  
  if (!method || !endpoint) {
    return ResponseUtils.validationError(res, [
      { field: 'method', message: 'HTTP method is required', code: 'REQUIRED' },
      { field: 'endpoint', message: 'Endpoint is required', code: 'REQUIRED' }
    ]);
  }

  // Mock validation results
  const validation = {
    valid: true,
    issues: [] as any[],
    suggestions: [] as string[]
  };

  // Check for common issues
  if (!headers?.['Content-Type'] && ['POST', 'PUT', 'PATCH'].includes(method)) {
    validation.issues.push({
      type: 'warning',
      field: 'headers.Content-Type',
      message: 'Content-Type header is recommended for requests with body'
    });
    validation.suggestions.push('Add Content-Type: application/json header');
  }

  if (!headers?.['Authorization']) {
    validation.issues.push({
      type: 'error',
      field: 'headers.Authorization',
      message: 'Authorization header is required for most endpoints'
    });
    validation.suggestions.push('Add Authorization: Bearer <token> header');
  }

  if (body && typeof body === 'string') {
    try {
      JSON.parse(body);
    } catch {
      validation.valid = false;
      validation.issues.push({
        type: 'error',
        field: 'body',
        message: 'Request body is not valid JSON'
      });
    }
  }

  ResponseUtils.success(res, validation);
});

// Get example requests
router.get('/examples', (req: Request, res: Response) => {
  const examples = [
    {
      name: 'Login',
      method: 'POST',
      endpoint: '/auth/login',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        email: 'user@example.com',
        password: 'your-password'
      },
      response: {
        success: true,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'user-id',
            email: 'user@example.com',
            name: 'User Name'
          }
        }
      }
    },
    {
      name: 'Create Post',
      method: 'POST',
      endpoint: '/posts',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-jwt-token'
      },
      body: {
        content: 'Hello from the API!',
        platforms: ['facebook', 'instagram'],
        hashtags: ['#api', '#test'],
        scheduledTime: '2024-02-01T15:30:00Z'
      },
      response: {
        success: true,
        data: {
          id: 'post-id',
          content: 'Hello from the API!',
          status: 'scheduled',
          createdAt: '2024-01-21T10:00:00Z'
        }
      }
    },
    {
      name: 'Get Posts',
      method: 'GET',
      endpoint: '/posts?page=1&limit=20&status=published',
      headers: {
        'Authorization': 'Bearer your-jwt-token'
      },
      response: {
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false
        }
      }
    }
  ];

  ResponseUtils.success(res, { examples });
});

export default router;
/**
 * Sandbox Routes for Developer Testing
 * 
 * Provides sandbox endpoints that mirror the production API but use mock data
 * for safe testing and development without affecting real user data.
 */

import { Router, Request, Response } from 'express';
import { SandboxService } from '../services/SandboxService';
import { ResponseUtils } from '../utils/responseUtils';
import { ErrorCode } from '../types/apiResponses';

const router = Router();
const sandboxService = SandboxService.getInstance();

/**
 * Sandbox authentication endpoints
 */

// Sandbox login
router.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return ResponseUtils.validationError(res, [
      { field: 'email', message: 'Email is required', code: 'REQUIRED' },
      { field: 'password', message: 'Password is required', code: 'REQUIRED' }
    ]);
  }

  const result = sandboxService.sandboxLogin(email, password);
  if (!result) {
    return ResponseUtils.error(res, ErrorCode.INVALID_TOKEN, 'Invalid credentials');
  }

  ResponseUtils.success(res, {
    token: result.token,
    refreshToken: `refresh_${result.token}`,
    user: result.user
  });
});

// Sandbox user info
router.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  ResponseUtils.success(res, user);
});

/**
 * Sandbox posts endpoints
 */

// Get posts
router.get('/posts', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const filters = {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    platform: req.query.platform,
    sort: req.query.sort,
    order: req.query.order
  };

  const { posts, totalCount } = sandboxService.getSandboxPosts(user.id, filters);
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  ResponseUtils.paginated(res, posts, { page, limit, totalCount });
});

// Get post by ID
router.get('/posts/:postId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const post = sandboxService.getSandboxPost(req.params.postId);
  if (!post) {
    return ResponseUtils.notFound(res, 'Post');
  }

  ResponseUtils.success(res, post);
});

// Create post
router.post('/posts', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const { content, platforms, hashtags, images, scheduledTime, platformSpecificContent } = req.body;

  // Validation
  if (!content || !platforms || platforms.length === 0) {
    return ResponseUtils.validationError(res, [
      { field: 'content', message: 'Content is required', code: 'REQUIRED' },
      { field: 'platforms', message: 'At least one platform is required', code: 'REQUIRED' }
    ]);
  }

  const post = sandboxService.createSandboxPost(user.id, {
    content,
    platforms,
    hashtags,
    images,
    scheduledTime,
    platformSpecificContent
  });

  ResponseUtils.success(res, post, 201);
});

// Update post
router.put('/posts/:postId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const post = sandboxService.updateSandboxPost(req.params.postId, req.body);
  if (!post) {
    return ResponseUtils.notFound(res, 'Post');
  }

  ResponseUtils.success(res, post);
});

// Delete post
router.delete('/posts/:postId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const deleted = sandboxService.deleteSandboxPost(req.params.postId);
  if (!deleted) {
    return ResponseUtils.notFound(res, 'Post');
  }

  ResponseUtils.success(res, { success: true });
});

// Publish post
router.post('/posts/:postId/publish', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  try {
    const result = sandboxService.simulatePostPublish(req.params.postId);
    ResponseUtils.success(res, result);
  } catch (error) {
    ResponseUtils.notFound(res, 'Post');
  }
});

// Bulk create posts
router.post('/posts/bulk', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const { posts } = req.body;
  if (!posts || !Array.isArray(posts)) {
    return ResponseUtils.validationError(res, [
      { field: 'posts', message: 'Posts array is required', code: 'REQUIRED' }
    ]);
  }

  const scheduledPosts = posts.map(postData => 
    sandboxService.createSandboxPost(user.id, postData)
  );

  ResponseUtils.success(res, {
    scheduledPosts,
    errors: []
  }, 201);
});

// Get analytics
router.get('/posts/analytics', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    platform: req.query.platform
  };

  const analytics = sandboxService.getSandboxAnalytics(user.id, filters);
  ResponseUtils.success(res, analytics);
});

/**
 * Sandbox OAuth endpoints
 */

// Connect platform (simulated)
router.post('/oauth/connect/:platform', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  const { platform } = req.params;
  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    return ResponseUtils.validationError(res, [
      { field: 'code', message: 'Authorization code is required', code: 'REQUIRED' },
      { field: 'redirectUri', message: 'Redirect URI is required', code: 'REQUIRED' }
    ]);
  }

  // Simulate successful connection
  const platformConnection = {
    id: `sandbox_${Date.now()}`,
    platform,
    platformUserId: `${platform}_sandbox_${user.id.slice(0, 8)}`,
    platformUsername: `${user.name.toLowerCase().replace(' ', '_')}_${platform}`,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSandbox: true
  };

  ResponseUtils.success(res, {
    success: true,
    platformConnection
  });
});

// Disconnect platform (simulated)
router.delete('/oauth/disconnect/:platform', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return ResponseUtils.unauthorized(res);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = sandboxService.getSandboxUser(token);
  
  if (!user) {
    return ResponseUtils.unauthorized(res);
  }

  ResponseUtils.success(res, { success: true });
});

/**
 * Sandbox management endpoints
 */

// Get sandbox info
router.get('/sandbox/info', (req: Request, res: Response) => {
  const stats = sandboxService.getSandboxStats();
  
  ResponseUtils.success(res, {
    ...stats,
    message: 'This is a sandbox environment for testing and development',
    documentation: 'https://docs.sma-platform.com/sandbox',
    testCredentials: {
      email: 'developer@example.com',
      password: 'sandbox123'
    },
    features: [
      'Mock data for all endpoints',
      'Simulated API responses',
      'No rate limiting',
      'Safe testing environment',
      'Realistic error scenarios'
    ]
  });
});

// Reset sandbox data
router.post('/sandbox/reset', (req: Request, res: Response) => {
  sandboxService.resetSandboxData();
  
  ResponseUtils.success(res, {
    success: true,
    message: 'Sandbox data has been reset to initial state'
  });
});

// Get test scenarios
router.get('/sandbox/scenarios', (req: Request, res: Response) => {
  const scenarios = [
    {
      name: 'Successful Post Creation',
      description: 'Create a post that will be successfully scheduled',
      endpoint: 'POST /sandbox/posts',
      payload: {
        content: 'Test post from sandbox',
        platforms: ['facebook', 'instagram'],
        hashtags: ['#test', '#sandbox']
      }
    },
    {
      name: 'Failed Post Publishing',
      description: 'Simulate a post that fails to publish to demonstrate error handling',
      endpoint: 'POST /sandbox/posts/{postId}/publish',
      note: 'Some posts will randomly fail to simulate real-world scenarios'
    },
    {
      name: 'Rate Limit Testing',
      description: 'Test rate limiting behavior (disabled in sandbox)',
      endpoint: 'Any endpoint',
      note: 'Rate limiting is disabled in sandbox for easier testing'
    },
    {
      name: 'Authentication Flow',
      description: 'Test login and token management',
      endpoint: 'POST /sandbox/auth/login',
      payload: {
        email: 'developer@example.com',
        password: 'sandbox123'
      }
    },
    {
      name: 'Analytics Data',
      description: 'Get sample analytics data',
      endpoint: 'GET /sandbox/posts/analytics',
      note: 'Returns mock analytics data for testing dashboard features'
    }
  ];

  ResponseUtils.success(res, { scenarios });
});

// Health check for sandbox
router.get('/health', (req: Request, res: Response) => {
  ResponseUtils.success(res, {
    status: 'healthy',
    environment: 'sandbox',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy (mock)',
      redis: 'healthy (mock)',
      scheduler: 'healthy (mock)'
    },
    message: 'Sandbox environment is operational'
  });
});

export default router;
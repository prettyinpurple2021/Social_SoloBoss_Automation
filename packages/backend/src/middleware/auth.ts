import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { sessionService } from '../services/SessionService';
import { apiKeyService } from '../services/ApiKeyService';
import { loggerService } from '../services/LoggerService';
import { monitoringService } from '../services/MonitoringService';
import { UserRow } from '../types/database';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

// Extend Express Request interface to include user and auth info
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
      authMethod?: 'jwt' | 'session' | 'api_key';
      sessionId?: string;
      apiKeyId?: string;
      permissions?: string[];
    }
  }
}

/**
 * Enhanced authentication middleware supporting multiple auth methods
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Try different authentication methods in order of preference
    let authResult = await trySessionAuth(req);
    
    if (!authResult.success) {
      authResult = await tryJwtAuth(req);
    }
    
    if (!authResult.success) {
      authResult = await tryApiKeyAuth(req);
    }

    if (!authResult.success) {
      loggerService.security('Authentication failed - no valid credentials', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });

      monitoringService.incrementCounter('auth_failures', 1, {
        reason: 'no_credentials',
        endpoint: req.path
      });

      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Set user and auth info on request
    req.user = authResult.user;
    req.authMethod = authResult.method;
    req.sessionId = authResult.sessionId;
    req.apiKeyId = authResult.apiKeyId;
    req.permissions = authResult.permissions;

    // Record successful authentication
    monitoringService.incrementCounter('auth_success', 1, {
      method: authResult.method || 'unknown',
      userId: authResult.user!.id
    });

    monitoringService.recordHistogram('auth_duration', Date.now() - startTime, {
      method: authResult.method || 'unknown'
    });

    next();
  } catch (error) {
    loggerService.error('Authentication middleware error', error as Error, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    monitoringService.incrementCounter('auth_errors', 1, {
      endpoint: req.path
    });

    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Try session-based authentication
 */
async function trySessionAuth(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !token.startsWith('Bearer ')) {
      return { success: false };
    }

    const accessToken = token.substring(7); // Remove 'Bearer '
    const validation = await sessionService.validateAccessToken(accessToken);
    
    const user = await AuthService.getUserById(validation.userId);
    if (!user) {
      return { success: false };
    }

    return {
      success: true,
      user,
      method: 'session',
      sessionId: validation.sessionId,
      permissions: ['user:all'] // Session auth gets full user permissions
    };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Try JWT-based authentication (legacy support)
 */
async function tryJwtAuth(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return { success: false };
    }

    const user = await AuthService.getUserFromToken(token);
    if (!user) {
      return { success: false };
    }

    return {
      success: true,
      user,
      method: 'jwt',
      permissions: ['user:all'] // JWT auth gets full user permissions
    };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Try API key authentication
 */
async function tryApiKeyAuth(req: Request): Promise<AuthResult> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return { success: false };
    }

    const validation = await apiKeyService.validateApiKey(apiKey);
    if (!validation.isValid || !validation.userId) {
      return { success: false };
    }

    const user = await AuthService.getUserById(validation.userId);
    if (!user) {
      return { success: false };
    }

    // Log API key usage
    await apiKeyService.logApiKeyUsage(
      validation.keyId!,
      req.path,
      req.method,
      req.ip || 'unknown',
      req.headers['user-agent'] || '',
      200, // Will be updated later if needed
      0 // Will be updated later
    );

    return {
      success: true,
      user,
      method: 'api_key',
      apiKeyId: validation.keyId,
      permissions: validation.permissions || []
    };
  } catch (error) {
    return { success: false };
  }
}

interface AuthResult {
  success: boolean;
  user?: UserRow;
  method?: 'jwt' | 'session' | 'api_key';
  sessionId?: string;
  apiKeyId?: string;
  permissions?: string[];
}

/**
 * Middleware to check if user is authenticated (optional authentication)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await AuthService.getUserFromToken(token);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Middleware to check if the authenticated user owns the resource
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const resourceUserId = req.params[userIdParam] || req.body.userId || req.query.userId;
    
    if (req.user.id !== resourceUserId) {
      loggerService.security('Ownership check failed', {
        userId: req.user.id,
        resourceUserId,
        path: req.path,
        method: req.method
      });

      monitoringService.incrementCounter('authorization_failures', 1, {
        reason: 'ownership',
        userId: req.user.id
      });

      res.status(403).json({
        success: false,
        error: 'Access denied: insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // For session and JWT auth, check if user has admin role or specific permission
    if (req.authMethod === 'session' || req.authMethod === 'jwt') {
      // In a real implementation, you'd check user roles/permissions from database
      // For now, we'll allow all authenticated users for session/JWT
      return next();
    }

    // For API key auth, check specific permissions
    if (req.authMethod === 'api_key' && req.permissions) {
      const hasPermission = apiKeyService.hasPermission(req.permissions, permission);
      
      if (!hasPermission) {
        loggerService.security('Permission check failed', {
          userId: req.user.id,
          apiKeyId: req.apiKeyId,
          requiredPermission: permission,
          userPermissions: req.permissions,
          path: req.path,
          method: req.method
        });

        monitoringService.incrementCounter('authorization_failures', 1, {
          reason: 'permission',
          permission,
          authMethod: req.authMethod
        });

        res.status(403).json({
          success: false,
          error: `Permission required: ${permission}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user needs at least one)
 */
export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // For session and JWT auth, allow all
    if (req.authMethod === 'session' || req.authMethod === 'jwt') {
      return next();
    }

    // For API key auth, check if user has any of the required permissions
    if (req.authMethod === 'api_key' && req.permissions) {
      const hasAnyPermission = permissions.some(permission =>
        apiKeyService.hasPermission(req.permissions!, permission)
      );

      if (!hasAnyPermission) {
        loggerService.security('Multiple permission check failed', {
          userId: req.user.id,
          apiKeyId: req.apiKeyId,
          requiredPermissions: permissions,
          userPermissions: req.permissions,
          path: req.path,
          method: req.method
        });

        monitoringService.incrementCounter('authorization_failures', 1, {
          reason: 'multiple_permissions',
          authMethod: req.authMethod
        });

        res.status(403).json({
          success: false,
          error: `One of these permissions required: ${permissions.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }
    }

    next();
  };
};

/**
 * Middleware to require admin access
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  // Check if user has admin permission
  const isAdmin = req.authMethod === 'api_key' 
    ? req.permissions?.includes('admin:all')
    : (req.user.role || 'user') === 'admin'; // Assuming user has role field

  if (!isAdmin) {
    loggerService.security('Admin access denied', {
      userId: req.user.id,
      authMethod: req.authMethod,
      path: req.path,
      method: req.method
    });

    monitoringService.incrementCounter('authorization_failures', 1, {
      reason: 'admin_required',
      userId: req.user.id
    });

    res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }

  next();
};

/**
 * Middleware to extract user ID from token and add to request
 */
export const extractUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      req.body.userId = req.user.id;
    }
    next();
  } catch (error) {
    next();
  }
};

// Export alias for backward compatibility
export const authMiddleware = authenticateToken;
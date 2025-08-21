import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UserRow } from '../types/database';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const user = await AuthService.getUserFromToken(token);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

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
        error: 'Authentication required'
      });
      return;
    }

    const resourceUserId = req.params[userIdParam] || req.body.userId || req.query.userId;
    
    if (req.user.id !== resourceUserId) {
      res.status(403).json({
        success: false,
        error: 'Access denied: insufficient permissions'
      });
      return;
    }

    next();
  };
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
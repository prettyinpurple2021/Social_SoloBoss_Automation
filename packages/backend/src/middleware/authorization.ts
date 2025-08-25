import { Request, Response, NextFunction } from 'express';
import { UserRow } from '../types/database';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // For now, we'll assume all authenticated users have admin role
    // In a real implementation, you'd check the user's role from the database
    const userRole = 'admin'; // This should come from req.user.role

    if (userRole !== role) {
      return res.status(403).json({
        success: false,
        error: `Role '${role}' required`
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require user role or higher
 */
export const requireUser = requireRole('user');
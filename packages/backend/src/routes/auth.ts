import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService, LoginCredentials, RegisterInput } from '../services/AuthService';
import { authenticateToken } from '../middleware/auth';
import { UserModel } from '../models/User';
import { UserSettings } from '../types/database';
import { AuditLogService } from '../services/AuditLogService';
import { 
  handleValidationErrors,
  validateEmail,
  validatePassword
} from '../middleware/validation';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', [
  ...validateEmail(),
  ...validatePassword(),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, password, settings }: RegisterInput = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    // Log registration attempt
    await AuditLogService.logAuthenticationEvent(
      'login_attempt',
      undefined,
      { email, action: 'register' },
      ip,
      userAgent
    );

    const result = await AuthService.register({
      email,
      name,
      password,
      settings
    });

    if (!result.success) {
      // Log failed registration
      await AuditLogService.logAuthenticationEvent(
        'login_failure',
        undefined,
        { email, action: 'register', reason: result.error },
        ip,
        userAgent
      );
      
      res.status(400).json(result);
      return;
    }

    // Log successful registration
    await AuditLogService.logAuthenticationEvent(
      'login_success',
      result.user!.id,
      { email, action: 'register' },
      ip,
      userAgent
    );

    // Remove password hash from response
    const userResponse = { ...result.user };
    delete (userResponse as any).password_hash;

    res.status(201).json({
      success: true,
      user: userResponse,
      token: result.token
    });
  } catch (error) {
    // Log registration error
    await AuditLogService.logAuthenticationEvent(
      'login_failure',
      undefined,
      { email: req.body.email, action: 'register', error: (error as Error).message },
      req.ip,
      req.get('User-Agent')
    );

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', [
  ...validateEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials: LoginCredentials = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || "";
    // Log login attempt
    await AuditLogService.logAuthenticationEvent(
      'login_attempt',
      undefined,
      { email: credentials.email },
      ip,
      userAgent
    );

    const result = await AuthService.login(credentials, ip, userAgent);

    if (!result.success) {
      // Log failed login
      await AuditLogService.logAuthenticationEvent(
        'login_failure',
        undefined,
        { email: credentials.email, reason: result.error },
        ip,
        userAgent
      );

      res.status(401).json(result);
      return;
    }

    // Log successful login
    await AuditLogService.logAuthenticationEvent(
      'login_success',
      result.user!.id,
      { email: credentials.email },
      ip,
      userAgent
    );

    // Remove password hash from response
    const userResponse = { ...result.user };
    delete (userResponse as any).password_hash;

    res.json({
      success: true,
      user: userResponse,
      token: result.token
    });
  } catch (error) {
    // Log login error
    await AuditLogService.logAuthenticationEvent(
      'login_failure',
      undefined,
      { email: req.body.email, error: (error as Error).message },
      req.ip,
      req.get('User-Agent')
    );

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Log logout event
    await AuditLogService.logAuthenticationEvent(
      'logout',
      req.user?.id,
      {},
      req.ip,
      req.get('User-Agent')
    );

    // With JWT, logout is handled client-side by removing the token
    // This endpoint exists for consistency and potential future server-side token blacklisting
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Remove password hash from response
    const userResponse = { ...req.user };
    delete (userResponse as any).password_hash;

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object')
], async (req: Request, res: Response): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { name, email, settings } = req.body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (settings !== undefined) updateData.settings = settings;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400).json({
          success: false,
          error: 'Email is already taken'
        });
        return;
      }
    }

    const updatedUser = await UserModel.update(req.user.id, updateData);
    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Remove password hash from response
    const userResponse = { ...updatedUser };
    delete (userResponse as any).password_hash;

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * PUT /auth/password
 * Change user password
 */
router.put('/password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .custom((value: any, { req }: any) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  ...validatePassword(),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    
    // Log password change attempt
    await AuditLogService.logAuthenticationEvent(
      'password_change',
      req.user.id,
      { action: 'attempt' },
      req.ip,
      req.get('User-Agent')
    );

    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);

    if (!result.success) {
      // Log failed password change
      await AuditLogService.logAuthenticationEvent(
        'login_failure',
        req.user.id,
        { action: 'password_change', reason: result.error },
        req.ip,
        req.get('User-Agent')
      );

      res.status(400).json(result);
      return;
    }

    // Log successful password change
    await AuditLogService.logAuthenticationEvent(
      'password_change',
      req.user.id,
      { action: 'success' },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    // Log password change error
    await AuditLogService.logAuthenticationEvent(
      'login_failure',
      req.user?.id,
      { action: 'password_change', error: (error as Error).message },
      req.ip,
      req.get('User-Agent')
    );

    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

export default router;

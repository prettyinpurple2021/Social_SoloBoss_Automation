import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { OAuthService } from '../services/OAuthService';
import { PlatformConnectionModel } from '../models/PlatformConnection';
import { Platform } from '../types/database';
import { AuditLogService } from '../services/AuditLogService';
import { UserRow } from '../types/database';

// Extend Express Request type to ensure params is defined
interface AuthenticatedRequest extends express.Request {
  user?: UserRow;
  params: { [key: string]: string };
}

const router = express.Router();

/**
 * GET /oauth/:platform/auth
 * Generate OAuth authorization URL for a platform
 */
router.get('/:platform/auth', 
  authenticateToken,
  param('platform').isIn(Object.values(Platform)).withMessage('Invalid platform'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const platform = req.params.platform as Platform;
      const userId = req.user!.id;

      const authUrl = OAuthService.generateAuthUrl(platform, userId);

      res.json({
        success: true,
        data: {
          authUrl,
          platform
        }
      });
    } catch (error) {
      console.error('OAuth auth URL generation failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate auth URL'
      });
    }
  }
);

/**
 * POST /oauth/:platform/callback
 * Handle OAuth callback and exchange code for token
 */
router.post('/:platform/callback',
  param('platform').isIn(Object.values(Platform)).withMessage('Invalid platform'),
  body('code').notEmpty().withMessage('Authorization code is required'),
  body('state').notEmpty().withMessage('State parameter is required'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const platform = req.params.platform as Platform;
      const { code, state } = req.body;

      const result = await OAuthService.exchangeCodeForToken(platform, code, state);

      if (result.success) {
        // Log successful token creation
        await AuditLogService.logTokenEvent(
          'token_created',
          (result.connection as any).user_id,
          platform,
          { platform_username: (result.connection as any).platform_username },
          req.ip,
          req.get('User-Agent')
        );

        res.json({
          success: true,
          data: result.connection,
          message: `Successfully connected ${platform} account`
        });
      } else {
        // Log failed token creation
        await AuditLogService.logTokenEvent(
          'token_validation_failed',
          state, // state contains userId
          platform,
          { reason: result.error },
          req.ip,
          req.get('User-Agent')
        );

        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('OAuth callback failed:', error);
      res.status(500).json({
        success: false,
        error: 'OAuth callback processing failed'
      });
    }
  }
);

/**
 * GET /oauth/connections
 * Get all platform connections for the authenticated user
 */
router.get('/connections',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const connections = await PlatformConnectionModel.findActiveByUserId(userId);

      const connectionData = connections.map(conn => ({
        id: conn.id,
        platform: conn.platform,
        username: conn.platform_username,
        isActive: conn.is_active,
        connectedAt: conn.created_at,
        expiresAt: conn.token_expires_at
      }));

      res.json({
        success: true,
        data: connectionData
      });
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform connections'
      });
    }
  }
);

/**
 * DELETE /oauth/:platform/disconnect
 * Disconnect a platform account
 */
router.delete('/:platform/disconnect',
  authenticateToken,
  param('platform').isIn(Object.values(Platform)).withMessage('Invalid platform'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const platform = req.params.platform as Platform;
      const userId = req.user!.id;

      const result = await OAuthService.disconnectPlatform(userId, platform);

      if (result.success) {
        // Log token revocation
        await AuditLogService.logTokenEvent(
          'token_revoked',
          userId,
          platform,
          { action: 'user_disconnect' },
          req.ip,
          req.get('User-Agent')
        );

        res.json({
          success: true,
          message: `Successfully disconnected ${platform} account`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Platform disconnection failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect platform'
      });
    }
  }
);

/**
 * POST /oauth/:platform/refresh
 * Manually refresh token for a platform
 */
router.post('/:platform/refresh',
  authenticateToken,
  param('platform').isIn(Object.values(Platform)).withMessage('Invalid platform'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const platform = req.params.platform as Platform;
      const userId = req.user!.id;

      const connection = await PlatformConnectionModel.findByUserAndPlatform(userId, platform);
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'Platform connection not found'
        });
      }

      const refreshed = await OAuthService.refreshToken(connection.id);

      if (refreshed) {
        // Log successful token refresh
        await AuditLogService.logTokenEvent(
          'token_refreshed',
          userId,
          platform,
          { action: 'manual_refresh' },
          req.ip,
          req.get('User-Agent')
        );

        res.json({
          success: true,
          message: `Successfully refreshed ${platform} token`
        });
      } else {
        // Log failed token refresh
        await AuditLogService.logTokenEvent(
          'token_validation_failed',
          userId,
          platform,
          { action: 'manual_refresh', reason: 'refresh_failed' },
          req.ip,
          req.get('User-Agent')
        );

        res.status(400).json({
          success: false,
          error: 'Failed to refresh token'
        });
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh token'
      });
    }
  }
);

/**
 * GET /oauth/:platform/status
 * Check connection status for a platform
 */
router.get('/:platform/status',
  authenticateToken,
  param('platform').isIn(Object.values(Platform)).withMessage('Invalid platform'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const platform = req.params.platform as Platform;
      const userId = req.user!.id;

      const connection = await PlatformConnectionModel.findByUserAndPlatform(userId, platform);
      
      if (!connection) {
        return res.json({
          success: true,
          data: {
            connected: false,
            platform
          }
        });
      }

      // Check if token is valid
      const validToken = await OAuthService.getValidToken(userId, platform);
      const isTokenValid = validToken !== null;

      res.json({
        success: true,
        data: {
          connected: connection.is_active && isTokenValid,
          platform,
          username: connection.platform_username,
          connectedAt: connection.created_at,
          expiresAt: connection.token_expires_at,
          needsRefresh: !isTokenValid && connection.is_active
        }
      });
    } catch (error) {
      console.error('Failed to check platform status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check platform status'
      });
    }
  }
);

export default router;
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { SettingsService } from '../services/SettingsService';
import { UserSettings, PlatformPreferences, NotificationSettings } from '../types/database';

const router = Router();

/**
 * GET /settings
 * Get user settings
 */
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const settings = await SettingsService.getUserSettings(req.user.id);
    if (!settings) {
      res.status(404).json({
        success: false,
        error: 'Settings not found'
      });
      return;
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get settings'
    });
  }
});

/**
 * PUT /settings
 * Update user settings
 */
router.put('/', authenticateToken, [
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('defaultHashtags')
    .optional()
    .isArray()
    .withMessage('Default hashtags must be an array'),
  body('defaultHashtags.*')
    .optional()
    .isString()
    .withMessage('Each hashtag must be a string'),
  body('autoApproveFromSoloBoss')
    .optional()
    .isBoolean()
    .withMessage('Auto approve from SoloBoss must be a boolean'),
  body('bloggerIntegrationEnabled')
    .optional()
    .isBoolean()
    .withMessage('Blogger integration enabled must be a boolean')
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

    const settingsUpdate: Partial<UserSettings> = req.body;
    const updatedSettings = await SettingsService.updateUserSettings(req.user.id, settingsUpdate);

    if (!updatedSettings) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

/**
 * PUT /settings/platform-preferences
 * Update platform-specific preferences
 */
router.put('/platform-preferences', authenticateToken, [
  body('facebook')
    .optional()
    .isObject()
    .withMessage('Facebook preferences must be an object'),
  body('instagram')
    .optional()
    .isObject()
    .withMessage('Instagram preferences must be an object'),
  body('pinterest')
    .optional()
    .isObject()
    .withMessage('Pinterest preferences must be an object'),
  body('x')
    .optional()
    .isObject()
    .withMessage('X preferences must be an object')
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

    const platformPreferences: Partial<PlatformPreferences> = req.body;
    const updatedSettings = await SettingsService.updatePlatformPreferences(req.user.id, platformPreferences);

    if (!updatedSettings) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update platform preferences'
    });
  }
});

/**
 * PUT /settings/notifications
 * Update notification settings
 */
router.put('/notifications', authenticateToken, [
  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('failedPostNotifications')
    .optional()
    .isBoolean()
    .withMessage('Failed post notifications must be a boolean'),
  body('integrationIssueNotifications')
    .optional()
    .isBoolean()
    .withMessage('Integration issue notifications must be a boolean'),
  body('weeklyReports')
    .optional()
    .isBoolean()
    .withMessage('Weekly reports must be a boolean'),
  body('notificationEmail')
    .optional()
    .isEmail()
    .withMessage('Notification email must be a valid email address')
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

    const notificationSettings: Partial<NotificationSettings> = req.body;
    const updatedSettings = await SettingsService.updateNotificationSettings(req.user.id, notificationSettings);

    if (!updatedSettings) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
});

/**
 * POST /settings/reset
 * Reset settings to defaults
 */
router.post('/reset', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const defaultSettings = await SettingsService.resetToDefaults(req.user.id);

    if (!defaultSettings) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      settings: defaultSettings,
      message: 'Settings reset to defaults'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings'
    });
  }
});

export default router;
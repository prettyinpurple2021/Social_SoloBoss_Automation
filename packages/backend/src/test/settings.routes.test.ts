import request from 'supertest';
import express from 'express';
import settingsRoutes from '../routes/settings';
import { SettingsService } from '../services/SettingsService';
import { authenticateToken } from '../middleware/auth';

// Mock the SettingsService
jest.mock('../services/SettingsService');
const mockSettingsService = SettingsService as jest.Mocked<typeof SettingsService>;

// Mock the auth middleware
jest.mock('../middleware/auth');
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

const app = express();
app.use(express.json());
app.use('/settings', settingsRoutes);

describe('Settings Routes', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockSettings = {
    timezone: 'UTC',
    defaultHashtags: ['test'],
    autoApproveFromSoloBoss: false,
    bloggerIntegrationEnabled: true,
    platformPreferences: {
      facebook: {
        defaultHashtags: [],
        contentFormat: 'full' as const,
        includeLink: true,
        autoPost: false
      }
    },
    notificationSettings: {
      emailNotifications: true,
      failedPostNotifications: true,
      integrationIssueNotifications: true,
      weeklyReports: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the auth middleware to add user to request
    mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /settings', () => {
    it('should return user settings successfully', async () => {
      mockSettingsService.getUserSettings.mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/settings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        settings: mockSettings
      });
      expect(mockSettingsService.getUserSettings).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return 404 when settings not found', async () => {
      mockSettingsService.getUserSettings.mockResolvedValue(null);

      const response = await request(app)
        .get('/settings')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Settings not found'
      });
    });

    it('should return 500 on service error', async () => {
      mockSettingsService.getUserSettings.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/settings')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get settings'
      });
    });
  });

  describe('PUT /settings', () => {
    const settingsUpdate = {
      timezone: 'America/New_York',
      defaultHashtags: ['updated', 'test']
    };

    it('should update settings successfully', async () => {
      const updatedSettings = { ...mockSettings, ...settingsUpdate };
      mockSettingsService.updateUserSettings.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/settings')
        .send(settingsUpdate)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        settings: updatedSettings
      });
      expect(mockSettingsService.updateUserSettings).toHaveBeenCalledWith(
        mockUser.id,
        settingsUpdate
      );
    });

    it('should return 400 for invalid data', async () => {
      const invalidUpdate = {
        timezone: 123, // Should be string
        defaultHashtags: 'not-an-array'
      };

      const response = await request(app)
        .put('/settings')
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 404 when user not found', async () => {
      mockSettingsService.updateUserSettings.mockResolvedValue(null);

      const response = await request(app)
        .put('/settings')
        .send(settingsUpdate)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'User not found'
      });
    });
  });

  describe('PUT /settings/platform-preferences', () => {
    const platformPreferencesUpdate = {
      facebook: {
        defaultHashtags: ['facebook'],
        contentFormat: 'summary' as const,
        includeLink: false,
        autoPost: true
      }
    };

    it('should update platform preferences successfully', async () => {
      const updatedSettings = {
        ...mockSettings,
        platformPreferences: { ...mockSettings.platformPreferences, ...platformPreferencesUpdate }
      };
      mockSettingsService.updatePlatformPreferences.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/settings/platform-preferences')
        .send(platformPreferencesUpdate)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        settings: updatedSettings
      });
      expect(mockSettingsService.updatePlatformPreferences).toHaveBeenCalledWith(
        mockUser.id,
        platformPreferencesUpdate
      );
    });

    it('should return 400 for invalid platform preferences', async () => {
      const invalidUpdate = {
        facebook: 'not-an-object'
      };

      const response = await request(app)
        .put('/settings/platform-preferences')
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /settings/notifications', () => {
    const notificationSettingsUpdate = {
      emailNotifications: false,
      failedPostNotifications: false,
      notificationEmail: 'new@example.com'
    };

    it('should update notification settings successfully', async () => {
      const updatedSettings = {
        ...mockSettings,
        notificationSettings: { ...mockSettings.notificationSettings, ...notificationSettingsUpdate }
      };
      mockSettingsService.updateNotificationSettings.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/settings/notifications')
        .send(notificationSettingsUpdate)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        settings: updatedSettings
      });
      expect(mockSettingsService.updateNotificationSettings).toHaveBeenCalledWith(
        mockUser.id,
        notificationSettingsUpdate
      );
    });

    it('should return 400 for invalid email', async () => {
      const invalidUpdate = {
        notificationEmail: 'invalid-email'
      };

      const response = await request(app)
        .put('/settings/notifications')
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /settings/reset', () => {
    it('should reset settings to defaults successfully', async () => {
      const defaultSettings = {
        timezone: 'UTC',
        defaultHashtags: [],
        autoApproveFromSoloBoss: false,
        bloggerIntegrationEnabled: false
      };
      mockSettingsService.resetToDefaults.mockResolvedValue(defaultSettings);

      const response = await request(app)
        .post('/settings/reset')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        settings: defaultSettings,
        message: 'Settings reset to defaults'
      });
      expect(mockSettingsService.resetToDefaults).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return 404 when user not found', async () => {
      mockSettingsService.resetToDefaults.mockResolvedValue(null);

      const response = await request(app)
        .post('/settings/reset')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'User not found'
      });
    });
  });

  describe('Authentication', () => {
    beforeEach(() => {
      // Reset the auth middleware mock to not add user
      mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
        req.user = null;
        next();
      });
    });

    it('should return 401 when user not authenticated', async () => {
      const response = await request(app)
        .get('/settings')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'User not authenticated'
      });
    });
  });
});
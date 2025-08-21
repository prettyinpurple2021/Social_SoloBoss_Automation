import { SettingsService } from '../services/SettingsService';
import { UserModel } from '../models/User';
import { UserSettings, PlatformPreferences, NotificationSettings } from '../types/database';

// Mock the UserModel
jest.mock('../models/User');
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('SettingsService', () => {
  const mockUserId = 'test-user-id';
  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashed-password',
    settings: {
      timezone: 'UTC',
      defaultHashtags: ['test'],
      autoApproveFromSoloBoss: false,
      bloggerIntegrationEnabled: true
    },
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSettings', () => {
    it('should return user settings when user exists', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await SettingsService.getUserSettings(mockUserId);

      expect(result).toEqual(mockUser.settings);
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null when user does not exist', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await SettingsService.getUserSettings(mockUserId);

      expect(result).toBeNull();
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty object when user has no settings', async () => {
      const userWithoutSettings = { ...mockUser, settings: undefined };
      mockUserModel.findById.mockResolvedValue(userWithoutSettings as any);

      const result = await SettingsService.getUserSettings(mockUserId);

      expect(result).toEqual({});
    });
  });

  describe('updateUserSettings', () => {
    const settingsUpdate: Partial<UserSettings> = {
      timezone: 'America/New_York',
      defaultHashtags: ['updated', 'test']
    };

    it('should update user settings successfully', async () => {
      const updatedUser = {
        ...mockUser,
        settings: { ...mockUser.settings, ...settingsUpdate }
      };
      
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateSettings.mockResolvedValue(updatedUser);

      const result = await SettingsService.updateUserSettings(mockUserId, settingsUpdate);

      expect(result).toEqual(updatedUser.settings);
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockUserModel.updateSettings).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining(settingsUpdate)
      );
    });

    it('should return null when user does not exist', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await SettingsService.updateUserSettings(mockUserId, settingsUpdate);

      expect(result).toBeNull();
      expect(mockUserModel.updateSettings).not.toHaveBeenCalled();
    });

    it('should merge platform preferences correctly', async () => {
      const platformPreferencesUpdate: Partial<PlatformPreferences> = {
        facebook: {
          defaultHashtags: ['facebook'],
          contentFormat: 'summary',
          includeLink: false,
          autoPost: true
        }
      };

      const settingsWithPlatformPrefs: Partial<UserSettings> = {
        platformPreferences: platformPreferencesUpdate
      };

      const userWithExistingPrefs = {
        ...mockUser,
        settings: {
          ...mockUser.settings,
          platformPreferences: {
            instagram: {
              defaultHashtags: ['instagram'],
              imageRequired: true,
              maxHashtags: 30,
              autoPost: false
            }
          }
        }
      };

      mockUserModel.findById.mockResolvedValue(userWithExistingPrefs as any);
      mockUserModel.updateSettings.mockResolvedValue(userWithExistingPrefs as any);

      await SettingsService.updateUserSettings(mockUserId, settingsWithPlatformPrefs);

      expect(mockUserModel.updateSettings).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          platformPreferences: expect.objectContaining({
            facebook: platformPreferencesUpdate.facebook,
            instagram: userWithExistingPrefs.settings.platformPreferences.instagram
          })
        })
      );
    });
  });

  describe('updatePlatformPreferences', () => {
    const platformPreferencesUpdate: Partial<PlatformPreferences> = {
      facebook: {
        defaultHashtags: ['facebook'],
        contentFormat: 'full',
        includeLink: true,
        autoPost: false
      }
    };

    it('should update platform preferences successfully', async () => {
      const updatedUser = {
        ...mockUser,
        settings: {
          ...mockUser.settings,
          platformPreferences: platformPreferencesUpdate
        }
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateSettings.mockResolvedValue(updatedUser);

      const result = await SettingsService.updatePlatformPreferences(
        mockUserId,
        platformPreferencesUpdate
      );

      expect(result).toEqual(updatedUser.settings);
      expect(mockUserModel.updateSettings).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          platformPreferences: platformPreferencesUpdate
        })
      );
    });

    it('should return null when user does not exist', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await SettingsService.updatePlatformPreferences(
        mockUserId,
        platformPreferencesUpdate
      );

      expect(result).toBeNull();
    });
  });

  describe('updateNotificationSettings', () => {
    const notificationSettingsUpdate: Partial<NotificationSettings> = {
      emailNotifications: true,
      failedPostNotifications: true,
      notificationEmail: 'notifications@example.com'
    };

    it('should update notification settings successfully', async () => {
      const updatedUser = {
        ...mockUser,
        settings: {
          ...mockUser.settings,
          notificationSettings: notificationSettingsUpdate
        }
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.updateSettings.mockResolvedValue(updatedUser);

      const result = await SettingsService.updateNotificationSettings(
        mockUserId,
        notificationSettingsUpdate
      );

      expect(result).toEqual(updatedUser.settings);
      expect(mockUserModel.updateSettings).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          notificationSettings: notificationSettingsUpdate
        })
      );
    });

    it('should return null when user does not exist', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await SettingsService.updateNotificationSettings(
        mockUserId,
        notificationSettingsUpdate
      );

      expect(result).toBeNull();
    });
  });

  describe('getDefaultSettings', () => {
    it('should return default settings with correct structure', () => {
      const defaultSettings = SettingsService.getDefaultSettings();

      expect(defaultSettings).toEqual({
        timezone: 'UTC',
        defaultHashtags: [],
        autoApproveFromSoloBoss: false,
        bloggerIntegrationEnabled: false,
        platformPreferences: {
          facebook: {
            defaultHashtags: [],
            contentFormat: 'full',
            includeLink: true,
            autoPost: false
          },
          instagram: {
            defaultHashtags: [],
            imageRequired: true,
            maxHashtags: 30,
            autoPost: false
          },
          pinterest: {
            defaultBoard: '',
            defaultHashtags: [],
            imageRequired: true,
            autoPost: false
          },
          x: {
            defaultHashtags: [],
            shortenLinks: true,
            threadLongContent: true,
            autoPost: false
          }
        },
        notificationSettings: {
          emailNotifications: true,
          failedPostNotifications: true,
          integrationIssueNotifications: true,
          weeklyReports: false
        }
      });
    });
  });

  describe('resetToDefaults', () => {
    it('should reset user settings to defaults', async () => {
      const defaultSettings = SettingsService.getDefaultSettings();
      const updatedUser = {
        ...mockUser,
        settings: defaultSettings
      };

      mockUserModel.updateSettings.mockResolvedValue(updatedUser);

      const result = await SettingsService.resetToDefaults(mockUserId);

      expect(result).toEqual(defaultSettings);
      expect(mockUserModel.updateSettings).toHaveBeenCalledWith(mockUserId, defaultSettings);
    });

    it('should return null when user update fails', async () => {
      mockUserModel.updateSettings.mockResolvedValue(null);

      const result = await SettingsService.resetToDefaults(mockUserId);

      expect(result).toBeNull();
    });
  });
});
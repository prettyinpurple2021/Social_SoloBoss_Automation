import { UserModel } from '../models/User';
import { UserSettings, PlatformPreferences, NotificationSettings } from '../types/database';

export class SettingsService {
  /**
   * Get user settings
   */
  static async getUserSettings(userId: string): Promise<UserSettings | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }
    return user.settings || {};
  }

  /**
   * Update user settings
   */
  static async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }

    // Merge with existing settings
    const currentSettings = user.settings || {};
    const updatedSettings: UserSettings = {
      ...currentSettings,
      ...settings,
      // Deep merge platform preferences if provided
      platformPreferences: settings.platformPreferences 
        ? { ...currentSettings.platformPreferences, ...settings.platformPreferences }
        : currentSettings.platformPreferences,
      // Deep merge notification settings if provided
      notificationSettings: settings.notificationSettings
        ? { ...currentSettings.notificationSettings, ...settings.notificationSettings }
        : currentSettings.notificationSettings
    };

    const updatedUser = await UserModel.updateSettings(userId, updatedSettings);
    return updatedUser?.settings || null;
  }

  /**
   * Update platform preferences
   */
  static async updatePlatformPreferences(
    userId: string, 
    platformPreferences: Partial<PlatformPreferences>
  ): Promise<UserSettings | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }

    const currentSettings = user.settings || {};
    const currentPlatformPrefs = currentSettings.platformPreferences || {};

    const updatedSettings: UserSettings = {
      ...currentSettings,
      platformPreferences: {
        ...currentPlatformPrefs,
        ...platformPreferences
      }
    };

    const updatedUser = await UserModel.updateSettings(userId, updatedSettings);
    return updatedUser?.settings || null;
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(
    userId: string, 
    notificationSettings: Partial<NotificationSettings>
  ): Promise<UserSettings | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      return null;
    }

    const currentSettings = user.settings || {};
    const currentNotificationSettings = currentSettings.notificationSettings || {};

    const updatedSettings: UserSettings = {
      ...currentSettings,
      notificationSettings: {
        ...currentNotificationSettings,
        ...notificationSettings
      }
    };

    const updatedUser = await UserModel.updateSettings(userId, updatedSettings);
    return updatedUser?.settings || null;
  }

  /**
   * Get default settings for new users
   */
  static getDefaultSettings(): UserSettings {
    return {
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
    };
  }

  /**
   * Reset settings to defaults
   */
  static async resetToDefaults(userId: string): Promise<UserSettings | null> {
    const defaultSettings = this.getDefaultSettings();
    const updatedUser = await UserModel.updateSettings(userId, defaultSettings);
    return updatedUser?.settings || null;
  }
}
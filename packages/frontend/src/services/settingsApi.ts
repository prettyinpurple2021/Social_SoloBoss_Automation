import { UserSettings, PlatformPreferences, NotificationSettings } from '../types/user';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  settings?: T;
  error?: string;
  message?: string;
}

class SettingsApi {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }

  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest<UserSettings>('/settings');
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest<UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  async updatePlatformPreferences(
    platformPreferences: Partial<PlatformPreferences>
  ): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest<UserSettings>('/settings/platform-preferences', {
      method: 'PUT',
      body: JSON.stringify(platformPreferences)
    });
  }

  async updateNotificationSettings(
    notificationSettings: Partial<NotificationSettings>
  ): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest<UserSettings>('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(notificationSettings)
    });
  }

  async resetSettings(): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest<UserSettings>('/settings/reset', {
      method: 'POST'
    });
  }
}

export const settingsApi = new SettingsApi();
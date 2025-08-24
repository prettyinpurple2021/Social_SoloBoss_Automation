import { Platform, PlatformConnection } from '@sma/shared/types/platform';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  connections?: T;
  connection?: T;
  error?: string;
  message?: string;
}

interface OAuthUrlResponse {
  authUrl: string;
  state: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  connection?: PlatformConnection;
  lastSync?: Date;
  error?: string;
}

class PlatformsApi {
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

  async getConnections(): Promise<ApiResponse<PlatformConnection[]>> {
    return this.makeRequest<PlatformConnection[]>('/platforms/connections');
  }

  async getConnection(platform: Platform): Promise<ApiResponse<PlatformConnection>> {
    return this.makeRequest<PlatformConnection>(`/platforms/connections/${platform}`);
  }

  async getConnectionStatus(platform: Platform): Promise<ApiResponse<ConnectionStatus>> {
    return this.makeRequest<ConnectionStatus>(`/platforms/connections/${platform}/status`);
  }

  async initiateOAuth(platform: Platform): Promise<ApiResponse<OAuthUrlResponse>> {
    return this.makeRequest<OAuthUrlResponse>(`/platforms/oauth/${platform}/initiate`, {
      method: 'POST'
    });
  }

  async completeOAuth(platform: Platform, code: string, state: string): Promise<ApiResponse<PlatformConnection>> {
    return this.makeRequest<PlatformConnection>(`/platforms/oauth/${platform}/callback`, {
      method: 'POST',
      body: JSON.stringify({ code, state })
    });
  }

  async refreshToken(connectionId: string): Promise<ApiResponse<PlatformConnection>> {
    return this.makeRequest<PlatformConnection>(`/platforms/connections/${connectionId}/refresh`, {
      method: 'POST'
    });
  }

  async disconnectPlatform(connectionId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(`/platforms/connections/${connectionId}`, {
      method: 'DELETE'
    });
  }

  async testConnection(connectionId: string): Promise<ApiResponse<{
    isValid: boolean;
    platformUser: {
      id: string;
      username: string;
      name?: string;
    };
    permissions: string[];
    error?: string;
  }>> {
    return this.makeRequest(`/platforms/connections/${connectionId}/test`, {
      method: 'POST'
    });
  }

  async syncPlatformData(connectionId: string): Promise<ApiResponse<{
    syncedAt: Date;
    itemsSynced: number;
    errors: string[];
  }>> {
    return this.makeRequest(`/platforms/connections/${connectionId}/sync`, {
      method: 'POST'
    });
  }

  async getPlatformPages(platform: Platform): Promise<ApiResponse<{
    pages: Array<{
      id: string;
      name: string;
      category?: string;
      accessToken?: string;
    }>;
  }>> {
    return this.makeRequest(`/platforms/${platform}/pages`);
  }

  async selectPage(connectionId: string, pageId: string): Promise<ApiResponse<PlatformConnection>> {
    return this.makeRequest<PlatformConnection>(`/platforms/connections/${connectionId}/page`, {
      method: 'POST',
      body: JSON.stringify({ pageId })
    });
  }

  // Helper method to start OAuth flow in a popup window
  async connectPlatformWithPopup(platform: Platform): Promise<PlatformConnection> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get OAuth URL
        const response = await this.initiateOAuth(platform);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to initiate OAuth');
        }

        const { authUrl, state } = response.data;

        // Open popup window
        const popup = window.open(
          authUrl,
          `${platform}_oauth`,
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        // Listen for popup messages
        const messageListener = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          if (event.data.type === 'OAUTH_SUCCESS') {
            const { code, receivedState } = event.data;
            
            if (receivedState !== state) {
              reject(new Error('Invalid state parameter'));
              return;
            }

            try {
              const connectionResponse = await this.completeOAuth(platform, code, state);
              if (connectionResponse.success && connectionResponse.connection) {
                resolve(connectionResponse.connection);
              } else {
                reject(new Error(connectionResponse.error || 'Failed to complete OAuth'));
              }
            } catch (error) {
              reject(error);
            } finally {
              window.removeEventListener('message', messageListener);
              popup.close();
            }
          } else if (event.data.type === 'OAUTH_ERROR') {
            reject(new Error(event.data.error || 'OAuth failed'));
            window.removeEventListener('message', messageListener);
            popup.close();
          }
        };

        window.addEventListener('message', messageListener);

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            reject(new Error('OAuth cancelled by user'));
          }
        }, 1000);

      } catch (error) {
        reject(error);
      }
    });
  }
}

export const platformsApi = new PlatformsApi();
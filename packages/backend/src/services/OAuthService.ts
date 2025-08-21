import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Platform } from '../types/database';
import { 
  OAuthConfig, 
  OAuthToken, 
  OAuthUserInfo, 
  OAuthTokenResponse, 
  OAuthState,
  PlatformOAuthConfig,
  ConnectionResult,
  DisconnectionResult
} from '../types/oauth';
import { EncryptionService } from './EncryptionService';
import { PlatformConnectionModel } from '../models/PlatformConnection';

export class OAuthService {
  private static readonly STATE_EXPIRY_MINUTES = 10;
  private static readonly TOKEN_REFRESH_BUFFER_HOURS = 2;

  private static readonly PLATFORM_CONFIGS: PlatformOAuthConfig = {
    [Platform.FACEBOOK]: {
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
      scope: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      userInfoUrl: 'https://graph.facebook.com/v18.0/me'
    },
    [Platform.INSTAGRAM]: {
      clientId: process.env.INSTAGRAM_CLIENT_ID || '',
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI || '',
      scope: ['instagram_basic', 'instagram_content_publish'],
      authUrl: 'https://api.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      userInfoUrl: 'https://graph.instagram.com/me'
    },
    [Platform.PINTEREST]: {
      clientId: process.env.PINTEREST_CLIENT_ID || '',
      clientSecret: process.env.PINTEREST_CLIENT_SECRET || '',
      redirectUri: process.env.PINTEREST_REDIRECT_URI || '',
      scope: ['boards:read', 'pins:read', 'pins:write'],
      authUrl: 'https://www.pinterest.com/oauth/',
      tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
      userInfoUrl: 'https://api.pinterest.com/v5/user_account'
    },
    [Platform.X]: {
      clientId: process.env.X_CLIENT_ID || '',
      clientSecret: process.env.X_CLIENT_SECRET || '',
      redirectUri: process.env.X_REDIRECT_URI || '',
      scope: ['tweet.read', 'tweet.write', 'users.read'],
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      userInfoUrl: 'https://api.twitter.com/2/users/me'
    }
  };

  /**
   * Generates OAuth authorization URL for a platform
   */
  static generateAuthUrl(platform: Platform, userId: string): string {
    const config = this.PLATFORM_CONFIGS[platform];
    if (!config.clientId || !config.clientSecret) {
      throw new Error(`OAuth not configured for platform: ${platform}`);
    }

    const state = this.generateOAuthState(userId, platform);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      state: state
    });

    // Platform-specific parameters
    if (platform === Platform.X) {
      params.append('code_challenge', 'challenge');
      params.append('code_challenge_method', 'plain');
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access token
   */
  static async exchangeCodeForToken(
    platform: Platform, 
    code: string, 
    state: string
  ): Promise<ConnectionResult> {
    try {
      // Verify and decode state
      const oauthState = this.verifyOAuthState(state);
      if (oauthState.platform !== platform) {
        throw new Error('Platform mismatch in OAuth state');
      }

      const config = this.PLATFORM_CONFIGS[platform];
      const tokenData = await this.requestAccessToken(platform, code, config);
      const userInfo = await this.fetchUserInfo(platform, tokenData.accessToken, config);

      // Encrypt tokens before storing
      const encryptedTokens = EncryptionService.encryptToken({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken
      });

      // Store platform connection
      const connection = await PlatformConnectionModel.create({
        user_id: oauthState.userId,
        platform: platform,
        platform_user_id: userInfo.id,
        platform_username: userInfo.username,
        access_token: encryptedTokens.accessToken,
        refresh_token: encryptedTokens.refreshToken,
        token_expires_at: tokenData.expiresAt
      });

      return {
        success: true,
        connection: {
          id: connection.id,
          platform: connection.platform,
          username: connection.platform_username,
          isActive: connection.is_active
        }
      };
    } catch (error) {
      console.error(`OAuth token exchange failed for ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Refreshes an expired access token
   */
  static async refreshToken(connectionId: string): Promise<boolean> {
    try {
      const connection = await PlatformConnectionModel.findById(connectionId);
      if (!connection || !connection.refresh_token) {
        return false;
      }

      const config = this.PLATFORM_CONFIGS[connection.platform];
      const decryptedTokens = EncryptionService.decryptToken({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token
      });

      const response = await axios.post(config.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: decryptedTokens.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = this.parseTokenResponse(response.data);
      const encryptedTokens = EncryptionService.encryptToken({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || decryptedTokens.refreshToken
      });

      await PlatformConnectionModel.update(connectionId, {
        access_token: encryptedTokens.accessToken,
        refresh_token: encryptedTokens.refreshToken,
        token_expires_at: tokenData.expiresAt
      });

      return true;
    } catch (error) {
      console.error(`Token refresh failed for connection ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Disconnects a platform account
   */
  static async disconnectPlatform(userId: string, platform: Platform): Promise<DisconnectionResult> {
    try {
      const connection = await PlatformConnectionModel.findByUserAndPlatform(userId, platform);
      if (!connection) {
        return { success: false, error: 'Platform connection not found' };
      }

      // Revoke token with platform if possible
      await this.revokeToken(connection.platform, connection.access_token);

      // Deactivate connection
      await PlatformConnectionModel.deactivate(connection.id);

      return { success: true };
    } catch (error) {
      console.error(`Platform disconnection failed for ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnection failed'
      };
    }
  }

  /**
   * Checks if tokens are expiring soon and refreshes them
   */
  static async refreshExpiringTokens(): Promise<void> {
    try {
      const expiringConnections = await PlatformConnectionModel.findExpiringSoon(
        this.TOKEN_REFRESH_BUFFER_HOURS
      );

      const refreshPromises = expiringConnections.map(connection => 
        this.refreshToken(connection.id)
      );

      await Promise.allSettled(refreshPromises);
    } catch (error) {
      console.error('Failed to refresh expiring tokens:', error);
    }
  }

  /**
   * Gets a valid access token for a platform connection
   */
  static async getValidToken(userId: string, platform: Platform): Promise<string | null> {
    try {
      const connection = await PlatformConnectionModel.findByUserAndPlatform(userId, platform);
      if (!connection || !connection.is_active) {
        return null;
      }

      // Check if token is expiring soon
      if (connection.token_expires_at) {
        const expiryTime = new Date(connection.token_expires_at);
        const bufferTime = new Date(Date.now() + (this.TOKEN_REFRESH_BUFFER_HOURS * 60 * 60 * 1000));
        
        if (expiryTime <= bufferTime) {
          const refreshed = await this.refreshToken(connection.id);
          if (!refreshed) {
            return null;
          }
          
          // Fetch updated connection
          const updatedConnection = await PlatformConnectionModel.findById(connection.id);
          if (!updatedConnection) {
            return null;
          }
          
          return EncryptionService.decrypt(updatedConnection.access_token);
        }
      }

      return EncryptionService.decrypt(connection.access_token);
    } catch (error) {
      console.error(`Failed to get valid token for ${platform}:`, error);
      return null;
    }
  }

  // Private helper methods

  private static generateOAuthState(userId: string, platform: Platform): string {
    const state: OAuthState = {
      userId,
      platform,
      timestamp: Date.now(),
      nonce: EncryptionService.generateNonce()
    };

    return EncryptionService.encrypt(JSON.stringify(state));
  }

  private static verifyOAuthState(encryptedState: string): OAuthState {
    try {
      const stateJson = EncryptionService.decrypt(encryptedState);
      const state: OAuthState = JSON.parse(stateJson);

      // Check if state is expired
      const expiryTime = state.timestamp + (this.STATE_EXPIRY_MINUTES * 60 * 1000);
      if (Date.now() > expiryTime) {
        throw new Error('OAuth state has expired');
      }

      return state;
    } catch (error) {
      throw new Error('Invalid OAuth state');
    }
  }

  private static async requestAccessToken(
    platform: Platform, 
    code: string, 
    config: OAuthConfig
  ): Promise<OAuthToken> {
    const data = {
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: code
    };

    const response = await axios.post(config.tokenUrl, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    return this.parseTokenResponse(response.data);
  }

  private static parseTokenResponse(data: OAuthTokenResponse): OAuthToken {
    const expiresAt = data.expires_in 
      ? new Date(Date.now() + (data.expires_in * 1000))
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scope: data.scope ? data.scope.split(' ') : undefined,
      tokenType: data.token_type
    };
  }

  private static async fetchUserInfo(
    platform: Platform, 
    accessToken: string, 
    config: OAuthConfig
  ): Promise<OAuthUserInfo> {
    if (!config.userInfoUrl) {
      throw new Error(`User info URL not configured for ${platform}`);
    }

    const response = await axios.get(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return this.parseUserInfo(platform, response.data);
  }

  private static parseUserInfo(platform: Platform, data: any): OAuthUserInfo {
    switch (platform) {
      case Platform.FACEBOOK:
        return {
          id: data.id,
          username: data.name || data.id,
          name: data.name,
          email: data.email
        };
      
      case Platform.INSTAGRAM:
        return {
          id: data.id,
          username: data.username,
          name: data.name
        };
      
      case Platform.PINTEREST:
        return {
          id: data.id,
          username: data.username,
          name: data.first_name && data.last_name 
            ? `${data.first_name} ${data.last_name}` 
            : data.username
        };
      
      case Platform.X:
        return {
          id: data.id,
          username: data.username,
          name: data.name
        };
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private static async revokeToken(platform: Platform, encryptedToken: string): Promise<void> {
    try {
      const token = EncryptionService.decrypt(encryptedToken);
      const config = this.PLATFORM_CONFIGS[platform];

      // Platform-specific token revocation
      switch (platform) {
        case Platform.FACEBOOK:
          await axios.delete(`https://graph.facebook.com/v18.0/me/permissions`, {
            params: { access_token: token }
          });
          break;
        
        case Platform.X:
          await axios.post('https://api.twitter.com/2/oauth2/revoke', {
            token: token,
            client_id: config.clientId
          });
          break;
        
        // Instagram and Pinterest don't have explicit revocation endpoints
        // The tokens will expire naturally
        case Platform.INSTAGRAM:
        case Platform.PINTEREST:
        default:
          break;
      }
    } catch (error) {
      // Log but don't throw - token revocation is best effort
      console.warn(`Token revocation failed for ${platform}:`, error);
    }
  }
}
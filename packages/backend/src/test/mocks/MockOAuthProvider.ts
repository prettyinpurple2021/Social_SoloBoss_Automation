import express from 'express';
import { Platform } from '../../types/database';

export interface MockOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  validCodes: string[];
  validTokens: string[];
  userInfo: Record<string, any>;
}

export class MockOAuthProvider {
  private app: express.Application;
  private server: any;
  private configs: Map<Platform, MockOAuthConfig> = new Map();

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.setupRoutes();
  }

  /**
   * Configure mock OAuth provider for a platform
   */
  configure(platform: Platform, config: MockOAuthConfig): void {
    this.configs.set(platform, config);
  }

  /**
   * Start the mock OAuth server
   */
  start(port: number = 3002): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Mock OAuth provider running on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock OAuth server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock OAuth provider stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private setupRoutes(): void {
    // Mock Facebook OAuth endpoints
    this.setupPlatformRoutes(Platform.FACEBOOK, {
      authPath: '/facebook/dialog/oauth',
      tokenPath: '/facebook/oauth/access_token',
      userInfoPath: '/facebook/me'
    });

    // Mock Instagram OAuth endpoints
    this.setupPlatformRoutes(Platform.INSTAGRAM, {
      authPath: '/instagram/oauth/authorize',
      tokenPath: '/instagram/oauth/access_token',
      userInfoPath: '/instagram/me'
    });

    // Mock Pinterest OAuth endpoints
    this.setupPlatformRoutes(Platform.PINTEREST, {
      authPath: '/pinterest/oauth',
      tokenPath: '/pinterest/v5/oauth/token',
      userInfoPath: '/pinterest/v5/user_account'
    });

    // Mock X (Twitter) OAuth endpoints
    this.setupPlatformRoutes(Platform.X, {
      authPath: '/x/oauth2/authorize',
      tokenPath: '/x/oauth2/token',
      userInfoPath: '/x/users/me'
    });
  }

  private setupPlatformRoutes(platform: Platform, paths: {
    authPath: string;
    tokenPath: string;
    userInfoPath: string;
  }): void {
    // Authorization endpoint (GET)
    this.app.get(paths.authPath, (req, res) => {
      const config = this.configs.get(platform);
      if (!config) {
        return res.status(400).json({ error: 'Platform not configured' });
      }

      const { client_id, redirect_uri, state } = req.query;

      if (client_id !== config.clientId) {
        return res.status(400).json({ error: 'invalid_client_id' });
      }

      // Simulate user authorization - redirect back with code
      const code = 'mock_auth_code_' + Date.now();
      const redirectUrl = `${redirect_uri}?code=${code}&state=${state}`;
      
      res.redirect(redirectUrl);
    });

    // Token exchange endpoint (POST)
    this.app.post(paths.tokenPath, (req, res) => {
      const config = this.configs.get(platform);
      if (!config) {
        return res.status(400).json({ error: 'Platform not configured' });
      }

      const { grant_type, client_id, client_secret, code, refresh_token } = req.body;

      if (client_id !== config.clientId || client_secret !== config.clientSecret) {
        return res.status(400).json({ 
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
      }

      if (grant_type === 'authorization_code') {
        if (!code || !code.startsWith('mock_auth_code_')) {
          return res.status(400).json({ 
            error: 'invalid_grant',
            error_description: 'Invalid authorization code'
          });
        }

        // Return mock tokens
        res.json({
          access_token: `mock_access_token_${platform}_${Date.now()}`,
          refresh_token: `mock_refresh_token_${platform}_${Date.now()}`,
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read write'
        });
      } else if (grant_type === 'refresh_token') {
        if (!refresh_token || !refresh_token.startsWith('mock_refresh_token_')) {
          return res.status(400).json({ 
            error: 'invalid_grant',
            error_description: 'Invalid refresh token'
          });
        }

        // Return new access token
        res.json({
          access_token: `mock_access_token_${platform}_refreshed_${Date.now()}`,
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read write'
        });
      } else {
        res.status(400).json({ 
          error: 'unsupported_grant_type',
          error_description: 'Grant type not supported'
        });
      }
    });

    // User info endpoint (GET)
    this.app.get(paths.userInfoPath, (req, res) => {
      const config = this.configs.get(platform);
      if (!config) {
        return res.status(400).json({ error: 'Platform not configured' });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.substring(7);
      if (!token.startsWith('mock_access_token_')) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Return mock user info
      res.json(config.userInfo);
    });

    // Token revocation endpoint (DELETE/POST)
    this.app.delete(paths.userInfoPath.replace('/me', '/permissions'), (req, res) => {
      res.json({ success: true });
    });

    this.app.post(paths.tokenPath.replace('/token', '/revoke'), (req, res) => {
      res.json({ revoked: true });
    });
  }

  /**
   * Get default mock configurations for testing
   */
  static getDefaultConfigs(): Record<Platform, MockOAuthConfig> {
    return {
      [Platform.FACEBOOK]: {
        clientId: 'mock_facebook_client_id',
        clientSecret: 'mock_facebook_client_secret',
        redirectUri: 'http://localhost:3001/api/oauth/facebook/callback',
        validCodes: ['mock_auth_code_facebook'],
        validTokens: ['mock_access_token_facebook'],
        userInfo: {
          id: 'facebook_user_123',
          name: 'Mock Facebook User',
          email: 'facebook@example.com'
        }
      },
      [Platform.INSTAGRAM]: {
        clientId: 'mock_instagram_client_id',
        clientSecret: 'mock_instagram_client_secret',
        redirectUri: 'http://localhost:3001/api/oauth/instagram/callback',
        validCodes: ['mock_auth_code_instagram'],
        validTokens: ['mock_access_token_instagram'],
        userInfo: {
          id: 'instagram_user_123',
          username: 'mock_instagram_user',
          name: 'Mock Instagram User'
        }
      },
      [Platform.PINTEREST]: {
        clientId: 'mock_pinterest_client_id',
        clientSecret: 'mock_pinterest_client_secret',
        redirectUri: 'http://localhost:3001/api/oauth/pinterest/callback',
        validCodes: ['mock_auth_code_pinterest'],
        validTokens: ['mock_access_token_pinterest'],
        userInfo: {
          id: 'pinterest_user_123',
          username: 'mock_pinterest_user',
          first_name: 'Mock',
          last_name: 'Pinterest User'
        }
      },
      [Platform.X]: {
        clientId: 'mock_x_client_id',
        clientSecret: 'mock_x_client_secret',
        redirectUri: 'http://localhost:3001/api/oauth/x/callback',
        validCodes: ['mock_auth_code_x'],
        validTokens: ['mock_access_token_x'],
        userInfo: {
          id: 'x_user_123',
          username: 'mock_x_user',
          name: 'Mock X User'
        }
      }
    };
  }
}
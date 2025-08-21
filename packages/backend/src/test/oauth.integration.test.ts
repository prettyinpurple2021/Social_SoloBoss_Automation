import request from 'supertest';
import express from 'express';
import { MockOAuthProvider } from './mocks/MockOAuthProvider';
import { OAuthService } from '../services/OAuthService';
import { Platform } from '../types/database';
import { EncryptionService } from '../services/EncryptionService';
import oauthRoutes from '../routes/oauth';

// Mock the database models
jest.mock('../models/PlatformConnection');

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  }
}));

describe('OAuth Integration Tests', () => {
  let app: express.Application;
  let mockProvider: MockOAuthProvider;
  const mockUserId = 'test-user-123';

  beforeAll(async () => {
    // Setup test environment
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests';
    
    // Configure OAuth endpoints to point to mock provider
    const mockConfigs = MockOAuthProvider.getDefaultConfigs();
    
    process.env.FACEBOOK_CLIENT_ID = mockConfigs[Platform.FACEBOOK].clientId;
    process.env.FACEBOOK_CLIENT_SECRET = mockConfigs[Platform.FACEBOOK].clientSecret;
    process.env.FACEBOOK_REDIRECT_URI = mockConfigs[Platform.FACEBOOK].redirectUri;
    
    process.env.INSTAGRAM_CLIENT_ID = mockConfigs[Platform.INSTAGRAM].clientId;
    process.env.INSTAGRAM_CLIENT_SECRET = mockConfigs[Platform.INSTAGRAM].clientSecret;
    process.env.INSTAGRAM_REDIRECT_URI = mockConfigs[Platform.INSTAGRAM].redirectUri;

    // Start mock OAuth provider
    mockProvider = new MockOAuthProvider();
    Object.values(Platform).forEach(platform => {
      mockProvider.configure(platform, mockConfigs[platform]);
    });
    await mockProvider.start(3002);

    // Override OAuth service URLs to point to mock provider
    const originalConfigs = (OAuthService as any).PLATFORM_CONFIGS;
    (OAuthService as any).PLATFORM_CONFIGS = {
      ...originalConfigs,
      [Platform.FACEBOOK]: {
        ...originalConfigs[Platform.FACEBOOK],
        authUrl: 'http://localhost:3002/facebook/dialog/oauth',
        tokenUrl: 'http://localhost:3002/facebook/oauth/access_token',
        userInfoUrl: 'http://localhost:3002/facebook/me'
      },
      [Platform.INSTAGRAM]: {
        ...originalConfigs[Platform.INSTAGRAM],
        authUrl: 'http://localhost:3002/instagram/oauth/authorize',
        tokenUrl: 'http://localhost:3002/instagram/oauth/access_token',
        userInfoUrl: 'http://localhost:3002/instagram/me'
      }
    };

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/oauth', oauthRoutes);
  });

  afterAll(async () => {
    await mockProvider.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete OAuth Flow', () => {
    it('should complete Facebook OAuth flow successfully', async () => {
      // Mock database operations
      const { PlatformConnectionModel } = require('../models/PlatformConnection');
      const mockConnection = {
        id: 'connection-123',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook_user_123',
        platform_username: 'Mock Facebook User',
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date(Date.now() + 3600000),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      PlatformConnectionModel.create.mockResolvedValue(mockConnection);

      // Step 1: Generate auth URL
      const authResponse = await request(app)
        .get('/api/oauth/facebook/auth')
        .expect(200);

      expect(authResponse.body.success).toBe(true);
      expect(authResponse.body.data.authUrl).toContain('localhost:3002/facebook/dialog/oauth');

      // Step 2: Extract state from auth URL for callback
      const authUrl = new URL(authResponse.body.data.authUrl);
      const state = authUrl.searchParams.get('state');
      expect(state).toBeDefined();

      // Step 3: Simulate OAuth callback with mock code
      const mockCode = 'mock_auth_code_' + Date.now();
      
      const callbackResponse = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: mockCode, state: state })
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body.data).toEqual({
        id: 'connection-123',
        platform: Platform.FACEBOOK,
        username: 'Mock Facebook User',
        isActive: true
      });

      // Verify database was called with encrypted tokens
      expect(PlatformConnectionModel.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook_user_123',
        platform_username: 'Mock Facebook User',
        access_token: expect.stringContaining('encrypted-'),
        refresh_token: expect.stringContaining('encrypted-'),
        token_expires_at: expect.any(Date)
      });
    });

    it('should handle Instagram OAuth flow', async () => {
      const { PlatformConnectionModel } = require('../models/PlatformConnection');
      const mockConnection = {
        id: 'connection-456',
        user_id: mockUserId,
        platform: Platform.INSTAGRAM,
        platform_user_id: 'instagram_user_123',
        platform_username: 'mock_instagram_user',
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date(Date.now() + 3600000),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      PlatformConnectionModel.create.mockResolvedValue(mockConnection);

      // Generate auth URL
      const authResponse = await request(app)
        .get('/api/oauth/instagram/auth')
        .expect(200);

      const authUrl = new URL(authResponse.body.data.authUrl);
      const state = authUrl.searchParams.get('state');
      const mockCode = 'mock_auth_code_' + Date.now();
      
      // Complete OAuth callback
      const callbackResponse = await request(app)
        .post('/api/oauth/instagram/callback')
        .send({ code: mockCode, state: state })
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body.data.platform).toBe(Platform.INSTAGRAM);
      expect(callbackResponse.body.data.username).toBe('mock_instagram_user');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid authorization code', async () => {
      const authResponse = await request(app)
        .get('/api/oauth/facebook/auth')
        .expect(200);

      const authUrl = new URL(authResponse.body.data.authUrl);
      const state = authUrl.searchParams.get('state');
      
      // Use invalid code
      const callbackResponse = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: 'invalid_code', state: state })
        .expect(400);

      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.error).toBeDefined();
    });

    it('should handle expired OAuth state', async () => {
      // Create an expired state
      const expiredState = EncryptionService.encrypt(JSON.stringify({
        userId: mockUserId,
        platform: Platform.FACEBOOK,
        timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago
        nonce: 'test-nonce'
      }));

      const callbackResponse = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: 'valid_code', state: expiredState })
        .expect(400);

      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.error).toContain('expired');
    });

    it('should handle platform mismatch in state', async () => {
      // Create state for different platform
      const mismatchedState = EncryptionService.encrypt(JSON.stringify({
        userId: mockUserId,
        platform: Platform.INSTAGRAM, // Different from callback platform
        timestamp: Date.now(),
        nonce: 'test-nonce'
      }));

      const callbackResponse = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: 'valid_code', state: mismatchedState })
        .expect(400);

      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.error).toContain('mismatch');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh expired tokens', async () => {
      const { PlatformConnectionModel } = require('../models/PlatformConnection');
      
      const mockConnection = {
        id: 'connection-789',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook_user_123',
        platform_username: 'Mock Facebook User',
        access_token: EncryptionService.encrypt('old_access_token'),
        refresh_token: EncryptionService.encrypt('mock_refresh_token_facebook_123'),
        token_expires_at: new Date(Date.now() - 1000), // Expired
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      PlatformConnectionModel.findById.mockResolvedValue(mockConnection);
      PlatformConnectionModel.update.mockResolvedValue({
        ...mockConnection,
        access_token: EncryptionService.encrypt('new_access_token')
      });

      const refreshed = await OAuthService.refreshToken('connection-789');
      expect(refreshed).toBe(true);

      expect(PlatformConnectionModel.update).toHaveBeenCalledWith(
        'connection-789',
        expect.objectContaining({
          access_token: expect.any(String),
          token_expires_at: expect.any(Date)
        })
      );
    });
  });

  describe('Platform Disconnection', () => {
    it('should disconnect platform successfully', async () => {
      const { PlatformConnectionModel } = require('../models/PlatformConnection');
      
      const mockConnection = {
        id: 'connection-disconnect',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook_user_123',
        platform_username: 'Mock Facebook User',
        access_token: EncryptionService.encrypt('access_token_to_revoke'),
        refresh_token: EncryptionService.encrypt('refresh_token'),
        token_expires_at: new Date(Date.now() + 3600000),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      PlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(mockConnection);
      PlatformConnectionModel.deactivate.mockResolvedValue({
        ...mockConnection,
        is_active: false
      });

      const disconnectResponse = await request(app)
        .delete('/api/oauth/facebook/disconnect')
        .expect(200);

      expect(disconnectResponse.body.success).toBe(true);
      expect(disconnectResponse.body.message).toContain('Successfully disconnected');

      expect(PlatformConnectionModel.deactivate).toHaveBeenCalledWith('connection-disconnect');
    });
  });
});
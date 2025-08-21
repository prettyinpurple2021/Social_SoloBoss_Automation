import request from 'supertest';
import express from 'express';
import oauthRoutes from '../routes/oauth';
import { OAuthService } from '../services/OAuthService';
import { PlatformConnectionModel } from '../models/PlatformConnection';
import { Platform } from '../types/database';

// Mock services
jest.mock('../services/OAuthService');
jest.mock('../models/PlatformConnection');

const mockedOAuthService = OAuthService as jest.Mocked<typeof OAuthService>;
const mockedPlatformConnectionModel = PlatformConnectionModel as jest.Mocked<typeof PlatformConnectionModel>;

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  }
}));

describe('OAuth Routes', () => {
  let app: express.Application;
  const mockUserId = 'user-123';
  const mockPlatform = Platform.FACEBOOK;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/oauth', oauthRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/oauth/:platform/auth', () => {
    it('should generate OAuth authorization URL', async () => {
      const mockAuthUrl = 'https://facebook.com/oauth?client_id=123&redirect_uri=callback';
      mockedOAuthService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/oauth/facebook/auth')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          authUrl: mockAuthUrl,
          platform: 'facebook'
        }
      });

      expect(mockedOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        Platform.FACEBOOK,
        mockUserId
      );
    });

    it('should return 400 for invalid platform', async () => {
      const response = await request(app)
        .get('/api/oauth/invalid-platform/auth')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle service errors', async () => {
      mockedOAuthService.generateAuthUrl.mockImplementation(() => {
        throw new Error('OAuth not configured');
      });

      const response = await request(app)
        .get('/api/oauth/facebook/auth')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OAuth not configured');
    });
  });

  describe('POST /api/oauth/:platform/callback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'oauth-state-123';

    it('should successfully handle OAuth callback', async () => {
      const mockConnection = {
        id: 'connection-123',
        platform: Platform.FACEBOOK,
        username: 'Test User',
        isActive: true
      };

      mockedOAuthService.exchangeCodeForToken.mockResolvedValue({
        success: true,
        connection: mockConnection
      });

      const response = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: mockCode, state: mockState })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockConnection,
        message: 'Successfully connected facebook account'
      });

      expect(mockedOAuthService.exchangeCodeForToken).toHaveBeenCalledWith(
        Platform.FACEBOOK,
        mockCode,
        mockState
      );
    });

    it('should return 400 for missing code', async () => {
      const response = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ state: mockState })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing state', async () => {
      const response = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: mockCode })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle OAuth service failure', async () => {
      mockedOAuthService.exchangeCodeForToken.mockResolvedValue({
        success: false,
        error: 'Invalid authorization code'
      });

      const response = await request(app)
        .post('/api/oauth/facebook/callback')
        .send({ code: mockCode, state: mockState })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid authorization code');
    });
  });

  describe('GET /api/oauth/connections', () => {
    it('should return user platform connections', async () => {
      const mockConnections = [
        {
          id: 'connection-1',
          platform: Platform.FACEBOOK,
          platform_username: 'Facebook User',
          is_active: true,
          created_at: new Date('2023-01-01'),
          token_expires_at: new Date('2024-01-01')
        },
        {
          id: 'connection-2',
          platform: Platform.INSTAGRAM,
          platform_username: 'Instagram User',
          is_active: true,
          created_at: new Date('2023-01-02'),
          token_expires_at: null
        }
      ];

      mockedPlatformConnectionModel.findActiveByUserId.mockResolvedValue(mockConnections as any);

      const response = await request(app)
        .get('/api/oauth/connections')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toEqual({
        id: 'connection-1',
        platform: Platform.FACEBOOK,
        username: 'Facebook User',
        isActive: true,
        connectedAt: '2023-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T00:00:00.000Z'
      });

      expect(mockedPlatformConnectionModel.findActiveByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle database errors', async () => {
      mockedPlatformConnectionModel.findActiveByUserId.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/oauth/connections')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch platform connections');
    });
  });

  describe('DELETE /api/oauth/:platform/disconnect', () => {
    it('should successfully disconnect platform', async () => {
      mockedOAuthService.disconnectPlatform.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .delete('/api/oauth/facebook/disconnect')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully disconnected facebook account'
      });

      expect(mockedOAuthService.disconnectPlatform).toHaveBeenCalledWith(
        mockUserId,
        Platform.FACEBOOK
      );
    });

    it('should return 400 for invalid platform', async () => {
      const response = await request(app)
        .delete('/api/oauth/invalid-platform/disconnect')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle disconnection failure', async () => {
      mockedOAuthService.disconnectPlatform.mockResolvedValue({
        success: false,
        error: 'Platform connection not found'
      });

      const response = await request(app)
        .delete('/api/oauth/facebook/disconnect')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Platform connection not found');
    });
  });

  describe('POST /api/oauth/:platform/refresh', () => {
    it('should successfully refresh token', async () => {
      const mockConnection = {
        id: 'connection-123',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook-user-123',
        platform_username: 'Test User',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date(),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(mockConnection);
      mockedOAuthService.refreshToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/oauth/facebook/refresh')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully refreshed facebook token'
      });

      expect(mockedOAuthService.refreshToken).toHaveBeenCalledWith('connection-123');
    });

    it('should return 404 for non-existent connection', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/oauth/facebook/refresh')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Platform connection not found');
    });

    it('should handle refresh failure', async () => {
      const mockConnection = {
        id: 'connection-123',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook-user-123',
        platform_username: 'Test User',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date(),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(mockConnection);
      mockedOAuthService.refreshToken.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/oauth/facebook/refresh')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to refresh token');
    });
  });

  describe('GET /api/oauth/:platform/status', () => {
    it('should return connection status for connected platform', async () => {
      const mockConnection = {
        id: 'connection-123',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook-user-123',
        platform_username: 'Test User',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date('2024-12-31'),
        is_active: true,
        created_at: new Date('2023-01-01'),
        updated_at: new Date()
      };

      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(mockConnection);
      mockedOAuthService.getValidToken.mockResolvedValue('valid-token');

      const response = await request(app)
        .get('/api/oauth/facebook/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          connected: true,
          platform: Platform.FACEBOOK,
          username: 'Test User',
          connectedAt: '2023-01-01T00:00:00.000Z',
          expiresAt: '2024-12-31T00:00:00.000Z',
          needsRefresh: false
        }
      });
    });

    it('should return not connected for non-existent connection', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/oauth/facebook/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          connected: false,
          platform: Platform.FACEBOOK
        }
      });
    });

    it('should indicate needs refresh for invalid token', async () => {
      const mockConnection = {
        id: 'connection-123',
        user_id: mockUserId,
        platform: Platform.FACEBOOK,
        platform_user_id: 'facebook-user-123',
        platform_username: 'Test User',
        access_token: 'encrypted-token',
        refresh_token: 'encrypted-refresh-token',
        token_expires_at: new Date('2024-12-31'),
        is_active: true,
        created_at: new Date('2023-01-01'),
        updated_at: new Date()
      };

      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValue(mockConnection);
      mockedOAuthService.getValidToken.mockResolvedValue(null); // Invalid token

      const response = await request(app)
        .get('/api/oauth/facebook/status')
        .expect(200);

      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.needsRefresh).toBe(true);
    });
  });
});
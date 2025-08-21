import { OAuthService } from '../services/OAuthService';
import { EncryptionService } from '../services/EncryptionService';
import { PlatformConnectionModel } from '../models/PlatformConnection';
import { Platform } from '../types/database';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock PlatformConnectionModel
jest.mock('../models/PlatformConnection');
const mockedPlatformConnectionModel = PlatformConnectionModel as jest.Mocked<typeof PlatformConnectionModel>;

// Mock EncryptionService
jest.mock('../services/EncryptionService');
const mockedEncryptionService = EncryptionService as jest.Mocked<typeof EncryptionService>;

describe('OAuthService', () => {
  const mockUserId = 'user-123';
  const mockPlatform = Platform.FACEBOOK;
  const mockCode = 'auth-code-123';
  const mockAccessToken = 'access-token-123';
  const mockRefreshToken = 'refresh-token-123';

  beforeAll(() => {
    // Setup environment variables
    process.env.FACEBOOK_CLIENT_ID = 'facebook-client-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'facebook-client-secret';
    process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:3001/api/oauth/facebook/callback';
    process.env.ENCRYPTION_KEY = 'test-encryption-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock EncryptionService methods
    mockedEncryptionService.encrypt.mockImplementation((text) => `encrypted-${text}`);
    mockedEncryptionService.decrypt.mockImplementation((text) => text.replace('encrypted-', ''));
    mockedEncryptionService.generateNonce.mockReturnValue('test-nonce');
    mockedEncryptionService.encryptToken.mockImplementation((token) => ({
      accessToken: `encrypted-${token.accessToken}`,
      refreshToken: token.refreshToken ? `encrypted-${token.refreshToken}` : undefined
    }));
    mockedEncryptionService.decryptToken.mockImplementation((token) => ({
      accessToken: token.accessToken.replace('encrypted-', ''),
      refreshToken: token.refreshToken ? token.refreshToken.replace('encrypted-', '') : undefined
    }));
  });

  describe('generateAuthUrl', () => {
    it('should generate valid OAuth authorization URL', () => {
      const authUrl = OAuthService.generateAuthUrl(mockPlatform, mockUserId);
      
      expect(authUrl).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(authUrl).toContain('client_id=facebook-client-id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=pages_manage_posts');
    });

    it('should throw error for unconfigured platform', () => {
      delete process.env.FACEBOOK_CLIENT_ID;
      
      expect(() => {
        OAuthService.generateAuthUrl(mockPlatform, mockUserId);
      }).toThrow('OAuth not configured for platform: facebook');
    });
  });

  describe('exchangeCodeForToken', () => {
    const mockState = 'encrypted-oauth-state';
    const mockTokenResponse = {
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      expires_in: 3600,
      token_type: 'Bearer'
    };
    const mockUserInfo = {
      id: 'facebook-user-123',
      name: 'Test User',
      email: 'test@example.com'
    };
    const mockConnection = {
      id: 'connection-123',
      user_id: mockUserId,
      platform: mockPlatform,
      platform_user_id: 'facebook-user-123',
      platform_username: 'Test User',
      access_token: `encrypted-${mockAccessToken}`,
      refresh_token: `encrypted-${mockRefreshToken}`,
      token_expires_at: new Date(Date.now() + 3600000),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    beforeEach(() => {
      // Reset all mocks for each test
      jest.clearAllMocks();
      
      // Re-setup basic mocks
      mockedEncryptionService.encrypt.mockImplementation((text) => `encrypted-${text}`);
      mockedEncryptionService.decrypt.mockImplementation((text) => text.replace('encrypted-', ''));
      mockedEncryptionService.generateNonce.mockReturnValue('test-nonce');
      mockedEncryptionService.encryptToken.mockImplementation((token) => ({
        accessToken: `encrypted-${token.accessToken}`,
        refreshToken: token.refreshToken ? `encrypted-${token.refreshToken}` : undefined
      }));
      mockedEncryptionService.decryptToken.mockImplementation((token) => ({
        accessToken: token.accessToken.replace('encrypted-', ''),
        refreshToken: token.refreshToken ? token.refreshToken.replace('encrypted-', '') : undefined
      }));
    });

    it('should successfully exchange code for token', async () => {
      // Mock state verification
      mockedEncryptionService.decrypt.mockReturnValueOnce(JSON.stringify({
        userId: mockUserId,
        platform: mockPlatform,
        timestamp: Date.now() - 1000,
        nonce: 'test-nonce'
      }));

      // Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });
      
      // Mock user info fetch
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserInfo });
      
      // Mock database save
      mockedPlatformConnectionModel.create.mockResolvedValueOnce(mockConnection);

      const result = await OAuthService.exchangeCodeForToken(mockPlatform, mockCode, mockState);
      
      expect(result.success).toBe(true);
      expect(result.connection).toEqual({
        id: 'connection-123',
        platform: mockPlatform,
        username: 'Test User',
        isActive: true
      });
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/oauth/access_token',
        expect.objectContaining({
          grant_type: 'authorization_code',
          client_id: 'facebook-client-id',
          client_secret: 'facebook-client-secret',
          code: mockCode
        }),
        expect.any(Object)
      );
      
      expect(mockedPlatformConnectionModel.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        platform: mockPlatform,
        platform_user_id: 'facebook-user-123',
        platform_username: 'Test User',
        access_token: `encrypted-${mockAccessToken}`,
        refresh_token: `encrypted-${mockRefreshToken}`,
        token_expires_at: expect.any(Date)
      });
    });

    it('should handle platform mismatch in state', async () => {
      // Override the decrypt mock for this specific test
      mockedEncryptionService.decrypt.mockImplementationOnce((text) => {
        return JSON.stringify({
          userId: mockUserId,
          platform: Platform.INSTAGRAM, // Different platform
          timestamp: Date.now() - 1000,
          nonce: 'test-nonce'
        });
      });

      const result = await OAuthService.exchangeCodeForToken(mockPlatform, mockCode, mockState);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Platform mismatch');
    });

    it('should handle expired state', async () => {
      // Override the decrypt mock for this specific test
      mockedEncryptionService.decrypt.mockImplementationOnce((text) => {
        return JSON.stringify({
          userId: mockUserId,
          platform: mockPlatform,
          timestamp: Date.now() - (15 * 60 * 1000), // 15 minutes ago (expired)
          nonce: 'test-nonce'
        });
      });

      const result = await OAuthService.exchangeCodeForToken(mockPlatform, mockCode, mockState);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should handle token exchange failure', async () => {
      // Mock state verification first
      mockedEncryptionService.decrypt.mockReturnValueOnce(JSON.stringify({
        userId: mockUserId,
        platform: mockPlatform,
        timestamp: Date.now() - 1000,
        nonce: 'test-nonce'
      }));

      // Mock token exchange failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Token exchange failed'));

      const result = await OAuthService.exchangeCodeForToken(mockPlatform, mockCode, mockState);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    const mockConnectionId = 'connection-123';
    const mockConnection = {
      id: mockConnectionId,
      user_id: mockUserId,
      platform: mockPlatform,
      platform_user_id: 'facebook-user-123',
      platform_username: 'Test User',
      access_token: `encrypted-${mockAccessToken}`,
      refresh_token: `encrypted-${mockRefreshToken}`,
      token_expires_at: new Date(Date.now() + 3600000),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should successfully refresh token', async () => {
      const newAccessToken = 'new-access-token-123';
      const mockRefreshResponse = {
        access_token: newAccessToken,
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockedPlatformConnectionModel.findById.mockResolvedValueOnce(mockConnection);
      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });
      mockedPlatformConnectionModel.update.mockResolvedValueOnce({
        ...mockConnection,
        access_token: `encrypted-${newAccessToken}`
      });

      const result = await OAuthService.refreshToken(mockConnectionId);
      
      expect(result).toBe(true);
      expect(mockedPlatformConnectionModel.update).toHaveBeenCalledWith(
        mockConnectionId,
        expect.objectContaining({
          access_token: `encrypted-${newAccessToken}`,
          token_expires_at: expect.any(Date)
        })
      );
    });

    it('should return false for non-existent connection', async () => {
      mockedPlatformConnectionModel.findById.mockResolvedValueOnce(null);

      const result = await OAuthService.refreshToken(mockConnectionId);
      
      expect(result).toBe(false);
    });

    it('should return false for connection without refresh token', async () => {
      const connectionWithoutRefresh = { ...mockConnection, refresh_token: undefined };
      mockedPlatformConnectionModel.findById.mockResolvedValueOnce(connectionWithoutRefresh);

      const result = await OAuthService.refreshToken(mockConnectionId);
      
      expect(result).toBe(false);
    });

    it('should handle refresh failure', async () => {
      mockedPlatformConnectionModel.findById.mockResolvedValueOnce(mockConnection);
      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      const result = await OAuthService.refreshToken(mockConnectionId);
      
      expect(result).toBe(false);
    });
  });

  describe('disconnectPlatform', () => {
    const mockConnection = {
      id: 'connection-123',
      user_id: mockUserId,
      platform: mockPlatform,
      platform_user_id: 'facebook-user-123',
      platform_username: 'Test User',
      access_token: `encrypted-${mockAccessToken}`,
      refresh_token: `encrypted-${mockRefreshToken}`,
      token_expires_at: new Date(Date.now() + 3600000),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should successfully disconnect platform', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(mockConnection);
      mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });
      mockedPlatformConnectionModel.deactivate.mockResolvedValueOnce({
        ...mockConnection,
        is_active: false
      });

      const result = await OAuthService.disconnectPlatform(mockUserId, mockPlatform);
      
      expect(result.success).toBe(true);
      expect(mockedPlatformConnectionModel.deactivate).toHaveBeenCalledWith('connection-123');
    });

    it('should return error for non-existent connection', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(null);

      const result = await OAuthService.disconnectPlatform(mockUserId, mockPlatform);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getValidToken', () => {
    const mockConnection = {
      id: 'connection-123',
      user_id: mockUserId,
      platform: mockPlatform,
      platform_user_id: 'facebook-user-123',
      platform_username: 'Test User',
      access_token: `encrypted-${mockAccessToken}`,
      refresh_token: `encrypted-${mockRefreshToken}`,
      token_expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)), // 24 hours from now
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should return valid token', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(mockConnection);

      const token = await OAuthService.getValidToken(mockUserId, mockPlatform);
      
      expect(token).toBe(mockAccessToken);
    });

    it('should return null for inactive connection', async () => {
      const inactiveConnection = { ...mockConnection, is_active: false };
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(inactiveConnection);

      const token = await OAuthService.getValidToken(mockUserId, mockPlatform);
      
      expect(token).toBeNull();
    });

    it('should return null for non-existent connection', async () => {
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(null);

      const token = await OAuthService.getValidToken(mockUserId, mockPlatform);
      
      expect(token).toBeNull();
    });

    it('should refresh expiring token', async () => {
      const expiringConnection = {
        ...mockConnection,
        token_expires_at: new Date(Date.now() + (60 * 60 * 1000)) // 1 hour from now (within buffer)
      };
      
      mockedPlatformConnectionModel.findByUserAndPlatform.mockResolvedValueOnce(expiringConnection);
      
      // Mock successful refresh
      const newAccessToken = 'new-access-token-123';
      const mockRefreshResponse = {
        access_token: newAccessToken,
        expires_in: 3600,
        token_type: 'Bearer'
      };
      
      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });
      mockedPlatformConnectionModel.findById.mockResolvedValueOnce(expiringConnection);
      mockedPlatformConnectionModel.update.mockResolvedValueOnce({
        ...expiringConnection,
        access_token: `encrypted-${newAccessToken}`
      });
      mockedPlatformConnectionModel.findById.mockResolvedValueOnce({
        ...expiringConnection,
        access_token: `encrypted-${newAccessToken}`
      });

      const token = await OAuthService.getValidToken(mockUserId, mockPlatform);
      
      expect(token).toBe(newAccessToken);
    });
  });
});
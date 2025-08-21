import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth, requireOwnership, extractUserId } from '../middleware/auth';
import { AuthService } from '../services/AuthService';

// Mock the AuthService
jest.mock('../services/AuthService');
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashedpassword123',
    settings: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    mockRequest = {
      headers: {},
      params: {},
      body: {},
      query: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token and set user', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith('valid.jwt.token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no token provided', async () => {
      mockRequest.headers = {};

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockResolvedValue(null);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if authentication service throws error', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Service error'));

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication failed'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat'
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required'
      });
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith('valid.jwt.token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user if no token provided', async () => {
      mockRequest.headers = {};

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.getUserFromToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user if token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockResolvedValue(null);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user if service throws error', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token'
      };
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Service error'));

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    it('should allow access if user owns the resource (from params)', () => {
      mockRequest.user = mockUser;
      mockRequest.params = { userId: mockUser.id };

      const middleware = requireOwnership('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access if user owns the resource (from body)', () => {
      mockRequest.user = mockUser;
      mockRequest.body = { userId: mockUser.id };

      const middleware = requireOwnership('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access if user owns the resource (from query)', () => {
      mockRequest.user = mockUser;
      mockRequest.query = { userId: mockUser.id };

      const middleware = requireOwnership('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: 'some-user-id' };

      const middleware = requireOwnership('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not own the resource', () => {
      mockRequest.user = mockUser;
      mockRequest.params = { userId: 'different-user-id' };

      const middleware = requireOwnership('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied: insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use default parameter name if not specified', () => {
      mockRequest.user = mockUser;
      mockRequest.params = { userId: mockUser.id };

      const middleware = requireOwnership();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('extractUserId', () => {
    it('should add userId to request body if user is authenticated', async () => {
      mockRequest.user = mockUser;
      mockRequest.body = {};

      await extractUserId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.userId).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not modify request body if user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {};

      await extractUserId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue even if an error occurs', async () => {
      mockRequest.user = mockUser;
      mockRequest.body = null; // This might cause an error

      await extractUserId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
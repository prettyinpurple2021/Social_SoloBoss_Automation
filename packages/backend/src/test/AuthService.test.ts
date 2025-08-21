import { AuthService, LoginCredentials, RegisterInput } from '../services/AuthService';
import { UserModel } from '../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock the UserModel
jest.mock('../models/User');
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
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
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Set default environment variables for testing
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  describe('hashPassword', () => {
    it('should hash a password using bcrypt', async () => {
      const password = 'testpassword123';
      const hashedPassword = 'hashedpassword123';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await AuthService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a password against a hash', async () => {
      const password = 'testpassword123';
      const hash = 'hashedpassword123';
      
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await AuthService.verifyPassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'wrongpassword';
      const hash = 'hashedpassword123';
      
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await AuthService.verifyPassword(password, hash);

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token for a user', () => {
      const token = 'generated.jwt.token';
      mockJwt.sign.mockReturnValue(token as never);

      const result = AuthService.generateToken(mockUser);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email
        },
        'test-secret',
        { expiresIn: '24h' }
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid JWT token', () => {
      const token = 'valid.jwt.token';
      const payload = {
        userId: mockUser.id,
        email: mockUser.email,
        iat: 1234567890,
        exp: 1234567890
      };
      
      mockJwt.verify.mockReturnValue(payload as never);

      const result = AuthService.verifyToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(result).toEqual(payload);
    });

    it('should return null for invalid token', () => {
      const token = 'invalid.jwt.token';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = AuthService.verifyToken(token);

      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    const registerInput: RegisterInput = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'TestPassword123',
      settings: { timezone: 'UTC' }
    };

    it('should successfully register a new user', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashedpassword123' as never);
      mockUserModel.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValue('generated.jwt.token' as never);

      const result = await AuthService.register(registerInput);

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registerInput.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerInput.password, 12);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        email: registerInput.email,
        name: registerInput.name,
        password_hash: 'hashedpassword123',
        settings: registerInput.settings
      });
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('generated.jwt.token');
    });

    it('should fail if user already exists', async () => {
      mockUserModel.findByEmail.mockResolvedValue(mockUser);

      const result = await AuthService.register(registerInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });

    it('should handle registration errors', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockRejectedValue(new Error('Hashing failed') as never);

      const result = await AuthService.register(registerInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hashing failed');
    });
  });

  describe('login', () => {
    const loginCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    it('should successfully login with valid credentials', async () => {
      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue('generated.jwt.token' as never);

      const result = await AuthService.login(loginCredentials);

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(loginCredentials.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginCredentials.password, mockUser.password_hash);
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('generated.jwt.token');
    });

    it('should fail with invalid email', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);

      const result = await AuthService.login(loginCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail with invalid password', async () => {
      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await AuthService.login(loginCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should handle login errors', async () => {
      mockUserModel.findByEmail.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.login(loginCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getUserFromToken', () => {
    it('should return user for valid token', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        userId: mockUser.id,
        email: mockUser.email
      };
      
      mockJwt.verify.mockReturnValue(payload as never);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await AuthService.getUserFromToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(mockUserModel.findById).toHaveBeenCalledWith(payload.userId);
      expect(result).toEqual(mockUser);
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid.jwt.token';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await AuthService.getUserFromToken(token);

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      const token = 'valid.jwt.token';
      const payload = {
        userId: 'nonexistent-user-id',
        email: 'test@example.com'
      };
      
      mockJwt.verify.mockReturnValue(payload as never);
      mockUserModel.findById.mockResolvedValue(null);

      const result = await AuthService.getUserFromToken(token);

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    const userId = mockUser.id;
    const currentPassword = 'currentPassword123';
    const newPassword = 'newPassword123';

    it('should successfully change password', async () => {
      const updatedUser = { ...mockUser, password_hash: 'newhashedpassword123' };
      
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('newhashedpassword123' as never);
      mockUserModel.update.mockResolvedValue(updatedUser);

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, mockUser.password_hash);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserModel.update).toHaveBeenCalledWith(userId, {
        password_hash: 'newhashedpassword123'
      });
      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
    });

    it('should fail if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should fail if current password is incorrect', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should handle password change errors', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockRejectedValue(new Error('Hashing failed') as never);

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hashing failed');
    });
  });
});
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/User';

// Mock the dependencies
jest.mock('../services/AuthService');
jest.mock('../models/User');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashedpassword123',
    settings: { timezone: 'UTC' },
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'TestPassword123',
      settings: { timezone: 'UTC' }
    };

    it('should register a new user successfully', async () => {
      mockAuthService.register.mockResolvedValue({
        success: true,
        user: mockUser,
        token: 'jwt.token.here'
      });

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined(); // Should be removed from response
      expect(response.body.token).toBe('jwt.token.here');
      expect(mockAuthService.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 for weak password', async () => {
      const invalidData = { ...validRegisterData, password: 'weak' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for short name', async () => {
      const invalidData = { ...validRegisterData, name: 'A' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if user already exists', async () => {
      mockAuthService.register.mockResolvedValue({
        success: false,
        error: 'User with this email already exists'
      });

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('should return 500 for server errors', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Registration failed');
    });
  });

  describe('POST /auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    it('should login successfully with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        user: mockUser,
        token: 'jwt.token.here'
      });

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined();
      expect(response.body.token).toBe('jwt.token.here');
      expect(mockAuthService.login).toHaveBeenCalledWith(validLoginData);
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = { ...validLoginData, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing password', async () => {
      const invalidData = { email: validLoginData.email };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid email or password'
      });

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 500 for server errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Login failed');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid.jwt.token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid.jwt.token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined();
      expect(response.body.user.email).toBe(mockUser.email);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 401 with invalid token', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('PUT /auth/profile', () => {
    const updateData = {
      name: 'Updated Name',
      email: 'updated@example.com',
      settings: { timezone: 'EST' }
    };

    it('should update profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateData };
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockUserModel.findByEmail.mockResolvedValue(null); // Email not taken
      mockUserModel.update.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/auth/profile')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe(updateData.name);
      expect(response.body.user.email).toBe(updateData.email);
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should return 400 if email is already taken', async () => {
      const otherUser = { ...mockUser, id: 'different-id' };
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockUserModel.findByEmail.mockResolvedValue(otherUser);

      const response = await request(app)
        .put('/auth/profile')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is already taken');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/auth/profile')
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid name', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/auth/profile')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send({ name: 'A' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /auth/password', () => {
    const passwordData = {
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword123'
    };

    it('should change password successfully', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockAuthService.changePassword.mockResolvedValue({
        success: true,
        user: mockUser
      });

      const response = await request(app)
        .put('/auth/password')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        passwordData.currentPassword,
        passwordData.newPassword
      );
    });

    it('should return 400 for weak new password', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/auth/password')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send({
          currentPassword: 'CurrentPassword123',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for incorrect current password', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockAuthService.changePassword.mockResolvedValue({
        success: false,
        error: 'Current password is incorrect'
      });

      const response = await request(app)
        .put('/auth/password')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send(passwordData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put('/auth/password')
        .send(passwordData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { UserRow, CreateUserInput, UserSettings } from '../types/database';
import { SettingsService } from './SettingsService';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  settings?: UserSettings;
}

export interface AuthResult {
  success: boolean;
  user?: UserRow;
  token?: string;
  error?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  
  private static get JWT_SECRET(): string {
    return process.env.JWT_SECRET || 'your-secret-key';
  }
  
  private static get JWT_EXPIRES_IN(): string {
    return process.env.JWT_EXPIRES_IN || '24h';
  }

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token for a user
   */
  static generateToken(user: UserRow): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Register a new user
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await UserModel.findByEmail(input.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Hash the password
      const passwordHash = await this.hashPassword(input.password);

      // Create user with default settings
      const defaultSettings = SettingsService.getDefaultSettings();
      const createUserInput: CreateUserInput = {
        email: input.email,
        name: input.name,
        password_hash: passwordHash,
        settings: input.settings ? { ...defaultSettings, ...input.settings } : defaultSettings
      };

      const user = await UserModel.create(createUserInput);

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Authenticate a user with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      // Find user by email
      const user = await UserModel.findByEmail(credentials.email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  /**
   * Get user by token
   */
  static async getUserFromToken(token: string): Promise<UserRow | null> {
    const payload = this.verifyToken(token);
    if (!payload) {
      return null;
    }

    return UserModel.findById(payload.userId);
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify current password
      const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update user
      const updatedUser = await UserModel.update(userId, {
        password_hash: newPasswordHash
      });

      return {
        success: true,
        user: updatedUser || undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password change failed'
      };
    }
  }
}
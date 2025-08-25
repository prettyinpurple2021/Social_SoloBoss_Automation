import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../models/User';
import { UserRow, CreateUserInput, UserSettings } from '../types/database';
import { SettingsService } from './SettingsService';
import { securityService } from './SecurityService';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { EncryptionService } from './EncryptionService';
import { auditService } from './AuditService';
import { db } from '../database/connection';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

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
  sessionId: string;
  tokenType: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days
  private static readonly MAX_SESSIONS_PER_USER = 5;
  
  private static get JWT_SECRET(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
  }
  
  private static get JWT_REFRESH_SECRET(): string {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    return secret;
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
   * Generate access and refresh token pair
   */
  static async generateTokenPair(user: UserRow, ipAddress: string, userAgent: string): Promise<TokenPair> {
    const sessionId = EncryptionService.generateSecureRandom(32);
    
    // Create access token
    const accessPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      sessionId,
      tokenType: 'access'
    };

    // Create refresh token
    const refreshPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      sessionId,
      tokenType: 'refresh'
    };

    const accessToken = jwt.sign(accessPayload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'social-media-automation',
      audience: 'sma-client'
    });

    const refreshToken = jwt.sign(refreshPayload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'social-media-automation',
      audience: 'sma-client'
    });

    // Store session in database
    await this.createUserSession(user.id, sessionId, accessToken, refreshToken, ipAddress, userAgent);

    // Calculate expiration times
    const accessExpiresIn = 15 * 60; // 15 minutes in seconds
    const refreshExpiresIn = 7 * 24 * 60 * 60; // 7 days in seconds

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refreshExpiresIn
    };
  }

  /**
   * Generate a JWT token for a user (legacy method for backward compatibility)
   */
  static generateToken(user: UserRow): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      sessionId: EncryptionService.generateSecureRandom(16),
      tokenType: 'access'
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'social-media-automation',
      audience: 'sma-client'
    });
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): JWTPayload | null {
    try {
      const secret = tokenType === 'access' ? this.JWT_SECRET : this.JWT_REFRESH_SECRET;
      const payload = jwt.verify(token, secret, {
        issuer: 'social-media-automation',
        audience: 'sma-client'
      }) as JWTPayload;

      // Verify token type matches expected
      if (payload.tokenType !== tokenType) {
        loggerService.warn('Token type mismatch', {
          expected: tokenType,
          actual: payload.tokenType,
          userId: payload.userId
        });
        return null;
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        loggerService.debug('Token expired', { tokenType });
      } else if (error instanceof jwt.JsonWebTokenError) {
        loggerService.warn('Invalid token', { 
          tokenType, 
          error: error.message 
        });
      }
      return null;
    }
  }

  /**
   * Refresh access token using refresh token with rotation
   */
  static async refreshAccessToken(refreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPair | null> {
    try {
      // Verify refresh token
      const payload = this.verifyToken(refreshToken, 'refresh');
      if (!payload) {
        loggerService.warn('Invalid refresh token provided', { ipAddress });
        return null;
      }

      // Check if session exists and is active
      const session = await this.getUserSession(payload.sessionId);
      if (!session || !session.isActive) {
        loggerService.warn('Invalid or inactive session for token refresh', {
          sessionId: payload.sessionId,
          userId: payload.userId,
          ipAddress
        });
        return null;
      }

      // Verify refresh token matches stored token (constant-time comparison)
      const storedTokenBuffer = Buffer.from(session.refreshToken, 'utf8');
      const providedTokenBuffer = Buffer.from(refreshToken, 'utf8');
      
      if (storedTokenBuffer.length !== providedTokenBuffer.length || 
          !crypto.timingSafeEqual(storedTokenBuffer, providedTokenBuffer)) {
        loggerService.error('Refresh token mismatch - possible token theft', {
          sessionId: payload.sessionId,
          userId: payload.userId,
          ipAddress,
          userAgent
        });
        
        // Invalidate all sessions for this user as a security measure
        await this.invalidateAllUserSessions(payload.userId);
        
        // Log security incident
        await auditService.logSecurityEvent(
          'suspicious_activity',
          'Refresh token mismatch detected - possible token theft',
          payload.userId,
          ipAddress,
          {
            sessionId: payload.sessionId,
            userAgent,
            reason: 'refresh_token_mismatch'
          }
        );
        
        throw new AppError(
          'Invalid refresh token',
          ErrorCode.TOKEN_EXPIRED,
          401,
          ErrorSeverity.HIGH,
          false,
          { userId: payload.userId, reason: 'token_mismatch' }
        );
      }

      // Check for suspicious activity (multiple refresh attempts from different IPs)
      const recentRefreshes = await db.query(`
        SELECT COUNT(*) as count, COUNT(DISTINCT ip_address) as ip_count
        FROM audit_logs
        WHERE user_id = $1 
        AND action = 'token_refresh'
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [payload.userId]);

      const refreshCount = parseInt(recentRefreshes.rows[0]?.count || '0');
      const ipCount = parseInt(recentRefreshes.rows[0]?.ip_count || '0');

      if (refreshCount > 10 || ipCount > 3) {
        loggerService.warn('Suspicious token refresh activity detected', {
          userId: payload.userId,
          refreshCount,
          ipCount,
          ipAddress
        });
        
        await auditService.logSecurityEvent(
          'suspicious_activity',
          'Excessive token refresh attempts detected',
          payload.userId,
          ipAddress,
          {
            refreshCount,
            ipCount,
            timeWindow: '1 hour'
          }
        );
      }

      // Get user
      const user = await UserModel.findById(payload.userId);
      if (!user) {
        loggerService.warn('User not found during token refresh', {
          userId: payload.userId,
          sessionId: payload.sessionId
        });
        return null;
      }

      // Generate new token pair with rotation
      const newTokenPair = await this.generateTokenPair(user, ipAddress, userAgent);

      // Invalidate old session (refresh token rotation)
      await this.invalidateUserSession(payload.sessionId);

      // Log successful token refresh
      await auditService.logAuthentication(
        user.id,
        user.email,
        'token_refresh',
        true,
        ipAddress,
        userAgent
      );

      loggerService.info('Access token refreshed with rotation', {
        userId: user.id,
        oldSessionId: payload.sessionId,
        ipAddress
      });

      return newTokenPair;
    } catch (error) {
      loggerService.error('Failed to refresh access token', error as Error, {
        ipAddress,
        userAgent
      });
      
      // Log failed refresh attempt
      if (error instanceof AppError && error.context?.userId) {
        await auditService.logAuthentication(
          error.context.userId,
          'unknown',
          'token_refresh',
          false,
          ipAddress,
          userAgent,
          error.message
        );
      }
      
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
  static async login(credentials: LoginCredentials, ipAddress: string, userAgent: string): Promise<AuthResult & { tokenPair?: TokenPair }> {
    try {
      // Check for account lockout
      const lockoutStatus = await securityService.isLockedOut(credentials.email, ipAddress);
      if (lockoutStatus.locked) {
        await securityService.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          'Account locked'
        );

        return {
          success: false,
          error: `Account is locked. Try again after ${lockoutStatus.unlockAt?.toLocaleString()}`
        };
      }

      // Detect suspicious activity
      const suspiciousActivity = await securityService.detectSuspiciousActivity(
        credentials.email,
        ipAddress,
        userAgent
      );

      if (suspiciousActivity.suspicious && suspiciousActivity.riskScore > 70) {
        await securityService.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          'Suspicious activity detected'
        );

        return {
          success: false,
          error: 'Login blocked due to suspicious activity. Please contact support.'
        };
      }

      // Find user by email
      const user = await UserModel.findByEmail(credentials.email);
      if (!user) {
        await securityService.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          'User not found'
        );

        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
      if (!isValidPassword) {
        await securityService.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          'Invalid password'
        );

        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Successful login - record it
      await securityService.recordLoginAttempt(
        credentials.email,
        ipAddress,
        userAgent,
        true
      );

      // Clean up old sessions if user has too many
      await this.cleanupOldSessions(user.id);

      // Generate token pair
      const tokenPair = await this.generateTokenPair(user, ipAddress, userAgent);

      // Log successful login
      loggerService.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent
      });

      // Record metrics
      monitoringService.incrementCounter('user_logins_total', 1, {
        success: 'true',
        email_domain: user.email.split('@')[1] || 'unknown'
      });

      return {
        success: true,
        user,
        token: tokenPair.accessToken, // For backward compatibility
        tokenPair
      };
    } catch (error) {
      loggerService.error('Login failed', error as Error, {
        email: credentials.email,
        ipAddress
      });

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

  /**
   * Create a new user session
   */
  private static async createUserSession(
    userId: string,
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(`
      INSERT INTO user_sessions (id, user_id, session_token, refresh_token, expires_at, ip_address, user_agent, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
    `, [sessionId, userId, accessToken, refreshToken, expiresAt, ipAddress, userAgent]);
  }

  /**
   * Get user session by session ID
   */
  private static async getUserSession(sessionId: string): Promise<UserSession | null> {
    const result = await db.query(`
      SELECT id, user_id, session_token, refresh_token, expires_at, ip_address, user_agent, is_active, created_at, updated_at
      FROM user_sessions
      WHERE id = $1 AND is_active = true AND expires_at > NOW()
    `, [sessionId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      refreshToken: row.refresh_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Invalidate a user session
   */
  static async invalidateUserSession(sessionId: string): Promise<void> {
    await db.query(`
      UPDATE user_sessions
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [sessionId]);
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateAllUserSessions(userId: string): Promise<void> {
    await db.query(`
      UPDATE user_sessions
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND is_active = true
    `, [userId]);

    loggerService.info('All user sessions invalidated', { userId });
  }

  /**
   * Clean up old sessions for a user (keep only the most recent ones)
   */
  private static async cleanupOldSessions(userId: string): Promise<void> {
    await db.query(`
      UPDATE user_sessions
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 
      AND is_active = true
      AND id NOT IN (
        SELECT id FROM user_sessions
        WHERE user_id = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT $2
      )
    `, [userId, this.MAX_SESSIONS_PER_USER - 1]); // -1 because we're about to create a new one
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<UserSession[]> {
    const result = await db.query(`
      SELECT id, user_id, session_token, refresh_token, expires_at, ip_address, user_agent, is_active, created_at, updated_at
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      refreshToken: row.refresh_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  /**
   * Logout user (invalidate specific session)
   */
  static async logout(sessionId: string): Promise<boolean> {
    try {
      await this.invalidateUserSession(sessionId);
      
      loggerService.info('User logged out', { sessionId });
      monitoringService.incrementCounter('user_logouts_total', 1);
      
      return true;
    } catch (error) {
      loggerService.error('Failed to logout user', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * Logout from all devices (invalidate all sessions)
   */
  static async logoutFromAllDevices(userId: string): Promise<boolean> {
    try {
      await this.invalidateAllUserSessions(userId);
      
      loggerService.info('User logged out from all devices', { userId });
      monitoringService.incrementCounter('user_logouts_all_devices_total', 1);
      
      return true;
    } catch (error) {
      loggerService.error('Failed to logout user from all devices', error as Error, { userId });
      return false;
    }
  }

  /**
   * Validate password strength using security service
   */
  static validatePasswordStrength(password: string): {
    valid: boolean;
    issues: string[];
    score: number;
  } {
    return securityService.validatePassword(password);
  }

  /**
   * Clean up expired sessions (should be run periodically)
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await db.query(`
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE expires_at < NOW() AND is_active = true
      `);

      loggerService.info('Expired sessions cleaned up', { 
        count: result.rowCount 
      });
    } catch (error) {
      loggerService.error('Failed to cleanup expired sessions', error as Error);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserRow | null> {
    try {
      const user = await UserModel.findById(userId);
      return user;
    } catch (error) {
      loggerService.error('Failed to get user by ID', error as Error, { userId });
      return null;
    }
  }
}
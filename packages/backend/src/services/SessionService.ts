import { randomBytes } from 'crypto';
import { cacheService } from './CacheService';
import { Config } from '../config';

export interface SessionData {
  userId: string;
  email: string;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: SessionData;
  error?: string;
}

export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private static readonly SESSION_TTL = Config.security.sessionTimeoutHours * 60 * 60; // Convert to seconds

  /**
   * Create a new session
   */
  static async createSession(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const sessionData: SessionData = {
      userId,
      email,
      createdAt: now,
      lastAccessedAt: now,
      ipAddress,
      userAgent,
      isActive: true
    };

    // Store session data
    await cacheService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      sessionData,
      { ttl: this.SESSION_TTL }
    );

    // Track user sessions
    await this.addUserSession(userId, sessionId);

    return sessionId;
  }

  /**
   * Validate and refresh a session
   */
  static async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const sessionData = await cacheService.get<SessionData>(sessionKey);

      if (!sessionData) {
        return {
          isValid: false,
          error: 'Session not found or expired'
        };
      }

      if (!sessionData.isActive) {
        return {
          isValid: false,
          error: 'Session is inactive'
        };
      }

      // Update last accessed time
      sessionData.lastAccessedAt = new Date();
      await cacheService.set(sessionKey, sessionData, { ttl: this.SESSION_TTL });

      return {
        isValid: true,
        session: sessionData
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Session validation failed'
      };
    }
  }

  /**
   * Invalidate a session
   */
  static async invalidateSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionData = await cacheService.get<SessionData>(sessionKey);

    if (sessionData) {
      await this.removeUserSession(sessionData.userId, sessionId);
    }

    await cacheService.delete(sessionKey);
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await cacheService.get<string[]>(userSessionsKey);

    if (sessionIds) {
      // Remove all session data
      const deletePromises = sessionIds.map(sessionId => 
        cacheService.delete(`${this.SESSION_PREFIX}${sessionId}`)
      );
      
      await Promise.all(deletePromises);
      
      // Clear user sessions list
      await cacheService.delete(userSessionsKey);
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await cacheService.get<string[]>(userSessionsKey);

    if (!sessionIds) {
      return [];
    }

    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await cacheService.get<SessionData>(`${this.SESSION_PREFIX}${sessionId}`);
      if (sessionData && sessionData.isActive) {
        sessions.push(sessionData);
      }
    }

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    // This would typically be handled by Redis TTL, but we can implement
    // additional cleanup logic here if needed
    return 0;
  }

  /**
   * Generate a secure session ID
   */
  private static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Add session to user's session list
   */
  private static async addUserSession(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    let sessionIds = await cacheService.get<string[]>(userSessionsKey) || [];
    
    sessionIds.push(sessionId);
    
    // Keep only the last 10 sessions per user
    if (sessionIds.length > 10) {
      const oldSessionId = sessionIds.shift();
      if (oldSessionId) {
        await cacheService.delete(`${this.SESSION_PREFIX}${oldSessionId}`);
      }
    }
    
    await cacheService.set(userSessionsKey, sessionIds, { ttl: this.SESSION_TTL });
  }

  /**
   * Remove session from user's session list
   */
  private static async removeUserSession(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await cacheService.get<string[]>(userSessionsKey);
    
    if (sessionIds) {
      const filteredIds = sessionIds.filter(id => id !== sessionId);
      
      if (filteredIds.length > 0) {
        await cacheService.set(userSessionsKey, filteredIds, { ttl: this.SESSION_TTL });
      } else {
        await cacheService.delete(userSessionsKey);
      }
    }
  }

  /**
   * Validate access token
   */
  static async validateAccessToken(accessToken: string): Promise<{ userId: string; sessionId: string }> {
    // This is a simplified implementation
    // In a real app, you'd decode and validate the JWT token
    try {
      // For now, we'll assume the token contains the user ID
      // In practice, you'd use a JWT library to decode and validate
      const decoded = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
      return {
        userId: decoded.userId,
        sessionId: decoded.sessionId
      };
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }
}

export const sessionService = SessionService;
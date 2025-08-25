import { randomBytes } from 'crypto';
import { CacheService } from './CacheService';
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
    await CacheService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      this.SESSION_TTL
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
      const sessionDataStr = await CacheService.get(sessionKey);

      if (!sessionDataStr) {
        return {
          isValid: false,
          error: 'Session not found or expired'
        };
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);

      if (!sessionData.isActive) {
        return {
          isValid: false,
          error: 'Session is inactive'
        };
      }

      // Update last accessed time
      sessionData.lastAccessedAt = new Date();
      await CacheService.set(sessionKey, JSON.stringify(sessionData), this.SESSION_TTL);

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
    const sessionDataStr = await CacheService.get(sessionKey);

    if (sessionDataStr) {
      const sessionData: SessionData = JSON.parse(sessionDataStr);
      await this.removeUserSession(sessionData.userId, sessionId);
    }

    await CacheService.delete(sessionKey);
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIdsStr = await CacheService.get(userSessionsKey);

    if (sessionIdsStr) {
      const sessionIds: string[] = JSON.parse(sessionIdsStr);
      
      // Remove all session data
      const deletePromises = sessionIds.map(sessionId => 
        CacheService.delete(`${this.SESSION_PREFIX}${sessionId}`)
      );
      
      await Promise.all(deletePromises);
      
      // Clear user sessions list
      await CacheService.delete(userSessionsKey);
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIdsStr = await CacheService.get(userSessionsKey);

    if (!sessionIdsStr) {
      return [];
    }

    const sessionIds: string[] = JSON.parse(sessionIdsStr);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const sessionDataStr = await CacheService.get(`${this.SESSION_PREFIX}${sessionId}`);
      if (sessionDataStr) {
        const sessionData: SessionData = JSON.parse(sessionDataStr);
        if (sessionData.isActive) {
          sessions.push(sessionData);
        }
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
    const sessionIdsStr = await CacheService.get(userSessionsKey);
    
    let sessionIds: string[] = [];
    if (sessionIdsStr) {
      sessionIds = JSON.parse(sessionIdsStr);
    }
    
    sessionIds.push(sessionId);
    
    // Keep only the last 10 sessions per user
    if (sessionIds.length > 10) {
      const oldSessionId = sessionIds.shift();
      if (oldSessionId) {
        await CacheService.delete(`${this.SESSION_PREFIX}${oldSessionId}`);
      }
    }
    
    await CacheService.set(userSessionsKey, JSON.stringify(sessionIds), this.SESSION_TTL);
  }

  /**
   * Remove session from user's session list
   */
  private static async removeUserSession(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIdsStr = await CacheService.get(userSessionsKey);
    
    if (sessionIdsStr) {
      let sessionIds: string[] = JSON.parse(sessionIdsStr);
      sessionIds = sessionIds.filter(id => id !== sessionId);
      
      if (sessionIds.length > 0) {
        await CacheService.set(userSessionsKey, JSON.stringify(sessionIds), this.SESSION_TTL);
      } else {
        await CacheService.delete(userSessionsKey);
      }
    }
  }
}

export const sessionService = SessionService;
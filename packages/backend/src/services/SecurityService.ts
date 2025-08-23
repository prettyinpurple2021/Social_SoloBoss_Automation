import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { db } from '../database/connection';
import { EncryptionService } from './EncryptionService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';

export interface SecurityPolicy {
  maxLoginAttempts: number;
  lockoutDuration: number; // in milliseconds
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionTimeout: number; // in milliseconds
  maxConcurrentSessions: number;
  requireMFA: boolean;
  ipWhitelistEnabled: boolean;
  allowedIPs: string[];
}

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
}

export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'account_lockout' | 'password_change' | 'suspicious_activity' | 'security_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface AccountLockout {
  email: string;
  ipAddress: string;
  lockedAt: Date;
  unlockAt: Date;
  attemptCount: number;
  reason: string;
}

export class SecurityService {
  private static instance: SecurityService;
  private defaultPolicy: SecurityPolicy = {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxConcurrentSessions: 5,
    requireMFA: false,
    ipWhitelistEnabled: false,
    allowedIPs: []
  };

  private constructor() {}

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Get security policy (can be customized per user/organization)
   */
  getSecurityPolicy(userId?: string): SecurityPolicy {
    // In a real implementation, this could be customized per user/organization
    return { ...this.defaultPolicy };
  }

  /**
   * Record a login attempt
   */
  async recordLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO failed_login_attempts (email, ip_address, user_agent, attempt_count, last_attempt_at, blocked_until)
        VALUES ($1, $2, $3, 1, NOW(), NULL)
        ON CONFLICT (email, ip_address)
        DO UPDATE SET
          attempt_count = CASE 
            WHEN failed_login_attempts.blocked_until IS NULL OR failed_login_attempts.blocked_until < NOW()
            THEN CASE WHEN $4 THEN 0 ELSE failed_login_attempts.attempt_count + 1 END
            ELSE failed_login_attempts.attempt_count
          END,
          last_attempt_at = NOW(),
          blocked_until = CASE
            WHEN $4 THEN NULL
            WHEN (CASE 
              WHEN failed_login_attempts.blocked_until IS NULL OR failed_login_attempts.blocked_until < NOW()
              THEN failed_login_attempts.attempt_count + 1
              ELSE failed_login_attempts.attempt_count
            END) >= $5 THEN NOW() + INTERVAL '15 minutes'
            ELSE failed_login_attempts.blocked_until
          END
      `, [email, ipAddress, userAgent, success, this.defaultPolicy.maxLoginAttempts]);

      // Log security event
      await this.logSecurityEvent({
        type: 'login_attempt',
        severity: success ? 'low' : 'medium',
        email,
        ipAddress,
        userAgent,
        details: {
          success,
          failureReason: failureReason || null
        }
      });

      // Record metrics
      monitoringService.incrementCounter('login_attempts_total', 1, {
        success: success.toString(),
        email_domain: email.split('@')[1] || 'unknown'
      });

      if (!success) {
        loggerService.security(`Failed login attempt for ${email}`, {
          email,
          ipAddress,
          userAgent,
          failureReason
        });
      }

    } catch (error) {
      loggerService.error('Failed to record login attempt', error as Error, {
        email,
        ipAddress,
        success
      });
    }
  }

  /**
   * Check if account/IP is locked out
   */
  async isLockedOut(email: string, ipAddress: string): Promise<{
    locked: boolean;
    unlockAt?: Date;
    attemptCount?: number;
    reason?: string;
  }> {
    try {
      const result = await db.query(`
        SELECT attempt_count, blocked_until
        FROM failed_login_attempts
        WHERE email = $1 AND ip_address = $2
        AND blocked_until IS NOT NULL
        AND blocked_until > NOW()
      `, [email, ipAddress]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          locked: true,
          unlockAt: new Date(row.blocked_until),
          attemptCount: row.attempt_count,
          reason: 'Too many failed login attempts'
        };
      }

      return { locked: false };
    } catch (error) {
      loggerService.error('Failed to check lockout status', error as Error, {
        email,
        ipAddress
      });
      // Fail safe - don't lock out if we can't check
      return { locked: false };
    }
  }

  /**
   * Manually unlock an account
   */
  async unlockAccount(email: string, ipAddress?: string, adminUserId?: string): Promise<boolean> {
    try {
      const whereClause = ipAddress ? 'email = $1 AND ip_address = $2' : 'email = $1';
      const params = ipAddress ? [email, ipAddress] : [email];

      await db.query(`
        UPDATE failed_login_attempts
        SET blocked_until = NULL, attempt_count = 0
        WHERE ${whereClause}
      `, params);

      await this.logSecurityEvent({
        type: 'account_lockout',
        severity: 'medium',
        email,
        ipAddress: ipAddress || 'all',
        details: {
          action: 'manual_unlock',
          adminUserId
        }
      });

      loggerService.security(`Account unlocked: ${email}`, {
        email,
        ipAddress,
        adminUserId
      });

      return true;
    } catch (error) {
      loggerService.error('Failed to unlock account', error as Error, {
        email,
        ipAddress,
        adminUserId
      });
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string, policy?: SecurityPolicy): {
    valid: boolean;
    issues: string[];
    score: number;
  } {
    const actualPolicy = policy || this.defaultPolicy;
    const issues: string[] = [];
    let score = 0;

    // Length check
    if (password.length < actualPolicy.passwordMinLength) {
      issues.push(`Password must be at least ${actualPolicy.passwordMinLength} characters long`);
    } else {
      score += Math.min(password.length * 2, 20);
    }

    // Character type checks
    if (actualPolicy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      issues.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    if (actualPolicy.passwordRequireLowercase && !/[a-z]/.test(password)) {
      issues.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    if (actualPolicy.passwordRequireNumbers && !/[0-9]/.test(password)) {
      issues.push('Password must contain at least one number');
    } else if (/[0-9]/.test(password)) {
      score += 10;
    }

    if (actualPolicy.passwordRequireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      issues.push('Password must contain at least one special character');
    } else if (/[^A-Za-z0-9]/.test(password)) {
      score += 15;
    }

    // Additional strength checks
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (/[A-Z].*[A-Z]/.test(password)) score += 5; // Multiple uppercase
    if (/[0-9].*[0-9]/.test(password)) score += 5; // Multiple numbers
    if (/[^A-Za-z0-9].*[^A-Za-z0-9]/.test(password)) score += 10; // Multiple special chars

    // Common password patterns (reduce score)
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        score -= 20;
        issues.push('Password contains common patterns that are easily guessed');
        break;
      }
    }

    // Sequential characters
    if (/012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
      score -= 10;
      issues.push('Password contains sequential characters');
    }

    // Repeated characters
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      issues.push('Password contains repeated characters');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      valid: issues.length === 0,
      issues,
      score
    };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const eventId = EncryptionService.generateSecureRandom(16);
      
      await db.query(`
        INSERT INTO security_events (id, type, severity, user_id, action, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        eventId,
        event.type,
        event.severity,
        null, // user_id would be resolved from email if needed
        event.type,
        JSON.stringify(event.details),
        event.ipAddress,
        event.userAgent || null
      ]);

      // Also log to application logs
      loggerService.security(`Security event: ${event.type}`, {
        eventId,
        type: event.type,
        severity: event.severity,
        email: event.email,
        ipAddress: event.ipAddress,
        details: event.details
      });

      // Record metrics
      monitoringService.incrementCounter('security_events_total', 1, {
        type: event.type,
        severity: event.severity
      });

      // Trigger alerts for high severity events
      if (event.severity === 'high' || event.severity === 'critical') {
        monitoringService.recordMetric('security_alert', 1, 'counter', {
          type: event.type,
          severity: event.severity
        });
      }

    } catch (error) {
      loggerService.error('Failed to log security event', error as Error, {
        eventType: event.type,
        severity: event.severity
      });
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    suspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // Check for rapid login attempts from different IPs
      const recentAttempts = await db.query(`
        SELECT COUNT(DISTINCT ip_address) as ip_count, COUNT(*) as total_attempts
        FROM failed_login_attempts
        WHERE email = $1 AND last_attempt_at > NOW() - INTERVAL '1 hour'
      `, [email]);

      if (recentAttempts.rows[0]?.ip_count > 3) {
        reasons.push('Multiple IP addresses used for login attempts');
        riskScore += 30;
      }

      if (recentAttempts.rows[0]?.total_attempts > 10) {
        reasons.push('High frequency of login attempts');
        riskScore += 25;
      }

      // Check for unusual user agent patterns
      if (!userAgent || userAgent.length < 10) {
        reasons.push('Suspicious or missing user agent');
        riskScore += 15;
      }

      // Check for known malicious IP patterns (simplified)
      if (this.isKnownMaliciousIP(ipAddress)) {
        reasons.push('IP address associated with malicious activity');
        riskScore += 50;
      }

      // Check for geographic anomalies (would require IP geolocation service)
      // This is a placeholder for more sophisticated geo-analysis
      if (this.isUnusualGeographicLocation(ipAddress, email)) {
        reasons.push('Login attempt from unusual geographic location');
        riskScore += 20;
      }

      // Log suspicious activity
      if (riskScore > 30) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: riskScore > 60 ? 'high' : 'medium',
          email,
          ipAddress,
          userAgent,
          details: {
            riskScore,
            reasons,
            detectionTime: new Date().toISOString()
          }
        });
      }

      return {
        suspicious: riskScore > 30,
        reasons,
        riskScore
      };

    } catch (error) {
      loggerService.error('Failed to detect suspicious activity', error as Error, {
        email,
        ipAddress
      });
      
      return {
        suspicious: false,
        reasons: [],
        riskScore: 0
      };
    }
  }

  /**
   * Check if IP is known to be malicious (simplified implementation)
   */
  private isKnownMaliciousIP(ipAddress: string): boolean {
    // In a real implementation, this would check against threat intelligence feeds
    const knownMaliciousPatterns = [
      /^10\.0\.0\.1$/, // Example pattern
      /^192\.168\.1\.1$/, // Example pattern
    ];

    return knownMaliciousPatterns.some(pattern => pattern.test(ipAddress));
  }

  /**
   * Check for unusual geographic location (placeholder)
   */
  private isUnusualGeographicLocation(ipAddress: string, email: string): boolean {
    // In a real implementation, this would:
    // 1. Get IP geolocation
    // 2. Compare with user's historical login locations
    // 3. Flag if significantly different
    return false;
  }

  /**
   * Get security metrics for monitoring
   */
  async getSecurityMetrics(timeRange: string = '24h'): Promise<{
    totalLoginAttempts: number;
    failedLoginAttempts: number;
    lockedAccounts: number;
    securityEvents: number;
    suspiciousActivity: number;
  }> {
    try {
      const interval = timeRange === '1h' ? '1 hour' : 
                     timeRange === '24h' ? '24 hours' : 
                     timeRange === '7d' ? '7 days' : '24 hours';

      const [loginAttempts, lockedAccounts, securityEvents] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE attempt_count > 0) as failed
          FROM failed_login_attempts
          WHERE last_attempt_at > NOW() - INTERVAL '${interval}'
        `),
        db.query(`
          SELECT COUNT(*) as count
          FROM failed_login_attempts
          WHERE blocked_until IS NOT NULL AND blocked_until > NOW()
        `),
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE type = 'suspicious_activity') as suspicious
          FROM security_events
          WHERE created_at > NOW() - INTERVAL '${interval}'
        `)
      ]);

      return {
        totalLoginAttempts: parseInt(loginAttempts.rows[0]?.total || '0'),
        failedLoginAttempts: parseInt(loginAttempts.rows[0]?.failed || '0'),
        lockedAccounts: parseInt(lockedAccounts.rows[0]?.count || '0'),
        securityEvents: parseInt(securityEvents.rows[0]?.total || '0'),
        suspiciousActivity: parseInt(securityEvents.rows[0]?.suspicious || '0')
      };
    } catch (error) {
      loggerService.error('Failed to get security metrics', error as Error);
      return {
        totalLoginAttempts: 0,
        failedLoginAttempts: 0,
        lockedAccounts: 0,
        securityEvents: 0,
        suspiciousActivity: 0
      };
    }
  }

  /**
   * Clean up old security data
   */
  async cleanupSecurityData(): Promise<void> {
    try {
      // Clean up old failed login attempts (older than 30 days)
      await db.query(`
        DELETE FROM failed_login_attempts
        WHERE last_attempt_at < NOW() - INTERVAL '30 days'
      `);

      // Clean up old security events (older than 90 days)
      await db.query(`
        DELETE FROM security_events
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      loggerService.info('Security data cleanup completed');
    } catch (error) {
      loggerService.error('Failed to cleanup security data', error as Error);
    }
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();
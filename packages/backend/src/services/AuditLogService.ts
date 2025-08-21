import { loggerService } from './LoggerService';
import { db } from '../database/connection';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'token_management' | 'data_access' | 'configuration' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  action: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Service for audit logging and security event tracking
 */
export class AuditLogService {
  /**
   * Log a general audit event
   */
  static async logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    try {
      // Store in database
      await db.query(`
        INSERT INTO audit_logs (
          user_id, action, resource, resource_id, details, 
          ip_address, user_agent, success, error, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        auditEntry.userId || null,
        auditEntry.action,
        auditEntry.resource,
        auditEntry.resourceId || null,
        JSON.stringify(auditEntry.details || {}),
        auditEntry.ip || null,
        auditEntry.userAgent || null,
        auditEntry.success,
        auditEntry.error || null,
        auditEntry.timestamp
      ]);

      // Also log to application logs
      loggerService.info('Audit event', auditEntry);
    } catch (error) {
      loggerService.error('Failed to log audit event', error as Error, { auditEntry });
    }
  }

  /**
   * Log a security-specific event
   */
  static async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    try {
      // Store in database
      await db.query(`
        INSERT INTO security_events (
          type, severity, user_id, action, details, 
          ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        securityEvent.type,
        securityEvent.severity,
        securityEvent.userId || null,
        securityEvent.action,
        JSON.stringify(securityEvent.details),
        securityEvent.ip || null,
        securityEvent.userAgent || null,
        securityEvent.timestamp
      ]);

      // Log with appropriate level based on severity
      if (securityEvent.severity === 'critical') {
        loggerService.error('Security event', new Error(securityEvent.action), securityEvent);
      } else if (securityEvent.severity === 'high') {
        loggerService.warn('Security event', securityEvent);
      } else {
        loggerService.info('Security event', securityEvent);
      }

      // Alert on critical events
      if (securityEvent.severity === 'critical') {
        await this.alertCriticalSecurityEvent(securityEvent);
      }
    } catch (error) {
      loggerService.error('Failed to log security event', error as Error, { securityEvent });
    }
  }

  /**
   * Log authentication events
   */
  static async logAuthenticationEvent(
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'password_change',
    userId?: string,
    details: Record<string, any> = {},
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const success = action.includes('success') || action === 'logout' || action === 'token_refresh' || action === 'password_change';
    const severity = action.includes('failure') ? 'medium' : 'low';

    await Promise.all([
      this.logAuditEvent({
        userId,
        action,
        resource: 'authentication',
        details,
        ip,
        userAgent,
        success
      }),
      this.logSecurityEvent({
        type: 'authentication',
        severity,
        userId,
        action,
        details,
        ip,
        userAgent
      })
    ]);
  }

  /**
   * Log token management events
   */
  static async logTokenEvent(
    action: 'token_created' | 'token_refreshed' | 'token_revoked' | 'token_expired' | 'token_validation_failed',
    userId: string,
    platform?: string,
    details: Record<string, any> = {},
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const success = !action.includes('failed') && !action.includes('expired');
    const severity = action.includes('failed') ? 'high' : 'low';

    await Promise.all([
      this.logAuditEvent({
        userId,
        action,
        resource: 'oauth_token',
        resourceId: platform,
        details,
        ip,
        userAgent,
        success
      }),
      this.logSecurityEvent({
        type: 'token_management',
        severity,
        userId,
        action,
        details: { platform, ...details },
        ip,
        userAgent
      })
    ]);
  }

  /**
   * Log data access events
   */
  static async logDataAccessEvent(
    action: 'read' | 'create' | 'update' | 'delete',
    resource: string,
    resourceId: string,
    userId?: string,
    details: Record<string, any> = {},
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: `${resource}_${action}`,
      resource,
      resourceId,
      details,
      ip,
      userAgent,
      success: true
    });
  }

  /**
   * Log authorization failures
   */
  static async logAuthorizationFailure(
    action: string,
    resource: string,
    userId?: string,
    details: Record<string, any> = {},
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await Promise.all([
      this.logAuditEvent({
        userId,
        action: `unauthorized_${action}`,
        resource,
        details,
        ip,
        userAgent,
        success: false,
        error: 'Insufficient permissions'
      }),
      this.logSecurityEvent({
        type: 'authorization',
        severity: 'medium',
        userId,
        action: `unauthorized_${action}`,
        details: { resource, ...details },
        ip,
        userAgent
      })
    ]);
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    action: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      severity,
      userId,
      action,
      details,
      ip,
      userAgent
    });
  }

  /**
   * Log configuration changes
   */
  static async logConfigurationChange(
    action: string,
    resource: string,
    oldValue: any,
    newValue: any,
    userId: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await Promise.all([
      this.logAuditEvent({
        userId,
        action: `config_${action}`,
        resource,
        details: { oldValue, newValue },
        ip,
        userAgent,
        success: true
      }),
      this.logSecurityEvent({
        type: 'configuration',
        severity: 'low',
        userId,
        action: `config_${action}`,
        details: { resource, oldValue, newValue },
        ip,
        userAgent
      })
    ]);
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      const result = await db.query(`
        SELECT 
          user_id as "userId",
          action,
          resource,
          resource_id as "resourceId",
          details,
          ip_address as "ip",
          user_agent as "userAgent",
          success,
          error,
          created_at as "timestamp"
        FROM audit_logs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      return result.rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }));
    } catch (error) {
      loggerService.error('Failed to retrieve user audit logs', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get security events
   */
  static async getSecurityEvents(
    limit: number = 100,
    offset: number = 0,
    severity?: string,
    type?: string
  ): Promise<SecurityEvent[]> {
    try {
      let query = `
        SELECT 
          type,
          severity,
          user_id as "userId",
          action,
          details,
          ip_address as "ip",
          user_agent as "userAgent",
          created_at as "timestamp"
        FROM security_events 
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (severity) {
        query += ` AND severity = $${++paramCount}`;
        params.push(severity);
      }

      if (type) {
        query += ` AND type = $${++paramCount}`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }));
    } catch (error) {
      loggerService.error('Failed to retrieve security events', error as Error);
      return [];
    }
  }

  /**
   * Alert on critical security events
   */
  private static async alertCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // In a real implementation, this would send alerts via email, Slack, etc.
    loggerService.error('CRITICAL SECURITY EVENT', new Error('Critical security event detected'), {
      event,
      alertLevel: 'CRITICAL'
    });

    // Could integrate with notification services here
    // await NotificationService.sendSecurityAlert(event);
  }

  /**
   * Clean up old audit logs (for data retention)
   */
  static async cleanupOldLogs(retentionDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const auditResult = await db.query(
        'DELETE FROM audit_logs WHERE created_at < $1',
        [cutoffDate]
      );

      const securityResult = await db.query(
        'DELETE FROM security_events WHERE created_at < $1',
        [cutoffDate]
      );

      loggerService.info('Cleaned up old audit logs', {
        auditLogsDeleted: auditResult.rowCount,
        securityEventsDeleted: securityResult.rowCount,
        cutoffDate
      });
    } catch (error) {
      loggerService.error('Failed to cleanup old audit logs', error as Error);
    }
  }
}
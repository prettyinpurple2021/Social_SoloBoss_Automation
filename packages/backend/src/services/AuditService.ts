import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { db } from '../database/connection';
import { EncryptionService } from './EncryptionService';

export interface AuditEvent {
  id?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  error?: string;
  timestamp?: Date;
}

export interface SecurityIncident {
  id: string;
  type: 'authentication_failure' | 'authorization_failure' | 'data_breach' | 'suspicious_activity' | 'system_compromise';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUsers: string[];
  affectedResources: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  details: Record<string, any>;
}

export interface ComplianceReport {
  period: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  eventsByType: Record<string, number>;
  securityIncidents: number;
  dataAccess: {
    total: number;
    unauthorized: number;
    byUser: Record<string, number>;
  };
  authentication: {
    successful: number;
    failed: number;
    locked: number;
  };
  dataModification: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const eventId = EncryptionService.generateSecureRandom(16);
      const timestamp = new Date();

      // Store in database
      await db.query(`
        INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details, ip_address, user_agent, success, error, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        eventId,
        event.userId || null,
        event.action,
        event.resource,
        event.resourceId || null,
        JSON.stringify(event.details),
        event.ipAddress || null,
        event.userAgent || null,
        event.success,
        event.error || null,
        timestamp
      ]);

      // Log to application logs
      loggerService.audit(`${event.action} on ${event.resource}`, {
        eventId,
        userId: event.userId,
        resource: event.resource,
        resourceId: event.resourceId,
        success: event.success,
        ipAddress: event.ipAddress,
        details: event.details
      });

      // Record metrics
      monitoringService.incrementCounter('audit_events_total', 1, {
        action: event.action,
        resource: event.resource,
        success: event.success.toString()
      });

      // Check for suspicious patterns
      await this.detectSuspiciousPatterns(event);

      return eventId;
    } catch (error) {
      loggerService.error('Failed to log audit event', error as Error, {
        action: event.action,
        resource: event.resource
      });
      throw error;
    }
  }

  /**
   * Log user authentication event
   */
  async logAuthentication(
    userId: string | null,
    email: string,
    action: 'login' | 'logout' | 'password_change' | 'password_reset',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    error?: string
  ): Promise<string> {
    return this.logEvent({
      userId,
      action: `user_${action}`,
      resource: 'authentication',
      resourceId: email,
      details: {
        email,
        action,
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent,
      success,
      error
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    action: 'read' | 'create' | 'update' | 'delete',
    success: boolean,
    ipAddress?: string,
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      userId,
      action: `data_${action}`,
      resource,
      resourceId,
      details: {
        operation: action,
        timestamp: new Date().toISOString(),
        ...details
      },
      ipAddress,
      success
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: 'suspicious_activity' | 'security_violation' | 'access_denied' | 'privilege_escalation',
    description: string,
    userId?: string,
    ipAddress?: string,
    details?: Record<string, any>
  ): Promise<string> {
    return this.logEvent({
      userId,
      action: `security_${type}`,
      resource: 'security',
      details: {
        type,
        description,
        timestamp: new Date().toISOString(),
        ...details
      },
      ipAddress,
      success: false // Security events are typically failures/violations
    });
  }

  /**
   * Log system administration event
   */
  async logAdminEvent(
    adminUserId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string
  ): Promise<string> {
    return this.logEvent({
      userId: adminUserId,
      action: `admin_${action}`,
      resource,
      resourceId,
      details: {
        adminAction: action,
        timestamp: new Date().toISOString(),
        ...details
      },
      ipAddress,
      success: true
    });
  }

  /**
   * Create security incident
   */
  async createSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'detectedAt' | 'status'>): Promise<string> {
    try {
      const incidentId = EncryptionService.generateSecureRandom(16);
      const detectedAt = new Date();

      await db.query(`
        INSERT INTO security_events (id, type, severity, user_id, action, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        incidentId,
        'security_incident',
        incident.severity,
        null, // Will be populated from affected users if needed
        incident.type,
        JSON.stringify({
          description: incident.description,
          affectedUsers: incident.affectedUsers,
          affectedResources: incident.affectedResources,
          details: incident.details,
          status: 'open'
        }),
        null,
        detectedAt
      ]);

      // Log critical incidents immediately
      if (incident.severity === 'critical' || incident.severity === 'high') {
        loggerService.error(`Security incident: ${incident.type}`, undefined, {
          incidentId,
          type: incident.type,
          severity: incident.severity,
          description: incident.description,
          affectedUsers: incident.affectedUsers.length,
          affectedResources: incident.affectedResources.length
        });

        // Trigger alert
        monitoringService.recordMetric('security_incident', 1, 'counter', {
          type: incident.type,
          severity: incident.severity
        });
      }

      return incidentId;
    } catch (error) {
      loggerService.error('Failed to create security incident', error as Error, {
        type: incident.type,
        severity: incident.severity
      });
      throw error;
    }
  }

  /**
   * Get audit events for a user
   */
  async getUserAuditEvents(
    userId: string,
    limit: number = 100,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditEvent[]> {
    try {
      let query = `
        SELECT id, user_id, action, resource, resource_id, details, ip_address, user_agent, success, error, created_at
        FROM audit_logs
        WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        details: JSON.parse(row.details || '{}'),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: row.success,
        error: row.error,
        timestamp: new Date(row.created_at)
      }));
    } catch (error) {
      loggerService.error('Failed to get user audit events', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get audit events for a resource
   */
  async getResourceAuditEvents(
    resource: string,
    resourceId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditEvent[]> {
    try {
      let query = `
        SELECT id, user_id, action, resource, resource_id, details, ip_address, user_agent, success, error, created_at
        FROM audit_logs
        WHERE resource = $1
      `;
      const params: any[] = [resource];

      if (resourceId) {
        query += ` AND resource_id = $2`;
        params.push(resourceId);
        query += ` ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
        params.push(limit, offset);
      } else {
        query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        params.push(limit, offset);
      }

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        details: JSON.parse(row.details || '{}'),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: row.success,
        error: row.error,
        timestamp: new Date(row.created_at)
      }));
    } catch (error) {
      loggerService.error('Failed to get resource audit events', error as Error, { resource, resourceId });
      return [];
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    try {
      // Get total events
      const totalEventsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      // Get events by type
      const eventsByTypeResult = await db.query(`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY action
      `, [startDate, endDate]);

      // Get security incidents
      const securityIncidentsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM security_events
        WHERE created_at BETWEEN $1 AND $2
        AND type = 'security_incident'
      `, [startDate, endDate]);

      // Get authentication stats
      const authStatsResult = await db.query(`
        SELECT 
          action,
          success,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        AND resource = 'authentication'
        GROUP BY action, success
      `, [startDate, endDate]);

      // Get data modification stats
      const dataModStatsResult = await db.query(`
        SELECT 
          CASE 
            WHEN action LIKE '%create%' THEN 'created'
            WHEN action LIKE '%update%' THEN 'updated'
            WHEN action LIKE '%delete%' THEN 'deleted'
            ELSE 'other'
          END as operation,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        AND action LIKE 'data_%'
        GROUP BY operation
      `, [startDate, endDate]);

      // Process results
      const eventsByType: Record<string, number> = {};
      eventsByTypeResult.rows.forEach(row => {
        eventsByType[row.action] = parseInt(row.count);
      });

      const authentication = {
        successful: 0,
        failed: 0,
        locked: 0
      };

      authStatsResult.rows.forEach(row => {
        if (row.success) {
          authentication.successful += parseInt(row.count);
        } else {
          authentication.failed += parseInt(row.count);
        }
      });

      const dataModification = {
        created: 0,
        updated: 0,
        deleted: 0
      };

      dataModStatsResult.rows.forEach(row => {
        if (row.operation in dataModification) {
          (dataModification as any)[row.operation] = parseInt(row.count);
        }
      });

      return {
        period: { start: startDate, end: endDate },
        totalEvents: parseInt(totalEventsResult.rows[0]?.count || '0'),
        eventsByType,
        securityIncidents: parseInt(securityIncidentsResult.rows[0]?.count || '0'),
        dataAccess: {
          total: Object.values(eventsByType).reduce((sum, count) => sum + count, 0),
          unauthorized: 0, // Would need additional logic to determine
          byUser: {} // Would need additional query
        },
        authentication,
        dataModification
      };
    } catch (error) {
      loggerService.error('Failed to generate compliance report', error as Error, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      throw error;
    }
  }

  /**
   * Detect suspicious patterns in audit events
   */
  private async detectSuspiciousPatterns(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Check for rapid successive failures
      if (!event.success && event.userId) {
        const recentFailures = await db.query(`
          SELECT COUNT(*) as count
          FROM audit_logs
          WHERE user_id = $1
          AND success = false
          AND created_at > NOW() - INTERVAL '5 minutes'
        `, [event.userId]);

        if (parseInt(recentFailures.rows[0]?.count || '0') > 5) {
          await this.createSecurityIncident({
            type: 'suspicious_activity',
            severity: 'medium',
            description: `Rapid successive failures detected for user ${event.userId}`,
            affectedUsers: [event.userId],
            affectedResources: [event.resource],
            details: {
              pattern: 'rapid_failures',
              failureCount: recentFailures.rows[0].count,
              timeWindow: '5 minutes'
            }
          });
        }
      }

      // Check for unusual access patterns
      if (event.success && event.userId && event.ipAddress) {
        const recentIPs = await db.query(`
          SELECT DISTINCT ip_address
          FROM audit_logs
          WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '1 hour'
          AND ip_address IS NOT NULL
        `, [event.userId]);

        if (recentIPs.rows.length > 3) {
          await this.createSecurityIncident({
            type: 'suspicious_activity',
            severity: 'medium',
            description: `Multiple IP addresses detected for user ${event.userId}`,
            affectedUsers: [event.userId],
            affectedResources: ['authentication'],
            details: {
              pattern: 'multiple_ips',
              ipCount: recentIPs.rows.length,
              timeWindow: '1 hour'
            }
          });
        }
      }
    } catch (error) {
      loggerService.error('Failed to detect suspicious patterns', error as Error);
    }
  }

  /**
   * Clean up old audit logs (for compliance with data retention policies)
   */
  async cleanupOldAuditLogs(retentionDays: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db.query(`
        DELETE FROM audit_logs
        WHERE created_at < $1
      `, [cutoffDate]);

      loggerService.info('Audit logs cleanup completed', {
        deletedCount: result.rowCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays
      });
    } catch (error) {
      loggerService.error('Failed to cleanup old audit logs', error as Error, { retentionDays });
    }
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();
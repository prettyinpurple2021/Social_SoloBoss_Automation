import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { auditService } from './AuditService';
import { securityService } from './SecurityService';
import { db } from '../database/connection';
import { EncryptionService } from './EncryptionService';

export interface SecurityIncident {
  id: string;
  type: 'authentication_failure' | 'authorization_failure' | 'data_breach' | 'suspicious_activity' | 'system_compromise' | 'malicious_input' | 'rate_limit_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedUsers: string[];
  affectedResources: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
  assignedTo?: string;
  responseActions: ResponseAction[];
  details: Record<string, any>;
  metadata: {
    detectionMethod: string;
    confidence: number;
    riskScore: number;
    impactAssessment: string;
  };
}

export interface ResponseAction {
  id: string;
  type: 'block_ip' | 'disable_user' | 'revoke_tokens' | 'alert_admin' | 'backup_data' | 'isolate_system' | 'notify_users';
  description: string;
  executedAt: Date;
  executedBy: string;
  success: boolean;
  details: Record<string, any>;
}

export interface IncidentMetrics {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  averageResolutionTime: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  responseEffectiveness: number;
}

export class IncidentResponseService {
  private static instance: IncidentResponseService;
  private activeIncidents: Map<string, SecurityIncident> = new Map();
  private responsePlaybooks: Map<string, ResponsePlaybook> = new Map();

  private constructor() {
    this.initializePlaybooks();
  }

  static getInstance(): IncidentResponseService {
    if (!IncidentResponseService.instance) {
      IncidentResponseService.instance = new IncidentResponseService();
    }
    return IncidentResponseService.instance;
  }

  /**
   * Create a new security incident
   */
  async createIncident(incident: Omit<SecurityIncident, 'id' | 'detectedAt' | 'status' | 'responseActions'>): Promise<string> {
    try {
      const incidentId = EncryptionService.generateSecureRandom(16);
      const now = new Date();

      const fullIncident: SecurityIncident = {
        ...incident,
        id: incidentId,
        detectedAt: now,
        status: 'open',
        responseActions: []
      };

      // Store in database
      await db.query(`
        INSERT INTO security_incidents (
          id, type, severity, title, description, affected_users, affected_resources,
          detected_at, status, details, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        incidentId,
        incident.type,
        incident.severity,
        incident.title,
        incident.description,
        JSON.stringify(incident.affectedUsers),
        JSON.stringify(incident.affectedResources),
        now,
        'open',
        JSON.stringify(incident.details),
        JSON.stringify(incident.metadata),
        now
      ]);

      // Add to active incidents
      this.activeIncidents.set(incidentId, fullIncident);

      // Log the incident
      loggerService.error(`Security incident created: ${incident.title}`, undefined, {
        incidentId,
        type: incident.type,
        severity: incident.severity,
        affectedUsers: incident.affectedUsers.length,
        affectedResources: incident.affectedResources.length
      });

      // Record metrics
      monitoringService.incrementCounter('security_incidents_total', 1, {
        type: incident.type,
        severity: incident.severity
      });

      // Execute automated response based on severity and type
      await this.executeAutomatedResponse(fullIncident);

      // Send alerts for high/critical incidents
      if (incident.severity === 'high' || incident.severity === 'critical') {
        await this.sendIncidentAlert(fullIncident);
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
   * Update incident status
   */
  async updateIncidentStatus(
    incidentId: string, 
    status: SecurityIncident['status'], 
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    try {
      const incident = this.activeIncidents.get(incidentId);
      if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
      }

      const now = new Date();
      const resolvedAt = status === 'resolved' ? now : undefined;

      await db.query(`
        UPDATE security_incidents 
        SET status = $1, resolved_at = $2, updated_at = $3, updated_by = $4, notes = $5
        WHERE id = $6
      `, [status, resolvedAt, now, updatedBy, notes || null, incidentId]);

      incident.status = status;
      incident.resolvedAt = resolvedAt;

      if (status === 'resolved') {
        this.activeIncidents.delete(incidentId);
        
        // Calculate resolution time
        const resolutionTime = now.getTime() - incident.detectedAt.getTime();
        monitoringService.recordMetric('incident_resolution_time', resolutionTime, 'histogram', {
          type: incident.type,
          severity: incident.severity
        });
      }

      loggerService.info(`Incident status updated`, {
        incidentId,
        status,
        updatedBy,
        resolutionTime: resolvedAt ? now.getTime() - incident.detectedAt.getTime() : undefined
      });
    } catch (error) {
      loggerService.error('Failed to update incident status', error as Error, { incidentId, status });
      throw error;
    }
  }

  /**
   * Execute response action
   */
  async executeResponseAction(
    incidentId: string,
    actionType: ResponseAction['type'],
    executedBy: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    try {
      const incident = this.activeIncidents.get(incidentId);
      if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
      }

      const actionId = EncryptionService.generateSecureRandom(12);
      const now = new Date();

      let success = false;
      let actionDetails = { ...details };

      // Execute the action
      switch (actionType) {
        case 'block_ip':
          success = await this.blockIP(details.ipAddress);
          break;
        case 'disable_user':
          success = await this.disableUser(details.userId);
          break;
        case 'revoke_tokens':
          success = await this.revokeUserTokens(details.userId);
          break;
        case 'alert_admin':
          success = await this.alertAdministrators(incident);
          break;
        case 'backup_data':
          success = await this.backupAffectedData(incident.affectedResources);
          break;
        case 'notify_users':
          success = await this.notifyAffectedUsers(incident.affectedUsers, details.message);
          break;
        default:
          success = false;
          actionDetails.error = 'Unknown action type';
      }

      const action: ResponseAction = {
        id: actionId,
        type: actionType,
        description: this.getActionDescription(actionType, details),
        executedAt: now,
        executedBy,
        success,
        details: actionDetails
      };

      // Store action in database
      await db.query(`
        INSERT INTO incident_response_actions (
          id, incident_id, type, description, executed_at, executed_by, success, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        actionId,
        incidentId,
        actionType,
        action.description,
        now,
        executedBy,
        success,
        JSON.stringify(actionDetails)
      ]);

      // Add to incident
      incident.responseActions.push(action);

      loggerService.info(`Response action executed`, {
        incidentId,
        actionId,
        actionType,
        success,
        executedBy
      });

      return actionId;
    } catch (error) {
      loggerService.error('Failed to execute response action', error as Error, {
        incidentId,
        actionType,
        executedBy
      });
      throw error;
    }
  }

  /**
   * Get incident metrics
   */
  async getIncidentMetrics(timeRange: string = '24h'): Promise<IncidentMetrics> {
    try {
      const interval = timeRange === '1h' ? '1 hour' : 
                     timeRange === '24h' ? '24 hours' : 
                     timeRange === '7d' ? '7 days' : '24 hours';

      const [totalResult, openResult, criticalResult, typeResult, severityResult] = await Promise.all([
        db.query(`
          SELECT COUNT(*) as count
          FROM security_incidents
          WHERE detected_at > NOW() - INTERVAL '${interval}'
        `),
        db.query(`
          SELECT COUNT(*) as count
          FROM security_incidents
          WHERE status IN ('open', 'investigating', 'contained')
        `),
        db.query(`
          SELECT COUNT(*) as count
          FROM security_incidents
          WHERE severity = 'critical' AND detected_at > NOW() - INTERVAL '${interval}'
        `),
        db.query(`
          SELECT type, COUNT(*) as count
          FROM security_incidents
          WHERE detected_at > NOW() - INTERVAL '${interval}'
          GROUP BY type
        `),
        db.query(`
          SELECT severity, COUNT(*) as count
          FROM security_incidents
          WHERE detected_at > NOW() - INTERVAL '${interval}'
          GROUP BY severity
        `)
      ]);

      // Calculate average resolution time
      const resolutionResult = await db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))) as avg_resolution_seconds
        FROM security_incidents
        WHERE resolved_at IS NOT NULL AND detected_at > NOW() - INTERVAL '${interval}'
      `);

      const incidentsByType: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        incidentsByType[row.type] = parseInt(row.count);
      });

      const incidentsBySeverity: Record<string, number> = {};
      severityResult.rows.forEach(row => {
        incidentsBySeverity[row.severity] = parseInt(row.count);
      });

      return {
        totalIncidents: parseInt(totalResult.rows[0]?.count || '0'),
        openIncidents: parseInt(openResult.rows[0]?.count || '0'),
        criticalIncidents: parseInt(criticalResult.rows[0]?.count || '0'),
        averageResolutionTime: parseFloat(resolutionResult.rows[0]?.avg_resolution_seconds || '0'),
        incidentsByType,
        incidentsBySeverity,
        responseEffectiveness: await this.calculateResponseEffectiveness()
      };
    } catch (error) {
      loggerService.error('Failed to get incident metrics', error as Error);
      throw error;
    }
  }

  /**
   * Execute automated response based on incident type and severity
   */
  private async executeAutomatedResponse(incident: SecurityIncident): Promise<void> {
    const playbook = this.responsePlaybooks.get(`${incident.type}_${incident.severity}`);
    if (!playbook) {
      return;
    }

    for (const action of playbook.automatedActions) {
      try {
        await this.executeResponseAction(
          incident.id,
          action.type,
          'system',
          action.parameters
        );
      } catch (error) {
        loggerService.error('Failed to execute automated response action', error as Error, {
          incidentId: incident.id,
          actionType: action.type
        });
      }
    }
  }

  /**
   * Block IP address
   */
  private async blockIP(ipAddress: string): Promise<boolean> {
    try {
      // Add to blocked IPs table
      await db.query(`
        INSERT INTO blocked_ips (ip_address, blocked_at, blocked_by, reason)
        VALUES ($1, NOW(), 'incident_response', 'Security incident')
        ON CONFLICT (ip_address) DO UPDATE SET
          blocked_at = NOW(),
          blocked_by = 'incident_response',
          reason = 'Security incident'
      `, [ipAddress]);

      loggerService.info(`IP address blocked`, { ipAddress });
      return true;
    } catch (error) {
      loggerService.error('Failed to block IP address', error as Error, { ipAddress });
      return false;
    }
  }

  /**
   * Disable user account
   */
  private async disableUser(userId: string): Promise<boolean> {
    try {
      await db.query(`
        UPDATE users 
        SET is_active = false, disabled_at = NOW(), disabled_reason = 'Security incident'
        WHERE id = $1
      `, [userId]);

      // Invalidate all user sessions
      await db.query(`
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      loggerService.info(`User account disabled`, { userId });
      return true;
    } catch (error) {
      loggerService.error('Failed to disable user account', error as Error, { userId });
      return false;
    }
  }

  /**
   * Revoke all user tokens
   */
  private async revokeUserTokens(userId: string): Promise<boolean> {
    try {
      await db.query(`
        UPDATE user_sessions
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

      loggerService.info(`User tokens revoked`, { userId });
      return true;
    } catch (error) {
      loggerService.error('Failed to revoke user tokens', error as Error, { userId });
      return false;
    }
  }

  /**
   * Alert administrators
   */
  private async alertAdministrators(incident: SecurityIncident): Promise<boolean> {
    try {
      // In a real implementation, this would send emails, Slack messages, etc.
      loggerService.error(`SECURITY ALERT: ${incident.title}`, undefined, {
        incidentId: incident.id,
        type: incident.type,
        severity: incident.severity,
        description: incident.description
      });

      monitoringService.recordMetric('security_alert_sent', 1, 'counter', {
        type: incident.type,
        severity: incident.severity
      });

      return true;
    } catch (error) {
      loggerService.error('Failed to alert administrators', error as Error);
      return false;
    }
  }

  /**
   * Backup affected data
   */
  private async backupAffectedData(resources: string[]): Promise<boolean> {
    try {
      // In a real implementation, this would trigger data backup procedures
      loggerService.info(`Data backup initiated for affected resources`, { resources });
      return true;
    } catch (error) {
      loggerService.error('Failed to backup affected data', error as Error, { resources });
      return false;
    }
  }

  /**
   * Notify affected users
   */
  private async notifyAffectedUsers(userIds: string[], message: string): Promise<boolean> {
    try {
      // In a real implementation, this would send notifications to users
      loggerService.info(`User notifications sent`, { 
        userCount: userIds.length,
        message: message.substring(0, 100)
      });
      return true;
    } catch (error) {
      loggerService.error('Failed to notify affected users', error as Error);
      return false;
    }
  }

  /**
   * Send incident alert
   */
  private async sendIncidentAlert(incident: SecurityIncident): Promise<void> {
    await this.executeResponseAction(
      incident.id,
      'alert_admin',
      'system',
      { incident }
    );
  }

  /**
   * Get action description
   */
  private getActionDescription(actionType: ResponseAction['type'], details: Record<string, any>): string {
    switch (actionType) {
      case 'block_ip':
        return `Blocked IP address: ${details.ipAddress}`;
      case 'disable_user':
        return `Disabled user account: ${details.userId}`;
      case 'revoke_tokens':
        return `Revoked all tokens for user: ${details.userId}`;
      case 'alert_admin':
        return 'Sent alert to administrators';
      case 'backup_data':
        return 'Initiated data backup for affected resources';
      case 'notify_users':
        return `Notified ${details.userCount || 'affected'} users`;
      default:
        return `Executed ${actionType} action`;
    }
  }

  /**
   * Calculate response effectiveness
   */
  private async calculateResponseEffectiveness(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(*) FILTER (WHERE success = true) as successful_actions
        FROM incident_response_actions
        WHERE executed_at > NOW() - INTERVAL '30 days'
      `);

      const total = parseInt(result.rows[0]?.total_actions || '0');
      const successful = parseInt(result.rows[0]?.successful_actions || '0');

      return total > 0 ? (successful / total) * 100 : 0;
    } catch (error) {
      loggerService.error('Failed to calculate response effectiveness', error as Error);
      return 0;
    }
  }

  /**
   * Initialize response playbooks
   */
  private initializePlaybooks(): void {
    // Critical authentication failure playbook
    this.responsePlaybooks.set('authentication_failure_critical', {
      name: 'Critical Authentication Failure Response',
      automatedActions: [
        { type: 'block_ip', parameters: {} },
        { type: 'alert_admin', parameters: {} }
      ]
    });

    // High suspicious activity playbook
    this.responsePlaybooks.set('suspicious_activity_high', {
      name: 'High Suspicious Activity Response',
      automatedActions: [
        { type: 'revoke_tokens', parameters: {} },
        { type: 'alert_admin', parameters: {} }
      ]
    });

    // Critical system compromise playbook
    this.responsePlaybooks.set('system_compromise_critical', {
      name: 'Critical System Compromise Response',
      automatedActions: [
        { type: 'backup_data', parameters: {} },
        { type: 'alert_admin', parameters: {} },
        { type: 'notify_users', parameters: { message: 'Security incident detected. Please change your password.' } }
      ]
    });
  }
}

interface ResponsePlaybook {
  name: string;
  automatedActions: Array<{
    type: ResponseAction['type'];
    parameters: Record<string, any>;
  }>;
}

// Export singleton instance
export const incidentResponseService = IncidentResponseService.getInstance();
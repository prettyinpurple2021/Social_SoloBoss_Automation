import { Pool } from 'pg';
import { createWriteStream } from 'fs';
import { stringify } from 'csv-stringify';
import { logger } from '../utils/logger';
import { EncryptionService } from './EncryptionService';

interface ExportOptions {
  format: 'json' | 'csv';
  includeDeleted?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tables?: string[];
}

interface ExportResult {
  exportId: string;
  downloadUrl: string;
  expiresAt: Date;
  size: number;
  format: string;
}

export class DataExportService {
  private db: Pool;
  private encryptionService: EncryptionService;

  constructor(db: Pool, encryptionService: EncryptionService) {
    this.db = db;
    this.encryptionService = encryptionService;
  }

  /**
   * Export complete user data package
   */
  async exportUserData(userId: string, options: ExportOptions): Promise<ExportResult> {
    const exportId = `user_export_${userId}_${Date.now()}`;
    logger.info(`Starting user data export: ${exportId}`);

    try {
      // Collect all user data
      const userData = await this.collectCompleteUserData(userId, options);

      // Generate export file
      const filePath = `/tmp/${exportId}.${options.format}`;
      
      if (options.format === 'json') {
        await this.generateJSONExport(filePath, userData);
      } else {
        await this.generateCSVExport(filePath, userData);
      }

      // Encrypt the export
      const encryptedPath = `/tmp/${exportId}.${options.format}.enc`;
      await this.encryptExportFile(filePath, encryptedPath);

      // Upload to secure storage
      const downloadUrl = await this.uploadSecureExport(encryptedPath, exportId, userId);

      // Get file size
      const size = await this.getFileSize(encryptedPath);

      // Log the export for audit
      await this.logExportActivity(userId, exportId, options);

      // Cleanup temporary files
      await this.cleanupFiles([filePath, encryptedPath]);

      const result: ExportResult = {
        exportId,
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        size,
        format: options.format
      };

      logger.info(`User data export completed: ${exportId}`);
      return result;

    } catch (error) {
      logger.error(`User data export failed: ${exportId}`, error);
      throw error;
    }
  }

  /**
   * Export specific data table
   */
  async exportTableData(userId: string, tableName: string, options: ExportOptions): Promise<ExportResult> {
    const exportId = `table_export_${tableName}_${userId}_${Date.now()}`;
    logger.info(`Starting table export: ${exportId}`);

    try {
      // Validate table access
      if (!this.isTableAccessible(tableName, userId)) {
        throw new Error(`Access denied to table: ${tableName}`);
      }

      // Get table data
      const tableData = await this.getTableData(tableName, userId, options);

      // Generate export file
      const filePath = `/tmp/${exportId}.${options.format}`;
      
      if (options.format === 'json') {
        await this.writeJSONFile(filePath, { [tableName]: tableData });
      } else {
        await this.writeCSVFile(filePath, tableData);
      }

      // Encrypt and upload
      const encryptedPath = `/tmp/${exportId}.${options.format}.enc`;
      await this.encryptExportFile(filePath, encryptedPath);
      const downloadUrl = await this.uploadSecureExport(encryptedPath, exportId, userId);

      const size = await this.getFileSize(encryptedPath);

      await this.logExportActivity(userId, exportId, { ...options, tables: [tableName] });
      await this.cleanupFiles([filePath, encryptedPath]);

      const result: ExportResult = {
        exportId,
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        size,
        format: options.format
      };

      logger.info(`Table export completed: ${exportId}`);
      return result;

    } catch (error) {
      logger.error(`Table export failed: ${exportId}`, error);
      throw error;
    }
  }

  /**
   * Generate GDPR-compliant data export
   */
  async exportGDPRData(userId: string): Promise<ExportResult> {
    logger.info(`Starting GDPR data export for user: ${userId}`);

    const options: ExportOptions = {
      format: 'json',
      includeDeleted: true,
      tables: [
        'users',
        'posts',
        'platform_connections',
        'post_analytics',
        'integrations',
        'audit_logs'
      ]
    };

    try {
      const userData = await this.collectGDPRCompliantData(userId);
      const exportId = `gdpr_export_${userId}_${Date.now()}`;
      
      // Add GDPR-specific metadata
      const gdprExport = {
        export_info: {
          export_id: exportId,
          user_id: userId,
          export_date: new Date().toISOString(),
          export_type: 'GDPR_COMPLIANT',
          data_controller: process.env.COMPANY_NAME || 'Social Media Automation Platform',
          contact_email: process.env.DPO_EMAIL || 'privacy@example.com',
          retention_policy: 'Data will be retained according to our privacy policy',
          your_rights: [
            'Right to rectification',
            'Right to erasure',
            'Right to restrict processing',
            'Right to data portability',
            'Right to object'
          ]
        },
        user_data: userData
      };

      const filePath = `/tmp/${exportId}.json`;
      await this.writeJSONFile(filePath, gdprExport);

      const encryptedPath = `/tmp/${exportId}.json.enc`;
      await this.encryptExportFile(filePath, encryptedPath);
      const downloadUrl = await this.uploadSecureExport(encryptedPath, exportId, userId);

      const size = await this.getFileSize(encryptedPath);

      await this.logGDPRExport(userId, exportId);
      await this.cleanupFiles([filePath, encryptedPath]);

      const result: ExportResult = {
        exportId,
        downloadUrl,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for GDPR
        size,
        format: 'json'
      };

      logger.info(`GDPR export completed: ${exportId}`);
      return result;

    } catch (error) {
      logger.error(`GDPR export failed for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<void> {
    logger.info('Starting cleanup of expired exports');

    try {
      const expiredExports = await this.getExpiredExports();

      for (const exportRecord of expiredExports) {
        try {
          // Delete from storage
          await this.deleteExportFromStorage(exportRecord.storage_path);
          
          // Remove from database
          await this.deleteExportRecord(exportRecord.id);

          logger.info(`Deleted expired export: ${exportRecord.export_id}`);
        } catch (error) {
          logger.error(`Failed to delete export: ${exportRecord.export_id}`, error);
        }
      }

      logger.info(`Cleanup completed. Deleted ${expiredExports.length} expired exports`);

    } catch (error) {
      logger.error('Export cleanup failed', error);
      throw error;
    }
  }

  // Private methods
  private async collectCompleteUserData(userId: string, options: ExportOptions): Promise<any> {
    const client = await this.db.connect();
    
    try {
      const userData: any = {};

      // User profile
      userData.profile = await this.getUserProfile(client, userId, options);
      
      // Posts
      userData.posts = await this.getUserPosts(client, userId, options);
      
      // Platform connections (without sensitive tokens)
      userData.platform_connections = await this.getUserPlatformConnections(client, userId, options);
      
      // Analytics data
      userData.analytics = await this.getUserAnalytics(client, userId, options);
      
      // Integrations
      userData.integrations = await this.getUserIntegrations(client, userId, options);
      
      // Audit logs
      userData.audit_logs = await this.getUserAuditLogs(client, userId, options);

      return userData;
    } finally {
      client.release();
    }
  }

  private async collectGDPRCompliantData(userId: string): Promise<any> {
    const client = await this.db.connect();
    
    try {
      return {
        personal_information: await this.getGDPRPersonalInfo(client, userId),
        content_data: await this.getGDPRContentData(client, userId),
        usage_data: await this.getGDPRUsageData(client, userId),
        technical_data: await this.getGDPRTechnicalData(client, userId)
      };
    } finally {
      client.release();
    }
  }

  private async getUserProfile(client: any, userId: string, options: ExportOptions): Promise<any> {
    let query = 'SELECT id, email, name, timezone, settings, created_at, updated_at FROM users WHERE id = $1';
    const params = [userId];

    if (!options.includeDeleted) {
      query += ' AND deleted_at IS NULL';
    }

    const result = await client.query(query, params);
    return result.rows[0];
  }

  private async getUserPosts(client: any, userId: string, options: ExportOptions): Promise<any[]> {
    let query = `
      SELECT p.*, 
             array_agg(DISTINCT pp.platform) as published_platforms,
             array_agg(DISTINCT pp.status) as platform_statuses
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      WHERE p.user_id = $1
    `;
    const params = [userId];

    if (options.dateRange) {
      query += ' AND p.created_at BETWEEN $2 AND $3';
      params.push(options.dateRange.start, options.dateRange.end);
    }

    if (!options.includeDeleted) {
      query += ' AND p.deleted_at IS NULL';
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const result = await client.query(query, params);
    return result.rows;
  }

  private async getUserPlatformConnections(client: any, userId: string, options: ExportOptions): Promise<any[]> {
    // Exclude sensitive token data from exports
    const query = `
      SELECT id, platform, platform_user_id, platform_username, 
             scopes, is_active, created_at, updated_at
      FROM platform_connections 
      WHERE user_id = $1
    `;

    const result = await client.query(query, [userId]);
    return result.rows;
  }

  private async getUserAnalytics(client: any, userId: string, options: ExportOptions): Promise<any[]> {
    let query = `
      SELECT pa.metric_type, pa.metric_value, pa.recorded_at, pa.metadata,
             p.content as post_content, pp.platform
      FROM post_analytics pa
      JOIN platform_posts pp ON pa.platform_post_id = pp.id
      JOIN posts p ON pp.post_id = p.id
      WHERE p.user_id = $1
    `;
    const params = [userId];

    if (options.dateRange) {
      query += ' AND pa.recorded_at BETWEEN $2 AND $3';
      params.push(options.dateRange.start, options.dateRange.end);
    }

    query += ' ORDER BY pa.recorded_at DESC';

    const result = await client.query(query, params);
    return result.rows;
  }

  private async getUserIntegrations(client: any, userId: string, options: ExportOptions): Promise<any[]> {
    // Exclude sensitive configuration data
    const query = `
      SELECT id, integration_type, is_active, created_at, updated_at
      FROM integrations 
      WHERE user_id = $1
    `;

    const result = await client.query(query, [userId]);
    return result.rows;
  }

  private async getUserAuditLogs(client: any, userId: string, options: ExportOptions): Promise<any[]> {
    let query = `
      SELECT action, resource_type, resource_id, details, 
             ip_address, user_agent, created_at
      FROM audit_logs 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (options.dateRange) {
      query += ' AND created_at BETWEEN $2 AND $3';
      params.push(options.dateRange.start, options.dateRange.end);
    }

    query += ' ORDER BY created_at DESC LIMIT 10000'; // Limit for performance

    const result = await client.query(query, params);
    return result.rows;
  }

  private async getGDPRPersonalInfo(client: any, userId: string): Promise<any> {
    const result = await client.query(`
      SELECT id, email, name, timezone, created_at, updated_at, deleted_at
      FROM users WHERE id = $1
    `, [userId]);

    return result.rows[0];
  }

  private async getGDPRContentData(client: any, userId: string): Promise<any> {
    const posts = await client.query(`
      SELECT id, content, images, hashtags, platforms, 
             scheduled_time, status, created_at, published_at
      FROM posts WHERE user_id = $1
    `, [userId]);

    return {
      posts: posts.rows,
      total_posts: posts.rows.length
    };
  }

  private async getGDPRUsageData(client: any, userId: string): Promise<any> {
    const analytics = await client.query(`
      SELECT COUNT(*) as total_analytics_records,
             MIN(recorded_at) as first_activity,
             MAX(recorded_at) as last_activity
      FROM post_analytics pa
      JOIN platform_posts pp ON pa.platform_post_id = pp.id
      JOIN posts p ON pp.post_id = p.id
      WHERE p.user_id = $1
    `, [userId]);

    return analytics.rows[0];
  }

  private async getGDPRTechnicalData(client: any, userId: string): Promise<any> {
    const auditLogs = await client.query(`
      SELECT COUNT(*) as total_audit_records,
             array_agg(DISTINCT ip_address) as ip_addresses_used,
             MIN(created_at) as first_login,
             MAX(created_at) as last_activity
      FROM audit_logs WHERE user_id = $1
    `, [userId]);

    return auditLogs.rows[0];
  }

  private async generateJSONExport(filePath: string, data: any): Promise<void> {
    await this.writeJSONFile(filePath, data);
  }

  private async generateCSVExport(filePath: string, data: any): Promise<void> {
    // Flatten the data structure for CSV export
    const flattenedData = this.flattenDataForCSV(data);
    await this.writeCSVFile(filePath, flattenedData);
  }

  private flattenDataForCSV(data: any): any[] {
    const flattened: any[] = [];
    
    // Flatten nested objects into rows
    for (const [category, items] of Object.entries(data)) {
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          flattened.push({
            category,
            ...this.flattenObject(item)
          });
        });
      } else if (typeof items === 'object' && items !== null) {
        flattened.push({
          category,
          ...this.flattenObject(items)
        });
      }
    }

    return flattened;
  }

  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = Array.isArray(value) ? JSON.stringify(value) : value;
      }
    }
    
    return flattened;
  }

  private async writeJSONFile(filePath: string, data: any): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async writeCSVFile(filePath: string, data: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const writableStream = createWriteStream(filePath);
      const stringifier = stringify({
        header: true,
        quoted: true
      });

      stringifier.pipe(writableStream);
      
      data.forEach(row => stringifier.write(row));
      stringifier.end();

      writableStream.on('finish', resolve);
      writableStream.on('error', reject);
    });
  }

  private async encryptExportFile(inputPath: string, outputPath: string): Promise<void> {
    // Use encryption service to encrypt the export file
    await this.encryptionService.encryptFile(inputPath, outputPath);
  }

  private async uploadSecureExport(filePath: string, exportId: string, userId: string): Promise<string> {
    // Implementation would upload to secure storage and return signed URL
    // This is a placeholder - actual implementation would use cloud storage
    return `https://secure-exports.example.com/${exportId}`;
  }

  private async logExportActivity(userId: string, exportId: string, options: ExportOptions): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        userId,
        'DATA_EXPORT',
        'USER_DATA',
        exportId,
        JSON.stringify({
          format: options.format,
          tables: options.tables,
          include_deleted: options.includeDeleted,
          date_range: options.dateRange
        })
      ]);
    } finally {
      client.release();
    }
  }

  private async logGDPRExport(userId: string, exportId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        userId,
        'GDPR_DATA_EXPORT',
        'USER_DATA',
        exportId,
        JSON.stringify({
          export_type: 'GDPR_COMPLIANT',
          compliance_framework: 'GDPR',
          data_subject_rights: 'Article 20 - Right to data portability'
        })
      ]);
    } finally {
      client.release();
    }
  }

  private isTableAccessible(tableName: string, userId: string): boolean {
    // Define which tables users can export
    const accessibleTables = [
      'posts',
      'platform_connections',
      'post_analytics',
      'integrations',
      'audit_logs'
    ];

    return accessibleTables.includes(tableName);
  }

  private async getTableData(tableName: string, userId: string, options: ExportOptions): Promise<any[]> {
    const client = await this.db.connect();
    
    try {
      // This is a simplified implementation - would need proper query building
      const result = await client.query(`SELECT * FROM ${tableName} WHERE user_id = $1`, [userId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    const fs = require('fs').promises;
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private async cleanupFiles(filePaths: string[]): Promise<void> {
    const fs = require('fs').promises;
    
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn(`Failed to cleanup file: ${filePath}`, error);
      }
    }
  }

  private async getExpiredExports(): Promise<any[]> {
    const client = await this.db.connect();
    
    try {
      const result = await client.query(`
        SELECT id, export_id, storage_path
        FROM data_exports 
        WHERE expires_at < NOW()
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private async deleteExportFromStorage(storagePath: string): Promise<void> {
    // Implementation would delete from cloud storage
    logger.info(`Deleting export from storage: ${storagePath}`);
  }

  private async deleteExportRecord(exportId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('DELETE FROM data_exports WHERE id = $1', [exportId]);
    } finally {
      client.release();
    }
  }
}
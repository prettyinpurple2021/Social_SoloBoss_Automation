import { Pool } from 'pg';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { logger } from '../utils/logger';
import { EncryptionService } from './EncryptionService';

interface BackupConfig {
  schedule: string;
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  encryption: {
    algorithm: string;
    keyRotationDays: number;
  };
  storage: {
    primary: string;
    secondary: string;
    regions: string[];
  };
}

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  checksum: string;
  encrypted: boolean;
  location: string;
  region: string;
  retention_until: Date;
}

export class BackupService {
  private db: Pool;
  private storage: Storage;
  private encryptionService: EncryptionService;
  private config: BackupConfig;

  constructor(
    db: Pool,
    storage: Storage,
    encryptionService: EncryptionService,
    config: BackupConfig
  ) {
    this.db = db;
    this.storage = storage;
    this.encryptionService = encryptionService;
    this.config = config;
  }

  /**
   * Create a full database backup with encryption
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = `full_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const timestamp = new Date();
    
    logger.info(`Starting full backup: ${backupId}`);

    try {
      // Create database dump
      const dumpPath = `/tmp/${backupId}.sql`;
      await this.createDatabaseDump(dumpPath);

      // Compress and encrypt
      const encryptedPath = `/tmp/${backupId}.sql.gz.enc`;
      await this.compressAndEncrypt(dumpPath, encryptedPath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(encryptedPath);
      const size = await this.getFileSize(encryptedPath);

      // Upload to multiple regions
      const locations = await this.uploadToMultipleRegions(encryptedPath, backupId);

      // Store metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'full',
        size,
        checksum,
        encrypted: true,
        location: locations.primary,
        region: this.config.storage.regions[0],
        retention_until: this.calculateRetentionDate(timestamp, 'full')
      };

      await this.storeBackupMetadata(metadata);

      // Cleanup temporary files
      await this.cleanupTempFiles([dumpPath, encryptedPath]);

      logger.info(`Full backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      logger.error(`Full backup failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Create incremental backup (changes since last backup)
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = `incremental_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const timestamp = new Date();
    
    logger.info(`Starting incremental backup: ${backupId}`);

    try {
      const lastBackup = await this.getLastBackupTimestamp();
      
      // Export only changed data since last backup
      const changes = await this.exportIncrementalChanges(lastBackup);
      const dumpPath = `/tmp/${backupId}.json`;
      
      await this.writeFile(dumpPath, JSON.stringify(changes, null, 2));

      // Compress and encrypt
      const encryptedPath = `/tmp/${backupId}.json.gz.enc`;
      await this.compressAndEncrypt(dumpPath, encryptedPath);

      const checksum = await this.calculateChecksum(encryptedPath);
      const size = await this.getFileSize(encryptedPath);

      const locations = await this.uploadToMultipleRegions(encryptedPath, backupId);

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: 'incremental',
        size,
        checksum,
        encrypted: true,
        location: locations.primary,
        region: this.config.storage.regions[0],
        retention_until: this.calculateRetentionDate(timestamp, 'incremental')
      };

      await this.storeBackupMetadata(metadata);
      await this.cleanupTempFiles([dumpPath, encryptedPath]);

      logger.info(`Incremental backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      logger.error(`Incremental backup failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupId: string, targetTime?: Date): Promise<void> {
    logger.info(`Starting restore from backup: ${backupId}`);

    try {
      const metadata = await this.getBackupMetadata(backupId);
      
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Download and decrypt backup
      const encryptedPath = `/tmp/restore_${backupId}.enc`;
      const decryptedPath = `/tmp/restore_${backupId}.sql`;

      await this.downloadBackup(metadata.location, encryptedPath);
      await this.decryptAndDecompress(encryptedPath, decryptedPath);

      // Verify checksum
      const checksum = await this.calculateChecksum(encryptedPath);
      if (checksum !== metadata.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // Create restore point before proceeding
      const restorePointId = await this.createRestorePoint();

      try {
        // Restore database
        await this.restoreDatabase(decryptedPath);

        // If point-in-time recovery requested, apply incremental changes
        if (targetTime && metadata.type === 'full') {
          await this.applyIncrementalChanges(metadata.timestamp, targetTime);
        }

        logger.info(`Restore completed successfully: ${backupId}`);

      } catch (restoreError) {
        // Rollback to restore point on failure
        logger.error('Restore failed, rolling back', restoreError);
        await this.rollbackToRestorePoint(restorePointId);
        throw restoreError;
      }

      await this.cleanupTempFiles([encryptedPath, decryptedPath]);

    } catch (error) {
      logger.error(`Restore failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Export user data in standard formats
   */
  async exportUserData(userId: string, format: 'json' | 'csv'): Promise<string> {
    logger.info(`Exporting user data: ${userId} in ${format} format`);

    try {
      const userData = await this.collectUserData(userId);
      const exportId = `export_${userId}_${Date.now()}`;
      
      let exportPath: string;
      
      if (format === 'json') {
        exportPath = `/tmp/${exportId}.json`;
        await this.writeFile(exportPath, JSON.stringify(userData, null, 2));
      } else {
        exportPath = `/tmp/${exportId}.csv`;
        await this.writeCSV(exportPath, userData);
      }

      // Encrypt export file
      const encryptedPath = `/tmp/${exportId}.${format}.enc`;
      await this.encryptFile(exportPath, encryptedPath);

      // Upload to secure storage with limited access
      const downloadUrl = await this.uploadUserExport(encryptedPath, exportId, userId);

      await this.cleanupTempFiles([exportPath, encryptedPath]);

      // Log export for audit trail
      await this.logDataExport(userId, format, exportId);

      return downloadUrl;

    } catch (error) {
      logger.error(`User data export failed: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Securely delete user data (GDPR compliance)
   */
  async secureDeleteUserData(userId: string, reason: string): Promise<void> {
    logger.info(`Starting secure deletion for user: ${userId}`);

    try {
      // Create audit record before deletion
      await this.logDataDeletion(userId, reason);

      // Create final backup before deletion
      const backupData = await this.collectUserData(userId);
      const deletionBackupId = `deletion_${userId}_${Date.now()}`;
      await this.createDeletionBackup(deletionBackupId, backupData);

      // Begin transaction for atomic deletion
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Delete user data in correct order (respecting foreign keys)
        await this.deleteUserDataTables(client, userId);

        // Anonymize audit logs (keep for compliance but remove PII)
        await this.anonymizeAuditLogs(client, userId);

        await client.query('COMMIT');

        // Schedule secure deletion of backups after retention period
        await this.scheduleDeletionBackupCleanup(deletionBackupId, userId);

        logger.info(`Secure deletion completed for user: ${userId}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Secure deletion failed for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Test backup integrity
   */
  async testBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      
      if (!metadata) {
        return false;
      }

      // Download backup
      const tempPath = `/tmp/test_${backupId}.enc`;
      await this.downloadBackup(metadata.location, tempPath);

      // Verify checksum
      const checksum = await this.calculateChecksum(tempPath);
      const checksumValid = checksum === metadata.checksum;

      // Test decryption
      const decryptedPath = `/tmp/test_${backupId}.dec`;
      await this.decryptAndDecompress(tempPath, decryptedPath);

      // Validate backup content structure
      const contentValid = await this.validateBackupContent(decryptedPath, metadata.type);

      await this.cleanupTempFiles([tempPath, decryptedPath]);

      return checksumValid && contentValid;

    } catch (error) {
      logger.error(`Backup integrity test failed: ${backupId}`, error);
      return false;
    }
  }

  /**
   * Cleanup expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    logger.info('Starting cleanup of expired backups');

    try {
      const expiredBackups = await this.getExpiredBackups();

      for (const backup of expiredBackups) {
        try {
          // Delete from storage
          await this.deleteBackupFromStorage(backup.location);
          
          // Remove metadata
          await this.deleteBackupMetadata(backup.id);

          logger.info(`Deleted expired backup: ${backup.id}`);
        } catch (error) {
          logger.error(`Failed to delete backup: ${backup.id}`, error);
        }
      }

      logger.info(`Cleanup completed. Deleted ${expiredBackups.length} expired backups`);

    } catch (error) {
      logger.error('Backup cleanup failed', error);
      throw error;
    }
  }

  // Private helper methods
  private async createDatabaseDump(outputPath: string): Promise<void> {
    // Implementation for creating PostgreSQL dump
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        '--host', process.env.DB_HOST,
        '--port', process.env.DB_PORT,
        '--username', process.env.DB_USER,
        '--dbname', process.env.DB_NAME,
        '--file', outputPath,
        '--verbose',
        '--no-password'
      ], {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });
    });
  }

  private async compressAndEncrypt(inputPath: string, outputPath: string): Promise<void> {
    const key = await this.encryptionService.getCurrentKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const input = createReadStream(inputPath);
    const gzip = createGzip();
    const output = createWriteStream(outputPath);

    // Write IV to beginning of file
    output.write(iv);

    await pipeline(input, gzip, cipher, output);

    // Write auth tag
    const authTag = cipher.getAuthTag();
    output.write(authTag);
  }

  private async decryptAndDecompress(inputPath: string, outputPath: string): Promise<void> {
    const key = await this.encryptionService.getCurrentKey();
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);

    // Read IV from beginning of file
    const iv = Buffer.alloc(16);
    await new Promise((resolve) => {
      input.once('readable', () => {
        input.read(16).copy(iv);
        resolve(void 0);
      });
    });

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    const gunzip = createGunzip();

    await pipeline(input, decipher, gunzip, output);
  }

  private async uploadToMultipleRegions(filePath: string, backupId: string): Promise<{ primary: string; secondary: string[] }> {
    const bucket = this.storage.bucket(this.config.storage.primary);
    const fileName = `backups/${backupId}`;

    // Upload to primary region
    await bucket.upload(filePath, {
      destination: fileName,
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          backupId,
          encrypted: 'true',
          timestamp: new Date().toISOString()
        }
      }
    });

    // Replicate to secondary regions
    const secondaryLocations: string[] = [];
    for (const region of this.config.storage.regions.slice(1)) {
      const secondaryBucket = this.storage.bucket(`${this.config.storage.secondary}-${region}`);
      await secondaryBucket.upload(filePath, { destination: fileName });
      secondaryLocations.push(`${this.config.storage.secondary}-${region}/${fileName}`);
    }

    return {
      primary: `${this.config.storage.primary}/${fileName}`,
      secondary: secondaryLocations
    };
  }

  private async collectUserData(userId: string): Promise<any> {
    const client = await this.db.connect();
    
    try {
      const userData = {
        user: await this.getUserData(client, userId),
        posts: await this.getUserPosts(client, userId),
        platformConnections: await this.getUserPlatformConnections(client, userId),
        analytics: await this.getUserAnalytics(client, userId),
        integrations: await this.getUserIntegrations(client, userId),
        auditLogs: await this.getUserAuditLogs(client, userId)
      };

      return userData;
    } finally {
      client.release();
    }
  }

  private async getUserData(client: any, userId: string): Promise<any> {
    const result = await client.query(
      'SELECT id, email, name, timezone, settings, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  private async getUserPosts(client: any, userId: string): Promise<any[]> {
    const result = await client.query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  private async getUserPlatformConnections(client: any, userId: string): Promise<any[]> {
    const result = await client.query(
      'SELECT id, platform, platform_user_id, platform_username, scopes, is_active, created_at FROM platform_connections WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  }

  private async getUserAnalytics(client: any, userId: string): Promise<any[]> {
    const result = await client.query(`
      SELECT pa.* FROM post_analytics pa
      JOIN platform_posts pp ON pa.platform_post_id = pp.id
      JOIN posts p ON pp.post_id = p.id
      WHERE p.user_id = $1
    `, [userId]);
    return result.rows;
  }

  private async getUserIntegrations(client: any, userId: string): Promise<any[]> {
    const result = await client.query(
      'SELECT id, integration_type, is_active, created_at FROM integrations WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  }

  private async getUserAuditLogs(client: any, userId: string): Promise<any[]> {
    const result = await client.query(
      'SELECT action, resource_type, resource_id, details, ip_address, created_at FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000',
      [userId]
    );
    return result.rows;
  }

  private calculateRetentionDate(timestamp: Date, type: string): Date {
    const retention = new Date(timestamp);
    
    switch (type) {
      case 'full':
        retention.setDate(retention.getDate() + this.config.retention.monthly * 30);
        break;
      case 'incremental':
        retention.setDate(retention.getDate() + this.config.retention.daily);
        break;
      default:
        retention.setDate(retention.getDate() + this.config.retention.weekly * 7);
    }
    
    return retention;
  }

  // Additional helper methods would be implemented here...
  private async calculateChecksum(filePath: string): Promise<string> {
    // Implementation for calculating file checksum
    return '';
  }

  private async getFileSize(filePath: string): Promise<number> {
    // Implementation for getting file size
    return 0;
  }

  private async writeFile(path: string, content: string): Promise<void> {
    // Implementation for writing file
  }

  private async writeCSV(path: string, data: any): Promise<void> {
    // Implementation for writing CSV
  }

  private async cleanupTempFiles(paths: string[]): Promise<void> {
    // Implementation for cleaning up temporary files
  }

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    // Implementation for storing backup metadata in database
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // Implementation for retrieving backup metadata
    return null;
  }

  private async getLastBackupTimestamp(): Promise<Date> {
    // Implementation for getting last backup timestamp
    return new Date();
  }

  private async exportIncrementalChanges(since: Date): Promise<any> {
    // Implementation for exporting incremental changes
    return {};
  }

  private async downloadBackup(location: string, outputPath: string): Promise<void> {
    // Implementation for downloading backup from storage
  }

  private async restoreDatabase(dumpPath: string): Promise<void> {
    // Implementation for restoring database from dump
  }

  private async createRestorePoint(): Promise<string> {
    // Implementation for creating restore point
    return '';
  }

  private async rollbackToRestorePoint(restorePointId: string): Promise<void> {
    // Implementation for rolling back to restore point
  }

  private async applyIncrementalChanges(from: Date, to: Date): Promise<void> {
    // Implementation for applying incremental changes
  }

  private async uploadUserExport(filePath: string, exportId: string, userId: string): Promise<string> {
    // Implementation for uploading user export
    return '';
  }

  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    // Implementation for encrypting file
  }

  private async logDataExport(userId: string, format: string, exportId: string): Promise<void> {
    // Implementation for logging data export
  }

  private async logDataDeletion(userId: string, reason: string): Promise<void> {
    // Implementation for logging data deletion
  }

  private async createDeletionBackup(backupId: string, data: any): Promise<void> {
    // Implementation for creating deletion backup
  }

  private async deleteUserDataTables(client: any, userId: string): Promise<void> {
    // Implementation for deleting user data from all tables
  }

  private async anonymizeAuditLogs(client: any, userId: string): Promise<void> {
    // Implementation for anonymizing audit logs
  }

  private async scheduleDeletionBackupCleanup(backupId: string, userId: string): Promise<void> {
    // Implementation for scheduling deletion backup cleanup
  }

  private async validateBackupContent(filePath: string, type: string): Promise<boolean> {
    // Implementation for validating backup content
    return true;
  }

  private async getExpiredBackups(): Promise<BackupMetadata[]> {
    // Implementation for getting expired backups
    return [];
  }

  private async deleteBackupFromStorage(location: string): Promise<void> {
    // Implementation for deleting backup from storage
  }

  private async deleteBackupMetadata(backupId: string): Promise<void> {
    // Implementation for deleting backup metadata
  }
}
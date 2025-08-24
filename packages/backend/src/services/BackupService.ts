import { Pool } from 'pg';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { spawn } from 'child_process';
import { loggerService } from './LoggerService';
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
    
    loggerService.info(`Starting full backup: ${backupId}`);

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

      loggerService.info(`Full backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      loggerService.error(`Full backup failed: ${backupId}`, error as Error);
      throw error;
    }
  }

  /**
   * Create incremental backup (changes since last backup)
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = `incremental_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const timestamp = new Date();
    
    loggerService.info(`Starting incremental backup: ${backupId}`);

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

      loggerService.info(`Incremental backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      loggerService.error(`Incremental backup failed: ${backupId}`, error as Error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupId: string, targetTime?: Date): Promise<void> {
    loggerService.info(`Starting restore from backup: ${backupId}`);

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

        loggerService.info(`Restore completed successfully: ${backupId}`);

      } catch (restoreError) {
        // Rollback to restore point on failure
        loggerService.error('Restore failed, rolling back', restoreError as Error);
        await this.rollbackToRestorePoint(restorePointId);
        throw restoreError;
      }

      await this.cleanupTempFiles([encryptedPath, decryptedPath]);

    } catch (error) {
      loggerService.error(`Restore failed: ${backupId}`, error as Error);
      throw error;
    }
  }

  /**
   * Export user data in standard formats
   */
  async exportUserData(userId: string, format: 'json' | 'csv'): Promise<string> {
    loggerService.info(`Exporting user data: ${userId} in ${format} format`);

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
      loggerService.error(`User data export failed: ${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Securely delete user data (GDPR compliance)
   */
  async secureDeleteUserData(userId: string, reason: string): Promise<void> {
    loggerService.info(`Starting secure deletion for user: ${userId}`);

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

        loggerService.info(`Secure deletion completed for user: ${userId}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      loggerService.error(`Secure deletion failed for user: ${userId}`, error as Error);
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
      loggerService.error(`Backup integrity test failed: ${backupId}`, error as Error);
      return false;
    }
  }

  /**
   * Cleanup expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    loggerService.info('Starting cleanup of expired backups');

    try {
      const expiredBackups = await this.getExpiredBackups();

      for (const backup of expiredBackups) {
        try {
          // Delete from storage
          await this.deleteBackupFromStorage(backup.location);
          
          // Remove metadata
          await this.deleteBackupMetadata(backup.id);

          loggerService.info(`Deleted expired backup: ${backup.id}`);
        } catch (error) {
          loggerService.error(`Failed to delete backup: ${backup.id}`, error as Error);
        }
      }

      loggerService.info(`Cleanup completed. Deleted ${expiredBackups.length} expired backups`);

    } catch (error) {
      loggerService.error('Backup cleanup failed', error as Error);
      throw error;
    }
  }

  // Private helper methods
  private async createDatabaseDump(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        '--host', process.env.DB_HOST || 'localhost',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USER || 'postgres',
        '--dbname', process.env.DB_NAME || 'social_media_automation',
        '--file', outputPath,
        '--verbose',
        '--no-password'
      ], {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      });

      pgDump.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async compressAndEncrypt(inputPath: string, outputPath: string): Promise<void> {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-please', 'utf8').subarray(0, 32);
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
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-please', 'utf8').subarray(0, 32);
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);

    // Read IV from beginning of file
    const iv = Buffer.alloc(16);
    await new Promise<void>((resolve) => {
      input.once('readable', () => {
        const chunk = input.read(16);
        if (chunk) {
          chunk.copy(iv);
        }
        resolve();
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

  // Helper methods implementation
  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf8');
  }

  private async writeCSV(path: string, data: any): Promise<void> {
    const csvContent = this.convertToCSV(data);
    await fs.writeFile(path, csvContent, 'utf8');
  }

  private convertToCSV(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    const lines: string[] = [];
    
    // Handle user data structure
    if (data.user) {
      lines.push('User Information');
      lines.push('Field,Value');
      Object.entries(data.user).forEach(([key, value]) => {
        lines.push(`${key},"${String(value).replace(/"/g, '""')}"`);
      });
      lines.push('');
    }

    // Handle posts
    if (data.posts && Array.isArray(data.posts)) {
      lines.push('Posts');
      if (data.posts.length > 0) {
        const headers = Object.keys(data.posts[0]);
        lines.push(headers.join(','));
        data.posts.forEach((post: any) => {
          const values = headers.map(header => `"${String(post[header] || '').replace(/"/g, '""')}"`);
          lines.push(values.join(','));
        });
      }
      lines.push('');
    }

    // Handle platform connections
    if (data.platformConnections && Array.isArray(data.platformConnections)) {
      lines.push('Platform Connections');
      if (data.platformConnections.length > 0) {
        const headers = Object.keys(data.platformConnections[0]);
        lines.push(headers.join(','));
        data.platformConnections.forEach((conn: any) => {
          const values = headers.map(header => `"${String(conn[header] || '').replace(/"/g, '""')}"`);
          lines.push(values.join(','));
        });
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private async cleanupTempFiles(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await fs.unlink(path);
      } catch (error) {
        loggerService.warn(`Failed to cleanup temp file: ${path}`, { error: (error as Error).message });
      }
    }
  }

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await this.db.query(`
      INSERT INTO backup_metadata (
        backup_id, timestamp, type, size, checksum, encrypted, 
        location, region, retention_until, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      metadata.id,
      metadata.timestamp,
      metadata.type,
      metadata.size,
      metadata.checksum,
      metadata.encrypted,
      metadata.location,
      metadata.region,
      metadata.retention_until,
      'completed',
      JSON.stringify({})
    ]);
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const result = await this.db.query(
      'SELECT * FROM backup_metadata WHERE backup_id = $1',
      [backupId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.backup_id,
      timestamp: row.timestamp,
      type: row.type,
      size: row.size,
      checksum: row.checksum,
      encrypted: row.encrypted,
      location: row.location,
      region: row.region,
      retention_until: row.retention_until
    };
  }

  private async getLastBackupTimestamp(): Promise<Date> {
    const result = await this.db.query(
      'SELECT MAX(timestamp) as last_backup FROM backup_metadata WHERE status = $1',
      ['completed']
    );
    
    return result.rows[0]?.last_backup || new Date(0);
  }

  private async exportIncrementalChanges(since: Date): Promise<any> {
    const client = await this.db.connect();
    
    try {
      const changes = {
        posts: await this.getChangedPosts(client, since),
        platformConnections: await this.getChangedPlatformConnections(client, since),
        users: await this.getChangedUsers(client, since),
        analytics: await this.getChangedAnalytics(client, since)
      };

      return changes;
    } finally {
      client.release();
    }
  }

  private async getChangedPosts(client: any, since: Date): Promise<any[]> {
    const result = await client.query(
      'SELECT * FROM posts WHERE updated_at > $1 ORDER BY updated_at',
      [since]
    );
    return result.rows;
  }

  private async getChangedPlatformConnections(client: any, since: Date): Promise<any[]> {
    const result = await client.query(
      'SELECT * FROM platform_connections WHERE updated_at > $1 ORDER BY updated_at',
      [since]
    );
    return result.rows;
  }

  private async getChangedUsers(client: any, since: Date): Promise<any[]> {
    const result = await client.query(
      'SELECT id, email, name, timezone, settings, updated_at FROM users WHERE updated_at > $1 ORDER BY updated_at',
      [since]
    );
    return result.rows;
  }

  private async getChangedAnalytics(client: any, since: Date): Promise<any[]> {
    const result = await client.query(
      'SELECT * FROM post_analytics WHERE recorded_at > $1 ORDER BY recorded_at',
      [since]
    );
    return result.rows;
  }

  private async downloadBackup(location: string, outputPath: string): Promise<void> {
    const [bucketName, fileName] = location.split('/', 2);
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    await file.download({ destination: outputPath });
  }

  private async restoreDatabase(dumpPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const psql = spawn('psql', [
        '--host', process.env.DB_HOST || 'localhost',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USER || 'postgres',
        '--dbname', process.env.DB_NAME || 'social_media_automation',
        '--file', dumpPath,
        '--quiet'
      ], {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
      });

      psql.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`psql exited with code ${code}`));
        }
      });

      psql.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async createRestorePoint(): Promise<string> {
    const pointId = `restore_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const timestamp = new Date();
    
    // Create a quick backup before restore
    const backupId = await this.createFullBackup();
    
    await this.db.query(`
      INSERT INTO recovery_points (point_id, timestamp, backup_id, status)
      VALUES ($1, $2, $3, $4)
    `, [pointId, timestamp, backupId.id, 'active']);
    
    return pointId;
  }

  private async rollbackToRestorePoint(restorePointId: string): Promise<void> {
    const result = await this.db.query(
      'SELECT backup_id FROM recovery_points WHERE point_id = $1',
      [restorePointId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Restore point not found: ${restorePointId}`);
    }
    
    const backupId = result.rows[0].backup_id;
    await this.restoreFromBackup(backupId);
  }

  private async applyIncrementalChanges(from: Date, to: Date): Promise<void> {
    // Get all incremental backups between the dates
    const result = await this.db.query(`
      SELECT backup_id FROM backup_metadata 
      WHERE type = 'incremental' 
      AND timestamp BETWEEN $1 AND $2 
      ORDER BY timestamp
    `, [from, to]);
    
    for (const row of result.rows) {
      const metadata = await this.getBackupMetadata(row.backup_id);
      if (metadata) {
        const tempPath = `/tmp/incremental_${row.backup_id}.json`;
        await this.downloadBackup(metadata.location, tempPath);
        
        const changes = JSON.parse(await fs.readFile(tempPath, 'utf8'));
        await this.applyChangesToDatabase(changes);
        
        await this.cleanupTempFiles([tempPath]);
      }
    }
  }

  private async applyChangesToDatabase(changes: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Apply changes in order
      if (changes.users) {
        await this.applyUserChanges(client, changes.users);
      }
      
      if (changes.posts) {
        await this.applyPostChanges(client, changes.posts);
      }
      
      if (changes.platformConnections) {
        await this.applyPlatformConnectionChanges(client, changes.platformConnections);
      }
      
      if (changes.analytics) {
        await this.applyAnalyticsChanges(client, changes.analytics);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyUserChanges(client: any, users: any[]): Promise<void> {
    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, email, name, timezone, settings, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          timezone = EXCLUDED.timezone,
          settings = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at
      `, [user.id, user.email, user.name, user.timezone, user.settings, user.updated_at]);
    }
  }

  private async applyPostChanges(client: any, posts: any[]): Promise<void> {
    for (const post of posts) {
      await client.query(`
        INSERT INTO posts (id, user_id, content, images, hashtags, platforms, scheduled_time, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          images = EXCLUDED.images,
          hashtags = EXCLUDED.hashtags,
          platforms = EXCLUDED.platforms,
          scheduled_time = EXCLUDED.scheduled_time,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `, [post.id, post.user_id, post.content, post.images, post.hashtags, post.platforms, post.scheduled_time, post.status, post.updated_at]);
    }
  }

  private async applyPlatformConnectionChanges(client: any, connections: any[]): Promise<void> {
    for (const conn of connections) {
      await client.query(`
        INSERT INTO platform_connections (id, user_id, platform, platform_user_id, platform_username, access_token, refresh_token, token_expires_at, scopes, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          platform_user_id = EXCLUDED.platform_user_id,
          platform_username = EXCLUDED.platform_username,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          scopes = EXCLUDED.scopes,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `, [conn.id, conn.user_id, conn.platform, conn.platform_user_id, conn.platform_username, conn.access_token, conn.refresh_token, conn.token_expires_at, conn.scopes, conn.is_active, conn.updated_at]);
    }
  }

  private async applyAnalyticsChanges(client: any, analytics: any[]): Promise<void> {
    for (const analytic of analytics) {
      await client.query(`
        INSERT INTO post_analytics (id, platform_post_id, metric_type, metric_value, recorded_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          metric_value = EXCLUDED.metric_value,
          recorded_at = EXCLUDED.recorded_at,
          metadata = EXCLUDED.metadata
      `, [analytic.id, analytic.platform_post_id, analytic.metric_type, analytic.metric_value, analytic.recorded_at, analytic.metadata]);
    }
  }

  private async uploadUserExport(filePath: string, exportId: string, userId: string): Promise<string> {
    const bucket = this.storage.bucket(this.config.storage.primary);
    const fileName = `exports/${userId}/${exportId}`;
    
    const [file] = await bucket.upload(filePath, {
      destination: fileName,
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          exportId,
          userId,
          encrypted: 'true',
          timestamp: new Date().toISOString()
        }
      }
    });

    // Generate signed URL valid for 7 days
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Store export request in database
    await this.db.query(`
      INSERT INTO data_export_requests (export_id, user_id, format, status, download_url, expires_at, file_size, encrypted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      exportId,
      userId,
      filePath.endsWith('.json') ? 'json' : 'csv',
      'completed',
      signedUrl,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      await this.getFileSize(filePath),
      true
    ]);

    return signedUrl;
  }

  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    const content = await fs.readFile(inputPath, 'utf8');
    const encrypted = EncryptionService.encrypt(content);
    await fs.writeFile(outputPath, encrypted, 'utf8');
  }

  private async logDataExport(userId: string, format: string, exportId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      'data_export',
      'user_data',
      exportId,
      JSON.stringify({ format, exportId }),
      null // IP would be passed from request context
    ]);

    loggerService.audit('User data export completed', {
      userId,
      format,
      exportId
    });
  }

  private async logDataDeletion(userId: string, reason: string): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      'data_deletion',
      'user_data',
      userId,
      JSON.stringify({ reason }),
      null
    ]);

    loggerService.audit('User data deletion initiated', {
      userId,
      reason
    });
  }

  private async createDeletionBackup(backupId: string, data: any): Promise<void> {
    const backupPath = `/tmp/${backupId}.json`;
    const encryptedPath = `/tmp/${backupId}.json.enc`;
    
    await this.writeFile(backupPath, JSON.stringify(data, null, 2));
    await this.encryptFile(backupPath, encryptedPath);
    
    const bucket = this.storage.bucket(this.config.storage.primary);
    const fileName = `deletion-backups/${backupId}`;
    
    await bucket.upload(encryptedPath, {
      destination: fileName,
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          backupId,
          type: 'deletion_backup',
          encrypted: 'true',
          timestamp: new Date().toISOString()
        }
      }
    });

    await this.cleanupTempFiles([backupPath, encryptedPath]);
  }

  private async deleteUserDataTables(client: any, userId: string): Promise<void> {
    // Delete in order to respect foreign key constraints
    const tables = [
      'post_analytics',
      'platform_posts', 
      'posts',
      'platform_connections',
      'integrations',
      'data_export_requests',
      'data_deletion_requests',
      'users'
    ];

    for (const table of tables) {
      if (table === 'post_analytics') {
        // Delete analytics through platform_posts relationship
        await client.query(`
          DELETE FROM post_analytics 
          WHERE platform_post_id IN (
            SELECT pp.id FROM platform_posts pp
            JOIN posts p ON pp.post_id = p.id
            WHERE p.user_id = $1
          )
        `, [userId]);
      } else if (table === 'platform_posts') {
        // Delete platform posts through posts relationship
        await client.query(`
          DELETE FROM platform_posts 
          WHERE post_id IN (
            SELECT id FROM posts WHERE user_id = $1
          )
        `, [userId]);
      } else {
        // Direct deletion for other tables
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      }
    }
  }

  private async anonymizeAuditLogs(client: any, userId: string): Promise<void> {
    // Replace user-specific data with anonymized values but keep logs for compliance
    await client.query(`
      UPDATE audit_logs 
      SET details = jsonb_set(
        COALESCE(details, '{}'),
        '{anonymized}',
        'true'
      ),
      ip_address = NULL,
      user_agent = NULL
      WHERE user_id = $1
    `, [userId]);
  }

  private async scheduleDeletionBackupCleanup(backupId: string, userId: string): Promise<void> {
    // Schedule cleanup after legal retention period (typically 30 days)
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() + 30);

    // In a real implementation, this would schedule a background job
    loggerService.info('Deletion backup cleanup scheduled', {
      backupId,
      userId,
      scheduledFor: cleanupDate.toISOString()
    });
  }

  private async validateBackupContent(filePath: string, type: string): Promise<boolean> {
    try {
      if (type === 'full') {
        // For full backups, check if it's a valid SQL dump
        const content = await fs.readFile(filePath, 'utf8');
        return content.includes('PostgreSQL database dump') || content.includes('CREATE TABLE');
      } else {
        // For incremental backups, check if it's valid JSON
        const content = await fs.readFile(filePath, 'utf8');
        JSON.parse(content);
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  private async getExpiredBackups(): Promise<BackupMetadata[]> {
    const result = await this.db.query(`
      SELECT backup_id, timestamp, type, size, checksum, encrypted, location, region, retention_until
      FROM backup_metadata 
      WHERE retention_until < NOW() AND status = 'completed'
      ORDER BY retention_until
    `);

    return result.rows.map((row: any) => ({
      id: row.backup_id,
      timestamp: row.timestamp,
      type: row.type,
      size: row.size,
      checksum: row.checksum,
      encrypted: row.encrypted,
      location: row.location,
      region: row.region,
      retention_until: row.retention_until
    }));
  }

  private async deleteBackupFromStorage(location: string): Promise<void> {
    const [bucketName, ...filePathParts] = location.split('/');
    const filePath = filePathParts.join('/');
    
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filePath);
    
    await file.delete();
  }

  private async deleteBackupMetadata(backupId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM backup_metadata WHERE backup_id = $1',
      [backupId]
    );
  }
}
import { Pool } from 'pg';
import { Storage } from '@google-cloud/storage';
import { BackupService } from '../services/BackupService';
import { DataDeletionService } from '../services/DataDeletionService';
import { DisasterRecoveryService } from '../services/DisasterRecoveryService';
import { BackupSchedulerService } from '../services/BackupSchedulerService';
import { EncryptionService } from '../services/EncryptionService';
import { loggerService } from '../services/LoggerService';

// Mock dependencies
jest.mock('../services/LoggerService');
jest.mock('../services/EncryptionService');
jest.mock('pg');
jest.mock('@google-cloud/storage');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(() => ({ size: 1024 }))
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn()
}));

describe('Backup System', () => {
  let mockDb: jest.Mocked<Pool>;
  let mockStorage: jest.Mocked<Storage>;
  let backupService: BackupService;
  let dataDeletionService: DataDeletionService;
  let disasterRecoveryService: DisasterRecoveryService;
  let backupSchedulerService: BackupSchedulerService;

  const mockBackupConfig = {
    schedule: '0 2 * * *',
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
    storage: {
      primary: 'test-bucket-primary',
      secondary: 'test-bucket-secondary',
      regions: ['us-central1', 'us-east1'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn()
      }))
    } as any;

    // Mock storage
    mockStorage = {
      bucket: jest.fn(() => ({
        upload: jest.fn(() => [{ getSignedUrl: jest.fn(() => ['https://example.com/download']) }]),
        file: jest.fn(() => ({
          download: jest.fn(),
          delete: jest.fn()
        }))
      }))
    } as any;

    // Initialize services
    backupService = new BackupService(mockDb, mockStorage, new EncryptionService(), mockBackupConfig);
    dataDeletionService = new DataDeletionService(mockDb, backupService);
    disasterRecoveryService = new DisasterRecoveryService(mockDb, backupService);
    backupSchedulerService = new BackupSchedulerService(mockDb, mockStorage, mockBackupConfig);
  });

  describe('BackupService', () => {
    describe('createFullBackup', () => {
      it('should create a full backup successfully', async () => {
        // Mock database query for storing metadata
        mockDb.query.mockResolvedValue({ rows: [] });

        // Mock file operations
        const fs = require('fs');
        fs.promises.stat.mockResolvedValue({ size: 1024 });

        // Mock pg_dump process
        const mockSpawn = jest.fn(() => ({
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          })
        }));
        jest.doMock('child_process', () => ({ spawn: mockSpawn }));

        const backup = await backupService.createFullBackup();

        expect(backup).toHaveProperty('id');
        expect(backup).toHaveProperty('timestamp');
        expect(backup.type).toBe('full');
        expect(backup.encrypted).toBe(true);
        expect(loggerService.info).toHaveBeenCalledWith(
          expect.stringContaining('Starting full backup')
        );
      });

      it('should handle backup creation failure', async () => {
        // Mock pg_dump failure
        const mockSpawn = jest.fn(() => ({
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 10);
            }
          })
        }));
        jest.doMock('child_process', () => ({ spawn: mockSpawn }));

        await expect(backupService.createFullBackup()).rejects.toThrow();
        expect(loggerService.error).toHaveBeenCalled();
      });
    });

    describe('createIncrementalBackup', () => {
      it('should create an incremental backup successfully', async () => {
        // Mock getting last backup timestamp
        mockDb.query.mockResolvedValueOnce({ rows: [{ last_backup: new Date() }] });
        
        // Mock getting incremental changes
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
          release: jest.fn()
        };
        mockDb.connect.mockResolvedValue(mockClient as any);

        // Mock storing metadata
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const backup = await backupService.createIncrementalBackup();

        expect(backup).toHaveProperty('id');
        expect(backup.type).toBe('incremental');
        expect(loggerService.info).toHaveBeenCalledWith(
          expect.stringContaining('Starting incremental backup')
        );
      });
    });

    describe('exportUserData', () => {
      it('should export user data in JSON format', async () => {
        const userId = 'test-user-id';
        const mockUserData = {
          user: { id: userId, email: 'test@example.com' },
          posts: [],
          platformConnections: []
        };

        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockUserData.user] })
            .mockResolvedValueOnce({ rows: mockUserData.posts })
            .mockResolvedValueOnce({ rows: mockUserData.platformConnections })
            .mockResolvedValue({ rows: [] }),
          release: jest.fn()
        };
        mockDb.connect.mockResolvedValue(mockClient as any);
        mockDb.query.mockResolvedValue({ rows: [] });

        const downloadUrl = await backupService.exportUserData(userId, 'json');

        expect(downloadUrl).toBe('https://example.com/download');
        expect(loggerService.info).toHaveBeenCalledWith(
          expect.stringContaining('Exporting user data')
        );
      });

      it('should export user data in CSV format', async () => {
        const userId = 'test-user-id';
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
          release: jest.fn()
        };
        mockDb.connect.mockResolvedValue(mockClient as any);
        mockDb.query.mockResolvedValue({ rows: [] });

        const downloadUrl = await backupService.exportUserData(userId, 'csv');

        expect(downloadUrl).toBe('https://example.com/download');
      });
    });

    describe('testBackupIntegrity', () => {
      it('should validate backup integrity successfully', async () => {
        const backupId = 'test-backup-id';
        const mockMetadata = {
          backup_id: backupId,
          checksum: 'test-checksum',
          location: 'test-bucket/test-file',
          type: 'full'
        };

        mockDb.query.mockResolvedValue({ rows: [mockMetadata] });

        // Mock file operations
        const fs = require('fs');
        fs.promises.readFile.mockResolvedValue('PostgreSQL database dump');

        const isValid = await backupService.testBackupIntegrity(backupId);

        expect(isValid).toBe(true);
      });

      it('should detect corrupted backup', async () => {
        const backupId = 'test-backup-id';
        mockDb.query.mockResolvedValue({ rows: [] });

        const isValid = await backupService.testBackupIntegrity(backupId);

        expect(isValid).toBe(false);
      });
    });
  });

  describe('DataDeletionService', () => {
    describe('requestDataDeletion', () => {
      it('should create a data deletion request', async () => {
        const userId = 'test-user-id';
        const reason = 'User requested account deletion';

        mockDb.query.mockResolvedValue({ rows: [] });

        const request = await dataDeletionService.requestDataDeletion(userId, reason);

        expect(request).toHaveProperty('id');
        expect(request.userId).toBe(userId);
        expect(request.reason).toBe(reason);
        expect(request.status).toBe('pending');
        expect(request.verificationRequired).toBe(true);
        expect(loggerService.audit).toHaveBeenCalledWith(
          'Data deletion requested',
          expect.objectContaining({ userId, reason })
        );
      });

      it('should create immediate deletion request', async () => {
        const userId = 'test-user-id';
        const reason = 'GDPR compliance';

        mockDb.query.mockResolvedValue({ rows: [] });

        const request = await dataDeletionService.requestDataDeletion(userId, reason, true);

        expect(request.status).toBe('scheduled');
        expect(request.verificationRequired).toBe(false);
      });
    });

    describe('verifyDeletionRequest', () => {
      it('should verify deletion request with valid token', async () => {
        const requestId = 'test-request-id';
        const verificationToken = 'test-token';

        mockDb.query
          .mockResolvedValueOnce({ rows: [{ user_id: 'test-user' }] })
          .mockResolvedValueOnce({ rows: [] });

        const verified = await dataDeletionService.verifyDeletionRequest(requestId, verificationToken);

        expect(verified).toBe(true);
        expect(loggerService.audit).toHaveBeenCalledWith(
          'Data deletion verified',
          expect.objectContaining({ requestId })
        );
      });

      it('should reject invalid verification token', async () => {
        const requestId = 'test-request-id';
        const verificationToken = 'invalid-token';

        mockDb.query.mockResolvedValue({ rows: [] });

        const verified = await dataDeletionService.verifyDeletionRequest(requestId, verificationToken);

        expect(verified).toBe(false);
      });
    });

    describe('executeDeletion', () => {
      it('should execute data deletion successfully', async () => {
        const requestId = 'test-request-id';
        const mockRequest = {
          request_id: requestId,
          user_id: 'test-user-id',
          reason: 'User request'
        };

        // Mock getting deletion request
        mockDb.query.mockResolvedValueOnce({ rows: [mockRequest] });
        
        // Mock updating status to in_progress
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        // Mock data collection and deletion
        const mockClient = {
          query: jest.fn()
            .mockResolvedValue({ rows: [{ count: '5' }] }), // Mock count queries
          release: jest.fn()
        };
        mockDb.connect.mockResolvedValue(mockClient as any);

        // Mock final status update
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const result = await dataDeletionService.executeDeletion(requestId);

        expect(result.success).toBe(true);
        expect(result.deletedRecords).toBeGreaterThan(0);
        expect(loggerService.audit).toHaveBeenCalledWith(
          'Data deletion completed',
          expect.objectContaining({ requestId })
        );
      });
    });
  });

  describe('DisasterRecoveryService', () => {
    describe('initializeDefaultProcedures', () => {
      it('should initialize default disaster recovery procedures', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        await disasterRecoveryService.initializeDefaultProcedures();

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO disaster_recovery_procedures'),
          expect.any(Array)
        );
        expect(loggerService.info).toHaveBeenCalledWith(
          'Default disaster recovery procedures initialized'
        );
      });
    });

    describe('executeProcedure', () => {
      it('should execute disaster recovery procedure in test mode', async () => {
        const procedureName = 'database_restore_from_backup';
        const mockProcedure = {
          id: 'test-id',
          procedure_name: procedureName,
          description: 'Test procedure',
          steps: JSON.stringify([
            {
              stepNumber: 1,
              title: 'Test step',
              description: 'Test step description',
              timeoutMinutes: 5,
              critical: false
            }
          ]),
          estimated_duration_minutes: 10,
          priority: 1,
          is_active: true
        };

        // Mock getting procedure
        mockDb.query.mockResolvedValueOnce({ rows: [mockProcedure] });
        
        // Mock creating test record
        mockDb.query.mockResolvedValueOnce({ rows: [] });
        
        // Mock updating test record
        mockDb.query.mockResolvedValueOnce({ rows: [] });
        
        // Mock updating procedure
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const result = await disasterRecoveryService.executeProcedure(procedureName, true);

        expect(result).toHaveProperty('testId');
        expect(result.status).toBe('passed');
        expect(result.completedSteps).toBe(1);
        expect(loggerService.info).toHaveBeenCalledWith(
          'Starting disaster recovery procedure execution',
          expect.objectContaining({ procedureName, testMode: true })
        );
      });
    });

    describe('getReadinessStatus', () => {
      it('should return disaster recovery readiness status', async () => {
        const mockProcedures = [
          {
            id: 'test-id',
            procedure_name: 'test_procedure',
            description: 'Test procedure',
            steps: JSON.stringify([]),
            estimated_duration_minutes: 10,
            priority: 1,
            last_tested_at: new Date(),
            test_results: JSON.stringify({ status: 'passed' }),
            is_active: true
          }
        ];

        mockDb.query.mockResolvedValue({ rows: mockProcedures });

        const status = await disasterRecoveryService.getReadinessStatus();

        expect(status).toHaveProperty('overallStatus');
        expect(status).toHaveProperty('procedures');
        expect(status).toHaveProperty('recommendations');
        expect(status.procedures).toHaveLength(1);
      });
    });
  });

  describe('BackupSchedulerService', () => {
    describe('initialization', () => {
      it('should initialize with default jobs', () => {
        const jobStatus = backupSchedulerService.getJobStatus();

        expect(jobStatus).toHaveLength(6);
        expect(jobStatus.some(job => job.name === 'daily_full_backup')).toBe(true);
        expect(jobStatus.some(job => job.name === 'hourly_incremental_backup')).toBe(true);
        expect(jobStatus.some(job => job.name === 'weekly_backup_cleanup')).toBe(true);
      });
    });

    describe('job management', () => {
      it('should enable and disable jobs', () => {
        backupSchedulerService.setJobEnabled('daily_full_backup', false);
        
        const jobStatus = backupSchedulerService.getJobStatus();
        const dailyBackupJob = jobStatus.find(job => job.name === 'daily_full_backup');
        
        expect(dailyBackupJob?.enabled).toBe(false);
      });

      it('should execute job manually', async () => {
        // Mock the backup service methods
        jest.spyOn(backupService, 'createFullBackup').mockResolvedValue({
          id: 'test-backup',
          timestamp: new Date(),
          type: 'full',
          size: 1024,
          checksum: 'test-checksum',
          encrypted: true,
          location: 'test-location',
          region: 'us-central1',
          retention_until: new Date()
        });

        jest.spyOn(backupService, 'testBackupIntegrity').mockResolvedValue(true);

        await backupSchedulerService.executeJob('daily_full_backup');

        expect(backupService.createFullBackup).toHaveBeenCalled();
        expect(backupService.testBackupIntegrity).toHaveBeenCalled();
        expect(loggerService.info).toHaveBeenCalledWith(
          'Scheduled job completed successfully',
          expect.objectContaining({ jobName: 'daily_full_backup' })
        );
      });
    });

    describe('health check', () => {
      it('should return healthy status when started', () => {
        backupSchedulerService.start();
        
        const health = backupSchedulerService.healthCheck();
        
        expect(health.status).toBe('healthy');
        expect(health.isStarted).toBe(true);
        expect(health.enabledJobs).toBeGreaterThan(0);
        
        backupSchedulerService.stop();
      });

      it('should return unhealthy status when not started', () => {
        const health = backupSchedulerService.healthCheck();
        
        expect(health.status).toBe('unhealthy');
        expect(health.isStarted).toBe(false);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete backup and recovery workflow', async () => {
      // Mock all necessary database operations
      mockDb.query.mockResolvedValue({ rows: [] });
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockDb.connect.mockResolvedValue(mockClient as any);

      // Mock backup creation
      jest.spyOn(backupService, 'createFullBackup').mockResolvedValue({
        id: 'test-backup',
        timestamp: new Date(),
        type: 'full',
        size: 1024,
        checksum: 'test-checksum',
        encrypted: true,
        location: 'test-location',
        region: 'us-central1',
        retention_until: new Date()
      });

      // Mock backup integrity test
      jest.spyOn(backupService, 'testBackupIntegrity').mockResolvedValue(true);

      // Create backup
      const backup = await backupService.createFullBackup();
      expect(backup).toHaveProperty('id');

      // Test backup integrity
      const isValid = await backupService.testBackupIntegrity(backup.id);
      expect(isValid).toBe(true);

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting full backup')
      );
    });

    it('should handle data deletion workflow with verification', async () => {
      const userId = 'test-user-id';
      const reason = 'User requested deletion';

      // Mock database operations
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Create deletion request
        .mockResolvedValueOnce({ rows: [{ user_id: userId }] }) // Verify token
        .mockResolvedValueOnce({ rows: [] }); // Update status

      // Request deletion
      const request = await dataDeletionService.requestDataDeletion(userId, reason);
      expect(request.verificationRequired).toBe(true);

      // Verify deletion
      const verified = await dataDeletionService.verifyDeletionRequest(
        request.id, 
        request.verificationToken!
      );
      expect(verified).toBe(true);

      // Verify audit logging
      expect(loggerService.audit).toHaveBeenCalledWith(
        'Data deletion requested',
        expect.objectContaining({ userId, reason })
      );
    });
  });
});
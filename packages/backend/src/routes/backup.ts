import express from 'express';
import { Pool } from 'pg';
import { Storage } from '@google-cloud/storage';
import { BackupService } from '../services/BackupService';
import { DataDeletionService } from '../services/DataDeletionService';
import { DisasterRecoveryService } from '../services/DisasterRecoveryService';
import { EncryptionService } from '../services/EncryptionService';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { loggerService } from '../services/LoggerService';

const router = express.Router();

// Initialize services (these would typically be injected)
const db = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});

const backupConfig = {
  schedule: '0 2 * * *', // Daily at 2 AM
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
    primary: process.env.BACKUP_BUCKET_PRIMARY || 'sma-backups-primary',
    secondary: process.env.BACKUP_BUCKET_SECONDARY || 'sma-backups-secondary',
    regions: ['us-central1', 'us-east1', 'europe-west1'],
  },
};

const backupService = new BackupService(db, storage, new EncryptionService(), backupConfig);
const dataDeletionService = new DataDeletionService(db, backupService);
const disasterRecoveryService = new DisasterRecoveryService(db, backupService);

/**
 * @swagger
 * /api/backup/create:
 *   post:
 *     summary: Create a database backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [full, incremental]
 *                 description: Type of backup to create
 *             required:
 *               - type
 *     responses:
 *       200:
 *         description: Backup created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 backup:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     type:
 *                       type: string
 *                     size:
 *                       type: number
 *                     location:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Backup creation failed
 */
router.post('/create', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { type } = req.body;

    if (!type || !['full', 'incremental'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup type. Must be "full" or "incremental"'
      });
    }

    loggerService.info('Backup creation requested', {
      userId: req.user?.id,
      type,
      requestId: req.headers['x-request-id']
    });

    let backup;
    if (type === 'full') {
      backup = await backupService.createFullBackup();
    } else {
      backup = await backupService.createIncrementalBackup();
    }

    res.json({
      success: true,
      backup: {
        id: backup.id,
        timestamp: backup.timestamp,
        type: backup.type,
        size: backup.size,
        location: backup.location
      }
    });

  } catch (error) {
    loggerService.error('Backup creation failed', error as Error, {
      userId: req.user?.id,
      type: req.body.type
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
});

/**
 * @swagger
 * /api/backup/restore:
 *   post:
 *     summary: Restore database from backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               backupId:
 *                 type: string
 *                 description: ID of the backup to restore from
 *               targetTime:
 *                 type: string
 *                 format: date-time
 *                 description: Point-in-time to restore to (optional)
 *             required:
 *               - backupId
 *     responses:
 *       200:
 *         description: Restore completed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Restore failed
 */
router.post('/restore', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { backupId, targetTime } = req.body;

    if (!backupId) {
      return res.status(400).json({
        success: false,
        error: 'Backup ID is required'
      });
    }

    loggerService.info('Database restore requested', {
      userId: req.user?.id,
      backupId,
      targetTime,
      requestId: req.headers['x-request-id']
    });

    const targetDate = targetTime ? new Date(targetTime) : undefined;
    await backupService.restoreFromBackup(backupId, targetDate);

    res.json({
      success: true,
      message: 'Database restored successfully'
    });

  } catch (error) {
    loggerService.error('Database restore failed', error as Error, {
      userId: req.user?.id,
      backupId: req.body.backupId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to restore database'
    });
  }
});

/**
 * @swagger
 * /api/backup/test/{backupId}:
 *   post:
 *     summary: Test backup integrity
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the backup to test
 *     responses:
 *       200:
 *         description: Backup integrity test results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 valid:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Test failed
 */
router.post('/test/:backupId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { backupId } = req.params;

    loggerService.info('Backup integrity test requested', {
      userId: req.user?.id,
      backupId,
      requestId: req.headers['x-request-id']
    });

    const isValid = await backupService.testBackupIntegrity(backupId);

    res.json({
      success: true,
      valid: isValid,
      message: isValid ? 'Backup integrity verified' : 'Backup integrity check failed'
    });

  } catch (error) {
    loggerService.error('Backup integrity test failed', error as Error, {
      userId: req.user?.id,
      backupId: req.params.backupId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to test backup integrity'
    });
  }
});

/**
 * @swagger
 * /api/backup/export:
 *   post:
 *     summary: Export user data
 *     tags: [Data Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 description: Export format
 *             required:
 *               - format
 *     responses:
 *       200:
 *         description: Export created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 downloadUrl:
 *                   type: string
 *                   description: Secure download URL for the export
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Export failed
 */
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const { format } = req.body;
    const userId = req.user!.id;

    if (!format || !['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "json" or "csv"'
      });
    }

    loggerService.info('User data export requested', {
      userId,
      format,
      requestId: req.headers['x-request-id']
    });

    const downloadUrl = await backupService.exportUserData(userId, format);

    res.json({
      success: true,
      downloadUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    loggerService.error('User data export failed', error as Error, {
      userId: req.user?.id,
      format: req.body.format
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export user data'
    });
  }
});

/**
 * @swagger
 * /api/backup/delete-request:
 *   post:
 *     summary: Request user data deletion
 *     tags: [Data Deletion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for data deletion
 *               immediate:
 *                 type: boolean
 *                 description: Whether to delete immediately or after grace period
 *             required:
 *               - reason
 *     responses:
 *       200:
 *         description: Deletion request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 requestId:
 *                   type: string
 *                 verificationToken:
 *                   type: string
 *                 scheduledFor:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Request failed
 */
router.post('/delete-request', authenticateToken, async (req, res) => {
  try {
    const { reason, immediate = false } = req.body;
    const userId = req.user!.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required for data deletion'
      });
    }

    loggerService.info('Data deletion requested', {
      userId,
      reason,
      immediate,
      requestId: req.headers['x-request-id']
    });

    const deletionRequest = await dataDeletionService.requestDataDeletion(userId, reason, immediate);

    res.json({
      success: true,
      requestId: deletionRequest.id,
      verificationToken: deletionRequest.verificationToken,
      scheduledFor: deletionRequest.scheduledFor?.toISOString(),
      message: immediate 
        ? 'Data deletion scheduled immediately'
        : 'Data deletion scheduled. Please verify using the provided token.'
    });

  } catch (error) {
    loggerService.error('Data deletion request failed', error as Error, {
      userId: req.user?.id,
      reason: req.body.reason
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create deletion request'
    });
  }
});

/**
 * @swagger
 * /api/backup/delete-verify:
 *   post:
 *     summary: Verify data deletion request
 *     tags: [Data Deletion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestId:
 *                 type: string
 *               verificationToken:
 *                 type: string
 *             required:
 *               - requestId
 *               - verificationToken
 *     responses:
 *       200:
 *         description: Deletion request verified
 *       400:
 *         description: Invalid verification token
 *       500:
 *         description: Verification failed
 */
router.post('/delete-verify', async (req, res) => {
  try {
    const { requestId, verificationToken } = req.body;

    if (!requestId || !verificationToken) {
      return res.status(400).json({
        success: false,
        error: 'Request ID and verification token are required'
      });
    }

    const verified = await dataDeletionService.verifyDeletionRequest(requestId, verificationToken);

    if (!verified) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    res.json({
      success: true,
      message: 'Data deletion request verified and scheduled'
    });

  } catch (error) {
    loggerService.error('Data deletion verification failed', error as Error, {
      requestId: req.body.requestId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to verify deletion request'
    });
  }
});

/**
 * @swagger
 * /api/backup/disaster-recovery/procedures:
 *   get:
 *     summary: Get disaster recovery procedures
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of disaster recovery procedures
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 procedures:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/disaster-recovery/procedures', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const procedures = await disasterRecoveryService.getActiveProcedures();

    res.json({
      success: true,
      procedures
    });

  } catch (error) {
    loggerService.error('Failed to get disaster recovery procedures', error as Error, {
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get disaster recovery procedures'
    });
  }
});

/**
 * @swagger
 * /api/backup/disaster-recovery/execute:
 *   post:
 *     summary: Execute disaster recovery procedure
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               procedureName:
 *                 type: string
 *               testMode:
 *                 type: boolean
 *             required:
 *               - procedureName
 *     responses:
 *       200:
 *         description: Procedure executed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Execution failed
 */
router.post('/disaster-recovery/execute', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { procedureName, testMode = true } = req.body;

    if (!procedureName) {
      return res.status(400).json({
        success: false,
        error: 'Procedure name is required'
      });
    }

    loggerService.info('Disaster recovery procedure execution requested', {
      userId: req.user?.id,
      procedureName,
      testMode,
      requestId: req.headers['x-request-id']
    });

    const result = await disasterRecoveryService.executeProcedure(procedureName, testMode);

    res.json({
      success: true,
      result
    });

  } catch (error) {
    loggerService.error('Disaster recovery procedure execution failed', error as Error, {
      userId: req.user?.id,
      procedureName: req.body.procedureName
    });

    res.status(500).json({
      success: false,
      error: 'Failed to execute disaster recovery procedure'
    });
  }
});

/**
 * @swagger
 * /api/backup/disaster-recovery/status:
 *   get:
 *     summary: Get disaster recovery readiness status
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disaster recovery readiness status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/disaster-recovery/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const status = await disasterRecoveryService.getReadinessStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    loggerService.error('Failed to get disaster recovery status', error as Error, {
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get disaster recovery status'
    });
  }
});

export default router;
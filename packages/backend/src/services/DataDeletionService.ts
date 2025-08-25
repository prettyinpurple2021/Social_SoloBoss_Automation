import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { BackupService } from './BackupService';
import { loggerService } from './LoggerService';
import { EncryptionService } from './EncryptionService';

interface DeletionRequest {
    id: string;
    userId: string;
    reason: string;
    requestedAt: Date;
    scheduledFor?: Date;
    status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed';
    completedAt?: Date;
    verificationRequired: boolean;
    verificationToken?: string;
    verificationExpiresAt?: Date;
}

interface DeletionResult {
    success: boolean;
    deletedRecords: number;
    errors?: string[];
    backupLocation?: string;
    deletionSummary?: {
        posts: number;
        platformConnections: number;
        analytics: number;
        integrations: number;
        exports: number;
    };
}

interface DeletionSummary {
    posts: number;
    platformConnections: number;
    analytics: number;
    integrations: number;
    exports: number;
    auditLogs: number;
}

export class DataDeletionService {
    private db: Pool;
    private backupService: BackupService;

    constructor(db: Pool, backupService: BackupService) {
        this.db = db;
        this.backupService = backupService;
    }

    /**
     * Request user data deletion (GDPR Article 17 - Right to Erasure)
     */
    async requestDataDeletion(userId: string, reason: string, immediateDelete: boolean = false): Promise<DeletionRequest> {
        const requestId = `del_${Date.now()}_${randomBytes(8).toString('hex')}`;
        const verificationToken = randomBytes(32).toString('hex');
        const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const request: DeletionRequest = {
            id: requestId,
            userId,
            reason,
            requestedAt: new Date(),
            scheduledFor: immediateDelete ? new Date() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days grace period
            status: immediateDelete ? 'scheduled' : 'pending',
            verificationRequired: !immediateDelete,
            verificationToken: immediateDelete ? undefined : verificationToken,
            verificationExpiresAt: immediateDelete ? undefined : verificationExpiresAt
        };

        await this.db.query(`
            INSERT INTO data_deletion_requests (
                request_id, user_id, reason, requested_at, scheduled_for, 
                status, verification_required, verification_token, verification_expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            request.id,
            request.userId,
            request.reason,
            request.requestedAt,
            request.scheduledFor,
            request.status,
            request.verificationRequired,
            request.verificationToken,
            request.verificationExpiresAt
        ]);

        loggerService.audit('Data deletion requested', {
            userId,
            requestId: request.id,
            reason,
            immediateDelete,
            scheduledFor: request.scheduledFor?.toISOString()
        });

        return request;
    }

    /**
     * Verify data deletion request with token
     */
    async verifyDeletionRequest(requestId: string, verificationToken: string): Promise<boolean> {
        const result = await this.db.query(`
            SELECT * FROM data_deletion_requests 
            WHERE request_id = $1 AND verification_token = $2 
            AND verification_expires_at > NOW() AND status = 'pending'
        `, [requestId, verificationToken]);

        if (result.rows.length === 0) {
            return false;
        }

        // Update status to scheduled
        await this.db.query(`
            UPDATE data_deletion_requests 
            SET status = 'scheduled', verification_token = NULL, verification_expires_at = NULL
            WHERE request_id = $1
        `, [requestId]);

        loggerService.audit('Data deletion verified', {
            requestId,
            userId: result.rows[0].user_id
        });

        return true;
    }

    /**
     * Cancel a pending deletion request
     */
    async cancelDeletionRequest(requestId: string, userId: string): Promise<boolean> {
        const result = await this.db.query(`
            UPDATE data_deletion_requests 
            SET status = 'cancelled', updated_at = NOW()
            WHERE request_id = $1 AND user_id = $2 AND status IN ('pending', 'scheduled')
            RETURNING *
        `, [requestId, userId]);

        if (result.rows.length === 0) {
            return false;
        }

        loggerService.audit('Data deletion cancelled', {
            requestId,
            userId
        });

        return true;
    }

    /**
     * Execute scheduled data deletions
     */
    async processScheduledDeletions(): Promise<void> {
        const result = await this.db.query(`
            SELECT * FROM data_deletion_requests 
            WHERE status = 'scheduled' AND scheduled_for <= NOW()
            ORDER BY scheduled_for
        `);

        for (const request of result.rows) {
            try {
                await this.executeDeletion(request.request_id);
            } catch (error) {
                loggerService.error('Failed to execute scheduled deletion', error as Error, {
                    requestId: request.request_id,
                    userId: request.user_id
                });
            }
        }
    }

    /**
     * Execute data deletion for a specific request
     */
    async executeDeletion(requestId: string): Promise<DeletionResult> {
        const requestResult = await this.db.query(
            'SELECT * FROM data_deletion_requests WHERE request_id = $1',
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            throw new Error(`Deletion request not found: ${requestId}`);
        }

        const request = requestResult.rows[0];
        const userId = request.user_id;

        // Update status to in_progress
        await this.db.query(
            'UPDATE data_deletion_requests SET status = $1, updated_at = NOW() WHERE request_id = $2',
            ['in_progress', requestId]
        );

        loggerService.info('Starting data deletion execution', {
            requestId,
            userId,
            reason: request.reason
        });

        try {
            // Create final backup before deletion
            const userData = await this.collectUserDataForDeletion(userId);
            const backupLocation = await this.createDeletionBackup(requestId, userData);

            // Execute the deletion
            const deletionSummary = await this.performDataDeletion(userId);

            // Update request with completion details
            await this.db.query(`
                UPDATE data_deletion_requests 
                SET status = $1, completed_at = NOW(), backup_location = $2, deletion_summary = $3
                WHERE request_id = $4
            `, ['completed', backupLocation, JSON.stringify(deletionSummary), requestId]);

            const result: DeletionResult = {
                success: true,
                deletedRecords: Object.values(deletionSummary).reduce((sum, count) => sum + count, 0),
                backupLocation,
                deletionSummary
            };

            loggerService.audit('Data deletion completed', {
                requestId,
                userId,
                deletedRecords: result.deletedRecords,
                deletionSummary
            });

            return result;

        } catch (error) {
            // Update request with error
            await this.db.query(`
                UPDATE data_deletion_requests 
                SET status = $1, error_message = $2, updated_at = NOW()
                WHERE request_id = $3
            `, ['failed', (error as Error).message, requestId]);

            loggerService.error('Data deletion failed', error as Error, {
                requestId,
                userId
            });

            return {
                success: false,
                deletedRecords: 0,
                errors: [(error as Error).message]
            };
        }
    }

    /**
     * Get deletion request status
     */
    async getDeletionRequestStatus(requestId: string): Promise<DeletionRequest | null> {
        const result = await this.db.query(
            'SELECT * FROM data_deletion_requests WHERE request_id = $1',
            [requestId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.request_id,
            userId: row.user_id,
            reason: row.reason,
            requestedAt: row.requested_at,
            scheduledFor: row.scheduled_for,
            status: row.status,
            completedAt: row.completed_at,
            verificationRequired: row.verification_required,
            verificationToken: row.verification_token,
            verificationExpiresAt: row.verification_expires_at
        };
    }

    /**
     * Get all deletion requests for a user
     */
    async getUserDeletionRequests(userId: string): Promise<DeletionRequest[]> {
        const result = await this.db.query(
            'SELECT * FROM data_deletion_requests WHERE user_id = $1 ORDER BY requested_at DESC',
            [userId]
        );

        return result.rows.map((row: any) => ({
            id: row.request_id,
            userId: row.user_id,
            reason: row.reason,
            requestedAt: row.requested_at,
            scheduledFor: row.scheduled_for,
            status: row.status,
            completedAt: row.completed_at,
            verificationRequired: row.verification_required
        }));
    }

    /**
     * Collect user data before deletion for backup
     */
    private async collectUserDataForDeletion(userId: string): Promise<any> {
        const client = await this.db.connect();

        try {
            const userData = {
                user: await this.getUserData(client, userId),
                posts: await this.getUserPosts(client, userId),
                platformConnections: await this.getUserPlatformConnections(client, userId),
                analytics: await this.getUserAnalytics(client, userId),
                integrations: await this.getUserIntegrations(client, userId),
                auditLogs: await this.getUserAuditLogs(client, userId),
                exports: await this.getUserExports(client, userId),
                deletionRequests: await this.getUserDeletionRequests(userId)
            };

            return userData;
        } finally {
            client.release();
        }
    }

    /**
     * Create backup before deletion
     */
    private async createDeletionBackup(requestId: string, userData: any): Promise<string> {
        // Create a full backup and return its location
        const backupMetadata = await this.backupService.createFullBackup();

        // Log the backup creation for the deletion request
        loggerService.info('Created deletion backup', {
            requestId,
            userId: userData.user.id,
            backupId: backupMetadata.id,
            location: backupMetadata.location
        });

        return backupMetadata.location;
    }

    /**
     * Perform the actual data deletion
     */
    private async performDataDeletion(userId: string): Promise<DeletionSummary> {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            const summary: DeletionSummary = {
                posts: 0,
                platformConnections: 0,
                analytics: 0,
                integrations: 0,
                exports: 0,
                auditLogs: 0
            };

            // Count records before deletion
            summary.analytics = await this.countUserAnalytics(client, userId);
            summary.posts = await this.countUserPosts(client, userId);
            summary.platformConnections = await this.countUserPlatformConnections(client, userId);
            summary.integrations = await this.countUserIntegrations(client, userId);
            summary.exports = await this.countUserExports(client, userId);
            summary.auditLogs = await this.countUserAuditLogs(client, userId);

            // Delete data in correct order (respecting foreign keys)
            await this.deleteUserAnalytics(client, userId);
            await this.deleteUserPlatformPosts(client, userId);
            await this.deleteUserPosts(client, userId);
            await this.deleteUserPlatformConnections(client, userId);
            await this.deleteUserIntegrations(client, userId);
            await this.deleteUserExports(client, userId);
            await this.anonymizeUserAuditLogs(client, userId);
            await this.deleteUser(client, userId);

            await client.query('COMMIT');
            return summary;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Helper methods for data collection
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

    private async getUserExports(client: any, userId: string): Promise<any[]> {
        const result = await client.query(
            'SELECT export_id, format, status, requested_at, completed_at FROM data_export_requests WHERE user_id = $1',
            [userId]
        );
        return result.rows;
    }

    // Helper methods for counting records
    private async countUserAnalytics(client: any, userId: string): Promise<number> {
        const result = await client.query(`
            SELECT COUNT(*) as count FROM post_analytics pa
            JOIN platform_posts pp ON pa.platform_post_id = pp.id
            JOIN posts p ON pp.post_id = p.id
            WHERE p.user_id = $1
        `, [userId]);
        return parseInt(result.rows[0].count);
    }

    private async countUserPosts(client: any, userId: string): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM posts WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }

    private async countUserPlatformConnections(client: any, userId: string): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM platform_connections WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }

    private async countUserIntegrations(client: any, userId: string): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM integrations WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }

    private async countUserExports(client: any, userId: string): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM data_export_requests WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }

    private async countUserAuditLogs(client: any, userId: string): Promise<number> {
        const result = await client.query('SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }

    // Helper methods for deletion
    private async deleteUserAnalytics(client: any, userId: string): Promise<void> {
        await client.query(`
            DELETE FROM post_analytics 
            WHERE platform_post_id IN (
                SELECT pp.id FROM platform_posts pp
                JOIN posts p ON pp.post_id = p.id
                WHERE p.user_id = $1
            )
        `, [userId]);
    }

    private async deleteUserPlatformPosts(client: any, userId: string): Promise<void> {
        await client.query(`
            DELETE FROM platform_posts 
            WHERE post_id IN (
                SELECT id FROM posts WHERE user_id = $1
            )
        `, [userId]);
    }

    private async deleteUserPosts(client: any, userId: string): Promise<void> {
        await client.query('DELETE FROM posts WHERE user_id = $1', [userId]);
    }

    private async deleteUserPlatformConnections(client: any, userId: string): Promise<void> {
        await client.query('DELETE FROM platform_connections WHERE user_id = $1', [userId]);
    }

    private async deleteUserIntegrations(client: any, userId: string): Promise<void> {
        await client.query('DELETE FROM integrations WHERE user_id = $1', [userId]);
    }

    private async deleteUserExports(client: any, userId: string): Promise<void> {
        await client.query('DELETE FROM data_export_requests WHERE user_id = $1', [userId]);
    }

    private async anonymizeUserAuditLogs(client: any, userId: string): Promise<void> {
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

    private async deleteUser(client: any, userId: string): Promise<void> {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
    }
}
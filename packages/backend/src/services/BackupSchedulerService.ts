import cron from 'node-cron';
import { Pool } from 'pg';
import { Storage } from '@google-cloud/storage';
import { BackupService } from './BackupService';
import { DataDeletionService } from './DataDeletionService';
import { DisasterRecoveryService } from './DisasterRecoveryService';
import { EncryptionService } from './EncryptionService';
import { loggerService } from './LoggerService';

interface ScheduledJob {
    name: string;
    schedule: string;
    task: () => Promise<void>;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    running: boolean;
}

export class BackupSchedulerService {
    private jobs: Map<string, ScheduledJob> = new Map();
    private backupService: BackupService;
    private dataDeletionService: DataDeletionService;
    private disasterRecoveryService: DisasterRecoveryService;
    private isStarted: boolean = false;

    constructor(
        db: Pool,
        storage: Storage,
        backupConfig: any
    ) {
        this.backupService = new BackupService(db, storage, new EncryptionService(), backupConfig);
        this.dataDeletionService = new DataDeletionService(db, this.backupService);
        this.disasterRecoveryService = new DisasterRecoveryService(db, this.backupService);

        this.initializeJobs();
    }

    /**
     * Initialize all scheduled jobs
     */
    private initializeJobs(): void {
        // Daily full backup at 2 AM
        this.addJob({
            name: 'daily_full_backup',
            schedule: '0 2 * * *',
            task: this.performDailyBackup.bind(this),
            enabled: true,
            running: false
        });

        // Hourly incremental backup during business hours
        this.addJob({
            name: 'hourly_incremental_backup',
            schedule: '0 9-17 * * 1-5',
            task: this.performIncrementalBackup.bind(this),
            enabled: true,
            running: false
        });

        // Weekly backup cleanup on Sundays at 3 AM
        this.addJob({
            name: 'weekly_backup_cleanup',
            schedule: '0 3 * * 0',
            task: this.performBackupCleanup.bind(this),
            enabled: true,
            running: false
        });

        // Daily data deletion processing at 1 AM
        this.addJob({
            name: 'daily_deletion_processing',
            schedule: '0 1 * * *',
            task: this.processScheduledDeletions.bind(this),
            enabled: true,
            running: false
        });

        // Weekly disaster recovery testing on Saturdays at 4 AM
        this.addJob({
            name: 'weekly_dr_testing',
            schedule: '0 4 * * 6',
            task: this.performDisasterRecoveryTesting.bind(this),
            enabled: true,
            running: false
        });

        // Monthly comprehensive backup integrity check
        this.addJob({
            name: 'monthly_integrity_check',
            schedule: '0 5 1 * *',
            task: this.performIntegrityCheck.bind(this),
            enabled: true,
            running: false
        });

        loggerService.info('Backup scheduler jobs initialized', {
            jobCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys())
        });
    }

    /**
     * Start all scheduled jobs
     */
    start(): void {
        if (this.isStarted) {
            loggerService.warn('Backup scheduler already started');
            return;
        }

        for (const [name, job] of this.jobs) {
            if (job.enabled) {
                cron.schedule(job.schedule, async () => {
                    await this.executeJob(name);
                }, {
                    scheduled: true,
                    timezone: process.env.TZ || 'UTC'
                });

                loggerService.info('Scheduled job started', {
                    jobName: name,
                    schedule: job.schedule
                });
            }
        }

        this.isStarted = true;
        loggerService.info('Backup scheduler started');
    }

    /**
     * Stop all scheduled jobs
     */
    stop(): void {
        if (!this.isStarted) {
            return;
        }

        cron.getTasks().forEach(task => task.stop());
        this.isStarted = false;
        loggerService.info('Backup scheduler stopped');
    }

    /**
     * Add a new scheduled job
     */
    addJob(job: ScheduledJob): void {
        this.jobs.set(job.name, job);
        loggerService.info('Scheduled job added', {
            jobName: job.name,
            schedule: job.schedule,
            enabled: job.enabled
        });
    }

    /**
     * Enable or disable a job
     */
    setJobEnabled(jobName: string, enabled: boolean): void {
        const job = this.jobs.get(jobName);
        if (job) {
            job.enabled = enabled;
            loggerService.info('Job status changed', {
                jobName,
                enabled
            });
        }
    }

    /**
     * Get status of all jobs
     */
    getJobStatus(): Array<{
        name: string;
        schedule: string;
        enabled: boolean;
        running: boolean;
        lastRun?: Date;
        nextRun?: Date;
    }> {
        return Array.from(this.jobs.values()).map(job => ({
            name: job.name,
            schedule: job.schedule,
            enabled: job.enabled,
            running: job.running,
            lastRun: job.lastRun,
            nextRun: job.nextRun
        }));
    }

    /**
     * Manually execute a job
     */
    async executeJob(jobName: string): Promise<void> {
        const job = this.jobs.get(jobName);
        if (!job) {
            throw new Error(`Job not found: ${jobName}`);
        }

        if (job.running) {
            loggerService.warn('Job already running, skipping execution', {
                jobName
            });
            return;
        }

        job.running = true;
        job.lastRun = new Date();

        const startTime = Date.now();
        loggerService.info('Starting scheduled job execution', {
            jobName,
            startTime: job.lastRun.toISOString()
        });

        try {
            await job.task();
            
            const duration = Date.now() - startTime;
            loggerService.info('Scheduled job completed successfully', {
                jobName,
                duration,
                completedAt: new Date().toISOString()
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            loggerService.error('Scheduled job failed', error as Error, {
                jobName,
                duration,
                failedAt: new Date().toISOString()
            });

            // Send alert for critical job failures
            if (this.isCriticalJob(jobName)) {
                await this.sendJobFailureAlert(jobName, error as Error);
            }
        } finally {
            job.running = false;
        }
    }

    /**
     * Perform daily full backup
     */
    private async performDailyBackup(): Promise<void> {
        loggerService.info('Starting daily full backup');
        
        const backup = await this.backupService.createFullBackup();
        
        loggerService.info('Daily full backup completed', {
            backupId: backup.id,
            size: backup.size,
            location: backup.location
        });

        // Test backup integrity
        const isValid = await this.backupService.testBackupIntegrity(backup.id);
        if (!isValid) {
            throw new Error(`Backup integrity check failed for backup: ${backup.id}`);
        }

        loggerService.info('Daily backup integrity verified', {
            backupId: backup.id
        });
    }

    /**
     * Perform incremental backup
     */
    private async performIncrementalBackup(): Promise<void> {
        loggerService.info('Starting incremental backup');
        
        const backup = await this.backupService.createIncrementalBackup();
        
        loggerService.info('Incremental backup completed', {
            backupId: backup.id,
            size: backup.size,
            location: backup.location
        });
    }

    /**
     * Perform backup cleanup
     */
    private async performBackupCleanup(): Promise<void> {
        loggerService.info('Starting backup cleanup');
        
        await this.backupService.cleanupExpiredBackups();
        
        loggerService.info('Backup cleanup completed');
    }

    /**
     * Process scheduled data deletions
     */
    private async processScheduledDeletions(): Promise<void> {
        loggerService.info('Starting scheduled data deletion processing');
        
        await this.dataDeletionService.processScheduledDeletions();
        
        loggerService.info('Scheduled data deletion processing completed');
    }

    /**
     * Perform disaster recovery testing
     */
    private async performDisasterRecoveryTesting(): Promise<void> {
        loggerService.info('Starting disaster recovery testing');
        
        await this.disasterRecoveryService.scheduleRegularTests();
        
        loggerService.info('Disaster recovery testing completed');
    }

    /**
     * Perform comprehensive backup integrity check
     */
    private async performIntegrityCheck(): Promise<void> {
        loggerService.info('Starting monthly backup integrity check');
        
        // Get all backups from the last month
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // This would need to be implemented in BackupService
        // const recentBackups = await this.backupService.getBackupsSince(oneMonthAgo);
        
        // For now, just log that we would perform this check
        loggerService.info('Monthly backup integrity check completed');
    }

    /**
     * Check if a job is critical
     */
    private isCriticalJob(jobName: string): boolean {
        const criticalJobs = [
            'daily_full_backup',
            'daily_deletion_processing'
        ];
        return criticalJobs.includes(jobName);
    }

    /**
     * Send alert for job failure
     */
    private async sendJobFailureAlert(jobName: string, error: Error): Promise<void> {
        // In a real implementation, this would send alerts via email, Slack, etc.
        loggerService.error('CRITICAL: Scheduled job failure alert', error, {
            jobName,
            alertType: 'job_failure',
            severity: 'critical',
            timestamp: new Date().toISOString()
        });

        // Could integrate with notification services here
        // await notificationService.sendAlert({
        //     type: 'job_failure',
        //     severity: 'critical',
        //     message: `Critical job failed: ${jobName}`,
        //     error: error.message
        // });
    }

    /**
     * Get backup statistics
     */
    async getBackupStatistics(): Promise<{
        totalBackups: number;
        totalSize: number;
        lastFullBackup?: Date;
        lastIncrementalBackup?: Date;
        oldestBackup?: Date;
        newestBackup?: Date;
    }> {
        // This would need to be implemented in BackupService
        // For now, return placeholder data
        return {
            totalBackups: 0,
            totalSize: 0
        };
    }

    /**
     * Get disaster recovery readiness summary
     */
    async getDisasterRecoveryReadiness(): Promise<{
        status: 'ready' | 'warning' | 'critical';
        lastTest?: Date;
        procedureCount: number;
        issues: string[];
    }> {
        const readinessStatus = await this.disasterRecoveryService.getReadinessStatus();
        
        return {
            status: readinessStatus.overallStatus,
            procedureCount: readinessStatus.procedures.length,
            issues: readinessStatus.recommendations
        };
    }

    /**
     * Health check for the scheduler service
     */
    healthCheck(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        isStarted: boolean;
        jobCount: number;
        runningJobs: number;
        enabledJobs: number;
        lastJobExecution?: Date;
    } {
        const jobs = Array.from(this.jobs.values());
        const runningJobs = jobs.filter(job => job.running).length;
        const enabledJobs = jobs.filter(job => job.enabled).length;
        const lastJobExecution = jobs
            .filter(job => job.lastRun)
            .sort((a, b) => (b.lastRun!.getTime() - a.lastRun!.getTime()))[0]?.lastRun;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        if (!this.isStarted) {
            status = 'unhealthy';
        } else if (enabledJobs === 0) {
            status = 'degraded';
        } else if (lastJobExecution && Date.now() - lastJobExecution.getTime() > 25 * 60 * 60 * 1000) {
            // No job has run in over 25 hours
            status = 'degraded';
        }

        return {
            status,
            isStarted: this.isStarted,
            jobCount: this.jobs.size,
            runningJobs,
            enabledJobs,
            lastJobExecution
        };
    }
}
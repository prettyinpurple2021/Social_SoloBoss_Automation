import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { BackupService } from './BackupService';
import { loggerService } from './LoggerService';

interface DisasterRecoveryProcedure {
    id: string;
    procedureName: string;
    description: string;
    steps: RecoveryStep[];
    estimatedDurationMinutes: number;
    priority: number;
    lastTestedAt?: Date;
    testResults?: TestResult;
    isActive: boolean;
}

interface RecoveryStep {
    stepNumber: number;
    title: string;
    description: string;
    command?: string;
    expectedResult?: string;
    validationQuery?: string;
    rollbackCommand?: string;
    timeoutMinutes: number;
    critical: boolean;
}

interface TestResult {
    testId: string;
    status: 'passed' | 'failed' | 'partial';
    duration: number;
    issuesFound: string[];
    recommendations: string[];
    completedSteps: number;
    totalSteps: number;
}

interface DisasterRecoveryTest {
    id: string;
    testId: string;
    procedureId: string;
    testType: 'scheduled' | 'manual' | 'incident';
    startedAt: Date;
    completedAt?: Date;
    status: 'running' | 'passed' | 'failed' | 'cancelled';
    results?: TestResult;
}

export class DisasterRecoveryService {
    private db: Pool;
    private backupService: BackupService;

    constructor(db: Pool, backupService: BackupService) {
        this.db = db;
        this.backupService = backupService;
    }

    /**
     * Initialize default disaster recovery procedures
     */
    async initializeDefaultProcedures(): Promise<void> {
        const procedures = this.getDefaultProcedures();
        
        for (const procedure of procedures) {
            await this.createOrUpdateProcedure(procedure);
        }

        loggerService.info('Default disaster recovery procedures initialized');
    }

    /**
     * Create or update a disaster recovery procedure
     */
    async createOrUpdateProcedure(procedure: DisasterRecoveryProcedure): Promise<void> {
        await this.db.query(`
            INSERT INTO disaster_recovery_procedures (
                procedure_name, description, steps, estimated_duration_minutes, 
                priority, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (procedure_name) DO UPDATE SET
                description = EXCLUDED.description,
                steps = EXCLUDED.steps,
                estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
                priority = EXCLUDED.priority,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
        `, [
            procedure.procedureName,
            procedure.description,
            JSON.stringify(procedure.steps),
            procedure.estimatedDurationMinutes,
            procedure.priority,
            procedure.isActive
        ]);
    }

    /**
     * Get all active disaster recovery procedures
     */
    async getActiveProcedures(): Promise<DisasterRecoveryProcedure[]> {
        const result = await this.db.query(`
            SELECT * FROM disaster_recovery_procedures 
            WHERE is_active = true 
            ORDER BY priority, procedure_name
        `);

        return result.rows.map(this.mapRowToProcedure);
    }

    /**
     * Get a specific disaster recovery procedure
     */
    async getProcedure(procedureName: string): Promise<DisasterRecoveryProcedure | null> {
        const result = await this.db.query(
            'SELECT * FROM disaster_recovery_procedures WHERE procedure_name = $1',
            [procedureName]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToProcedure(result.rows[0]);
    }

    /**
     * Execute a disaster recovery procedure
     */
    async executeProcedure(procedureName: string, testMode: boolean = false): Promise<TestResult> {
        const procedure = await this.getProcedure(procedureName);
        
        if (!procedure) {
            throw new Error(`Disaster recovery procedure not found: ${procedureName}`);
        }

        const testId = `test_${Date.now()}_${randomBytes(8).toString('hex')}`;
        const startTime = Date.now();

        // Create test record
        await this.db.query(`
            INSERT INTO disaster_recovery_tests (
                test_id, procedure_id, test_type, started_at, status
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            testId,
            procedure.id,
            testMode ? 'manual' : 'incident',
            new Date(),
            'running'
        ]);

        loggerService.info('Starting disaster recovery procedure execution', {
            procedureName,
            testId,
            testMode,
            stepCount: procedure.steps.length
        });

        const result: TestResult = {
            testId,
            status: 'passed',
            duration: 0,
            issuesFound: [],
            recommendations: [],
            completedSteps: 0,
            totalSteps: procedure.steps.length
        };

        try {
            for (const step of procedure.steps) {
                loggerService.info(`Executing recovery step ${step.stepNumber}: ${step.title}`, {
                    testId,
                    stepNumber: step.stepNumber,
                    testMode
                });

                try {
                    await this.executeRecoveryStep(step, testMode);
                    result.completedSteps++;
                } catch (error) {
                    const errorMessage = `Step ${step.stepNumber} failed: ${(error as Error).message}`;
                    result.issuesFound.push(errorMessage);
                    
                    if (step.critical) {
                        result.status = 'failed';
                        loggerService.error('Critical recovery step failed', error as Error, {
                            testId,
                            stepNumber: step.stepNumber,
                            stepTitle: step.title
                        });
                        break;
                    } else {
                        result.status = 'partial';
                        loggerService.warn('Non-critical recovery step failed', {
                            testId,
                            stepNumber: step.stepNumber,
                            error: (error as Error).message
                        });
                    }
                }
            }

            result.duration = Date.now() - startTime;

            // Update test record with results
            await this.db.query(`
                UPDATE disaster_recovery_tests 
                SET completed_at = NOW(), status = $1, results = $2
                WHERE test_id = $3
            `, [result.status, JSON.stringify(result), testId]);

            // Update procedure with test results
            await this.db.query(`
                UPDATE disaster_recovery_procedures 
                SET last_tested_at = NOW(), test_results = $1
                WHERE procedure_name = $2
            `, [JSON.stringify(result), procedureName]);

            loggerService.info('Disaster recovery procedure execution completed', {
                procedureName,
                testId,
                status: result.status,
                duration: result.duration,
                completedSteps: result.completedSteps,
                totalSteps: result.totalSteps,
                issuesFound: result.issuesFound.length
            });

            return result;

        } catch (error) {
            result.status = 'failed';
            result.duration = Date.now() - startTime;
            result.issuesFound.push(`Execution failed: ${(error as Error).message}`);

            await this.db.query(`
                UPDATE disaster_recovery_tests 
                SET completed_at = NOW(), status = 'failed', results = $1
                WHERE test_id = $2
            `, [JSON.stringify(result), testId]);

            loggerService.error('Disaster recovery procedure execution failed', error as Error, {
                procedureName,
                testId
            });

            throw error;
        }
    }

    /**
     * Schedule regular disaster recovery tests
     */
    async scheduleRegularTests(): Promise<void> {
        const procedures = await this.getActiveProcedures();
        
        for (const procedure of procedures) {
            const shouldTest = await this.shouldRunScheduledTest(procedure);
            
            if (shouldTest) {
                try {
                    await this.executeProcedure(procedure.procedureName, true);
                } catch (error) {
                    loggerService.error('Scheduled disaster recovery test failed', error as Error, {
                        procedureName: procedure.procedureName
                    });
                }
            }
        }
    }

    /**
     * Get test history for a procedure
     */
    async getTestHistory(procedureName: string, limit: number = 10): Promise<DisasterRecoveryTest[]> {
        const result = await this.db.query(`
            SELECT drt.* FROM disaster_recovery_tests drt
            JOIN disaster_recovery_procedures drp ON drt.procedure_id = drp.id
            WHERE drp.procedure_name = $1
            ORDER BY drt.started_at DESC
            LIMIT $2
        `, [procedureName, limit]);

        return result.rows.map((row: any) => ({
            id: row.id,
            testId: row.test_id,
            procedureId: row.procedure_id,
            testType: row.test_type,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            status: row.status,
            results: row.results ? JSON.parse(row.results) : undefined
        }));
    }

    /**
     * Get overall disaster recovery readiness status
     */
    async getReadinessStatus(): Promise<{
        overallStatus: 'ready' | 'warning' | 'critical';
        procedures: Array<{
            name: string;
            status: 'ready' | 'warning' | 'critical';
            lastTested?: Date;
            issues: string[];
        }>;
        recommendations: string[];
    }> {
        const procedures = await this.getActiveProcedures();
        const status = {
            overallStatus: 'ready' as 'ready' | 'warning' | 'critical',
            procedures: [] as Array<{
                name: string;
                status: 'ready' | 'warning' | 'critical';
                lastTested?: Date;
                issues: string[];
            }>,
            recommendations: [] as string[]
        };

        let criticalCount = 0;
        let warningCount = 0;

        for (const procedure of procedures) {
            const procedureStatus = {
                name: procedure.procedureName,
                status: 'ready' as 'ready' | 'warning' | 'critical',
                lastTested: procedure.lastTestedAt,
                issues: [] as string[]
            };

            // Check if procedure has been tested recently
            const daysSinceTest = procedure.lastTestedAt 
                ? Math.floor((Date.now() - procedure.lastTestedAt.getTime()) / (1000 * 60 * 60 * 24))
                : Infinity;

            if (daysSinceTest > 90) {
                procedureStatus.status = 'critical';
                procedureStatus.issues.push('Not tested in over 90 days');
                criticalCount++;
            } else if (daysSinceTest > 30) {
                procedureStatus.status = 'warning';
                procedureStatus.issues.push('Not tested in over 30 days');
                warningCount++;
            }

            // Check last test results
            if (procedure.testResults) {
                if (procedure.testResults.status === 'failed') {
                    procedureStatus.status = 'critical';
                    procedureStatus.issues.push('Last test failed');
                    criticalCount++;
                } else if (procedure.testResults.status === 'partial') {
                    procedureStatus.status = 'warning';
                    procedureStatus.issues.push('Last test had issues');
                    warningCount++;
                }
            }

            status.procedures.push(procedureStatus);
        }

        // Determine overall status
        if (criticalCount > 0) {
            status.overallStatus = 'critical';
        } else if (warningCount > 0) {
            status.overallStatus = 'warning';
        }

        // Generate recommendations
        if (criticalCount > 0) {
            status.recommendations.push('Immediately test and fix critical procedures');
        }
        if (warningCount > 0) {
            status.recommendations.push('Schedule testing for procedures with warnings');
        }
        if (procedures.length === 0) {
            status.recommendations.push('Create disaster recovery procedures');
        }

        return status;
    }

    /**
     * Execute a single recovery step
     */
    private async executeRecoveryStep(step: RecoveryStep, testMode: boolean): Promise<void> {
        const startTime = Date.now();
        const timeout = step.timeoutMinutes * 60 * 1000;

        try {
            if (step.command && !testMode) {
                // In production, execute the actual command
                await this.executeCommand(step.command, timeout);
            }

            if (step.validationQuery) {
                // Validate the step was successful
                const isValid = await this.validateStep(step.validationQuery);
                if (!isValid) {
                    throw new Error(`Step validation failed: ${step.validationQuery}`);
                }
            }

            const duration = Date.now() - startTime;
            loggerService.info(`Recovery step completed successfully`, {
                stepNumber: step.stepNumber,
                title: step.title,
                duration,
                testMode
            });

        } catch (error) {
            if (step.rollbackCommand && !testMode) {
                try {
                    await this.executeCommand(step.rollbackCommand, timeout);
                    loggerService.info('Step rollback executed', {
                        stepNumber: step.stepNumber,
                        rollbackCommand: step.rollbackCommand
                    });
                } catch (rollbackError) {
                    loggerService.error('Step rollback failed', rollbackError as Error, {
                        stepNumber: step.stepNumber
                    });
                }
            }
            throw error;
        }
    }

    /**
     * Execute a system command with timeout
     */
    private async executeCommand(command: string, timeoutMs: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const [cmd, ...args] = command.split(' ');
            
            const process = spawn(cmd, args);
            const timeout = setTimeout(() => {
                process.kill();
                reject(new Error(`Command timed out: ${command}`));
            }, timeoutMs);

            process.on('close', (code: number) => {
                clearTimeout(timeout);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}: ${command}`));
                }
            });

            process.on('error', (error: Error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Validate a recovery step
     */
    private async validateStep(validationQuery: string): Promise<boolean> {
        try {
            const result = await this.db.query(validationQuery);
            return result.rows.length > 0;
        } catch (error) {
            loggerService.error('Step validation query failed', error as Error, {
                validationQuery
            });
            return false;
        }
    }

    /**
     * Check if a scheduled test should run
     */
    private async shouldRunScheduledTest(procedure: DisasterRecoveryProcedure): Promise<boolean> {
        // Test high priority procedures weekly, others monthly
        const testIntervalDays = procedure.priority <= 2 ? 7 : 30;
        
        if (!procedure.lastTestedAt) {
            return true;
        }

        const daysSinceTest = Math.floor(
            (Date.now() - procedure.lastTestedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return daysSinceTest >= testIntervalDays;
    }

    /**
     * Map database row to procedure object
     */
    private mapRowToProcedure(row: any): DisasterRecoveryProcedure {
        return {
            id: row.id,
            procedureName: row.procedure_name,
            description: row.description,
            steps: JSON.parse(row.steps),
            estimatedDurationMinutes: row.estimated_duration_minutes,
            priority: row.priority,
            lastTestedAt: row.last_tested_at,
            testResults: row.test_results ? JSON.parse(row.test_results) : undefined,
            isActive: row.is_active
        };
    }

    /**
     * Get default disaster recovery procedures
     */
    private getDefaultProcedures(): DisasterRecoveryProcedure[] {
        return [
            {
                id: '',
                procedureName: 'database_restore_from_backup',
                description: 'Restore database from the most recent backup',
                estimatedDurationMinutes: 30,
                priority: 1,
                isActive: true,
                steps: [
                    {
                        stepNumber: 1,
                        title: 'Stop application services',
                        description: 'Stop all application services to prevent data corruption',
                        command: 'docker-compose down',
                        timeoutMinutes: 5,
                        critical: true
                    },
                    {
                        stepNumber: 2,
                        title: 'Create current database backup',
                        description: 'Create a backup of current state before restore',
                        validationQuery: 'SELECT COUNT(*) FROM backup_metadata WHERE timestamp > NOW() - INTERVAL \'1 hour\'',
                        timeoutMinutes: 15,
                        critical: true
                    },
                    {
                        stepNumber: 3,
                        title: 'Restore from backup',
                        description: 'Restore database from the most recent backup',
                        timeoutMinutes: 20,
                        critical: true
                    },
                    {
                        stepNumber: 4,
                        title: 'Verify database integrity',
                        description: 'Run integrity checks on restored database',
                        validationQuery: 'SELECT COUNT(*) FROM users WHERE id IS NOT NULL',
                        timeoutMinutes: 5,
                        critical: true
                    },
                    {
                        stepNumber: 5,
                        title: 'Start application services',
                        description: 'Restart all application services',
                        command: 'docker-compose up -d',
                        validationQuery: 'SELECT 1',
                        timeoutMinutes: 10,
                        critical: true
                    }
                ]
            },
            {
                id: '',
                procedureName: 'failover_to_secondary_region',
                description: 'Failover to secondary region in case of primary region failure',
                estimatedDurationMinutes: 45,
                priority: 1,
                isActive: true,
                steps: [
                    {
                        stepNumber: 1,
                        title: 'Verify secondary region status',
                        description: 'Check that secondary region is healthy and ready',
                        timeoutMinutes: 5,
                        critical: true
                    },
                    {
                        stepNumber: 2,
                        title: 'Update DNS records',
                        description: 'Point DNS to secondary region',
                        timeoutMinutes: 10,
                        critical: true
                    },
                    {
                        stepNumber: 3,
                        title: 'Sync latest data',
                        description: 'Ensure secondary region has latest data',
                        timeoutMinutes: 20,
                        critical: true
                    },
                    {
                        stepNumber: 4,
                        title: 'Start services in secondary region',
                        description: 'Start all application services in secondary region',
                        timeoutMinutes: 10,
                        critical: true
                    }
                ]
            },
            {
                id: '',
                procedureName: 'security_incident_response',
                description: 'Response procedure for security incidents',
                estimatedDurationMinutes: 60,
                priority: 2,
                isActive: true,
                steps: [
                    {
                        stepNumber: 1,
                        title: 'Isolate affected systems',
                        description: 'Isolate compromised systems from network',
                        timeoutMinutes: 5,
                        critical: true
                    },
                    {
                        stepNumber: 2,
                        title: 'Revoke compromised credentials',
                        description: 'Revoke all potentially compromised API keys and tokens',
                        timeoutMinutes: 10,
                        critical: true
                    },
                    {
                        stepNumber: 3,
                        title: 'Create forensic backup',
                        description: 'Create backup for forensic analysis',
                        timeoutMinutes: 30,
                        critical: false
                    },
                    {
                        stepNumber: 4,
                        title: 'Notify stakeholders',
                        description: 'Notify relevant stakeholders about the incident',
                        timeoutMinutes: 15,
                        critical: false
                    }
                ]
            }
        ];
    }
}
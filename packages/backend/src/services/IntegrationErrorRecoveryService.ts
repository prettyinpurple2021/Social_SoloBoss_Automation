import { IntegrationErrorService } from './IntegrationErrorService';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';

export class IntegrationErrorRecoveryService {
  private static instance: IntegrationErrorRecoveryService;
  private errorService: IntegrationErrorService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  private constructor() {
    this.errorService = IntegrationErrorService.getInstance();
  }

  public static getInstance(): IntegrationErrorRecoveryService {
    if (!IntegrationErrorRecoveryService.instance) {
      IntegrationErrorRecoveryService.instance = new IntegrationErrorRecoveryService();
    }
    return IntegrationErrorRecoveryService.instance;
  }

  /**
   * Start the error recovery service
   */
  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      loggerService.warn('Integration error recovery service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    loggerService.info('Starting integration error recovery service', {
      intervalMinutes,
      intervalMs
    });

    // Run immediately on start
    this.processRecoveries();

    // Schedule recurring processing
    this.intervalId = setInterval(() => {
      this.processRecoveries();
    }, intervalMs);

    monitoringService.recordMetric('integration_error_recovery_service_started', 1, 'counter');
  }

  /**
   * Stop the error recovery service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    loggerService.info('Integration error recovery service stopped');
    monitoringService.recordMetric('integration_error_recovery_service_stopped', 1, 'counter');
  }

  /**
   * Process pending error recoveries
   */
  private async processRecoveries(): Promise<void> {
    try {
      loggerService.debug('Processing pending error recoveries');
      
      const startTime = Date.now();
      await this.errorService.processPendingRecoveries();
      const processingTime = Date.now() - startTime;

      loggerService.debug('Completed processing pending error recoveries', {
        processingTimeMs: processingTime
      });

      monitoringService.recordMetric('integration_error_recovery_cycle_completed', 1, 'counter', {
        processingTimeMs: processingTime.toString()
      });

    } catch (error) {
      loggerService.error('Error during recovery processing cycle', error as Error);
      
      monitoringService.recordMetric('integration_error_recovery_cycle_failed', 1, 'counter', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; intervalId?: NodeJS.Timeout } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId
    };
  }
}
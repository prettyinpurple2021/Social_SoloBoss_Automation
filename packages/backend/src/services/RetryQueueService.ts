import { QueueService } from './QueueService';
import { PostService } from './PostService';
import { IntegrationService } from './IntegrationService';
import { NotificationService } from './NotificationService';
import { loggerService } from './LoggerService';
import { AppError, ErrorCode, ErrorSeverity, PlatformError } from '../types/errors';
import { PostStatus, Platform } from '../types/database';

export interface RetryJob {
  id: string;
  type: 'post_publish' | 'platform_connection' | 'integration_sync';
  data: any;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError?: AppError;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryQueueStats {
  totalJobs: number;
  pendingJobs: number;
  failedJobs: number;
  completedJobs: number;
  jobsByType: Record<string, number>;
}

export class RetryQueueService {
  private static instance: RetryQueueService;
  private retryJobs: Map<string, RetryJob> = new Map();
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  private constructor() {}

  static getInstance(): RetryQueueService {
    if (!RetryQueueService.instance) {
      RetryQueueService.instance = new RetryQueueService();
    }
    return RetryQueueService.instance;
  }

  /**
   * Start the retry queue processor
   */
  start(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    // Process retry jobs every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processRetryJobs().catch(error => {
        loggerService.error('Error processing retry jobs', error);
      });
    }, 30000);

    loggerService.info('Retry queue service started');
  }

  /**
   * Stop the retry queue processor
   */
  stop(): void {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    loggerService.info('Retry queue service stopped');
  }

  /**
   * Add a failed post to the retry queue
   */
  async addPostRetry(
    postId: string,
    userId: string,
    platform: Platform,
    error: AppError,
    maxAttempts: number = 3
  ): Promise<string> {
    const jobId = `post_${postId}_${platform}_${Date.now()}`;
    const nextRetryAt = this.calculateNextRetryTime(1);

    const retryJob: RetryJob = {
      id: jobId,
      type: 'post_publish',
      data: {
        postId,
        userId,
        platform,
      },
      attempts: 0,
      maxAttempts,
      nextRetryAt,
      lastError: error,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.retryJobs.set(jobId, retryJob);

    // Send notification about the failed post
    await NotificationService.sendPostFailureNotification(
      postId,
      userId,
      platform,
      error,
      0,
      nextRetryAt
    );

    loggerService.info(
      'Post added to retry queue',
      { jobId, postId, platform, nextRetryAt }
    );

    return jobId;
  }

  /**
   * Add a failed platform connection to the retry queue
   */
  async addPlatformConnectionRetry(
    userId: string,
    platform: Platform,
    error: AppError,
    maxAttempts: number = 3
  ): Promise<string> {
    const jobId = `platform_${userId}_${platform}_${Date.now()}`;
    const nextRetryAt = this.calculateNextRetryTime(1);

    const retryJob: RetryJob = {
      id: jobId,
      type: 'platform_connection',
      data: {
        userId,
        platform,
      },
      attempts: 0,
      maxAttempts,
      nextRetryAt,
      lastError: error,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.retryJobs.set(jobId, retryJob);

    loggerService.info(
      'Platform connection added to retry queue',
      { jobId, userId, platform, nextRetryAt }
    );

    return jobId;
  }

  /**
   * Add a failed integration sync to the retry queue
   */
  async addIntegrationRetry(
    userId: string,
    integration: string,
    data: any,
    error: AppError,
    maxAttempts: number = 3
  ): Promise<string> {
    const jobId = `integration_${userId}_${integration}_${Date.now()}`;
    const nextRetryAt = this.calculateNextRetryTime(1);

    const retryJob: RetryJob = {
      id: jobId,
      type: 'integration_sync',
      data: {
        userId,
        integration,
        ...data,
      },
      attempts: 0,
      maxAttempts,
      nextRetryAt,
      lastError: error,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.retryJobs.set(jobId, retryJob);

    loggerService.info(
      'Integration sync added to retry queue',
      { jobId, userId, integration, nextRetryAt }
    );

    return jobId;
  }

  /**
   * Manually retry a specific job
   */
  async manualRetry(jobId: string): Promise<boolean> {
    const job = this.retryJobs.get(jobId);
    
    if (!job) {
      loggerService.warn('Retry job not found for manual retry', { jobId });
      return false;
    }

    // Reset retry time to now for immediate processing
    job.nextRetryAt = new Date();
    job.updatedAt = new Date();

    loggerService.info('Job scheduled for manual retry', { jobId });
    
    // Process immediately
    await this.processRetryJob(job);
    
    return true;
  }

  /**
   * Cancel a retry job
   */
  cancelRetry(jobId: string): boolean {
    const job = this.retryJobs.get(jobId);
    
    if (!job) {
      return false;
    }

    this.retryJobs.delete(jobId);
    
    loggerService.info('Retry job cancelled', { jobId });
    return true;
  }

  /**
   * Get retry jobs with optional filtering
   */
  getRetryJobs(
    type?: string,
    userId?: string,
    status?: 'pending' | 'failed' | 'exhausted'
  ): RetryJob[] {
    let jobs = Array.from(this.retryJobs.values());

    if (type) {
      jobs = jobs.filter(job => job.type === type);
    }

    if (userId) {
      jobs = jobs.filter(job => job.data.userId === userId);
    }

    if (status) {
      const now = new Date();
      jobs = jobs.filter(job => {
        switch (status) {
          case 'pending':
            return job.attempts < job.maxAttempts && job.nextRetryAt > now;
          case 'failed':
            return job.attempts < job.maxAttempts && job.nextRetryAt <= now;
          case 'exhausted':
            return job.attempts >= job.maxAttempts;
          default:
            return true;
        }
      });
    }

    return jobs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get retry queue statistics
   */
  getStats(): RetryQueueStats {
    const jobs = Array.from(this.retryJobs.values());
    const now = new Date();

    const stats: RetryQueueStats = {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(job => job.attempts < job.maxAttempts && job.nextRetryAt > now).length,
      failedJobs: jobs.filter(job => job.attempts < job.maxAttempts && job.nextRetryAt <= now).length,
      completedJobs: 0, // Completed jobs are removed from the queue
      jobsByType: {},
    };

    // Count jobs by type
    for (const job of jobs) {
      stats.jobsByType[job.type] = (stats.jobsByType[job.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear completed and old jobs
   */
  cleanup(): void {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [jobId, job] of this.retryJobs.entries()) {
      // Remove jobs that are exhausted and older than 7 days
      if (job.attempts >= job.maxAttempts && job.updatedAt < sevenDaysAgo) {
        this.retryJobs.delete(jobId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      loggerService.info('Retry queue cleanup completed', { removedCount });
    }
  }

  /**
   * Process all retry jobs that are ready
   */
  private async processRetryJobs(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.retryJobs.values())
      .filter(job => job.nextRetryAt <= now && job.attempts < job.maxAttempts);

    if (readyJobs.length === 0) {
      return;
    }

    loggerService.info(`Processing ${readyJobs.length} retry jobs`);

    for (const job of readyJobs) {
      try {
        await this.processRetryJob(job);
      } catch (error) {
        loggerService.error(
          'Error processing retry job',
          error as Error,
          { jobId: job.id, jobType: job.type }
        );
      }
    }

    // Cleanup old jobs
    this.cleanup();
  }

  /**
   * Process a single retry job
   */
  private async processRetryJob(job: RetryJob): Promise<void> {
    job.attempts++;
    job.updatedAt = new Date();

    try {
      let success = false;

      switch (job.type) {
        case 'post_publish':
          success = await this.retryPostPublish(job);
          break;
        case 'platform_connection':
          success = await this.retryPlatformConnection(job);
          break;
        case 'integration_sync':
          success = await this.retryIntegrationSync(job);
          break;
        default:
          throw new Error(`Unknown retry job type: ${job.type}`);
      }

      if (success) {
        // Job succeeded, remove from queue
        this.retryJobs.delete(job.id);
        loggerService.info(
          'Retry job completed successfully',
          { jobId: job.id, attempts: job.attempts }
        );
      } else {
        // Job failed, schedule next retry or mark as exhausted
        await this.handleRetryFailure(job);
      }
    } catch (error) {
      job.lastError = error instanceof AppError ? error : new AppError(
        (error as Error).message,
        ErrorCode.INTERNAL_SERVER_ERROR,
        500,
        ErrorSeverity.HIGH,
        true
      );

      await this.handleRetryFailure(job);
    }
  }

  /**
   * Retry post publishing
   */
  private async retryPostPublish(job: RetryJob): Promise<boolean> {
    const { postId, userId, platform } = job.data;

    try {
      // Get the post
      const post = await PostService.getPost(postId, userId);
      if (!post) {
        loggerService.warn('Post not found for retry', { postId, userId });
        return false;
      }

      // Find the platform post
      const platformPost = post.platformPosts.find(pp => pp.platform === platform);
      if (!platformPost) {
        loggerService.warn('Platform post not found for retry', { postId, platform });
        return false;
      }

      // Attempt to publish
      const integrationService = IntegrationService.getInstance();
      const result = await integrationService.publishPost(post.user_id, platform, {
        content: post.content,
        images: post.images,
        hashtags: post.hashtags
      });
      
      if (result.success) {
        // Update post status to published
        await PostService.updatePostStatus(postId, userId, PostStatus.PUBLISHED);
        return true;
      } else {
        job.lastError = new PlatformError(
          result.error || 'Publishing failed',
          ErrorCode.POST_PUBLISHING_FAILED,
          result.retryable
        );
        return false;
      }
    } catch (error) {
      job.lastError = error instanceof AppError ? error : new AppError(
        (error as Error).message,
        ErrorCode.POST_PUBLISHING_FAILED,
        500,
        ErrorSeverity.HIGH,
        true
      );
      return false;
    }
  }

  /**
   * Retry platform connection
   */
  private async retryPlatformConnection(job: RetryJob): Promise<boolean> {
    const { userId, platform } = job.data;

    try {
      // Attempt to refresh the platform connection
      // This would typically involve refreshing OAuth tokens
      // Implementation depends on the specific platform and OAuth service
      
      loggerService.info('Platform connection retry not yet implemented', { userId, platform });
      return false;
    } catch (error) {
      job.lastError = error instanceof AppError ? error : new AppError(
        (error as Error).message,
        ErrorCode.PLATFORM_AUTHENTICATION_FAILED,
        500,
        ErrorSeverity.HIGH,
        true
      );
      return false;
    }
  }

  /**
   * Retry integration sync
   */
  private async retryIntegrationSync(job: RetryJob): Promise<boolean> {
    const { userId, integration } = job.data;

    try {
      // Attempt to sync the integration
      // Implementation depends on the specific integration
      
      loggerService.info('Integration sync retry not yet implemented', { userId, integration });
      return false;
    } catch (error) {
      job.lastError = error instanceof AppError ? error : new AppError(
        (error as Error).message,
        ErrorCode.INTERNAL_SERVER_ERROR,
        500,
        ErrorSeverity.HIGH,
        true
      );
      return false;
    }
  }

  /**
   * Handle retry job failure
   */
  private async handleRetryFailure(job: RetryJob): Promise<void> {
    if (job.attempts >= job.maxAttempts) {
      // Job exhausted, send final notification
      loggerService.error(
        'Retry job exhausted',
        job.lastError,
        { jobId: job.id, attempts: job.attempts, maxAttempts: job.maxAttempts }
      );

      if (job.type === 'post_publish') {
        await NotificationService.sendPostFailureNotification(
          job.data.postId,
          job.data.userId,
          job.data.platform,
          job.lastError || new AppError('Max retry attempts exceeded', ErrorCode.POST_PUBLISHING_FAILED),
          job.attempts
        );
      }
    } else {
      // Schedule next retry
      job.nextRetryAt = this.calculateNextRetryTime(job.attempts);
      
      loggerService.info(
        'Retry job scheduled for next attempt',
        { jobId: job.id, attempts: job.attempts, nextRetryAt: job.nextRetryAt }
      );
    }
  }

  /**
   * Calculate next retry time using exponential backoff
   */
  private calculateNextRetryTime(attempt: number): Date {
    // Exponential backoff: 1min, 5min, 15min
    const delays = [60, 300, 900]; // seconds
    const delay = delays[Math.min(attempt - 1, delays.length - 1)];
    
    return new Date(Date.now() + delay * 1000);
  }
}

// Export singleton instance
export const retryQueueService = RetryQueueService.getInstance();
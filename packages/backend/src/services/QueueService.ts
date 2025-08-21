import Bull, { Queue, Job, JobOptions } from 'bull';
import { redis } from '../database/redis';

export interface PostExecutionJobData {
  postId: string;
  userId: string;
  scheduledTime: Date;
  retryCount?: number;
}

export interface RetryJobData extends PostExecutionJobData {
  originalError: string;
  lastAttemptAt: Date;
}

export class QueueService {
  private static instance: QueueService;
  private postQueue: Queue<PostExecutionJobData>;
  private retryQueue: Queue<RetryJobData>;

  private constructor() {
    // Initialize Redis connection
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };

    // Create post execution queue
    this.postQueue = new Bull<PostExecutionJobData>('post-execution', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 1, // We handle retries manually for better control
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute base delay
        },
      },
    });

    // Create retry queue for failed posts
    this.retryQueue = new Bull<RetryJobData>('post-retry', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 300000, // 5 minute base delay for retries
        },
      },
    });

    // Set up error handling
    this.postQueue.on('error', (error) => {
      console.error('Post queue error:', error);
    });

    this.retryQueue.on('error', (error) => {
      console.error('Retry queue error:', error);
    });

    // Log job completion
    this.postQueue.on('completed', (job: Job<PostExecutionJobData>) => {
      console.log(`Post execution job completed: ${job.id} for post ${job.data.postId}`);
    });

    this.postQueue.on('failed', (job: Job<PostExecutionJobData>, err: Error) => {
      console.error(`Post execution job failed: ${job.id} for post ${job.data.postId}`, err);
    });

    this.retryQueue.on('completed', (job: Job<RetryJobData>) => {
      console.log(`Post retry job completed: ${job.id} for post ${job.data.postId}`);
    });

    this.retryQueue.on('failed', (job: Job<RetryJobData>, err: Error) => {
      console.error(`Post retry job failed: ${job.id} for post ${job.data.postId}`, err);
    });
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Schedule a post for execution at a specific time
   */
  public async schedulePost(
    postId: string,
    userId: string,
    scheduledTime: Date
  ): Promise<Job<PostExecutionJobData>> {
    const delay = scheduledTime.getTime() - Date.now();
    
    const jobOptions: JobOptions = {
      delay: Math.max(0, delay), // Don't allow negative delays
      jobId: `post-${postId}`, // Use consistent job ID for deduplication
    };

    const jobData: PostExecutionJobData = {
      postId,
      userId,
      scheduledTime,
      retryCount: 0,
    };

    return await this.postQueue.add('execute-post', jobData, jobOptions);
  }

  /**
   * Schedule a post for immediate execution
   */
  public async executePostNow(
    postId: string,
    userId: string
  ): Promise<Job<PostExecutionJobData>> {
    const jobData: PostExecutionJobData = {
      postId,
      userId,
      scheduledTime: new Date(),
      retryCount: 0,
    };

    return await this.postQueue.add('execute-post', jobData);
  }

  /**
   * Schedule a post for retry with exponential backoff
   */
  public async scheduleRetry(
    postId: string,
    userId: string,
    originalError: string,
    retryCount: number,
    scheduledTime: Date
  ): Promise<Job<RetryJobData>> {
    // Calculate exponential backoff delay: 1min, 5min, 15min
    const baseDelay = 60000; // 1 minute
    const backoffMultiplier = Math.pow(5, retryCount - 1);
    const delay = baseDelay * backoffMultiplier;

    const jobOptions: JobOptions = {
      delay,
      jobId: `retry-${postId}-${retryCount}`,
    };

    const jobData: RetryJobData = {
      postId,
      userId,
      scheduledTime,
      retryCount,
      originalError,
      lastAttemptAt: new Date(),
    };

    return await this.retryQueue.add('retry-post', jobData, jobOptions);
  }

  /**
   * Cancel a scheduled post
   */
  public async cancelScheduledPost(postId: string): Promise<boolean> {
    try {
      const job = await this.postQueue.getJob(`post-${postId}`);
      if (job) {
        await job.remove();
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error canceling scheduled post ${postId}:`, error);
      return false;
    }
  }

  /**
   * Cancel all retry attempts for a post
   */
  public async cancelRetries(postId: string): Promise<number> {
    try {
      const jobs = await this.retryQueue.getJobs(['delayed', 'waiting']);
      let canceledCount = 0;

      for (const job of jobs) {
        if (job.data.postId === postId) {
          await job.remove();
          canceledCount++;
        }
      }

      return canceledCount;
    } catch (error) {
      console.error(`Error canceling retries for post ${postId}:`, error);
      return 0;
    }
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<{
    postQueue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    retryQueue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    const [postWaiting, postActive, postCompleted, postFailed, postDelayed] = await Promise.all([
      this.postQueue.getWaiting(),
      this.postQueue.getActive(),
      this.postQueue.getCompleted(),
      this.postQueue.getFailed(),
      this.postQueue.getDelayed(),
    ]);

    const [retryWaiting, retryActive, retryCompleted, retryFailed, retryDelayed] = await Promise.all([
      this.retryQueue.getWaiting(),
      this.retryQueue.getActive(),
      this.retryQueue.getCompleted(),
      this.retryQueue.getFailed(),
      this.retryQueue.getDelayed(),
    ]);

    return {
      postQueue: {
        waiting: postWaiting.length,
        active: postActive.length,
        completed: postCompleted.length,
        failed: postFailed.length,
        delayed: postDelayed.length,
      },
      retryQueue: {
        waiting: retryWaiting.length,
        active: retryActive.length,
        completed: retryCompleted.length,
        failed: retryFailed.length,
        delayed: retryDelayed.length,
      },
    };
  }

  /**
   * Get the post execution queue
   */
  public getPostQueue(): Queue<PostExecutionJobData> {
    return this.postQueue;
  }

  /**
   * Get the retry queue
   */
  public getRetryQueue(): Queue<RetryJobData> {
    return this.retryQueue;
  }

  /**
   * Clean up old jobs
   */
  public async cleanupJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 24 hours
      await this.postQueue.clean(24 * 60 * 60 * 1000, 'completed');
      await this.retryQueue.clean(24 * 60 * 60 * 1000, 'completed');

      // Clean failed jobs older than 7 days
      await this.postQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      await this.retryQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

      console.log('Queue cleanup completed');
    } catch (error) {
      console.error('Error during queue cleanup:', error);
    }
  }

  /**
   * Close all queues
   */
  public async close(): Promise<void> {
    await Promise.all([
      this.postQueue.close(),
      this.retryQueue.close(),
    ]);
  }
}

// Export singleton instance
export const queueService = QueueService.getInstance();
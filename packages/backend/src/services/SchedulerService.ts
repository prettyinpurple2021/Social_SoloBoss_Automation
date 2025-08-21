import { Job } from 'bull';
import { PostService, PostWithPlatformPosts } from './PostService';
import { IntegrationService } from './IntegrationService';
import { queueService, PostExecutionJobData, RetryJobData } from './QueueService';
import { PostStatus, Platform } from '../types/database';
import { PlatformPostModel } from '../models/PlatformPost';

export interface PostExecutionResult {
  postId: string;
  success: boolean;
  platformResults: PlatformExecutionResult[];
  error?: string;
}

export interface PlatformExecutionResult {
  platform: Platform;
  success: boolean;
  platformPostId?: string;
  error?: string;
  retryable: boolean;
}

export interface SchedulerError extends Error {
  retryable: boolean;
  platformErrors?: Record<Platform, string>;
}

export class SchedulerService {
  private static instance: SchedulerService;
  private integrationService: IntegrationService;
  private maxRetries: number = 3;

  private constructor() {
    this.integrationService = IntegrationService.getInstance();
    this.setupQueueProcessors();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Set up Bull queue processors
   */
  private setupQueueProcessors(): void {
    // Process post execution jobs
    queueService.getPostQueue().process('execute-post', async (job: Job<PostExecutionJobData>) => {
      return await this.executePost(job.data);
    });

    // Process retry jobs
    queueService.getRetryQueue().process('retry-post', async (job: Job<RetryJobData>) => {
      return await this.retryPost(job.data);
    });
  }

  /**
   * Schedule a post for execution
   */
  public async schedulePost(postId: string, userId: string, scheduledTime: Date): Promise<void> {
    try {
      // Update post status to scheduled
      await PostService.updatePostStatus(postId, userId, PostStatus.SCHEDULED);
      
      // Add to queue
      await queueService.schedulePost(postId, userId, scheduledTime);
      
      console.log(`Post ${postId} scheduled for execution at ${scheduledTime.toISOString()}`);
    } catch (error) {
      console.error(`Error scheduling post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a post immediately
   */
  public async executePostNow(postId: string, userId: string): Promise<PostExecutionResult> {
    try {
      const jobData: PostExecutionJobData = {
        postId,
        userId,
        scheduledTime: new Date(),
        retryCount: 0,
      };

      return await this.executePost(jobData);
    } catch (error) {
      console.error(`Error executing post ${postId} immediately:`, error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled post
   */
  public async cancelScheduledPost(postId: string, userId: string): Promise<boolean> {
    try {
      // Cancel from queue
      const canceled = await queueService.cancelScheduledPost(postId);
      
      if (canceled) {
        // Update post status back to draft
        await PostService.updatePostStatus(postId, userId, PostStatus.DRAFT);
        console.log(`Canceled scheduled post ${postId}`);
      }
      
      return canceled;
    } catch (error) {
      console.error(`Error canceling scheduled post ${postId}:`, error);
      return false;
    }
  }

  /**
   * Execute a post across all platforms
   */
  private async executePost(jobData: PostExecutionJobData): Promise<PostExecutionResult> {
    const { postId, userId } = jobData;
    
    try {
      console.log(`Executing post ${postId} for user ${userId}`);
      
      // Get post data
      const post = await PostService.getPost(postId, userId);
      if (!post) {
        throw new Error(`Post ${postId} not found or access denied`);
      }

      // Update post status to publishing
      await PostService.updatePostStatus(postId, userId, PostStatus.PUBLISHING);

      // Execute on each platform
      const platformResults: PlatformExecutionResult[] = [];
      let hasFailures = false;
      let hasRetryableFailures = false;

      for (const platformPost of post.platformPosts) {
        try {
          const result = await this.executePlatformPost(post, platformPost.platform, platformPost.id);
          platformResults.push(result);
          
          if (!result.success) {
            hasFailures = true;
            if (result.retryable) {
              hasRetryableFailures = true;
            }
          }
        } catch (error) {
          console.error(`Error executing post on ${platformPost.platform}:`, error);
          platformResults.push({
            platform: platformPost.platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryable: true,
          });
          hasFailures = true;
          hasRetryableFailures = true;
        }
      }

      // Determine final status
      let finalStatus: PostStatus;
      if (!hasFailures) {
        finalStatus = PostStatus.PUBLISHED;
      } else if (hasRetryableFailures && (jobData.retryCount || 0) < this.maxRetries) {
        finalStatus = PostStatus.SCHEDULED; // Keep as scheduled for retry
        await this.scheduleRetryIfNeeded(jobData, platformResults);
      } else {
        finalStatus = PostStatus.FAILED;
      }

      // Update post status
      await PostService.updatePostStatus(postId, userId, finalStatus);

      const result: PostExecutionResult = {
        postId,
        success: !hasFailures,
        platformResults,
      };

      console.log(`Post ${postId} execution completed with status: ${finalStatus}`);
      return result;

    } catch (error) {
      console.error(`Error executing post ${postId}:`, error);
      
      // Update post status to failed
      await PostService.updatePostStatus(postId, userId, PostStatus.FAILED);
      
      const result: PostExecutionResult = {
        postId,
        success: false,
        platformResults: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return result;
    }
  }

  /**
   * Execute a post on a specific platform
   */
  private async executePlatformPost(
    post: PostWithPlatformPosts,
    platform: Platform,
    platformPostId: string
  ): Promise<PlatformExecutionResult> {
    try {
      // Update platform post status to publishing
      await PlatformPostModel.updateStatus(platformPostId, PostStatus.PUBLISHING);

      // Execute through integration service
      const publishResult = await this.integrationService.publishPost(post.user_id, platform, {
        content: post.content,
        images: post.images,
        hashtags: post.hashtags,
      });

      if (publishResult.success && publishResult.platformPostId) {
        // Update platform post with success
        await PlatformPostModel.update(platformPostId, {
          platform_post_id: publishResult.platformPostId,
          status: PostStatus.PUBLISHED,
          published_at: new Date(),
          error: undefined,
        });

        return {
          platform,
          success: true,
          platformPostId: publishResult.platformPostId,
          retryable: false,
        };
      } else {
        // Update platform post with error
        await PlatformPostModel.update(platformPostId, {
          status: PostStatus.FAILED,
          error: publishResult.error || 'Unknown error',
        });

        return {
          platform,
          success: false,
          error: publishResult.error || 'Unknown error',
          retryable: publishResult.retryable || false,
        };
      }
    } catch (error) {
      console.error(`Error executing platform post ${platformPostId} on ${platform}:`, error);
      
      // Update platform post with error
      await PlatformPostModel.update(platformPostId, {
        status: PostStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      };
    }
  }

  /**
   * Schedule retry if needed
   */
  private async scheduleRetryIfNeeded(
    jobData: PostExecutionJobData,
    platformResults: PlatformExecutionResult[]
  ): Promise<void> {
    const retryableFailures = platformResults.filter(r => !r.success && r.retryable);
    
    if (retryableFailures.length > 0) {
      const retryCount = (jobData.retryCount || 0) + 1;
      
      if (retryCount <= this.maxRetries) {
        const errorMessages = retryableFailures.map(r => `${r.platform}: ${r.error}`).join('; ');
        
        await queueService.scheduleRetry(
          jobData.postId,
          jobData.userId,
          errorMessages,
          retryCount,
          jobData.scheduledTime
        );
        
        console.log(`Scheduled retry ${retryCount}/${this.maxRetries} for post ${jobData.postId}`);
      } else {
        console.log(`Max retries exceeded for post ${jobData.postId}`);
      }
    }
  }

  /**
   * Retry a failed post
   */
  private async retryPost(jobData: RetryJobData): Promise<PostExecutionResult> {
    console.log(`Retrying post ${jobData.postId} (attempt ${jobData.retryCount}/${this.maxRetries})`);
    
    // Convert retry job data to execution job data
    const executionJobData: PostExecutionJobData = {
      postId: jobData.postId,
      userId: jobData.userId,
      scheduledTime: jobData.scheduledTime,
      retryCount: jobData.retryCount,
    };

    return await this.executePost(executionJobData);
  }

  /**
   * Process all scheduled posts that are ready for execution
   */
  public async processScheduledPosts(): Promise<void> {
    try {
      const scheduledPosts = await PostService.getScheduledPostsForExecution();
      
      console.log(`Found ${scheduledPosts.length} posts ready for execution`);
      
      for (const post of scheduledPosts) {
        try {
          await queueService.executePostNow(post.id, post.user_id);
        } catch (error) {
          console.error(`Error queuing post ${post.id} for execution:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  /**
   * Get scheduler statistics
   */
  public async getSchedulerStats(): Promise<{
    queueStats: any;
    scheduledPostsCount: number;
  }> {
    const [queueStats, scheduledPosts] = await Promise.all([
      queueService.getQueueStats(),
      PostService.getScheduledPostsForExecution(),
    ]);

    return {
      queueStats,
      scheduledPostsCount: scheduledPosts.length,
    };
  }

  /**
   * Start the scheduler (for background processing)
   */
  public async start(): Promise<void> {
    console.log('Starting scheduler service...');
    
    // Set up periodic processing of scheduled posts
    setInterval(async () => {
      await this.processScheduledPosts();
    }, 60000); // Check every minute

    // Set up periodic queue cleanup
    setInterval(async () => {
      await queueService.cleanupJobs();
    }, 60 * 60 * 1000); // Cleanup every hour

    console.log('Scheduler service started');
  }

  /**
   * Stop the scheduler
   */
  public async stop(): Promise<void> {
    console.log('Stopping scheduler service...');
    await queueService.close();
    console.log('Scheduler service stopped');
  }
}

// Export singleton instance
export const schedulerService = SchedulerService.getInstance();
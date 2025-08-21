import { BloggerService } from './BloggerService';
import { QueueService } from './QueueService';

export class BloggerMonitorService {
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static readonly MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Start the blogger monitoring service
   */
  static start(): void {
    if (this.monitoringInterval) {
      console.log('Blogger monitoring service is already running');
      return;
    }

    console.log('Starting blogger monitoring service...');
    
    // Run initial monitoring
    this.runMonitoring();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.runMonitoring();
    }, this.MONITOR_INTERVAL_MS);

    console.log(`Blogger monitoring service started with ${this.MONITOR_INTERVAL_MS / 1000}s interval`);
  }

  /**
   * Stop the blogger monitoring service
   */
  static stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Blogger monitoring service stopped');
    }
  }

  /**
   * Run monitoring for all active blogger integrations
   */
  private static async runMonitoring(): Promise<void> {
    try {
      console.log('Running blogger feed monitoring...');
      
      const results = await BloggerService.monitorAllBloggerFeeds();
      
      let totalNewPosts = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.error) {
          errorCount++;
          console.error('Blogger monitoring error:', result.error);
        } else {
          successCount++;
          totalNewPosts += result.newPosts.length;
          
          if (result.newPosts.length > 0) {
            console.log(`Found ${result.newPosts.length} new blog posts`);
          }
        }
      }

      console.log(`Blogger monitoring completed: ${successCount} successful, ${errorCount} errors, ${totalNewPosts} new posts processed`);
    } catch (error) {
      console.error('Error during blogger monitoring:', error);
    }
  }

  /**
   * Queue a manual monitoring job for a specific user
   */
  static async queueUserMonitoring(userId: string): Promise<void> {
    try {
      // TODO: Implement blogger monitoring queue
      console.log('Blogger monitoring queued for user:', userId);
      // await QueueService.addJob('blogger-monitor-user', {
      //   userId,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('Error queuing user blogger monitoring:', error);
      throw error;
    }
  }

  /**
   * Process a queued user monitoring job
   */
  static async processUserMonitoringJob(jobData: { userId: string; timestamp: string }): Promise<void> {
    try {
      const integration = await BloggerService.getBloggerIntegration(jobData.userId);
      
      if (!integration || !integration.enabled) {
        console.log(`Skipping blogger monitoring for user ${jobData.userId}: integration not found or disabled`);
        return;
      }

      const result = await BloggerService.monitorBloggerFeed(integration);
      
      if (result.error) {
        console.error(`Blogger monitoring error for user ${jobData.userId}:`, result.error);
      } else if (result.newPosts.length > 0) {
        console.log(`Found ${result.newPosts.length} new blog posts for user ${jobData.userId}`);
      }
    } catch (error) {
      console.error(`Error processing blogger monitoring job for user ${jobData.userId}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  static getStatus(): { running: boolean; intervalMs: number } {
    return {
      running: this.monitoringInterval !== null,
      intervalMs: this.MONITOR_INTERVAL_MS
    };
  }
}
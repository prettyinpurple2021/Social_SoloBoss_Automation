import { AppError, ErrorSeverity } from '../types/errors';
import { loggerService } from './LoggerService';

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'console';
  config: any;
  enabled: boolean;
}

export interface ErrorNotification {
  id: string;
  error: AppError;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface PostFailureNotification {
  id: string;
  postId: string;
  userId: string;
  platform: string;
  error: AppError;
  retryCount: number;
  nextRetryAt?: Date;
  timestamp: Date;
}

export class NotificationService {
  private static channels: NotificationChannel[] = [
    {
      type: 'console',
      config: {},
      enabled: true,
    },
    // Add more channels as needed (email, webhook, etc.)
  ];

  private static errorNotifications: Map<string, ErrorNotification> = new Map();
  private static postFailureNotifications: Map<string, PostFailureNotification> = new Map();

  /**
   * Send error notification for critical system errors
   */
  static async sendErrorNotification(error: AppError): Promise<void> {
    const notificationId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: ErrorNotification = {
      id: notificationId,
      error,
      timestamp: new Date(),
      acknowledged: false,
    };

    // Store notification
    this.errorNotifications.set(notificationId, notification);

    // Send through enabled channels
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendThroughChannel(channel, {
          type: 'error',
          title: `Critical Error: ${error.code}`,
          message: error.message,
          severity: error.severity,
          context: error.context,
          timestamp: notification.timestamp,
        });
      } catch (channelError) {
        loggerService.error(
          `Failed to send notification through ${channel.type}`,
          channelError as Error,
          { notificationId, errorCode: error.code }
        );
      }
    }

    loggerService.info(
      'Error notification sent',
      { notificationId, errorCode: error.code, severity: error.severity }
    );
  }

  /**
   * Send notification for failed post publishing
   */
  static async sendPostFailureNotification(
    postId: string,
    userId: string,
    platform: string,
    error: AppError,
    retryCount: number,
    nextRetryAt?: Date
  ): Promise<void> {
    const notificationId = `post_failure_${postId}_${platform}_${Date.now()}`;
    
    const notification: PostFailureNotification = {
      id: notificationId,
      postId,
      userId,
      platform,
      error,
      retryCount,
      nextRetryAt,
      timestamp: new Date(),
    };

    // Store notification
    this.postFailureNotifications.set(notificationId, notification);

    // Send through enabled channels
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendThroughChannel(channel, {
          type: 'post_failure',
          title: `Post Publishing Failed: ${platform}`,
          message: `Post ${postId} failed to publish to ${platform}: ${error.message}`,
          severity: error.severity,
          context: {
            postId,
            userId,
            platform,
            retryCount,
            nextRetryAt,
            errorCode: error.code,
          },
          timestamp: notification.timestamp,
        });
      } catch (channelError) {
        loggerService.error(
          `Failed to send post failure notification through ${channel.type}`,
          channelError as Error,
          { notificationId, postId, platform }
        );
      }
    }

    loggerService.info(
      'Post failure notification sent',
      { notificationId, postId, platform, retryCount }
    );
  }

  /**
   * Send notification for integration issues
   */
  static async sendIntegrationFailureNotification(
    userId: string,
    integration: string,
    error: AppError
  ): Promise<void> {
    const notificationId = `integration_failure_${integration}_${userId}_${Date.now()}`;
    
    // Send through enabled channels
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendThroughChannel(channel, {
          type: 'integration_failure',
          title: `Integration Failed: ${integration}`,
          message: `${integration} integration failed for user ${userId}: ${error.message}`,
          severity: error.severity,
          context: {
            userId,
            integration,
            errorCode: error.code,
          },
          timestamp: new Date(),
        });
      } catch (channelError) {
        loggerService.error(
          `Failed to send integration failure notification through ${channel.type}`,
          channelError as Error,
          { notificationId, userId, integration }
        );
      }
    }

    loggerService.info(
      'Integration failure notification sent',
      { notificationId, userId, integration }
    );
  }

  /**
   * Get error notifications
   */
  static getErrorNotifications(acknowledged?: boolean): ErrorNotification[] {
    const notifications = Array.from(this.errorNotifications.values());
    
    if (acknowledged !== undefined) {
      return notifications.filter(n => n.acknowledged === acknowledged);
    }
    
    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get post failure notifications for a user
   */
  static getPostFailureNotifications(userId?: string): PostFailureNotification[] {
    const notifications = Array.from(this.postFailureNotifications.values());
    
    const filtered = userId 
      ? notifications.filter(n => n.userId === userId)
      : notifications;
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge error notification
   */
  static acknowledgeErrorNotification(notificationId: string, acknowledgedBy: string): boolean {
    const notification = this.errorNotifications.get(notificationId);
    
    if (!notification) {
      return false;
    }

    notification.acknowledged = true;
    notification.acknowledgedBy = acknowledgedBy;
    notification.acknowledgedAt = new Date();

    loggerService.info(
      'Error notification acknowledged',
      { notificationId, acknowledgedBy }
    );

    return true;
  }

  /**
   * Clear old notifications (older than 30 days)
   */
  static clearOldNotifications(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Clear old error notifications
    for (const [id, notification] of this.errorNotifications.entries()) {
      if (notification.timestamp < thirtyDaysAgo) {
        this.errorNotifications.delete(id);
      }
    }

    // Clear old post failure notifications
    for (const [id, notification] of this.postFailureNotifications.entries()) {
      if (notification.timestamp < thirtyDaysAgo) {
        this.postFailureNotifications.delete(id);
      }
    }

    loggerService.info('Old notifications cleared');
  }

  /**
   * Send notification through specific channel
   */
  private static async sendThroughChannel(channel: NotificationChannel, notification: any): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.log(`[NOTIFICATION] ${notification.title}: ${notification.message}`);
        break;
        
      case 'email':
        // Implement email sending logic
        // await this.sendEmail(channel.config, notification);
        break;
        
      case 'webhook':
        // Implement webhook sending logic
        // await this.sendWebhook(channel.config, notification);
        break;
        
      default:
        throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * Add notification channel
   */
  static addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
    loggerService.info('Notification channel added', { type: channel.type });
  }

  /**
   * Remove notification channel
   */
  static removeChannel(type: string): boolean {
    const index = this.channels.findIndex(c => c.type === type);
    
    if (index === -1) {
      return false;
    }

    this.channels.splice(index, 1);
    loggerService.info('Notification channel removed', { type });
    return true;
  }

  /**
   * Enable/disable notification channel
   */
  static toggleChannel(type: string, enabled: boolean): boolean {
    const channel = this.channels.find(c => c.type === type);
    
    if (!channel) {
      return false;
    }

    channel.enabled = enabled;
    loggerService.info('Notification channel toggled', { type, enabled });
    return true;
  }
}
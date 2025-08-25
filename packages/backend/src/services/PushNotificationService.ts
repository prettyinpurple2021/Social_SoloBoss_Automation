import webpush from 'web-push';
import { db } from '../database/connection';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.initializeWebPush();
  }

  private initializeWebPush() {
    // Set VAPID keys (these should be environment variables)
    const vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LUhbKbVPLfzYKCrAh4u7WgPSi6YoMKGYLqjbOjBSRD8a9DtFHkI',
      privateKey: process.env.VAPID_PRIVATE_KEY || 'HyP1bSuGSByzYWa6yHdgfxmd2b-jhDwCqhTjfBZco9c'
    };

    webpush.setVapidDetails(
      'mailto:admin@sma-platform.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  }

  async subscribeUser(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, endpoint) 
        DO UPDATE SET 
          p256dh_key = EXCLUDED.p256dh_key,
          auth_key = EXCLUDED.auth_key,
          updated_at = NOW()
      `, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);

      console.log(`Push subscription saved for user ${userId}`);
    } catch (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }
  }

  async unsubscribeUser(userId: string, endpoint?: string): Promise<void> {
    try {
      if (endpoint) {
        await this.db.query(`
          DELETE FROM push_subscriptions 
          WHERE user_id = $1 AND endpoint = $2
        `, [userId, endpoint]);
      } else {
        await this.db.query(`
          DELETE FROM push_subscriptions 
          WHERE user_id = $1
        `, [userId]);
      }

      console.log(`Push subscription removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing push subscription:', error);
      throw error;
    }
  }

  async sendNotificationToUser(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const subscriptions = await this.getUserSubscriptions(userId);
      
      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user ${userId}`);
        return;
      }

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/pwa-192x192.png',
        badge: payload.badge || '/pwa-192x192.png',
        tag: payload.tag || 'default',
        data: payload.data || {},
        actions: payload.actions || [],
        timestamp: Date.now(),
        requireInteraction: false,
        silent: false
      });

      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key
              }
            },
            notificationPayload
          );
          console.log(`Notification sent successfully to ${subscription.endpoint}`);
        } catch (error: any) {
          console.error(`Failed to send notification to ${subscription.endpoint}:`, error);
          
          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.unsubscribeUser(userId, subscription.endpoint);
          }
        }
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  async sendBulkNotification(userIds: string[], payload: NotificationPayload): Promise<void> {
    const sendPromises = userIds.map(userId => 
      this.sendNotificationToUser(userId, payload)
    );

    await Promise.allSettled(sendPromises);
  }

  async notifyPostPublished(userId: string, postId: string, platforms: string[]): Promise<void> {
    await this.sendNotificationToUser(userId, {
      title: 'Post Published Successfully!',
      body: `Your post has been published to ${platforms.join(', ')}`,
      tag: 'post-published',
      data: { postId, type: 'post-published' },
      actions: [
        {
          action: 'view',
          title: 'View Post'
        },
        {
          action: 'analytics',
          title: 'View Analytics'
        }
      ]
    });
  }

  async notifyPostFailed(userId: string, postId: string, platform: string, error: string): Promise<void> {
    await this.sendNotificationToUser(userId, {
      title: 'Post Publishing Failed',
      body: `Failed to publish to ${platform}: ${error}`,
      tag: 'post-failed',
      data: { postId, platform, error, type: 'post-failed' },
      actions: [
        {
          action: 'retry',
          title: 'Retry'
        },
        {
          action: 'edit',
          title: 'Edit Post'
        }
      ]
    });
  }

  async notifyScheduledPostReady(userId: string, postId: string, scheduledTime: Date): Promise<void> {
    await this.sendNotificationToUser(userId, {
      title: 'Scheduled Post Ready',
      body: `Your post is scheduled to publish at ${scheduledTime.toLocaleString()}`,
      tag: 'post-scheduled',
      data: { postId, scheduledTime: scheduledTime.toISOString(), type: 'post-scheduled' },
      actions: [
        {
          action: 'view',
          title: 'View Post'
        },
        {
          action: 'edit',
          title: 'Edit Schedule'
        }
      ]
    });
  }

  async notifyPlatformConnectionExpired(userId: string, platform: string): Promise<void> {
    await this.sendNotificationToUser(userId, {
      title: 'Platform Connection Expired',
      body: `Your ${platform} connection needs to be renewed`,
      tag: 'connection-expired',
      data: { platform, type: 'connection-expired' },
      actions: [
        {
          action: 'reconnect',
          title: 'Reconnect'
        }
      ]
    });
  }

  async notifyWeeklyAnalytics(userId: string, stats: any): Promise<void> {
    await this.sendNotificationToUser(userId, {
      title: 'Weekly Analytics Report',
      body: `You published ${stats.postsCount} posts with ${stats.totalEngagement} total engagement`,
      tag: 'weekly-analytics',
      data: { stats, type: 'weekly-analytics' },
      actions: [
        {
          action: 'view',
          title: 'View Report'
        }
      ]
    });
  }

  private async getUserSubscriptions(userId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT endpoint, p256dh_key, auth_key
      FROM push_subscriptions
      WHERE user_id = $1 AND is_active = true
    `, [userId]);

    return result.rows;
  }

  async getVapidPublicKey(): Promise<string> {
    return process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LUhbKbVPLfzYKCrAh4u7WgPSi6YoMKGYLqjbOjBSRD8a9DtFHkI';
  }

  async cleanupExpiredSubscriptions(): Promise<void> {
    try {
      // Remove subscriptions older than 90 days that haven't been updated
      await this.db.query(`
        DELETE FROM push_subscriptions
        WHERE updated_at < NOW() - INTERVAL '90 days'
      `);

      console.log('Expired push subscriptions cleaned up');
    } catch (error) {
      console.error('Error cleaning up expired subscriptions:', error);
    }
  }
}
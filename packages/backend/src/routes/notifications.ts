import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { PushNotificationService } from '../services/PushNotificationService';
import { db } from '../database/connection';

const router = Router();

// Initialize push notification service
const db = new Database();
const pushNotificationService = new PushNotificationService(db);

// Get VAPID public key for client-side subscription
router.get('/vapid-public-key', authenticateToken, async (req, res) => {
  try {
    const publicKey = await pushNotificationService.getVapidPublicKey();
    res.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: 'Failed to get VAPID public key' });
  }
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    await pushNotificationService.subscribeUser(userId, subscription);
    
    res.json({ 
      success: true, 
      message: 'Successfully subscribed to push notifications' 
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await pushNotificationService.unsubscribeUser(userId, endpoint);
    
    res.json({ 
      success: true, 
      message: 'Successfully unsubscribed from push notifications' 
    });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
  }
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await pushNotificationService.sendNotificationToUser(userId, {
      title: 'Test Notification',
      body: 'This is a test notification from Social Media Automation Platform',
      tag: 'test',
      data: { type: 'test' }
    });
    
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await db.query(`
      SELECT notification_preferences
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      preferences: result.rows[0].notification_preferences || {
        post_published: true,
        post_failed: true,
        post_scheduled: true,
        connection_expired: true,
        weekly_analytics: true,
        marketing: false
      }
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences data' });
    }

    await db.query(`
      UPDATE users
      SET notification_preferences = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(preferences), userId]);
    
    res.json({ 
      success: true, 
      message: 'Notification preferences updated successfully',
      preferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Get notification history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await db.query(`
      SELECT 
        id,
        notification_type,
        title,
        body,
        data,
        sent_at,
        delivery_status
      FROM notification_logs
      WHERE user_id = $1
      ORDER BY sent_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM notification_logs
      WHERE user_id = $1
    `, [userId]);

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

// Mark notifications as read (for future use)
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'Invalid notification IDs' });
    }

    // For now, just return success - we can implement read status later
    res.json({ 
      success: true, 
      message: 'Notifications marked as read' 
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
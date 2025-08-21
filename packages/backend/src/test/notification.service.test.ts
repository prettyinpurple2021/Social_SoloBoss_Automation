import { NotificationService } from '../services/NotificationService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';
import { loggerService } from '../services/LoggerService';

// Mock dependencies
jest.mock('../services/LoggerService');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear notifications between tests
    (NotificationService as any).errorNotifications.clear();
    (NotificationService as any).postFailureNotifications.clear();
  });

  describe('Error Notifications', () => {
    it('should send error notification for critical errors', async () => {
      const error = new AppError(
        'Critical system error',
        ErrorCode.DATABASE_ERROR,
        500,
        ErrorSeverity.CRITICAL,
        true,
        { userId: 'user123' }
      );

      await NotificationService.sendErrorNotification(error);

      const notifications = NotificationService.getErrorNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].error).toBe(error);
      expect(notifications[0].acknowledged).toBe(false);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Error notification sent',
        expect.objectContaining({
          errorCode: ErrorCode.DATABASE_ERROR,
          severity: ErrorSeverity.CRITICAL,
        })
      );
    });

    it('should store error notifications with unique IDs', async () => {
      const error1 = new AppError('Error 1', ErrorCode.DATABASE_ERROR);
      const error2 = new AppError('Error 2', ErrorCode.NETWORK_ERROR);

      await NotificationService.sendErrorNotification(error1);
      await NotificationService.sendErrorNotification(error2);

      const notifications = NotificationService.getErrorNotifications();
      expect(notifications).toHaveLength(2);
      expect(notifications[0].id).not.toBe(notifications[1].id);
    });

    it('should filter error notifications by acknowledged status', async () => {
      const error = new AppError('Test error', ErrorCode.DATABASE_ERROR);
      await NotificationService.sendErrorNotification(error);

      const unacknowledged = NotificationService.getErrorNotifications(false);
      expect(unacknowledged).toHaveLength(1);

      const acknowledged = NotificationService.getErrorNotifications(true);
      expect(acknowledged).toHaveLength(0);
    });

    it('should acknowledge error notifications', async () => {
      const error = new AppError('Test error', ErrorCode.DATABASE_ERROR);
      await NotificationService.sendErrorNotification(error);

      const notifications = NotificationService.getErrorNotifications();
      const notificationId = notifications[0].id;

      const success = NotificationService.acknowledgeErrorNotification(notificationId, 'user123');
      expect(success).toBe(true);

      const updatedNotifications = NotificationService.getErrorNotifications();
      expect(updatedNotifications[0].acknowledged).toBe(true);
      expect(updatedNotifications[0].acknowledgedBy).toBe('user123');
      expect(updatedNotifications[0].acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should return false when acknowledging non-existent notification', () => {
      const success = NotificationService.acknowledgeErrorNotification('non-existent', 'user123');
      expect(success).toBe(false);
    });
  });

  describe('Post Failure Notifications', () => {
    it('should send post failure notification', async () => {
      const error = new AppError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);
      const nextRetryAt = new Date(Date.now() + 60000);

      await NotificationService.sendPostFailureNotification(
        'post123',
        'user123',
        'facebook',
        error,
        1,
        nextRetryAt
      );

      const notifications = NotificationService.getPostFailureNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].postId).toBe('post123');
      expect(notifications[0].userId).toBe('user123');
      expect(notifications[0].platform).toBe('facebook');
      expect(notifications[0].error).toBe(error);
      expect(notifications[0].retryCount).toBe(1);
      expect(notifications[0].nextRetryAt).toBe(nextRetryAt);
    });

    it('should filter post failure notifications by user', async () => {
      const error = new AppError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);

      await NotificationService.sendPostFailureNotification('post1', 'user1', 'facebook', error, 1);
      await NotificationService.sendPostFailureNotification('post2', 'user2', 'instagram', error, 1);

      const user1Notifications = NotificationService.getPostFailureNotifications('user1');
      expect(user1Notifications).toHaveLength(1);
      expect(user1Notifications[0].userId).toBe('user1');

      const allNotifications = NotificationService.getPostFailureNotifications();
      expect(allNotifications).toHaveLength(2);
    });

    it('should sort notifications by timestamp descending', async () => {
      const error = new AppError('Post failed', ErrorCode.POST_PUBLISHING_FAILED);

      // Add notifications with slight delay to ensure different timestamps
      await NotificationService.sendPostFailureNotification('post1', 'user1', 'facebook', error, 1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await NotificationService.sendPostFailureNotification('post2', 'user1', 'instagram', error, 1);

      const notifications = NotificationService.getPostFailureNotifications('user1');
      expect(notifications).toHaveLength(2);
      expect(notifications[0].timestamp.getTime()).toBeGreaterThan(notifications[1].timestamp.getTime());
    });
  });

  describe('Integration Failure Notifications', () => {
    it('should send integration failure notification', async () => {
      const error = new AppError('Integration failed', ErrorCode.BLOGGER_CONNECTION_FAILED);

      await NotificationService.sendIntegrationFailureNotification('user123', 'blogger', error);

      expect(loggerService.info).toHaveBeenCalledWith(
        'Integration failure notification sent',
        expect.objectContaining({
          userId: 'user123',
          integration: 'blogger',
        })
      );
    });
  });

  describe('Notification Channels', () => {
    it('should add notification channel', () => {
      const channel = {
        type: 'email' as const,
        config: { smtp: 'test' },
        enabled: true,
      };

      NotificationService.addChannel(channel);

      expect(loggerService.info).toHaveBeenCalledWith(
        'Notification channel added',
        { type: 'email' }
      );
    });

    it('should remove notification channel', () => {
      const channel = {
        type: 'webhook' as const,
        config: { url: 'test' },
        enabled: true,
      };

      NotificationService.addChannel(channel);
      const success = NotificationService.removeChannel('webhook');

      expect(success).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Notification channel removed',
        { type: 'webhook' }
      );
    });

    it('should return false when removing non-existent channel', () => {
      const success = NotificationService.removeChannel('non-existent');
      expect(success).toBe(false);
    });

    it('should toggle notification channel', () => {
      const channel = {
        type: 'email' as const,
        config: {},
        enabled: true,
      };

      NotificationService.addChannel(channel);
      const success = NotificationService.toggleChannel('email', false);

      expect(success).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Notification channel toggled',
        { type: 'email', enabled: false }
      );
    });

    it('should return false when toggling non-existent channel', () => {
      const success = NotificationService.toggleChannel('non-existent', false);
      expect(success).toBe(false);
    });
  });

  describe('Notification Cleanup', () => {
    it('should clear old notifications', async () => {
      const error = new AppError('Old error', ErrorCode.DATABASE_ERROR);
      
      // Mock old timestamp (31 days ago)
      const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      
      await NotificationService.sendErrorNotification(error);
      
      // Manually set old timestamp for testing
      const notifications = NotificationService.getErrorNotifications();
      (notifications[0] as any).timestamp = oldTimestamp;

      NotificationService.clearOldNotifications();

      const remainingNotifications = NotificationService.getErrorNotifications();
      expect(remainingNotifications).toHaveLength(0);
      expect(loggerService.info).toHaveBeenCalledWith('Old notifications cleared');
    });

    it('should keep recent notifications during cleanup', async () => {
      const error = new AppError('Recent error', ErrorCode.DATABASE_ERROR);
      await NotificationService.sendErrorNotification(error);

      NotificationService.clearOldNotifications();

      const notifications = NotificationService.getErrorNotifications();
      expect(notifications).toHaveLength(1);
    });
  });

  describe('Error Handling in Notifications', () => {
    it('should handle notification channel errors gracefully', async () => {
      // Mock console.log to throw an error
      const originalConsoleLog = console.log;
      console.log = jest.fn().mockImplementation(() => {
        throw new Error('Console error');
      });

      const error = new AppError('Test error', ErrorCode.DATABASE_ERROR, 500, ErrorSeverity.CRITICAL);

      // Should not throw despite console error
      await expect(NotificationService.sendErrorNotification(error)).resolves.not.toThrow();

      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to send notification through console',
        expect.any(Error),
        expect.objectContaining({
          errorCode: ErrorCode.DATABASE_ERROR,
        })
      );

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });
});
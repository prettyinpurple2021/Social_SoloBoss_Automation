import { test, expect, devices } from '@playwright/test';

test.describe('Mobile and PWA Features', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should display mobile-optimized interface', async ({ page }) => {
    await page.goto('/login');
    
    // Verify mobile layout
    await expect(page.locator('[data-testid=mobile-layout]')).toBeVisible();
    await expect(page.locator('[data-testid=desktop-sidebar]')).not.toBeVisible();
    
    // Login
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    // Verify mobile dashboard
    await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible();
    await expect(page.locator('[data-testid=mobile-navigation]')).toBeVisible();
  });

  test('should support touch interactions', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test swipe navigation
    const dashboard = page.locator('[data-testid=mobile-dashboard]');
    await dashboard.swipe({ direction: 'left' });
    
    // Verify navigation occurred
    await expect(page.locator('[data-testid=analytics-view]')).toBeVisible();
  });

  test('should handle image capture on mobile', async ({ page }) => {
    await page.goto('/posts/create');
    
    // Mock camera access
    await page.route('**/api/upload/image', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.com/test-image.jpg',
          id: 'test-image-id'
        })
      });
    });
    
    // Test image capture
    await page.click('[data-testid=capture-image]');
    
    // Verify image was added
    await expect(page.locator('[data-testid=uploaded-image]')).toBeVisible();
  });

  test('should work offline with service worker', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Verify offline functionality
    await page.reload();
    await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible();
    await expect(page.locator('[data-testid=cached-content]')).toBeVisible();
    
    // Test offline post creation
    await page.click('[data-testid=create-post-offline]');
    await page.fill('[data-testid=post-content]', 'Offline post content');
    await page.click('[data-testid=save-draft]');
    
    // Verify draft saved locally
    await expect(page.locator('[data-testid=draft-saved]')).toBeVisible();
  });

  test('should display PWA install prompt', async ({ page }) => {
    await page.goto('/');
    
    // Mock PWA install prompt
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    
    // Verify install prompt appears
    await expect(page.locator('[data-testid=pwa-install-prompt]')).toBeVisible();
    
    // Test install action
    await page.click('[data-testid=install-app]');
    await expect(page.locator('[data-testid=install-success]')).toBeVisible();
  });

  test('should handle push notifications', async ({ page }) => {
    await page.goto('/settings/notifications');
    
    // Mock notification permission
    await page.evaluate(() => {
      Object.defineProperty(Notification, 'permission', {
        value: 'granted',
        writable: false
      });
    });
    
    // Enable push notifications
    await page.click('[data-testid=enable-push-notifications]');
    
    // Verify notifications enabled
    await expect(page.locator('[data-testid=notifications-enabled]')).toBeVisible();
    
    // Test notification display
    await page.evaluate(() => {
      new Notification('Test notification', {
        body: 'This is a test notification',
        icon: '/icon-192x192.png'
      });
    });
  });
});
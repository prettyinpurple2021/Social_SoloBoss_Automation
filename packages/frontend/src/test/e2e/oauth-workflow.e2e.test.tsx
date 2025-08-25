import { test, expect } from '@playwright/test';

test.describe('OAuth Integration Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'testpassword');
    await page.click('[data-testid=login-button]');
    await expect(page.locator('[data-testid=dashboard]')).toBeVisible();
  });

  test('should complete Facebook OAuth flow', async ({ page }) => {
    // Navigate to platform connections
    await page.click('[data-testid=platform-connections]');
    await expect(page.locator('[data-testid=connections-page]')).toBeVisible();

    // Start Facebook OAuth
    await page.click('[data-testid=connect-facebook]');
    
    // Mock OAuth popup (in real test, this would handle actual OAuth)
    await page.route('**/oauth/facebook/callback*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          platform: 'facebook',
          accountName: 'Test Facebook Page'
        })
      });
    });

    // Verify connection success
    await expect(page.locator('[data-testid=facebook-connected]')).toBeVisible();
    await expect(page.locator('[data-testid=facebook-account-name]')).toContainText('Test Facebook Page');
  });

  test('should handle OAuth errors gracefully', async ({ page }) => {
    await page.click('[data-testid=platform-connections]');
    
    // Mock OAuth error
    await page.route('**/oauth/instagram/callback*', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'access_denied',
          error_description: 'User denied access'
        })
      });
    });

    await page.click('[data-testid=connect-instagram]');
    
    // Verify error handling
    await expect(page.locator('[data-testid=oauth-error]')).toBeVisible();
    await expect(page.locator('[data-testid=oauth-error]')).toContainText('User denied access');
  });

  test('should allow disconnecting platforms', async ({ page }) => {
    // Assume Facebook is already connected
    await page.click('[data-testid=platform-connections]');
    
    // Disconnect Facebook
    await page.click('[data-testid=disconnect-facebook]');
    await page.click('[data-testid=confirm-disconnect]');
    
    // Verify disconnection
    await expect(page.locator('[data-testid=facebook-connected]')).not.toBeVisible();
    await expect(page.locator('[data-testid=connect-facebook]')).toBeVisible();
  });
});
import { OAuthService } from './OAuthService';

export class TokenRefreshService {
  private static refreshInterval: NodeJS.Timeout | null = null;
  private static readonly REFRESH_INTERVAL_MINUTES = 60; // Check every hour

  /**
   * Starts the automatic token refresh service
   */
  static start(): void {
    if (this.refreshInterval) {
      console.log('Token refresh service is already running');
      return;
    }

    console.log('Starting token refresh service...');
    
    // Run immediately on start
    this.refreshTokens();

    // Set up recurring refresh
    this.refreshInterval = setInterval(() => {
      this.refreshTokens();
    }, this.REFRESH_INTERVAL_MINUTES * 60 * 1000);

    console.log(`Token refresh service started (checking every ${this.REFRESH_INTERVAL_MINUTES} minutes)`);
  }

  /**
   * Stops the automatic token refresh service
   */
  static stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('Token refresh service stopped');
    }
  }

  /**
   * Manually trigger token refresh
   */
  static async refreshTokens(): Promise<void> {
    try {
      console.log('Checking for expiring tokens...');
      await OAuthService.refreshExpiringTokens();
      console.log('Token refresh check completed');
    } catch (error) {
      console.error('Token refresh service error:', error);
    }
  }

  /**
   * Check if the service is running
   */
  static isRunning(): boolean {
    return this.refreshInterval !== null;
  }
}
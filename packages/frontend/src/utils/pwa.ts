import { Workbox } from 'workbox-window';

export interface PWAUpdateInfo {
  isUpdateAvailable: boolean;
  updateServiceWorker: () => Promise<void>;
}

export class PWAManager {
  private wb: Workbox | null = null;
  private updateCallback: ((info: PWAUpdateInfo) => void) | null = null;

  constructor() {
    if ('serviceWorker' in navigator) {
      this.wb = new Workbox('/sw.js');
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (!this.wb) return;

    // Service worker is waiting to activate
    this.wb.addEventListener('waiting', () => {
      if (this.updateCallback) {
        this.updateCallback({
          isUpdateAvailable: true,
          updateServiceWorker: () => this.updateServiceWorker()
        });
      }
    });

    // Service worker has been updated and is controlling the page
    this.wb.addEventListener('controlling', () => {
      window.location.reload();
    });
  }

  async register(): Promise<void> {
    if (!this.wb) return;

    try {
      await this.wb.register();
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  private async updateServiceWorker(): Promise<void> {
    if (!this.wb) return;

    // Send a message to the waiting service worker to skip waiting
    this.wb.messageSkipWaiting();
  }

  onUpdateAvailable(callback: (info: PWAUpdateInfo) => void) {
    this.updateCallback = callback;
  }

  // Check if app is running as PWA
  static isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }

  // Check if device supports PWA installation
  static canInstall(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window &&
           'Notification' in window;
  }
}

// Push notification utilities
export class NotificationManager {
  static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    return await Notification.requestPermission();
  }

  static async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission === 'granted') {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          ...options
        });
      } else {
        new Notification(title, {
          icon: '/pwa-192x192.png',
          ...options
        });
      }
    }
  }

  static async subscribeToPush(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          // This should be replaced with your actual VAPID public key
          'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LUhbKbVPLfzYKCrAh4u7WgPSi6YoMKGYLqjbOjBSRD8a9DtFHkI'
        )
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Offline detection utilities
export class OfflineManager {
  private static callbacks: Array<(isOnline: boolean) => void> = [];

  static init() {
    window.addEventListener('online', () => this.notifyCallbacks(true));
    window.addEventListener('offline', () => this.notifyCallbacks(false));
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static onStatusChange(callback: (isOnline: boolean) => void) {
    this.callbacks.push(callback);
  }

  private static notifyCallbacks(isOnline: boolean) {
    this.callbacks.forEach(callback => callback(isOnline));
  }
}
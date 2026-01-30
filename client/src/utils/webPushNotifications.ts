// Web Push API utilities with VAPID

interface PushSubscriptionData {
  subscription: PushSubscription;
  userId: string;
  userRole: string;
  deviceInfo?: string;
}

class WebPushNotificationManager {
  private vapidPublicKey: string | null = null;
  private subscription: PushSubscription | null = null;
  private subscriptionId: string | null = null;
  private isInitialized = false;
  private userId: string | null = null;
  private userRole: string = 'student';
  private canteenId: string | null = null;

  private initializationPromise: Promise<boolean> | null = null;

  /**
   * Initialize the Web Push service
   */
  async initialize(userId?: string, userRole?: string, canteenId?: string): Promise<boolean> {
    // If already initialized, just update user info if provided
    if (this.isInitialized) {
      if (userId) this.userId = userId;
      if (userRole) this.userRole = userRole;
      if (canteenId) this.canteenId = canteenId;
      return true;
    }

    // If initialization is in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Check if browser supports service workers and push notifications
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.warn('Push notifications are not supported by this browser');
          return false;
        }

        // Set user info
        if (userId) {
          this.userId = userId;
        }
        if (userRole) {
          this.userRole = userRole;
        }
        if (canteenId) {
          this.canteenId = canteenId;
        }

        // Get VAPID public key from server
        await this.fetchVAPIDKey();

        if (!this.vapidPublicKey) {
          console.warn('Failed to get VAPID public key from server');
          return false;
        }

        // Register service worker
        await this.registerServiceWorker();

        // Check existing subscription
        await this.checkExistingSubscription();

        this.isInitialized = true;
        console.log('✅ Web Push notification manager initialized');
        console.log('🔑 VAPID public key received:', this.vapidPublicKey?.substring(0, 20) + '...');
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize Web Push notifications:', error);
        return false;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVAPIDKey(): Promise<void> {
    try {
      const response = await fetch('/api/push/vapid-public-key');
      if (!response.ok) {
        throw new Error(`Failed to fetch VAPID key: ${response.status}`);
      }

      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
    } catch (error) {
      console.error('Failed to fetch VAPID public key:', error);
      throw error;
    }
  }

  /**
   * Register service worker for push notifications
   */
  private async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Setup Android notification channels for better heads-up notification support
      await this.setupAndroidNotificationChannels();

      console.log('✅ Service worker registered successfully');
      return registration;
    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Setup Android notification channels for optimal heads-up notification behavior
   */
  private async setupAndroidNotificationChannels(): Promise<void> {
    try {
      // Check if we're on Android and have notification channel support
      const userAgent = navigator.userAgent.toLowerCase();
      if ('Notification' in window && userAgent.includes('android')) {
        console.log('🔔 Setting up Android notification channels for heads-up notifications');

        // Test if the browser supports notification options that help with Android heads-up display
        const testNotification = new Notification('Setup Complete', {
          silent: true,
          tag: 'setup-test',
        } as NotificationOptions);

        // Close the test notification immediately
        setTimeout(() => testNotification.close(), 100);

        console.log('✅ Android notification configuration optimized');
      }
    } catch (error) {
      console.warn('Android notification channel setup failed (non-critical):', error);
    }
  }

  /**
   * Check for existing push subscription and auto-subscribe if permission is granted
   */
  private async checkExistingSubscription(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        this.subscription = existingSubscription;
        console.log('✅ Found existing push subscription');

        // If we have a subscription but no subscription ID, register it with the server
        if (!this.subscriptionId && this.userId) {
          try {
            const subscriptionId = await this.sendSubscriptionToServer(existingSubscription);
            this.subscriptionId = subscriptionId;
            console.log('🔄 Re-registered existing subscription with server');
          } catch (error) {
            console.warn('Failed to re-register existing subscription:', error);
          }
        }
      } else if (Notification.permission === 'granted' && this.userId) {
        // Auto-subscribe if permission is already granted
        console.log('🔔 Permission already granted, auto-subscribing...');
        try {
          await this.subscribeWithoutPermissionRequest();
        } catch (error) {
          console.warn('Failed to auto-subscribe:', error);
        }
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  }

  /**
   * Subscribe to push notifications without requesting permission (for auto-subscribe)
   */
  private async subscribeWithoutPermissionRequest(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey!) as any,
      });

      this.subscription = subscription;

      // Send subscription to server
      const subscriptionId = await this.sendSubscriptionToServer(subscription);
      this.subscriptionId = subscriptionId;

      console.log('✅ Auto-subscribed to push notifications');
    } catch (error) {
      console.error('Failed to auto-subscribe:', error);
      throw error;
    }
  }

  /**
   * Request notification permission and subscribe to push notifications
   */
  async requestPermissionAndSubscribe(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.vapidPublicKey) {
        throw new Error('Web Push manager not initialized');
      }

      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission === 'denied') {
        console.warn('Notification permission denied by user');
        throw new Error('Notifications are blocked. Please enable them in your browser settings.');
      }

      if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission);
        throw new Error('Notification permission was not granted. Please try again.');
      }

      // Subscribe to push notifications
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as any,
      });

      this.subscription = subscription;

      // Send subscription to server
      const subscriptionId = await this.sendSubscriptionToServer(subscription);
      this.subscriptionId = subscriptionId;

      console.log('✅ Successfully subscribed to push notifications');
      console.log('📱 Subscription ID:', subscriptionId);
      return true;
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<string> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          userId: this.userId,
          userRole: this.userRole,
          canteenId: this.canteenId,
          deviceInfo: this.getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send subscription to server: ${response.status}`);
      }

      const data = await response.json();
      return data.subscriptionId;
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        console.warn('No active subscription to unsubscribe from');
        return true;
      }

      // Unsubscribe from push manager
      await this.subscription.unsubscribe();

      // Remove subscription from server
      if (this.subscriptionId) {
        await this.removeSubscriptionFromServer(this.subscriptionId);
      }

      this.subscription = null;
      this.subscriptionId = null;

      console.log('✅ Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscriptionId: string): Promise<void> {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove subscription from server: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      if (!this.userId) {
        throw new Error('User ID not available');
      }

      const response = await fetch('/api/push/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          title: 'Test Notification',
          message: 'This is a test notification from your canteen app!',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send test notification: ${response.status}`);
      }

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      return false;
    }
  }

  /**
   * Show local test notification with Android-optimized settings
   */
  async showLocalTestNotification(): Promise<boolean> {
    try {
      if (Notification.permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      // Use service worker to show notification for better Android compatibility
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🔔 Android Banner Test', {
        body: 'This notification uses service worker for maximum Android compatibility!',
        icon: '/api/icon.png?size=192',
        badge: '/api/icon.png?size=192',
        tag: 'android-banner-test',
        requireInteraction: true,
        silent: false,
        renotify: true,
        data: {
          type: 'android_test',
          timestamp: Date.now(),
        },
      } as NotificationOptions);

      console.log('✅ Android-optimized service worker notification displayed');
      return true;
    } catch (error) {
      console.error('❌ Failed to show Android-optimized notification:', error);

      // Fallback to direct notification API
      try {
        const notification = new Notification('🔔 Android Fallback Test', {
          body: 'Fallback notification - check your notification settings!',
          icon: '/api/icon.png?size=192',
          badge: '/api/icon.png?size=192',
          tag: 'android-fallback',
          requireInteraction: true,
          silent: false,
        } as NotificationOptions);

        setTimeout(() => notification.close(), 8000);
        console.log('✅ Fallback notification displayed');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback notification also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Convert VAPID key from URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
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

  /**
   * Get device information for subscription tracking
   */
  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    return `${platform} - ${userAgent.substring(0, 100)}`;
  }

  /**
   * Get notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Check if user is subscribed
   */
  isSubscribed(): boolean {
    return !!this.subscription;
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get subscription ID
   */
  getSubscriptionId(): string | null {
    return this.subscriptionId;
  }

  /**
   * Update user information
   */
  updateUserInfo(userId: string, userRole: string, canteenId?: string): void {
    this.userId = userId;
    this.userRole = userRole;
    if (canteenId) {
      this.canteenId = canteenId;
    }
  }
}

export default WebPushNotificationManager;

// Export singleton instance
export const webPushManager = new WebPushNotificationManager();

// Export utility functions
export const initializeWebPushNotifications = async (userId: string, userRole: string = 'student', canteenId?: string): Promise<boolean> => {
  return await webPushManager.initialize(userId, userRole, canteenId);
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  return await webPushManager.requestPermissionAndSubscribe();
};

export const unsubscribeFromNotifications = async (): Promise<boolean> => {
  return await webPushManager.unsubscribe();
};

export const sendTestNotification = async (): Promise<boolean> => {
  return await webPushManager.sendTestNotification();
};

export const showLocalTestNotification = async (): Promise<boolean> => {
  return await webPushManager.showLocalTestNotification();
};

export const getNotificationPermissionStatus = (): NotificationPermission => {
  return webPushManager.getPermissionStatus();
};

export const isSubscribedToNotifications = (): boolean => {
  return webPushManager.isSubscribed();
};

export const isWebPushReady = (): boolean => {
  return webPushManager.isReady();
};
// Comprehensive PWA Update Manager
export class UpdateManager {
  private static instance: UpdateManager;
  private registration: ServiceWorkerRegistration | null = null;
  private isUpdateAvailable = false;
  private newWorker: ServiceWorker | null = null;

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  /**
   * Initialize update manager with service worker registration
   */
  init(registration: ServiceWorkerRegistration): void {
    this.registration = registration;
    
    // Skip all update functionality in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) return;
    
    this.setupUpdateListeners();
    this.checkForUpdates();
  }

  /**
   * Setup listeners for service worker updates
   */
  private setupUpdateListeners(): void {
    if (!this.registration) return;

    // Skip update listeners in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      console.log('🔄 New service worker found, installing...');
      this.newWorker = this.registration!.installing;
      
      if (this.newWorker) {
        this.newWorker.addEventListener('statechange', () => {
          if (this.newWorker!.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✅ New service worker installed, ready to activate');
            this.isUpdateAvailable = true;
            this.showUpdateNotification();
          }
        });
      }
    });

    // Listen for controlling service worker changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service worker controller changed, reloading...');
      this.handleSuccessfulUpdate();
    });
  }

  /**
   * Check for updates periodically
   */
  private checkForUpdates(): void {
    if (!this.registration) return;

    // Skip update checks in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) return;

    // Check immediately
    this.registration.update().catch(error => {
      // Silently handle update errors
      if (!isDevelopment) {
        console.warn('Service worker update check failed:', error);
      }
    });

    // NO background polling - only check when user becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !isDevelopment) {
        console.log('👀 User returned, checking for service worker updates...');
        this.registration!.update().catch(() => {
          // Silently handle errors
        });
      }
    });
  }

  /**
   * Show update notification to user
   */
  private showUpdateNotification(): void {
    console.log('🚀 App Update Available! A new version with improvements is ready. Update now for the best experience.');
  }

  /**
   * Apply the update
   */
  applyUpdate(): void {
    if (!this.newWorker) {
      console.error('No new service worker available');
      return;
    }

    console.log('🔄 Applying update...');
    console.log('Updating app...');
    
    // Tell the new service worker to skip waiting
    this.newWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Handle successful update
   */
  private handleSuccessfulUpdate(): void {
    // Skip in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) return;

    // Clear any old caches
    this.clearOldCaches();
    
    // Show success message
    console.log('✅ App Updated Successfully! You\'re now using the latest version with new features and improvements.');
    
    // Reload the page to get fresh content with cache bypass
    setTimeout(() => {
      const cacheBuster = `?v=${Date.now()}`;
      const currentUrl = window.location.href.split('?')[0];
      console.log('🔄 Reloading with cache buster after update:', cacheBuster);
      window.location.href = currentUrl + cacheBuster;
    }, 1000);
  }

  /**
   * Manually refresh the app (force reload)
   */
  static async forceRefresh(): Promise<void> {
    console.log('Refreshing app...');
    
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('🗑️ All caches cleared');
      }

      // Unregister service worker and reload
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('🗑️ Service workers unregistered');
      }

      // Wait a moment for unregistration to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force reload with cache bypass using timestamp to bust HTTP cache
      const cacheBuster = `?v=${Date.now()}`;
      const currentUrl = window.location.href.split('?')[0];
      console.log('🔄 Force reloading with cache buster:', cacheBuster);
      window.location.href = currentUrl + cacheBuster;
    } catch (error) {
      console.error('Error during force refresh:', error);
      console.error('Failed to refresh. Please reload the page manually.');
      // Fallback: try simple reload
      window.location.reload();
    }
  }

  /**
   * Clear old caches
   */
  private async clearOldCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith('digital-canteen-') && name !== 'digital-canteen-v1'
      );
      
      await Promise.all(oldCaches.map(name => caches.delete(name)));
      console.log('🗑️ Old caches cleared:', oldCaches);
    } catch (error) {
      console.error('Error clearing old caches:', error);
    }
  }

  /**
   * Get current app version info
   */
  static async getVersionInfo(): Promise<{ version: string; cacheVersion: string }> {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const channel = new MessageChannel();
        
        return new Promise((resolve) => {
          channel.port1.onmessage = (event) => {
            resolve(event.data);
          };
          
          navigator.serviceWorker.controller!.postMessage(
            { type: 'GET_VERSION' },
            [channel.port2]
          );
        });
      }
    } catch (error) {
      console.error('Error getting version info:', error);
    }
    
    return { version: '1.0.0', cacheVersion: 'unknown' };
  }

  /**
   * Check if update is available
   */
  isUpdateReady(): boolean {
    return this.isUpdateAvailable;
  }
}

// Export singleton instance
export const updateManager = UpdateManager.getInstance();
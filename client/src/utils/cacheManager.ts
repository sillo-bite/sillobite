// Cache management utilities for PWA deployment invalidation
export class CacheManager {
  private static readonly APP_VERSION_KEY = 'app_version';
  private static readonly BUILD_TIMESTAMP_KEY = 'build_timestamp';
  
  // This will be replaced during build with actual version
  private static readonly CURRENT_VERSION = 'v1755077641093-6090eab8f6f0e7de';
  private static readonly BUILD_TIME = '1755077641093';

  /**
   * Check if app cache should be invalidated due to new deployment
   */
  static async checkForUpdate(): Promise<boolean> {
    try {
      const storedVersion = localStorage.getItem(this.APP_VERSION_KEY);
      const storedBuildTime = localStorage.getItem(this.BUILD_TIMESTAMP_KEY);
      
      // If no stored version, this is first load - store current version
      if (!storedVersion || !storedBuildTime) {
        this.updateStoredVersion();
        return false;
      }

      // Check if version or build time has changed (new deployment)
      const versionChanged = storedVersion !== this.CURRENT_VERSION;
      const buildTimeChanged = storedBuildTime !== this.BUILD_TIME;
      
      if (versionChanged || buildTimeChanged) {
        console.log('🔄 New deployment detected, clearing cache...');
        await this.clearAllCaches();
        this.updateStoredVersion();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for updates:', error);
      return false;
    }
  }

  /**
   * Clear all application caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('✅ Service worker caches cleared');
      }

      // Clear React Query cache
      if (window.queryClient) {
        window.queryClient.clear();
        console.log('✅ React Query cache cleared');
      }

      // Clear localStorage except user session data
      const preserveKeys = ['user', 'session_timestamp'];
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('✅ localStorage cache cleared (session preserved)');

      // Clear sessionStorage
      sessionStorage.clear();
      console.log('✅ sessionStorage cleared');

    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Complete logout cache clearing - clears EVERYTHING including user session
   */
  static async clearLogoutCaches(): Promise<void> {
    try {
      console.log('🔥 Starting complete logout cache clearing...');
      
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('✅ Service worker caches cleared');
      }

      // Clear React Query cache
      if (window.queryClient) {
        window.queryClient.clear();
        console.log('✅ React Query cache cleared');
      }

      // Clear ALL localStorage (including user session)
      localStorage.clear();
      console.log('✅ ALL localStorage cleared');

      // Clear ALL sessionStorage
      sessionStorage.clear();
      console.log('✅ ALL sessionStorage cleared');

      // Clear IndexedDB if present
      if ('indexedDB' in window) {
        try {
          // Clear common IndexedDB stores
          const databases = ['firebaseLocalStorageDb', 'firebase-installations-store'];
          for (const dbName of databases) {
            try {
              indexedDB.deleteDatabase(dbName);
              console.log(`✅ IndexedDB ${dbName} cleared`);
            } catch (error) {
              console.warn(`⚠️ Could not clear IndexedDB ${dbName}:`, error);
            }
          }
        } catch (error) {
          console.warn('⚠️ IndexedDB clearing failed:', error);
        }
      }

      // Force service worker to skip waiting and activate
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            if (registration.active) {
              registration.active.postMessage({ type: 'CLEAR_CACHE' });
            }
          }
        } catch (error) {
          console.warn('⚠️ Service worker messaging failed:', error);
        }
      }

      console.log('✅ Complete logout cache clearing finished');
    } catch (error) {
      console.error('❌ Error during logout cache clearing:', error);
    }
  }

  /**
   * Update stored version info
   */
  private static updateStoredVersion(): void {
    localStorage.setItem(this.APP_VERSION_KEY, this.CURRENT_VERSION);
    localStorage.setItem(this.BUILD_TIMESTAMP_KEY, this.BUILD_TIME);
  }

  /**
   * Force cache refresh (manual trigger)
   */
  static async forceRefresh(): Promise<void> {
    await this.clearAllCaches();
    window.location.reload();
  }

  /**
   * Check if service worker update is available
   */
  static async checkServiceWorkerUpdate(): Promise<boolean> {
    if ('serviceWorker' in navigator) {
      try {
        // Skip in development mode to avoid errors
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return false;
        }
        
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          return !!registration.waiting;
        }
      } catch (error) {
        // Silently handle errors in development, only log in production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          console.error('Error checking service worker update:', error);
        }
      }
    }
    return false;
  }

  /**
   * Activate waiting service worker
   */
  static async activateWaitingServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }
}

// Make queryClient available globally for cache clearing
declare global {
  interface Window {
    queryClient: any;
  }
}
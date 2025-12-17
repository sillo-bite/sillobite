// App update notification system
export class AppUpdater {
  private static hasShownUpdateNotification = false;

  /**
   * Show update notification to user
   */
  static showUpdateNotification(): void {
    if (this.hasShownUpdateNotification) return;
    
    this.hasShownUpdateNotification = true;
    
    console.log('App Updated! New features are now available. The app has been refreshed automatically.');
  }

  /**
   * Show cache clearing notification
   */
  static showCacheClearNotification(): void {
    console.log('Cache Cleared - App data has been refreshed for the latest features.');
  }

  /**
   * Show service worker update notification
   */
  static showServiceWorkerUpdateNotification(): void {
    console.log('Updating... Installing the latest version of the app.');
  }

  /**
   * Show icon update notification to user
   * @deprecated - Disabled per user request to remove icon change prompts
   */
  static showIconUpdateNotification(): void {
    // Method disabled - no longer shows icon update notifications
    return;
  }
}

// Make global notification available for cache manager
if (typeof window !== 'undefined') {
  window.showToast = (message: string, type: 'success' | 'error' | 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };
}
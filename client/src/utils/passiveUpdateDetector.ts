// 100% Passive Update Detector - ZERO automatic calls
class PassiveUpdateDetector {
  private static instance: PassiveUpdateDetector;

  static getInstance(): PassiveUpdateDetector {
    if (!PassiveUpdateDetector.instance) {
      PassiveUpdateDetector.instance = new PassiveUpdateDetector();
    }
    return PassiveUpdateDetector.instance;
  }

  /**
   * Initialize - does NOTHING automatically
   */
  init(): void {
    console.log('🛑 Passive update detector initialized - ZERO automatic calls');
    // Absolutely NO automatic checking
    // NO event listeners
    // NO polling
    // NO timers
    // NOTHING automatic
  }

  /**
   * Manual check only - called by user action (coordinated with DevUpdateDetector)
   */
  async manualCheck(): Promise<void> {
    console.log('🔍 Manual update check triggered by user');
    
    try {
      const response = await fetch('/api/server-info');
      if (!response.ok) return;

      const { startTime } = await response.json();
      // Use same localStorage key as DevUpdateDetector for coordination
      const storedStartTime = localStorage.getItem('last_server_start_time');
      
      if (storedStartTime && parseInt(storedStartTime) < startTime) {
        console.log('🔄 Server restart detected during manual check!');
        this.showUpdateNotification();
        // Update the stored time
        localStorage.setItem('last_server_start_time', startTime.toString());
      } else {
        // Check if user just updated very recently (within last 30 seconds)
        const timeDiff = Date.now() - parseInt(storedStartTime || '0');
        if (timeDiff < 30000) {
          } else {
          }
        
        // Always update stored time for coordination
        localStorage.setItem('last_server_start_time', startTime.toString());
      }
      
    } catch (error) {
      }
  }

  /**
   * Show update notification (simpler since mandatory modal handles this now)
   */
  private showUpdateNotification(): void {
    }

  /**
   * Refresh the app
   */
  private async refreshApp(): Promise<void> {
    try {
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Force reload with cache bypass
      const cacheBuster = `?v=${Date.now()}`;
      const currentUrl = window.location.href.split('?')[0];
      window.location.href = currentUrl + cacheBuster;
    } catch (error) {
      // Fallback with cache buster
      const cacheBuster = `?v=${Date.now()}`;
      const currentUrl = window.location.href.split('?')[0];
      window.location.href = currentUrl + cacheBuster;
    }
  }
}

// Export singleton
export const passiveUpdateDetector = PassiveUpdateDetector.getInstance();

// Initialize but do NOTHING automatically
passiveUpdateDetector.init();
// Smart Update Detector - efficient server restart detection
export class DevUpdateDetector {
  private static instance: DevUpdateDetector;
  private serverStartTime: number | null = null;
  private lastKnownStartTime: number | null = null;
  private isChecking = false;
  private lastCheckTime: number | null = null;

  static getInstance(): DevUpdateDetector {
    if (!DevUpdateDetector.instance) {
      DevUpdateDetector.instance = new DevUpdateDetector();
    }
    return DevUpdateDetector.instance;
  }

  /**
   * Start monitoring - check once after splash screen
   */
  startMonitoring(): void {
    console.log('🧠 Starting server restart detection (one-time check)...');
    
    // Get stored server start time from localStorage
    this.lastKnownStartTime = this.getStoredStartTime();
    console.log('📁 Last known server start time:', this.lastKnownStartTime ? new Date(this.lastKnownStartTime) : 'None stored');
    
    // Check once on app load
    this.checkForServerRestart();
    
    // Listen for visibility changes (when user comes back to app)
    this.setupVisibilityListener();
  }



  /**
   * Get stored server start time from localStorage
   */
  private getStoredStartTime(): number | null {
    const stored = localStorage.getItem('last_server_start_time');
    return stored ? parseInt(stored) : null;
  }

  /**
   * Store server start time in localStorage
   */
  private storeStartTime(startTime: number): void {
    localStorage.setItem('last_server_start_time', startTime.toString());
  }


  /**
   * Setup visibility listener - check when user returns to app
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('👀 User returned to app, checking for server restart...');
        // Only check if we haven't checked recently
        const now = Date.now();
        if (!this.lastCheckTime || (now - this.lastCheckTime) > 2 * 60 * 1000) { // 2 minutes minimum
          this.checkForServerRestart();
        }
      }
    });
    
    // Also check when page gains focus
    window.addEventListener('focus', () => {
      console.log('🎯 Window gained focus, checking for server restart...');
      // Only check if we haven't checked recently
      const now = Date.now();
      if (!this.lastCheckTime || (now - this.lastCheckTime) > 2 * 60 * 1000) { // 2 minutes minimum
        this.checkForServerRestart();
      }
    });
  }

  // Cache server start time to prevent repeated calls
  private serverStartTimeCache: { time: number; timestamp: number } | null = null;
  private readonly SERVER_INFO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (much less aggressive)

  /**
   * Get server start time from a simple endpoint with caching
   */
  private async getServerStartTime(): Promise<number> {
    const now = Date.now();
    
    // Return cached value if still valid
    if (this.serverStartTimeCache && 
        (now - this.serverStartTimeCache.timestamp) < this.SERVER_INFO_CACHE_DURATION) {
      return this.serverStartTimeCache.time;
    }

    try {
      const response = await fetch('/api/server-info');
      if (response.ok) {
        const data = await response.json();
        const startTime = data.startTime || Date.now();
        
        // Cache the result
        this.serverStartTimeCache = {
          time: startTime,
          timestamp: now
        };
        
        return startTime;
      }
    } catch (error) {
      console.log('Could not get server start time, using current time');
    }
    
    const fallbackTime = Date.now();
    this.serverStartTimeCache = {
      time: fallbackTime,
      timestamp: now
    };
    
    return fallbackTime;
  }

  /**
   * Check for server restart - compare timestamps
   */
  private async checkForServerRestart(): Promise<void> {
    if (this.isChecking) return;
    
    this.isChecking = true;
    
    try {
      const currentStartTime = await this.getServerStartTime();
      console.log('🔍 Checking server start time:', new Date(currentStartTime));
      
      // If we have a stored time and current time is newer, server restarted
      if (this.lastKnownStartTime && currentStartTime > this.lastKnownStartTime) {
        console.log('🚨 SERVER RESTART DETECTED!');
        console.log('📅 Previous start time:', new Date(this.lastKnownStartTime));
        console.log('📅 Current start time:', new Date(currentStartTime));
        console.log('⏰ Time difference:', Math.round((currentStartTime - this.lastKnownStartTime) / 1000), 'seconds');
        
        this.handleServerRestart();
      } else if (!this.lastKnownStartTime) {
        console.log('📝 First time check - storing server start time');
      } else {
        console.log('✅ No server restart detected (same start time)');
      }
      
      // Always update the known start time
      this.lastKnownStartTime = currentStartTime;
      this.storeStartTime(currentStartTime);
      
    } catch (error) {
      console.error('❌ Error checking server status:', error);
      console.log('Server might be restarting or unreachable...');
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Handle server restart - show full-screen mandatory update overlay
   */
  private handleServerRestart(): void {
    // Create full-screen mandatory update overlay
    this.showMandatoryUpdateModal();
    
    // Also log it prominently for developers
    console.log('🚀 SERVER RESTART DETECTED - Showing mandatory update overlay');
  }

  /**
   * Show mandatory full-screen update modal
   */
  private showMandatoryUpdateModal(): void {
    // Remove any existing modal
    this.removeMandatoryUpdateModal();
    
    // Detect theme
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? 'hsl(0 0% 10%)' : 'hsl(0 0% 100%)';
    const cardBg = isDark ? 'hsl(0 0% 13%)' : 'hsl(0 0% 100%)';
    const textColor = isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 13%)';
    const textMuted = isDark ? 'hsl(0 0% 65%)' : 'hsl(0 0% 45%)';
    const overlayBg = isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)';
    const primaryColor = 'hsl(4 68% 52%)'; // #D63D31
    const primaryHover = 'hsl(4 68% 42%)';
    const borderColor = isDark ? 'hsl(0 0% 20%)' : 'hsl(0 0% 90%)';
    
    // Create full-screen overlay
    const overlay = document.createElement('div');
    overlay.id = 'mandatory-update-overlay';
    overlay.innerHTML = `
      <div class="mandatory-update-overlay">
        <div class="mandatory-update-content">
          <div class="update-icon">🚀</div>
          <h1 class="update-title">App Updated!</h1>
          <p class="update-description">New features and improvements are available. Please refresh to continue using the app.</p>
          <div class="update-buttons">
            <button type="button" id="refresh-now-btn" class="refresh-btn" tabindex="0">
              🔄 Refresh Now
            </button>
          </div>
          <p class="update-note">You must refresh to continue</p>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .mandatory-update-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${overlayBg};
        backdrop-filter: blur(10px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .mandatory-update-content {
        background: ${cardBg};
        border: 1px solid ${borderColor};
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(30px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .update-icon {
        font-size: 48px;
        margin-bottom: 16px;
        animation: bounce 2s infinite;
      }
      
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-10px);
        }
        60% {
          transform: translateY(-5px);
        }
      }
      
      .update-title {
        font-size: 24px;
        font-weight: 700;
        color: ${textColor};
        margin: 0 0 12px 0;
      }
      
      .update-description {
        font-size: 16px;
        color: ${textMuted};
        line-height: 1.5;
        margin: 0 0 24px 0;
      }
      
      .update-buttons {
        margin-bottom: 16px;
      }
      
      .refresh-btn {
        background: ${primaryColor};
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: all 0.2s ease;
        min-height: 56px;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        pointer-events: auto !important;
        position: relative;
        z-index: 100000;
        outline: 2px solid transparent;
        display: block;
      }
      
      .refresh-btn:hover {
        background: ${primaryHover};
        transform: translateY(-2px);
        box-shadow: 0 4px 12px ${primaryColor}40;
      }
      
      .refresh-btn:active {
        transform: translateY(0);
      }
      
      .update-note {
        font-size: 14px;
        color: ${textMuted};
        margin: 0;
        font-style: italic;
      }
      
      @media (max-width: 480px) {
        .mandatory-update-content {
          padding: 24px;
          border-radius: 12px;
        }
        
        .update-icon {
          font-size: 40px;
        }
        
        .update-title {
          font-size: 20px;
        }
        
        .update-description {
          font-size: 15px;
        }
        
        .refresh-btn {
          font-size: 16px;
          padding: 14px 24px;
          min-height: 50px;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    

    
    // Attach event handlers to button
    setTimeout(() => {
      const refreshBtn = document.getElementById('refresh-now-btn');
      if (refreshBtn) {
        const handleRefresh = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Visual feedback
          refreshBtn.style.background = '#B83428';
          refreshBtn.style.transform = 'scale(0.95)';
          refreshBtn.textContent = '🔄 Refreshing...';
          
          this.refreshApp();
        };
        
        // Add multiple event handlers for compatibility
        refreshBtn.addEventListener('click', handleRefresh, { capture: true });
        refreshBtn.addEventListener('touchstart', handleRefresh, { capture: true });
        refreshBtn.onclick = handleRefresh;
        
        // Hover effects
        refreshBtn.addEventListener('mouseenter', () => {
          refreshBtn.style.background = '#B83428';
        });
        
        refreshBtn.addEventListener('mouseleave', () => {
          refreshBtn.style.background = '#D63D31';
        });
        
        // Ensure button is accessible
        refreshBtn.setAttribute('tabindex', '0');
        refreshBtn.style.pointerEvents = 'auto';
        refreshBtn.style.cursor = 'pointer';
      }
    }, 200);
    
    // Prevent scrolling and interaction with background
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * Remove mandatory update modal
   */
  private removeMandatoryUpdateModal(): void {
    const existing = document.getElementById('mandatory-update-overlay');
    if (existing) {
      existing.remove();
    }
    document.body.style.overflow = '';
  }
  
  /**
   * Refresh the app with full-screen loading
   */
  private async refreshApp(): Promise<void> {
    console.log('🚀 refreshApp method called - starting app refresh process...');
    // Update the modal to show loading state
    const overlay = document.getElementById('mandatory-update-overlay');
    if (overlay) {
      // Detect theme
      const isDark = document.documentElement.classList.contains('dark');
      const cardBg = isDark ? 'hsl(0 0% 13%)' : 'hsl(0 0% 100%)';
      const textColor = isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 13%)';
      const textMuted = isDark ? 'hsl(0 0% 65%)' : 'hsl(0 0% 45%)';
      const overlayBg = isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)';
      const primaryColor = 'hsl(4 68% 52%)'; // #D63D31
      const borderColor = isDark ? 'hsl(0 0% 20%)' : 'hsl(0 0% 90%)';
      const loadingBarBg = isDark ? 'hsl(0 0% 18%)' : 'hsl(0 0% 96%)';
      
      overlay.innerHTML = `
        <div class="mandatory-update-overlay">
          <div class="mandatory-update-content">
            <div class="update-loading-container">
              <div class="update-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
              </div>
            </div>
            <h1 class="update-title">Updating App...</h1>
            <p class="update-description">Please wait while we load the latest features</p>
            <div class="loading-bar-container">
              <div class="loading-bar">
                <div class="loading-progress"></div>
                <div class="loading-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add loading animation styles
      const loadingStyle = document.createElement('style');
      loadingStyle.id = 'update-loading-styles';
      loadingStyle.textContent = `
        .mandatory-update-overlay {
          background: ${overlayBg} !important;
        }
        
        .mandatory-update-content {
          background: ${cardBg} !important;
          border: 1px solid ${borderColor} !important;
        }
        
        .update-title {
          color: ${textColor} !important;
        }
        
        .update-description {
          color: ${textMuted} !important;
        }
        
        .update-loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .update-spinner {
          position: relative;
          width: 64px;
          height: 64px;
        }
        
        .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top-color: ${primaryColor};
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        
        .spinner-ring:nth-child(1) {
          animation-delay: -0.45s;
          opacity: 0.8;
        }
        
        .spinner-ring:nth-child(2) {
          animation-delay: -0.3s;
          opacity: 0.6;
          border-top-color: ${primaryColor}CC;
        }
        
        .spinner-ring:nth-child(3) {
          animation-delay: -0.15s;
          opacity: 0.4;
          border-top-color: ${primaryColor}99;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-bar-container {
          width: 100%;
          margin: 24px 0 16px 0;
        }
        
        .loading-bar {
          width: 100%;
          height: 8px;
          background: ${loadingBarBg};
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        
        .loading-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, ${primaryColor}, ${primaryColor}DD);
          border-radius: 4px;
          animation: progress 2s ease-in-out infinite;
        }
        
        .loading-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 30%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: shimmer 1.5s infinite;
        }
        
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `;
      
      // Remove existing loading styles if any
      const existingStyle = document.getElementById('update-loading-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(loadingStyle);
    }
    
    try {
      console.log('🧹 Clearing caches before refresh...');
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log('✅ Service workers unregistered');
      }

      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ Browser cache cleared');
      }

      // Wait for loading animation to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Store current server start time before refresh so manual checks know we're updated
      const currentStartTime = await this.getServerStartTime();
      this.storeStartTime(currentStartTime);
      console.log('✅ Stored updated server start time before refresh:', new Date(currentStartTime));
      
      console.log('🔄 Reloading page with fresh content...');
      // Force reload with cache bypass using timestamp to bust HTTP cache
      const cacheBuster = `?v=${Date.now()}`;
      const currentUrl = window.location.href.split('?')[0];
      console.log('🚀 Using cache buster:', cacheBuster);
      window.location.href = currentUrl + cacheBuster;
    } catch (error) {
      console.error('❌ Error during refresh:', error);
      // Fallback to simple reload with cache buster
      setTimeout(() => {
        const cacheBuster = `?v=${Date.now()}`;
        const currentUrl = window.location.href.split('?')[0];
        window.location.href = currentUrl + cacheBuster;
      }, 1000);
    }
  }
}

// Export detector instance for manual triggering
export const serverRestartDetector = DevUpdateDetector.getInstance();


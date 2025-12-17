import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Hook to handle browser back button navigation for PWA applications
 * Ensures that browser back button follows PWA navigation rules
 * 
 * This hook should be used at the app level to intercept all browser back navigation
 */
export function useBrowserBackNavigation() {
  const [, setLocation] = useLocation();

  /**
   * Check if current path is a main navigation page that should always go to home
   * Note: These routes no longer exist - they're handled internally by /app
   */
  const isMainNavigationPage = (path: string): boolean => {
    // These routes are deprecated - all navigation is handled by /app
    return false;
  };

  useEffect(() => {
    let isNavigating = false;

    const handlePopState = (event: PopStateEvent) => {
      // Prevent multiple rapid back navigation events
      if (isNavigating) return;
      
      const currentPath = window.location.pathname;
      
      // If we're on a main navigation page, handle it specially
      if (isMainNavigationPage(currentPath)) {
        isNavigating = true;
        
        // Prevent the default back behavior
        event.preventDefault();
        
        // Navigate to /app instead
        setLocation("/app");
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isNavigating = false;
        }, 100);
        
        return;
      }
    };

    // Add event listener for browser back button
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setLocation]);
}

/**
 * Alternative approach using history manipulation
 * This creates a more robust solution by managing the history stack
 */
export function useBrowserBackNavigationWithHistory() {
  const [, setLocation] = useLocation();

  /**
   * Check if current path is a main navigation page that should always go to home
   * Note: These routes no longer exist - they're handled internally by /app
   */
  const isMainNavigationPage = (path: string): boolean => {
    // These routes are deprecated - all navigation is handled by /app
    return false;
  };

  useEffect(() => {
    // Store the original pushState and replaceState methods
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    // Override pushState to add special markers for main navigation pages
    window.history.pushState = function(state: any, title: string, url?: string | URL | null) {
      const path = typeof url === 'string' ? url : window.location.pathname;
      
      if (isMainNavigationPage(path)) {
        // Add a marker to indicate this is a main navigation page
        const newState = { ...state, pwaMainPage: true, originalPath: path };
        return originalPushState.call(this, newState, title, url);
      }
      
      return originalPushState.call(this, state, title, url);
    };

    // Override replaceState similarly
    window.history.replaceState = function(state: any, title: string, url?: string | URL | null) {
      const path = typeof url === 'string' ? url : window.location.pathname;
      
      if (isMainNavigationPage(path)) {
        const newState = { ...state, pwaMainPage: true, originalPath: path };
        return originalReplaceState.call(this, newState, title, url);
      }
      
      return originalReplaceState.call(this, state, title, url);
    };

    const handlePopState = (event: PopStateEvent) => {
      const currentPath = window.location.pathname;
      const state = event.state;
      
      // Check if we're on a main navigation page
      const isMainPage = state?.pwaMainPage || isMainNavigationPage(currentPath);
      
      // Don't handle if we're already on /app (AppPage handles it internally)
      if (currentPath === "/app") {
        return; // Let AppPage handle /app navigation
      }
      
      if (isMainPage) {
        // Prevent the back navigation
        event.preventDefault();
        
        // Navigate to /app (these routes no longer exist)
        originalPushState.call(window.history, { pwaApp: true }, '', '/app');
        setLocation("/app");
        
        return;
      }
    };

    // Add event listener for browser back button
    window.addEventListener('popstate', handlePopState);

    // Cleanup - restore original methods
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setLocation]);
}




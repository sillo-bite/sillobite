import { useLocation } from "wouter";

/**
 * Custom hook for PWA navigation that ensures consistent back navigation patterns
 * 
 * PWA Navigation Strategy:
 * - Key pages (cart, orders, profile, menu) always navigate back to home
 * - This provides a better user experience in PWA applications by avoiding complex navigation history
 * - Users can always easily return to the main hub (home page) from any major section
 * - This is especially important for mobile PWA users who expect predictable navigation patterns
 * - Browser back button is intercepted to follow the same navigation rules
 * 
 * Usage:
 * - Use goToHome() for back navigation from main pages
 * - Use navigateTo() for general navigation with PWA-friendly options
 * - Use goBack() for smart back navigation that adapts to PWA vs browser context
 * - Browser back button automatically follows PWA navigation rules
 */
export function usePWANavigation() {
  const [, setLocation] = useLocation();

  /**
   * Check if current path is a main navigation page that should always go to home
   * Note: These routes no longer exist - they're handled internally by /app
   */
  const isMainNavigationPage = (path: string): boolean => {
    // These routes are deprecated - all navigation is handled by /app
    return false;
  };

  /**
   * Navigate back to home page - used by main navigation pages
   * This ensures consistent navigation in PWA applications
   */
  const goToHome = () => {
    setLocation("/app");
  };

  /**
   * Navigate to a specific page with PWA-friendly navigation
   * @param path - The path to navigate to
   * @param options - Navigation options
   */
  const navigateTo = (path: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      // Use replace for navigation that shouldn't create history entries
      window.history.replaceState({}, '', path);
      setLocation(path);
    } else {
      // For main navigation pages, ensure proper history management
      if (isMainNavigationPage(path)) {
        // Push a special state to mark this as a main navigation page
        window.history.pushState({ pwaMainPage: true, path }, '', path);
      }
      setLocation(path);
    }
  };

  /**
   * Navigate back with PWA-friendly behavior
   * For main pages, always go to home instead of browser back
   * @param fallbackPath - Fallback path if no history
   */
  const goBack = (fallbackPath: string = "/app") => {
    // Check if we're in a PWA context
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  window.location.search.includes('pwa=true');

    if (isPWA) {
      // In PWA, always go to /app for main navigation pages
      setLocation("/app");
    } else {
      // In browser, use normal back navigation
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation(fallbackPath);
      }
    }
  };

  // Browser back navigation is now handled by useBrowserBackNavigationWithHistory hook
  // This keeps the navigation logic centralized and prevents conflicts

  /**
   * Handle browser back navigation for main pages
   * This function can be called to programmatically handle back navigation
   */
  const handleBrowserBack = () => {
    const currentPath = window.location.pathname;
    
    if (isMainNavigationPage(currentPath)) {
      // For main navigation pages, always go to /app
      setLocation("/app");
    } else {
      // For other pages, use normal browser back
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/app");
      }
    }
  };

  return {
    goToHome,
    navigateTo,
    goBack,
    handleBrowserBack,
    isMainNavigationPage,
    setLocation
  };
}

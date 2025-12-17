import { useEffect } from "react";
import { useLocation } from "wouter";

interface UseBackNavigationOptions {
  /**
   * Custom back handler function
   */
  onBack?: () => void;
  /**
   * Route to navigate to on back
   */
  backTo?: string;
  /**
   * Session storage key to check for referrer
   */
  referrerKey?: string;
  /**
   * Route to navigate if referrer matches
   */
  referrerRoute?: string;
}

/**
 * Hook for handling back navigation with referrer support
 * Used for pages that need special back navigation logic (e.g., from login page)
 */
export function useBackNavigation(options: UseBackNavigationOptions = {}) {
  const [, setLocation] = useLocation();
  const { referrerKey, referrerRoute, onBack, backTo } = options;

  useEffect(() => {
    const handlePopState = () => {
      if (referrerKey && referrerRoute) {
        const referrer = sessionStorage.getItem(referrerKey);
        if (referrer === referrerRoute) {
          sessionStorage.removeItem(referrerKey);
          setTimeout(() => {
            setLocation(referrerRoute);
          }, 0);
          return;
        }
      }

      if (onBack) {
        onBack();
      } else if (backTo) {
        setLocation(backTo);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setLocation, referrerKey, referrerRoute, onBack, backTo]);

  const handleBackClick = () => {
    if (referrerKey && referrerRoute) {
      const referrer = sessionStorage.getItem(referrerKey);
      if (referrer === referrerRoute) {
        sessionStorage.removeItem(referrerKey);
        setLocation(referrerRoute);
        return;
      }
    }

    if (onBack) {
      onBack();
    } else if (backTo) {
      setLocation(backTo);
    } else {
      // Default: navigate to /app and dispatch back event
      setLocation("/app");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
      }, 0);
    }
  };

  return { handleBackClick };
}


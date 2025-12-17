import { useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * Activity tracker hook for mobile PWA users
 * Automatically extends user session on app interactions
 * Helps maintain login state for mobile users who frequently switch between apps
 */
export function useActivityTracker() {
  const { updateActivity, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Track user activity events that indicate active usage
    const events = [
      'click',
      'touchstart',
      'keydown',
      'scroll',
      'mousedown',
      'touchmove'
    ];

    // Throttle activity updates to prevent excessive localStorage writes
    let lastUpdate = 0;
    const throttleDelay = 60000; // Update activity at most once per minute

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > throttleDelay) {
        updateActivity();
        lastUpdate = now;
      }
    };

    // Add event listeners for activity tracking
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Track PWA state changes (when app comes into focus)
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        updateActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, updateActivity]);
}
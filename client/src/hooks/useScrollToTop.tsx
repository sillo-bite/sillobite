import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook that scrolls to top whenever the route changes
 * Use this in individual components that need scroll restoration
 */
export function useScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
}

/**
 * Component wrapper that scrolls to top on route changes
 * Place this inside your Router to enable global scroll restoration
 */
export function ScrollToTop() {
  useScrollToTop();
  return null;
}

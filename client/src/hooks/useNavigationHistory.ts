import { useState, useEffect, useCallback, useRef } from 'react';

export type NavigationView = 'home' | 'cart' | 'favorites' | 'menu' | 'profile' | 'orders' | 'challenges';

interface NavigationHistoryItem {
  view: NavigationView;
  timestamp: number;
}

/**
 * Hook to manage navigation history for proper back button behavior
 * Tracks the user's navigation path so back button follows the actual path taken
 */
export function useNavigationHistory() {
  const [history, setHistory] = useState<NavigationHistoryItem[]>([]);
  const [currentView, setCurrentView] = useState<NavigationView>('home');
  const isNavigatingBackRef = useRef(false);

  // Initialize with home view
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ view: 'home', timestamp: Date.now() }]);
      setCurrentView('home');
    }
  }, []);

  /**
   * Navigate to a new view and add it to history
   * @param view - The view to navigate to
   * @param skipIfSame - If true, skip adding to history if it's the same as current view
   */
  const navigateTo = useCallback((view: NavigationView, skipIfSame: boolean = true) => {
    // Don't add to history if we're currently navigating back
    if (isNavigatingBackRef.current) {
      // Just update the view without adding to history
      isNavigatingBackRef.current = false;
      setCurrentView(view);
      return;
    }
    
    setHistory(prev => {
      // Don't add if it's the same view and skipIfSame is true
      if (skipIfSame && prev.length > 0 && prev[prev.length - 1].view === view) {
        return prev;
      }
      // Add new view to history
      return [...prev, { view, timestamp: Date.now() }];
    });
    setCurrentView(view);
  }, []);

  /**
   * Navigate back to the previous view in history
   * Returns the previous view or 'home' if no history
   */
  const navigateBack = useCallback((): NavigationView => {
    // Set flag to prevent adding to history when view changes
    isNavigatingBackRef.current = true;
    
    let previousView: NavigationView = 'home';
    
    setHistory(prev => {
      if (prev.length <= 1) {
        // Already at root, stay at home
        previousView = 'home';
        setCurrentView('home');
        return prev;
      }
      // Remove current view (last entry) and get the previous one
      const newHistory = prev.slice(0, -1);
      // The previous view is now the last entry in the new history
      previousView = newHistory[newHistory.length - 1].view;
      setCurrentView(previousView);
      return newHistory;
    });
    
    // Reset flag after state update completes
    // Use requestAnimationFrame to ensure it happens after React's state update
    requestAnimationFrame(() => {
      isNavigatingBackRef.current = false;
    });
    
    return previousView;
  }, []);

  /**
   * Get the previous view without navigating
   */
  const getPreviousView = useCallback((): NavigationView => {
    if (history.length <= 1) {
      return 'home';
    }
    return history[history.length - 2].view;
  }, [history]);

  /**
   * Clear history and reset to home
   */
  const resetToHome = useCallback(() => {
    setHistory([{ view: 'home', timestamp: Date.now() }]);
    setCurrentView('home');
  }, []);

  /**
   * Replace current view without adding to history (for same-page navigation)
   */
  const replaceCurrent = useCallback((view: NavigationView) => {
    setHistory(prev => {
      if (prev.length === 0) {
        return [{ view, timestamp: Date.now() }];
      }
      // Replace last item
      const newHistory = [...prev];
      newHistory[newHistory.length - 1] = { view, timestamp: Date.now() };
      return newHistory;
    });
    setCurrentView(view);
  }, []);

  /**
   * Navigate to a view, ensuring the current view is in history first
   * This is useful when navigating from one view to another (e.g., Profile -> Orders)
   * to ensure proper back navigation
   */
  const navigateToWithCurrent = useCallback((view: NavigationView, currentViewToAdd: NavigationView) => {
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      setCurrentView(view);
      return;
    }
    
    setHistory(prev => {
      const newHistory = [...prev];
      const lastView = newHistory.length > 0 ? newHistory[newHistory.length - 1].view : null;
      
      // If current view is not the last entry, add it first
      if (lastView !== currentViewToAdd && currentViewToAdd !== view) {
        newHistory.push({ view: currentViewToAdd, timestamp: Date.now() });
      }
      
      // Then add the target view (only if different from last entry)
      const newLastView = newHistory.length > 0 ? newHistory[newHistory.length - 1].view : null;
      if (newLastView !== view) {
        newHistory.push({ view, timestamp: Date.now() });
      }
      
      return newHistory;
    });
    setCurrentView(view);
  }, []);

  return {
    currentView,
    history,
    navigateTo,
    navigateBack,
    getPreviousView,
    resetToHome,
    replaceCurrent,
    navigateToWithCurrent
  };
}


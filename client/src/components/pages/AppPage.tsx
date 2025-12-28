import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation, Router } from "wouter";
import HomeScreen from "./HomeScreen";
const CartPage = lazy(() => import("./CartPage"));
import FavoritesPage from "./FavoritesPage";
import MenuListingPage from "@/components/menu/MenuListingPage";
import ProfilePage from "@/components/profile/ProfilePage";
import OrdersPage from "@/components/orders/OrdersPage";
import CodingChallengesPage from "./CodingChallengesPage";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { useNavigationHistory, type NavigationView } from "@/hooks/useNavigationHistory";
import { useAuth } from "@/hooks/useAuth";

type ViewType = "home" | "cart" | "favorites" | "menu" | "profile" | "orders" | "challenges";

/**
 * App Page - Single Page Application entry point
 * Manages navigation between HomeScreen, CartPage, FavoritesPage, MenuListingPage, ProfilePage, and OrdersPage
 * All views keep URL at /app while rendering components internally
 */

// Wrapper component that provides virtual route context for MenuListingPage
function MenuWrapper({ category, children }: { category: string; children: React.ReactNode }) {
  // Create a custom location hook that provides /menu/:category route
  const useCustomLocation = () => {
    const [location, setLocation] = useState(`/menu/${encodeURIComponent(category)}`);
    
    // Update location when category changes
    useEffect(() => {
      setLocation(`/menu/${encodeURIComponent(category)}`);
    }, [category]);
    
    // Intercept setLocation to update parent category state via custom event
    const customSetLocation = (newLocation: string) => {
      // If navigating to /home, dispatch event to switch to home view in AppPage
      if (newLocation === "/home" || newLocation === "/") {
        window.dispatchEvent(new CustomEvent('appNavigateHome', {}));
        return; // Don't update location in nested router
      }
      
      if (newLocation.startsWith("/menu/")) {
        const categoryFromUrl = newLocation.split("/menu/")[1];
        if (categoryFromUrl) {
          // Dispatch event to update parent category
          window.dispatchEvent(new CustomEvent('appMenuCategoryChange', {
            detail: { category: decodeURIComponent(categoryFromUrl) }
          }));
        }
      }
      setLocation(newLocation);
    };
    
    return [location, customSetLocation] as const;
  };
  
  return (
    <Router hook={useCustomLocation}>
      {children}
    </Router>
  );
}
export default function AppPage() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [menuCategory, setMenuCategory] = useState<string>("all");
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>("");
  const [, setLocation] = useLocation();
  const { navigateTo, navigateBack, getPreviousView, history, navigateToWithCurrent } = useNavigationHistory();
  const [showExitToast, setShowExitToast] = useState(false);
  const [shouldHideBottomNav, setShouldHideBottomNav] = useState(false);
  const { user } = useAuth();
  
  // Ref to track current view for event handlers (prevents closure issues)
  const currentViewRef = useRef<ViewType>(currentView);
  
  // Redirect delivery persons to their portal (immediate check)
  useEffect(() => {
    if (user && user.role === 'delivery_person') {
      console.log('🚚 Delivery person detected in AppPage, redirecting to delivery portal');
      console.log('   User data:', { id: user.id, email: user.email, role: user.role });
      setLocation('/delivery-portal');
      return;
    }
  }, [user, setLocation]);
  
  // Also check on mount in case user is already loaded
  useEffect(() => {
    const checkUser = () => {
      const cachedUserStr = localStorage.getItem('user');
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr);
          if (cachedUser && cachedUser.role === 'delivery_person') {
            console.log('🚚 Delivery person detected from cache in AppPage, redirecting to delivery portal');
            setLocation('/delivery-portal');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };
    checkUser();
  }, [setLocation]);
  
  // Update ref when currentView changes
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);
  
  // Check if we're returning from a separate route (like Notifications, Help & Support, etc.) and need to restore Profile
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath === "/app") {
      const fromProfile = sessionStorage.getItem('navigationFrom') === 'profile';
      if (fromProfile && currentView !== 'profile') {
        // We're returning from a page that came from Profile, restore Profile view
        sessionStorage.removeItem('navigationFrom');
        const lastHistoryView = history.length > 0 ? history[history.length - 1].view : null;
        if (lastHistoryView !== 'profile') {
          navigateTo("profile");
        } else {
          setCurrentView("profile");
        }
      }
    }
  }, [currentView, history, navigateTo]);

  // Handle navigation from bottom navigation
  const handleNavigation = (view: "home" | "menu" | "cart" | "profile" | "favorites") => {
    // Track this navigation in history (not a back navigation)
    navigateTo(view);
    setCurrentView(view);
    
    // Keep URL at /app with proper state marking
    // Important: Mark state differently based on view for iOS/Android back handling
    if (view === "home") {
      // Mark as home view for back navigation handling
      window.history.replaceState({ 
        homeView: true, 
        isHome: true,
        timestamp: Date.now() 
      }, "", "/app");
    } else {
      // For other views, use neutral state
      window.history.replaceState({ 
        view: view,
        timestamp: Date.now() 
      }, "", "/app");
    }
    
    // Scroll to top when switching views
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Determine current page for BottomNavigation
  const getCurrentPage = (): "home" | "menu" | "cart" | "profile" | "favorites" => {
    return currentView as "home" | "menu" | "cart" | "profile" | "favorites";
  };

  // Listen for menu category changes and navigation events
  useEffect(() => {
    const handleCategoryChange = (e: CustomEvent) => {
      const category = e.detail?.category || "all";
      setMenuCategory(category);
      // Switch to menu view when category changes
      if (currentView !== "menu") {
        navigateTo("menu");
        setCurrentView("menu");
        window.history.replaceState({}, "", "/app");
      }
    };
    
    // Listen for back navigation - uses history to go to previous view
    const handleNavigateBack = () => {
      const previousView = navigateBack();
      setCurrentView(previousView);
      window.history.replaceState({}, "", "/app");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    
    // Listen for navigation to cart view
    const handleNavigateToCart = () => {
      navigateTo("cart");
      setCurrentView("cart");
      window.history.replaceState({}, "", "/app");
    };
    
    // Listen for navigation to orders view
    const handleNavigateToOrders = () => {
      // Ensure we're not already on orders
      if (currentView === "orders") {
        return; // Already on orders, don't navigate
      }
      
      // Use navigateToWithCurrent to ensure current view is in history before navigating to orders
      // This ensures proper back navigation: Profile -> Orders -> Back -> Profile -> Back -> Home
      navigateToWithCurrent("orders", currentView as NavigationView);
      setCurrentView("orders");
      window.history.replaceState({}, "", "/app");
    };
    
    // Listen for navigation to menu view from category clicks
    const handleNavigateToMenu = (e: CustomEvent) => {
      const category = e.detail?.category || "all";
      const search = e.detail?.search || "";
      // MenuListingPage expects category to be lowercase for matching
      const normalizedCategory = category === "all" ? "all" : category.toLowerCase();
      setCurrentView("menu");
      setMenuCategory(normalizedCategory);
      setMenuSearchQuery(search);
      window.history.replaceState({}, "", "/app");
      // Scroll to top when switching views
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    
    // Listen for ensuring Profile is in history (before navigating away)
    const handleEnsureProfileInHistory = () => {
      // Ensure Profile is in history before navigating to a separate route
      const lastHistoryView = history.length > 0 ? history[history.length - 1].view : null;
      if (lastHistoryView !== 'profile' && currentView === 'profile') {
        navigateTo("profile");
      }
    };
    
    // Listen for navigation to profile view
    const handleNavigateToProfile = () => {
      // Check if we're coming back from a separate route (like Notifications)
      const fromNotifications = sessionStorage.getItem('navigationFrom') === 'profile';
      
      if (fromNotifications) {
        // Coming back from Notifications - restore Profile view
        sessionStorage.removeItem('navigationFrom');
        
        // Check if Profile is already in history
        const lastHistoryView = history.length > 0 ? history[history.length - 1].view : null;
        
        if (lastHistoryView !== 'profile') {
          // Profile is not in history, add it
          navigateTo("profile");
        } else {
          // Profile is already in history, just set the view
          setCurrentView("profile");
        }
        window.history.replaceState({}, "", "/app");
      } else {
        // Normal navigation to Profile - add to history
        navigateTo("profile");
        setCurrentView("profile");
        window.history.replaceState({}, "", "/app");
      }
    };
    
    // Listen for navigation to challenges view
    const handleNavigateToChallenges = () => {
      navigateToWithCurrent("challenges", currentView as NavigationView);
      setCurrentView("challenges");
      window.history.replaceState({}, "", "/app");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    
    // Listen for navigation to home view (for direct navigation, not back)
    const handleNavigateHome = () => {
      navigateTo("home");
      setCurrentView("home");
      window.history.replaceState({}, "", "/app");
    };
    
    window.addEventListener('appMenuCategoryChange' as any, handleCategoryChange);
    window.addEventListener('appNavigateToMenu' as any, handleNavigateToMenu);
    window.addEventListener('appNavigateBack' as any, handleNavigateBack);
    window.addEventListener('appNavigateHome' as any, handleNavigateHome);
    window.addEventListener('appNavigateToCart' as any, handleNavigateToCart);
    window.addEventListener('appNavigateToOrders' as any, handleNavigateToOrders);
    window.addEventListener('appNavigateToProfile' as any, handleNavigateToProfile);
    window.addEventListener('appNavigateToChallenges' as any, handleNavigateToChallenges);
    window.addEventListener('appEnsureProfileInHistory' as any, handleEnsureProfileInHistory);
    
    return () => {
      window.removeEventListener('appMenuCategoryChange' as any, handleCategoryChange);
      window.removeEventListener('appNavigateToMenu' as any, handleNavigateToMenu);
      window.removeEventListener('appNavigateBack' as any, handleNavigateBack);
      window.removeEventListener('appNavigateHome' as any, handleNavigateHome);
      window.removeEventListener('appNavigateToCart' as any, handleNavigateToCart);
      window.removeEventListener('appNavigateToOrders' as any, handleNavigateToOrders);
      window.removeEventListener('appNavigateToProfile' as any, handleNavigateToProfile);
      window.removeEventListener('appNavigateToChallenges' as any, handleNavigateToChallenges);
      window.removeEventListener('appEnsureProfileInHistory' as any, handleEnsureProfileInHistory);
    };
  }, [navigateTo, navigateBack, history, currentView]); // Include history and currentView for handleNavigateToOrders


  // Handle browser back navigation and intercept goToHome from MenuListingPage
  useEffect(() => {
    if (currentView === "menu") {
      // Intercept navigation to /home when in menu view (from goToHome or back button)
      const checkUrl = () => {
        const path = window.location.pathname;
        if ((path === "/home" || path === "/") && currentView === "menu") {
          setCurrentView("home");
          window.history.replaceState({}, "", "/app");
        }
      };
      
      const urlCheckInterval = setInterval(checkUrl, 50); // Check more frequently
      
      // Listen for popstate events (browser back button)
      const handlePopState = (event: PopStateEvent) => {
        // When back button is pressed, use navigation history
        event.preventDefault();
        const previousView = navigateBack();
        setCurrentView(previousView);
        window.history.replaceState({}, "", "/app");
      };
      
      // Also intercept history.back() calls
      const originalBack = window.history.back;
      window.history.back = function() {
        const previousView = navigateBack();
        setCurrentView(previousView);
        window.history.replaceState({}, "", "/app");
        return;
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        clearInterval(urlCheckInterval);
        window.removeEventListener('popstate', handlePopState);
        window.history.back = originalBack;
      };
    }
  }, [currentView, navigateBack]);

  // Handle back navigation from home view - iOS: prevent swipe, Android: close PWA
  useEffect(() => {
    if (currentView === "home") {
      // Detect device type
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      
      // For iOS PWA: Block left-to-right swipe gesture on home page
      if (isIOS && isPWA) {
        // Clear any history entries from splash/OAuth/login pages
        const clearAuthHistory = () => {
          const currentPath = window.location.pathname;
          if (currentPath === '/app') {
            window.history.replaceState({ home: true, isHome: true, view: 'home', cleared: true }, '', '/app');
            window.history.pushState({ home: true, isHome: true, view: 'home', barrier: true }, '', '/app');
          }
        };
        
        clearAuthHistory();
        
        // Touch tracking for swipe prevention - more aggressive
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwipeBlocked = false;
        let hasMoved = false;
        const EDGE_THRESHOLD = 30; // Increased edge zone to 30px
        
        // Block left-to-right swipe gesture
        const handleTouchStart = (e: TouchEvent) => {
          if (e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            hasMoved = false;
            
            // Block if touch starts from left edge (increased threshold)
            if (touchStartX < EDGE_THRESHOLD) {
              isSwipeBlocked = true;
              // Prevent default immediately for edge touches
              e.preventDefault();
              e.stopPropagation();
            }
          }
        };
        
        const handleTouchMove = (e: TouchEvent) => {
          if (e.touches.length === 0) return;
          
          const currentX = e.touches[0].clientX;
          const currentY = e.touches[0].clientY;
          const deltaX = currentX - touchStartX;
          const deltaY = Math.abs(currentY - touchStartY);
          
          // Track if any movement occurred
          if (Math.abs(deltaX) > 0 || deltaY > 0) {
            hasMoved = true;
          }
          
          // More aggressive blocking: catch even tiny movements from edge
          if (touchStartX < EDGE_THRESHOLD) {
            // Block ANY rightward movement from edge, even tiny ones
            if (deltaX > 0) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              isSwipeBlocked = true;
              return;
            }
            
            // Also block if movement is primarily horizontal (even small)
            if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 3) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              isSwipeBlocked = true;
              return;
            }
          }
          
          // Also check if current position is in edge zone and moving right
          if (currentX < EDGE_THRESHOLD && deltaX > 0) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            isSwipeBlocked = true;
          }
        };
        
        const handleTouchEnd = (e: TouchEvent) => {
          // If we blocked a swipe, prevent any default behavior
          if (isSwipeBlocked && hasMoved) {
            e.preventDefault();
            e.stopPropagation();
          }
          isSwipeBlocked = false;
          hasMoved = false;
        };
        
        const handleTouchCancel = () => {
          isSwipeBlocked = false;
          hasMoved = false;
        };
        
        // Handle back navigation - immediately push forward to re-render home
        const handlePopState = () => {
          const latestView = currentViewRef.current;
          const currentPath = window.location.pathname;
          
          // Block navigation to splash, OAuth, login, onboarding pages
          const blockedPaths = ['/', '/oauth-callback', '/login', '/onboarding', '/profile-setup'];
          const isBlockedPath = blockedPaths.includes(currentPath);
          
          // If we're on home view OR trying to navigate to a blocked path, restore home
          if (latestView === 'home' || isBlockedPath) {
            window.history.replaceState({ home: true, isHome: true, view: 'home' }, '', '/app');
            window.history.pushState({ home: true, isHome: true, view: 'home', barrier: true }, '', '/app');
            setCurrentView('home');
          }
        };
        
        // Add touch event listeners to block swipe gesture
        // Use non-passive for all to ensure we can preventDefault
        document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        document.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: false });
        
        // Also add to window for maximum coverage
        window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        window.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: false });
        
        // Add popstate listener for fallback
        window.addEventListener('popstate', handlePopState, { capture: true, passive: true });
        
        return () => {
          document.removeEventListener('touchstart', handleTouchStart, { capture: true });
          document.removeEventListener('touchmove', handleTouchMove, { capture: true });
          document.removeEventListener('touchend', handleTouchEnd, { capture: true });
          document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
          window.removeEventListener('touchstart', handleTouchStart, { capture: true });
          window.removeEventListener('touchmove', handleTouchMove, { capture: true });
          window.removeEventListener('touchend', handleTouchEnd, { capture: true });
          window.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
          window.removeEventListener('popstate', handlePopState, { capture: true });
        };
      }
      
      // For Android PWA: Close/minimize app when back button is pressed on home view
      if (isAndroid && isPWA) {
        // Clear history stack and set up for app exit on back press
        // Replace all history with single root entry
        window.history.replaceState({ 
          homeView: true, 
          isRootEntry: true,
          allowExit: true,
          timestamp: Date.now() 
        }, '', '/app');
        
        // Track back press count for double-tap to exit pattern
        let backPressCount = 0;
        let backPressTimer: NodeJS.Timeout | null = null;
        
        const handlePopState = (event: PopStateEvent) => {
          const currentState = window.history.state;
          
          // If we're at root entry, allow the app to close
          if (currentState?.isRootEntry || currentState?.allowExit) {
            // Don't prevent default - let Android system close the app
            // This is the natural behavior when history is empty
            console.log('📱 Android PWA: Back pressed on home - allowing app to close');
            return;
          }
          
          // If somehow not at root, navigate to root and mark as exit-ready
          event.preventDefault();
          event.stopPropagation();
          
          window.history.replaceState({ 
            homeView: true, 
            isRootEntry: true,
            allowExit: true,
            timestamp: Date.now() 
          }, '', '/app');
        };
        
        // Override history.back to handle double-tap to exit
        const originalBack = window.history.back;
        window.history.back = function() {
          console.log('📱 Android PWA: Back button pressed on home view');
          
          // Increment back press count
          backPressCount++;
          
          // Clear existing timer
          if (backPressTimer) {
            clearTimeout(backPressTimer);
          }
          
          // If double tap within 2 seconds, close app
          if (backPressCount >= 2) {
            console.log('📱 Android PWA: Double back press detected - closing app');
            // Reset history to empty state to allow app close
            window.history.replaceState(null, '', '/app');
            // Attempt to close (some browsers support this)
            window.close();
            // If close doesn't work, system will minimize on next back
            backPressCount = 0;
            return;
          }
          
          // Show toast message for single tap
          console.log('📱 Android PWA: Press back again to exit');
          
          // Show visual toast notification
          setShowExitToast(true);
          
          // Reset counter and hide toast after 2 seconds
          backPressTimer = setTimeout(() => {
            backPressCount = 0;
            setShowExitToast(false);
          }, 2000);
        };
        
        // Override history.go
        const originalGo = window.history.go;
        window.history.go = function(delta?: number) {
          if (delta && delta < 0) {
            // Treat as back button press
            return originalBack.call(window.history);
          }
          return originalGo.call(window.history, delta);
        };
        
        // Add popstate listener
        window.addEventListener('popstate', handlePopState, { capture: true });
        
        return () => {
          if (backPressTimer) {
            clearTimeout(backPressTimer);
          }
          window.removeEventListener('popstate', handlePopState, { capture: true });
          window.history.back = originalBack;
          window.history.go = originalGo;
        };
      }
    }
  }, [currentView]);

  // Handle browser back navigation from orders view - use history-based navigation
  useEffect(() => {
    if (currentView === "orders") {
      // Listen for popstate events (browser back button, Android back, iOS swipe)
      const handlePopState = (event: PopStateEvent) => {
        // When back button is pressed from orders view, use history-based navigation
        if (currentView === "orders") {
          event.preventDefault();
          event.stopPropagation();
          
          // Use history-based back navigation
          const previousView = navigateBack();
          setCurrentView(previousView);
          window.history.replaceState({}, "", "/app");
        }
      };
      
      // Also intercept history.back() calls
      const originalBack = window.history.back;
      window.history.back = function() {
        if (currentView === "orders") {
          const previousView = navigateBack();
          setCurrentView(previousView);
          window.history.replaceState({}, "", "/app");
          return;
        }
        return originalBack.call(window.history);
      };
      
      // Use capture phase to handle event before other handlers
      window.addEventListener('popstate', handlePopState, { capture: true });
      
      return () => {
        window.removeEventListener('popstate', handlePopState, { capture: true });
        window.history.back = originalBack;
      };
    }
  }, [currentView, navigateBack]);

  // Handle browser back navigation from challenges view - use history-based navigation
  useEffect(() => {
    if (currentView === "challenges") {
      // Listen for popstate events (browser back button, Android back, iOS swipe)
      const handlePopState = (event: PopStateEvent) => {
        // When back button is pressed from challenges view, use history-based navigation
        if (currentView === "challenges") {
          event.preventDefault();
          event.stopPropagation();
          
          // Use history-based back navigation
          const previousView = navigateBack();
          setCurrentView(previousView);
          window.history.replaceState({}, "", "/app");
        }
      };
      
      // Also intercept history.back() calls
      const originalBack = window.history.back;
      window.history.back = function() {
        if (currentView === "challenges") {
          const previousView = navigateBack();
          setCurrentView(previousView);
          window.history.replaceState({}, "", "/app");
          return;
        }
        return originalBack.call(window.history);
      };
      
      // Use capture phase to handle event before other handlers
      window.addEventListener('popstate', handlePopState, { capture: true });
      
      return () => {
        window.removeEventListener('popstate', handlePopState, { capture: true });
        window.history.back = originalBack;
      };
    }
  }, [currentView, navigateBack]);

  // Intercept navigation when menu view is active to keep URL at /app
  useEffect(() => {
    if (currentView === "menu") {
      // Always keep URL at /app
      if (window.location.pathname !== "/app" && !window.location.pathname.startsWith("/dish/")) {
        window.history.replaceState({}, "", "/app");
      }
      
      // Continuously ensure URL stays at /app (except for dish pages)
      const urlCheckInterval = setInterval(() => {
        if (window.location.pathname !== "/app" && !window.location.pathname.startsWith("/dish/")) {
          window.history.replaceState({}, "", "/app");
        }
      }, 100);
      
      return () => {
        clearInterval(urlCheckInterval);
      };
    }
  }, [currentView]);

  // Listen for menu search focus changes to hide bottom nav when keyboard is open
  useEffect(() => {
    const handleMenuSearchFocusChange = (event: CustomEvent<{ isFocused: boolean }>) => {
      setShouldHideBottomNav(event.detail.isFocused);
    };

    window.addEventListener('menuSearchFocusChange', handleMenuSearchFocusChange as EventListener);
    
    return () => {
      window.removeEventListener('menuSearchFocusChange', handleMenuSearchFocusChange as EventListener);
    };
  }, []);

  // Reset shouldHideBottomNav when navigating away from menu
  useEffect(() => {
    if (currentView !== 'menu') {
      setShouldHideBottomNav(false);
    }
  }, [currentView]);

  // Hide BottomNavigation from HomeScreen, CartPage, FavoritesPage, MenuListingPage, ProfilePage, and OrdersPage
  useEffect(() => {
    const hideDuplicateBottomNav = () => {
      const allBottomNavs = document.querySelectorAll('[class*="fixed"][class*="bottom"][class*="border-t"]');
      // Keep only the last one (our AppPage navigation)
      if (allBottomNavs.length > 1) {
        for (let i = 0; i < allBottomNavs.length - 1; i++) {
          (allBottomNavs[i] as HTMLElement).style.display = 'none';
        }
      }
    };
    
    // Check periodically
    const interval = setInterval(hideDuplicateBottomNav, 100);
    
    return () => clearInterval(interval);
  }, [currentView]);

  return (
    <div className="min-h-screen">
      {/* Conditionally render HomeScreen, CartPage, FavoritesPage, MenuListingPage, ProfilePage, or OrdersPage */}
      {currentView === "home" && (
        <HomeScreen />
      )}
      
      {currentView === "cart" && (
        <div style={{ display: "block" }}>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-center">Loading cart...</div></div>}>
            <CartPage />
          </Suspense>
        </div>
      )}

      {currentView === "favorites" && (
        <div style={{ display: "block" }}>
          <FavoritesPage />
        </div>
      )}

      {currentView === "menu" && (
        <MenuWrapper category={menuCategory}>
          <MenuListingPage initialSearchQuery={menuSearchQuery} />
        </MenuWrapper>
      )}

      {currentView === "profile" && (
        <div style={{ display: "block" }}>
          <ProfilePage />
        </div>
      )}

      {currentView === "orders" && (
        <div style={{ display: "block" }}>
          <OrdersPage />
        </div>
      )}

      {currentView === "challenges" && (
        <div style={{ display: "block" }}>
          <CodingChallengesPage />
        </div>
      )}

      {/* Single BottomNavigation for AppPage - hide when menu search is focused */}
      {!shouldHideBottomNav && (
        <BottomNavigation currentPage={getCurrentPage()} onNavigate={handleNavigation} />
      )}
      
      {/* Exit app toast notification (Android) */}
      {showExitToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
            <span className="font-medium">Press back again to exit</span>
          </div>
        </div>
      )}
    </div>
  );
}


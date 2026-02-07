import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation, Router } from "wouter";
import HomeScreen from "./HomeScreen";
const CartPage = lazy(() => import("./CartPage"));
import FavoritesPage from "./FavoritesPage";
import MenuListingPage from "@/components/menu/MenuListingPage";
import ProfilePage from "@/components/profile/ProfilePage";
import OrdersPage from "@/components/orders/OrdersPage";
import CodingChallengesPage from "./CodingChallengesPage";
import FloatingCart from "@/components/cart/FloatingCart";
import { useNavigationHistory, type NavigationView } from "@/hooks/useNavigationHistory";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@shared/schema";
import CanteenSelectorPage from "./CanteenSelectorPage";
import { useCanteenContext } from "@/contexts/CanteenContext";

type ViewType = "home" | "cart" | "favorites" | "menu" | "profile" | "orders" | "challenges" | "selector";

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

    return [location, customSetLocation];
  };

  return (
    <Router hook={useCustomLocation as any}>
      {children}
    </Router>
  );
}

export default function AppPage() {
  const { selectedCanteen } = useCanteenContext();
  const [, setLocation] = useLocation(); // Keep for redirecting out of app
  // Removed internal location state usage for view management in favor of manual URL updates

  // Helper to get params from URL
  const getParams = () => {
    if (typeof window === 'undefined') return { view: 'selector' as ViewType, category: 'all', search: '', activateSearch: false, canteenId: null };
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    // Validate view param to ensure it matches ViewType
    const validViews: ViewType[] = ["home", "cart", "favorites", "menu", "profile", "orders", "challenges", "selector"];
    const view = (validViews.includes(viewParam as ViewType) ? viewParam as ViewType : 'selector');

    return {
      view,
      category: params.get('category') || 'all',
      search: params.get('search') || '',
      activateSearch: params.get('activateSearch') === 'true',
      canteenId: params.get('canteenId')
    };
  };

  // Initial state from URL
  const initialParams = getParams();

  // State now just mirrors URL for reactivity, but source of truth is URL
  const [currentView, setCurrentView] = useState<ViewType>(initialParams.view);
  const [menuCategory, setMenuCategory] = useState<string>(initialParams.category);
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>(initialParams.search);
  const [activateHomeSearch, setActivateHomeSearch] = useState<boolean>(initialParams.activateSearch);

  const { navigateTo, navigateBack, history, navigateToWithCurrent } = useNavigationHistory(initialParams.view as NavigationView);
  const [showExitToast, setShowExitToast] = useState(false);
  const { user } = useAuth();

  // Ref to track current view
  const currentViewRef = useRef<ViewType>(currentView);

  // Update state when URL changes (popstate or manual change)
  useEffect(() => {
    const handleUrlChange = () => {
      const params = getParams();
      // Only update if changed to avoid loops
      if (params.view !== currentViewRef.current) {
        setCurrentView(params.view);
      }
      setMenuCategory(params.category);
      setMenuSearchQuery(params.search);
      setActivateHomeSearch(params.activateSearch);
    };

    window.addEventListener('popstate', handleUrlChange);
    // Also listen to a custom event for pushState/replaceState if we wrapped them, 
    // but for now we'll just update state where we update URL.

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Sync ref
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Sync Canteen Selection with URL
  // If URL has canteenId, ensure it matches context (prioritize URL for deep linking)
  const { setSelectedCanteen, availableCanteens } = useCanteenContext();

  useEffect(() => {
    const params = getParams();
    if (params.canteenId && availableCanteens.length > 0) {
      if (!selectedCanteen || selectedCanteen.id !== params.canteenId) {
        const canteenFromUrl = availableCanteens.find(c => c.id === params.canteenId);
        if (canteenFromUrl) {
          console.log("Restoring canteen from URL:", canteenFromUrl.name);
          setSelectedCanteen(canteenFromUrl);
        }
      }
    } else if (selectedCanteen && !params.canteenId) {
      // If context has canteen but URL doesn't, we should ideally update URL, 
      // but let's do that via the updateUrl helper to avoid loops
    }
  }, [availableCanteens, selectedCanteen?.id]);


  // Helper to update URL
  const updateUrl = (view: ViewType, extraParams: Record<string, string> = {}, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);

    // Clear old specific params
    url.searchParams.delete('category');
    url.searchParams.delete('search');
    url.searchParams.delete('activateSearch');

    // Persist canteenId if it exists in extraParams or current context
    // Priority: extraParams > context (to handle immediate navigation after selection)
    if (extraParams.canteenId) {
      url.searchParams.set('canteenId', extraParams.canteenId);
    } else if (selectedCanteen?.id) {
      url.searchParams.set('canteenId', selectedCanteen.id);
    }

    // Set new params
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const newUrl = `${window.location.pathname}?${url.searchParams.toString()}`;

    if (replace) {
      window.history.replaceState({}, "", newUrl);
    } else {
      window.history.pushState({}, "", newUrl);
    }

    // Sync local state immediately
    setCurrentView(view);
    if (extraParams.category) setMenuCategory(extraParams.category);
    if (extraParams.search) setMenuSearchQuery(extraParams.search);
    if (extraParams.activateSearch) setActivateHomeSearch(extraParams.activateSearch === 'true');
  };

  // Redirect delivery persons
  useEffect(() => {
    if (user && user.role === UserRole.DELIVERY_PERSON) {
      console.log('🚚 Delivery person detected in AppPage, redirecting to delivery portal');
      setLocation('/delivery-portal');
      return;
    }
  }, [user, setLocation]);

  // Check user on mount
  useEffect(() => {
    const checkUser = () => {
      const cachedUserStr = localStorage.getItem('user');
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr);
          if (cachedUser && cachedUser.role === UserRole.DELIVERY_PERSON) {
            setLocation('/delivery-portal');
          }
        } catch (e) { }
      }
    };
    checkUser();
  }, [setLocation]);

  // Restore Profile check
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath === "/app") {
      const fromProfile = sessionStorage.getItem('navigationFrom') === 'profile';
      if (fromProfile && currentView !== 'profile') {
        sessionStorage.removeItem('navigationFrom');
        // Simple restore
        updateUrl('profile');
      }
    }
  }, []);

  // ~~~~~ Navigation Handlers ~~~~~

  const handleNavigation = (view: ViewType, canteenId?: string) => {
    navigateTo(view);
    // Determine if we need to set any default params for specific views
    const params: Record<string, string> = {};
    if (view === 'menu') params.category = 'all';
    if (canteenId) params.canteenId = canteenId;

    updateUrl(view, params);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleCategoryChange = (e: CustomEvent) => {
      const category = e.detail?.category || "all";
      // Update URL with new category, keeping view as menu
      updateUrl('menu', { category });
    };

    const handleNavigateBack = () => {
      const previousView = navigateBack();
      // When going back, we should ideally pop state, but since our internal history 
      // is separate from browser history (sometimes), we simulate it.
      // Ideally, simple history.back() would work if we pushed state correctly.
      // For now, we sync the URL to the calculated previous view.
      updateUrl(previousView, {}, true); // Replace to not clutter history further? Or push? 
      // Actually, if user hit browser back, we invoke this? No, this is for in-app back button.
      // If in-app back button, we likely want to go back in browser history if it matches?
      // Let's just update URL to match the view we want to show.

      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNavigateToCart = () => {
      navigateTo("cart");
      updateUrl("cart");
    };

    const handleNavigateToOrders = () => {
      if (currentView === "orders") return;
      navigateToWithCurrent("orders", currentView as NavigationView);
      updateUrl("orders");
    };

    const handleNavigateToFavorites = () => {
      if (currentView === "favorites") return;
      navigateToWithCurrent("favorites", currentView as NavigationView);
      updateUrl("favorites");
    };

    const handleNavigateToMenu = (e: CustomEvent) => {
      const category = e.detail?.category || "all";
      const search = e.detail?.search || "";
      const normalizedCategory = category === "all" ? "all" : category.toLowerCase();

      const params: Record<string, string> = { category: normalizedCategory };
      if (search) params.search = search;

      updateUrl("menu", params);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleEnsureProfileInHistory = () => {
      // With URL params, browser history naturally handles this if we pushState appropriately.
      // However, useNavigationHistory hook is still used for the custom back button logic.
      const lastHistoryView = history.length > 0 ? history[history.length - 1].view : null;
      if (lastHistoryView !== 'profile' && currentView === 'profile') {
        navigateTo("profile");
        // URL is already profile if currentView is profile
      }
    };

    const handleNavigateToProfile = () => {
      const fromNotifications = sessionStorage.getItem('navigationFrom') === 'profile';
      if (fromNotifications) {
        sessionStorage.removeItem('navigationFrom');
        // Logic to maybe just replace state if we just came back
      }
      navigateTo("profile");
      updateUrl("profile");
    };

    const handleNavigateToChallenges = () => {
      navigateToWithCurrent("challenges", currentView as NavigationView);
      updateUrl("challenges");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNavigateHome = () => {
      navigateTo("home");
      updateUrl("home");
    };

    const handleNavigateHomeWithSearch = () => {
      navigateTo("home");
      updateUrl("home", { activateSearch: 'true' });
    };

    window.addEventListener('appMenuCategoryChange' as any, handleCategoryChange);
    window.addEventListener('appNavigateToMenu' as any, handleNavigateToMenu);
    window.addEventListener('appNavigateBack' as any, handleNavigateBack);
    window.addEventListener('appNavigateHome' as any, handleNavigateHome);
    window.addEventListener('appNavigateToCart' as any, handleNavigateToCart);
    window.addEventListener('appNavigateToOrders' as any, handleNavigateToOrders);
    window.addEventListener('appNavigateToFavorites' as any, handleNavigateToFavorites);
    window.addEventListener('appNavigateToProfile' as any, handleNavigateToProfile);
    window.addEventListener('appNavigateToChallenges' as any, handleNavigateToChallenges);
    window.addEventListener('appEnsureProfileInHistory' as any, handleEnsureProfileInHistory);
    window.addEventListener('appNavigateHomeWithSearch' as any, handleNavigateHomeWithSearch);

    return () => {
      window.removeEventListener('appMenuCategoryChange' as any, handleCategoryChange);
      window.removeEventListener('appNavigateToMenu' as any, handleNavigateToMenu);
      window.removeEventListener('appNavigateBack' as any, handleNavigateBack);
      window.removeEventListener('appNavigateHome' as any, handleNavigateHome);
      window.removeEventListener('appNavigateToCart' as any, handleNavigateToCart);
      window.removeEventListener('appNavigateToOrders' as any, handleNavigateToOrders);
      window.removeEventListener('appNavigateToFavorites' as any, handleNavigateToFavorites);
      window.removeEventListener('appNavigateToProfile' as any, handleNavigateToProfile);
      window.removeEventListener('appNavigateToChallenges' as any, handleNavigateToChallenges);
      window.removeEventListener('appEnsureProfileInHistory' as any, handleEnsureProfileInHistory);
      window.removeEventListener('appNavigateHomeWithSearch' as any, handleNavigateHomeWithSearch);
    };
  }, [navigateTo, navigateBack, history, currentView]);


  // ~~~~~ Logic to prevent leaving /app or handling special back cases ~~~~~

  // Handle browser back navigation and intercept goToHome from MenuListingPage
  useEffect(() => {
    // Replaced the interval check with just reacting to popstate in the first useEffect
    // Removal of aggressive URL masking allows refreshing on specific views.

    // Logic for intercepting internal menu routing
    if (currentView === "menu") {
      // If the internal router inside MenuWrapper tries to go to IDLE path (rare with this new setup), handled by wrapper.
    }
  }, [currentView]);

  // Handle back navigation - iOS/Android specific overrides
  // We keep the touch blocking for iOS PWA but remove history hacks that might conflict with URL params
  useEffect(() => {
    if (currentView === "home") {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      // For iOS PWA: Block left-to-right swipe gesture on home page
      if (isIOS && isPWA) {
        // Touch tracking for swipe prevention
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwipeBlocked = false;
        let hasMoved = false;
        const EDGE_THRESHOLD = 30;

        const handleTouchStart = (e: TouchEvent) => {
          if (e.touches.length > 0) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            hasMoved = false;
            if (touchStartX < EDGE_THRESHOLD) {
              isSwipeBlocked = true;
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

          if (Math.abs(deltaX) > 0 || deltaY > 0) hasMoved = true;

          if (touchStartX < EDGE_THRESHOLD) {
            if (deltaX > 0) {
              e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
              isSwipeBlocked = true;
              return;
            }
            if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 3) {
              e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
              isSwipeBlocked = true;
              return;
            }
          }
          if (currentX < EDGE_THRESHOLD && deltaX > 0) {
            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
            isSwipeBlocked = true;
          }
        };

        const handleTouchEnd = (e: TouchEvent) => {
          if (isSwipeBlocked && hasMoved) {
            e.preventDefault(); e.stopPropagation();
          }
          isSwipeBlocked = false; hasMoved = false;
        };

        const handleTouchCancel = () => { isSwipeBlocked = false; hasMoved = false; };

        document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        document.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: false });
        window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        window.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: false });

        return () => {
          document.removeEventListener('touchstart', handleTouchStart, { capture: true });
          document.removeEventListener('touchmove', handleTouchMove, { capture: true });
          document.removeEventListener('touchend', handleTouchEnd, { capture: true });
          document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
          window.removeEventListener('touchstart', handleTouchStart, { capture: true });
          window.removeEventListener('touchmove', handleTouchMove, { capture: true });
          window.removeEventListener('touchend', handleTouchEnd, { capture: true });
          window.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
        };
      }
    }
  }, [currentView]);


  return (
    <div
      className="min-h-screen bg-background overflow-x-hidden"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {currentView === "selector" && (
        <CanteenSelectorPage
          onCanteenSelect={(canteenId) => {
            handleNavigation("home", canteenId);
          }}
        />
      )}

      {currentView === "home" && (
        <HomeScreen
          activateSearch={activateHomeSearch}
          onSearchDeactivated={() => setActivateHomeSearch(false)}
          onNavigateBack={() => handleNavigation('selector')}
        />
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

      {/* Floating Cart - shown on home and menu views */}
      {currentView === "menu" && (
        <FloatingCart />
      )}

      {/* Exit app toast notification (Android) */}
      {showExitToast && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-4 duration-300">
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


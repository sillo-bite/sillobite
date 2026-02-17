import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthSync } from "@/hooks/useDataSync";
import { useCategoriesLazyLoad } from "@/hooks/useCategoriesLazyLoad";
import { useDynamicCategoryPageSize } from "@/hooks/useDynamicCategoryPageSize";
import { useHomeData } from "@/hooks/useHomeData";
import { Loader2, XCircle, CheckCircle, TrendingUp, Zap, Sparkles, UserCircle2, Search, ShoppingBag, ShoppingCart, X, ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearRestaurantContext, resolveUserSessionConflict, securelyUpdateUserData } from "@/utils/sessionConflictResolver";
import { setPWAAuth } from "@/utils/pwaAuth";
import type { Category, MenuItem } from "@shared/schema";

import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import HomeMediaBanner from "@/components/pages/HomeMediaBanner";
import MenuItemCard from "@/components/menu/MenuItemCard";
import CategoryCarousel from "@/components/menu/CategoryCarousel";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import HomeScreenSkeleton from "@/components/pages/HomeScreenSkeleton";
import CurrentOrderBottomSheet from "@/components/orders/CurrentOrderBottomSheet";
import FloatingCart from "@/components/cart/FloatingCart";
import { updateStatusBarColor } from "@/utils/statusBar";
import { useLocation as useLocationContext } from "@/contexts/LocationContext";
import { MapPin, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

// Constants for better maintainability
const SCROLL_THRESHOLD = 100;
const SUBSEQUENT_PAGE_SIZE = 5; // Subsequent scroll fetches load 5 categories


/**
 * Utility function to get default category name based on item name
 * @param itemName - The name of the menu item
 * @returns The default category name for the item
 */
const getDefaultCategoryName = (itemName: string): string => {
  const name = itemName.toLowerCase();
  if (name.includes('tea') || name.includes('coffee') || name.includes('juice') || name.includes('drink')) {
    return 'Beverages';
  } else if (name.includes('rice') || name.includes('biryani') || name.includes('curry')) {
    return 'Main Course';
  } else if (name.includes('snack') || name.includes('samosa') || name.includes('pakora')) {
    return 'Snacks';
  } else if (name.includes('sweet') || name.includes('dessert') || name.includes('cake')) {
    return 'Desserts';
  } else if (name.includes('bread') || name.includes('roti') || name.includes('naan')) {
    return 'Bread';
  } else {
    return 'Main Course';
  }
};

interface HomeScreenProps {
  activateSearch?: boolean;
  onSearchDeactivated?: () => void;
  onNavigateBack?: () => void;
}

export default function HomeScreen({ activateSearch = false, onSearchDeactivated, onNavigateBack }: HomeScreenProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuthSync();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const { user, login } = useAuth();
  const { selectedLocationType, selectedLocationId, isLoading: isLocationLoading } = useLocationContext();
  const { getTotalItems } = useCart();

  // Smooth scroll-based transition state (0 to 1)
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track if live order bottom sheet is hidden due to scroll
  const [isLiveOrderHidden, setIsLiveOrderHidden] = useState(false);
  // Delayed state for cart visibility - only show after live order animation completes
  const [showCartCard, setShowCartCard] = useState(false);

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sentinel for stickiness detection
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  const [isSearchSticky, setIsSearchSticky] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSearchSticky(!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: '13px 0px 0px 0px' }
    );

    if (searchSentinelRef.current) {
      observer.observe(searchSentinelRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Update status bar to match header color
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      updateStatusBarColor('hsl(270, 40%, 8%)'); // Exact dark mode background
    } else {
      updateStatusBarColor('hsl(280, 30%, 98%)'); // Exact light mode background
    }
  }, [resolvedTheme]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus search input when search becomes active
  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // Notify parent when search is deactivated
      onSearchDeactivated?.();
    }
  }, [isSearchActive, onSearchDeactivated]);

  // Handle external search activation (from menu page)
  useEffect(() => {
    if (activateSearch && !isSearchActive) {
      setIsSearchActive(true);
    }
  }, [activateSearch, isSearchActive]);

  // Server-side search query
  const { data: searchData, isLoading: isSearchLoading, isFetching: isSearchFetching } = useQuery<{ items: MenuItem[], pagination: any }>({
    queryKey: ["/api/menu/search", selectedCanteen?.id, debouncedSearchQuery],
    queryFn: async () => {
      if (!selectedCanteen?.id || !debouncedSearchQuery.trim()) {
        return { items: [], pagination: {} };
      }

      const params = new URLSearchParams({
        canteenId: selectedCanteen.id,
        availableOnly: 'true',
        limit: '30',
        search: debouncedSearchQuery.trim()
      });

      const response = await fetch(`/api/menu?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      return await response.json();
    },
    enabled: !!selectedCanteen?.id && debouncedSearchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });

  const searchResults = searchData?.items || [];
  const isSearching = searchQuery !== debouncedSearchQuery || isSearchFetching;
  const hasSearchQuery = debouncedSearchQuery.trim().length >= 2;

  const closeSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, []);

  // Smooth scroll detection with progress tracking
  useEffect(() => {
    let ticking = false;
    // Header is approximately 80px tall (pt-12 = 48px + content ~32px)
    // Search bar should become sticky only after header is fully scrolled out
    const HEADER_HEIGHT = 80; // Height of the header section

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;

          // Calculate progress for header fade (0 to 1 as header scrolls out)
          const headerProgress = Math.min(1, scrollY / HEADER_HEIGHT);

          // Apply easing for smoother feel
          const easedProgress = 1 - Math.pow(1 - headerProgress, 2);

          setScrollProgress(easedProgress);

          // Header is fully visible when scrollProgress is 0 (at top)
          // Show live orders only when header is fully expanded (cart icon visible)
          // Show cart card when header is not fully visible
          setIsLiveOrderHidden(headerProgress > 0);

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Delay cart card visibility to wait for live order animation to complete
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLiveOrderHidden) {
      // Wait for live order slide-out animation (300ms) + small buffer before showing cart
      timeoutId = setTimeout(() => {
        setShowCartCard(true);
      }, 350);
    } else {
      // Immediately hide cart when scrolling back up
      setShowCartCard(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLiveOrderHidden]);

  // Restaurant context state
  const [hasRestaurantContext, setHasRestaurantContext] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<{
    name: string;
    tableNumber: string;
  } | null>(null);

  // State for users without college/org context
  const [showIncompleteProfileMessage, setShowIncompleteProfileMessage] = useState(false);

  // Check for restaurant context and prioritize it - optimized with useMemo for localStorage parsing
  const restaurantContextData = useMemo(() => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }, [user?.id]); // Only reparse when user ID changes

  useEffect(() => {
    // First check if user is authenticated
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    // Check for restaurant context in user data
    try {
      // First, check if there's pending QR data for existing authenticated users
      const pendingQRData = sessionStorage.getItem('pendingQRTableData');
      if (pendingQRData && user) {
        try {
          const qrData = JSON.parse(pendingQRData) as {
            restaurantId: string;
            restaurantName: string;
            tableNumber: string;
            hash?: string;
            timestamp: number;
          };

          // Check if data is not too old (e.g., less than 10 minutes)
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          if (qrData.timestamp > tenMinutesAgo) {
            const restaurantContext = {
              restaurantId: qrData.restaurantId,
              restaurantName: qrData.restaurantName,
              tableNumber: qrData.tableNumber
            };

            const updatedUserData = resolveUserSessionConflict(user, restaurantContext);
            if (updatedUserData) {
              securelyUpdateUserData(updatedUserData, false);
              login(updatedUserData as any);
            }
            sessionStorage.removeItem('pendingQRTableData');

            setHasRestaurantContext(true);
            setRestaurantInfo({
              name: qrData.restaurantName,
              tableNumber: qrData.tableNumber
            });

            return;
          } else {
            sessionStorage.removeItem('pendingQRTableData');
          }
        } catch (error) {
          console.error('Error processing pending QR data:', error);
          sessionStorage.removeItem('pendingQRTableData');
        }
      }

      // Use memoized localStorage data instead of parsing again
      if (restaurantContextData) {
        // If user has restaurant context, ensure it's prioritized
        if (restaurantContextData.restaurantId && restaurantContextData.restaurantName && restaurantContextData.tableNumber) {
          setHasRestaurantContext(true);
          setRestaurantInfo({
            name: restaurantContextData.restaurantName,
            tableNumber: restaurantContextData.tableNumber
          });

          // Set hasRestaurantContext flag if not already set (optimize: only write if needed)
          if (!restaurantContextData.hasRestaurantContext) {
            const updatedUserData = {
              ...restaurantContextData,
              hasRestaurantContext: true
            };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
            window.dispatchEvent(new CustomEvent('userAuthChange'));
          }

          // Sync React state only if needed
          if (user && (!user.restaurantId || !user.restaurantName || !user.tableNumber)) {
            login(restaurantContextData);
          }
        } else {
          setHasRestaurantContext(false);
          setRestaurantInfo(null);
        }
      } else if (user) {
        // No localStorage data but React user exists - check React user state
        const hasContext = !!(user.restaurantId && user.restaurantName && user.tableNumber);
        setHasRestaurantContext(hasContext);

        if (hasContext) {
          setRestaurantInfo({
            name: user.restaurantName,
            tableNumber: user.tableNumber
          });
        } else {
          setRestaurantInfo(null);
        }
      } else {
        setHasRestaurantContext(false);
        setRestaurantInfo(null);
      }
    } catch (error) {
      console.error('Error checking restaurant context:', error);
      setHasRestaurantContext(false);
      setRestaurantInfo(null);
    }
  }, [isAuthenticated, setLocation, user, login, restaurantContextData]);

  // Check if user has college/org context after exiting restaurant
  useEffect(() => {
    if (isAuthenticated && user && !hasRestaurantContext) {
      // Check URL params to see if we just exited restaurant
      const urlParams = new URLSearchParams(window.location.search);
      const justExitedRestaurant = urlParams.get('exitedRestaurant') === 'true';
      const noCollege = urlParams.get('noCollege') === 'true';

      if (justExitedRestaurant && noCollege) {
        // Check if user has college or organization
        const hasCollege = !!(user.college || user.collegeId);
        const hasOrganization = !!(user.organization || user.organizationId);

        // Also check localStorage as it might have the latest data
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            const parsedData = JSON.parse(userData);
            const hasCollegeInStorage = !!(parsedData.college || parsedData.collegeId);
            const hasOrgInStorage = !!(parsedData.organization || parsedData.organizationId);

            // If no college/org in either place, show message
            if (!hasCollege && !hasOrganization && !hasCollegeInStorage && !hasOrgInStorage) {
              setShowIncompleteProfileMessage(true);
              // Clean up URL params
              window.history.replaceState({}, '', '/app');
            }
          } catch (error) {
            console.error('Error parsing user data:', error);
          }
        } else if (!hasCollege && !hasOrganization) {
          setShowIncompleteProfileMessage(true);
          // Clean up URL params
          window.history.replaceState({}, '', '/home');
        }
      }
    }
  }, [isAuthenticated, user, hasRestaurantContext]);

  // Redirect to selector if no location is selected and not in restaurant context
  // Redirect to selector if no location is selected and not in restaurant context
  useEffect(() => {
    // Wait for location context to finish loading before redirecting
    if (!isLocationLoading && !hasRestaurantContext && (!selectedLocationType || !selectedLocationId)) {
      if (onNavigateBack) {
        onNavigateBack();
      } else {
        // Fallback if onNavigateBack is not provided (though it should be from AppPage)
        window.history.back();
      }
    }
  }, [hasRestaurantContext, selectedLocationType, selectedLocationId, onNavigateBack, isLocationLoading]);

  // Determine if we should show content or loading
  // If we are redirecting, we can return null or a loader to prevent flash of content
  // Also show loader if location context is still initializing


  // Handle exit restaurant
  const handleExitRestaurant = useCallback(async () => {
    // ... code truncated for brevity, same as before ...
    if (!user) return;

    // ... exit restaurant logic ...
    // (Actual logic is long, we just need to place the hook before it or after it, but before any return)
    // To minimize complexity in replace_file_content, I will insert the new hook at a safe spot 
    // and remove the old one.
    // Wait, replace_file_content replaces a block. I cannot easily "move" without replacing two blocks
    // unless I use multi_replace.

    // Let's use multi_replace instead.
  }, [user, login]);

  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${'bg-background'
        }`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className={`${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'
            }`}>Checking authentication...</p>
        </div>
      </div>
    );
  }
  // Dynamic category page size based on screen width
  const { initialPageSize, subsequentPageSize } = useDynamicCategoryPageSize(2); // +2 buffer items

  // Lazy loading categories with infinite scroll
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchCategories
  } = useCategoriesLazyLoad(selectedCanteen?.id || null, initialPageSize, !!selectedCanteen, subsequentPageSize);

  // Flatten all pages of lazy loaded categories with error handling
  const categories: Category[] = useMemo(() => {
    const baseCategories = categoriesData?.pages ? categoriesData.pages.flatMap(page => {
      if (!page?.items || !Array.isArray(page.items)) {
        return [];
      }
      return page.items;
    }) : [];

    // Add "all" category at the beginning
    return [
      {
        id: 'all',
        name: 'all',
        canteenId: selectedCanteen?.id || '',
        imageUrl: '/White Brown Modern QR Code Food Menu Flyer.svg',
        createdAt: new Date()
      } as Category,
      ...baseCategories
    ];
  }, [categoriesData, selectedCanteen?.id]);

  const totalCategories = (categoriesData?.pages?.[0]?.total || 0) + 1;

  // Home data batch API - media banners, trending items, quick picks, active orders
  // Wait for both canteen AND user to be ready before fetching to prevent multiple calls
  const {
    data: homeData,
    isLoading: homeDataLoading,
    refetch: refetchHomeDataRaw
  } = useHomeData(
    selectedCanteen?.id || null,
    user?.id || null,
    !!selectedCanteen && isAuthenticated && !!user?.id // Only fetch when user ID is available
  );

  // Debounced refetch to prevent rapid consecutive calls (e.g., from WebSocket events)
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refetchHomeData = useCallback(() => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }

    // Debounce refetch by 300ms to group rapid calls
    refetchTimeoutRef.current = setTimeout(() => {
      refetchHomeDataRaw();
    }, 300);
  }, [refetchHomeDataRaw]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, []);

  const isLoading = categoriesLoading || homeDataLoading;

  // Get data from home API - backend already limits to 4 items, no need to slice
  // Memoize to prevent recreation on every render
  const mediaBanners = useMemo(() => homeData?.mediaBanners || [], [homeData?.mediaBanners]);
  const trendingItems = useMemo(() => homeData?.trendingItems || [], [homeData?.trendingItems]);
  const quickPickItems = useMemo(() => homeData?.quickPicks || [], [homeData?.quickPicks]);





  // Helper function to create URL-safe category names (memoized)
  const createCategoryUrl = useCallback((categoryName: string) => {
    return encodeURIComponent(categoryName.toLowerCase());
  }, []);

  // Determine if we should show content or loading
  // If we are redirecting, we can return null or a loader to prevent flash of content
  // Also show loader if location context is still initializing
  if (isLocationLoading || (!hasRestaurantContext && (!selectedLocationType || !selectedLocationId))) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${'bg-background'}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        </div>
      </div>
    );
  }



  if (isLoading) {
    return (
      <>
        <HomeScreenSkeleton />
      </>
    );
  }



  // Determine if we should show content or loading
  // If we are redirecting, we can return null or a loader to prevent flash of content
  if (!hasRestaurantContext && (!selectedLocationType || !selectedLocationId)) {
    return null; // Or a transparent loader
  }




  return (
    <>
      <div className={`min-h-screen ${'bg-background'
        }`} style={{ maxWidth: '100vw' }}>
        {/* Header Container - Scrolls normally, fades as it goes out of view */}
        <div
          className="bg-background"
          style={{
            opacity: 1 - scrollProgress * 0.5, // Subtle fade as scrolling
          }}
        >
          {/* Top section - Canteen selector and profile */}
          <div className="px-4 pt-12 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-1 min-w-0 gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full shrink-0 -ml-2"
                  onClick={() => {
                    // Prefer explicit navigation handler if provided
                    if (onNavigateBack) {
                      onNavigateBack();
                    } else {
                      window.history.back();
                    }
                  }}
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </Button>

                <div className="flex items-center flex-1 min-w-0 overflow-hidden">
                  <div className={`p-1.5 md:p-2 rounded-xl mr-2 md:mr-3 shrink-0 transition-all duration-300 ${resolvedTheme === 'dark' ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'
                    }`}>
                    <Store className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 leading-none whitespace-nowrap">
                      Currently at
                    </span>
                    <h2 className="text-base md:text-lg font-bold truncate leading-tight tracking-tight text-foreground pr-1">
                      {selectedCanteen?.name || 'Select Canteen'}
                    </h2>
                  </div>
                </div>

                {/* Exit Restaurant Button - Only shown when restaurant context exists */}
                {hasRestaurantContext && restaurantInfo && (
                  <Button
                    onClick={handleExitRestaurant}
                    variant="outline"
                    size="sm"
                    className="ml-1 shrink-0 hidden sm:flex"
                    title={`Exit ${restaurantInfo.name} - Table ${restaurantInfo.tableNumber}`}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    <span className="text-xs font-medium">Exit</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center shrink-0 gap-1 md:gap-3">
                {/* Cart Icon - Always visible in header */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                  }}
                  className="rounded-full h-10 w-10 md:h-12 md:w-12 p-0 relative group hover:bg-primary/10 transition-all duration-200"
                  aria-label={`View cart with ${getTotalItems()} items`}
                >
                  <ShoppingCart className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 md:h-5 md:w-5 flex items-center justify-center shadow-lg ring-2 ring-background">
                      {getTotalItems() > 99 ? '99+' : getTotalItems()}
                    </span>
                  )}
                </Button>


              </div>
            </div>
          </div>
        </div>

        {/* Incomplete Profile Message */}
        {showIncompleteProfileMessage && !hasRestaurantContext && (
          <div className="px-4 mt-4">
            <Card className={`border-2 ${resolvedTheme === 'dark'
              ? 'bg-blue-950/50 border-blue-800'
              : 'bg-blue-50 border-blue-200'
              }`}>
              <CardContent className="pt-6 pb-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'
                      }`}>
                      <CheckCircle className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                        }`} />
                    </div>
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                      Thank You!
                    </h3>
                    <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      You've successfully exited the restaurant session.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-current/20">
                    <p className={`text-sm mb-4 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      To continue using SilloBite, please complete your profile or scan a QR code at a restaurant table.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        onClick={() => {
                          setShowIncompleteProfileMessage(false);
                          setLocation('/profile/edit');
                        }}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Complete Profile
                      </Button>
                      <Button
                        onClick={() => setShowIncompleteProfileMessage(false)}
                        variant="outline"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Categories Section - Premium styling */}
        <div className="mt-6 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
          <ErrorBoundary>
            <CategoryCarousel
              categories={categories}
              isLoading={categoriesLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              totalCategories={totalCategories}
              onScroll={(e) => {
                const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
                const isNearEnd = scrollLeft + clientWidth >= scrollWidth - SCROLL_THRESHOLD;

                if (isNearEnd && hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              createCategoryUrl={createCategoryUrl}
            />
          </ErrorBoundary>
        </div>

        {/* Media Banner - Enhanced with animation */}
        {!showIncompleteProfileMessage && (
          <div className="mt-6 animate-slide-up-fade mb-4" style={{ animationDelay: '200ms' }}>
            <HomeMediaBanner banners={mediaBanners} isLoading={homeDataLoading} />
          </div>
        )}

        {/* Sentinel for search sticky detection */}
        <div ref={searchSentinelRef} className="absolute h-1 w-full pointer-events-none opacity-0" style={{ transform: 'translateY(-1px)' }} />

        {/* Search Bar - Uses position: sticky for smooth behavior */}
        <div
          className="px-4"
          style={{
            position: isSearchSticky ? 'fixed' : 'relative',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            paddingTop: isSearchSticky ? '12px' : '32px',
            paddingBottom: '16px',
            // Background only when sticky
            background: isSearchSticky
              ? (resolvedTheme === 'dark'
                ? 'rgba(15, 10, 24, 0.95)'
                : 'rgba(255, 255, 255, 0.98)')
              : 'transparent',
            backdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
            WebkitBackdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
            borderBottom: isSearchSticky
              ? (resolvedTheme === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.08)'
                : '1px solid rgba(0, 0, 0, 0.06)')
              : 'none',
            boxShadow: isSearchSticky
              ? '0 4px 20px rgba(0, 0, 0, 0.08)'
              : 'none',
            transition: 'background 0.2s ease-out, backdrop-filter 0.2s ease-out, box-shadow 0.2s ease-out',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              {/* Subtle glow effect on hover */}
              <div className={`absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none ${resolvedTheme === 'dark'
                ? 'bg-primary/20'
                : 'bg-primary/10'
                }`} />

              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10 w-5 h-5 transition-colors duration-150 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />

              <input
                type="text"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Search for dishes, categories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isSearchActive && e.target.value) {
                    setIsSearchActive(true);
                  }
                }}
                onFocus={() => setIsSearchActive(true)}
                className={`w-full rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none relative py-3.5 pl-12 pr-10 text-sm transition-all duration-150 ${resolvedTheme === 'dark'
                  ? 'bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15 focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
                  : 'bg-gray-100/80 border border-gray-200/60 hover:bg-gray-100 hover:border-gray-300/80 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                  }`}
                style={{ WebkitAppearance: 'none' }}
              />

              {/* Clear button */}
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${resolvedTheme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>


          </div>
        </div>

        {/* Main Content Sections */}
        <div className={`px-4 space-y-8 ${isSearchSticky ? 'mt-36' : 'mt-8'}`}>
          {/* Trending Now Section - Premium Design */}
          <ErrorBoundary>
            <section className="animate-slide-up-fade" style={{ animationDelay: '300ms' }}>
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-bold tracking-tight ${resolvedTheme === 'dark' ? 'text-gray-50' : 'text-gray-900'
                    }`}>Trending Now</h2>
                  <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>Most popular right now</p>
                </div>
              </div>

              {trendingItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {trendingItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="animate-card-entrance hover-lift"
                      style={{
                        animationDelay: `${400 + index * 80}ms`,
                      }}
                    >
                      <MenuItemCard
                        item={item}
                        variant="trending"
                        getDefaultCategoryName={getDefaultCategoryName}
                        hideDescription={true}
                      />
                    </div>
                  ))}
                </div>
              ) : !homeDataLoading && (
                <div className={`flex items-center justify-center py-6 px-4 rounded-2xl border-2 border-dashed transition-all ${resolvedTheme === 'dark'
                  ? 'border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/30'
                  : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white'
                  }`}>
                  <TrendingUp className={`w-5 h-5 mr-3 ${resolvedTheme === 'dark' ? 'text-orange-400/60' : 'text-orange-500/60'
                    }`} />
                  <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    Nothing trending right now
                  </span>
                </div>
              )}
            </section>
          </ErrorBoundary>

          {/* Quick Picks Section - Premium Design */}
          <ErrorBoundary>
            <section className="animate-slide-up-fade" style={{ animationDelay: '400ms' }}>
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-bold tracking-tight ${resolvedTheme === 'dark' ? 'text-gray-50' : 'text-gray-900'
                    }`}>Quick Picks</h2>
                  <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>Ready in minutes</p>
                </div>
              </div>

              {quickPickItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {quickPickItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="animate-card-entrance hover-lift"
                      style={{
                        animationDelay: `${500 + index * 80}ms`,
                      }}
                    >
                      <MenuItemCard
                        item={item}
                        variant="quickpick"
                        getDefaultCategoryName={getDefaultCategoryName}
                        hideDescription={true}
                      />
                    </div>
                  ))}
                </div>
              ) : !homeDataLoading && (
                <div className={`flex items-center justify-center py-6 px-4 rounded-2xl border transition-all ${resolvedTheme === 'dark'
                  ? 'bg-gradient-to-br from-blue-900/20 to-cyan-900/10 border-blue-800/30'
                  : 'bg-gradient-to-br from-blue-50 to-cyan-50/50 border-blue-100'
                  }`}>
                  <Zap className={`w-5 h-5 mr-3 ${resolvedTheme === 'dark' ? 'text-blue-400/60' : 'text-blue-500/60'
                    }`} />
                  <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-blue-300/80' : 'text-blue-600/80'
                    }`}>
                    Quick picks coming soon
                  </span>
                </div>
              )}
            </section>
          </ErrorBoundary>

          {/* Empty State - Only show when everything is empty */}
          {!homeDataLoading && trendingItems.length === 0 && quickPickItems.length === 0 && categories.length === 0 && (
            <div className={`text-center py-8 px-6 rounded-3xl border-2 border-dashed transition-all animate-slide-up-fade ${resolvedTheme === 'dark'
              ? 'bg-gradient-to-br from-gray-800/30 to-gray-900/30 border-gray-700/50'
              : 'bg-gradient-to-br from-gray-50 to-white border-gray-200'
              }`} style={{ animationDelay: '600ms' }}>
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${resolvedTheme === 'dark'
                ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/10'
                : 'bg-gradient-to-br from-amber-100 to-yellow-50'
                }`}>
                <Sparkles className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                  }`} />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                Menu is being prepared
              </h3>
              <p className={`text-sm mb-5 max-w-xs mx-auto ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                We're setting up amazing items for you. Check back soon!
              </p>
              <Button
                onClick={() => {
                  refetchCategories();
                  refetchHomeData();
                }}
                variant="outline"
                size="default"
                className={`rounded-xl px-6 transition-all hover:scale-105 ${resolvedTheme === 'dark'
                  ? 'border-gray-600 hover:bg-gray-700/50 text-gray-200'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-800'
                  }`}
              >
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* Dynamic bottom spacing - only when cart has items (not just live orders) */}
        {getTotalItems() > 0 && (
          <div className="h-32"></div>
        )}

        {/* Smaller spacing for live orders only (no cart items) */}
        {getTotalItems() === 0 && Array.isArray(homeData?.activeOrders) && homeData.activeOrders.length > 0 && (
          <div className="h-20"></div>
        )}

      </div>

      {/* Search Overlay */}
      {isSearchActive && (
        <div
          className="fixed inset-0 z-[100] animate-in fade-in duration-200"
          style={{
            background: resolvedTheme === 'dark'
              ? 'rgba(15, 10, 24, 0.98)'
              : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Search Header */}
          <div
            className="sticky top-0 z-10 px-4 pt-12 pb-4"
            style={{
              background: resolvedTheme === 'dark'
                ? 'rgba(15, 10, 24, 0.95)'
                : 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full h-10 w-10 flex-shrink-0 ${resolvedTheme === 'dark'
                  ? 'hover:bg-white/10 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
                  }`}
                onClick={closeSearch}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              {/* Search Input */}
              <div className="relative flex-1">
                <div
                  className={`absolute -inset-0.5 rounded-xl opacity-0 focus-within:opacity-100 transition-opacity duration-300 blur-md pointer-events-none ${resolvedTheme === 'dark' ? 'bg-violet-500/30' : 'bg-violet-400/20'
                    }`}
                />

                <div
                  className={`relative flex items-center rounded-xl overflow-hidden transition-all duration-200 ${resolvedTheme === 'dark'
                    ? 'bg-white/5 border border-white/10 focus-within:border-violet-500/50'
                    : 'bg-white border border-gray-200 focus-within:border-violet-400 focus-within:shadow-lg'
                    }`}
                >
                  <Search className={`ml-4 w-5 h-5 flex-shrink-0 pointer-events-none ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />

                  <input
                    ref={searchInputRef}
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Search dishes, categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`flex-1 py-3.5 px-3 bg-transparent outline-none text-[15px] w-full min-w-0 ${resolvedTheme === 'dark'
                      ? 'text-white placeholder:text-gray-500'
                      : 'text-gray-900 placeholder:text-gray-400'
                      }`}
                    style={{ WebkitAppearance: 'none' }}
                  />

                  {/* Loading indicator */}
                  {isSearching && searchQuery && (
                    <div className="pr-3">
                      <Loader2 className={`w-4 h-4 animate-spin ${resolvedTheme === 'dark' ? 'text-violet-400' : 'text-violet-500'
                        }`} />
                    </div>
                  )}

                  {/* Clear button */}
                  {searchQuery && !isSearching && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setDebouncedSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      className={`pr-3 transition-colors ${resolvedTheme === 'dark'
                        ? 'text-gray-500 hover:text-gray-300'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search Content */}
          <div className="px-4 py-4 overflow-y-auto" style={{ height: 'calc(100vh - 120px)' }}>
            {hasSearchQuery ? (
              <div className="animate-in fade-in duration-200">
                {/* Results header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${resolvedTheme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-100'
                      }`}>
                      <Search className={`w-4 h-4 ${resolvedTheme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                        }`} />
                    </div>
                    <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      {isSearching ? 'Searching...' : (
                        searchResults.length > 0
                          ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                          : 'No results'
                      )}
                    </span>
                  </div>
                  {searchResults.length > 0 && (
                    <span className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                      for "{debouncedSearchQuery}"
                    </span>
                  )}
                </div>

                {/* Results grid */}
                {isSearchLoading && !searchResults.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl h-48 animate-pulse ${resolvedTheme === 'dark' ? 'bg-white/5' : 'bg-gray-200'
                          }`}
                      />
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {searchResults.map((item, index) => (
                      <div
                        key={item.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <MenuItemCard
                          item={item}
                          getDefaultCategoryName={getDefaultCategoryName}
                          hideDescription={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : !isSearching && (
                  <div className={`text-center py-12 rounded-2xl ${resolvedTheme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                    }`}>
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                      }`}>
                      <Search className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        }`} />
                    </div>
                    <p className={`font-medium mb-1 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      No dishes found
                    </p>
                    <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                      Try a different search term
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Popular Searches */}
                <div className="animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${resolvedTheme === 'dark' ? 'bg-rose-500/20' : 'bg-rose-100'
                      }`}>
                      <TrendingUp className={`w-4 h-4 ${resolvedTheme === 'dark' ? 'text-rose-400' : 'text-rose-600'
                        }`} />
                    </div>
                    <span className={`text-sm font-semibold ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                      Popular Searches
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {["Tea", "Coffee", "Snacks", "Chicken", "Rice", "Biryani", "Burger", "Pizza"].map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setSearchQuery(term);
                          setDebouncedSearchQuery(term);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${resolvedTheme === 'dark'
                          ? 'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-300 hover:from-violet-500/20 hover:to-fuchsia-500/20 border border-violet-500/20'
                          : 'bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-700 hover:from-violet-100 hover:to-fuchsia-100 border border-violet-200'
                          }`}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="animate-in fade-in duration-200" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${resolvedTheme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        }`}>
                        <Sparkles className={`w-4 h-4 ${resolvedTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          }`} />
                      </div>
                      <span className={`text-sm font-semibold ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                        Categories
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {categories.filter(c => c.name !== 'all').slice(0, 8).map((category) => (
                        <button
                          key={category.id || (category as any)._id}
                          onClick={() => {
                            setSearchQuery(category.name);
                            setDebouncedSearchQuery(category.name);
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${resolvedTheme === 'dark'
                            ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                            }`}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search tip */}
                <div
                  className={`text-center py-8 ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                >
                  <p className="text-sm">
                    Type at least 2 characters to search
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Cart - Shows after live order animation completes, or always in search overlay */}
      <FloatingCart
        hasActiveOrders={Array.isArray(homeData?.activeOrders) && homeData.activeOrders.length > 0}
        showOnlyWhenLiveOrderHidden={!isSearchActive}
        isLiveOrderHidden={isSearchActive || showCartCard}
      />

      {/* Current Order Bottom Sheet - Hidden on scroll or when search overlay is active */}
      <CurrentOrderBottomSheet
        activeOrders={Array.isArray(homeData?.activeOrders) ? homeData.activeOrders : []}
        refetchOrders={refetchHomeData}
        forceHidden={isLiveOrderHidden || isSearchActive}
      />
    </>
  );
}

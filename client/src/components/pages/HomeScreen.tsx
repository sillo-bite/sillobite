import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthSync } from "@/hooks/useDataSync";
import { useCategoriesLazyLoad } from "@/hooks/useCategoriesLazyLoad";
import { useHomeData } from "@/hooks/useHomeData";
import { ChefHat, Loader2, Bell, X, XCircle, CheckCircle, TrendingUp, Zap, Sparkles, Flame, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearRestaurantContext, resolveUserSessionConflict, securelyUpdateUserData } from "@/utils/sessionConflictResolver";
import { setPWAAuth } from "@/utils/pwaAuth";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import type { MenuItem, Category } from "@shared/schema";
import { CanteenSelector } from "@/components/canteen/CanteenSelector";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import HomeMediaBanner from "@/components/pages/HomeMediaBanner";
import MenuItemCard from "@/components/menu/MenuItemCard";
import CategoryCarousel from "@/components/menu/CategoryCarousel";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import HomeScreenSkeleton from "@/components/pages/HomeScreenSkeleton";
import NotificationPanel from "@/components/common/NotificationPanel";
import { useNotificationContext } from "@/contexts/NotificationContext";
import CurrentOrderBottomSheet from "@/components/orders/CurrentOrderBottomSheet";
import { updateStatusBarColor } from "@/utils/statusBar";

// Constants for better maintainability
const SCROLL_THRESHOLD = 100;
const ANIMATION_DELAY = 50; // Reduced from 100ms to 50ms for faster perceived load
const CATEGORIES_PAGE_SIZE = 5;


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

export default function HomeScreen() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuthSync();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const { user, login } = useAuth();

  // Update status bar to match header color
  useEffect(() => {
    updateStatusBarColor('#DC2626'); // bg-red-600
  }, []);

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
            securelyUpdateUserData(updatedUserData, false);
            login(updatedUserData);
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
  
  // Handle exit restaurant
  const handleExitRestaurant = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch fresh user data from server to get original college/org context
      console.log('🔄 Fetching user data from server to restore college/org context...');
      // Use cache-busting for this specific case since we need fresh data when exiting restaurant
      const userResponse = await fetch(`/api/users/by-email/${user.email}`, {
        cache: 'no-cache' // Force fresh data when exiting restaurant context
      });
      
      if (userResponse.ok) {
        const serverUserData = await userResponse.json();
        
        // Check if user has college or organization associated
        const hasCollege = !!(serverUserData.college || serverUserData.collegeId);
        const hasOrganization = !!(serverUserData.organization || serverUserData.organizationId);
        
        // Clear restaurant context from user data
        const updatedUserData = clearRestaurantContext(user);
        
        // Restore college/organization data from server if available
        if (hasCollege || hasOrganization) {
          // Merge server data with current user data, excluding restaurant context
          const restoredUserData = {
            ...updatedUserData,
            college: serverUserData.college || updatedUserData.college,
            collegeId: serverUserData.collegeId || updatedUserData.collegeId,
            collegeName: serverUserData.collegeName || updatedUserData.collegeName,
            organization: serverUserData.organization || updatedUserData.organization,
            organizationId: serverUserData.organizationId || updatedUserData.organizationId,
            organizationName: serverUserData.organizationName || updatedUserData.organizationName,
            department: serverUserData.department || updatedUserData.department,
          };
          
          // Update user data
          localStorage.setItem('user', JSON.stringify(restoredUserData));
          setPWAAuth(restoredUserData);
          login(restoredUserData);
          
          console.log('✅ Restored college/org context:', {
            college: restoredUserData.college,
            organization: restoredUserData.organization
          });
          
          // Refresh the page to ensure all components reflect the change
          window.location.href = '/app';
        } else {
          // User has no college/org - show incomplete profile message
          console.log('⚠️ User has no college or organization associated');
          
          // Update user data without college/org
          localStorage.setItem('user', JSON.stringify(updatedUserData));
          setPWAAuth(updatedUserData);
          login(updatedUserData);
          
          // Show message asking to complete profile or scan QR
          // Redirect with query param to show message after reload
          window.location.href = '/app?exitedRestaurant=true&noCollege=true';
        }
        
        // Update local state
        setHasRestaurantContext(false);
        setRestaurantInfo(null);
      } else {
        // If server fetch fails, just clear restaurant context
        const updatedUserData = clearRestaurantContext(user);
        login(updatedUserData);
        
        // Check if current user data has college/org
        const hasCollege = !!(user.college || user.collegeId);
        const hasOrganization = !!(user.organization || user.organizationId);
        
        if (!hasCollege && !hasOrganization) {
          // Redirect with query param to show message
          window.location.href = '/app?exitedRestaurant=true&noCollege=true';
        } else {
          window.location.href = '/app';
        }
        
        setHasRestaurantContext(false);
        setRestaurantInfo(null);
      }
    } catch (error) {
      console.error('Error exiting restaurant:', error);
      
      // Fallback: just clear restaurant context
      try {
        const updatedUserData = clearRestaurantContext(user);
        login(updatedUserData);
        setHasRestaurantContext(false);
        setRestaurantInfo(null);
        window.location.href = '/app';
      } catch (fallbackError) {
        alert('Failed to exit restaurant. Please try again.');
      }
    }
  }, [user, login]);

  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        'bg-background'
      }`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className={`${
            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'
          }`}>Checking authentication...</p>
        </div>
      </div>
    );
  }
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Use real notification context
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications
  } = useNotificationContext();
  
  // Calculate unread count once to avoid redundant filtering
  const unreadNotificationsCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );


  // Lazy loading categories with infinite scroll
  const { 
    data: categoriesData, 
    isLoading: categoriesLoading, 
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchCategories
  } = useCategoriesLazyLoad(selectedCanteen?.id || null, CATEGORIES_PAGE_SIZE, !!selectedCanteen);

  // Flatten all pages of lazy loaded categories with error handling
  const categories: Category[] = useMemo(() => {
    if (!categoriesData?.pages) return [];
    return categoriesData.pages.flatMap(page => {
      if (!page?.items || !Array.isArray(page.items)) {
        return [];
      }
      return page.items;
    });
  }, [categoriesData]);
  
  const totalCategories = categoriesData?.pages?.[0]?.total || 0;

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


  // Notification handlers
  const handleToggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  const handleMarkAsRead = useCallback((id: string) => {
    markAsRead(id);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    clearAllNotifications();
  }, [clearAllNotifications]);

  // Get data from home API - backend already limits to 4 items, no need to slice
  // Memoize to prevent recreation on every render
  const mediaBanners = useMemo(() => homeData?.mediaBanners || [], [homeData?.mediaBanners]);
  const trendingItems = useMemo(() => homeData?.trendingItems || [], [homeData?.trendingItems]);
  const quickPickItems = useMemo(() => homeData?.quickPicks || [], [homeData?.quickPicks]);





  // Helper function to create URL-safe category names (memoized)
  const createCategoryUrl = useCallback((categoryName: string) => {
    return encodeURIComponent(categoryName.toLowerCase());
  }, []);



  if (isLoading) {
    return (
      <>
        <HomeScreenSkeleton />
        <BottomNavigation currentPage="home" />
      </>
    );
  }

  return (
    <>
      <div className={`min-h-screen overflow-x-hidden ${
        'bg-background'
      }`} style={{ maxWidth: '100vw' }}>
        {/* Header Container */}
        <div className="bg-red-600 rounded-b-2xl shadow-xl overflow-hidden">
          {/* Top section - Canteen selector, exit restaurant button, and notifications */}
          <div className="px-4 pt-12 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CanteenSelector />
                {/* Exit Restaurant Button - Only shown when restaurant context exists */}
                {hasRestaurantContext && restaurantInfo && (
                  <Button
                    onClick={handleExitRestaurant}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 ml-2"
                    title={`Exit ${restaurantInfo.name} - Table ${restaurantInfo.tableNumber}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    <span className="text-xs font-medium">Exit {restaurantInfo.name}</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {/* Streak and XP - Only show if coding challenges are enabled */}
                {homeData?.codingChallengesEnabled && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('appNavigateToChallenges', {}));
                    }}
                    className="flex items-center space-x-2 px-3 py-2 rounded-full hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/10"
                    aria-label="View Coding Challenges"
                  >
                    <div className="flex items-center space-x-1">
                      <Flame className="w-5 h-5 text-white" />
                      <span className="text-white text-sm font-semibold">7</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy className="w-4 h-4 text-yellow-300" />
                      <span className="text-white text-sm font-medium">1,250</span>
                    </div>
                  </button>
                )}
                <button
                  onClick={handleToggleNotifications}
                  className="relative p-2 rounded-full hover:bg-white/5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/10"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                >
                  <Bell className="w-5 h-5 text-white" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>

      {/* Incomplete Profile Message */}
      {showIncompleteProfileMessage && !hasRestaurantContext && (
        <div className="px-4 mt-4">
          <Card className={`border-2 ${
            resolvedTheme === 'dark' 
              ? 'bg-blue-950/50 border-blue-800' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <CardContent className="pt-6 pb-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    resolvedTheme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'
                  }`}>
                    <CheckCircle className={`w-8 h-8 ${
                      resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                    }`} />
                  </div>
                </div>
                <div>
                  <h3 className={`text-xl font-bold mb-2 ${
                    resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    Thank You!
                  </h3>
                  <p className={`text-sm ${
                    resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    You've successfully exited the restaurant session.
                  </p>
                </div>
                <div className="pt-2 border-t border-current/20">
                  <p className={`text-sm mb-4 ${
                    resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    To continue using Sillobyte, please complete your profile or scan a QR code at a restaurant table.
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

      {/* Media Banner */}
      {!showIncompleteProfileMessage && (
        <div className="mt-4">
          <HomeMediaBanner banners={mediaBanners} isLoading={homeDataLoading} />
        </div>
      )}

      {/* Categories - Edge to Edge */}
      <div className="mt-4">
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

      <div className="px-4 space-y-4 mt-4">
        {/* Trending Now */}
        <ErrorBoundary>
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <h2 className={`text-lg font-semibold ${
                resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
              }`}>Trending Now</h2>
            </div>
            {trendingItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 pb-2">
                {trendingItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${index * ANIMATION_DELAY}ms`,
                      animationFillMode: 'forwards'
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
              <div className={`flex items-center justify-center py-3 px-3 rounded-xl border-2 border-dashed ${
                resolvedTheme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50'
              }`}>
                <TrendingUp className={`w-4 h-4 mr-2 flex-shrink-0 ${
                  resolvedTheme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                }`} />
                <span className={`text-xs font-medium ${
                  resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Nothing trending right now
                </span>
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Quick Picks */}
        <ErrorBoundary>
          <div className="animate-slide-up">
            <div className="mb-2">
              <h2 className={`text-lg font-semibold ${
                resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
              }`}>Quick Picks</h2>
            </div>
            {quickPickItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 pb-[60px]">
                {quickPickItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="animate-slide-up"
                    style={{
                      animationDelay: `${index * ANIMATION_DELAY}ms`,
                      animationFillMode: 'forwards'
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
              <div className={`flex items-center justify-center py-3 px-3 rounded-lg border ${
                resolvedTheme === 'dark' ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-200'
              }`}>
                <Zap className={`w-4 h-4 mr-2 flex-shrink-0 ${
                  resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <span className={`text-xs font-medium ${
                  resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  Quick picks coming soon
                </span>
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Empty State - Only show when everything is empty */}
        {!homeDataLoading && trendingItems.length === 0 && quickPickItems.length === 0 && categories.length === 0 && (
          <div className={`text-center py-6 px-4 rounded-xl border ${
            resolvedTheme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className={`w-4 h-4 flex-shrink-0 ${
                resolvedTheme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`} />
              <p className={`text-sm font-medium ${
                resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Menu is being prepared
              </p>
            </div>
            <p className={`text-xs mb-3 max-w-xs mx-auto ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              We're setting up amazing items for you. Check back soon!
            </p>
            <Button 
              onClick={() => {
                refetchCategories();
                refetchHomeData();
              }}
              variant="outline"
              size="sm"
              className={`${
                resolvedTheme === 'dark' 
                  ? 'border-gray-600 hover:bg-gray-700 text-gray-200' 
                  : 'border-gray-300 hover:bg-gray-100 text-gray-800'
              }`}
            >
              Refresh
            </Button>
          </div>
        )}
      </div>

      </div>
      
      {/* Bottom spacing for bottom sheet - bottom sheet height + visible gap */}
      {/* Bottom sheet height: ~4.5rem + Visible gap: 1rem + Extra: 2.25rem (36px) = ~7.75rem */}
      <div className="pb-[calc(7.75rem+env(safe-area-inset-bottom))]"></div>
      
      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={handleCloseNotifications}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAll}
      />
      
      {/* Current Order Bottom Sheet - Only shows on home page */}
      <CurrentOrderBottomSheet 
        activeOrders={Array.isArray(homeData?.activeOrders) ? homeData.activeOrders : []} 
        refetchOrders={refetchHomeData}
      />
      
      <BottomNavigation currentPage="home" />
    </>
  );
}
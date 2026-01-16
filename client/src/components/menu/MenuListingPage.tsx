import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCategoriesLazyLoad } from "@/hooks/useCategoriesLazyLoad";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Loader2, Leaf, Heart, Search, X, Minus, Star } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import CategoryIcon from "@/components/ui/CategoryIcon";
import type { MenuItem, Category } from "@shared/schema";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useReducedMotion } from "@/utils/dropdownAnimations";
import MenuListingPageSkeleton from "./MenuListingPageSkeleton";
import { updateStatusBarColor } from "@/utils/statusBar";

interface MenuListingPageProps {
  initialSearchQuery?: string;
}

export default function MenuListingPage({ initialSearchQuery = "" }: MenuListingPageProps) {
  const [location, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const [, params] = useRoute("/menu/:category");
  const category = params?.category;

  // Helper function to create URL-safe category names (same as HomeScreen)
  const createCategoryUrl = useCallback((categoryName: string | undefined | null) => {
    if (!categoryName) return '';
    try {
      return encodeURIComponent(categoryName.toLowerCase());
    } catch (error) {
      console.error('Error encoding category URL:', error, categoryName);
      return categoryName.toLowerCase().replace(/\s+/g, '-');
    }
  }, []);
  const [vegOnly, setVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery);
  const { addToCart, getCartQuantity, decreaseQuantity } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const observerTarget = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  
  // Scroll threshold for horizontal scroll detection
  const SCROLL_THRESHOLD = 100;

  // Memoize user preferences parsing to prevent repeated JSON.parse
  const userPreferences = useMemo(() => {
    try {
      const savedPreferences = localStorage.getItem('userPreferences');
      if (savedPreferences) {
        return JSON.parse(savedPreferences);
      }
    } catch (error) {
      console.error('Error parsing user preferences:', error);
    }
    return {
      vegMode: false,
      appearance: 'light',
      notifications: true,
      language: 'English'
    };
  }, []); // Only parse once on mount

  // Load veg mode preference from memoized preferences
  useEffect(() => {
    setVegOnly(userPreferences.vegMode || false);
  }, [userPreferences]);

  // Listen for changes in localStorage to sync with other pages
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userPreferences' && e.newValue) {
        try {
          const preferences = JSON.parse(e.newValue);
          setVegOnly(preferences.vegMode || false);
        } catch (error) {
          console.error('Error parsing storage event preferences:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update veg mode preference in localStorage (memoized)
  const handleVegModeToggle = useCallback((checked: boolean) => {
    setVegOnly(checked);
    
    // Update localStorage with minimal parsing
    try {
      const savedPreferences = localStorage.getItem('userPreferences');
      const preferences = savedPreferences ? JSON.parse(savedPreferences) : {
        vegMode: true,
        appearance: 'light',
        notifications: true,
        language: 'English'
      };
      
      const updatedPreferences = {
        ...preferences,
        vegMode: checked
      };
      
      localStorage.setItem('userPreferences', JSON.stringify(updatedPreferences));
    } catch (error) {
      console.error('Error updating veg mode preference:', error);
    }
  }, []);




  // Fetch categories with lazy loading (5 per page, DB-level pagination)
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    fetchNextPage: fetchNextCategoriesPage,
    hasNextPage: hasNextCategoriesPage,
    isFetchingNextPage: isFetchingNextCategoriesPage
  } = useCategoriesLazyLoad(
    selectedCanteen?.id || null,
    5, // Load 5 categories per page
    !!selectedCanteen
  );

  // Flatten all category pages into a single array
  const categories = useMemo(() => {
    return categoriesData?.pages.flatMap(page => page.items) || [];
  }, [categoriesData]);

  const totalCategories = categoriesData?.pages[0]?.total || 0;

  // Helper function to safely decode category
  const safeDecodeCategory = (cat: string | undefined): string => {
    if (!cat) return '';
    try {
      return decodeURIComponent(cat).toLowerCase().trim();
    } catch (error) {
      console.error('Error decoding category:', error, cat);
      return cat.toLowerCase().trim();
    }
  };

  // Helper function to get category ID/name for API
  const getCategoryForAPI = useCallback(() => {
    if (!category || category === "all") return "all";
    if (categories.length === 0) return category; // Use the URL slug if categories aren't loaded yet
    
    const decodedCategory = safeDecodeCategory(category);
    const foundCategory = categories.find(cat => 
      cat && cat.name && cat.name.toLowerCase().trim() === decodedCategory
    );
    
    // Return the ID if found, otherwise return the original category slug
    return foundCategory?.id || foundCategory?._id || category;
  }, [category, categories]);

  // Infinite query for menu items with server-side filtering
  const {
    data: menuData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: menuItemsLoading,
    isFetching: menuItemsFetching,
    refetch
  } = useInfiniteQuery<{
    items: MenuItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>({
    queryKey: [
      '/api/menu',
      selectedCanteen?.id,
      getCategoryForAPI(),
      debouncedSearchQuery,
      vegOnly
    ],
    // Keep previous data while fetching new search results (prevents UI flickering)
    placeholderData: (previousData) => previousData,
    queryFn: async ({ pageParam = 1, signal }) => {
      const categoryIdOrName = getCategoryForAPI();
      
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '10',
        availableOnly: 'true',
        ...(selectedCanteen?.id && { canteenId: selectedCanteen.id }),
        ...(!debouncedSearchQuery && categoryIdOrName !== 'all' && { category: categoryIdOrName }),
        ...(debouncedSearchQuery && { search: debouncedSearchQuery }),
        ...(vegOnly && { vegOnly: 'true' })
      });
      
      const response = await fetch(`/api/menu?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch menu items: ${response.status}`);
      }
      return await response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage 
        ? lastPage.pagination.currentPage + 1 
        : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes for menu items
    gcTime: 1000 * 60 * 10, // 10 minutes - cache search results longer
    enabled: !!selectedCanteen,
    // Retry configuration for failed requests
    retry: (failureCount, error: any) => {
      // Don't retry if request was aborted (user typed more)
      if (error?.name === 'AbortError') return false;
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });

  // Flatten all pages into a single array
  const menuItems = menuData?.pages.flatMap(page => page.items) || [];

  const isLoading = categoriesLoading || menuItemsLoading;
  const isSearching = menuItemsFetching && debouncedSearchQuery.length > 0;

  // Utility function to get default category name
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

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // All filtering is now done server-side, so menuItems is already filtered
  // Memoize to prevent unnecessary renders
  const filteredItems = useMemo(() => menuItems, [menuItems]);

  // Reset scroll position when category or search changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category, debouncedSearchQuery, vegOnly]);

  // Memoized handlers to prevent re-renders
  const handleBackClick = useCallback(() => {
    // Check if we're on /app page - if so, use custom event to navigate within AppPage
    if (location === '/app' || window.location.pathname === '/app') {
      // Dispatch event to AppPage to switch to home view
      window.dispatchEvent(new CustomEvent('appNavigateHome', {}));
    } else {
      // If not on /app, use normal navigation
      goToHome();
    }
    // Dispatch custom event to navigate back using history
    window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
    setLocation("/app");
  }, [location, goToHome, setLocation]);

  const handleAddToCart = useCallback((item: MenuItem) => {
    // Check if canteen is selected before adding to cart
    if (!selectedCanteen?.id) {
      return;
    }
    
    // Validate counter IDs are present (REQUIRED)
    if (!item.storeCounterId || !item.paymentCounterId) {
      console.error('❌ Menu item missing counter IDs:', {
        itemId: item.id || (item as any)._id,
        itemName: item.name,
        storeCounterId: item.storeCounterId,
        paymentCounterId: item.paymentCounterId,
        fullItem: item
      });
      alert(`Error: Counter IDs are missing for "${item.name}". Please refresh the page and try again.`);
      return;
    }
    
    addToCart({
      id: item.id || (item as any)._id || '',
      name: item.name,
      price: item.price,
      isVegetarian: item.isVegetarian,
      canteenId: selectedCanteen.id,
      category: item.category || (item as any).categoryName,
      description: item.description,
      storeCounterId: item.storeCounterId,
      paymentCounterId: item.paymentCounterId
    });
  }, [selectedCanteen?.id, addToCart]);
  
  const handleCategoryClick = useCallback((categoryName: string) => {
    setLocation(`/menu/${createCategoryUrl(categoryName)}`);
  }, [setLocation, createCategoryUrl]);
  
  const handleAllCategoryClick = useCallback(() => {
    setLocation("/menu/all");
  }, [setLocation]);
  
  const handleDishClick = useCallback((itemId: string, from: string) => {
    setLocation(`/dish/${itemId}`, { state: { from } });
  }, [setLocation]);
  
  const handleCategoriesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
    const isNearEnd = scrollLeft + clientWidth >= scrollWidth - SCROLL_THRESHOLD;
    
    if (isNearEnd && hasNextCategoriesPage && !isFetchingNextCategoriesPage) {
      fetchNextCategoriesPage();
    }
  }, [hasNextCategoriesPage, isFetchingNextCategoriesPage, fetchNextCategoriesPage]);

  // Memoize category display name to prevent re-computation
  const categoryDisplayName = useMemo(() => {
    if (category === "all") return "All";
    const decodedCategory = safeDecodeCategory(category);
    const foundCategory = categories.find(cat => cat && cat.name && cat.name.toLowerCase().trim() === decodedCategory);
    if (foundCategory && foundCategory.name) return foundCategory.name;
    // Fallback: try to decode and display category name
    try {
      return category ? decodeURIComponent(category).replace(/%20/g, ' ') : 'Menu';
    } catch {
      return category || 'Menu';
    }
  }, [category, categories]);

  // Update status bar to match header color
  useEffect(() => {
    updateStatusBarColor('#724491'); // purple primary color
  }, []);

  // Show skeleton while loading
  if (isLoading) {
    return (
      <>
        <MenuListingPageSkeleton />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header Container */}
        <div className="bg-[#724491] rounded-b-2xl shadow-xl overflow-hidden">
          {/* Top section - Back button, title, and veg toggle */}
          <div className="px-4 pt-12 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBackClick} 
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold capitalize text-white">
                  {categoryDisplayName}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="veg-toggle"
                  variant="green"
                  checked={vegOnly}
                  onCheckedChange={handleVegModeToggle}
                  className="shadow-lg shadow-black/20"
                />
                <Label htmlFor="veg-toggle" className="flex items-center space-x-1 cursor-pointer hidden sm:flex text-white">
                  <Leaf className="w-4 h-4 text-green-400" />
                  <span>Veg Only</span>
                </Label>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative pb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
              <Input
                placeholder="Search food..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-10 pr-10 h-10 rounded-full focus:bg-white/20 transition-all border-none focus:ring-1 focus:ring-white/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Categories - Native Horizontal Scrollable with Lazy Loading */}
      <div>
        <div 
          ref={categoriesScrollRef}
          className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4 px-4 py-4"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch', 
            touchAction: 'pan-x' 
          }}
          onScroll={handleCategoriesScroll}
        >
          <button
            key="all"
            onClick={handleAllCategoryClick}
            className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all duration-200 ${
              category === "all" 
                ? "bg-[#724491] text-white shadow-lg" 
                : resolvedTheme === 'dark' 
                  ? "bg-black text-gray-200 hover:bg-gray-900 border border-gray-800" 
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat, index) => {
            // Normalize category names for comparison
            const decodedCategory = safeDecodeCategory(category);
            const catNameNormalized = cat?.name?.toLowerCase().trim() || '';
            const isActive = decodedCategory === catNameNormalized;
            
            if (!cat || !cat.name) return null;
            
            return (
              <button
                key={cat.id || (cat as any)._id || `category-${cat.name}`}
                onClick={() => handleCategoryClick(cat.name)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all duration-200 dropdown-item ${
                  isActive
                    ? "bg-[#724491] text-white shadow-lg" 
                    : resolvedTheme === 'dark' 
                      ? "bg-black text-gray-200 hover:bg-gray-900 border border-gray-800" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                } ${prefersReducedMotion ? '' : 'animate-dropdown-stagger'}`}
                style={{
                  animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
                }}
              >
                <CategoryIcon category={cat} size="md" />
                {cat.name}
              </button>
            );
          })}
          
          {/* Loading indicator for next page of categories */}
          {isFetchingNextCategoriesPage && (
            <div className="flex-shrink-0 flex items-center justify-center w-[100px]">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-4">
          {/* Show skeleton when searching */}
          {isSearching ? (
            <>
              {Array.from({ length: 3 }).map((_, index) => (
                <Card 
                  key={`skeleton-${index}`}
                  className={`${
                    resolvedTheme === 'dark' ? 'bg-card' : 'bg-card'
                  } rounded-2xl shadow-lg border-0 overflow-hidden animate-pulse`}
                >
                  <CardContent className="p-0">
                    <div className="w-full relative aspect-[21/9] overflow-hidden">
                      <div className={`absolute inset-0 overflow-hidden rounded-t-2xl ${
                        resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                        <div className={`w-full h-full flex items-center justify-center ${
                          resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          <span className="text-5xl opacity-50">🔍</span>
                        </div>
                      </div>
                    </div>
                    <div className={`${
                      resolvedTheme === 'dark' ? 'bg-card' : 'bg-card'
                    } relative`} style={{ 
                      marginTop: '-12px', 
                      borderRadius: '0 0 0.75rem 0.75rem'
                    }}>
                      <div className="px-3 pt-3 pb-3">
                        <div className={`h-5 w-32 rounded mb-3 ${
                          resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className="flex items-center justify-between">
                          <div className={`h-5 w-16 rounded ${
                            resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                          <div className={`w-10 h-10 rounded-full ${
                            resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : filteredItems.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>
                {debouncedSearchQuery 
                  ? `No items found for "${debouncedSearchQuery}"`
                  : category === "all" 
                    ? "No items available" 
                    : "No items found in this category"
                }
              </p>
            </div>
          ) : (
            <>
            {filteredItems.map((item, index) => (
              <Card 
                key={item.id || (item as any)._id || `item-${index}`} 
                className={`${
                  resolvedTheme === 'dark' 
                    ? 'bg-card hover:bg-gray-950' 
                    : 'bg-card hover:bg-gray-50'
                } rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border-0 overflow-hidden`}
                onClick={() => handleDishClick(item.id || (item as any)._id || '', `/menu/${category}`)}
              >
                <CardContent className="p-0">
                  {/* Top Section - Image with rounded corners */}
                  <div className="w-full relative aspect-[21/9] overflow-hidden">
                    <div className={`absolute inset-0 overflow-hidden rounded-t-2xl ${
                      resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`w-full h-full ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-700' 
                            : 'bg-gray-200'
                        } flex items-center justify-center`}>
                          <span className="text-5xl opacity-50">🍽️</span>
                        </div>
                      )}
                      
                      {/* Heart button - Top right corner */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite({
                            id: item.id || (item as any)._id || '',
                            name: item.name,
                            price: item.price,
                            isVegetarian: item.isVegetarian,
                            imageUrl: item.imageUrl,
                            canteenId: selectedCanteen?.id || '',
                            description: item.description
                          });
                        }}
                        className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all touch-manipulation z-10 backdrop-blur-sm ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-800/90 hover:bg-gray-700/90' 
                            : 'bg-white/95 hover:bg-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 transition-all ${
                          isFavorite(item.id || (item as any)._id || '') 
                            ? 'fill-red-500 text-red-500 scale-110' 
                            : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`} />
                      </button>
                      
                      {/* Rating badge - Bottom right on image */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-sm z-10 touch-manipulation ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-800 border border-gray-700' 
                            : 'bg-white/95 border border-gray-200 backdrop-blur-sm'
                        }`}
                      >
                        <span className={`text-sm font-bold ${
                          resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          4.8
                        </span>
                        <Star className={`w-3.5 h-3.5 ${
                          resolvedTheme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
                        } fill-current`} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Section - Content */}
                  <div className={`${
                    resolvedTheme === 'dark' ? 'bg-card' : 'bg-card'
                  } relative`} style={{ 
                    marginTop: '-12px', 
                    borderRadius: '0 0 0.75rem 0.75rem',
                    borderTopLeftRadius: '0',
                    borderTopRightRadius: '0.5rem'
                  }}>
                    <div className="px-3 pt-3 pb-3">
                      {/* Restaurant Name */}
                      <h3 className={`font-bold text-lg mb-3 ${
                        resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {item.name}
                      </h3>
                      
                      {/* Quantity Selector and Add to Cart */}
                      <div className="flex items-center justify-between">
                        <div className={`text-lg font-bold ${
                          resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          ₹{item.price}
                        </div>
                        
                        {/* Right: Add button */}
                        <div className="ml-3">
                      {getCartQuantity(item.id || (item as any)._id || '') > 0 ? (
                        <div className={`flex items-center rounded-full px-1 py-1 ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-700' 
                            : 'bg-gray-200'
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              decreaseQuantity(item.id || (item as any)._id || '');
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 ${
                              resolvedTheme === 'dark' 
                                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className={`text-base font-bold min-w-[32px] text-center px-2 ${
                              resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                            {String(getCartQuantity(item.id || (item as any)._id || '')).padStart(2, '0')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(item);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 ${
                              resolvedTheme === 'dark' 
                                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            if (!item.available || item.stock === 0) return;
                            e.stopPropagation();
                            handleAddToCart(item);
                          }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 shadow-sm ${
                            resolvedTheme === 'dark' 
                              ? 'bg-gray-700 hover:bg-gray-600 text-green-400' 
                              : 'bg-gray-200 hover:bg-gray-300 text-green-600'
                          } ${
                            !item.available || item.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={!item.available || item.stock === 0}
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Infinite scroll trigger */}
            {hasNextPage && (
              <div ref={observerTarget} className="flex justify-center py-4">
                {isFetchingNextPage ? (
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                ) : (
                  <div className="h-4" /> // Spacer for intersection observer
                )}
              </div>
            )}
            
            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            </>
          )}
        </div>

      </div>
      
      {/* Bottom spacing for floating cart */}
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]"></div>
    </>
  );
}
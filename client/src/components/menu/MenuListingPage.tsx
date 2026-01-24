import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCategoriesLazyLoad } from "@/hooks/useCategoriesLazyLoad";
import { useDynamicCategoryPageSize } from "@/hooks/useDynamicCategoryPageSize";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Loader2, Leaf, Heart, Search, Minus, Star } from "lucide-react";
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

  // Helper function to create URL-safe category names
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
  }, []);

  // Load veg mode preference
  useEffect(() => {
    setVegOnly(userPreferences.vegMode || false);
  }, [userPreferences]);

  // Listen for changes in localStorage
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

  // Handler to navigate to home with search activated
  const handleSearchClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('appNavigateHomeWithSearch', {}));
  }, []);

  // Update veg mode preference in localStorage
  const handleVegModeToggle = useCallback((checked: boolean) => {
    setVegOnly(checked);
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

  // Dynamic category page size
  const { initialPageSize, subsequentPageSize } = useDynamicCategoryPageSize(2);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    fetchNextPage: fetchNextCategoriesPage,
    hasNextPage: hasNextCategoriesPage,
    isFetchingNextPage: isFetchingNextCategoriesPage
  } = useCategoriesLazyLoad(
    selectedCanteen?.id || null,
    initialPageSize,
    !!selectedCanteen,
    subsequentPageSize
  );

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

  const getCategoryForAPI = useCallback(() => {
    if (!category || category === "all") return "all";
    if (categories.length === 0) return category;
    const decodedCategory = safeDecodeCategory(category);
    const foundCategory = categories.find(cat =>
      cat && cat.name && cat.name.toLowerCase().trim() === decodedCategory
    );
    return foundCategory?.id || category;
  }, [category, categories]);

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
      vegOnly
    ],
    placeholderData: (previousData) => previousData,
    queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) => {
      const categoryIdOrName = getCategoryForAPI();
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '10',
        availableOnly: 'true',
        ...(selectedCanteen?.id && { canteenId: selectedCanteen.id }),
        ...(categoryIdOrName !== 'all' && { category: categoryIdOrName }),
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    enabled: !!selectedCanteen,
    retry: (failureCount, error: any) => {
      if (error?.name === 'AbortError') return false;
      return failureCount < 2;
    },
  });

  const menuItems = menuData?.pages.flatMap(page => page.items) || [];
  const isLoading = categoriesLoading || menuItemsLoading;

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

  const filteredItems = useMemo(() => menuItems, [menuItems]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category, vegOnly]);

  const handleBackClick = useCallback(() => {
    if (location === '/app' || window.location.pathname === '/app') {
      window.dispatchEvent(new CustomEvent('appNavigateHome', {}));
    } else {
      goToHome();
    }
    window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
    setLocation("/app");
  }, [location, goToHome, setLocation]);

  const handleAddToCart = useCallback((item: MenuItem) => {
    if (!selectedCanteen?.id) return;
    if (!item.storeCounterId || !item.paymentCounterId) {
      console.error('❌ Menu item missing counter IDs:', { item });
      alert(`Error: Counter IDs are missing for "${item.name}". Please refresh the page and try again.`);
      return;
    }
    addToCart({
      id: item.id || (item as any)._id || '',
      name: item.name,
      price: item.price,
      isVegetarian: item.isVegetarian,
      canteenId: selectedCanteen.id,
      category: item.categoryId || (item as any).categoryName,
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

  useEffect(() => {
    updateStatusBarColor(resolvedTheme === 'dark' ? '#0f0a18' : '#ffffff');
  }, [resolvedTheme]);

  if (isLoading) {
    return <MenuListingPageSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-background overflow-y-auto overflow-x-hidden"
      style={{
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${resolvedTheme === 'dark' ? 'bg-background/80' : 'bg-background/90'
          }`}
        style={{
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: resolvedTheme === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="pt-12">
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackClick}
                className={`flex-shrink-0 rounded-xl transition-all duration-200 hover-scale-subtle ${resolvedTheme === 'dark'
                  ? 'text-gray-100 hover:bg-white/10'
                  : 'text-gray-900 hover:bg-gray-100/80'
                  }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <button onClick={handleSearchClick} className="flex-1 text-left group">
                <div className="relative">
                  <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg pointer-events-none ${resolvedTheme === 'dark' ? 'bg-primary/20' : 'bg-primary/10'
                    }`} />
                  <div className={`relative pl-11 pr-4 h-11 rounded-2xl flex items-center transition-all duration-200 shadow-xl ${resolvedTheme === 'dark'
                    ? 'bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15'
                    : 'bg-white border-gray-200/60 hover:bg-gray-50 hover:border-gray-300/80'
                    }`}>
                    <Search className={`absolute left-3.5 w-4.5 h-4.5 transition-colors ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                    <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>Search dishes...</span>
                  </div>
                </div>
              </button>
              <div
                onClick={() => handleVegModeToggle(!vegOnly)}
                className={`flex-shrink-0 cursor-pointer flex items-center gap-2 px-3 pr-4 py-2 rounded-2xl border transition-all duration-300 group shadow-xl ${vegOnly
                  ? resolvedTheme === 'dark'
                    ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                    : 'bg-green-50 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                  : resolvedTheme === 'dark'
                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                    : 'bg-gray-100/80 border-gray-200/60 hover:bg-gray-100'
                  }`}
              >
                <div className={`relative w-9 h-5 rounded-full transition-colors duration-300 flex items-center px-0.5 ${vegOnly ? 'bg-green-500' : 'bg-gray-400/50'
                  }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${vegOnly ? 'translate-x-[16px]' : 'translate-x-0'
                    }`} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Leaf className={`w-3.5 h-3.5 transition-colors duration-300 ${vegOnly ? 'text-green-500 fill-green-500' : 'text-gray-500'
                    }`} />
                  <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${vegOnly
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                    }`}>Veg</span>
                </div>
              </div>
            </div>
          </div>
          <div
            ref={categoriesScrollRef}
            className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-4 px-4"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'auto'
            }}
            onScroll={handleCategoriesScroll}
          >
            <button
              key="all"
              onClick={handleAllCategoryClick}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-300 ${prefersReducedMotion ? '' : 'animate-stagger-fade'
                } ${category === "all"
                  ? "bg-primary text-white shadow-xl shadow-primary/30"
                  : resolvedTheme === 'dark'
                    ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/10 shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-lg"
                }`}
              style={{ animationDelay: '0ms' }}
            >
              All
            </button>
            {categories.map((cat, index) => {
              const decodedCategory = safeDecodeCategory(category);
              const catNameNormalized = cat?.name?.toLowerCase().trim() || '';
              const isActive = decodedCategory === catNameNormalized;
              if (!cat || !cat.name) return null;
              return (
                <button
                  key={cat.id || (cat as any)._id || `category-${cat.name}`}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-300 ${prefersReducedMotion ? '' : 'animate-stagger-fade'
                    } ${isActive
                      ? "bg-primary text-white shadow-xl shadow-primary/30"
                      : resolvedTheme === 'dark'
                        ? "bg-[#251F35] text-gray-300 hover:bg-[#2d2640] border border-white/10 shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-lg"
                    }`}
                  style={{ animationDelay: prefersReducedMotion ? '0ms' : `${(index + 1) * 40}ms` }}
                >
                  <CategoryIcon category={cat} size="md" />
                  {cat.name}
                </button>
              );
            })}
            {isFetchingNextCategoriesPage && (
              <div className="flex-shrink-0 flex items-center justify-center w-[100px]">
                <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-[200px]"></div>
      <div className="px-4 pb-4">
        {filteredItems.length === 0 && !isLoading ? (
          <div className={`text-center py-12 px-6 rounded-3xl border-2 border-dashed animate-slide-up-fade ${resolvedTheme === 'dark'
            ? 'bg-gradient-to-br from-gray-800/30 to-gray-900/30 border-gray-700/50'
            : 'bg-gradient-to-br from-gray-50 to-white border-gray-200'
            }`}>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${resolvedTheme === 'dark'
              ? 'bg-gradient-to-br from-primary/20 to-primary-light/10'
              : 'bg-gradient-to-br from-primary/10 to-primary-light/5'
              }`}>
              <Search className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-primary-light' : 'text-primary'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
              {category === "all" ? "No items available" : "No items found"}
            </h3>
            <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {category === "all" ? "Check back soon for new items" : "Try selecting a different category"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 justify-items-center">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id || (item as any)._id || `item-${index}`}
                  className={`relative w-full max-w-[400px] mb-3 ${prefersReducedMotion ? '' : 'animate-card-entrance hover-lift'}`}
                  style={{ animationDelay: prefersReducedMotion ? '0ms' : `${index * 60}ms` }}
                  onClick={() => handleDishClick(item.id || (item as any)._id || '', `/menu/${category}`)}
                >
                  <Card
                    className={`${resolvedTheme === 'dark'
                      ? 'bg-[#251F35] border-white/15'
                      : 'bg-white border-gray-100'
                      } rounded-3xl shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] transition-all duration-300 cursor-pointer overflow-hidden`}
                  >
                    <CardContent className="p-0">
                      <div className="relative h-[140px] overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className={`w-full h-full ${resolvedTheme === 'dark'
                            ? 'bg-gradient-to-br from-gray-700 to-gray-800'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200'
                            } flex items-center justify-center`}>
                            <span className="text-5xl opacity-40">🍽️</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
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
                          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 touch-manipulation z-10 hover:scale-110 ${resolvedTheme === 'dark' ? 'bg-gray-900/80 backdrop-blur-sm' : 'bg-white/90 backdrop-blur-sm'
                            }`}
                        >
                          <Heart className={`w-4.5 h-4.5 transition-all ${isFavorite(item.id || (item as any)._id || '')
                            ? 'fill-red-500 text-red-500'
                            : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`} />
                        </button>
                      </div>
                      <div className="px-4 pt-3.5 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-[15px] font-bold leading-tight line-clamp-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${item.isVegetarian
                              ? 'bg-green-500/20 border border-green-500/40'
                              : 'bg-red-500/20 border border-red-500/40'
                              }`}>
                              <div className={`w-2.5 h-2.5 rounded-sm ${item.isVegetarian ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            </div>
                            <span className={`text-sm font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>4.8</span>
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          </div>
                        </div>
                        <div className={`border-t border-dashed my-2.5 ${resolvedTheme === 'dark' ? 'border-gray-700/60' : 'border-gray-200'}`}></div>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${resolvedTheme === 'dark' ? 'bg-orange-500/15' : 'bg-orange-100'}`}>
                            <span className="text-xs">🔥</span>
                          </div>
                          <span className={`text-xs font-medium ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.calories ? `${item.calories} kcal` : '0 kcal'}
                          </span>
                        </div>
                      </div>
                      {getCartQuantity(item.id || (item as any)._id || '') > 0 ? (
                        <div
                          className="absolute bottom-0 right-0 w-28 h-11 flex items-center justify-between px-2 bg-primary transition-all duration-300"
                          style={{ borderTopLeftRadius: '24px', borderBottomRightRadius: '24px' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              decreaseQuantity(item.id || (item as any)._id || '');
                            }}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 bg-white/20 hover:bg-white/30"
                          >
                            <Minus className="w-4 h-4 text-white" />
                          </button>
                          <span className="text-sm font-bold text-white min-w-[32px] text-center">
                            {String(getCartQuantity(item.id || (item as any)._id || '')).padStart(2, '0')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!item.available || item.stock === 0) return;
                              handleAddToCart(item);
                            }}
                            disabled={!item.available || item.stock === 0}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 bg-white/20 hover:bg-white/30 ${!item.available || item.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!item.available || item.stock === 0) return;
                            handleAddToCart(item);
                          }}
                          disabled={!item.available || item.stock === 0}
                          className={`absolute bottom-0 right-0 w-11 h-11 flex items-center justify-center transition-all duration-200 touch-manipulation active:scale-95 bg-primary hover:shadow-lg ${!item.available || item.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          style={{ borderTopLeftRadius: '50%', borderBottomRightRadius: '24px' }}
                        >
                          <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
                        </button>
                      )}
                    </CardContent>
                  </Card>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-[90px] right-[-0px] z-20"
                  >
                    <div
                      className={`rounded-l-full w-36 h-4 flex items-center justify-center gap-2  ${resolvedTheme === 'dark'
                        ? 'bg-[#251F35]'
                        : 'bg-white'
                        }`}
                    >
                      <svg className={`w-3 h-3 ${resolvedTheme === 'dark' ? 'text-primary-light' : 'text-primary'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                        <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
                      </svg>
                      <span className={`text-[10px] font-semibold whitespace-nowrap ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                        {item.cookingTime ? `${item.cookingTime} mins` : '0 mins'}
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-[75px] right-[130px] z-20">
                    <svg width="28" height="28" viewBox="0 0 90 90" className="rotate-[160deg]">
                      <path
                        d="M20,70 Q100,10 240,70"
                        stroke={resolvedTheme === "dark" ? "#251F35" : "#ffffff"}
                        strokeWidth="30"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            {hasNextPage && (
              <div ref={observerTarget} className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>Loading more...</span>
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]"></div>
    </div>
  );
}
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, X, Sparkles, Clock, TrendingUp, Loader2 } from "lucide-react";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import MenuItemCard from "@/components/menu/MenuItemCard";
import type { MenuItem, Category } from "@shared/schema";
import { usePWANavigation } from "@/hooks/usePWANavigation";

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

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save search to recent searches
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Debounce search query for efficient API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery.trim().length >= 2) {
        saveRecentSearch(searchQuery.trim());
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, saveRecentSearch]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Server-side search query
  const { data: searchData, isLoading, isFetching } = useQuery<{ items: MenuItem[], pagination: any }>({
    queryKey: ["/api/menu/search", selectedCanteen?.id, debouncedSearchQuery],
    queryFn: async () => {
      if (!selectedCanteen?.id || !debouncedSearchQuery.trim()) {
        return { items: [], pagination: {} };
      }
      
      const params = new URLSearchParams({
        canteenId: selectedCanteen.id,
        availableOnly: 'true',
        limit: '50',
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
  const isSearching = searchQuery !== debouncedSearchQuery || isFetching;
  const hasSearchQuery = debouncedSearchQuery.trim().length >= 2;

  // Fetch categories for suggestions
  const { data: categoriesData } = useQuery<{ items: Category[] } | Category[]>({
    queryKey: ["/api/categories", selectedCanteen?.id],
    queryFn: async () => {
      if (!selectedCanteen?.id) return [];
      const response = await fetch(`/api/categories?canteenId=${selectedCanteen.id}`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    },
    enabled: !!selectedCanteen?.id,
    staleTime: 1000 * 60 * 5,
  });

  const categories = useMemo(() => {
    if (Array.isArray(categoriesData)) return categoriesData;
    return categoriesData?.items || [];
  }, [categoriesData]);

  const popularSearches = ["Tea", "Coffee", "Snacks", "Chicken", "Rice", "Biryani", "Burger", "Pizza"];

  return (
    <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-[#0f0a18]' : 'bg-gray-50'}`}>
      {/* Premium Header with Search */}
      <div 
        className="sticky top-0 z-50"
        style={{
          background: resolvedTheme === 'dark' 
            ? 'linear-gradient(180deg, rgba(15, 10, 24, 0.98) 0%, rgba(15, 10, 24, 0.95) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="px-4 pt-12 pb-4">
          {/* Back button and Search Input */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-full h-10 w-10 flex-shrink-0 ${
                resolvedTheme === 'dark' 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              onClick={goToHome}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {/* Premium Search Input */}
            <div className="relative flex-1 group">
              {/* Glow effect */}
              <div 
                className={`absolute -inset-0.5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-md pointer-events-none ${
                  resolvedTheme === 'dark' ? 'bg-violet-500/30' : 'bg-violet-400/20'
                }`}
              />
              
              <div 
                className={`relative flex items-center rounded-xl overflow-hidden transition-all duration-200 ${
                  resolvedTheme === 'dark'
                    ? 'bg-white/5 border border-white/10 focus-within:border-violet-500/50 focus-within:bg-white/8'
                    : 'bg-white border border-gray-200 focus-within:border-violet-400 focus-within:shadow-lg focus-within:shadow-violet-500/10'
                }`}
              >
                <Search className={`ml-4 w-5 h-5 flex-shrink-0 pointer-events-none ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
                
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Search dishes, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`flex-1 py-3.5 px-3 bg-transparent outline-none text-[15px] w-full min-w-0 ${
                    resolvedTheme === 'dark' 
                      ? 'text-white placeholder:text-gray-500' 
                      : 'text-gray-900 placeholder:text-gray-400'
                  }`}
                  style={{ WebkitAppearance: 'none' }}
                />
                
                {/* Loading indicator */}
                {isSearching && searchQuery && (
                  <div className="pr-3">
                    <Loader2 className={`w-4 h-4 animate-spin ${
                      resolvedTheme === 'dark' ? 'text-violet-400' : 'text-violet-500'
                    }`} />
                  </div>
                )}
                
                {/* Clear button */}
                {searchQuery && !isSearching && (
                  <button
                    onClick={clearSearch}
                    className={`pr-3 transition-colors ${
                      resolvedTheme === 'dark' 
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
        
        {/* Subtle border */}
        <div className={`h-px ${
          resolvedTheme === 'dark' ? 'bg-white/5' : 'bg-gray-200/50'
        }`} />
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Search Results */}
        {hasSearchQuery ? (
          <div className="animate-in fade-in duration-300">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  resolvedTheme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-100'
                }`}>
                  <Search className={`w-4 h-4 ${
                    resolvedTheme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {isSearching ? 'Searching...' : (
                    searchResults.length > 0 
                      ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                      : 'No results'
                  )}
                </span>
              </div>
              {searchResults.length > 0 && (
                <span className={`text-xs ${
                  resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  for "{debouncedSearchQuery}"
                </span>
              )}
            </div>

            {/* Results grid */}
            {isLoading && !searchResults.length ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className={`rounded-2xl h-48 animate-pulse ${
                      resolvedTheme === 'dark' ? 'bg-white/5' : 'bg-gray-200'
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
              <div className={`text-center py-12 rounded-2xl ${
                resolvedTheme === 'dark' ? 'bg-white/5' : 'bg-white'
              }`}>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <Search className={`w-8 h-8 ${
                    resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                </div>
                <p className={`font-medium mb-1 ${
                  resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  No dishes found
                </p>
                <p className={`text-sm ${
                  resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      resolvedTheme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
                    }`}>
                      <Clock className={`w-4 h-4 ${
                        resolvedTheme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                      }`} />
                    </div>
                    <span className={`text-sm font-semibold ${
                      resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      Recent
                    </span>
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className={`text-xs font-medium ${
                      resolvedTheme === 'dark' ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Clear all
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, index) => (
                    <button
                      key={`${term}-${index}`}
                      onClick={() => setSearchQuery(term)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        resolvedTheme === 'dark'
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            <div className="animate-in fade-in duration-300" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-lg ${
                  resolvedTheme === 'dark' ? 'bg-rose-500/20' : 'bg-rose-100'
                }`}>
                  <TrendingUp className={`w-4 h-4 ${
                    resolvedTheme === 'dark' ? 'text-rose-400' : 'text-rose-600'
                  }`} />
                </div>
                <span className={`text-sm font-semibold ${
                  resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Popular
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setSearchQuery(term)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      resolvedTheme === 'dark'
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
              <div className="animate-in fade-in duration-300" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${
                    resolvedTheme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${
                      resolvedTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                  </div>
                  <span className={`text-sm font-semibold ${
                    resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    Categories
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 8).map((category) => (
                    <button
                      key={category.id || (category as any)._id}
                      onClick={() => setSearchQuery(category.name)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        resolvedTheme === 'dark'
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
              className={`text-center py-8 animate-in fade-in duration-300 ${
                resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
              style={{ animationDelay: '300ms' }}
            >
              <p className="text-sm">
                Type at least 2 characters to search
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom safe area */}
      <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]" />
    </div>
  );
}

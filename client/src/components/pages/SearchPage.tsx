import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, X } from "lucide-react";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import MenuItemCard from "@/components/menu/MenuItemCard";
import type { MenuItem, Category } from "@shared/schema";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import BottomNavigation from "@/components/navigation/BottomNavigation";

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
  console.log('🔍 SearchPage: Component rendered');
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();

  // Debounce search query to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Function to clear search
  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  // Fetch real menu items and categories
  const { data: menuItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu", "search-page", Date.now()], // Force fresh data
    queryFn: async () => {
      console.log('🔍 SearchPage: Fetching menu items...');
      const response = await fetch('/api/menu');
      if (!response.ok) {
        throw new Error(`Failed to fetch menu items: ${response.status}`);
      }
      const data = await response.json();
      console.log('🔍 SearchPage: Raw API response:', data);
      console.log('🔍 SearchPage: Menu items received:', data.map(item => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        hasImage: !!item.imageUrl
      })));
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - reasonable caching for search results
    cacheTime: 0, // Disable cache completely
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Create item-category mapping
  const getCategoryName = (categoryId?: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || "Other";
  };

  const filteredItems = useMemo(() => {
    const filtered = menuItems.filter(item => {
      // First filter out items with 0 stock and unavailable items
      if (!item.available || item.stock <= 0) return false;
      
      // If no search query, show all available items
      if (!debouncedSearchQuery.trim()) return true;
      
      // Then apply search filter
      const categoryName = getCategoryName(item.categoryId);
      const searchLower = debouncedSearchQuery.toLowerCase();
      
      const matches = (
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        categoryName.toLowerCase().includes(searchLower) ||
        // Also search in ingredients if available
        (item as any).ingredients?.toLowerCase().includes(searchLower) ||
        // Search in tags if available
        (item as any).tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );

      // Debug logging for search matches
      if (matches && debouncedSearchQuery.trim()) {
        console.log('🔍 Search match found:', {
          itemName: item.name,
          searchQuery: debouncedSearchQuery,
          categoryName,
          description: item.description,
          ingredients: (item as any).ingredients,
          tags: (item as any).tags
        });
      }

      return matches;
    });

    // Remove duplicates based on item ID and name combination
    const uniqueItems = filtered.reduce((acc, current) => {
      const key = `${current.id}-${current.name}`;
      if (!acc.has(key)) {
        acc.set(key, current);
      }
      return acc;
    }, new Map());

    const result = Array.from(uniqueItems.values());
    console.log('🔍 Final filtered items count:', result.length, 'for query:', debouncedSearchQuery);
    
    return result;
  }, [menuItems, debouncedSearchQuery, categories]);


  // Generate search suggestions based on menu items
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    
    const suggestions = new Set<string>();
    const searchLower = debouncedSearchQuery.toLowerCase();
    
    // Add item names that match
    menuItems.forEach(item => {
      if (item.name.toLowerCase().includes(searchLower)) {
        suggestions.add(item.name);
      }
    });
    
    // Add category names that match
    categories.forEach(category => {
      if (category.name.toLowerCase().includes(searchLower)) {
        suggestions.add(category.name);
      }
    });
    
    return Array.from(suggestions).slice(0, 5);
  }, [debouncedSearchQuery, menuItems, categories]);

  const popularSearches = ["Tea", "Snacks", "Chicken", "Roll", "Pizza", "Burger", "Rice", "Noodles"];

  // Search bar component - modern design matching HomeScreen
  const SearchBar = () => (
    <div className="relative w-full">
      <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
        resolvedTheme === 'dark' ? 'text-[#B37ED7]' : 'text-[#724491]'
      }`} />
      <Input
        placeholder="Search for food..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`pl-12 pr-12 rounded-full h-12 text-base shadow-sm border-2 transition-all ${
          resolvedTheme === 'dark' 
            ? 'bg-white/10 border-[#724491]/50 text-white placeholder:text-[#C397E1]/70 focus:border-[#B37ED7] focus:bg-white/15 focus:shadow-lg focus:shadow-[#724491]/20' 
            : 'bg-white border-[#C397E1]/50 text-gray-900 placeholder:text-gray-500 focus:border-[#724491] focus:bg-white focus:shadow-lg focus:shadow-[#724491]/20'
        }`}
        autoFocus
      />
      {searchQuery && (
        <button
          onClick={clearSearch}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
            resolvedTheme === 'dark' 
              ? 'text-[#C397E1] hover:text-[#B37ED7] hover:bg-[#724491]/30' 
              : 'text-[#724491] hover:text-[#562A6E] hover:bg-[#C397E1]/30'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${
      'bg-background'
    }`}>
      {/* Header Container */}
      <div className="bg-[#724491] rounded-b-2xl shadow-xl overflow-hidden">
        {/* Top section - Back button and title */}
        <div className="px-4 pt-12 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={goToHome}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <span className="text-white font-bold text-lg">Search</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search Suggestions */}
        {debouncedSearchQuery && searchSuggestions.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-foreground">Suggestions</h3>
            <div className="flex flex-wrap gap-2">
              {searchSuggestions.map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setSearchQuery(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Popular Searches */}
        {!searchQuery && (
          <div>
            <h3 className="font-semibold mb-3 text-foreground">Popular Searches</h3>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <Badge
                  key={term}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setSearchQuery(term)}
                >
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchQuery && (
          <div>
            <h3 className="font-semibold mb-3 text-foreground">
              {searchQuery !== debouncedSearchQuery ? (
                "Searching..."
              ) : filteredItems.length > 0 ? (
                `${filteredItems.length} results for "${debouncedSearchQuery}"`
              ) : (
                `No results for "${debouncedSearchQuery}"`
              )}
            </h3>
            
            {isLoading || searchQuery !== debouncedSearchQuery ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <Card key={index} className="animate-pulse bg-card">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded mb-2 w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    getDefaultCategoryName={getDefaultCategoryName}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p>No available items found for "{searchQuery}"</p>
                <p className="text-sm mt-1">Try searching for something else</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom spacing for navigation and search bar */}
      <div className="pb-[calc(9rem+env(safe-area-inset-bottom))]"></div>
      
      {/* Fixed Search Bar above Bottom Navigation */}
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 w-full z-[9998] mb-3">
        <div className={`px-4 py-3 shadow-lg backdrop-blur-sm rounded-2xl border ${
          resolvedTheme === 'dark' 
            ? 'bg-background/95 border-[#724491]/30' 
            : 'bg-white/95 border-[#C397E1]/30'
        }`}>
          <SearchBar />
        </div>
      </div>
      
      <BottomNavigation currentPage="menu" />
    </div>
  );
}
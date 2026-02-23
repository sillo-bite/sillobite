import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/contexts/CartContext";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { ArrowLeft, Search, Star, Clock, Plus, Loader2, ChefHat, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, Category } from "@shared/schema";

export default function ViewAllQuickPicksPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { addToCart, getCartQuantity } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();

  // Fetch real data from database
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      return response.json();
    },
  });

  const { data: menuItems = [], isLoading: menuItemsLoading } = useQuery<MenuItem[]>({
    queryKey: ['/api/menu'],
    queryFn: async () => {
      const response = await fetch('/api/menu');
      if (!response.ok) {
        throw new Error(`Failed to fetch menu items: ${response.status}`);
      }
      return response.json();
    },
  });

  const isLoading = categoriesLoading || menuItemsLoading;

  // Transform menu items to quick picks format
  // Filter by both available status and stock level (stock > 0)
  const quickPickItems = menuItems
    .filter(item => {
      const isAvailable = item.available !== false;
      const hasStock = typeof item.stock !== 'number' || item.stock > 0;
      return isAvailable && hasStock;
    })
    .map(item => ({
      id: item.id.toString(),
      name: item.name,
      price: item.price,
      category: categories.find(cat => cat.id === item.categoryId)?.name || "General",
      isVegetarian: item.isVegetarian,
      stock: item.stock,
      available: item.available,
      description: item.description,
      imageUrl: item.imageUrl,
      categoryId: item.categoryId,
      storeCounterId: (item as any).storeCounterId,
      paymentCounterId: (item as any).paymentCounterId
    }));

  const filteredItems = quickPickItems.filter(item => {
    // If no search query, show all items
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower)
    );
  });

  // Function to clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleAddToCart = (item: typeof quickPickItems[0]) => {
    // Check if canteen is selected before adding to cart
    if (!selectedCanteen?.id) {
      console.warn('Cannot add item to cart: No canteen selected');
      return;
    }

    // Check if item is available and has stock
    const isAvailable = item.available !== false;
    const hasStock = typeof item.stock !== 'number' || item.stock > 0;
    if (!isAvailable || !hasStock) {
      console.warn('Cannot add item to cart: Item not available or out of stock');
      return;
    }

    // Validate counter IDs are present (REQUIRED)
    if (!item.storeCounterId || !item.paymentCounterId) {
      console.error('❌ Menu item missing counter IDs:', {
        itemId: item.id,
        itemName: item.name,
        storeCounterId: item.storeCounterId,
        paymentCounterId: item.paymentCounterId,
        fullItem: item
      });
      alert(`Error: Counter IDs are missing for "${item.name}". Please refresh the page and try again.`);
      return;
    }

    addToCart({
      id: item.id, // Keep as string (MongoDB ObjectId)
      name: item.name,
      price: item.price,
      isVegetarian: item.isVegetarian, // Use actual vegetarian status
      canteenId: selectedCanteen.id,
      description: item.description,
      imageUrl: item.imageUrl,
      storeCounterId: item.storeCounterId,
      paymentCounterId: item.paymentCounterId
    });
  };



  if (isLoading) {
    return (
      <div
        className={`min-h-screen pb-20 overflow-y-auto scrollbar-hide ${'bg-background'
          }`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Header Container Skeleton */}
        <div className="bg-[#724491] rounded-b-2xl shadow-xl overflow-hidden">
          <div className="px-4 pt-12 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
                <Skeleton className="w-24 h-6 rounded bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4 -mt-3">
          {/* Results header skeleton */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <Skeleton className={`h-4 w-32 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
              <Skeleton className={`h-8 w-24 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
            </div>
          </div>

          {/* Menu items skeleton */}
          <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    {/* Image skeleton */}
                    <Skeleton className={`w-16 h-16 rounded-xl flex-shrink-0 ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />

                    <div className="flex-1">
                      {/* Name and price skeleton */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className={`h-5 w-32 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            }`} />
                          <Skeleton className={`w-2 h-2 rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            }`} />
                        </div>
                        <Skeleton className={`h-5 w-16 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                      </div>

                      {/* Description skeleton */}
                      <Skeleton className={`h-3 w-full rounded mb-2 ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />

                      {/* Category and time skeleton */}
                      <div className="flex items-center space-x-4 text-sm mb-2">
                        <Skeleton className={`h-6 w-20 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                        <Skeleton className={`h-4 w-24 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                      </div>

                      {/* Bottom section skeleton */}
                      <div className="flex items-center justify-between">
                        <Skeleton className={`h-4 w-20 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                        <Skeleton className={`h-8 w-20 rounded ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom spacing for navigation and search bar */}
        <div className="pb-[calc(9rem+env(safe-area-inset-bottom))]"></div>

        {/* Fixed Search Bar skeleton above Bottom Navigation */}
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 w-full z-[9998] mb-3">
          <div className={`px-4 py-3 shadow-lg backdrop-blur-sm rounded-2xl border ${resolvedTheme === 'dark'
            ? 'bg-background/95 border-[#724491]/30'
            : 'bg-white/95 border-[#C397E1]/30'
            }`}>
            <Skeleton className={`h-12 w-full rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`} />
          </div>
        </div>
      </div>
    );
  }

  // Search bar component - modern design matching HomeScreen
  const SearchBar = () => (
    <div className="relative w-full">
      <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${resolvedTheme === 'dark' ? 'text-[#B37ED7]' : 'text-[#724491]'
        }`} />
      <Input
        placeholder="Search for food..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`pl-12 pr-12 rounded-full h-12 text-base shadow-sm border-2 transition-all ${resolvedTheme === 'dark'
          ? 'bg-white/10 border-[#724491]/50 text-white placeholder:text-[#C397E1]/70 focus:border-[#B37ED7] focus:bg-white/15 focus:shadow-lg focus:shadow-[#724491]/20'
          : 'bg-white border-[#C397E1]/50 text-gray-900 placeholder:text-gray-500 focus:border-[#724491] focus:bg-white focus:shadow-lg focus:shadow-[#724491]/20'
          }`}
      />
      {searchQuery && (
        <button
          onClick={clearSearch}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors ${resolvedTheme === 'dark'
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
    <div className={`min-h-screen ${'bg-background'
      }`}>

      {/* Header Container */}
      <div className="bg-[#724491] rounded-b-2xl shadow-xl overflow-hidden">
        {/* Top section - Back button and title */}
        <div className="px-4 pt-12 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/app")}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <span className="text-white font-bold text-lg">Quick Picks</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-3">
        {/* Results header */}
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} items available
            </p>
            <Button
              size="sm"
              onClick={() => {
                // Dispatch custom event to switch to cart view in AppPage
                window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                setLocation("/app");
              }}
              className="bg-primary hover:bg-primary/90"
            >
              View Cart
            </Button>
          </div>
        </div>

        {/* Menu items */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {menuItems.length === 0 ? "No Menu Items Available" : "No items found"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {menuItems.length === 0
                ? "Check back later for delicious food options!"
                : "Try searching for something else"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#B37ED7] to-[#724491] rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to emoji if image fails to load
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) {
                              fallback.classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <span className={`text-white text-lg ${item.imageUrl ? 'hidden' : ''}`}>🍽️</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          {/* Vegetarian/Non-vegetarian indicator */}
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${item.isVegetarian ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            aria-label={item.isVegetarian ? 'Vegetarian' : 'Non-vegetarian'}
                          />
                        </div>
                        <p className="text-lg font-bold">₹{item.price}</p>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          {(() => {
                            const category = categories.find(cat => cat.id === item.categoryId);
                            return category ? (
                              <>
                                <CategoryIcon category={category} size="sm" />
                                <span className="bg-muted px-2 py-1 rounded text-xs">
                                  {category.name}
                                </span>
                              </>
                            ) : (
                              <span className="bg-muted px-2 py-1 rounded text-xs">
                                {item.category}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Available now
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.id && getCartQuantity(item.id) > 0 && (
                            <span className="text-sm font-medium">
                              {getCartQuantity(item.id)} in cart
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(item)}
                          className="bg-primary hover:bg-primary/90"
                          disabled={!selectedCanteen?.id || !item.available || (typeof item.stock === 'number' && item.stock <= 0)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {item.id && getCartQuantity(item.id) > 0
                            ? `ADD (${getCartQuantity(item.id)})`
                            : 'ADD'
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom spacing for search bar */}
      <div className="pb-[calc(6.5rem+env(safe-area-inset-bottom))]"></div>

      {/* Fixed Search Bar at the bottom */}
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 w-full z-[9998] mb-1">
        <div className={`px-4 py-3 shadow-lg backdrop-blur-sm rounded-2xl border ${resolvedTheme === 'dark'
          ? 'bg-background/95 border-[#724491]/30'
          : 'bg-white/95 border-[#C397E1]/30'
          }`}>
          <SearchBar />
        </div>
      </div>
    </div>
  );
}
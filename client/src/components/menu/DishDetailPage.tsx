import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Minus, Star, Clock, Heart, Share2, Trash2, ArrowRight, Utensils } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import type { MenuItem } from "@shared/schema";

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

export default function DishDetailPage() {
  const [, setLocation] = useLocation();
  const { dishId } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const { addToCart } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { goToHome } = usePWANavigation();

  // Fetch the specific dish from the database
  const { data: dish, isLoading, error } = useQuery<MenuItem>({
    queryKey: [`/api/menu/${dishId}`],
    enabled: !!dishId,
  });

  // Parse addons from the dish data and remove duplicates
  const addons = dish?.addOns ? (() => {
    try {
      const parsed = JSON.parse(dish.addOns);
      if (!Array.isArray(parsed)) return [];

      // Remove duplicates based on id or name
      const uniqueAddons = parsed.filter((addon: any, index: number, self: any[]) => {
        if (addon.id) {
          return index === self.findIndex((a: any) => a.id === addon.id);
        } else if (addon.name) {
          return index === self.findIndex((a: any) => a.name === addon.name && a.price === addon.price);
        }
        return true;
      });

      return uniqueAddons;
    } catch {
      return [];
    }
  })() : [];

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dish details...</p>
        </div>
      </div>
    );
  }

  // Show error or not found state
  if (error || !dish) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative">
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToHome}
              className={`rounded-lg shadow-md ${resolvedTheme === 'dark'
                  ? 'bg-card/95 hover:bg-card text-foreground'
                  : 'bg-card/95 hover:bg-card text-foreground'
                }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className={`w-full h-80 flex items-center justify-center ${resolvedTheme === 'dark'
              ? 'bg-gradient-to-br from-[#33221a] to-[#1a1612]'
              : 'bg-gradient-to-br from-orange-100 to-orange-200'
            }`}>
            <span className="text-8xl">🍽️</span>
          </div>
        </div>
        <div className="px-4 py-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-foreground">Dish Not Found</h1>
          <p className="mb-4 text-muted-foreground">This dish is not available in our menu.</p>
          <Button onClick={goToHome}>Back to Menu</Button>
        </div>
      </div>
    );
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      if (prev.includes(addonId)) {
        return prev.filter(id => id !== addonId);
      } else {
        // Prevent adding duplicates
        return [...prev, addonId];
      }
    });
  };

  const getAddonPrice = () => {
    if (!dish || !selectedAddons || selectedAddons.length === 0) return 0;
    return selectedAddons.reduce((total, addonId) => {
      // Find addon by id, or by matching the fallback identifier format
      const addon = addons.find((a: any, index: number) => {
        if (a.id === addonId) return true;
        // Check if addonId matches the fallback format: "addon-{index}-{name}"
        if (addonId.startsWith('addon-')) {
          const fallbackId = `addon-${index}-${a.name}`;
          return fallbackId === addonId;
        }
        // Fallback: match by name if no id exists
        return !a.id && a.name === addonId;
      });
      if (!addon) return total;
      const addonPrice = typeof addon.price === 'string'
        ? parseFloat(addon.price) || 0
        : Number(addon.price) || 0;
      return Number(total) + Number(addonPrice);
    }, 0);
  };

  // Calculate prices only when dish is available
  const basePrice = dish ? (typeof dish.price === 'string'
    ? parseFloat(dish.price) || 0
    : Number(dish.price) || 0) : 0;

  const addonTotal = getAddonPrice();
  const totalPrice = dish ? (basePrice + addonTotal) * quantity : 0;

  const handleAddToCart = () => {
    if (!dish) return;

    // Check if canteen is selected before adding to cart
    if (!selectedCanteen?.id) {
      console.warn('Cannot add item to cart: No canteen selected');
      return;
    }

    const category = getDefaultCategoryName(dish.name);
    console.log('🔍 Adding dish to cart:', {
      name: dish.name,
      finalCategory: category,
      storeCounterId: dish.storeCounterId,
      paymentCounterId: dish.paymentCounterId
    });

    // Validate counter IDs are present (REQUIRED)
    if (!dish.storeCounterId || !dish.paymentCounterId) {
      console.error('❌ Menu item missing counter IDs:', {
        itemId: dish.id,
        itemName: dish.name,
        storeCounterId: dish.storeCounterId,
        paymentCounterId: dish.paymentCounterId,
        fullDish: dish
      });
      alert(`Error: Counter IDs are missing for "${dish.name}". Please refresh the page and try again.`);
      return;
    }

    // Calculate price per item (base + addons)
    const addonTotal = getAddonPrice();
    const itemPrice = Number(basePrice) + Number(addonTotal);

    // Add the item to cart with the selected quantity
    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: dish.id,
        name: dish.name,
        price: itemPrice,
        isVegetarian: dish.isVegetarian,
        canteenId: selectedCanteen.id,
        category: category,
        description: dish.description,
        imageUrl: dish.imageUrl,
        storeCounterId: dish.storeCounterId,
        paymentCounterId: dish.paymentCounterId
      });
    }

    // Navigate to cart page after adding
    // Dispatch custom event to switch to cart view in AppPage
    window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
    setLocation("/app");
  };

  const handleToggleFavorite = () => {
    if (!dish || !selectedCanteen?.id) return;
    toggleFavorite({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      isVegetarian: dish.isVegetarian,
      imageUrl: dish.imageUrl,
      canteenId: selectedCanteen.id,
      description: dish.description
    });
  };

  const handleShare = async () => {
    if (!dish) return;

    const shareData = {
      title: dish.name,
      text: `Check out ${dish.name} at ${selectedCanteen?.name || 'the canteen'}!`,
      url: window.location.href
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        // You could show a toast notification here
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const categoryName = getDefaultCategoryName(dish.name);
  const categoryEmoji = categoryName === 'Pizza' ? '🍕' :
    categoryName === 'Main Course' ? '🍛' :
      categoryName === 'Beverages' ? '🥤' :
        categoryName === 'Snacks' ? '🍿' :
          categoryName === 'Desserts' ? '🍰' :
            categoryName === 'Bread' ? '🍞' : '🍽️';

  return (
    <div className="min-h-screen pb-36 bg-background">
      {/* Top Navigation Bar */}
      <div className="relative">
        {/* Image Section - Takes ~45% of screen */}
        <div className={`w-full h-[45vh] min-h-[320px] flex items-center justify-center overflow-hidden relative ${resolvedTheme === 'dark'
            ? 'bg-gradient-to-br from-[#33221a] to-[#1a1612]'
            : 'bg-gradient-to-br from-orange-100 to-orange-200'
          }`}>
          {dish.imageUrl ? (
            <img
              src={dish.imageUrl}
              alt={dish.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span className={`text-8xl ${dish.imageUrl ? 'hidden' : ''}`}>🍽️</span>

          {/* Navigation Overlay */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToHome}
              className={`rounded-lg shadow-md backdrop-blur-sm ${resolvedTheme === 'dark'
                  ? 'bg-[#212121] hover:bg-[#2a2a2a] text-white border border-gray-700/50'
                  : 'bg-white/95 hover:bg-white text-gray-900 border border-gray-200/50'
                }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleFavorite}
                className={`rounded-lg shadow-md backdrop-blur-sm ${resolvedTheme === 'dark'
                    ? 'bg-[#212121] hover:bg-[#2a2a2a] text-white border border-gray-700/50'
                    : 'bg-white/95 hover:bg-white text-gray-900 border border-gray-200/50'
                  }`}
              >
                <Heart className={`w-5 h-5 transition-colors ${isFavorite(dish.id)
                    ? 'fill-red-500 text-red-500'
                    : resolvedTheme === 'dark'
                      ? 'text-white'
                      : 'text-gray-900'
                  }`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className={`rounded-lg shadow-md backdrop-blur-sm ${resolvedTheme === 'dark'
                    ? 'bg-[#212121] hover:bg-[#2a2a2a] text-white border border-gray-700/50'
                    : 'bg-white/95 hover:bg-white text-gray-900 border border-gray-200/50'
                  }`}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - Rounded top corners only */}
      <div className="relative px-4 pt-16 pb-5 space-y-6 -mt-24 z-10 rounded-t-[40px] bg-background">

        {/* Dish Info - Positioned relative to avoid overlap with curve */}
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold flex-1 text-foreground">{dish.name}</h1>
          </div>

          {/* Restaurant/Category Info */}
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-5 h-5 rounded flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-amber-700/80' : 'bg-amber-200'
              }`}>
              <span className="text-xs">{categoryEmoji}</span>
            </div>
            <span className="text-sm text-muted-foreground">{selectedCanteen?.name || categoryName}</span>
            <span className="text-sm text-muted-foreground">•</span>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-green-600 fill-green-600" />
              <span className="text-sm font-medium text-foreground">4.8</span>
            </div>
            <span className="text-sm text-muted-foreground">(2.2k)</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Add Ingredients Section */}
        {addons.length > 0 && (
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-4 text-foreground">Add Ingredients</h3>
            <div className="space-y-4">
              {addons.map((addon: any, index: number) => (
                <div
                  key={addon.id || `addon-${index}-${addon.name}`}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Ingredient Icon/Image Placeholder */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-card' : 'bg-muted'
                      }`}>
                      <Utensils className={`w-5 h-5 ${resolvedTheme === 'dark' ? 'text-muted-foreground' : 'text-muted-foreground'
                        }`} />
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-foreground">{addon.name}</div>
                      <div className="text-xs mt-0.5 text-muted-foreground">
                        {addon.quantity || '250 gm'} +₹{addon.price}
                      </div>
                    </div>
                  </div>

                  {/* Green Square Checkbox */}
                  <div
                    onClick={() => toggleAddon(addon.id || `addon-${index}-${addon.name}`)}
                    className={`w-6 h-6 rounded cursor-pointer flex items-center justify-center transition-all ${selectedAddons.includes(addon.id || `addon-${index}-${addon.name}`)
                        ? 'bg-green-600 border-2 border-green-600'
                        : resolvedTheme === 'dark'
                          ? 'border-2 border-border bg-transparent'
                          : 'border-2 border-border bg-transparent'
                      }`}
                  >
                    {selectedAddons.includes(addon.id || `addon-${index}-${addon.name}`) && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="white"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className={`fixed bottom-12 left-4 right-4 p-4 rounded-2xl shadow-2xl backdrop-blur-md ${resolvedTheme === 'dark'
          ? 'bg-card/98 border border-border'
          : 'bg-card/98 border border-border'
        }`}>
        <div className="flex items-center gap-3">
          {/* Quantity Selector */}
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${resolvedTheme === 'dark'
              ? 'bg-muted'
              : 'bg-muted'
            }`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-8 w-8 p-0 hover:bg-transparent"
              disabled={quantity === 1}
            >
              {quantity === 1 ? (
                <Trash2 className="w-4 h-4 text-foreground" />
              ) : (
                <Minus className="w-4 h-4 text-foreground" />
              )}
            </Button>
            <span className="font-bold text-base min-w-[24px] text-center text-foreground">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
              className="h-8 w-8 p-0 hover:bg-transparent"
            >
              <Plus className="w-4 h-4 text-green-600" />
            </Button>
          </div>

          {/* Add to Cart Button */}
          <Button
            className="flex-1 h-12 rounded-lg font-semibold text-base bg-green-600 hover:bg-green-500 text-white shadow-lg"
            onClick={handleAddToCart}
          >
            Add to Cart - ₹{totalPrice}
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Plus, Minus, Utensils, Star, Clock, Flame } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import LazyImage from "@/components/common/LazyImage";
import type { MenuItem } from "@shared/schema";

interface MenuItemCardProps {
  item: MenuItem;
  variant?: 'default' | 'trending' | 'quickpick';
  getDefaultCategoryName: (itemName: string) => string;
  hideDescription?: boolean;
}

const MenuItemCard = React.memo(function MenuItemCard({ 
  item, 
  variant = 'default',
  getDefaultCategoryName,
  hideDescription = false
}: MenuItemCardProps) {
  const [, setLocation] = useLocation();
  const { addToCart, removeFromCart, getCartQuantity } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { selectedCanteen, availableCanteens } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const [imageError, setImageError] = React.useState(false);

  // Helper to check if item can be added to cart
  const isItemAvailable = useMemo(() => {
    // Default to available if not explicitly set
    const isAvailable = item.available !== false;
    
    // Only check stock if it's a valid number and it's 0 or less
    // If stock is undefined, null, or not a number, treat it as stock not tracked (allow adding)
    const hasStock = typeof item.stock !== 'number' || item.stock > 0;
    
    return isAvailable && hasStock;
  }, [item.available, item.stock]);

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Check if item can be added
    if (!isItemAvailable) {
      return;
    }
    
    // Get the canteenId - use selected canteen or first available canteen
    const canteenId = selectedCanteen?.id || (availableCanteens.length > 0 ? availableCanteens[0].id : 'default');
    
    // Check if we have a valid canteen ID
    if (!canteenId || canteenId === 'default') {
      return;
    }
    
    const category = getDefaultCategoryName(item.name);
    
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
      id: item.id,
      name: item.name,
      price: item.price,
      isVegetarian: item.isVegetarian,
      canteenId: canteenId,
      category: category,
      description: item.description,
      imageUrl: item.imageUrl,
      storeCounterId: item.storeCounterId,
      paymentCounterId: item.paymentCounterId
    });
  }, [item.id, item.name, item.price, item.isVegetarian, item.available, item.stock, isItemAvailable, selectedCanteen?.id, availableCanteens, addToCart, getDefaultCategoryName]);

  const handleRemoveFromCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromCart(item.id);
  }, [item.id, removeFromCart]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const canteenId = selectedCanteen?.id || (availableCanteens.length > 0 ? availableCanteens[0].id : 'default');
    toggleFavorite({
      id: item.id,
      name: item.name,
      price: item.price,
      isVegetarian: item.isVegetarian,
      imageUrl: item.imageUrl,
      canteenId: canteenId,
      description: item.description
    });
  }, [item.id, item.name, item.price, item.isVegetarian, item.imageUrl, item.description, selectedCanteen?.id, availableCanteens, toggleFavorite]);

  const cardClassName = useMemo(() => {
    const baseClasses = 'rounded-3xl transition-all duration-300 cursor-pointer border-0 overflow-hidden transform relative';
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 hover:from-gray-800 hover:to-gray-850 shadow-[0_4px_20px_rgba(0,0,0,0.3)]' 
      : 'bg-white hover:bg-gray-50/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)]';
    
    return `${baseClasses} ${themeClasses}`;
  }, [resolvedTheme]);

  const imageContainerClassName = useMemo(() => {
    const baseClasses = 'w-full h-full flex items-center justify-center';
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-gray-700' 
      : 'bg-gray-200';
    
    return `${baseClasses} ${themeClasses}`;
  }, [resolvedTheme]);

  const quantitySelectorClassName = useMemo(() => {
    const baseClasses = 'rounded-full flex items-center px-1 py-1 touch-manipulation';
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-gray-700' 
      : 'bg-gray-200';
    
    return `${baseClasses} ${themeClasses}`;
  }, [resolvedTheme]);

  const addButtonClassName = useMemo(() => {
    const baseClasses = 'w-10 h-10 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 shadow-sm';
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-gray-700 hover:bg-gray-600' 
      : 'bg-gray-200 hover:bg-gray-300';
    
    return `${baseClasses} ${themeClasses}`;
  }, [resolvedTheme]);

  const textClassName = useMemo(() => {
    const baseClasses = {
      title: 'font-bold text-sm truncate leading-tight',
      price: 'text-base font-bold leading-tight',
      description: 'text-xs leading-tight truncate'
    };
    
    const themeClasses = {
      title: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
      price: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
      description: resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
    };
    
    return (type: 'title' | 'price' | 'description') => `${baseClasses[type]} ${themeClasses[type]}`;
  }, [resolvedTheme]);

  const buttonTextClassName = useMemo(() => {
    const baseClasses = 'font-bold text-sm hover:opacity-70 active:opacity-50 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center';
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700';
    return `${baseClasses} ${themeClasses}`;
  }, [resolvedTheme]);

  const imageAspectClassName = useMemo(() => {
    switch (variant) {
      case 'quickpick':
        return 'aspect-[4/3]';
      case 'trending':
        return 'aspect-[4/3]';
      default:
        return 'aspect-[5/3]';
    }
  }, [variant]);

  const contentPaddingClassName = useMemo(() => {
    if (variant === 'quickpick' || variant === 'trending') {
      return 'px-3 py-2';
    }
    return 'px-3 py-2';
  }, [variant]);


  // Default variant for trending and quick picks
  return (
    <Card className={cardClassName} onClick={() => setLocation(`/dish/${item.id}`)}>
      <CardContent className="p-0">
        {/* Top Section - Outer container with soft background */}
        <div className={`w-full p-2 relative`}>
          {/* Soft colored background for outer container */}
          <div className={`absolute inset-0 rounded-t-3xl ${
            resolvedTheme === 'dark' 
              ? 'bg-gradient-to-br from-gray-700/30 to-gray-800/30' 
              : 'bg-gradient-to-br from-emerald-50/80 to-teal-50/60'
          }`} />
          
          {/* Inner image container - reduced from square */}
          <div className={`relative aspect-[4/3] w-full rounded-xl overflow-hidden ${
            resolvedTheme === 'dark' 
              ? 'bg-gray-700/50' 
              : 'bg-white/60'
          }`}>
            {item.imageUrl ? (
              <LazyImage
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                placeholder={
                  <div className={`${imageContainerClassName} bg-transparent`}>
                    <span className="text-3xl">🍽️</span>
                  </div>
                }
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                resolvedTheme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}>
                <span className="text-3xl">🍽️</span>
              </div>
            )}
          </div>
          
          {/* Heart button - Top right corner of outer container */}
          <button 
            onClick={handleToggleFavorite}
            className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 touch-manipulation z-10 ${
              resolvedTheme === 'dark' 
                ? 'bg-gray-800/60 hover:bg-gray-800/80 backdrop-blur-sm' 
                : 'bg-white/90 hover:bg-white shadow-md'
            } ${isFavorite(item.id) ? 'scale-110' : 'hover:scale-110'}`}
          >
            <Heart className={`w-4 h-4 transition-all duration-300 ${
              isFavorite(item.id) 
                ? 'fill-red-500 text-red-500' 
                : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-400'
            }`} strokeWidth={1.5} />
          </button>
        </div>

        {/* Bottom Section - Content */}
        <div className={contentPaddingClassName}>
          {/* Item name and rating row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`${textClassName('title')} flex-1 text-sm`}>
              {item.name}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <span className={`text-xs font-bold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                {(4.0 + Math.random() * 0.9).toFixed(1)}
              </span>
            </div>
          </div>
          
          {/* Time and Calories - Pill style */}
          <div className="flex items-center gap-2 mb-2">
            {(item.cookingTime && item.cookingTime > 0) ? (
              <span className={`text-[11px] font-medium ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Clock className="w-3 h-3 inline mr-0.5" />
                {item.cookingTime} min
              </span>
            ) : (
              <span className={`text-[11px] font-medium ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Clock className="w-3 h-3 inline mr-0.5" />
                00
              </span>
            )}
            {(item.calories && item.calories > 0) ? (
              <span className={`text-[11px] font-medium ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Flame className="w-3 h-3 inline mr-0.5" />
                {item.calories} kcal
              </span>
            ) : (
              <span className={`text-xs font-medium ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Flame className="w-3 h-3 inline mr-0.5" />
                00
              </span>
            )}
          </div>
          
          {/* Price row */}
          <div className="flex justify-between items-center pb-1">
            {/* Price */}
            <div className={`${textClassName('price')} text-base`}>
              ₹{item.price}
            </div>
          </div>
        </div>
        
        {/* Add to cart button - Positioned at bottom-right edge */}
        {item.id && getCartQuantity(item.id) > 0 ? (
          <div className={`absolute bottom-0 right-0 rounded-tl-xl flex items-center px-1.5 py-1.5 touch-manipulation transition-all duration-300 ${
            resolvedTheme === 'dark' 
              ? 'bg-primary' 
              : 'bg-primary'
          }`} style={{
            boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.3), 0 4px 12px rgba(114, 68, 145, 0.4)'
          }}>
            <button
              onClick={handleRemoveFromCart}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all touch-manipulation active:scale-90 bg-white/20 text-white hover:bg-white/30"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold min-w-[28px] text-center px-0.5 text-white">
              {String(item.id ? getCartQuantity(item.id) : 0).padStart(2, '0')}
            </span>
            <button
              onClick={handleAddToCart}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all touch-manipulation active:scale-90 bg-white/20 text-white hover:bg-white/30 ${
                !isItemAvailable 
                  ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!isItemAvailable}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            className={`absolute bottom-0 right-0 w-11 h-11 rounded-tl-2xl flex items-center justify-center transition-all touch-manipulation active:scale-95 bg-primary text-white hover:shadow-xl ${
              !isItemAvailable 
                ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''
            }`}
            disabled={!isItemAvailable}
            style={{
              boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.3), 0 4px 12px rgba(114, 68, 145, 0.4)'
            }}
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>
        )}
      </CardContent>
    </Card>
  );
});

export default MenuItemCard;

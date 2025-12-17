import React, { useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Plus, Minus, Utensils } from "lucide-react";
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
    const baseClasses = 'rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border-0 overflow-hidden transform relative';
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-card hover:bg-gray-950' 
      : 'bg-card hover:bg-gray-50';
    
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
      title: 'font-bold text-lg truncate leading-tight',
      price: 'text-lg font-bold leading-tight',
      description: 'text-xs leading-tight truncate'
    };
    
    const themeClasses = {
      title: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800',
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
        return 'aspect-[16/10]';
      default:
        return 'aspect-[5/3]';
    }
  }, [variant]);

  const contentPaddingClassName = useMemo(() => {
    if (variant === 'quickpick' || variant === 'trending') {
      return 'px-3 py-2.5';
    }
    return 'px-3 py-3';
  }, [variant]);


  // Default variant for trending and quick picks
  return (
    <Card className={cardClassName} onClick={() => setLocation(`/dish/${item.id}`)}>
      <CardContent className="p-0">
        {/* Top Section - Image (separate and clean) */}
        <div className={`w-full ${imageAspectClassName} overflow-hidden relative`}>
          {item.imageUrl ? (
            <LazyImage
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              placeholder={
                <div className={imageContainerClassName}>
                  <span className="text-lg">🍽️</span>
                </div>
              }
            />
          ) : (
            <div className={imageContainerClassName}>
              <span className="text-lg">🍽️</span>
            </div>
          )}
          
          {/* Heart button - Top right corner on image */}
          <button 
            onClick={handleToggleFavorite}
            className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all touch-manipulation z-10 ${
              resolvedTheme === 'dark' 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Heart className={`w-3 h-3 ${
              isFavorite(item.id) 
                ? 'fill-red-500 text-red-500' 
                : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-400'
            }`} />
          </button>
        </div>

        {/* Bottom Section - Content */}
        <div className={contentPaddingClassName}>
          {/* Content Section */}
          <div className={`flex flex-col ${variant === 'quickpick' || variant === 'trending' ? 'gap-1 mb-1.5' : 'gap-1.5 mb-2'}`}>
            {/* Item name */}
            <h3 className={textClassName('title')}>
              {item.name}
            </h3>
            
            {/* Price */}
            <div className={textClassName('price')}>
              ₹{item.price}
            </div>
            
            {/* Description */}
            {!hideDescription && (
              <div className={textClassName('description')}>
                {item.description || 'Delicious food item'}
              </div>
            )}
          </div>
          
          {/* Add to cart button */}
          <div className="flex justify-end items-center">
              {item.id && getCartQuantity(item.id) > 0 ? (
                <div className={quantitySelectorClassName}>
                  <button
                    onClick={handleRemoveFromCart}
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
                    {String(item.id ? getCartQuantity(item.id) : 0).padStart(2, '0')}
                  </span>
                  <button
                    onClick={handleAddToCart}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 ${
                      resolvedTheme === 'dark' 
                        ? 'bg-gray-700 text-white hover:bg-gray-600' 
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    } ${
                      !isItemAvailable 
                        ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!isItemAvailable}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className={`${addButtonClassName} ${
                    !isItemAvailable 
                      ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={!isItemAvailable}
                >
                  <Plus className={`w-5 h-5 ${
                    resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-600'
                  }`} />
                </button>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default MenuItemCard;

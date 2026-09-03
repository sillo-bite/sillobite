import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Plus, Minus, Star } from "lucide-react";
import type { MenuItem } from "@shared/schema";
import type { FavoriteItem } from "@/contexts/FavoritesContext";

interface MenuListingCardProps {
  item: MenuItem;
  index: number;
  resolvedTheme: string;
  prefersReducedMotion: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
  getCartQuantity: (id: string) => number;
  decreaseQuantity: (id: string) => void;
  handleAddToCart: (item: MenuItem) => void;
  selectedCanteenId: string;
  from: string;
}

const MenuListingCard = React.memo(function MenuListingCard({
  item,
  index,
  resolvedTheme,
  prefersReducedMotion,
  isFavorite,
  toggleFavorite,
  getCartQuantity,
  decreaseQuantity,
  handleAddToCart,
  selectedCanteenId,
  from,
}: MenuListingCardProps) {
  const itemId = item.id || (item as any)._id || '';

  return (
    <div
      key={itemId || `item-${index}`}
      className={`relative w-full max-w-[400px] mb-3 ${prefersReducedMotion ? '' : 'animate-card-entrance hover-lift'}`}
      style={{ animationDelay: prefersReducedMotion ? '0ms' : `${index * 60}ms` }}
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
                  id: itemId,
                  name: item.name,
                  price: item.price,
                  isVegetarian: item.isVegetarian,
                  imageUrl: item.imageUrl,
                  canteenId: selectedCanteenId,
                  description: item.description
                });
              }}
              className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 touch-manipulation z-10 hover:scale-110 ${resolvedTheme === 'dark' ? 'bg-gray-900/80 backdrop-blur-sm' : 'bg-white/90 backdrop-blur-sm'
                }`}
            >
              <Heart className={`w-4.5 h-4.5 transition-all ${isFavorite(itemId)
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
          {getCartQuantity(itemId) > 0 ? (
            <div
              className="absolute bottom-0 right-0 w-28 h-11 flex items-center justify-between px-2 bg-primary transition-all duration-300"
              style={{ borderTopLeftRadius: '24px', borderBottomRightRadius: '24px' }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  decreaseQuantity(itemId);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-95 bg-white/20 hover:bg-white/30"
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <span className="text-sm font-bold text-white min-w-[32px] text-center">
                {String(getCartQuantity(itemId)).padStart(2, '0')}
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
  );
});

export default MenuListingCard;

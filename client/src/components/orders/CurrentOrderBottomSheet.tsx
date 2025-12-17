import { useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePaginatedActiveOrders } from "@/hooks/usePaginatedActiveOrders";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks/useAuth";
import type { Order } from "@shared/schema";
import LazyImage from "@/components/common/LazyImage";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

function OrderCard({ order, isHomePage, formatCurrency, menuItemsMap }: { 
  order: Order; 
  isHomePage: boolean; 
  formatCurrency: (amount: number) => string;
  menuItemsMap?: Map<string, any>;
}) {
  const [, setLocation] = useLocation();

  const orderItems = useMemo(() => {
    if (!order?.items) return [];
    try {
      const parsed = typeof order.items === 'string' 
        ? JSON.parse(order.items) 
        : order.items;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }, [order?.items]);

  const firstItem = orderItems.length > 0 ? orderItems[0] : null;
  const totalItemCount = orderItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

  // Use image from order item if available, otherwise try to get from menuItemsMap
  const itemImage = useMemo(() => {
    // First, check if the order item itself has an imageUrl
    if (firstItem?.imageUrl) {
      return firstItem.imageUrl;
    }
    
    // If we have a menuItemsMap and the item has an id, try to get it from there
    if (menuItemsMap && firstItem?.id) {
      const menuItem = menuItemsMap.get(String(firstItem.id));
      return menuItem?.imageUrl || null;
    }
    
    return null;
  }, [firstItem, menuItemsMap]);

  const itemNames = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return 'Item';
    const uniqueItems = orderItems.reduce((acc: any[], item: any) => {
      if (item.name && item.name !== 'Item') {
        acc.push(item.name);
      }
      return acc;
    }, []);
    if (uniqueItems.length === 0) return 'Item';
    let displayItems = uniqueItems.slice(0, 2);
    if (uniqueItems.length >= 3 && uniqueItems[0].length < 15) {
      displayItems = uniqueItems.slice(0, 3);
    }
    let result = displayItems.join(', ');
    if (uniqueItems.length > displayItems.length) {
      result += '...';
    }
    return result;
  }, [orderItems]);

  return (
    <div className="w-full flex items-center overflow-hidden relative">
      <div className="flex items-center flex-1 min-w-0 px-4 py-4 pr-20 sm:pr-24">
        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 mr-3 ring-2 ring-border">
          {itemImage ? (
            <LazyImage
              src={itemImage}
              alt={itemNames}
              className="w-full h-full object-cover"
              placeholder={
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-xl">🍽️</span>
                </div>
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-xl">🍽️</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {itemNames && itemNames !== 'Item' && (
            <p className="text-sm font-bold truncate mb-1 leading-tight text-foreground">
              {itemNames}
            </p>
          )}
          
          <p className="text-xs font-medium text-muted-foreground">
            {totalItemCount} item{totalItemCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-600 to-red-700 flex flex-col items-center justify-center px-3 py-4 flex-shrink-0 min-w-[75px] absolute right-0 top-0 bottom-0 rounded-r-lg">
        <div className="text-white font-bold text-sm mb-2 leading-tight">
          {formatCurrency(order.amount || 0)}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const orderId = order.orderNumber || order.id;
            if (orderId) {
              setLocation(`/order-status/${orderId}`);
            }
          }}
          className="text-white text-[10px] font-semibold uppercase tracking-wide hover:opacity-90 transition-opacity px-2 py-1 rounded bg-white/20 hover:bg-white/30"
        >
          View Order
        </button>
      </div>
    </div>
  );
}

interface CurrentOrderBottomSheetProps {
  activeOrders?: Order[];
  refetchOrders?: () => void;
}

export default function CurrentOrderBottomSheet({ activeOrders: propActiveOrders, refetchOrders }: CurrentOrderBottomSheetProps = {}) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isHomePage = location === "/app" || location.startsWith("/app");

  // ✅ NO MORE SEPARATE API CALL - Use orders from home-data API prop
  // Fallback to old method only if prop not provided (for backward compatibility)
  const { orders: fallbackOrders, isLoading: fallbackLoading, error: fallbackError, refetch: fallbackRefetch } = usePaginatedActiveOrders(
    1, 
    100,
    undefined,
    undefined,
    isHomePage && !!user && !propActiveOrders // Only fetch if no prop provided
  );
  
  // Use prop orders if available, otherwise fallback
  // Ensure activeOrders is always an array
  const activeOrders = useMemo(() => {
    const prop = Array.isArray(propActiveOrders) ? propActiveOrders : null;
    const fallback = Array.isArray(fallbackOrders) ? fallbackOrders : [];
    return prop || fallback || [];
  }, [propActiveOrders, fallbackOrders]);
  
  const isLoading = propActiveOrders ? false : fallbackLoading;
  const error = propActiveOrders ? null : fallbackError;
  const refetch = refetchOrders || fallbackRefetch;

  const canteenIds = useMemo(() => {
    if (!activeOrders || !Array.isArray(activeOrders) || activeOrders.length === 0) return [];
    return Array.from(
      new Set(activeOrders.map((order: Order) => order.canteenId).filter(Boolean))
    );
  }, [activeOrders]);

  // Fetch menu items once for all orders (only if needed and not on homepage where home-data should be used)
  // Actually, we should disable this on homepage since order items should already have imageUrl
  // But if they don't, we'll fetch menu once per unique canteenId
  const uniqueCanteenIds = useMemo(() => {
    return Array.from(new Set(canteenIds));
  }, [canteenIds]);

  // Create a map of menu items by ID for quick lookup
  // Only fetch if we're not on homepage (homepage should use home-data API)
  // Actually, let's just use the imageUrl from order items if available
  const menuItemsMap = useMemo(() => {
    // Don't fetch menu on homepage - order items should have imageUrl
    // If they don't, we'll just show the placeholder
    return new Map<string, any>();
  }, []);

  useWebSocket({
    canteenIds,
    enabled: canteenIds.length > 0 && isHomePage,
    onOrderUpdate: () => refetch(),
    onOrderStatusChange: () => refetch(),
    onNewOrder: () => refetch(),
  });

  // Remove the automatic refetch on user load - not needed anymore
  // WebSocket handles real-time updates, and query will fetch initially when enabled
  // useEffect(() => {
  //   if (isHomePage && user) {
  //     const timeoutId = setTimeout(() => refetch(), 100);
  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [isHomePage, user, refetch]);

  if (!isHomePage) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const hasMultipleOrders = activeOrders.length > 1;
  const bottomNavHeight = 64;
  const gap = 16;

  return (
    <div
      className="fixed left-0 right-0 z-[9998]"
      style={{ 
        bottom: `${bottomNavHeight + gap}px`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 w-full rounded-lg border bg-card border-border">
            <div className="relative w-8 h-8 mb-3">
              <div className="absolute inset-0 border-2 border-transparent rounded-full border-t-primary border-r-primary/60 animate-spin" style={{ animationDuration: '1s' }}></div>
              <div className="absolute inset-0 border-2 border-transparent rounded-full border-b-primary/40 border-l-primary/40 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
            </div>
          </div>
        ) : error ? null : activeOrders.length === 0 ? null : hasMultipleOrders ? (
          <Carousel
            opts={{
              align: "center",
              loop: false,
              dragFree: false,
              containScroll: "trimSnaps",
            }}
            className="w-full"
          >
            <CarouselContent className="!ml-0">
              {activeOrders.map((order: Order, index: number) => (
                <CarouselItem key={order.id || order.orderNumber || `order-${index}`} className="pl-2 pr-2 basis-[90%] sm:basis-[85%]">
                  <div className="w-full rounded-lg overflow-hidden border-l bg-card border-border">
                    <OrderCard
                      order={order}
                      isHomePage={isHomePage}
                      formatCurrency={formatCurrency}
                      menuItemsMap={menuItemsMap}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <div className="w-full rounded-lg overflow-hidden border-l bg-card border-border">
            <OrderCard
              order={activeOrders[0]}
              isHomePage={isHomePage}
              formatCurrency={formatCurrency}
              menuItemsMap={menuItemsMap}
            />
          </div>
        )}
      </div>
    </div>
  );
}

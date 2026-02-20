import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePaginatedActiveOrders } from "@/hooks/usePaginatedActiveOrders";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import type { Order } from "@shared/schema";
import LazyImage from "@/components/common/LazyImage";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Clock, ChevronRight, Package } from "lucide-react";

function OrderCard({ order, isHomePage, formatCurrency, menuItemsMap }: {
  order: Order;
  isHomePage: boolean;
  formatCurrency: (amount: number) => string;
  menuItemsMap?: Map<string, any>;
}) {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();

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
  const isBulkOrder = orderItems.length > 1;

  // Get the appropriate image based on order type
  const itemImage = useMemo(() => {
    const targetItem = firstItem;

    if (!targetItem) return null;

    if (targetItem.imageUrl) {
      return targetItem.imageUrl;
    }

    if (menuItemsMap && menuItemsMap.size > 0 && targetItem.id) {
      const menuItem = menuItemsMap.get(String(targetItem.id));
      if (menuItem?.imageUrl) {
        return menuItem.imageUrl;
      }
    }

    return null;
  }, [firstItem, menuItemsMap]);

  const itemNames = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return 'Your Order';
    const uniqueItems = orderItems.reduce((acc: any[], item: any) => {
      if (item.name && item.name !== 'Item') {
        acc.push(item.name);
      }
      return acc;
    }, []);
    if (uniqueItems.length === 0) return 'Your Order';
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

  // Get status color and text
  const getStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { color: 'bg-amber-500', text: 'Pending', pulse: true };
      case 'confirmed':
        return { color: 'bg-blue-500', text: 'Confirmed', pulse: false };
      case 'preparing':
        return { color: 'bg-orange-500', text: 'Preparing', pulse: true };
      case 'ready':
        return { color: 'bg-green-500', text: 'Ready', pulse: true };
      case 'out_for_delivery':
        return { color: 'bg-purple-500', text: 'On the way', pulse: true };
      default:
        return { color: 'bg-gray-500', text: 'Processing', pulse: false };
    }
  };

  const statusInfo = getStatusInfo(order.status);

  return (
    <div
      className={`w-full overflow-hidden relative rounded-2xl transition-all duration-300 ${resolvedTheme === 'dark'
        ? 'bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 border border-gray-700/50'
        : 'bg-gradient-to-br from-white/95 via-gray-50/95 to-white/95 border border-gray-200/50'
        }`}
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: resolvedTheme === 'dark'
          ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div className={`absolute inset-0 pointer-events-none rounded-2xl ${resolvedTheme === 'dark'
        ? 'bg-gradient-to-r from-[#724491]/10 via-transparent to-[#724491]/5'
        : 'bg-gradient-to-r from-[#724491]/5 via-transparent to-[#724491]/3'
        }`} />

      <div className="flex items-center p-3 relative">
        {/* Image with premium styling */}
        <div className="relative flex-shrink-0 mr-3">
          <div
            className={`w-14 h-14 rounded-xl overflow-hidden ${resolvedTheme === 'dark' ? 'ring-2 ring-gray-700/50' : 'ring-2 ring-gray-200/50'
              }`}
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {itemImage ? (
              <LazyImage
                src={itemImage}
                alt={itemNames}
                className="w-full h-full object-cover"
                placeholder={
                  <div className={`w-full h-full flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                }
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Item count badge */}
          {isBulkOrder && (
            <div className="absolute -bottom-1 -right-1 bg-[#724491] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-lg border-2 border-background">
              {totalItemCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusInfo.color} ${statusInfo.pulse ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-semibold ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                {statusInfo.text}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
              <Clock className="w-3 h-3" />
              <span>~15 min</span>
            </div>
          </div>

          {/* Item names */}
          <p className={`text-sm font-bold truncate mb-0.5 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
            {itemNames}
          </p>

          {/* Price */}
          <p className={`text-base font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
            {formatCurrency(order.amount || 0)}
          </p>
        </div>

        {/* View Order Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const orderId = order.orderNumber || order.id;
            if (orderId) {
              setLocation(`/order-status/${orderId}`);
            }
          }}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-[#724491] to-[#8B5AAF] text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            boxShadow: '0 4px 14px rgba(114, 68, 145, 0.4)',
          }}
        >
          <span>Track</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface CurrentOrderBottomSheetProps {
  activeOrders?: Order[];
  refetchOrders?: () => void;
  forceHidden?: boolean; // When true, hide the bottom sheet (controlled by parent)
}


export default function CurrentOrderBottomSheet({ activeOrders: propActiveOrders, refetchOrders, forceHidden = false }: CurrentOrderBottomSheetProps = {}) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();

  const isHomePage = location === "/app" || location.startsWith("/app");

  const { orders: fallbackOrders, isLoading: fallbackLoading, error: fallbackError, refetch: fallbackRefetch } = usePaginatedActiveOrders(
    1,
    100,
    undefined,
    user?.id ? Number(user.id) : undefined, // Security: always filter by current user's ID
    isHomePage && !!user && !propActiveOrders
  );

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

  const itemIdsNeedingImages = useMemo(() => {
    const ids: string[] = [];
    activeOrders.forEach((order: Order) => {
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item.imageUrl && item.id) {
              ids.push(String(item.id));
            }
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
    return Array.from(new Set(ids));
  }, [activeOrders]);

  const { data: menuItemsData } = useQuery({
    queryKey: ['menu-items-for-orders', itemIdsNeedingImages.join(',')],
    queryFn: async () => {
      if (itemIdsNeedingImages.length === 0 || canteenIds.length === 0) {
        return [];
      }

      const canteenId = canteenIds[0];
      const response = await fetch(`/api/menu?canteenId=${canteenId}&limit=100`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.items || data || [];
    },
    enabled: isHomePage && itemIdsNeedingImages.length > 0 && canteenIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const menuItemsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (menuItemsData && Array.isArray(menuItemsData)) {
      menuItemsData.forEach((item: any) => {
        const id = item.id || item._id;
        if (id) {
          map.set(String(id), item);
        }
      });
    }
    return map;
  }, [menuItemsData]);

  useWebSocket({
    canteenIds,
    enabled: canteenIds.length > 0 && isHomePage,
    onOrderUpdate: () => refetch(),
    onOrderStatusChange: () => refetch(),
    onNewOrder: () => refetch(),
  });

  if (!isHomePage) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(0)}`;
  };

  const hasMultipleOrders = activeOrders.length > 1;

  // Use forceHidden prop to control visibility (controlled by parent based on header state)
  const isVisible = !forceHidden;

  return (
    <div
      className="fixed left-0 right-0 z-[9998] px-3"
      style={{
        bottom: '16px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: isVisible ? 'translateY(0)' : 'translateY(calc(100% + 40px))',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 400ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease-out',
      }}
    >
      {/* Ambient glow effect */}
      {activeOrders.length > 0 && (
        <div
          className="absolute inset-x-4 -bottom-2 h-20 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(114, 68, 145, 0.5), rgba(139, 90, 175, 0.4), rgba(114, 68, 145, 0.3))',
            opacity: isVisible ? 0.6 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        />
      )}

      <div className="w-full relative">
        {isLoading ? (
          <div
            className={`flex flex-col items-center justify-center py-6 px-4 w-full rounded-[20px] ${resolvedTheme === 'dark'
              ? 'bg-gray-900/90 border border-gray-700/50'
              : 'bg-white/90 border border-gray-200/50'
              }`}
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px -15px rgba(114, 68, 145, 0.3), 0 10px 30px -10px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border-2 border-transparent rounded-full border-t-[#724491] border-r-[#724491]/60 animate-spin" style={{ animationDuration: '1s' }}></div>
              <div className="absolute inset-0 border-2 border-transparent rounded-full border-b-[#724491]/40 border-l-[#724491]/40 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
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
                <CarouselItem key={order.id || order.orderNumber || `order-${index}`} className="pl-1.5 pr-1.5 basis-[92%] sm:basis-[88%]">
                  <OrderCard
                    order={order}
                    isHomePage={isHomePage}
                    formatCurrency={formatCurrency}
                    menuItemsMap={menuItemsMap}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <OrderCard
            order={activeOrders[0]}
            isHomePage={isHomePage}
            formatCurrency={formatCurrency}
            menuItemsMap={menuItemsMap}
          />
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatOrderIdDisplay } from '@shared/utils';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';
// BarcodeScanModal, OrderFoundModal, OrderNotFoundModal removed - not needed for KOT counters

// DeliveryPersonSelectModal removed - not needed for KOT counters
// Removed PanelGroup import - using custom layout instead
import {
  ChefHat, // Changed from Store to ChefHat for KOT counter
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  LogOut,
  Radio,
  CheckSquare,
  Loader2,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface KotModeProps {
  counterId: string;
  canteenId: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  itemsSubtotal?: number;
  status: string;
  items: string;
  createdAt: Date;
  estimatedTime: number;
  isMarkable?: boolean;
  paymentStatus?: string;
  barcode?: string;
  orderType?: 'delivery' | 'takeaway';
  deliveryPersonId?: string;
  itemStatusByCounter?: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'out_for_delivery' | 'completed' } };
}

interface CanteenInfo {
  name: string;
  id: string;
}

// NEW SIMPLIFIED LOGIC: Filter items by checking item.kotCounterId directly
// Helper function to filter items in an order for a specific KOT counter
function filterOrderItems(order: any, counterId: string): any | null {
  if (!order || !order.items) return null;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  // Filter items that belong to this KOT counter by checking item.kotCounterId
  const relevantItems = items.filter((item: any) => {
    // Check if item has kotCounterId and it matches this counter
    const belongsToCounter = item.kotCounterId === counterId;

    if (belongsToCounter) {
      console.log(`✅ Item ${item.name} belongs to KOT counter ${counterId}`, {
        itemName: item.name,
        itemKotCounterId: item.kotCounterId,
        targetCounterId: counterId
      });
    }

    return belongsToCounter;
  });

  if (relevantItems.length > 0) {
    console.log(`✅ Order ${order.orderNumber} has ${relevantItems.length} relevant items (out of ${items.length} total) for KOT counter ${counterId}`);
    // Return a filtered order with only the relevant items
    return {
      ...order,
      items: JSON.stringify(relevantItems)
    };
  }

  console.log(`❌ Order ${order.orderNumber} has no items for KOT counter ${counterId} (checked ${items.length} items)`);
  return null;
}

// Helper function to filter orders for specific KOT counter
function filterOrderForCounter(order: any, counterId: string): any | null {
  if (!order) return null;

  // Check if the counter is in the allKotCounterIds array (order should be broadcasted to this counter)
  const shouldShowOrder = order.allKotCounterIds && order.allKotCounterIds.includes(counterId);

  if (!shouldShowOrder) {
    console.log(`❌ Order ${order.orderNumber} not broadcasted to KOT counter ${counterId}`, {
      allKotCounterIds: order.allKotCounterIds,
      targetCounterId: counterId
    });
    return null;
  }

  // Filter items for this KOT counter
  return filterOrderItems(order, counterId);
}

// Helper function to check if KOT counter has already marked all items ready in an order
function hasCounterDeliveredItems(order: any, counterId: string): boolean {
  try {
    if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
      return false;
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const counterItemStatus = order.itemStatusByCounter[counterId];

    // Check if all items belonging to this KOT counter are ready
    // Use item.kotCounterId directly (no menu item lookup needed)
    const counterItems = items.filter((item: any) => item.kotCounterId === counterId);

    return counterItems.length > 0 && counterItems.every((item: any) =>
      counterItemStatus[item.id] === 'ready' || counterItemStatus[item.id] === 'completed'
    );
  } catch (error) {
    console.error('Error checking if KOT counter has marked items ready:', error);
    return false;
  }
}

export default function KotMode({ counterId, canteenId }: KotModeProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);



  // Set page title
  useEffect(() => {
    document.title = "KOT Counter | KIT-CANTEEN Owner Dashboard";
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Removed barcode and delivery related state - not needed for KOT counters
  // Removed isLiveMode state - now purely WebSocket-based

  console.log('🍳 KotMode component mounted with:', { counterId, canteenId });

  // Fetch menu items to check isMarkable property and for filtering
  const { data: menuItemsData } = useQuery({
    queryKey: ['/api/menu', canteenId],
    queryFn: () => apiRequest(`/api/menu?canteenId=${canteenId}&availableOnly=false`), // Get all menu items (including unavailable/out of stock) for order filtering
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Extract menu items from API response
  const menuItems = menuItemsData?.items || [];

  // Fetch counters to get KOT counter names
  const { data: countersData } = useQuery({
    queryKey: ['/api/counters', canteenId],
    queryFn: () => apiRequest(`/api/counters?canteenId=${canteenId}`),
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Extract counters from API response
  const counters = Array.isArray(countersData)
    ? countersData
    : (countersData as any)?.items || (countersData as any)?.counters || [];

  // Create a map of counter ID to counter name for quick lookup
  const counterMap = new Map<string, { name: string; type: string }>();
  counters.forEach((counter: any) => {
    if (counter.id && counter.name) {
      counterMap.set(counter.id, { name: counter.name, type: counter.type || 'store' });
    }
  });

  // WebSocket integration for counter-specific updates
  const { joinCounterRoom, leaveCounterRoom, isConnected } = useWebSocket({
    enabled: true && menuItems.length > 0, // Only enable WebSocket when menu items are loaded
    onNewOrder: (order) => {
      console.log('🍳 KotMode received new order:', {
        orderNumber: order.orderNumber,
        kotCounterId: order.kotCounterId,
        allKotCounterIds: order.allKotCounterIds,
        allCounterIds: order.allCounterIds,
        items: order.items?.length,
        counterId,
        canteenId,
        fullOrder: order
      });

      // Check if this order is relevant to this KOT counter
      const isRelevantToCounter = order.allKotCounterIds?.includes(counterId) ||
        order.allCounterIds?.includes(counterId) ||
        order.kotCounterId === counterId;

      console.log('🍳 KotMode order relevance check:', {
        orderNumber: order.orderNumber,
        counterId,
        isRelevantToCounter,
        allKotCounterIds: order.allKotCounterIds,
        allCounterIds: order.allCounterIds,
        kotCounterId: order.kotCounterId,
        menuItemsLength: menuItems.length
      });

      if (isRelevantToCounter) {
        // Check if menu items are available for filtering
        if (menuItems.length === 0) {
          // Menu items not loaded yet, invalidate to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId, menuItems.length] });
          return;
        }

        // Check if this counter has already delivered their items in this order
        const counterHasDelivered = hasCounterDeliveredItems(order, counterId);
        if (counterHasDelivered) {
          // Remove order from cache if counter has delivered
          queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.filter((o: any) =>
              o.id !== order.id && o.orderNumber !== order.orderNumber
            );
          });
          return;
        }

        // Filter orders to show only items belonging to this counter
        const relevantOrder = filterOrderForCounter(order, counterId);
        if (relevantOrder) {
          // Add new order to cache directly - use exact query key including menuItems.length
          queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
            if (!oldData) return [relevantOrder];

            // Check if order already exists
            const exists = oldData.some((o: any) =>
              o.id === relevantOrder.id || o.orderNumber === relevantOrder.orderNumber
            );

            if (exists) {
              // Update existing order
              return oldData.map((o: any) =>
                o.id === relevantOrder.id || o.orderNumber === relevantOrder.orderNumber
                  ? relevantOrder
                  : o
              );
            } else {
              // Add new order at the beginning (newest first)
              return [relevantOrder, ...oldData];
            }
          });
        }
      }
    },
    onOrderUpdate: (order) => {
      // Check if this order is relevant to this KOT counter
      const isRelevantToCounter = order?.allKotCounterIds?.includes(counterId) ||
        order?.allCounterIds?.includes(counterId) ||
        order?.kotCounterId === counterId;

      if (!isRelevantToCounter) return;

      // Filter the order for this counter before updating cache
      const filteredOrder = filterOrderForCounter(order, counterId);
      if (!filteredOrder) return;

      // Update cache directly - use exact query key including menuItems.length
      queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
        if (!oldData) return [filteredOrder];

        const existingIndex = oldData.findIndex((o: any) =>
          o.id === filteredOrder.id || o.orderNumber === filteredOrder.orderNumber
        );

        if (existingIndex >= 0) {
          // Update existing order - preserve full itemStatusByCounter
          const updated = [...oldData];
          const existingOrder = updated[existingIndex];
          updated[existingIndex] = {
            ...filteredOrder,
            // Preserve the full itemStatusByCounter from the order update
            itemStatusByCounter: order.itemStatusByCounter || filteredOrder.itemStatusByCounter || existingOrder.itemStatusByCounter,
            // Preserve deliveryPersonId
            deliveryPersonId: order.deliveryPersonId || existingOrder.deliveryPersonId,
            // Preserve order status
            status: order.status || existingOrder.status
          };
          return updated;
        } else {
          // Add new order
          return [...oldData, filteredOrder];
        }
      });
    },
    onOrderStatusChange: (order, oldStatus, newStatus) => {
      // Check if this order is relevant to this KOT counter
      const isRelevantToCounter = order?.allKotCounterIds?.includes(counterId) ||
        order?.allCounterIds?.includes(counterId) ||
        order?.kotCounterId === counterId;

      if (!isRelevantToCounter) return;

      // Filter the order for this counter before updating cache
      const filteredOrder = filterOrderForCounter(order, counterId);
      if (!filteredOrder) {
        // Order no longer relevant to this counter, remove it
        queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.filter((o: any) =>
            o.id !== order.id && o.orderNumber !== order.orderNumber
          );
        });
        return;
      }

      // Update cache directly - use exact query key including menuItems.length
      queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
        if (!oldData) return [filteredOrder];

        const existingIndex = oldData.findIndex((o: any) =>
          o.id === filteredOrder.id || o.orderNumber === filteredOrder.orderNumber
        );

        if (existingIndex >= 0) {
          // Update existing order - preserve full itemStatusByCounter
          const updated = [...oldData];
          const existingOrder = updated[existingIndex];
          updated[existingIndex] = {
            ...filteredOrder,
            // Preserve the full itemStatusByCounter from the order update
            itemStatusByCounter: order.itemStatusByCounter || filteredOrder.itemStatusByCounter || existingOrder.itemStatusByCounter,
            // Preserve deliveryPersonId
            deliveryPersonId: order.deliveryPersonId || existingOrder.deliveryPersonId,
            // Preserve order status
            status: order.status || existingOrder.status
          };
          return updated;
        } else {
          // Add new order
          return [...oldData, filteredOrder];
        }
      });
    },
    onItemStatusChange: (order) => {
      // Handle item-level status changes (from mark-ready)
      const isRelevantToCounter = order?.allKotCounterIds?.includes(counterId) ||
        order?.allCounterIds?.includes(counterId) ||
        order?.kotCounterId === counterId;

      if (!isRelevantToCounter) return;

      // Filter the order for this counter before updating cache
      const filteredOrder = filterOrderForCounter(order, counterId);
      if (!filteredOrder) return;

      // Update cache directly - use exact query key including menuItems.length
      queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
        if (!oldData) return [filteredOrder];

        const existingIndex = oldData.findIndex((o: any) =>
          o.id === filteredOrder.id || o.orderNumber === filteredOrder.orderNumber
        );

        if (existingIndex >= 0) {
          // Update existing order - preserve full itemStatusByCounter from the order update
          const updated = [...oldData];
          const existingOrder = updated[existingIndex];
          updated[existingIndex] = {
            ...filteredOrder,
            // Preserve the full itemStatusByCounter from the order update (includes all counters)
            itemStatusByCounter: order.itemStatusByCounter || filteredOrder.itemStatusByCounter || existingOrder.itemStatusByCounter,
            // Preserve deliveryPersonId
            deliveryPersonId: order.deliveryPersonId || existingOrder.deliveryPersonId,
            // Preserve order status
            status: order.status || existingOrder.status
          };
          return updated;
        } else {
          // Add new order
          return [...oldData, filteredOrder];
        }
      });
    },
    onConnected: () => {
      console.log('🍳 KotMode WebSocket connected, attempting to join counter room:', counterId);
      if (counterId && canteenId) {
        // Retry joining the room after connection
        setTimeout(() => {
          joinCounterRoom(counterId, canteenId);
        }, 200);
      }
    }
  });

  // Join counter room when component mounts
  useEffect(() => {
    console.log('🍳 KotMode useEffect - WebSocket connection status:', {
      isConnected,
      counterId,
      canteenId,
      menuItemsLength: menuItems.length,
      shouldJoin: isConnected && counterId && canteenId && menuItems.length > 0
    });

    console.log('🍳 KotMode - Attempting to join counter room:', {
      counterId,
      canteenId,
      isConnected,
      menuItemsLoaded: menuItems.length > 0
    });

    if (isConnected && counterId && canteenId && menuItems.length > 0) {
      // Add a small delay to ensure WebSocket is fully connected
      const timeoutId = setTimeout(() => {
        console.log('🍳 KotMode attempting to join counter room:', counterId);
        joinCounterRoom(counterId, canteenId);
        console.log('🍳 KotMode joinCounterRoom called for:', counterId);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (counterId) {
          leaveCounterRoom(counterId);
          console.log('🍳 KotMode left counter room:', counterId);
        }
      };
    }
  }, [isConnected, counterId, canteenId, menuItems.length, joinCounterRoom, leaveCounterRoom]);

  // Additional effect to retry joining if not successful (only if menuItems are loaded)
  useEffect(() => {
    if (isConnected && counterId && canteenId && menuItems.length > 0) {
      // Only retry if the first effect didn't successfully join
      const retryTimeout = setTimeout(() => {
        console.log('🍳 KotMode retry: attempting to join counter room again:', counterId);
        joinCounterRoom(counterId, canteenId);
      }, 2000); // Increased delay to avoid duplicate calls

      return () => clearTimeout(retryTimeout);
    }
  }, [isConnected, counterId, canteenId, menuItems.length, joinCounterRoom]);

  // Fetch canteen info
  const { data: canteenInfo } = useQuery({
    queryKey: ['/api/system-settings/canteens', canteenId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${canteenId}`),
    enabled: !!canteenId,
  });

  // Fetch orders for this counter
  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/orders', canteenId, counterId, menuItems.length],
    queryFn: async () => {
      console.log('🍳 KotMode fetching orders for:', { canteenId, counterId });
      // Fetch all orders for the canteen and filter by kotCounterId
      const result = await apiRequest(`/api/orders?canteenId=${canteenId}`);
      console.log('🍳 KotMode orders API response (all orders):', result);
      console.log('🍳 KotMode orders with counter arrays:', result.map((order: any) => ({
        orderNumber: order.orderNumber,
        kotCounterId: order.kotCounterId,
        allKotCounterIds: order.allKotCounterIds,
        allCounterIds: order.allCounterIds,
        itemsCount: order.items ? (typeof order.items === 'string' ? JSON.parse(order.items).length : order.items.length) : 0
      })));

      // Filter orders that belong to this KOT counter and filter items within each order
      // IMPORTANT: Always check items first, as allKotCounterIds might be incomplete
      const filteredOrders = result.map((order: any) => {
        console.log(`🍳 Filtering order ${order.orderNumber} for KOT counter ${counterId}:`, {
          orderKotCounterId: order.kotCounterId,
          orderAllKotCounterIds: order.allKotCounterIds,
          orderAllCounterIds: order.allCounterIds,
          targetCounterId: counterId,
          hasAllKotCounterIds: !!order.allKotCounterIds,
          hasAllCounterIds: !!order.allCounterIds
        });

        // Use simplified filtering - check if counter is in allKotCounterIds and filter items by item.kotCounterId
        return filterOrderForCounter(order, counterId);
      }).filter((order: any) => order !== null); // Remove null orders

      console.log('🍳 KotMode filtered orders for KOT counter:', filteredOrders);

      return filteredOrders;
    },
    enabled: !!counterId && !!canteenId && menuItems.length > 0,
    // No polling - only WebSocket updates
  });

  // Handle deep linking/highlighting of orders
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightOrderNumber = params.get('highlight');
    if (highlightOrderNumber && orders.length > 0) {
      // Small timeout to ensure DOM is rendered
      setTimeout(() => {
        const element = document.getElementById(`order-card-${highlightOrderNumber}`);
        if (element) {
          console.log(`🔦 Highlighting order ${highlightOrderNumber}`);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add visual highlight
          element.classList.add('ring-4', 'ring-primary', 'ring-offset-2', 'z-10');
          // Remove highlight after 5 seconds
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-primary', 'ring-offset-2', 'z-10');
          }, 5000);
        } else {
          console.log(`❌ Could not find element order-card-${highlightOrderNumber}`);
        }
      }, 1000);
    }
  }, [orders, window.location.search]);

  console.log('🍳 KotMode menu items data:', {
    menuItemsData,
    menuItems,
    menuItemsLength: menuItems.length,
    isArray: Array.isArray(menuItems)
  });

  console.log('🍳 KotMode useQuery state:', {
    isLoading,
    error,
    ordersCount: orders.length,
    enabled: !!counterId && !!canteenId,
    counterId,
    canteenId
  });

  // Mark order as ready mutation
  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => {
      // Validate orderId
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      return apiRequest(`/api/orders/${orderId}/mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      });
    },
    onSuccess: (updatedOrder) => {
      // Update cache optimistically first for immediate UI feedback
      const filteredOrder = filterOrderForCounter(updatedOrder, counterId);
      if (filteredOrder) {
        // Use exact query key including menuItems.length
        queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
          if (!oldData) return [filteredOrder];

          const existingIndex = oldData.findIndex((o: any) =>
            o.id === filteredOrder.id || o.orderNumber === filteredOrder.orderNumber
          );

          if (existingIndex >= 0) {
            // Update existing order - merge itemStatusByCounter to ensure all updates are reflected
            const updated = [...oldData];
            const existingOrder = updated[existingIndex];
            updated[existingIndex] = {
              ...filteredOrder,
              // Preserve itemStatusByCounter from updatedOrder to ensure all counter statuses are included
              itemStatusByCounter: updatedOrder.itemStatusByCounter || filteredOrder.itemStatusByCounter || existingOrder.itemStatusByCounter
            };
            return updated;
          } else {
            // Add new order
            return [...oldData, filteredOrder];
          }
        });
      }

      // Also invalidate to ensure we get the latest data from server
      // This ensures subsequent updates work correctly
      queryClient.invalidateQueries({
        queryKey: ['/api/orders', canteenId, counterId, menuItems.length],
        refetchType: 'active' // Only refetch active queries
      });
    },
    onError: (error: any) => {
      console.error('Failed to mark order as ready:', error.message || 'Unknown error');
      // On error, invalidate to get fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId, menuItems.length] });
    },
  });

  // Note: Delivery and barcode scanning functionality removed for KOT counters
  // KOT counters only mark items as ready

  // Helper function to check if order has markable items (same as main dashboard)
  const hasMarkableItems = (order: Order) => {
    try {
      // Safety check for menuItems
      if (!Array.isArray(menuItems)) {
        console.log('🔍 menuItems is not an array:', menuItems);
        return false;
      }

      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      console.log('🔍 Checking order for markable items:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        items: items,
        itemsLength: items?.length,
        menuItemsLength: menuItems.length
      });

      // Use item.isMarkable directly (included in order items during creation)
      const hasMarkable = items.some((item: any) => {
        // Check isMarkable from item itself (added during order creation)
        const isMarkable = item.isMarkable === true;

        console.log('🔍 Checking item:', {
          itemName: item.name,
          itemId: item.id,
          isMarkable: isMarkable,
          itemHasIsMarkable: 'isMarkable' in item,
          itemData: { isMarkable: item.isMarkable, storeCounterId: item.storeCounterId }
        });

        return isMarkable;
      });

      console.log('🔍 Order has markable items:', hasMarkable);
      return hasMarkable;
    } catch (error) {
      console.error('Error parsing order items:', error);
      return false;
    }
  };

  // Helper function to check if THIS counter has markable items in the order that are NOT yet ready
  const hasMarkableItemsForCounter = (order: Order) => {
    try {
      // Safety check for menuItems
      if (!Array.isArray(menuItems)) {
        console.log('🔍 menuItems is not an array:', menuItems);
        return false;
      }

      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

      // Get item status for this counter
      const counterItemStatus = order.itemStatusByCounter?.[counterId] || {};

      // Filter items that belong to this KOT counter AND are markable AND not yet ready
      // Use item.kotCounterId and item.isMarkable directly (included in order items during creation)
      const counterItems = items.filter((item: any) => {
        // Check if item belongs to this KOT counter using item.kotCounterId
        const belongsToCounter = item.kotCounterId === counterId;
        if (!belongsToCounter) return false;

        // Check if item is markable using item.isMarkable (added during order creation)
        const isMarkable = item.isMarkable === true;
        if (!isMarkable) {
          console.log(`⏭️ Item ${item.name} (${item.id}) skipped - not markable`, {
            itemIsMarkable: item.isMarkable,
            itemHasIsMarkable: 'isMarkable' in item
          });
          return false;
        }

        // Check if item is NOT already ready, out_for_delivery, or completed
        const itemStatus = counterItemStatus[item.id] || 'pending';
        const isNotReady = itemStatus !== 'ready' && itemStatus !== 'completed' && itemStatus !== 'out_for_delivery';

        if (isNotReady) {
          console.log(`✅ Item ${item.name} (${item.id}) is markable and NOT ready - status: ${itemStatus}`);
        } else {
          console.log(`⏭️ Item ${item.name} (${item.id}) skipped - already ready/out_for_delivery/completed`);
        }

        return isNotReady;
      });

      const hasMarkable = counterItems.length > 0;

      console.log('🔍 Counter has markable items (not ready):', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        counterId,
        counterItemsCount: counterItems.length,
        hasMarkable,
        counterItems: counterItems.map((item: any) => ({
          name: item.name,
          id: item.id,
          status: counterItemStatus[item.id] || 'pending'
        }))
      });

      return hasMarkable;
    } catch (error) {
      console.error('Error checking counter markable items:', error);
      return false;
    }
  };

  // Helper function to check if THIS counter has any items (to determine if we should show Scan QR for auto-ready items)
  const hasCounterItems = (order: Order) => {
    try {
      if (!Array.isArray(menuItems)) {
        return false;
      }

      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

      // Check if any items belong to this KOT counter
      // Use item.kotCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.kotCounterId === counterId);

      return counterItems.length > 0;
    } catch (error) {
      console.error('Error checking counter items:', error);
      return false;
    }
  };

  // Helper function to check if items for this counter are ready
  const areCounterItemsReady = (order: Order) => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const counterItemStatus = order.itemStatusByCounter?.[counterId] || {};

      // Check if all items belonging to this KOT counter are ready
      // Use item.kotCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.kotCounterId === counterId);

      if (counterItems.length === 0) return false;

      // For each item, check if it's ready
      return counterItems.every((item: any) => {
        // For auto-ready items (not markable), check order status
        if (item.isMarkable !== true) {
          return order.status === 'ready' || order.status === 'preparing' || order.status === 'out_for_delivery';
        }
        // For markable items, check itemStatusByCounter
        const itemStatus = counterItemStatus[item.id];
        return itemStatus === 'ready' || itemStatus === 'out_for_delivery' || itemStatus === 'completed';
      });
    } catch (error) {
      console.error('Error checking counter items ready status:', error);
      return false;
    }
  };

  // Note: areCounterItemsOutForDelivery removed - not needed for KOT counters

  // Helper function to check if all items for this counter are completed/delivered
  const areCounterItemsCompleted = (order: Order) => {
    try {
      if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
        return false;
      }

      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const counterItemStatus = order.itemStatusByCounter[counterId];

      // Check if all items belonging to this KOT counter are ready
      // Use item.kotCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.kotCounterId === counterId);

      return counterItems.every((item: any) => counterItemStatus[item.id] === 'completed');
    } catch (error) {
      console.error('Error checking counter items completed status:', error);
      return false;
    }
  };

  // Helper function to get item status for this counter
  const getItemStatus = (order: Order, itemId: string, item: any) => {
    try {
      // If item is not markable (auto-ready), check order status
      // Auto-ready items are considered ready if order is ready or preparing
      if (item.isMarkable !== true) {
        if (order.status === 'ready' || order.status === 'preparing' || order.status === 'out_for_delivery') {
          return 'ready';
        }
        return 'pending';
      }

      // For markable items, check itemStatusByCounter
      if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
        return 'pending';
      }
      return order.itemStatusByCounter[counterId][itemId] || 'pending';
    } catch (error) {
      console.error('Error getting item status:', error);
      return 'pending';
    }
  };

  // Note: KOT preparation indicator logic removed - not needed in KOT counter itself

  // Categorize orders - exclude orders where this counter has already delivered their items
  // Memoize active orders filter to avoid recalculating on every render
  const activeOrders = useMemo(() => {
    return orders.filter((order: Order) => {
      const orderStatus = order.status;
      // Include active statuses for KOT counter
      const isActiveStatus = ['pending', 'preparing', 'ready', 'pending_kot'].includes(orderStatus);

      if (!isActiveStatus) return false;

      // Check if this counter has already delivered their items
      const counterItemsCompleted = areCounterItemsCompleted(order);
      return !counterItemsCompleted;
    });
  }, [orders, counterId]);

  // Memoize prep required orders filter to avoid recalculating on every render
  const prepRequiredOrders = useMemo(() => {
    return orders.filter((order: Order) => {
      const isPending = order.status === 'pending';
      if (!isPending) return false;

      // Check if THIS counter has markable items that are NOT ready
      // This is counter-specific - only check items belonging to this counter
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const itemStatusByCounter = order.itemStatusByCounter || {};

        // Filter markable items that belong to THIS KOT counter
        const counterMarkableItems = items.filter((item: any) => {
          return item.kotCounterId === counterId && item.isMarkable === true;
        });

        // If this counter has no markable items, exclude from prep required
        if (counterMarkableItems.length === 0) {
          return false;
        }

        // Check if all markable items for THIS counter are ready
        let allCounterMarkableItemsReady = true;
        for (const item of counterMarkableItems) {
          const itemStatus = itemStatusByCounter[counterId]?.[item.id];
          if (itemStatus !== 'ready' && itemStatus !== 'completed') {
            allCounterMarkableItemsReady = false;
            break;
          }
        }

        const counterItemsCompleted = areCounterItemsCompleted(order);

        // Show in prep required if:
        // 1. Order is pending
        // 2. This counter has markable items that are NOT all ready
        // 3. This counter's items are not all completed
        return !allCounterMarkableItemsReady && !counterItemsCompleted;
      } catch (error) {
        return false;
      }
    });
  }, [orders, counterId]);

  // Filter orders based on search
  const filteredActiveOrders = activeOrders.filter((order: Order) =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPrepOrders = prepRequiredOrders.filter((order: Order) =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Debug categorization results
  console.log('🔍 Final categorization results:', {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    prepRequiredOrders: prepRequiredOrders.length,
    filteredActiveOrders: filteredActiveOrders.length,
    filteredPrepOrders: filteredPrepOrders.length,
    prepRequiredOrderIds: prepRequiredOrders.map((o: any) => o.id),
    activeOrderIds: activeOrders.map((o: any) => o.id)
  });

  // Helper functions
  const getStatusBadge = (order: Order) => {
    if (order.status === 'ready') {
      return <div className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 text-xs font-medium px-2 py-1 rounded-full shadow-sm">Ready</div>;
    } else if (order.status === 'preparing') {
      return <div className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 text-xs font-medium px-2 py-1 rounded-full shadow-sm">Preparing</div>;
    } else if (order.status === 'pending') {
      return <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-foreground text-xs font-medium px-2 py-1 rounded-full shadow-sm">Pending</div>;
    }
    return null;
  };

  const getPrepBadge = (order: Order) => {
    // Check if there are still markable items that need prep for this counter
    const hasMarkableForCounter = hasMarkableItemsForCounter(order);

    if (hasMarkableForCounter) {
      return <div className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 text-xs font-medium px-2 py-1 rounded-full shadow-sm">Prep Required</div>;
    } else {
      return <div className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 text-xs font-medium px-2 py-1 rounded-full shadow-sm">Auto-Ready</div>;
    }
  };

  const getPriorityBadge = (order: Order) => {
    // Add priority logic based on order age or other factors
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    const isOld = orderAge > 15 * 60 * 1000; // 15 minutes
    if (isOld) {
      return <div className="bg-gradient-to-r from-red-100 to-red-200 text-red-800 text-xs font-medium px-2 py-1 rounded-full shadow-sm animate-pulse">Priority</div>;
    }
    return null;
  };

  const formatOrderTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Modal handlers
  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  // Removed barcode and delivery handlers - not needed for KOT counters

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive">Failed to load KOT counter data</p>
          <Button onClick={() => refetch()} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-4 md:px-6 py-3 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <ChefHat className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h1 className="text-lg md:text-xl font-bold">
                    {canteenInfo?.canteen?.name || 'CANTEEN'} - KOT Counter
                  </h1>
                  <div className="flex items-center space-x-1" title={
                    isConnected
                      ? `WebSocket connected to counter room: ${counterId}`
                      : 'WebSocket disconnected - orders will not update in real-time'
                  }>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Kitchen Order Ticket</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-md">
              <Radio className="h-4 w-4" />
              <span>Live Orders</span>
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                title={isConnected ? 'Real-time updates active' : 'Real-time updates unavailable'}
              ></div>
            </div>
            <button
              onClick={() => {
                console.log('🏪 Manual join counter room test:', counterId);
                joinCounterRoom(counterId, canteenId);
              }}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Test Join Room
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/canteen-owner-dashboard/${canteenId}`)}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Exit KOT Counter</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 h-full">
          {/* Active Orders Panel */}
          <div className="h-full bg-muted/50 p-3 md:p-4 border-r">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-4 w-4 md:h-5 md:w-5" />
                <h2 className="text-base md:text-lg font-semibold">Active Orders</h2>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-red-100 text-red-800 text-sm px-2 py-1">
                  {filteredActiveOrders.length}
                </Badge>
              </div>
            </div>

            <div className="mb-3 md:mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search active orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm md:text-base"
                />
              </div>
            </div>

            <div className="space-y-2 md:space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto counter-scrollbar pr-2">
              {filteredActiveOrders.map((order: Order) => {
                const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

                return (
                  <Card key={order.id} id={`order-card-${order.orderNumber}`} onClick={() => handleOrderClick(order)} className="group relative overflow-hidden bg-gradient-to-br from-card to-green-50/30 dark:to-green-950/30 border border-green-200/50 dark:border-green-800/50 hover:border-green-300 dark:hover:border-green-700 hover:shadow-xl transition-all duration-300 cursor-pointer mb-3 rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <CardContent className="relative p-4">
                      {/* Compact Header with Order ID and Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center bg-card rounded-lg px-2 py-1.5 shadow-sm border border-border">
                            <span className="text-sm font-semibold text-foreground">
                              #{formatted.prefix}
                            </span>
                            <div className="ml-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                              {formatted.highlighted}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusBadge(order)}
                          <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-foreground text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                            {order.estimatedTime || 15}m
                          </div>
                          {getPrepBadge(order)}
                        </div>
                      </div>

                      {/* Compact Customer and Items Section */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-foreground">Customer: {order.customerName}</span>
                        </div>
                        <div className="bg-card rounded-lg p-2 border border-border">
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            {items.map((item: any, index: number) => {
                              const itemStatus = getItemStatus(order, item.id, item);
                              const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery';
                              const isCompleted = itemStatus === 'completed';
                              const isOutForDelivery = itemStatus === 'out_for_delivery';
                              return (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-600' :
                                      isReady ? 'bg-green-500' : 'bg-yellow-500'
                                      }`}></div>
                                    <span className={`font-medium ${isCompleted ? 'text-green-800' :
                                      isReady ? 'text-green-700' : 'text-foreground'
                                      }`}>
                                      {item.quantity}x {item.name}
                                    </span>
                                    {isCompleted && (
                                      <div className="bg-green-200 text-green-900 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                        Delivered
                                      </div>
                                    )}
                                    {isReady && !isCompleted && (
                                      <div className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                                        Ready
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">₹{item.price}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Compact Bottom Section with Action Button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="text-xl font-bold text-warning">
                            ₹{order.itemsSubtotal ?? order.amount}
                          </div>
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatOrderTime(order.createdAt)}</span>
                          </div>
                        </div>

                        {/* Small Action Button in Bottom Right */}
                        {(() => {
                          const counterItemsCompleted = areCounterItemsCompleted(order);
                          const hasMarkableForCounter = hasMarkableItemsForCounter(order);
                          const hasItemsForCounter = hasCounterItems(order);
                          const counterItemsReady = areCounterItemsReady(order);

                          console.log('🔍 Button logic check:', {
                            orderNumber: order.orderNumber,
                            counterId,
                            counterItemsCompleted,
                            hasMarkableForCounter,
                            hasItemsForCounter,
                            counterItemsReady,
                            orderStatus: order.status,
                          });

                          if (counterItemsCompleted) {
                            // Items for this counter are completed - Show completed indicator
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Delivered</span>
                              </div>
                            );
                          } else if (hasMarkableForCounter) {
                            // FIXED: If there are markable items for this counter that are NOT ready, show Mark Ready button
                            // This takes priority over other checks - markable items must be marked ready first
                            return (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Get order ID - try id, _id, or orderNumber
                                  const orderAny = order as any;
                                  const orderId = order.id || orderAny._id || order.orderNumber;
                                  if (!orderId) {
                                    console.error('❌ Order ID not found in order object:', order);
                                    return;
                                  }
                                  markReadyMutation.mutate(orderId);
                                }}
                                disabled={markReadyMutation.isPending}
                                size="sm"
                                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {markReadyMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Mark Ready
                                  </>
                                )}
                              </Button>
                            );
                          } else if (counterItemsReady || (!hasMarkableForCounter && hasItemsForCounter)) {
                            // Items for this KOT counter are ready - show ready status
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Ready</span>
                              </div>
                            );
                          } else if (order.status === 'ready' || order.status === 'pending_kot' || areCounterItemsReady(order)) {
                            // Order is ready - show ready status
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Ready</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Prep Required Orders Panel */}
          <div className="h-full bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">▲ Prep Required Orders</h2>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Orders requiring manual preparation (unseen orders prioritized)
            </p>

            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto counter-scrollbar pr-2">
              {filteredPrepOrders.map((order: Order) => {
                const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

                return (
                  <Card key={order.id} id={`order-card-${order.orderNumber}`} onClick={() => handleOrderClick(order)} className="group relative overflow-hidden bg-gradient-to-br from-card to-orange-50/30 dark:to-orange-950/30 border border-orange-200/50 dark:border-orange-800/50 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-xl transition-all duration-300 cursor-pointer mb-3 rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <CardContent className="relative p-4">
                      {/* Compact Header with Order ID and Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center bg-card rounded-lg px-2 py-1.5 shadow-sm border border-border">
                            <span className="text-sm font-semibold text-foreground">
                              #{formatted.prefix}
                            </span>
                            <div className="ml-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                              {formatted.highlighted}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusBadge(order)}
                          <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-foreground text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                            {order.estimatedTime || 15}m
                          </div>
                          {getPrepBadge(order)}
                          {getPriorityBadge(order)}
                        </div>
                      </div>

                      {/* Compact Customer and Items Section */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                          <span className="text-sm font-medium text-foreground">Customer: {order.customerName}</span>
                        </div>
                        <div className="bg-card rounded-lg p-2 border border-border">
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            {items.map((item: any, index: number) => {
                              const itemStatus = getItemStatus(order, item.id, item);
                              const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery';
                              const isCompleted = itemStatus === 'completed';
                              const isOutForDelivery = itemStatus === 'out_for_delivery';
                              return (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-600' :
                                      isReady ? 'bg-green-500' : 'bg-yellow-500'
                                      }`}></div>
                                    <span className={`font-medium ${isCompleted ? 'text-green-800' :
                                      isReady ? 'text-green-700' : 'text-foreground'
                                      }`}>
                                      {item.quantity}x {item.name}
                                    </span>
                                    {isCompleted && (
                                      <div className="bg-green-200 text-green-900 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                        Delivered
                                      </div>
                                    )}
                                    {isReady && !isCompleted && (
                                      <div className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                                        Ready
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">₹{item.price}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Compact Bottom Section with Action Button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="text-xl font-bold text-success">
                            ₹{order.itemsSubtotal ?? order.amount}
                          </div>
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatOrderTime(order.createdAt)}</span>
                          </div>
                        </div>

                        {/* Small Action Button in Bottom Right */}
                        {(() => {
                          const counterItemsCompleted = areCounterItemsCompleted(order);
                          const hasMarkableForCounter = hasMarkableItemsForCounter(order);
                          const hasItemsForCounter = hasCounterItems(order);
                          const counterItemsReady = areCounterItemsReady(order);

                          console.log('🔍 Button logic check:', {
                            orderNumber: order.orderNumber,
                            counterId,
                            counterItemsCompleted,
                            hasMarkableForCounter,
                            hasItemsForCounter,
                            counterItemsReady,
                            orderStatus: order.status,
                          });

                          if (counterItemsCompleted) {
                            // Items for this counter are completed - Show completed indicator
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Delivered</span>
                              </div>
                            );
                          } else if (hasMarkableForCounter) {
                            // FIXED: If there are markable items for this counter that are NOT ready, show Mark Ready button
                            // This takes priority over other checks - markable items must be marked ready first
                            return (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Get order ID - try id, _id, or orderNumber
                                  const orderAny = order as any;
                                  const orderId = order.id || orderAny._id || order.orderNumber;
                                  if (!orderId) {
                                    console.error('❌ Order ID not found in order object:', order);
                                    return;
                                  }
                                  markReadyMutation.mutate(orderId);
                                }}
                                disabled={markReadyMutation.isPending}
                                size="sm"
                                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {markReadyMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Mark Ready
                                  </>
                                )}
                              </Button>
                            );
                          } else if (counterItemsReady || (!hasMarkableForCounter && hasItemsForCounter)) {
                            // Items for this KOT counter are ready - show ready status
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Ready</span>
                              </div>
                            );
                          } else if (order.status === 'ready' || order.status === 'pending_kot' || areCounterItemsReady(order)) {
                            // Order is ready - show ready status
                            return (
                              <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Ready</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onScanBarcode={undefined} // Not needed for KOT counters
      />
    </div>
  );
}

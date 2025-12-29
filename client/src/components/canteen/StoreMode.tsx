import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatOrderIdDisplay } from '@shared/utils';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';
import BarcodeScanModal from '@/components/modals/BarcodeScanModal';
import OrderFoundModal from '@/components/orders/OrderFoundModal';
import OrderNotFoundModal from '@/components/orders/OrderNotFoundModal';

import DeliveryPersonSelectModal from '@/components/canteen/DeliveryPersonSelectModal';
// Removed PanelGroup import - using custom layout instead
import { 
  Store, 
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
  CheckSquare,
  Loader2,
  QrCode,
  AlertTriangle,
  Zap,
  Truck,
  Receipt
} from 'lucide-react';

interface StoreModeProps {
  counterId: string;
  canteenId: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  status: string;
  items: string;
  createdAt: Date;
  estimatedTime: number;
  isMarkable?: boolean;
  paymentStatus?: string;
  barcode?: string;
  orderType?: 'delivery' | 'takeaway';
  deliveryPersonId?: string;
  deliveryAddress?: {
    label?: string;
    fullName?: string;
    phoneNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  itemStatusByCounter?: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'out_for_delivery' | 'completed' } };
}

interface CanteenInfo {
  name: string;
  id: string;
}

// NEW SIMPLIFIED LOGIC: Filter items by checking item.storeCounterId directly
// Helper function to filter items in an order for a specific counter
function filterOrderItems(order: any, counterId: string): any | null {
  if (!order || !order.items) return null;
  
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  
  // Filter items that belong to this counter by checking item.storeCounterId
  const relevantItems = items.filter((item: any) => {
    // Check if item has storeCounterId and it matches this counter
    const belongsToCounter = item.storeCounterId === counterId;
    
    if (belongsToCounter) {
      console.log(`✅ Item ${item.name} belongs to counter ${counterId}`, {
        itemName: item.name,
        itemStoreCounterId: item.storeCounterId,
        targetCounterId: counterId
      });
    }
    
    return belongsToCounter;
  });
  
  if (relevantItems.length > 0) {
    console.log(`✅ Order ${order.orderNumber} has ${relevantItems.length} relevant items (out of ${items.length} total) for store counter ${counterId}`);
    // Return a filtered order with only the relevant items
    return {
      ...order,
      items: JSON.stringify(relevantItems)
    };
  }
  
  console.log(`❌ Order ${order.orderNumber} has no items for store counter ${counterId} (checked ${items.length} items)`);
  return null;
}

// Helper function to filter orders for specific counter
function filterOrderForCounter(order: any, counterId: string): any | null {
  if (!order) return null;
  
  // Check if the counter is in the allStoreCounterIds array (order should be broadcasted to this counter)
  const shouldShowOrder = order.allStoreCounterIds && order.allStoreCounterIds.includes(counterId);
  
  if (!shouldShowOrder) {
    console.log(`❌ Order ${order.orderNumber} not broadcasted to counter ${counterId}`, {
      allStoreCounterIds: order.allStoreCounterIds,
      targetCounterId: counterId
    });
    return null;
  }
  
  // Filter items for this counter
  return filterOrderItems(order, counterId);
}

// Helper function to check if counter has already delivered their items in an order
function hasCounterDeliveredItems(order: any, counterId: string): boolean {
  try {
    if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
      return false;
    }
    
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const counterItemStatus = order.itemStatusByCounter[counterId];
    
    // Check if all items belonging to this counter are completed
    // Use item.storeCounterId directly (no menu item lookup needed)
    const counterItems = items.filter((item: any) => item.storeCounterId === counterId);
    
    return counterItems.length > 0 && counterItems.every((item: any) => 
      counterItemStatus[item.id] === 'completed'
    );
  } catch (error) {
    console.error('Error checking if counter has delivered items:', error);
    return false;
  }
}

export default function StoreMode({ counterId, canteenId }: StoreModeProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showPrepSection, setShowPrepSection] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = "Store Counter | KIT-CANTEEN Owner Dashboard";
  }, []);
  
  // Track mobile viewport for compact controls
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowPrepSection(true); // always show prep panel on larger screens
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [currentOrderForBarcode, setCurrentOrderForBarcode] = useState<any>(null);
  const [isOrderFoundModalOpen, setIsOrderFoundModalOpen] = useState(false);
  const [isOrderNotFoundModalOpen, setIsOrderNotFoundModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [isDeliveryPersonModalOpen, setIsDeliveryPersonModalOpen] = useState(false);
  const [currentOrderForDelivery, setCurrentOrderForDelivery] = useState<any>(null);
  const [showConsolidatedModal, setShowConsolidatedModal] = useState(false);
  // Removed isLiveMode state - now purely WebSocket-based

  console.log('🏪 StoreMode component mounted with:', { counterId, canteenId });

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
      console.log('🏪 StoreMode received new order:', {
        orderNumber: order.orderNumber,
        storeCounterId: order.storeCounterId,
        allStoreCounterIds: order.allStoreCounterIds,
        allCounterIds: order.allCounterIds,
        items: order.items?.length,
        counterId,
        canteenId,
        fullOrder: order
      });
      
      // Check if this order is relevant to this counter
      const isRelevantToCounter = order.allStoreCounterIds?.includes(counterId) || 
                                  order.allCounterIds?.includes(counterId) || 
                                  order.storeCounterId === counterId;
      
      console.log('🏪 StoreMode order relevance check:', {
        orderNumber: order.orderNumber,
        counterId,
        isRelevantToCounter,
        allStoreCounterIds: order.allStoreCounterIds,
        allCounterIds: order.allCounterIds,
        storeCounterId: order.storeCounterId,
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
      // Check if this order is relevant to this counter
      const isRelevantToCounter = order?.allStoreCounterIds?.includes(counterId) || 
                                  order?.allCounterIds?.includes(counterId) || 
                                  order?.storeCounterId === counterId;
      
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
      // Check if this order is relevant to this counter
      const isRelevantToCounter = order?.allStoreCounterIds?.includes(counterId) || 
                                  order?.allCounterIds?.includes(counterId) || 
                                  order?.storeCounterId === counterId;
      
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
      // Handle item-level status changes (from mark-ready or out-for-delivery)
      const isRelevantToCounter = order?.allStoreCounterIds?.includes(counterId) || 
                                  order?.allCounterIds?.includes(counterId) || 
                                  order?.storeCounterId === counterId;
      
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
      console.log('🏪 StoreMode WebSocket connected, attempting to join counter room:', counterId);
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
    console.log('🏪 StoreMode useEffect - WebSocket connection status:', {
      isConnected,
      counterId,
      canteenId,
      menuItemsLength: menuItems.length,
      shouldJoin: isConnected && counterId && canteenId && menuItems.length > 0
    });
    
    console.log('🏪 StoreMode - Attempting to join counter room:', {
      counterId,
      canteenId,
      isConnected,
      menuItemsLoaded: menuItems.length > 0
    });
    
    if (isConnected && counterId && canteenId && menuItems.length > 0) {
      // Add a small delay to ensure WebSocket is fully connected
      const timeoutId = setTimeout(() => {
        console.log('🏪 StoreMode attempting to join counter room:', counterId);
        joinCounterRoom(counterId, canteenId);
        console.log('🏪 StoreMode joinCounterRoom called for:', counterId);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        if (counterId) {
          leaveCounterRoom(counterId);
          console.log('🏪 StoreMode left counter room:', counterId);
        }
      };
    }
  }, [isConnected, counterId, canteenId, menuItems.length, joinCounterRoom, leaveCounterRoom]);

  // Additional effect to retry joining if not successful (only if menuItems are loaded)
  useEffect(() => {
    if (isConnected && counterId && canteenId && menuItems.length > 0) {
      // Only retry if the first effect didn't successfully join
      const retryTimeout = setTimeout(() => {
        console.log('🏪 StoreMode retry: attempting to join counter room again:', counterId);
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
      console.log('🏪 StoreMode fetching orders for:', { canteenId, counterId });
      // Fetch all orders for the canteen and filter by storeCounterId
      const result = await apiRequest(`/api/orders?canteenId=${canteenId}`);
      console.log('🏪 StoreMode orders API response (all orders):', result);
      console.log('🏪 StoreMode orders with counter arrays:', result.map((order: any) => ({
        orderNumber: order.orderNumber,
        storeCounterId: order.storeCounterId,
        allStoreCounterIds: order.allStoreCounterIds,
        allCounterIds: order.allCounterIds,
        itemsCount: order.items ? (typeof order.items === 'string' ? JSON.parse(order.items).length : order.items.length) : 0
      })));
      
      // Filter orders that belong to this store counter and filter items within each order
      // IMPORTANT: Always check items first, as allStoreCounterIds might be incomplete
      const filteredOrders = result.map((order: any) => {
        console.log(`🏪 Filtering order ${order.orderNumber} for counter ${counterId}:`, {
          orderStoreCounterId: order.storeCounterId,
          orderAllStoreCounterIds: order.allStoreCounterIds,
          orderAllCounterIds: order.allCounterIds,
          targetCounterId: counterId,
          hasAllStoreCounterIds: !!order.allStoreCounterIds,
          hasAllCounterIds: !!order.allCounterIds
        });
        
        // Use simplified filtering - check if counter is in allStoreCounterIds and filter items by item.storeCounterId
        return filterOrderForCounter(order, counterId);
      }).filter((order: any) => order !== null); // Remove null orders
      
      console.log('🏪 StoreMode filtered orders for store counter:', filteredOrders);
      
      return filteredOrders;
    },
    enabled: !!counterId && !!canteenId && menuItems.length > 0,
    // Polling fallback when WebSocket is disconnected
    refetchInterval: (query) => {
      // Only poll if WebSocket is not connected
      if (!isConnected) {
        return 5000; // Poll every 5 seconds when WebSocket is disconnected
      }
      return false; // No polling when WebSocket is connected
    },
    refetchIntervalInBackground: true, // Continue polling even when tab is in background
  });

  console.log('🏪 StoreMode menu items data:', {
    menuItemsData,
    menuItems,
    menuItemsLength: menuItems.length,
    isArray: Array.isArray(menuItems)
  });

  console.log('🏪 StoreMode useQuery state:', { 
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

  // Mark order as out for delivery mutation
  const markOutForDeliveryMutation = useMutation({
    mutationFn: ({ orderId, deliveryPersonId, deliveryPersonEmail }: { orderId: string; deliveryPersonId: string; deliveryPersonEmail: string | null }) => {
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      if (!deliveryPersonId) {
        throw new Error('Delivery person ID is required');
      }
      return apiRequest(`/api/orders/${orderId}/out-for-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          counterId,
          deliveryPersonId,
          deliveryPersonEmail
        }),
      });
    },
    onSuccess: (updatedOrder) => {
      console.log('🚚 markOutForDeliveryMutation onSuccess - updatedOrder:', {
        orderNumber: updatedOrder.orderNumber,
        itemStatusByCounter: updatedOrder.itemStatusByCounter,
        status: updatedOrder.status,
        deliveryPersonId: updatedOrder.deliveryPersonId
      });
      
      const filteredOrder = filterOrderForCounter(updatedOrder, counterId);
      if (filteredOrder) {
        queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
          if (!oldData) return [filteredOrder];
          const existingIndex = oldData.findIndex((o: any) => 
            o.id === filteredOrder.id || o.orderNumber === filteredOrder.orderNumber
          );
          if (existingIndex >= 0) {
            const updated = [...oldData];
            const existingOrder = updated[existingIndex];
            // Preserve the full itemStatusByCounter from the updated order (includes all counters)
            // This ensures we don't lose status updates from other counters
            updated[existingIndex] = {
              ...filteredOrder,
              // Use the full itemStatusByCounter from updatedOrder, not just the filtered one
              itemStatusByCounter: updatedOrder.itemStatusByCounter || existingOrder.itemStatusByCounter || filteredOrder.itemStatusByCounter,
              // Also preserve deliveryPersonId
              deliveryPersonId: updatedOrder.deliveryPersonId || existingOrder.deliveryPersonId,
              // Preserve order status
              status: updatedOrder.status || existingOrder.status
            };
            console.log('🚚 Updated cache for order:', {
              orderNumber: updated[existingIndex].orderNumber,
              itemStatusByCounter: updated[existingIndex].itemStatusByCounter,
              status: updated[existingIndex].status
            });
            return updated;
          }
          return [...oldData, filteredOrder];
        });
      }
      // Don't invalidate immediately - let WebSocket updates handle it
      // Only invalidate if WebSocket is not connected to ensure we get updates
      if (!isConnected) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/orders', canteenId, counterId, menuItems.length],
          refetchType: 'active'
        });
      }
    },
    onError: (error: any) => {
      console.error('Failed to mark order as out for delivery:', error.message || 'Unknown error');
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId, menuItems.length] });
    },
  });

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
      
      // Filter items that belong to this counter AND are markable AND not yet ready
      // Use item.storeCounterId and item.isMarkable directly (included in order items during creation)
      const counterItems = items.filter((item: any) => {
        // Check if item belongs to this counter using item.storeCounterId
        const belongsToCounter = item.storeCounterId === counterId;
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
      
      // Check if any items belong to this counter
      // Use item.storeCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.storeCounterId === counterId);
      
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
      
      // Check if all items belonging to this counter are ready
      // Use item.storeCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.storeCounterId === counterId);
      
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

  // Helper function to check if items for this counter are out for delivery
  const areCounterItemsOutForDelivery = (order: Order) => {
    try {
      if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
        return false;
      }
      
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const counterItemStatus = order.itemStatusByCounter[counterId];
      
      // Check if all ready items belonging to this counter are out for delivery
      // Use item.storeCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.storeCounterId === counterId);
      
      // Only check items that are markable (need preparation) or were ready
      // Items that are not markable (auto-ready) don't need to be marked out for delivery
      const markableOrReadyItems = counterItems.filter((item: any) => {
        const itemStatus = counterItemStatus[item.id] as 'pending' | 'ready' | 'out_for_delivery' | 'completed' | undefined;
        return item.isMarkable === true || itemStatus === 'ready' || itemStatus === 'out_for_delivery';
      });
      
      if (markableOrReadyItems.length === 0) {
        return false; // No items to check
      }
      
      // All markable/ready items must be out_for_delivery
      return markableOrReadyItems.every((item: any) => {
        const itemStatus = counterItemStatus[item.id] as 'pending' | 'ready' | 'out_for_delivery' | 'completed' | undefined;
        return itemStatus === 'out_for_delivery' || itemStatus === 'completed';
      });
    } catch (error) {
      console.error('Error checking counter items out for delivery status:', error);
      return false;
    }
  };

  // Helper function to check if all items for this counter are completed/delivered
  const areCounterItemsCompleted = (order: Order) => {
    try {
      if (!order.itemStatusByCounter || !order.itemStatusByCounter[counterId]) {
        return false;
      }
      
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const counterItemStatus = order.itemStatusByCounter[counterId];
      
      // Check if all items belonging to this counter are completed
      // Use item.storeCounterId directly (no menu item lookup needed)
      const counterItems = items.filter((item: any) => item.storeCounterId === counterId);
      
      return counterItems.every((item: any) => counterItemStatus[item.id] === 'completed');
    } catch (error) {
      console.error('Error checking counter items completed status:', error);
      return false;
    }
  };

  // Helper function to get item status for this counter
  const getItemStatus = (order: Order, itemId: string, item: any) => {
    try {
      // First, check itemStatusByCounter if it exists (for both markable and auto-ready items)
      if (order.itemStatusByCounter && order.itemStatusByCounter[counterId]) {
        const itemStatus = order.itemStatusByCounter[counterId][itemId];
        if (itemStatus) {
          return itemStatus;
        }
      }
      
      // If item is not markable (auto-ready), check order status as fallback
      // Auto-ready items are considered ready if order is ready or preparing
      if (item.isMarkable !== true) {
        if (order.status === 'ready' || order.status === 'preparing' || order.status === 'out_for_delivery') {
          return 'ready';
        }
        return 'pending';
      }
      
      // For markable items without itemStatusByCounter entry, return pending
      return 'pending';
    } catch (error) {
      console.error('Error getting item status:', error);
      return 'pending';
    }
  };

  // Helper function to check if items are still being prepared in KOT counters
  // Returns array of KOT counter info (id, name) that are still preparing items for this store counter
  const getKotCountersPreparing = (order: Order): Array<{ id: string; name: string }> => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const preparingKotCounters = new Map<string, string>(); // Map of KOT counter ID to name
      
      // Check each item that belongs to this store counter
      const storeCounterItems = items.filter((item: any) => 
        item.storeCounterId === counterId && item.isMarkable === true && item.kotCounterId
      );
      
      for (const item of storeCounterItems) {
        const kotCounterId = item.kotCounterId;
        if (!kotCounterId) continue;
        
        // Check if this item is ready in the KOT counter
        // If itemStatusByCounter doesn't have the KOT counter entry, or item is not ready, it's still preparing
        const kotCounterStatus = order.itemStatusByCounter?.[kotCounterId];
        const itemStatusInKot = kotCounterStatus?.[item.id];
        
        // If item is not ready in KOT counter, add KOT counter to preparing list
        if (itemStatusInKot !== 'ready' && itemStatusInKot !== 'completed' && itemStatusInKot !== 'out_for_delivery') {
          const kotCounter = counterMap.get(kotCounterId);
          if (kotCounter) {
            preparingKotCounters.set(kotCounterId, kotCounter.name);
          }
        }
      }
      
      // Return array of KOT counter info
      return Array.from(preparingKotCounters.entries()).map(([id, name]) => ({ id, name }));
    } catch (error) {
      console.error('Error checking KOT counters preparing:', error);
      return [];
    }
  };

  // Helper function to check if order has items still being prepared in KOT counters
  const hasItemsInKotPreparation = (order: Order): boolean => {
    return getKotCountersPreparing(order).length > 0;
  };

  // Categorize orders - exclude orders where this counter has already delivered their items
  // Memoize active orders filter to avoid recalculating on every render
  const activeOrders = useMemo(() => {
    return orders.filter((order: Order) => {
      const orderStatus = order.status;
      // Include 'out_for_delivery' status for delivery orders that need barcode scanning
      // Also include orders where items are out for delivery at counter level
      const isActiveStatus = ['pending', 'preparing', 'ready', 'out_for_delivery'].includes(orderStatus);
      const hasItemsOutForDelivery = areCounterItemsOutForDelivery(order);
      
      if (!isActiveStatus && !hasItemsOutForDelivery) return false;
      
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
        
        // Filter markable items that belong to THIS counter
        const counterMarkableItems = items.filter((item: any) => {
          return item.storeCounterId === counterId && item.isMarkable === true;
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

  // Consolidated pending items (not ready/out for delivery/completed) for this counter
  const consolidatedPendingItems = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; orderNumbers: Set<string> }>();

    filteredActiveOrders.forEach((order: Order) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

      items.forEach((item: any) => {
        // Only count items that belong to this counter
        if (!item.storeCounterId || item.storeCounterId !== counterId) return;

        const itemStatus = getItemStatus(order, item.id, item);
        const isPendingForCounter = !['ready', 'completed', 'out_for_delivery'].includes(itemStatus);

        if (!isPendingForCounter) return;

        const key = item.id || item.name;
        const existing = map.get(key) || { name: item.name, quantity: 0, orderNumbers: new Set<string>() };
        existing.quantity += item.quantity || 1;
        existing.orderNumbers.add(order.orderNumber || order.id);
        map.set(key, existing);
      });
    });

    return Array.from(map.values())
      .map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        orders: entry.orderNumbers.size
      }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
  }, [filteredActiveOrders, counterId]);

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
      return <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs font-semibold px-2 py-1 rounded-full shadow-sm">Ready</div>;
    } else if (order.status === 'preparing') {
      return <div className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary border border-primary/40 dark:border-primary/50 text-xs font-semibold px-2 py-1 rounded-full shadow-sm">Preparing</div>;
    } else if (order.status === 'pending') {
      return <div className="bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50 text-xs font-semibold px-2 py-1 rounded-full shadow-sm">Pending</div>;
    }
    return null;
  };

  const getPrepBadge = (order: Order) => {
    // Check if there are still markable items that need prep for this counter
    const hasMarkableForCounter = hasMarkableItemsForCounter(order);
    
    if (hasMarkableForCounter) {
      return <div className="bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50 text-xs font-semibold px-2 py-1 rounded-full shadow-sm">Prep Required</div>;
    } else {
      return <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs font-semibold px-2 py-1 rounded-full shadow-sm">Auto-Ready</div>;
    }
  };

  const getPriorityBadge = (order: Order) => {
    // Add priority logic based on order age or other factors
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    const isOld = orderAge > 15 * 60 * 1000; // 15 minutes
    if (isOld) {
      return <div className="bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive text-xs font-medium px-2 py-1 rounded-full shadow-sm animate-pulse">Priority</div>;
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

  const handleBarcodeScan = (order: any) => {
    setCurrentOrderForBarcode(order);
    // Close the order details modal first, then open barcode scan modal
    setIsModalOpen(false);
    setSelectedOrder(null);
    setIsBarcodeModalOpen(true);
  };

  const handleCloseBarcodeModal = () => {
    setIsBarcodeModalOpen(false);
    // Don't clear currentOrderForBarcode here - let the result modals handle it
  };

  const handleBackToOrder = () => {
    setIsBarcodeModalOpen(false);
    // Reopen the order details modal
    setSelectedOrder(currentOrderForBarcode);
    setIsModalOpen(true);
  };

  // Helper function to check if scanned barcode matches order (full barcode or first 4 digits)
  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;
    
    // Exact match
    if (scannedBarcode === orderBarcode) return true;
    
    // Check if scanned is first 4 digits of order barcode
    if (scannedBarcode.length === 4 && orderBarcode.length >= 4) {
      const first4Digits = orderBarcode.slice(0, 4);
      return scannedBarcode === first4Digits;
    }
    
    // Check if order barcode starts with scanned barcode (for partial matches)
    if (scannedBarcode.length < orderBarcode.length) {
      return orderBarcode.startsWith(scannedBarcode);
    }
    
    return false;
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      console.log('🔍 Barcode scanned:', barcode, 'for order:', currentOrderForBarcode?.id);
      console.log('🔍 Order barcode:', currentOrderForBarcode?.barcode);
      
      // Store the order data before closing the barcode modal
      const orderForVerification = currentOrderForBarcode;
      
      // Close the barcode scan modal first
      setIsBarcodeModalOpen(false);
      
      // Verify if the scanned barcode matches the order's barcode (full or first 4 digits)
      if (orderForVerification && matchesBarcode(barcode, orderForVerification.barcode)) {
        console.log('✅ Barcode/OTP matches! Showing order found modal');
        setScannedBarcode(barcode);
        setCurrentOrderForBarcode(orderForVerification); // Keep the order data
        setIsOrderFoundModalOpen(true);
      } else {
        console.log('❌ Barcode/OTP does not match! Showing order not found modal');
        setScannedBarcode(barcode);
        setCurrentOrderForBarcode(null); // Clear order data for not found
        setIsOrderNotFoundModalOpen(true);
      }
    } catch (error) {
      console.error('Error processing barcode scan:', error);
    }
  };

  const handleCloseOrderFoundModal = () => {
    setIsOrderFoundModalOpen(false);
    setCurrentOrderForBarcode(null);
  };

  const handleCloseOrderNotFoundModal = () => {
    setIsOrderNotFoundModalOpen(false);
    setCurrentOrderForBarcode(null);
  };

  const handleMarkDelivered = async () => {
    try {
      if (!currentOrderForBarcode) {
        console.error('❌ No order selected for delivery');
        return;
      }
      
      // Get order ID - try id, _id, or orderNumber
      const orderId = currentOrderForBarcode.id || currentOrderForBarcode._id || currentOrderForBarcode.orderNumber;
      
      if (!orderId) {
        console.error('❌ Order ID not found in order object:', currentOrderForBarcode);
        return;
      }
      
      setIsDelivering(true);
      console.log('📦 Marking order as delivered:', { orderId, orderNumber: currentOrderForBarcode.orderNumber });
      
      // Call the deliver API endpoint
      await apiRequest(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ counterId })
      });
      
      console.log('✅ Order marked as delivered successfully');
      
      // Update cache directly instead of invalidating
      queryClient.setQueryData(['/api/orders', canteenId, counterId, menuItems.length], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((o: any) => {
          const oId = o.id || o._id || o.orderNumber;
          if (oId === orderId) {
            return { ...o, status: 'delivered' };
          }
          return o;
        });
      });
      
      handleCloseOrderFoundModal();
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      // You could add a toast notification here for error feedback
    } finally {
      setIsDelivering(false);
    }
  };

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
          <p className="text-destructive">Failed to load store mode data</p>
          <Button onClick={() => refetch()} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-card border-b px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-start md:items-center space-x-3 md:space-x-4">
            <div className="flex items-center space-x-2">
              <Store className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-lg md:text-xl font-bold">
                    {canteenInfo?.canteen?.name || 'CANTEEN'} - Store Mode
                  </h1>
                  <div className="flex items-center space-x-1" title={
                    isConnected 
                      ? `WebSocket connected to counter room: ${counterId}` 
                      : 'WebSocket disconnected - orders will not update in real-time'
                  }>
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-success' : 'bg-destructive'
                    }`}></div>
                    <span className={`text-xs ${
                      isConnected ? 'text-success' : 'text-destructive'
                    }`}>
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Rush Business Mode</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-nowrap overflow-x-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConsolidatedModal(true)}
              className="flex items-center space-x-2 flex-shrink-0"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">
                Pending Items {consolidatedPendingItems.length > 0 ? `(${consolidatedPendingItems.length})` : ''}
              </span>
              {isMobile && consolidatedPendingItems.length > 0 && (
                <span className="sm:hidden">({consolidatedPendingItems.length})</span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center space-x-2 flex-shrink-0"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrepSection((prev) => !prev)}
                className="flex items-center space-x-2 flex-shrink-0"
                aria-label="Toggle prep required section"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>{showPrepSection ? "Hide Prep" : "Show Prep"}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/canteen-owner-dashboard/${canteenId}?tab=pos-billing`)}
              className="flex items-center space-x-2 flex-shrink-0"
              aria-label="Navigate to POS Billing"
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">POS Billing</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/canteen-owner-dashboard/${canteenId}`)}
              className="flex items-center space-x-2 flex-shrink-0"
              aria-label="Exit Store Mode"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Exit Store Mode</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 h-full">
          {/* Active Orders Panel */}
          <div className="h-full bg-muted/50 p-3 md:p-4 border-r flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-4 w-4 md:h-5 md:w-5" />
                <h2 className="text-base md:text-lg font-semibold">Active Orders</h2>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-2 py-1">
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

            <div className="space-y-2 md:space-y-3 flex-1 overflow-y-auto counter-scrollbar pr-2 min-h-0">
              {filteredActiveOrders.map((order: Order) => {
                const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                
                return (
                  <Card key={order.id} onClick={() => handleOrderClick(order)} className="group relative overflow-hidden bg-gradient-to-br from-card to-success/5 dark:to-success/10 border border-border hover:border-success/50 dark:hover:border-success/50 hover:shadow-xl transition-all duration-300 cursor-pointer mb-3 rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <CardContent className="relative p-4">
                      {/* Compact Header with Order ID and Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center bg-card rounded-lg px-2 py-1.5 shadow-sm border border-border">
                            <span className="text-sm font-semibold text-foreground">
                              #{formatted.prefix}
                            </span>
                            <div className="ml-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                              {formatted.highlighted}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusBadge(order)}
                          {order.estimatedTime && (
                            <div className="bg-muted text-muted-foreground border border-border text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                              {order.estimatedTime}m
                            </div>
                          )}
                          {getPrepBadge(order)}
                        </div>
                      </div>
                      
                      {/* KOT Preparation Indicator */}
                      {(() => {
                        const kotCountersPreparing = getKotCountersPreparing(order);
                        if (kotCountersPreparing.length > 0) {
                          return (
                            <div className="mb-3 p-2 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                <span className="text-sm font-medium text-primary">
                                  Preparing in KOT Counter: {kotCountersPreparing.map(k => k.name).join(', ')}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Compact Customer and Items Section */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                          <span className="text-sm font-medium text-foreground">Customer: {order.customerName}</span>
                        </div>
                        <div className="bg-card rounded-lg px-3 py-2 border border-border max-h-48">
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            {items.map((item: any, index: number) => {
                              const itemStatus = getItemStatus(order, item.id, item);
                              const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery';
                              const isCompleted = itemStatus === 'completed';
                              const isOutForDelivery = itemStatus === 'out_for_delivery';
                              return (
                                <div key={index} className="flex items-center justify-between gap-3 py-0.5">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      isCompleted ? 'bg-success' :
                                      isReady ? 'bg-success' : 'bg-warning'
                                    }`}></div>
                                    <span className={`font-medium truncate ${
                                      isCompleted ? 'text-success' :
                                      isReady ? 'text-success' : 'text-foreground'
                                    }`}>
                                      {item.quantity}x {item.name}
                                    </span>
                                    {isCompleted && (
                                      <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm flex-shrink-0">
                                        Delivered
                                      </div>
                                    )}
                                    {isReady && !isCompleted && (
                                      <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm flex-shrink-0">
                                        Ready
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground font-medium flex-shrink-0">₹{item.price}</span>
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
                            ₹{order.amount}
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
                          const itemsInKotPreparation = hasItemsInKotPreparation(order);
                          const kotCountersPreparing = getKotCountersPreparing(order);
                          
                          console.log('🔍 Button logic check:', {
                            orderNumber: order.orderNumber,
                            counterId,
                            counterItemsCompleted,
                            hasMarkableForCounter,
                            hasItemsForCounter,
                            counterItemsReady,
                            orderStatus: order.status,
                            itemsInKotPreparation,
                            kotCountersPreparing: kotCountersPreparing.map(k => k.name)
                          });
                          
                          if (counterItemsCompleted) {
                            // Items for this counter are completed - Show completed indicator
                            return (
                              <div className="flex items-center space-x-1 text-success text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Delivered</span>
                              </div>
                            );
                          } else if (itemsInKotPreparation) {
                            // Items are still being prepared in KOT counters - Hide buttons
                            // The indicator is shown above, so just return null for buttons
                            return null;
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
                                className="bg-warning hover:bg-warning/90 text-warning-foreground text-xs px-3 py-1.5 rounded-md shadow-lg hover:shadow-xl ring-2 ring-warning/20 hover:ring-warning/40 border border-warning/30 dark:border-warning/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                            // Items for this counter are ready OR items are not markable (auto-ready)
                            // For delivery orders, check if items are "out_for_delivery" at counter level - if not, show "Out for Delivery" button
                            // If items are "out_for_delivery" or it's a takeaway order, show "Scan Barcode"
                            const orderAny = order as any;
                            const isDeliveryOrder = orderAny.orderType === 'delivery';
                            const isOutForDelivery = areCounterItemsOutForDelivery(order);
                            const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                            
                            // If delivery person is already assigned, don't show "Out for Delivery" button
                            // The delivery person will handle the delivery
                            if (hasDeliveryPerson) {
                              // Delivery person assigned - show status or nothing
                              if (isOutForDelivery) {
                                return (
                                  <div className="flex items-center space-x-1 text-primary text-sm font-medium">
                                    <Truck className="h-4 w-4" />
                                    <span>Out for Delivery</span>
                                  </div>
                                );
                              }
                              return null;
                            }
                            
                            if (isDeliveryOrder && !isOutForDelivery) {
                              // Delivery order that's ready but not yet out for delivery - Show "Out for Delivery" button
                              return (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const orderAny = order as any;
                                    const orderId = order.id || orderAny._id || order.orderNumber;
                                    if (!orderId) {
                                      console.error('❌ Order ID not found in order object:', order);
                                      return;
                                    }
                                    setCurrentOrderForDelivery(order);
                                    setIsDeliveryPersonModalOpen(true);
                                  }}
                                  disabled={markOutForDeliveryMutation.isPending}
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2 rounded-md shadow-lg hover:shadow-xl ring-2 ring-primary/20 hover:ring-primary/40 border border-primary/30 dark:border-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                >
                                  {markOutForDeliveryMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Out for Delivery
                                    </>
                                  )}
                                </Button>
                              );
                            } else {
                              // Takeaway order OR delivery order already out for delivery - Show Scan Barcode button
                              // BUT hide it if delivery person is assigned (delivery person will handle delivery)
                              if (hasDeliveryPerson) {
                                // Delivery person assigned - don't show Scan Barcode button
                                return null;
                              }
                              
                              return (
                                <Button
                                  variant="cart"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBarcodeScan(order);
                                  }}
                                  size="sm"
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Scan Barcode
                                </Button>
                              );
                            }
                          } else if (order.status === 'ready' || order.status === 'out_for_delivery' || areCounterItemsReady(order)) {
                            // Order is ready - Show appropriate button based on order type
                            const orderAny = order as any;
                            const isDeliveryOrder = orderAny.orderType === 'delivery';
                            const isOutForDelivery = areCounterItemsOutForDelivery(order);
                            const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                            
                            // If delivery person is already assigned, don't show "Out for Delivery" button
                            // The delivery person will handle the delivery
                            if (hasDeliveryPerson) {
                              // Delivery person assigned - show status or nothing
                              if (isOutForDelivery) {
                                return (
                                  <div className="flex items-center space-x-1 text-primary text-sm font-medium">
                                    <Truck className="h-4 w-4" />
                                    <span>Out for Delivery</span>
                                  </div>
                                );
                              }
                              return null;
                            }
                            
                            if (isDeliveryOrder && !isOutForDelivery) {
                              // Delivery order ready but not out for delivery - Show "Out for Delivery" button
                              return (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const orderAny = order as any;
                                    const orderId = order.id || orderAny._id || order.orderNumber;
                                    if (!orderId) {
                                      console.error('❌ Order ID not found in order object:', order);
                                      return;
                                    }
                                    setCurrentOrderForDelivery(order);
                                    setIsDeliveryPersonModalOpen(true);
                                  }}
                                  disabled={markOutForDeliveryMutation.isPending}
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2 rounded-md shadow-lg hover:shadow-xl ring-2 ring-primary/20 hover:ring-primary/40 border border-primary/30 dark:border-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                >
                                  {markOutForDeliveryMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Out for Delivery
                                    </>
                                  )}
                                </Button>
                              );
                            } else {
                              // Takeaway or delivery already out - Show Scan Barcode button
                              // BUT hide it if delivery person is assigned (delivery person will handle delivery)
                              const orderAny = order as any;
                              const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                              
                              if (hasDeliveryPerson) {
                                // Delivery person assigned - don't show Scan Barcode button
                                return null;
                              }
                              
                              return (
                                <Button
                                  variant="cart"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBarcodeScan(order);
                                  }}
                                  size="sm"
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Scan Barcode
                                </Button>
                              );
                            }
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
          {(!isMobile || showPrepSection) && (
          <div className="h-full bg-muted/50 p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-semibold">▲ Prep Required Orders</h2>
                <div className="w-2 h-2 bg-warning rounded-full"></div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Orders requiring manual preparation (unseen orders prioritized)
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto counter-scrollbar pr-2 min-h-0">
              {filteredPrepOrders.map((order: Order) => {
                const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                
                return (
                  <Card key={order.id} onClick={() => handleOrderClick(order)} className="group relative overflow-hidden bg-gradient-to-br from-card to-warning/5 dark:to-warning/10 border border-border hover:border-warning/50 dark:hover:border-warning/50 hover:shadow-xl transition-all duration-300 cursor-pointer mb-3 rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <CardContent className="relative p-4">
                      {/* Compact Header with Order ID and Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center bg-card rounded-lg px-2 py-1.5 shadow-sm border border-border">
                            <span className="text-sm font-semibold text-foreground">
                              #{formatted.prefix}
                            </span>
                            <div className="ml-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                              {formatted.highlighted}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusBadge(order)}
                          {order.estimatedTime && (
                            <div className="bg-muted text-muted-foreground border border-border text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                              {order.estimatedTime}m
                            </div>
                          )}
                          {getPrepBadge(order)}
                          {getPriorityBadge(order)}
                        </div>
                      </div>
                      
                      {/* KOT Preparation Indicator */}
                      {(() => {
                        const kotCountersPreparing = getKotCountersPreparing(order);
                        if (kotCountersPreparing.length > 0) {
                          return (
                            <div className="mb-3 p-2 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                <span className="text-sm font-medium text-primary">
                                  Preparing in KOT Counter: {kotCountersPreparing.map(k => k.name).join(', ')}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Compact Customer and Items Section */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-warning rounded-full"></div>
                          <span className="text-sm font-medium text-foreground">Customer: {order.customerName}</span>
                        </div>
                        <div className="bg-card rounded-lg px-3 py-2 border border-border max-h-48">
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            {items.map((item: any, index: number) => {
                              const itemStatus = getItemStatus(order, item.id, item);
                              const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery';
                              const isCompleted = itemStatus === 'completed';
                              const isOutForDelivery = itemStatus === 'out_for_delivery';
                              return (
                                <div key={index} className="flex items-center justify-between gap-3 py-0.5">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      isCompleted ? 'bg-success' :
                                      isReady ? 'bg-success' : 'bg-warning'
                                    }`}></div>
                                    <span className={`font-medium truncate ${
                                      isCompleted ? 'text-success' :
                                      isReady ? 'text-success' : 'text-foreground'
                                    }`}>
                                      {item.quantity}x {item.name}
                                    </span>
                                    {isCompleted && (
                                      <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm flex-shrink-0">
                                        Delivered
                                      </div>
                                    )}
                                    {isReady && !isCompleted && (
                                      <div className="bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50 text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm flex-shrink-0">
                                        Ready
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground font-medium flex-shrink-0">₹{item.price}</span>
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
                            ₹{order.amount}
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
                          const itemsInKotPreparation = hasItemsInKotPreparation(order);
                          const kotCountersPreparing = getKotCountersPreparing(order);
                          
                          console.log('🔍 Button logic check:', {
                            orderNumber: order.orderNumber,
                            counterId,
                            counterItemsCompleted,
                            hasMarkableForCounter,
                            hasItemsForCounter,
                            counterItemsReady,
                            orderStatus: order.status,
                            itemsInKotPreparation,
                            kotCountersPreparing: kotCountersPreparing.map(k => k.name)
                          });
                          
                          if (counterItemsCompleted) {
                            // Items for this counter are completed - Show completed indicator
                            return (
                              <div className="flex items-center space-x-1 text-success text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                <span>Delivered</span>
                              </div>
                            );
                          } else if (itemsInKotPreparation) {
                            // Items are still being prepared in KOT counters - Hide buttons
                            // The indicator is shown above, so just return null for buttons
                            return null;
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
                                className="bg-warning hover:bg-warning/90 text-warning-foreground text-xs px-3 py-1.5 rounded-md shadow-lg hover:shadow-xl ring-2 ring-warning/20 hover:ring-warning/40 border border-warning/30 dark:border-warning/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                            // Items for this counter are ready OR items are not markable (auto-ready)
                            // For delivery orders, check if items are "out_for_delivery" at counter level - if not, show "Out for Delivery" button
                            // If items are "out_for_delivery" or it's a takeaway order, show "Scan Barcode"
                            const orderAny = order as any;
                            const isDeliveryOrder = orderAny.orderType === 'delivery';
                            const isOutForDelivery = areCounterItemsOutForDelivery(order);
                            const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                            
                            // If delivery person is already assigned, don't show "Out for Delivery" button
                            // The delivery person will handle the delivery
                            if (hasDeliveryPerson) {
                              // Delivery person assigned - show status or nothing
                              if (isOutForDelivery) {
                                return (
                                  <div className="flex items-center space-x-1 text-primary text-sm font-medium">
                                    <Truck className="h-4 w-4" />
                                    <span>Out for Delivery</span>
                                  </div>
                                );
                              }
                              return null;
                            }
                            
                            if (isDeliveryOrder && !isOutForDelivery) {
                              // Delivery order that's ready but not yet out for delivery - Show "Out for Delivery" button
                              return (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const orderAny = order as any;
                                    const orderId = order.id || orderAny._id || order.orderNumber;
                                    if (!orderId) {
                                      console.error('❌ Order ID not found in order object:', order);
                                      return;
                                    }
                                    setCurrentOrderForDelivery(order);
                                    setIsDeliveryPersonModalOpen(true);
                                  }}
                                  disabled={markOutForDeliveryMutation.isPending}
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2 rounded-md shadow-lg hover:shadow-xl ring-2 ring-primary/20 hover:ring-primary/40 border border-primary/30 dark:border-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                >
                                  {markOutForDeliveryMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Out for Delivery
                                    </>
                                  )}
                                </Button>
                              );
                            } else {
                              // Takeaway order OR delivery order already out for delivery - Show Scan Barcode button
                              // BUT hide it if delivery person is assigned (delivery person will handle delivery)
                              if (hasDeliveryPerson) {
                                // Delivery person assigned - don't show Scan Barcode button
                                return null;
                              }
                              
                              return (
                                <Button
                                  variant="cart"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBarcodeScan(order);
                                  }}
                                  size="sm"
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Scan Barcode
                                </Button>
                              );
                            }
                          } else if (order.status === 'ready' || order.status === 'out_for_delivery' || areCounterItemsReady(order)) {
                            // Order is ready - Show appropriate button based on order type
                            const orderAny = order as any;
                            const isDeliveryOrder = orderAny.orderType === 'delivery';
                            const isOutForDelivery = areCounterItemsOutForDelivery(order);
                            const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                            
                            // If delivery person is already assigned, don't show "Out for Delivery" button
                            // The delivery person will handle the delivery
                            if (hasDeliveryPerson) {
                              // Delivery person assigned - show status or nothing
                              if (isOutForDelivery) {
                                return (
                                  <div className="flex items-center space-x-1 text-primary text-sm font-medium">
                                    <Truck className="h-4 w-4" />
                                    <span>Out for Delivery</span>
                                  </div>
                                );
                              }
                              return null;
                            }
                            
                            if (isDeliveryOrder && !isOutForDelivery) {
                              // Delivery order ready but not out for delivery - Show "Out for Delivery" button
                              return (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const orderAny = order as any;
                                    const orderId = order.id || orderAny._id || order.orderNumber;
                                    if (!orderId) {
                                      console.error('❌ Order ID not found in order object:', order);
                                      return;
                                    }
                                    setCurrentOrderForDelivery(order);
                                    setIsDeliveryPersonModalOpen(true);
                                  }}
                                  disabled={markOutForDeliveryMutation.isPending}
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2 rounded-md shadow-lg hover:shadow-xl ring-2 ring-primary/20 hover:ring-primary/40 border border-primary/30 dark:border-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                >
                                  {markOutForDeliveryMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Out for Delivery
                                    </>
                                  )}
                                </Button>
                              );
                            } else {
                              // Takeaway or delivery already out - Show Scan Barcode button
                              // BUT hide it if delivery person is assigned (delivery person will handle delivery)
                              const orderAny = order as any;
                              const hasDeliveryPerson = !!orderAny.deliveryPersonId;
                              
                              if (hasDeliveryPerson) {
                                // Delivery person assigned - don't show Scan Barcode button
                                return null;
                              }
                              
                              return (
                                <Button
                                  variant="cart"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBarcodeScan(order);
                                  }}
                                  size="sm"
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Scan Barcode
                                </Button>
                              );
                            }
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
          )}
        </div>
      </div>

      {/* Consolidated Pending Items Modal */}
      <Dialog open={showConsolidatedModal} onOpenChange={setShowConsolidatedModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pending Items</DialogTitle>
            <DialogDescription>
              Consolidated items from active orders not marked as ready yet.
            </DialogDescription>
          </DialogHeader>
          {consolidatedPendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending items for this counter.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {consolidatedPendingItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between border border-border rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{item.quantity} pcs</Badge>
                    <Badge variant="outline">{item.orders} order{item.orders !== 1 ? 's' : ''}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onScanBarcode={handleBarcodeScan}
      />

      {/* Barcode Scan Modal */}
      <BarcodeScanModal
        isOpen={isBarcodeModalOpen}
        onClose={handleCloseBarcodeModal}
        onBarcodeScanned={handleBarcodeScanned}
        onBack={handleBackToOrder}
        title="Scan Barcode"
      />

      {/* Delivery Person Select Modal */}
      {currentOrderForDelivery && (
        <DeliveryPersonSelectModal
          open={isDeliveryPersonModalOpen}
          onClose={() => {
            setIsDeliveryPersonModalOpen(false);
            setCurrentOrderForDelivery(null);
          }}
          onSelect={(deliveryPersonId, deliveryPersonEmail) => {
            console.log('🚚 StoreMode: Delivery person selected:', {
              deliveryPersonId,
              deliveryPersonEmail,
              order: currentOrderForDelivery
            });
            const orderAny = currentOrderForDelivery as any;
            const orderId = currentOrderForDelivery.id || orderAny._id || currentOrderForDelivery.orderNumber;
            if (orderId) {
              console.log('🚚 Calling markOutForDeliveryMutation with:', {
                orderId,
                deliveryPersonId,
                deliveryPersonEmail
              });
              markOutForDeliveryMutation.mutate({
                orderId,
                deliveryPersonId,
                deliveryPersonEmail
              });
            } else {
              console.error('❌ Order ID not found for delivery assignment');
            }
          }}
          canteenId={canteenId}
          orderNumber={currentOrderForDelivery.orderNumber || currentOrderForDelivery.id}
        />
      )}

      {/* Order Found Modal */}
      <OrderFoundModal
        isOpen={isOrderFoundModalOpen}
        onClose={handleCloseOrderFoundModal}
        onMarkDelivered={handleMarkDelivered}
        order={currentOrderForBarcode}
        isDelivering={isDelivering}
      />

      {/* Order Not Found Modal */}
      <OrderNotFoundModal
        isOpen={isOrderNotFoundModalOpen}
        onClose={handleCloseOrderNotFoundModal}
        scannedBarcode={scannedBarcode}
      />
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ChefHat, Package, Phone, ArrowLeft, Store, CreditCard, XCircle, AlertTriangle, RefreshCw, Truck } from "lucide-react";
import JsBarcode from 'jsbarcode';
import { formatOrderIdDisplay } from "@shared/utils";
import type { Order } from '@shared/schema';
import { useWebSocket } from "@/hooks/useWebSocket";
import { useOrderStatusPolling } from "@/hooks/useOrderStatusPolling";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { updateStatusBarColor, getColorFromTailwindClass } from "@/utils/statusBar";
// Real Barcode Generator Component using JsBarcode library
const BarcodeGenerator = ({ orderId }: { orderId: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      try {
        // Generate a proper Code 128 barcode
        JsBarcode(canvasRef.current, orderId, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          background: "#ffffff",
          lineColor: "#1a1a1a",
          margin: 10,
          fontSize: 14,
          textAlign: "center",
          textPosition: "bottom"
        });
      } catch (error) {
        // Barcode generation failed - fallback to text display
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
          canvas.width = 250;
          canvas.height = 80;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#1a1a1a';
          ctx.font = '16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Order: ${orderId}`, canvas.width/2, canvas.height/2);
        }
      }
    }
  }, [orderId]);

  return (
    <canvas 
      ref={canvasRef}
      className="mx-auto"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

export default function OrderStatusPage() {
  const [, setLocation] = useLocation();
  const { orderId } = useParams();
  
  console.log('🔍 OrderStatusPage - Received orderId:', orderId);
  
  // Get source from URL parameters to determine correct back navigation
  const urlParams = new URLSearchParams(window.location.search);
  const sourceContext = urlParams.get('from');

  // Handle all back navigation scenarios (browser back, iOS swipe, Android back)
  useEffect(() => {
    // Override browser history behavior to always redirect to /app (home view)
    const handleBackNavigation = (event: PopStateEvent) => {
      event.preventDefault();
      // Always navigate to /app (home view) regardless of how user tries to go back
      setLocation('/app');
    };

    // Push a new state to handle back navigation
    window.history.pushState({ page: 'order-status' }, '', window.location.href);
    
    // Listen for popstate events (browser back, swipe gestures)
    window.addEventListener('popstate', handleBackNavigation);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handleBackNavigation);
    };
  }, [setLocation]);

  // OPTIMIZATION 3: Batch counter names fetching using React Query
  // Fetch counter names only when needed, with caching
  const CounterNameDisplay = ({ counterId }: { counterId: string }) => {
    const { data: counterData, isLoading } = useQuery({
      queryKey: ['/api/counters', counterId, 'name'],
      queryFn: async () => {
        const response = await apiRequest(`/api/counters/${counterId}/name`) as { name: string };
        return response;
      },
      enabled: !!counterId,
      staleTime: 1000 * 60 * 10, // - counter names don't change often
      gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    });
    
    if (isLoading) {
      return <span className="font-medium">Loading...</span>;
    }
    
    return <span className="font-medium">{counterData?.name || 'Unknown Counter'}</span>;
  };

  const queryClient = useQueryClient();

  // OPTIMIZATION 1: Fetch only the specific order instead of all orders
  const { data: order, isLoading: orderLoading, refetch: refetchOrder } = useQuery<Order>({
    queryKey: ['/api/orders', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      const response = await apiRequest(`/api/orders/${orderId}`) as Order;
      return response;
    },
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 seconds - reasonable caching for order status
    refetchInterval: false, // Disable polling - using WebSocket for real-time updates, polling as fallback
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: true, // Refetch on mount to ensure fresh data
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
  });

  // Helper function to get item status for a specific counter
  const getItemStatus = (order: Order, itemId: string, counterId: string, item?: any): 'pending' | 'ready' | 'out_for_delivery' | 'completed' => {
    try {
      // First, check itemStatusByCounter if it exists (for both markable and auto-ready items)
      if (order.itemStatusByCounter && order.itemStatusByCounter[counterId]) {
        const itemStatus = order.itemStatusByCounter[counterId][itemId];
        if (itemStatus) {
          return itemStatus as 'pending' | 'ready' | 'out_for_delivery' | 'completed';
        }
      }
      
      // If item is not markable (auto-ready), check order status as fallback
      // Auto-ready items are considered ready if order is ready or preparing or out_for_delivery
      if (item && item.isMarkable !== true) {
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

  // Helper function to get counter name by ID
  const getCounterName = (counterId: string) => {
    // This would typically come from a counters API, for now return a formatted name
    return `Counter ${counterId.slice(-4)}`;
  };

  // OPTIMIZATION 2: Group items by counter using order data only (no menu fetch needed)
  // Order items already contain storeCounterId and paymentCounterId
  const groupItemsByCounter = (order: Order) => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const counterGroups: { [counterId: string]: any[] } = {};
      
      items.forEach((item: any) => {
        // Use counterId from order item directly (already included in order data)
        const counterId = item.storeCounterId || item.counterId || 'default';
        
        if (!counterGroups[counterId]) {
          counterGroups[counterId] = [];
        }
        counterGroups[counterId].push({
          ...item,
          counterId,
          counterName: getCounterName(counterId)
        });
      });
      
      return counterGroups;
    } catch (error) {
      console.error('Error grouping items by counter:', error);
      return {};
    }
  };

  // OPTIMIZATION 4: Progressive loading - use order directly from query
  const finalOrder = order;
  
  // Determine order status - for offline orders with pending payment, show as pending_payment
  // But skip payment pending status for orders with amount 0 (free orders)
  const orderAmount = finalOrder?.amount || 0;
  const rawStatus = finalOrder?.status as "pending" | "preparing" | "ready" | "out_for_delivery" | "completed" | "delivered" | "rejected" | "cancelled" | "pending_payment" || "pending";
  
  // For orders with amount 0, never show as pending_payment even if server sets it
  // Convert pending_payment to pending for free orders
  let orderStatus = rawStatus;
  if (rawStatus === 'pending_payment' && orderAmount <= 0) {
    orderStatus = 'pending';
  } else {
    // For offline orders with pending payment and amount > 0, show as pending_payment
    const isOfflinePending = (finalOrder as any)?.isOffline && (finalOrder as any)?.paymentStatus === 'pending' && orderAmount > 0;
    if (isOfflinePending) {
      orderStatus = 'pending_payment';
    }
  }

  // Determine if payment is completed (needed for theme configuration)
  const isPaymentCompleted = (() => {
    if (!finalOrder) return false;
    
    const isOffline = (finalOrder as any)?.isOffline;
    const paymentStatus = (finalOrder as any)?.paymentStatus;
    const orderAmount = finalOrder?.amount || 0;
    
    // For free orders (amount <= 0), payment is considered completed
    if (orderAmount <= 0) {
      return true;
    }
    
    // For online payments (not offline), payment is completed when order status is 'preparing' or later
    // (Online payments create orders with 'preparing' status directly after successful payment)
    if (!isOffline) {
      return orderStatus === "preparing" || orderStatus === "ready" || orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered";
    }
    
    // For offline payments, check paymentStatus field
    return paymentStatus === 'completed' || paymentStatus === 'paid' || paymentStatus === 'confirmed';
  })();
  
  // Get canteen ID from the order to join the correct room
  const orderCanteenId = finalOrder?.canteenId;

  // OPTIMIZATION 4: Progressive loading - fetch canteen data only after order loads
  const { data: canteenData, isLoading: canteenLoading } = useQuery({
    queryKey: ['/api/system-settings/canteens', orderCanteenId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${orderCanteenId}`),
    enabled: !!orderCanteenId && !!finalOrder, // Only fetch after order is loaded
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  // OPTIMIZATION 2: Removed full menu fetch - using order data only
  // Order items already contain counterId information, no need for full menu
  
  // Real-time order updates via WebSocket for user-facing status updates
  const webSocketStatus = useWebSocket({
    canteenIds: orderCanteenId ? [orderCanteenId] : [], // Join the specific canteen room
    enabled: true && !!orderCanteenId, // Only enable if we have a canteen ID
    onNewOrder: (order) => {
      console.log("🔄 User received new order, refreshing data...");
      // OPTIMIZATION 5: Only refetch if it's the current order
      const orderAny = order as any;
      const finalOrderAny = finalOrder as any;
      const matches = order.id?.toString() === orderId || 
                     orderAny._id?.toString() === orderId || 
                     order.orderNumber === orderId ||
                     (finalOrder && (
                       order.id?.toString() === finalOrder.id?.toString() ||
                       orderAny._id?.toString() === finalOrderAny?._id?.toString() ||
                       order.orderNumber === finalOrder.orderNumber
                     ));
      if (matches) {
        refetchOrder();
      }
    },
    onOrderUpdate: (order) => {
      console.log("🔄 User received order update, refreshing data...", {
        orderNumber: order.orderNumber,
        orderId: order.id || (order as any)._id,
        itemStatusByCounter: order.itemStatusByCounter
      });
      // OPTIMIZATION 5: Only refetch if it's the current order
      const orderAny = order as any;
      const finalOrderAny = finalOrder as any;
      const matches = order.id?.toString() === orderId || 
                     orderAny._id?.toString() === orderId || 
                     order.orderNumber === orderId ||
                     (finalOrder && (
                       order.id?.toString() === finalOrder.id?.toString() ||
                       orderAny._id?.toString() === finalOrderAny?._id?.toString() ||
                       order.orderNumber === finalOrder.orderNumber
                     ));
      if (matches) {
        console.log("✅ Order update matches current order, refetching...");
        refetchOrder();
      }
    },
    onItemStatusChange: (order) => {
      // Handle item-level status changes (e.g., when items are marked ready from KOT counter)
      console.log("🔄 User received item status change, refreshing data...", {
        orderNumber: order.orderNumber,
        orderId: order.id || (order as any)._id,
        itemStatusByCounter: order.itemStatusByCounter
      });
      const orderAny = order as any;
      const finalOrderAny = finalOrder as any;
      const matches = order.id?.toString() === orderId || 
                     orderAny._id?.toString() === orderId || 
                     order.orderNumber === orderId ||
                     (finalOrder && (
                       order.id?.toString() === finalOrder.id?.toString() ||
                       orderAny._id?.toString() === finalOrderAny?._id?.toString() ||
                       order.orderNumber === finalOrder.orderNumber
                     ));
      if (matches) {
        console.log("✅ Item status change matches current order, refetching...");
        refetchOrder();
      }
    },
    onOrderStatusChange: (order, oldStatus, newStatus) => {
      const orderAny = order as any;
      const finalOrderAny = finalOrder as any;
      console.log(`🔄 User order status changed: ${oldStatus} → ${newStatus}`, {
        orderId: orderId,
        orderIdFromOrder: order.id || orderAny._id,
        orderNumber: order.orderNumber,
        orderNumberFromParams: orderId,
        finalOrderId: finalOrder?.id,
        finalOrder_id: finalOrderAny?._id,
        finalOrderNumber: finalOrder?.orderNumber
      });
      
      // OPTIMIZATION 5: Only refetch if it's the current order
      // Check multiple possible ID formats (id, _id, orderNumber)
      // The orderId from URL params could be either an ObjectId or an orderNumber
      // IMPORTANT: Compare MongoDB _id values as they are the most reliable identifier
      const orderIdMatch = 
        // Direct ID matches with URL param
        order.id?.toString() === orderId || 
        orderAny._id?.toString() === orderId || 
        order.orderNumber === orderId ||
        // Match against finalOrder (the order we're currently viewing) - this is the most reliable
        (finalOrder && (
          // Match by MongoDB _id (most reliable - same order regardless of orderNumber)
          (orderAny._id && finalOrder.id && orderAny._id.toString() === finalOrder.id.toString()) ||
          (order.id && finalOrder.id && order.id.toString() === finalOrder.id.toString()) ||
          (orderAny._id && finalOrderAny?._id && orderAny._id.toString() === finalOrderAny._id.toString()) ||
          // Match by orderNumber
          (order.orderNumber && finalOrder.orderNumber && order.orderNumber === finalOrder.orderNumber) ||
          // Match by id field (if both have it)
          (order.id && finalOrder.id && order.id.toString() === finalOrder.id.toString())
        ));
      
      if (orderIdMatch) {
        console.log(`✅ Order status change matches current order, refetching...`);
        const statusMessages: { [key: string]: string } = {
          'preparing': 'Your order is being prepared! 👨‍🍳',
          'ready': 'Your order is ready for pickup! 📦',
          'out_for_delivery': 'Your order is out for delivery! 🚚',
          'delivered': 'Your order has been delivered! ✅',
          'cancelled': 'Your order has been cancelled ❌'
        };
        
        const message = statusMessages[newStatus] || `Order status updated to ${newStatus}`;
        refetchOrder();
      } else {
        console.log(`⏭️ Order status change does not match current order, ignoring...`, {
          urlOrderId: orderId,
          wsOrderId: order.id || orderAny._id,
          wsOrderNumber: order.orderNumber,
          currentOrderId: finalOrder?.id,
          currentOrderNumber: finalOrder?.orderNumber
        });
      }
    },
    onConnected: () => {
      console.log("✅ User WebSocket connection established for canteen:", orderCanteenId);
    },
    onDisconnected: () => {
      console.log("❌ User WebSocket connection lost");
    },
    onError: (error) => {
      console.error("❌ User WebSocket error:", error);
    }
  });

  // Polling fallback for when WebSocket is disconnected
  // Industry Standard: Automatic fallback with proper lifecycle management
  const pollingStatus = useOrderStatusPolling({
    orderId: orderId || '',
    enabled: !!orderId,
    isWebSocketConnected: webSocketStatus.isConnected,
    isWebSocketConnecting: webSocketStatus.isConnecting,
    onDataUpdate: (updatedOrder) => {
      // Update React Query cache directly to avoid refetch
      if (updatedOrder) {
        queryClient.setQueryData(['/api/orders', orderId], updatedOrder);
        console.log('📊 Order status updated via polling:', updatedOrder.orderNumber || updatedOrder.id);
      }
    },
    onError: (error) => {
      console.error('❌ Polling error:', error);
    },
    pollingInterval: 4000, // Poll every 4 seconds when WebSocket is disconnected (balanced for UX and cost)
  });
  
  // Dynamic theme configuration based on order status and payment status
  const getThemeConfig = (status: string) => {
    // If payment is completed, use green theme for the entire page
    if (isPaymentCompleted && (status === "preparing" || status === "ready" || status === "out_for_delivery" || status === "completed" || status === "delivered")) {
      return {
        bg: "bg-green-50 dark:bg-green-950/20",
        headerBg: "bg-green-600 dark:bg-green-700",
        iconBg: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400",
        progressColor: "[&>div]:bg-green-500",
        borderColor: "border-green-200 dark:border-green-800",
        buttonBg: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800",
        buttonText: "text-white",
        theme: "green"
      };
    }
    
    switch (status?.toLowerCase()) {
      case "pending_payment":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/20",
          headerBg: "bg-amber-600 dark:bg-amber-700",
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          progressColor: "[&>div]:bg-amber-500",
          borderColor: "border-amber-200 dark:border-amber-800",
          buttonBg: "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800",
          buttonText: "text-white",
          theme: "amber"
        };
      case "pending":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950/20",
          headerBg: "bg-yellow-600 dark:bg-yellow-700",
          iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          progressColor: "[&>div]:bg-yellow-500",
          borderColor: "border-yellow-200 dark:border-yellow-800",
          buttonBg: "bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800",
          buttonText: "text-white",
          theme: "yellow"
        };
      case "preparing":
        return {
          bg: "bg-orange-50 dark:bg-orange-950/20",
          headerBg: "bg-orange-600 dark:bg-orange-700",
          iconBg: "bg-orange-100 dark:bg-orange-900/30",
          iconColor: "text-orange-600 dark:text-orange-400",
          progressColor: "[&>div]:bg-orange-500",
          borderColor: "border-orange-200 dark:border-orange-800",
          buttonBg: "bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800",
          buttonText: "text-white",
          theme: "orange"
        };
      case "ready":
        return {
          bg: "bg-orange-50 dark:bg-orange-950/20",
          headerBg: "bg-orange-700 dark:bg-orange-800",
          iconBg: "bg-orange-100 dark:bg-orange-900/30",
          iconColor: "text-orange-700 dark:text-orange-400",
          progressColor: "[&>div]:bg-orange-600",
          borderColor: "border-orange-200 dark:border-orange-800",
          buttonBg: "bg-orange-700 hover:bg-orange-800 dark:bg-orange-800 dark:hover:bg-orange-900",
          buttonText: "text-white",
          theme: "orange"
        };
      case "delivered":
      case "completed":
        return {
          bg: "bg-green-50 dark:bg-green-950/20",
          headerBg: "bg-green-600 dark:bg-green-700",
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
          progressColor: "[&>div]:bg-green-500",
          borderColor: "border-green-200 dark:border-green-800",
          buttonBg: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800",
          buttonText: "text-white",
          theme: "green"
        };
      case "cancelled":
      case "rejected":
        return {
          bg: "bg-red-50 dark:bg-red-950/20",
          headerBg: "bg-red-600 dark:bg-red-700",
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
          progressColor: "[&>div]:bg-red-500",
          borderColor: "border-red-200 dark:border-red-800",
          buttonBg: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
          buttonText: "text-white",
          theme: "red"
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-950/20",
          headerBg: "bg-slate-600 dark:bg-slate-700",
          iconBg: "bg-slate-100 dark:bg-slate-900/30",
          iconColor: "text-slate-600 dark:text-slate-400",
          progressColor: "[&>div]:bg-slate-500",
          borderColor: "border-slate-200 dark:border-slate-800",
          buttonBg: "bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-800",
          buttonText: "text-white",
          theme: "slate"
        };
    }
  };
  
  const themeConfig = getThemeConfig(orderStatus);
  
  // Update status bar to match header color based on order status
  useEffect(() => {
    if (themeConfig.headerBg) {
      const headerColor = getColorFromTailwindClass(themeConfig.headerBg);
      updateStatusBarColor(headerColor);
    }
  }, [themeConfig.headerBg]);
  
  // Calculate progress based on order status - memoized to prevent infinite loops
  const progress = useMemo(() => {
    switch (orderStatus?.toLowerCase()) {
      case "pending_payment": return 10;
      case "pending": return 20;
      case "preparing": return 50;
      case "ready": return 80;
      case "completed": return 100;
      case "delivered": return 100;
      case "cancelled":
      case "rejected": return 0;
      default: return 20;
    }
  }, [orderStatus]);

  const orderDetails = finalOrder ? (() => {
    let parsedItems: Array<{id: number, name: string, price: number, quantity: number}> = [];
    
    try {
      const itemsData = JSON.parse(finalOrder.items || '[]');
      parsedItems = Array.isArray(itemsData) ? itemsData : [];
    } catch (error) {
      console.error('Error parsing order items:', error);
      parsedItems = [];
    }

    return {
      id: finalOrder.barcode, // Use barcode as the primary ID for consistency
      orderNumber: finalOrder.orderNumber, // Keep order number for reference
      items: parsedItems,
      total: finalOrder.amount,
      estimatedTime: `${finalOrder.estimatedTime || 15} mins`,
      actualTime: orderStatus === "ready" ? `${finalOrder.estimatedTime || 15} mins` : `${finalOrder.estimatedTime || 15} mins`,
      pickupLocation: canteenData?.location || canteenData?.name || "Canteen Counter"
    };
  })() : null;

  // OPTIMIZATION 4: Progressive loading - show loading only for order, not for canteen
  if (orderLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-8">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (!finalOrder || !orderDetails) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-8">Order not found</div>
          <Button onClick={() => setLocation("/app")} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Determine if payment is pending
  const isPaymentPending = (() => {
    if (!finalOrder) return false;
    const orderAmount = finalOrder?.amount || 0;
    
    // Free orders don't have pending payment
    if (orderAmount <= 0) {
      return false;
    }
    
    // Payment is pending if order status is pending_payment
    return orderStatus === "pending_payment";
  })();

  // Build base steps array
  const baseSteps = [
    {
      status: "placed",
      label: "Order Placed",
      icon: CheckCircle,
      completed: true,
      time: finalOrder ? new Date(finalOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""
    }
  ];

  // Add payment step conditionally - only show one payment step
  if (isPaymentPending) {
    // Show "Payment Pending" when payment is actually pending
    baseSteps.push({
      status: "pending_payment",
      label: "Payment Pending",
      icon: Clock,
      completed: false,
      time: "Awaiting payment confirmation"
    });
  } else if (isPaymentCompleted) {
    // Show "Payment Completed" when payment is completed
    baseSteps.push({
      status: "payment_completed",
      label: "Payment Completed",
      icon: CreditCard,
      completed: true,
      time: finalOrder ? new Date(finalOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""
    });
  }

  const isDeliveryOrder = (finalOrder as any)?.orderType === 'delivery';
  
  const statusSteps = [
    ...baseSteps,
    {
      status: "preparing",
      label: "Preparing",
      icon: ChefHat,
      completed: orderStatus === "preparing" || orderStatus === "ready" || orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered",
      time: orderStatus === "preparing" || orderStatus === "ready" || orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered" ? 
        finalOrder ? new Date(new Date(finalOrder.createdAt).getTime() + 3 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "" : ""
    },
    {
      status: "ready",
      label: isDeliveryOrder ? "Ready for Delivery" : "Ready for Pickup",
      icon: Package,
      completed: orderStatus === "ready" || orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered",
      time: orderStatus === "ready" || orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered" ? 
        finalOrder ? new Date(new Date(finalOrder.createdAt).getTime() + (finalOrder.estimatedTime || 15) * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "" : ""
    },
    ...(isDeliveryOrder ? [{
      status: "out_for_delivery",
      label: "Out for Delivery",
      icon: Truck,
      completed: orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered",
      time: orderStatus === "out_for_delivery" || orderStatus === "completed" || orderStatus === "delivered" ? 
        finalOrder ? new Date(new Date(finalOrder.createdAt).getTime() + (finalOrder.estimatedTime || 15) * 60000 + 5 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "" : ""
    }] : []),
    {
      status: "delivered",
      label: isDeliveryOrder ? "Order Delivered" : "Order Completed",
      icon: CheckCircle,
      completed: orderStatus === "delivered" || orderStatus === "completed",
      time: (orderStatus === "delivered" || orderStatus === "completed") && finalOrder?.deliveredAt ? 
        new Date(finalOrder.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
        (orderStatus === "delivered" || orderStatus === "completed" ? 
          finalOrder ? new Date(new Date(finalOrder.createdAt).getTime() + (finalOrder.estimatedTime || 15) * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "" : "")
    }
  ];

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Header */}
      <div className={`${themeConfig.headerBg} px-4 pt-12 pb-6 rounded-b-3xl shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10"
            title="Back to Home"
            onClick={() => setLocation('/app')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              webSocketStatus.isConnected ? 'bg-green-400 animate-pulse' : 
              webSocketStatus.isConnecting ? 'bg-yellow-400 animate-spin' : 
              'bg-red-400'
            }`} />
            <span className="text-white text-sm">
              {webSocketStatus.isConnected ? 'Live' : 
               webSocketStatus.isConnecting ? 'Connecting...' : 
               'Offline'}
            </span>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Order Status</h1>
          <div className="flex items-center justify-center gap-1">
            <span className="text-white">Order #</span>
            <span className="text-white font-bold">
              {(() => {
                const formatted = formatOrderIdDisplay(orderDetails.orderNumber);
                return formatted.prefix + formatted.highlighted;
              })()}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-32">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Order Barcode - At the Top (Hidden for cancelled/rejected orders) */}
          {orderStatus !== "cancelled" && orderStatus !== "rejected" && (
          <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-5 border border-border">
            <div className="text-center">
              <div className="bg-white dark:bg-gray-900 p-3 rounded-lg inline-block mb-4">
                <BarcodeGenerator orderId={orderDetails.id} />
              </div>
              <p className={`font-bold text-lg mb-3 ${themeConfig.iconColor}`}>Order ID: {orderDetails.id}</p>
              {/* OTP Display - First 4 digits of barcode - Highlighted */}
              {orderDetails.id && orderDetails.id.length >= 4 && (() => {
                const first4Digits = orderDetails.id.slice(0, 4);
                const isDelivery = (finalOrder as any)?.orderType === 'delivery';
                return (
                  <div className="my-4">
                    <div className="bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 dark:from-primary/30 dark:via-primary/20 dark:to-primary/15 rounded-xl p-4 border-2 border-primary/30 dark:border-primary/40 shadow-lg">
                      <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {isDelivery ? '🚚 Delivery OTP' : '📦 Pickup OTP'}
                      </p>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-primary/50 dark:border-primary/60 shadow-inner">
                        <p className={`text-5xl font-black ${themeConfig.iconColor} tracking-[0.2em] letter-spacing-wide`} style={{ letterSpacing: '0.3em' }}>
                          {first4Digits}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 font-medium">
                        Show this OTP or scan the barcode above
                      </p>
                    </div>
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">
                Show this barcode or OTP at the counter for verification
              </p>
            </div>
          </div>
          )}

          {/* Payment Confirmation Info (for offline orders) */}
          {(finalOrder as any)?.isOffline && (finalOrder as any)?.paymentConfirmedBy && (
            <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border">
              <h3 className={`font-semibold mb-3 flex items-center ${themeConfig.iconColor}`}>
                <CreditCard className={`w-4 h-4 mr-2 ${themeConfig.iconColor}`} />
                Payment Confirmation
              </h3>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-green-800 dark:text-green-200 mb-0.5">Payment Confirmed</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Confirmed at: <CounterNameDisplay counterId={(finalOrder as any).paymentConfirmedBy} />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Timeline or Cancellation Info */}
          {orderStatus === "cancelled" || orderStatus === "rejected" ? (
            <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border">
              <div className="text-center space-y-2">
                <XCircle className={`w-6 h-6 mx-auto ${themeConfig.iconColor}`} />
                <p className={`font-semibold text-base ${themeConfig.iconColor}`}>Order is cancelled</p>
                <p className="text-sm text-muted-foreground">This order was cancelled, so the timeline is hidden.</p>
              </div>
            </div>
          ) : (
          <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border">
            <h3 className={`font-semibold mb-4 ${themeConfig.iconColor}`}>
              Order Timeline
            </h3>
            <div className="space-y-4">
              {statusSteps.map((step, index) => {
                const isCompleted = step.completed;
                
                return (
                  <div key={step.status} className="flex items-start">
                    {/* Icon Circle */}
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted 
                          ? `${themeConfig.iconBg} ${themeConfig.iconColor}` 
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      <step.icon className="w-4 h-4" />
                    </div>
                    
                    {/* Text Content */}
                    <div className="flex-1 min-w-0 ml-3">
                      <p className={`font-medium text-sm ${isCompleted ? themeConfig.iconColor : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {step.time && (
                        <p className={`text-xs mt-0.5 ${isCompleted ? themeConfig.iconColor : "text-muted-foreground"}`}>
                          {step.time}
                        </p>
                      )}
                    </div>
                    
                    {/* Right Checkmark for Completed Steps */}
                    {isCompleted && (
                      <CheckCircle className={`w-4 h-4 ${themeConfig.iconColor} flex-shrink-0 mt-1.5 ml-2`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Order Details */}
          <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border">
            <h3 className={`font-semibold mb-3 flex items-center ${themeConfig.iconColor}`}>
              <Store className={`w-4 h-4 mr-2 ${themeConfig.iconColor}`} />
              Order Details
            </h3>
            <div className="space-y-3">
              {orderDetails.items && orderDetails.items.length > 0 ? (
                (() => {
                  const counterGroups = groupItemsByCounter(finalOrder);
                  return Object.entries(counterGroups).map(([counterId, items]) => (
                    <div key={counterId} className="space-y-2">
                      {/* Counter Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center space-x-2">
                          <Store className={`w-4 h-4 ${themeConfig.iconColor}`} />
                          <span className={`font-medium text-sm ${themeConfig.iconColor}`}>
                            {items[0]?.counterName || 'General'}
                          </span>
                        </div>
                        {/* Counter Status Indicator */}
                        <div className="flex items-center space-x-1">
                          {(() => {
                            const allItemsCompleted = items.every((item: any) => 
                              getItemStatus(finalOrder, item.id, item.counterId, item) === 'completed'
                            );
                            const allItemsReady = items.every((item: any) => {
                              const status = getItemStatus(finalOrder, item.id, item.counterId, item);
                              return status === 'ready' || status === 'out_for_delivery' || status === 'completed';
                            });
                            const someItemsReady = items.some((item: any) => {
                              const status = getItemStatus(finalOrder, item.id, item.counterId, item);
                              return status === 'ready' || status === 'out_for_delivery' || status === 'completed';
                            });
                            
                            if (allItemsCompleted) {
                              return (
                                <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs font-medium">Delivered</span>
                                </div>
                              );
                            } else if (allItemsReady) {
                              return (
                                <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs font-medium">Ready</span>
                                </div>
                              );
                            } else if (someItemsReady) {
                              return (
                                <div className="flex items-center space-x-1 text-yellow-600 dark:text-yellow-400">
                                  <Clock className="w-4 h-4" />
                                  <span className="text-xs font-medium">In Progress</span>
                                </div>
                              );
                            } else {
                              // Use theme color for preparing status
                              return (
                                <div className={`flex items-center space-x-1 ${themeConfig.iconColor}`}>
                                  <Clock className="w-4 h-4" />
                                  <span className="text-xs font-medium">Preparing</span>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      
                      {/* Items for this counter */}
                      <div className="space-y-2">
                        {items.map((item: any, index: number) => {
                          const itemStatus = getItemStatus(finalOrder, item.id, item.counterId, item);
                          const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery';
                          const isCompleted = itemStatus === 'completed';
                          const isOutForDelivery = itemStatus === 'out_for_delivery';
                          const isPreparing = (itemStatus as string === 'preparing' || itemStatus === 'pending');
                          return (
                            <div key={index} className="flex justify-between items-center py-1">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  isCompleted ? 'bg-green-600 dark:bg-green-500' :
                                  isReady ? 'bg-green-500 dark:bg-green-400' : 
                                  isPreparing ? (
                                    themeConfig.theme === 'amber' ? 'bg-amber-500 dark:bg-amber-400' :
                                    themeConfig.theme === 'yellow' ? 'bg-yellow-500 dark:bg-yellow-400' :
                                    themeConfig.theme === 'orange' ? 'bg-orange-500 dark:bg-orange-400' :
                                    themeConfig.theme === 'green' ? 'bg-green-500 dark:bg-green-400' :
                                    themeConfig.theme === 'red' ? 'bg-red-500 dark:bg-red-400' :
                                    'bg-slate-500 dark:bg-slate-400'
                                  ) : 'bg-yellow-500 dark:bg-yellow-400'
                                }`}></div>
                                <span className={`text-sm truncate ${
                                  isCompleted ? 'text-green-700 dark:text-green-300 font-medium' :
                                  isReady ? 'text-green-600 dark:text-green-400 font-medium' : 
                                  isPreparing ? `${themeConfig.iconColor} font-medium` : 'text-foreground'
                                }`}>
                                  {item.name} x{item.quantity}
                                </span>
                                {isCompleted && (
                                  <span className="bg-green-200 dark:bg-green-900/40 text-green-900 dark:text-green-200 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
                                    Delivered
                                  </span>
                                )}
                                {isOutForDelivery && !isCompleted && (
                                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
                                    Out for Delivery
                                  </span>
                                )}
                                {isReady && !isCompleted && !isOutForDelivery && (
                                  <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
                                    Ready
                                  </span>
                                )}
                                {isPreparing && !isReady && !isCompleted && (
                                  <span className={`${themeConfig.iconBg} ${themeConfig.iconColor} text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-2`}>
                                    Preparing
                                  </span>
                                )}
                              </div>
                              <span className={`font-semibold text-sm ml-3 flex-shrink-0 ${themeConfig.iconColor}`}>₹{item.price}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No items found in this order
                </div>
              )}
              <div className="border-t pt-3 mt-3 border-border">
                <div className="flex justify-between items-center">
                  <span className={`font-bold ${themeConfig.iconColor}`}>Total</span>
                  <span className={`${themeConfig.iconColor} font-bold text-lg`}>₹{orderDetails.total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Person Info */}
          {finalOrder?.deliveryPersonId && (
            <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border">
              <h3 className={`font-semibold mb-3 flex items-center ${themeConfig.iconColor}`}>
                <Truck className={`w-4 h-4 mr-2 ${themeConfig.iconColor}`} />
                Delivery Person Assigned
              </h3>
              <div className={`${themeConfig.iconBg} rounded-lg p-3 border border-border`}>
                <p className={`font-semibold text-sm ${themeConfig.iconColor}`}>
                  Delivery Person ID: {finalOrder.deliveryPersonId}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your order has been assigned to a delivery person and will be delivered soon.
                </p>
              </div>
            </div>
          )}

          {/* Pickup Location & Contact */}
          <div className="bg-card dark:bg-[#1e1e1e] rounded-2xl p-4 border border-border space-y-4">
            <div>
              <h3 className={`font-semibold mb-3 flex items-center ${themeConfig.iconColor}`}>
                <Package className={`w-4 h-4 mr-2 ${themeConfig.iconColor}`} />
                Pickup Location
              </h3>
              <div className={`${themeConfig.iconBg} rounded-lg p-3 border border-border`}>
                <p className={`font-semibold text-sm mb-1 ${themeConfig.iconColor}`}>
                  {canteenData?.name || "Canteen"}
                </p>
                <p className={`text-xs ${themeConfig.iconColor}`}>
                  {orderDetails.pickupLocation}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Show the barcode above for verification
                </p>
              </div>
            </div>

            <div className="border-t pt-3 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold text-sm mb-0.5 ${themeConfig.iconColor}`}>Need Help?</h3>
                  <p className="text-xs text-muted-foreground">Contact canteen staff</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`border-border ${themeConfig.iconColor}`}
                >
                  <Phone className={`w-3.5 h-3.5 mr-1.5 ${themeConfig.iconColor}`} />
                  Call
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 border-t p-4 bg-card dark:bg-[#1e1e1e] border-border">
        <div className="max-w-2xl mx-auto space-y-3">
          {orderStatus === "pending_payment" ? (
            <>
              <p className="text-muted-foreground text-center text-sm mb-2">
                Please proceed to the payment counter to complete your payment
              </p>
              <Button
                variant="outline"
                size="mobile"
                className="w-full"
                onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
              >
                Browse Menu
              </Button>
            </>
          ) : orderStatus === "cancelled" ? (
            <>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  size="mobile"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                  onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Order
                </Button>
                <Button
                  variant="outline"
                  size="mobile"
                  className="flex-1"
                  onClick={() => setLocation("/app")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </>
          ) : orderStatus === "rejected" ? (
            <>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Order Rejected</p>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300">
                  Your order was rejected by the payment counter. You can place a new order or contact staff.
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  size="mobile"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                  onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Order
                </Button>
                <Button
                  variant="outline"
                  size="mobile"
                  className="flex-1"
                  onClick={() => setLocation("/app")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </>
          ) : orderStatus === "delivered" ? (
            <Button
              variant="food"
              size="mobile"
              className="w-full"
              onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
            >
              Order Delivered - Browse Menu
            </Button>
          ) : orderStatus === "ready" ? (
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="mobile"
                className="flex-1"
                onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
              >
                Browse Menu
              </Button>
              <Button
                variant="food"
                size="mobile"
                className="flex-1"
                disabled
              >
                Ready for Pickup
              </Button>
            </div>
          ) : (
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="mobile"
                className="flex-1"
                onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}
              >
                Browse Menu
              </Button>
              <Button
                variant="food"
                size="mobile"
                className="flex-1"
                onClick={() => refetchOrder()}
              >
                Refresh Status
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
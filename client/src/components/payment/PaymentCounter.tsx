import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';
import BarcodeScanModal from '@/components/modals/BarcodeScanModal';
import OrderFoundModal from '@/components/orders/OrderFoundModal';
import OrderNotFoundModal from '@/components/orders/OrderNotFoundModal';
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Filter,
  RefreshCw,
  Receipt,
  QrCode
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaymentCounterProps {
  counterId: string;
  canteenId: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  items: string;
}


// Helper function to filter items in an order for a specific counter
function filterOrderItems(order: any, counterId: string): any | null {
  if (!order || !order.items) return order;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  // For offline orders, ALL payment counters should receive the order regardless of item assignment
  if (order.isOffline === true) {
    console.log(`💳 Order ${order.orderNumber} is offline - showing ALL items for payment counter ${counterId}`);
    return order; // Return the full order for offline orders
  }

  // For regular orders, filter items that belong to this counter
  const relevantItems = items.filter((item: any) => {
    // Check if item belongs to this payment counter
    const isRelevant = item.belongsToPaymentCounter === true && item.paymentCounterId === counterId;
    console.log(`💳 Item ${item.name} (${item.id}) relevance for counter ${counterId}:`, {
      belongsToPaymentCounter: item.belongsToPaymentCounter,
      itemPaymentCounterId: item.paymentCounterId,
      targetCounterId: counterId,
      isRelevant
    });
    return isRelevant;
  });

  if (relevantItems.length > 0) {
    console.log(`💳 Order ${order.orderNumber} has ${relevantItems.length} items for payment counter ${counterId}`);
    // Return a filtered order with only the relevant items
    return {
      ...order,
      items: JSON.stringify(relevantItems)
    };
  }

  console.log(`💳 Order ${order.orderNumber} has no items for payment counter ${counterId}`);
  return null;
}

// Helper function to filter orders for specific counter
function filterOrderForCounter(order: any, counterId: string): any | null {
  if (!order) return null;

  console.log(`💳 Filtering order ${order.orderNumber} for counter ${counterId}:`, {
    orderPaymentCounterId: order.paymentCounterId,
    orderAllPaymentCounterIds: order.allPaymentCounterIds,
    orderAllCounterIds: order.allCounterIds,
    targetCounterId: counterId,
    isOffline: order.isOffline
  });

  // For offline orders, ALL payment counters should receive the order
  if (order.isOffline === true) {
    console.log(`💳 Order ${order.orderNumber} is offline - relevant for ALL payment counters including ${counterId}`);
    return filterOrderItems(order, counterId);
  }

  // Check if the order belongs to this payment counter (direct assignment)
  if (order.paymentCounterId === counterId) {
    console.log(`💳 Order ${order.orderNumber} directly assigned to counter ${counterId}`);
    // Still need to filter items for this counter
    return filterOrderItems(order, counterId);
  }

  // Check if the counter is in the allPaymentCounterIds array
  if (order.allPaymentCounterIds && order.allPaymentCounterIds.includes(counterId)) {
    console.log(`💳 Order ${order.orderNumber} has counter ${counterId} in allPaymentCounterIds`);
    // Filter items for this counter
    return filterOrderItems(order, counterId);
  }

  // Check if the counter is in the allCounterIds array
  if (order.allCounterIds && order.allCounterIds.includes(counterId)) {
    console.log(`💳 Order ${order.orderNumber} has counter ${counterId} in allCounterIds`);
    // Filter items for this counter
    return filterOrderItems(order, counterId);
  }

  // Fallback: Check if any items in the order belong to this counter
  if (order.items && Array.isArray(order.items)) {
    return filterOrderItems(order, counterId);
  }

  console.log(`💳 Order ${order.orderNumber} does not belong to counter ${counterId}`);
  return null;
}

export default function PaymentCounter({ counterId, canteenId }: PaymentCounterProps) {
  const [, setLocation] = useLocation();
  const [isOwnerRoute] = useRoute("/canteen-owner-dashboard/:canteenId/counter/:counterId");
  const [isAdminRoute] = useRoute("/admin/canteen/:canteenId/counter/:counterId");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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

  // Set page title
  useEffect(() => {
    document.title = "Payment Counter | KIT-CANTEEN Owner Dashboard";
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [currentOrderForBarcode, setCurrentOrderForBarcode] = useState<any>(null);
  const [isOrderFoundModalOpen, setIsOrderFoundModalOpen] = useState(false);
  const [isOrderNotFoundModalOpen, setIsOrderNotFoundModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);

  console.log('💳 PaymentCounter component mounted with:', { counterId, canteenId });

  // WebSocket integration for counter-specific updates
  const { joinCounterRoom, leaveCounterRoom, isConnected } = useWebSocket({
    enabled: true,
    onNewOrder: (order) => {
      console.log('PaymentCounter received new order:', {
        orderNumber: order.orderNumber,
        paymentCounterId: order.paymentCounterId,
        allPaymentCounterIds: order.allPaymentCounterIds,
        allCounterIds: order.allCounterIds,
        items: order.items?.length,
        counterId
      });
      // Filter orders to show only items belonging to this counter
      const relevantOrder = filterOrderForCounter(order, counterId);
      console.log('💳 PaymentCounter order filtering result:', {
        isRelevant: !!relevantOrder,
        orderNumber: order.orderNumber,
        counterId
      });
      if (relevantOrder) {
        queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      }
    },
    onOrderUpdate: (order) => {
      console.log('💳 PaymentCounter received order update:', order);
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
    },
    onOrderStatusChange: (order, oldStatus, newStatus) => {
      console.log('💳 PaymentCounter received order status change:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        oldStatus,
        newStatus
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
    },
    onPaymentConfirmed: (order: any, confirmedByCounter: string) => {
      console.log('💳 PaymentCounter received payment confirmation:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        confirmedByCounter,
        currentCounterId: counterId
      });
      // Remove the order from this payment counter's UI by invalidating queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
    },
    onOrderRejected: (order: any, rejectedByCounter: string) => {
      console.log('💳 PaymentCounter received order rejection:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        rejectedByCounter,
        currentCounterId: counterId,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus
      });
      // Remove the order from this payment counter's UI by invalidating queries
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      // Also invalidate the general orders query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onConnected: () => {
      console.log('💳 PaymentCounter WebSocket connected, attempting to join counter room:', counterId);
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
    console.log('💳 PaymentCounter useEffect - WebSocket connection status:', {
      isConnected,
      counterId,
      canteenId,
      shouldJoin: isConnected && counterId && canteenId
    });

    console.log('💳 PaymentCounter - Attempting to join counter room:', {
      counterId,
      canteenId,
      isConnected
    });

    if (isConnected && counterId && canteenId) {
      // Add a small delay to ensure WebSocket is fully connected
      const timeoutId = setTimeout(() => {
        console.log('💳 PaymentCounter attempting to join counter room:', counterId);
        joinCounterRoom(counterId, canteenId);
        console.log('💳 PaymentCounter joinCounterRoom called for:', counterId);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (counterId) {
          leaveCounterRoom(counterId);
          console.log('💳 PaymentCounter left counter room:', counterId);
        }
      };
    }
  }, [isConnected, counterId, canteenId, joinCounterRoom, leaveCounterRoom]);

  // Additional effect to retry joining if not successful
  useEffect(() => {
    if (isConnected && counterId && canteenId) {
      const retryTimeout = setTimeout(() => {
        console.log('💳 PaymentCounter retry: attempting to join counter room again:', counterId);
        joinCounterRoom(counterId, canteenId);
      }, 1000);

      return () => clearTimeout(retryTimeout);
    }
  }, [isConnected, counterId, canteenId, joinCounterRoom]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch orders for this counter - only offline orders with pending_payment status
  const { data: orders = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['/api/orders', canteenId, counterId],
    queryFn: async () => {
      console.log('💳 PaymentCounter fetching orders for:', { canteenId, counterId });
      // Fetch all orders for the canteen and filter by paymentCounterId
      const result = await apiRequest(`/api/orders?canteenId=${canteenId}`);
      console.log('💳 PaymentCounter orders API response (all orders):', result);

      // Filter ALL offline orders with pending_payment status (regardless of payment counter assignment)
      const filteredOrders = result.filter((order: any) => {
        // Check if it's an offline order with pending payment
        const isOfflinePendingPayment = order.isOffline === true &&
          order.status === 'pending_payment' &&
          order.paymentStatus === 'pending';

        console.log(`💳 Order ${order.orderNumber} filtering check:`, {
          isOffline: order.isOffline,
          status: order.status,
          paymentStatus: order.paymentStatus,
          isOfflinePendingPayment,
          canteenId: order.canteenId,
          targetCanteenId: canteenId
        });

        // Show ALL offline orders for this canteen (regardless of payment counter assignment)
        if (isOfflinePendingPayment && order.canteenId === canteenId) {
          console.log(`💳 Order ${order.orderNumber} included - offline order for this canteen`);
          return true;
        }

        console.log(`💳 Order ${order.orderNumber} filtered out - not offline pending payment for this canteen`);
        return false;
      });
      console.log('💳 PaymentCounter filtered offline orders for payment counter:', filteredOrders);

      return filteredOrders;
    },
    enabled: !!counterId && !!canteenId,
    // No polling - only WebSocket updates
  });

  // Fetch menu items to check isMarkable property
  const { data: menuItemsData } = useQuery({
    queryKey: ['/api/menu', canteenId],
    queryFn: () => apiRequest(`/api/menu?canteenId=${canteenId}&availableOnly=false`), // Get all menu items (including unavailable/out of stock) for order filtering
    enabled: !!canteenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Extract menu items from API response
  const menuItems = menuItemsData?.items || [];

  console.log('💳 PaymentCounter useQuery state:', {
    isLoading,
    error,
    ordersCount: orders.length,
    enabled: !!counterId && !!canteenId,
    counterId,
    canteenId
  });


  // Process payment mutation - confirms offline order and broadcasts to store counters
  const processPaymentMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      }),
    onSuccess: async () => {
      console.log('💳 Payment confirmation successful - invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      // Also invalidate the general orders query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      // Force a refetch to get the latest data
      await queryClient.refetchQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      console.log('Payment confirmed successfully - order broadcasted to store counters');
      setSelectedOrder(null);
      // Close the order found modal
      setIsOrderFoundModalOpen(false);
      setCurrentOrderForBarcode(null);
    },
    onError: (error: any) => {
      console.error('Failed to confirm payment:', error.message || 'Unknown error');
    },
  });

  // Reject order mutation - rejects offline order and prevents it from going to store counters
  const rejectOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      }),
    onSuccess: async () => {
      console.log('💳 Order rejection successful - invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      // Also invalidate the general orders query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      // Force a refetch to get the latest data
      await queryClient.refetchQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      console.log('Order rejected successfully - order will not be sent to store counters');
    },
    onError: (error: any) => {
      console.error('Failed to reject order:', error.message || 'Unknown error');
    },
  });

  // Handle payment confirmation from the order found modal
  const handleConfirmPayment = () => {
    if (currentOrderForBarcode) {
      console.log('💳 Confirming payment for order:', currentOrderForBarcode.orderNumber);
      processPaymentMutation.mutate(currentOrderForBarcode.id);
    }
  };

  // Helper function to check if scanned barcode matches order (full barcode or first 4 digits)
  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;

    // Exact match
    if (scannedBarcode === orderBarcode || scannedBarcode === String(orderBarcode) || String(orderBarcode) === scannedBarcode) {
      return true;
    }

    // Check if scanned is first 4 digits of order barcode
    if (scannedBarcode.length === 4 && orderBarcode.length >= 4) {
      const first4Digits = String(orderBarcode).slice(0, 4);
      return scannedBarcode === first4Digits;
    }

    // Check if order barcode starts with scanned barcode (for partial matches)
    const orderBarcodeStr = String(orderBarcode);
    if (scannedBarcode.length < orderBarcodeStr.length) {
      return orderBarcodeStr.startsWith(scannedBarcode);
    }

    return false;
  };

  // Handle barcode scanning for payment confirmation
  const handlePaymentBarcodeScanned = async (barcode: string) => {
    console.log('💳 Barcode/OTP scanned for payment confirmation:', barcode);
    console.log('💳 Available orders for scanning:', orders.map((o: any) => ({
      orderNumber: o.orderNumber,
      barcode: o.barcode,
      status: o.status,
      isOffline: o.isOffline,
      paymentStatus: o.paymentStatus
    })));

    // Find the order by barcode (full barcode or first 4 digits OTP)
    // Try both string and number comparison to handle different formats
    const order = orders.find((o: any) => {
      // Check full barcode match
      if (matchesBarcode(barcode, o.barcode)) return true;

      // Also try orderNumber as fallback
      if (matchesBarcode(barcode, o.orderNumber)) return true;

      // Legacy exact matches
      if (o.barcode === barcode || o.barcode === String(barcode) || String(o.barcode) === barcode) return true;
      if (o.orderNumber === barcode || o.orderNumber === String(barcode) || String(o.orderNumber) === barcode) return true;

      return false;
    });

    console.log('💳 Order search result:', {
      scannedBarcode: barcode,
      foundOrder: order ? {
        orderNumber: order.orderNumber,
        barcode: order.barcode,
        status: order.status,
        isOffline: order.isOffline,
        paymentStatus: order.paymentStatus
      } : null
    });

    if (order && order.status === 'pending_payment' && order.isOffline) {
      console.log('💳 Found offline order for barcode/OTP:', order.orderNumber);
      // Show order found modal with payment confirmation
      setCurrentOrderForBarcode(order);
      setIsOrderFoundModalOpen(true);
    } else {
      console.log('💳 Order not found or not eligible for payment confirmation:', {
        barcode,
        foundOrder: !!order,
        orderStatus: order?.status,
        isOffline: order?.isOffline,
        paymentStatus: order?.paymentStatus
      });
      // Show order not found modal
      setScannedBarcode(barcode);
      setIsOrderNotFoundModalOpen(true);
    }
  };

  // Mark order as ready mutation
  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/orders/${orderId}/mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });
      console.log('Order marked as ready');
    },
    onError: (error: any) => {
      console.error('Failed to mark order as ready:', error.message || 'Unknown error');
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
      return items.some((item: any) => {
        // Try both id and _id fields to find the menu item
        const menuItem = menuItems.find((mi: any) => mi.id === item.id || mi._id === item.id);
        const isMarkable = menuItem?.isMarkable === true;
        return isMarkable;
      });
    } catch (error) {
      console.error('Error parsing order items:', error);
      return false;
    }
  };

  // Filter orders based on search and status (all orders are offline pending_payment)
  const filteredOrders = orders.filter((order: Order) => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    // Since all orders are pending_payment, we can filter by payment status or keep all
    const matchesStatus = statusFilter === 'all' || order.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'preparing':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'pending_payment':
        return <CreditCard className="h-4 w-4 text-warning" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
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

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      console.log('🔍 Barcode scanned:', barcode, 'for order:', currentOrderForBarcode?.id);
      console.log('🔍 Order barcode:', currentOrderForBarcode?.barcode);

      // Store the order data before closing the barcode modal
      const orderForVerification = currentOrderForBarcode;

      // Close the barcode scan modal first
      setIsBarcodeModalOpen(false);

      // Verify if the scanned barcode matches the order's barcode
      if (orderForVerification && barcode === orderForVerification.barcode) {
        console.log('✅ Barcode matches! Showing order found modal');
        setScannedBarcode(barcode);
        setCurrentOrderForBarcode(orderForVerification); // Keep the order data
        setIsOrderFoundModalOpen(true);
      } else {
        console.log('❌ Barcode does not match! Showing order not found modal');
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
      if (currentOrderForBarcode) {
        setIsDelivering(true);
        console.log('📦 Marking order as delivered:', currentOrderForBarcode.id);

        // Call the deliver API endpoint
        await apiRequest(`/api/orders/${currentOrderForBarcode.id}/deliver`, {
          method: 'POST',
          body: JSON.stringify({ counterId })
        });

        console.log('✅ Order marked as delivered successfully');

        // Refresh orders after marking as delivered
        queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId, counterId] });

        handleCloseOrderFoundModal();
      }
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      // You could add a toast notification here for error feedback
    } finally {
      setIsDelivering(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/20 text-success dark:bg-success/30 dark:text-success border border-success/40 dark:border-success/50';
      case 'preparing':
        return 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50';
      case 'ready':
        return 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary border border-primary/40 dark:border-primary/50';
      case 'pending_payment':
        return 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning border border-warning/40 dark:border-warning/50';
      case 'cancelled':
        return 'bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive border border-destructive/40 dark:border-destructive/50';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Failed to load payment counter data</p>
          <Button onClick={() => refetch()} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const countersRoute = isOwnerRoute
                ? `/canteen-owner-dashboard/${canteenId}/counters`
                : `/admin/canteen/${canteenId}/counters`;
              setLocation(countersRoute);
            }}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Counters</span>
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold flex items-center space-x-2">
                <CreditCard className="h-6 w-6" />
                <span>Offline Payment Counter</span>
              </h1>
              <div className="flex items-center space-x-1" title={
                isConnected
                  ? `WebSocket connected to counter room: ${counterId}`
                  : 'WebSocket disconnected - orders will not update in real-time'
              }>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'
                  }`}></div>
                <span className={`text-xs ${isConnected ? 'text-success' : 'text-destructive'
                  }`}>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <button
                onClick={() => {
                  console.log('💳 Manual join counter room test:', counterId);
                  joinCounterRoom(counterId, canteenId);
                }}
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Test Join Room
              </button>
            </div>
            <p className="text-muted-foreground">Confirm offline payments and broadcast to store counters</p>
          </div>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>


      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search Orders</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by order number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="md:w-48">
          <Label htmlFor="status-filter">Filter by Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredOrders.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || statusFilter !== 'all'
                  ? 'No offline orders match your current filters.'
                  : 'No offline orders are currently pending payment confirmation.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order: Order) => (
            <Card key={order.id} id={`order-card-${order.orderNumber}`} onClick={() => handleOrderClick(order)} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <CardTitle className="text-base md:text-lg">Order #{order.orderNumber}</CardTitle>
                      <CardDescription className="text-sm">{order.customerName}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(order.status) + ' hover:bg-warning/30 dark:hover:bg-warning/40'}>
                      {order.status.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Badge>
                    <Badge variant="outline">₹{order.amount}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex flex-col md:flex-row md:items-center space-y-1 md:space-y-0 md:space-x-3">
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(order.createdAt).toLocaleString()}
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      ₹{order.amount}
                    </div>
                  </div>

                  {/* Small Action Buttons in Bottom Right */}
                  <div className="flex flex-wrap gap-2">
                    {order.status === 'pending_payment' ? (
                      <>
                        {/* Offline order pending payment - Show Scan Barcode button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentOrderForBarcode(order);
                            setIsBarcodeModalOpen(true);
                          }}
                          disabled={processPaymentMutation.isPending || rejectOrderMutation.isPending}
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <QrCode className="h-3 w-3 mr-1" />
                          Scan Barcode
                        </Button>
                        {/* Reject Order button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectOrderMutation.mutate(order.id);
                          }}
                          disabled={processPaymentMutation.isPending || rejectOrderMutation.isPending}
                          size="sm"
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs px-3 py-1.5 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
        onBarcodeScanned={handlePaymentBarcodeScanned}
        onBack={handleBackToOrder}
        title="Scan Barcode"
      />

      {/* Order Found Modal */}
      <OrderFoundModal
        isOpen={isOrderFoundModalOpen}
        onClose={handleCloseOrderFoundModal}
        onMarkDelivered={handleMarkDelivered}
        onConfirmPayment={handleConfirmPayment}
        order={currentOrderForBarcode}
        isDelivering={isDelivering}
        isConfirmingPayment={processPaymentMutation.isPending}
        mode="payment"
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

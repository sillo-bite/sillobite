import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, CreditCard, HandCoins, Check, X, Truck, ShoppingBag, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useCart } from "@/contexts/CartContext";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";
import NotificationPermissionDialog from "@/components/modals/NotificationPermissionDialog";
import CouponApplicator from "@/components/payment/CouponApplicator";
import { useStockValidation } from "@/hooks/useStockValidation";
import StockValidationWarning from "@/components/canteen/StockValidationWarning";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { getUserFromStorage } from "@/utils/userStorage";
import { formatCurrency } from "@/utils/formatting";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddressSelectionDialog from "@/components/checkout/AddressSelectionDialog";

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [orderType, setOrderType] = useState<"delivery" | "takeaway">("takeaway");
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string;
  } | null>(null);
  const paymentValidRef = useRef(false);
  const addressSelectedRef = useRef(false); // Track if address was selected to prevent reset
  const queryClient = useQueryClient();

  // Checkout session management
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(1200); // 20 minutes in seconds
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAbandonedRef = useRef(false);
  const usePollingRef = useRef(false); // Track if we should use polling (fallback only)

  // Use cart context instead of reading from localStorage directly
  const { cart, clearCart, removeFromCart, getCartCanteenId, validateCartCanteen } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const userData = getUserFromStorage() || {};

  // Get canteen ID from cart or selected canteen
  const cartCanteenId = getCartCanteenId();
  const canteenId = cartCanteenId || selectedCanteen?.id || localStorage.getItem('selectedCanteenId');

  // Charges for this canteen
  const { data: chargesData } = useQuery<{
    items: Array<{ id: string; name: string; type: 'percent' | 'fixed'; value: number; active: boolean }>;
  }>({
    queryKey: ['/api/canteens', canteenId, 'charges'],
    queryFn: async () => apiRequest(`/api/canteens/${canteenId}/charges`),
    enabled: !!canteenId
  });

  // Canteen feature toggles (pay at counter, delivery)
  const { data: canteenSettings } = useQuery<any>({
    queryKey: ['/api/system-settings/canteens', canteenId, 'features'],
    queryFn: async () => apiRequest(`/api/system-settings/canteens/${canteenId}`),
    enabled: !!canteenId,
  });

  const allowPayAtCounter = canteenSettings?.payAtCounterEnabled ?? true;
  const allowDelivery = canteenSettings?.deliveryEnabled ?? true;

  // Enforce takeaway when delivery disabled for this canteen
  useEffect(() => {
    if (allowDelivery === false && orderType === "delivery") {
      setOrderType("takeaway");
      setSelectedAddress(null);
    }
  }, [allowDelivery, orderType]);

  // Enforce UPI when pay-at-counter disabled
  useEffect(() => {
    if (allowPayAtCounter === false && paymentMethod === "offline") {
      setPaymentMethod("upi");
    }
  }, [allowPayAtCounter, paymentMethod]);

  // WebSocket for checkout session status updates (primary method)
  const { isConnected: isWebSocketConnected } = useWebSocket({
    canteenIds: canteenId ? [canteenId] : [],
    enabled: !!canteenId && !!checkoutSessionId,
    onCheckoutSessionStatusChange: (sessionId, status, timeRemaining) => {
      // Only process if it's for our session
      if (sessionId === checkoutSessionId) {
        setSessionTimeLeft(timeRemaining);

        // If session expired, trigger timeout
        if (timeRemaining <= 0 && !showTimeoutDialog) {
          setShowTimeoutDialog(true);
          // Restore stock by abandoning the session
          apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
            method: 'POST'
          }).catch(console.error);
        }
      }
    },
    onConnected: () => {
      // WebSocket connected - stop polling
      usePollingRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    },
    onDisconnected: () => {
      // WebSocket disconnected - start polling as fallback
      usePollingRef.current = true;
    }
  });

  // Initialize notification hook
  const { permission, supportsNotifications } = useWebPushNotifications(userData?.id, userData?.role);

  // Initialize stock validation
  const { validationResult, isLoading: isStockLoading, refetch: refetchStock } = useStockValidation(cart);

  // Menu API call completely removed - counter IDs are REQUIRED and stored in cart items when items are added
  // All cart items MUST have storeCounterId and paymentCounterId - validation will fail if missing

  const subtotal = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const totalBeforeDiscount = subtotal;
  const activeCharges = (chargesData?.items || []).filter((c) => c.active);
  const baseAmount = appliedCoupon ? appliedCoupon.finalAmount : totalBeforeDiscount;
  const chargesComputation = (() => {
    let chargesTotal = 0;
    const chargesApplied: Array<{ name: string; type: 'percent' | 'fixed'; value: number; amount: number }> = [];
    activeCharges.forEach((charge) => {
      const amount = charge.type === 'percent' ? (baseAmount * charge.value) / 100 : charge.value;
      if (amount > 0) {
        chargesApplied.push({
          name: charge.name,
          type: charge.type,
          value: charge.value,
          amount: Number(amount.toFixed(2))
        });
        chargesTotal += amount;
      }
    });
    return {
      chargesApplied,
      chargesTotal: Number(chargesTotal.toFixed(2))
    };
  })();
  const chargesTotal = chargesComputation.chargesTotal;
  const chargesApplied = chargesComputation.chargesApplied;
  const total = baseAmount + chargesTotal;

  // Get total item count
  const getTotalItems = () => {
    return cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
  };

  // Collect all counter IDs from cart items (REQUIRED - all items must have counter IDs)
  const collectCounterIds = async (retryCount = 0): Promise<{
    storeCounterIds: string[];
    paymentCounterIds: string[];
    allCounterIds: string[];
  }> => {
    const storeCounterIds = new Set<string>();
    const paymentCounterIds = new Set<string>();
    const MAX_RETRIES = 2;

    // Validate that all cart items have counter IDs (REQUIRED)
    const itemsWithoutCounterIds = cart.filter(
      item => !item.storeCounterId || !item.paymentCounterId
    );

    if (itemsWithoutCounterIds.length > 0) {
      const missingItems = itemsWithoutCounterIds.map(item => item.name).join(', ');
      const errorMessage = `Counter IDs are required for all items. Missing counter IDs for: ${missingItems}.\n\n` +
        `These items were likely added before counter IDs were required. ` +
        `Please remove these items from your cart and add them again from the menu page.`;

      console.error('❌ Cart items missing counter IDs:', {
        missingItems: itemsWithoutCounterIds.map(item => ({
          id: item.id,
          name: item.name,
          storeCounterId: item.storeCounterId,
          paymentCounterId: item.paymentCounterId
        }))
      });

      throw new Error(errorMessage);
    }

    // Collect counter IDs directly from cart items (all items should have them)
    cart.forEach(cartItem => {
      if (cartItem.storeCounterId) {
        storeCounterIds.add(cartItem.storeCounterId);
      }
      if (cartItem.paymentCounterId) {
        paymentCounterIds.add(cartItem.paymentCounterId);
      }
    });

    // For offline orders, we need to get ALL payment counters for the canteen
    // This is the only API call needed (separate from menu API)
    if (canteenId) {
      try {
        const response = await apiRequest(`/api/counters?canteenId=${canteenId}&type=payment`);
        const allPaymentCounters = response || [];

        // Add ALL payment counters for offline orders
        allPaymentCounters.forEach((counter: any) => {
          paymentCounterIds.add(counter.id);
        });
      } catch (error) {
        console.warn('Failed to fetch payment counters, retrying...', error);
        // Retry logic
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1))); // Exponential backoff
          return collectCounterIds(retryCount + 1);
        }
        // Fallback: use payment counter IDs from cart items (already collected above)
        console.warn('Using payment counter IDs from cart items as fallback');
      }
    }

    return {
      storeCounterIds: Array.from(storeCounterIds),
      paymentCounterIds: Array.from(paymentCounterIds),
      allCounterIds: Array.from(new Set([...Array.from(storeCounterIds), ...Array.from(paymentCounterIds)]))
    };
  };

  // Validate cart canteen on mount
  useEffect(() => {
    if (selectedCanteen?.id && cart.length > 0) {
      if (!validateCartCanteen(selectedCanteen.id)) {
        // Dispatch custom event to switch to cart view in AppPage
        window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
        setLocation('/app');
      }
    }
  }, [selectedCanteen?.id, cart.length, validateCartCanteen, setLocation]);

  // Function to fetch college name by ID
  const fetchCollegeName = async (collegeId: string) => {
    try {
      const response = await fetch(`/api/system-settings/colleges/${collegeId}/name`);
      if (response.ok) {
        const data = await response.json();
        return data.name || 'Unknown College';
      }
    } catch (error) {
      // Silently fail and return default
    }
    return 'Unknown College';
  };

  const createOrderDirectly = async () => {
    try {
      const orderData = await buildOrderData(true);

      if (!canteenId) {
        alert('Please select a canteen before placing an order.');
        setPaymentInProgress(false);
        paymentValidRef.current = false;
        return;
      }

      // Add checkout session ID to order data (for stock reservation handling)
      const orderDataWithSession = {
        ...orderData,
        checkoutSessionId: checkoutSessionId
      };

      const newOrder = await createOrderMutation.mutateAsync(orderDataWithSession);

      // Update checkout session status to completed
      if (checkoutSessionId) {
        try {
          await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'completed' })
          });
          hasAbandonedRef.current = true; // Prevent abandon on unmount
        } catch (error) {
          console.error('Error updating checkout session status:', error);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });
      await queryClient.refetchQueries({ queryKey: ['/api/orders'] });
      await queryClient.refetchQueries({ queryKey: ['/api/orders/active/paginated'] });

      setTimeout(() => {
        setLocation(`/order-status/${newOrder.orderNumber}`);
      }, 300);
    } catch (error) {
      const errorMessage = (error as any).message || 'Failed to create order. Please try again.';
      alert(errorMessage);
      setPaymentInProgress(false);
      paymentValidRef.current = false;
    }
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
    },
    onSuccess: () => {
      // Invalidate orders cache to refresh order lists
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      // Also invalidate active orders query to refresh bottom sheet immediately
      queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });
      // Clear cart after successful order using cart context
      clearCart();
    },
  });


  // ============================================
  // Checkout Session Management
  // ============================================

  // Create or use existing checkout session when component mounts
  useEffect(() => {
    const initializeCheckoutSession = async () => {
      try {
        // Check if session already exists (created in CartPage)
        const existingSessionId = localStorage.getItem('currentCheckoutSessionId');

        if (existingSessionId) {
          // Use existing session
          try {
            const statusResponse = await apiRequest(`/api/checkout-sessions/${existingSessionId}/status`);
            if (statusResponse.success) {
              setCheckoutSessionId(existingSessionId);
              setSessionTimeLeft(statusResponse.timeRemaining || 1200);
              console.log('✅ Using existing checkout session:', existingSessionId);
              return;
            }
          } catch (error) {
            console.warn('Existing session not found, creating new one:', error);
            localStorage.removeItem('currentCheckoutSessionId');
          }
        }

        // Create new session if none exists
        const response = await apiRequest('/api/checkout-sessions/create', {
          method: 'POST',
          body: JSON.stringify({
            customerId: userData.id || 0,
            canteenId: canteenId || undefined
          })
        });

        if (response.success && response.sessionId) {
          setCheckoutSessionId(response.sessionId);
          setSessionTimeLeft(response.timeRemaining || 1200);
          localStorage.setItem('currentCheckoutSessionId', response.sessionId);
          console.log('✅ Checkout session created:', response.sessionId);
        }
      } catch (error) {
        console.error('Error initializing checkout session:', error);
      }
    };

    initializeCheckoutSession();
  }, []); // Only run on mount

  // Update session activity periodically (heartbeat every 60 seconds - OPTIMIZED)
  useEffect(() => {
    if (!checkoutSessionId) return;

    const updateActivity = async () => {
      try {
        await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/activity`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Error updating checkout session activity:', error);
      }
    };

    // Update activity immediately and then every 60 seconds (reduced from 30s)
    updateActivity();
    activityIntervalRef.current = setInterval(updateActivity, 60000);

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [checkoutSessionId]);

  // Session timer countdown
  useEffect(() => {
    if (!checkoutSessionId || sessionTimeLeft <= 0) {
      // Session expired - show timeout dialog and restore stock
      if (sessionTimeLeft === 0 && checkoutSessionId && !hasAbandonedRef.current && !showTimeoutDialog) {
        setShowTimeoutDialog(true);
        // Restore stock by abandoning the session
        apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
          method: 'POST'
        }).catch(console.error);
        // Mark session as expired
        apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'expired' })
        }).catch(console.error);
      }
      return;
    }

    sessionTimerRef.current = setTimeout(() => {
      setSessionTimeLeft(prev => {
        if (prev <= 1) {
          // Session expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [checkoutSessionId, sessionTimeLeft, showTimeoutDialog]);

  // Sync session status from server (FALLBACK ONLY - when WebSocket is disconnected)
  useEffect(() => {
    if (!checkoutSessionId) return;

    // Only poll if WebSocket is not connected (fallback mode)
    if (!usePollingRef.current && isWebSocketConnected) {
      // WebSocket is connected - clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const syncSessionStatus = async () => {
      try {
        const response = await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/status`);
        if (response.success) {
          const serverTimeRemaining = response.timeRemaining || 0;
          setSessionTimeLeft(serverTimeRemaining);

          // If server says session is expired, trigger timeout
          if (serverTimeRemaining <= 0 && !showTimeoutDialog) {
            setShowTimeoutDialog(true);
            // Restore stock by abandoning the session
            apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
              method: 'POST'
            }).catch(console.error);
          }
        }
      } catch (error) {
        console.error('Error syncing session status (polling fallback):', error);
      }
    };

    // Poll every 10 seconds only when WebSocket is disconnected
    pollingIntervalRef.current = setInterval(syncSessionStatus, 10000);
    syncSessionStatus(); // Sync immediately

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [checkoutSessionId, showTimeoutDialog, isWebSocketConnected]);

  // Abandon session when component unmounts
  useEffect(() => {
    return () => {
      if (checkoutSessionId && !hasAbandonedRef.current) {
        hasAbandonedRef.current = true;
        apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
          method: 'POST'
        }).catch(console.error);
        localStorage.removeItem('currentCheckoutSessionId');
      }

      // Cleanup all timers
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [checkoutSessionId]);


  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleNotificationDialogClose = () => {
    setShowNotificationDialog(false);
    // Set loading state again before proceeding
    setPaymentInProgress(true);
    // Proceed with order even if user skips notifications
    proceedWithOrder();
  };

  const handleRemoveItem = (itemId: string) => {
    removeFromCart(itemId);
  };

  const handleRetryStockCheck = () => {
    refetchStock();
  };

  const handlePlaceOrder = async () => {
    // Check stock validation first
    if (!validationResult.isValid) {
      return;
    }

    // If delivery is selected but no address is chosen, show address dialog
    if (orderType === "delivery" && !selectedAddress && userData?.id) {
      setShowAddressDialog(true);
      return;
    }

    // Set loading state IMMEDIATELY to prevent duplicate clicks
    setPaymentInProgress(true);

    // Check notification permissions before placing order
    if (supportsNotifications && permission !== 'granted') {
      // Reset loading state when showing dialog
      setPaymentInProgress(false);
      // Show notification permission dialog
      setShowNotificationDialog(true);
      return;
    }

    // Proceed with order placement
    proceedWithOrder();
  };

  // Shared function to build complete order data - consolidates duplicate logic
  const buildOrderData = async (isOffline: boolean) => {
    const counterIds = await collectCounterIds();

    let collegeName = 'Not specified';
    if (userData.college) {
      collegeName = await fetchCollegeName(userData.college);
    }

    const enhancedCart = cart.map(item => ({
      ...item,
      category: item.category || 'Main Course'
    }));

    // For 0 amount orders, payment is not needed
    const isFreeOrder = total <= 0;

    // Determine status based on order type:
    // - Free orders: status will be determined by server based on markable items
    // - Offline paid orders: pending_payment (waiting for payment at counter)
    // - Online paid orders: status will be determined by server based on markable items after payment
    let orderStatus: string;
    let orderPaymentStatus: string;

    if (isFreeOrder) {
      // Free orders: server will determine status based on markable items
      // Status will be 'pending' if has markable items, 'ready' if not
      orderStatus = 'pending'; // Server will adjust based on markable items
      orderPaymentStatus = 'completed'; // Free orders are automatically paid
    } else if (isOffline) {
      // Offline paid orders: must wait for payment at counter
      orderStatus = 'pending_payment';
      orderPaymentStatus = 'pending';
    } else {
      // Online paid orders: status will be set by server after payment succeeds
      // For now, set a placeholder - server will update after payment
      orderStatus = 'pending'; // Server will adjust based on markable items after payment
      orderPaymentStatus = 'pending'; // Will be updated to 'paid' after payment succeeds
    }

    return {
      customerId: userData.id || null,
      customerName: userData.name || 'Guest User',
      collegeName: collegeName,
      items: JSON.stringify(enhancedCart),
      amount: total,
      itemsSubtotal: subtotal,
      taxAmount: 0, // No tax for regular user orders (tax only applied in POS orders)
      chargesTotal: chargesTotal,
      chargesApplied: chargesApplied,
      originalAmount: appliedCoupon ? totalBeforeDiscount : total,
      discountAmount: appliedCoupon ? appliedCoupon.discountAmount : 0,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
      status: orderStatus,
      estimatedTime: 15,
      canteenId: canteenId,
      isOffline: isOffline,
      paymentStatus: orderPaymentStatus,
      paymentMethod: isOffline ? 'offline' : paymentMethod, // 'offline', 'upi', etc.
      orderType: orderType, // Include orderType in all order creation paths
      storeCounterIds: counterIds.storeCounterIds,
      paymentCounterIds: counterIds.paymentCounterIds,
      allCounterIds: counterIds.allCounterIds,
      // Include delivery address if delivery order type
      ...(orderType === "delivery" && selectedAddress ? {
        deliveryAddress: {
          label: selectedAddress.label,
          fullName: selectedAddress.fullName,
          phoneNumber: selectedAddress.phoneNumber,
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          landmark: selectedAddress.landmark,
        }
      } : {})
    };
  };

  const handleOfflinePayment = async () => {
    try {
      const orderData = await buildOrderData(true);

      if (!canteenId) {
        alert('Please select a canteen before placing an order.');
        setPaymentInProgress(false);
        paymentValidRef.current = false;
        return;
      }

      // Add checkout session ID to order data
      const orderDataWithSession = {
        ...orderData,
        checkoutSessionId: checkoutSessionId
      };

      const response = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderDataWithSession),
      });

      // Update checkout session status to completed
      if (checkoutSessionId) {
        try {
          await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'completed' })
          });
          hasAbandonedRef.current = true; // Prevent abandon on unmount
        } catch (error) {
          console.error('Error updating checkout session status:', error);
        }
      }

      if (response && response.orderNumber) {
        clearCart();
        setLocation(`/order-status/${response.orderNumber}`);
      } else if (response && response.id) {
        clearCart();
        setLocation(`/order-status/${response.id}`);
      }
    } catch (error) {
      // Reset loading state on error
      setPaymentInProgress(false);
      paymentValidRef.current = false;

      // Show error to user
      const errorMessage = (error as any).message || 'Failed to place order. Please try again.';
      alert(errorMessage);
    }
  };

  const proceedWithOrder = async () => {
    // Check if the amount is 0 (due to coupon discount)
    // Fixed: Use consistent threshold (total <= 0) instead of total <= 1
    if (total <= 0) {
      // For free orders, directly create the order without payment
      // Keep loading state active (already set in handlePlaceOrder)
      paymentValidRef.current = false;

      // Clean up any pending order data
      localStorage.removeItem('pendingOrderData');

      // Create order directly
      await createOrderDirectly();
      return;
    }

    // Handle offline payment
    if (paymentMethod === 'offline') {
      await handleOfflinePayment();
      return;
    }

    // Loading state already set in handlePlaceOrder - no need to set again

    // Set payment in progress
    setPaymentInProgress(true);
    paymentValidRef.current = true;

    try {
      // Collect counter IDs and college name before payment initiation
      const counterIds = await collectCounterIds();
      let collegeName = 'Not specified';
      if (userData.college) {
        collegeName = await fetchCollegeName(userData.college);
      }

      const enhancedCart = cart.map(item => ({
        ...item,
        category: item.category || 'Main Course'
      }));

      // Build complete order data with all required fields for payment callback
      // Use buildOrderData to ensure deliveryAddress is included for delivery orders
      const baseOrderData = await buildOrderData(false);
      const orderData = {
        ...baseOrderData, // This includes deliveryAddress if it's a delivery order
        storeCounterIds: counterIds.storeCounterIds,
        paymentCounterIds: counterIds.paymentCounterIds,
        allCounterIds: counterIds.allCounterIds
      };

      if (!canteenId) {
        alert('Please select a canteen before placing an order.');
        setPaymentInProgress(false);
        paymentValidRef.current = false;
        return;
      }

      // Store order data in localStorage for later order creation (fallback)
      localStorage.setItem('pendingOrderData', JSON.stringify(orderData));

      // Generate idempotency key to prevent duplicate payments
      const idempotencyKey = `payment_${userData.id || 'guest'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Initiate Razorpay payment with complete order data
      const paymentResponse = await apiRequest('/api/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          amount: total,
          customerName: userData.name || 'Guest User',
          orderData: orderData, // Send complete order data to be stored with payment
          idempotencyKey: idempotencyKey, // Prevent duplicate payments
          checkoutSessionId: checkoutSessionId // Pass checkout session ID
        }),
      });

      if (paymentResponse.success) {
        // Update checkout session status to payment_initiated
        if (checkoutSessionId) {
          try {
            await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
              method: 'POST',
              body: JSON.stringify({
                status: 'payment_initiated',
                metadata: {
                  merchantTransactionId: paymentResponse.merchantTransactionId,
                  razorpayOrderId: paymentResponse.razorpayOrderId
                }
              })
            });
          } catch (error) {
            console.error('Error updating checkout session status:', error);
          }
        }

        // Validate required fields
        if (!paymentResponse.keyId || !paymentResponse.razorpayOrderId) {
          setPaymentInProgress(false);
          paymentValidRef.current = false;
          localStorage.removeItem('pendingOrderData');
          alert('Payment gateway configuration error. Please contact support.');
          return;
        }

        localStorage.setItem('currentPaymentTxnId', paymentResponse.merchantTransactionId);

        // Function to initialize Razorpay checkout
        const initRazorpay = () => {
          try {
            if (!(window as any).Razorpay) {
              throw new Error('Razorpay script not loaded');
            }

            const options = {
              key: paymentResponse.keyId,
              amount: paymentResponse.amount,
              currency: paymentResponse.currency || 'INR',
              name: 'Kit Sillobyte',
              description: 'Order Payment',
              order_id: paymentResponse.razorpayOrderId,
              handler: function (response: any) {
                // Payment successful - update checkout session status before redirect
                if (checkoutSessionId) {
                  apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'payment_completed' })
                  }).catch(console.error);
                }
                // Redirect to callback page
                window.location.href = `/payment-callback?razorpay_payment_id=${response.razorpay_payment_id}&razorpay_order_id=${response.razorpay_order_id}&razorpay_signature=${response.razorpay_signature}`;
              },
              prefill: {
                name: userData.name || 'Guest User',
                email: userData.email || '',
                contact: userData.phone || ''
              },
              theme: {
                color: '#6366f1'
              },
              modal: {
                ondismiss: async function () {
                  // User closed the modal - restore stock and navigate back to cart
                  setPaymentInProgress(false);
                  paymentValidRef.current = false;

                  // Restore stock by abandoning the session
                  if (checkoutSessionId) {
                    try {
                      await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
                        method: 'POST'
                      });
                      console.log('✅ Stock restored after payment modal dismissal');
                    } catch (error) {
                      console.error('Error restoring stock:', error);
                    }
                  }

                  // Clean up local storage
                  localStorage.removeItem('pendingOrderData');
                  localStorage.removeItem('currentPaymentTxnId');
                  localStorage.removeItem('currentCheckoutSessionId');

                  // Navigate back to cart page
                  window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                  setLocation('/app');
                }
              }
            };

            const razorpay = new (window as any).Razorpay(options);
            razorpay.on('payment.failed', async function (response: any) {
              console.error('Payment failed:', response);

              // Restore stock and update checkout session status to payment_failed
              if (checkoutSessionId) {
                try {
                  // Restore stock by abandoning the session (which restores stock)
                  await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/abandon`, {
                    method: 'POST'
                  });
                  // Then mark as payment_failed
                  await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'payment_failed' })
                  });
                  console.log('✅ Stock restored after payment failure');
                } catch (error) {
                  console.error('Error restoring stock or updating checkout session status:', error);
                }
              }

              setPaymentInProgress(false);
              paymentValidRef.current = false;
              localStorage.removeItem('pendingOrderData');
              localStorage.removeItem('currentPaymentTxnId');
              window.location.href = '/payment-callback?status=failed';
            });
            razorpay.open();
          } catch (error) {
            console.error('Error initializing Razorpay:', error);
            setPaymentInProgress(false);
            paymentValidRef.current = false;
            localStorage.removeItem('pendingOrderData');
            localStorage.removeItem('currentPaymentTxnId');
            alert('Failed to initialize payment gateway. Please try again.');
          }
        };

        // Check if Razorpay script is already loaded
        if ((window as any).Razorpay) {
          initRazorpay();
        } else {
          // Load Razorpay Checkout script dynamically
          const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
          if (existingScript) {
            // Script already exists, wait for it to load
            existingScript.addEventListener('load', initRazorpay);
            if ((window as any).Razorpay) {
              initRazorpay();
            }
          } else {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = initRazorpay;
            script.onerror = () => {
              setPaymentInProgress(false);
              paymentValidRef.current = false;
              localStorage.removeItem('pendingOrderData');
              alert('Failed to load payment gateway. Please try again.');
            };
            document.body.appendChild(script);
          }
        }
      } else {
        // Payment initiation failed
        setPaymentInProgress(false);
        paymentValidRef.current = false;

        // Clean up stored data
        localStorage.removeItem('pendingOrderData');

        const errorMessage = paymentResponse.message || 'Payment initiation failed. Please try again.';
        alert(errorMessage);
      }
    } catch (error) {
      // Error during payment initiation
      setPaymentInProgress(false);
      paymentValidRef.current = false;

      // Clean up stored data
      localStorage.removeItem('pendingOrderData');

      const errorMessage = (error as any).message?.includes('timeout')
        ? "Payment gateway is taking too long to respond. Please try again."
        : (error as any).message || "Failed to process payment. Please try again.";

      alert(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-background px-4 py-4 pt-8 sticky top-0 z-10">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => {
              window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
              setLocation('/app');
            }} className="text-foreground hover:bg-accent">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Checkout</h1>
          </div>
          {/* Checkout Session Timer - Always visible when session is active */}
          <div className="pr-4">
            {checkoutSessionId && sessionTimeLeft > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground">
                  {formatTime(sessionTimeLeft)}
                </div>
              </div>

            )}
          </div>
        </div>
      </div>

      <div className="pb-32">
        {/* Priority 1: Critical Warnings */}
        <div className="px-4 pt-4 space-y-4">
          {/* Stock Validation Warning - Highest Priority */}
          <StockValidationWarning
            validationResult={validationResult}
            onRetry={handleRetryStockCheck}
            onRemoveItem={handleRemoveItem}
            isLoading={isStockLoading}
          />
        </div>

        {/* Priority 2: Order Details & Payment */}
        <div className="px-4 space-y-4">
          {/* Order Summary - High Priority */}
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Order Summary</h3>

              {/* Order Items */}
              <div className="space-y-2 mb-3">
                {cart.map((item: any, index: number) => {
                  const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
                  const itemTotal = itemPrice * item.quantity;
                  return (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-medium text-foreground">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(itemPrice)} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(itemTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-foreground">Subtotal ({getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'})</span>
                  <span className="text-foreground font-medium">{formatCurrency(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#22c55e]">Coupon Discount ({appliedCoupon.code})</span>
                    <span className="text-[#22c55e] font-medium">-{formatCurrency(appliedCoupon.discountAmount)}</span>
                  </div>
                )}

                {chargesApplied.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border">
                    {chargesApplied.map((charge) => (
                      <div key={charge.name} className="flex justify-between items-center">
                        <span className="text-foreground text-sm">
                          {charge.name} ({charge.type === 'percent' ? `${charge.value}%` : `₹${charge.value}`})
                        </span>
                        <span className="text-foreground font-medium">+{formatCurrency(charge.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-foreground font-bold text-lg">Total</span>
                  <span className={appliedCoupon && appliedCoupon.discountAmount > 0 ? "text-[#22c55e] font-bold text-lg" : "text-foreground font-bold text-lg"}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coupon Applicator - Medium Priority */}
          <CouponApplicator
            totalAmount={totalBeforeDiscount}
            onCouponApplied={(couponData) => setAppliedCoupon(couponData)}
            onCouponRemoved={() => setAppliedCoupon(null)}
            appliedCoupon={appliedCoupon}
          />

          {/* Order Type - High Priority */}
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center text-foreground">
                <ShoppingBag className="w-5 h-5 mr-2 text-primary" />
                Order Type
              </h3>
              <RadioGroup value={orderType} onValueChange={(value) => {
                const newOrderType = value as "delivery" | "takeaway";
                setOrderType(newOrderType);
                // Show address dialog when delivery is selected
                if (newOrderType === "delivery" && userData?.id) {
                  setShowAddressDialog(true);
                } else if (newOrderType === "takeaway") {
                  // Clear selected address when switching to takeaway
                  setSelectedAddress(null);
                }
              }}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors">
                    <RadioGroupItem value="takeaway" id="takeaway" className="border-primary text-primary data-[state=checked]:bg-primary" />
                    <Label htmlFor="takeaway" className="flex-1 cursor-pointer">
                      <div className="flex items-center">
                        <ShoppingBag className="w-5 h-5 mr-3 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">Takeaway</p>
                          <p className="text-sm text-muted-foreground">Collect your order from the counter</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                  {allowDelivery && (
                    <div className="flex items-center space-x-3 p-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors">
                      <RadioGroupItem value="delivery" id="delivery" className="border-primary text-primary data-[state=checked]:bg-primary" />
                      <Label htmlFor="delivery" className="flex-1 cursor-pointer">
                        <div className="flex items-center">
                          <Truck className="w-5 h-5 mr-3 text-[#3b82f6]" />
                          <div>
                            <p className="font-medium text-foreground">Delivery</p>
                            <p className="text-sm text-muted-foreground">Get your order delivered to your location</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}
                </div>
              </RadioGroup>

              {/* Display Selected Address for Delivery */}
              {orderType === "delivery" && selectedAddress && (
                <div className="mt-4 p-3 border border-border rounded-lg bg-muted">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-[#3b82f6]" />
                        <h4 className="font-semibold text-foreground text-sm">Delivery Address</h4>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{selectedAddress.label}</p>
                        <p>{selectedAddress.fullName} • {selectedAddress.phoneNumber}</p>
                        <p>
                          {selectedAddress.addressLine1}
                          {selectedAddress.addressLine2 && `, ${selectedAddress.addressLine2}`}
                        </p>
                        <p>
                          {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                        </p>
                        {selectedAddress.landmark && (
                          <p className="text-xs">Landmark: {selectedAddress.landmark}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddressDialog(true)}
                      className="text-[#3b82f6] hover:text-[#2563eb]"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {/* Show message if delivery selected but no address */}
              {orderType === "delivery" && !selectedAddress && userData?.id && (
                <div className="mt-4 p-3 border border-yellow-600/50 rounded-lg bg-yellow-600/10">
                  <p className="text-sm text-yellow-400">
                    Please select a delivery address to continue
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method - High Priority */}
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center text-foreground">
                <CreditCard className="w-5 h-5 mr-2 text-primary" />
                Payment Method
              </h3>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors">
                    <RadioGroupItem value="upi" id="upi" className="border-primary text-primary data-[state=checked]:bg-primary" />
                    <Label htmlFor="upi" className="flex-1 cursor-pointer">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 mr-3 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">UPI Payment</p>
                          <p className="text-sm text-muted-foreground">Google Pay, Razorpay, UPI, Cards</p>
                        </div>
                      </div>
                    </Label>
                    <span className="bg-[#22c55e] text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                      Recommended
                    </span>
                  </div>

                  {allowPayAtCounter && (
                    <div className="flex items-center space-x-3 p-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors">
                      <RadioGroupItem value="offline" id="offline" className="border-primary text-primary data-[state=checked]:bg-primary" />
                      <Label htmlFor="offline" className="flex-1 cursor-pointer">
                        <div className="flex items-center">
                          <HandCoins className="w-5 h-5 mr-3 text-[#f97316]" />
                          <div>
                            <p className="font-medium text-foreground">Pay at Counter</p>
                            <p className="text-sm text-muted-foreground">Pay cash/card at the canteen counter</p>
                          </div>
                        </div>
                      </Label>
                      <span className="bg-[#f97316] text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                        Offline
                      </span>
                    </div>
                  )}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Important Information - Low Priority */}
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="p-4">
              <div className="rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Important Information
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Orders are prepared fresh - slight delays may occur during peak hours</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>For offline payments, complete payment at the counter before collecting your order</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Review your order details carefully before confirming</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Place Order Button - Highest Priority */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 space-y-2 shadow-2xl z-50">
        <Button
          variant="food"
          size="mobile"
          className={`w-full bg-[#22c55e] hover:bg-[#16a34a] text-white transition-all ${paymentInProgress ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          onClick={handlePlaceOrder}
          disabled={paymentInProgress || cart.length === 0 || !validationResult.isValid}
        >
          {paymentInProgress ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {paymentMethod === 'offline' ? 'Placing Order...' : 'Redirecting to Payment Gateway...'}
            </>
          ) : paymentMethod === 'offline' ? (
            `Place Order • ${formatCurrency(total)}`
          ) : (
            `Pay Now • ${formatCurrency(total)}`
          )}
        </Button>

        {cart.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Your cart is empty. Add items to continue.
          </p>
        )}

        {!validationResult.isValid && cart.length > 0 && (
          <p className="text-center text-sm text-[#f87171]">
            Please resolve stock availability issues above to place your order.
          </p>
        )}
      </div>

      {/* Notification Permission Dialog */}
      <NotificationPermissionDialog
        isOpen={showNotificationDialog}
        onClose={handleNotificationDialogClose}
        userId={userData?.id}
        userRole={userData?.role}
      />

      {/* Session Timeout Dialog */}
      <AlertDialog open={showTimeoutDialog} onOpenChange={(open) => {
        if (!open) {
          // When dialog is closed, redirect to cart
          setShowTimeoutDialog(false);
          localStorage.removeItem('currentCheckoutSessionId');
          window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
          setLocation('/app');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" />
              Session Expired
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your checkout session has timed out after 20 minutes. Your reserved items have been released back to inventory.
              <br /><br />
              Please return to your cart and proceed to checkout again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowTimeoutDialog(false);
                localStorage.removeItem('currentCheckoutSessionId');
                window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                setLocation('/app');
              }}
            >
              Return to Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Address Selection Dialog */}
      {userData?.id && (
        <AddressSelectionDialog
          open={showAddressDialog}
          onClose={() => {
            setShowAddressDialog(false);
            // Only reset to takeaway if no address was selected (user closed dialog without selecting)
            // Use ref to check if address was actually selected
            if (!addressSelectedRef.current && orderType === "delivery") {
              setOrderType("takeaway");
            }
            // Reset the ref for next time
            addressSelectedRef.current = false;
          }}
          onSelect={(address) => {
            // Mark that address was selected
            addressSelectedRef.current = true;
            // Set address and ensure orderType is delivery
            setSelectedAddress(address);
            setOrderType("delivery"); // Ensure delivery is selected
            setShowAddressDialog(false);
          }}
          userId={userData.id}
        />
      )}
    </div>
  );
}
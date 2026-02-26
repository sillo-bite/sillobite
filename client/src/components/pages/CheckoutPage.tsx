import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, CreditCard, HandCoins, Check, X, Truck, ShoppingBag, MapPin, ChevronUp } from "lucide-react";
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
import { calculateOrderTotal } from "../../../../shared/pricing";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AddressSelectionDialog from "@/components/checkout/AddressSelectionDialog";
import Lottie from "lottie-react";
import takeawayAnimation from "@/lottiefiles/takeaway.json";
import deliveryAnimation from "@/lottiefiles/Delivery Service-Delivery man.json";
import upiPaymentAnimation from "@/lottiefiles/upiPayment.json";
import offlinePaymentAnimation from "@/lottiefiles/offlinePayment.json";

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "takeaway">("takeaway");
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
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
  const userData = (getUserFromStorage() || {}) as any;

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
        if (status === 'abandoned') {
          localStorage.removeItem('currentCheckoutSessionId');
          window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
          setLocation('/app?view=cart');
          return;
        }

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

  const mappedCoupon = appliedCoupon ? {
    type: 'fixed' as const, // The frontend appliedCoupon only stores discountAmount and finalAmount, so it acts like a fixed discount at this stage
    value: appliedCoupon.discountAmount,
    maxDiscountAmount: undefined
  } : undefined;

  const {
    subtotal,
    discountAmount,
    totalBeforeCharges: totalBeforeDiscount, // Using totalBeforeCharges as totalBeforeDiscount for UI
    chargesTotal,
    finalTotal: total,
    chargesApplied
  } = calculateOrderTotal(
    cart,
    chargesData?.items || [],
    mappedCoupon
  );

  // For coupon validation, use subtotal (menu items only, before charges and discount)
  // This ensures minimum order amount is checked against items only
  const amountForCouponValidation = subtotal;

  const baseAmount = appliedCoupon ? appliedCoupon.finalAmount : totalBeforeDiscount;

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
          const serverStatus = response.status;

          if (serverStatus === 'abandoned') {
            localStorage.removeItem('currentCheckoutSessionId');
            window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
            setLocation('/app?view=cart');
            return;
          }

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

  const handleSavePhone = async () => {
    const numericPhone = phoneNumberInput.replace(/\D/g, '');
    if (numericPhone.length < 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsSavingPhone(true);
    try {
      const response = await apiRequest(`/api/users/${userData.id}`, {
        method: 'PUT',
        body: JSON.stringify({ phoneNumber: numericPhone })
      });

      if (response) {
        // Update local storage so it persists
        const updatedUser = { ...userData, ...response };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Also update the userData variable manually for this render cycle
        userData.phoneNumber = numericPhone;

        setShowPhonePrompt(false);
      }
    } catch (error) {
      alert("Failed to save mobile number. Please try again.");
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleRetryStockCheck = () => {
    refetchStock();
  };

  const handlePlaceOrder = async () => {
    // Check stock validation first
    if (!validationResult.isValid) {
      return;
    }

    // Check if user has a valid phone number
    const userPhone = userData?.phoneNumber;
    if (!userPhone || userPhone.replace(/\D/g, '').length < 10) {
      setShowPhonePrompt(true);
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
              name: 'Kit SilloBite',
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
                  setLocation('/app?view=cart');
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
              setShowBackConfirmDialog(true);
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
                    {chargesApplied.map((charge: { name: string; type: 'percent' | 'fixed'; value: number; amount: number }) => (
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
            totalAmount={amountForCouponValidation}
            canteenId={canteenId || undefined}
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
                <div className={`grid gap-4 ${allowDelivery ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="relative h-full">
                    <RadioGroupItem value="takeaway" id="takeaway" className="sr-only" />
                    <Label
                      htmlFor="takeaway"
                      className={`flex flex-col items-center justify-center h-full p-5 rounded-3xl cursor-pointer border-2 transition-all duration-300 active:scale-[0.98] ${orderType === 'takeaway'
                        ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
                        : 'border-transparent text-muted-foreground'
                        }`}
                    >
                      <Lottie
                        animationData={takeawayAnimation}
                        loop={true}
                        autoplay={true}
                        className="w-16 h-16"
                      />
                      <div className="text-center">
                        <p className={`font-bold text-[17px] mt-4 mb-1 tracking-tight ${orderType === 'takeaway' ? 'text-primary' : 'text-foreground'
                          }`}>
                          Takeaway
                        </p>
                        <p className={`text-xs leading-tight ${orderType === 'takeaway' ? 'text-primary/70' : 'text-muted-foreground'
                          }`}>
                          Collect from counter
                        </p>
                      </div>
                    </Label>
                  </div>

                  {allowDelivery && (
                    <div className="relative h-full">
                      <RadioGroupItem value="delivery" id="delivery" className="sr-only" />
                      <Label
                        htmlFor="delivery"
                        className={`flex flex-col items-center justify-center h-full p-5 rounded-3xl cursor-pointer border-2 transition-all duration-300 active:scale-[0.98] ${orderType === 'delivery'
                          ? 'border-[#3b82f6] bg-[#3b82f6]/5 shadow-md scale-[1.02]'
                          : 'border-transparent text-muted-foreground'
                          }`}
                      >
                        <Lottie
                          animationData={deliveryAnimation}
                          loop={true}
                          autoplay={true}
                          className="w-24 h-24"
                        />
                        <div className="text-center">
                          <p className={`font-bold text-[17px] mb-1 tracking-tight ${orderType === 'delivery' ? 'text-[#3b82f6]' : 'text-foreground'
                            }`}>
                            Delivery
                          </p>
                          <p className={`text-[12px] font-medium leading-tight ${orderType === 'delivery' ? 'text-[#3b82f6]/70' : 'text-muted-foreground'
                            }`}>
                            To your location
                          </p>
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

          {/* Payment Method card was moved to bottom drawer */}
        </div>
      </div>

      {/* Payment Menu Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isPaymentMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsPaymentMenuOpen(false)}
      />

      {/* Place Order Button & Payment Method Selector */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 pointer-events-auto rounded-t-2xl" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>

        {/* Expanded Payment Options (Slides Up from Button) */}
        <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isPaymentMenuOpen ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0 mb-0'
          } grid`}>
          <div className="min-h-0 rounded-[1.25rem] border border-border/50 p-2 shadow-inner">
            <RadioGroup
              value={paymentMethod}
              onValueChange={(val) => {
                setPaymentMethod(val);
                setIsPaymentMenuOpen(false); // Auto-close on select
              }}
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="upi"
                  className={`flex items-center space-x-3 p-3.5 border-2 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${paymentMethod === 'upi'
                    ? 'border-primary bg-primary/5 shadow-sm scale-[1.01]'
                    : 'border-transparent bg-background text-muted-foreground'
                    }`}
                >
                  <Lottie
                    animationData={upiPaymentAnimation}
                    loop={true}
                    autoplay={true}
                    className="w-8 h-8"
                  />
                  <div className="flex-1">
                    <p className={`font-bold text-[14px] tracking-tight ${paymentMethod === 'upi' ? 'text-primary' : 'text-foreground'}`}>Online Payment</p>
                    <p className={`text-[11px] mt-0.5 ${paymentMethod === 'upi' ? 'text-primary/70' : 'text-muted-foreground/70'}`}>UPI, Cards & Wallets</p>
                  </div>
                  <RadioGroupItem value="upi" id="upi" className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'upi' ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    }`}>
                    {paymentMethod === 'upi' && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                  </div>
                </Label>

                {allowPayAtCounter && (
                  <Label
                    htmlFor="offline"
                    className={`flex items-center space-x-3 p-3.5 border-2 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${paymentMethod === 'offline'
                      ? 'border-[#f97316] bg-[#f97316]/5 shadow-sm scale-[1.01]'
                      : 'border-transparent bg-background text-muted-foreground'
                      }`}
                  >
                    <Lottie
                      animationData={offlinePaymentAnimation}
                      loop={true}
                      autoplay={true}
                      className="w-12 h-12"
                    />
                    <div className="flex-1">
                      <p className={`font-bold text-[14px] tracking-tight ${paymentMethod === 'offline' ? 'text-[#f97316]' : 'text-foreground'}`}>Pay at Counter</p>
                      <p className={`text-[11px] mt-0.5 ${paymentMethod === 'offline' ? 'text-[#f97316]/70' : 'text-muted-foreground/70'}`}>Pay via cash/card at canteen</p>
                    </div>
                    <RadioGroupItem value="offline" id="offline" className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'offline' ? 'border-[#f97316] bg-[#f97316]' : 'border-muted-foreground/30'
                      }`}>
                      {paymentMethod === 'offline' && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                    </div>
                  </Label>
                )}
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full">
          {/* Collapsed Payment Selector Button */}
          <button
            onClick={() => setIsPaymentMenuOpen(!isPaymentMenuOpen)}
            className={`flex flex-col items-start justify-center h-[54px] px-3.5 rounded-[1.15rem] transition-all active:scale-[0.98] flex-shrink-0 min-w-[124px] bg-background border ${isPaymentMenuOpen ? ' border-[#9847D1]/80 shadow-inner' : 'border-[#9847D1]/50 shadow-sm'
              }`}
          >
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5 flex items-center gap-1 pl-1.5">
              Pay Via
              <ChevronUp className={`w-3 h-3 transition-transform duration-300 ${isPaymentMenuOpen ? 'rotate-180' : ''}`} />
            </span>
            <div className="flex items-center gap-1 -ml-1">
              {paymentMethod === 'upi' ? (
                <>
                  <Lottie
                    animationData={upiPaymentAnimation}
                    loop={true}
                    autoplay={true}
                    className="w-7 h-7"
                  />
                  <span className="font-extrabold text-[14px] text-foreground tracking-tight">UPI/Card</span>
                </>
              ) : (
                <>
                  <Lottie
                    animationData={offlinePaymentAnimation}
                    loop={true}
                    autoplay={true}
                    className="w-7 h-7"
                  />
                  <span className="font-extrabold text-[14px] text-foreground tracking-tight">Counter</span>
                </>
              )}
            </div>
          </button>

          {/* Place Order / Pay Now Action Button */}
          <Button
            variant="food"
            size="mobile"
            className="flex-1 h-[56px] rounded-2xl font-bold text-[16px] text-white transition-all active:scale-[0.98] shadow-lg disabled:opacity-80 disabled:cursor-not-allowed border-0"
            onClick={handlePlaceOrder}
            disabled={paymentInProgress || cart.length === 0 || !validationResult.isValid}
            style={
              !paymentInProgress && cart.length > 0 && validationResult.isValid
                ? paymentMethod === 'offline'
                  ? { backgroundColor: '#9847D1', boxShadow: '0 8px 25px -6px rgba(152, 71, 209, 0.5)' }
                  : { backgroundColor: '#9847D1', boxShadow: '0 8px 25px -6px rgba(152, 71, 209, 0.5)' }
                : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
            }
          >
            {paymentInProgress ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                <span>{paymentMethod === 'offline' ? 'Placing Order' : 'Redirecting...'}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-1">
                <span className="drop-shadow-sm">
                  {paymentMethod === 'offline' ? 'Place Order' : 'Pay Now'}
                </span>
                <div className="flex items-center gap-1.5 bg-white/20 py-1.5 px-3 rounded-xl backdrop-blur-md">
                  <span className="font-black drop-shadow-sm tracking-wide">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            )}
          </Button>
        </div>

        {/* Validation Errors underneath */}
        {cart.length === 0 ? (
          <p className="text-center text-[11px] font-medium text-muted-foreground mt-3">
            Your cart is empty. Add items to continue.
          </p>
        ) : !validationResult.isValid ? (
          <p className="text-center text-[11px] font-medium text-red-500 mt-3 bg-red-500/10 py-1.5 px-3 rounded-lg mx-auto w-fit">
            Resolve stock issues to proceed.
          </p>
        ) : null}
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
          setLocation('/app?view=cart');
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
                setLocation('/app?view=cart');
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

      {/* Phone Number Required Dialog */}
      <Dialog open={showPhonePrompt} onOpenChange={setShowPhonePrompt}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-xl z-[100] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mobile Number Required</DialogTitle>
            <DialogDescription>
              We need a valid mobile number to communicate order updates with you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="phoneNumber" className="sr-only">
                Mobile Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit mobile number"
                value={phoneNumberInput}
                onChange={(e) => setPhoneNumberInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                className="text-lg py-6 tracking-widest text-center"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPhonePrompt(false)}
              disabled={isSavingPhone}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSavePhone}
              disabled={isSavingPhone || phoneNumberInput.length < 10}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
            >
              {isSavingPhone ? "Saving..." : "Save & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back Confirmation Dialog */}
      <AlertDialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <AlertDialogContent className="w-[90vw] max-w-sm rounded-[24px] p-6 gap-6 sm:rounded-[24px] z-[100]">
          <AlertDialogHeader className="text-center sm:text-center space-y-3">
            <AlertDialogTitle className="text-xl font-semibold">Leave Checkout?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[15px] leading-relaxed text-muted-foreground">
              Are you sure you want to go back? Your current checkout progress will be lost and your reserved items might be released if your session expires.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-3 w-full mt-2">
            <AlertDialogAction
              onClick={() => {
                setShowBackConfirmDialog(false);
                window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                setLocation('/app?view=cart');
              }}
              className="w-full bg-[#e13a3a] hover:bg-[#c93434] text-white py-6 rounded-xl text-base font-semibold shadow-none"
            >
              Leave Checkout
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0 sm:mt-0 py-6 rounded-xl border-gray-100 bg-gray-50/50 hover:bg-gray-100 text-base font-semibold text-gray-700 shadow-none">
              Stay
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
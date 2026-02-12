import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, CreditCard, HandCoins, Loader2, X, CheckCircle, Printer, AlertTriangle, QrCode, Truck } from "lucide-react";
import { OwnerButton } from "@/components/owner";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/utils/posCalculations";
import { toast } from "sonner";
import { printBill } from "@/services/localPrinterService";
import { QRPaymentScreen } from "@/components/payment/QRPaymentScreen";
import BarcodeScanModal from "@/components/modals/BarcodeScanModal";
import OrderFoundModal from "@/components/orders/OrderFoundModal";
import OrderNotFoundModal from "@/components/orders/OrderNotFoundModal";
import DeliveryPersonSelectModal from "@/components/canteen/DeliveryPersonSelectModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrderTotals } from "@/types/pos";
import { Button } from "@/components/ui/button";
interface PosCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totals: OrderTotals;
  cart: Array<{ id: string; name: string; price: number; quantity: number }>;
  customerName: string;
  canteenId: string;
  taxRate?: number;
  taxName?: string;
  onOrderCreated?: () => void;
}

const SESSION_DURATION_MINUTES = 15;

type CheckoutStage = 'payment_selection' | 'payment_processing' | 'payment_success';

export function PosCheckoutDialog({
  open,
  onOpenChange,
  totals,
  cart,
  customerName,
  canteenId,
  taxRate = 5,
  taxName = 'GST',
  onOrderCreated,
}: PosCheckoutDialogProps) {
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(SESSION_DURATION_MINUTES * 60);
  const [paymentMethod, setPaymentMethod] = useState<"offline" | "upi" | "qr">("offline");
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<CheckoutStage>('payment_selection');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [canteenCharges, setCanteenCharges] = useState<any[]>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isOrderFoundModalOpen, setIsOrderFoundModalOpen] = useState(false);
  const [isOrderNotFoundModalOpen, setIsOrderNotFoundModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [isDeliveryPersonModalOpen, setIsDeliveryPersonModalOpen] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAbandonedRef = useRef(false);
  const razorpayRef = useRef<any>(null);
  const cachedCartRef = useRef<any[]>([]);
  const cachedTotalsRef = useRef<OrderTotals | null>(null);
  const isPaymentInProgressRef = useRef(false);
  const queryClient = useQueryClient();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchCanteenCharges = async () => {
    try {
      console.log('🔍 [CHECKOUT] Fetching charges for canteenId:', canteenId);
      const chargesResponse = await apiRequest(`/api/canteens/${canteenId}/charges`);
      console.log('📥 [CHECKOUT] Charges API response:', chargesResponse);

      const chargesArray = Array.isArray(chargesResponse) ? chargesResponse : chargesResponse?.items || [];
      console.log(`📋 [CHECKOUT] Total charges found: ${chargesArray.length}`);

      const activeCharges = chargesArray.filter((charge: any) => charge.active);
      console.log(`📊 [CHECKOUT] Active canteen charges: ${activeCharges.length}`, activeCharges);

      if (activeCharges.length === 0) {
        console.warn(`⚠️ [CHECKOUT] No active canteen charges configured for canteen ${canteenId}`);
        console.warn('⚠️ [CHECKOUT] All charges:', chargesArray);
      }

      setCanteenCharges(activeCharges);
      return activeCharges;
    } catch (error) {
      console.error('❌ [CHECKOUT] Failed to fetch canteen charges:', error);
      setCanteenCharges([]);
      return [];
    }
  };

  const calculateTotalsWithCharges = (baseTotals: OrderTotals, charges: any[], includeCharges: boolean): OrderTotals => {
    if (!includeCharges || charges.length === 0) {
      return baseTotals;
    }

    let chargesTotal = 0;
    charges.forEach((charge) => {
      if (charge.type === 'percent') {
        chargesTotal += (baseTotals.subtotal * charge.value) / 100;
      } else {
        chargesTotal += charge.value;
      }
    });

    const total = baseTotals.subtotal - baseTotals.discount + baseTotals.tax + chargesTotal;

    return {
      ...baseTotals,
      total,
    };
  };

  const getDisplayTotals = (): OrderTotals => {
    const includeCharges = paymentMethod === 'upi' || paymentMethod === 'qr';
    const displayTotals = calculateTotalsWithCharges(totals, canteenCharges, includeCharges);
    console.log('💰 Display totals:', { paymentMethod, hasCharges: canteenCharges.length, includeCharges, displayTotals });
    return displayTotals;
  };

  const createCheckoutSession = async () => {
    try {
      setIsLoading(true);
      await fetchCanteenCharges();

      const response = await apiRequest('/api/checkout-sessions/create', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 0,
          canteenId: canteenId,
          sessionDurationMinutes: SESSION_DURATION_MINUTES,
          sessionType: 'pos'
        })
      });

      if (response.success && response.sessionId) {
        setCheckoutSessionId(response.sessionId);
        setSessionTimeLeft(response.timeRemaining || SESSION_DURATION_MINUTES * 60);
        console.log('✅ POS Checkout session created:', response.sessionId);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  const abandonCheckoutSession = async (sessionId: string) => {
    if (hasAbandonedRef.current) return;

    try {
      hasAbandonedRef.current = true;
      await apiRequest(`/api/checkout-sessions/${sessionId}/abandon`, {
        method: 'POST'
      });
      console.log('✅ POS Checkout session abandoned:', sessionId);
    } catch (error) {
      console.error('Error abandoning checkout session:', error);
    }
  };

  useEffect(() => {
    if (open) {
      // Don't reset if we're showing success screen after payment
      if (stage !== 'payment_success' && !isPaymentInProgressRef.current) {
        hasAbandonedRef.current = false;
        setStage('payment_selection');
        setPaymentData(null);
        setCreatedOrder(null);
        cachedCartRef.current = cart;
        createCheckoutSession();
      }
    } else {
      // Only abandon session if not in payment processing or success stage
      // Don't abandon if Razorpay payment is in progress or QR payment is being shown
      if (checkoutSessionId && !hasAbandonedRef.current && stage === 'payment_selection' && !isPaymentInProgressRef.current && !showQRPayment) {
        abandonCheckoutSession(checkoutSessionId);
      }

      // Only reset state if not in payment processing, not showing success, and not showing QR payment
      if (!isPaymentInProgressRef.current && stage !== 'payment_success' && !showQRPayment) {
        setStage('payment_selection');
        setCheckoutSessionId(null);
        setSessionTimeLeft(SESSION_DURATION_MINUTES * 60);
        setPaymentMethod("offline");
        setShowOfflineConfirm(false);
        setCanteenCharges([]);
        if (sessionTimerRef.current) {
          clearInterval(sessionTimerRef.current);
          sessionTimerRef.current = null;
        }
      }

      // When closing after success, reset for next time
      if (stage === 'payment_success') {
        setStage('payment_selection');
        setCreatedOrder(null);
        setCanteenCharges([]);
      }
    }

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [open, showQRPayment]);

  useEffect(() => {
    if (!checkoutSessionId || !open) return;

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }

    sessionTimerRef.current = setInterval(() => {
      setSessionTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (sessionTimerRef.current) {
            clearInterval(sessionTimerRef.current);
          }
          if (stage === 'payment_selection') {
            toast.error('Checkout session expired. Please try again.');
            onOpenChange(false);
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [checkoutSessionId, open, onOpenChange, stage]);

  const handleClose = () => {
    // Prevent closing when Razorpay payment is in progress
    if (isPaymentInProgressRef.current) {
      return;
    }

    // Close Razorpay if open
    if (razorpayRef.current) {
      razorpayRef.current.close();
      razorpayRef.current = null;
    }

    // Only abandon session if we're at payment selection stage
    if (checkoutSessionId && !hasAbandonedRef.current && stage === 'payment_selection') {
      abandonCheckoutSession(checkoutSessionId);
    }

    onOpenChange(false);
  };

  const initiateUpiPayment = async () => {
    try {
      setIsLoading(true);

      const upiTotals = calculateTotalsWithCharges(totals, canteenCharges, true);
      cachedTotalsRef.current = upiTotals;

      const response = await apiRequest('/api/pos/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          amount: upiTotals.total,
          customerName: customerName,
          cart: cart,
          canteenId: canteenId,
          checkoutSessionId: checkoutSessionId,
          totals: upiTotals
        })
      });

      if (response.success) {
        setPaymentData(response);
        setStage('payment_processing');

        // Load Razorpay and open payment modal
        loadRazorpayAndOpenModal(response);
      } else {
        toast.error(response.message || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      if (error.errorCode === 'DUPLICATE_PAYMENT_REQUEST') {
        toast.error('Payment is already in progress for this session');
      } else {
        toast.error('Failed to initiate payment. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadRazorpayAndOpenModal = (paymentResponse: any) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const options = {
        key: paymentResponse.keyId,
        amount: paymentResponse.amount,
        currency: paymentResponse.currency,
        order_id: paymentResponse.razorpayOrderId,
        name: 'POS Payment',
        description: `Order for ${customerName}`,
        handler: async (response: any) => {
          await handlePaymentSuccess(response);
        },
        modal: {
          ondismiss: () => {
            isPaymentInProgressRef.current = false;
            // When Razorpay modal is closed, abandon the checkout session
            if (checkoutSessionId && !hasAbandonedRef.current && stage === 'payment_processing') {
              abandonCheckoutSession(checkoutSessionId);
              toast.info('Payment cancelled');
            }
          }
        },
        theme: {
          color: '#6d47ff'
        }
      };

      razorpayRef.current = new (window as any).Razorpay(options);
      isPaymentInProgressRef.current = true;
      razorpayRef.current.open();
      // Keep dialog open to maintain state
      // onOpenChange(false);
    };
    script.onerror = () => {
      toast.error('Failed to load payment gateway');
      setStage('payment_selection');
      isPaymentInProgressRef.current = false;
    };
    document.body.appendChild(script);
  };

  const handlePaymentSuccess = async (razorpayResponse: any) => {
    try {
      setIsLoading(true);
      isPaymentInProgressRef.current = false;

      // Create order after successful payment
      const orderResponse = await apiRequest('/api/pos/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          checkoutSessionId: checkoutSessionId,
          paymentId: razorpayResponse.razorpay_payment_id,
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpaySignature: razorpayResponse.razorpay_signature
        })
      });

      if (orderResponse.success) {
        setCreatedOrder(orderResponse.order);
        setStage('payment_success');
        toast.success('Order created successfully!');

        // Reopen dialog to show success screen
        onOpenChange(true);

        if (onOrderCreated) {
          onOrderCreated();
        }
      } else {
        setStockError(orderResponse.message || 'Order creation failed. Please contact support.');
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      setStockError(error.message || 'Failed to create order. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = () => {
    if (paymentMethod === 'upi') {
      initiateUpiPayment();
    } else if (paymentMethod === 'qr') {
      // Cache cart and totals for QR payment (with canteen charges)
      const qrTotals = calculateTotalsWithCharges(totals, canteenCharges, true);
      cachedCartRef.current = cart;
      cachedTotalsRef.current = qrTotals;

      // Show QR payment screen
      setShowQRPayment(true);
      // Keep dialog open to maintain state
      // onOpenChange(false);
    } else {
      // For offline payment, show confirmation dialog
      setShowOfflineConfirm(true);
    }
  };

  const handleOfflinePaymentConfirmed = async () => {
    setShowOfflineConfirm(false);

    try {
      setIsLoading(true);

      cachedTotalsRef.current = totals;

      // Create order with offline payment (no charges)
      const orderResponse = await apiRequest('/api/pos/orders/create-offline', {
        method: 'POST',
        body: JSON.stringify({
          checkoutSessionId: checkoutSessionId,
          customerName: customerName,
          cart: cart,
          canteenId: canteenId,
          totals: totals
        })
      });

      if (orderResponse.success) {
        setCreatedOrder(orderResponse.order);
        setStage('payment_success');
        toast.success('Order created successfully!');

        if (onOrderCreated) {
          onOrderCreated();
        }
      } else {
        console.error('❌ Order creation failed:', orderResponse);
        setStockError(orderResponse.message || 'Order creation failed. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Offline order creation error:', error);
      const msg = error.message || 'Failed to create order. Please try again.';
      setStockError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!createdOrder) {
      toast.error('No order data available for printing');
      return;
    }

    try {
      setIsPrinting(true);

      const cachedCart = cachedCartRef.current || [];
      const cachedTotals = cachedTotalsRef.current || { subtotal: 0, discount: 0, tax: 0, total: 0 };
      // Determine payment method from order if available, otherwise use state
      const orderPaymentMethod = createdOrder.paymentMethod || paymentMethod;
      const isOfflineOrder = orderPaymentMethod === 'offline' || orderPaymentMethod === 'cash';

      // Map payment method to printer API accepted values (CASH or UPI only)
      const printerPaymentMode = isOfflineOrder ? 'CASH' : 'UPI';

      const orderOtp = createdOrder.barcode ? createdOrder.barcode.substring(0, 4) : '0000';

      const printPayload: any = {
        version: "1.0.0",
        billId: createdOrder.orderNumber || createdOrder.id || 'UNKNOWN',
        vendorId: canteenId,
        items: cachedCart.map((item, index) => ({
          itemId: item.id || `ITEM-${index + 1}`,
          name: item.name || 'Unknown Item',
          quantity: item.quantity || 0,
          unitPrice: item.price || 0,
          totalPrice: (item.price || 0) * (item.quantity || 0),
        })),
        subtotal: cachedTotals.subtotal || 0,
        tax: cachedTotals.tax || 0,
        total: createdOrder.amount || cachedTotals.total || 0,
        paymentMode: printerPaymentMode,
        timestamp: new Date().toISOString(),
        currency: "INR",
        orderOtp: orderOtp,
        barcode: createdOrder.barcode || createdOrder.orderNumber || '',
        notes: "Thank You"
      };

      if (createdOrder.customerName && createdOrder.customerName.trim()) {
        printPayload.customerInfo = {
          name: createdOrder.customerName,
        };
      }

      if (cachedTotals.discount && cachedTotals.discount > 0) {
        printPayload.discount = cachedTotals.discount;
      }

      if (!isOfflineOrder) {
        // Use chargesApplied from order if available, otherwise calculate from canteen charges
        let chargesForPrint: any[] = [];

        console.log('🔍 Print Debug - Order Payment Method:', orderPaymentMethod);
        console.log('🔍 Print Debug - Created Order:', createdOrder);
        console.log('🔍 Print Debug - chargesApplied:', createdOrder.chargesApplied);
        console.log('🔍 Print Debug - chargesTotal:', createdOrder.chargesTotal);
        console.log('🔍 Print Debug - Canteen Charges:', canteenCharges);

        if (createdOrder.chargesApplied) {
          // Parse chargesApplied from order (can be string or array)
          chargesForPrint = typeof createdOrder.chargesApplied === 'string'
            ? JSON.parse(createdOrder.chargesApplied)
            : createdOrder.chargesApplied;
          console.log('✅ Using chargesApplied from order:', chargesForPrint);
        } else if (canteenCharges.length > 0) {
          // Calculate charges from canteen charges
          chargesForPrint = canteenCharges.map((charge: any) => {
            let chargeAmount = 0;
            if (charge.type === 'percent') {
              chargeAmount = (cachedTotals.subtotal * charge.value) / 100;
            } else {
              chargeAmount = charge.value;
            }
            return {
              name: charge.name,
              type: charge.type,
              value: charge.value,
              amount: chargeAmount
            };
          });
          console.log('✅ Calculated charges from canteen charges:', chargesForPrint);
        } else {
          console.warn('⚠️ No charges found - neither chargesApplied nor canteenCharges');
        }

        if (chargesForPrint.length > 0) {
          printPayload.charges = chargesForPrint.map((charge: any) => ({
            name: charge.name || 'Charge',
            value: charge.amount || 0,
            isPercentage: charge.type === 'percent',
          }));
          console.log('📄 Final print payload charges:', printPayload.charges);
        } else {
          console.warn('⚠️ No charges added to print payload');
        }
      }

      const result = await printBill(printPayload);

      if (result.success) {
        toast.success('Receipt sent to printer successfully');
      } else {
        toast.error(`Print failed: ${result.message || 'Unknown error'}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('Failed to print receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  // Mark order as ready mutation (for POS orders)
  const markReadyMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      const response = await apiRequest(`/api/orders/${orderId}/mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: null }),
      });
      return response.order || response;
    },
    onSuccess: (updatedOrder) => {
      toast.success('Order marked as ready!');
      setCreatedOrder(prevOrder => ({
        ...prevOrder,
        ...updatedOrder,
        orderNumber: updatedOrder.orderNumber || prevOrder?.orderNumber,
        id: updatedOrder.id || prevOrder?.id,
        _id: updatedOrder._id || prevOrder?._id,
      }));
      if (onOrderCreated) {
        onOrderCreated();
      }
    },
    onError: (error: any) => {
      console.error('Failed to mark order as ready:', error.message || 'Unknown error');
      toast.error('Failed to mark order as ready');
    },
  });

  // Mark order as out for delivery mutation (for POS orders)
  const markOutForDeliveryMutation = useMutation({
    mutationFn: async ({ orderId, deliveryPersonId, deliveryPersonEmail }: { orderId: string; deliveryPersonId: string; deliveryPersonEmail: string | null }) => {
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      if (!deliveryPersonId) {
        throw new Error('Delivery person ID is required');
      }
      const response = await apiRequest(`/api/orders/${orderId}/out-for-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: null,
          deliveryPersonId,
          deliveryPersonEmail
        }),
      });
      return response.order || response;
    },
    onSuccess: (updatedOrder) => {
      toast.success('Order marked as out for delivery!');
      setCreatedOrder(prevOrder => ({
        ...prevOrder,
        ...updatedOrder,
        orderNumber: updatedOrder.orderNumber || prevOrder?.orderNumber,
        id: updatedOrder.id || prevOrder?.id,
        _id: updatedOrder._id || prevOrder?._id,
      }));
      setIsDeliveryPersonModalOpen(false);
      if (onOrderCreated) {
        onOrderCreated();
      }
    },
    onError: (error: any) => {
      console.error('Failed to mark order as out for delivery:', error.message || 'Unknown error');
      toast.error('Failed to mark order as out for delivery');
    },
  });

  // Helper function to check if scanned barcode matches order (full barcode or first 4 digits)
  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;

    // Exact match
    if (scannedBarcode === orderBarcode) return true;

    // Check if scanned barcode matches first 4 digits (OTP)
    if (scannedBarcode.length === 4 && orderBarcode.startsWith(scannedBarcode)) return true;

    return false;
  };

  // Barcode scan handlers
  const handleBarcodeScan = () => {
    setIsBarcodeModalOpen(true);
  };

  const handleCloseBarcodeModal = () => {
    setIsBarcodeModalOpen(false);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      console.log('📱 Barcode scanned:', barcode);
      setIsBarcodeModalOpen(false);

      // Verify if the scanned barcode matches the order's barcode (full or first 4 digits)
      if (createdOrder && matchesBarcode(barcode, createdOrder.barcode)) {
        console.log('✅ Barcode/OTP matches! Showing order found modal');
        setScannedBarcode(barcode);
        setIsOrderFoundModalOpen(true);
      } else {
        console.log('❌ Barcode/OTP does not match! Showing order not found modal');
        setScannedBarcode(barcode);
        setIsOrderNotFoundModalOpen(true);
      }
    } catch (error) {
      console.error('Error processing barcode scan:', error);
    }
  };

  const handleCloseOrderFoundModal = () => {
    setIsOrderFoundModalOpen(false);
  };

  const handleCloseOrderNotFoundModal = () => {
    setIsOrderNotFoundModalOpen(false);
  };

  const handleMarkDelivered = async () => {
    try {
      if (!createdOrder) {
        console.error('❌ No order selected for delivery');
        return;
      }

      const orderId = createdOrder.id || createdOrder._id || createdOrder.orderNumber;

      if (!orderId) {
        console.error('❌ Order ID not found in order object:', createdOrder);
        return;
      }

      setIsDelivering(true);
      console.log('📦 Marking order as delivered:', { orderId, orderNumber: createdOrder.orderNumber });

      // Call the deliver API endpoint
      // For POS orders without delivery person, send deliveryPersonId if exists, otherwise send empty body
      const requestBody = createdOrder.deliveryPersonId
        ? { deliveryPersonId: createdOrder.deliveryPersonId }
        : {};

      await apiRequest(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('✅ Order marked as delivered successfully');
      toast.success('Order marked as delivered!');

      handleCloseOrderFoundModal();
      onOpenChange(false);

      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Failed to mark order as delivered');
    } finally {
      setIsDelivering(false);
    }
  };

  // Delivery person assignment handlers
  const handleAssignDeliveryPerson = () => {
    setIsDeliveryPersonModalOpen(true);
  };

  const handleDeliveryPersonSelected = async (deliveryPersonId: string, deliveryPersonEmail: string | null) => {
    if (!createdOrder) {
      console.error('❌ No order for delivery person assignment');
      return;
    }

    const orderId = createdOrder.id || createdOrder._id || createdOrder.orderNumber;

    if (!orderId) {
      console.error('❌ Order ID not found in order object:', createdOrder);
      return;
    }

    markOutForDeliveryMutation.mutate({ orderId, deliveryPersonId, deliveryPersonEmail });
  };

  return (
    <>
      <Card className="fixed inset-0 h-2/3 flex flex-col px-4 mx-4 mt-32 z-50">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-lg font-semibold p-4">
            {stage === 'payment_success' ? 'Order Confirmed' : 'Checkout'}
          </div>
          <div className="flex flex-3">
            <div className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
            </div>
            <div className="text-lg font-bold text-primary">
              {formatTime(sessionTimeLeft)}
            </div>
          </div>
          <div className="flex flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
        <div className="space-y-4 py-4 overflow-y-scroll scrollbar-hide">
          {isLoading && stage !== 'payment_processing' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <div className="py-4 overflow-y-scroll scrollbar-hide">

            {!isLoading && stage === 'payment_selection' && checkoutSessionId && (
              <>
                {/* Order Summary */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Order Summary</h3>

                    {/* Customer Name */}
                    <div className="mb-3 pb-3 border-b">
                      <div className="text-sm text-muted-foreground">Customer</div>
                      <div className="font-medium">{customerName}</div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2 mb-3">
                      {cart.map((item, index) => {
                        const itemTotal = item.price * item.quantity;
                        return (
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(item.price)} × {item.quantity}
                              </div>
                            </div>
                            <div className="font-semibold whitespace-nowrap">
                              {formatCurrency(itemTotal)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Subtotal</span>
                        <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                      </div>

                      {totals.discount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-600">Discount</span>
                          <span className="font-medium text-green-600">-{formatCurrency(totals.discount)}</span>
                        </div>
                      )}

                      {totals.tax > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Tax ({taxRate}% {taxName})</span>
                          <span className="font-medium">{formatCurrency(totals.tax)}</span>
                        </div>
                      )}

                      {(paymentMethod === 'upi' || paymentMethod === 'qr') && canteenCharges.length > 0 && canteenCharges.map((charge, idx) => {
                        const chargeAmount = charge.type === 'percent'
                          ? (totals.subtotal * charge.value) / 100
                          : charge.value;
                        return (
                          <div key={idx} className="flex justify-between items-center transition-all duration-500">
                            <span className="text-sm text-muted-foreground">
                              {charge.name} {charge.type === 'percent' ? `(${charge.value}%)` : ''}
                            </span>
                            <span className="font-medium">{formatCurrency(chargeAmount)}</span>
                          </div>
                        );
                      })}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-bold text-lg text-primary">
                          {formatCurrency(getDisplayTotals().total)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Method Selection */}
                <Card className="mt-4">
                  <CardContent className="flex items-center justify-center gap-2 p-4">
                    <div className="text-sm text-muted-foreground">Payment Method</div>
                    <OwnerButton
                      variant={paymentMethod === 'upi' ? 'primary' : 'secondary'}
                      onClick={() => setPaymentMethod('upi')}
                      className="flex-1"
                    >
                      UPI
                    </OwnerButton>
                    <OwnerButton
                      variant={paymentMethod === 'qr' ? 'primary' : 'secondary'}
                      onClick={() => setPaymentMethod('qr')}
                      className="flex-1"
                    >
                      QR
                    </OwnerButton>
                    <OwnerButton
                      variant={paymentMethod === 'offline' ? 'primary' : 'secondary'}
                      onClick={() => setPaymentMethod('offline')}
                      className="flex-1"
                    >
                      Offline
                    </OwnerButton>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <OwnerButton
                    variant="secondary"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Cancel
                  </OwnerButton>
                  <OwnerButton
                    variant="primary"
                    onClick={handleConfirmPayment}
                    className="flex-1"
                    disabled={isLoading}
                    isLoading={isLoading}
                  >
                    {paymentMethod === 'offline' ? 'Confirm Order' : paymentMethod === 'qr' ? 'Show QR Code' : `Pay ${formatCurrency(getDisplayTotals().total)}`}
                  </OwnerButton>
                </div>
              </>
            )}

            {stage === 'payment_processing' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-lg font-medium">Processing Payment...</p>
                <p className="text-sm text-muted-foreground">Please complete the payment in the Razorpay window</p>
              </div>
            )}

            {stage === 'payment_success' && createdOrder && (
              <>
                {/* Success Message */}
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  <div className="bg-green-100 rounded-full p-4">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-600">Order Confirmed!</h3>
                  <p className="text-muted-foreground text-center">
                    Your order has been created successfully
                  </p>
                </div>

                {/* Order Details */}
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm text-muted-foreground">Order Number</span>
                        <span className="font-bold text-lg">{createdOrder?.orderNumber || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm text-muted-foreground">Order OTP</span>
                        <span className="font-bold text-2xl text-primary tracking-wider">{createdOrder?.barcode ? createdOrder.barcode.substring(0, 4) : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm text-muted-foreground">Customer Name</span>
                        <span className="font-medium">{createdOrder?.customerName || customerName || 'Customer'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span className="font-medium capitalize">{createdOrder?.status || 'pending'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="font-bold text-lg text-primary">{formatCurrency(createdOrder.amount || cachedTotalsRef.current?.total || totals.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4">
                  <OwnerButton
                    variant="outline"
                    onClick={handlePrintReceipt}
                    className="flex-1 flex items-center justify-center gap-2"
                    disabled={isPrinting}
                    isLoading={isPrinting}
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </OwnerButton>
                  {(() => {
                    const orderStatus = createdOrder.status;
                    const isDeliveryOrder = createdOrder.orderType === 'delivery';
                    const hasDeliveryPerson = !!createdOrder.deliveryPersonId;
                    const isOutForDelivery = orderStatus === 'out_for_delivery';

                    // Button visibility logic
                    // 1. If status is pending/preparing → Show "Mark as Ready"
                    if (orderStatus === 'pending' || orderStatus === 'preparing') {
                      return (
                        <>
                          <OwnerButton
                            variant="secondary"
                            onClick={() => {
                              const orderId = createdOrder.id || createdOrder._id || createdOrder.orderNumber;
                              if (orderId) {
                                markReadyMutation.mutate(orderId);
                              }
                            }}
                            className="flex-1 flex items-center justify-center gap-2"
                            disabled={markReadyMutation.isPending}
                            isLoading={markReadyMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark as Ready
                          </OwnerButton>
                          <OwnerButton
                            variant="primary"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            Done
                          </OwnerButton>
                        </>
                      );
                    }

                    // 2. If status is ready or out_for_delivery → Show "Scan Barcode"
                    if (orderStatus === 'ready' || isOutForDelivery) {
                      return (
                        <>
                          <OwnerButton
                            variant="secondary"
                            onClick={handleBarcodeScan}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            <QrCode className="w-4 h-4" />
                            Scan Barcode
                          </OwnerButton>
                          <OwnerButton
                            variant="primary"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            Done
                          </OwnerButton>
                        </>
                      );
                    }

                    // 3. Default - just show Done button
                    return (
                      <OwnerButton
                        variant="primary"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        Done
                      </OwnerButton>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Offline Payment Confirmation Dialog */}
          <AlertDialog open={showOfflineConfirm} onOpenChange={setShowOfflineConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-orange-100 rounded-full p-2">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <AlertDialogTitle className="text-xl">Confirm Offline Payment</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base pt-2">
                  You are about to create an order with <strong>offline payment</strong> of{' '}
                  <strong className="text-primary">{formatCurrency(totals.total)}</strong> for{' '}
                  <strong>{customerName}</strong>.
                </AlertDialogDescription>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-3">
                  <p className="text-amber-800 text-sm font-medium">
                    ⚠️ Note: This order will <strong>NOT</strong> be included in automatic payouts.
                    It will only appear in analytics and reports.
                  </p>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleOfflinePaymentConfirmed}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Confirm Order'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* QR Payment Screen */}
          {showQRPayment && (
            <QRPaymentScreen
              amount={getDisplayTotals().total}
              customerName={customerName}
              canteenId={canteenId}
              cart={cart}
              totals={getDisplayTotals()}
              checkoutSessionId={checkoutSessionId || undefined}
              onSuccess={async (orderNumber) => {
                setShowQRPayment(false);

                try {
                  // Fetch order details to show in success screen
                  console.log('📥 Fetching order details for:', orderNumber);
                  const orderResponse = await apiRequest(`/api/orders/${orderNumber}`);
                  console.log('📦 Order response:', orderResponse);

                  if (orderResponse) {
                    setCreatedOrder(orderResponse);
                    setStage('payment_success');
                    onOpenChange(true);
                    toast.success('Order created successfully!');

                    if (onOrderCreated) {
                      onOrderCreated();
                    }
                  } else {
                    console.warn('⚠️ No order response received');
                    toast.success('Payment successful!');
                    if (onOrderCreated) {
                      onOrderCreated();
                    }
                  }
                } catch (error) {
                  console.error('❌ Error fetching order details:', error);
                  toast.success('Payment successful!');
                  if (onOrderCreated) {
                    onOrderCreated();
                  }
                }
              }}
              onCancel={() => {
                setShowQRPayment(false);
                onOpenChange(true);
              }}
            />
          )}

          {/* Barcode Scan Modal */}
          <BarcodeScanModal
            isOpen={isBarcodeModalOpen}
            onClose={handleCloseBarcodeModal}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Order Found Modal */}
          {createdOrder && (
            <OrderFoundModal
              isOpen={isOrderFoundModalOpen}
              onClose={handleCloseOrderFoundModal}
              order={createdOrder}
              onMarkDelivered={handleMarkDelivered}
              isDelivering={isDelivering}
            />
          )}

          {/* Order Not Found Modal */}
          <OrderNotFoundModal
            isOpen={isOrderNotFoundModalOpen}
            onClose={handleCloseOrderNotFoundModal}
            scannedBarcode={scannedBarcode}
          />

          {/* Delivery Person Select Modal */}
          {createdOrder && (
            <DeliveryPersonSelectModal
              open={isDeliveryPersonModalOpen}
              onClose={() => setIsDeliveryPersonModalOpen(false)}
              onSelect={handleDeliveryPersonSelected}
              canteenId={canteenId}
              orderNumber={createdOrder.orderNumber || createdOrder.id}
            />
          )}
        </div>

        {/* Stock Error Popup */}
        <AlertDialog open={!!stockError} onOpenChange={(open) => {
          if (!open) {
            setStockError(null);
            onOpenChange(false);
            queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
          }
        }}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Order Failed
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-700">
                {stockError}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                setStockError(null);
                onOpenChange(false);
                queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
              }}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </>
  );
}

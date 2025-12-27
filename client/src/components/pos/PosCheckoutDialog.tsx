import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, CreditCard, HandCoins, Loader2, X, CheckCircle, Printer, AlertTriangle } from "lucide-react";
import { OwnerButton } from "@/components/owner";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/utils/posCalculations";
import { toast } from "sonner";
import type { OrderTotals } from "@/types/pos";

interface PosCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totals: OrderTotals;
  cart: Array<{ id: string; name: string; price: number; quantity: number }>;
  customerName: string;
  canteenId: string;
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
  onOrderCreated,
}: PosCheckoutDialogProps) {
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(SESSION_DURATION_MINUTES * 60);
  const [paymentMethod, setPaymentMethod] = useState<"offline" | "upi">("offline");
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<CheckoutStage>('payment_selection');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAbandonedRef = useRef(false);
  const razorpayRef = useRef<any>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const createCheckoutSession = async () => {
    try {
      setIsLoading(true);
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
      hasAbandonedRef.current = false;
      setStage('payment_selection');
      setPaymentData(null);
      setCreatedOrder(null);
      createCheckoutSession();
    } else {
      // Only abandon session if not in payment processing or success stage
      if (checkoutSessionId && !hasAbandonedRef.current && stage === 'payment_selection') {
        abandonCheckoutSession(checkoutSessionId);
      }
      setCheckoutSessionId(null);
      setSessionTimeLeft(SESSION_DURATION_MINUTES * 60);
      setPaymentMethod("offline");
      setShowOfflineConfirm(false);
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    }

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [open]);

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
      
      const response = await apiRequest('/api/pos/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          amount: totals.total,
          customerName: customerName,
          cart: cart,
          canteenId: canteenId,
          checkoutSessionId: checkoutSessionId,
          totals: totals
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
            // When Razorpay modal is closed, abandon the checkout session
            if (checkoutSessionId && !hasAbandonedRef.current && stage === 'payment_processing') {
              abandonCheckoutSession(checkoutSessionId);
              toast.info('Payment cancelled');
              onOpenChange(false);
            }
          }
        },
        theme: {
          color: '#6d47ff'
        }
      };

      razorpayRef.current = new (window as any).Razorpay(options);
      razorpayRef.current.open();
    };
    script.onerror = () => {
      toast.error('Failed to load payment gateway');
      setStage('payment_selection');
    };
    document.body.appendChild(script);
  };

  const handlePaymentSuccess = async (razorpayResponse: any) => {
    try {
      setIsLoading(true);
      
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
        
        if (onOrderCreated) {
          onOrderCreated();
        }
      } else {
        toast.error('Order creation failed. Please contact support.');
      }
    } catch (error) {
      console.error('Order creation error:', error);
      toast.error('Failed to create order. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = () => {
    if (paymentMethod === 'upi') {
      initiateUpiPayment();
    } else {
      // For offline payment, show confirmation dialog
      setShowOfflineConfirm(true);
    }
  };

  const handleOfflinePaymentConfirmed = async () => {
    setShowOfflineConfirm(false);
    
    try {
      setIsLoading(true);
      
      console.log('🔵 Creating offline order with:', {
        checkoutSessionId,
        customerName,
        cart,
        canteenId,
        totals
      });
      
      // Create order with offline payment
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

      console.log('📦 Offline order response:', orderResponse);

      if (orderResponse.success) {
        setCreatedOrder(orderResponse.order);
        setStage('payment_success');
        toast.success('Order created successfully!');
        
        if (onOrderCreated) {
          onOrderCreated();
        }
      } else {
        console.error('❌ Order creation failed:', orderResponse);
        toast.error(orderResponse.message || 'Order creation failed. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Offline order creation error:', error);
      toast.error(error.message || 'Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    toast.info('Print receipt will be implemented later');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              {stage === 'payment_success' ? 'Order Confirmed' : 'Checkout'}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading && stage !== 'payment_processing' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && stage === 'payment_selection' && checkoutSessionId && (
            <>
              {/* Session Timer */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-primary" />
                      <span className="text-sm font-medium">Checkout Session</span>
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {formatTime(sessionTimeLeft)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your checkout session expires in {formatTime(sessionTimeLeft)}
                  </p>
                </CardContent>
              </Card>

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

                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-lg text-primary">
                        {formatCurrency(totals.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method Selection */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-primary" />
                    Payment Method
                  </h3>
                  <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "offline" | "upi")}>
                    <div className="space-y-3">
                      {/* Offline Payment */}
                      <div className="flex items-center space-x-3 p-3 border-2 rounded-lg transition-colors cursor-pointer hover:bg-accent" onClick={() => setPaymentMethod("offline")}>
                        <RadioGroupItem value="offline" id="offline-pos" />
                        <Label htmlFor="offline-pos" className="flex-1 cursor-pointer">
                          <div className="flex items-center">
                            <HandCoins className="w-5 h-5 mr-3 text-orange-500" />
                            <div>
                              <p className="font-medium">Offline Payment</p>
                              <p className="text-sm text-muted-foreground">Cash or Card at counter (Implementation pending)</p>
                            </div>
                          </div>
                        </Label>
                      </div>

                      {/* UPI Payment */}
                      <div className="flex items-center space-x-3 p-3 border-2 rounded-lg transition-colors cursor-pointer hover:bg-accent" onClick={() => setPaymentMethod("upi")}>
                        <RadioGroupItem value="upi" id="upi-pos" />
                        <Label htmlFor="upi-pos" className="flex-1 cursor-pointer">
                          <div className="flex items-center">
                            <CreditCard className="w-5 h-5 mr-3 text-primary" />
                            <div>
                              <p className="font-medium">UPI Payment</p>
                              <p className="text-sm text-muted-foreground">Google Pay, PhonePe, UPI, Cards</p>
                            </div>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
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
                  {paymentMethod === 'offline' ? 'Confirm Order' : `Pay ${formatCurrency(totals.total)}`}
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
                      <span className="font-bold text-lg">{createdOrder.orderNumber}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Customer Name</span>
                      <span className="font-medium">{createdOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className="font-medium capitalize">{createdOrder.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Amount</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(createdOrder.amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <OwnerButton
                  variant="secondary"
                  onClick={handlePrintReceipt}
                  className="flex-1"
                  icon={<Printer className="w-4 h-4" />}
                >
                  Print Receipt
                </OwnerButton>
                <OwnerButton
                  variant="primary"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Done
                </OwnerButton>
              </div>
            </>
          )}
        </div>
      </DialogContent>
      </Dialog>

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
              <div className="space-y-3">
                <p>
                  You are about to create an order with <strong>offline payment</strong> of{' '}
                  <strong className="text-primary">{formatCurrency(totals.total)}</strong> for{' '}
                  <strong>{customerName}</strong>.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-amber-800 text-sm font-medium">
                    ⚠️ Note: This order will <strong>NOT</strong> be included in automatic payouts. 
                    It will only appear in analytics and reports.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
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
    </>
  );
}

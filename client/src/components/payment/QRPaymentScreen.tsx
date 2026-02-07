import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { CheckCircle, X, Loader2, QrCode, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/posCalculations";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { OrderTotals } from "@/types/pos";

interface QRPaymentScreenProps {
  amount: number;
  customerName: string;
  canteenId: string;
  cart: Array<{ id: string; name: string; price: number; quantity: number }>;
  totals: OrderTotals;
  checkoutSessionId?: string;
  onSuccess?: (orderNumber: string) => void;
  onCancel?: () => void;
}

export function QRPaymentScreen({
  amount,
  customerName,
  canteenId,
  cart,
  totals,
  checkoutSessionId,
  onSuccess,
  onCancel
}: QRPaymentScreenProps) {
  const [, navigate] = useLocation();
  const [qrData, setQrData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingPaymentRef = useRef(false);
  const hasPaymentSucceededRef = useRef(false);
  const qrIdRef = useRef<string | null>(null);
  const orderNumberRef = useRef<string | null>(null);

  const { isConnected } = useWebSocket({
    canteenIds: canteenId ? [canteenId] : [],
    enabled: true,
    onPaymentSuccess: (data: any) => {
      console.log('🔔 WebSocket payment_success received:', data);

      if (hasPaymentSucceededRef.current) {
        return;
      }

      if (data.qrCodeId === qrIdRef.current || data.orderNumber === orderNumberRef.current) {
        handlePaymentSuccessFromWebSocket(data);
      }
    }
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePaymentSuccessFromWebSocket = (data: any) => {
    if (hasPaymentSucceededRef.current) {
      return;
    }

    hasPaymentSucceededRef.current = true;
    setPaymentStatus('success');
    stopPolling();

    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    const orderInfo = {
      orderNumber: data.orderNumber || qrData?.orderNumber,
      orderId: data.orderId || qrData?.orderId,
      paymentId: data.paymentId,
      amount: amount,
      customerName: customerName
    };
    setOrderDetails(orderInfo);

    console.log('✅ Payment successful via WebSocket:', orderInfo);
    toast.success('Payment received instantly!');

    setTimeout(() => {
      console.log('🔄 Attempting redirect with orderInfo:', orderInfo);
      if (onSuccess && orderInfo.orderNumber) {
        console.log('🔄 Calling onSuccess with:', orderInfo.orderNumber);
        onSuccess(orderInfo.orderNumber);
      } else if (orderInfo.orderNumber) {
        console.log('🔄 Navigating to order status:', orderInfo.orderNumber);
        navigate(`/order-status/${orderInfo.orderNumber}`);
      } else {
        console.warn('⚠️ No order number available for redirect');
        toast.error('Order number missing. Please check your orders.');
      }
    }, 2000);
  };

  const createQRPayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 [QR] Creating QR payment with:', {
        amount,
        customerName,
        canteenId,
        cart: cart.length,
        totals,
        checkoutSessionId
      });

      const response = await apiRequest('/api/payments/create-qr', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          customerName,
          canteenId,
          cart,
          totals,
          checkoutSessionId
        })
      });

      console.log('✅ [QR] QR payment creation response:', response);

      if (response.success) {
        setQrData(response);
        setPaymentStatus('pending');

        // Store refs for WebSocket matching
        qrIdRef.current = response.qrId;
        orderNumberRef.current = response.orderNumber;

        const expiresAt = response.expiresAt;
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = expiresAt - now;
        setTimeLeft(Math.max(0, timeRemaining));

        startPolling(response.qrId);
        startExpiryTimer(timeRemaining);

        console.log('✅ QR payment created:', response);
      } else {
        setError(response.message || 'Failed to create QR payment');
        toast.error(response.message || 'Failed to create QR payment');
      }
    } catch (err: any) {
      console.error('QR payment creation error:', err);
      setError(err.message || 'Failed to create QR payment');
      toast.error('Failed to create QR payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPaymentStatus = async (qrId: string) => {
    if (isCheckingPaymentRef.current || hasPaymentSucceededRef.current) {
      return;
    }

    try {
      isCheckingPaymentRef.current = true;
      const response = await apiRequest(`/api/payments/qr-status/${qrId}`);

      if (response.success) {
        if (response.paymentReceived && response.paymentId) {
          if (hasPaymentSucceededRef.current) {
            return;
          }

          hasPaymentSucceededRef.current = true;
          setPaymentStatus('success');
          stopPolling();

          if (expiryTimerRef.current) {
            clearInterval(expiryTimerRef.current);
            expiryTimerRef.current = null;
          }

          const orderInfo = {
            orderNumber: response.orderNumber,
            orderId: response.orderId,
            paymentId: response.paymentId,
            amount: amount,
            customerName: customerName
          };
          setOrderDetails(orderInfo);

          console.log('✅ Payment successful:', orderInfo);
          toast.success('Payment received successfully!');

          setTimeout(() => {
            console.log('🔄 Attempting redirect with orderInfo:', orderInfo);
            if (onSuccess && orderInfo.orderNumber) {
              console.log('🔄 Calling onSuccess with:', orderInfo.orderNumber);
              onSuccess(orderInfo.orderNumber);
            } else if (orderInfo.orderNumber) {
              console.log('🔄 Navigating to order status:', orderInfo.orderNumber);
              navigate(`/order-status/${orderInfo.orderNumber}`);
            } else {
              console.warn('⚠️ No order number available for redirect');
              toast.error('Order number missing. Please check your orders.');
            }
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    } finally {
      isCheckingPaymentRef.current = false;
    }
  };

  const startPolling = (qrId: string) => {
    stopPolling();

    checkPaymentStatus(qrId);

    pollingIntervalRef.current = setInterval(() => {
      if (!hasPaymentSucceededRef.current) {
        checkPaymentStatus(qrId);
      } else {
        stopPolling();
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const startExpiryTimer = (seconds: number) => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
    }

    expiryTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (expiryTimerRef.current) {
            clearInterval(expiryTimerRef.current);
          }
          if (!hasPaymentSucceededRef.current) {
            setPaymentStatus('expired');
            stopPolling();
            toast.error('QR code expired. Please try again.');
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  const handleCancel = async () => {
    if (hasPaymentSucceededRef.current) {
      toast.info('Payment already completed. Cannot cancel.');
      return;
    }

    stopPolling();
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
    }

    if (qrData?.qrId && paymentStatus === 'pending') {
      try {
        await apiRequest(`/api/payments/qr-close/${qrData.qrId}`, {
          method: 'POST'
        });
        console.log('✅ QR code closed');
      } catch (err) {
        console.error('Error closing QR code:', err);
      }
    }

    if (onCancel) {
      onCancel();
    }
  };

  useEffect(() => {
    createQRPayment();

    return () => {
      stopPolling();
      if (expiryTimerRef.current) {
        clearInterval(expiryTimerRef.current);
      }
      isCheckingPaymentRef.current = false;
    };
  }, []);

  if (isLoading && !qrData) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <h2 className="text-xl font-semibold mb-2">Generating QR Code</h2>
            <p className="text-muted-foreground">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !qrData) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Error</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="space-y-2">
              <Button onClick={createQRPayment} className="w-full">
                Try Again
              </Button>
              <Button onClick={handleCancel} variant="secondary" className="w-full">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <div className="bg-green-100 rounded-full p-4 w-20 h-20 mx-auto flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700">
              Payment Successful!
            </h2>
            <p className="text-muted-foreground">
              Your payment has been received and verified.
            </p>

            {orderDetails && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                {orderDetails.orderNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Order Number:</span>
                    <span className="font-semibold text-primary">{orderDetails.orderNumber}</span>
                  </div>
                )}
                {orderDetails.paymentId && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment ID:</span>
                    <span className="font-mono text-xs">{orderDetails.paymentId.substring(0, 20)}...</span>
                  </div>
                )}
                {orderDetails.amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-bold text-green-600">{formatCurrency(orderDetails.amount)}</span>
                  </div>
                )}
                {orderDetails.customerName && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{orderDetails.customerName}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to order status...</span>
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  if (onSuccess && orderDetails?.orderNumber) {
                    onSuccess(orderDetails.orderNumber);
                  } else if (orderDetails?.orderNumber) {
                    navigate(`/order-status/${orderDetails.orderNumber}`);
                  } else {
                    navigate('/');
                  }
                }}
              >
                View Order Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStatus === 'expired') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-orange-500" />
            <h2 className="text-xl font-semibold mb-2 text-orange-700">
              QR Code Expired
            </h2>
            <p className="text-muted-foreground mb-6">
              The QR code has expired. Please generate a new one.
            </p>
            <div className="space-y-2">
              <Button onClick={createQRPayment} className="w-full">
                Generate New QR Code
              </Button>
              <Button onClick={handleCancel} variant="secondary" className="w-full">
                Cancel Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-background z-50">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Scan to Pay</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center overflow-y-auto scrollbar-hide z-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-4xl font-bold text-primary">{formatCurrency(amount)}</p>
              {customerName && (
                <p className="text-sm text-muted-foreground">
                  Customer: <span className="font-medium text-foreground">{customerName}</span>
                </p>
              )}
            </div>

            {qrData?.qrImageUrl && (
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                <img
                  src={qrData.qrImageUrl}
                  alt="QR Code for Payment"
                  className="w-full max-w-sm h-50"
                />
              </div>
            )}

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for payment...</span>
              </div>

              {isConnected && (
                <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Live updates enabled</span>
                </div>
              )}

              {timeLeft > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground">Expires in:</span>
                  <span className={`font-mono font-semibold ${timeLeft < 60 ? 'text-orange-600' : 'text-primary'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                Scan this QR code with any UPI app (PhonePe, GPay, Paytm, etc.) to complete the payment
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="secondary"
          onClick={handleCancel}
          className="w-full max-w-md"
        >
          Cancel Payment
        </Button>
      </div>

    </>

  );
}

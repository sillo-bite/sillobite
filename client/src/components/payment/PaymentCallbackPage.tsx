/**
 * Payment Callback Page Component
 * Industry Standard: Clean UI component with business logic extracted to hook
 */
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { usePaymentCallback } from "@/hooks/usePaymentCallback";
import { PAYMENT_STATUS } from "@/constants/payment";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { PaymentErrorFallback } from "./PaymentErrorFallback";

function PaymentCallbackPageContent() {
  const { status, paymentData, handleRetry, handleGoToOrders } = usePaymentCallback();

  return (
    <div 
      className="min-h-screen bg-background flex items-center justify-center p-4"
      role="main"
      aria-label="Payment verification"
    >
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Industry Standard: Accessibility - ARIA live region for status updates */}
          <div 
            role="status" 
            aria-live="polite" 
            aria-atomic="true"
            aria-label={`Payment status: ${status}`}
          >
            {status === PAYMENT_STATUS.CHECKING && (
              <>
                <Loader2 
                  className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" 
                  aria-label="Verifying payment"
                  aria-hidden="false"
                />
                <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
                <p className="text-muted-foreground">
                  Please wait while we confirm your payment...
                </p>
              </>
            )}

            {status === PAYMENT_STATUS.SUCCESS && (
              <>
                <CheckCircle 
                  className="w-12 h-12 mx-auto mb-4 text-green-500" 
                  aria-label="Payment successful"
                  aria-hidden="false"
                />
                <h2 className="text-xl font-semibold mb-2 text-green-700">
                  Payment Successful!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your order has been confirmed.
                </p>
                {paymentData?.orderNumber && (
                  <p className="text-sm text-muted-foreground" aria-label={`Order number: ${paymentData.orderNumber}`}>
                    Order Number: <strong>{paymentData.orderNumber}</strong>
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2 mb-4">
                  Redirecting to order status...
                </p>
                {paymentData?.orderNumber && (
                  <button
                    onClick={() => {
                      window.location.href = `/order-status/${paymentData.orderNumber}?from=payment`;
                    }}
                    className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors mt-2"
                    aria-label="Go to order status"
                  >
                    View Order Status
                  </button>
                )}
              </>
            )}

            {status === PAYMENT_STATUS.FAILED && (
              <>
                <XCircle 
                  className="w-12 h-12 mx-auto mb-4 text-red-500" 
                  aria-label="Payment failed"
                  aria-hidden="false"
                />
                <h2 className="text-xl font-semibold mb-2 text-red-700">
                  Payment Failed
                </h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't process your payment. Please try again.
                </p>
                <div className="space-y-2">
                  <button 
                    onClick={handleRetry}
                    className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    aria-label="Retry payment"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
                      handleGoToOrders();
                    }}
                    className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
                    aria-label="Go back to cart"
                  >
                    Back to Cart
                  </button>
                </div>
              </>
            )}

            {status === PAYMENT_STATUS.PENDING && (
              <>
                <Clock 
                  className="w-12 h-12 mx-auto mb-4 text-yellow-500" 
                  aria-label="Payment processing"
                  aria-hidden="false"
                />
                <h2 className="text-xl font-semibold mb-2 text-yellow-700">
                  Payment Processing
                </h2>
                <p className="text-muted-foreground mb-6">
                  Your payment is still being processed. This may take a few minutes.
                </p>
                <div className="space-y-2">
                  <button 
                    onClick={handleGoToOrders}
                    className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    aria-label="Check your orders"
                  >
                    Check Orders
                  </button>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
                    aria-label="Go back to home"
                  >
                    Back to Home
                  </button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Payment Callback Page with Error Boundary
 * Industry Standard: Wrapped in error boundary for graceful error handling
 */
export default function PaymentCallbackPage() {
  return (
    <ErrorBoundary fallback={<PaymentErrorFallback onRetry={() => window.location.reload()} />}>
      <PaymentCallbackPageContent />
    </ErrorBoundary>
  );
}
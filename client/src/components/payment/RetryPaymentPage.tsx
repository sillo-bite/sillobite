import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, RefreshCw, ShoppingCart } from "lucide-react";

export default function RetryPaymentPage() {
  const [, setLocation] = useLocation();

  const handleRetryPayment = () => {
    setLocation('/checkout');
  };

  const handleReturnToCart = () => {
    // Dispatch custom event to switch to cart view in AppPage
    window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
    setLocation('/app');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => {
            // Dispatch custom event to switch to cart view in AppPage
            window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
            setLocation('/app');
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Payment Failed</h1>
        </div>
      </div>

      <div className="p-4">
        {/* Failed Payment Card */}
        <Card className="shadow-card border-destructive">
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-destructive mb-2">
                Payment Session Expired
              </h2>
              <p className="text-muted-foreground mb-6">
                Payment session expired or failed. Please try again to complete your order.
              </p>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-destructive-foreground mb-2">What happened?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 text-left">
                <li>• Payment session timed out after 7 minutes</li>
                <li>• Payment was cancelled or interrupted</li>
                <li>• Network connection issues during payment</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                variant="food"
                size="mobile"
                className="w-full"
                onClick={handleRetryPayment}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Payment
              </Button>
              
              <Button
                variant="outline"
                size="mobile"
                className="w-full"
                onClick={handleReturnToCart}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Return to Cart
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Your cart items are still saved. You can modify your order or try payment again.
            </p>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="shadow-card mt-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">💡 Tips for Successful Payment</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Ensure stable internet connection</li>
              <li>• Complete payment within 7 minutes</li>
              <li>• Don't close the payment window</li>
              <li>• Have your UPI app ready</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
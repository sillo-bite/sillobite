/**
 * Error fallback component for payment callback errors
 * Industry Standard: Specific error UI for payment failures
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'wouter';

interface PaymentErrorFallbackProps {
  onRetry: () => void;
}

export function PaymentErrorFallback({ onRetry }: PaymentErrorFallbackProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <AlertTriangle 
            className="w-12 h-12 mx-auto mb-4 text-red-500" 
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold mb-2 text-red-700">
            Payment Verification Error
          </h2>
          <p className="text-muted-foreground mb-6">
            We encountered an error while verifying your payment. Please check your orders or try again.
          </p>
          <div className="space-y-2">
            <Button 
              onClick={onRetry}
              className="w-full"
              aria-label="Retry payment verification"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
            <Button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
                setLocation('/app');
              }}
              variant="outline"
              className="w-full"
              aria-label="Go to orders page"
            >
              Check Orders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


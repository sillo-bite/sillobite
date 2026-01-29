import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { Ticket, X, Check, AlertCircle, Percent, IndianRupee } from "lucide-react";
import { getUserIdFromStorage } from "@/utils/userStorage";

interface CouponApplicatorProps {
  totalAmount: number;
  onCouponApplied?: (couponData: {
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string;
  }) => void;
  onCouponRemoved?: () => void;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string;
  } | null;
}

export default function CouponApplicator({
  totalAmount,
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon
}: CouponApplicatorProps) {
  const [couponCode, setCouponCode] = useState("");
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    coupon?: any;
    discountAmount?: number;
  } | null>(null);

  // Validate coupon mutation
  const validateCouponMutation = useMutation({
    mutationFn: ({ code }: { code: string }) =>
      apiRequest('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          userId: getUserIdFromStorage(),
          orderAmount: totalAmount
        })
      }),
    onSuccess: (result) => {
      setValidationResult(result);
      if (result.valid && onCouponApplied && result.coupon) {
        const finalAmount = totalAmount - (result.discountAmount || 0);
        onCouponApplied({
          code: result.coupon.code,
          discountAmount: result.discountAmount || 0,
          finalAmount,
          description: result.coupon.description
        });
      } else if (!result.valid) {
      }
    },
    onError: () => {
      setValidationResult({
        valid: false,
        message: "Failed to validate coupon. Please try again."
      });
    }
  });

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      return;
    }

    if (appliedCoupon) {
      return;
    }

    validateCouponMutation.mutate({ code: couponCode });
  };

  const handleRemoveCoupon = () => {
    setValidationResult(null);
    setCouponCode("");
    if (onCouponRemoved) {
      onCouponRemoved();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyCoupon();
    }
  };

  if (appliedCoupon) {
    return (

      <Card className="bg-muted/50 border border-green-500/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <CardTitle className="text-sm font-medium text-foreground">Coupon Applied</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCoupon}
              className="text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-green-500 mb-1">
                {appliedCoupon.code}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {appliedCoupon.description}
              </div>
            </div>
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2">
              -₹{appliedCoupon.discountAmount}
            </span>
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Savings</span>
            <span className="font-semibold text-green-500">
              ₹{appliedCoupon.discountAmount}
            </span>
          </div>
        </CardContent>
      </Card>
    );

  }

  return (
    <Card className="bg-card border border-border shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-primary" />
          <CardTitle className="text-sm font-medium text-foreground">Apply Coupon</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <div className="flex-1">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              className="uppercase bg-background border-input text-foreground placeholder:text-muted-foreground"
              disabled={validateCouponMutation.isPending}
            />
          </div>
          <Button
            onClick={handleApplyCoupon}
            disabled={validateCouponMutation.isPending || !couponCode.trim()}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {validateCouponMutation.isPending ? "Checking..." : "Apply"}
          </Button>
        </div>

        {validationResult && !validationResult.valid && (
          <div className="flex items-start space-x-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive">
              {validationResult.message}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Percent className="w-3 h-3" />
            <span>Have a discount code? Apply it here to save on your order</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
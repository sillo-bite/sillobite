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
      <Card className="bg-[#166534] border border-[#22c55e] shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-white" />
              <CardTitle className="text-sm font-medium text-white">Coupon Applied</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCoupon}
              className="text-white hover:bg-[#22c55e]/20 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-[#86efac] mb-1">
                {appliedCoupon.code}
              </div>
              <div className="text-xs text-white line-clamp-2">
                {appliedCoupon.description}
              </div>
            </div>
            <span className="bg-[#22c55e] text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2">
              -₹{appliedCoupon.discountAmount}
            </span>
          </div>
          
          <Separator className="bg-[#a0a0a0]" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">Savings</span>
            <span className="font-semibold text-white">
              ₹{appliedCoupon.discountAmount}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#2a2a2a] border border-[#3a3a3a] shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-[#22c55e]" />
          <CardTitle className="text-sm font-medium text-white">Apply Coupon</CardTitle>
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
              className="uppercase bg-background border-[#3a3a3a] text-white placeholder:text-[#a0a0a0]"
              disabled={validateCouponMutation.isPending}
            />
          </div>
          <Button
            onClick={handleApplyCoupon}
            disabled={validateCouponMutation.isPending || !couponCode.trim()}
            size="sm"
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
          >
            {validateCouponMutation.isPending ? "Checking..." : "Apply"}
          </Button>
        </div>

        {validationResult && !validationResult.valid && (
          <div className="flex items-start space-x-2 p-3 bg-red-950 rounded-lg border border-red-800">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-300">
              {validationResult.message}
            </div>
          </div>
        )}

        <div className="text-xs text-[#a0a0a0]">
          <div className="flex items-center space-x-1">
            <Percent className="w-3 h-3" />
            <span>Have a discount code? Apply it here to save on your order</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
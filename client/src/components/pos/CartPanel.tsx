import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Percent, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerCard, OwnerButton, OwnerBadge } from "@/components/owner";
import { formatCurrency } from "@/utils/posCalculations";
import type { CartItem, DiscountConfig, OrderTotals } from "@/types/pos";
import { X } from "lucide-react";
import { Card } from "../ui/card";

interface CartPanelProps {
  cart: CartItem[];
  customerName: string;
  discountConfig: DiscountConfig;
  totals: OrderTotals;
  isProcessing: boolean;
  taxRate?: number;
  taxName?: string;
  onCustomerNameChange: (name: string) => void;
  onQuantityChange: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onDiscountConfigChange: (config: DiscountConfig) => void;
  onCheckout: () => void;
  onCloseCart?: () => void;
}

export function CartPanel({
  cart,
  customerName,
  discountConfig,
  totals,
  isProcessing,
  taxRate = 5,
  taxName = 'GST',
  onCustomerNameChange,
  onQuantityChange,
  onRemoveItem,
  onDiscountConfigChange,
  onCheckout,
  onCloseCart,
}: CartPanelProps) {
  const isPopupMode = !!onCloseCart;

  // Shared cart content used by both modes
  const cartContent = (
    <div className="py-4 overflow-y-scroll scrollbar-hide">
      {/* Customer Name */}
      <div className="mb-4 flex-shrink-0">
        <Label htmlFor="customer-name" className="text-sm font-medium mb-2 block">
          Customer Name
        </Label>
        <Input
          id="customer-name"
          placeholder="Enter customer name"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          className="h-10"
        />
      </div>

      {/* Cart Items */}
      <div className="flex-1 min-h-0 overflow-y-auto mb-4 space-y-2 app-scrollbar">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Add items from the menu</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 bg-muted/30 border border-border rounded-lg transition-colors">
            {cart.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OwnerButton
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onQuantityChange(item.id, -1)}
                  >
                    <Minus className="w-3 h-3" />
                  </OwnerButton>
                  <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                  <OwnerButton
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onQuantityChange(item.id, 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </OwnerButton>
                  <OwnerButton
                    variant="danger"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </OwnerButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {cart.length > 0 && (
        <div className="space-y-2 mb-4 p-4 bg-muted/30 border border-border rounded-lg flex-shrink-0">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount</span>
              <span className="font-medium">-{formatCurrency(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}% {taxName})</span>
            <span className="font-medium">{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      )}

      {/* Checkout Button */}
      <OwnerButton
        variant="primary"
        className="w-full flex-shrink-0 h-11"
        onClick={onCheckout}
        disabled={cart.length === 0 || isProcessing}
        isLoading={isProcessing}
        icon={<CreditCard className="w-4 h-4" />}
      >
        {isProcessing ? "Processing..." : `Checkout - ${formatCurrency(totals.total)}`}
      </OwnerButton>
    </div>
  );

  // Desktop inline mode – render as a normal card without overlay
  if (!isPopupMode) {
    return (
      <Card className="flex flex-col px-4 h-full overflow-hidden">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>Cart</span>
          </div>
        </div>
        {cartContent}
      </Card>
    );
  }

  // Mobile popup mode – render with fullscreen overlay backdrop
  return (
    <>
      <div className="fixed inset-0 h-full w-full z-50 bg-black opacity-50" style={{ paddingLeft: "0px" }} onClick={onCloseCart}>
      </div>
      <Card className="fixed inset-0 h-2/3 flex flex-col px-4 mx-4 mt-32 z-50">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>Cart</span>
          </div>
          <OwnerButton variant="secondary" size="icon" onClick={onCloseCart}>
            <X className="w-4 h-4" />
          </OwnerButton>
        </div>
        {cartContent}
      </Card>
    </>
  );
}

interface DiscountSectionProps {
  discountConfig: DiscountConfig;
  onDiscountConfigChange: (config: DiscountConfig) => void;
}

function DiscountSection({ discountConfig, onDiscountConfigChange }: DiscountSectionProps) {
  const isPercentMode = discountConfig.percent > 0 || (discountConfig.percent === 0 && discountConfig.amount === 0);

  return (
    <div className="space-y-3 mb-4 p-3 bg-muted/30 border border-border rounded-lg flex-shrink-0">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Discount</Label>
        <div className="flex gap-2">
          <OwnerButton
            variant={isPercentMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => onDiscountConfigChange({ percent: 0, amount: 0 })}
            icon={<Percent className="w-3 h-3" />}
          >
            %
          </OwnerButton>
          <OwnerButton
            variant={!isPercentMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => onDiscountConfigChange({ percent: 0, amount: 0 })}
            icon={<DollarSign className="w-3 h-3" />}
          >
            ₹
          </OwnerButton>
        </div>
      </div>
      {isPercentMode ? (
        <Input
          type="number"
          placeholder="Discount %"
          value={discountConfig.percent || ""}
          onChange={(e) => onDiscountConfigChange({
            percent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
            amount: 0
          })}
          className="h-10"
        />
      ) : (
        <Input
          type="number"
          placeholder="Discount amount"
          value={discountConfig.amount || ""}
          onChange={(e) => onDiscountConfigChange({
            percent: 0,
            amount: Math.max(0, parseFloat(e.target.value) || 0)
          })}
          className="h-10"
        />
      )}
    </div>
  );
}

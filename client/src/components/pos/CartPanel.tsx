import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Percent, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerCard, OwnerButton, OwnerBadge } from "@/components/owner";
import { formatCurrency } from "@/utils/posCalculations";
import type { CartItem, DiscountConfig, OrderTotals } from "@/types/pos";

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
  onClearCart,
  onDiscountConfigChange,
  onCheckout,
}: CartPanelProps) {
  return (
    <OwnerCard
      title={
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          <span>Cart</span>
        </div>
      }
      description={`${cart.length} item(s) in cart`}
      headerActions={
        cart.length > 0 && (
          <OwnerButton variant="icon" size="icon" onClick={onClearCart}>
            <Trash2 className="w-4 h-4" />
          </OwnerButton>
        )
      }
      className="flex flex-col overflow-hidden h-full"
      contentClassName="flex-1 flex flex-col overflow-hidden p-4 min-h-0"
    >
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
          cart.map(item => (
            <div 
              key={item.id} 
              className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg hover:bg-muted/70 transition-colors"
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
          ))
        )}
      </div>

      {/* Discount Section */}
      {cart.length > 0 && (
        <DiscountSection
          discountConfig={discountConfig}
          onDiscountConfigChange={onDiscountConfigChange}
        />
      )}

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
    </OwnerCard>
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

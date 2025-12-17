import { Banknote, CreditCard, QrCode, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OwnerButton } from "@/components/owner";
import { formatCurrency } from "@/utils/posCalculations";
import type { PaymentMethod, OrderTotals } from "@/types/pos";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPaymentMethod: PaymentMethod;
  totals: OrderTotals;
  isProcessing: boolean;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onConfirm: () => void;
}

const paymentMethods = [
  {
    method: 'cash' as PaymentMethod,
    icon: Banknote,
    title: 'Cash',
    description: 'Pay with cash',
  },
  {
    method: 'card' as PaymentMethod,
    icon: CreditCard,
    title: 'Card',
    description: 'Debit/Credit card',
  },
  {
    method: 'upi' as PaymentMethod,
    icon: QrCode,
    title: 'UPI',
    description: 'PhonePe, GPay, etc.',
  },
  {
    method: 'wallet' as PaymentMethod,
    icon: Smartphone,
    title: 'Wallet',
    description: 'Digital wallet',
  },
];

export function PaymentDialog({
  open,
  onOpenChange,
  selectedPaymentMethod,
  totals,
  isProcessing,
  onPaymentMethodChange,
  onConfirm,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Select Payment Method</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {paymentMethods.map(({ method, icon: Icon, title, description }) => (
            <button
              key={method}
              onClick={() => onPaymentMethodChange(method)}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === method
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                selectedPaymentMethod === method
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
              {selectedPaymentMethod === method && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground"></div>
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(totals.total)}</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <OwnerButton variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </OwnerButton>
          <OwnerButton 
            variant="primary" 
            onClick={onConfirm} 
            disabled={isProcessing}
            isLoading={isProcessing}
          >
            Confirm Payment
          </OwnerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

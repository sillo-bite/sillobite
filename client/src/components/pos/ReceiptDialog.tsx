import { CheckCircle2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OwnerButton } from "@/components/owner";
import { formatCurrency, formatDate } from "@/utils/posCalculations";
import type { Transaction } from "@/types/pos";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onPrint: () => void;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  transaction,
  onPrint,
}: ReceiptDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-lg font-semibold">Receipt</span>
            <OwnerButton variant="secondary" size="sm" onClick={onPrint} icon={<Printer className="w-4 h-4" />}>
              Print
            </OwnerButton>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Header */}
          <div className="text-center border-b border-border pb-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold mb-1">Thank You!</h2>
            <p className="text-sm text-muted-foreground">Order #{transaction.orderNumber}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(transaction.createdAt)}</p>
          </div>
          
          {/* Customer Info */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{transaction.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method:</span>
              <span className="font-medium capitalize">{transaction.paymentMethod}</span>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3">Items</h3>
            <div className="space-y-2">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(transaction.amount)}</span>
            </div>
            {transaction.discount && transaction.discount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Discount</span>
                <span className="font-medium">-{formatCurrency(transaction.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(transaction.amount)}</span>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center pt-4 border-t border-border">
            <p className="font-semibold text-success">Payment Successful</p>
          </div>
        </div>
        <DialogFooter>
          <OwnerButton variant="primary" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </OwnerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { CheckCircle2, Printer, CheckCircle, QrCode, Truck, UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OwnerButton } from "@/components/owner";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/posCalculations";
import type { Transaction } from "@/types/pos";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onPrint: () => void;
  onMarkAsReady?: () => void;
  onScanBarcode?: () => void;
  onAssignDeliveryPerson?: () => void;
  onOutForDelivery?: () => void;
  isMarkingReady?: boolean;
  isMarkingOutForDelivery?: boolean;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  transaction,
  onPrint,
  onMarkAsReady,
  onScanBarcode,
  onAssignDeliveryPerson,
  onOutForDelivery,
  isMarkingReady = false,
  isMarkingOutForDelivery = false,
}: ReceiptDialogProps) {
  if (!transaction) return null;

  const transactionAny = transaction as any;
  const orderType = transactionAny.orderType || 'takeaway';
  const isDeliveryOrder = orderType === 'delivery';
  const hasDeliveryPerson = !!transactionAny.deliveryPersonId;

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

          {/* Order Actions */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {onMarkAsReady && (
                <Button
                  onClick={onMarkAsReady}
                  disabled={isMarkingReady}
                  size="sm"
                  className="bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  {isMarkingReady ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Ready
                    </>
                  )}
                </Button>
              )}
              
              {onScanBarcode && (
                <Button
                  onClick={onScanBarcode}
                  variant="outline"
                  size="sm"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Scan Barcode
                </Button>
              )}
              
              {isDeliveryOrder && onAssignDeliveryPerson && !hasDeliveryPerson && (
                <Button
                  onClick={onAssignDeliveryPerson}
                  variant="outline"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Delivery
                </Button>
              )}
              
              {isDeliveryOrder && onOutForDelivery && !hasDeliveryPerson && (
                <Button
                  onClick={onOutForDelivery}
                  disabled={isMarkingOutForDelivery}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isMarkingOutForDelivery ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4 mr-2" />
                      Out for Delivery
                    </>
                  )}
                </Button>
              )}
            </div>
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

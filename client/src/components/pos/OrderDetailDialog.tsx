import { Printer, User, Calendar, DollarSign, ShoppingCart, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OwnerButton, OwnerBadge } from "@/components/owner";
import { formatCurrency, formatDate } from "@/utils/posCalculations";

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any | null;
  onPrint: (transaction: any) => void;
  isPrinting?: boolean;
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  transaction,
  onPrint,
  isPrinting = false,
}: OrderDetailDialogProps) {
  if (!transaction) return null;

  const items = JSON.parse(transaction.items || '[]');
  
  // Parse chargesApplied if it exists
  let charges: any[] = [];
  if (transaction.chargesApplied) {
    charges = typeof transaction.chargesApplied === 'string' 
      ? JSON.parse(transaction.chargesApplied) 
      : transaction.chargesApplied;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <span className="text-lg font-semibold">Order Details</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">#{transaction.orderNumber}</p>
            </div>
            <OwnerBadge variant="success" className="text-xs">
              {transaction.status}
            </OwnerBadge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Customer Name</p>
                <p className="font-medium">{transaction.customerName}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date & Time</p>
                <p className="font-medium">{formatDate(transaction.createdAt)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                <p className="font-medium capitalize">{transaction.paymentMethod}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Items</p>
                <p className="font-medium">{items.length} item(s)</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Order Items
            </h3>
            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    {item.imageUrl && (
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(transaction.itemsSubtotal || transaction.amount)}</span>
            </div>
            
            {transaction.discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-success">-{formatCurrency(transaction.discountAmount)}</span>
              </div>
            )}
            
            {transaction.taxAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatCurrency(transaction.taxAmount)}</span>
              </div>
            )}
            
            {charges.length > 0 && (
              <>
                {charges.map((charge: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {charge.name} {charge.type === 'percent' ? `(${charge.value}%)` : ''}
                    </span>
                    <span className="font-medium">{formatCurrency(charge.amount)}</span>
                  </div>
                ))}
              </>
            )}
            
            <div className="flex items-center justify-between font-bold text-lg pt-3 border-t border-border">
              <span className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Total Amount
              </span>
              <span className="text-primary">{formatCurrency(transaction.amount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <OwnerButton 
            variant="secondary" 
            onClick={() => onOpenChange(false)} 
            className="flex-1 sm:flex-none"
          >
            Close
          </OwnerButton>
          <OwnerButton 
            variant="primary" 
            onClick={() => onPrint(transaction)}
            disabled={isPrinting}
            icon={<Printer className="w-4 h-4" />}
            className="flex-1 sm:flex-none"
          >
            {isPrinting ? 'Printing...' : 'Print Receipt'}
          </OwnerButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

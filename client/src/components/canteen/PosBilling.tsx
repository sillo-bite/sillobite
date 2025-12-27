import { useState, useMemo } from "react";
import { ShoppingCart, History } from "lucide-react";
import { toast } from "sonner";
import { OwnerPageLayout, OwnerTabs, OwnerTabList, OwnerTab } from "@/components/owner";
import { usePosCart } from "@/hooks/usePosCart";
import { usePosData } from "@/hooks/usePosData";
import { usePosOrder } from "@/hooks/usePosOrder";
import { calculateOrderTotals } from "@/utils/posCalculations";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { PosCheckoutDialog } from "@/components/pos/PosCheckoutDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { TransactionHistory } from "@/components/pos/TransactionHistory";
import PrinterStatus from "@/components/common/PrinterStatus";
import { printWithRetry } from "@/services/localPrinterService";
import type { PosBillingProps, DiscountConfig, PaymentMethod, Transaction } from "@/types/pos";

export default function PosBilling({ canteenId }: PosBillingProps) {
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"billing" | "history">("billing");
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({ percent: 0, amount: 0 });
  const [couponCode, setCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  
  // Print State
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastTransactionForPrint, setLastTransactionForPrint] = useState<Transaction | null>(null);
  const [lastTotalsForPrint, setLastTotalsForPrint] = useState<{ subtotal: number; discount: number; total: number } | null>(null);

  // Custom Hooks
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart } = usePosCart();
  const { menuItems, categories, transactions, isLoading, refetchTransactions } = usePosData(
    canteenId,
    searchQuery,
    selectedCategory
  );
  const { createOrder, currentTransaction, setCurrentTransaction, isProcessing } = usePosOrder(canteenId);

  // Calculate totals
  const totals = useMemo(() => {
    return calculateOrderTotals(cart, discountConfig);
  }, [cart, discountConfig]);

  // Handlers
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("Please add items to cart before checkout.");
      return;
    }

    // Set default customer name if not provided
    if (!customerName.trim()) {
      setCustomerName("Customer");
    }

    setShowCheckoutDialog(true);
  };

  // Format transaction data for printing
  const formatTransactionForPrint = (transaction: Transaction, totals: { subtotal: number; discount: number; total: number }) => {
    return {
      orderNumber: transaction.orderNumber,
      customerName: transaction.customerName,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      paymentMethod: transaction.paymentMethod,
      date: transaction.createdAt.toISOString(),
      status: transaction.status,
    };
  };

  // Send bill to printer
  const sendToPrinter = async (transaction: Transaction, totalsForPrint: { subtotal: number; discount: number; total: number }) => {
    setIsPrinting(true);
    setPrintError(null);

    const printPayload = formatTransactionForPrint(transaction, totalsForPrint);
    
    try {
      const result = await printWithRetry(printPayload, 2, 1000);
      
      if (result.success) {
        toast.success("Bill sent to printer successfully");
        setPrintError(null);
      } else {
        setPrintError(result.message || "Failed to print bill");
        toast.error(`Print failed: ${result.message || "Unknown error"}`, {
          action: {
            label: "Retry",
            onClick: () => sendToPrinter(transaction, totalsForPrint),
          },
          duration: 10000,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to print bill";
      setPrintError(errorMessage);
      toast.error(`Print error: ${errorMessage}`, {
        action: {
          label: "Retry",
          onClick: () => sendToPrinter(transaction, totalsForPrint),
        },
        duration: 10000,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePayment = async () => {
    const transaction = await createOrder({
      canteenId,
      customerName,
      cart,
      total: totals.total,
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode,
      paymentMethod: selectedPaymentMethod,
    });

    if (transaction) {
      setShowCheckoutDialog(false);
      setShowReceipt(true);
      setLastTransactionForPrint(transaction);
      setLastTotalsForPrint(totals);
      resetForm();
      refetchTransactions();
      
      // Send to printer after successful save (non-blocking)
      sendToPrinter(transaction, totals).catch(() => {
        // Error already handled in sendToPrinter
      });
    }
  };

  const resetForm = () => {
    clearCart();
    setCustomerName("");
    setDiscountConfig({ percent: 0, amount: 0 });
    setCouponCode("");
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDiscountConfigChange = (config: DiscountConfig) => {
    setDiscountConfig(config);
  };

  return (
    <OwnerPageLayout>
      <OwnerTabs value={activeTab} onValueChange={(v) => setActiveTab(v as "billing" | "history")}>
        <div className="flex items-center justify-between mb-4">
          <OwnerTabList>
            <OwnerTab value="billing" icon={<ShoppingCart className="w-4 h-4" />}>
              Billing
            </OwnerTab>
            <OwnerTab value="history" icon={<History className="w-4 h-4" />}>
              Transaction History
            </OwnerTab>
          </OwnerTabList>
          <PrinterStatus />
        </div>

        {/* Single shared content container - only one panel rendered at a time */}
        <div className="pos-billing-tab-content flex-1 flex flex-col min-h-0 overflow-hidden mt-4">
          {activeTab === "billing" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden min-h-0">
              <MenuGrid
                menuItems={menuItems}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                isLoading={isLoading}
                onSearchChange={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onItemClick={addToCart}
              />

              <CartPanel
                cart={cart}
                customerName={customerName}
                discountConfig={discountConfig}
                totals={totals}
                isProcessing={isProcessing}
                onCustomerNameChange={setCustomerName}
                onQuantityChange={updateQuantity}
                onRemoveItem={removeFromCart}
                onClearCart={resetForm}
                onDiscountConfigChange={handleDiscountConfigChange}
                onCheckout={handleCheckout}
              />
            </div>
          ) : (
            <TransactionHistory transactions={transactions} />
          )}
        </div>
      </OwnerTabs>

      {/* POS Checkout Dialog */}
      <PosCheckoutDialog
        open={showCheckoutDialog}
        onOpenChange={setShowCheckoutDialog}
        totals={totals}
        cart={cart}
        customerName={customerName || "Customer"}
        canteenId={canteenId}
        onOrderCreated={() => {
          refetchTransactions();
          resetForm();
        }}
      />

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
        transaction={currentTransaction}
        onPrint={handlePrintReceipt}
      />
    </OwnerPageLayout>
  );
}

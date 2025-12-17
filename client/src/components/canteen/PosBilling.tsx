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
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { TransactionHistory } from "@/components/pos/TransactionHistory";
import type { PosBillingProps, DiscountConfig, PaymentMethod } from "@/types/pos";

export default function PosBilling({ canteenId }: PosBillingProps) {
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"billing" | "history">("billing");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({ percent: 0, amount: 0 });
  const [couponCode, setCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");

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

    if (!customerName.trim()) {
      toast.error("Please enter customer name.");
      return;
    }

    setShowPaymentDialog(true);
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
      setShowPaymentDialog(false);
      setShowReceipt(true);
      resetForm();
      refetchTransactions();
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
        <OwnerTabList>
          <OwnerTab value="billing" icon={<ShoppingCart className="w-4 h-4" />}>
            Billing
          </OwnerTab>
          <OwnerTab value="history" icon={<History className="w-4 h-4" />}>
            Transaction History
          </OwnerTab>
        </OwnerTabList>

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

      {/* Payment Method Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        selectedPaymentMethod={selectedPaymentMethod}
        totals={totals}
        isProcessing={isProcessing}
        onPaymentMethodChange={setSelectedPaymentMethod}
        onConfirm={handlePayment}
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

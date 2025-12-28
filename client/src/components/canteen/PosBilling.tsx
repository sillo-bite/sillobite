import { useState, useMemo, useEffect } from "react";
import { ShoppingCart, History, TestTube2 } from "lucide-react";
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
import { printWithRetry, printBill } from "@/services/localPrinterService";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { PosBillingProps, DiscountConfig, PaymentMethod, Transaction } from "@/types/pos";

export default function PosBilling({ canteenId }: PosBillingProps) {
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"billing" | "history">("billing");
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({ percent: 0, amount: 0 });
  const [couponCode, setCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  
  // Print State
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastTransactionForPrint, setLastTransactionForPrint] = useState<Transaction | null>(null);
  const [lastTotalsForPrint, setLastTotalsForPrint] = useState<{ subtotal: number; discount: number; tax: number; total: number } | null>(null);
  
  // Test Print State
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // Custom Hooks
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart } = usePosCart();
  const { menuItems, categories, transactions, transactionsPagination, isLoading, refetchTransactions, setTransactionsPage } = usePosData(
    canteenId,
    searchQuery,
    selectedCategory
  );
  const { createOrder, currentTransaction, setCurrentTransaction, isProcessing } = usePosOrder(canteenId);

  // Calculate totals
  const totals = useMemo(() => {
    return calculateOrderTotals(cart, discountConfig);
  }, [cart, discountConfig]);

  // Test Print Handler
  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    
    try {
      const subtotal = 470.00;
      const discount = 50.00;
      const deliveryCharge = 40.00;
      const packagingFee = 15.00;
      
      const taxableAmount = subtotal - discount + deliveryCharge + packagingFee;
      const tax = 84.60; // Pre-calculated tax
      const total = taxableAmount + tax;
      
      const testBillId = `TEST-${Date.now()}`;
      
      const dummyReceiptData = {
        version: "1.0.0",
        billId: testBillId,
        vendorId: canteenId,
        items: [
          {
            itemId: "PROD-101",
            name: "Espresso Coffee",
            quantity: 2.0,
            unitPrice: 120.00,
            totalPrice: 240.00,
          },
          {
            itemId: "PROD-205",
            name: "Chocolate Muffin",
            quantity: 1.0,
            unitPrice: 80.00,
            totalPrice: 80.00,
          },
          {
            itemId: "PROD-350",
            name: "Fresh Orange Juice (Large)",
            quantity: 1.5,
            unitPrice: 100.00,
            totalPrice: 150.00,
          },
        ],
        subtotal: subtotal,
        tax: tax,
        total: total,
        paymentMode: "UPI",
        timestamp: new Date().toISOString(),
        currency: "INR",
        customerInfo: {
          name: "Test Customer",
          phone: "+919876543210",
          email: "test@example.com",
        },
        discount: discount,
        charges: [
          {
            name: "Delivery Charge",
            value: deliveryCharge,
            isPercentage: false,
          },
          {
            name: "Packaging Fee",
            value: packagingFee,
            isPercentage: false,
          },
        ],
        orderOtp: "8745",
        barcode: testBillId,
        notes: "Thank you for your order! This is a test print.",
        metadata: {
          testPrint: true,
          timestamp: Date.now(),
        },
      };
      
      const result = await printBill(dummyReceiptData);
      
      if (result.success) {
        toast.success("Test print sent successfully");
      } else {
        toast.error(`Test print failed: ${result.message || "Unknown error"}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error sending test print:', error);
      toast.error('Failed to send test print');
    } finally {
      setIsTestPrinting(false);
    }
  };

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
  const formatTransactionForPrint = (transaction: Transaction, totals: { subtotal: number; discount: number; tax: number; total: number }) => {
    // Generate 4-digit OTP for order verification
    const orderOtp = Math.floor(1000 + Math.random() * 9000).toString();
    
    const payload: any = {
      version: "1.0.0",
      billId: transaction.orderNumber,
      vendorId: canteenId,
      items: transaction.items.map((item, index) => ({
        itemId: item.id || `ITEM-${index + 1}`,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      paymentMode: transaction.paymentMethod.toUpperCase(),
      timestamp: transaction.createdAt.toISOString(),
      currency: "INR",
    };

    // Add customerInfo only if customer name is provided
    if (transaction.customerName && transaction.customerName.trim()) {
      payload.customerInfo = {
        name: transaction.customerName,
      };
    }

    // Add discount only if it exists
    if (totals.discount > 0) {
      payload.discount = totals.discount;
    }

    // Add order OTP for pickup verification
    payload.orderOtp = orderOtp;

    // Add barcode data (use order number as barcode)
    payload.barcode = transaction.orderNumber;

    return payload;
  };

  // Send bill to printer
  const sendToPrinter = async (transaction: Transaction, totalsForPrint: { subtotal: number; discount: number; tax: number; total: number }) => {
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <OwnerTabList>
            <OwnerTab value="billing" icon={<ShoppingCart className="w-4 h-4" />}>
              Billing
            </OwnerTab>
            <OwnerTab value="history" icon={<History className="w-4 h-4" />}>
              History
            </OwnerTab>
          </OwnerTabList>
          <div className="flex items-center gap-2 flex-wrap">
            <PrinterStatus />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="flex items-center gap-2"
            >
              <TestTube2 className={`w-4 h-4 ${isTestPrinting ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isTestPrinting ? 'Testing...' : 'Test Printer'}</span>
              <span className="sm:hidden">{isTestPrinting ? 'Test...' : 'Test'}</span>
            </Button>
          </div>
        </div>

        {/* Single shared content container - only one panel rendered at a time */}
        <div className="pos-billing-tab-content flex-1 flex flex-col min-h-0 overflow-hidden mt-4">
          {activeTab === "billing" ? (
            <>
              {/* Desktop: Side by side | Mobile: Full width menu only */}
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

                {/* Desktop Cart - Hidden on mobile */}
                <div className="hidden lg:block">
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
              </div>

              {/* Mobile Floating Cart Button */}
              {cart.length > 0 && (
                <button
                  onClick={() => setShowCartSheet(true)}
                  className="lg:hidden fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 pr-5"
                >
                  <ShoppingCart className="w-6 h-6" />
                  <Badge className="bg-white text-primary font-bold">
                    {cart.length}
                  </Badge>
                </button>
              )}

              {/* Mobile Cart Sheet */}
              <Sheet open={showCartSheet} onOpenChange={setShowCartSheet}>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Cart ({cart.length} items)
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-hidden">
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
                      onCheckout={() => {
                        setShowCartSheet(false);
                        handleCheckout();
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <TransactionHistory 
              transactions={transactions} 
              pagination={transactionsPagination}
              onPageChange={setTransactionsPage}
            />
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

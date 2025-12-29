import { useState } from "react";
import { History, User, Calendar, DollarSign, ShoppingCart, ChevronLeft, ChevronRight, CheckCircle, QrCode, Loader2 } from "lucide-react";
import { OwnerCard, OwnerBadge, OwnerButton } from "@/components/owner";
import { formatCurrency, formatDate } from "@/utils/posCalculations";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import BarcodeScanModal from "@/components/modals/BarcodeScanModal";
import OrderFoundModal from "@/components/orders/OrderFoundModal";
import OrderNotFoundModal from "@/components/orders/OrderNotFoundModal";

interface TransactionHistoryProps {
  transactions: any[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
  onPageChange?: (page: number) => void;
  onTransactionClick?: (transaction: any) => void;
  onRefresh?: () => void;
}

export function TransactionHistory({ transactions, pagination, onPageChange, onTransactionClick, onRefresh }: TransactionHistoryProps) {
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isOrderFoundModalOpen, setIsOrderFoundModalOpen] = useState(false);
  const [isOrderNotFoundModalOpen, setIsOrderNotFoundModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const queryClient = useQueryClient();

  const markReadyMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        throw new Error('Invalid order ID');
      }
      const response = await apiRequest(`/api/orders/${orderId}/mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: null }),
      });
      return response.order || response;
    },
    onSuccess: () => {
      toast.success('Order marked as ready!');
      if (onRefresh) {
        onRefresh();
      }
    },
    onError: (error: any) => {
      console.error('Failed to mark order as ready:', error.message || 'Unknown error');
      toast.error('Failed to mark order as ready');
    },
  });

  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;
    if (scannedBarcode === orderBarcode) return true;
    if (scannedBarcode.length === 4 && orderBarcode.startsWith(scannedBarcode)) return true;
    return false;
  };

  const handleBarcodeScan = (order: any) => {
    setSelectedOrder(order);
    setIsBarcodeModalOpen(true);
  };

  const handleCloseBarcodeModal = () => {
    setIsBarcodeModalOpen(false);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setIsBarcodeModalOpen(false);
      
      if (selectedOrder && matchesBarcode(barcode, selectedOrder.barcode)) {
        setScannedBarcode(barcode);
        setIsOrderFoundModalOpen(true);
      } else {
        setScannedBarcode(barcode);
        setIsOrderNotFoundModalOpen(true);
      }
    } catch (error) {
      console.error('Error processing barcode scan:', error);
    }
  };

  const handleCloseOrderFoundModal = () => {
    setIsOrderFoundModalOpen(false);
  };

  const handleCloseOrderNotFoundModal = () => {
    setIsOrderNotFoundModalOpen(false);
  };

  const handleMarkDelivered = async () => {
    try {
      if (!selectedOrder) {
        console.error('❌ No order selected for delivery');
        return;
      }
      
      const orderId = selectedOrder.id || selectedOrder._id || selectedOrder.orderNumber;
      
      if (!orderId) {
        console.error('❌ Order ID not found in order object:', selectedOrder);
        return;
      }
      
      setIsDelivering(true);
      
      // For POS orders without delivery person, send deliveryPersonId if exists, otherwise send empty body
      const requestBody = selectedOrder.deliveryPersonId 
        ? { deliveryPersonId: selectedOrder.deliveryPersonId }
        : {};
      
      await apiRequest(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      toast.success('Order marked as delivered!');
      
      handleCloseOrderFoundModal();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Failed to mark order as delivered');
    } finally {
      setIsDelivering(false);
    }
  };

  return (
    <>
    <OwnerCard
      title={
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span>Transaction History</span>
        </div>
      }
      description="Recent POS transactions"
      className="flex-1 flex flex-col min-h-0"
      contentClassName="flex-1 flex flex-col min-h-0 p-4"
    >
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No transactions found</p>
            <p className="text-xs text-muted-foreground mt-1">Transactions will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction: any) => {
              const items = JSON.parse(transaction.items || '[]');
              const orderStatus = transaction.status;
              const isDelivered = orderStatus === 'delivered' || orderStatus === 'completed';
              const showActionButtons = !isDelivered;
              
              return (
                <div 
                  key={transaction.id} 
                  className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow hover:border-primary/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="flex items-center gap-2 cursor-pointer flex-1" 
                      onClick={() => onTransactionClick?.(transaction)}
                    >
                      <h3 className="font-semibold text-sm">#{transaction.orderNumber}</h3>
                      <OwnerBadge variant="success" className="text-xs">
                        {transaction.status}
                      </OwnerBadge>
                    </div>
                    {transaction.barcode && (
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-muted-foreground">OTP</span>
                        <span className="font-bold text-lg text-primary tracking-wider">
                          {transaction.barcode.substring(0, 4)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div 
                    className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs md:text-sm cursor-pointer"
                    onClick={() => onTransactionClick?.(transaction)}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">{transaction.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{formatDate(transaction.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{items.length} item(s)</span>
                    </div>
                  </div>
                  {transaction.discountAmount > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-medium text-success">
                          {formatCurrency(transaction.discountAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {showActionButtons && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-2">
                      {(orderStatus === 'pending' || orderStatus === 'preparing') && (
                        <OwnerButton
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const orderId = transaction.id || transaction._id || transaction.orderNumber;
                            if (orderId) {
                              markReadyMutation.mutate(orderId);
                            }
                          }}
                          disabled={markReadyMutation.isPending}
                          className="flex items-center gap-1 text-xs"
                        >
                          {markReadyMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Mark as Ready
                        </OwnerButton>
                      )}
                      
                      {(orderStatus === 'ready' || orderStatus === 'out_for_delivery') && (
                        <OwnerButton
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBarcodeScan(transaction);
                          }}
                          className="flex items-center gap-1 text-xs"
                        >
                          <QrCode className="w-3 h-3" />
                          Scan Barcode
                        </OwnerButton>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {transactions.length} of {pagination.totalCount} transactions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <div className="text-sm">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </OwnerCard>
    
    {/* Barcode Scan Modal */}
    <BarcodeScanModal
      isOpen={isBarcodeModalOpen}
      onClose={handleCloseBarcodeModal}
      onBarcodeScanned={handleBarcodeScanned}
    />

    {/* Order Found Modal */}
    {selectedOrder && (
      <OrderFoundModal
        isOpen={isOrderFoundModalOpen}
        onClose={handleCloseOrderFoundModal}
        order={selectedOrder}
        onMarkDelivered={handleMarkDelivered}
        isDelivering={isDelivering}
      />
    )}

    {/* Order Not Found Modal */}
    <OrderNotFoundModal
      isOpen={isOrderNotFoundModalOpen}
      onClose={handleCloseOrderNotFoundModal}
      scannedBarcode={scannedBarcode}
    />
    </>
  );
}

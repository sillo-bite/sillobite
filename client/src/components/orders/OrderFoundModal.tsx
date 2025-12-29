import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, DollarSign } from 'lucide-react';
import { formatOrderIdDisplay } from '@shared/utils';

interface OrderFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkDelivered?: () => void;
  onConfirmPayment?: () => void;
  order: any;
  isDelivering?: boolean;
  isConfirmingPayment?: boolean;
  mode?: 'delivery' | 'payment';
}

const OrderFoundModal: React.FC<OrderFoundModalProps> = ({
  isOpen,
  onClose,
  onMarkDelivered,
  onConfirmPayment,
  order,
  isDelivering = false,
  isConfirmingPayment = false,
  mode = 'delivery'
}) => {
  console.log('🔍 OrderFoundModal render:', { isOpen, order: order?.id, orderNumber: order?.orderNumber });
  
  if (!order) {
    console.log('❌ OrderFoundModal: No order data provided');
    return null;
  }

  const formattedOrderId = formatOrderIdDisplay(order.orderNumber || order.id);
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': return <Badge className="bg-green-100 text-green-800 border-green-200">Ready</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'preparing': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Preparing</Badge>;
      case 'completed': return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Completed</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'payment' && onConfirmPayment) {
        onConfirmPayment();
      } else if (mode === 'delivery' && onMarkDelivered) {
        onMarkDelivered();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[600px] p-4 sm:p-6 z-[70] max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyPress}>
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center text-lg sm:text-2xl font-bold text-gray-900">
            <DollarSign className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
            Order Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Order Found Confirmation */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center mb-3">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 flex-shrink-0" />
              <span className="text-base sm:text-lg font-bold text-green-800">Order Found!</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div className="break-words">
                <span className="font-medium text-gray-700">Order ID:</span>
                <span className="ml-2 font-mono text-gray-900 text-xs sm:text-sm">#{formattedOrderId.full}</span>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-0 sm:ml-2">{getStatusBadge(order.status)}</span>
              </div>
              <div className="break-words">
                <span className="font-medium text-gray-700">Customer:</span>
                <span className="ml-2 text-gray-900">{order.customerName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Total Amount:</span>
                <span className="ml-2 font-bold text-green-600">₹{order.amount}</span>
              </div>
            </div>
          </div>

          {/* Ordered Dishes */}
          <div>
            <h3 className="flex items-center text-base sm:text-lg font-semibold text-gray-800 mb-3">
              <DollarSign className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              Ordered Dishes
            </h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {items.map((item: any, index: number) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold text-gray-900 text-sm sm:text-base">{item.name}</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                        VEG
                      </Badge>
                    </div>
                    <span className="font-bold text-blue-600 text-sm sm:text-base">₹{item.price}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    ₹{item.price} × {item.quantity} {item.quantity > 1 ? 'pieces' : 'piece'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 hidden sm:block">
            <div className="text-sm text-blue-800">
              Press <span className="bg-blue-200 px-1 rounded font-semibold">Enter</span> to {mode === 'payment' ? 'confirm payment' : 'deliver'} or <span className="bg-blue-200 px-1 rounded font-semibold">Esc</span> to cancel.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 h-11 order-2 sm:order-1"
            >
              Cancel
            </Button>
            {mode === 'payment' ? (
              <Button
                onClick={onConfirmPayment}
                disabled={isConfirmingPayment}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 h-11 order-1 sm:order-2"
              >
                {isConfirmingPayment ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Payment
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={onMarkDelivered}
                disabled={isDelivering}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 h-11 order-1 sm:order-2"
              >
                {isDelivering ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Delivering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Delivered
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderFoundModal;

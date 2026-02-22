import React from 'react';
import { X, ChefHat, Receipt, User, CreditCard, Clock, Hash, QrCode, Truck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatOrderIdDisplay } from '@shared/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onScanBarcode?: (order: any) => void;
}

export default function OrderDetailsModal({ order, isOpen, onClose, onScanBarcode }: OrderDetailsModalProps) {
  const { data: customerDetails, isLoading: customerLoading } = useQuery({
    queryKey: ['/api/users', order?.customerId],
    queryFn: () => apiRequest(`/api/users/${order?.customerId}`),
    enabled: !!order?.customerId && isOpen,
  });

  if (!isOpen || !order) return null;

  const phoneNumber = order?.deliveryAddress?.phoneNumber || customerDetails?.phoneNumber || null;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const formatted = formatOrderIdDisplay(order.orderNumber || order.id.toString());

  // Debug: Log order data to check for deliveryAddress
  console.log('OrderDetailsModal - Order data:', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    status: order.status,
    deliveryPersonId: order.deliveryPersonId,
    hasDeliveryAddress: !!order.deliveryAddress,
    deliveryAddress: order.deliveryAddress,
    allOrderKeys: Object.keys(order) // Show all keys to debug
  });

  // Check if it's a delivery order but address is missing
  const isDeliveryOrder = order.orderType === 'delivery' || order.status === 'out_for_delivery' || order.deliveryPersonId;
  if (isDeliveryOrder && !order.deliveryAddress) {
    console.warn('⚠️ Delivery order missing address:', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status
    });
  }

  const formatOrderTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { color: 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning', text: 'Pending' },
      'preparing': { color: 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary', text: 'Preparing' },
      'ready': { color: 'bg-success/20 text-success dark:bg-success/30 dark:text-success', text: 'Ready' },
      'completed': { color: 'bg-muted text-muted-foreground', text: 'Completed' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={`${config.color} font-medium`}>
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto counter-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Order Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Ordered Dishes Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <ChefHat className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Ordered Dishes</h3>
            </div>
            <div className="space-y-3">
              {items.map((item: any, index: number) => (
                <div key={index} className="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 border border-primary/20 dark:border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-foreground mb-1">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">₹{item.price} × {item.quantity} pieces</p>
                    </div>
                    <div className="text-lg font-bold text-primary">
                      ₹{(item.price * item.quantity).toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Information and Customer & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Information */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Order Information</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Order ID:</span>
                  <span className="text-sm font-medium text-foreground">#{formatted.full}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Order Time:</span>
                  <span className="text-sm font-medium text-foreground">{formatOrderTime(order.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Est. Time:</span>
                  <span className="text-sm font-medium text-foreground">{order.estimatedTime || 15} minutes</span>
                </div>
                {order.deliveryPersonId && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Truck className="h-4 w-4 mr-1.5 text-primary" />
                      Delivery Person:
                    </span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-medium px-2.5 py-1">
                      {order.deliveryPersonId}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Payment */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Customer & Payment</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer:</span>
                  <div className="text-right">
                    <span className="block text-sm font-medium text-foreground">{order.customerName}</span>
                    {phoneNumber && (
                      <span className="block text-xs text-muted-foreground">{phoneNumber}</span>
                    )}
                    {customerLoading && order?.customerId && !phoneNumber && (
                      <span className="block text-xs text-muted-foreground animate-pulse">Loading phone...</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Amount:</span>
                  <span className="text-lg font-bold text-success">₹{order.itemsSubtotal ?? order.amount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Barcode Used:</span>
                  <span className={`text-sm font-medium ${order.barcodeUsed ? 'text-success' : 'text-warning'}`}>
                    {order.barcodeUsed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address Section */}
          {((order.orderType === 'delivery' || order.status === 'out_for_delivery' || order.deliveryPersonId)) && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Delivery Address</h3>
              </div>
              {order.deliveryAddress ? (
                <div className="space-y-2 text-sm">
                  {order.deliveryAddress.fullName && (
                    <p className="font-medium text-gray-900">{order.deliveryAddress.fullName}</p>
                  )}
                  {order.deliveryAddress.phoneNumber && (
                    <p className="text-gray-600">{order.deliveryAddress.phoneNumber}</p>
                  )}
                  {order.deliveryAddress.addressLine1 && (
                    <p className="text-gray-600">
                      {order.deliveryAddress.addressLine1}
                      {order.deliveryAddress.addressLine2 && `, ${order.deliveryAddress.addressLine2}`}
                    </p>
                  )}
                  {(order.deliveryAddress.city || order.deliveryAddress.state || order.deliveryAddress.pincode) && (
                    <p className="text-gray-600">
                      {[order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {order.deliveryAddress.landmark && (
                    <p className="text-gray-600">Landmark: {order.deliveryAddress.landmark}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 rounded p-3 border border-amber-200">
                  <p className="font-medium">⚠️ Delivery address not available</p>
                  <p className="text-xs mt-1">This order was created before address saving was implemented, or the address was not provided.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-6 border-t border-border">
          <div>
            {order.status === 'ready' && onScanBarcode && (
              <Button
                onClick={() => onScanBarcode(order)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan Barcode
              </Button>
            )}
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            className="px-6 py-2"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

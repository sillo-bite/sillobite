import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  CheckCircle, 
  Clock, 
  User,
  RefreshCw,
  MapPin
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { formatOrderIdDisplay } from "@shared/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import BarcodeScanModal from "@/components/modals/BarcodeScanModal";
import OrderFoundModal from "@/components/orders/OrderFoundModal";
import OrderNotFoundModal from "@/components/orders/OrderNotFoundModal";

interface DeliveryHomeProps {
  deliveryPerson: any;
  onRefresh?: () => void;
}

export default function DeliveryHome({ deliveryPerson, onRefresh }: DeliveryHomeProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<"active" | "completed">("active");
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [currentOrderForBarcode, setCurrentOrderForBarcode] = useState<any>(null);
  const [isOrderFoundModalOpen, setIsOrderFoundModalOpen] = useState(false);
  const [isOrderNotFoundModalOpen, setIsOrderNotFoundModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);

  // Get orders for delivery person
  const { data: ordersData, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`],
    queryFn: async () => {
      if (!user?.email) return { active: [], completed: [] };
      const result = await apiRequest(`/api/delivery-persons/by-email/${user.email}/orders`);
      console.log('📦 Fetched orders for delivery person:', {
        activeCount: result?.active?.length || 0,
        completedCount: result?.completed?.length || 0,
        activeOrders: result?.active?.map((o: any) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          deliveryPersonId: o.deliveryPersonId
        }))
      });
      return result;
    },
    enabled: !!user?.email && !!deliveryPerson,
    refetchInterval: 60000, // Refetch every 60 seconds (reduced frequency)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 0, // Always consider data stale to ensure fresh fetches after assignments
  });

  const activeOrders = ordersData?.active || [];
  const completedOrders = ordersData?.completed || [];

  // Removed pending assignment polling - we now use direct assignment only
  // No need to check for pending assignments since assignments are direct

  // WebSocket connection for delivery assignments
  const { socket, isConnected } = useWebSocket({
    enabled: !!user?.email
  });

  useEffect(() => {
    if (!socket || !user?.email) {
      console.log('🚚 WebSocket setup skipped:', { hasSocket: !!socket, hasEmail: !!user?.email });
      return;
    }

    // Join delivery person room when connected
    if (isConnected) {
      socket.emit('joinDeliveryPersonRoom', { email: user.email });
      console.log('🚚 Joined delivery person room for:', user.email);
    } else {
      console.log('🚚 WebSocket not connected yet, waiting...');
    }

    // Listen for delivery assignments
    const handleAssignmentRequest = (message: any) => {
      console.log('🚚 Received delivery assignment message:', message);
      if (message.type === 'delivery_assignment') {
        // New direct assignment from store counter - no accept/reject needed
        // Just refresh orders to show the new assignment in active orders
        console.log('✅ Received direct delivery assignment, refreshing orders...', {
          orderId: message.data?.orderId,
          orderNumber: message.data?.orderNumber,
          status: message.data?.status
        });
        
        // Invalidate query cache first
        queryClient.invalidateQueries({ 
          queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`] 
        });
        
        // Wait a bit for database to update, then refetch
        setTimeout(() => {
          console.log('🔄 Refetching orders after assignment...');
          refetch().then((result) => {
            console.log('📦 Orders refetched:', {
              activeCount: result.data?.active?.length || 0,
              completedCount: result.data?.completed?.length || 0,
              activeOrders: result.data?.active?.map((o: any) => ({
                orderNumber: o.orderNumber,
                status: o.status
              }))
            });
          }).catch((error) => {
            console.error('❌ Error refetching orders:', error);
          });
        }, 500); // Small delay to ensure database update is complete
      }
    };

    socket.on('deliveryAssignment', handleAssignmentRequest);
    console.log('🚚 Registered deliveryAssignment event listener');

    return () => {
      console.log('🚚 Cleaning up delivery person WebSocket listeners');
      if (socket && user?.email) {
        socket.emit('leaveDeliveryPersonRoom', { email: user.email });
      }
      socket.off('deliveryAssignment', handleAssignmentRequest);
    };
  }, [socket, isConnected, user?.email, refetch, queryClient]);

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const updateData: any = { status };
      if (status === "delivered") {
        updateData.deliveredAt = new Date().toISOString();
      }
      return apiRequest(`/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`] });
      if (onRefresh) onRefresh();
    }
  });

  // Removed accept/reject mutations - no longer needed with direct assignment

  // Handle barcode scan initiation
  const handleBarcodeScan = (order: any) => {
    setCurrentOrderForBarcode(order);
    setIsBarcodeModalOpen(true);
  };

  const handleCloseBarcodeModal = () => {
    setIsBarcodeModalOpen(false);
  };

  const handleBackToOrder = () => {
    setIsBarcodeModalOpen(false);
    setCurrentOrderForBarcode(null);
  };

  // Helper function to check if scanned barcode matches order (full barcode or first 4 digits)
  const matchesBarcode = (scannedBarcode: string, orderBarcode: string): boolean => {
    if (!orderBarcode) return false;
    
    // Exact match
    if (scannedBarcode === orderBarcode) return true;
    
    // Check if scanned is first 4 digits of order barcode
    if (scannedBarcode.length === 4 && orderBarcode.length >= 4) {
      const first4Digits = orderBarcode.slice(0, 4);
      return scannedBarcode === first4Digits;
    }
    
    // Check if order barcode starts with scanned barcode (for partial matches)
    if (scannedBarcode.length < orderBarcode.length) {
      return orderBarcode.startsWith(scannedBarcode);
    }
    
    return false;
  };

  // Handle barcode scanned
  const handleBarcodeScanned = async (barcode: string) => {
    try {
      console.log('🔍 Barcode scanned:', barcode, 'for order:', currentOrderForBarcode?.id);
      console.log('🔍 Order barcode:', currentOrderForBarcode?.barcode);
      
      // Store the order data before closing the barcode modal
      const orderForVerification = currentOrderForBarcode;
      
      // Close the barcode scan modal first
      setIsBarcodeModalOpen(false);
      
      // Verify if the scanned barcode matches the order's barcode (full or first 4 digits)
      if (orderForVerification && matchesBarcode(barcode, orderForVerification.barcode)) {
        console.log('✅ Barcode/OTP matches! Showing order found modal');
        setScannedBarcode(barcode);
        setCurrentOrderForBarcode(orderForVerification); // Keep the order data
        setIsOrderFoundModalOpen(true);
      } else {
        console.log('❌ Barcode/OTP does not match! Showing order not found modal');
        setScannedBarcode(barcode);
        setCurrentOrderForBarcode(null); // Clear order data for not found
        setIsOrderNotFoundModalOpen(true);
      }
    } catch (error) {
      console.error('Error processing barcode scan:', error);
    }
  };

  const handleCloseOrderFoundModal = () => {
    setIsOrderFoundModalOpen(false);
    setCurrentOrderForBarcode(null);
  };

  const handleCloseOrderNotFoundModal = () => {
    setIsOrderNotFoundModalOpen(false);
    setCurrentOrderForBarcode(null);
    setScannedBarcode('');
  };

  // Handle mark as delivered (after barcode verification)
  const handleMarkDelivered = async () => {
    try {
      if (!currentOrderForBarcode) {
        console.error('❌ No order selected for delivery');
        return;
      }
      
      if (!deliveryPerson?.deliveryPersonId) {
        console.error('❌ Delivery person ID not found');
        alert("Delivery person information not found. Please refresh and try again.");
        return;
      }
      
      // Get order ID - try id, _id, or orderNumber
      const orderId = currentOrderForBarcode.id || currentOrderForBarcode._id || currentOrderForBarcode.orderNumber;
      
      if (!orderId) {
        console.error('❌ Order ID not found in order object:', currentOrderForBarcode);
        return;
      }
      
      setIsDelivering(true);
      console.log('📦 Marking order as delivered by delivery person:', { 
        orderId, 
        orderNumber: currentOrderForBarcode.orderNumber,
        deliveryPersonId: deliveryPerson.deliveryPersonId
      });
      
      // Call the deliver API endpoint with delivery person ID
      await apiRequest(`/api/orders/${orderId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ 
          deliveryPersonId: deliveryPerson.deliveryPersonId 
        })
      });
      
      console.log('✅ Order marked as delivered successfully');
      
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ 
        queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`] 
      });
      refetch();
      
      if (onRefresh) onRefresh();
      
      handleCloseOrderFoundModal();
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      alert("Failed to mark order as delivered. Please try again.");
    } finally {
      setIsDelivering(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("delivered") || statusLower.includes("completed")) {
      return "bg-green-100 text-green-800 border-green-200";
    }
    if (statusLower.includes("ready") || statusLower.includes("out_for_delivery")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    if (statusLower.includes("preparing")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
    if (statusLower.includes("pending")) {
      return "bg-orange-100 text-orange-800 border-orange-200";
    }
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const handleRefresh = () => {
    refetch();
    if (onRefresh) onRefresh();
  };

  const parseOrderItems = (itemsString: string) => {
    try {
      const items = typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{activeOrders.length}</p>
              </div>
              <Package className="w-8 h-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Delivered</p>
                <p className="text-2xl font-bold">{deliveryPerson.totalOrderDelivered || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-muted p-1 rounded-lg">
        <Button
          variant={selectedTab === "active" ? "default" : "ghost"}
          className="flex-1"
          onClick={() => setSelectedTab("active")}
        >
          Active ({activeOrders.length})
        </Button>
        <Button
          variant={selectedTab === "completed" ? "default" : "ghost"}
          className="flex-1"
          onClick={() => setSelectedTab("completed")}
        >
          Completed ({completedOrders.length})
        </Button>
      </div>

      {/* Orders List */}
      {ordersLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      ) : selectedTab === "active" && activeOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">No Active Orders</p>
            <p className="text-sm text-muted-foreground">
              You don't have any active orders assigned at the moment.
            </p>
          </CardContent>
        </Card>
      ) : selectedTab === "completed" && completedOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">No Completed Orders</p>
            <p className="text-sm text-muted-foreground">
              Your completed orders will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(selectedTab === "active" ? activeOrders : completedOrders).map((order: any) => {
            const formatted = formatOrderIdDisplay(order.orderNumber || order.id);
            const items = parseOrderItems(order.items);
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <span>#{formatted.prefix}</span>
                      <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-1">
                        {formatted.highlighted}
                      </span>
                    </CardTitle>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Customer Info */}
                  <div className="flex items-center space-x-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{order.customerName}</span>
                  </div>

                  {/* Delivery Address */}
                  {((order.orderType === 'delivery' || order.status === 'out_for_delivery' || order.deliveryPersonId) && order.deliveryAddress) && (
                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                      <div className="flex items-start space-x-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-muted-foreground mb-1">Delivery Address:</p>
                          <div className="space-y-0.5 text-xs">
                            {order.deliveryAddress.fullName && (
                              <p className="font-medium">{order.deliveryAddress.fullName}</p>
                            )}
                            {order.deliveryAddress.phoneNumber && (
                              <p className="text-muted-foreground">{order.deliveryAddress.phoneNumber}</p>
                            )}
                            {order.deliveryAddress.addressLine1 && (
                              <p className="text-muted-foreground">
                                {order.deliveryAddress.addressLine1}
                                {order.deliveryAddress.addressLine2 && `, ${order.deliveryAddress.addressLine2}`}
                              </p>
                            )}
                            {(order.deliveryAddress.city || order.deliveryAddress.state || order.deliveryAddress.pincode) && (
                              <p className="text-muted-foreground">
                                {[order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
                              </p>
                            )}
                            {order.deliveryAddress.landmark && (
                              <p className="text-muted-foreground">Landmark: {order.deliveryAddress.landmark}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Items - Grouped by Counter */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Items to Pick:</p>
                    {(() => {
                      // Group items by counter
                      const itemStatusByCounter = order.itemStatusByCounter || {};
                      const counterMap = order.counterMap || {};
                      const itemsByCounter: { [counterId: string]: any[] } = {};
                      
                      items.forEach((item: any) => {
                        const counterId = item.storeCounterId;
                        if (counterId) {
                          if (!itemsByCounter[counterId]) {
                            itemsByCounter[counterId] = [];
                          }
                          itemsByCounter[counterId].push(item);
                        }
                      });

                      // If no counter grouping, show all items
                      if (Object.keys(itemsByCounter).length === 0) {
                        return (
                          <div className="bg-muted p-2 rounded text-sm">
                            <ul className="space-y-1">
                              {items.slice(0, 5).map((item: any, idx: number) => (
                                <li key={idx} className="flex justify-between">
                                  <span>{item.name || item.itemName || "Item"}</span>
                                  <span className="text-muted-foreground">
                                    {item.quantity ? `x${item.quantity}` : ""}
                                  </span>
                                </li>
                              ))}
                              {items.length > 5 && (
                                <li className="text-muted-foreground text-xs">
                                  +{items.length - 5} more items
                                </li>
                              )}
                            </ul>
                          </div>
                        );
                      }

                      // Show items grouped by counter
                      return (
                        <div className="space-y-2">
                          {Object.entries(itemsByCounter).map(([counterId, counterItems]) => {
                            const counterInfo = counterMap[counterId] || { name: `Counter ${counterId}`, code: counterId };
                            const counterStatus = itemStatusByCounter[counterId] || {};
                            const readyItems = counterItems.filter((item: any) => {
                              const itemStatus = counterStatus[item.id];
                              // For auto-ready items (not markable), check order status
                              if (!itemStatus && item.isMarkable !== true) {
                                // Auto-ready item - consider ready if order is ready/preparing/out_for_delivery
                                return order.status === 'ready' || order.status === 'preparing' || order.status === 'out_for_delivery';
                              }
                              // For markable items, check the status from itemStatusByCounter
                              return itemStatus === 'ready' || itemStatus === 'out_for_delivery' || itemStatus === 'completed';
                            });
                            
                            return (
                              <div key={counterId} className="bg-muted p-3 rounded border-l-4 border-primary">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold text-primary">
                                    {counterInfo.name} ({counterInfo.code})
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {readyItems.length}/{counterItems.length} ready
                                  </Badge>
                                </div>
                                <ul className="space-y-1 text-sm">
                                  {counterItems.map((item: any, idx: number) => {
                                    // For auto-ready items (not markable), check order status
                                    // Auto-ready items are considered ready if order is ready/preparing/out_for_delivery
                                    let itemStatus = counterStatus[item.id];
                                    if (!itemStatus && item.isMarkable !== true) {
                                      // Auto-ready item - check order status
                                      if (order.status === 'ready' || order.status === 'preparing' || order.status === 'out_for_delivery') {
                                        itemStatus = 'ready';
                                      } else {
                                        itemStatus = 'pending';
                                      }
                                    } else {
                                      // Markable item or has status - use the status from itemStatusByCounter
                                      itemStatus = itemStatus || 'pending';
                                    }
                                    
                                    const isReady = itemStatus === 'ready' || itemStatus === 'out_for_delivery' || itemStatus === 'completed';
                                    return (
                                      <li key={idx} className={`flex justify-between ${isReady ? 'text-green-700' : 'text-gray-600'}`}>
                                        <span className="flex items-center space-x-2">
                                          <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                          <span>{item.name || item.itemName || "Item"}</span>
                                        </span>
                                        <span className="text-muted-foreground">
                                          {item.quantity ? `x${item.quantity}` : ""}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Total Amount:</span>
                    <span className="text-lg font-bold text-primary">₹{order.amount}</span>
                  </div>

                    {/* Time Info */}
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Button for Active Orders */}
                    {selectedTab === "active" && (
                      <Button
                        className="w-full mt-2"
                        onClick={() => handleBarcodeScan(order)}
                        disabled={isDelivering}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Delivered
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      {/* Refresh Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleRefresh}
        disabled={ordersLoading}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${ordersLoading ? 'animate-spin' : ''}`} />
        Refresh Orders
      </Button>

      {/* Barcode Scan Modal */}
      <BarcodeScanModal
        isOpen={isBarcodeModalOpen}
        onClose={handleCloseBarcodeModal}
        onBarcodeScanned={handleBarcodeScanned}
        onBack={handleBackToOrder}
        title="Scan Order Barcode"
      />

      {/* Order Found Modal */}
      <OrderFoundModal
        isOpen={isOrderFoundModalOpen}
        onClose={handleCloseOrderFoundModal}
        onMarkDelivered={handleMarkDelivered}
        order={currentOrderForBarcode}
        isDelivering={isDelivering}
        mode="delivery"
      />

      {/* Order Not Found Modal */}
      <OrderNotFoundModal
        isOpen={isOrderNotFoundModalOpen}
        onClose={handleCloseOrderNotFoundModal}
        scannedBarcode={scannedBarcode}
      />
    </div>
  );
}


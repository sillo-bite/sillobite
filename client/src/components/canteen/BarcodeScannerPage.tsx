import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Plus, Trash2, ShoppingCart, AlertTriangle, Clock, User, CreditCard, Receipt, Package } from "lucide-react";
import { formatOrderIdDisplay } from "@shared/utils";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";
import NotificationPermissionDialog from "@/components/modals/NotificationPermissionDialog";

// Types for our components
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  stock: number;
}

interface SelectedItem extends MenuItem {
  quantity: number;
}

interface OrderDetails {
  id: string;
  status: string;
  placedAt: string;
  customerName: string;
  items: SelectedItem[];
  total: number;
  estimatedTime?: number;
}

export default function BarcodeScannerPage() {
  const [, setLocation] = useLocation();
  const [orderId, setOrderId] = useState("");
  
  // Manual order creation state
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  
  // Order details popup state
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);

  // Get user data and notification hook
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const { permission, supportsNotifications } = useWebPushNotifications(userData?.id, userData?.role);

  // Sample menu items - in real app, this would come from API
  const menuItems: MenuItem[] = [
    { id: 1, name: "Veg Thali", price: 60, category: "Veg", available: true, stock: 20 },
    { id: 2, name: "Paneer Curry", price: 70, category: "Veg", available: true, stock: 15 },
    { id: 3, name: "Rice", price: 25, category: "Staples", available: true, stock: 100 },
    { id: 4, name: "Coffee", price: 15, category: "Beverages", available: true, stock: 50 },
    { id: 5, name: "Chicken Curry", price: 80, category: "Non-Veg", available: true, stock: 10 },
  ];

  // Function to fetch order details from API
  const fetchOrderDetails = async (orderIdToFetch: string): Promise<OrderDetails | null> => {
    try {
      const response = await fetch(`/api/orders/${orderIdToFetch}`);
      if (response.ok) {
        const order = await response.json();
        // Transform the API response to match our OrderDetails interface
        return {
          id: order.orderNumber || orderIdToFetch,
          status: order.status || "completed",
          placedAt: order.createdAt || "Just now",
          customerName: order.customerName || "Unknown Customer",
          items: JSON.parse(order.items || "[]"),
          total: order.amount || 0,
          estimatedTime: order.estimatedTime
        };
      } else {
        // Return mock data if API fails (for demo purposes)
        return {
          id: orderIdToFetch,
          status: "completed",
          placedAt: "Today, 2:30 PM",
          customerName: "John Doe",
          items: [
            { id: 1, name: "Veg Thali", price: 60, category: "Veg", available: true, stock: 20, quantity: 1 },
            { id: 4, name: "Coffee", price: 15, category: "Beverages", available: true, stock: 50, quantity: 2 }
          ],
          total: 90,
          estimatedTime: 15
        };
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!orderId.trim()) {
      return;
    }
    
    // Accept either 12-digit barcode or 4-digit OTP
    const barcodePattern = /^[0-9]{12}$/;
    const otpPattern = /^[0-9]{4}$/;
    
    if (!barcodePattern.test(orderId) && !otpPattern.test(orderId)) {
      return;
    }
    
    setIsLoadingOrder(true);
    // Fetch order details and show in popup instead of navigating
    // If it's a 4-digit OTP, we need to search for orders ending with those digits
    let searchId = orderId;
    if (otpPattern.test(orderId)) {
      // For 4-digit OTP, try to find order by searching with the OTP
      // The API should handle this, but we'll pass it as is
      searchId = orderId;
    }
    
    const details = await fetchOrderDetails(searchId);
    if (details) {
      setOrderDetails(details);
      setIsOrderDetailsModalOpen(true);
      setOrderId(""); // Clear the input
    } else {
      }
    setIsLoadingOrder(false);
  };

  // Manual order creation handlers
  const handleAddItemToOrder = (menuItem: MenuItem, quantity = 1) => {
    const existingItem = selectedItems.find(item => item.id === menuItem.id);
    if (existingItem) {
      setSelectedItems(selectedItems.map(item => 
        item.id === menuItem.id 
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, { ...menuItem, quantity }]);
    }
  };

  const handleRemoveItemFromOrder = (itemId: number) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };

  const handleUpdateItemQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItemFromOrder(itemId);
      return;
    }
    setSelectedItems(selectedItems.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const calculateOrderTotal = () => {
    return selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCreateManualOrder = async () => {
    if (selectedItems.length === 0) {
      return;
    }

    // Check notification permissions before placing order
    if (supportsNotifications && permission !== 'granted') {
      setShowNotificationDialog(true);
      return;
    }

    // Proceed with order creation
    proceedWithManualOrder();
  };

  // Function to fetch college name by ID
  const fetchCollegeName = async (collegeId: string) => {
    try {
      const response = await fetch(`/api/system-settings/colleges/${collegeId}/name`);
      if (response.ok) {
        const data = await response.json();
        return data.name || 'Unknown College';
      }
    } catch (error) {
      console.log('🔍 Failed to fetch college name:', error);
    }
    return 'Unknown College';
  };

  const proceedWithManualOrder = async () => {
    try {
      // Fetch college name if user has college info
      let collegeName = 'Not specified';
      if (userData?.college) {
        collegeName = await fetchCollegeName(userData.college);
      }

            // Utility function to get default category name
            const getDefaultCategoryName = (itemName: string): string => {
              const name = itemName.toLowerCase();
              if (name.includes('tea') || name.includes('coffee') || name.includes('juice') || name.includes('drink')) {
                return 'Beverages';
              } else if (name.includes('rice') || name.includes('biryani') || name.includes('curry')) {
                return 'Main Course';
              } else if (name.includes('snack') || name.includes('samosa') || name.includes('pakora')) {
                return 'Snacks';
              } else if (name.includes('sweet') || name.includes('dessert') || name.includes('cake')) {
                return 'Desserts';
              } else if (name.includes('bread') || name.includes('roti') || name.includes('naan')) {
                return 'Bread';
              } else {
                return 'Main Course';
              }
            };

            // Enhance selected items with category information
            const enhancedItems = selectedItems.map(item => ({
              ...item,
              category: item.category || getDefaultCategoryName(item.name)
            }));

            console.log('🔍 BarcodeScannerPage - Enhanced items:', enhancedItems.map(item => ({
              name: item.name,
              category: item.category
            })));

      const orderData = {
        customerId: userData?.id || 6, // Use current user ID or fallback
        customerName: userData?.name || "Manual Order",
        collegeName: collegeName,
        items: JSON.stringify(enhancedItems),
        amount: calculateOrderTotal(),
        originalAmount: calculateOrderTotal(), // No discount for manual orders
        discountAmount: 0,
        appliedCoupon: null,
        status: "preparing",
        estimatedTime: 15
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const order = await response.json();
        // Reset form and close modal
        setSelectedItems([]);
        setIsMenuModalOpen(false);
      } else {
        }
    } catch (error) {
      }
  };

  const handleNotificationDialogClose = (granted: boolean) => {
    setShowNotificationDialog(false);
    if (granted) {
      // User granted permission, proceed with order
      proceedWithManualOrder();
    }
    // If denied, do nothing - let user try again if they want
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/canteen-owner")}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Order Entry</h1>
          <Button 
            onClick={() => setIsMenuModalOpen(true)}
            variant="outline"
            size="sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Quick Order
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Order ID Entry Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Enter Order ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID</Label>
              <Input
                id="orderId"
                placeholder="e.g., 123456789012"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={12}
              />
            </div>

            {orderId && (
              <Alert className={
                /^[0-9]{12}$/.test(orderId) 
                  ? "border-green-500/50 text-green-600 dark:border-green-500 [&>svg]:text-green-600"
                  : "border-amber-500/50 text-amber-600 dark:border-amber-500 [&>svg]:text-amber-600"
              }>
                {/^[0-9]{12}$/.test(orderId) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {/^[0-9]{12}$/.test(orderId) 
                    ? (
                        <div className="flex items-center">
                          <span>Valid Order ID: </span>
                          <span>{(() => {
                            const formatted = formatOrderIdDisplay(orderId);
                            return formatted.prefix;
                          })()}</span>
                          <span className="bg-green-500/20 text-green-700 font-bold px-1 rounded ml-0">
                            {(() => {
                              const formatted = formatOrderIdDisplay(orderId);
                              return formatted.highlighted;
                            })()}
                          </span>
                        </div>
                      )
                    : `Invalid format. Expected 12 digits (0-9): ${orderId.length}/12`
                  }
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={!orderId.trim() || isLoadingOrder}
            >
              {isLoadingOrder ? "Loading..." : "Submit Order ID"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Order Menu Modal */}
        <Dialog open={isMenuModalOpen} onOpenChange={setIsMenuModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quick Order Menu</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Menu Items Selection */}
              <div className="space-y-4">
                <h3 className="font-medium">Available Items</h3>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto border rounded p-3">
                  {menuItems.filter(item => item.available).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent/50">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.category}</div>
                        <div className="text-lg font-semibold text-primary">₹{item.price}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddItemToOrder(item)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Order Summary</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-accent/50 rounded">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">₹{item.price} each</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveItemFromOrder(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Order Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-bold text-primary">₹{calculateOrderTotal()}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedItems([]);
                          setIsMenuModalOpen(false);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateManualOrder}
                        disabled={selectedItems.length === 0}
                        className="flex-1"
                        size="lg"
                      >
                        Create Order
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Order Details Popup Modal */}
        <Dialog open={isOrderDetailsModalOpen} onOpenChange={setIsOrderDetailsModalOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Order Details</span>
              </DialogTitle>
            </DialogHeader>
            
            {orderDetails && (
              <div className="space-y-6">
                {/* Order Status */}
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <Badge className={
                      orderDetails.status === "completed" ? "bg-green-500 text-white" :
                      orderDetails.status === "ready" ? "bg-blue-500 text-white" :
                      orderDetails.status === "preparing" ? "bg-orange-500 text-white" :
                      "bg-gray-500 text-white"
                    }>
                      {orderDetails.status.charAt(0).toUpperCase() + orderDetails.status.slice(1)}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold">Order #{orderDetails.id}</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {orderDetails.placedAt}
                  </p>
                </div>

                {/* Customer Info */}
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Customer
                  </h4>
                  <p className="text-sm text-muted-foreground pl-6">{orderDetails.customerName}</p>
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Receipt className="w-4 h-4 mr-2" />
                    Items ({orderDetails.items.length})
                  </h4>
                  <div className="space-y-2">
                    {orderDetails.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">₹{item.price} × {item.quantity}</p>
                        </div>
                        <div className="text-sm font-semibold">₹{item.price * item.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Total Amount
                    </span>
                    <span className="text-lg font-bold text-primary">₹{orderDetails.total}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsOrderDetailsModalOpen(false)}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  {orderDetails.status === "ready" && (
                    <Button
                      onClick={() => {
                        setIsOrderDetailsModalOpen(false);
                      }}
                      className="flex-1"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Notification Permission Dialog */}
        <NotificationPermissionDialog
          isOpen={showNotificationDialog}
          onClose={handleNotificationDialogClose}
          userId={userData?.id}
          userRole={userData?.role}
        />
      </div>
    </div>
  );
}
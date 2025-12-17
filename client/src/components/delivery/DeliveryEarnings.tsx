import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Package,
  RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface DeliveryEarningsProps {
  deliveryPerson: any;
}

export default function DeliveryEarnings({ deliveryPerson }: DeliveryEarningsProps) {
  const { user } = useAuth();

  // Get completed orders for earnings calculation
  // Uses the same query key as DeliveryHome to share cached data
  const { data: ordersData, isLoading } = useQuery({
    queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`],
    queryFn: async () => {
      if (!user?.email) return { active: [], completed: [] };
      return apiRequest(`/api/delivery-persons/by-email/${user.email}/orders`);
    },
    enabled: !!user?.email && !!deliveryPerson,
    // No refetchInterval here - uses cached data from DeliveryHome
    staleTime: 60000, // Consider data fresh for 60 seconds
  });

  const completedOrders = ordersData?.completed || [];
  
  // Calculate earnings (assuming a fixed amount per delivery or percentage)
  // For now, we'll show total orders and let the system calculate earnings
  const totalEarnings = completedOrders.reduce((sum: number, order: any) => {
    // You can adjust this calculation based on your earnings model
    // For example: fixed amount per delivery, percentage of order value, etc.
    return sum + (order.amount * 0.05); // Example: 5% commission
  }, 0);

  const todayOrders = completedOrders.filter((order: any) => {
    const orderDate = new Date(order.deliveredAt || order.createdAt);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const todayEarnings = todayOrders.reduce((sum: number, order: any) => {
    return sum + (order.amount * 0.05);
  }, 0);

  const thisWeekOrders = completedOrders.filter((order: any) => {
    const orderDate = new Date(order.deliveredAt || order.createdAt);
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return orderDate >= weekAgo;
  });

  const weekEarnings = thisWeekOrders.reduce((sum: number, order: any) => {
    return sum + (order.amount * 0.05);
  }, 0);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Earnings Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Earnings</p>
                <p className="text-2xl font-bold">₹{todayEarnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayOrders.length} orders
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">₹{weekEarnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {thisWeekOrders.length} orders
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Total Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">₹{totalEarnings.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                From {completedOrders.length} completed orders
              </p>
            </div>
            <Package className="w-12 h-12 text-primary opacity-60" />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Orders Delivered</span>
            <span className="font-medium">{deliveryPerson.totalOrderDelivered || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completed Orders</span>
            <span className="font-medium">{completedOrders.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Average per Order</span>
            <span className="font-medium">
              ₹{completedOrders.length > 0 ? (totalEarnings / completedOrders.length).toFixed(2) : '0.00'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Earnings are calculated based on completed orders. 
            Payment processing may take 1-3 business days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


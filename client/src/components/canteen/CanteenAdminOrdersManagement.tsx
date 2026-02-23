import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { usePaginatedOrders } from "@/hooks/usePaginatedOrders";
import { useFilteredOrders } from "@/hooks/useFilteredOrders";
import { useMultiCanteenWebSocket } from "@/hooks/useMultiCanteenWebSocket";
import { useTriggerBasedUpdates } from "@/hooks/useTriggerBasedUpdates";
import { useEffect } from "react";
import type { Order } from "@shared/schema";
import { formatOrderIdDisplay } from "@shared/utils";
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Package,
  Loader2,
  Calendar,
  MapPin,
  Trash2,
  ShoppingCart,
  User,
  Phone,
  Mail,
  CreditCard,
  Timer,
  TrendingUp,
  BarChart3,
  SortAsc,
  SortDesc,
  ChevronDown,
  X
} from "lucide-react";

interface CanteenAdminOrdersManagementProps {
  canteenId: string;
}

export default function CanteenAdminOrdersManagement({ canteenId }: CanteenAdminOrdersManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [amountRange, setAmountRange] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [counterNames, setCounterNames] = useState<{ [counterId: string]: string }>({});

  const { triggerOrderRefresh } = useTriggerBasedUpdates();

  // Function to get counter name
  const getCounterName = async (counterId: string): Promise<string> => {
    if (counterNames[counterId]) {
      return counterNames[counterId];
    }

    try {
      const response = await apiRequest(`/api/counters/${counterId}/name`);
      const name = response.name || 'Unknown Counter';
      setCounterNames(prev => ({ ...prev, [counterId]: name }));
      return name;
    } catch (error) {
      console.error('Error fetching counter name:', error);
      return 'Unknown Counter';
    }
  };

  // Component to display counter name
  const CounterNameDisplay = ({ counterId }: { counterId: string }) => {
    const [name, setName] = useState<string>('Loading...');

    useEffect(() => {
      getCounterName(counterId).then(setName);
    }, [counterId]);

    return <span className="font-medium text-green-600">{name}</span>;
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, dateRange, amountRange, paymentMethod, collegeFilter, sortBy, sortOrder]);

  // Use server-side filtered orders hook
  const {
    orders: filteredOrders,
    totalCount,
    totalPages,
    currentPage: serverCurrentPage,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders
  } = useFilteredOrders({
    canteenId,
    search: searchTerm,
    status: selectedStatus,
    dateRange,
    amountRange,
    paymentMethod,
    collegeFilter,
    sortBy,
    sortOrder,
    page: currentPage,
    limit: 15
  });

  // Fetch order stats only (counts by status) - more efficient than fetching all orders
  const { data: orderStats = { pending: 0, preparing: 0, completed: 0, cancelled: 0 } } = useQuery({
    queryKey: ['/api/orders/stats', canteenId],
    queryFn: async () => {
      const response = await fetch(`/api/orders/stats?canteenId=${canteenId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch order stats: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - stats don't change frequently
    refetchOnWindowFocus: false,
  });

  // Real-time updates: join canteen room and refetch on new orders or updates
  useMultiCanteenWebSocket({
    canteenIds: [canteenId],
    enabled: !!canteenId,
    onNewOrder: () => {
      refetchOrders();
    },
    onOrderUpdate: () => {
      refetchOrders();
    }
  });

  // Note: Removed menu API call - order items already contain necessary data

  // Fetch colleges for filtering
  const { data: collegesData, isLoading: collegesLoading, error: collegesError } = useQuery({
    queryKey: ['/api/system-settings/colleges'],
    queryFn: async () => {
      console.log('🏫 Fetching colleges...');
      const response = await fetch('/api/system-settings/colleges');
      console.log('🏫 Colleges response status:', response.status);
      if (!response.ok) {
        console.error('🏫 Colleges fetch failed:', response.status, response.statusText);
        return { colleges: [] };
      }
      const data = await response.json();
      console.log('🏫 Colleges data structure:', data);
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - colleges don't change often
    refetchOnWindowFocus: false,
  });

  // Extract colleges array from the response
  const colleges = collegesData?.colleges || [];

  // Debug colleges data
  console.log('🏫 Colleges data:', collegesData);
  console.log('🏫 Extracted colleges:', colleges);
  console.log('🏫 Colleges loading:', collegesLoading);
  console.log('🏫 Colleges error:', collegesError);
  console.log('🏫 Is colleges array?', Array.isArray(colleges));
  console.log('🏫 Colleges length:', colleges.length);


  // Fetch user details for the selected order
  const { data: userDetails } = useQuery({
    queryKey: ['/api/users', selectedOrder?.customerId],
    queryFn: async () => {
      if (!selectedOrder?.customerId) return null;
      const response = await fetch(`/api/users/${selectedOrder.customerId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedOrder?.customerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });


  // Fetch payment details for the selected order
  const { data: paymentDetails } = useQuery({
    queryKey: ['/api/payments', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return null;
      try {
        // Try to find payment by order ID
        const response = await fetch(`/api/payments?orderId=${selectedOrder.id}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.payments?.[0] || null;
      } catch {
        return null;
      }
    },
    enabled: !!selectedOrder?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Parse order items from JSON string
  const parseOrderItems = (itemsString: string) => {
    try {
      return JSON.parse(itemsString);
    } catch {
      return [];
    }
  };


  // Debug function to log user data
  const debugUserData = () => {
    if (userDetails) {
      console.log('🔍 User Details:', userDetails);
      console.log('🔍 User College Field:', userDetails.college);
      console.log('🔍 User CollegeId Field:', userDetails.collegeId);
    }
    if (selectedOrder) {
      console.log('🔍 Selected Order:', selectedOrder);
      console.log('🔍 Order Applied Coupon:', selectedOrder.appliedCoupon);
      console.log('🔍 Order Discount Amount:', selectedOrder.discountAmount);
      console.log('🔍 Order Original Amount:', selectedOrder.originalAmount);
      console.log('🔍 Order Amount:', selectedOrder.amount);
      console.log('🔍 All Order Keys:', Object.keys(selectedOrder));
    }
    if (paymentDetails) {
      console.log('🔍 Payment Details:', paymentDetails);
    }
  };

  // Call debug function when data changes
  React.useEffect(() => {
    debugUserData();
  }, [userDetails, selectedOrder]);


  // Get order item details - order items already contain necessary data
  const getOrderItemDetails = (orderItemsString: string) => {
    const items = parseOrderItems(orderItemsString);
    return items.map((item: any) => ({
      ...item,
      name: item.name || 'Unknown Item',
      price: item.price || 0,
      imageUrl: item.imageUrl,
      category: item.category || 'N/A'
    }));
  };

  // Note: Filtering and sorting is now handled server-side for better performance

  // Pagination handlers for server-side filtering
  const goToPage = (page: number) => {
    console.log('Navigate to page:', page);
    setCurrentPage(page);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setDateRange("all");
    setAmountRange("all");
    setPaymentMethod("all");
    setCollegeFilter("all");
    setSortBy("createdAt");
    setSortOrder("desc");
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedStatus !== "all" || dateRange !== "all" ||
    amountRange !== "all" || paymentMethod !== "all" || collegeFilter !== "all";

  // Update order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated', currentPage, 15, canteenId] });
      triggerOrderRefresh(canteenId);
    },
    onError: (error) => {
      console.error('Update order error:', error);
    }
  });

  // Delete order mutation
  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/orders/${orderId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated', currentPage, 15, canteenId] });
      triggerOrderRefresh(canteenId);
    },
    onError: (error) => {
      console.error('Delete order error:', error);
    }
  });

  // Note: Advanced filtering is now handled by getFilteredAndSortedOrders function above

  // Get status counts from stats API
  const statusCounts = {
    all: totalCount,
    pending: orderStats.pending || 0,
    preparing: orderStats.preparing || 0,
    completed: orderStats.completed || 0,
    cancelled: orderStats.cancelled || 0,
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'preparing': return <AlertTriangle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExport = () => {
  };

  const handleRefresh = () => {
    refetchOrders();
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    updateOrderStatus.mutate({ orderId, status: newStatus });
  };

  const handleDeleteOrder = (orderId: string) => {
    if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      deleteOrder.mutate(orderId);
    }
  };

  if (ordersLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-500" />
        <p className="text-red-600">Failed to load orders. Please try again.</p>
        <Button onClick={handleRefresh} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Orders Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Monitor and manage all orders for this canteen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="flex-1 sm:flex-initial">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 sm:flex-initial">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Order Stats */}
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 min-w-max sm:min-w-0">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Orders</p>
                  <p className="text-2xl font-bold">{statusCounts.all}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold">{statusCounts.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Preparing</p>
                  <p className="text-2xl font-bold">{statusCounts.preparing}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">{statusCounts.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Cancelled</p>
                  <p className="text-2xl font-bold">{statusCounts.cancelled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {/* Search and Basic Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="search">Search Orders</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Search by order number, customer name, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status Filter</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Advanced Filters</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  <span>Clear All Filters</span>
                </Button>
              )}
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Date Range Filter */}
                  <div>
                    <Label htmlFor="dateRange">Date Range</Label>
                    <Select value={dateRange} onValueChange={(value) => setDateRange(value as "all" | "today" | "week" | "month")}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount Range Filter */}
                  <div>
                    <Label htmlFor="amountRange">Amount Range</Label>
                    <Select value={amountRange} onValueChange={(value) => setAmountRange(value as "all" | "low" | "medium" | "high")}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Amounts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Amounts</SelectItem>
                        <SelectItem value="low">Low (₹0-50)</SelectItem>
                        <SelectItem value="medium">Medium (₹50-150)</SelectItem>
                        <SelectItem value="high">High (₹150+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Method Filter */}
                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "all" | "cash" | "online" | "free")}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="free">Free Orders</SelectItem>
                        <SelectItem value="cash">Cash Payment</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* College Filter */}
                  <div>
                    <Label htmlFor="collegeFilter">College</Label>
                    <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Colleges" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Colleges</SelectItem>
                        {collegesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading colleges...
                          </SelectItem>
                        ) : collegesError ? (
                          <SelectItem value="error" disabled>
                            Error loading colleges
                          </SelectItem>
                        ) : Array.isArray(colleges) && colleges.length > 0 ? (
                          colleges.map((college: any) => (
                            <SelectItem key={college.id} value={college.name}>
                              {college.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-colleges" disabled>
                            No colleges available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <Label htmlFor="sortBy">Sort By</Label>
                    <div className="flex space-x-2">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="createdAt">Date Created</SelectItem>
                          <SelectItem value="amount">Amount</SelectItem>
                          <SelectItem value="customerName">Customer Name</SelectItem>
                          <SelectItem value="orderNumber">Order Number</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="px-3"
                      >
                        {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {searchTerm && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>Search: "{searchTerm}"</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSearchTerm("")}
                        />
                      </Badge>
                    )}
                    {selectedStatus !== "all" && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>Status: {selectedStatus}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedStatus("all")}
                        />
                      </Badge>
                    )}
                    {dateRange !== "all" && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>Date: {dateRange}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setDateRange("all")}
                        />
                      </Badge>
                    )}
                    {amountRange !== "all" && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>Amount: {amountRange}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setAmountRange("all")}
                        />
                      </Badge>
                    )}
                    {paymentMethod !== "all" && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>Payment: {paymentMethod}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setPaymentMethod("all")}
                        />
                      </Badge>
                    )}
                    {collegeFilter !== "all" && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>College: {collegeFilter}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setCollegeFilter("all")}
                        />
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base sm:text-lg">
            <span>Orders ({filteredOrders.length})</span>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs sm:text-sm">
                Page {currentPage} of {totalPages}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedStatus !== "all"
                  ? "Try adjusting your filters"
                  : "No orders have been placed yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredOrders.map((order: any) => {
                const orderItems = getOrderItemDetails(order.items);
                return (
                  <div key={order.id} className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <h3 className="font-semibold text-sm sm:text-base break-words">
                            {(() => {
                              const formatted = formatOrderIdDisplay(order.orderNumber);
                              return (
                                <>
                                  {formatted.prefix}
                                  <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-1">
                                    {formatted.highlighted}
                                  </span>
                                </>
                              );
                            })()}
                          </h3>
                          <div className="flex items-center flex-wrap gap-2">
                            <Badge className={`${getStatusColor(order.status)} text-xs`}>
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(order.status)}
                                <span className="capitalize">{order.status}</span>
                              </div>
                            </Badge>
                            {order.isOffline && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                <div className="flex items-center space-x-1">
                                  <CreditCard className="h-3 w-3" />
                                  <span>Offline</span>
                                </div>
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                          <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
                            <p className="font-medium text-sm sm:text-base">{order.customerName || order.customer?.name || 'Unknown'}</p>
                            {(order.customerEmail || order.customer?.email) && (
                              <p className="text-xs text-muted-foreground break-all">{order.customerEmail || order.customer?.email}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Items</p>
                            <p className="font-medium text-sm sm:text-base">{orderItems.length} items</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {orderItems.length > 0 ? (
                                <>
                                  {orderItems.slice(0, 2).map((item: any) => item.name).join(', ')}
                                  {orderItems.length > 2 && ` +${orderItems.length - 2} more`}
                                </>
                              ) : (
                                'No items found'
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                            <p className="font-bold text-base sm:text-lg">₹{order.totalAmount || order.total || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOrder(order)}
                          className="flex-1 sm:flex-initial text-xs sm:text-sm"
                        >
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="sm:inline">View</span>
                        </Button>


                        {order.status === 'preparing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            disabled={updateOrderStatus.isPending}
                            className="disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial text-xs sm:text-sm"
                          >
                            {updateOrderStatus.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1 animate-spin" />
                                <span className="hidden sm:inline">Updating...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Mark as Ready</span>
                                <span className="sm:hidden">Ready</span>
                              </>
                            )}
                          </Button>
                        )}

                        {order.status === 'ready' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            disabled={updateOrderStatus.isPending}
                            className="flex-1 sm:flex-initial text-xs sm:text-sm"
                          >
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                            <span className="sm:inline">Complete</span>
                          </Button>
                        )}

                        {/* Developer Mode - Delete Order Button */}
                        {process.env.NODE_ENV === 'development' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={deleteOrder.isPending}
                            className="text-red-600 hover:text-red-700 flex-1 sm:flex-initial"
                            title="Developer Mode: Delete Order (Only available in development)"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={15}
            onPageChange={goToPage}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            onFirstPage={goToFirstPage}
            onLastPage={goToLastPage}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
          />
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Complete Order Details</span>
              <Badge className={getStatusColor(selectedOrder?.status || '')}>
                <div className="flex items-center space-x-1">
                  {selectedOrder && getStatusIcon(selectedOrder.status)}
                  <span className="capitalize">{selectedOrder?.status}</span>
                </div>
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ShoppingCart className="h-5 w-5" />
                    <span>Order Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {(() => {
                          const formatted = formatOrderIdDisplay(selectedOrder.orderNumber);
                          return (
                            <>
                              {formatted.prefix}
                              <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-1">
                                {formatted.highlighted}
                              </span>
                            </>
                          );
                        })()}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order ID:</span>
                          <span className="font-medium">{selectedOrder.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer ID:</span>
                          <span className="font-medium">{selectedOrder.customerId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Canteen ID:</span>
                          <span className="font-medium">{selectedOrder.canteenId}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Order Timeline</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                        </div>
                        {selectedOrder.updatedAt && selectedOrder.updatedAt !== selectedOrder.createdAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated:</span>
                            <span className="font-medium">{new Date(selectedOrder.updatedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedOrder.readyAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ready At:</span>
                            <span className="font-medium">{new Date(selectedOrder.readyAt).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedOrder.deliveredAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Delivered At:</span>
                            <span className="font-medium">{new Date(selectedOrder.deliveredAt).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedOrder.estimatedTime && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Estimated Time:</span>
                            <span className="font-medium">{selectedOrder.estimatedTime} minutes</span>
                          </div>
                        )}
                        {selectedOrder.barcode && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Barcode:</span>
                            <span className="font-medium">{selectedOrder.barcode}</span>
                          </div>
                        )}
                        {selectedOrder.barcodeUsed !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Barcode Used:</span>
                            <span className="font-medium">{selectedOrder.barcodeUsed ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">₹{selectedOrder.originalAmount || selectedOrder.amount}</span>
                        </div>
                        {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount:</span>
                            <span>-₹{selectedOrder.discountAmount}</span>
                          </div>
                        )}
                        {selectedOrder.appliedCoupon && (
                          <div className="flex justify-between text-blue-600">
                            <span>Coupon Applied:</span>
                            <span>{selectedOrder.appliedCoupon}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-lg">₹{selectedOrder.amount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Customer Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Basic Details</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>
                          <p className="font-medium">{userDetails?.name || selectedOrder.customerName || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <p className="font-medium">{userDetails?.email || selectedOrder.customerEmail || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <p className="font-medium">{userDetails?.phoneNumber || selectedOrder.customerPhone || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">User ID:</span>
                          <p className="font-medium">{selectedOrder.customerId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Advanced Details</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">College:</span>
                          <p className="font-medium">
                            {selectedOrder?.collegeName || userDetails?.collegeName || 'Not specified'}
                            <span className="text-xs text-gray-500 ml-2">
                              (ID: {userDetails?.college || selectedOrder.college || userDetails?.collegeId || selectedOrder.collegeId || 'None'})
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Department:</span>
                          <p className="font-medium">{userDetails?.department || selectedOrder.department || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Year:</span>
                          <p className="font-medium">{userDetails?.currentStudyYear || selectedOrder.year || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Register Number:</span>
                          <p className="font-medium">{userDetails?.registerNumber || selectedOrder.registerNumber || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Account Status</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Role:</span>
                          <p className="font-medium">{userDetails?.role || selectedOrder.role || 'Student'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Account Status:</span>
                          <p className="font-medium">{userDetails?.isActive ? 'Active' : 'Inactive'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Orders:</span>
                          <p className="font-medium">{userDetails?.totalOrders || selectedOrder.totalOrders || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Loyalty Points:</span>
                          <p className="font-medium">{userDetails?.loyaltyPoints || selectedOrder.loyaltyPoints || '0'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5" />
                    <span>Payment Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Payment Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Mode:</span>
                          <Badge variant={selectedOrder.isOffline ? 'outline' : 'default'} className={
                            selectedOrder.isOffline ? 'bg-orange-50 text-orange-700 border-orange-200' : ''
                          }>
                            {selectedOrder.isOffline ? 'Offline Payment' : 'Online Payment'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Status:</span>
                          <Badge variant={
                            selectedOrder.amount === 0 ? 'secondary' :
                              (paymentDetails?.status === 'success' || selectedOrder.paymentStatus === 'completed' || selectedOrder.paymentStatus === 'paid') ? 'default' :
                                'destructive'
                          }>
                            {selectedOrder.amount === 0 ? 'Free Order' :
                              (paymentDetails?.status === 'success' || selectedOrder.paymentStatus === 'completed' || selectedOrder.paymentStatus === 'paid') ? 'Paid' :
                                'Pending'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Method:</span>
                          <span className="font-medium">
                            {selectedOrder.amount === 0 ? 'Free Order' :
                              selectedOrder.isOffline ? 'Cash/Card at Counter' :
                                paymentDetails?.paymentMethod || selectedOrder.paymentMethod || 'Not specified'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transaction ID:</span>
                          <span className="font-medium">
                            {selectedOrder.amount === 0 ? 'N/A (Free Order)' :
                              selectedOrder.isOffline ? 'N/A (Offline Payment)' :
                                paymentDetails?.merchantTransactionId || paymentDetails?.razorpayTransactionId || paymentDetails?.phonePeTransactionId || selectedOrder.transactionId || 'N/A'}
                          </span>
                        </div>
                        {selectedOrder.isOffline && selectedOrder.paymentConfirmedBy && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payment Confirmed By:</span>
                            <CounterNameDisplay counterId={selectedOrder.paymentConfirmedBy} />
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Gateway:</span>
                          <span className="font-medium">
                            {selectedOrder.amount === 0 ? 'N/A (Free Order)' :
                              selectedOrder.isOffline ? 'N/A (Offline Payment)' :
                                paymentDetails?.razorpayTransactionId ? 'Razorpay' : paymentDetails?.responseCode ? 'PhonePe (Legacy)' : selectedOrder.paymentGateway || 'N/A'}
                          </span>
                        </div>
                        {(paymentDetails?.createdAt || selectedOrder.paidAt) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Paid At:</span>
                            <span className="font-medium">
                              {new Date(paymentDetails?.createdAt || selectedOrder.paidAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {paymentDetails?.responseCode && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Response Code:</span>
                            <span className="font-medium">{paymentDetails.responseCode}</span>
                          </div>
                        )}
                        {paymentDetails?.responseMessage && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Response Message:</span>
                            <span className="font-medium">{paymentDetails.responseMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Offline Payment Confirmation Details */}
                    {selectedOrder.isOffline && selectedOrder.paymentConfirmedBy && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Offline Payment Confirmation</h4>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-800">Payment Confirmed</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confirmed by Counter:</span>
                              <CounterNameDisplay counterId={selectedOrder.paymentConfirmedBy} />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Payment Method:</span>
                              <span className="font-medium">Cash/Card at Counter</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confirmation Status:</span>
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Verified
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="font-medium">Coupon & Discounts</h4>
                      <div className="space-y-2 text-sm">
                        {selectedOrder.appliedCoupon ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Coupon Code:</span>
                              <span className="font-medium text-blue-600">{selectedOrder.appliedCoupon}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Coupon Discount:</span>
                              <span className="font-medium text-green-600">-₹{selectedOrder.discountAmount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Original Amount:</span>
                              <span className="font-medium">₹{selectedOrder.originalAmount || selectedOrder.amount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Final Amount:</span>
                              <span className="font-bold text-lg">₹{selectedOrder.amount}</span>
                            </div>
                          </>
                        ) : selectedOrder.discountAmount && selectedOrder.discountAmount > 0 ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Discount Applied:</span>
                              <span className="font-medium text-green-600">-₹{selectedOrder.discountAmount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Original Amount:</span>
                              <span className="font-medium">₹{selectedOrder.originalAmount || selectedOrder.amount + selectedOrder.discountAmount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Final Amount:</span>
                              <span className="font-bold text-lg">₹{selectedOrder.amount}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-muted-foreground">
                            No coupon or discount applied
                            {selectedOrder.appliedCoupon && (
                              <div className="text-xs text-red-500 mt-1">
                                Debug: appliedCoupon = "{selectedOrder.appliedCoupon}"
                              </div>
                            )}
                            {selectedOrder.discountAmount && (
                              <div className="text-xs text-red-500 mt-1">
                                Debug: discountAmount = {selectedOrder.discountAmount}
                              </div>
                            )}
                          </div>
                        )}
                        {selectedOrder.loyaltyDiscount && selectedOrder.loyaltyDiscount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Loyalty Discount:</span>
                            <span className="font-medium text-green-600">-₹{selectedOrder.loyaltyDiscount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Order Items ({getOrderItemDetails(selectedOrder.items).length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getOrderItemDetails(selectedOrder.items).map((item: any, index: number) => (
                      <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted/50">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{item.name}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Quantity:</span>
                              <p className="font-medium">{item.quantity}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Unit Price:</span>
                              <p className="font-medium">₹{item.price}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Category:</span>
                              <p className="font-medium">{item.category || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total:</span>
                              <p className="font-bold">₹{item.quantity * item.price}</p>
                            </div>
                          </div>
                          {item.specialInstructions && (
                            <div className="mt-2">
                              <span className="text-muted-foreground text-sm">Special Instructions:</span>
                              <p className="text-sm italic">{item.specialInstructions}</p>
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-2">
                              <span className="text-muted-foreground text-sm">Notes:</span>
                              <p className="text-sm italic">{item.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order Actions */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <div className="flex space-x-2">
                  {selectedOrder.status === 'pending' && (
                    <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Start Preparing
                    </Button>
                  )}
                  {selectedOrder.status === 'preparing' && (
                    <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'ready')}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Ready
                    </Button>
                  )}
                  {selectedOrder.status === 'ready' && (
                    <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  {selectedOrder.status === 'completed' && (
                    <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                      <Package className="h-4 w-4 mr-2" />
                      Mark Delivered
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuthSync } from "@/hooks/useDataSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Clock, CheckCircle, Package, Loader2, Receipt, X, SlidersHorizontal, ChevronDown, MapPin, Calendar, DollarSign, CreditCard, Filter, XCircle } from "lucide-react";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Order } from "@shared/schema";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/contexts/ThemeContext";
import { useCanteenContext } from "@/contexts/CanteenContext";

export default function OrdersPage() {
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCanteen, setFilterCanteen] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [filterAmountRange, setFilterAmountRange] = useState("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [showCanteenDropdown, setShowCanteenDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showAmountDropdown, setShowAmountDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const canteenDropdownRef = useRef<HTMLDivElement>(null);

  // Clear search function
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (filterCanteen !== "all") count++;
    if (filterDateRange !== "all") count++;
    if (filterAmountRange !== "all") count++;
    if (filterPaymentStatus !== "all") count++;
    return count;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterCanteen("all");
    setFilterDateRange("all");
    setFilterAmountRange("all");
    setFilterPaymentStatus("all");
    setShowCanteenDropdown(false);
    setShowDateDropdown(false);
    setShowAmountDropdown(false);
    setShowPaymentDropdown(false);
    setShowFilters(false);
  };

  const [currentUser, setCurrentUser] = useState<any>(null);
  const { isAuthenticated } = useAuthSync();
  const { resolvedTheme } = useTheme();
  const { availableCanteens } = useCanteenContext();
  const queryClient = useQueryClient();

  // Status filter options
  const statusOptions = [
    { value: "all", label: "All Orders", icon: Package },
    { value: "pending", label: "Pending", icon: Clock },
    { value: "pending_payment", label: "Payment Pending", icon: Clock },
    { value: "preparing", label: "Preparing", icon: Package },
    { value: "ready", label: "Ready", icon: CheckCircle },
    { value: "completed", label: "Completed", icon: CheckCircle },
    { value: "delivered", label: "Delivered", icon: CheckCircle },
    { value: "cancelled", label: "Cancelled", icon: X }
  ];

  // Date range filter options
  const dateRangeOptions = [
    { value: "all", label: "All Time", icon: Calendar },
    { value: "today", label: "Today", icon: Calendar },
    { value: "last7days", label: "Last 7 Days", icon: Calendar },
    { value: "month", label: "This Month", icon: Calendar },
    { value: "last30days", label: "Last 30 Days", icon: Calendar }
  ];

  // Amount range filter options
  const amountRangeOptions = [
    { value: "all", label: "All Amounts", icon: DollarSign },
    { value: "under100", label: "Under ₹100", icon: DollarSign },
    { value: "100-300", label: "₹100 - ₹300", icon: DollarSign },
    { value: "300-500", label: "₹300 - ₹500", icon: DollarSign },
    { value: "above500", label: "Above ₹500", icon: DollarSign }
  ];

  // Payment status filter options
  const paymentStatusOptions = [
    { value: "all", label: "All Payments", icon: CreditCard },
    { value: "paid", label: "Paid", icon: CheckCircle },
    { value: "pending", label: "Pending", icon: Clock },
    { value: "failed", label: "Failed", icon: X }
  ];

  // Canteen filter options
  const canteenOptions = [
    { value: "all", label: "All Canteens", icon: MapPin },
    ...availableCanteens.map(canteen => ({
      value: canteen.id,
      label: canteen.name,
      icon: MapPin
    }))
  ];
  
  // Debug canteen data
  console.log('🏪 OrdersPage - Available canteens:', availableCanteens);

  // Enhanced security check for authenticated users only
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, setLocation]);

  // Get current user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Close filter panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (canteenDropdownRef.current && !canteenDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false);
        setShowCanteenDropdown(false);
        setShowDateDropdown(false);
        setShowAmountDropdown(false);
        setShowPaymentDropdown(false);
      }
    };

    if (showFilters || showCanteenDropdown || showDateDropdown || showAmountDropdown || showPaymentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters, showCanteenDropdown, showDateDropdown, showAmountDropdown, showPaymentDropdown]);

  // Fetch real orders from database
  const { data: allOrders = [], isLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: true, // Explicitly enable the query
    refetchOnWindowFocus: false,
    refetchInterval: false, // Disable polling - using WebSocket for real-time updates
    retry: 3,
  });

  // Get unique canteen IDs from user's orders for multi-room subscription
  const userCanteenIds = Array.from(new Set(
    allOrders
      .filter((order: Order) => order.canteenId)
      .map((order: Order) => order.canteenId)
  )).filter(Boolean) as string[];

  // Real-time order updates via WebSocket for user orders list - Multi-canteen support
  useWebSocket({
    canteenIds: userCanteenIds, // Join all canteen rooms where user has orders
    enabled: isAuthenticated && userCanteenIds.length > 0,
    onOrderUpdate: (order) => {
      console.log("🔄 User orders list received order update, refreshing...");
      refetch();
    },
    onOrderStatusChange: (order, oldStatus, newStatus) => {
      console.log(`🔄 User orders list - order status changed: ${oldStatus} → ${newStatus}`);
      refetch();
    },
    onNewOrder: (order) => {
      console.log("📦 User orders list - new order received");
      refetch();
    },
    onConnected: () => {
      console.log("✅ User orders list WebSocket connected to canteens:", userCanteenIds);
    },
    onDisconnected: () => {
      console.log("❌ User orders list WebSocket disconnected");
    },
    onError: (error) => {
      console.error("❌ User orders list WebSocket error:", error);
    }
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel order');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      console.log('✅ Order cancelled successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to cancel order:', error);
      alert(`Failed to cancel order: ${error.message}`);
    }
  });

  // Helper function to check if order can be cancelled
  const canCancelOrder = (order: Order) => {
    const status = order.status?.toLowerCase();
    // Can only cancel orders that are pending or preparing
    // Exclude completed, delivered, cancelled, and ready orders
    const nonCancellableStatuses = ['completed', 'delivered', 'cancelled', 'ready'];
    if (!status || nonCancellableStatuses.includes(status)) {
      return false;
    }
    return status === 'pending' || status === 'preparing' || status === 'pending_payment';
  };

  // Handle order cancellation
  const handleCancelOrder = (order: Order) => {
    if (window.confirm(`Are you sure you want to cancel order #${order.orderNumber}? This action cannot be undone.`)) {
      cancelOrderMutation.mutate(order.id);
    }
  };

  // Filter orders to show only current user's orders
  const userOrders = allOrders.filter((order: Order) => {
    if (!currentUser) return false;
    
    // Primary match: customer ID
    if (order.customerId === currentUser.id) {
      return true;
    }
    
    // Secondary match: customer name matches user name from profile
    if (currentUser.name && order.customerName === currentUser.name) {
      return true;
    }
    
    // Tertiary match: partial name matching (case insensitive)
    if (currentUser.name && order.customerName?.toLowerCase().includes(currentUser.name.toLowerCase())) {
      return true;
    }
    
    return false;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
      case 'pending_payment': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200';
      case 'preparing': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200';
      case 'ready': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
      case 'completed': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
      case 'delivered': return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': 
      case 'pending_payment': return <Clock className="w-4 h-4" />;
      case 'preparing': return <Package className="w-4 h-4" />;
      case 'ready': 
      case 'completed':
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Date filtering helper
  const isDateInRange = (orderDate: Date, range: string) => {
    const now = new Date();
    const order = new Date(orderDate);
    
    // Set time to start of day for accurate date comparison
    const orderStartOfDay = new Date(order.getFullYear(), order.getMonth(), order.getDate());
    const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case 'today':
        return orderStartOfDay.getTime() === nowStartOfDay.getTime();
      case 'last7days':
        const last7Days = new Date(nowStartOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderStartOfDay >= last7Days;
      case 'month':
        const monthAgo = new Date(nowStartOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderStartOfDay >= monthAgo;
      case 'last30days':
        const last30Days = new Date(nowStartOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderStartOfDay >= last30Days;
      default:
        return true;
    }
  };

  // Amount filtering helper
  const isAmountInRange = (amount: number, range: string) => {
    switch (range) {
      case 'under100':
        return amount < 100;
      case '100-300':
        return amount >= 100 && amount <= 300;
      case '300-500':
        return amount >= 300 && amount <= 500;
      case 'above500':
        return amount > 500;
      default:
        return true;
    }
  };

  const filteredOrders = userOrders.filter(order => {
    // Search filter - matches order number or ID
    const matchesSearch = !searchTerm || (order.orderNumber || order.id.toString()).toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter - case-insensitive comparison, handles pending_payment
    const orderStatus = order.status?.toLowerCase() || '';
    let matchesStatus = true;
    if (filterStatus !== "all") {
      if (filterStatus === "pending_payment") {
        matchesStatus = orderStatus === "pending_payment";
      } else {
        matchesStatus = orderStatus === filterStatus.toLowerCase();
      }
    }
    
    // Canteen filter
    const matchesCanteen = filterCanteen === "all" || order.canteenId === filterCanteen;
    
    // Date range filter
    const matchesDateRange = filterDateRange === "all" || isDateInRange(order.createdAt, filterDateRange);
    
    // Amount range filter
    const matchesAmountRange = filterAmountRange === "all" || isAmountInRange(order.amount, filterAmountRange);
    
    // Payment status filter - case-insensitive, handles undefined/null payment status
    let matchesPaymentStatus = true;
    if (filterPaymentStatus !== "all") {
      const orderPaymentStatus = (order as any).paymentStatus?.toLowerCase() || '';
      switch (filterPaymentStatus.toLowerCase()) {
        case 'paid':
          matchesPaymentStatus = orderPaymentStatus === 'paid';
          break;
        case 'pending':
          matchesPaymentStatus = !orderPaymentStatus || orderPaymentStatus === 'pending';
          break;
        case 'failed':
          matchesPaymentStatus = orderPaymentStatus === 'failed';
          break;
        default:
          matchesPaymentStatus = true;
      }
    }
    
    return matchesSearch && matchesStatus && matchesCanteen && matchesDateRange && matchesAmountRange && matchesPaymentStatus;
  });

  if (isLoading) {
    return (
      <div className={`min-h-screen ${
        'bg-background'
      }`}>
        <div className="bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                // Dispatch custom event to navigate back using history
                window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
                setLocation("/app");
              }}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">My Orders</h1>
            </div>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <BottomNavigation currentPage="profile" />
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen ${
        'bg-background'
      }`}>
        {/* Header */}
        <div className="bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  // Dispatch custom event to navigate back using history
                  window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
                  setLocation("/app");
                }}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">My Orders</h1>
                <p className="text-white/80 text-sm">
                  {userOrders.length > 0 ? `${userOrders.length} orders found` : "No orders yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4 mt-6 pb-28">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, date, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-12 h-14 rounded-2xl shadow-md bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdown Button */}
          <div className="relative" ref={canteenDropdownRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full h-14 pl-4 pr-4 rounded-2xl shadow-md flex items-center justify-between cursor-pointer transition-colors ${
                resolvedTheme === 'dark' 
                  ? 'bg-[#2a2a2a] border border-gray-700 text-white hover:bg-[#333333]' 
                  : 'bg-gray-100 border border-gray-300 text-gray-900 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <SlidersHorizontal className={`w-5 h-5 ${
                  resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                }`} />
                <span className={`font-medium ${
                  resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Filters
                  {getActiveFilterCount() > 0 && (
                    <span className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded-full">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 ${
                resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
              } transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Filter Panel */}
            {showFilters && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl shadow-xl border backdrop-blur-sm overflow-hidden">
                <div className={`p-4 ${
                  resolvedTheme === 'dark' 
                    ? 'bg-[#2a2a2a]/95 border-gray-700' 
                    : 'bg-white/95 border-gray-300'
                }`}>
                  {/* Compact Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-base font-bold ${
                      resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Quick Filters</h3>
                    {getActiveFilterCount() > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          resolvedTheme === 'dark' 
                            ? 'text-gray-300 hover:text-white bg-[#333333] hover:bg-[#404040]'
                            : 'text-gray-600 hover:text-gray-900 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Horizontal Compact Layout */}
                  <div className="space-y-4">
                    {/* Status Filter - Horizontal Pills */}
                    <div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-4">
                        {statusOptions.map((option, index) => {
                          const IconComponent = option.icon;
                          const isSelected = filterStatus === option.value;
                          
                          return (
                            <button
                              key={option.value}
                              onClick={() => setFilterStatus(option.value)}
                              className={`flex items-center space-x-1 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                                isSelected
                                  ? 'bg-red-600 text-white'
                                  : resolvedTheme === 'dark'
                                    ? 'bg-[#333333] text-white hover:bg-[#404040]'
                                    : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
                              }`}
                            >
                              <IconComponent className="w-3 h-3" />
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date Range Filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowDateDropdown(!showDateDropdown)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors overflow-hidden ${
                          filterDateRange === "all" 
                            ? resolvedTheme === 'dark'
                              ? 'bg-[#333333] text-white'
                              : 'bg-gray-200 text-gray-900'
                            : resolvedTheme === 'dark'
                              ? 'hover:bg-[#333333]/50 text-white hover:text-white'
                              : 'hover:bg-gray-200 text-gray-900 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">
                            {filterDateRange === "all" 
                              ? "All Time" 
                              : dateRangeOptions.find(d => d.value === filterDateRange)?.label || "All Time"
                            }
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 ${
                          resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        } transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDateDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl border backdrop-blur-sm overflow-hidden">
                          <div className={`space-y-2 p-4 ${
                            resolvedTheme === 'dark' 
                              ? 'bg-[#2a2a2a]/95 border-gray-700' 
                              : 'bg-white/95 border-gray-300'
                          }`}>
                            {dateRangeOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setFilterDateRange(option.value);
                                  setShowDateDropdown(false);
                                }}
                                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${
                                  filterDateRange === option.value 
                                    ? resolvedTheme === 'dark'
                                      ? 'text-white bg-[#333333]'
                                      : 'text-gray-900 bg-gray-200'
                                    : resolvedTheme === 'dark'
                                      ? 'text-white hover:text-white hover:bg-[#333333]/50'
                                      : 'text-gray-900 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full border ${
                                  filterDateRange === option.value ? 'border-red-500 bg-red-500' : 'border-gray-400'
                                }`} />
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amount Range Filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAmountDropdown(!showAmountDropdown)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors overflow-hidden ${
                          filterAmountRange === "all" 
                            ? resolvedTheme === 'dark'
                              ? 'bg-[#333333] text-white'
                              : 'bg-gray-200 text-gray-900'
                            : resolvedTheme === 'dark'
                              ? 'hover:bg-[#333333]/50 text-white hover:text-white'
                              : 'hover:bg-gray-200 text-gray-900 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">
                            {filterAmountRange === "all" 
                              ? "All Amounts" 
                              : amountRangeOptions.find(a => a.value === filterAmountRange)?.label || "All Amounts"
                            }
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 ${
                          resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        } transition-transform ${showAmountDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showAmountDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl border backdrop-blur-sm overflow-hidden">
                          <div className={`space-y-2 p-4 ${
                            resolvedTheme === 'dark' 
                              ? 'bg-[#2a2a2a]/95 border-gray-700' 
                              : 'bg-white/95 border-gray-300'
                          }`}>
                            {amountRangeOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setFilterAmountRange(option.value);
                                  setShowAmountDropdown(false);
                                }}
                                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${
                                  filterAmountRange === option.value 
                                    ? resolvedTheme === 'dark'
                                      ? 'text-white bg-[#333333]'
                                      : 'text-gray-900 bg-gray-200'
                                    : resolvedTheme === 'dark'
                                      ? 'text-white hover:text-white hover:bg-[#333333]/50'
                                      : 'text-gray-900 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full border ${
                                  filterAmountRange === option.value ? 'border-red-500 bg-red-500' : 'border-gray-400'
                                }`} />
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Status Filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors overflow-hidden ${
                          filterPaymentStatus === "all" 
                            ? resolvedTheme === 'dark'
                              ? 'bg-[#333333] text-white'
                              : 'bg-gray-200 text-gray-900'
                            : resolvedTheme === 'dark'
                              ? 'hover:bg-[#333333]/50 text-white hover:text-white'
                              : 'hover:bg-gray-200 text-gray-900 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4" />
                          <span className="font-medium">
                            {filterPaymentStatus === "all" 
                              ? "All Payments" 
                              : paymentStatusOptions.find(p => p.value === filterPaymentStatus)?.label || "All Payments"
                            }
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 ${
                          resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        } transition-transform ${showPaymentDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showPaymentDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl border backdrop-blur-sm overflow-hidden">
                          <div className={`space-y-2 p-4 ${
                            resolvedTheme === 'dark' 
                              ? 'bg-[#2a2a2a]/95 border-gray-700' 
                              : 'bg-white/95 border-gray-300'
                          }`}>
                            {paymentStatusOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setFilterPaymentStatus(option.value);
                                  setShowPaymentDropdown(false);
                                }}
                                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${
                                  filterPaymentStatus === option.value 
                                    ? resolvedTheme === 'dark'
                                      ? 'text-white bg-[#333333]'
                                      : 'text-gray-900 bg-gray-200'
                                    : resolvedTheme === 'dark'
                                      ? 'text-white hover:text-white hover:bg-[#333333]/50'
                                      : 'text-gray-900 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full border ${
                                  filterPaymentStatus === option.value ? 'border-red-500 bg-red-500' : 'border-gray-400'
                                }`} />
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Canteen Filter - Compact Dropdown */}
                    {availableCanteens.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowCanteenDropdown(!showCanteenDropdown)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors overflow-hidden ${
                            filterCanteen === "all" 
                              ? resolvedTheme === 'dark'
                                ? 'bg-[#333333] text-white'
                                : 'bg-gray-200 text-gray-900'
                              : resolvedTheme === 'dark'
                                ? 'hover:bg-[#333333]/50 text-white hover:text-white'
                                : 'hover:bg-gray-200 text-gray-900 hover:text-gray-900'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span className="font-medium">
                              {filterCanteen === "all" 
                                ? "All Canteens" 
                                : availableCanteens.find(c => c.id === filterCanteen)?.name || "All Canteens"
                              }
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 ${
                            resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                          } transition-transform ${showCanteenDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Compact Canteen Options */}
                        {showCanteenDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-lg shadow-xl border backdrop-blur-sm overflow-hidden">
                            <div className={`space-y-2 p-4 ${
                              resolvedTheme === 'dark' 
                                ? 'bg-[#2a2a2a]/95 border-gray-700' 
                                : 'bg-white/95 border-gray-300'
                            }`}>
                              <button
                                onClick={() => {
                                  setFilterCanteen("all");
                                  setShowCanteenDropdown(false);
                                }}
                                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${
                                  filterCanteen === "all" 
                                    ? resolvedTheme === 'dark'
                                      ? 'text-white bg-[#333333]'
                                      : 'text-gray-900 bg-gray-200'
                                    : resolvedTheme === 'dark'
                                      ? 'text-white hover:text-white hover:bg-[#333333]/50'
                                      : 'text-gray-900 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full border ${
                                  filterCanteen === "all" ? 'border-red-500 bg-red-500' : 'border-gray-400'
                                }`} />
                                <span>All Canteens</span>
                              </button>
                              {availableCanteens.map((canteen) => (
                                <button
                                  key={canteen.id}
                                  onClick={() => {
                                    setFilterCanteen(canteen.id);
                                    setShowCanteenDropdown(false);
                                  }}
                                  className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${
                                    filterCanteen === canteen.id 
                                      ? resolvedTheme === 'dark'
                                        ? 'text-white bg-[#333333]'
                                        : 'text-gray-900 bg-gray-200'
                                      : resolvedTheme === 'dark'
                                        ? 'text-white hover:text-white hover:bg-[#333333]/50'
                                        : 'text-gray-900 hover:text-gray-900 hover:bg-gray-200'
                                  }`}
                                >
                                  <div className={`w-3 h-3 rounded-full border ${
                                    filterCanteen === canteen.id ? 'border-red-500 bg-red-500' : 'border-gray-400'
                                  }`} />
                                  <span>{canteen.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <Receipt className={`w-8 h-8 ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {userOrders.length === 0 ? "No orders yet" : "No orders found"}
              </h3>
              <p className={`mb-4 ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {userOrders.length === 0 
                  ? "Start ordering delicious food from our menu!"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
              <Button onClick={() => {
                // Navigate to /app first, then dispatch event to switch to menu view
                setLocation("/app");
                // Use setTimeout to ensure navigation happens before event dispatch
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                    detail: { category: 'all' }
                  }));
                }, 100);
              }}>
                Browse Menu
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  onClick={() => setLocation(`/order-status/${order.orderNumber || order.barcode || order.id}?from=orders`)}
                  className={`hover:shadow-md transition-all duration-200 cursor-pointer ${
                    resolvedTheme === 'dark' 
                      ? 'bg-[#1e1e1e] border border-gray-700 shadow-lg' 
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Header Section: Order ID and Status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-base font-bold mb-1 ${
                          resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          Order #{order.orderNumber || order.id}
                        </h3>
                        <p className={`text-xs ${
                          resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })} at {new Date(order.createdAt).toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.status || 'pending')} px-4 py-1 ml-2 shrink-0`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(order.status || 'pending')}
                          <span className="capitalize text-xs font-medium whitespace-nowrap">
                            {order.status === 'pending_payment' ? 'Payment Pending' : (order.status || 'Pending').replace('_', ' ')}
                          </span>
                        </div>
                      </Badge>
                    </div>

                    {/* Amount and Payment Info Section - Compact Layout */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className={`text-lg font-bold ${
                            resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            ₹{order.amount}
                          </p>
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded ${
                          resolvedTheme === 'dark' 
                            ? 'bg-gray-800/50 text-gray-300' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          <CreditCard className="w-3 h-3 mr-1" />
                          <span className="text-xs">
                            {(order as any).paymentStatus ? String((order as any).paymentStatus).charAt(0).toUpperCase() + String((order as any).paymentStatus).slice(1) : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Section - Compact */}
                    <div className={`flex gap-2 ${
                      canCancelOrder(order) ? '' : 'justify-end'
                    }`}>
                      {canCancelOrder(order) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelOrder(order);
                          }}
                          disabled={cancelOrderMutation.isPending}
                          className={`flex-1 ${
                            resolvedTheme === 'dark' 
                              ? 'border-red-600 bg-red-900/20 text-red-300 hover:bg-red-800/40 hover:text-red-200' 
                              : 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800'
                          }`}
                        >
                          {cancelOrderMutation.isPending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              <span className="text-xs">Cancel</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 mr-1.5" />
                              <span className="text-xs">Cancel</span>
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/order-status/${order.orderNumber || order.barcode || order.id}?from=orders`);
                        }}
                        className={`flex-1 ${
                          resolvedTheme === 'dark' 
                            ? 'border-gray-600 bg-gray-800/50 text-gray-200 hover:bg-gray-700/60 hover:text-white' 
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1.5" />
                        <span className="text-xs">View Details</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <BottomNavigation currentPage="profile" />
    </>
  );
}
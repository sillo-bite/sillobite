import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuthSync } from "@/hooks/useDataSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Clock, CheckCircle, Package, Loader2, Receipt, X, SlidersHorizontal, ChevronDown, MapPin, Calendar, DollarSign, CreditCard, Filter, XCircle } from "lucide-react";
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
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<"running" | "past">("running");
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
    enabled: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
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
    canteenIds: userCanteenIds,
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

  // Filter orders to show only current user's orders
  const userOrders = allOrders.filter((order: Order) => {
    if (!currentUser) return false;
    if (order.customerId === currentUser.id) return true;
    if (currentUser.name && order.customerName === currentUser.name) return true;
    if (currentUser.name && order.customerName?.toLowerCase().includes(currentUser.name.toLowerCase())) return true;
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

  // Helper to parse first item from order
  const getFirstItem = (order: Order) => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items) && items.length > 0) {
        return items[0];
      }
    } catch (e) { }
    return null;
  };

  // Helper to count items in order
  const getItemCount = (order: Order) => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items)) {
        return items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      }
    } catch (e) { }
    return 0;
  };

  // Running statuses
  const runningStatuses = ['pending', 'pending_payment', 'preparing', 'ready', 'out_for_delivery'];
  const pastStatuses = ['completed', 'delivered', 'cancelled'];

  const filteredOrders = userOrders.filter(order => {
    // Tab filter
    const orderStatus = order.status?.toLowerCase() || '';
    if (activeTab === "running" && !runningStatuses.includes(orderStatus)) return false;
    if (activeTab === "past" && !pastStatuses.includes(orderStatus)) return false;

    // Search filter
    const firstItem = getFirstItem(order);
    const matchesSearch = !searchTerm ||
      (order.orderNumber || order.id.toString()).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (firstItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
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

    // Payment status filter
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

  // Sort orders by date (newest first)
  const sortedOrders = [...filteredOrders].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-8 pb-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
              }}
              className={`${resolvedTheme === 'dark' ? 'text-white' : 'text-black'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className={`text-xl font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-black'}`}>My order</h1>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#9847D1]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="px-4 pt-8 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                }}
                className={`${resolvedTheme === 'dark' ? 'text-white' : 'text-black'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className={`text-xl font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-black'}`}>My order</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Icon */}
              <button
                onClick={() => {
                  setShowFilters(!showFilters);
                  if (!showFilters) setShowSearch(false);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${showFilters
                  ? 'bg-[#9847D1] text-white'
                  : resolvedTheme === 'dark'
                    ? 'text-white hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <div className="relative">
                  <SlidersHorizontal className="w-5 h-5" />
                  {getActiveFilterCount() > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-[#9847D1] text-white rounded-full border-2 border-background">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </div>
              </button>
              {/* Search Icon */}
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setShowFilters(false);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${showSearch
                  ? 'bg-[#9847D1] text-white'
                  : resolvedTheme === 'dark'
                    ? 'text-white hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Search Bar */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showSearch ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-11 pr-10 h-12 rounded-2xl border-2 ${resolvedTheme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'} text-foreground placeholder:text-muted-foreground focus:border-[#9847D1] transition-colors`}
                autoFocus={showSearch}
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0'}`} ref={canteenDropdownRef}>
          <div className={`mx-4 mb-3 rounded-2xl shadow-lg border ${resolvedTheme === 'dark' ? 'bg-[#1f1429]/95 border-gray-700' : 'bg-white/95 border-gray-200'}`}>
            <div className="p-4 pb-5 max-h-[60vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quick Filters</h3>
                {getActiveFilterCount() > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${resolvedTheme === 'dark'
                      ? 'text-gray-300 hover:text-white bg-[#333333] hover:bg-[#404040]'
                      : 'text-gray-600 hover:text-gray-900 bg-gray-200 hover:bg-gray-300'
                      }`}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Status Filter */}
                <div>
                  <label className={`text-xs font-medium mb-2 block ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Order Status</label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent">
                    {statusOptions.map((option) => {
                      const IconComponent = option.icon;
                      const isSelected = filterStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setFilterStatus(option.value)}
                          className={`flex items-center space-x-1 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${isSelected
                            ? 'bg-[#9847D1] text-white'
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
                <div>
                  <label className={`text-xs font-medium mb-2 block ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Date Range</label>
                  <button
                    onClick={() => {
                      setShowDateDropdown(!showDateDropdown);
                      setShowAmountDropdown(false);
                      setShowPaymentDropdown(false);
                      setShowCanteenDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${resolvedTheme === 'dark'
                      ? 'bg-[#333333] text-white hover:bg-[#404040]'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">
                        {filterDateRange === "all" ? "All Time" : dateRangeOptions.find(d => d.value === filterDateRange)?.label || "All Time"}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showDateDropdown && (
                    <div className={`mt-2 space-y-1 px-2`}>
                      {dateRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setFilterDateRange(option.value);
                            setShowDateDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${filterDateRange === option.value
                            ? 'bg-[#9847D1] text-white'
                            : resolvedTheme === 'dark' ? 'hover:bg-[#404040] text-white' : 'hover:bg-gray-300 text-gray-900'
                            }`}
                        >
                          <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterDateRange === option.value ? 'border-white bg-white' : 'border-gray-400'}`} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount Range Filter */}
                <div>
                  <label className={`text-xs font-medium mb-2 block ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Amount Range</label>
                  <button
                    onClick={() => {
                      setShowAmountDropdown(!showAmountDropdown);
                      setShowDateDropdown(false);
                      setShowPaymentDropdown(false);
                      setShowCanteenDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${resolvedTheme === 'dark'
                      ? 'bg-[#333333] text-white hover:bg-[#404040]'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                  >
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-medium">
                        {filterAmountRange === "all" ? "All Amounts" : amountRangeOptions.find(a => a.value === filterAmountRange)?.label || "All Amounts"}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAmountDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showAmountDropdown && (
                    <div className={`mt-2 space-y-1 px-2`}>
                      {amountRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setFilterAmountRange(option.value);
                            setShowAmountDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${filterAmountRange === option.value
                            ? 'bg-[#9847D1] text-white'
                            : resolvedTheme === 'dark' ? 'hover:bg-[#404040] text-white' : 'hover:bg-gray-300 text-gray-900'
                            }`}
                        >
                          <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterAmountRange === option.value ? 'border-white bg-white' : 'border-gray-400'}`} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className={`text-xs font-medium mb-2 block ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Payment Status</label>
                  <button
                    onClick={() => {
                      setShowPaymentDropdown(!showPaymentDropdown);
                      setShowDateDropdown(false);
                      setShowAmountDropdown(false);
                      setShowCanteenDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${resolvedTheme === 'dark'
                      ? 'bg-[#333333] text-white hover:bg-[#404040]'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                  >
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4" />
                      <span className="font-medium">
                        {filterPaymentStatus === "all" ? "All Payments" : paymentStatusOptions.find(p => p.value === filterPaymentStatus)?.label || "All Payments"}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showPaymentDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showPaymentDropdown && (
                    <div className={`mt-2 space-y-1 px-2`}>
                      {paymentStatusOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setFilterPaymentStatus(option.value);
                            setShowPaymentDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${filterPaymentStatus === option.value
                            ? 'bg-[#9847D1] text-white'
                            : resolvedTheme === 'dark' ? 'hover:bg-[#404040] text-white' : 'hover:bg-gray-300 text-gray-900'
                            }`}
                        >
                          <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterPaymentStatus === option.value ? 'border-white bg-white' : 'border-gray-400'}`} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Canteen Filter */}
                {availableCanteens.length > 0 && (
                  <div>
                    <label className={`text-xs font-medium mb-2 block ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Canteen</label>
                    <button
                      onClick={() => {
                        setShowCanteenDropdown(!showCanteenDropdown);
                        setShowDateDropdown(false);
                        setShowAmountDropdown(false);
                        setShowPaymentDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${resolvedTheme === 'dark'
                        ? 'bg-[#333333] text-white hover:bg-[#404040]'
                        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                        }`}
                    >
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">
                          {filterCanteen === "all" ? "All Canteens" : availableCanteens.find(c => c.id === filterCanteen)?.name || "All Canteens"}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showCanteenDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showCanteenDropdown && (
                      <div className={`mt-2 space-y-1 px-2`}>
                        <button
                          onClick={() => {
                            setFilterCanteen("all");
                            setShowCanteenDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${filterCanteen === "all"
                            ? 'bg-[#9847D1] text-white'
                            : resolvedTheme === 'dark' ? 'hover:bg-[#404040] text-white' : 'hover:bg-gray-300 text-gray-900'
                            }`}
                        >
                          <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterCanteen === "all" ? 'border-white bg-white' : 'border-gray-400'}`} />
                          <span>All Canteens</span>
                        </button>
                        {availableCanteens.map((canteen) => (
                          <button
                            key={canteen.id}
                            onClick={() => {
                              setFilterCanteen(canteen.id);
                              setShowCanteenDropdown(false);
                            }}
                            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg ${filterCanteen === canteen.id
                              ? 'bg-[#9847D1] text-white'
                              : resolvedTheme === 'dark' ? 'hover:bg-[#404040] text-white' : 'hover:bg-gray-300 text-gray-900'
                              }`}
                          >
                            <div className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterCanteen === canteen.id ? 'border-white bg-white' : 'border-gray-400'}`} />
                            <span>{canteen.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Running Order / Past Order Tabs */}
        <div className="px-4 pb-4 pt-1">
          <div className={`flex items-center gap-2 rounded-full p-1 ${resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
            <button
              onClick={() => setActiveTab("running")}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === "running"
                ? 'bg-[#9847D1] text-white shadow-md'
                : resolvedTheme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Running Order
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === "past"
                ? 'bg-[#9847D1] text-white shadow-md'
                : resolvedTheme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Past Order
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="px-4 pb-10 space-y-4">
          {sortedOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <Receipt className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                {activeTab === "running" ? "No running orders" : "No past orders"}
              </h3>
              <p className={`mb-4 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {activeTab === "running"
                  ? "You don't have any active orders right now"
                  : "Your order history will appear here"
                }
              </p>
              {activeTab === "running" && (
                <Button
                  onClick={() => {
                    setLocation("/app");
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                        detail: { category: 'all' }
                      }));
                    }, 100);
                  }}
                  className="bg-[#9847D1] hover:bg-[#7e39b0] text-white rounded-full px-6"
                >
                  Browse Menu
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedOrders.map((order) => {
                const firstItem = getFirstItem(order);
                const itemCount = getItemCount(order);
                const orderPlacedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short'
                });
                const orderPlacedTime = `${orderPlacedDate} / ${new Date(order.createdAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}`;

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl overflow-hidden transition-all duration-200 ${resolvedTheme === 'dark'
                      ? 'bg-[#1f1429] border border-gray-700/50 shadow-lg'
                      : 'bg-white border border-gray-100 shadow-md'
                      }`}
                  >
                    {/* Card Content */}
                    <div className="p-5">
                      {/* Top Section: Status Badge & Order Number */}
                      <div className="flex items-center justify-between mb-3">
                        {(() => {
                          const canteen = availableCanteens.find((c: any) => c.id === order.canteenId);
                          const logoSrc = (canteen as any)?.logoUrl || canteen?.imageUrl || null;
                          return (
                            <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 ${resolvedTheme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                              {logoSrc ? (
                                <img
                                  src={logoSrc}
                                  alt={canteen?.name || 'Canteen'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-lg">🏪</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <span className="ml-1">
                          {order.orderNumber && order.orderNumber.length >= 4 ? (
                            <>
                              #<span className="opacity-70 text-base">{order.orderNumber.slice(0, -4)}</span>
                              <span className={`inline-block px-2 py-0.5 rounded-md ${resolvedTheme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'} ml-1 font-black text-xl tracking-wider shadow-sm`}>
                                {order.orderNumber.slice(-4)}
                              </span>
                            </>
                          ) : (
                            order.orderNumber
                          )}
                        </span>
                      </div>

                      {/* Item Image & Name */}
                      <div className="flex flex-col items-center mb-4">
                        {/* Circular Item Image */}
                        <div className={`w-20 h-20 rounded-full overflow-hidden mb-3 border-2 ${resolvedTheme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                          {firstItem?.imageUrl ? (
                            <img
                              src={firstItem.imageUrl}
                              alt={firstItem.name || 'Order item'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${firstItem?.imageUrl ? 'hidden' : ''}`}>
                            <span className="text-2xl">🍽️</span>
                          </div>
                        </div>

                        {/* Item Name */}
                        <h3 className={`text-lg font-bold text-center ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {firstItem?.name || 'Order'}
                        </h3>

                        {/* Price */}
                        <p className="text-xl font-bold text-[#9847D1] mt-1">
                          ₹{order.amount?.toFixed(2)}
                        </p>
                      </div>

                      {/* Items count & Order placed time */}
                      <div className="flex items-center justify-center gap-6 mb-4">
                        <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          Items: {itemCount}
                        </span>
                        <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          Ordered: {orderPlacedTime}
                        </span>
                      </div>

                      {/* Track Order Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/order-status/${order.orderNumber}?from=orders`);
                        }}
                        className="w-full py-3 rounded-full bg-[#9847D1] text-white font-semibold text-sm hover:bg-[#7e39b0] transition-all duration-200 shadow-sm active:scale-[0.98]"
                      >
                        {activeTab === "running" ? "Track Order" : "View Details"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OwnerButton, OwnerBadge } from "@/components/owner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuthSync } from "@/hooks/useDataSync";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatOrderIdDisplay } from "@shared/utils";
import type { Order } from "@shared/schema";

interface PendingPayment {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  items: string; // JSON string
  createdAt: Date;
  canteenId: string;
  status: 'pending_payment';
  estimatedTime: number;
  barcode: string;
}

interface PaymentCounterDashboardProps {
  canteenId: string;
}

export default function PaymentCounterDashboard({ canteenId }: PaymentCounterDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 12;
  
  const { user, isAuthenticated } = useAuthSync();
  const queryClient = useQueryClient();

  // Fetch offline orders with pending payment status - no polling, rely on WebSocket
  const { data: pendingPaymentsData, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/orders', canteenId, 'offline-pending'],
    queryFn: async () => {
      const response = await apiRequest(`/api/orders?canteenId=${canteenId}&isOffline=true&paymentStatus=pending`);
      return response;
    },
    enabled: !!canteenId,
    refetchInterval: false, // No polling - use WebSocket
    staleTime: 1000 * 30, // 30 seconds - reasonable caching for payment data
  });

  const pendingPayments = pendingPaymentsData || [];

  // WebSocket for real-time updates
  const webSocketStatus = useWebSocket({
    canteenIds: [canteenId],
    enabled: true && !!canteenId,
    onNewOrder: (order) => {
      refetch();
    },
    onOrderUpdate: (order) => {
      refetch();
    },
    onConnected: () => {
      // Immediately fetch pending payments when connected
      refetch();
    },
    onDisconnected: () => {
      // WebSocket disconnected
    }
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest(`/api/payments/confirm/${orderId}`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      refetch();
      setShowPaymentDetails(false);
      setSelectedPayment(null);
    },
    onError: (error) => {
      // Error handled by React Query
    }
  });

  // Reject payment mutation
  const rejectPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest(`/api/payments/reject/${paymentId}`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      refetch();
      setShowPaymentDetails(false);
      setSelectedPayment(null);
    },
    onError: (error) => {
      // Error handled by React Query
    }
  });

  // Filter payments based on search and status
  const filteredPayments = pendingPayments.filter(payment => {
    const matchesSearch = payment.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         payment.orderNumber.includes(searchQuery);
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'pending' && payment.status === 'pending_payment');
    
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / cardsPerPage);
  const startIndex = (currentPage - 1) * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const handleConfirmPayment = async (orderId: string) => {
    setIsProcessing(true);
    try {
      await confirmPaymentMutation.mutateAsync(orderId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    setIsProcessing(true);
    try {
      await rejectPaymentMutation.mutateAsync(paymentId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPayment = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setShowPaymentDetails(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending_payment':
        return <OwnerBadge variant="warning" className="flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          Pending Payment
        </OwnerBadge>;
      case 'cancelled':
        return <OwnerBadge variant="danger">Cancelled</OwnerBadge>;
      default:
        return <OwnerBadge variant="default">{status || 'Unknown'}</OwnerBadge>;
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access the payment counter.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body {
          height: 100%;
          overflow: hidden;
        }
      `}</style>
      <div className="h-full flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0 p-4 pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" />
                Payment Counter
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search by customer name or order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 h-9"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="h-9 px-3 text-sm border border-input rounded-md bg-background"
                >
                  <option value="all">All Payments</option>
                  <option value="pending">Pending</option>
                </select>
                <OwnerBadge variant={webSocketStatus.isConnected ? "success" : "warning"} className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {webSocketStatus.isConnected ? 'Connected' : 'Disconnected'}
                </OwnerBadge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0">
            <div className="flex-shrink-0 mb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Pending Payments</h3>
                <OwnerBadge variant="default">{filteredPayments.length} payments</OwnerBadge>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading payments...</p>
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {searchQuery || filterStatus !== 'all' 
                      ? 'No payments match your current filters.'
                      : 'All payments have been processed.'
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className="payments-grid-container flex-1 min-h-0 overflow-y-auto overflow-x-hidden app-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 auto-rows-[180px] gap-2 md:gap-3">
                      {paginatedPayments.map((payment) => (
                        <Card 
                          key={payment.id} 
                          className="h-[180px] cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl border border-border bg-card flex flex-col"
                          onClick={() => handleViewPayment(payment)}
                        >
                          <CardContent className="p-2.5 md:p-3 flex flex-col h-full min-h-0">
                            <div className="flex flex-col h-full justify-between min-h-0">
                              {/* Top Section - Order Info */}
                              <div className="flex-shrink-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium text-sm">
                                    {(() => {
                                      const formatted = formatOrderIdDisplay(payment.orderNumber);
                                      return (
                                        <>
                                          {formatted.prefix}
                                          <span className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary font-bold px-1.5 py-0.5 rounded text-xs ml-1 border border-primary/30 dark:border-primary/50">
                                            {formatted.highlighted}
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </h4>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {getStatusBadge(payment.status)}
                                    <OwnerBadge variant="warning" className="flex items-center gap-0.5">
                                      <CreditCard className="h-3 w-3" />
                                      <span className="hidden sm:inline">Offline</span>
                                    </OwnerBadge>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  Customer: <span className="text-foreground font-medium">{payment.customerName}</span>
                                </p>
                              </div>
                              
                              {/* Bottom Section - Amount and Action Buttons */}
                              <div className="flex-shrink-0 flex items-end justify-between gap-2 mt-2 pt-2 border-t border-border">
                                <p className="text-sm font-semibold text-foreground">₹{payment.amount}</p>
                                <div className="flex-shrink-0 flex items-center gap-1.5">
                                  <OwnerButton
                                    size="sm"
                                    variant="primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmPayment(payment.id);
                                    }}
                                    disabled={isProcessing}
                                    icon={<Check className="w-3 h-3" />}
                                  >
                                    Confirm
                                  </OwnerButton>
                                  <OwnerButton
                                    size="sm"
                                    variant="danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRejectPayment(payment.id);
                                    }}
                                    disabled={isProcessing}
                                    icon={<X className="w-3 h-3" />}
                                  >
                                    Reject
                                  </OwnerButton>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  
                  {/* Pagination Controls - Below Grid */}
                  {totalPages > 1 && (
                    <div className="flex-shrink-0 mt-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Showing {startIndex + 1}-{Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} payments
                        </div>
                        <div className="flex items-center gap-1">
                          <OwnerButton
                            variant="secondary"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                            icon={<ChevronLeft className="w-3 h-3" />}
                          >
                            Prev
                          </OwnerButton>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              return (
                                <OwnerButton
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "primary" : "secondary"}
                                  size="sm"
                                  onClick={() => handlePageClick(pageNum)}
                                  className="h-7 w-7 p-0"
                                >
                                  {pageNum}
                                </OwnerButton>
                              );
                            })}
                          </div>
                          <OwnerButton
                            variant="secondary"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            icon={<ChevronRight className="w-3 h-3" />}
                            iconPosition="right"
                          >
                            Next
                          </OwnerButton>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Details Dialog */}
      <Dialog open={showPaymentDetails} onOpenChange={setShowPaymentDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Order Number</Label>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const formatted = formatOrderIdDisplay(selectedPayment.orderNumber);
                      return (
                        <>
                          <span>#{formatted.prefix}</span>
                          <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-0">{formatted.highlighted}</span>
                        </>
                      );
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                  <p className="text-lg font-semibold">{selectedPayment.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Amount</Label>
                  <p className="text-lg font-semibold">₹{selectedPayment.amount}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Order Items</Label>
                <div className="mt-2 space-y-2">
                  {JSON.parse(selectedPayment.items).map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">₹{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <OwnerButton
                  variant="secondary"
                  onClick={() => setShowPaymentDetails(false)}
                >
                  Close
                </OwnerButton>
                <OwnerButton
                  variant="danger"
                  onClick={() => handleRejectPayment(selectedPayment.id)}
                  disabled={isProcessing}
                  icon={<X className="w-4 h-4" />}
                >
                  Reject Payment
                </OwnerButton>
                <OwnerButton
                  variant="primary"
                  onClick={() => handleConfirmPayment(selectedPayment.id)}
                  disabled={isProcessing}
                  icon={<Check className="w-4 h-4" />}
                >
                  Confirm Payment
                </OwnerButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


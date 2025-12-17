import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Filter, CreditCard, DollarSign, 
  TrendingUp, AlertTriangle, CheckCircle, Clock, 
  RefreshCw, Download, Eye, Loader2, ChevronLeft, ChevronRight
} from "lucide-react";

export default function AdminPaymentManagementPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  // Fetch payments data with pagination and server-side search
  const { data: paymentsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/payments', currentPage, itemsPerPage, debouncedSearchTerm, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });
      return apiRequest(`/api/admin/payments?${params.toString()}`);
    },
  });

  const payments = paymentsData?.payments || [];
  const totalCount = paymentsData?.totalCount || 0;
  const totalPages = paymentsData?.totalPages || 0;
  const hasNextPage = paymentsData?.hasNextPage || false;
  const hasPrevPage = paymentsData?.hasPrevPage || false;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "success": return "bg-green-100 text-green-800 border-green-200";
      case "failed": return "bg-red-100 text-red-800 border-red-200";
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "timeout": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "success": return <CheckCircle className="h-3 w-3" />;
      case "failed": return <AlertTriangle className="h-3 w-3" />;
      case "pending": return <Clock className="h-3 w-3 animate-pulse" />;
      case "timeout": return <RefreshCw className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const stats = {
    totalTransactions: payments.length,
    // Amount is stored in paise, so divide by 100 for rupees
    totalAmount: payments.reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0),
    successRate: payments.length > 0 ? Math.round(((payments.filter((p: any) => p.status === 'success').length / payments.length) * 100)) : 0,
    // Pending amount also needs to be converted from paise to rupees
    pendingAmount: payments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0)
  };

  const handleExportReport = () => {
    // Simulate report generation
    setTimeout(() => {
      const csvContent = [
        ["Payment ID", "Order ID", "User", "Amount", "Method", "Status", "Timestamp", "Transaction ID", "Gateway"],
        ...payments.map((payment: any) => [
          payment.id,
          payment.orderDetails?.orderNumber || 'N/A',
          payment.orderDetails?.customerName || 'Guest',
          payment.formattedAmount,
          payment.paymentMethod || 'N/A',
          payment.status,
          payment.createdAtFormatted,
          payment.merchantTransactionId,
          'Razorpay'
        ])
      ].map(row => row.join(",")).join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      }, 2000);
  };

  const handleViewPayment = (payment: any) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
  };

  const handleRetryPayment = (payment: any) => {
    // In a real app, this would trigger the payment retry process
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/admin")}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
            <p className="text-muted-foreground">Monitor and manage all payment transactions</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTransactions}</p>
                <p className="text-xs text-muted-foreground">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{stats.pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Pending Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, order ID, or transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading payments...</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment transactions found.
              </div>
            ) : (
              payments.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {payment.orderDetails?.customerName || 'Guest User'}
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Txn: {payment.merchantTransactionId}</span>
                        <span>•</span>
                        <span>{payment.paymentMethod || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="font-semibold text-lg">{payment.formattedAmount}</p>
                    <p className="text-xs text-muted-foreground">Razorpay</p>
                  </div>
                  
                  <div className="text-center">
                    <Badge className={`${getStatusColor(payment.status)} mb-1 border`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(payment.status)}
                        <span className="capitalize">{payment.status}</span>
                      </div>
                    </Badge>
                    <p className="text-xs text-muted-foreground">{payment.createdAtFormatted}</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewPayment(payment)}
                      title="View payment details"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {payment.status === "failed" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRetryPayment(payment)}
                        title="Retry failed payment"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center text-sm text-muted-foreground">
                <span>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} payments</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!hasPrevPage}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
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
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!hasNextPage}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <span>Payment Details</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment ID</p>
                  <p className="text-sm font-mono">{selectedPayment.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Order Number</p>
                  <p className="text-sm font-mono">{selectedPayment.orderDetails?.orderNumber || 'N/A'}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Customer</p>
                <p className="text-sm">{selectedPayment.orderDetails?.customerName || 'Guest User'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold text-green-600">{selectedPayment.formattedAmount}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={`${getStatusColor(selectedPayment.status)} border`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(selectedPayment.status)}
                      <span className="capitalize">{selectedPayment.status}</span>
                    </div>
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                  <p className="text-sm">{selectedPayment.paymentMethod || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gateway</p>
                  <p className="text-sm">Razorpay</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Merchant Transaction ID</p>
                <p className="text-sm font-mono bg-muted p-2 rounded text-xs break-all">{selectedPayment.merchantTransactionId}</p>
              </div>

              {selectedPayment.razorpayTransactionId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Razorpay Transaction ID</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded text-xs break-all">{selectedPayment.razorpayTransactionId}</p>
                </div>
              )}
              {selectedPayment.phonePeTransactionId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PhonePe Transaction ID (Legacy)</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded text-xs break-all">{selectedPayment.phonePeTransactionId}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created At</p>
                  <p className="text-sm">{selectedPayment.createdAtFormatted}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updated At</p>
                  <p className="text-sm">{selectedPayment.updatedAtFormatted}</p>
                </div>
              </div>

              {selectedPayment.responseCode && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Response Code</p>
                  <p className="text-sm">{selectedPayment.responseCode}</p>
                </div>
              )}

              {selectedPayment.responseMessage && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Response Message</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedPayment.responseMessage}</p>
                </div>
              )}

              {selectedPayment.metadata && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Order Items</p>
                  <div className="text-sm bg-muted p-2 rounded max-h-24 overflow-y-auto">
                    {selectedPayment.metadata.items && JSON.parse(selectedPayment.metadata.items).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.name} x {item.quantity}</span>
                        <span>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPayment.status === "failed" && (
                <div className="pt-4">
                  <Button 
                    onClick={() => {
                      handleRetryPayment(selectedPayment);
                      setIsModalOpen(false);
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Payment
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCcw,
  Eye,
  Calendar,
  FileText,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { useAuthSync } from "@/hooks/useDataSync";

export default function PayoutRequestManagementPage() {
  const { user } = useAuthSync();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all payout requests
  const { data: requestsData, isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: [`/api/admin/payout/requests`, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      return apiRequest(`/api/admin/payout/requests?${params.toString()}`);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all settlements
  const { data: settlementsData, isLoading: settlementsLoading, refetch: refetchSettlements } = useQuery({
    queryKey: [`/api/admin/payout/settlements`],
    queryFn: async () => {
      return apiRequest(`/api/admin/payout/settlements`);
    },
  });

  const requests = requestsData?.requests || [];
  const settlements = settlementsData?.settlements || [];

  // Filter requests by search query
  const filteredRequests = requests.filter((req: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.requestId.toLowerCase().includes(query) ||
      req.canteenId.toLowerCase().includes(query) ||
      req.amountInRupees.toString().includes(query)
    );
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { requestId: string; notes?: string }) => {
      return apiRequest(`/api/admin/payout/requests/${data.requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedBy: user?.id,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payout`] });
      setShowApproveDialog(false);
      refetchRequests();
    },
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async (data: { requestId: string; rejectionReason: string; notes?: string }) => {
      return apiRequest(`/api/admin/payout/requests/${data.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectedBy: user?.id,
          rejectionReason: data.rejectionReason,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payout`] });
      setShowRejectDialog(false);
      refetchRequests();
    },
  });

  // Process request mutation
  const processMutation = useMutation({
    mutationFn: async (data: { requestId: string; transactionId?: string; notes?: string }) => {
      return apiRequest(`/api/admin/payout/requests/${data.requestId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processedBy: user?.id,
          transactionId: data.transactionId,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payout`] });
      setShowProcessDialog(false);
      refetchRequests();
      refetchSettlements();
    },
  });

  // Complete settlement mutation
  const completeMutation = useMutation({
    mutationFn: async (data: { settlementId: string; transactionId?: string; notes?: string }) => {
      return apiRequest(`/api/admin/payout/settlements/${data.settlementId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processedBy: user?.id,
          transactionId: data.transactionId,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payout`] });
      setShowCompleteDialog(false);
      refetchSettlements();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/20 text-success border-success/40 dark:bg-success/30 dark:text-success dark:border-success/50">Completed</Badge>;
      case "processing":
        return <Badge className="bg-primary/20 text-primary border-primary/40 dark:bg-primary/30 dark:text-primary dark:border-primary/50">Processing</Badge>;
      case "approved":
        return <Badge className="bg-success/20 text-success border-success/40 dark:bg-success/30 dark:text-success dark:border-success/50">Approved</Badge>;
      case "pending":
        return <Badge className="bg-warning/20 text-warning border-warning/40 dark:bg-warning/30 dark:text-warning dark:border-warning/50">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/40 dark:bg-destructive/30 dark:text-destructive dark:border-destructive/50">Rejected</Badge>;
      case "failed":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/40 dark:bg-destructive/30 dark:text-destructive dark:border-destructive/50">Failed</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const safeFormatDate = (date: Date | string | undefined | null, formatStr: string) => {
    if (!date) return "N/A";
    try {
      let dateObj: Date;
      if (typeof date === "string") {
        // Handle empty strings
        if (date.trim() === "") return "N/A";
        // Check if it looks like a date string (not a file path or chunk reference)
        if (date.includes("chunk-") || date.includes(".js") || date.includes("?v=")) {
          console.warn("Invalid date string detected (looks like a file path):", date);
          return "N/A";
        }
        dateObj = new Date(date);
      } else {
        dateObj = date;
      }

      // Check if date is valid
      if (!dateObj || isNaN(dateObj.getTime())) {
        return "N/A";
      }

      // Additional check: ensure date is within reasonable range
      const year = dateObj.getFullYear();
      if (year < 1900 || year > 2100) {
        return "N/A";
      }

      return format(dateObj, formatStr);
    } catch (error) {
      console.warn("Date formatting error:", error, "Date value:", date);
      return "N/A";
    }
  };

  const isValidTransactionId = (txnId: string | undefined | null): boolean => {
    if (!txnId) return false;
    // Filter out invalid transaction IDs that look like file paths or chunk references
    if (txnId.includes("chunk-") || txnId.includes(".js") || txnId.includes("?v=") || txnId.includes("http://") || txnId.includes("https://")) {
      return false;
    }
    return true;
  };

  const handleViewDetails = async (request: any) => {
    try {
      const data = await apiRequest(`/api/admin/payout/requests/${request.requestId}`);
      setSelectedRequest(data.request);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error("Error fetching request details:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payout Request Management</h1>
          <p className="text-muted-foreground">Manage canteen owner payout requests and settlements</p>
        </div>
        <Button onClick={() => refetchRequests()} variant="outline" disabled={requestsLoading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${requestsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList>
          <TabsTrigger value="requests">
            Payout Requests
            {requests.filter((r: any) => r.status === "pending").length > 0 && (
              <Badge className="ml-2 bg-warning/20 text-warning border-warning/40 dark:bg-warning/30 dark:text-warning dark:border-warning/50">
                {requests.filter((r: any) => r.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by request ID, canteen ID, or amount..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requests List */}
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No payout requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request: any) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="font-semibold text-lg">Request #{request.requestId}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Canteen ID</p>
                            <p className="font-medium">{request.canteenId}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Amount</p>
                            <p className="font-semibold text-lg">{formatCurrency(request.amountInRupees)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Orders</p>
                            <p className="font-medium">{request.orderCount}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>Requested: {safeFormatDate(request.requestedAt, "PPp")}</p>
                          {request.approvedAt && (
                            <p>Approved: {safeFormatDate(request.approvedAt, "PPp")}</p>
                          )}
                          {request.rejectedAt && (
                            <p className="text-red-500">Rejected: {safeFormatDate(request.rejectedAt, "PPp")}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(request)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowApproveDialog(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        {request.status === "approved" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowProcessDialog(true);
                            }}
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Process
                          </Button>
                        )}
                        {request.status === "processing" && request.settlementId && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              // Find the settlement for this request
                              const settlement = settlements.find((s: any) => s.settlementId === request.settlementId);
                              if (settlement) {
                                setSelectedRequest(settlement);
                                setShowCompleteDialog(true);
                              }
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Complete Settlement
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          {settlementsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : settlements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No settlements yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement: any) => (
                <Card key={settlement.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="font-semibold text-lg">Settlement #{settlement.settlementId}</span>
                          {getStatusBadge(settlement.status)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Canteen ID</p>
                            <p className="font-medium">{settlement.canteenId}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Amount</p>
                            <p className="font-semibold text-lg">{formatCurrency(settlement.amountInRupees)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Orders</p>
                            <p className="font-medium">{settlement.orderCount}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>
                            Period: {safeFormatDate(settlement.periodStart, "PP")} -{" "}
                            {safeFormatDate(settlement.periodEnd, "PP")}
                          </p>
                          {settlement.processedAt && (
                            <p>Processed: {safeFormatDate(settlement.processedAt, "PPp")}</p>
                          )}
                          {settlement.transactionId && isValidTransactionId(settlement.transactionId) && (
                            <p className="font-mono text-xs break-all">Txn: {settlement.transactionId}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        {settlement.status === "processing" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(settlement);
                              setShowCompleteDialog(true);
                            }}
                            className="min-w-[120px]"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Complete
                          </Button>
                        )}
                        {settlement.status === "completed" && (
                          <Badge className="bg-success/20 text-success border-success/40 dark:bg-success/30 dark:text-success dark:border-success/50 w-fit">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Request ID</Label>
                  <p className="font-mono text-sm">{selectedRequest.requestId}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label>Canteen ID</Label>
                  <p>{selectedRequest.canteenId}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="font-semibold">{formatCurrency(selectedRequest.amountInRupees)}</p>
                </div>
                <div>
                  <Label>Order Count</Label>
                  <p>{selectedRequest.orderCount}</p>
                </div>
                <div>
                  <Label>Requested At</Label>
                  <p>{safeFormatDate(selectedRequest.requestedAt, "PPp")}</p>
                </div>
                {selectedRequest.approvedAt && (
                  <div>
                    <Label>Approved At</Label>
                    <p>{safeFormatDate(selectedRequest.approvedAt, "PPp")}</p>
                  </div>
                )}
                {selectedRequest.rejectedAt && (
                  <div>
                    <Label>Rejected At</Label>
                    <p className="text-destructive">{safeFormatDate(selectedRequest.rejectedAt, "PPp")}</p>
                  </div>
                )}
                {selectedRequest.processedAt && (
                  <div>
                    <Label>Processed At</Label>
                    <p>{safeFormatDate(selectedRequest.processedAt, "PPp")}</p>
                  </div>
                )}
                {selectedRequest.rejectionReason && (
                  <div>
                    <Label>Rejection Reason</Label>
                    <p className="text-destructive">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
                {selectedRequest.transactionId && isValidTransactionId(selectedRequest.transactionId) && (
                  <div>
                    <Label>Transaction ID</Label>
                    <p className="font-mono text-sm break-all">{selectedRequest.transactionId}</p>
                  </div>
                )}
                {selectedRequest.periodStart && selectedRequest.periodEnd && (
                  <div>
                    <Label>Period</Label>
                    <p>
                      {safeFormatDate(selectedRequest.periodStart, "PP")} -{" "}
                      {safeFormatDate(selectedRequest.periodEnd, "PP")}
                    </p>
                  </div>
                )}
              </div>
              {selectedRequest.orders && (
                <div>
                  <Label>Orders</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {selectedRequest.orders.map((order: any) => (
                      <div key={order.id} className="p-2 border rounded text-sm">
                        <p className="font-medium">#{order.orderNumber}</p>
                        <p className="text-muted-foreground">
                          {formatCurrency(order.amount)} • {order.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payout Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                value={selectedRequest ? formatCurrency(selectedRequest.amountInRupees) : ""}
                disabled
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes for this approval..."
                rows={3}
                id="approve-notes"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const notes = (document.getElementById("approve-notes") as HTMLTextAreaElement)?.value;
                  approveMutation.mutate({
                    requestId: selectedRequest.requestId,
                    notes,
                  });
                }}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payout Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                rows={3}
                id="reject-reason"
                required
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add additional notes..."
                rows={2}
                id="reject-notes"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const reason = (document.getElementById("reject-reason") as HTMLTextAreaElement)?.value;
                  const notes = (document.getElementById("reject-notes") as HTMLTextAreaElement)?.value;
                  if (!reason) {
                    alert("Please provide a rejection reason");
                    return;
                  }
                  rejectMutation.mutate({
                    requestId: selectedRequest.requestId,
                    rejectionReason: reason,
                    notes,
                  });
                }}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                value={selectedRequest ? formatCurrency(selectedRequest.amountInRupees) : ""}
                disabled
              />
            </div>
            <div>
              <Label>Transaction ID (Optional)</Label>
              <Input
                placeholder="Enter transaction ID..."
                id="process-transaction-id"
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes for this processing..."
                rows={3}
                id="process-notes"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const transactionId = (document.getElementById("process-transaction-id") as HTMLInputElement)?.value;
                  const notes = (document.getElementById("process-notes") as HTMLTextAreaElement)?.value;
                  processMutation.mutate({
                    requestId: selectedRequest.requestId,
                    transactionId: transactionId || undefined,
                    notes,
                  });
                }}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Settlement Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <>
                <div>
                  <Label>Settlement ID</Label>
                  <Input
                    value={selectedRequest.settlementId || selectedRequest.id || ""}
                    disabled
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input
                    value={formatCurrency(selectedRequest.amountInRupees || selectedRequest.amount / 100 || 0)}
                    disabled
                  />
                </div>
                <div>
                  <Label>Transaction ID (Optional)</Label>
                  <Input
                    placeholder="Enter final transaction ID..."
                    id="complete-transaction-id"
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add completion notes..."
                    rows={3}
                    id="complete-notes"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const transactionId = (document.getElementById("complete-transaction-id") as HTMLInputElement)?.value;
                      const notes = (document.getElementById("complete-notes") as HTMLTextAreaElement)?.value;
                      const settlementId = selectedRequest.settlementId || selectedRequest.id;
                      if (!settlementId) {
                        alert("No settlement ID found");
                        return;
                      }
                      completeMutation.mutate({
                        settlementId: settlementId,
                        transactionId: transactionId || undefined,
                        notes,
                      });
                    }}
                    disabled={completeMutation.isPending || !selectedRequest}
                  >
                    {completeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Complete"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  OwnerPageLayout,
  OwnerCard,
  OwnerButton,
  OwnerBadge,
  OwnerTabs,
  OwnerTabList,
  OwnerTab,
  OwnerTabPanel,
} from "@/components/owner";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Calendar,
  FileText,
  Loader2,
  TrendingUp,
  Wallet,
  History,
} from "lucide-react";
import { format } from "date-fns";

interface PayoutManagementProps {
  canteenId: string;
}

export default function PayoutManagement({ canteenId }: PayoutManagementProps) {
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<string>("requests");

  // Fetch pending payout amount
  const { data: pendingData, isLoading: pendingLoading, isFetching: pendingFetching, refetch: refetchPending } = useQuery({
    queryKey: [`/api/canteens/${canteenId}/payout/pending`],
    queryFn: async () => {
      return apiRequest(`/api/canteens/${canteenId}/payout/pending`);
    },
    enabled: !!canteenId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch settlement history
  const { data: settlementsData, isLoading: settlementsLoading, isFetching: settlementsFetching, refetch: refetchSettlements } = useQuery({
    queryKey: [`/api/canteens/${canteenId}/payout/settlements`],
    queryFn: async () => {
      return apiRequest(`/api/canteens/${canteenId}/payout/settlements`);
    },
    enabled: !!canteenId,
  });

  // Fetch payout request history
  const { data: requestsData, isLoading: requestsLoading, isFetching: requestsFetching, refetch: refetchRequests } = useQuery({
    queryKey: [`/api/canteens/${canteenId}/payout/requests`],
    queryFn: async () => {
      return apiRequest(`/api/canteens/${canteenId}/payout/requests`);
    },
    enabled: !!canteenId,
  });

  const pendingAmount = pendingData?.pendingAmountInRupees || 0;
  const pendingOrderCount = pendingData?.pendingOrderCount || 0;
  const settlements = settlementsData?.settlements || [];
  const requests = requestsData?.requests || [];

  // Calculate statistics
  const totalSettled = settlements
    .filter((s: any) => s.status === "completed")
    .reduce((sum: number, s: any) => sum + (s.amountInRupees || 0), 0);
  
  const pendingRequests = requests.filter((r: any) => r.status === "pending").length;
  const completedSettlements = settlements.filter((s: any) => s.status === "completed").length;

  // Create payout request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: { orderIds: string[]; notes?: string }) => {
      return apiRequest(`/api/canteens/${canteenId}/payout/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: data.orderIds,
          notes: data.notes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/payout`] });
      setShowRequestDialog(false);
      setSelectedOrderIds([]);
      setNotes("");
      refetchPending();
      refetchRequests();
    },
  });

  const handleRequestPayout = () => {
    if (pendingData?.pendingOrderIds && pendingData.pendingOrderIds.length > 0) {
      setSelectedOrderIds(pendingData.pendingOrderIds);
      setShowRequestDialog(true);
    }
  };

  const handleSubmitRequest = () => {
    if (selectedOrderIds.length === 0) {
      return;
    }
    createRequestMutation.mutate({
      orderIds: selectedOrderIds,
      notes: notes || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <OwnerBadge variant="success">Completed</OwnerBadge>;
      case "processing":
        return <OwnerBadge variant="info">Processing</OwnerBadge>;
      case "approved":
        return <OwnerBadge variant="success">Approved</OwnerBadge>;
      case "pending":
        return <OwnerBadge variant="warning">Pending</OwnerBadge>;
      case "rejected":
        return <OwnerBadge variant="danger">Rejected</OwnerBadge>;
      case "failed":
        return <OwnerBadge variant="danger">Failed</OwnerBadge>;
      default:
        return <OwnerBadge variant="default">{status}</OwnerBadge>;
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

  const isLoading = pendingLoading || requestsLoading || settlementsLoading;
  const isRefreshing = pendingFetching || requestsFetching || settlementsFetching;

  return (
    <OwnerPageLayout>
      <OwnerCard className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Responsive Header */}
        <div className="flex items-center gap-2 px-2 sm:px-3 md:px-4 pt-3 pb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-tight">
                Payout
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Synced</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Manage payouts and settlement history
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 md:p-4 pt-2 gap-2 sm:gap-3 app-scrollbar">
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 flex-shrink-0">
            <OwnerCard className="border-l-4 border-l-warning">
              <div className="p-2.5 sm:p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Pending Payout</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground break-words">
                      {pendingLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : (
                        formatCurrency(pendingAmount)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {pendingOrderCount} {pendingOrderCount === 1 ? "order" : "orders"}
                    </p>
                  </div>
                  <Wallet className="w-8 h-8 text-warning flex-shrink-0" />
                </div>
              </div>
            </OwnerCard>

            <OwnerCard className="border-l-4 border-l-success">
              <div className="p-2.5 sm:p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Total Settled</p>
                    <p className="text-lg sm:text-xl font-bold text-success break-words">
                      {settlementsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : (
                        formatCurrency(totalSettled)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {completedSettlements} {completedSettlements === 1 ? "settlement" : "settlements"}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-success flex-shrink-0" />
                </div>
              </div>
            </OwnerCard>

            <OwnerCard className="border-l-4 border-l-primary">
              <div className="p-2.5 sm:p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Active Requests</p>
                    <p className="text-lg sm:text-xl font-bold text-primary break-words">
                      {requestsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : (
                        requests.length
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {pendingRequests} pending
                    </p>
                  </div>
                  <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                </div>
              </div>
            </OwnerCard>
          </div>

          {/* Quick Action - Request Payout */}
          {pendingAmount > 0 && (
            <div className="flex-shrink-0">
              <OwnerCard className="bg-primary/5 border-primary/20">
                <div className="p-2.5 sm:p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        You have {formatCurrency(pendingAmount)} available for payout
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {pendingOrderCount} {pendingOrderCount === 1 ? "order" : "orders"} ready for settlement
                      </p>
                    </div>
                    <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                      <DialogTrigger asChild>
                        <OwnerButton
                          variant="primary"
                          onClick={handleRequestPayout}
                          icon={<ArrowRight className="w-4 h-4" />}
                          iconPosition="right"
                          className="w-full sm:w-auto"
                        >
                          Request Payout
                        </OwnerButton>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border max-w-md w-[96vw] sm:w-full px-3">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">Request Payout</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-foreground">Amount</Label>
                            <Input
                              value={formatCurrency(pendingAmount)}
                              disabled
                              className="font-semibold break-words"
                            />
                          </div>
                          <div>
                            <Label className="text-foreground">Orders Included</Label>
                            <Input
                              value={`${pendingOrderCount} orders`}
                              disabled
                              className="break-words"
                            />
                          </div>
                          <div>
                            <Label className="text-foreground">Notes (Optional)</Label>
                            <Textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any notes for this payout request..."
                              rows={3}
                              className="break-words resize-none"
                            />
                          </div>
                          <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                            <OwnerButton
                              variant="secondary"
                              onClick={() => setShowRequestDialog(false)}
                            >
                              Cancel
                            </OwnerButton>
                            <OwnerButton
                              variant="primary"
                              onClick={handleSubmitRequest}
                              disabled={createRequestMutation.isPending}
                              isLoading={createRequestMutation.isPending}
                            >
                              Submit Request
                            </OwnerButton>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </OwnerCard>
            </div>
          )}

          {/* Tabs for Organized Sections */}
          <OwnerTabs value={activeTab} onValueChange={setActiveTab}>
            <OwnerTabList className="overflow-x-auto no-scrollbar gap-2">
              <OwnerTab value="requests" icon={<FileText className="w-4 h-4" />} badge={requests.length}>
                Payout Requests
              </OwnerTab>
              <OwnerTab value="settlements" icon={<History className="w-4 h-4" />} badge={settlements.length}>
                Settlement History
              </OwnerTab>
            </OwnerTabList>

            <OwnerTabPanel value="requests">
              <OwnerCard
                className="flex-1 flex flex-col min-h-0"
                contentClassName="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 app-scrollbar"
              >
                {requestsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-base font-medium text-foreground mb-1">No payout requests yet</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Your payout requests will appear here once you submit them
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {requests.map((request: any) => (
                      <OwnerCard
                        key={request.id}
                        hover
                        className="border-border"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-3">
                                <span className="font-semibold text-base text-foreground break-words">
                                  Request #{request.requestId}
                                </span>
                                <div className="flex-shrink-0">{getStatusBadge(request.status)}</div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                                  <p className="text-base font-semibold text-foreground break-words">
                                    {formatCurrency(request.amountInRupees)}
                                  </p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground mb-1">Orders</p>
                                  <p className="text-base font-semibold text-foreground break-words">
                                    {request.orderCount}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span className="text-foreground break-words">
                                    Requested: {safeFormatDate(request.requestedAt, "PPp")}
                                  </span>
                                </div>
                                {request.approvedAt && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-success" />
                                    <span className="text-foreground break-words">
                                      Approved: {safeFormatDate(request.approvedAt, "PPp")}
                                    </span>
                                  </div>
                                )}
                                {request.rejectedAt && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <XCircle className="w-3 h-3 flex-shrink-0 text-destructive" />
                                    <span className="text-destructive break-words">
                                      Rejected: {safeFormatDate(request.rejectedAt, "PPp")}
                                    </span>
                                  </div>
                                )}
                                {request.rejectionReason && (
                                  <div className="flex items-start gap-2 text-muted-foreground mt-2">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0 text-destructive mt-0.5" />
                                    <span className="text-destructive break-words text-xs">
                                      Reason: {request.rejectionReason}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </OwnerCard>
                    ))}
                  </div>
                )}
              </OwnerCard>
            </OwnerTabPanel>

            <OwnerTabPanel value="settlements">
              <OwnerCard
                className="flex-1 flex flex-col min-h-0"
                contentClassName="flex-1 min-h-0 overflow-y-auto p-4 app-scrollbar"
              >
                {settlementsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : settlements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-base font-medium text-foreground mb-1">No settlements yet</p>
                    <p className="text-sm text-muted-foreground break-words">
                      Completed settlements will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((settlement: any) => (
                      <OwnerCard
                        key={settlement.id}
                        hover
                        className="border-border"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-3">
                                <span className="font-semibold text-base text-foreground break-words">
                                  Settlement #{settlement.settlementId}
                                </span>
                                <div className="flex-shrink-0">{getStatusBadge(settlement.status)}</div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                                  <p className="text-base font-semibold text-foreground break-words">
                                    {formatCurrency(settlement.amountInRupees)}
                                  </p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground mb-1">Orders</p>
                                  <p className="text-base font-semibold text-foreground break-words">
                                    {settlement.orderCount}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span className="text-foreground break-words">
                                    Period: {safeFormatDate(settlement.periodStart, "PP")} -{" "}
                                    {safeFormatDate(settlement.periodEnd, "PP")}
                                  </span>
                                </div>
                                {settlement.processedAt && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <CheckCircle className="w-3 h-3 flex-shrink-0 text-success" />
                                    <span className="text-foreground break-words">
                                      Processed: {safeFormatDate(settlement.processedAt, "PPp")}
                                    </span>
                                  </div>
                                )}
                                {settlement.transactionId && isValidTransactionId(settlement.transactionId) && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <DollarSign className="w-3 h-3 flex-shrink-0 text-primary" />
                                    <span className="font-mono text-xs text-foreground break-all">
                                      Txn: {settlement.transactionId}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </OwnerCard>
                    ))}
                  </div>
                )}
              </OwnerCard>
            </OwnerTabPanel>
          </OwnerTabs>
        </div>
      </OwnerCard>
    </OwnerPageLayout>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import {
    ArrowLeft,
    CreditCard,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    ShoppingBag,
    AlertTriangle,
    ChevronRight,
    Loader2,
} from "lucide-react";

type PaymentItem = {
    id: string;
    merchantTransactionId: string;
    amount: number;
    displayAmount: number;
    status: string;
    canteenName: string;
    customerName: string;
    itemsSummary: string[];
    itemCount: number;
    hasOrder: boolean;
    orderId?: any;
    createdAt: string;
    updatedAt: string;
};

type VerifyResult = {
    success: boolean;
    status: string;
    message: string;
    data?: {
        orderNumber?: string;
        orderId?: string;
        paymentStatus?: string;
    };
};

export default function MyPaymentsPage() {
    const { resolvedTheme } = useTheme();
    const queryClient = useQueryClient();
    const [userInfo, setUserInfo] = useState<any>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [verifyResult, setVerifyResult] = useState<Record<string, VerifyResult>>({});

    useEffect(() => {
        const userData = localStorage.getItem("user");
        if (userData) {
            try {
                setUserInfo(JSON.parse(userData));
            } catch (e) { }
        }
    }, []);

    const userId = userInfo?.id;

    const {
        data: paymentsData,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: [`/api/users/${userId}/my-payments`],
        enabled: !!userId,
    });

    const payments: PaymentItem[] = (paymentsData as any)?.payments || [];

    const verifyMutation = useMutation({
        mutationFn: async (merchantTransactionId: string) => {
            return apiRequest<VerifyResult>(
                `/api/users/${userId}/verify-payment/${merchantTransactionId}`,
                { method: "POST" }
            );
        },
        onSuccess: (result, merchantTransactionId) => {
            setVerifyResult((prev) => ({ ...prev, [merchantTransactionId]: result }));
            setVerifyingId(null);
            // Refresh payments list
            queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/my-payments`] });
        },
        onError: (error: any, merchantTransactionId) => {
            setVerifyResult((prev) => ({
                ...prev,
                [merchantTransactionId]: {
                    success: false,
                    status: "error",
                    message: error.message || "Verification failed",
                },
            }));
            setVerifyingId(null);
        },
    });

    const handleVerify = (merchantTransactionId: string) => {
        setVerifyingId(merchantTransactionId);
        setVerifyResult((prev) => {
            const updated = { ...prev };
            delete updated[merchantTransactionId];
            return updated;
        });
        verifyMutation.mutate(merchantTransactionId);
    };

    const getStatusConfig = (status: string) => {
        const s = status?.toLowerCase();
        if (s === "success" || s === "completed") {
            return {
                label: "Successful",
                icon: CheckCircle2,
                color: "text-green-600",
                bg: "bg-green-50",
                border: "border-green-200",
                darkBg: "bg-green-950/30",
                darkBorder: "border-green-800",
            };
        }
        if (s === "failed" || s === "expired") {
            return {
                label: s === "expired" ? "Expired" : "Failed",
                icon: XCircle,
                color: "text-red-500",
                bg: "bg-red-50",
                border: "border-red-200",
                darkBg: "bg-red-950/30",
                darkBorder: "border-red-800",
            };
        }
        return {
            label: "Pending",
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-50",
            border: "border-amber-200",
            darkBg: "bg-amber-950/30",
            darkBorder: "border-amber-800",
        };
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isDark = resolvedTheme === "dark";

    return (
        <div className={`min-h-screen ${isDark ? "bg-background" : "bg-gray-50"}`}>
            {/* Header */}
            <div className={`relative px-4 pt-12 pb-6 ${isDark ? "bg-background" : "bg-background"}`}>
                <div className="relative z-10 flex items-center justify-between mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`hover:bg-white/20 transition-all duration-200 rounded-full ${isDark ? "text-white" : "text-black"}`}
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent("appNavigateToProfile", {}));
                        }}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-black"}`}>
                        My Payments
                    </h1>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`hover:bg-white/20 transition-all duration-200 rounded-full ${isDark ? "text-white" : "text-black"}`}
                        onClick={() => refetch()}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </Button>
                </div>
                <p className={`text-sm text-center ${isDark ? "text-white/70" : "text-black"}`}>
                    View your payment history and verify pending payments
                </p>
            </div>

            {/* Content */}
            <div className="px-4 py-4 space-y-3">
                {/* Loading */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#724491]" />
                        <p className="text-muted-foreground text-sm">
                            Loading your payments...
                        </p>
                    </div>
                )}

                {/* Error */}
                {isError && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <AlertTriangle className="w-12 h-12 text-red-400" />
                        <p className="text-muted-foreground">Failed to load payments</p>
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !isError && payments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-20 h-20 rounded-full bg-[#724491]/10 flex items-center justify-center">
                            <CreditCard className="w-10 h-10 text-[#724491]/50" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-lg font-medium text-foreground">
                                No payments yet
                            </p>
                            <p className="text-muted-foreground text-sm">
                                Your payment history will appear here after you make a purchase
                            </p>
                        </div>
                    </div>
                )}

                {/* Payment cards */}
                {!isLoading &&
                    payments.map((payment) => {
                        const statusConfig = getStatusConfig(payment.status);
                        const StatusIcon = statusConfig.icon;
                        const isPending = payment.status?.toLowerCase() === "pending";
                        const result = verifyResult[payment.merchantTransactionId];
                        const isVerifying = verifyingId === payment.merchantTransactionId;

                        return (
                            <Card
                                key={payment.id}
                                className={`overflow-hidden transition-all duration-200 ${isDark
                                    ? "bg-card border border-gray-800"
                                    : "bg-white border border-gray-200 shadow-sm"
                                    }`}
                            >
                                <CardContent className="p-0">
                                    {/* Main Payment Info */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            {/* Amount & Status */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg font-bold text-foreground">
                                                        ₹{payment.displayAmount.toFixed(2)}
                                                    </span>
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDark
                                                            ? `${statusConfig.darkBg} ${statusConfig.darkBorder} border`
                                                            : `${statusConfig.bg} ${statusConfig.border} border`
                                                            } ${statusConfig.color}`}
                                                    >
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusConfig.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(payment.createdAt)} at{" "}
                                                    {formatTime(payment.createdAt)}
                                                </p>
                                            </div>

                                            {/* Order link if exists */}
                                            {payment.hasOrder && payment.orderId && (
                                                <button
                                                    className="flex items-center gap-1 text-xs text-[#724491] font-medium hover:underline"
                                                    onClick={() => {
                                                        const orderId =
                                                            typeof payment.orderId === "object"
                                                                ? payment.orderId._id || payment.orderId.id
                                                                : payment.orderId;
                                                        const orderNumber =
                                                            typeof payment.orderId === "object" &&
                                                                payment.orderId.orderNumber
                                                                ? payment.orderId.orderNumber
                                                                : "";
                                                        window.location.href = `/order-status/${orderId}?from=my_payments`;
                                                    }}
                                                >
                                                    <ShoppingBag className="w-3.5 h-3.5" />
                                                    {typeof payment.orderId === "object" &&
                                                        payment.orderId?.orderNumber
                                                        ? `#${payment.orderId.orderNumber}`
                                                        : "View Order"}
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Items summary */}
                                        {payment.itemsSummary.length > 0 && (
                                            <div className="mb-2">
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {payment.itemsSummary.join(", ")}
                                                    {payment.itemCount > 3 &&
                                                        ` +${payment.itemCount - 3} more`}
                                                </p>
                                            </div>
                                        )}

                                        {/* Canteen */}
                                        {payment.canteenName && (
                                            <p className="text-xs text-muted-foreground">
                                                {payment.canteenName}
                                            </p>
                                        )}

                                        {/* Transaction ID */}
                                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                                            TXN: {payment.merchantTransactionId}
                                        </p>
                                    </div>

                                    {/* Verify button for pending payments */}
                                    {isPending && !payment.hasOrder && (
                                        <div
                                            className={`px-4 py-3 ${isDark
                                                ? "bg-amber-950/20 border-t border-amber-800/30"
                                                : "bg-amber-50 border-t border-amber-100"
                                                }`}
                                        >
                                            {result ? (
                                                <div className="space-y-2">
                                                    <div
                                                        className={`flex items-start gap-2 text-sm ${result.status === "verified_and_created" ||
                                                            result.status === "already_completed"
                                                            ? "text-green-600"
                                                            : result.status === "failed"
                                                                ? "text-red-500"
                                                                : "text-amber-600"
                                                            }`}
                                                    >
                                                        {result.status === "verified_and_created" ||
                                                            result.status === "already_completed" ? (
                                                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        ) : result.status === "failed" ? (
                                                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        ) : (
                                                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        )}
                                                        <span className="font-medium">
                                                            {result.message}
                                                        </span>
                                                    </div>
                                                    {result.data?.orderNumber && (
                                                        <button
                                                            className="flex items-center gap-1 text-xs text-[#724491] font-medium hover:underline ml-6"
                                                            onClick={() => {
                                                                window.location.href = `/order-status/${result.data?.orderId}?from=my_payments`;
                                                            }}
                                                        >
                                                            <ShoppingBag className="w-3.5 h-3.5" />
                                                            View Order #{result.data.orderNumber}
                                                            <ChevronRight className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={`w-full gap-2 font-medium ${isDark
                                                        ? "border-amber-700 text-amber-400 hover:bg-amber-950/40"
                                                        : "border-amber-300 text-amber-700 hover:bg-amber-100"
                                                        }`}
                                                    onClick={() =>
                                                        handleVerify(payment.merchantTransactionId)
                                                    }
                                                    disabled={isVerifying}
                                                >
                                                    {isVerifying ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Verifying with payment gateway...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="w-4 h-4" />
                                                            Verify Payment Status
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}

                {/* Bottom spacing for safe area */}
                <div className="h-8" />
            </div>
        </div>
    );
}

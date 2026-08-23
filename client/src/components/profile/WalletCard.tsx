import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface WalletCardProps {
  userId: number;
}

interface WalletData {
  wallet: {
    balance: string;
  };
  stats: {
    totalCredits: string;
    totalDebits: string;
  };
}

interface Transaction {
  id: number;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  description: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  referenceType?: string;
  createdAt: string;
}

interface TransactionsData {
  transactions: Transaction[];
}

export default function WalletCard({ userId }: WalletCardProps) {
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch wallet data
  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: [`/api/wallet/${userId}`],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch transaction history
  const { data: transactionsData } = useQuery<TransactionsData>({
    queryKey: [`/api/wallet/${userId}/transactions`],
    enabled: showTransactionsDialog
  });

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Create Razorpay order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch(`/api/wallet/${userId}/topup/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create order');
      }

      return response.json();
    }
  });

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch(`/api/wallet/${userId}/topup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Payment verification failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${userId}/transactions`] });
      setShowTopUpDialog(false);
      setTopUpAmount('');
      setIsProcessing(false);
    }
  });

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);

    if (isNaN(amount) || amount < 10) {
      toast({
        title: "Invalid Amount",
        description: "Minimum top-up amount is ₹10",
        variant: "destructive"
      });
      return;
    }

    if (amount > 10000) {
      toast({
        title: "Invalid Amount",
        description: "Maximum top-up amount is ₹10,000",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create Razorpay order
      const orderData = await createOrderMutation.mutateAsync(amount);

      // Initialize Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Wallet Top-up',
        description: `Add ₹${amount} to your wallet`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
            await verifyPaymentMutation.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transactionId: orderData.transactionId
            });

            toast({
              title: "Success!",
              description: `₹${amount} added to your wallet successfully`,
              variant: "default"
            });
          } catch (error: any) {
            console.error('Payment verification failed:', error);
            toast({
              title: "Payment Failed",
              description: error.message || 'Payment verification failed',
              variant: "destructive"
            });
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#724491'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to initiate payment',
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const quickAmounts = [100, 200, 500, 1000];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'FAILED':
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getTransactionIcon = (type: string) => {
    return type === 'CREDIT' ? (
      <ArrowDownRight className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowUpRight className="w-4 h-4 text-red-500" />
    );
  };

  if (isLoading) {
    return (
      <Card className={`${resolvedTheme === 'dark' ? 'bg-card border-gray-800' : 'bg-white border-gray-200'}`}>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-10 bg-gray-300 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = walletData?.wallet?.balance || '0';
  const stats = walletData?.stats;

  return (
    <>
      <Card className={`${resolvedTheme === 'dark' ? 'bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-full ${resolvedTheme === 'dark' ? 'bg-purple-800' : 'bg-purple-200'}`}>
                <Wallet className={`w-5 h-5 ${resolvedTheme === 'dark' ? 'text-purple-200' : 'text-purple-700'}`} />
              </div>
              <h3 className={`text-lg font-semibold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                My Wallet
              </h3>
            </div>
            <Button
              size="sm"
              onClick={() => setShowTransactionsDialog(true)}
              variant="ghost"
              className={`${resolvedTheme === 'dark' ? 'text-purple-200 hover:text-white' : 'text-purple-700 hover:text-purple-900'}`}
            >
              History
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="mb-6">
            <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
              Available Balance
            </p>
            <p className={`text-4xl font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              ₹{parseFloat(balance).toFixed(2)}
            </p>
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-3 rounded-lg ${resolvedTheme === 'dark' ? 'bg-purple-800/30' : 'bg-white/50'}`}>
                <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
                  Total Added
                </p>
                <p className={`text-lg font-semibold ${resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                  ₹{parseFloat(stats.totalCredits).toFixed(2)}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${resolvedTheme === 'dark' ? 'bg-purple-800/30' : 'bg-white/50'}`}>
                <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
                  Total Spent
                </p>
                <p className={`text-lg font-semibold ${resolvedTheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                  ₹{parseFloat(stats.totalDebits).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() => setShowTopUpDialog(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            disabled={isProcessing}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Money
          </Button>
        </CardContent>
      </Card>

      {/* Top-up Dialog */}
      <Dialog open={showTopUpDialog} onOpenChange={setShowTopUpDialog}>
        <DialogContent className={`${resolvedTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle>Add Money to Wallet</DialogTitle>
            <DialogDescription>
              Enter the amount you want to add to your wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Amount (₹)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                min="10"
                max="10000"
                className={`${resolvedTheme === 'dark' ? 'bg-gray-800 border-gray-700' : ''}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Min: ₹10 | Max: ₹10,000
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Quick Select</p>
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setTopUpAmount(amount.toString())}
                    className={`${resolvedTheme === 'dark' ? 'border-gray-700 hover:bg-gray-800' : ''}`}
                  >
                    ₹{amount}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleTopUp}
              disabled={isProcessing || !topUpAmount}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isProcessing ? 'Processing...' : 'Proceed to Pay'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={showTransactionsDialog} onOpenChange={setShowTransactionsDialog}>
        <DialogContent className={`${resolvedTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'} max-w-2xl max-h-[80vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              View all your wallet transactions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {transactionsData?.transactions?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              transactionsData?.transactions?.map((transaction: any) => (
                <div
                  key={transaction.id}
                  className={`p-4 rounded-lg border ${resolvedTheme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                        {transaction.referenceType && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Type: {transaction.referenceType}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'CREDIT' ? '+' : '-'}₹{parseFloat(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        {getStatusIcon(transaction.status)}
                        <span className="text-xs text-muted-foreground">
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

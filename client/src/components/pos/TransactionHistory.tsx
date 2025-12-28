import { History, User, Calendar, DollarSign, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { OwnerCard, OwnerBadge } from "@/components/owner";
import { formatCurrency, formatDate } from "@/utils/posCalculations";
import { Button } from "@/components/ui/button";

interface TransactionHistoryProps {
  transactions: any[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
  onPageChange?: (page: number) => void;
}

export function TransactionHistory({ transactions, pagination, onPageChange }: TransactionHistoryProps) {
  return (
    <OwnerCard
      title={
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span>Transaction History</span>
        </div>
      }
      description="Recent POS transactions"
      className="flex-1 flex flex-col min-h-0"
      contentClassName="flex-1 flex flex-col min-h-0 p-4"
    >
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No transactions found</p>
            <p className="text-xs text-muted-foreground mt-1">Transactions will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction: any) => {
              const items = JSON.parse(transaction.items || '[]');
              return (
                <div 
                  key={transaction.id} 
                  className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">#{transaction.orderNumber}</h3>
                      <OwnerBadge variant="success" className="text-xs">
                        {transaction.status}
                      </OwnerBadge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">{transaction.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{formatDate(transaction.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{items.length} item(s)</span>
                    </div>
                  </div>
                  {transaction.discountAmount > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-medium text-success">
                          {formatCurrency(transaction.discountAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {transactions.length} of {pagination.totalCount} transactions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <div className="text-sm">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </OwnerCard>
  );
}

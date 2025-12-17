import { RefreshCw, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import type { StockValidationResult } from "@/hooks/useStockValidation";

interface StockValidationWarningProps {
  validationResult: StockValidationResult;
  onRetry: () => void;
  onRemoveItem?: (itemId: string) => void;
  isLoading?: boolean;
}

export default function StockValidationWarning({
  validationResult,
  onRetry,
  onRemoveItem,
  isLoading = false
}: StockValidationWarningProps) {
  const { resolvedTheme } = useTheme();
  
  if (validationResult.isValid) {
    return null;
  }

  const criticalErrors = validationResult.errors.filter(error => error.available === 0);
  const quantityErrors = validationResult.errors.filter(error => error.available > 0 && error.available < error.requested);

  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`${
      isDark 
        ? 'bg-red-950/30 border-red-800/50' 
        : 'bg-red-50 border-red-200'
    } border rounded-xl p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 ${
          isDark 
            ? 'bg-red-900/50 border border-red-800/50' 
            : 'bg-red-100'
        } rounded-full flex items-center justify-center`}>
          <Package className={`w-5 h-5 ${
            isDark ? 'text-red-400' : 'text-red-600'
          }`} />
        </div>
        <div>
          <h3 className={`font-semibold ${
            isDark ? 'text-red-300' : 'text-red-900'
          }`}>
            Stock Issues Found
          </h3>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {criticalErrors.map((error, index) => (
          <div 
            key={index} 
            className={`flex items-center justify-between ${
              isDark 
                ? 'bg-black/50 border-red-800/30' 
                : 'bg-white border-red-200'
            } rounded-lg p-3 border`}
          >
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className={`font-medium ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {error.itemName}
                </span>
                <Badge 
                  variant="destructive" 
                  className={`text-xs ${
                    isDark 
                      ? 'bg-red-900/50 border-red-800 text-red-300' 
                      : ''
                  }`}
                >
                  Out of Stock
                </Badge>
              </div>
            </div>
            {onRemoveItem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(error.itemId)}
                className={`${
                  isDark 
                    ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300' 
                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                } transition-colors flex items-center space-x-1`}
                title="Remove item from cart"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs font-medium">Remove</span>
              </Button>
            )}
          </div>
        ))}

        {quantityErrors.map((error, index) => (
          <div 
            key={index} 
            className={`flex items-center justify-between ${
              isDark 
                ? 'bg-black/50 border-orange-800/30' 
                : 'bg-white border-orange-200'
            } rounded-lg p-3 border`}
          >
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className={`font-medium ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {error.itemName}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isDark 
                      ? 'border-orange-800/50 text-orange-400 bg-orange-950/30' 
                      : 'border-orange-300 text-orange-700'
                  }`}
                >
                  Only {error.available} left
                </Badge>
              </div>
              <p className={`text-sm mt-1 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                You requested {error.requested}, but only {error.available} are available
              </p>
            </div>
            {onRemoveItem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(error.itemId)}
                className={`${
                  isDark 
                    ? 'text-orange-400 hover:bg-orange-900/30 hover:text-orange-300' 
                    : 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                } transition-colors flex items-center space-x-1`}
                title="Remove item from cart"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs font-medium">Remove</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isLoading}
          className={`${
            isDark 
              ? 'border-red-800/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-700/50' 
              : 'border-red-300 text-red-700 hover:bg-red-50'
          } transition-colors`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Stock
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

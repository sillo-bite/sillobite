import { useEffect } from "react";
import * as React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCart } from "@/contexts/CartContext";
import { useCanteenContext } from "@/contexts/CanteenContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Loader2, AlertTriangle, Package, X } from "lucide-react";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { useStockValidation } from "@/hooks/useStockValidation";
import StockValidationWarning from "@/components/canteen/StockValidationWarning";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useReducedMotion } from "@/utils/dropdownAnimations";
import { getUserFromStorage } from "@/utils/userStorage";
import { apiRequest } from "@/lib/queryClient";

export default function CartPage() {
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const { cart, updateQuantity, removeFromCart, getTotalPrice, getTotalItems, clearCart, getCartCanteenId, validateCartCanteen } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  
  // State for stock validation dialog
  const [showStockDialog, setShowStockDialog] = React.useState(false);
  const [checkoutValidationResult, setCheckoutValidationResult] = React.useState<typeof validationResult | null>(null);
  const [isValidatingForCheckout, setIsValidatingForCheckout] = React.useState(false);
  
  // State for showing all cart items
  const [showAllItems, setShowAllItems] = React.useState(false);
  
  // Initialize stock validation
  const { validationResult, isLoading: isStockLoading, refetch: refetchStock } = useStockValidation(cart);
  
  // Get canteen ID for WebSocket connection
  const cartCanteenId = getCartCanteenId();
  const currentCanteenId = selectedCanteen?.id;
  
  // Debounce refetch to prevent multiple rapid calls
  const debouncedRefetchStock = React.useRef<NodeJS.Timeout | null>(null);
  const handleRefetchStock = React.useCallback(() => {
    if (debouncedRefetchStock.current) {
      clearTimeout(debouncedRefetchStock.current);
    }
    debouncedRefetchStock.current = setTimeout(() => {
      console.log("🔄 Cart received order update, refreshing stock validation...");
      refetchStock();
    }, 500); // Debounce by 500ms
  }, [refetchStock]);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedRefetchStock.current) {
        clearTimeout(debouncedRefetchStock.current);
      }
    };
  }, []);

  // Real-time updates via WebSocket for stock changes and menu updates
  useWebSocket({
    canteenIds: cartCanteenId ? [cartCanteenId] : [],
    enabled: !!cartCanteenId && cart.length > 0,
    onOrderUpdate: (order) => {
      // Use debounced refetch
      handleRefetchStock();
    },
    onConnected: () => {
      console.log("✅ Cart WebSocket connected for canteen:", cartCanteenId);
    },
    onDisconnected: () => {
      console.log("❌ Cart WebSocket disconnected");
    },
    onError: (error) => {
      console.error("❌ Cart WebSocket error:", error);
    }
  });
  
  // Validate cart canteen on mount and when canteen changes
  useEffect(() => {
    if (currentCanteenId && cart.length > 0) {
      if (!validateCartCanteen(currentCanteenId)) {
        // Canteen mismatch detected - user will see warning card
        // Don't auto-clear to allow user to decide
        console.warn('⚠️ Cart contains items from different canteen');
      }
    }
  }, [currentCanteenId, cart.length, validateCartCanteen]);


  // Debounce quantity updates to prevent rapid successive calls
  const quantityUpdateTimeoutRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const handleUpdateQuantity = React.useCallback((itemId: string | number, newQuantity: number) => {
    const id = String(itemId);
    
    // Clear existing timeout for this item
    const existingTimeout = quantityUpdateTimeoutRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      updateQuantity(id, newQuantity);
      quantityUpdateTimeoutRef.current.delete(id);
    }, 200); // Debounce by 200ms
    
    quantityUpdateTimeoutRef.current.set(id, timeout);
  }, [updateQuantity]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      quantityUpdateTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      quantityUpdateTimeoutRef.current.clear();
    };
  }, []);

  const handleRemoveItem = (itemId: string | number) => {
    removeFromCart(String(itemId));
  };

  const proceedToCheckout = async () => {
    if (cart.length === 0) {
      return;
    }
    
    // Check canteen validation before proceeding
    if (currentCanteenId && !validateCartCanteen(currentCanteenId)) {
      // Show alert to user
      alert('Your cart contains items from a different canteen. Please clear your cart or switch back to the original canteen.');
      return;
    }
    
    // Validate stock before proceeding to checkout
    setIsValidatingForCheckout(true);
    try {
      // Make a single direct API call for stock validation (avoid duplicate calls from hook)
      const itemIds = cart.map(item => item.id);
      if (itemIds.length > 0) {
        const { apiRequest } = await import('@/lib/queryClient');
        const stockData = await apiRequest(`/api/stock/status?${itemIds.map(id => `itemIds=${id}`).join('&')}`);
        
        // Validate stock against cart items
        const errors: Array<{
          itemId: string;
          itemName: string;
          requested: number;
          available: number;
          message: string;
        }> = [];
        
        cart.forEach(cartItem => {
          const stockItem = stockData.find((item: any) => item.id === cartItem.id);
          
          if (!stockItem) {
            errors.push({
              itemId: cartItem.id,
              itemName: cartItem.name,
              requested: cartItem.quantity,
              available: 0,
              message: `${cartItem.name} is no longer available`
            });
          } else if (!stockItem.available) {
            errors.push({
              itemId: cartItem.id,
              itemName: cartItem.name,
              requested: cartItem.quantity,
              available: stockItem.stock,
              message: `${cartItem.name} is currently out of stock`
            });
          } else if (stockItem.stock < cartItem.quantity) {
            errors.push({
              itemId: cartItem.id,
              itemName: cartItem.name,
              requested: cartItem.quantity,
              available: stockItem.stock,
              message: `${cartItem.name}: Only ${stockItem.stock} available (you requested ${cartItem.quantity})`
            });
          }
        });
        
        if (errors.length > 0) {
          // Stock validation failed - show dialog
          setCheckoutValidationResult({
            isValid: false,
            errors,
            items: stockData
          });
          setShowStockDialog(true);
          setIsValidatingForCheckout(false);
          return;
        }
      }
      
      // Stock is valid, now create checkout session and reserve stock
      try {
        const userData = getUserFromStorage();
        const canteenId = cartCanteenId || currentCanteenId;
        
        // Create checkout session
        const sessionResponse = await apiRequest('/api/checkout-sessions/create', {
          method: 'POST',
          body: JSON.stringify({
            customerId: userData?.id || 0,
            canteenId: canteenId
          })
        });
        
        if (!sessionResponse.success || !sessionResponse.sessionId) {
          throw new Error('Failed to create checkout session');
        }
        
        const sessionId = sessionResponse.sessionId;
        localStorage.setItem('currentCheckoutSessionId', sessionId);
        
        // Reserve stock for this checkout session
        const cartItems = cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          name: item.name
        }));
        
        await apiRequest(`/api/checkout-sessions/${sessionId}/reserve-stock`, {
          method: 'POST',
          body: JSON.stringify({ cartItems })
        });
        
        console.log('✅ Stock reserved for checkout session:', sessionId);
        
        // Stock reserved successfully, proceed to checkout
        setIsValidatingForCheckout(false);
        setLocation("/checkout");
      } catch (error: any) {
        console.error('Error creating checkout session or reserving stock:', error);
        setIsValidatingForCheckout(false);
        
        // Show error to user
        const errorMessage = error.message || 'Failed to proceed to checkout. Please try again.';
        alert(errorMessage);
        
        // Show error dialog
        setCheckoutValidationResult({
          isValid: false,
          errors: [{
            itemId: '',
            itemName: 'Checkout Error',
            requested: 0,
            available: 0,
            message: errorMessage
          }],
          items: []
        });
        setShowStockDialog(true);
      }
    } catch (error) {
      console.error('Error validating stock for checkout:', error);
      setIsValidatingForCheckout(false);
      // Show error dialog
      setCheckoutValidationResult({
        isValid: false,
        errors: [{
          itemId: '',
          itemName: 'Stock Validation Error',
          requested: 0,
          available: 0,
          message: 'Unable to verify stock availability. Please try again.'
        }],
        items: []
      });
      setShowStockDialog(true);
    }
  };

  const handleRemoveItemFromValidation = (itemId: string) => {
    console.log('🗑️ CartPage: Removing item with ID:', itemId);
    removeFromCart(itemId); // Pass string directly, don't convert to int
    };

  const handleRetryStockCheck = () => {
    // Trigger a refetch of the stock data
    refetchStock();
  };

  return (
    <>
      <div
        className={`w-full h-auto min-h-fit flex flex-col ${
        resolvedTheme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-background'
      }`}
      >
      {/* Header */}
      <div className="bg-[#724491] px-4 pt-12 pb-6 rounded-b-2xl shadow-xl flex-shrink-0">
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
              <h1 className="text-xl font-bold text-white">My Cart</h1>
              <p className="text-white/80 text-sm">
                {cart.length > 0 ? `${getTotalItems()} items` : "Your cart is empty"}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <Badge variant="secondary" className="bg-white/20 text-white">
              ₹{getTotalPrice()}
            </Badge>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div 
        className="flex flex-col px-4 space-y-4 mt-4"
        style={{
          paddingBottom: cart.length > 0 
            ? 'calc(150px + env(safe-area-inset-bottom, 0px))' 
            : 'calc(80px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Canteen Mismatch Warning */}
        {currentCanteenId && cart.length > 0 && !validateCartCanteen(currentCanteenId) && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive">Canteen Mismatch</h3>
                  <p className="text-sm text-muted-foreground">
                    Your cart contains items from a different canteen. Please clear your cart or switch back to the original canteen.
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    clearCart();
                  }}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Clear Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Validation Warning */}
        <StockValidationWarning
          validationResult={validationResult}
          onRetry={handleRetryStockCheck}
          onRemoveItem={handleRemoveItemFromValidation}
          isLoading={isStockLoading}
        />

        {cart.length === 0 ? (
          // Empty Cart State
          <div className="p-12 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-100'
            }`}>
              <ShoppingCart className={`w-8 h-8 ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${
              resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Your cart is empty
            </h3>
            <p className={`mb-4 ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Your cart is empty. Add some items to get started!
            </p>
            <Button 
              onClick={() => {
                // Navigate to menu view using the app's internal navigation system
                // This ensures proper navigation when CartPage is rendered within AppPage
                window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
                  detail: { category: 'all' }
                }));
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Browse Menu
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-4">
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {(showAllItems ? cart : cart.slice(0, 5)).map((item, index) => (
                <Card 
                  key={item.id}
                  className={`dropdown-item ${
                    prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                  } rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border-0 overflow-hidden ${
                    resolvedTheme === 'dark' 
                      ? 'bg-card hover:bg-gray-950' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  style={{
                    animationDelay: prefersReducedMotion ? '0ms' : `${index * 100}ms`
                  }}
                >
                  <CardContent className="p-0">
                    {/* Compact Section - Image, info, and quantity modifier with integrated delete */}
                    <div className="flex items-center p-4 gap-4">
                      {/* Left: Product image */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <div className={`w-full h-full flex items-center justify-center ${
                          resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-200'
                        }`}>
                          <span className="text-lg">🍽️</span>
                        </div>
                      </div>
                      
                      {/* Center: Veg indicator, name, and price */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-2">
                          {/* Vegetarian indicator */}
                          <div className={`w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0 ${
                            item.isVegetarian ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                          
                          {/* Item name */}
                          <h3 className={`font-bold text-sm truncate leading-tight ${
                            resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {item.name}
                          </h3>
                        </div>
                        
                        {/* Price */}
                        <div className={`text-sm font-medium ml-5 ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          ₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}
                        </div>
                      </div>
                      
                      {/* Right: Quantity selector with integrated delete button */}
                      <div className="flex items-center flex-shrink-0">
                        {/* Quantity selector */}
                        <div className={`rounded-lg flex items-center gap-2 px-2.5 py-1.5 min-w-[70px] justify-center ${
                          resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-200'
                        }`}>
                          {item.quantity === 1 ? (
                            /* Delete button when quantity is 1 */
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(item.id);
                              }}
                              className="text-destructive hover:opacity-70 min-w-[24px] flex items-center justify-center transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            /* Minus button when quantity is 2 or more */
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuantity(item.id, item.quantity - 1);
                              }}
                              className={`font-bold text-sm hover:opacity-70 min-w-[24px] flex items-center justify-center ${
                                resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              }`}
                            >
                              -
                            </button>
                          )}
                          <span className={`font-bold text-sm min-w-[24px] text-center ${
                            resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQuantity(item.id, item.quantity + 1);
                            }}
                            className={`font-bold text-sm hover:opacity-70 min-w-[24px] flex items-center justify-center ${
                              resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </div>

            {/* Show More/Show Less Button */}
            {cart.length > 5 && (
              <div className="flex justify-center pb-4 mb-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAllItems(!showAllItems)}
                  className={`w-full ${
                    resolvedTheme === 'dark' 
                      ? 'border-gray-700 hover:bg-gray-800 hover:text-gray-100' 
                      : 'border-gray-300 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {showAllItems ? 'Show Less' : `Show More (${cart.length - 5} more items)`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Fixed Checkout Summary - Above Bottom Navigation */}
      {cart.length > 0 && (
        <div 
          className={`fixed left-0 right-0 z-[9998] ${
            resolvedTheme === 'dark' 
              ? 'bg-[#1a1a1a] border-t border-gray-800' 
              : 'bg-white border-t border-gray-200'
          }`}
          style={{
            bottom: 'calc(64px + 6px + env(safe-area-inset-bottom, 0px))',
            paddingTop: '16px',
            paddingBottom: '16px',
            paddingLeft: '16px',
            paddingRight: '16px',
            boxShadow: resolvedTheme === 'dark' 
              ? '0 -4px 6px -1px rgba(0, 0, 0, 0.3)' 
              : '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center justify-between gap-4 max-w-full">
            {/* Left: Total Text and Price */}
            <div className="flex flex-col justify-center flex-shrink-0">
              <span className={`text-xs leading-tight ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total shopping cart
              </span>
              <span className={`text-xl font-bold leading-tight mt-0.5 ${
                resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                ₹{getTotalPrice()}
              </span>
            </div>
            
            {/* Right: Continue to Checkout Button */}
            <Button
              onClick={proceedToCheckout}
              disabled={
                isStockLoading || 
                isValidatingForCheckout ||
                !!(currentCanteenId && cart.length > 0 && !validateCartCanteen(currentCanteenId))
              }
              className="flex-1 min-w-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              size="lg"
            >
              {isStockLoading || isValidatingForCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isValidatingForCheckout ? 'Validating...' : 'Checking...'}
                </>
              ) : !validationResult.isValid ? (
                "Stock Issues"
              ) : (
                "Continue to checkout"
              )}
            </Button>
          </div>
        </div>
      )}
      
      <BottomNavigation currentPage="cart" />
      </div>

      {/* Stock Validation Dialog */}
      <AlertDialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <AlertDialogContent className={`max-w-md max-h-[80vh] overflow-y-auto ${
          resolvedTheme === 'dark' 
            ? 'bg-[#1a1a1a] border-gray-800' 
            : 'bg-white border-gray-200'
        }`}>
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${
                resolvedTheme === 'dark' 
                  ? 'bg-red-900/50 border border-red-800/50' 
                  : 'bg-red-100'
              } rounded-full flex items-center justify-center`}>
                <Package className={`w-5 h-5 ${
                  resolvedTheme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <AlertDialogTitle className={`${
                resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Stock Issues Detected
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className={`pt-2 ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Some items in your cart are no longer available or have insufficient stock. Please review and update your cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {checkoutValidationResult && !checkoutValidationResult.isValid && (
            <div className="space-y-3 py-4">
              {checkoutValidationResult.errors.map((error, index) => {
                const isOutOfStock = error.available === 0;
                const isInsufficient = error.available > 0 && error.available < error.requested;
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      resolvedTheme === 'dark'
                        ? isOutOfStock
                          ? 'bg-red-950/30 border-red-800/50'
                          : 'bg-orange-950/30 border-orange-800/50'
                        : isOutOfStock
                          ? 'bg-red-50 border-red-200'
                          : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${
                            isOutOfStock ? 'bg-red-500' : 'bg-orange-500'
                          }`}></div>
                          <span className={`font-semibold ${
                            resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {error.itemName}
                          </span>
                          <Badge
                            variant={isOutOfStock ? "destructive" : "outline"}
                            className={`text-xs ${
                              resolvedTheme === 'dark'
                                ? isOutOfStock
                                  ? 'bg-red-900/50 border-red-800 text-red-300'
                                  : 'border-orange-800/50 text-orange-400 bg-orange-950/30'
                                : ''
                            }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : `Only ${error.available} available`}
                          </Badge>
                        </div>
                        <p className={`text-sm ml-4 ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {error.message}
                        </p>
                        {isInsufficient && (
                          <p className={`text-xs mt-1 ml-4 ${
                            resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            You requested: {error.requested} | Available: {error.available}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleRemoveItemFromValidation(error.itemId);
                          // Close dialog if this was the last error
                          const remainingErrors = checkoutValidationResult.errors.filter(
                            (e, i) => i !== index
                          );
                          if (remainingErrors.length === 0) {
                            setShowStockDialog(false);
                            setCheckoutValidationResult(null);
                          } else {
                            setCheckoutValidationResult({
                              ...checkoutValidationResult,
                              errors: remainingErrors
                            });
                          }
                        }}
                        className={`${
                          resolvedTheme === 'dark'
                            ? isOutOfStock
                              ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                              : 'text-orange-400 hover:bg-orange-900/30 hover:text-orange-300'
                            : isOutOfStock
                              ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                              : 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                        } transition-colors`}
                        title="Remove item from cart"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel className={
              resolvedTheme === 'dark' 
                ? 'border-gray-700 hover:bg-gray-800' 
                : 'border-gray-300 hover:bg-gray-100'
            }>
              Update Cart
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowStockDialog(false);
                setCheckoutValidationResult(null);
                // Refresh stock validation after closing
                refetchStock();
              }}
              className="bg-primary hover:bg-primary/90"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
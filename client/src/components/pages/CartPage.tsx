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
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Loader2, AlertTriangle, Package, X, ArrowRight, ShoppingBag } from "lucide-react";
import { useStockValidation } from "@/hooks/useStockValidation";
import StockValidationWarning from "@/components/canteen/StockValidationWarning";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useReducedMotion } from "@/utils/dropdownAnimations";
import { getUserFromStorage } from "@/utils/userStorage";
import { apiRequest } from "@/lib/queryClient";
import { updateStatusBarColor } from "@/utils/statusBar";

export default function CartPage() {
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const { cart, updateQuantity, removeFromCart, getTotalPrice, getTotalItems, clearCart, getCartCanteenId, validateCartCanteen } = useCart();
  const { selectedCanteen } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // Update status bar to match header color
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      updateStatusBarColor('hsl(270, 40%, 8%)'); // Exact dark mode background
    } else {
      updateStatusBarColor('hsl(280, 30%, 98%)'); // Exact light mode background
    }
  }, [resolvedTheme]);

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
      clearTimeout(debouncedRefetchStock.current); a
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
        className={`w-full h-auto min-h-fit flex flex-col bg-background`}
      >
        {/* Header */}
        <div className={`px-4 pt-12 pb-6 rounded-b-2xl flex-shrink-0 ${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'
          }`}>
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
                className={`${resolvedTheme === 'dark' ? 'text-gray-100 hover:bg-gray-800' : 'text-gray-900 hover:bg-gray-100'
                  }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className={`text-xl font-bold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>My Cart</h1>
                <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                  {cart.length > 0 ? `${getTotalItems()} items` : "Your cart is empty"}
                </p>
              </div>

            </div>
            {cart.length > 0 && (
              <Badge variant="secondary" className={`${resolvedTheme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'
                }`}>
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
              ? 'calc(100px + env(safe-area-inset-bottom, 0px))'
              : 'calc(40px + env(safe-area-inset-bottom, 0px))'
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
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-100'
                }`}>
                <ShoppingCart className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                Your cart is empty
              </h3>
              <p className={`mb-4 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
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
                <div className="space-y-4">
                  <Card className={`rounded-3xl border-0 overflow-hidden transition-all duration-300 ${resolvedTheme === 'dark'
                    ? 'bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/10'
                    : 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5'
                    }`}>
                    <CardContent className="p-0">
                      <div>
                        {(showAllItems ? cart : cart.slice(0, 5)).map((item, index, array) => (
                          <div key={item.id} className={`${index !== array.length - 1 ? 'border-b border-dashed border-gray-100 dark:border-gray-800' : ''
                            } transition-colors hover:bg-gray-50/50 dark:hover:bg-white/5`}>
                            <div className="flex items-center p-3 gap-3">
                              {/* Left: Product image - compacted */}
                              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 dark:border-gray-800">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-full h-full flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-100'
                                    }`}>
                                    <ShoppingBag className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                              </div>

                              {/* Center: Info */}
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-start justify-start gap-1.5 mb-1">
                                  <h3 className={`font-bold text-[15px] leading-tight line-clamp-1 ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                                    }`}>
                                    {item.name}
                                  </h3>
                                  {/* Veg/Non-veg Indicator */}
                                  <div className={`w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5 border ${item.isVegetarian
                                    ? 'border-green-600'
                                    : 'border-red-600'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.isVegetarian ? 'bg-green-600' : 'bg-red-600'
                                      }`}></div>
                                  </div>
                                </div>

                                <div className="flex items-baseline gap-2">
                                  <p className={`text-sm font-semibold ${resolvedTheme === 'dark' ? 'text-violet-400' : 'text-violet-600'}`}>
                                    ₹{item.price}
                                  </p>
                                  {item.quantity > 1 && (
                                    <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                      Total: <span className={resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>₹{item.price * item.quantity}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Right: Quantity Controls - Compact Pill */}
                              <div className="flex flex-col items-end gap-1">
                                <div className={`flex items-center rounded-full p-0.5 h-8 border ${resolvedTheme === 'dark'
                                  ? 'bg-gray-900 border-gray-800'
                                  : 'bg-white border-gray-200 shadow-sm'
                                  }`}>
                                  {item.quantity === 1 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveItem(item.id);
                                      }}
                                      className="w-7 h-7 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateQuantity(item.id, item.quantity - 1);
                                      }}
                                      className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${resolvedTheme === 'dark'
                                        ? 'hover:bg-gray-800 text-gray-300'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <span className={`w-6 text-center font-bold text-sm ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                    {item.quantity}
                                  </span>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateQuantity(item.id, item.quantity + 1);
                                    }}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${resolvedTheme === 'dark'
                                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                      }`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Show More/Show Less Button */}
              {cart.length > 5 && (
                <div className="flex justify-center pb-4 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllItems(!showAllItems)}
                    className={`w-full ${resolvedTheme === 'dark'
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

        {/* Premium Floating Checkout Card */}
        {cart.length > 0 && (
          <div
            className="fixed left-4 right-4 z-[9998]"
            style={{
              bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Ambient glow effect */}
            <div
              className="absolute inset-x-4 -bottom-2 h-20 rounded-3xl blur-2xl pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.4), rgba(192, 132, 252, 0.3))',
                opacity: 0.6,
              }}
            />

            <button
              onClick={proceedToCheckout}
              disabled={
                isStockLoading ||
                isValidatingForCheckout ||
                !!(currentCanteenId && cart.length > 0 && !validateCartCanteen(currentCanteenId))
              }
              className="relative w-full overflow-hidden rounded-[20px] transition-all duration-300 active:scale-[0.98] hover:scale-[1.005] group disabled:opacity-80 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(168, 85, 247, 0.95) 50%, rgba(147, 51, 234, 0.95) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: `
                  0 20px 60px -15px rgba(139, 92, 246, 0.5),
                  0 10px 30px -10px rgba(0, 0, 0, 0.3),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              {/* Animated gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)',
                }}
              />

              {/* Shimmer effect on hover - Only if not loading/disabled */}
              {!(isStockLoading || isValidatingForCheckout) && (
                <div
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
                  }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between px-5 py-4">
                {/* Left side - Image and Total info */}
                <div className="flex items-center gap-4">
                  {/* Icon/Image container with glass effect */}
                  <div className="relative">
                    {cart.length > 0 && cart[0].imageUrl ? (
                      <div
                        className="w-12 h-12 rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                        style={{
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <img
                          src={cart[0].imageUrl}
                          alt={cart[0].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1))',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    {/* Item count badge */}
                    <div
                      className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff, #f0f0f0)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <span className="text-[11px] font-bold text-violet-600">
                        {getTotalItems() > 99 ? '99+' : getTotalItems()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                      Total to pay
                    </span>
                    <span className="text-white font-bold text-2xl tracking-tight">
                      ₹{getTotalPrice()}
                    </span>
                  </div>
                </div>

                {/* Right side - Action Button Look */}
                <div
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 ${isStockLoading || isValidatingForCheckout
                    ? 'bg-white/10'
                    : 'bg-white/20 group-hover:bg-white/25 shadow-sm'
                    }`}
                >
                  {isStockLoading || isValidatingForCheckout ? (
                    <>
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                      <span className="text-white font-semibold text-base">
                        {isValidatingForCheckout ? 'Validating...' : 'Checking...'}
                      </span>
                    </>
                  ) : !validationResult.isValid ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-red-200" />
                      <span className="text-white font-semibold text-base">
                        Stock Issues
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-white font-bold text-lg tracking-tight">
                        Checkout
                      </span>
                      <div className="w-6 h-6 rounded-full bg-white text-violet-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <ArrowRight className="w-4 h-4" strokeWidth={3} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

      </div>

      {/* Stock Validation Dialog */}
      <AlertDialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <AlertDialogContent className={`max-w-md max-h-[80vh] overflow-y-auto ${resolvedTheme === 'dark'
          ? 'bg-[#1a1a1a] border-gray-800'
          : 'bg-white border-gray-200'
          }`}>
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${resolvedTheme === 'dark'
                ? 'bg-red-900/50 border border-red-800/50'
                : 'bg-red-100'
                } rounded-full flex items-center justify-center`}>
                <Package className={`w-5 h-5 ${resolvedTheme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`} />
              </div>
              <AlertDialogTitle className={`${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                Stock Issues Detected
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className={`pt-2 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
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
                    className={`p-3 rounded-lg border ${resolvedTheme === 'dark'
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
                          <div className={`w-2 h-2 rounded-full ${isOutOfStock ? 'bg-red-500' : 'bg-orange-500'
                            }`}></div>
                          <span className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                            {error.itemName}
                          </span>
                          <Badge
                            variant={isOutOfStock ? "destructive" : "outline"}
                            className={`text-xs ${resolvedTheme === 'dark'
                              ? isOutOfStock
                                ? 'bg-red-900/50 border-red-800 text-red-300'
                                : 'border-orange-800/50 text-orange-400 bg-orange-950/30'
                              : ''
                              }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : `Only ${error.available} available`}
                          </Badge>
                        </div>
                        <p className={`text-sm ml-4 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                          {error.message}
                        </p>
                        {isInsufficient && (
                          <p className={`text-xs mt-1 ml-4 ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
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
                        className={`${resolvedTheme === 'dark'
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
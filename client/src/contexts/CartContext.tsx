import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVegetarian: boolean;
  canteenId: string; // Add canteen ID to track which canteen the item belongs to
  category?: string; // Add category information
  description?: string; // Item description
  imageUrl?: string; // Item image URL
  addedAt?: number; // Timestamp when item was added (for price staleness tracking)
  storeCounterId?: string; // Store counter ID for this menu item
  paymentCounterId?: string; // Payment counter ID for this menu item
}

export type CartPendingItem = {
  item: { id: string | number; name: string; price: number; isVegetarian: boolean; canteenId: string; category?: string; description?: string; imageUrl?: string; storeCounterId?: string; paymentCounterId?: string };
  quantity: number;
};

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: { id: string | number; name: string; price: number; isVegetarian: boolean; canteenId: string; category?: string; description?: string; imageUrl?: string; storeCounterId?: string; paymentCounterId?: string }, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, newQuantity: number) => void;
  decreaseQuantity: (itemId: string | number) => void;
  getCartQuantity: (itemId: string | number) => number;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  clearCart: () => void;
  getCartCanteenId: () => string | null;
  clearCartForCanteen: (canteenId: string) => void;
  validateCartCanteen: (canteenId: string) => boolean;
  initializeCartForCanteen: (canteenId: string) => void;
  // Canteen conflict detection
  canteenConflict: boolean;
  pendingItem: CartPendingItem | null;
  confirmCanteenSwitch: () => void;
  cancelCanteenSwitch: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'digital-canteen-cart';
const CART_STORAGE_PREFIX = 'digital-canteen-cart-';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentCanteenId, setCurrentCanteenId] = useState<string | null>(null);
  const [canteenConflict, setCanteenConflict] = useState(false);
  const [pendingItem, setPendingItem] = useState<CartPendingItem | null>(null);

  // Refs to read current values without adding them as callback dependencies
  // (prevents infinite re-render loops when CanteenContext uses initializeCartForCanteen in a useEffect)
  const cartRef = useRef(cart);
  const currentCanteenIdRef = useRef(currentCanteenId);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { currentCanteenIdRef.current = currentCanteenId; }, [currentCanteenId]);

  // Get canteen-specific storage key
  const getCanteenStorageKey = (canteenId: string) => `${CART_STORAGE_PREFIX}${canteenId}`;

  // Load cart for specific canteen
  const loadCartForCanteen = useCallback((canteenId: string) => {
    try {
      const storageKey = getCanteenStorageKey(canteenId);
      const savedCart = localStorage.getItem(storageKey);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);

        // Validate cart items have string IDs (MongoDB ObjectIds) and correct canteenId
        const isValidCart = Array.isArray(parsedCart) &&
          parsedCart.every(item =>
            typeof item.id === 'string' &&
            item.id.length > 10 &&
            item.canteenId === canteenId
          );

        if (isValidCart) {
          setCart(parsedCart);
          setCurrentCanteenId(canteenId);
          console.log(`🛒 Loaded cart for canteen ${canteenId}:`, parsedCart.length, 'items');
        } else {
          // Clear invalid cart data
          console.warn(`Clearing invalid cart data for canteen ${canteenId}`);
          localStorage.removeItem(storageKey);
          setCart([]);
          setCurrentCanteenId(canteenId);
        }
      } else {
        // No cart for this canteen, start fresh
        setCart([]);
        setCurrentCanteenId(canteenId);
        console.log(`🛒 No existing cart for canteen ${canteenId}, starting fresh`);
      }
    } catch (error) {
      console.error(`Failed to load cart for canteen ${canteenId}:`, error);
      setCart([]);
      setCurrentCanteenId(canteenId);
    }
  }, []);

  // Save cart to canteen-specific localStorage
  const saveCartForCanteen = useCallback((canteenId: string, cartData: CartItem[]) => {
    try {
      const storageKey = getCanteenStorageKey(canteenId);
      localStorage.setItem(storageKey, JSON.stringify(cartData));
      console.log(`🛒 Saved cart for canteen ${canteenId}:`, cartData.length, 'items');
    } catch (error) {
      console.error(`Failed to save cart for canteen ${canteenId}:`, error);
    }
  }, []);

  // Save cart to localStorage whenever cart changes
  useEffect(() => {
    if (currentCanteenId && cart.length >= 0) {
      saveCartForCanteen(currentCanteenId, cart);
      console.log(`🛒 Cart state updated for canteen ${currentCanteenId}:`, cart.length, 'items');

      // Dispatch custom event for same-tab synchronization
      window.dispatchEvent(new CustomEvent('cartUpdated', {
        detail: { canteenId: currentCanteenId, cart }
      }));
    }
  }, [cart, currentCanteenId, saveCartForCanteen]);

  // Cross-tab synchronization: Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only handle cart-related storage changes
      if (!e.key || !e.key.startsWith(CART_STORAGE_PREFIX)) {
        return;
      }

      // Extract canteen ID from storage key
      const canteenId = e.key.replace(CART_STORAGE_PREFIX, '');

      // Only sync if it's for the current canteen
      if (canteenId === currentCanteenId && e.newValue) {
        try {
          const parsedCart = JSON.parse(e.newValue);
          const isValidCart = Array.isArray(parsedCart) &&
            parsedCart.every(item =>
              typeof item.id === 'string' &&
              item.id.length > 10 &&
              item.canteenId === canteenId
            );

          if (isValidCart) {
            console.log(`🔄 Cart synced from other tab for canteen ${canteenId}`);
            setCart(parsedCart);
          }
        } catch (error) {
          console.error('Error parsing cart from storage event:', error);
        }
      }
    };

    // Listen for storage events (from other tabs)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (from same tab)
    const handleCartUpdate = (e: CustomEvent) => {
      // Ignore events from same tab to prevent loops
      if (e.detail?.canteenId === currentCanteenId) {
        // Only update if cart is different to prevent unnecessary re-renders
        const currentCartStr = JSON.stringify(cart);
        const newCartStr = JSON.stringify(e.detail.cart);
        if (currentCartStr !== newCartStr) {
          setCart(e.detail.cart);
        }
      }
    };

    window.addEventListener('cartUpdated', handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleCartUpdate as EventListener);
    };
  }, [currentCanteenId, cart]);

  // Clear cart on logout
  useEffect(() => {
    const handleLogout = () => {
      console.log('🛒 Clearing cart on logout');
      // Clear all canteen-specific carts
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CART_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      // Also clear legacy key
      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
      setCurrentCanteenId(null);
    };

    window.addEventListener('userAuthChange', handleLogout);

    // Also check if user was logged out by checking localStorage
    const checkUserLogout = () => {
      const user = localStorage.getItem('user');
      const tempUser = localStorage.getItem('temp_user_session');
      if (!user && !tempUser && cart.length > 0) {
        handleLogout();
      }
    };

    // Check on mount and periodically
    checkUserLogout();
    const interval = setInterval(checkUserLogout, 1000);

    return () => {
      window.removeEventListener('userAuthChange', handleLogout);
      clearInterval(interval);
    };
  }, [cart]);

  // Internal helper to actually add the item to the cart (no conflict check)
  const addItemInternal = useCallback((item: { id: string | number; name: string; price: number; isVegetarian: boolean; canteenId: string; category?: string; description?: string; imageUrl?: string; storeCounterId?: string; paymentCounterId?: string }, quantity: number) => {
    const itemId = item.id.toString();

    if (!currentCanteenId || currentCanteenId !== item.canteenId) {
      console.log(`🛒 Switching from canteen ${currentCanteenId} to ${item.canteenId}`);
      const storageKey = getCanteenStorageKey(item.canteenId);
      let loadedCart: CartItem[] = [];

      try {
        const savedCart = localStorage.getItem(storageKey);
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          const isValidCart = Array.isArray(parsedCart) &&
            parsedCart.every(cartItem =>
              typeof cartItem.id === 'string' &&
              cartItem.id.length > 10 &&
              cartItem.canteenId === item.canteenId
            );
          if (isValidCart) {
            loadedCart = parsedCart;
          }
        }
      } catch (error) {
        console.error(`Failed to load cart for canteen ${item.canteenId}:`, error);
      }

      setCurrentCanteenId(item.canteenId);

      setCart(currentCart => {
        const baseCart = loadedCart.length > 0 ? loadedCart : currentCart;
        const existingItemIndex = baseCart.findIndex(cartItem => cartItem.id === itemId);

        let newCart: CartItem[];
        if (existingItemIndex >= 0) {
          newCart = baseCart.map((cartItem, index) =>
            index === existingItemIndex
              ? { ...cartItem, quantity: cartItem.quantity + quantity }
              : cartItem
          );
        } else {
          newCart = [...baseCart, {
            ...item,
            id: itemId,
            quantity,
            addedAt: Date.now()
          }];
        }
        return newCart;
      });
    } else {
      console.log('🛒 Adding item to same canteen cart');
      setCart(currentCart => {
        const existingItemIndex = currentCart.findIndex(cartItem => cartItem.id === itemId);

        let newCart: CartItem[];
        if (existingItemIndex >= 0) {
          newCart = currentCart.map((cartItem, index) =>
            index === existingItemIndex
              ? { ...cartItem, quantity: cartItem.quantity + quantity }
              : cartItem
          );
        } else {
          newCart = [...currentCart, {
            ...item,
            id: itemId,
            quantity,
            addedAt: Date.now()
          }];
        }
        return newCart;
      });
    }
  }, [currentCanteenId, getCanteenStorageKey]);

  const addToCart = useCallback((item: { id: string | number; name: string; price: number; isVegetarian: boolean; canteenId: string; category?: string; description?: string; storeCounterId?: string; paymentCounterId?: string }, quantity = 1) => {
    const itemId = item.id.toString();

    console.log('🛒 CartContext addToCart called:', {
      itemId,
      itemName: item.name,
      canteenId: item.canteenId,
      currentCanteenId,
      quantity,
      storeCounterId: item.storeCounterId,
      paymentCounterId: item.paymentCounterId
    });

    // Validate counter IDs are present (REQUIRED)
    if (!item.storeCounterId || !item.paymentCounterId) {
      console.error('❌ CartContext: Item missing counter IDs when adding to cart:', {
        itemId,
        itemName: item.name,
        storeCounterId: item.storeCounterId,
        paymentCounterId: item.paymentCounterId
      });
      throw new Error(`Counter IDs are required for "${item.name}". Please refresh the page and add the item again.`);
    }

    // Canteen conflict detection: if cart has items from a different canteen, prompt the user
    if (currentCanteenId && currentCanteenId !== item.canteenId && cart.length > 0) {
      console.log(`🛒 Canteen conflict detected: cart has items from ${currentCanteenId}, trying to add from ${item.canteenId}`);
      setPendingItem({ item, quantity });
      setCanteenConflict(true);
      return; // Don't add yet — wait for user confirmation
    }

    // No conflict, add directly
    addItemInternal(item, quantity);
  }, [currentCanteenId, cart.length, addItemInternal]);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(currentCart => currentCart.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(currentCart =>
      currentCart.map(item =>
        item.id === itemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }, [removeFromCart]);

  const decreaseQuantity = useCallback((itemId: string | number) => {
    const id = itemId.toString();
    setCart(currentCart => {
      const item = currentCart.find(cartItem => cartItem.id === id);
      if (item) {
        if (item.quantity > 1) {
          return currentCart.map(cartItem =>
            cartItem.id === id
              ? { ...cartItem, quantity: cartItem.quantity - 1 }
              : cartItem
          );
        } else {
          return currentCart.filter(cartItem => cartItem.id !== id);
        }
      }
      return currentCart;
    });
  }, []);

  const getCartQuantity = useCallback((itemId: string | number) => {
    if (itemId === undefined || itemId === null) {
      return 0;
    }
    const id = itemId.toString();
    const item = cart.find(cartItem => cartItem.id === id);
    return item ? item.quantity : 0;
  }, [cart]);

  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const getTotalPrice = useCallback(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  const clearCart = useCallback(() => {
    if (currentCanteenId) {
      // Clear the canteen-specific cart
      const storageKey = getCanteenStorageKey(currentCanteenId);
      localStorage.removeItem(storageKey);
    }
    // Also clear the legacy key if it exists
    localStorage.removeItem(CART_STORAGE_KEY);
    setCart([]);
    setCurrentCanteenId(null);
  }, [currentCanteenId]);

  const getCartCanteenId = useCallback(() => {
    return currentCanteenId;
  }, [currentCanteenId]);

  const clearCartForCanteen = useCallback((canteenId: string) => {
    if (currentCanteenId && currentCanteenId !== canteenId) {
      console.log(`🛒 Clearing cart for canteen switch: ${currentCanteenId} -> ${canteenId}`);
      // Load the new canteen's cart instead of clearing
      loadCartForCanteen(canteenId);
    }
  }, [currentCanteenId, loadCartForCanteen]);

  const validateCartCanteen = useCallback((canteenId: string) => {
    return !currentCanteenId || currentCanteenId === canteenId;
  }, [currentCanteenId]);

  const initializeCartForCanteen = useCallback((canteenId: string) => {
    const curCanteen = currentCanteenIdRef.current;
    const curCartLen = cartRef.current.length;
    console.log(`🛒 Initializing cart for canteen: ${canteenId}, current: ${curCanteen}, cart items: ${curCartLen}`);

    // If the cart already has items from a DIFFERENT canteen, do NOT switch.
    // The cart stays showing the old canteen's items until the user explicitly
    // confirms a switch via the conflict dialog (triggered by addToCart).
    if (curCanteen && curCanteen !== canteenId && curCartLen > 0) {
      console.log(`🛒 Cart has ${curCartLen} items from canteen ${curCanteen} — keeping current cart (conflict will trigger on addToCart)`);
      return;
    }

    // No items or same canteen — safe to load/switch
    loadCartForCanteen(canteenId);
  }, [loadCartForCanteen]);

  // Confirm canteen switch: clear current cart and add the pending item
  const confirmCanteenSwitch = useCallback(() => {
    if (!pendingItem) return;

    console.log('🛒 Confirming canteen switch — clearing cart and adding pending item');

    // Clear the current canteen's cart from storage
    if (currentCanteenId) {
      const storageKey = getCanteenStorageKey(currentCanteenId);
      localStorage.removeItem(storageKey);
    }
    localStorage.removeItem(CART_STORAGE_KEY);
    setCart([]);
    setCurrentCanteenId(null);

    // Now add the pending item (will switch canteen context)
    const { item, quantity } = pendingItem;
    setPendingItem(null);
    setCanteenConflict(false);

    // Use setTimeout to ensure state is cleared before adding
    setTimeout(() => {
      addItemInternal(item, quantity);
    }, 0);
  }, [pendingItem, currentCanteenId, getCanteenStorageKey, addItemInternal]);

  // Cancel canteen switch: discard the pending item
  const cancelCanteenSwitch = useCallback(() => {
    console.log('🛒 Canteen switch cancelled');
    setPendingItem(null);
    setCanteenConflict(false);
  }, []);

  const value: CartContextType = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    decreaseQuantity,
    getCartQuantity,
    getTotalItems,
    getTotalPrice,
    clearCart,
    getCartCanteenId,
    clearCartForCanteen,
    validateCartCanteen,
    initializeCartForCanteen,
    canteenConflict,
    pendingItem,
    confirmCanteenSwitch,
    cancelCanteenSwitch,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
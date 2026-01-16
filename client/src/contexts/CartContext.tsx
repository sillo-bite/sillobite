import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  getCartCanteenId: () => string | null; // Get the canteen ID for items in cart
  clearCartForCanteen: (canteenId: string) => void; // Load cart for specific canteen
  validateCartCanteen: (canteenId: string) => boolean; // Validate if cart items belong to current canteen
  initializeCartForCanteen: (canteenId: string) => void; // Initialize cart for a specific canteen
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'digital-canteen-cart';
const CART_STORAGE_PREFIX = 'digital-canteen-cart-';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentCanteenId, setCurrentCanteenId] = useState<string | null>(null);

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

  const addToCart = useCallback((item: { id: string | number; name: string; price: number; isVegetarian: boolean; canteenId: string; category?: string; description?: string; storeCounterId?: string; paymentCounterId?: string }, quantity = 1) => {
    const itemId = item.id.toString(); // Ensure string ID
    
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
    
    // If switching to a different canteen, or if no canteen is currently selected, load that canteen's cart first
    if (!currentCanteenId || currentCanteenId !== item.canteenId) {
      console.log(`🛒 Switching from canteen ${currentCanteenId} to ${item.canteenId}`);
      // Load the cart synchronously first
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
      
      // Set the canteen ID and loaded cart
      setCurrentCanteenId(item.canteenId);
      
      // Now add the item to the loaded cart
      setCart(currentCart => {
        // Use loaded cart if available, otherwise use current cart
        const baseCart = loadedCart.length > 0 ? loadedCart : currentCart;
        const existingItemIndex = baseCart.findIndex(cartItem => cartItem.id === itemId);
        
        let newCart: CartItem[];
        if (existingItemIndex >= 0) {
          // Item exists, increase quantity
          newCart = baseCart.map((cartItem, index) =>
            index === existingItemIndex
              ? { ...cartItem, quantity: cartItem.quantity + quantity }
              : cartItem
          );
        } else {
          // New item, add to cart with timestamp
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
      // Same canteen, add item normally
      console.log('🛒 Adding item to same canteen cart');
      setCart(currentCart => {
        const existingItemIndex = currentCart.findIndex(cartItem => cartItem.id === itemId);
        
        let newCart: CartItem[];
        if (existingItemIndex >= 0) {
          // Item exists, increase quantity
          console.log('🛒 Item exists, increasing quantity');
          newCart = currentCart.map((cartItem, index) =>
            index === existingItemIndex
              ? { ...cartItem, quantity: cartItem.quantity + quantity }
              : cartItem
          );
        } else {
          // New item, add to cart with timestamp
          console.log('🛒 New item, adding to cart');
          newCart = [...currentCart, { 
            ...item, 
            id: itemId, 
            quantity,
            addedAt: Date.now()
          }];
        }
        
        console.log('🛒 New cart state:', newCart);
        return newCart;
      });
    }

  }, [currentCanteenId, getCanteenStorageKey]);

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
    console.log(`🛒 Initializing cart for canteen: ${canteenId}`);
    loadCartForCanteen(canteenId);
  }, [loadCartForCanteen]);

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
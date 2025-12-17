import { useState, useEffect } from 'react';
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface StockValidationResult {
  isValid: boolean;
  errors: Array<{
    itemId: string;
    itemName: string;
    requested: number;
    available: number;
    message: string;
  }>;
  items: Array<{
    id: string;
    stock: number;
    available: boolean;
  }>;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export function useStockValidation(cartItems: CartItem[]) {
  const queryClient = useQueryClient();
  const [validationResult, setValidationResult] = useState<StockValidationResult>({
    isValid: true,
    errors: [],
    items: []
  });

  // Get item IDs from cart and create stable query key
  // Sort IDs to ensure consistent query key even if order changes
  const itemIds = React.useMemo(() => {
    const ids = cartItems.map(item => item.id);
    return [...ids].sort(); // Sort to ensure consistent key
  }, [cartItems]);

  // Create stable query key using stringified sorted IDs
  const queryKey = React.useMemo(() => {
    return ['/api/stock/status', itemIds.join(',')];
  }, [itemIds]);

  // Debounce refetch to prevent rapid successive calls
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const [debouncedItemIds, setDebouncedItemIds] = React.useState(itemIds);

  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setDebouncedItemIds(itemIds);
    }, 300); // Debounce by 300ms

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [itemIds]);

  // Fetch stock status for all items in cart
  const { data: stockData, isLoading, error, refetch: refetchQuery } = useQuery({
    queryKey: ['/api/stock/status', debouncedItemIds.join(',')],
    queryFn: async () => {
      if (debouncedItemIds.length === 0) return [];
      
      try {
        const response = await apiRequest(`/api/stock/status?${debouncedItemIds.map(id => `itemIds=${id}`).join('&')}`);
        return response;
      } catch (error) {
        console.error('Stock validation API error:', error);
        // Return empty array on error to allow graceful degradation
        // Validation will show items as potentially unavailable
        return [];
      }
    },
    enabled: debouncedItemIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Validate stock when cart items or stock data changes
  useEffect(() => {
    // Handle error state
    if (error) {
      console.error('Stock validation error:', error);
      // On error, mark validation as invalid but don't show specific errors
      // This allows user to retry
      setValidationResult({
        isValid: false,
        errors: [{
          itemId: '',
          itemName: 'Stock check failed',
          requested: 0,
          available: 0,
          message: 'Unable to verify stock availability. Please try again.'
        }],
        items: []
      });
      return;
    }

    if (!stockData || cartItems.length === 0) {
      setValidationResult({
        isValid: true,
        errors: [],
        items: []
      });
      return;
    }

    const errors: StockValidationResult['errors'] = [];
    
    // Check each cart item against stock availability
    cartItems.forEach(cartItem => {
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

    setValidationResult({
      isValid: errors.length === 0,
      errors,
      items: stockData
    });
  }, [cartItems, stockData, error]);

  // Debounced refetch function
  const debouncedRefetchRef = React.useRef<NodeJS.Timeout | null>(null);
  const refetch = React.useCallback(async () => {
    if (debouncedRefetchRef.current) {
      clearTimeout(debouncedRefetchRef.current);
    }
    
    debouncedRefetchRef.current = setTimeout(async () => {
      // Only refetch the query - invalidateQueries is redundant and causes duplicate calls
      await refetchQuery();
    }, 300); // Debounce refetch by 300ms
  }, [refetchQuery]);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedRefetchRef.current) {
        clearTimeout(debouncedRefetchRef.current);
      }
    };
  }, []);

  return {
    validationResult,
    isLoading,
    error,
    refetch
  };
}




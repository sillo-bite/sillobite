import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket, UseWebSocketOptions } from './useWebSocket';
export interface UseMultiCanteenWebSocketOptions {
  canteenIds: string[];
  enabled?: boolean;
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
}

export function useMultiCanteenWebSocket({
  canteenIds,
  enabled = true,
  onNewOrder,
  onOrderUpdate
}: UseMultiCanteenWebSocketOptions) {
  const queryClient = useQueryClient();

  // Handle new order updates
  const handleNewOrder = useCallback((order: any) => {
    // For new orders, we need to refetch to get the full list
    // But only invalidate, don't refetch immediately - let components handle it
    queryClient.invalidateQueries({ queryKey: ['/api/orders', order.canteenId] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });
    
    // Call custom handler if provided
    onNewOrder?.(order);
  }, [queryClient, onNewOrder]);

  // Handle order updates - use cache updates instead of invalidations
  const handleOrderUpdate = useCallback((order: any) => {
    // Update cache directly for paginated queries to avoid refetch
    queryClient.setQueryData(['/api/orders/paginated'], (oldData: any) => {
      if (!oldData?.items) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((o: any) => 
          o.id === order.id || o.orderNumber === order.orderNumber
            ? { ...o, ...order }
            : o
        )
      };
    });
    
    queryClient.setQueryData(['/api/orders/active/paginated'], (oldData: any) => {
      if (!oldData?.items) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((o: any) => 
          o.id === order.id || o.orderNumber === order.orderNumber
            ? { ...o, ...order }
            : o
        )
      };
    });
    
    // Call custom handler if provided
    onOrderUpdate?.(order);
  }, [queryClient, onOrderUpdate]);

  // Handle order status changes - use cache updates instead of invalidations
  const handleOrderStatusChange = useCallback((order: any, oldStatus: string, newStatus: string) => {
    // Update cache directly to avoid refetch
    queryClient.setQueryData(['/api/orders/paginated'], (oldData: any) => {
      if (!oldData?.items) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((o: any) => 
          o.id === order.id || o.orderNumber === order.orderNumber
            ? { ...o, ...order }
            : o
        )
      };
    });
    
    queryClient.setQueryData(['/api/orders/active/paginated'], (oldData: any) => {
      if (!oldData?.items) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((o: any) => 
          o.id === order.id || o.orderNumber === order.orderNumber
            ? { ...o, ...order }
            : o
        )
      };
    });
  }, [queryClient]);

  // Handle connection events
  const handleConnected = useCallback(() => {
    console.log('✅ Multi-canteen WebSocket connected');
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('❌ Multi-canteen WebSocket disconnected');
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('❌ Multi-canteen WebSocket error:', error);
    }, []);

  // Use the base WebSocket hook
  const webSocket = useWebSocket({
    canteenIds,
    enabled,
    onNewOrder: handleNewOrder,
    onOrderUpdate: handleOrderUpdate,
    onOrderStatusChange: handleOrderStatusChange,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError
  });

  return webSocket;
}

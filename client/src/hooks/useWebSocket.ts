import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl } from '@/utils/apiConfig';

export interface WebSocketMessage {
  type: 'new_order' | 'new_offline_order' | 'order_updated' | 'order_status_changed' | 'item_status_changed' | 'banner_updated' | 'payment_success' | 'payment_confirmed' | 'order_rejected' | 'connected' | 'pong' | 'checkout_session_status_changed';
  data?: any;
  oldStatus?: string;
  newStatus?: string;
  orderNumber?: string;
  message?: string;
  canteenIds?: string[];
  connectedAt?: string;
  confirmedByCounter?: string;
  rejectedByCounter?: string;
  counterId?: string;
  itemStatusByCounter?: any;
  sessionId?: string;
  timeRemaining?: number;
  status?: string;
}

export interface UseWebSocketOptions {
  canteenIds?: string[];
  counterIds?: string[]; // Add counter IDs for counter-specific rooms
  enabled?: boolean;
  onNewOrder?: (order: any) => void;
  onOrderUpdate?: (order: any) => void;
  onOrderStatusChange?: (order: any, oldStatus: string, newStatus: string) => void;
  onItemStatusChange?: (order: any) => void; // Handler for item-level status changes
  onBannerUpdate?: (data: any) => void;
  onPaymentSuccess?: (data: any) => void;
  onPaymentConfirmed?: (order: any, confirmedByCounter: string) => void;
  onOrderRejected?: (order: any, rejectedByCounter: string) => void;
  onCheckoutSessionStatusChange?: (sessionId: string, status: string, timeRemaining: number) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  joinCanteenRooms: (canteenIds: string[]) => void;
  leaveCanteenRoom: (canteenId: string) => void;
  joinCounterRoom: (counterId: string, canteenId: string) => void;
  leaveCounterRoom: (counterId: string) => void;
  sendMessage: (event: string, data: any) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    canteenIds = [],
    counterIds = [],
    enabled = true,
    onNewOrder,
    onOrderUpdate,
    onOrderStatusChange,
    onItemStatusChange,
    onBannerUpdate,
    onPaymentSuccess,
    onPaymentConfirmed,
    onOrderRejected,
    onCheckoutSessionStatusChange,
    onConnected,
    onDisconnected,
    onError
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10; // Increased for PWA scenarios
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  const visibilityCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnectRef = useRef<(() => void) | null>(null);

  // Get WebSocket URL - use centralized utility
  const getWebSocketURL = useCallback(() => {
    const wsBaseUrl = getWebSocketUrl();
    
    // Convert HTTP URL to WebSocket URL format if needed
    if (wsBaseUrl.startsWith('ws://') || wsBaseUrl.startsWith('wss://')) {
      return wsBaseUrl;
    }
    
    // Fallback: convert HTTP URL to WebSocket
    if (wsBaseUrl.startsWith('http://')) {
      return wsBaseUrl.replace('http://', 'ws://');
    }
    if (wsBaseUrl.startsWith('https://')) {
      return wsBaseUrl.replace('https://', 'wss://');
    }
    
    // Default fallback
    if (typeof window === 'undefined') return 'ws://localhost:5000';
    
    // For development, always use localhost:5000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'ws://localhost:5000';
    }
    
    // For production, use the same host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }, []);

  // Stop keepalive (defined early to avoid dependency issues)
  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    stopKeepAlive();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const socket = socketRef.current;
    if (socket) {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;
      hasConnectedRef.current = false;
    }
  }, [stopKeepAlive]);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (!enabled || socketRef.current?.connected || isConnectingRef.current || hasConnectedRef.current) {
      return;
    }

    isConnectingRef.current = true;
    hasConnectedRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      const socket = io(getWebSocketURL(), {
        transports: ['websocket', 'polling'],
        timeout: 20000, // Increased timeout for PWA scenarios
        reconnection: false, // We'll handle reconnection manually
        autoConnect: true,
        forceNew: true, // Force new connection
        upgrade: true, // Allow transport upgrades
        rememberUpgrade: false // Don't remember upgrade to prevent stale connections
      });

      socketRef.current = socket;

      // Connection event handlers
      socket.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        lastPongRef.current = Date.now();
        onConnected?.();

        // Join canteen rooms if provided
        if (canteenIds.length > 0) {
          socket.emit('joinCanteenRooms', canteenIds);
        }

        // Start keepalive ping for PWA
        stopKeepAlive(); // Clear any existing interval first
        keepAliveIntervalRef.current = setInterval(() => {
          const currentSocket = socketRef.current;
          if (currentSocket?.connected) {
            const timeSinceLastPong = Date.now() - lastPongRef.current;
            
            // If no pong received in 30 seconds, connection might be stale
            if (timeSinceLastPong > 30000) {
              console.warn('⚠️ WebSocket keepalive timeout, reconnecting...');
              // Connection is dead, trigger reconnection
              hasConnectedRef.current = false;
              reconnectAttemptsRef.current = 0;
              if (currentSocket) {
                currentSocket.disconnect();
              }
              socketRef.current = null;
              setIsConnected(false);
              // Trigger reconnection via scheduleReconnect
              // Use ref to avoid circular dependency
              if (reconnectAttemptsRef.current < maxReconnectAttempts && scheduleReconnectRef.current) {
                scheduleReconnectRef.current();
              }
            } else {
              // Send ping
              currentSocket.emit('ping');
            }
          }
        }, 15000); // Ping every 15 seconds
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        stopKeepAlive();
        onDisconnected?.();

        console.log('🔌 WebSocket disconnected:', reason);

        // Only attempt to reconnect if not a manual disconnect and we haven't exceeded max attempts
        // For PWA, be more aggressive with reconnection
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          // Reset attempts if it's a transport error (common in PWA)
          if (reason === 'transport close' || reason === 'transport error') {
            reconnectAttemptsRef.current = Math.max(0, reconnectAttemptsRef.current - 1);
          }
          
          if (reconnectAttemptsRef.current < maxReconnectAttempts && scheduleReconnectRef.current) {
            scheduleReconnectRef.current();
          } else {
            // Reset attempts after a delay to allow retry
            setTimeout(() => {
              reconnectAttemptsRef.current = 0;
            }, 30000); // Reset after 30 seconds
          }
        }
      });

      socket.on('connect_error', (err) => {
        console.error('❌ WebSocket connection error:', err);
        setError(err.message);
        setIsConnecting(false);
        isConnectingRef.current = false;
        onError?.(err);
        if (scheduleReconnectRef.current) {
          scheduleReconnectRef.current();
        }
      });

      // Debug: Listen for any WebSocket events
      socket.onAny((eventName, ...args) => {
        console.log('🔍 WebSocket event received:', eventName, args);
        if (eventName === 'orderUpdate') {
          console.log('🔍 OrderUpdate event details:', {
            eventName,
            args,
            messageType: args[0]?.type,
            orderNumber: args[0]?.data?.orderNumber,
            canteenId: args[0]?.data?.canteenId,
            allStoreCounterIds: args[0]?.data?.allStoreCounterIds
          });
        }
      });

      // Message event handlers - FIXED: Use correct event name 'orderUpdate'
      socket.on('orderUpdate', (message: WebSocketMessage) => {
        console.log('📨 Received WebSocket message:', message);
        console.log('📨 Message type:', message.type);
        console.log('📨 Message data:', message.data);
        console.log('📨 Socket ID:', socket.id);
        console.log('📨 Socket connected:', socket.connected);
        
        switch (message.type) {
          case 'new_order':
            onNewOrder?.(message.data);
            break;
          case 'new_offline_order':
            // Handle offline orders specifically
            onNewOrder?.(message.data);
            break;
          case 'payment_confirmed':
            // Treat payment confirmation as a new order event for dashboards
            console.log('📨 Payment confirmed event received:', message);
            onNewOrder?.((message as any).data?.order ?? message.data);
            break;
          case 'order_updated':
          case 'order_status_changed':
            console.log('📨 Order updated event received:', message);
            onOrderUpdate?.(message.data);
            if (message.oldStatus && message.newStatus) {
              console.log(`📨 Order status change: ${message.oldStatus} → ${message.newStatus}`);
              onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
            }
            break;
          case 'item_status_changed':
            // Handle item-level status changes separately (e.g., mark-ready)
            // This allows components to update cache directly without refetching
            onItemStatusChange?.(message.data);
            // Also call onOrderUpdate for backward compatibility
            onOrderUpdate?.(message.data);
            if (message.oldStatus && message.newStatus) {
              onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
            }
            break;
          case 'banner_updated':
            onBannerUpdate?.(message.data);
            break;
          case 'payment_success':
            onPaymentSuccess?.(message.data);
            break;
          case 'order_rejected':
            if (message.rejectedByCounter) {
              onOrderRejected?.(message.data, message.rejectedByCounter);
            }
            break;
          case 'checkout_session_status_changed':
            if (message.sessionId && message.status && message.timeRemaining !== undefined) {
              onCheckoutSessionStatusChange?.(message.sessionId, message.status, message.timeRemaining);
            }
            break;
        }
      });

      socket.on('roomJoined', () => {});
      socket.on('left_room', () => {});
      socket.on('counterRoomJoined', () => {});
      socket.on('counterRoomLeft', () => {});
      socket.on('pong', () => {
        lastPongRef.current = Date.now();
      });

    } catch (err) {
      console.error('❌ Failed to create WebSocket connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
      isConnectingRef.current = false;
      onError?.(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [enabled, getWebSocketURL, canteenIds, onConnected, onDisconnected, onError, onNewOrder, onOrderUpdate, onOrderStatusChange, onBannerUpdate, onPaymentSuccess, stopKeepAlive, maxReconnectAttempts]);

  // Schedule reconnection with exponential backoff (more aggressive for PWA)
  // Uses connectRef to avoid circular dependency
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // More aggressive reconnection for PWA - shorter delays
    const baseDelay = 1000;
    const maxDelay = 8000; // Reduced from 10000
    const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current), maxDelay);
    reconnectAttemptsRef.current++;
    
    console.log(`🔄 Scheduling WebSocket reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (reconnectAttemptsRef.current <= maxReconnectAttempts && enabled) {
        hasConnectedRef.current = false; // Reset connection flag
        connectRef.current(); // Use ref to avoid circular dependency
      } else {
        console.error('❌ Max reconnection attempts reached, will retry after delay');
        setError('Connection failed after multiple attempts');
        // Reset attempts after delay to allow retry
        setTimeout(() => {
          reconnectAttemptsRef.current = 0;
          if (enabled && scheduleReconnectRef.current) {
            scheduleReconnectRef.current();
          }
        }, 30000);
      }
    }, delay);
  }, [enabled]);

  // Update refs after functions are defined
  connectRef.current = connect;
  scheduleReconnectRef.current = scheduleReconnect;

  // Join canteen rooms
  const joinCanteenRooms = useCallback((canteenIds: string[]) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('joinCanteenRooms', canteenIds);
    }
  }, []);

  // Leave specific canteen room
  const leaveCanteenRoom = useCallback((canteenId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('leaveCanteenRooms', [canteenId]);
    }
  }, []);

  // Join counter room
  const joinCounterRoom = useCallback((counterId: string, canteenId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('joinCounterRoom', { counterId, canteenId });
    }
  }, []);

  // Leave counter room
  const leaveCounterRoom = useCallback((counterId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('leaveCounterRoom', { counterId });
    }
  }, []);

  // Send custom message
  const sendMessage = useCallback((event: string, data: any) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(event, data);
    }
  }, []);

  // Reconnect WebSocket
  const reconnect = useCallback(() => {
    console.log('🔄 Manual WebSocket reconnect requested');
    disconnect();
    reconnectAttemptsRef.current = 0;
    hasConnectedRef.current = false;
    setTimeout(() => connect(), 1000);
  }, [disconnect, connect]);

  // Main effect to handle connection lifecycle - SIMPLIFIED
  useEffect(() => {
    if (enabled && !hasConnectedRef.current) {
      connect();
    } else if (!enabled) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]); // Only depend on enabled

  // Effect to handle canteen room changes
  useEffect(() => {
    if (isConnected && canteenIds.length > 0) {
      joinCanteenRooms(canteenIds);
    }
  }, [isConnected, canteenIds.join(',')]); // Use join to avoid array reference issues

  // PWA-specific: Handle page visibility changes (app going to background/foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - check connection and reconnect if needed
        console.log('👀 Page became visible, checking WebSocket connection...');
        
        // Clear any pending visibility check
        if (visibilityCheckTimeoutRef.current) {
          clearTimeout(visibilityCheckTimeoutRef.current);
        }
        
        // Wait a bit for network to stabilize after coming to foreground
        visibilityCheckTimeoutRef.current = setTimeout(() => {
          const socket = socketRef.current;
          
          // If not connected or connection seems stale, reconnect
          if (!socket?.connected || !isConnected) {
            console.log('🔄 Reconnecting WebSocket after page visibility change...');
            reconnectAttemptsRef.current = 0; // Reset attempts
            reconnect();
          } else {
            // Verify connection is still alive
            const timeSinceLastPong = Date.now() - lastPongRef.current;
            if (timeSinceLastPong > 30000) {
              console.log('🔄 Connection appears stale, reconnecting...');
              reconnect();
            } else {
              // Send ping to verify connection
              socket.emit('ping');
            }
          }
        }, 500); // Small delay to let network stabilize
      } else {
        // Page became hidden - stop keepalive to save battery
        console.log('👀 Page became hidden, pausing keepalive...');
        stopKeepAlive();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also handle online/offline events for network state changes
    const handleOnline = () => {
      console.log('🌐 Network came online, checking WebSocket connection...');
      if (!isConnected && enabled) {
        reconnectAttemptsRef.current = 0;
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('🌐 Network went offline');
      // Connection will be lost naturally, no need to disconnect manually
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (visibilityCheckTimeoutRef.current) {
        clearTimeout(visibilityCheckTimeoutRef.current);
      }
    };
  }, [isConnected, enabled, reconnect, stopKeepAlive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopKeepAlive();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (visibilityCheckTimeoutRef.current) {
        clearTimeout(visibilityCheckTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect, stopKeepAlive]); // Include dependencies

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    joinCanteenRooms,
    leaveCanteenRoom,
    joinCounterRoom,
    leaveCounterRoom,
    sendMessage,
    disconnect,
    reconnect
  };
}

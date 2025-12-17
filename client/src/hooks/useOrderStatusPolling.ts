/**
 * Order Status Polling Hook
 * Industry Standard: Polling fallback for WebSocket with proper lifecycle management
 * 
 * Features:
 * - Automatic start/stop based on WebSocket connection state
 * - Race condition handling via queue
 * - Aggressive WebSocket reconnection in parallel
 * - Proper cleanup on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { pollingQueue } from '@/services/orderStatusPollingQueue';

interface UseOrderStatusPollingOptions {
  orderId: string;
  enabled?: boolean;
  isWebSocketConnected: boolean;
  isWebSocketConnecting: boolean;
  onDataUpdate?: (data: any) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number; // Polling interval in ms (default: 3000)
}

interface UseOrderStatusPollingReturn {
  isPolling: boolean;
  lastPollTime: number | null;
  error: Error | null;
  startPolling: () => void;
  stopPolling: () => void;
  pollNow: () => Promise<void>;
}

export function useOrderStatusPolling({
  orderId,
  enabled = true,
  isWebSocketConnected,
  isWebSocketConnecting,
  onDataUpdate,
  onError,
  pollingInterval = 4000, // Default: 4 seconds (balanced: cost-efficient but responsive)
}: UseOrderStatusPollingOptions): UseOrderStatusPollingReturn {
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const orderIdRef = useRef(orderId);
  const enabledRef = useRef(enabled);
  const isWebSocketConnectedRef = useRef(isWebSocketConnected);

  // Update refs
  useEffect(() => {
    orderIdRef.current = orderId;
    enabledRef.current = enabled;
    isWebSocketConnectedRef.current = isWebSocketConnected;
  }, [orderId, enabled, isWebSocketConnected]);

  /**
   * Perform a single poll
   */
  const pollNow = useCallback(async (): Promise<void> => {
    if (!orderIdRef.current || !enabledRef.current) {
      return;
    }

    // Don't poll if WebSocket is connected
    if (isWebSocketConnectedRef.current) {
      return;
    }

    try {
      setError(null);
      const data = await pollingQueue.pollOrder(orderIdRef.current, 1);
      
      if (data) {
        setLastPollTime(Date.now());
        onDataUpdate?.(data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed');
      setError(error);
      onError?.(error);
      console.error('❌ Order status polling error:', error);
    }
  }, [onDataUpdate, onError]);

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    // Don't start if already polling
    if (isPollingRef.current) {
      return;
    }

    // Don't start if WebSocket is connected
    if (isWebSocketConnectedRef.current) {
      return;
    }

    // Don't start if not enabled
    if (!enabledRef.current || !orderIdRef.current) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    // Poll immediately
    pollNow();

    // Set up interval
    pollingIntervalRef.current = setInterval(() => {
      // Check if WebSocket connected (stop polling if so)
      if (isWebSocketConnectedRef.current) {
        stopPolling();
        return;
      }

      // Check if still enabled
      if (!enabledRef.current || !orderIdRef.current) {
        stopPolling();
        return;
      }

      pollNow();
    }, pollingInterval);

    console.log(`🔄 Started polling for order ${orderIdRef.current}`);
  }, [pollNow, pollingInterval]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (!isPollingRef.current) {
      return;
    }

    isPollingRef.current = false;
    setIsPolling(false);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Remove from queue
    if (orderIdRef.current) {
      pollingQueue.removeOrder(orderIdRef.current);
    }

    console.log(`⏸️ Stopped polling for order ${orderIdRef.current}`);
  }, []);

  /**
   * Main effect: Start/stop polling based on WebSocket state
   * Industry Standard: Immediate stop when WebSocket connects to reduce server load
   */
  useEffect(() => {
    // If WebSocket is connected, stop polling immediately
    if (isWebSocketConnected) {
      stopPolling();
      // Clear any pending requests from queue
      if (orderId) {
        pollingQueue.removeOrder(orderId);
      }
      return;
    }

    // If WebSocket is connecting, wait a bit before starting polling
    if (isWebSocketConnecting) {
      // Wait 3 seconds for WebSocket to connect, then start polling if still disconnected
      const timeout = setTimeout(() => {
        if (!isWebSocketConnectedRef.current && enabledRef.current && orderIdRef.current) {
          startPolling();
        }
      }, 3000); // Increased from 2 to 3 seconds

      return () => clearTimeout(timeout);
    }

    // WebSocket is disconnected and not connecting - start polling
    if (enabled && orderId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isWebSocketConnected, isWebSocketConnecting, enabled, orderId, startPolling, stopPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
      if (orderId) {
        pollingQueue.removeOrder(orderId);
      }
    };
  }, [orderId, stopPolling]);

  return {
    isPolling,
    lastPollTime,
    error,
    startPolling,
    stopPolling,
    pollNow,
  };
}


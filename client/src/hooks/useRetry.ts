import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

interface UseRetryReturn {
  retryCount: number;
  isRetrying: boolean;
  canRetry: boolean;
  retry: () => Promise<void>;
  reset: () => void;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  asyncFunction: T,
  options: UseRetryOptions = {}
): UseRetryReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onMaxRetriesReached
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const canRetry = retryCount < maxRetries;

  const retry = useCallback(async () => {
    if (!canRetry || isRetrying) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      onRetry?.(retryCount + 1);
      
      // Add delay before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      await asyncFunction();
      
      // Reset on success
      setRetryCount(0);
    } catch (error) {
      console.error(`Retry attempt ${retryCount + 1} failed:`, error);
      
      if (retryCount + 1 >= maxRetries) {
        onMaxRetriesReached?.();
      }
    } finally {
      setIsRetrying(false);
    }
  }, [asyncFunction, canRetry, isRetrying, retryCount, maxRetries, retryDelay, onRetry, onMaxRetriesReached]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retryCount,
    isRetrying,
    canRetry,
    retry,
    reset
  };
}

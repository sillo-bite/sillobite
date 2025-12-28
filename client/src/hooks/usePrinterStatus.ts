import { useState, useEffect, useCallback } from "react";
import { checkStatus } from "@/services/localPrinterService";

interface PrinterStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UsePrinterStatusReturn extends PrinterStatus {
  retry: () => Promise<void>;
}

const POLL_INTERVAL = 5000; // Check every 5 seconds

/**
 * Hook to monitor local printer helper status
 * Polls the status endpoint periodically and exposes manual retry
 */
export function usePrinterStatus(): UsePrinterStatusReturn {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    isLoading: true,
    error: null,
  });

  const checkPrinterStatus = useCallback(async () => {
    try {
      const result = await checkStatus();
      setStatus({
        isConnected: result.available,
        isLoading: false,
        error: result.available ? null : result.message || "Not connected",
      });
    } catch (error) {
      setStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to check printer status",
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const runCheck = async () => {
      if (isMounted) {
        await checkPrinterStatus();
      }
    };

    // Initial check
    runCheck();

    // Set up polling
    pollInterval = setInterval(runCheck, POLL_INTERVAL);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [checkPrinterStatus]);

  const retry = useCallback(async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));
    await checkPrinterStatus();
  }, [checkPrinterStatus]);

  return { ...status, retry };
}





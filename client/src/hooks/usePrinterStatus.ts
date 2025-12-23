import { useState, useEffect } from "react";
import { checkStatus } from "@/services/localPrinterService";

interface PrinterStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL = 5000; // Check every 5 seconds

/**
 * Hook to monitor local printer helper status
 * Polls the status endpoint periodically
 */
export function usePrinterStatus(): PrinterStatus {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const checkPrinterStatus = async () => {
      try {
        const result = await checkStatus();
        if (isMounted) {
          setStatus({
            isConnected: result.available,
            isLoading: false,
            error: result.available ? null : result.message || "Not connected",
          });
        }
      } catch (error) {
        if (isMounted) {
          setStatus({
            isConnected: false,
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to check printer status",
          });
        }
      }
    };

    // Initial check
    checkPrinterStatus();

    // Set up polling
    pollInterval = setInterval(checkPrinterStatus, POLL_INTERVAL);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  return status;
}



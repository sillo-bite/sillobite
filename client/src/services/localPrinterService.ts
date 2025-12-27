/**
 * Local Printer Service
 * Communicates with a local printer helper running at http://127.0.0.1:9100
 */

const LOCAL_PRINTER_BASE_URL = 'http://127.0.0.1:9100';
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout

interface PrinterStatus {
  available: boolean;
  message?: string;
  version?: string;
}

interface PrintBillResponse {
  success: boolean;
  message?: string;
  jobId?: string;
}

interface BluetoothPrinter {
  name: string;
  address: string;
}

interface PrintersListResponse {
  success: boolean;
  printers?: BluetoothPrinter[];
  message?: string;
}

interface ConnectPrinterResponse {
  success: boolean;
  message?: string;
  connected?: boolean;
}

/**
 * Check if the local printer helper is available
 * @returns Promise with status information
 */
export async function checkStatus(): Promise<PrinterStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        message: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      available: true,
      message: data.message || 'Printer helper is available',
      version: data.version,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        available: false,
        message: 'Request timeout - printer helper may not be running',
      };
    }
    return {
      available: false,
      message: error instanceof Error ? error.message : 'Failed to connect to printer helper',
    };
  }
}

/**
 * Print a bill with the given payload
 * @param payload - The bill data to print
 * @returns Promise with print result
 */
export async function printBill(payload: any): Promise<PrintBillResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // Longer timeout for print jobs

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Bill printed successfully',
      jobId: data.jobId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timeout - printer helper may not be responding',
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to print bill',
    };
  }
}

/**
 * Send a print job to the local printer helper
 * @param payload - The print job data to send
 * @returns Promise with print result
 */
export async function print(payload: any): Promise<PrintBillResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // Longer timeout for print jobs

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Print job sent successfully',
      jobId: data.jobId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timeout - printer helper may not be responding',
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send print job',
    };
  }
}

/**
 * Send a print job with retry logic
 * @param payload - The print job data to send
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @param retryDelay - Delay between retries in milliseconds (default: 1000)
 * @returns Promise with print result
 */
export async function printWithRetry(
  payload: any,
  maxRetries: number = 2,
  retryDelay: number = 1000
): Promise<PrintBillResponse> {
  let lastError: PrintBillResponse | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await print(payload);
    
    if (result.success) {
      return result;
    }

    lastError = result;

    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return lastError || {
    success: false,
    message: 'Failed to print after retries',
  };
}

/**
 * Send a test print command to the printer
 * @returns Promise with test print result
 */
export async function testPrint(): Promise<PrintBillResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // Longer timeout for print jobs

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/test-print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Test print sent successfully',
      jobId: data.jobId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timeout - printer helper may not be responding',
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send test print',
    };
  }
}

/**
 * Get list of paired Bluetooth printers
 * @returns Promise with list of available printers
 */
export async function getPrinters(): Promise<PrintersListResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/printers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      printers: data.printers || [],
      message: data.message,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timeout - printer helper may not be running',
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get printers list',
    };
  }
}

/**
 * Connect to a specific Bluetooth printer by address
 * @param address - Bluetooth address of the printer to connect
 * @returns Promise with connection result
 */
export async function connectPrinter(address: string): Promise<ConnectPrinterResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // Longer timeout for connection

    const response = await fetch(`${LOCAL_PRINTER_BASE_URL}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      connected: data.connected,
      message: data.message || 'Connected to printer successfully',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timeout - connection may be taking too long',
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to printer',
    };
  }
}


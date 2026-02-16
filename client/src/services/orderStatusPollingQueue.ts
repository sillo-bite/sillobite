/**
 * Order Status Polling Queue Manager
 * Industry Standard: Centralized queue management to prevent race conditions
 * and handle multiple simultaneous polling requests efficiently
 */

interface PollingRequest {
  orderId: string;
  priority: number; // Higher priority = more important
  timestamp: number;
  resolve: (data: any) => void;
  reject: (error: Error) => void;
}

interface PollingQueueConfig {
  maxConcurrent: number; // Maximum concurrent requests
  batchSize: number; // Number of orders to poll in one request
  interval: number; // Polling interval in ms
  debounceTime: number; // Debounce time for same order requests
}

class OrderStatusPollingQueue {
  private static instance: OrderStatusPollingQueue;
  private queue: Map<string, PollingRequest> = new Map(); // Order ID -> Request
  private processing: Set<string> = new Set(); // Currently processing order IDs
  private batchTimer: NodeJS.Timeout | null = null;
  private lastBatchTime: number = 0; // Last batch processing time
  private isProcessing: boolean = false; // Flag to prevent concurrent processing
  private config: PollingQueueConfig = {
    maxConcurrent: 2, // Max 2 concurrent requests (reduced for cost efficiency)
    batchSize: 20, // Poll up to 20 orders at once (increased for better batching)
    interval: 4000, // Poll every 4 seconds (balanced: cost-efficient but responsive)
    debounceTime: 1500, // Debounce same order requests by 1.5 seconds (prevents duplicates)
  };

  private lastRequestTime: Map<string, number> = new Map(); // Order ID -> Last request time

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): OrderStatusPollingQueue {
    if (!OrderStatusPollingQueue.instance) {
      OrderStatusPollingQueue.instance = new OrderStatusPollingQueue();
    }
    return OrderStatusPollingQueue.instance;
  }

  /**
   * Add order to polling queue
   * Industry Standard: Debouncing and priority handling
   */
  public async pollOrder(orderId: string, priority: number = 1): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if request is debounced
      const lastRequest = this.lastRequestTime.get(orderId);
      const now = Date.now();

      if (lastRequest && (now - lastRequest) < this.config.debounceTime) {
        // Request is debounced, return existing promise if available
        const existingRequest = this.queue.get(orderId);
        if (existingRequest) {
          existingRequest.resolve = resolve;
          existingRequest.reject = reject;
          existingRequest.priority = Math.max(existingRequest.priority, priority);
          return;
        }
      }

      // Add to queue
      this.queue.set(orderId, {
        orderId,
        priority,
        timestamp: now,
        resolve,
        reject,
      });

      this.lastRequestTime.set(orderId, now);

      // Schedule processing with proper batching (don't process immediately)
      this.scheduleProcessQueue();
    });
  }

  /**
   * Remove order from polling queue
   */
  public removeOrder(orderId: string): void {
    const request = this.queue.get(orderId);
    if (request) {
      request.reject(new Error('Polling cancelled'));
      this.queue.delete(orderId);
    }
    this.processing.delete(orderId);
    this.lastRequestTime.delete(orderId);
  }

  /**
   * Clear all polling requests
   */
  public clear(): void {
    // Reject all pending requests
    this.queue.forEach((request) => {
      request.reject(new Error('Polling queue cleared'));
    });
    this.queue.clear();
    this.processing.clear();
    this.lastRequestTime.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Schedule queue processing with proper batching and rate limiting
   * Industry Standard: Throttled batch processing to reduce server load
   */
  private scheduleProcessQueue(): void {
    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Calculate time since last batch
    const timeSinceLastBatch = Date.now() - this.lastBatchTime;
    const delay = Math.max(0, this.config.interval - timeSinceLastBatch);

    // Schedule processing
    this.batchTimer = setTimeout(() => {
      this.processQueue();
    }, delay);
  }

  /**
   * Process queue with batching and concurrency control
   * Industry Standard: Efficient batch processing with rate limiting
   */
  private async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    // Check if we can process more (respect max concurrent)
    if (this.processing.size >= this.config.maxConcurrent) {
      // Schedule next batch
      this.scheduleProcessQueue();
      return;
    }

    this.isProcessing = true;
    this.lastBatchTime = Date.now();

    // Get orders to process (prioritize by priority and timestamp)
    const ordersToProcess = Array.from(this.queue.entries())
      .sort((a, b) => {
        // Sort by priority (higher first), then by timestamp (older first)
        if (b[1].priority !== a[1].priority) {
          return b[1].priority - a[1].priority;
        }
        return a[1].timestamp - b[1].timestamp;
      })
      .slice(0, Math.min(this.config.batchSize, this.config.maxConcurrent - this.processing.size))
      .map(([orderId]) => orderId);

    if (ordersToProcess.length === 0) {
      return;
    }

    // Mark as processing
    ordersToProcess.forEach((orderId) => {
      this.processing.add(orderId);
    });

    // Batch process orders
    try {
      const results = await this.batchPollOrders(ordersToProcess);

      // Resolve requests
      ordersToProcess.forEach((orderId, index) => {
        const request = this.queue.get(orderId);
        if (request) {
          request.resolve(results[index] || null);
          this.queue.delete(orderId);
        }
        this.processing.delete(orderId);
      });
    } catch (error) {
      // Reject all requests in batch
      ordersToProcess.forEach((orderId) => {
        const request = this.queue.get(orderId);
        if (request) {
          request.reject(error instanceof Error ? error : new Error('Polling failed'));
          this.queue.delete(orderId);
        }
        this.processing.delete(orderId);
      });
    }

    this.isProcessing = false;

    // Schedule next batch if queue is not empty
    if (this.queue.size > 0) {
      this.scheduleProcessQueue();
    }
  }

  /**
   * Batch poll multiple orders in a single request
   * Industry Standard: Reduce server load by batching requests
   */
  private async batchPollOrders(orderIds: string[]): Promise<any[]> {
    try {
      const response = await fetch('/api/orders/poll-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        // Handle rate limiting gracefully
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          const retryAfter = errorData.retryAfter || 5;
          console.warn(`⚠️ Rate limit hit, will retry after ${retryAfter} seconds`);

          // Wait and retry once
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

          // Retry the request
          const retryResponse = await fetch('/api/orders/poll-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderIds }),
            signal: AbortSignal.timeout(10000),
          });

          if (!retryResponse.ok) {
            throw new Error(`Rate limit exceeded. Please wait before trying again.`);
          }

          const retryData = await retryResponse.json();
          return orderIds.map((orderId) => {
            return retryData.orders?.find((order: any) =>
              order.id === orderId || order.orderNumber === orderId
            ) || null;
          });
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Return results in same order as requested
      return orderIds.map((orderId) => {
        return data.orders?.find((order: any) =>
          order.id === orderId || order.orderNumber === orderId
        ) || null;
      });
    } catch (error) {
      console.error('❌ Batch polling failed:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PollingQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get queue status (for debugging)
   */
  public getStatus(): { queueSize: number; processing: number; processingIds: string[] } {
    return {
      queueSize: this.queue.size,
      processing: this.processing.size,
      processingIds: Array.from(this.processing),
    };
  }
}

export const pollingQueue = OrderStatusPollingQueue.getInstance();


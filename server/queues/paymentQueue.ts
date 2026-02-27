import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { createRazorpayOrder } from '../../shared/razorpay';
import { CheckoutSessionService } from '../checkout-session-service';
import { storage } from '../storage-hybrid';

/**
 * Payment processing queue configuration
 * Handles payment initiation with throttling and retry logic
 * SCALABILITY FIX: Only creates queue if Redis is available
 */
let paymentQueue: Queue | null = null;
let razorpayQueue: Queue | null = null;
let paymentWorker: Worker | null = null;
let razorpayWorker: Worker | null = null;

/**
 * Get or create payment queue (lazy initialization)
 */
async function getPaymentQueue(): Promise<Queue | null> {
  if (paymentQueue) return paymentQueue;

  const { isRedisAvailable } = await import('../config/redis');
  const available = await isRedisAvailable();

  if (!available) {
    return null;
  }

  paymentQueue = new Queue('payment-processing', {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds, exponential backoff
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
    // limiter is not a valid option for Queue, it belongs to Worker
  });

  return paymentQueue;
}

/**
 * Get or create Razorpay queue (lazy initialization)
 */
async function getRazorpayQueue(): Promise<Queue | null> {
  if (razorpayQueue) return razorpayQueue;

  const { isRedisAvailable } = await import('../config/redis');
  const available = await isRedisAvailable();

  if (!available) {
    return null;
  }

  razorpayQueue = new Queue('razorpay-api', {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 500,
      },
      removeOnFail: {
        age: 86400,
      },
    },
    // limiter is not a valid option for Queue, it belongs to Worker
  });

  return razorpayQueue;
}

/**
 * Payment job data interface
 */
export interface PaymentJobData {
  amount: number;
  customerName: string;
  orderData: any;
  idempotencyKey: string;
  checkoutSessionId: string;
  merchantOrderId: string;
}

/**
 * Razorpay order creation job data
 */
export interface RazorpayOrderJobData {
  amount: number;
  currency: string;
  merchantOrderId: string;
  notes: Record<string, string>;
}

/**
 * Add payment initiation job to queue
 * Returns null if Redis/queue is not available
 */
export async function queuePaymentInitiation(data: PaymentJobData): Promise<Job<PaymentJobData> | null> {
  const queue = await getPaymentQueue();
  if (!queue) return null;

  return await queue.add('initiate-payment', data, {
    jobId: data.idempotencyKey, // Use idempotency key as job ID to prevent duplicates
    priority: 1, // Normal priority
  });
}

/**
 * Add Razorpay order creation job to queue
 * Returns null if Redis/queue is not available
 */
export async function queueRazorpayOrder(data: RazorpayOrderJobData): Promise<Job<RazorpayOrderJobData> | null> {
  const queue = await getRazorpayQueue();
  if (!queue) return null;

  return await queue.add('create-razorpay-order', data, {
    priority: 1,
  });
}

/**
 * Initialize workers (only if Redis is available)
 */
async function initializeWorkers() {
  const { isRedisAvailable } = await import('../config/redis');
  const available = await isRedisAvailable();

  if (!available || paymentWorker) return; // Already initialized or Redis unavailable

  paymentWorker = new Worker<PaymentJobData>(
    'payment-processing',
    async (job: Job<PaymentJobData>) => {
      const { amount, customerName, orderData, idempotencyKey, checkoutSessionId, merchantOrderId } = job.data;

      console.log(`🔄 Processing payment job: ${job.id} for checkout session ${checkoutSessionId}`);

      try {
        // Validate checkout session
        const session = await CheckoutSessionService.getSession(checkoutSessionId);
        if (!session) {
          throw new Error(`Checkout session ${checkoutSessionId} not found`);
        }

        const isActive = await CheckoutSessionService.isSessionActive(checkoutSessionId);
        if (!isActive) {
          throw new Error(`Checkout session ${checkoutSessionId} is not active`);
        }

        // Check for duplicate payment
        const sessionDuplicateCheck = await CheckoutSessionService.checkDuplicatePaymentFromSession(checkoutSessionId);
        if (sessionDuplicateCheck.isDuplicate) {
          throw new Error(`Duplicate payment request for checkout session ${checkoutSessionId}`);
        }

        // Create Razorpay order via queue (throttled)
        const razorpayJob = await queueRazorpayOrder({
          amount,
          currency: 'INR',
          merchantOrderId,
          notes: {
            customerName,
            canteenId: orderData.canteenId || '',
            checkoutSessionId: checkoutSessionId,
          },
        });

        if (!razorpayJob) {
          // Queue not available, create Razorpay order directly
          const razorpayOrder = await createRazorpayOrder(
            amount,
            'INR',
            merchantOrderId,
            {
              customerName,
              canteenId: orderData.canteenId || '',
              checkoutSessionId: checkoutSessionId,
            }
          );

          return {
            success: true,
            merchantTransactionId: merchantOrderId,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
          };
        }

        // Wait for Razorpay order creation
        // We need QueueEvents to wait for job completion
        const queueEvents = new QueueEvents('razorpay-api', { connection: getRedisClient() });
        const razorpayResult = await razorpayJob.waitUntilFinished(queueEvents) as any;
        await queueEvents.close();

        if (!razorpayResult || !razorpayResult.success) {
          throw new Error(`Razorpay order creation failed: ${razorpayResult?.error || 'Unknown error'}`);
        }

        const razorpayOrder = razorpayResult.data;

        // Update checkout session status
        await CheckoutSessionService.updateStatus(
          checkoutSessionId,
          'payment_initiated',
          {
            ...orderData,
            razorpayOrderId: razorpayOrder.id,
            merchantTransactionId: merchantOrderId,
            amount: amount,
            idempotencyKey: idempotencyKey || null,
            paymentInitiatedAt: new Date().toISOString(),
          }
        );

        // Store payment record
        await storage.createPayment({
          customerId: orderData.customerId || undefined,
          merchantTransactionId: merchantOrderId,
          razorpayOrderId: razorpayOrder.id, // Store as indexed field
          checkoutSessionId: checkoutSessionId, // Store as indexed field
          amount: amount * 100, // Store in paise
          status: 'pending',
          canteenId: orderData.canteenId,
          checksum: '',
          metadata: JSON.stringify({
            ...orderData,
            razorpayOrderId: razorpayOrder.id,
            checkoutSessionId: checkoutSessionId,
            idempotencyKey: idempotencyKey || null,
          }),
        });

        return {
          success: true,
          merchantTransactionId: merchantOrderId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        };
      } catch (error) {
        console.error(`❌ Payment job ${job.id} failed:`, error);

        // Update checkout session status on error
        try {
          await CheckoutSessionService.updateStatus(checkoutSessionId, 'payment_failed');
        } catch (updateError) {
          console.error('Error updating checkout session status:', updateError);
        }

        throw error;
      }
    },
    {
      connection: getRedisClient(),
      concurrency: parseInt(process.env.PAYMENT_WORKER_CONCURRENCY || '10'), // Process 10 jobs concurrently
      limiter: {
        max: parseInt(process.env.PAYMENT_QUEUE_MAX_JOBS || '50'),
        duration: 1000,
      },
    }
  );

  razorpayWorker = new Worker<RazorpayOrderJobData>(
    'razorpay-api',
    async (job: Job<RazorpayOrderJobData>) => {
      const { amount, currency, merchantOrderId, notes } = job.data;

      console.log(`🔄 Creating Razorpay order: ${merchantOrderId}`);

      try {
        const razorpayOrder = await createRazorpayOrder(
          amount,
          currency,
          merchantOrderId,
          notes
        );

        return {
          success: true,
          data: razorpayOrder,
        };
      } catch (error: any) {
        console.error(`❌ Razorpay order creation failed for ${merchantOrderId}:`, error);

        // Check if it's a rate limit error from Razorpay
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          // Retry with longer delay
          throw new Error(`Razorpay API rate limit exceeded. Retrying...`);
        }

        throw error;
      }
    },
    {
      connection: getRedisClient(),
      concurrency: parseInt(process.env.RAZORPAY_WORKER_CONCURRENCY || '5'), // Process 5 Razorpay calls concurrently
      limiter: {
        max: parseInt(process.env.RAZORPAY_QUEUE_MAX_JOBS || '10'),
        duration: 1000,
      },
    }
  );

  // Worker event handlers
  paymentWorker.on('completed', (job: Job) => {
    console.log(`✅ Payment job ${job.id} completed`);
  });

  paymentWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`❌ Payment job ${job?.id} failed:`, err);
  });

  razorpayWorker.on('completed', (job: Job) => {
    console.log(`✅ Razorpay job ${job.id} completed`);
  });

  razorpayWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`❌ Razorpay job ${job?.id} failed:`, err);
  });
}

// Initialize workers on module load (if Redis available)
initializeWorkers().catch(() => {
  // Workers will initialize when Redis becomes available
});

/**
 * Gracefully close queues and workers
 */
export async function closeQueues(): Promise<void> {
  if (paymentWorker) await paymentWorker.close();
  if (razorpayWorker) await razorpayWorker.close();
  if (paymentQueue) await paymentQueue.close();
  if (razorpayQueue) await razorpayQueue.close();
  console.log('✅ Payment queues closed');
}

// Export queue getters for use in routes
export { getPaymentQueue, getRazorpayQueue };


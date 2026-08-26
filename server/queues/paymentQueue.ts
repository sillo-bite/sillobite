import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { createPaymentSession } from '../../shared/zoho-payments';
import { CheckoutSessionService } from '../checkout-session-service';
import { storage } from '../storage-hybrid';

/**
 * Payment processing queue configuration
 * Handles payment initiation with throttling and retry logic
 * SCALABILITY FIX: Only creates queue if Redis is available
 */
let paymentQueue: Queue | null = null;
let zohoPaymentsQueue: Queue | null = null;
let paymentWorker: Worker | null = null;
let zohoPaymentsWorker: Worker | null = null;

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
 * Get or create Zoho Payments queue (lazy initialization)
 */
async function getZohoPaymentsQueue(): Promise<Queue | null> {
  if (zohoPaymentsQueue) return zohoPaymentsQueue;

  const { isRedisAvailable } = await import('../config/redis');
  const available = await isRedisAvailable();

  if (!available) {
    return null;
  }

  zohoPaymentsQueue = new Queue('zoho-payments-api', {
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

  return zohoPaymentsQueue;
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
 * Zoho Payments session creation job data
 */
export interface ZohoSessionJobData {
  amount: number;
  currency: string;
  merchantOrderId: string;
  customerName: string;
  customerEmail?: string;
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
 * Add Zoho payment session creation job to queue
 * Returns null if Redis/queue is not available
 */
export async function queueZohoSession(data: ZohoSessionJobData): Promise<Job<ZohoSessionJobData> | null> {
  const queue = await getZohoPaymentsQueue();
  if (!queue) return null;

  return await queue.add('create-zoho-session', data, {
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

        // Create Zoho Session via queue (throttled)
        const zohoJob = await queueZohoSession({
          amount,
          currency: 'INR',
          merchantOrderId,
          customerName,
          customerEmail: orderData.customerEmail,
          notes: {
            canteenId: orderData.canteenId || '',
            checkoutSessionId: checkoutSessionId,
            merchantOrderId
          },
        });

        if (!zohoJob) {
          // Queue not available, create Zoho session directly
          const sessionData = await createPaymentSession(
            amount,
            'INR',
            {
              customerName,
              customerEmail: orderData.customerEmail,
              description: `Order ${merchantOrderId}`,
              notes: {
                canteenId: orderData.canteenId || '',
                checkoutSessionId: checkoutSessionId,
                merchantOrderId
              }
            }
          );

          return {
            success: true,
            merchantTransactionId: merchantOrderId,
            zohoPaymentSessionId: sessionData.payment_session_id,
            amount: sessionData.amount,
            currency: sessionData.currency,
          };
        }

        // Wait for Zoho session creation
        // We need QueueEvents to wait for job completion
        const queueEvents = new QueueEvents('zoho-payments-api', { connection: getRedisClient() });
        const zohoResult = await zohoJob.waitUntilFinished(queueEvents) as any;
        await queueEvents.close();

        if (!zohoResult || !zohoResult.success) {
          throw new Error(`Zoho session creation failed: ${zohoResult?.error || 'Unknown error'}`);
        }

        const sessionData = zohoResult.data;

        // Update checkout session status
        await CheckoutSessionService.updateStatus(
          checkoutSessionId,
          'payment_initiated',
          {
            ...orderData,
            zohoPaymentSessionId: sessionData.payment_session_id,
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
          zohoPaymentSessionId: sessionData.payment_session_id, // Store as indexed field
          checkoutSessionId: checkoutSessionId, // Store as indexed field
          amount: amount * 100, // Store in paise
          status: 'pending',
          canteenId: orderData.canteenId,
          checksum: '',
          metadata: JSON.stringify({
            ...orderData,
            zohoPaymentSessionId: sessionData.payment_session_id,
            checkoutSessionId: checkoutSessionId,
            idempotencyKey: idempotencyKey || null,
          }),
        });

        return {
          success: true,
          merchantTransactionId: merchantOrderId,
          zohoPaymentSessionId: sessionData.payment_session_id,
          amount: sessionData.amount,
          currency: sessionData.currency,
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

  zohoPaymentsWorker = new Worker<ZohoSessionJobData>(
    'zoho-payments-api',
    async (job: Job<ZohoSessionJobData>) => {
      const { amount, currency, merchantOrderId, customerName, customerEmail, notes } = job.data;

      console.log(`🔄 Creating Zoho session: ${merchantOrderId}`);

      try {
        const sessionData = await createPaymentSession(
          amount,
          currency,
          {
            customerName,
            customerEmail,
            description: `Order ${merchantOrderId}`,
            notes
          }
        );

        return {
          success: true,
          data: sessionData,
        };
      } catch (error: any) {
        console.error(`❌ Zoho session creation failed for ${merchantOrderId}:`, error);

        // Check if it's a rate limit error from Zoho (typically 429)
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          // Retry with longer delay
          throw new Error(`Zoho Payments API rate limit exceeded. Retrying...`);
        }

        throw error;
      }
    },
    {
      connection: getRedisClient(),
      concurrency: parseInt(process.env.ZOHO_PAYMENTS_WORKER_CONCURRENCY || '5'), // Process 5 Zoho API calls concurrently
      limiter: {
        max: parseInt(process.env.ZOHO_PAYMENTS_QUEUE_MAX_JOBS || '10'),
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

  zohoPaymentsWorker.on('completed', (job: Job) => {
    console.log(`✅ Zoho Payments job ${job.id} completed`);
  });

  zohoPaymentsWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`❌ Zoho Payments job ${job?.id} failed:`, err);
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
  if (zohoPaymentsWorker) await zohoPaymentsWorker.close();
  if (paymentQueue) await paymentQueue.close();
  if (zohoPaymentsQueue) await zohoPaymentsQueue.close();
  console.log('✅ Payment queues closed');
}

// Export queue getters for use in routes
export { getPaymentQueue, getZohoPaymentsQueue };

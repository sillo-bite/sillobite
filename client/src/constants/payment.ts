/**
 * Payment-related constants
 * Industry Standard: Centralized configuration for maintainability
 */
export const PAYMENT_CONFIG = {
  RETRY: {
    MAX_ATTEMPTS: 15,
    INTERVAL_MS: 3000,
  },
  TIMEOUT: {
    STATUS_CHECK_MS: 30000, // Increased from 15000ms to 30000ms (30s) to handle slow server responses
    REDIRECT_MS: 1500, // Reduced from 2000ms for faster redirect
  },
  STORAGE_KEYS: {
    TRANSACTION_ID: 'currentPaymentTxnId',
    ORDER_ID: 'currentOrderId',
    CHECKOUT_SESSION: 'currentCheckoutSessionId',
    PENDING_ORDER: 'pendingOrderData',
  },
} as const;

export type PaymentStatus = 'checking' | 'success' | 'failed' | 'pending';

export const PAYMENT_STATUS = {
  CHECKING: 'checking' as PaymentStatus,
  SUCCESS: 'success' as PaymentStatus,
  FAILED: 'failed' as PaymentStatus,
  PENDING: 'pending' as PaymentStatus,
} as const;


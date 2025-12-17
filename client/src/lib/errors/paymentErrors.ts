/**
 * Payment-specific error types
 * Industry Standard: Custom error classes for better error handling
 */

export class PaymentVerificationError extends Error {
  constructor(
    message: string,
    public transactionId: string,
    public code: 'VERIFICATION_FAILED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE'
  ) {
    super(message);
    this.name = 'PaymentVerificationError';
    Object.setPrototypeOf(this, PaymentVerificationError.prototype);
  }
}

export class PaymentStatusCheckError extends Error {
  constructor(
    message: string,
    public transactionId: string,
    public code: 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'NOT_FOUND'
  ) {
    super(message);
    this.name = 'PaymentStatusCheckError';
    Object.setPrototypeOf(this, PaymentStatusCheckError.prototype);
  }
}

export class PaymentCallbackError extends Error {
  constructor(
    message: string,
    public code: 'MISSING_TRANSACTION_ID' | 'VERIFICATION_FAILED' | 'STATUS_CHECK_FAILED',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PaymentCallbackError';
    Object.setPrototypeOf(this, PaymentCallbackError.prototype);
  }
}


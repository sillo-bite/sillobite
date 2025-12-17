/**
 * Payment-related TypeScript types
 * Industry Standard: Strong typing for type safety
 */

export interface PaymentStatusResponse {
  success: boolean;
  status: 'success' | 'failed' | 'pending';
  data?: PaymentData;
}

export interface PaymentData {
  orderNumber?: string;
  merchantTransactionId?: string;
  shouldClearCart?: boolean;
  orderId?: string;
  [key: string]: unknown;
}

export interface RazorpayCallbackParams {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  merchantTransactionId?: string;
}

export interface UsePaymentCallbackReturn {
  status: PaymentStatus;
  paymentData: PaymentData | null;
  orderId: string;
  handleRetry: () => void;
  handleGoToOrders: () => void;
}

export type PaymentStatus = 'checking' | 'success' | 'failed' | 'pending';


import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';

import https from 'https';

// Razorpay Configuration - loaded from environment variables
export const RAZORPAY_CONFIG = {
  KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
};

// SCALABILITY FIX: HTTP Keep-Alive Agent to reuse SSL connections
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

// Initialize Razorpay instance
export const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_CONFIG.KEY_ID,
  key_secret: RAZORPAY_CONFIG.KEY_SECRET,
  // @ts-ignore - Pass agent for underlying axios/request library if supported
  agent: httpsAgent
});

// Payment status codes
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
} as const;

// Razorpay response codes
export const RAZORPAY_RESPONSE_CODES = {
  PAYMENT_SUCCESS: 'authorized',
  PAYMENT_FAILED: 'failed',
  PAYMENT_PENDING: 'created',
  PAYMENT_CAPTURED: 'captured',
  PAYMENT_REFUNDED: 'refunded',
} as const;

// Verify Razorpay webhook signature
export function verifyWebhookSignature(
  payload: string | object,
  signature: string,
  secret: string = RAZORPAY_CONFIG.WEBHOOK_SECRET
): boolean {
  try {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Create Razorpay order
export async function createRazorpayOrder(
  amount: number | string,
  currency: string = 'INR',
  receipt?: string,
  notes?: Record<string, string>
) {
  // Validate configuration before making API call
  if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
    throw new Error('Razorpay configuration missing: KEY_ID or KEY_SECRET not set');
  }
  const numericAmount = Number(amount);

  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid amount: amount must be a number greater than 0');
  }

  try {
    const options = {
      amount: Math.round(numericAmount * 100), // Convert to paise safely without losing decimals
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);

    // Provide more helpful error messages
    if (error.error) {
      const errorDescription = error.error.description || error.error.error?.description || 'Unknown error';
      const errorCode = error.error.code || error.error.error?.code || 'UNKNOWN';
      throw new Error(`Razorpay API Error [${errorCode}]: ${errorDescription}`);
    }

    throw error;
  }
}

// Verify payment signature (for frontend callback verification)
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_CONFIG.KEY_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
}

// Get payment details
export async function getPaymentDetails(paymentId: string) {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw error;
  }
}

// Get order details
export async function getOrderDetails(orderId: string) {
  try {
    const order = await razorpayInstance.orders.fetch(orderId);
    return order;
  } catch (error) {
    console.error('Error fetching order details:', error);
    throw error;
  }
}

export async function createRazorpayQR(
  orderId: string,
  amount: number,
  currency: string = 'INR',
  description?: string,
  customerName?: string
) {
  if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
    throw new Error('Razorpay configuration missing: KEY_ID or KEY_SECRET not set');
  }

  if (amount <= 0) {
    throw new Error('Invalid amount: amount must be greater than 0');
  }

  try {
    const options = {
      type: 'upi_qr' as const,
      name: customerName || 'Customer',
      usage: 'single_use' as const,
      fixed_amount: true,
      payment_amount: Math.round(amount * 100), // Convert to paise safely without floating point issues
      description: description || `Order ${orderId}`,
      close_by: Math.floor(Date.now() / 1000) + 600,
      notes: {
        orderId: orderId
      }
    };

    const qrCode = await razorpayInstance.qrCode.create(options);
    return qrCode;
  } catch (error: any) {
    console.error('Error creating Razorpay QR code:', error);

    if (error.error) {
      const errorDescription = error.error.description || error.error.error?.description || 'Unknown error';
      const errorCode = error.error.code || error.error.error?.code || 'UNKNOWN';
      throw new Error(`Razorpay QR API Error [${errorCode}]: ${errorDescription}`);
    }

    throw error;
  }
}

export async function fetchRazorpayQR(qrCodeId: string) {
  try {
    const qrCode = await razorpayInstance.qrCode.fetch(qrCodeId);
    return qrCode;
  } catch (error) {
    console.error('Error fetching Razorpay QR code:', error);
    throw error;
  }
}

export async function fetchAllRazorpayQRPayments(qrCodeId: string) {
  try {
    const payments = await razorpayInstance.qrCode.fetchAllPayments(qrCodeId);
    return payments;
  } catch (error) {
    console.error('Error fetching Razorpay QR code payments:', error);
    throw error;
  }
}

export async function closeRazorpayQR(qrCodeId: string) {
  try {
    const qrCode = await razorpayInstance.qrCode.close(qrCodeId);
    return qrCode;
  } catch (error) {
    console.error('Error closing Razorpay QR code:', error);
    throw error;
  }
}

/**
 * Extracts the UPI deep link from a Razorpay QR code image.
 * Downloads the image, decodes the QR, and returns the embedded UPI link.
 * Returns null if extraction fails — caller should fall back to image_url.
 */
export async function extractUpiLinkFromQR(imageUrl: string): Promise<string | null> {
  try {
    // Download the QR image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`⚠️ Failed to download QR image: HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Read image with Jimp
    const image = await Jimp.read(buffer);
    const width = image.width;
    const height = image.height;

    // Get raw RGBA pixel data
    const imageData = new Uint8ClampedArray(image.bitmap.data);

    // Decode the QR code
    const qrResult = jsQR(imageData, width, height);

    if (qrResult && qrResult.data) {
      console.log(`✅ UPI link extracted from QR image: ${qrResult.data.substring(0, 50)}...`);
      return qrResult.data;
    }

    console.warn('⚠️ Could not decode QR code from image');
    return null;
  } catch (error) {
    console.error('❌ Error extracting UPI link from QR:', error);
    return null;
  }
}

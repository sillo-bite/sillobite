import crypto from 'crypto';
import axios from 'axios';

// Zoho Payments Configuration - loaded from environment variables
export const ZOHO_PAYMENTS_CONFIG = {
  ACCOUNT_ID: process.env.ZOHO_PAYMENTS_ACCOUNT_ID || '',
  API_KEY: process.env.ZOHO_PAYMENTS_API_KEY || '', // Frontend API key for checkout widget
  CLIENT_ID: process.env.ZOHO_PAYMENTS_CLIENT_ID || '',
  CLIENT_SECRET: process.env.ZOHO_PAYMENTS_CLIENT_SECRET || '',
  REFRESH_TOKEN: process.env.ZOHO_PAYMENTS_REFRESH_TOKEN || '',
  WEBHOOK_SIGNING_KEY: process.env.ZOHO_PAYMENTS_WEBHOOK_SIGNING_KEY || '',
  ENV: process.env.ZOHO_PAYMENTS_ENV || 'production', // 'sandbox' or 'production'
  DOMAIN: process.env.ZOHO_PAYMENTS_DOMAIN || 'IN', // IN, US, EU, AU
};

// Zoho Payments base URL (region-specific & env-specific)
function getBaseUrl(): string {
  const isSandbox = ZOHO_PAYMENTS_CONFIG.ENV === 'sandbox';
  const domainMap: Record<string, string> = {
    IN: isSandbox ? 'https://paymentssandbox.zoho.in' : 'https://payments.zoho.in',
    US: isSandbox ? 'https://paymentssandbox.zoho.com' : 'https://payments.zoho.com',
    EU: isSandbox ? 'https://paymentssandbox.zoho.eu' : 'https://payments.zoho.eu',
    AU: isSandbox ? 'https://paymentssandbox.zoho.com.au' : 'https://payments.zoho.com.au',
  };
  return domainMap[ZOHO_PAYMENTS_CONFIG.DOMAIN] || domainMap.IN;
}

const API_BASE = () => `${getBaseUrl()}/api/v1`;

// Payment status codes (internal, mapped from Zoho events)
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
} as const;

// Zoho Payments event types
export const ZOHO_PAYMENT_EVENTS = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_PENDING: 'payment.pending',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
} as const;

// ─── OAuth Token Management ───────────────────────────────────────────────────

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get a valid OAuth access token, refreshing if needed.
 * Zoho OAuth tokens expire after ~1 hour; we cache and auto-refresh.
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  if (!ZOHO_PAYMENTS_CONFIG.CLIENT_ID || !ZOHO_PAYMENTS_CONFIG.CLIENT_SECRET || !ZOHO_PAYMENTS_CONFIG.REFRESH_TOKEN) {
    throw new Error('Zoho Payments OAuth configuration missing: CLIENT_ID, CLIENT_SECRET, or REFRESH_TOKEN not set');
  }

  try {
    const tokenUrl = `https://accounts.zoho.${ZOHO_PAYMENTS_CONFIG.DOMAIN === 'IN' ? 'in' : 'com'}/oauth/v2/token`;

    const response = await axios.post(tokenUrl, null, {
      params: {
        grant_type: 'refresh_token',
        client_id: ZOHO_PAYMENTS_CONFIG.CLIENT_ID,
        client_secret: ZOHO_PAYMENTS_CONFIG.CLIENT_SECRET,
        refresh_token: ZOHO_PAYMENTS_CONFIG.REFRESH_TOKEN,
      },
    });

    cachedAccessToken = response.data.access_token;
    // Zoho tokens typically expire in 3600 seconds
    tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;

    return cachedAccessToken!;
  } catch (error: any) {
    console.error('Error refreshing Zoho OAuth token:', error.response?.data || error.message);
    throw new Error(`Zoho OAuth token refresh failed: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Get authenticated axios headers for Zoho Payments API calls.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  return {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'X-Account-ID': ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID,
    'Content-Type': 'application/json',
  };
}

// ─── Payment Session Management ───────────────────────────────────────────────

/**
 * Create a Zoho Payments session.
 * This is the equivalent of Razorpay's createOrder — it creates a server-side
 * session that the frontend checkout widget uses to collect payment.
 * 
 * @param amount - Payment amount (in base currency units, e.g., rupees, NOT paise)
 * @param currency - Currency code (default: 'INR')
 * @param metadata - Additional metadata (receipt, notes, etc.)
 * @returns Zoho payment session data including payment_session_id
 */
export async function createPaymentSession(
  amount: number | string,
  currency: string = 'INR',
  metadata?: {
    receipt?: string;
    notes?: Record<string, string>;
    description?: string;
    customerName?: string;
    customerEmail?: string;
  }
): Promise<{
  payment_session_id: string;
  amount: number;
  currency: string;
  status: string;
}> {
  // Validate configuration
  if (!ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID || !ZOHO_PAYMENTS_CONFIG.CLIENT_ID) {
    throw new Error('Zoho Payments configuration missing: ACCOUNT_ID or CLIENT_ID not set');
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid amount: amount must be a number greater than 0');
  }

  try {
    const headers = await getAuthHeaders();

    const sessionData: Record<string, any> = {
      amount: Number(numericAmount.toFixed(2)), // Zoho Payments uses decimal format, not paise
      currency,
    };

    // Add optional fields
    if (metadata?.description) {
      sessionData.description = metadata.description;
    }
    
    // Convert other metadata to Zoho's meta_data array if needed, but for now we omit them 
    // to avoid "Invalid data provided" schema errors, as customer_name/email are not top-level fields.

    const response = await axios.post(
      `${API_BASE()}/paymentsessions?account_id=${ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID}`,
      sessionData,
      { headers }
    );

    const session = response.data.payments_session;
    console.log(`✅ Zoho payment session created: ${session.payments_session_id}`);

    return {
      payment_session_id: session.payments_session_id,
      amount: Number(session.amount),
      currency: session.currency || currency,
      status: session.status || 'created',
    };
  } catch (error: any) {
    console.error('Error creating Zoho payment session:', JSON.stringify(error.response?.data || error.message, null, 2));

    if (error.response?.data) {
      const errorData = error.response.data;
      const errorMessage = errorData.message || errorData.error?.message || 'Unknown error';
      const errorCode = errorData.code || errorData.error?.code || 'UNKNOWN';
      const details = errorData.details ? JSON.stringify(errorData.details) : '';
      throw new Error(`Zoho Payments API Error [${errorCode}]: ${errorMessage} ${details}`);
    }

    throw error;
  }
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

/**
 * Verify Zoho Payments webhook signature.
 * 
 * Zoho sends webhook signatures in the format:
 *   X-Zoho-Webhook-Signature: t=<timestamp>,v=<signature>
 * 
 * The signature is computed as: HMAC-SHA256(signingKey, "<timestamp>.<payload>")
 */
export function verifyWebhookSignature(
  payload: string | object,
  signatureHeader: string,
  signingKey: string = ZOHO_PAYMENTS_CONFIG.WEBHOOK_SIGNING_KEY
): boolean {
  try {
    if (!signatureHeader || !signingKey) {
      console.error('Missing webhook signature header or signing key');
      return false;
    }

    // Parse the signature header: "t=<timestamp>,v=<signature>"
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v='));

    if (!timestampPart || !signaturePart) {
      console.error('Invalid webhook signature format');
      return false;
    }

    const timestamp = timestampPart.substring(2);
    const receivedSignature = signaturePart.substring(2);

    // Construct the signed data
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedData = `${timestamp}.${payloadString}`;

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', signingKey)
      .update(signedData)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying Zoho webhook signature:', error);
    return false;
  }
}

// ─── Payment Details ─────────────────────────────────────────────────────────

/**
 * Get payment details from Zoho Payments API.
 */
export async function getPaymentDetails(paymentId: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE()}/payments/${paymentId}?account_id=${ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID}`, { headers });
    console.log(`[ZOHO-API] getPaymentDetails response for ${paymentId}:`, JSON.stringify(response.data, null, 2));
    // Zoho typically wraps responses in their entity name, e.g., { payment: { ... } }
    return response.data.payment || response.data;
  } catch (error: any) {
    console.error('Error fetching Zoho payment details:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get payment session details from Zoho Payments API.
 */
export async function getPaymentSessionDetails(paymentSessionId: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE()}/paymentsessions/${paymentSessionId}?account_id=${ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID}`, { headers });
    // Zoho typically wraps responses, e.g., { payments_session: { ... } }
    return response.data.payments_session || response.data;
  } catch (error: any) {
    console.error('Error fetching Zoho payment session details:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * List payments for a payment session.
 * Useful for checking if a session has any successful payments.
 */
export async function getPaymentsForSession(paymentSessionId: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE()}/payments`, {
      headers,
      params: { 
        payment_session_id: paymentSessionId,
        account_id: ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID
      },
    });
    return response.data?.payments || [];
  } catch (error: any) {
    console.error('Error fetching payments for session:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a refund for a payment.
 */
export async function createRefund(
  paymentId: string,
  amount?: number, // If not provided, full refund
  reason?: string
): Promise<any> {
  try {
    const headers = await getAuthHeaders();

    const refundData: Record<string, any> = {};
    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to paise
    }
    if (reason) {
      refundData.reason = reason;
    }

    const response = await axios.post(
      `${API_BASE()}/payments/${paymentId}/refunds?account_id=${ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID}`,
      refundData,
      { headers }
    );

    console.log(`✅ Zoho refund created for payment ${paymentId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error creating Zoho refund:', error.response?.data || error.message);
    throw error;
  }
}

import crypto from 'crypto';
import axios from 'axios';

// PhonePe OAuth Configuration - loaded from environment variables
export const PHONEPE_CONFIG = {
  CLIENT_ID: process.env.PHONEPE_CLIENT_ID || '',
  CLIENT_SECRET: process.env.PHONEPE_CLIENT_SECRET || '',
  CLIENT_VERSION: process.env.PHONEPE_CLIENT_VERSION || '1',
  MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID || '', // Still needed for some requests
  
  // OAuth and API URLs (corrected as per PhonePe docs)
  AUTH_BASE_URL: process.env.PHONEPE_AUTH_BASE_URL || 'https://api.phonepe.com/apis/identity-manager',
  API_BASE_URL: process.env.PHONEPE_API_BASE_URL || 'https://api.phonepe.com/apis/pg',
  
  // Legacy support (keeping for backward compatibility)
  SALT_KEY: process.env.PHONEPE_SALT_KEY || '',
  SALT_INDEX: process.env.PHONEPE_SALT_INDEX || '1',
  CALLBACK_VERSION: '/pg/v1/callback'
};

// OAuth token cache
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

// Generate OAuth access token
export async function getOAuthToken(): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  try {
    console.log('🔑 Generating new PhonePe OAuth token...');
    
    const tokenResponse = await axios.post(
      `${PHONEPE_CONFIG.AUTH_BASE_URL}/v1/oauth/token`,
      new URLSearchParams({
        client_id: PHONEPE_CONFIG.CLIENT_ID,
        client_secret: PHONEPE_CONFIG.CLIENT_SECRET,
        client_version: PHONEPE_CONFIG.CLIENT_VERSION,
        grant_type: 'client_credentials'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    if (tokenResponse.data.access_token) {
      // Cache the token with expiry (subtract 5 minutes for safety)
      const expiresAt = tokenResponse.data.expires_at ? 
        (tokenResponse.data.expires_at * 1000) - (5 * 60 * 1000) : 
        Date.now() + (55 * 60 * 1000); // Default 55 minutes
      
      tokenCache = {
        token: tokenResponse.data.access_token,
        expiresAt
      };
      
      console.log('✅ PhonePe OAuth token generated successfully');
      return tokenResponse.data.access_token;
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('❌ OAuth token generation failed:', error);
    throw new Error(`OAuth token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy checksum function (kept for backward compatibility)
export function generatePaymentChecksum(payload: any, endpoint: string): string {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const string = base64Payload + endpoint + PHONEPE_CONFIG.SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  return sha256 + '###' + PHONEPE_CONFIG.SALT_INDEX;
}

// Generate checksum for status verification
export function generateStatusChecksum(merchantTransactionId: string): string {
  const endpoint = `/pg/v1/status/${PHONEPE_CONFIG.MERCHANT_ID}/${merchantTransactionId}`;
  const string = endpoint + PHONEPE_CONFIG.SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  return sha256 + '###' + PHONEPE_CONFIG.SALT_INDEX;
}

// Verify webhook checksum
export function verifyWebhookChecksum(payload: any, receivedChecksum: string): boolean {
  const payloadString = JSON.stringify(payload);
  const string = payloadString + PHONEPE_CONFIG.CALLBACK_VERSION + PHONEPE_CONFIG.SALT_KEY;
  const expectedChecksum = crypto.createHash('sha256').update(string).digest('hex') + '###' + PHONEPE_CONFIG.SALT_INDEX;
  return receivedChecksum === expectedChecksum;
}

// Create OAuth payment payload (v2 API format)
export function createOAuthPaymentPayload(
  merchantOrderId: string,
  amount: number,
  redirectUrl: string
) {
  return {
    merchantOrderId,
    amount, // Amount in paisa
    paymentFlow: {
      type: 'PG_CHECKOUT',
      merchantUrls: {
        redirectUrl
      }
    }
  };
}

// Legacy payment payload (kept for backward compatibility)
export function createPaymentPayload(
  merchantTransactionId: string,
  amount: number,
  customerName: string,
  redirectUrl: string,
  callbackUrl: string
) {
  return {
    merchantId: PHONEPE_CONFIG.MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: `USER_${Date.now()}`,
    amount: amount * 100, // Convert to paise
    redirectUrl,
    callbackUrl,
    paymentInstrument: {
      type: 'PAY_PAGE'
    }
  };
}

// Payment status codes
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success', 
  FAILED: 'failed',
  TIMEOUT: 'timeout'
} as const;

// Response codes from PhonePe
export const PHONEPE_RESPONSE_CODES = {
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED', 
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  BAD_REQUEST: 'BAD_REQUEST',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT'
} as const;
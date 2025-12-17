# Industry Standard Improvements for PaymentCallbackPage

## Current Status: **Good (7/10)** → Target: **Industry Standard (9.5/10)**

## Issues to Fix:

### 1. **Global State Pollution** ❌
**Current:**
```typescript
let retryCount = (window as any).paymentRetryCount || 0;
(window as any).paymentRetryCount = retryCount + 1;
```

**Industry Standard:**
```typescript
const retryCountRef = useRef(0);
retryCountRef.current += 1;
```

### 2. **Type Safety** ❌
**Current:**
```typescript
const [paymentData, setPaymentData] = useState<any>(null);
```

**Industry Standard:**
```typescript
interface PaymentStatusResponse {
  success: boolean;
  status: 'success' | 'failed' | 'pending';
  data?: {
    orderNumber?: string;
    merchantTransactionId?: string;
    shouldClearCart?: boolean;
    [key: string]: unknown;
  };
}
const [paymentData, setPaymentData] = useState<PaymentStatusResponse['data']>(null);
```

### 3. **Magic Numbers** ❌
**Current:**
```typescript
if (retryCount < 15) { // Max 15 retries (45 seconds)
  setTimeout(checkPaymentStatus, 3000);
}
setTimeout(() => { ... }, 2000);
```

**Industry Standard:**
```typescript
const PAYMENT_RETRY_CONFIG = {
  MAX_RETRIES: 15,
  RETRY_INTERVAL_MS: 3000,
  REDIRECT_DELAY_MS: 2000,
  STATUS_CHECK_TIMEOUT_MS: 15000,
} as const;
```

### 4. **Logging Service** ❌
**Current:**
```typescript
console.log('💳 Payment success');
console.error('Error verifying Razorpay payment:', error);
```

**Industry Standard:**
```typescript
import { logger } from '@/lib/logger';

logger.info('payment.status.check', { 
  transactionId: merchantTransactionId,
  duration: responseTime 
});
logger.error('payment.verification.failed', { error, transactionId });
```

### 5. **Separation of Concerns** ❌
**Current:** All logic in component

**Industry Standard:** Extract to custom hook
```typescript
// hooks/usePaymentCallback.ts
export function usePaymentCallback() {
  // All business logic here
  return { status, paymentData, handleRetry };
}

// PaymentCallbackPage.tsx
export default function PaymentCallbackPage() {
  const { status, paymentData, handleRetry } = usePaymentCallback();
  // Only UI rendering
}
```

### 6. **Error Boundaries** ❌
**Current:** No error boundary

**Industry Standard:**
```typescript
<ErrorBoundary fallback={<PaymentErrorFallback />}>
  <PaymentCallbackPage />
</ErrorBoundary>
```

### 7. **Accessibility** ❌
**Current:** No ARIA labels

**Industry Standard:**
```typescript
<div role="status" aria-live="polite" aria-atomic="true">
  {status === 'checking' && (
    <>
      <Loader2 aria-label="Verifying payment" />
      <h2>Verifying Payment</h2>
    </>
  )}
</div>
```

### 8. **Analytics/Tracking** ❌
**Current:** No tracking

**Industry Standard:**
```typescript
import { trackEvent } from '@/lib/analytics';

trackEvent('payment.callback.started', { transactionId });
trackEvent('payment.callback.success', { 
  transactionId, 
  orderNumber,
  duration: responseTime 
});
```

### 9. **Constants File** ❌
**Current:** Inline values

**Industry Standard:**
```typescript
// constants/payment.ts
export const PAYMENT_CONFIG = {
  RETRY: {
    MAX_ATTEMPTS: 15,
    INTERVAL_MS: 3000,
  },
  TIMEOUT: {
    STATUS_CHECK_MS: 15000,
    REDIRECT_MS: 2000,
  },
  STORAGE_KEYS: {
    TRANSACTION_ID: 'currentPaymentTxnId',
    ORDER_ID: 'currentOrderId',
    CHECKOUT_SESSION: 'currentCheckoutSessionId',
    PENDING_ORDER: 'pendingOrderData',
  },
} as const;
```

### 10. **Error Types** ❌
**Current:** Generic errors

**Industry Standard:**
```typescript
class PaymentVerificationError extends Error {
  constructor(
    message: string,
    public transactionId: string,
    public code: 'VERIFICATION_FAILED' | 'TIMEOUT' | 'NETWORK_ERROR'
  ) {
    super(message);
    this.name = 'PaymentVerificationError';
  }
}
```

## Priority Improvements:

### High Priority (Must Have):
1. ✅ Remove global state pollution (useRef)
2. ✅ Add proper TypeScript types
3. ✅ Extract magic numbers to constants
4. ✅ Add error boundary

### Medium Priority (Should Have):
5. ✅ Extract business logic to custom hook
6. ✅ Add logging service
7. ✅ Add analytics tracking

### Low Priority (Nice to Have):
8. ✅ Add accessibility attributes
9. ✅ Add unit tests
10. ✅ Add error types

## Estimated Time to Industry Standard:
- **High Priority:** 2-3 hours
- **Medium Priority:** 3-4 hours  
- **Low Priority:** 4-6 hours
- **Total:** ~10-13 hours

## Current Grade: **7/10** (Good)
## After Improvements: **9.5/10** (Industry Standard)


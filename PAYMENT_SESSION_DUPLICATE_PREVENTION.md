# Payment Session Duplicate Prevention System

## Overview

This system implements server-side validation to prevent duplicate payment submissions and order creations by using time-limited payment sessions. Each payment attempt creates a unique session that tracks the transaction and prevents users from accidentally submitting multiple payments for the same order.

## Key Features

1. **Session-Based Validation**: Each payment/order attempt creates a unique session
2. **Time-Limited Sessions**: Sessions expire after 10 minutes (configurable)
3. **Automatic Cleanup**: Expired sessions are automatically cleaned up via TTL index and periodic cleanup
4. **Duplicate Detection**: Prevents duplicate submissions within the session window
5. **Session States**: Tracks session lifecycle (active, completed, expired, cancelled)

## Architecture Components

### 1. PaymentSession Model (`server/models/mongodb-models.ts`)

```typescript
interface IPaymentSession {
  sessionId: string;           // Unique session identifier
  customerId: number;          // User ID initiating payment
  amount: number;              // Payment amount
  canteenId: string;          // Canteen ID
  orderData: string;          // JSON string of order data
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  expiresAt: Date;            // Session expiration timestamp
  createdAt: Date;
  completedAt?: Date;         // When payment was completed
}
```

**Features:**
- TTL index for automatic cleanup after 1 hour
- Compound indexes for efficient duplicate detection
- Stores complete order data for validation

### 2. PaymentSessionService (`server/payment-session-service.ts`)

Core service managing payment sessions with the following capabilities:

#### Methods:

- **`createSession()`**: Creates a new payment session (default 10 minutes)
- **`checkDuplicateSession()`**: Validates if user has an active session for similar payment
- **`getSession()`**: Retrieves session by ID
- **`isSessionActive()`**: Checks if session is still valid
- **`completeSession()`**: Marks session as completed after successful payment
- **`cancelSession()`**: Cancels a session on error or user action
- **`cleanupExpiredSessions()`**: Manual cleanup of expired sessions
- **`getUserActiveSessions()`**: Gets all active sessions for a user
- **`validateOrderData()`**: Validates order data hasn't been tampered with

### 3. Duplicate Prevention Middleware

**`checkDuplicatePaymentMiddleware()`**
- Checks for duplicate payment sessions
- Matches by: customerId, amount, canteenId
- Looks back 10 minutes for active sessions
- Returns session details if duplicate found

## Implementation Flow

### Online Payment Flow (UPI/Card)

```
1. User clicks "Pay Now"
   │
   ├─→ Client sends payment request to /api/payments/initiate
   │
   ├─→ Server checks for duplicate sessions
   │   ├─→ If duplicate found → Return 429 with existing session info
   │   └─→ If no duplicate → Continue
   │
   ├─→ Create new payment session (10 min expiry)
   │
   ├─→ Initiate PhonePe payment
   │   ├─→ Success → Store sessionId in payment metadata
   │   └─→ Failure → Cancel session
   │
   ├─→ Redirect user to payment gateway
   │
   └─→ On payment completion → Mark session as completed
```

### Offline Payment Flow (Pay at Counter)

```
1. User clicks "Place Order" (offline)
   │
   ├─→ Client sends order request to /api/orders
   │
   ├─→ Server checks for duplicate sessions (if amount > 0)
   │   ├─→ If duplicate found → Return 429 with existing session info
   │   └─→ If no duplicate → Continue
   │
   ├─→ Create new order session (10 min expiry)
   │
   ├─→ Create order with status "pending_payment"
   │   ├─→ Success → Mark session as completed
   │   └─→ Failure → Cancel session
   │
   └─→ Order awaits payment at counter
```

## Session Lifecycle

```
[ACTIVE] → Session created when payment initiated
    ↓
    ├─→ Payment Success → [COMPLETED]
    ├─→ Payment Failed → [CANCELLED]
    ├─→ Time Expires → [EXPIRED]
    └─→ Manual Cancel → [CANCELLED]
```

## Duplicate Detection Logic

The system checks for duplicates by matching:

1. **Customer ID**: Same user
2. **Amount**: Same payment amount
3. **Canteen ID**: Same canteen
4. **Time Window**: Within last 10 minutes
5. **Session Status**: Only active sessions

If all criteria match, the request is rejected with HTTP 429 (Too Many Requests).

## API Endpoints

### Payment Session Management

#### 1. Get User Sessions
```http
GET /api/payment-sessions/user/:customerId
Response: List of active sessions with time remaining
```

#### 2. Check Session Status
```http
GET /api/payment-sessions/:sessionId/status
Response: Detailed session information
```

#### 3. Cancel Session
```http
POST /api/payment-sessions/:sessionId/cancel
Response: Success message
```

#### 4. Manual Cleanup (Admin)
```http
POST /api/payment-sessions/cleanup
Response: Number of sessions cleaned up
```

## Error Handling

### Client-Side Response

When duplicate detected (HTTP 429):
```json
{
  "success": false,
  "message": "You already have an active payment session. Please wait 234 seconds...",
  "existingSession": {
    "sessionId": "PSESS_1234567890_abc123def456",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "expiresAt": "2024-01-01T10:10:00.000Z",
    "timeRemaining": 234
  },
  "errorCode": "DUPLICATE_PAYMENT_SESSION"
}
```

### Error Scenarios

1. **Payment Gateway Timeout**: Session is cancelled
2. **Order Creation Failure**: Session is cancelled, stock restored
3. **Network Error**: Session is cancelled
4. **User Cancellation**: Session marked as cancelled

## Automatic Cleanup

### TTL Index
- MongoDB TTL index deletes expired sessions 1 hour after expiration
- Configurable via `expireAfterSeconds` in schema

### Periodic Cleanup
- Runs every 5 minutes via `setInterval`
- Updates status of expired active sessions to 'expired'
- Logs cleanup count for monitoring

```javascript
// In server/routes.ts
setInterval(async () => {
  await PaymentSessionService.cleanupExpiredSessions();
}, 5 * 60 * 1000); // Every 5 minutes
```

## Configuration

### Session Duration
Default: **10 minutes** (configurable per session)

```typescript
await PaymentSessionService.createSession(
  customerId,
  amount,
  canteenId,
  orderData,
  10 // Duration in minutes
);
```

### Duplicate Detection Window
Default: **10 minutes** (checks last 10 minutes of activity)

```typescript
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
```

## Benefits

1. **Prevents Accidental Double Charges**: Users can't submit duplicate payments
2. **Protects Against Multiple Clicks**: Rapid clicking won't create multiple orders
3. **Network Retry Protection**: Failed requests won't create duplicates on retry
4. **Browser Back Button Safety**: Going back and resubmitting is prevented
5. **Clear User Feedback**: Users know if they have a pending transaction

## Monitoring & Logging

Session lifecycle is logged at each stage:

```
✅ Payment session created: PSESS_xxx (expires at: ISO-DATE)
🔍 Checking for duplicate payment session: Customer X, Amount Y
⚠️ Duplicate session detected for customer X
✅ Payment session completed: PSESS_xxx
❌ Cancelled payment session: PSESS_xxx due to error
🧹 Cleaned up N expired payment sessions
```

## Database Indexes

```javascript
PaymentSessionSchema.index({ sessionId: 1 });
PaymentSessionSchema.index({ customerId: 1, status: 1 });
PaymentSessionSchema.index({ expiresAt: 1 }); // For TTL cleanup
PaymentSessionSchema.index({ status: 1, createdAt: -1 });
PaymentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }); // TTL
```

## Security Considerations

1. **Session ID Format**: `PSESS_{timestamp}_{random}` - Unpredictable
2. **Server-Side Validation**: Cannot be bypassed by client
3. **Time-Based Expiry**: Limits exposure window
4. **Order Data Validation**: Stored data is validated before use
5. **No User-Provided Session IDs**: All IDs generated server-side

## Testing Scenarios

1. **Normal Flow**: Single payment → Success
2. **Rapid Double-Click**: Second request rejected with 429
3. **Browser Refresh**: Same order attempt rejected
4. **Session Expiry**: After 10 min, new session allowed
5. **Different Amount**: Different amount allowed immediately
6. **Different User**: Different user allowed immediately
7. **Payment Failure**: Session cancelled, retry allowed

## Future Enhancements

1. **Per-User Rate Limiting**: Limit total active sessions per user
2. **Session Analytics**: Track duplicate attempt patterns
3. **Dynamic Expiry**: Adjust duration based on payment method
4. **Session Recovery**: Resume incomplete sessions
5. **Admin Dashboard**: View/manage all active sessions

## Related Files

- `server/models/mongodb-models.ts` - PaymentSession model
- `server/payment-session-service.ts` - Session management service
- `server/routes.ts` - API endpoints and integration
- `client/src/components/pages/CheckoutPage.tsx` - Client integration

## Conclusion

This payment session system provides robust duplicate prevention at the server level, ensuring payment integrity and preventing accidental double charges. The time-limited session approach balances security with user experience, while automatic cleanup ensures efficient resource usage.


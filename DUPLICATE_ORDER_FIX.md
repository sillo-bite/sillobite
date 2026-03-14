# Duplicate Order Creation Fix

## Problem
When a payment was completed, TWO orders were being created from the same payment transaction due to a race condition between:
1. Razorpay webhook handler (`/api/payments/webhook`)
2. Client payment status check (`/api/payments/status/:merchantTransactionId`)

Both paths would call `orderService.createOrderFromPayment()` simultaneously, and both would see that `payment.orderId` was null, so both would proceed to create separate orders.

## Example from Logs
```
Payment: TXN_1773473653263_ufg2dorff
Order 1: 643319277261 (created by webhook)
Order 2: 826091847265 (created by client status check)
```

## Root Cause
The duplicate check logic checked `if (!payment.orderId)` but this was NOT atomic. Between the check and the order creation, another process could also pass the same check, resulting in duplicate orders.

## Solution: Atomic Claim Pattern

### Implementation
We use MongoDB's `findOneAndUpdate` with a conditional query to atomically "claim" the order creation:

```typescript
// In order-service.ts createOrderFromPayment()

// Step 1: Atomically claim order creation
const claimResult = await Payment.findOneAndUpdate(
    {
        merchantTransactionId: merchantTransactionId,
        orderId: { $exists: false } // Only if no orderId exists
    },
    {
        $set: { 
            orderId: 'CLAIMING_ORDER_CREATION', // Temporary marker
            updatedAt: new Date()
        }
    },
    {
        new: false, // Return document BEFORE update
        upsert: false
    }
);

// Step 2: If claimResult is null, another process already claimed it
if (!claimResult) {
    // Check if order already exists and return it
    // Or throw error indicating already in progress
}

// Step 3: Create the order (only one process gets here)
const order = await this.createOrder(...);

// Step 4: Replace CLAIMING_MARKER with actual orderId
await Payment.findOneAndUpdate(
    { merchantTransactionId },
    { $set: { orderId: order.id } }
);
```

### Key Benefits
1. **Atomic Operation**: MongoDB ensures only ONE process can successfully update the payment with the claim marker
2. **Race Condition Proof**: If webhook and client callback run simultaneously, only one will succeed in claiming
3. **Graceful Handling**: The losing process detects the claim and either returns the existing order or exits gracefully
4. **Error Recovery**: If order creation fails after claiming, the marker is removed so it can be retried

## Files Modified
1. `server/services/order-service.ts` - Added atomic claim logic in `createOrderFromPayment()`
2. `server/routes.ts` - Added better error handling for race condition scenarios in:
   - `/api/payments/webhook` (line ~5795)
   - `/api/payments/status/:merchantTransactionId` (lines ~5931, ~6081)

## Testing
After deployment, monitor logs for:
- `🔒 Successfully claimed order creation for [txnId]` - Indicates successful claim
- `⚠️ Order creation already claimed/completed for [txnId]` - Indicates race condition was properly handled
- `ℹ️ Order creation already handled by another process` - Indicates graceful handling in webhook/status check

## Expected Behavior
- Only ONE order should be created per payment transaction
- Both webhook and client callback can run, but only one will create the order
- The other will detect the existing order and return it gracefully
- No duplicate orders, no errors in logs

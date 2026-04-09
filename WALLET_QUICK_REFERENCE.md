# Wallet System - Quick Reference

## Quick Start

```bash
# 1. Add to .env
DATABASE_URL=postgresql://...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# 2. Run migration
npx prisma migrate dev --name add_wallet_system

# 3. Generate Prisma client
npx prisma generate

# 4. Start server
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/:userId` | Get wallet details |
| GET | `/api/wallet/:userId/transactions` | Get transaction history |
| GET | `/api/wallet/:userId/balance` | Get current balance |
| POST | `/api/wallet/:userId/topup/create-order` | Create top-up order |
| POST | `/api/wallet/:userId/topup/verify` | Verify payment |
| POST | `/api/wallet/webhook` | Razorpay webhook |

## Service Methods

```typescript
import { walletService } from './services/walletService';

// Get or create wallet
const wallet = await walletService.getOrCreateWallet(userId);

// Get balance
const balance = await walletService.getBalance(userId);

// Credit wallet (add money)
await walletService.creditWallet({
  userId: 123,
  amount: 100,
  description: 'Wallet top-up',
  referenceType: 'topup',
  paymentId: 'pay_xxx',
  orderId: 'order_xxx'
});

// Debit wallet (spend money)
await walletService.debitWallet({
  userId: 123,
  amount: 50,
  description: 'Order payment',
  referenceType: 'order',
  referenceId: 'order_123'
});

// Check balance
const hasFunds = await walletService.hasSufficientBalance(userId, 100);

// Get transaction history
const history = await walletService.getTransactionHistory(userId, 50, 0);

// Get stats
const stats = await walletService.getWalletStats(userId);
```

## Frontend Component

```tsx
import WalletCard from '@/components/profile/WalletCard';

// In your component
<WalletCard userId={userInfo.id} />
```

## Database Queries

```sql
-- Get wallet balance
SELECT balance FROM wallets WHERE user_id = 123;

-- Get recent transactions
SELECT * FROM wallet_transactions 
WHERE user_id = 123 
ORDER BY created_at DESC 
LIMIT 10;

-- Get total credits
SELECT SUM(amount) FROM wallet_transactions 
WHERE user_id = 123 AND type = 'CREDIT' AND status = 'COMPLETED';

-- Get total debits
SELECT SUM(amount) FROM wallet_transactions 
WHERE user_id = 123 AND type = 'DEBIT' AND status = 'COMPLETED';
```

## Transaction Types

| Type | Description | Example |
|------|-------------|---------|
| CREDIT | Add money | Top-up, Refund, Cashback |
| DEBIT | Spend money | Order payment |

## Transaction Status

| Status | Description |
|--------|-------------|
| PENDING | Payment initiated, not confirmed |
| COMPLETED | Transaction successful |
| FAILED | Payment failed |
| CANCELLED | Transaction cancelled |
| REFUNDED | Amount refunded |

## Payment Flow

```
User → Add Money → Create Order → Razorpay Checkout
  ↓
Payment Success → Verify Signature → Complete Transaction
  ↓
Update Balance → Refresh UI
```

## Razorpay Test Cards

**Success:**
- Card: 4111 1111 1111 1111
- CVV: 123
- Expiry: 12/25

**Failure:**
- Card: 4000 0000 0000 0002
- CVV: 123
- Expiry: 12/25

## Common Patterns

### Check balance before order
```typescript
const hasFunds = await walletService.hasSufficientBalance(userId, orderAmount);
if (!hasFunds) {
  throw new Error('Insufficient wallet balance');
}
```

### Process order payment with wallet
```typescript
// Debit wallet
await walletService.debitWallet({
  userId,
  amount: orderAmount,
  description: `Payment for order #${orderId}`,
  referenceType: 'order',
  referenceId: orderId
});
```

### Refund to wallet
```typescript
await walletService.refundTransaction({
  userId,
  amount: refundAmount,
  description: `Refund for order #${orderId}`,
  referenceType: 'refund',
  referenceId: orderId
});
```

## Error Handling

```typescript
try {
  await walletService.debitWallet({...});
} catch (error) {
  if (error.message === 'Insufficient wallet balance') {
    // Handle insufficient balance
  }
  // Handle other errors
}
```

## Webhook Verification

```typescript
const signature = req.headers['x-razorpay-signature'];
const expectedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Optional (for webhooks)
RAZORPAY_WEBHOOK_SECRET=...
```

## Limits

- Minimum top-up: ₹10
- Maximum top-up: ₹10,000
- Currency: INR only (currently)

## Indexes

```sql
-- Automatically created by Prisma
CREATE INDEX idx_wallet_user_id ON wallets(user_id);
CREATE INDEX idx_transaction_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_transaction_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_transaction_reference_id ON wallet_transactions(reference_id);
CREATE INDEX idx_transaction_payment_id ON wallet_transactions(payment_id);
CREATE INDEX idx_transaction_order_id ON wallet_transactions(order_id);
CREATE INDEX idx_transaction_created_at ON wallet_transactions(created_at);
```

## Monitoring

```typescript
// Get wallet stats
const stats = await walletService.getWalletStats(userId);
console.log(`Balance: ₹${stats.balance}`);
console.log(`Total Credits: ₹${stats.totalCredits}`);
console.log(`Total Debits: ₹${stats.totalDebits}`);
console.log(`Transactions: ${stats.transactionCount}`);
```

## Debugging

```typescript
// Enable detailed logging
console.log('💰 Wallet operation:', {
  userId,
  operation: 'credit',
  amount,
  balanceBefore,
  balanceAfter
});
```

## Security Checklist

- ✅ Payment signature verification
- ✅ Webhook signature verification
- ✅ Balance validation before debit
- ✅ Transaction immutability
- ✅ Amount limits (min/max)
- ✅ Secure environment variables
- ✅ HTTPS in production

## Performance Tips

1. Use indexes for queries
2. Paginate transaction history
3. Cache wallet balance (with invalidation)
4. Use database transactions for consistency
5. Optimize webhook processing

## Next Steps

1. ✅ Wallet creation and top-up
2. ⏳ Order payment with wallet
3. ⏳ Partial payments (wallet + other methods)
4. ⏳ Cashback and rewards
5. ⏳ Wallet notifications

---

**Need more details?** Check `WALLET_SYSTEM_DOCUMENTATION.md`

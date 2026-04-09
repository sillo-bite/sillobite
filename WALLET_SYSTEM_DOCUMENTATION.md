# Wallet System Documentation

## Overview

The wallet system is a ledger-based digital wallet implementation that allows users to:
- Add money to their wallet via Razorpay
- View wallet balance and transaction history
- Use wallet balance for future orders (to be implemented)
- Track all wallet transactions with complete audit trail

## Architecture

### Database Schema (PostgreSQL via Prisma)

#### Wallet Model
```prisma
model Wallet {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  balance   Decimal  @default(0) @db.Decimal(10, 2)
  currency  String   @default("INR")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  transactions WalletTransaction[]
}
```

#### WalletTransaction Model (Ledger-based)
```prisma
model WalletTransaction {
  id                String   @id @default(uuid())
  walletId          Int
  userId            Int
  type              TransactionType  // CREDIT or DEBIT
  amount            Decimal  @db.Decimal(10, 2)
  balanceBefore     Decimal  @db.Decimal(10, 2)
  balanceAfter      Decimal  @db.Decimal(10, 2)
  description       String
  referenceType     String?  // "topup", "order", "refund", "cashback"
  referenceId       String?  // Order ID, Payment ID, etc.
  paymentMethod     String?  // "razorpay", "upi", etc.
  paymentId         String?  // Razorpay payment ID
  orderId           String?  // Razorpay order ID
  status            TransactionStatus  // PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED
  metadata          Json?
  createdAt         DateTime @default(now())
  
  wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
}
```

### Ledger-based Approach

The wallet uses a ledger-based system where:
1. Every transaction records the balance before and after
2. Transactions are immutable once created
3. Balance is calculated from the ledger for audit purposes
4. Supports both credit (add money) and debit (spend money) operations

## API Endpoints

### Get Wallet Details
```
GET /api/wallet/:userId
```

Response:
```json
{
  "wallet": {
    "id": 1,
    "userId": 123,
    "balance": "500.00",
    "currency": "INR",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "stats": {
    "balance": "500.00",
    "totalCredits": "1000.00",
    "totalDebits": "500.00",
    "transactionCount": 10,
    "currency": "INR"
  }
}
```

### Get Transaction History
```
GET /api/wallet/:userId/transactions?limit=50&offset=0
```

Response:
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "CREDIT",
      "amount": "100.00",
      "balanceBefore": "400.00",
      "balanceAfter": "500.00",
      "description": "Wallet top-up of ₹100",
      "referenceType": "topup",
      "referenceId": "order_xyz",
      "paymentMethod": "razorpay",
      "paymentId": "pay_abc",
      "orderId": "order_xyz",
      "status": "COMPLETED",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "totalCount": 10,
  "hasMore": false
}
```

### Create Top-up Order
```
POST /api/wallet/:userId/topup/create-order
```

Request:
```json
{
  "amount": 100
}
```

Response:
```json
{
  "orderId": "order_xyz",
  "amount": 10000,
  "currency": "INR",
  "transactionId": "uuid",
  "key": "rzp_test_xxx"
}
```

### Verify Top-up Payment
```
POST /api/wallet/:userId/topup/verify
```

Request:
```json
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "signature",
  "transactionId": "uuid"
}
```

Response:
```json
{
  "success": true,
  "message": "Wallet top-up successful",
  "transaction": {
    "id": "uuid",
    "amount": "100.00",
    "balanceAfter": "500.00",
    "status": "COMPLETED"
  },
  "newBalance": "500.00"
}
```

### Check Balance
```
GET /api/wallet/:userId/balance
```

Response:
```json
{
  "balance": "500.00",
  "currency": "INR"
}
```

### Webhook Handler
```
POST /api/wallet/webhook
```

Handles Razorpay webhook events for payment status updates.

## Wallet Service Methods

### Core Methods

#### `getOrCreateWallet(userId: number)`
Gets existing wallet or creates a new one for the user.

#### `getBalance(userId: number): Promise<Decimal>`
Returns the current wallet balance.

#### `creditWallet(params)`
Adds money to the wallet (top-up, refund, cashback).

Parameters:
- `userId`: User ID
- `amount`: Amount to credit
- `description`: Transaction description
- `referenceType`: Type of transaction (optional)
- `referenceId`: Reference ID (optional)
- `paymentMethod`: Payment method (optional)
- `paymentId`: Payment ID (optional)
- `orderId`: Order ID (optional)
- `metadata`: Additional data (optional)

#### `debitWallet(params)`
Deducts money from the wallet (order payment).

Parameters:
- `userId`: User ID
- `amount`: Amount to debit
- `description`: Transaction description
- `referenceType`: Type of transaction (optional)
- `referenceId`: Reference ID (optional)
- `metadata`: Additional data (optional)

#### `getTransactionHistory(userId, limit, offset)`
Retrieves paginated transaction history.

#### `createPendingTransaction(params)`
Creates a pending transaction for payment processing.

#### `completePendingTransaction(transactionId, paymentId, paymentMethod)`
Completes a pending transaction after successful payment.

#### `failPendingTransaction(transactionId, reason)`
Marks a pending transaction as failed.

#### `refundTransaction(params)`
Creates a refund transaction.

#### `hasSufficientBalance(userId, amount): Promise<boolean>`
Checks if user has sufficient balance.

#### `getWalletStats(userId)`
Returns wallet statistics including total credits, debits, and transaction count.

## Frontend Components

### WalletCard Component

Location: `client/src/components/profile/WalletCard.tsx`

Features:
- Display wallet balance
- Show total credits and debits
- Add money button
- Transaction history dialog
- Quick amount selection (₹100, ₹200, ₹500, ₹1000)
- Razorpay integration for payments
- Real-time balance updates

Props:
```typescript
interface WalletCardProps {
  userId: number;
}
```

Usage:
```tsx
<WalletCard userId={userInfo.id} />
```

## Payment Flow

### Top-up Flow

1. User clicks "Add Money" button
2. User enters amount or selects quick amount
3. Frontend calls `/api/wallet/:userId/topup/create-order`
4. Backend creates Razorpay order and pending transaction
5. Frontend opens Razorpay checkout
6. User completes payment
7. Razorpay calls success handler
8. Frontend calls `/api/wallet/:userId/topup/verify`
9. Backend verifies payment signature
10. Backend completes pending transaction
11. Wallet balance is updated
12. Frontend refreshes wallet data

### Webhook Flow (Backup)

1. Razorpay sends webhook event
2. Backend verifies webhook signature
3. Backend processes payment.captured or payment.failed event
4. Backend updates transaction status
5. Wallet balance is updated if payment captured

## Security Features

1. **Payment Signature Verification**: All payments are verified using Razorpay signature
2. **Webhook Signature Verification**: Webhooks are verified using HMAC SHA256
3. **Transaction Immutability**: Transactions cannot be modified once created
4. **Balance Validation**: Debit operations check for sufficient balance
5. **Amount Limits**: 
   - Minimum top-up: ₹10
   - Maximum top-up: ₹10,000

## Environment Variables

Add these to your `.env` file:

```env
# Razorpay (required for wallet top-up)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Database (already configured)
DATABASE_URL=postgresql://user:password@host:port/database
```

## Migration

Run the following command to create wallet tables:

```bash
npx prisma migrate dev --name add_wallet_system
```

Or in production:

```bash
npx prisma migrate deploy
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Wallet creation and management
- ✅ Top-up via Razorpay
- ✅ Transaction history
- ✅ Balance display
- ✅ Ledger-based tracking

### Phase 2 (To be implemented)
- [ ] Use wallet balance for order payments
- [ ] Partial wallet payments (wallet + other payment methods)
- [ ] Cashback on orders
- [ ] Referral bonuses
- [ ] Wallet-to-wallet transfers
- [ ] Auto top-up when balance is low
- [ ] Wallet freeze/unfreeze by admin
- [ ] Transaction disputes and resolution
- [ ] Export transaction history (CSV/PDF)
- [ ] Wallet notifications (low balance, transaction alerts)

### Phase 3 (Advanced)
- [ ] Wallet rewards program
- [ ] Scheduled payments
- [ ] Recurring top-ups
- [ ] Multi-currency support
- [ ] Wallet analytics dashboard
- [ ] Fraud detection
- [ ] Transaction limits per day/week/month

## Testing

### Manual Testing Checklist

1. **Wallet Creation**
   - [ ] New user gets wallet automatically
   - [ ] Wallet starts with ₹0 balance

2. **Top-up**
   - [ ] Can add ₹10 (minimum)
   - [ ] Cannot add less than ₹10
   - [ ] Cannot add more than ₹10,000
   - [ ] Quick amounts work correctly
   - [ ] Razorpay checkout opens
   - [ ] Payment success updates balance
   - [ ] Payment failure doesn't update balance

3. **Transaction History**
   - [ ] Shows all transactions
   - [ ] Displays correct amounts
   - [ ] Shows transaction status
   - [ ] Pagination works

4. **Balance Display**
   - [ ] Shows correct balance
   - [ ] Updates after top-up
   - [ ] Shows total credits/debits

## Troubleshooting

### Common Issues

1. **Razorpay checkout not opening**
   - Check if Razorpay script is loaded
   - Verify RAZORPAY_KEY_ID is set
   - Check browser console for errors

2. **Payment verification fails**
   - Verify RAZORPAY_KEY_SECRET is correct
   - Check signature verification logic
   - Review server logs

3. **Balance not updating**
   - Check if transaction completed successfully
   - Verify wallet update query
   - Check for database errors

4. **Webhook not working**
   - Verify RAZORPAY_WEBHOOK_SECRET
   - Check webhook URL configuration in Razorpay dashboard
   - Review webhook logs

## Support

For issues or questions:
1. Check server logs for errors
2. Review transaction status in database
3. Check Razorpay dashboard for payment status
4. Contact support with transaction ID

## License

MIT

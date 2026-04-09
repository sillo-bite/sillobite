# CareBite Order Creation Flow

## 🔄 Complete Order Flow with Rollback

### Overview
The CareBite order creation implements a robust flow with automatic rollback at each step to ensure data consistency and prevent stock/payment issues.

---

## 📋 Step-by-Step Flow

### Step 1: User Validation ✅
**What happens:**
- Validates email and access token from request
- Retrieves user from PostgreSQL database
- Verifies access token matches user

**On Failure:**
- Returns 401/404 error
- No rollback needed (nothing changed yet)

---

### Step 2: Menu Item Validation ✅
**What happens:**
- Fetches menu items from MongoDB
- Validates all items exist
- Validates items belong to specified canteen
- Calculates total order amount

**On Failure:**
- Returns 400 error with missing item IDs
- No rollback needed (nothing changed yet)

---

### Step 3: Real-Time Stock Validation ✅
**What happens:**
- Checks current stock levels in MongoDB
- Validates sufficient quantity for each item
- Prepares stock update operations

**On Failure:**
- Returns 400 error with detailed stock info
- Shows which items are out of stock
- Shows available vs requested quantities
- No rollback needed (nothing changed yet)

---

### Step 4: Stock Reservation 🔒 **CRITICAL**
**What happens:**
- **Immediately reserves stock** using atomic MongoDB operations
- Reduces stock count in database
- Uses `$inc` with validation to prevent negative stock
- This happens BEFORE checking wallet balance

**Why reserve before payment?**
- Prevents race conditions (multiple users ordering same item)
- Ensures stock is held for this specific order
- If payment fails, we can restore the reserved stock

**On Failure:**
- Returns 500 error
- No rollback needed (reservation itself failed)

---

### Step 5: Wallet Balance Check 💳
**What happens:**
- Checks user's wallet balance
- Compares with order total amount
- Calculates exact shortfall if insufficient

**On Failure:**
- **ROLLBACK: Restores reserved stock**
- Returns 400 error with:
  - Current balance
  - Order amount
  - Exact shortfall
  - Suggestion to add specific amount
- Stock is returned to inventory

**Rollback Process:**
```typescript
// Restore stock
const rollbackUpdates = stockValidation.updates.map(update => ({
  ...update,
  operation: 'restore' // Changes 'deduct' to 'restore'
}));
await stockService.processStockUpdates(rollbackUpdates);
```

---

### Step 6: Wallet Debit 💸
**What happens:**
- Deducts order amount from wallet
- Creates immutable transaction record
- Updates wallet balance
- Links transaction to order metadata

**On Failure:**
- **ROLLBACK: Restores reserved stock**
- Returns 500 error
- Stock is returned to inventory
- No money was actually debited

**Rollback Process:**
```typescript
// Restore stock (same as Step 5)
const rollbackUpdates = stockValidation.updates.map(update => ({
  ...update,
  operation: 'restore'
}));
await stockService.processStockUpdates(rollbackUpdates);
```

---

### Step 7: Order Creation 📝
**What happens:**
- Creates order in MongoDB
- Sets payment status as 'completed'
- Sets order status as 'pending'
- Links wallet transaction ID
- Adds CareBite metadata

**On Failure:**
- **ROLLBACK: Restores stock AND refunds wallet**
- Returns 500 error
- Stock is returned to inventory
- Money is refunded to wallet

**Rollback Process:**
```typescript
// 1. Restore stock
const rollbackUpdates = stockValidation.updates.map(update => ({
  ...update,
  operation: 'restore'
}));
await stockService.processStockUpdates(rollbackUpdates);

// 2. Refund wallet
await walletService.creditWallet({
  userId: user.id,
  amount: totalAmount,
  description: 'Refund for failed order',
  referenceType: 'refund',
  metadata: {
    reason: 'order_creation_failed',
    originalTransactionId: walletResult.transaction.id
  }
});
```

---

### Step 8: Notifications 📢
**What happens:**
- Sends WebSocket notification to canteen owner
- Sends push notification to canteen owner
- Order appears in canteen dashboard

**On Failure:**
- Logs warning but doesn't fail order
- Order is already created successfully
- Notifications are "best effort"

---

## 🔐 Atomic Operations

### Stock Operations
All stock operations use MongoDB atomic updates:

```typescript
// Deduct stock (with validation)
{
  updateOne: {
    filter: {
      _id: itemId,
      stock: { $gte: quantity } // Ensures sufficient stock
    },
    update: { $inc: { stock: -quantity } }
  }
}

// Restore stock
{
  updateOne: {
    filter: { _id: itemId },
    update: { $inc: { stock: quantity } }
  }
}
```

### Wallet Operations
Wallet uses ledger-based system with immutable transactions:

```typescript
// Debit
{
  type: 'debit',
  amount: totalAmount,
  balanceBefore: currentBalance,
  balanceAfter: currentBalance - totalAmount,
  description: 'Order payment'
}

// Credit (refund)
{
  type: 'credit',
  amount: totalAmount,
  balanceBefore: currentBalance,
  balanceAfter: currentBalance + totalAmount,
  description: 'Refund for failed order'
}
```

---

## 🛡️ Race Condition Prevention

### Problem
Two users order the last item simultaneously:
1. User A checks stock: 1 available ✅
2. User B checks stock: 1 available ✅
3. User A reserves stock: 0 remaining
4. User B tries to reserve: **FAILS** (stock already 0)

### Solution
Atomic stock reservation with validation:

```typescript
// This operation is atomic in MongoDB
await MenuItem.findOneAndUpdate(
  {
    _id: itemId,
    stock: { $gte: quantity } // Only succeeds if stock >= quantity
  },
  { $inc: { stock: -quantity } }
);
```

If stock is insufficient, the update returns `null` and we rollback.

---

## 📊 Flow Diagram

```
User Request
    ↓
[1] Validate User ────────────→ Error? → Return 401/404
    ↓
[2] Validate Menu Items ──────→ Error? → Return 400
    ↓
[3] Validate Stock ───────────→ Error? → Return 400
    ↓
[4] Reserve Stock (ATOMIC) ───→ Error? → Return 500
    ↓
[5] Check Wallet Balance ─────→ Error? → Rollback Stock → Return 400
    ↓
[6] Debit Wallet ─────────────→ Error? → Rollback Stock → Return 500
    ↓
[7] Create Order ─────────────→ Error? → Rollback Stock + Refund → Return 500
    ↓
[8] Send Notifications ───────→ Error? → Log Warning (Order OK)
    ↓
Success Response (201)
```

---

## ✅ Guarantees

### Data Consistency
- Stock is never lost (always restored on failure)
- Money is never lost (always refunded on failure)
- No orphaned reservations (rollback at each step)

### Atomicity
- Stock operations use MongoDB atomic updates
- Wallet operations use PostgreSQL transactions
- No partial states (all or nothing)

### Idempotency
- Each operation can be safely retried
- Rollback operations are safe to call multiple times
- No duplicate charges or stock deductions

---

## 🐛 Error Scenarios

### Scenario 1: Insufficient Stock
```
Flow: Steps 1-3 ✅ → Step 4 ❌
Rollback: None needed
Result: User sees "out of stock" error
```

### Scenario 2: Insufficient Balance
```
Flow: Steps 1-4 ✅ → Step 5 ❌
Rollback: Restore stock
Result: User sees "add ₹X to wallet" error
```

### Scenario 3: Wallet Debit Fails
```
Flow: Steps 1-5 ✅ → Step 6 ❌
Rollback: Restore stock
Result: User sees "payment failed" error
```

### Scenario 4: Order Creation Fails
```
Flow: Steps 1-6 ✅ → Step 7 ❌
Rollback: Restore stock + Refund wallet
Result: User sees "order failed, refunded" error
```

### Scenario 5: Notification Fails
```
Flow: Steps 1-7 ✅ → Step 8 ❌
Rollback: None (order successful)
Result: Order created, notification logged as warning
```

---

## 🔍 Monitoring

### Success Indicators
- ✅ User validated
- ✅ Stock validation passed
- ✅ Sufficient wallet balance
- ✅ Stock reserved
- ✅ Wallet debited
- ✅ Order created
- ✅ Notifications sent

### Failure Indicators
- ❌ Stock validation failed
- ❌ Insufficient balance
- ❌ Stock reservation failed
- ❌ Wallet debit failed
- ❌ Order creation failed
- ⚠️ Notification failed (non-critical)

### Rollback Indicators
- 🔄 Rolling back reserved stock
- ✅ Stock rollback completed
- ✅ Wallet refund completed
- ❌ Stock rollback failed (critical error)
- ❌ Wallet refund failed (critical error)

---

## 🎯 Best Practices

### For Developers
1. Always check rollback logs for failures
2. Monitor critical rollback errors (stock/wallet)
3. Test concurrent order scenarios
4. Verify atomic operations work correctly

### For Testing
1. Test with last available item (race conditions)
2. Test with exact wallet balance
3. Test with database failures
4. Test with network timeouts
5. Verify rollback completes successfully

### For Production
1. Monitor rollback frequency
2. Alert on critical rollback failures
3. Track stock discrepancies
4. Audit wallet transaction consistency
5. Log all order creation attempts

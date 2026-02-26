# Coupon Usage Tracking Debug Guide

## Problem
Users can use the same coupon multiple times, and usage is not being tracked in the database (`usedCount`, `usedBy`, `usageHistory` remain empty).

## Debugging Steps

### Step 1: Check if applyCoupon is Being Called

When a user creates an order with a coupon, check the server logs for these messages:

```
🎟️ [ORDER-CREATION] About to apply coupon
```

**If you DON'T see this message:**
- The `applyCoupon()` function is NOT being called at all
- Check if `serverValidatedCouponCode` is null
- Check if `order` object is null
- Look for earlier errors in order creation

**If you DO see this message:**
- Continue to Step 2

### Step 2: Check Input Parameters

Look for this log message:

```
🎟️ [COUPON] Input parameters: { code, userId, userIdType, orderAmount, orderId, orderNumber }
```

**Check these values:**
- `userId`: Should be a number (e.g., 19)
- `userIdType`: Should be "number"
- `code`: Should match the coupon code (e.g., "UDHAYAM")
- `orderId`: Should be a valid MongoDB ObjectId string
- `orderNumber`: Should be the order number (e.g., "ORD-12345")

**Common Issues:**
- `userId` is a string instead of number → Type conversion issue
- `userId` is undefined → Not being passed from request
- `orderId` is undefined → Order creation failed

### Step 3: Check Coupon Found

Look for this log message:

```
🎟️ [COUPON] Found coupon UDHAYAM: { usedCount, usageLimit, usedBy, usedByTypes, isActive }
```

**Check these values:**
- `usedCount`: Current usage count
- `usageLimit`: Maximum allowed uses
- `usedBy`: Array of user IDs who used the coupon
- `usedByTypes`: Array showing the type of each ID in usedBy (should all be "number")
- `isActive`: Should be true

**Common Issues:**
- `usedByTypes` contains "string" → Type mismatch! User IDs stored as strings
- `usedBy` already contains the userId → User already used coupon (expected behavior)
- `usedCount >= usageLimit` → Coupon limit reached (expected behavior)

### Step 4: Check Atomic Update Conditions

Look for this log message:

```
🎟️ [COUPON] Atomic update conditions: { _id, code, isActive, validFrom, validUntil, usedCount, usedBy, userIdToCheck, userIdType }
```

**Check these values:**
- `userIdToCheck`: Should match the userId from Step 2
- `userIdType`: Should be "number"
- `usedBy`: The $nin condition - should be `{ $nin: [userId] }`

**Common Issues:**
- `userIdType` is "string" but usedBy contains numbers → Type mismatch!
- `userIdType` is "number" but usedBy contains strings → Type mismatch!

### Step 5: Check Atomic Update Result

Look for this log message:

```
🎟️ [COUPON] Atomic update result: { success, resultExists, newUsedCount, newUsedBy }
```

**If `success: false` and `resultExists: false`:**
- The atomic update failed because conditions weren't met
- Continue to Step 6 to see why

**If `success: true`:**
- Coupon was applied successfully!
- Check database to verify `usedCount`, `usedBy`, and `usageHistory` were updated
- If database still shows 0 uses, there's a database write issue

### Step 6: Check Recheck Results (If Atomic Update Failed)

Look for this log message:

```
🎟️ [COUPON] Recheck results: { usedCount, usageLimit, usedBy, userInUsedBy }
```

**Possible reasons for failure:**
1. `usedCount >= usageLimit` → "Coupon usage limit reached"
2. `userInUsedBy: true` → "You have already used this coupon"
3. Neither of above → Unknown reason (check date validity, isActive, etc.)

### Step 7: Check Final Result

Look for this log message:

```
🎟️ [ORDER-CREATION] Coupon application result: { success, message, discountAmount }
```

**If `success: false`:**
- Check the `message` field for the reason
- Order was created but coupon was NOT applied
- This is the bug we're trying to fix!

**If `success: true`:**
- Coupon was applied successfully
- Verify in database that usage was tracked

## Common Root Causes

### 1. Type Mismatch (Most Likely)

**Problem:** `userId` is stored as string in `usedBy` array, but passed as number to `$nin` query.

**How to detect:**
```
🎟️ [COUPON] Found coupon: { usedBy: ["19"], usedByTypes: ["string"] }
🎟️ [COUPON] Atomic update conditions: { userIdToCheck: 19, userIdType: "number" }
```

**Fix:** Convert userId to number before storing:
```typescript
$addToSet: { usedBy: Number(userId) }
```

### 2. applyCoupon Not Being Called

**Problem:** The condition `if (serverValidatedCouponCode && order)` is false.

**How to detect:**
```
🎟️ [ORDER-CREATION] Skipping coupon application: { hasValidatedCoupon: false, hasOrder: true }
```

**Fix:** Check why `serverValidatedCouponCode` is null after validation.

### 3. Silent Error in applyCoupon

**Problem:** `applyCoupon()` throws an error but it's caught and logged without failing the request.

**How to detect:**
```
🎟️ [COUPON] Error applying coupon UDHAYAM: [error details]
```

**Fix:** Check the error details and fix the underlying issue.

### 4. Database Write Concern Issue

**Problem:** Write concern `{ w: 'majority', j: true }` fails if MongoDB is not configured properly.

**How to detect:**
```
🎟️ [COUPON] Error applying coupon: WriteConcernError
```

**Fix:** Check MongoDB configuration or reduce write concern to `{ w: 1 }`.

### 5. Race Condition (Less Likely with Atomic Update)

**Problem:** Multiple simultaneous requests bypass the atomic update.

**How to detect:**
- Multiple users use the same coupon at the exact same time
- `usedCount` increments by more than 1 per request

**Fix:** Already fixed with atomic `findOneAndUpdate` using `$nin` and `$addToSet`.

## Testing Procedure

### Test 1: Single Order with Coupon

1. Create a test order with coupon "UDHAYAM"
2. Check server logs for all the messages above
3. Verify in MongoDB:
   ```javascript
   db.coupons.findOne({ code: "UDHAYAM" })
   ```
4. Should show:
   - `usedCount: 1`
   - `usedBy: [19]` (or your user ID)
   - `usageHistory: [{ userId: 19, orderId: "...", ... }]`

### Test 2: Duplicate Coupon Use

1. Try to create another order with the same coupon and user
2. Should fail with: "You have already used this coupon"
3. Verify `usedCount` is still 1 (not 2)

### Test 3: Check Existing Orders

For the orders that already used "UDHAYAM" but weren't tracked:

1. Find the orders in MongoDB:
   ```javascript
   db.orders.find({ appliedCoupon: "UDHAYAM" })
   ```
2. Note the `customerId` values
3. Check if these users are in the coupon's `usedBy` array:
   ```javascript
   db.coupons.findOne({ code: "UDHAYAM" }, { usedBy: 1 })
   ```
4. If `usedBy` is empty, the bug is confirmed

## Manual Fix for Existing Data

If you need to manually fix the coupon usage data:

```javascript
// 1. Find all orders that used the coupon
const orders = db.orders.find({ appliedCoupon: "UDHAYAM" }).toArray();

// 2. Extract unique user IDs
const userIds = [...new Set(orders.map(o => o.customerId))];

// 3. Build usage history
const usageHistory = orders.map(o => ({
  userId: o.customerId,
  orderId: o._id,
  orderNumber: o.orderNumber,
  discountAmount: o.discountAmount || 0,
  usedAt: o.createdAt
}));

// 4. Update the coupon
db.coupons.updateOne(
  { code: "UDHAYAM" },
  {
    $set: {
      usedCount: orders.length,
      usedBy: userIds,
      usageHistory: usageHistory
    }
  }
);

// 5. Verify
db.coupons.findOne({ code: "UDHAYAM" });
```

## Next Steps

1. **Enable detailed logging** (already done in the code)
2. **Create a test order** with a coupon
3. **Check server logs** for all the debug messages
4. **Identify the root cause** using the patterns above
5. **Apply the appropriate fix**
6. **Test again** to verify the fix works
7. **Manually fix existing data** if needed

## Contact

If the issue persists after following this guide, provide:
1. Complete server logs from order creation
2. MongoDB document for the coupon (sanitized)
3. MongoDB document for the order (sanitized)
4. User ID and coupon code used

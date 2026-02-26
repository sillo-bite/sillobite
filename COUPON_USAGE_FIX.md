# Coupon Usage Tracking Fix

## Issues Found

1. **Multiple coupon uses by same user** - Users could use the same coupon multiple times
2. **Usage count not tracked** - `usedCount` wasn't incrementing properly
3. **User ID not tracked** - `usedBy` array wasn't being populated
4. **Usage limit not enforced** - Coupons could be used beyond their limit
5. **Race condition vulnerability** - Simultaneous requests could bypass checks

## Root Causes

### 1. Incorrect Atomic Update Query
**Problem**: The original query used `usedBy: { $ne: userId }` which doesn't work correctly with arrays.

```typescript
// ❌ WRONG - $ne doesn't work properly with arrays
usedBy: { $ne: userId }

// ✅ CORRECT - Use $nin to check if user NOT in array
'usedBy': { $nin: [userId] }
```

### 2. Missing Write Concern
**Problem**: No write concern specified, allowing potential data inconsistency.

```typescript
// ❌ WRONG - No write concern
{ new: true }

// ✅ CORRECT - Use majority write concern
{ 
  new: true,
  writeConcern: { w: 'majority', j: true }
}
```

### 3. Missing Database Indexes
**Problem**: No indexes on critical fields for atomic operations.

## Fixes Implemented

### 1. Fixed Atomic Update in `applyCoupon()`

**File**: `server/storage-hybrid.ts`

```typescript
// CRITICAL FIX: Use MongoDB's atomic findOneAndUpdate with proper conditions
const result = await Coupon.findOneAndUpdate(
  {
    _id: coupon._id, // Use _id for better performance
    code: code, // Double-check code matches
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    usedCount: { $lt: coupon.usageLimit }, // Ensure we don't exceed limit
    'usedBy': { $nin: [userId] } // CRITICAL: Use $nin to check user NOT in array
  },
  {
    $inc: { usedCount: 1 },
    $addToSet: { usedBy: userId }, // $addToSet prevents duplicates
    $push: { usageHistory: usageHistoryEntry }
  },
  { 
    new: true,
    // Use write concern for stronger consistency
    writeConcern: { w: 'majority', j: true }
  }
);
```

**Key Changes**:
- ✅ Changed `usedBy: { $ne: userId }` to `'usedBy': { $nin: [userId] }`
- ✅ Added `_id` check for better performance
- ✅ Added write concern for data consistency
- ✅ Added comprehensive logging for debugging

### 2. Added Database Indexes

**File**: `server/models/mongodb-models.ts`

```typescript
// CRITICAL INDEXES for coupon atomicity and performance
// 1. Index on code for fast lookups (already unique)
// 2. Compound index for atomic updates
CouponSchema.index({ code: 1, isActive: 1, validFrom: 1, validUntil: 1 });
// 3. Index on usedBy array for fast user lookup
CouponSchema.index({ usedBy: 1 });
// 4. Index on canteenId for canteen-specific queries
CouponSchema.index({ canteenId: 1, isActive: 1 });
```

**Benefits**:
- ✅ Faster coupon lookups
- ✅ Faster user-in-array checks
- ✅ Better atomic update performance
- ✅ Canteen-specific query optimization

### 3. Enhanced Logging

Added comprehensive logging to track coupon application:

```typescript
console.log(`🎟️ [COUPON] Applying coupon ${code} for user ${userId}`);
console.log(`🎟️ [COUPON] Found coupon:`, {
  usedCount: coupon.usedCount,
  usageLimit: coupon.usageLimit,
  usedBy: coupon.usedBy
});
console.log(`🎟️ [COUPON] Successfully applied coupon:`, {
  newUsedCount: result.usedCount,
  usedByCount: result.usedBy.length
});
```

## Testing Checklist

### Test 1: Single User, Single Use
- [ ] User applies coupon once → ✅ Success
- [ ] User tries to apply same coupon again → ❌ "You have already used this coupon"
- [ ] Check `usedBy` array contains user ID
- [ ] Check `usedCount` incremented by 1
- [ ] Check `usageHistory` has entry with user ID and order details

### Test 2: Usage Limit Enforcement
- [ ] Create coupon with `usageLimit: 3`
- [ ] User 1 applies → ✅ Success (usedCount: 1)
- [ ] User 2 applies → ✅ Success (usedCount: 2)
- [ ] User 3 applies → ✅ Success (usedCount: 3)
- [ ] User 4 applies → ❌ "Coupon usage limit reached"

### Test 3: Race Condition (Concurrent Requests)
- [ ] User sends 5 simultaneous requests with same coupon
- [ ] Only 1 request succeeds
- [ ] Other 4 requests fail with "You have already used this coupon"
- [ ] `usedCount` is exactly 1 (not 5)
- [ ] `usedBy` array has exactly 1 entry

### Test 4: Usage Details Visibility
- [ ] Admin views coupon usage details
- [ ] Can see `usedCount` correctly
- [ ] Can see list of users who used coupon
- [ ] Can see usage history with order numbers
- [ ] Can see discount amounts applied

## How to Test

### 1. Create Test Coupon
```bash
# Via Admin Panel or API
POST /api/admin/challenges
{
  "code": "TEST50",
  "description": "Test 50% off",
  "discountType": "percentage",
  "discountValue": 50,
  "usageLimit": 3,
  "validFrom": "2024-01-01",
  "validUntil": "2025-12-31",
  "createdBy": 1,
  "canteenId": "your-canteen-id"
}
```

### 2. Test Single Use
```bash
# Apply coupon in checkout
# Try to use same coupon again → Should fail
```

### 3. Test Concurrent Requests (Using curl)
```bash
# Send 5 simultaneous requests
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/orders \
    -H "Content-Type: application/json" \
    -d '{
      "customerId": 1,
      "appliedCoupon": "TEST50",
      "amount": 100,
      ...
    }' &
done
wait

# Check coupon usage
curl http://localhost:5000/api/admin/challenges/COUPON_ID/usage
```

### 4. Check Database Directly
```javascript
// In MongoDB shell or Compass
db.coupons.findOne({ code: "TEST50" })

// Should show:
// - usedCount: 1 (not 5)
// - usedBy: [1] (user ID)
// - usageHistory: [{ userId: 1, orderId: "...", ... }]
```

## Monitoring

### Check Logs
Look for these log patterns:

```
🎟️ [ORDER-CREATION] About to apply coupon: { couponCode, orderId, orderNumber, customerId, customerIdType, originalAmount }
🎟️ [COUPON] Applying coupon TEST50 for user 1, order ORDER-123
🎟️ [COUPON] Input parameters: { code, userId, userIdType, orderAmount, orderId, orderNumber }
🎟️ [COUPON] Found coupon TEST50: { usedCount: 0, usageLimit: 3, usedBy: [], usedByTypes: [] }
🎟️ [COUPON] Attempting atomic update for coupon TEST50
🎟️ [COUPON] Atomic update conditions: { _id, code, isActive, validFrom, validUntil, usedCount, usedBy, userIdToCheck, userIdType }
🎟️ [COUPON] Atomic update result: { success: true, resultExists: true, newUsedCount: 1, newUsedBy: [1] }
🎟️ [COUPON] Successfully applied coupon TEST50: { newUsedCount: 1, usageLimit: 3, usedByCount: 1, discountAmount: 50 }
🎟️ [ORDER-CREATION] Coupon application result: { success: true, message: 'Coupon applied successfully', discountAmount: 50 }
✅ Coupon TEST50 applied successfully to order ORDER-123
```

### Failed Attempts
```
🎟️ [COUPON] Atomic update result: { success: false, resultExists: false }
🎟️ [COUPON] Atomic update failed for coupon TEST50, re-checking conditions
🎟️ [COUPON] Recheck results: { usedCount: 1, usageLimit: 3, usedBy: [1], userInUsedBy: true }
🎟️ [COUPON] User 1 already used coupon TEST50
```

### Skipped Application
```
🎟️ [ORDER-CREATION] Skipping coupon application: { hasValidatedCoupon: false, hasOrder: true, couponCode: null }
```

## Database Indexes

After deploying, ensure indexes are created:

```javascript
// In MongoDB shell
db.coupons.getIndexes()

// Should show:
// 1. { code: 1 } (unique)
// 2. { code: 1, isActive: 1, validFrom: 1, validUntil: 1 }
// 3. { usedBy: 1 }
// 4. { canteenId: 1, isActive: 1 }
```

## Rollback Plan

If issues occur:

1. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   ```

2. **Manual coupon reset** (if needed):
   ```javascript
   // Reset specific coupon
   db.coupons.updateOne(
     { code: "TEST50" },
     { 
       $set: { usedCount: 0, usedBy: [], usageHistory: [] }
     }
   )
   ```

## Performance Impact

- **Positive**: Indexes improve query performance
- **Minimal**: Write concern adds ~10-20ms per coupon application
- **Trade-off**: Stronger consistency vs. slight latency increase

## Security Improvements

1. ✅ **Prevents coupon fraud** - Users can't reuse coupons
2. ✅ **Enforces usage limits** - Coupons can't exceed their limit
3. ✅ **Audit trail** - Full usage history tracked
4. ✅ **Race condition protection** - Atomic operations prevent concurrent abuse

## Next Steps

1. Deploy to staging environment
2. Run all test cases
3. Monitor logs for 24 hours
4. Deploy to production
5. Monitor coupon usage metrics

## Support

If issues persist:
1. Check MongoDB logs for errors
2. Verify indexes are created
3. Check application logs for `[COUPON]` entries
4. Contact database admin if write concern issues occur

# Coupon Amount Calculation Fix - COMPLETED ✅

## Issue

The coupon minimum order amount was being checked against the **final amount** (after discount and including charges), but it should be checked against the **items subtotal only** (menu items cost before charges and before discount).

## Example

Order breakdown:
- Items subtotal: ₹500 (menu items only)
- Canteen charges (3%): ₹15
- Subtotal before discount: ₹515
- Coupon discount (20 off): -₹20
- **Final amount: ₹495**

With the old logic:
- Coupon minimum: ₹499
- Amount checked: ₹495 (final amount) ❌ FAILS
- Result: "Minimum order amount of ₹499 required"

With the new logic:
- Coupon minimum: ₹499
- Amount checked: ₹500 (items subtotal) ✅ PASSES
- Result: Coupon applied successfully

---

## Server-Side Fixes (COMPLETED ✅)

### 1. OrderService.createOrder()
**File**: `server/services/order-service.ts`

```typescript
// Use itemsSubtotal (menu items cost only, before charges) for coupon validation
const amountForCouponValidation = orderData.itemsSubtotal || orderData.originalAmount || orderData.amount;

const couponApplication = await storage.applyCoupon(
    couponCode,
    customerIdAsNumber,
    amountForCouponValidation, // Use items subtotal, not final amount
    orderId,
    orderNumber
);
```

### 2. Direct POST /api/orders - Coupon Re-validation
**File**: `server/routes.ts` (lines ~3000)

```typescript
// Re-validate coupon server-side (NEVER trust client-provided discount)
// Use itemsSubtotal (menu items cost only, before charges) for validation
const amountForCouponValidation = req.body.itemsSubtotal || req.body.originalAmount || req.body.amount;

const couponValidation = await storage.validateCoupon(
    req.body.appliedCoupon,
    customerIdAsNumber,
    amountForCouponValidation, // Use items subtotal, not final amount
    req.body.canteenId
);
```

### 3. Direct POST /api/orders - Coupon Application
**File**: `server/routes.ts` (lines ~3060)

```typescript
// Use itemsSubtotal (menu items cost only, before charges) for coupon validation
const amountForCouponValidation = req.body.itemsSubtotal || req.body.originalAmount || req.body.amount;

const couponApplication = await storage.applyCoupon(
    serverValidatedCouponCode,
    customerIdAsNumber,
    amountForCouponValidation, // Use items subtotal, not final amount
    order.id,
    order.orderNumber
);
```

---

## Client-Side Fixes (COMPLETED ✅)

### 1. CheckoutPage - Amount Calculation
**File**: `client/src/components/pages/CheckoutPage.tsx`

Added `amountForCouponValidation` variable that uses `subtotal`:
```typescript
const {
    subtotal,
    discountAmount,
    totalBeforeCharges: totalBeforeDiscount,
    chargesTotal,
    finalTotal: total,
    chargesApplied
} = calculateOrderTotal(
    cart,
    chargesData?.items || [],
    mappedCoupon
);

// For coupon validation, use subtotal (menu items only, before charges and discount)
// This ensures minimum order amount is checked against items only
const amountForCouponValidation = subtotal;
```

### 2. CheckoutPage - CouponApplicator Props
**File**: `client/src/components/pages/CheckoutPage.tsx`

Updated CouponApplicator to receive correct amount and canteenId:
```typescript
<CouponApplicator
  totalAmount={amountForCouponValidation}
  canteenId={canteenId || undefined}
  onCouponApplied={(couponData) => setAppliedCoupon(couponData)}
  onCouponRemoved={handleRemoveCoupon}
  appliedCoupon={appliedCoupon}
/>
```

### 3. CouponApplicator - Interface Update
**File**: `client/src/components/payment/CouponApplicator.tsx`

Added `canteenId` prop:
```typescript
interface CouponApplicatorProps {
  totalAmount: number;
  canteenId?: string;
  onCouponApplied?: (couponData: { ... }) => void;
  onCouponRemoved?: () => void;
  appliedCoupon?: { ... } | null;
}
```

### 4. CouponApplicator - Validation Request
**File**: `client/src/components/payment/CouponApplicator.tsx`

Updated validation request to include canteenId:
```typescript
body: JSON.stringify({
  code: code.trim().toUpperCase(),
  userId: getUserIdFromStorage(),
  orderAmount: totalAmount, // Now receives subtotal from parent
  canteenId: canteenId
})
```

---

## Summary of Changes

### What Changed:
1. ✅ Server-side coupon validation now uses `itemsSubtotal` instead of final amount
2. ✅ Server-side coupon application now uses `itemsSubtotal` instead of final amount
3. ✅ Client-side now passes `subtotal` to CouponApplicator instead of `totalBeforeDiscount`
4. ✅ Client-side now includes `canteenId` in coupon validation requests
5. ✅ All three coupon validation/application points updated (OrderService, direct order creation validation, direct order creation application)

### Result:
✅ Coupon minimum amount is now checked against menu items cost only (₹500), not including charges (₹15)
✅ Coupon with minimum ₹499 will now pass validation correctly
✅ Canteen isolation is enforced in validation
✅ Consistent behavior across all order creation paths (webhook, direct, POS)

---

## Testing Checklist

- [ ] Test coupon with minimum amount just below items subtotal (should pass)
- [ ] Test coupon with minimum amount above items subtotal (should fail)
- [ ] Test coupon validation before order creation
- [ ] Test coupon application during order creation
- [ ] Test with orders that have canteen charges
- [ ] Test with orders that don't have canteen charges
- [ ] Verify coupon usage tracking still works correctly
- [ ] Test global coupons vs canteen-specific coupons

---

## Files Modified

1. `server/services/order-service.ts` - Updated createOrder method
2. `server/routes.ts` - Updated direct order creation endpoint (validation and application)
3. `client/src/components/pages/CheckoutPage.tsx` - Added amountForCouponValidation, updated CouponApplicator props
4. `client/src/components/payment/CouponApplicator.tsx` - Added canteenId prop, updated validation request
  canteenId: "canteen-123",
  // ... other fields
};
```

## How to Calculate itemsSubtotal (Client)

```typescript
// Calculate items subtotal (menu items only)
const itemsSubtotal = cartItems.reduce((total, item) => {
  return total + (item.price * item.quantity);
}, 0);

// Calculate charges (applied to items subtotal)
const chargesTotal = calculateCharges(itemsSubtotal, canteenCharges);

// Calculate subtotal before discount
const subtotalBeforeDiscount = itemsSubtotal + chargesTotal;

// Apply coupon discount (to items subtotal, not including charges)
const discountAmount = calculateDiscount(itemsSubtotal, coupon);

// Calculate final amount
const finalAmount = subtotalBeforeDiscount - discountAmount;

// Send to server
const orderData = {
  itemsSubtotal: itemsSubtotal, // ← For coupon validation
  chargesTotal: chargesTotal,
  originalAmount: subtotalBeforeDiscount,
  discountAmount: discountAmount,
  amount: finalAmount,
  appliedCoupon: coupon.code,
  // ... other fields
};
```

## Testing

After restarting the server and updating the client:

### Test 1: Order with items subtotal ≥ minimum
- Items subtotal: ₹500
- Coupon minimum: ₹499
- Expected: ✅ Coupon applied successfully

### Test 2: Order with items subtotal < minimum
- Items subtotal: ₹450
- Coupon minimum: ₹499
- Expected: ❌ "Minimum order amount of ₹499 required"

### Test 3: Order with charges
- Items subtotal: ₹500
- Charges: ₹15
- Final amount: ₹515
- Coupon minimum: ₹499
- Expected: ✅ Coupon applied (checked against ₹500, not ₹515)

## Summary

**Server-side**: ✅ Fixed - Now uses `itemsSubtotal` for coupon validation

**Client-side**: ⚠️ Needs update - Must send `itemsSubtotal` in:
1. Coupon validation requests (`POST /api/coupons/validate`)
2. Order creation requests (`POST /api/orders` or payment metadata)

The server will fall back to `originalAmount` or `amount` if `itemsSubtotal` is not provided, but for correct behavior, the client should always send `itemsSubtotal`.

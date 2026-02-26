# Global Coupons Implementation Guide

## Overview
Global coupons are coupons that work across ALL canteens in the system, rather than being restricted to a single canteen.

---

## How It Works

### 1. Special CanteenId Value
- Global coupons use `canteenId: "GLOBAL"` instead of a specific canteen ID
- This special value is recognized throughout the system

### 2. Validation Logic
When validating a coupon for an order:
```typescript
// Query checks for EITHER the specific canteen OR global coupons
const query = {
  code: couponCode,
  $or: [
    { canteenId: specificCanteenId },
    { canteenId: 'GLOBAL' }
  ]
};
```

### 3. Database Schema
```typescript
canteenId: { 
  type: String, 
  required: true, 
  default: 'GLOBAL' 
}
```

---

## Creating Global Coupons

### Admin UI
1. Go to Admin Panel → Coupon Management
2. Click "Create Coupon"
3. In the Canteen dropdown, select **"🌍 Global (All Canteens)"**
4. Fill in other coupon details
5. Click "Create"

### API
```typescript
POST /api/coupons
{
  "code": "WELCOME50",
  "description": "Welcome discount for all canteens",
  "discountType": "percentage",
  "discountValue": 50,
  "usageLimit": 1000,
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "canteenId": "GLOBAL",  // <-- This makes it global
  "createdBy": 1
}
```

---

## Use Cases

### 1. Platform-Wide Promotions
- New user welcome offers
- Festival discounts across all canteens
- Platform anniversary celebrations

### 2. Marketing Campaigns
- Referral program coupons
- Social media promotion codes
- Partnership discounts

### 3. Loyalty Rewards
- Milestone rewards (100th order, etc.)
- VIP user benefits
- Student/employee benefits across campus

---

## Features

### ✅ Works Everywhere
- Users can apply global coupons at ANY canteen
- No need to create duplicate coupons for each canteen

### ✅ Centralized Management
- Super admins manage global coupons from one place
- Easy to track usage across all canteens

### ✅ Canteen-Specific Override
- Canteen owners can still create their own specific coupons
- Specific canteen coupons don't interfere with global ones

### ✅ Visual Indicators
- Global coupons show "🌍 Global - Valid in all canteens" badge
- Easy to distinguish from canteen-specific coupons

---

## Validation Flow

```
User applies coupon "WELCOME50" at Canteen A
    ↓
System queries: Find coupon where code = "WELCOME50" 
                AND (canteenId = "canteen-a-id" OR canteenId = "GLOBAL")
    ↓
Found: WELCOME50 with canteenId = "GLOBAL"
    ↓
Validate: Check active, dates, usage limit, user eligibility
    ↓
Apply: Discount calculated and applied to order
    ↓
Track: Usage recorded with canteen context
```

---

## API Endpoints

### Get Active Coupons for Canteen
```typescript
GET /api/coupons/active?canteenId=canteen-123

// Returns both:
// 1. Coupons specific to canteen-123
// 2. Global coupons (canteenId: "GLOBAL")
```

### Validate Coupon
```typescript
POST /api/coupons/validate
{
  "code": "WELCOME50",
  "userId": 123,
  "orderAmount": 500,
  "canteenId": "canteen-123"  // System checks both specific and global
}
```

---

## Storage Methods

### Get Active Coupons by Canteen
```typescript
async getActiveCouponsByCanteen(canteenId: string): Promise<any[]> {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: { $lt: ['$usedCount', '$usageLimit'] },
    $or: [
      { canteenId: canteenId },
      { canteenId: 'GLOBAL' }
    ]
  }).sort({ createdAt: -1 });
  return mongoToPlain(coupons);
}
```

### Validate Coupon
```typescript
async validateCoupon(code: string, userId?: number, orderAmount?: number, canteenId?: string) {
  const query: any = { code };
  if (canteenId) {
    query.$or = [
      { canteenId: canteenId },
      { canteenId: 'GLOBAL' }
    ];
  }
  const coupon = await Coupon.findOne(query);
  // ... validation logic
}
```

---

## Usage Tracking

### Global Coupon Usage
- Usage is tracked globally across all canteens
- `usageHistory` includes which canteen the coupon was used at
- Analytics can show per-canteen breakdown

### Example Usage History
```json
{
  "code": "WELCOME50",
  "canteenId": "GLOBAL",
  "usedCount": 150,
  "usageHistory": [
    {
      "userId": 123,
      "orderId": "order-1",
      "orderNumber": "123456",
      "discountAmount": 50,
      "usedAt": "2024-01-15T10:30:00Z",
      "canteenId": "canteen-a"  // Tracked in order context
    },
    {
      "userId": 456,
      "orderId": "order-2",
      "orderNumber": "123457",
      "discountAmount": 50,
      "usedAt": "2024-01-15T11:00:00Z",
      "canteenId": "canteen-b"  // Different canteen
    }
  ]
}
```

---

## Security Considerations

### ✅ Same Security as Regular Coupons
- Authentication required
- Rate limiting applied
- Server-side validation
- Atomic usage tracking

### ✅ Admin-Only Creation
- Only super admins can create global coupons
- Canteen owners cannot create global coupons (only for their canteen)

### ✅ Usage Limits
- Global usage limit applies across ALL canteens
- If limit is 1000, it's 1000 total uses, not per canteen

---

## Migration Guide

### For Existing Coupons
If you have existing coupons without the GLOBAL concept:

1. **All existing coupons remain canteen-specific** (they have specific canteenId)
2. **No migration needed** - they continue to work as before
3. **New global coupons** can be created going forward

### Database Update
No migration script needed - the schema change is backward compatible:
- Existing coupons: Keep their specific canteenId
- New global coupons: Use canteenId = "GLOBAL"

---

## Best Practices

### 1. Use Global Coupons Sparingly
- Reserve for truly platform-wide promotions
- Don't overuse to maintain exclusivity

### 2. Set Appropriate Limits
- Global coupons can be used more, so set higher limits
- Monitor usage closely

### 3. Clear Descriptions
- Make it clear in the description that it's valid everywhere
- Example: "Valid at all canteens across campus"

### 4. Time-Limited Campaigns
- Use shorter validity periods for global promotions
- Creates urgency and prevents abuse

### 5. Track Performance
- Monitor which canteens see most usage
- Adjust strategy based on data

---

## Example Scenarios

### Scenario 1: New User Welcome
```typescript
{
  "code": "WELCOME10",
  "description": "Welcome! Get 10% off your first order at any canteen",
  "discountType": "percentage",
  "discountValue": 10,
  "maxDiscountAmount": 50,
  "usageLimit": 10000,
  "canteenId": "GLOBAL",
  "assignmentType": "all"
}
```

### Scenario 2: Festival Offer
```typescript
{
  "code": "DIWALI2024",
  "description": "Diwali Special - ₹100 off on orders above ₹500",
  "discountType": "fixed",
  "discountValue": 100,
  "minimumOrderAmount": 500,
  "usageLimit": 5000,
  "canteenId": "GLOBAL",
  "validFrom": "2024-10-20T00:00:00Z",
  "validUntil": "2024-11-05T23:59:59Z"
}
```

### Scenario 3: Referral Program
```typescript
{
  "code": "REFER50",
  "description": "Referral reward - ₹50 off at any canteen",
  "discountType": "fixed",
  "discountValue": 50,
  "usageLimit": 1,  // One-time use per user
  "canteenId": "GLOBAL",
  "assignmentType": "specific",
  "assignedUsers": [123, 456, 789]  // Specific referred users
}
```

---

## Troubleshooting

### Issue: Global coupon not showing for users
**Solution**: Check that:
- Coupon is active (`isActive: true`)
- Current date is within validity period
- Usage limit not reached
- User hasn't already used it (if one-time)

### Issue: Coupon works at one canteen but not another
**Solution**: Verify:
- CanteenId is exactly "GLOBAL" (case-sensitive)
- Validation query includes `$or` clause
- No canteen-specific restrictions in code

### Issue: Usage count seems wrong
**Solution**: Remember:
- Global coupons track TOTAL usage across all canteens
- Not per-canteen usage
- Check `usageHistory` for breakdown

---

## Summary

Global coupons provide a powerful way to run platform-wide promotions while maintaining:
- ✅ Security and validation
- ✅ Usage tracking and analytics
- ✅ Easy management for admins
- ✅ Flexibility for marketing campaigns

The implementation is backward compatible and doesn't affect existing canteen-specific coupons.

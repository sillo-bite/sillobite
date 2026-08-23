# CareBite Order Creation - Testing Guide

## 🎯 Quick Test Setup

### Prerequisites Checklist
- [ ] User account exists (✅ Found: steepan430@gmail.com)
- [ ] Access token generated
- [ ] Sufficient wallet balance
- [ ] Menu items available (✅ Found: 5 items)

---

## 📋 Step-by-Step Testing

### Step 1: Generate Access Token

1. Open the app: `http://localhost:5000/app`
2. Login with: `steepan430@gmail.com`
3. Go to **Profile** page
4. Find **Connection Code** section
5. Click **Generate New Code**
6. Copy the **Access Token** (not the 6-digit code)

### Step 2: Top Up Wallet

**Current Balance:** ₹100  
**Required for Test:** ₹226  
**Need to Add:** ₹126 or more

1. Stay on **Profile** page
2. Find **Wallet** section
3. Click **Add Money**
4. Enter amount: `150` (or more)
5. Complete Razorpay payment
6. Verify new balance shows ₹250+

### Step 3: Test in Postman

#### Request Configuration

```
Method: POST
URL: http://localhost:5000/api/carebite/create-order
Headers:
  Content-Type: application/json
```

#### Request Body (Replace ACCESS_TOKEN)

```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "YOUR_ACCESS_TOKEN_HERE",
  "menus": [
    ["69a08fb398369948180b1f51", 2],
    ["69a0909b98369948180b1fc0", 2]
  ],
  "canteenId": "canteen-1771955358018"
}
```

**What this orders:**
- 2x Biscoff Brownie @ ₹59 = ₹118
- 2x Nuts Brownie @ ₹54 = ₹108
- **Total: ₹226**

---

## ✅ Expected Success Response

```json
{
  "success": true,
  "order": {
    "id": 123,
    "orderNumber": "123456789012",
    "amount": 226,
    "status": "pending",
    "items": 2,
    "walletBalance": "24.00"
  },
  "message": "Order placed successfully"
}
```

---

## ❌ Possible Error Responses

### 1. Missing Access Token

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "missing_fields",
  "message": "Required fields are missing",
  "details": {
    "email": "provided",
    "accessToken": "required",
    "menus": "provided",
    "canteenId": "provided"
  }
}
```

**Solution:** Generate access token from Profile page

---

### 2. Invalid Access Token

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "invalid_token",
  "message": "Access token is invalid or expired",
  "suggestion": "Please reconnect your CareBite app to get a new access token"
}
```

**Solution:** Generate a new access token

---

### 3. Insufficient Wallet Balance

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "insufficient_balance",
  "message": "Your wallet does not have sufficient balance for this order",
  "details": {
    "orderAmount": 226,
    "currentBalance": "100.00",
    "shortfall": "126.00",
    "itemCount": 2
  },
  "suggestion": "Please add ₹126.00 or more to your wallet to complete this order"
}
```

**Solution:** Top up wallet with at least ₹126

---

### 4. Insufficient Stock

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "insufficient_stock",
  "message": "Some items are out of stock or have insufficient quantity",
  "details": "Stock validation error details",
  "failedItems": [
    {
      "menuItemId": "69a08fb398369948180b1f51",
      "name": "Biscoff Brownie",
      "requestedQuantity": 2
    }
  ]
}
```

**Solution:** Reduce quantity or choose different items

---

### 5. Items Not Available

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "items_unavailable",
  "message": "Some menu items are not available or do not exist",
  "details": {
    "requestedItems": 2,
    "availableItems": 1,
    "missingItems": ["69a08fb398369948180b1f51"]
  }
}
```

**Solution:** Use valid menu item IDs from the database

---

## 🔍 Available Menu Items

| Item | ID | Price | Canteen |
|------|-----|-------|---------|
| Biscoff Brownie | `69a08fb398369948180b1f51` | ₹59 | canteen-1771955358018 |
| Nuts Brownie | `69a0909b98369948180b1fc0` | ₹54 | canteen-1771955358018 |
| Milk Cake | `69a0911198369948180b1fe4` | ₹69 | canteen-1771955358018 |
| Kurkure mix | `69a096a24f2b1db6bba65e5e` | ₹500 | canteen-1771955602709 |
| Faluda | `69a097a74f2b1db6bba65eb8` | ₹500 | canteen-1771955602709 |

---

## 🧪 Alternative Test Scenarios

### Test 1: Single Item Order

```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "YOUR_TOKEN",
  "menus": [
    ["69a0909b98369948180b1fc0", 1]
  ],
  "canteenId": "canteen-1771955358018"
}
```
**Total:** ₹54

---

### Test 2: Multiple Items from Same Canteen

```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "YOUR_TOKEN",
  "menus": [
    ["69a08fb398369948180b1f51", 1],
    ["69a0909b98369948180b1fc0", 1],
    ["69a0911198369948180b1fe4", 1]
  ],
  "canteenId": "canteen-1771955358018"
}
```
**Total:** ₹182 (59 + 54 + 69)

---

### Test 3: Large Quantity Order

```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "YOUR_TOKEN",
  "menus": [
    ["69a0909b98369948180b1fc0", 5]
  ],
  "canteenId": "canteen-1771955358018"
}
```
**Total:** ₹270 (54 × 5)

---

## 🔔 What Happens After Successful Order?

1. ✅ Wallet is debited
2. ✅ Stock is reduced
3. ✅ Order is created with status "pending"
4. ✅ Canteen owner receives WebSocket notification
5. ✅ Canteen owner receives push notification
6. ✅ Order appears in canteen admin dashboard

---

## 🐛 Troubleshooting

### Issue: "User not found"
- Verify email is correct
- Check user exists in database

### Issue: "Canteen not found"
- Verify canteenId matches menu items
- Check canteen exists in database

### Issue: "Connection refused"
- Ensure server is running on port 5000
- Check MongoDB and PostgreSQL are connected

### Issue: "Wallet not found"
- Wallet is created automatically on first access
- Try accessing Profile > Wallet first

---

## 📊 Monitoring Order Status

### Check Order in Database

```javascript
// In MongoDB
db.orders.find({ customerEmail: "steepan430@gmail.com" }).sort({ createdAt: -1 }).limit(1)
```

### Check Wallet Transaction

```sql
-- In PostgreSQL
SELECT * FROM wallet_transactions 
WHERE user_id = 3 
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Stock Levels

```javascript
// In MongoDB
db.menuitems.find({ 
  _id: { $in: [
    ObjectId("69a08fb398369948180b1f51"),
    ObjectId("69a0909b98369948180b1fc0")
  ]}
}, { name: 1, stock: 1 })
```

---

## 🎉 Success Indicators

When order is successful, you should see:

1. **Postman Response:** 201 status with order details
2. **Server Logs:** 
   - ✅ User validated
   - ✅ Stock validation passed
   - ✅ Sufficient wallet balance
   - ✅ Stock reserved
   - ✅ Wallet debited
   - ✅ Order created
   - ✅ Notifications sent
3. **Database Changes:**
   - New order in `orders` collection
   - New transaction in `wallet_transactions` table
   - Reduced stock in `menuitems` collection
4. **Canteen Dashboard:** New order appears

---

## 📝 Notes

- Menu items use MongoDB `_id` field (not `id`)
- Items don't have `isAvailable` field set (treated as available)
- Access tokens are stored in PostgreSQL `api_tokens` table
- Wallet uses ledger-based system (immutable transactions)
- All operations are atomic (rollback on failure)

---

## 🔗 Related Documentation

- [CAREBITE_ORDER_API.md](./CAREBITE_ORDER_API.md) - Full API documentation
- [CAREBITE_ERROR_HANDLING.md](./CAREBITE_ERROR_HANDLING.md) - Error handling guide
- [WALLET_SYSTEM_DOCUMENTATION.md](./WALLET_SYSTEM_DOCUMENTATION.md) - Wallet system docs

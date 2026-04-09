# 🚀 Postman Quick Test - CareBite Order

## ⚡ Copy-Paste Ready

### 1️⃣ Generate Access Token First
```
1. Open: http://localhost:5000/app
2. Login: steepan430@gmail.com
3. Profile > Connection Code > Generate
4. Copy the ACCESS TOKEN (long string, not 6-digit code)
```

### 2️⃣ Top Up Wallet
```
Current: ₹100
Needed: ₹226
Add: ₹150 or more

Profile > Wallet > Add Money > Pay ₹150
```

### 3️⃣ Postman Request

**Method:** `POST`

**URL:** 
```
http://localhost:5000/api/carebite/create-order
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "PASTE_YOUR_TOKEN_HERE",
  "menus": [
    ["69a08fb398369948180b1f51", 2],
    ["69a0909b98369948180b1fc0", 2]
  ],
  "canteenId": "canteen-1771955358018"
}
```

---

## ✅ Expected Response (Success)

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

## ❌ Common Errors

### Insufficient Balance
```json
{
  "success": false,
  "reason": "insufficient_balance",
  "details": {
    "orderAmount": 226,
    "currentBalance": "100.00",
    "shortfall": "126.00"
  },
  "suggestion": "Please add ₹126.00 or more to your wallet"
}
```
**Fix:** Top up wallet

---

### Invalid Token
```json
{
  "success": false,
  "reason": "invalid_token",
  "message": "Access token is invalid or expired"
}
```
**Fix:** Generate new token from Profile page

---

## 🎯 Alternative Test Bodies

### Small Order (₹54)
```json
{
  "email": "steepan430@gmail.com",
  "accessToken": "YOUR_TOKEN",
  "menus": [["69a0909b98369948180b1fc0", 1]],
  "canteenId": "canteen-1771955358018"
}
```

### Three Items (₹182)
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

---

## 📋 Available Items

| Item | ID | Price |
|------|-----|-------|
| Biscoff Brownie | `69a08fb398369948180b1f51` | ₹59 |
| Nuts Brownie | `69a0909b98369948180b1fc0` | ₹54 |
| Milk Cake | `69a0911198369948180b1fe4` | ₹69 |

All items are in canteen: `canteen-1771955358018`

---

## 🔍 Verify Success

1. **Check Response:** Status 201, success: true
2. **Check Wallet:** Profile page should show reduced balance
3. **Check Orders:** Canteen admin should see new order
4. **Server Logs:** Should show "🎉 Order creation completed successfully"

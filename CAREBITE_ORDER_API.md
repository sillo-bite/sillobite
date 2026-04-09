# CareBite Order API Documentation

## Overview

This document provides complete API documentation for integrating with the CareBite order system. The API handles menu retrieval and order creation with wallet payment integration.

**Base URL**: `https://your-domain.com/api/carebite`

---

## 1. Get Menu

Retrieves the available menu items for a user based on their location and access permissions.

### Endpoint

```
POST /api/carebite/menu
```

### Request Body

```json
{
  "email": "user@example.com",
  "accessToken": "user_access_token_from_connection_code"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `accessToken` | string | Yes | Access token from connection code |

### Success Response (200 OK)

```json
{
  "canteens": [
    {
      "id": "canteen_123",
      "name": "Main Canteen",
      "description": "Campus main canteen",
      "location": "Building A",
      "isActive": true,
      "operatingHours": {
        "monday": { "open": "08:00", "close": "20:00" },
        "tuesday": { "open": "08:00", "close": "20:00" }
      }
    }
  ],
  "menuItems": [
    {
      "id": "item_001",
      "name": "Chicken Burger",
      "description": "Grilled chicken burger with fries",
      "price": 150,
      "category": "Main Course",
      "canteenId": "canteen_123",
      "isAvailable": true,
      "imageUrl": "https://example.com/burger.jpg",
      "preparationTime": 15,
      "isVeg": false,
      "stock": 25
    },
    {
      "id": "item_002",
      "name": "Veg Pizza",
      "description": "Fresh vegetable pizza",
      "price": 200,
      "category": "Main Course",
      "canteenId": "canteen_123",
      "isAvailable": true,
      "imageUrl": "https://example.com/pizza.jpg",
      "preparationTime": 20,
      "isVeg": true,
      "stock": 15
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "error": "Email and accessToken are required"
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "error": "Invalid or expired access token"
}
```

#### 404 Not Found - User Not Found
```json
{
  "error": "User not found"
}
```

### Example Usage

#### cURL
```bash
curl -X POST https://your-domain.com/api/carebite/menu \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "accessToken": "abc123xyz789"
  }'
```

#### JavaScript
```javascript
const response = await fetch('https://your-domain.com/api/carebite/menu', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    accessToken: 'abc123xyz789'
  })
});

const data = await response.json();
console.log('Menu:', data);
```

---

## 2. Create Order

Creates an order with wallet payment integration. This endpoint handles the complete order flow including validation, stock checking, payment processing, and notifications.

### Endpoint

```
POST /api/carebite/create-order
```

### Request Body

```json
{
  "email": "user@example.com",
  "accessToken": "user_access_token_from_connection_code",
  "menus": [
    ["item_001", 2],
    ["item_002", 1],
    ["item_003", 3]
  ],
  "canteenId": "canteen_123"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `accessToken` | string | Yes | Access token from connection code |
| `menus` | array | Yes | Array of [menuItemId, quantity] pairs |
| `canteenId` | string | Yes | ID of the canteen |

### Menu Format

The `menus` field is an array of arrays, where each inner array contains:
- **Index 0**: Menu item ID (string)
- **Index 1**: Quantity (number, must be > 0)

**Example:**
```json
[
  ["item_123", 2],  // 2x Item 123
  ["item_456", 1],  // 1x Item 456
  ["item_789", 3]   // 3x Item 789
]
```

### Success Response (201 Created)

```json
{
  "success": true,
  "order": {
    "id": "order_mongodb_id_here",
    "orderNumber": "496199896571",
    "amount": 450,
    "status": "pending",
    "items": 3,
    "walletBalance": "550.00"
  },
  "message": "Order placed successfully"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the order was created successfully |
| `order.id` | string | MongoDB ID of the created order |
| `order.orderNumber` | string | Unique order number for tracking |
| `order.amount` | number | Total order amount in rupees |
| `order.status` | string | Order status (always "pending" initially) |
| `order.items` | number | Number of items in the order |
| `order.walletBalance` | string | User's remaining wallet balance after payment |
| `message` | string | Success message |

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "missing_fields",
  "message": "Required fields are missing",
  "details": {
    "email": "required",
    "accessToken": "provided",
    "menus": "required",
    "canteenId": "provided"
  }
}
```

#### 400 Bad Request - Invalid Menu Format
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "invalid_menu_format",
  "message": "Menu items must be provided as an array of [menuId, quantity] pairs",
  "example": [["menu-item-id", 2], ["another-item-id", 1]]
}
```

#### 404 Not Found - User Not Found
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "user_not_found",
  "message": "No user account found with this email address",
  "details": {
    "email": "user@example.com"
  }
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "invalid_token",
  "message": "Access token is invalid or expired",
  "suggestion": "Please reconnect your CareBite app to get a new access token"
}
```

#### 400 Bad Request - Items Unavailable
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "items_unavailable",
  "message": "Some menu items are not available or do not exist",
  "details": {
    "requestedItems": 3,
    "availableItems": 2,
    "missingItems": ["item_003"]
  }
}
```

#### 400 Bad Request - Insufficient Stock
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "insufficient_stock",
  "message": "Some items are out of stock or have insufficient quantity",
  "details": {
    "errors": [
      "Insufficient stock for Chicken Burger. Available: 2, Requested: 5"
    ],
    "failedItems": [
      {
        "menuItemId": "item_001",
        "name": "Chicken Burger",
        "requestedQuantity": 5,
        "availableQuantity": 2
      }
    ]
  },
  "suggestion": "Please reduce the quantity or remove out-of-stock items"
}
```

#### 400 Bad Request - Insufficient Balance
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "insufficient_balance",
  "message": "Your wallet does not have sufficient balance for this order",
  "details": {
    "orderAmount": 450,
    "currentBalance": "200.00",
    "shortfall": "250.00",
    "itemCount": 3
  },
  "suggestion": "Please add ₹250.00 or more to your wallet to complete this order"
}
```

#### 500 Internal Server Error - Wallet Debit Failed
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "wallet_debit_failed",
  "message": "Failed to process payment from wallet",
  "details": "Error message details"
}
```

#### 500 Internal Server Error - Order Creation Error
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "order_creation_error",
  "message": "Failed to create order. Your payment has been refunded.",
  "details": "Error message details"
}
```

#### 500 Internal Server Error - Generic Error
```json
{
  "success": false,
  "error": "Failed to create order",
  "reason": "internal_error",
  "message": "An unexpected error occurred while creating your order",
  "details": "Error message details"
}
```

---

## Order Creation Flow

The order creation process follows these steps with automatic rollback on failures:

### 1. Request Validation ✅
- Validates required fields (email, accessToken, menus, canteenId)
- Validates menu format (array of [id, quantity] pairs)
- Returns 400 error if validation fails

### 2. User Authentication ✅
- Checks if user exists by email
- Validates access token against user ID
- Returns 404 if user not found
- Returns 401 if token is invalid or expired

### 3. Menu Item Validation ✅
- Fetches menu items from database
- Verifies all items belong to the specified canteen
- Checks if items are available
- Calculates total order amount
- Returns 400 if items are unavailable

### 4. Stock Validation ✅
- Validates real-time stock availability for all items
- Checks if requested quantities are available
- Returns 400 with detailed stock information if insufficient

### 5. Stock Reservation ✅
- **Reserves stock immediately after validation**
- Atomic stock reduction to prevent overselling
- **Rollback**: Stock is restored if any subsequent step fails

### 6. Wallet Balance Check ✅
- Checks user's wallet balance
- Verifies sufficient funds for the order
- **Rollback**: Restores reserved stock if insufficient balance
- Returns 400 with balance details if insufficient

### 7. Wallet Payment ✅
- Debits order amount from user's wallet
- Creates wallet transaction record
- Updates wallet balance
- Links transaction to order metadata
- **Rollback**: Restores stock if wallet debit fails

### 8. Order Creation ✅
- Generates unique order number
- Creates order in database with all details
- Sets payment status as 'completed'
- Sets order status as 'pending'
- Generates barcode for order tracking
- Stores metadata (source: carebite, wallet transaction ID)
- **Rollback**: Restores stock AND refunds wallet if order creation fails

### 9. Notifications ✅
- Sends WebSocket notification to canteen owner (real-time)
- Sends push notification to canteen owner
- Includes order details in notifications
- **Note**: Notification failures don't affect order success

### 10. Success Response ✅
- Returns order details
- Returns updated wallet balance
- Returns success message

---

## Automatic Rollback System

The API implements comprehensive rollback mechanisms to ensure data consistency:

### Stock Rollback
- **Trigger**: Insufficient balance, wallet debit failure, or order creation failure
- **Action**: Restores reserved stock quantities
- **Implementation**: Atomic stock restoration operation

### Wallet Rollback
- **Trigger**: Order creation failure after successful wallet debit
- **Action**: Credits the debited amount back to user's wallet
- **Implementation**: Creates refund transaction with reference to original transaction

### Rollback Scenarios

| Failure Point | Stock Rollback | Wallet Rollback |
|---------------|----------------|-----------------|
| Insufficient Balance | ✅ Yes | ❌ N/A |
| Wallet Debit Failed | ✅ Yes | ❌ N/A |
| Order Creation Failed | ✅ Yes | ✅ Yes |

---

## Example Usage

### Complete Order Flow Example

#### Step 1: Get Menu
```bash
curl -X POST https://your-domain.com/api/carebite/menu \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "accessToken": "abc123xyz789"
  }'
```

#### Step 2: Create Order
```bash
curl -X POST https://your-domain.com/api/carebite/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "accessToken": "abc123xyz789",
    "menus": [
      ["item_001", 2],
      ["item_002", 1]
    ],
    "canteenId": "canteen_123"
  }'
```

### JavaScript Implementation

```javascript
class CareBiteAPI {
  constructor(baseUrl, email, accessToken) {
    this.baseUrl = baseUrl;
    this.email = email;
    this.accessToken = accessToken;
  }

  async getMenu() {
    const response = await fetch(`${this.baseUrl}/api/carebite/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.email,
        accessToken: this.accessToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch menu');
    }

    return await response.json();
  }

  async createOrder(menuItems, canteenId) {
    // menuItems format: [{ id: 'item_001', quantity: 2 }, ...]
    const menus = menuItems.map(item => [item.id, item.quantity]);

    const response = await fetch(`${this.baseUrl}/api/carebite/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.email,
        accessToken: this.accessToken,
        menus,
        canteenId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create order');
    }

    return data;
  }
}

// Usage
const api = new CareBiteAPI(
  'https://your-domain.com',
  'user@example.com',
  'abc123xyz789'
);

try {
  // Get menu
  const menu = await api.getMenu();
  console.log('Available items:', menu.menuItems.length);

  // Create order
  const order = await api.createOrder([
    { id: 'item_001', quantity: 2 },
    { id: 'item_002', quantity: 1 }
  ], 'canteen_123');

  console.log('Order created:', order.order.orderNumber);
  console.log('Remaining balance:', order.order.walletBalance);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Python Implementation

```python
import requests

class CareBiteAPI:
    def __init__(self, base_url, email, access_token):
        self.base_url = base_url
        self.email = email
        self.access_token = access_token

    def get_menu(self):
        response = requests.post(
            f'{self.base_url}/api/carebite/menu',
            json={
                'email': self.email,
                'accessToken': self.access_token
            }
        )
        response.raise_for_status()
        return response.json()

    def create_order(self, menu_items, canteen_id):
        # menu_items format: [{'id': 'item_001', 'quantity': 2}, ...]
        menus = [[item['id'], item['quantity']] for item in menu_items]

        response = requests.post(
            f'{self.base_url}/api/carebite/create-order',
            json={
                'email': self.email,
                'accessToken': self.access_token,
                'menus': menus,
                'canteenId': canteen_id
            }
        )
        
        data = response.json()
        
        if not response.ok:
            raise Exception(data.get('message', 'Failed to create order'))
        
        return data

# Usage
api = CareBiteAPI(
    'https://your-domain.com',
    'user@example.com',
    'abc123xyz789'
)

try:
    # Get menu
    menu = api.get_menu()
    print(f"Available items: {len(menu['menuItems'])}")

    # Create order
    order = api.create_order([
        {'id': 'item_001', 'quantity': 2},
        {'id': 'item_002', 'quantity': 1}
    ], 'canteen_123')

    print(f"Order created: {order['order']['orderNumber']}")
    print(f"Remaining balance: ₹{order['order']['walletBalance']}")
except Exception as error:
    print(f"Error: {error}")
```

---

## Error Handling Best Practices

### 1. Handle All Error Reasons

```javascript
async function createOrder(api, items, canteenId) {
  try {
    const order = await api.createOrder(items, canteenId);
    return { success: true, order };
  } catch (error) {
    const errorData = JSON.parse(error.message);
    
    switch (errorData.reason) {
      case 'insufficient_balance':
        return {
          success: false,
          message: `Please add ₹${errorData.details.shortfall} to your wallet`,
          action: 'top_up_wallet'
        };
      
      case 'insufficient_stock':
        return {
          success: false,
          message: 'Some items are out of stock',
          failedItems: errorData.details.failedItems,
          action: 'update_cart'
        };
      
      case 'invalid_token':
        return {
          success: false,
          message: 'Please reconnect your account',
          action: 'reconnect'
        };
      
      default:
        return {
          success: false,
          message: errorData.message || 'Order failed',
          action: 'retry'
        };
    }
  }
}
```

### 2. Implement Retry Logic

```javascript
async function createOrderWithRetry(api, items, canteenId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await api.createOrder(items, canteenId);
    } catch (error) {
      const errorData = JSON.parse(error.message);
      
      // Don't retry for these errors
      if (['insufficient_balance', 'invalid_token', 'user_not_found'].includes(errorData.reason)) {
        throw error;
      }
      
      // Retry for transient errors
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw error;
    }
  }
}
```

### 3. Validate Before Submitting

```javascript
function validateOrder(items, menu, walletBalance) {
  const errors = [];
  
  // Check if items exist
  for (const item of items) {
    const menuItem = menu.menuItems.find(m => m.id === item.id);
    if (!menuItem) {
      errors.push(`Item ${item.id} not found in menu`);
    } else if (!menuItem.isAvailable) {
      errors.push(`${menuItem.name} is not available`);
    } else if (menuItem.stock < item.quantity) {
      errors.push(`${menuItem.name}: only ${menuItem.stock} available`);
    }
  }
  
  // Check total amount
  const total = items.reduce((sum, item) => {
    const menuItem = menu.menuItems.find(m => m.id === item.id);
    return sum + (menuItem ? menuItem.price * item.quantity : 0);
  }, 0);
  
  if (total > parseFloat(walletBalance)) {
    errors.push(`Insufficient balance. Need ₹${(total - parseFloat(walletBalance)).toFixed(2)} more`);
  }
  
  return { isValid: errors.length === 0, errors, total };
}
```

---

## Security

### Authentication
- ✅ Access token validated against user's email
- ✅ Token must be active and not expired
- ✅ Token checked in `api_tokens` table
- ✅ Token linked to specific user ID

### Authorization
- ✅ User must exist in the system
- ✅ User must have a valid wallet
- ✅ User must have sufficient balance
- ✅ Menu items must belong to specified canteen

### Data Validation
- ✅ All input fields validated
- ✅ Menu items verified to exist
- ✅ Stock levels checked in real-time
- ✅ Prices fetched from database (not trusted from client)
- ✅ Quantities must be positive integers

### Payment Security
- ✅ Wallet transactions are atomic
- ✅ Stock reservation prevents overselling
- ✅ Automatic rollback on failures
- ✅ Transaction records maintained for audit

---

## Performance

| Metric | Value |
|--------|-------|
| Average Response Time | 500-800ms |
| Database Queries | 8-10 queries |
| Stock Validation | Real-time |
| Wallet Transaction | Atomic operation |
| Notifications | Async (non-blocking) |
| Concurrent Orders | Supported (atomic operations) |

---

## Rate Limiting

**Recommended**: Implement rate limiting on your client:
- Maximum 10 requests per minute per user
- Maximum 3 order creation attempts per minute
- Exponential backoff on failures

---

## Testing

### Test Scenarios

#### 1. Successful Order
```json
{
  "email": "test@example.com",
  "accessToken": "valid_token_here",
  "menus": [["item_001", 1], ["item_002", 2]],
  "canteenId": "canteen_123"
}
```
**Expected**: 201 Created with order details

#### 2. Insufficient Balance
```json
{
  "email": "test@example.com",
  "accessToken": "valid_token_here",
  "menus": [["expensive_item", 100]],
  "canteenId": "canteen_123"
}
```
**Expected**: 400 Bad Request with balance error and shortfall amount

#### 3. Invalid Token
```json
{
  "email": "test@example.com",
  "accessToken": "invalid_or_expired_token",
  "menus": [["item_001", 1]],
  "canteenId": "canteen_123"
}
```
**Expected**: 401 Unauthorized with reconnection suggestion

#### 4. Out of Stock
```json
{
  "email": "test@example.com",
  "accessToken": "valid_token_here",
  "menus": [["item_001", 999]],
  "canteenId": "canteen_123"
}
```
**Expected**: 400 Bad Request with stock details

#### 5. Missing Items
```json
{
  "email": "test@example.com",
  "accessToken": "valid_token_here",
  "menus": [["nonexistent_item", 1]],
  "canteenId": "canteen_123"
}
```
**Expected**: 400 Bad Request with missing items list

---

## Logging

The API logs all major steps for debugging:

```
🍽️ CareBite menu request received
📧 Email: user@example.com
🔑 Token: abc123xyz7...
✅ Menu fetched successfully
📊 Canteens: 2, Items: 15

🛒 CareBite order creation request received
📧 Email: user@example.com
🔑 Token: abc123xyz7...
🏪 Canteen: canteen_123
📦 Items: 3
✅ User validated: John Doe (ID: 123)
💰 Total amount: ₹450
📊 Validating real-time stock...
✅ Stock validation passed
🔒 Reserving stock...
✅ Stock reserved successfully
💳 Checking wallet balance...
✅ Sufficient wallet balance
💸 Debiting wallet...
✅ Wallet debited. New balance: ₹550
📝 Creating order...
✅ Order created: 496199896571
📢 Sending notifications...
✅ WebSocket notification sent
✅ Push notification sent
🎉 Order creation completed successfully
```

---

## Support & Troubleshooting

### Common Issues

#### Issue: "Invalid or expired access token"
**Solution**: User needs to reconnect their CareBite app to generate a new access token

#### Issue: "Insufficient wallet balance"
**Solution**: User needs to top up their wallet before placing the order

#### Issue: "Some items are out of stock"
**Solution**: Reduce quantity or remove out-of-stock items from the order

#### Issue: "User not found"
**Solution**: Verify the email address is correct and user has an account

### Debug Checklist

1. ✅ Check server logs for detailed error messages
2. ✅ Verify user has sufficient wallet balance
3. ✅ Confirm menu items are available and in stock
4. ✅ Check stock levels in admin panel
5. ✅ Verify access token is valid and not expired
6. ✅ Ensure canteen ID is correct
7. ✅ Validate menu item IDs exist in database

---

## Changelog

### Version 2.0.0 (Current)
- ✅ Added automatic stock rollback on failures
- ✅ Added automatic wallet refund on order creation failure
- ✅ Improved error messages with detailed information
- ✅ Added stock reservation before payment
- ✅ Enhanced validation and error handling
- ✅ Added comprehensive logging

### Version 1.0.0
- Initial release with basic order creation
- Wallet payment integration
- Stock validation
- WebSocket and push notifications

---

**API Version**: 2.0.0  
**Last Updated**: 2024  
**Status**: ✅ Production Ready  
**Maintained By**: Sillobite POS Team

# CareBite Order API - Error Handling Guide

## Error Response Structure

All error responses follow a consistent structure:

```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "error_code",
  "message": "Human-readable error message",
  "details": { /* Additional context */ },
  "suggestion": "Actionable suggestion (optional)"
}
```

## Error Codes & Handling

### 1. Missing Fields (`missing_fields`)

**HTTP Status**: 400 Bad Request

**Response**:
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "missing_fields",
  "message": "Required fields are missing",
  "details": {
    "email": "required",
    "accessToken": "provided",
    "menus": "provided",
    "canteenId": "provided"
  }
}
```

**How to Handle**:
```javascript
if (error.reason === 'missing_fields') {
  const missingFields = Object.entries(error.details)
    .filter(([key, value]) => value === 'required')
    .map(([key]) => key);
  
  showError(`Please provide: ${missingFields.join(', ')}`);
}
```

**User Message**: "Please fill in all required fields"

---

### 2. Invalid Menu Format (`invalid_menu_format`)

**HTTP Status**: 400 Bad Request

**Response**:
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "invalid_menu_format",
  "message": "Menu items must be provided as an array of [menuId, quantity] pairs",
  "example": [["menu-item-id", 2], ["another-item-id", 1]]
}
```

**How to Handle**:
```javascript
if (error.reason === 'invalid_menu_format') {
  console.error('Invalid menu format. Expected:', error.example);
  showError('Invalid order format. Please try again.');
}
```

**User Message**: "There was an error with your order. Please try again."

---

### 3. User Not Found (`user_not_found`)

**HTTP Status**: 404 Not Found

**Response**:
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

**How to Handle**:
```javascript
if (error.reason === 'user_not_found') {
  showError('Account not found. Please sign up first.');
  redirectToSignup();
}
```

**User Message**: "Account not found. Please create an account first."

---

### 4. Invalid Token (`invalid_token`)

**HTTP Status**: 401 Unauthorized

**Response**:
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "invalid_token",
  "message": "Access token is invalid or expired",
  "suggestion": "Please reconnect your CareBite app to get a new access token"
}
```

**How to Handle**:
```javascript
if (error.reason === 'invalid_token') {
  showError(error.suggestion);
  // Clear stored token
  localStorage.removeItem('accessToken');
  // Prompt user to reconnect
  showReconnectDialog();
}
```

**User Message**: "Your session has expired. Please reconnect your app."

---

### 5. Items Unavailable (`items_unavailable`)

**HTTP Status**: 400 Bad Request

**Response**:
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

**How to Handle**:
```javascript
if (error.reason === 'items_unavailable') {
  const missingItems = error.details.missingItems;
  
  // Remove unavailable items from cart
  removeItemsFromCart(missingItems);
  
  showError(
    `${missingItems.length} item(s) are no longer available. ` +
    `They have been removed from your order.`
  );
  
  // Refresh menu
  refreshMenu();
}
```

**User Message**: "Some items are no longer available and have been removed from your order."

---

### 6. Insufficient Stock (`insufficient_stock`)

**HTTP Status**: 400 Bad Request

**Response**:
```json
{
  "success": false,
  "error": "Order creation failed",
  "reason": "insufficient_stock",
  "message": "Some items are out of stock or have insufficient quantity",
  "details": "Insufficient stock for item: Burger",
  "failedItems": [
    {
      "menuItemId": "item_001",
      "name": "Burger",
      "requestedQuantity": 5
    }
  ]
}
```

**How to Handle**:
```javascript
if (error.reason === 'insufficient_stock') {
  const failedItems = error.failedItems || [];
  
  if (failedItems.length > 0) {
    const itemNames = failedItems.map(item => 
      `${item.name} (requested: ${item.requestedQuantity})`
    ).join(', ');
    
    showError(
      `Out of stock: ${itemNames}. ` +
      `Please reduce the quantity or remove these items.`
    );
    
    // Highlight out-of-stock items in cart
    highlightItems(failedItems.map(i => i.menuItemId));
  } else {
    showError('Some items are out of stock. Please adjust your order.');
  }
}
```

**User Message**: "Sorry, [Item Name] is out of stock. Please reduce the quantity or remove it from your order."

---

### 7. Insufficient Balance (`insufficient_balance`)

**HTTP Status**: 400 Bad Request

**Response**:
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

**How to Handle**:
```javascript
if (error.reason === 'insufficient_balance') {
  const { orderAmount, currentBalance, shortfall } = error.details;
  
  showError(
    `Insufficient balance!\n\n` +
    `Order Total: ₹${orderAmount}\n` +
    `Current Balance: ₹${currentBalance}\n` +
    `Need: ₹${shortfall} more\n\n` +
    error.suggestion,
    {
      primaryAction: {
        label: 'Add Money',
        onClick: () => openWalletTopUp(shortfall)
      },
      secondaryAction: {
        label: 'Reduce Order',
        onClick: () => showCart()
      }
    }
  );
}
```

**User Message**: 
```
Insufficient Balance!

Order Total: ₹450
Current Balance: ₹200
You need ₹250 more

[Add Money] [Reduce Order]
```

---

## Complete Error Handling Example

```javascript
async function createOrder(orderData) {
  try {
    const response = await fetch('/api/carebite/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();

    if (!response.ok) {
      handleOrderError(data);
      return null;
    }

    return data;
  } catch (error) {
    showError('Network error. Please check your connection.');
    return null;
  }
}

function handleOrderError(error) {
  switch (error.reason) {
    case 'missing_fields':
      showError('Please fill in all required fields');
      break;

    case 'invalid_menu_format':
      showError('Invalid order format. Please try again.');
      break;

    case 'user_not_found':
      showError('Account not found. Please sign up first.');
      redirectToSignup();
      break;

    case 'invalid_token':
      showError('Session expired. Please reconnect your app.');
      localStorage.removeItem('accessToken');
      showReconnectDialog();
      break;

    case 'items_unavailable':
      const missingItems = error.details.missingItems;
      removeItemsFromCart(missingItems);
      showError(
        `${missingItems.length} item(s) are no longer available ` +
        `and have been removed from your order.`
      );
      refreshMenu();
      break;

    case 'insufficient_stock':
      const failedItems = error.failedItems || [];
      if (failedItems.length > 0) {
        const itemNames = failedItems.map(i => i.name).join(', ');
        showError(
          `Out of stock: ${itemNames}. ` +
          `Please reduce the quantity or remove these items.`
        );
        highlightItems(failedItems.map(i => i.menuItemId));
      } else {
        showError('Some items are out of stock. Please adjust your order.');
      }
      break;

    case 'insufficient_balance':
      const { orderAmount, currentBalance, shortfall } = error.details;
      showBalanceError({
        orderAmount,
        currentBalance,
        shortfall,
        suggestion: error.suggestion
      });
      break;

    default:
      showError(error.message || 'Failed to create order. Please try again.');
  }
}

function showBalanceError({ orderAmount, currentBalance, shortfall, suggestion }) {
  showDialog({
    title: 'Insufficient Balance',
    message: 
      `Order Total: ₹${orderAmount}\n` +
      `Current Balance: ₹${currentBalance}\n` +
      `You need ₹${shortfall} more\n\n` +
      suggestion,
    icon: 'wallet',
    buttons: [
      {
        label: 'Add Money',
        primary: true,
        onClick: () => openWalletTopUp(parseFloat(shortfall))
      },
      {
        label: 'Reduce Order',
        onClick: () => showCart()
      },
      {
        label: 'Cancel',
        onClick: () => closeDialog()
      }
    ]
  });
}
```

## User-Friendly Messages

### For Mobile App

```javascript
const USER_MESSAGES = {
  missing_fields: {
    title: 'Missing Information',
    message: 'Please fill in all required fields',
    icon: '⚠️'
  },
  invalid_menu_format: {
    title: 'Order Error',
    message: 'There was an error with your order. Please try again.',
    icon: '❌'
  },
  user_not_found: {
    title: 'Account Not Found',
    message: 'Please create an account first',
    icon: '👤',
    action: 'Sign Up'
  },
  invalid_token: {
    title: 'Session Expired',
    message: 'Please reconnect your app',
    icon: '🔑',
    action: 'Reconnect'
  },
  items_unavailable: {
    title: 'Items Unavailable',
    message: 'Some items are no longer available',
    icon: '🚫',
    action: 'View Cart'
  },
  insufficient_stock: {
    title: 'Out of Stock',
    message: 'Some items are out of stock',
    icon: '📦',
    action: 'Adjust Order'
  },
  insufficient_balance: {
    title: 'Insufficient Balance',
    message: 'You need more money in your wallet',
    icon: '💰',
    action: 'Add Money'
  }
};
```

## Logging & Analytics

Track errors for analytics:

```javascript
function logOrderError(error, orderData) {
  analytics.track('Order Creation Failed', {
    reason: error.reason,
    message: error.message,
    userId: orderData.userId,
    canteenId: orderData.canteenId,
    itemCount: orderData.menus.length,
    timestamp: new Date().toISOString()
  });

  // Log specific details based on error type
  if (error.reason === 'insufficient_balance') {
    analytics.track('Insufficient Balance', {
      orderAmount: error.details.orderAmount,
      currentBalance: error.details.currentBalance,
      shortfall: error.details.shortfall
    });
  } else if (error.reason === 'insufficient_stock') {
    analytics.track('Stock Unavailable', {
      failedItems: error.failedItems
    });
  }
}
```

## Testing Error Scenarios

```javascript
// Test insufficient balance
const testInsufficientBalance = {
  email: 'test@example.com',
  accessToken: 'valid_token',
  menus: [['expensive_item', 100]], // Very high quantity
  canteenId: 'canteen_1'
};

// Test insufficient stock
const testInsufficientStock = {
  email: 'test@example.com',
  accessToken: 'valid_token',
  menus: [['limited_item', 1000]], // More than available
  canteenId: 'canteen_1'
};

// Test invalid token
const testInvalidToken = {
  email: 'test@example.com',
  accessToken: 'invalid_or_expired_token',
  menus: [['item_1', 1]],
  canteenId: 'canteen_1'
};
```

---

**Version**: 1.0.0

**Last Updated**: 2024

**Status**: ✅ Production Ready

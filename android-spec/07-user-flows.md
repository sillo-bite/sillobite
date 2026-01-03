# User Flows Specification

**Version**: 1.0  
**Last Updated**: 2025-12-31

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flows](#authentication-flows)
3. [Guest/Student Flows](#gueststudent-flows)
4. [Admin Flows](#admin-flows)
5. [Canteen Owner Flows](#canteen-owner-flows)
6. [Counter Staff Flows](#counter-staff-flows)
7. [Delivery Person Flows](#delivery-person-flows)
8. [Payment Flows](#payment-flows)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)

---

## Overview

This document traces complete user flows for all roles in the system, documenting preconditions, step-by-step actions, API calls, socket interactions, state transitions, and error handling.

### Flow Notation

```
┌────────────┐
│   STATE    │  ← Current state
└─────┬──────┘
      │
      ├─ Action/Event
      │
      ▼
┌────────────┐
│ NEXT STATE │  ← Resulting state
└────────────┘

[API] POST /api/endpoint  ← API call
[WS] emit('event', data)  ← WebSocket event
[STATE] cart.addItem()    ← State mutation
```

---

## Authentication Flows

### FLOW 1: Email/Password Login

**Role**: All

**Preconditions**:
- User has registered account
- User is on login page (`/login`)
- No active session

**Flow Diagram**:

```
┌──────────────┐
│UNAUTHENTICATED│
└──────┬───────┘
       │
       ├─ User enters email + password
       │
       ▼
┌──────────────┐
│  VALIDATING  │
│  (client)    │
└──────┬───────┘
       │
       ├─ Email format valid?
       ├─ Password length >= 8?
       │
       ▼
┌──────────────┐
│ AUTHENTICATING│
└──────┬───────┘
       │
       ├─ [API] POST /api/auth/login
       │  Body: { email, password }
       │
       ▼
┌──────────────┐
│   RESPONSE   │
└──────┬───────┘
       │
       ├───────────┬──────────┬─────────────┐
       │           │          │             │
   Success   Profile     Invalid      Server
   200       Incomplete  Creds        Error
       │        422        401          500
       │           │          │             │
       ▼           ▼          ▼             ▼
┌────────┐  ┌─────────┐ ┌────────┐  ┌────────┐
│AUTHED  │  │ SETUP   │ │ ERROR  │  │ ERROR  │
│        │  │ NEEDED  │ │        │  │        │
└───┬────┘  └────┬────┘ └────────┘  └────────┘
    │            │
    │            ├─ Redirect to /profile-setup
    │
    ├─ [STATE] localStorage.setItem('user', userData)
    ├─ [EVENT] window.dispatchEvent('userAuthChange')
    ├─ Redirect based on role:
    │   • admin/super_admin → /admin
    │   • canteen_owner → /canteen-owner
    │   • delivery_person → /delivery-portal
    │   • student/staff/guest → /app
    │
    ▼
┌──────────────┐
│ AUTHENTICATED│
│ HOME PAGE    │
└──────────────┘
```

**Step-by-Step**:

1. **User Input**:
   - Enter email
   - Enter password
   - Click "Login" button

2. **Client Validation**:
   - Check email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
   - Check password length (min 8 characters)
   - If invalid, show error toast

3. **API Call**:
   ```
   POST /api/auth/login
   Headers: { Content-Type: 'application/json' }
   Body: {
     email: string,
     password: string
   }
   ```

4. **Server Processing**:
   - Query user by email (PostgreSQL)
   - Compare password hash (bcrypt)
   - If valid, return user data + role
   - If invalid, return 401

5. **Client Response Handling**:
   - **Success (200)**:
     - Parse user data
     - Store in localStorage: `user` key
     - Dispatch custom event: `userAuthChange`
     - Redirect based on role
   
   - **Profile Incomplete (422)**:
     - User exists but missing required fields
     - Redirect to `/profile-setup`
   
   - **Invalid Credentials (401)**:
     - Show error toast: "Invalid email or password"
     - Clear password field
   
   - **Server Error (500)**:
     - Show error toast: "Login failed. Please try again."
     - Log error to console

6. **State Transitions**:
   - `useAuthSync` hook detects localStorage change
   - All contexts re-initialize with user data
   - WebSocket connections established

**API Calls**:
- `POST /api/auth/login`

**Socket Interactions**:
- None during login
- After login: `joinCanteenRooms` emitted if user has canteen access

**State Transitions**:
- `UNAUTHENTICATED` → `AUTHENTICATING` → `AUTHENTICATED`
- Cart Context: Load user's cart for selected canteen
- Canteen Context: Load canteens filtered by user's college/organization
- Location Context: Load user's saved location

**Error Handling**:
- **Network Error**: Show "Network error. Check connection."
- **Timeout (15s)**: Show "Request timeout. Try again."
- **Invalid Credentials**: Show "Invalid email or password."
- **Account Locked**: Show "Account locked. Contact support."

**Edge Cases**:
- **Concurrent Login**: Last login wins (overwrites localStorage)
- **Cross-Tab Login**: `storage` event syncs all tabs
- **Expired Session**: No server-side session, so always valid
- **Case-Sensitive Email**: Email lowercased on server

---

### FLOW 2: Google OAuth Login

**Role**: All

**Preconditions**:
- User has Google account
- User is on login page (`/login`)
- No active session

**Flow Diagram**:

```
┌──────────────┐
│UNAUTHENTICATED│
└──────┬───────┘
       │
       ├─ User clicks "Sign in with Google"
       │
       ▼
┌──────────────┐
│  REDIRECTING │
└──────┬───────┘
       │
       ├─ [API] Redirect to /api/auth/google
       │
       ▼
┌──────────────┐
│ GOOGLE AUTH  │
│  (external)  │
└──────┬───────┘
       │
       ├─ User authorizes app
       │
       ▼
┌──────────────┐
│   CALLBACK   │
│/auth/callback│
└──────┬───────┘
       │
       ├─ Parse URL params (code, state)
       ├─ [API] POST /api/auth/google/callback
       │
       ▼
┌──────────────┐
│   RESPONSE   │
└──────┬───────┘
       │
       ├───────────┬──────────┐
       │           │          │
   Success   Profile     Error
   200       Incomplete   500
       │        422          │
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│AUTHED  │  │ SETUP   │ │ ERROR  │
└───┬────┘  └────┬────┘ └────────┘
    │            │
    └────────────┴─ Same as email/password
                    login from here
```

**Step-by-Step**:

1. **Initiate OAuth**:
   - User clicks "Sign in with Google" button
   - Browser redirects to `/api/auth/google`

2. **Google Authorization** (external):
   - Server redirects to Google OAuth consent screen
   - User authorizes app permissions:
     - View email address
     - View basic profile info
   - Google redirects back to `/api/auth/google/callback?code=...&state=...`

3. **Callback Processing**:
   - Client detects redirect to `/auth/callback` or `/api/auth/google/callback`
   - Extract `code` and `state` from URL params
   - Server exchanges code for access token
   - Server fetches user profile from Google API
   - Server creates/updates user in PostgreSQL

4. **API Calls**:
   ```
   GET /api/auth/google
   → Redirects to Google OAuth

   GET /api/auth/google/callback?code=...&state=...
   → Exchanges code for token
   → Returns user data
   ```

5. **Client Response Handling**:
   - **Success**: Same as email/password login
   - **Profile Incomplete**: Redirect to `/profile-setup`
   - **Error**: Redirect to `/login` with error message

6. **State Transitions**:
   - Same as email/password login

**API Calls**:
- `GET /api/auth/google` (redirect)
- `GET /api/auth/google/callback` (server-side exchange)

**Socket Interactions**:
- Same as email/password login

**State Transitions**:
- Same as email/password login

**Error Handling**:
- **User Cancels Authorization**: Redirect to `/login` with message "Login cancelled"
- **Invalid State**: Redirect to `/login` with error "Invalid authentication state"
- **Token Exchange Failed**: Redirect to `/login` with error "Authentication failed"
- **Network Error**: Show "Network error. Try again."

**Edge Cases**:
- **Multiple Google Accounts**: User must select account in Google consent screen
- **Email Already Registered**: Links to existing account (same email)
- **Organization Restriction**: Only allows specific email domains (configurable)

---

### FLOW 3: Temporary Guest Access (Table Orders)

**Role**: Guest

**Preconditions**:
- User scans QR code at restaurant table
- QR code contains valid `restaurantId`, `tableNumber`, `hash`
- No authentication required

**Flow Diagram**:

```
┌──────────────┐
│ QR CODE SCAN │
└──────┬───────┘
       │
       ├─ Navigate to /table/{restaurantId}/{tableNumber}/{hash}
       │
       ▼
┌──────────────┐
│  VALIDATING  │
│  TABLE HASH  │
└──────┬───────┘
       │
       ├─ [API] POST /api/temp-user-session
       │  Body: { restaurantId, tableNumber, hash }
       │
       ▼
┌──────────────┐
│   RESPONSE   │
└──────┬───────┘
       │
       ├───────────┬──────────┐
       │           │          │
   Valid       Invalid    Expired
   200          401        401
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│ TEMP   │  │ ERROR   │ │ ERROR  │
│ USER   │  │         │ │        │
└───┬────┘  └─────────┘ └────────┘
    │
    ├─ [STATE] localStorage.setItem('temp_user_session', sessionData)
    ├─ [EVENT] window.dispatchEvent('userAuthChange')
    ├─ Redirect to /app (browse menu for restaurant)
    │
    ▼
┌──────────────┐
│ GUEST BROWSE │
│   (temp)     │
└──────────────┘
```

**Step-by-Step**:

1. **QR Code Scan**:
   - User scans QR code with camera app
   - QR code format: `https://domain.com/table/{restaurantId}/{tableNumber}/{hash}`
   - Browser opens URL

2. **Table Validation**:
   ```
   POST /api/temp-user-session
   Body: {
     restaurantId: string,
     tableNumber: string,
     hash: string
   }
   ```

3. **Server Processing**:
   - Verify hash matches expected value for restaurant + table
   - Check if table is active
   - Generate temporary session (30-minute expiry)
   - Return session data:
     ```json
     {
       "sessionId": "temp-session-123",
       "restaurantId": "restaurant-1",
       "tableNumber": "T01",
       "restaurantName": "Pizza Palace",
       "expiresAt": "2025-12-31T18:30:00Z"
     }
     ```

4. **Client Response Handling**:
   - **Valid (200)**:
     - Store session in localStorage: `temp_user_session` key
     - Dispatch `userAuthChange` event
     - Set temporary user role: `guest`
     - Redirect to `/app`
   
   - **Invalid/Expired (401)**:
     - Show error: "Invalid or expired QR code"
     - Prompt to scan valid QR code

5. **State Transitions**:
   - `UNAUTHENTICATED` → `TEMP_USER` → `GUEST_BROWSE`
   - Cart Context: Initialize empty cart for restaurant's canteen
   - Canteen Context: Load canteens filtered by restaurantId
   - Location Context: No location selection (restaurant-specific)

**API Calls**:
- `POST /api/temp-user-session`

**Socket Interactions**:
- `joinCanteenRooms` emitted with restaurant's canteen IDs

**State Transitions**:
- Temp user treated as `guest` role
- Limited to restaurant's canteen menu only
- No order history access
- Cart persists for session duration

**Error Handling**:
- **Invalid Hash**: "Invalid QR code. Please scan again."
- **Expired Session**: "Session expired. Please scan QR code again."
- **Restaurant Inactive**: "Restaurant temporarily unavailable."
- **Network Error**: "Connection error. Please try again."

**Edge Cases**:
- **Session Expiry**: After 30 minutes, prompt to scan QR code again
- **Multiple Tables**: Each table has unique hash, separate sessions
- **Transition to Registered**: User can sign up/login to link order to account
- **Cross-Device**: QR code scanned on different device creates separate session

---

## Guest/Student Flows

### FLOW 4: Browse Menu

**Role**: Student, Staff, Guest

**Preconditions**:
- User is authenticated (or temp guest)
- User has selected location (or restaurant for temp guest)
- User is on home page (`/app`)

**Flow Diagram**:

```
┌──────────────┐
│  HOME PAGE   │
└──────┬───────┘
       │
       ├─ [API] GET /api/system-settings/canteens?institution={type}&id={id}
       │  (Auto-loads canteens based on user's college/org/restaurant)
       │
       ▼
┌──────────────┐
│ CANTEENS     │
│ LOADED       │
└──────┬───────┘
       │
       ├─ [STATE] setSelectedCanteen(highestPriority)
       ├─ [STATE] initializeCartForCanteen(canteenId)
       │
       ▼
┌──────────────┐
│ SELECTED     │
│ CANTEEN      │
└──────┬───────┘
       │
       ├─ [API] GET /api/categories?canteenId={id}
       ├─ [API] GET /api/menu?canteenId={id}&limit=1000
       │
       ▼
┌──────────────┐
│  MENU DATA   │
│  LOADED      │
└──────┬───────┘
       │
       ├─ Display categories
       ├─ Display menu items (filtered by category)
       ├─ Show Quick Picks (if any)
       │
       ▼
┌──────────────┐
│  BROWSING    │
│  MENU        │
└──────┬───────┘
       │
       ├─ User filters by:
       │  • Category
       │  • Vegetarian toggle
       │  • Search query
       │
       ▼
┌──────────────┐
│  FILTERED    │
│  MENU        │
└──────────────┘
```

**Step-by-Step**:

1. **Load Canteens**:
   - Context determines institution type/ID based on user:
     - **Student with college**: `type=college, id=collegeId`
     - **User with organization**: `type=organization, id=orgId`
     - **Temp guest with restaurant**: `type=restaurant, id=restaurantId`
   - API call:
     ```
     GET /api/system-settings/canteens/by-{type}/{id}
     ```
   - Response:
     ```json
     {
       "canteens": [
         {
           "id": "canteen-1",
           "name": "Main Cafeteria",
           "isActive": true,
           "priority": 1,
           "operatingHours": { ... }
         }
       ]
     }
     ```

2. **Auto-Select Canteen**:
   - Sort canteens by priority (lower number = higher priority)
   - Select first active canteen
   - Store in CanteenContext state
   - Initialize cart for canteen

3. **Load Menu Data**:
   ```
   GET /api/categories?canteenId={id}
   GET /api/menu?canteenId={id}&limit=1000
   ```
   - Categories response:
     ```json
     {
       "items": [
         { "id": "cat-1", "name": "Beverages", "displayOrder": 1 }
       ],
       "pagination": { ... }
     }
     ```
   - Menu response:
     ```json
     {
       "items": [
         {
           "id": "item-1",
           "name": "Coffee",
           "price": 50,
           "category": "Beverages",
           "isVegetarian": true,
           "available": true,
           "stock": 100,
           "imageUrl": "https://...",
           "storeCounterId": "counter-store-1",
           "paymentCounterId": "counter-payment-1"
         }
       ]
     }
     ```

4. **Display Menu**:
   - Group items by category
   - Show Quick Picks section (items with `isQuickPick: true`)
   - Display item cards with:
     - Image
     - Name
     - Price
     - Vegetarian indicator
     - Add to cart button
     - Quantity controls (if in cart)

5. **Filter/Search**:
   - **Category Filter**: Click category tab → filter items
   - **Vegetarian Toggle**: Show only vegetarian items
   - **Search**: Type query → filter by name/description

**API Calls**:
- `GET /api/system-settings/canteens/by-{type}/{id}` (or lazy load: `GET /api/system-settings/canteens/lazy?institutionType={type}&institutionId={id}&page=1&limit=5`)
- `GET /api/categories?canteenId={id}`
- `GET /api/menu?canteenId={id}&limit=1000`

**Socket Interactions**:
- `joinCanteenRooms` emitted after canteen selection
- Listen for `orderUpdate` events (not relevant for browsing)

**State Transitions**:
- `LOADING` → `CANTEENS_LOADED` → `SELECTED_CANTEEN` → `MENU_DATA_LOADED` → `BROWSING`

**Error Handling**:
- **No Canteens Available**: Show "No canteens available in your location"
- **Menu Load Failed**: Show "Failed to load menu. Refresh to try again."
- **Network Error**: Show cached data (if available) with "Offline mode" indicator

**Edge Cases**:
- **Canteen Closed**: Show "Canteen currently closed. Opens at {time}."
- **All Items Out of Stock**: Show "Menu temporarily unavailable"
- **User Switches Canteen**: Clear cart prompt: "Switching canteen will clear your cart. Continue?"
- **Cache Staleness**: Show stale data with refresh button

---

### FLOW 5: Add Item to Cart

**Role**: Student, Staff, Guest

**Preconditions**:
- User is browsing menu
- Item is available (`available: true`)
- Item has sufficient stock
- Counter IDs are present on item

**Flow Diagram**:

```
┌──────────────┐
│  BROWSING    │
│  MENU        │
└──────┬───────┘
       │
       ├─ User clicks "Add to Cart" or "+" button
       │
       ▼
┌──────────────┐
│  VALIDATING  │
└──────┬───────┘
       │
       ├─ Check item.available === true
       ├─ Check item.stock > 0
       ├─ Check item.storeCounterId exists
       ├─ Check item.paymentCounterId exists
       │
       ▼
┌──────────────┐
│  VALIDATION  │
│  RESULT      │
└──────┬───────┘
       │
       ├───────────┬──────────┐
       │           │          │
    Valid      Out of     Counter IDs
               Stock        Missing
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│ ADD    │  │ ERROR   │ │ ERROR  │
│ TO     │  │         │ │        │
│ CART   │  │         │ │        │
└───┬────┘  └─────────┘ └────────┘
    │
    ├─ [STATE] cart.addToCart(item, quantity)
    │
    ├─ Check if canteen switch needed
    │
    ├───────────┬──────────┐
    │           │          │
  Same       Different
  Canteen    Canteen
    │           │
    │           ├─ Show confirmation dialog
    │           ├─ "Switching canteen will clear cart"
    │           │
    │           ├─ User confirms?
    │           │
    │           ├─ Yes: Clear cart, switch canteen
    │           └─ No: Cancel operation
    │
    ▼
┌──────────────┐
│  CART        │
│  UPDATED     │
└──────┬───────┘
    │
    ├─ [STATE] localStorage.setItem('digital-canteen-cart-{canteenId}', cart)
    ├─ [EVENT] window.dispatchEvent('cartUpdated', { canteenId, cart })
    │
    ▼
┌──────────────┐
│  BROWSING    │
│  (cart badge │
│   updated)   │
└──────────────┘
```

**Step-by-Step**:

1. **User Action**:
   - Click "Add to Cart" button on item card
   - OR click "+" button if item already in cart

2. **Client Validation**:
   ```typescript
   // Check item availability
   if (!item.available) {
     toast.error('Item currently unavailable');
     return;
   }
   
   // Check stock
   if (item.stock <= 0) {
     toast.error('Item out of stock');
     return;
   }
   
   // Check counter IDs (REQUIRED)
   if (!item.storeCounterId || !item.paymentCounterId) {
     toast.error('Item configuration error. Please refresh and try again.');
     throw new Error('Counter IDs missing');
   }
   ```

3. **Canteen Validation**:
   - Get current cart's canteen ID
   - Compare with item's canteen ID
   - If different:
     ```typescript
     const currentCanteenId = cart.getCartCanteenId();
     if (currentCanteenId && currentCanteenId !== item.canteenId) {
       // Show confirmation dialog
       const confirmed = await confirmDialog({
         title: 'Switch Canteen?',
         message: 'Switching canteen will clear your current cart. Continue?',
         confirmText: 'Yes, Switch',
         cancelText: 'Cancel'
       });
       
       if (!confirmed) return;
       
       // Clear cart and switch
       cart.clearCart();
     }
     ```

4. **Add to Cart**:
   ```typescript
   cart.addToCart({
     id: item.id,
     name: item.name,
     price: item.price,
     quantity: 1,
     isVegetarian: item.isVegetarian,
     canteenId: item.canteenId,
     category: item.category,
     description: item.description,
     storeCounterId: item.storeCounterId,
     paymentCounterId: item.paymentCounterId,
     addedAt: Date.now() // For price staleness tracking
   }, 1);
   ```

5. **State Updates**:
   - Cart state updated in memory
   - `useEffect` triggers localStorage save
   - `cartUpdated` event dispatched
   - Cart badge updated with new count
   - Item button changes to quantity controls

6. **Cross-Tab Sync**:
   - Other tabs receive `storage` event
   - Same tab receives `cartUpdated` event
   - All tabs sync cart state

**API Calls**:
- None (cart is client-side only)

**Socket Interactions**:
- None

**State Transitions**:
- `BROWSING` → `VALIDATING` → `ADD_TO_CART` → `CART_UPDATED` → `BROWSING`
- If canteen switch: `CONFIRMATION_DIALOG` → `CLEAR_CART` → `ADD_TO_CART`

**Error Handling**:
- **Item Unavailable**: "Item currently unavailable"
- **Out of Stock**: "Item out of stock"
- **Counter IDs Missing**: "Item configuration error. Please refresh and try again."
- **Canteen Mismatch**: Show confirmation dialog
- **Network Error**: No API calls, so N/A

**Edge Cases**:
- **Price Change**: Item shows current price, but cart stores price at time of add (tracked via `addedAt`)
- **Quantity Exceeds Stock**: Validate on checkout, not on add
- **Rapid Clicks**: Debounced to prevent multiple adds
- **Cart Full**: No limit on cart size
- **Stale Cart**: Items in cart for > 1 hour show warning on checkout

---

### FLOW 6: Checkout & Place Order

**Role**: Student, Staff, Guest

**Preconditions**:
- User has items in cart
- User is on checkout page (`/checkout`)
- Cart items belong to single canteen
- All items have counter IDs

**Flow Diagram**:

```
┌──────────────┐
│  CART WITH   │
│  ITEMS       │
└──────┬───────┘
       │
       ├─ User clicks "Checkout" button
       │
       ▼
┌──────────────┐
│  NAVIGATE    │
│ /checkout    │
└──────┬───────┘
       │
       ├─ [API] POST /api/checkout/sessions
       │  Body: { canteenId, items: [...], amount }
       │
       ▼
┌──────────────┐
│  CHECKOUT    │
│  SESSION     │
│  CREATED     │
└──────┬───────┘
       │
       ├─ Session ID: "session-123"
       ├─ Status: "active"
       ├─ Expires in: 5 minutes
       ├─ Stock reserved: true
       │
       ▼
┌──────────────┐
│  CHECKOUT    │
│  PAGE        │
└──────┬───────┘
       │
       ├─ Display:
       │  • Order summary
       │  • Item list with quantities
       │  • Subtotal
       │  • Taxes
       │  • Canteen charges (if applicable)
       │  • Total amount
       │  • Payment method selection
       │  • Delivery instructions (optional)
       │
       ├─ [WS] Listen for 'orderUpdate' (checkout_session_status_changed)
       │  • Updates countdown timer
       │
       ▼
┌──────────────┐
│  USER SELECTS│
│  PAYMENT     │
└──────┬───────┘
       │
       ├───────────┬──────────┬──────────┐
       │           │          │          │
     Online       Cash    Counter/POS  Cancel
     Payment               Pickup
       │           │          │          │
       ▼           ▼          ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐ ┌────────┐
│PAYMENT │  │ CASH    │ │ POS    │ │ SESSION│
│GATEWAY │  │ ORDER   │ │ ORDER  │ │EXPIRED │
└───┬────┘  └────┬────┘ └───┬────┘ └────────┘
    │            │           │
    │            └───────────┴─ [API] POST /api/orders
    │                           Body: {
    │                             checkoutSessionId,
    │                             paymentMethod: 'cash'/'offline',
    │                             ...
    │                           }
    │
    ├─ [API] POST /api/payments/initiate
    │  Body: {
    │    amount,
    │    checkoutSessionId,
    │    customerName,
    │    orderData: {...},
    │    idempotencyKey
    │  }
    │
    ▼
┌──────────────┐
│  PAYMENT     │
│  INITIATED   │
└──────┬───────┘
    │
    ├─ Redirect to Razorpay checkout
    │  • razorpayOrderId
    │  • amount
    │  • customerName
    │  • customerEmail (if available)
    │
    ▼
┌──────────────┐
│  RAZORPAY    │
│  CHECKOUT    │
│  (external)  │
└──────┬───────┘
    │
    ├─ User completes payment
    │
    ▼
┌──────────────┐
│  CALLBACK    │
│ /payment-    │
│  callback    │
└──────┬───────┘
    │
    ├─ [API] POST /api/payments/verify
    │  Body: {
    │    razorpay_order_id,
    │    razorpay_payment_id,
    │    razorpay_signature,
    │    metadata: {...orderData}
    │  }
    │
    ▼
┌──────────────┐
│  PAYMENT     │
│  VERIFIED    │
└──────┬───────┘
    │
    ├─ [API] POST /api/orders
    │  Body: {
    │    checkoutSessionId,
    │    paymentMethod: 'online',
    │    paymentId: razorpay_payment_id,
    │    ...orderData
    │  }
    │
    ▼
┌──────────────┐
│  ORDER       │
│  CREATED     │
└──────┬───────┘
    │
    ├─ [WS] Server broadcasts: 'orderUpdate' { type: 'new_order', data: order }
    ├─  To rooms:
    │   • canteen_{canteenId}
    │   • counter_{storeCounterId}
    │   • counter_{paymentCounterId}
    │   • counter_{kotCounterId} (if applicable)
    │
    ├─ [STATE] cart.clearCart()
    ├─ Redirect to /order-status/{orderId}
    │
    ▼
┌──────────────┐
│  ORDER       │
│  SUCCESS     │
└──────────────┘
```

**Step-by-Step**:

1. **Navigate to Checkout**:
   - User clicks "Checkout" button on cart
   - Navigate to `/checkout`

2. **Create Checkout Session**:
   ```
   POST /api/checkout/sessions
   Body: {
     canteenId: string,
     items: Array<{
       id: string,
       quantity: number,
       price: number
     }>,
     amount: number,
     customerId?: string
   }
   Response: {
     sessionId: string,
     status: 'active',
     expiresAt: string, // 5 minutes from now
     reservedStock: boolean
   }
   ```

3. **Display Checkout Page**:
   - Show order summary
   - Calculate totals:
     ```typescript
     subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
     tax = subtotal * 0.05; // 5% GST
     
     // Canteen charges (only for online payments)
     if (paymentMethod !== 'cash' && paymentMethod !== 'offline') {
       canteenCharges = calculateCharges(subtotal, canteenChargeConfig);
     }
     
     total = subtotal + tax + canteenCharges;
     ```

4. **Session Countdown**:
   - Listen for WebSocket `orderUpdate` events with type `checkout_session_status_changed`
   - Update countdown timer
   - If session expires: Show "Session expired. Please try again."

5. **Payment Method Selection**:
   - **Online Payment** (UPI/Card/QR):
     - Click "Pay Online" button
     - Initiate payment flow (see FLOW 8)
   
   - **Cash Payment**:
     - Click "Pay with Cash" button
     - Create order with `paymentMethod: 'cash'`
     - `paymentStatus: 'pending'`
   
   - **Counter/POS Pickup**:
     - Click "Pay at Counter" button
     - Create order with `paymentMethod: 'offline'`, `isOffline: true`
     - `paymentStatus: 'pending'`, `status: 'pending_payment'`

6. **Create Order (Cash/Counter)**:
   ```
   POST /api/orders
   Body: {
     checkoutSessionId: string,
     customerName: string,
     customerId?: string,
     canteenId: string,
     items: string, // JSON stringified array
     amount: number,
     paymentMethod: 'cash' | 'offline',
     deliveryInstructions?: string,
     isOffline?: boolean
   }
   Response: {
     id: string,
     orderNumber: string, // 12-digit unique number
     barcode: string, // 12-digit barcode
     status: 'pending' | 'pending_payment',
     paymentStatus: 'pending',
     ...
   }
   ```

7. **WebSocket Broadcast**:
   - Server broadcasts order to:
     - Canteen room: `canteen_{canteenId}`
     - Counter rooms based on item routing:
       - Payment counter: Always included
       - Store counter: For non-markable items or markable without KOT
       - KOT counter + Store counter: For markable items with KOT

8. **Clear Cart & Redirect**:
   ```typescript
   cart.clearCart();
   localStorage.removeItem(`digital-canteen-cart-${canteenId}`);
   navigate(`/order-status/${order.id}`);
   ```

**API Calls**:
- `POST /api/checkout/sessions`
- `POST /api/orders` (for cash/counter orders)
- OR `POST /api/payments/initiate` → `POST /api/payments/verify` → `POST /api/orders` (for online orders)

**Socket Interactions**:
- **Listen**: `orderUpdate` (type: `checkout_session_status_changed`)
- **Broadcast** (after order creation): `orderUpdate` (type: `new_order` or `new_offline_order`)

**State Transitions**:
- `CART_WITH_ITEMS` → `NAVIGATE_CHECKOUT` → `SESSION_CREATED` → `CHECKOUT_PAGE` → `SELECT_PAYMENT` → `ORDER_CREATED` → `SUCCESS`

**Error Handling**:
- **Session Creation Failed**: "Unable to create checkout session. Try again."
- **Session Expired**: "Checkout session expired. Your cart items are still safe."
- **Stock Validation Failed**: "Some items are out of stock: {itemNames}"
- **Payment Failed**: Redirect to `/retry-payment` with order details
- **Order Creation Failed**: "Order creation failed. Payment refunded (if applicable)."
- **Network Error**: Show "Network error. Your cart is saved."

**Edge Cases**:
- **Price Changed**: Show warning "Price changed for {itemNames}. Total updated."
- **Item Unavailable**: Remove from cart, show warning
- **Stock Insufficient**: Adjust quantity to available stock, show warning
- **Duplicate Order Prevention**: `checkoutSessionId` used for idempotency
- **Session Timeout**: After 5 minutes, create new session on refresh
- **Concurrent Orders**: Each session is independent

---

### FLOW 7: Track Order Status

**Role**: Student, Staff, Guest

**Preconditions**:
- User has placed an order
- User navigates to `/order-status/{orderId}` or `/orders`

**Flow Diagram**:

```
┌──────────────┐
│  ORDER       │
│  PLACED      │
└──────┬───────┘
       │
       ├─ Redirect to /order-status/{orderId}
       │
       ▼
┌──────────────┐
│  FETCH ORDER │
└──────┬───────┘
       │
       ├─ [API] GET /api/orders/{orderId}
       │  OR GET /api/orders/number/{orderNumber}
       │  OR GET /api/orders/barcode/{barcode}
       │
       ▼
┌──────────────┐
│  ORDER DATA  │
│  LOADED      │
└──────┬───────┘
       │
       ├─ Display:
       │  • Order number
       │  • Barcode (for scanning)
       │  • Status badge
       │  • Items list
       │  • Total amount
       │  • Payment status
       │  • Estimated time
       │  • Delivery person (if assigned)
       │
       ├─ [WS] socket.emit('joinCanteenRooms', [canteenId])
       ├─ [WS] Listen for 'orderUpdate' events
       │
       ▼
┌──────────────┐
│  TRACKING    │
│  ORDER       │
└──────┬───────┘
       │
       ├─ WebSocket events received:
       │
       ├─ type: 'order_status_changed'
       │  oldStatus: 'pending'
       │  newStatus: 'preparing'
       │  → [STATE] Update order status
       │  → Show notification
       │
       ├─ type: 'order_status_changed'
       │  oldStatus: 'preparing'
       │  newStatus: 'ready'
       │  → [STATE] Update order status
       │  → Show notification: "Order ready for pickup!"
       │
       ├─ type: 'order_status_changed'
       │  oldStatus: 'ready'
       │  newStatus: 'out_for_delivery'
       │  → [STATE] Update order status
       │  → Show delivery person info
       │
       ├─ type: 'order_status_changed'
       │  oldStatus: 'out_for_delivery'
       │  newStatus: 'delivered'
       │  → [STATE] Update order status
       │  → Show "Order delivered!" message
       │  → Prompt for review
       │
       ▼
┌──────────────┐
│  ORDER       │
│  COMPLETE    │
└──────────────┘
```

**Step-by-Step**:

1. **Load Order Data**:
   ```
   GET /api/orders/{orderId}
   Response: {
     id: string,
     orderNumber: string,
     barcode: string,
     status: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled',
     paymentStatus: 'pending' | 'PAID' | 'FAILED',
     items: Array<{
       id: string,
       name: string,
       quantity: number,
       price: number,
       isMarkable: boolean,
       status?: 'pending' | 'ready' // Item-level status
     }>,
     amount: number,
     canteenId: string,
     canteenName: string,
     customerId?: string,
     deliveryPersonId?: string,
     deliveryPersonName?: string,
     deliveryPersonPhone?: string,
     estimatedTime?: string,
     createdAt: string,
     updatedAt: string
   }
   ```

2. **Join WebSocket Room**:
   ```typescript
   socket.emit('joinCanteenRooms', {
     canteenIds: [order.canteenId],
     userId: user?.id,
     userRole: user?.role
   });
   ```

3. **Listen for Updates**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'order_status_changed' && 
         message.data.id === orderId) {
       
       // Update order state
       setOrder(message.data);
       
       // Show notification
       const statusMessages = {
         'preparing': 'Your order is being prepared! 👨‍🍳',
         'ready': 'Your order is ready for pickup! 📦',
         'out_for_delivery': 'Your order is on the way! 🚚',
         'delivered': 'Order delivered! ✅'
       };
       
       toast.success(statusMessages[message.newStatus]);
       
       // Send push notification (if enabled)
       if ('Notification' in window && Notification.permission === 'granted') {
         new Notification('Order Update', {
           body: statusMessages[message.newStatus],
           icon: '/logo.png'
         });
       }
     }
   });
   ```

4. **Display Status**:
   - **Pending**: "Order received. Waiting for confirmation."
   - **Preparing**: "Your order is being prepared. Estimated time: {time}."
   - **Ready**: "Order ready! Show barcode at counter for pickup."
   - **Out for Delivery**: "On the way! Delivery by {deliveryPerson}. Track: {phone}."
   - **Delivered**: "Order delivered. Enjoy your meal! Please rate your experience."
   - **Cancelled**: "Order cancelled. {reason}. Refund processed (if applicable)."

5. **Barcode Display**:
   - Generate barcode image from order number
   - Show "Tap to enlarge" option
   - Support 4-digit OTP (first 4 digits of order number) as fallback

6. **Fallback Polling** (if WebSocket disconnected):
   ```typescript
   // Fallback to polling every 30 seconds
   useEffect(() => {
     if (!socket.connected) {
       const interval = setInterval(() => {
         refetchOrder();
       }, 30000);
       
       return () => clearInterval(interval);
     }
   }, [socket.connected]);
   ```

**API Calls**:
- `GET /api/orders/{orderId}`
- Fallback: `GET /api/orders/{orderId}` (polling every 30s if WebSocket disconnected)

**Socket Interactions**:
- **Emit**: `joinCanteenRooms`
- **Listen**: `orderUpdate` (type: `order_status_changed`, `item_status_changed`)

**State Transitions**:
- `ORDER_PLACED` → `TRACKING` → `PREPARING` → `READY` → `OUT_FOR_DELIVERY` → `DELIVERED`
- OR `ORDER_PLACED` → `TRACKING` → `CANCELLED`

**Error Handling**:
- **Order Not Found**: "Order not found. Check order number and try again."
- **WebSocket Disconnected**: Show "Connection lost. Using fallback mode." + polling
- **Load Failed**: "Failed to load order. Refresh to try again."
- **Network Error**: Show cached order data (if available)

**Edge Cases**:
- **Order Cancelled by Admin**: Show cancellation reason + refund info
- **Payment Failed**: Show "Payment failed. Retry payment or contact support."
- **Multiple Status Changes**: Show latest status only
- **Old Orders**: Show completion timestamp for delivered/cancelled orders
- **No Delivery Person**: For pickup orders, no delivery person shown

---

## Admin Flows

### FLOW 8: Manage Canteen Menu

**Role**: Admin, Super Admin

**Preconditions**:
- User has admin role
- User is on admin dashboard (`/admin`)
- User navigates to canteen management

**Flow Diagram**:

```
┌──────────────┐
│ ADMIN        │
│ DASHBOARD    │
└──────┬───────┘
       │
       ├─ Navigate to /admin/canteen/{canteenId}/menu
       │
       ▼
┌──────────────┐
│ FETCH MENU   │
│ DATA         │
└──────┬───────┘
       │
       ├─ [API] GET /api/categories?canteenId={id}
       ├─ [API] GET /api/menu?canteenId={id}
       │
       ▼
┌──────────────┐
│ MENU         │
│ DISPLAYED    │
└──────┬───────┘
       │
       ├─ Admin actions:
       │
       ├─ ADD NEW ITEM ─────────►
       │                         │
       ├─ EDIT ITEM ────────────►
       │                         │
       ├─ DELETE ITEM ──────────►
       │                         │
       ├─ UPDATE STOCK ─────────►
       │                         │
       ├─ TOGGLE AVAILABILITY ──►
       │                         │
       ▼                         ▼
┌──────────────┐      ┌──────────────┐
│ VIEW MODE    │      │ ACTION MODAL │
└──────────────┘      └──────┬───────┘
                              │
                              ├─ ADD NEW ITEM:
                              │  • Upload image (Cloudinary)
                              │  • Enter name, description
                              │  • Set price
                              │  • Select category
                              │  • Set vegetarian flag
                              │  • Set stock quantity
                              │  • Assign counters (store, payment, KOT)
                              │  • Set markable flag
                              │
                              ├─ [API] POST /api/menu
                              │  Body: {
                              │    name, description, price,
                              │    category, canteenId,
                              │    isVegetarian, stock,
                              │    imageUrl, available,
                              │    storeCounterId, paymentCounterId,
                              │    kotCounterId, isMarkable
                              │  }
                              │
                              ▼
                     ┌──────────────┐
                     │ MENU ITEM    │
                     │ CREATED      │
                     └──────┬───────┘
                            │
                            ├─ [STATE] queryClient.invalidateQueries(['/api/menu'])
                            ├─ Show success toast
                            ├─ Close modal
                            │
                            ▼
                     ┌──────────────┐
                     │ MENU         │
                     │ REFRESHED    │
                     └──────────────┘
```

**Step-by-Step (Add New Item)**:

1. **Open Add Item Modal**:
   - Click "Add New Item" button
   - Modal opens with form fields

2. **Upload Image**:
   ```typescript
   const handleImageUpload = async (file: File) => {
     const formData = new FormData();
     formData.append('image', file);
     formData.append('folder', 'menu-items');
     
     const response = await fetch('/api/media/upload', {
       method: 'POST',
       body: formData // No Content-Type header (browser sets with boundary)
     });
     
     const { secure_url } = await response.json();
     setImageUrl(secure_url);
   };
   ```

3. **Fill Form**:
   - Name (required)
   - Description (optional)
   - Price (required, number)
   - Category (dropdown, required)
   - Vegetarian toggle
   - Stock quantity (default: 100)
   - Available toggle (default: true)
   - Store Counter (dropdown, required)
   - Payment Counter (dropdown, required)
   - KOT Counter (dropdown, optional)
   - Markable toggle (default: false)

4. **Validate Form**:
   ```typescript
   const validateForm = () => {
     if (!name) return 'Name is required';
     if (!price || price <= 0) return 'Valid price required';
     if (!category) return 'Category is required';
     if (!storeCounterId) return 'Store counter is required';
     if (!paymentCounterId) return 'Payment counter is required';
     return null;
   };
   ```

5. **Create Menu Item**:
   ```
   POST /api/menu
   Headers: { Content-Type: 'application/json' }
   Body: {
     name: string,
     description?: string,
     price: number,
     category: string,
     canteenId: string,
     isVegetarian: boolean,
     stock: number,
     imageUrl?: string,
     available: boolean,
     storeCounterId: string,
     paymentCounterId: string,
     kotCounterId?: string,
     isMarkable: boolean,
     isQuickPick?: boolean
   }
   Response: {
     id: string,
     ...menuItem
   }
   ```

6. **Update Cache**:
   ```typescript
   // Invalidate menu queries
   queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
   queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
   
   // Show success notification
   toast.success('Menu item added successfully');
   
   // Close modal
   setModalOpen(false);
   ```

**Step-by-Step (Edit Item)**:

1. **Open Edit Modal**:
   - Click "Edit" button on menu item
   - Modal opens with pre-filled form

2. **Update Fields**:
   - Modify any field
   - Optionally upload new image

3. **Update Menu Item**:
   ```
   PUT /api/menu/{itemId}
   Body: { ...updates }
   ```

4. **Update Cache**: Same as add

**Step-by-Step (Delete Item)**:

1. **Confirm Deletion**:
   - Click "Delete" button
   - Show confirmation dialog: "Delete {itemName}? This cannot be undone."

2. **Delete Menu Item**:
   ```
   DELETE /api/menu/{itemId}
   ```

3. **Update Cache**: Same as add

**Step-by-Step (Update Stock)**:

1. **Quick Update**:
   - Click stock badge on menu item
   - Inline editor opens
   - Enter new stock quantity
   - Press Enter or click Save

2. **Update Stock**:
   ```
   PATCH /api/menu/{itemId}
   Body: { stock: number }
   ```

3. **Optimistic Update**:
   ```typescript
   // Update cache immediately
   queryClient.setQueryData(['/api/menu', canteenId], (oldData) => {
     return {
       ...oldData,
       items: oldData.items.map(item =>
         item.id === itemId ? { ...item, stock: newStock } : item
       )
     };
   });
   ```

**API Calls**:
- `GET /api/categories?canteenId={id}`
- `GET /api/menu?canteenId={id}`
- `POST /api/menu`
- `PUT /api/menu/{itemId}`
- `PATCH /api/menu/{itemId}`
- `DELETE /api/menu/{itemId}`
- `POST /api/media/upload` (image upload)

**Socket Interactions**:
- None (menu updates are not real-time for customers)

**State Transitions**:
- `MENU_DISPLAYED` → `ACTION_MODAL` → `API_CALL` → `CACHE_INVALIDATED` → `MENU_REFRESHED`

**Error Handling**:
- **Image Upload Failed**: "Image upload failed. Try again or skip image."
- **Validation Failed**: Show field-specific errors
- **Duplicate Item Name**: "Item with this name already exists in category"
- **API Error**: "Failed to save item. Please try again."
- **Network Error**: "Network error. Changes not saved."

**Edge Cases**:
- **Counter Not Found**: Validate counter exists before allowing selection
- **Category Deleted**: Remove items from deleted category or reassign
- **Image Too Large**: Compress image before upload (max 5MB)
- **Concurrent Edits**: Last write wins (no conflict resolution)
- **Stock Goes Negative**: Prevent on UI, validate on server

---

## Canteen Owner Flows

### FLOW 9: View Owner Dashboard & Process Orders

**Role**: Canteen Owner

**Preconditions**:
- User has `canteen_owner` role
- User is on owner dashboard (`/canteen-owner`)
- User has assigned canteens

**Flow Diagram**:

```
┌──────────────┐
│ OWNER LOGIN  │
└──────┬───────┘
       │
       ├─ Redirect to /canteen-owner
       │
       ▼
┌──────────────┐
│ FETCH        │
│ CANTEENS     │
└──────┬───────┘
       │
       ├─ [API] GET /api/canteens/by-owner?email={ownerEmail}
       │
       ▼
┌──────────────┐
│ CANTEEN LIST │
└──────┬───────┘
       │
       ├─ User selects canteen
       │
       ▼
┌──────────────┐
│ CANTEEN      │
│ DASHBOARD    │
└──────┬───────┘
       │
       ├─ [API] GET /api/orders/paginated?canteenId={id}
       ├─ [API] GET /api/orders/active/paginated?canteenId={id}
       ├─ [API] GET /api/menu?canteenId={id}
       ├─ [API] GET /api/categories?canteenId={id}
       │
       ├─ [WS] socket.emit('joinCanteenRooms', [canteenId])
       ├─ [WS] Listen for 'orderUpdate' events
       │
       ▼
┌──────────────┐
│ DASHBOARD    │
│ LOADED       │
└──────┬───────┘
       │
       ├─ Display:
       │  • Active orders count
       │  • Pending orders count
       │  • Today's revenue
       │  • Order list (real-time)
       │  • Quick actions:
       │    - View counters
       │    - Manage menu
       │    - View analytics
       │
       ├─ WebSocket event received:
       │  type: 'new_order'
       │  → [STATE] Add order to list
       │  → Show notification
       │  → Play sound alert
       │
       ▼
┌──────────────┐
│ OWNER        │
│ MONITORING   │
└──────┬───────┘
       │
       ├─ COUNTER VIEW ──────────►
       │                         │
       ├─ ORDER DETAILS ─────────►
       │                         │
       ▼                         ▼
┌──────────────┐      ┌──────────────┐
│ ACTIVE       │      │ COUNTER      │
│ MONITORING   │      │ INTERFACE    │
└──────────────┘      └──────┬───────┘
                              │
                              ├─ Navigate to:
                              │  /canteen-owner-dashboard/{canteenId}/counter/{counterId}
                              │
                              ├─ [WS] socket.emit('joinCounterRoom', {
                              │    counterId, canteenId
                              │  })
                              │
                              ▼
                     ┌──────────────┐
                     │ COUNTER      │
                     │ ORDERS       │
                     └──────┬───────┘
                            │
                            ├─ Filter orders by counter
                            ├─ Show orders assigned to this counter
                            │
                            ├─ Actions:
                            │  • Mark items ready (KOT counter)
                            │  • Confirm payment (Payment counter)
                            │  • Mark order ready (Store counter)
                            │  • Cancel order
                            │  • Assign delivery person
                            │
                            ▼
                     ┌──────────────┐
                     │ PROCESS      │
                     │ ORDER        │
                     └──────────────┘
```

**Step-by-Step (View Dashboard)**:

1. **Load Owner's Canteens**:
   ```
   GET /api/canteens/by-owner?email={ownerEmail}
   Response: {
     canteens: [
       { id, name, isActive, ... }
     ]
   }
   ```

2. **Select Canteen**:
   - Display list of canteens
   - User clicks on canteen
   - Navigate to `/canteen-owner-dashboard/{canteenId}`

3. **Load Dashboard Data**:
   ```typescript
   // Parallel API calls
   const [orders, activeOrders, menu, categories] = await Promise.all([
     fetch(`/api/orders/paginated?canteenId=${canteenId}&page=1&limit=20`),
     fetch(`/api/orders/active/paginated?canteenId=${canteenId}&page=1&limit=50`),
     fetch(`/api/menu?canteenId=${canteenId}`),
     fetch(`/api/categories?canteenId=${canteenId}`)
   ]);
   ```

4. **Join WebSocket Room**:
   ```typescript
   socket.emit('joinCanteenRooms', {
     canteenIds: [canteenId],
     userId: user.id,
     userRole: 'canteen_owner'
   });
   ```

5. **Real-Time Order Updates**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'new_order') {
       // Add to order list
       queryClient.setQueryData(['/api/orders/paginated'], (oldData) => {
         return {
           ...oldData,
           orders: [message.data, ...oldData.orders]
         };
       });
       
       // Show notification
       toast.success(`New order #${message.data.orderNumber}`);
       
       // Play sound
       new Audio('/sounds/new-order.mp3').play();
     }
     
     if (message.type === 'order_status_changed') {
       // Update order in list
       queryClient.setQueryData(['/api/orders/paginated'], (oldData) => {
         return {
           ...oldData,
           orders: oldData.orders.map(order =>
             order.id === message.data.id ? message.data : order
           )
         };
       });
     }
   });
   ```

6. **Display Dashboard**:
   - **Stats Cards**:
     - Active Orders: {count}
     - Pending Orders: {count}
     - Today's Revenue: ₹{amount}
     - Completed Today: {count}
   
   - **Order List**:
     - Real-time order cards
     - Status badges
     - Quick actions (view details, manage)
   
   - **Quick Actions**:
     - View Counters
     - Manage Menu
     - View Analytics
     - Manage Settings

**Step-by-Step (Process Order from Counter)**:

1. **Navigate to Counter**:
   - Click "View Counters" button
   - Select counter (Store/Payment/KOT)
   - Navigate to `/canteen-owner-dashboard/{canteenId}/counter/{counterId}`

2. **Join Counter Room**:
   ```typescript
   socket.emit('joinCounterRoom', {
     counterId,
     canteenId
   });
   ```

3. **View Counter Orders**:
   - Filter orders by counter assignment
   - Show orders where:
     - `allStoreCounterIds.includes(counterId)` (for store counter)
     - `allPaymentCounterIds.includes(counterId)` (for payment counter)
     - `allKotCounterIds.includes(counterId)` (for KOT counter)

4. **Process Order (KOT Counter)**:
   - View order items
   - Mark items as ready:
     ```
     PATCH /api/orders/{orderId}/items/{itemId}/status
     Body: { status: 'ready', counterId }
     ```
   - When all markable items ready, order status changes to 'ready'

5. **Process Order (Payment Counter)**:
   - View order details
   - Confirm payment (for offline orders):
     ```
     PATCH /api/orders/{orderId}
     Body: { 
       paymentStatus: 'PAID',
       confirmedByCounter: counterId
     }
     ```
   - Broadcast `payment_confirmed` event

6. **Process Order (Store Counter)**:
   - View order details
   - Mark order as ready for pickup:
     ```
     PATCH /api/orders/{orderId}
     Body: { status: 'ready' }
     ```
   - Broadcast `order_ready` event

**API Calls**:
- `GET /api/canteens/by-owner?email={ownerEmail}`
- `GET /api/orders/paginated?canteenId={id}`
- `GET /api/orders/active/paginated?canteenId={id}`
- `GET /api/menu?canteenId={id}`
- `GET /api/categories?canteenId={id}`
- `PATCH /api/orders/{orderId}`
- `PATCH /api/orders/{orderId}/items/{itemId}/status`

**Socket Interactions**:
- **Emit**: `joinCanteenRooms`, `joinCounterRoom`
- **Listen**: `orderUpdate` (types: `new_order`, `new_offline_order`, `order_status_changed`, `item_status_changed`, `payment_confirmed`)

**State Transitions**:
- `OWNER_LOGIN` → `CANTEEN_LIST` → `CANTEEN_DASHBOARD` → `MONITORING`
- `COUNTER_INTERFACE` → `PROCESS_ORDER` → `ORDER_UPDATED`

**Error Handling**:
- **No Canteens Assigned**: "No canteens assigned to your account"
- **Dashboard Load Failed**: "Failed to load dashboard. Refresh to try again."
- **WebSocket Disconnected**: Show "Connection lost" indicator
- **Order Update Failed**: "Failed to update order. Try again."

**Edge Cases**:
- **Multiple Canteens**: Owner can switch between canteens
- **Counter Not Found**: Show error "Counter not configured"
- **Concurrent Updates**: Last write wins (no conflict resolution)
- **Order Already Completed**: Prevent further status changes

---

## Counter Staff Flows

### FLOW 10: KOT Counter Operations

**Role**: Counter Staff (KOT Counter)

**Preconditions**:
- User has counter staff role
- User assigned to KOT counter
- User is on counter interface (`/counter/{counterId}`)

**Flow Diagram**:

```
┌──────────────┐
│ KOT COUNTER  │
│ LOGIN        │
└──────┬───────┘
       │
       ├─ Navigate to /counter/{kotCounterId}
       │
       ▼
┌──────────────┐
│ FETCH        │
│ ORDERS       │
└──────┬───────┘
       │
       ├─ [API] GET /api/orders/counter/{kotCounterId}
       │
       ├─ [WS] socket.emit('joinCounterRoom', { counterId })
       ├─ [WS] Listen for 'orderUpdate' events
       │
       ▼
┌──────────────┐
│ KOT ORDERS   │
│ DISPLAYED    │
└──────┬───────┘
       │
       ├─ Display orders with markable items:
       │  • Order number
       │  • Customer name
       │  • Item list (only markable items)
       │  • Status (pending/preparing/ready)
       │  • Time since order placed
       │
       ├─ WebSocket event received:
       │  type: 'new_order'
       │  → [STATE] Add order to list
       │  → Show notification
       │  → Play sound alert
       │
       ▼
┌──────────────┐
│ KOT STAFF    │
│ MONITORING   │
└──────┬───────┘
       │
       ├─ Staff actions:
       │  • Mark item as ready
       │  • Mark all items ready
       │  • Print KOT
       │
       ▼
┌──────────────┐
│ MARK ITEM    │
│ READY        │
└──────┬───────┘
       │
       ├─ Staff clicks "Mark Ready" button on item
       │
       ├─ [API] PATCH /api/orders/{orderId}/items/{itemId}/status
       │  Body: { status: 'ready', counterId }
       │
       ▼
┌──────────────┐
│ ITEM STATUS  │
│ UPDATED      │
└──────┬───────┘
       │
       ├─ [WS] Server broadcasts: 'orderUpdate'
       │  type: 'item_status_changed'
       │  data: { orderId, itemId, newStatus: 'ready' }
       │
       ├─ Check if all markable items ready
       │
       ├───────────┬──────────┐
       │           │          │
   All Ready   Some      None
   (auto)      Pending   Ready
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│ORDER   │  │ PARTIAL │ │ ORDER  │
│STATUS  │  │ READY   │ │PREPARING│
│→ READY │  │         │ │        │
└───┬────┘  └─────────┘ └────────┘
    │
    ├─ [API] PATCH /api/orders/{orderId}
    │  Body: { status: 'ready' }
    │  (Auto-triggered by server)
    │
    ├─ [WS] Broadcast to all rooms
    │
    ├─ Notify customer: "Order ready!"
    │
    ▼
┌──────────────┐
│ REMOVE FROM  │
│ KOT QUEUE    │
└──────────────┘
```

**Step-by-Step**:

1. **Load KOT Orders**:
   ```
   GET /api/orders/counter/{kotCounterId}
   Response: {
     orders: [
       {
         id: string,
         orderNumber: string,
         customerName: string,
         items: Array<{
           id: string,
           name: string,
           quantity: number,
           status: 'pending' | 'ready',
           isMarkable: true,
           kotCounterId: string
         }>,
         status: 'pending' | 'preparing',
         createdAt: string
       }
     ]
   }
   ```

2. **Join Counter Room**:
   ```typescript
   socket.emit('joinCounterRoom', {
     counterId: kotCounterId,
     canteenId: canteenId
   });
   ```

3. **Listen for New Orders**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'new_order' && 
         message.data.kotCounterIds?.includes(kotCounterId)) {
       
       // Add to queue
       queryClient.setQueryData(['/api/orders/counter', kotCounterId], (oldData) => {
         return {
           ...oldData,
           orders: [message.data, ...oldData.orders]
         };
       });
       
       // Alert staff
       toast.info(`New order #${message.data.orderNumber}`);
       new Audio('/sounds/new-order.mp3').play();
     }
   });
   ```

4. **Mark Item Ready**:
   - Staff clicks "Mark Ready" button on item card
   - API call:
     ```
     PATCH /api/orders/{orderId}/items/{itemId}/status
     Body: {
       status: 'ready',
       counterId: kotCounterId
     }
     ```

5. **Server Processing**:
   - Update item status in database (MongoDB)
   - Check if all markable items are ready
   - If all ready:
     - Auto-update order status to 'ready'
     - Broadcast `order_status_changed` event
   - Else:
     - Broadcast `item_status_changed` event

6. **Client Update**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'item_status_changed') {
       // Update item in order list
       queryClient.setQueryData(['/api/orders/counter', kotCounterId], (oldData) => {
         return {
           ...oldData,
           orders: oldData.orders.map(order => {
             if (order.id === message.data.orderId) {
               return {
                 ...order,
                 items: order.items.map(item =>
                   item.id === message.data.itemId
                     ? { ...item, status: message.newStatus }
                     : item
                 )
               };
             }
             return order;
           })
         };
       });
     }
     
     if (message.type === 'order_status_changed' && message.newStatus === 'ready') {
       // Remove from queue
       queryClient.setQueryData(['/api/orders/counter', kotCounterId], (oldData) => {
         return {
           ...oldData,
           orders: oldData.orders.filter(order => order.id !== message.data.id)
         };
       });
     }
   });
   ```

**API Calls**:
- `GET /api/orders/counter/{kotCounterId}`
- `PATCH /api/orders/{orderId}/items/{itemId}/status`

**Socket Interactions**:
- **Emit**: `joinCounterRoom`
- **Listen**: `orderUpdate` (types: `new_order`, `item_status_changed`, `order_status_changed`)

**State Transitions**:
- `KOT_COUNTER_LOGIN` → `KOT_ORDERS_DISPLAYED` → `MARK_ITEM_READY` → `ITEM_STATUS_UPDATED` → `ORDER_READY` (if all items ready)

**Error Handling**:
- **Load Failed**: "Failed to load orders. Refresh to try again."
- **Mark Failed**: "Failed to mark item ready. Try again."
- **WebSocket Disconnected**: Show "Connection lost" warning
- **Network Error**: Queue update locally, retry when online

**Edge Cases**:
- **No Markable Items**: Order skips KOT counter
- **Item Already Marked**: Show "Already marked ready"
- **Order Cancelled**: Remove from queue immediately
- **Concurrent Marks**: Last write wins
- **Rapid Clicks**: Debounce button to prevent duplicate updates

---

### FLOW 11: Payment Counter Operations

**Role**: Counter Staff (Payment Counter)

**Preconditions**:
- User has counter staff role
- User assigned to payment counter
- User is on counter interface (`/counter/{counterId}`)

**Flow Diagram**:

```
┌──────────────┐
│ PAYMENT      │
│ COUNTER      │
│ LOGIN        │
└──────┬───────┘
       │
       ├─ Navigate to /counter/{paymentCounterId}
       │
       ▼
┌──────────────┐
│ FETCH        │
│ ORDERS       │
└──────┬───────┘
       │
       ├─ [API] GET /api/orders/counter/{paymentCounterId}
       │  Filter: paymentStatus='pending' OR status='pending_payment'
       │
       ├─ [WS] socket.emit('joinCounterRoom', { counterId })
       │
       ▼
┌──────────────┐
│ PAYMENT      │
│ QUEUE        │
└──────┬───────┘
       │
       ├─ Display orders needing payment:
       │  • Order number/barcode
       │  • Customer name
       │  • Amount
       │  • Payment method
       │  • Status
       │
       ▼
┌──────────────┐
│ SCAN BARCODE │
│ OR ENTER #   │
└──────┬───────┘
       │
       ├─ Staff scans barcode or enters order number
       │
       ▼
┌──────────────┐
│ FETCH ORDER  │
│ DETAILS      │
└──────┬───────┘
       │
       ├─ [API] GET /api/orders/barcode/{barcode}
       │  OR GET /api/orders/number/{orderNumber}
       │
       ▼
┌──────────────┐
│ ORDER        │
│ DETAILS      │
└──────┬───────┘
       │
       ├─ Display:
       │  • Order summary
       │  • Items list
       │  • Total amount
       │  • Payment status
       │
       ├─ Check payment method:
       │
       ├───────────┬──────────┬──────────┐
       │           │          │          │
     Cash       Offline    Online
               (POS)      (UPI/Card)
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│COLLECT │  │ POS     │ │ALREADY │
│CASH    │  │ PAYMENT │ │ PAID   │
└───┬────┘  └────┬────┘ └───┬────┘
    │            │           │
    └────────────┴───────────┴─ Staff action:
                                • Confirm payment received
                                • Or: Reject/Cancel
       │
       ├─ Staff clicks "Confirm Payment"
       │
       ├─ [API] PATCH /api/orders/{orderId}
       │  Body: {
       │    paymentStatus: 'PAID',
       │    confirmedByCounter: paymentCounterId,
       │    paidAt: Date.now()
       │  }
       │
       ▼
┌──────────────┐
│ PAYMENT      │
│ CONFIRMED    │
└──────┬───────┘
       │
       ├─ [WS] Server broadcasts: 'orderUpdate'
       │  type: 'payment_confirmed'
       │  data: { orderId, paymentStatus: 'PAID' }
       │
       ├─ Update order status:
       │  • If no markable items: status → 'ready'
       │  • If markable items: status → 'preparing'
       │
       ├─ Remove from payment queue
       │
       ▼
┌──────────────┐
│ NEXT ORDER   │
└──────────────┘
```

**Step-by-Step**:

1. **Load Payment Queue**:
   ```
   GET /api/orders/counter/{paymentCounterId}
   Response: {
     orders: [
       {
         id: string,
         orderNumber: string,
         barcode: string,
         customerName: string,
         amount: number,
         paymentMethod: 'cash' | 'offline' | 'online',
         paymentStatus: 'pending' | 'PAID',
         status: 'pending_payment' | 'pending',
         createdAt: string
       }
     ]
   }
   ```

2. **Scan/Enter Order**:
   - Staff scans barcode with barcode scanner
   - OR manually enters order number
   - Fetch order:
     ```
     GET /api/orders/barcode/{barcode}
     OR
     GET /api/orders/number/{orderNumber}
     ```

3. **Display Order Details**:
   - Show order summary
   - Highlight payment amount
   - Show payment method

4. **Confirm Payment**:
   - For **Cash**:
     - Staff clicks "Confirm Cash Received"
     - Optional: Enter amount tendered + calculate change
   
   - For **Offline/POS**:
     - Staff processes payment on POS terminal
     - Clicks "Confirm POS Payment"
   
   - For **Online** (already paid):
     - Show "Already Paid" badge
     - No action needed

5. **Update Payment Status**:
   ```
   PATCH /api/orders/{orderId}
   Body: {
     paymentStatus: 'PAID',
     confirmedByCounter: paymentCounterId,
     paidAt: Date.now()
   }
   ```

6. **Server Processing**:
   - Update payment status
   - Determine next status:
     - If no markable items: `status: 'ready'`
     - If markable items: `status: 'preparing'`
   - Broadcast to all rooms

7. **Remove from Queue**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'payment_confirmed') {
       queryClient.setQueryData(['/api/orders/counter', paymentCounterId], (oldData) => {
         return {
           ...oldData,
           orders: oldData.orders.filter(order => order.id !== message.data.id)
         };
       });
     }
   });
   ```

**API Calls**:
- `GET /api/orders/counter/{paymentCounterId}`
- `GET /api/orders/barcode/{barcode}`
- `GET /api/orders/number/{orderNumber}`
- `PATCH /api/orders/{orderId}`

**Socket Interactions**:
- **Emit**: `joinCounterRoom`
- **Listen**: `orderUpdate` (types: `new_order`, `new_offline_order`, `payment_confirmed`)

**State Transitions**:
- `PAYMENT_COUNTER_LOGIN` → `PAYMENT_QUEUE` → `SCAN_BARCODE` → `ORDER_DETAILS` → `CONFIRM_PAYMENT` → `PAYMENT_CONFIRMED` → `NEXT_ORDER`

**Error Handling**:
- **Order Not Found**: "Order not found. Check barcode/number and try again."
- **Already Paid**: "Order already paid."
- **Update Failed**: "Failed to confirm payment. Try again."
- **Network Error**: Queue locally, sync when online

**Edge Cases**:
- **Barcode Scan Failed**: Fallback to manual entry
- **Wrong Order**: Cancel and re-scan
- **Customer Absent**: Mark as pending, move to next
- **Insufficient Cash**: Show "Insufficient payment" warning
- **Duplicate Confirmation**: Prevent with idempotency check

---

## Delivery Person Flows

### FLOW 12: Delivery Assignment & Completion

**Role**: Delivery Person

**Preconditions**:
- User has `delivery_person` role
- User is on delivery portal (`/delivery-portal`)
- User has active delivery zone assigned

**Flow Diagram**:

```
┌──────────────┐
│ DELIVERY     │
│ PORTAL       │
│ LOGIN        │
└──────┬───────┘
       │
       ├─ Navigate to /delivery-portal
       │
       ▼
┌──────────────┐
│ FETCH        │
│ ASSIGNMENTS  │
└──────┬───────┘
       │
       ├─ [API] GET /api/delivery/my-orders
       │  Filter: deliveryPersonId={userId}
       │          status IN ['ready', 'out_for_delivery']
       │
       ├─ [WS] socket.emit('joinDeliveryRoom', { userId })
       │
       ▼
┌──────────────┐
│ AVAILABLE    │
│ ORDERS       │
└──────┬───────┘
       │
       ├─ Display orders:
       │  • Order number
       │  • Customer name
       │  • Delivery address
       │  • Amount
       │  • Distance
       │  • Status
       │
       ├─ WebSocket event received:
       │  type: 'delivery_assigned'
       │  → [STATE] Add order to list
       │  → Show notification
       │
       ▼
┌──────────────┐
│ SELECT ORDER │
└──────┬───────┘
       │
       ├─ Delivery person clicks "Start Delivery"
       │
       ├─ [API] PATCH /api/orders/{orderId}
       │  Body: { status: 'out_for_delivery' }
       │
       ▼
┌──────────────┐
│ OUT FOR      │
│ DELIVERY     │
└──────┬───────┘
       │
       ├─ [WS] Broadcast: 'orderUpdate'
       │  type: 'order_status_changed'
       │  newStatus: 'out_for_delivery'
       │
       ├─ Display:
       │  • Customer details
       │  • Delivery address
       │  • Customer phone
       │  • Navigation button (Google Maps)
       │  • "Mark Delivered" button
       │
       ▼
┌──────────────┐
│ NAVIGATE &   │
│ DELIVER      │
└──────┬───────┘
       │
       ├─ Delivery person reaches customer
       │
       ├─ Clicks "Mark as Delivered"
       │
       ├─ [API] PATCH /api/orders/{orderId}
       │  Body: {
       │    status: 'delivered',
       │    deliveredAt: Date.now()
       │  }
       │
       ▼
┌──────────────┐
│ ORDER        │
│ DELIVERED    │
└──────┬───────┘
       │
       ├─ [WS] Broadcast: 'orderUpdate'
       │  type: 'order_status_changed'
       │  newStatus: 'delivered'
       │
       ├─ Update delivery stats:
       │  • totalDeliveries++
       │  • totalEarnings += deliveryFee
       │
       ├─ Remove from active list
       │
       ▼
┌──────────────┐
│ NEXT ORDER   │
└──────────────┘
```

**Step-by-Step**:

1. **Load Assigned Orders**:
   ```
   GET /api/delivery/my-orders
   Response: {
     orders: [
       {
         id: string,
         orderNumber: string,
         customerName: string,
         customerPhone: string,
         deliveryAddress: string,
         deliveryLatitude: number,
         deliveryLongitude: number,
         amount: number,
         deliveryFee: number,
         distance: number,
         status: 'ready' | 'out_for_delivery',
         estimatedTime: string
       }
     ]
   }
   ```

2. **Join Delivery Room**:
   ```typescript
   socket.emit('joinDeliveryRoom', {
     userId: user.id
   });
   ```

3. **Listen for Assignments**:
   ```typescript
   socket.on('orderUpdate', (message) => {
     if (message.type === 'delivery_assigned' && 
         message.data.deliveryPersonId === user.id) {
       
       // Add to list
       queryClient.setQueryData(['/api/delivery/my-orders'], (oldData) => {
         return {
           ...oldData,
           orders: [message.data, ...oldData.orders]
         };
       });
       
       // Notify
       toast.info(`New delivery assigned: Order #${message.data.orderNumber}`);
       new Audio('/sounds/new-delivery.mp3').play();
     }
   });
   ```

4. **Start Delivery**:
   - Click "Start Delivery" button
   - Update status:
     ```
     PATCH /api/orders/{orderId}
     Body: { status: 'out_for_delivery' }
     ```

5. **Navigate to Customer**:
   - Display customer details
   - Show delivery address
   - Click "Navigate" button → Opens Google Maps with address

6. **Mark Delivered**:
   - Click "Mark as Delivered" button
   - Update status:
     ```
     PATCH /api/orders/{orderId}
     Body: {
       status: 'delivered',
       deliveredAt: Date.now()
     }
     ```

7. **Update Stats**:
   - Server updates `DeliveryPerson` stats:
     - `totalDeliveries++`
     - `totalEarnings += deliveryFee`
   - Client refetches stats

**API Calls**:
- `GET /api/delivery/my-orders`
- `PATCH /api/orders/{orderId}`
- `GET /api/delivery/stats` (for dashboard)

**Socket Interactions**:
- **Emit**: `joinDeliveryRoom`
- **Listen**: `orderUpdate` (types: `delivery_assigned`, `order_status_changed`)

**State Transitions**:
- `DELIVERY_PORTAL_LOGIN` → `AVAILABLE_ORDERS` → `SELECT_ORDER` → `OUT_FOR_DELIVERY` → `ORDER_DELIVERED` → `NEXT_ORDER`

**Error Handling**:
- **No Orders**: "No deliveries assigned yet."
- **Update Failed**: "Failed to update status. Try again."
- **Network Error**: Queue locally, sync when online
- **GPS Unavailable**: Show "Enable location services"

**Edge Cases**:
- **Customer Unavailable**: Mark as "Attempted delivery" (not implemented)
- **Wrong Address**: Contact customer, update address (not implemented)
- **Order Cancelled**: Remove from list, notify delivery person
- **Multiple Deliveries**: Show list, allow batch processing

---

## Payment Flows

### FLOW 13: Online Payment (Razorpay)

**Role**: Student, Staff, Guest

**Preconditions**:
- User is on checkout page
- User selects "Pay Online" method
- Razorpay configured on server

**Flow Diagram**:

```
┌──────────────┐
│ CHECKOUT     │
│ PAGE         │
└──────┬───────┘
       │
       ├─ User clicks "Pay Online"
       │
       ▼
┌──────────────┐
│ INITIATE     │
│ PAYMENT      │
└──────┬───────┘
       │
       ├─ [API] POST /api/payments/initiate
       │  Body: {
       │    amount: number,
       │    checkoutSessionId: string,
       │    customerName: string,
       │    customerEmail?: string,
       │    customerPhone?: string,
       │    orderData: { ... },
       │    idempotencyKey: string
       │  }
       │
       ▼
┌──────────────┐
│ RAZORPAY     │
│ ORDER        │
│ CREATED      │
└──────┬───────┘
       │
       ├─ Response:
       │  {
       │    razorpayOrderId: string,
       │    amount: number,
       │    currency: 'INR'
       │  }
       │
       ├─ Initialize Razorpay checkout:
       │
       ▼
┌──────────────┐
│ RAZORPAY     │
│ CHECKOUT     │
│ MODAL        │
└──────┬───────┘
       │
       ├─ User selects payment method:
       │  • UPI
       │  • Card (Credit/Debit)
       │  • Net Banking
       │  • Wallet
       │
       ├─ User completes payment
       │
       ▼
┌──────────────┐
│ RAZORPAY     │
│ RESPONSE     │
└──────┬───────┘
       │
       ├───────────┬──────────┐
       │           │          │
   Success      Failed   Cancelled
       │           │          │
       ▼           ▼          ▼
┌────────┐  ┌─────────┐ ┌────────┐
│VERIFY  │  │ ERROR   │ │ CANCEL │
│PAYMENT │  │         │ │        │
└───┬────┘  └─────────┘ └────────┘
    │
    ├─ [API] POST /api/payments/verify
    │  Body: {
    │    razorpay_order_id: string,
    │    razorpay_payment_id: string,
    │    razorpay_signature: string,
    │    metadata: { orderData }
    │  }
    │
    ▼
┌──────────────┐
│ SIGNATURE    │
│ VERIFIED     │
└──────┬───────┘
    │
    ├─ Server verifies signature:
    │  • SHA256 HMAC
    │  • Key: Razorpay secret
    │  • Data: order_id|payment_id
    │
    ├───────────┬──────────┐
    │           │          │
  Valid      Invalid
    │           │
    ▼           ▼
┌────────┐  ┌─────────┐
│CREATE  │  │ ERROR   │
│ORDER   │  │ REFUND  │
└───┬────┘  └─────────┘
    │
    ├─ [API] POST /api/orders
    │  Body: {
    │    checkoutSessionId: string,
    │    paymentMethod: 'online',
    │    paymentId: string,
    │    paymentStatus: 'PAID',
    │    ...orderData
    │  }
    │
    ▼
┌──────────────┐
│ ORDER        │
│ CREATED      │
└──────┬───────┘
    │
    ├─ [WS] Broadcast: 'orderUpdate'
    │  type: 'new_order'
    │
    ├─ [STATE] cart.clearCart()
    │
    ├─ Redirect to /order-status/{orderId}
    │
    ▼
┌──────────────┐
│ ORDER        │
│ SUCCESS      │
└──────────────┘
```

**Step-by-Step**:

1. **Initiate Payment**:
   ```
   POST /api/payments/initiate
   Body: {
     amount: 250, // In rupees
     checkoutSessionId: "session-123",
     customerName: "John Doe",
     customerEmail: "john@example.com",
     customerPhone: "+919876543210",
     orderData: {
       canteenId: "canteen-1",
       items: [{id, quantity, price}],
       deliveryInstructions: "..."
     },
     idempotencyKey: "checkout-session-123" // Prevents duplicate orders
   }
   Response: {
     razorpayOrderId: "order_abc123",
     amount: 25000, // In paise
     currency: "INR"
   }
   ```

2. **Initialize Razorpay Checkout**:
   ```typescript
   const options = {
     key: 'rzp_test_...', // Razorpay key ID
     amount: 25000, // In paise
     currency: 'INR',
     name: 'Digital Canteen',
     description: 'Food Order Payment',
     order_id: 'order_abc123',
     handler: async (response) => {
       // Success callback
       await verifyPayment(response);
     },
     prefill: {
       name: 'John Doe',
       email: 'john@example.com',
       contact: '+919876543210'
     },
     theme: {
       color: '#3b82f6'
     },
     modal: {
       ondismiss: () => {
         // User cancelled
         toast.error('Payment cancelled');
       }
     }
   };
   
   const rzp = new window.Razorpay(options);
   rzp.open();
   ```

3. **User Completes Payment**:
   - User selects payment method (UPI/Card/etc.)
   - Enters payment details
   - Razorpay processes payment
   - Returns response to handler

4. **Verify Payment**:
   ```
   POST /api/payments/verify
   Body: {
     razorpay_order_id: "order_abc123",
     razorpay_payment_id: "pay_xyz789",
     razorpay_signature: "signature_hash",
     metadata: {
       checkoutSessionId: "session-123",
       orderData: { ... }
     }
   }
   ```

5. **Server Verification**:
   ```typescript
   // Verify signature
   const crypto = require('crypto');
   const expectedSignature = crypto
     .createHmac('sha256', razorpaySecret)
     .update(`${razorpayOrderId}|${razorpayPaymentId}`)
     .digest('hex');
   
   if (expectedSignature !== razorpaySignature) {
     // Invalid signature
     throw new Error('Payment verification failed');
   }
   
   // Fetch payment details from Razorpay API
   const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
   
   if (paymentDetails.status !== 'captured') {
     throw new Error('Payment not captured');
   }
   ```

6. **Create Order**:
   - If verification succeeds:
     ```
     POST /api/orders
     Body: {
       checkoutSessionId: "session-123",
       paymentMethod: 'online',
       paymentId: 'pay_xyz789',
       paymentStatus: 'PAID',
       ...orderData
     }
     ```

7. **Broadcast & Redirect**:
   - Server broadcasts `new_order` event
   - Client clears cart
   - Redirect to `/order-status/{orderId}`

**API Calls**:
- `POST /api/payments/initiate`
- `POST /api/payments/verify`
- `POST /api/orders`

**Socket Interactions**:
- After order creation: `orderUpdate` broadcast (type: `new_order`)

**State Transitions**:
- `CHECKOUT` → `INITIATE_PAYMENT` → `RAZORPAY_CHECKOUT` → `VERIFY_PAYMENT` → `CREATE_ORDER` → `ORDER_SUCCESS`

**Error Handling**:
- **Razorpay Script Load Failed**: "Payment gateway unavailable. Try again later."
- **Payment Failed**: "Payment failed. {reason}. Try again or use different method."
- **Signature Verification Failed**: "Payment verification failed. Contact support with reference: {paymentId}"
- **Order Creation Failed**: "Order creation failed. Your payment will be refunded within 5-7 days."
- **Network Error**: "Network error. Your payment status will be checked automatically."

**Edge Cases**:
- **Duplicate Initiate**: Idempotency key prevents duplicate Razorpay orders
- **User Closes Modal**: Payment cancelled, no charge
- **Payment Pending**: Show "Payment processing. Check status in Orders."
- **Webhook Before Verify**: Webhook handles order creation (not client)
- **Refund Needed**: Manual refund via Razorpay dashboard

---

### FLOW 14: Payment Webhook (Razorpay)

**Role**: System (Server-side)

**Preconditions**:
- Razorpay webhook configured
- Payment completed on Razorpay

**Flow Diagram**:

```
┌──────────────┐
│ RAZORPAY     │
│ PAYMENT      │
│ COMPLETED    │
└──────┬───────┘
       │
       ├─ Razorpay sends webhook:
       │  POST /api/payments/webhook/razorpay
       │
       ▼
┌──────────────┐
│ WEBHOOK      │
│ RECEIVED     │
└──────┬───────┘
       │
       ├─ Verify webhook signature:
       │  • X-Razorpay-Signature header
       │  • SHA256 HMAC
       │  • Key: Webhook secret
       │
       ▼
┌──────────────┐
│ SIGNATURE    │
│ VERIFIED     │
└──────┬───────┘
       │
       ├─ Parse event:
       │  • payment.captured
       │  • payment.failed
       │  • order.paid
       │
       ▼
┌──────────────┐
│ EVENT:       │
│ payment.     │
│ captured     │
└──────┬───────┘
       │
       ├─ Extract payment details:
       │  • razorpay_order_id
       │  • razorpay_payment_id
       │  • amount
       │  • status
       │
       ├─ Check if order exists:
       │  • Query by razorpay_order_id
       │
       ├───────────┬──────────┐
       │           │          │
   Not Exists   Exists
       │           │
       ▼           ▼
┌────────┐  ┌─────────┐
│CREATE  │  │ UPDATE  │
│ORDER   │  │ ORDER   │
└───┬────┘  └────┬────┘
    │            │
    └────────────┴─ Update payment status
                    to 'PAID'
       │
       ├─ [WS] Broadcast: 'orderUpdate'
       │  type: 'payment_confirmed'
       │
       ▼
┌──────────────┐
│ WEBHOOK      │
│ PROCESSED    │
└──────────────┘
```

**Step-by-Step**:

1. **Receive Webhook**:
   ```
   POST /api/payments/webhook/razorpay
   Headers: {
     X-Razorpay-Signature: "signature_hash"
   }
   Body: {
     event: 'payment.captured',
     payload: {
       payment: {
         entity: {
           id: 'pay_xyz789',
           order_id: 'order_abc123',
           amount: 25000,
           status: 'captured',
           method: 'upi'
         }
       }
     }
   }
   ```

2. **Verify Signature**:
   ```typescript
   const webhookSignature = req.headers['x-razorpay-signature'];
   const webhookBody = JSON.stringify(req.body);
   
   const expectedSignature = crypto
     .createHmac('sha256', razorpayWebhookSecret)
     .update(webhookBody)
     .digest('hex');
   
   if (webhookSignature !== expectedSignature) {
     throw new Error('Invalid webhook signature');
   }
   ```

3. **Process Event**:
   ```typescript
   const { event, payload } = req.body;
   
   if (event === 'payment.captured') {
     const payment = payload.payment.entity;
     
     // Check if order exists
     const existingOrder = await db.order.findFirst({
       where: { paymentId: payment.id }
     });
     
     if (existingOrder) {
       // Order already created by client verify
       // Just ensure payment status is PAID
       if (existingOrder.paymentStatus !== 'PAID') {
         await db.order.update({
           where: { id: existingOrder.id },
           data: { paymentStatus: 'PAID' }
         });
       }
     } else {
       // Order not created yet (webhook arrived first)
       // Fetch order metadata from Razorpay
       const razorpayOrder = await razorpay.orders.fetch(payment.order_id);
       const metadata = razorpayOrder.notes; // Order data stored in notes
       
       // Create order
       const order = await createOrderFromWebhook({
         paymentId: payment.id,
         paymentStatus: 'PAID',
         ...metadata
       });
       
       // Broadcast
       io.to(`canteen_${order.canteenId}`).emit('orderUpdate', {
         type: 'new_order',
         data: order
       });
     }
   }
   ```

4. **Respond to Webhook**:
   ```typescript
   res.status(200).json({ status: 'ok' });
   ```

**API Calls**:
- None (webhook endpoint receives POST from Razorpay)

**Socket Interactions**:
- Broadcast `orderUpdate` (type: `new_order` or `payment_confirmed`)

**State Transitions**:
- `PAYMENT_COMPLETED` (Razorpay) → `WEBHOOK_RECEIVED` → `SIGNATURE_VERIFIED` → `ORDER_CREATED/UPDATED` → `WEBHOOK_PROCESSED`

**Error Handling**:
- **Invalid Signature**: Log error, return 401
- **Order Creation Failed**: Log error, return 500 (Razorpay will retry)
- **Database Error**: Log error, return 500

**Edge Cases**:
- **Webhook Arrives Before Client Verify**: Create order from webhook
- **Duplicate Webhooks**: Idempotency check prevents duplicate orders
- **Webhook Fails**: Razorpay retries with exponential backoff
- **Order Already Exists**: Skip creation, update if needed

---

## Edge Cases & Error Handling

### Global Error Patterns

#### 1. Network Errors

**Scenario**: User loses internet connection during operation

**Handling**:
- **Client-side**:
  - Detect offline: `window.addEventListener('offline', ...)`
  - Show offline indicator banner
  - Queue mutations locally (cart, favorites)
  - Disable server-dependent actions
  - Fallback to cached data (React Query)

- **Reconnection**:
  - Detect online: `window.addEventListener('online', ...)`
  - Sync queued mutations
  - Invalidate stale queries
  - Show "Back online" notification

**Example**:
```typescript
useEffect(() => {
  const handleOffline = () => {
    setIsOffline(true);
    toast.warning('No internet connection. Working offline.');
  };
  
  const handleOnline = () => {
    setIsOffline(false);
    toast.success('Back online. Syncing data...');
    
    // Sync queued operations
    syncQueuedMutations();
    
    // Refetch critical data
    queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
  };
  
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  
  return () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
  };
}, []);
```

---

#### 2. WebSocket Disconnections

**Scenario**: WebSocket connection drops during order tracking

**Handling**:
- **Auto-reconnection**:
  - Socket.IO handles reconnection with exponential backoff
  - Max reconnection attempts: 10
  - Backoff: 1s, 2s, 4s, 8s, ..., max 30s

- **Fallback to Polling**:
  ```typescript
  useEffect(() => {
    if (!socket.connected && orderId) {
      // Fallback: Poll every 30 seconds
      const interval = setInterval(() => {
        refetchOrder();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [socket.connected, orderId]);
  ```

- **User Notification**:
  ```typescript
  socket.on('disconnect', () => {
    toast.warning('Connection lost. Reconnecting...');
  });
  
  socket.on('connect', () => {
    toast.success('Connected. Real-time updates active.');
    
    // Rejoin rooms
    if (canteenId) {
      socket.emit('joinCanteenRooms', { canteenIds: [canteenId] });
    }
  });
  ```

---

#### 3. Session Expiry

**Scenario**: Checkout session expires after 5 minutes

**Handling**:
- **Countdown Timer**:
  ```typescript
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Session expired
      toast.error('Checkout session expired. Your cart is still safe.');
      navigate('/app');
      return;
    }
    
    const timer = setTimeout(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeRemaining]);
  ```

- **WebSocket Update**:
  ```typescript
  socket.on('orderUpdate', (message) => {
    if (message.type === 'checkout_session_status_changed' && 
        message.newStatus === 'expired') {
      toast.error('Session expired');
      navigate('/app');
    }
  });
  ```

- **Recovery**:
  - Cart remains intact (client-side storage)
  - User can retry checkout (creates new session)

---

#### 4. Stock Validation Failures

**Scenario**: Item goes out of stock during checkout

**Handling**:
- **Checkout Session Creation**:
  ```typescript
  try {
    const session = await createCheckoutSession({ canteenId, items });
  } catch (error) {
    if (error.status === 409 && error.data?.outOfStockItems) {
      // Show out of stock items
      const itemNames = error.data.outOfStockItems.join(', ');
      toast.error(`Items out of stock: ${itemNames}. Removed from cart.`);
      
      // Remove out of stock items from cart
      error.data.outOfStockItems.forEach(itemId => {
        cart.removeFromCart(itemId);
      });
    }
  }
  ```

- **Server-side Validation**:
  ```typescript
  // Reserve stock atomically
  const result = await db.menuItem.updateMany({
    where: {
      id: { in: itemIds },
      stock: { gte: quantity }
    },
    data: {
      stock: { decrement: quantity }
    }
  });
  
  if (result.count !== itemIds.length) {
    // Some items failed stock validation
    throw new ConflictError('Insufficient stock', { outOfStockItems });
  }
  ```

---

#### 5. Payment Failures

**Scenario**: Razorpay payment fails or user cancels

**Handling**:
- **Razorpay Error Callback**:
  ```typescript
  const options = {
    // ...
    handler: (response) => {
      verifyPayment(response);
    },
    modal: {
      ondismiss: () => {
        toast.error('Payment cancelled. Your cart is safe.');
        // Stay on checkout page
      }
    }
  };
  
  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', (response) => {
    const reason = response.error?.description || 'Payment failed';
    toast.error(`Payment failed: ${reason}`);
    
    // Offer retry
    setShowRetryButton(true);
  });
  
  rzp.open();
  ```

- **Stock Restoration**:
  - Checkout session expires after 5 minutes
  - Stock automatically restored on expiry
  - No manual intervention needed

---

#### 6. Duplicate Order Prevention

**Scenario**: User clicks "Place Order" multiple times

**Handling**:
- **Client-side Debouncing**:
  ```typescript
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handlePlaceOrder = async () => {
    if (isSubmitting) return; // Prevent double-click
    
    setIsSubmitting(true);
    try {
      await placeOrder();
    } finally {
      setIsSubmitting(false);
    }
  };
  ```

- **Server-side Idempotency**:
  ```typescript
  // Use checkoutSessionId as idempotency key
  const existingOrder = await db.order.findFirst({
    where: { checkoutSessionId }
  });
  
  if (existingOrder) {
    // Order already created
    return existingOrder;
  }
  
  // Create new order
  const order = await db.order.create({ ... });
  ```

---

#### 7. Role Permission Violations

**Scenario**: User tries to access endpoint without permission

**Handling**:
- **Middleware Check**:
  ```typescript
  const requireRole = (allowedRoles: string[]) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }
      
      next();
    };
  };
  ```

- **Client-side**:
  ```typescript
  if (error.status === 403) {
    toast.error('You don\'t have permission to perform this action.');
    navigate('/app'); // Redirect to safe page
  }
  ```

---

#### 8. Concurrent Order Updates

**Scenario**: Multiple staff members update same order simultaneously

**Handling**:
- **Last Write Wins**: No optimistic locking implemented
- **WebSocket Sync**: All clients receive updates immediately
- **Conflict Detection**: None (future enhancement)

**Example**:
```typescript
// Order updated by Staff A
PATCH /api/orders/{orderId} { status: 'preparing' }
// → Broadcasts to all

// Order updated by Staff B (1 second later)
PATCH /api/orders/{orderId} { status: 'ready' }
// → Overwrites previous, broadcasts to all

// Result: Final status is 'ready' (last write wins)
```

---

#### 9. Barcode Scan Failures

**Scenario**: Barcode scanner fails or barcode unreadable

**Handling**:
- **Fallback to Manual Entry**:
  ```typescript
  const handleScan = async (barcode: string) => {
    try {
      const order = await fetchOrderByBarcode(barcode);
      setSelectedOrder(order);
    } catch (error) {
      toast.error('Barcode not found. Enter order number manually.');
      setShowManualEntry(true);
    }
  };
  ```

- **4-Digit OTP Fallback**:
  ```typescript
  // First 4 digits of order number
  const otp = orderNumber.substring(0, 4);
  
  // Staff can ask customer for OTP instead of scanning
  const orderByOtp = await fetchOrderByOtp(otp);
  ```

---

#### 10. Cross-Tab Cart Conflicts

**Scenario**: User has multiple tabs open, modifies cart in both

**Handling**:
- **Storage Event Sync**:
  ```typescript
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `digital-canteen-cart-${canteenId}`) {
        // Another tab updated cart
        const newCart = e.newValue ? JSON.parse(e.newValue) : [];
        setCart(newCart);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [canteenId]);
  ```

- **Same-Tab Custom Event**:
  ```typescript
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { canteenId, cart }
    }));
  }, [cart]);
  
  useEffect(() => {
    const handleCartUpdated = (e: CustomEvent) => {
      if (e.detail.canteenId === canteenId) {
        setCart(e.detail.cart);
      }
    };
    
    window.addEventListener('cartUpdated', handleCartUpdated);
    return () => window.removeEventListener('cartUpdated', handleCartUpdated);
  }, [canteenId]);
  ```

---

## Appendix: Flow State Summary

### Authentication States

| State | Description | Next States |
|-------|-------------|-------------|
| `UNAUTHENTICATED` | No user session | `AUTHENTICATING` |
| `AUTHENTICATING` | Login in progress | `AUTHENTICATED`, `SETUP_NEEDED`, `ERROR` |
| `AUTHENTICATED` | Valid session | N/A (terminal) |
| `SETUP_NEEDED` | Profile incomplete | `AUTHENTICATED` (after setup) |
| `TEMP_USER` | Guest session | `GUEST_BROWSE`, `AUTHENTICATED` |

### Order States

| State | Description | Next States |
|-------|-------------|-------------|
| `pending` | Order received, payment pending (cash/offline) | `pending_payment`, `preparing`, `cancelled` |
| `pending_payment` | Offline order, awaiting counter payment | `preparing`, `cancelled` |
| `preparing` | Payment confirmed, being prepared | `ready`, `cancelled` |
| `ready` | Order ready for pickup | `out_for_delivery`, `delivered`, `cancelled` |
| `out_for_delivery` | Assigned to delivery person | `delivered`, `cancelled` |
| `delivered` | Order completed | N/A (terminal) |
| `cancelled` | Order cancelled | N/A (terminal) |

### Payment States

| State | Description | Next States |
|-------|-------------|-------------|
| `pending` | Awaiting payment | `PAID`, `FAILED` |
| `PAID` | Payment successful | N/A (terminal) |
| `FAILED` | Payment failed | `pending` (retry) |

### Checkout Session States

| State | Description | Expires In |
|-------|-------------|------------|
| `active` | Session valid, stock reserved | 5 minutes |
| `expired` | Session expired, stock restored | N/A |
| `completed` | Order created from session | N/A |

---

**End of User Flows Specification**
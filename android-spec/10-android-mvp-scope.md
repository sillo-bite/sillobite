# 10 - ANDROID MVP SCOPE

## DOCUMENT METADATA
- **Extraction Date**: 2026-01-02
- **Source**: android-spec/02-capability-map.md (96 capabilities), android-spec/01-roles-and-permissions.md, android-spec/07-user-flows.md
- **Protocol**: Conservative MVP classification based on implemented features
- **Classification Criteria**: Business value, technical complexity, user impact, Android-specific requirements

---

## CLASSIFICATION METHODOLOGY

### MUST HAVE (MVP)
- **Criteria**:
  - Essential for core business flow (browse → order → pay → receive)
  - Required for ANY user role to function
  - Blocking for basic Android app launch
  - High user impact if missing

### SHOULD HAVE (Post-MVP)
- **Criteria**:
  - Enhances UX but not blocking
  - Role-specific features (not all users need)
  - Advanced features with workarounds
  - Can be added incrementally

### WEB-ONLY
- **Criteria**:
  - Admin/management features (better suited for desktop)
  - Enterprise/B2B features (vendor bidding, payouts)
  - SEO/marketing features (sitemap, robots.txt)
  - Development/diagnostic tools

---

## MVP CLASSIFICATION: CUSTOMER APP (Primary Target)

### MUST HAVE - Authentication & User Management

#### 1.1 Google OAuth Authentication ✅
**Classification**: MUST HAVE  
**Reason**: Primary authentication method, zero-friction signup  
**Dependencies**:
- API: `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google/verify`
- Socket: NONE
- Data: PostgreSQL User table
**Android Requirements**:
- ✅ Google Sign-In SDK (REQUIRED)
- ✅ SHA-1 certificate fingerprint registration
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED (session managed server-side)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Use `com.google.android.gms:play-services-auth` (20.7.0+)
- Configure OAuth client ID in Firebase console
- Handle token exchange server-side

---

#### 1.2 Email/Password Authentication ✅
**Classification**: MUST HAVE  
**Reason**: Fallback for users without Google account, enterprise users  
**Dependencies**:
- API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- Socket: NONE
- Data: PostgreSQL User (email, passwordHash)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: OPTIONAL (remember email)
- ❌ Native permission: NOT NEEDED

---

#### 1.3 User Session Validation ✅
**Classification**: MUST HAVE  
**Reason**: Detect deleted users, refresh user data, prevent unauthorized access  
**Dependencies**:
- API: `GET /api/users/:id/validate`, `GET /api/users/:id`
- Socket: NONE
- Data: PostgreSQL User
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (cache user session in SharedPreferences)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Validate session on app launch
- Handle 401/403 responses with graceful logout
- Cache last valid user data for offline display

---

#### 1.4 Profile Setup & Location Selection ✅
**Classification**: MUST HAVE  
**Reason**: Role-specific onboarding, canteen selection  
**Dependencies**:
- API: `PUT /api/users/:id`, `PUT /api/users/:id/location`, `GET /api/locations/:type`
- Socket: NONE
- Data: PostgreSQL User, MongoDB SystemSettings (locations)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (cache selected location)
- ❌ Native permission: NOT NEEDED

---

### MUST HAVE - Menu Browsing

#### 2.1 Menu Item Browsing ✅
**Classification**: MUST HAVE  
**Reason**: Core customer flow, must see available food  
**Dependencies**:
- API: `GET /api/menu` (with filters: canteenId, search, category, vegOnly, availableOnly, page, limit)
- API: `GET /api/menu/:id` (item details)
- Socket: Receive `orderUpdate` with type `menu_updated`
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (cache menu for offline browsing)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Use RecyclerView with pagination (limit=20)
- Cache menu items in Room Database with timestamp
- Invalidate cache on `menu_updated` WebSocket event
- Support vegOnly filter toggle in UI

---

#### 2.2 Category Browsing ✅
**Classification**: MUST HAVE  
**Reason**: Essential for menu navigation (Beverages, Snacks, Meals, etc.)  
**Dependencies**:
- API: `GET /api/categories` (with filters: canteenId, page, limit, search)
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (cache categories)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Display categories as horizontal chips or grid
- Cache category images (10KB each, small size)

---

#### 2.3 Menu Search ✅
**Classification**: MUST HAVE  
**Reason**: Essential for large menus (50+ items), improves UX  
**Dependencies**:
- API: `GET /api/menu` with `search` query param
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED (search is live)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Debounce search input (300ms)
- Show "No results" state clearly

---

#### 2.4 Stock Display & Filtering ✅
**Classification**: MUST HAVE  
**Reason**: Prevent ordering out-of-stock items  
**Dependencies**:
- API: `GET /api/menu` with `stockFilter`, `availableOnly` params
- Socket: Receive `orderUpdate` with type `menu_updated` (stock changes)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (update cached stock in real-time)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Show stock badges: "Out of Stock", "Only 3 left"
- Disable "Add to Cart" for unavailable items

---

### MUST HAVE - Order Placement

#### 3.1 Shopping Cart ✅
**Classification**: MUST HAVE  
**Reason**: Core ordering flow  
**Dependencies**:
- API: NONE (client-side cart)
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (persist cart in Room Database)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Store cart items locally: `CartItem(menuItemId, quantity, price, canteenId)`
- Validate cart against current menu on checkout (stock, price changes)
- Clear cart after successful order placement

---

#### 3.2 Order Creation ✅
**Classification**: MUST HAVE  
**Reason**: Core business transaction  
**Dependencies**:
- API: `POST /api/orders` (creates order, deducts stock, generates barcode, initiates payment)
- Socket: Emit `orderUpdate` with type `new_order` to canteen room
- Data: MongoDB Order, MenuItem (stock deduction), Payment
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ✅ Background sync: REQUIRED (queue order if offline)
- ✅ Local persistence: REQUIRED (store pending order until confirmed)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Use WorkManager for offline order queue
- Implement idempotency: check `duplicateCheck` API response (429 error)
- Handle race conditions: stock validation failures (400 error)

---

#### 3.3 Order Tracking (Active Orders) ✅
**Classification**: MUST HAVE  
**Reason**: Users must know order status  
**Dependencies**:
- API: `GET /api/orders/user/:userId/active`
- Socket: Receive `orderUpdate` with types: `order_status_changed`, `order_updated`, `payment_success`
**Android Requirements**:
- ✅ Foreground service: OPTIONAL (maintain WebSocket when app backgrounded)
- ❌ Background sync: NOT NEEDED (polling fallback)
- ✅ Local persistence: REQUIRED (cache active orders)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Display order status: `pending`, `preparing`, `ready`, `delivered`
- Show real-time updates via WebSocket (if connected)
- Fallback to polling every 30s if WebSocket disconnected

---

#### 3.4 Order History ✅
**Classification**: MUST HAVE  
**Reason**: Essential for repeat orders, complaints, receipts  
**Dependencies**:
- API: `GET /api/orders/user/:userId/history` (with pagination)
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: OPTIONAL (cache recent history)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Paginate with RecyclerView (20 orders per page)
- Show order date, items, total, status

---

### MUST HAVE - Payment Processing

#### 4.1 Razorpay Online Payment ✅
**Classification**: MUST HAVE  
**Reason**: Primary revenue collection method  
**Dependencies**:
- API: `POST /api/payments/initiate`, `POST /api/payments/verify`, `GET /api/payments/status/:merchantTransactionId`
- Socket: Emit `orderUpdate` with type `payment_success`
- Data: MongoDB Payment, CheckoutSession
**Android Requirements**:
- ✅ Razorpay Android SDK: REQUIRED (com.razorpay:checkout:1.6.33+)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (store payment status)
- ✅ Native permission: NOT NEEDED (but READ_PHONE_STATE optional for prefill)

**Implementation Notes**:
- Integrate Razorpay Standard Checkout (native modal)
- Handle payment callbacks: success, failure, cancel
- Verify payment on server before confirming order
- Support UPI, Cards, Wallets, NetBanking

---

#### 4.2 Checkout Session Management ✅
**Classification**: MUST HAVE  
**Reason**: Prevent duplicate payments (critical for financial integrity)  
**Dependencies**:
- API: `POST /api/checkout-sessions`, `GET /api/checkout-sessions/:id`, `PUT /api/checkout-sessions/:id`
- Socket: Emit `orderUpdate` with type `checkout_session_status_changed`
- Data: MongoDB CheckoutSession (expires after 5 minutes)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (store active checkout session ID)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Create checkout session BEFORE payment initiation
- Lock session during payment flow
- Handle session expiration (5 min timeout)
- Clear session on payment success/failure

---

### MUST HAVE - Real-Time Communication

#### 5.1 WebSocket Connection Management ✅
**Classification**: MUST HAVE  
**Reason**: Real-time order updates essential for UX  
**Dependencies**:
- API: `GET /api/websocket/status` (diagnostics only)
- Socket: Emit `joinCanteenRooms`, `leaveCanteenRooms`, `ping`
- Socket: Receive `roomJoined`, `pong`, `error`
**Android Requirements**:
- ✅ Socket.IO Android Client: REQUIRED (io.socket:socket.io-client:2.1.0+)
- ✅ Foreground service: OPTIONAL (for delivery persons, SHOULD HAVE for customers)
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (store connection state)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Connect on app launch
- Join canteen room: `socket.emit('joinCanteenRooms', { canteenIds: [canteenId] })`
- Implement exponential backoff reconnection (1s → 8s)
- Handle Android background restrictions (connection severed when app backgrounded)

---

#### 5.2 Order Real-Time Updates ✅
**Classification**: MUST HAVE  
**Reason**: Users expect instant order status updates  
**Dependencies**:
- Socket: Receive `orderUpdate` with types:
  - `new_order` (order placed)
  - `order_status_changed` (preparing → ready → delivered)
  - `order_updated` (order modified)
  - `payment_success` (payment confirmed)
**Android Requirements**:
- ✅ Socket.IO: REQUIRED (from 5.1)
- ✅ Foreground service: OPTIONAL (prevent connection drop)
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (update cached order on event)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Listen to `orderUpdate` event
- Update UI immediately on status change
- Show snackbar: "Your order is ready for pickup!"
- Fallback to polling if WebSocket disconnected

---

#### 5.3 Menu Real-Time Updates ✅
**Classification**: MUST HAVE  
**Reason**: Prevent ordering unavailable items  
**Dependencies**:
- Socket: Receive `orderUpdate` with types:
  - `menu_updated` (item stock/availability changed)
  - `banner_updated` (home screen content changed)
**Android Requirements**:
- ✅ Socket.IO: REQUIRED (from 5.1)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (invalidate cached menu)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Invalidate Room Database cache on `menu_updated`
- Refresh menu list if user currently viewing
- Update cart items if stock changed

---

### MUST HAVE - Push Notifications

#### 8.1 FCM Push Subscription ✅
**Classification**: MUST HAVE  
**Reason**: Critical for order status notifications (especially when app backgrounded)  
**Dependencies**:
- API: `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/push/vapid-public-key`
- Data: MongoDB PushSubscription (userId, fcmToken)
**Android Requirements**:
- ✅ Firebase Cloud Messaging: REQUIRED (com.google.firebase:firebase-messaging:23.4.0+)
- ❌ Foreground service: NOT NEEDED (FCM wakes app)
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (store FCM token)
- ✅ POST_NOTIFICATIONS permission: REQUIRED (Android 13+)

**Implementation Notes**:
- Replace Web Push API with FCM
- Send FCM token to server on registration
- Handle token refresh (FCM tokens can expire)
- Request POST_NOTIFICATIONS permission on Android 13+

---

#### 8.2 Order Status Notifications ✅
**Classification**: MUST HAVE  
**Reason**: Users need alerts when order ready (may be doing other tasks)  
**Dependencies**:
- Triggered by: `PUT /api/orders/:id`, `PATCH /api/orders/:id/status`, `POST /api/delivery/scan`
- Data: MongoDB Order, PushSubscription
**Android Requirements**:
- ✅ FCM: REQUIRED (from 8.1)
- ✅ Notification Channels: REQUIRED (Android 8.0+)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ✅ POST_NOTIFICATIONS permission: REQUIRED (Android 13+)

**Implementation Notes**:
- Create notification channels: "Order Updates", "Delivery Alerts"
- Show notification with order details, status
- Deep link to order detail screen on tap
- Handle notification while app in foreground (show in-app alert)

---

### MUST HAVE - Offline Support

#### 24.1 Offline Menu Caching ✅
**Classification**: MUST HAVE  
**Reason**: Users must browse menu without network (college WiFi unreliable)  
**Dependencies**:
- API: `GET /api/menu`, `GET /api/categories` (data source)
- Socket: Receive `menu_updated` (cache invalidation)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Room Database: REQUIRED (local SQLite cache)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Cache menu items in Room Database:
  ```kotlin
  @Entity(tableName = "menu_items")
  data class CachedMenuItem(
    @PrimaryKey val id: String,
    val canteenId: String,
    val name: String,
    val price: Double,
    val stock: Int?,
    val available: Boolean,
    val imageUrl: String?,
    val cachedAt: Long
  )
  ```
- Cache TTL: 5 minutes (refresh on app launch if stale)
- Show "Offline Mode" indicator in UI

---

#### 24.2 Offline Order Queue ✅
**Classification**: MUST HAVE  
**Reason**: College networks unstable, order must not be lost  
**Dependencies**:
- API: `POST /api/orders` (syncs when online)
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ✅ WorkManager: REQUIRED (one-time sync task)
- ✅ Room Database: REQUIRED (persist pending orders)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Queue order in Room Database if network unavailable
- Use WorkManager OneTimeWorkRequest with NetworkType.CONNECTED constraint
- Retry with exponential backoff (1 min → 10 min)
- Show "Order queued, will sync when online" message
- Handle order failures (stock depleted during queue)

---

### MUST HAVE - Home Screen

#### 2.4 Home Screen Content ✅
**Classification**: MUST HAVE  
**Reason**: Primary landing screen, show featured items  
**Dependencies**:
- API: `GET /api/home-data` (batch endpoint: media banners, trending items, quick picks, active orders)
- Socket: Receive `orderUpdate` with type `banner_updated`
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: OPTIONAL (cache home data for 1 minute)
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Fetch on home screen open
- Display:
  - Media banners (carousel)
  - Trending items (horizontal RecyclerView)
  - Quick picks (horizontal RecyclerView)
  - Active orders (if any)
- Cache response for 60 seconds (reduce API calls)

---

## SHOULD HAVE (Post-MVP)

### SHOULD HAVE - Enhanced Menu Features

#### 2.2 Menu Item Image Upload 🟡
**Classification**: SHOULD HAVE  
**Reason**: Improves menu appeal but canteen owner feature (not customer)  
**Dependencies**:
- API: `POST /api/menu/:id/image`, `DELETE /api/menu/:id/image`
- Socket: NONE
**Android Requirements**:
- ✅ Camera Permission: REQUIRED (android.permission.CAMERA)
- ✅ Gallery Access: REQUIRED (READ_MEDIA_IMAGES on Android 13+)
- ✅ Image Compression: OPTIONAL (server compresses to 20KB anyway)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED

**Implementation Notes**:
- Use CameraX for camera capture
- Use Photo Picker API (Android 11+) for gallery selection
- Compress before upload (server compresses anyway, but reduce bandwidth)
- Fallback to web UI for MVP

---

#### 2.5 Category Image Upload 🟡
**Classification**: SHOULD HAVE  
**Reason**: Canteen owner feature, not critical for customer app  
**Dependencies**:
- API: `POST /api/categories/:id/image`, `DELETE /api/categories/:id/image`
- Socket: NONE
**Android Requirements**:
- ✅ Camera Permission: OPTIONAL
- ✅ Gallery Access: OPTIONAL
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED

**Implementation Notes**:
- Same implementation as menu item image upload
- Lower priority (categories less visual than menu items)

---

### SHOULD HAVE - Complaint Management

#### 14.1 Complaint Submission 🟡
**Classification**: SHOULD HAVE  
**Reason**: Important for customer support but not blocking for MVP  
**Dependencies**:
- API: `POST /api/complaints`, `GET /api/users/:id/complaints`
- Socket: NONE
- Data: MongoDB Complaint (orderId, userId, complaintType, description, status)
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Add "Report Issue" button on order detail screen
- Fields: complaintType (dropdown), description (multiline text)
- Show submission confirmation

---

### SHOULD HAVE - Barcode Features

#### 6.1 Order Barcode Display 🟡
**Classification**: SHOULD HAVE  
**Reason**: Useful for pickup verification but not essential (order number sufficient)  
**Dependencies**:
- Order barcode generated automatically: `ORD${orderNumber}` (16 chars)
- Data: MongoDB Order (barcode, orderNumber)
**Android Requirements**:
- ✅ Barcode Library: OPTIONAL (ZXing for barcode rendering)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Show barcode on order confirmation screen
- Use ZXing Android Embedded: `com.journeyapps:zxing-android-embedded:4.3.0`
- Fallback: show order number prominently if barcode rendering fails

---

#### 6.3 Public Order Tracking 🟡
**Classification**: SHOULD HAVE  
**Reason**: Nice-to-have for guest users but not MVP (authenticated users have order history)  
**Dependencies**:
- API: `GET /api/orders/by-barcode/:barcode`, `GET /api/orders/by-order-number/:orderNumber`
- Socket: NONE
**Android Requirements**:
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Add "Track Order" option for guest users
- Input: order number or barcode scan
- Display order status (no auth required)

---

### SHOULD HAVE - Delivery Person App (Separate MVP)

#### 11.3 Delivery Person Portal 🟡
**Classification**: SHOULD HAVE (SEPARATE APP MVP)  
**Reason**: Critical for delivery feature but should be separate app  
**Dependencies**:
- API: `GET /api/orders/delivery-person/:deliveryPersonId`, `GET /api/delivery-persons/by-email/:email`
- Socket: Emit `joinDeliveryPersonRoom`, Receive `deliveryAssignment`
**Android Requirements**:
- ✅ Foreground Service: REQUIRED (maintain WebSocket for order assignments)
- ✅ Barcode Scanner: REQUIRED (CameraX + ML Kit for delivery confirmation)
- ✅ Camera Permission: REQUIRED
- ✅ Location Services: OPTIONAL (delivery tracking)
- ✅ Maps SDK: OPTIONAL (navigation)
- ❌ Background sync: NOT NEEDED
- ✅ Local persistence: REQUIRED (cache assigned orders)

**Implementation Notes**:
- Build as separate Android app: "Sillobite Delivery"
- Foreground service notification: "Waiting for delivery assignments"
- Scan customer barcode to mark delivered: `POST /api/delivery/scan`
- Show assigned order details: items, delivery address, customer phone
- Post-MVP: Add Google Maps navigation

---

#### 6.2 Barcode Scanning (Delivery Verification) 🟡
**Classification**: SHOULD HAVE (Delivery App MVP)  
**Reason**: Required for delivery person app, not customer app  
**Dependencies**:
- API: `POST /api/delivery/scan`, `GET /api/delivery/verify/:barcode`
- Socket: Emit `orderUpdate` with type `order_status_changed` (status=delivered)
**Android Requirements**:
- ✅ CameraX + ML Kit Barcode: REQUIRED (com.google.mlkit:barcode-scanning:17.2.0)
- ✅ Camera Permission: REQUIRED (android.permission.CAMERA)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED

**Implementation Notes**:
- Use ML Kit Barcode Scanning (supports CODE_128, QR codes)
- Scan customer order barcode (format: `ORD${orderNumber}`)
- Validate barcode via API before marking delivered
- Handle errors: barcode already used, order not ready

---

### SHOULD HAVE - POS/Counter Features

#### 4.2 POS Payment (QR Code Display) 🟡
**Classification**: SHOULD HAVE (Canteen Owner App)  
**Reason**: Counter-based payments, separate owner app recommended  
**Dependencies**:
- API: `POST /api/pos/payments/initiate`, `POST /api/razorpay/qr/create`, `GET /api/razorpay/qr/:qrId`
- Socket: Emit payment confirmation to counter room
**Android Requirements**:
- ✅ QR Code Display: REQUIRED (ZXing for QR rendering)
- ✅ QR Code Scanner: OPTIONAL (if owner scans customer QR)
- ❌ Foreground service: NOT NEEDED
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Build as separate app: "Sillobite POS"
- Display Razorpay UPI QR code for walk-in customers
- Poll for payment status: `GET /api/razorpay/qr/:qrId/payments`
- Confirm order after payment success

---

#### 3.5 Multi-Counter Order Distribution 🟡
**Classification**: SHOULD HAVE (Canteen Owner App)  
**Reason**: Complex counter management, owner feature  
**Dependencies**:
- API: `GET /api/orders/counter/:counterId`
- Socket: Emit to `counter_${counterId}` room, Receive in counter app
**Android Requirements**:
- ✅ Socket.IO: REQUIRED (from 5.1)
- ✅ Foreground service: OPTIONAL (prevent disconnect)
- ❌ Background sync: NOT NEEDED
- ❌ Local persistence: NOT NEEDED
- ❌ Native permission: NOT NEEDED

**Implementation Notes**:
- Part of "Sillobite POS" app
- Join counter room: `socket.emit('joinCounterRoom', { counterId })`
- Display orders for specific counter (store/payment/KOT)
- Track item status per counter: `itemStatusByCounter`

---

## WEB-ONLY (No Android Value)

### WEB-ONLY - Admin Management

#### 1.3 User Administration ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin panel requires desktop view (tables, filters, bulk actions)  
**Dependencies**:
- API: `GET /api/users`, `GET /api/users/paginated`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`, `PUT /api/users/:id/block`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Complex data tables (user list with filters)
- Bulk actions (block/unblock multiple users)
- Better UX on desktop (large screen, mouse/keyboard)
- Low mobile usage (admins at desktop)

---

#### 9.1 System Settings Management ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin configuration panel (canteens, colleges, organizations)  
**Dependencies**:
- API: `GET /api/system-settings`, `PUT /api/system-settings`, `POST /api/system-settings/canteens`, etc.
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Complex nested forms (canteen list, college list)
- Infrequent usage (one-time setup)
- Desktop-optimized UI

---

#### 9.2 Canteen Settings ⛔
**Classification**: WEB-ONLY  
**Reason**: Owner configuration (tax rate, charges, favorite counter)  
**Dependencies**:
- API: `GET /api/canteens/:canteenId/settings`, `PUT /api/canteens/:canteenId/settings`
- Roles: `canteen_owner`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Infrequent changes (tax rate rarely updated)
- Better desktop UX (number inputs, dropdowns)

---

#### 9.3 Checkout Charges Management ⛔
**Classification**: WEB-ONLY  
**Reason**: Owner feature, complex configuration  
**Dependencies**:
- API: `GET /api/canteens/:canteenId/charges`, `POST /api/canteens/:canteenId/charges`, `PUT /api/canteen-charges/:id`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Create/update charges (delivery fee, packaging, service charge)
- Complex form: name, type (percent/fixed), value, active toggle

---

#### 10.1 Admin Dashboard Analytics ⛔
**Classification**: WEB-ONLY  
**Reason**: Analytics dashboard requires charts, large screen  
**Dependencies**:
- API: `GET /api/admin/dashboard-stats`, `GET /api/admin/analytics`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Charts (line, bar, pie) better on desktop
- Large data tables (revenue, orders)
- Desktop-only audience (admins)

---

#### 10.2 Menu Analytics ⛔
**Classification**: WEB-ONLY  
**Reason**: Owner analytics (total items, active, out-of-stock, low stock)  
**Dependencies**:
- API: `GET /api/canteens/:canteenId/menu-analytics`
- Roles: `canteen_owner`
**Android Requirements**: NOT APPLICABLE

---

#### 10.3 Order Analytics (Paginated) ⛔
**Classification**: WEB-ONLY  
**Reason**: Advanced filtering, pagination, date ranges  
**Dependencies**:
- API: `GET /api/orders/paginated`
- Roles: `admin`, `super_admin`, `canteen_owner`
**Android Requirements**: NOT APPLICABLE

---

#### 11.1 Delivery Person Management ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin panel for creating/managing delivery persons  
**Dependencies**:
- API: `POST /api/delivery-persons`, `GET /api/delivery-persons`, `PUT /api/delivery-persons/:id`, `DELETE /api/delivery-persons/:id`
- Roles: `admin`, `super_admin`, `canteen_owner`
**Android Requirements**: NOT APPLICABLE

---

#### 11.2 Order Assignment to Delivery Person ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin/owner feature, assign orders to delivery persons  
**Dependencies**:
- API: `PUT /api/orders/:id` (assign deliveryPersonId)
- Socket: Broadcast to `delivery_person_${email}` room
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Requires order list + delivery person list (complex UI)
- Desktop-optimized workflow

---

#### 14.2 Complaint Resolution (Admin) ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin panel for reviewing complaints  
**Dependencies**:
- API: `PATCH /api/complaints/:id`, `DELETE /api/complaints/:id`
- Roles: `admin`, `super_admin`, `canteen_owner`
**Android Requirements**: NOT APPLICABLE

---

#### 15.2 Login Issue Management (Admin) ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin debugging tool  
**Dependencies**:
- API: `PATCH /api/login-issues/:id`, `DELETE /api/login-issues/:id`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

---

### WEB-ONLY - Enterprise & Advanced Features

#### 16.1 Coding Challenge System ⛔
**Classification**: WEB-ONLY  
**Reason**: Gamification feature, requires code editor (desktop UX)  
**Dependencies**:
- API: `GET /api/coding-challenges`, `POST /api/coding-challenges/:id/submit`, `GET /api/coding-challenges/leaderboard`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Code editor not feasible on mobile (small screen, no keyboard)
- Low usage (optional gamification)
- Desktop audience (developers)

---

#### 17.1 Restaurant QR Code System ⛔
**Classification**: WEB-ONLY  
**Reason**: Table ordering for restaurants (not college canteen focus)  
**Dependencies**:
- API: `GET /api/restaurants/:restaurantId/table/:tableNumber`, `GET /api/table/:restaurantId/:tableNumber/:hash`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Feature for restaurant vertical (not MVP target)
- QR code scanning works via web browser (no app needed)

---

#### 18.1 Vendor Bidding ⛔
**Classification**: WEB-ONLY  
**Reason**: Enterprise B2B feature (vendor RFQ, bidding)  
**Dependencies**:
- API: `GET /api/bidding/rfqs`, `POST /api/bidding/rfqs`, `POST /api/bidding/rfqs/:id/bids`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- B2B procurement feature (not customer-facing)
- Complex workflows (RFQ creation, bid comparison)
- Desktop-only audience

---

#### 19.1 KOT (Kitchen Order Ticket) Printing ⛔
**Classification**: WEB-ONLY  
**Reason**: Desktop print agent (Electron app)  
**Dependencies**:
- API: `POST /api/print-agent/register`, `GET /api/print-agent/pending-jobs`, `POST /api/print/order/:orderId`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Thermal printer integration requires desktop OS drivers
- Electron app runs on owner's Windows/Mac machine
- No mobile use case

---

#### 20.1 Vendor Payout Processing ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin financial management  
**Dependencies**:
- API: `GET /api/payouts`, `POST /api/payouts`, `PUT /api/payouts/:id`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- Financial reconciliation (desktop-only workflow)
- Low frequency (monthly/quarterly payouts)

---

#### 21.1 Sitemap Generation ⛔
**Classification**: WEB-ONLY  
**Reason**: SEO for web (not applicable to Android app)  
**Dependencies**:
- API: `GET /api/sitemap.xml`, `GET /api/robots.txt`
**Android Requirements**: NOT APPLICABLE

---

#### 22.1 Database Backup & Restore ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin database management tool  
**Dependencies**:
- API: `POST /api/database/backup`, `POST /api/database/restore`, `GET /api/database/export`
- Roles: `super_admin`
**Android Requirements**: NOT APPLICABLE

---

#### 23.2 Performance Monitoring ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin diagnostics (slow queries, cache hit rates)  
**Dependencies**:
- API: `GET /api/performance/metrics`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

---

### WEB-ONLY - Diagnostics

#### 13.1 Health Checks ⛔
**Classification**: WEB-ONLY  
**Reason**: Server diagnostics (no user-facing value)  
**Dependencies**:
- API: `GET /api/health`, `GET /api/health/redis`, `GET /api/status`, `GET /api/server-info`
**Android Requirements**: NOT APPLICABLE

**Rationale**:
- DevOps monitoring (not customer feature)
- No UI in app

---

#### 13.2 Database Diagnostics ⛔
**Classification**: WEB-ONLY  
**Reason**: Admin troubleshooting tool  
**Dependencies**:
- API: `GET /api/schema-status`, `GET /api/mongodb-diagnostics`, `GET /api/websocket/status`
- Roles: `admin`, `super_admin`
**Android Requirements**: NOT APPLICABLE

---

## ANDROID-SPECIFIC IMPLEMENTATION REQUIREMENTS

### MUST HAVE - Native Integrations

#### A1. Google Sign-In SDK ✅
**Priority**: MUST HAVE  
**Library**: `com.google.android.gms:play-services-auth:20.7.0`  
**Setup**:
1. Register app in Firebase Console
2. Add SHA-1 certificate fingerprint
3. Configure OAuth client ID (Web, Android)
4. Handle `GoogleSignInAccount` → JWT token exchange

**Implementation**:
```kotlin
// Initialize Google Sign-In
val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestIdToken(getString(R.string.server_client_id)) // Web client ID
    .requestEmail()
    .build()
val googleSignInClient = GoogleSignIn.getClient(this, gso)

// Sign-In Flow
val signInIntent = googleSignInClient.signInIntent
startActivityForResult(signInIntent, RC_SIGN_IN)

// Handle Result
override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == RC_SIGN_IN) {
        val task = GoogleSignIn.getSignedInAccountFromIntent(data)
        val account = task.getResult(ApiException::class.java)
        // Send account.idToken to server: POST /api/auth/google/verify
    }
}
```

---

#### A2. Razorpay Android SDK ✅
**Priority**: MUST HAVE  
**Library**: `com.razorpay:checkout:1.6.33`  
**Setup**:
1. Add Razorpay key ID to project
2. Configure Proguard rules (if using R8/Proguard)
3. Permissions: `android.permission.READ_PHONE_STATE` (optional, for prefill)

**Implementation**:
```kotlin
// Initiate Payment
val checkout = Checkout()
checkout.setKeyID(BuildConfig.RAZORPAY_KEY_ID)

val options = JSONObject()
options.put("name", "Sillobite")
options.put("description", "Order #$orderNumber")
options.put("order_id", razorpayOrderId) // From POST /api/payments/initiate
options.put("amount", totalAmount * 100) // Paise
options.put("currency", "INR")
options.put("prefill", JSONObject().apply {
    put("email", userEmail)
    put("contact", userPhone)
})

checkout.open(activity, options)

// Handle Callbacks
override fun onPaymentSuccess(razorpayPaymentId: String) {
    // Verify payment: POST /api/payments/verify
    // Send: razorpayPaymentId, razorpayOrderId, razorpaySignature
}

override fun onPaymentError(code: Int, response: String) {
    // Handle payment failure
    // Codes: 0 (Payment cancelled), 2 (Network error)
}
```

---

#### A3. Firebase Cloud Messaging (FCM) ✅
**Priority**: MUST HAVE  
**Library**: `com.google.firebase:firebase-messaging:23.4.0`  
**Setup**:
1. Add `google-services.json` to `app/` directory
2. Request `POST_NOTIFICATIONS` permission (Android 13+)
3. Create notification channels (Android 8.0+)

**Implementation**:
```kotlin
// Request Permission (Android 13+)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        REQUEST_CODE_NOTIFICATIONS
    )
}

// Get FCM Token
FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
    // Send token to server: POST /api/push/subscribe
    // Body: { "userId": userId, "fcmToken": token, "deviceType": "android" }
}

// Handle Token Refresh
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // Update token on server
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Extract notification data
        val orderId = remoteMessage.data["orderId"]
        val status = remoteMessage.data["status"]
        val title = remoteMessage.notification?.title
        val body = remoteMessage.notification?.body
        
        // Show notification
        showNotification(title, body, orderId, status)
    }
}

// Create Notification Channels (Android 8.0+)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    val channel = NotificationChannel(
        CHANNEL_ORDER_UPDATES,
        "Order Updates",
        NotificationManager.IMPORTANCE_HIGH
    )
    notificationManager.createNotificationChannel(channel)
}
```

---

#### A4. Socket.IO Android Client ✅
**Priority**: MUST HAVE  
**Library**: `io.socket:socket.io-client:2.1.0`  
**Setup**:
1. Add OkHttp dependency (Socket.IO uses OkHttp)
2. Handle Android network security config (allow cleartext if using HTTP)
3. Manage lifecycle (connect on app launch, disconnect on app close)

**Implementation**:
```kotlin
class SocketManager(private val serverUrl: String) {
    private lateinit var socket: Socket
    
    fun connect(userId: String, canteenId: String) {
        val opts = IO.Options().apply {
            transports = arrayOf(WebSocket.NAME) // Force WebSocket
            reconnection = true
            reconnectionDelay = 1000
            reconnectionDelayMax = 8000
        }
        
        socket = IO.socket(serverUrl, opts)
        
        socket.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            joinCanteenRoom(canteenId)
        }
        
        socket.on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
        }
        
        socket.on("orderUpdate") { args ->
            val data = args[0] as JSONObject
            val type = data.getString("type")
            when (type) {
                "order_status_changed" -> handleOrderStatusChanged(data)
                "menu_updated" -> handleMenuUpdated(data)
                "banner_updated" -> handleBannerUpdated(data)
            }
        }
        
        socket.connect()
    }
    
    private fun joinCanteenRoom(canteenId: String) {
        val data = JSONObject().apply {
            put("canteenIds", JSONArray().put(canteenId))
        }
        socket.emit("joinCanteenRooms", data)
    }
    
    fun disconnect() {
        socket.disconnect()
    }
}

// Lifecycle Management (in Application class or Activity)
class MyApplication : Application() {
    lateinit var socketManager: SocketManager
    
    override fun onCreate() {
        super.onCreate()
        socketManager = SocketManager("https://api.sillobite.com")
    }
}

// Connect on app launch
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as MyApplication
        app.socketManager.connect(userId, canteenId)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        val app = application as MyApplication
        app.socketManager.disconnect()
    }
}
```

---

#### A5. Room Database (Offline Cache) ✅
**Priority**: MUST HAVE  
**Library**: `androidx.room:room-runtime:2.6.1`, `androidx.room:room-ktx:2.6.1`  
**Setup**:
1. Define entities (MenuItem, Category, Order, CartItem)
2. Create DAOs (Data Access Objects)
3. Configure database migration strategy

**Implementation**:
```kotlin
// Entities
@Entity(tableName = "menu_items")
data class CachedMenuItem(
    @PrimaryKey val id: String,
    val canteenId: String,
    val name: String,
    val description: String?,
    val price: Double,
    val stock: Int?,
    val available: Boolean,
    val imageUrl: String?,
    val categoryId: String?,
    val isVeg: Boolean,
    val cachedAt: Long
)

@Entity(tableName = "categories")
data class CachedCategory(
    @PrimaryKey val id: String,
    val canteenId: String,
    val name: String,
    val imageUrl: String?,
    val cachedAt: Long
)

@Entity(tableName = "cart_items")
data class CartItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
    val canteenId: String,
    val addedAt: Long
)

@Entity(tableName = "pending_orders")
data class PendingOrder(
    @PrimaryKey val id: String, // UUID
    val userId: String,
    val canteenId: String,
    val items: String, // JSON array of cart items
    val totalAmount: Double,
    val status: String, // "pending", "syncing", "failed"
    val createdAt: Long,
    val retryCount: Int = 0
)

// DAOs
@Dao
interface MenuItemDao {
    @Query("SELECT * FROM menu_items WHERE canteenId = :canteenId AND available = 1")
    fun getMenuItems(canteenId: String): Flow<List<CachedMenuItem>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CachedMenuItem>)
    
    @Query("DELETE FROM menu_items WHERE cachedAt < :expiryTime")
    suspend fun deleteExpired(expiryTime: Long)
}

@Dao
interface CartItemDao {
    @Query("SELECT * FROM cart_items WHERE canteenId = :canteenId")
    fun getCartItems(canteenId: String): Flow<List<CartItem>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: CartItem)
    
    @Delete
    suspend fun delete(item: CartItem)
    
    @Query("DELETE FROM cart_items WHERE canteenId = :canteenId")
    suspend fun clearCart(canteenId: String)
}

@Dao
interface PendingOrderDao {
    @Query("SELECT * FROM pending_orders WHERE status = 'pending'")
    suspend fun getPendingOrders(): List<PendingOrder>
    
    @Insert
    suspend fun insert(order: PendingOrder)
    
    @Update
    suspend fun update(order: PendingOrder)
    
    @Delete
    suspend fun delete(order: PendingOrder)
}

// Database
@Database(
    entities = [CachedMenuItem::class, CachedCategory::class, CartItem::class, PendingOrder::class],
    version = 1
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun menuItemDao(): MenuItemDao
    abstract fun cartItemDao(): CartItemDao
    abstract fun pendingOrderDao(): PendingOrderDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sillobite_db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
```

---

#### A6. WorkManager (Offline Sync) ✅
**Priority**: MUST HAVE  
**Library**: `androidx.work:work-runtime-ktx:2.9.0`  
**Setup**:
1. Define Worker for order sync
2. Configure constraints (NetworkType.CONNECTED)
3. Handle retry logic with backoff

**Implementation**:
```kotlin
class OrderSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        val database = AppDatabase.getDatabase(applicationContext)
        val pendingOrders = database.pendingOrderDao().getPendingOrders()
        
        if (pendingOrders.isEmpty()) {
            return Result.success()
        }
        
        var allSynced = true
        
        for (order in pendingOrders) {
            try {
                // Attempt to sync order
                val response = apiService.createOrder(order.toOrderRequest())
                
                if (response.isSuccessful) {
                    // Order synced successfully
                    database.pendingOrderDao().delete(order)
                    Log.d(TAG, "Order ${order.id} synced successfully")
                } else {
                    // Server rejected order (stock depleted, validation error)
                    val errorCode = response.code()
                    if (errorCode == 400 || errorCode == 429) {
                        // Non-retryable error, delete pending order
                        database.pendingOrderDao().delete(order)
                        Log.e(TAG, "Order ${order.id} rejected: $errorCode")
                    } else {
                        // Retryable error (5xx)
                        val updatedOrder = order.copy(
                            status = "failed",
                            retryCount = order.retryCount + 1
                        )
                        database.pendingOrderDao().update(updatedOrder)
                        allSynced = false
                    }
                }
            } catch (e: Exception) {
                // Network error, mark for retry
                Log.e(TAG, "Failed to sync order ${order.id}", e)
                val updatedOrder = order.copy(
                    status = "failed",
                    retryCount = order.retryCount + 1
                )
                database.pendingOrderDao().update(updatedOrder)
                allSynced = false
            }
        }
        
        return if (allSynced) {
            Result.success()
        } else {
            // Retry failed orders
            Result.retry()
        }
    }
}

// Schedule Worker
fun scheduleOrderSync(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
    
    val syncRequest = OneTimeWorkRequestBuilder<OrderSyncWorker>()
        .setConstraints(constraints)
        .setBackoffCriteria(
            BackoffPolicy.EXPONENTIAL,
            1, TimeUnit.MINUTES
        )
        .build()
    
    WorkManager.getInstance(context).enqueue(syncRequest)
}

// Queue Order Offline
suspend fun queueOrderOffline(order: Order) {
    val pendingOrder = PendingOrder(
        id = UUID.randomUUID().toString(),
        userId = order.userId,
        canteenId = order.canteenId,
        items = Json.encodeToString(order.items),
        totalAmount = order.totalAmount,
        status = "pending",
        createdAt = System.currentTimeMillis()
    )
    
    database.pendingOrderDao().insert(pendingOrder)
    
    // Schedule sync
    scheduleOrderSync(context)
    
    // Show user feedback
    Toast.makeText(context, "Order queued, will sync when online", Toast.LENGTH_LONG).show()
}
```

---

### MUST HAVE - Permissions

#### P1. POST_NOTIFICATIONS (Android 13+) ✅
**Priority**: MUST HAVE  
**Reason**: Required for FCM push notifications on Android 13+  
**Permission**: `android.permission.POST_NOTIFICATIONS`  
**Implementation**:
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

```kotlin
// Request at runtime (Android 13+)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    if (ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_CODE_NOTIFICATIONS
        )
    }
}
```

---

#### P2. INTERNET & ACCESS_NETWORK_STATE ✅
**Priority**: MUST HAVE  
**Reason**: API calls, WebSocket, image loading  
**Permissions**:
- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

### SHOULD HAVE - Permissions

#### P3. CAMERA (Post-MVP) 🟡
**Priority**: SHOULD HAVE  
**Reason**: Barcode scanning (delivery app), image upload (owner app)  
**Permission**: `android.permission.CAMERA`  
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

**Implementation** (Request at runtime):
```kotlin
if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
    != PackageManager.PERMISSION_GRANTED) {
    ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.CAMERA),
        REQUEST_CODE_CAMERA
    )
}
```

---

#### P4. READ_MEDIA_IMAGES (Android 13+) / READ_EXTERNAL_STORAGE (Android 12-) 🟡
**Priority**: SHOULD HAVE (Owner/Admin App)  
**Reason**: Gallery access for menu item image upload  
**Permissions**:
- Android 13+: `android.permission.READ_MEDIA_IMAGES`
- Android 12-: `android.permission.READ_EXTERNAL_STORAGE`

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
```

**Implementation** (Use Photo Picker on Android 11+):
```kotlin
// Photo Picker (Android 11+)
val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
startActivityForResult(intent, REQUEST_CODE_GALLERY)

// Permission fallback (Android 10-)
if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
        != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE),
            REQUEST_CODE_STORAGE
        )
    }
}
```

---

### SHOULD HAVE - Foreground Service (Delivery App)

#### FS1. Foreground Service (Delivery Person App) 🟡
**Priority**: SHOULD HAVE (Delivery App MVP)  
**Reason**: Maintain WebSocket connection for delivery assignments  
**Service Type**: `android:foregroundServiceType="dataSync"`  
**Implementation**:
```xml
<!-- AndroidManifest.xml -->
<service
    android:name=".DeliveryService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="dataSync" />
```

```kotlin
class DeliveryService : Service() {
    private lateinit var socketManager: SocketManager
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // Connect to WebSocket
        socketManager = SocketManager(BuildConfig.API_URL)
        socketManager.connect(userId, deliveryPersonEmail)
        socketManager.onDeliveryAssignment { order ->
            // Show notification for new delivery assignment
            showDeliveryNotification(order)
        }
        
        return START_STICKY
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_DELIVERY_SERVICE)
            .setContentTitle("Sillobite Delivery")
            .setContentText("Waiting for delivery assignments...")
            .setSmallIcon(R.drawable.ic_delivery)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
    }
}

// Start Service
val intent = Intent(this, DeliveryService::class.java)
ContextCompat.startForegroundService(this, intent)
```

---

## MVP SUMMARY

### Customer App (Primary MVP)

**MUST HAVE** (16 capabilities):
1. Google OAuth Authentication ✅
2. Email/Password Authentication ✅
3. User Session Validation ✅
4. Profile Setup & Location Selection ✅
5. Menu Item Browsing ✅
6. Category Browsing ✅
7. Menu Search ✅
8. Stock Display & Filtering ✅
9. Shopping Cart ✅
10. Order Creation ✅
11. Order Tracking (Active Orders) ✅
12. Order History ✅
13. Razorpay Online Payment ✅
14. Checkout Session Management ✅
15. WebSocket Connection Management ✅
16. Order Real-Time Updates ✅
17. Menu Real-Time Updates ✅
18. FCM Push Subscription ✅
19. Order Status Notifications ✅
20. Offline Menu Caching ✅
21. Offline Order Queue ✅
22. Home Screen Content ✅

**Total APIs**: 30+ endpoints  
**Total Socket Events**: 8 event types  
**Native SDKs**: 6 (Google Sign-In, Razorpay, FCM, Socket.IO, Room, WorkManager)  
**Permissions**: 2 (INTERNET, POST_NOTIFICATIONS)  

---

### Delivery Person App (Secondary MVP)

**SHOULD HAVE** (5 capabilities):
1. Delivery Person Portal ✅ (Separate App)
2. Barcode Scanning (Delivery Verification) ✅
3. Assigned Order List ✅
4. WebSocket Delivery Room ✅
5. Foreground Service (WebSocket Keep-Alive) ✅

**Total APIs**: 5+ endpoints  
**Total Socket Events**: 2 event types  
**Native SDKs**: 3 (Socket.IO, CameraX + ML Kit, Room)  
**Permissions**: 2 (CAMERA, INTERNET)  
**Service**: Foreground Service (dataSync)  

---

### Canteen Owner App (Post-MVP)

**SHOULD HAVE** (8 capabilities):
1. Menu Item Management ✅
2. Menu Item Image Upload ✅
3. Category Image Upload ✅
4. Order Status Management ✅
5. POS Payment (QR Code Display) ✅
6. Multi-Counter Order Distribution ✅
7. Order List (Counter View) ✅
8. Canteen Settings (Read-Only MVP) ✅

**Recommendation**: Build as separate app ("Sillobite POS")  
**Total APIs**: 20+ endpoints  
**Total Socket Events**: 5 event types  
**Native SDKs**: 4 (Socket.IO, ZXing, Camera, Room)  
**Permissions**: 3 (CAMERA, INTERNET, READ_MEDIA_IMAGES)  

---

### WEB-ONLY (No Android Development)

**Total**: 28 capabilities excluded from Android scope  
**Reason**: Admin/enterprise features better suited for desktop web  
**Examples**:
- User Administration (admin panel)
- System Settings Management (complex forms)
- Analytics Dashboards (charts, large data tables)
- Bidding System (B2B feature)
- Print Agent Integration (desktop Electron app)
- Database Management (super admin tools)
- Performance Monitoring (DevOps)

---

## TECHNICAL DEBT & FUTURE ENHANCEMENTS

### Post-MVP Enhancements (Customer App)

1. **Location Services** (Delivery Tracking)
   - Google Maps SDK integration
   - Real-time delivery person location
   - Estimated arrival time
   - **Priority**: LOW (nice-to-have)

2. **Image Compression** (Client-Side)
   - Compress images before upload (reduce bandwidth)
   - Server compresses anyway (20KB target)
   - **Priority**: LOW (optimization)

3. **Biometric Authentication** (Quick Login)
   - Fingerprint/Face unlock
   - Skip email/password entry on repeat login
   - **Priority**: MEDIUM (UX enhancement)

4. **Dark Mode** (Theme Support)
   - Material Design 3 dark theme
   - Follow system theme preference
   - **Priority**: MEDIUM (UX enhancement)

5. **Multi-Language Support** (Localization)
   - Hindi, English (regional languages)
   - Resource localization
   - **Priority**: LOW (depends on target market)

6. **Payment History** (Customer App)
   - View past payment records
   - Download receipts
   - **Priority**: MEDIUM (currently in Order History)

7. **Favorites/Wishlist** (Menu Items)
   - Save favorite menu items
   - Quick reorder from favorites
   - **Priority**: LOW (nice-to-have)

8. **Order Customization** (Add-ons, Notes)
   - Customize menu items (extra cheese, no onions)
   - Special instructions per item
   - **Priority**: MEDIUM (depends on canteen requirements)

9. **Referral System** (Gamification)
   - Invite friends, earn credits
   - Referral tracking
   - **Priority**: LOW (marketing feature)

10. **Wallet/Credits System** (Prepaid Balance)
    - Top-up wallet balance
    - Pay from wallet + Razorpay
    - **Priority**: LOW (complex financial feature)

---

### Known Limitations (Requires Backend Changes)

1. **Multi-Device Session Management**
   - Current: express-session (single device)
   - Android Needs: JWT token-based auth (multi-device support)
   - **Impact**: User logged out when signing in on another device
   - **Workaround**: Use JWT refresh tokens (requires backend refactor)

2. **Offline Order Idempotency**
   - Current: 429 error for duplicate orders (session-based)
   - Android Needs: Idempotency keys per order request
   - **Impact**: Duplicate orders if WorkManager retries
   - **Workaround**: Generate UUID per order, send in header `X-Idempotency-Key`

3. **WebSocket Authentication**
   - Current: Cookie-based session authentication
   - Android Needs: Token-based WebSocket auth
   - **Impact**: WebSocket connection fails without session cookies
   - **Workaround**: Send JWT token in Socket.IO auth query param

4. **Payment Webhook Security**
   - Current: Razorpay webhook validates via IP whitelist
   - Android Needs: Webhook signature verification
   - **Impact**: Payment verification depends on webhook
   - **Workaround**: Poll payment status if webhook delayed

5. **Image Upload Size Limits**
   - Current: 100KB client-side limit (server compresses to 20KB)
   - Android Needs: Client-side compression before upload
   - **Impact**: Large images (>100KB) rejected before compression
   - **Workaround**: Implement client-side compression (Compressor library)

---

## ANDROID ARCHITECTURE RECOMMENDATIONS

### Recommended Tech Stack

**Language**: Kotlin (100%)  
**Architecture**: MVVM (Model-View-ViewModel) + Repository Pattern  
**Dependency Injection**: Hilt (androidx.hilt:hilt-android)  
**Networking**: Retrofit 2 + OkHttp 4  
**Async**: Kotlin Coroutines + Flow  
**Local Database**: Room (androidx.room:room-runtime)  
**UI**: Jetpack Compose (androidx.compose:compose-bom) OR XML + ViewBinding  
**Navigation**: Jetpack Navigation Component  
**Image Loading**: Coil (io.coil-kt:coil-compose) OR Glide  
**Background Work**: WorkManager (androidx.work:work-runtime-ktx)  
**Real-Time**: Socket.IO Android Client (io.socket:socket.io-client)  
**Push Notifications**: Firebase Cloud Messaging (com.google.firebase:firebase-messaging)  
**Payment**: Razorpay Android SDK (com.razorpay:checkout)  
**OAuth**: Google Sign-In (com.google.android.gms:play-services-auth)  
**Barcode Scanning**: ML Kit (com.google.mlkit:barcode-scanning)  
**QR Code Display**: ZXing (com.journeyapps:zxing-android-embedded)  

---

### Recommended Module Structure

```
app/
├── data/
│   ├── local/
│   │   ├── dao/          # Room DAOs (MenuItemDao, CartItemDao, PendingOrderDao)
│   │   ├── entities/     # Room Entities (CachedMenuItem, CartItem)
│   │   └── database/     # AppDatabase
│   ├── remote/
│   │   ├── api/          # Retrofit API interfaces (AuthApi, MenuApi, OrderApi, PaymentApi)
│   │   ├── dto/          # Data Transfer Objects (request/response models)
│   │   └── socket/       # Socket.IO manager
│   └── repository/       # Repository implementations (AuthRepository, MenuRepository, OrderRepository)
├── domain/
│   ├── models/           # Domain models (User, MenuItem, Order, Payment)
│   └── usecases/         # Use cases (LoginUseCase, PlaceOrderUseCase, GetMenuUseCase)
├── presentation/
│   ├── auth/             # Login, Register, Profile Setup screens
│   ├── home/             # Home screen (banners, trending, quick picks)
│   ├── menu/             # Menu browsing, search, category filter
│   ├── cart/             # Shopping cart, checkout
│   ├── orders/           # Active orders, order history, order details
│   ├── payment/          # Razorpay payment flow
│   ├── profile/          # User profile, settings
│   └── common/           # Shared UI components (LoadingState, ErrorState, EmptyState)
├── di/                   # Hilt dependency injection modules
├── workers/              # WorkManager workers (OrderSyncWorker)
└── utils/                # Utilities (DateUtils, CurrencyUtils, NetworkUtils)
```

---

### Key Design Patterns

#### 1. Repository Pattern
```kotlin
interface MenuRepository {
    suspend fun getMenuItems(canteenId: String): Result<List<MenuItem>>
    fun getMenuItemsFlow(canteenId: String): Flow<List<MenuItem>>
    suspend fun refreshMenu(canteenId: String)
}

class MenuRepositoryImpl(
    private val menuApi: MenuApi,
    private val menuItemDao: MenuItemDao,
    private val socketManager: SocketManager
) : MenuRepository {
    
    override fun getMenuItemsFlow(canteenId: String): Flow<List<MenuItem>> {
        return menuItemDao.getMenuItems(canteenId)
            .map { it.map { cached -> cached.toDomainModel() } }
    }
    
    override suspend fun refreshMenu(canteenId: String) {
        val response = menuApi.getMenu(canteenId)
        if (response.isSuccessful) {
            val items = response.body()?.data ?: emptyList()
            menuItemDao.insertAll(items.map { it.toEntity() })
        }
    }
}
```

#### 2. Single Source of Truth (SSOT)
- **Local Database (Room)**: Single source of truth
- **API**: Refreshes local cache
- **WebSocket**: Invalidates cache (triggers refresh)
- **UI**: Observes local database via Flow

#### 3. Offline-First Strategy
1. **Read**: Always from local database
2. **Write**: Queue in local database → Sync to API when online
3. **Sync**: WorkManager with NetworkType.CONNECTED constraint

---

## ANDROID NATIVE REQUIREMENTS CHECKLIST

### Critical (Must Implement for MVP)

- [ ] **Google Sign-In SDK** - OAuth authentication
- [ ] **Razorpay Android SDK** - Native payment flow
- [ ] **Firebase Cloud Messaging (FCM)** - Push notification delivery
- [ ] **Socket.IO Android Client** - Real-time order updates
- [ ] **Room Database** - Local data persistence for offline mode
- [ ] **WorkManager** - Background sync for offline orders
- [ ] **POST_NOTIFICATIONS Permission** - Android 13+ notification permission
- [ ] **INTERNET & ACCESS_NETWORK_STATE Permissions** - Network access
- [ ] **Notification Channels** - Android 8.0+ notification management

### Recommended (Enhance UX)

- [ ] **Foreground Service** - Keep WebSocket alive for delivery persons (Delivery App MVP)
- [ ] **Notification Deep Links** - Open order detail on notification tap
- [ ] **Material Design 3** - Modern UI components
- [ ] **Adaptive Icons** - Android 8.0+ launcher icons
- [ ] **Splash Screen API** - Android 12+ splash screen

### Optional (Post-MVP)

- [ ] **CameraX + ML Kit Barcode Scanning** - Barcode scanner for delivery verification (Delivery App)
- [ ] **Camera Permission** - Required for barcode scanning and image uploads (Owner/Delivery App)
- [ ] **Gallery Access (READ_MEDIA_IMAGES)** - Menu item image uploads (Owner App)
- [ ] **ZXing Library** - QR code display for POS payments (Owner App)
- [ ] **Google Maps SDK** - Delivery person navigation (Delivery App Enhancement)
- [ ] **Location Services** - Delivery tracking (Delivery App Enhancement)
- [ ] **BiometricPrompt** - Fingerprint/Face unlock (UX Enhancement)
- [ ] **Image Compression Library** - Client-side image optimization (Owner App)

---

## MVP DEVELOPMENT ROADMAP

### Phase 1: Foundation (Week 1-2)

**Deliverables**:
- [ ] Project setup (Kotlin, Hilt, Retrofit, Room)
- [ ] Network layer (API interfaces, DTOs)
- [ ] Local database schema (Room entities, DAOs)
- [ ] Repository pattern implementation
- [ ] Base UI components (LoadingState, ErrorState)

**Dependencies**: None  
**Risk**: Medium (architecture decisions critical)

---

### Phase 2: Authentication (Week 2-3)

**Deliverables**:
- [ ] Google Sign-In integration
- [ ] Email/Password authentication
- [ ] Session management (JWT tokens)
- [ ] Profile setup flow
- [ ] Location selection

**Dependencies**: Phase 1  
**APIs**: `POST /api/auth/google/verify`, `POST /api/auth/register`, `POST /api/auth/login`, `PUT /api/users/:id`, `PUT /api/users/:id/location`  
**Risk**: Low (standard OAuth flow)

---

### Phase 3: Menu Browsing (Week 3-4)

**Deliverables**:
- [ ] Menu list screen (RecyclerView/Compose LazyColumn)
- [ ] Category filter chips
- [ ] Search functionality
- [ ] Stock display badges
- [ ] Offline menu caching (Room)
- [ ] Menu real-time updates (WebSocket)

**Dependencies**: Phase 1, Phase 2  
**APIs**: `GET /api/menu`, `GET /api/categories`, `GET /api/home-data`  
**Socket Events**: `menu_updated`, `banner_updated`  
**Risk**: Medium (WebSocket integration)

---

### Phase 4: Shopping Cart & Checkout (Week 4-5)

**Deliverables**:
- [ ] Cart UI (add/remove items, quantity)
- [ ] Cart persistence (Room)
- [ ] Checkout screen (item summary, charges, total)
- [ ] Checkout session creation
- [ ] Order creation flow

**Dependencies**: Phase 3  
**APIs**: `POST /api/checkout-sessions`, `POST /api/orders`  
**Risk**: Medium (cart validation against stock)

---

### Phase 5: Payment Integration (Week 5-6)

**Deliverables**:
- [ ] Razorpay SDK integration
- [ ] Payment initiation flow
- [ ] Payment verification
- [ ] Payment status polling (fallback)
- [ ] Payment failure handling

**Dependencies**: Phase 4  
**APIs**: `POST /api/payments/initiate`, `POST /api/payments/verify`, `GET /api/payments/status/:merchantTransactionId`  
**Socket Events**: `payment_success`  
**Risk**: High (payment critical path)

---

### Phase 6: Order Tracking (Week 6-7)

**Deliverables**:
- [ ] Active orders screen
- [ ] Order history screen
- [ ] Order detail screen
- [ ] Real-time order status updates (WebSocket)
- [ ] Polling fallback (WebSocket disconnected)

**Dependencies**: Phase 5  
**APIs**: `GET /api/orders/user/:userId/active`, `GET /api/orders/user/:userId/history`, `GET /api/orders/:id`  
**Socket Events**: `order_status_changed`, `order_updated`  
**Risk**: Medium (WebSocket lifecycle)

---

### Phase 7: Push Notifications (Week 7)

**Deliverables**:
- [ ] FCM setup (google-services.json)
- [ ] FCM token generation
- [ ] Push subscription API integration
- [ ] Notification channels (Android 8.0+)
- [ ] POST_NOTIFICATIONS permission (Android 13+)
- [ ] Notification deep links
- [ ] Foreground notification handling

**Dependencies**: Phase 6  
**APIs**: `POST /api/push/subscribe`, `POST /api/push/unsubscribe`  
**Risk**: Medium (FCM token refresh handling)

---

### Phase 8: Offline Support (Week 8)

**Deliverables**:
- [ ] Offline menu browsing (Room cache)
- [ ] Offline order queue (PendingOrder entity)
- [ ] WorkManager sync worker
- [ ] Network state monitoring
- [ ] Offline mode UI indicators
- [ ] Retry logic with exponential backoff

**Dependencies**: Phase 1-7  
**Risk**: High (complex sync logic, race conditions)

---

### Phase 9: Testing & Polish (Week 9-10)

**Deliverables**:
- [ ] Unit tests (ViewModels, Repositories, UseCases)
- [ ] Integration tests (Room DAOs, API calls)
- [ ] UI tests (Espresso/Compose Test)
- [ ] Manual testing (happy paths, error scenarios)
- [ ] Performance testing (list scrolling, image loading)
- [ ] Bug fixes
- [ ] UI polish (animations, transitions)

**Dependencies**: Phase 1-8  
**Risk**: Medium (time-consuming)

---

### Phase 10: Beta Launch (Week 11)

**Deliverables**:
- [ ] Google Play Console setup
- [ ] App signing key generation
- [ ] Internal testing track upload
- [ ] Beta tester recruitment (10-50 users)
- [ ] Crash reporting (Firebase Crashlytics)
- [ ] Analytics (Firebase Analytics)
- [ ] Feedback collection

**Dependencies**: Phase 9  
**Risk**: Low (release process)

---

## MVP SUCCESS METRICS

### Technical Metrics

1. **App Stability**
   - Crash-free rate: >99%
   - ANR (Application Not Responding) rate: <0.5%
   - Target: Firebase Crashlytics

2. **Performance**
   - App launch time (cold start): <3 seconds
   - Menu list scroll FPS: >55 FPS (60 FPS target)
   - Image load time (Coil): <500ms per image
   - Target: Android Profiler

3. **Network Efficiency**
   - API call failure rate: <5%
   - Average API response time: <500ms (server-side)
   - WebSocket connection uptime: >95%
   - Target: Firebase Performance Monitoring

4. **Offline Support**
   - Offline order sync success rate: >90%
   - Cache hit rate (menu): >80%
   - Target: Custom analytics

---

### Business Metrics

1. **User Engagement**
   - Daily Active Users (DAU): Track growth
   - Session duration: >5 minutes (browsing + ordering)
   - Orders per user per week: >2
   - Target: Firebase Analytics

2. **Conversion Funnel**
   - Registration completion rate: >70%
   - Cart abandonment rate: <40%
   - Payment success rate: >95%
   - Repeat order rate: >50%
   - Target: Firebase Analytics + Custom Events

3. **Payment Success**
   - Razorpay payment success rate: >95%
   - Average transaction value: Track
   - Payment retry rate: <10%
   - Target: Backend payment logs

4. **Notification Engagement**
   - Notification delivery rate: >95%
   - Notification open rate: >40%
   - Target: FCM Reports

---

## CONCLUSION

### MVP Scope Summary

**Customer App (Primary Target)**:
- **MUST HAVE**: 22 capabilities
- **Total APIs**: 30+ endpoints
- **Total Socket Events**: 8 event types
- **Native SDKs**: 6 critical integrations
- **Permissions**: 2 required (INTERNET, POST_NOTIFICATIONS)
- **Development Time**: 10-11 weeks (1 developer)

**Delivery Person App (Secondary Target)**:
- **SHOULD HAVE**: 5 capabilities (Separate App)
- **Total APIs**: 5+ endpoints
- **Total Socket Events**: 2 event types
- **Native SDKs**: 3 integrations
- **Permissions**: 2 required (CAMERA, INTERNET)
- **Service**: Foreground Service (dataSync)
- **Development Time**: 3-4 weeks (after Customer App MVP)

**Canteen Owner App (Post-MVP)**:
- **SHOULD HAVE**: 8 capabilities (Separate App)
- **Total APIs**: 20+ endpoints
- **Total Socket Events**: 5 event types
- **Native SDKs**: 4 integrations
- **Permissions**: 3 required (CAMERA, INTERNET, READ_MEDIA_IMAGES)
- **Development Time**: 5-6 weeks (after Delivery App)

**WEB-ONLY (No Android Development)**:
- **Total**: 28 capabilities excluded from Android scope
- **Reason**: Admin/enterprise features better suited for desktop web

---

### Critical Success Factors

1. **Razorpay Integration**: Payment flow must be bulletproof (>95% success rate)
2. **Offline Support**: College WiFi unreliable, app must function offline
3. **Real-Time Updates**: WebSocket uptime critical for order status notifications
4. **Push Notifications**: Users rely on notifications to know when order ready
5. **Performance**: Smooth scrolling, fast image loading (college students expect speed)

---

### Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Razorpay Payment Failures** | HIGH | Implement retry logic, fallback to manual confirmation, detailed error messages |
| **WebSocket Disconnection** | MEDIUM | Polling fallback (30s), automatic reconnection with exponential backoff |
| **Offline Order Duplication** | HIGH | Implement idempotency keys, generate UUID per order, prevent duplicate submissions |
| **FCM Token Expiry** | MEDIUM | Handle token refresh, resubscribe to push on token change |
| **Stock Race Conditions** | MEDIUM | Validate stock on checkout, handle 400 errors gracefully, show "Out of Stock" message |
| **Android Background Restrictions** | LOW | Document foreground service requirements for delivery app, use WorkManager for sync |

---

### Next Steps

1. **Backend Alignment**:
   - Confirm JWT token-based auth support (replace express-session cookies)
   - Add idempotency key support for `POST /api/orders`
   - Implement WebSocket token authentication (query param: `?token=JWT`)

2. **Design System**:
   - Define color palette (Material Design 3)
   - Create component library (buttons, cards, badges)
   - Design order status flow (Figma/Sketch)

3. **Development Kickoff**:
   - Set up Android project (Kotlin, Hilt, Retrofit, Room)
   - Configure Firebase (FCM, Crashlytics, Analytics)
   - Implement CI/CD pipeline (GitHub Actions → Google Play Internal Testing)

4. **Beta Testing Plan**:
   - Recruit 10-20 students from target college
   - Provide test accounts (bypass payment in staging)
   - Collect feedback via Google Forms + Firebase Crashlytics

---

## END OF DOCUMENT

**Document Version**: 1.0  
**Last Updated**: 2026-01-02  
**Total Capabilities Classified**: 96 capabilities (from 02-capability-map.md)  
**MVP Scope**: 22 MUST HAVE (Customer App), 5 SHOULD HAVE (Delivery App), 8 SHOULD HAVE (Owner App), 28 WEB-ONLY  
**Estimated Development Time**: 10-11 weeks (Customer App MVP)  

**Classification Principles**:  
✅ **MUST HAVE**: Core business flow (browse → order → pay → receive)  
🟡 **SHOULD HAVE**: Enhances UX but not blocking  
⛔ **WEB-ONLY**: Admin/management features (desktop-optimized)  

**Conservative MVP Philosophy**: Ship small but correct. Every capability in MVP must be production-ready, tested, and delivers immediate user value.
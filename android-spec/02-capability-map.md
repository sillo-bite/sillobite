# 02 - CAPABILITY MAP

## DOCUMENT METADATA
- **Extraction Date**: 2025-12-31
- **Source**: Backend routes (9730 lines), WebSocket implementation (613 lines), MongoDB models (1253 lines)
- **Protocol**: Business capability extraction (not screen-based)
- **Lines Analyzed**: 11,596+ LOC across server/, client/, shared/

---

## CAPABILITY ORGANIZATION

This document groups **ALL implemented capabilities** by logical business modules, not by UI screens.

Each capability includes:
- **Description**: What the capability does
- **Responsible Layer**: client/server/both
- **APIs Involved**: HTTP endpoints called
- **Socket Events**: Real-time events emitted/received
- **Data Models**: Database entities touched
- **Roles Allowed**: Which roles can use this capability
- **Android Native Support**: REQUIRED / OPTIONAL / NOT_NEEDED

---

## MODULE 1: USER MANAGEMENT

### 1.1 User Registration & Profile Setup

**Description**: Register new users via Google OAuth or email/password, complete profile with role-specific fields

**Responsible Layer**: BOTH
- **Client**: Registration forms, Google OAuth flow, profile completion UI
- **Server**: User creation, validation, OAuth integration

**APIs**:
- `POST /api/users` - Create new user account
- `GET /api/users/by-email/:email` - Check if user exists
- `GET /api/users/by-register/:registerNumber` - Validate register number uniqueness
- `GET /api/users/by-staff/:staffId` - Validate staff ID uniqueness
- `PUT /api/users/:id` - Update user profile
- `PUT /api/users/:id/location` - Set user's selected location
- `GET /api/locations/:type` - Fetch colleges/organizations/restaurants
- `GET /api/auth/google` - Google OAuth endpoints (googleAuth.ts router)
- `POST /api/auth/register` - Email/password registration (auth.ts router)
- `POST /api/auth/login` - Email/password login (auth.ts router)

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: User (Prisma)
- **MongoDB**: SystemSettings (for location lists)

**Roles Allowed**: ALL (unauthenticated users can register)

**Android Native**: 
- **Google OAuth**: REQUIRED (Android Google Sign-In SDK)
- **Email/Password**: NOT_NEEDED (web forms sufficient)
- **Location Selection**: NOT_NEEDED

---

### 1.2 User Session Management

**Description**: Validate user sessions, detect deleted users, refresh user data

**Responsible Layer**: BOTH
- **Client**: localStorage session persistence, session validation on app launch
- **Server**: Session validation against database

**APIs**:
- `GET /api/users/:id/validate` - Validate user session and get current user data
- `GET /api/users/:id` - Fetch user details

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: User (Prisma)

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED (session management via HTTP)

---

### 1.3 User Administration

**Description**: Admin panel user management - create, update, delete users, block/unblock, role assignment

**Responsible Layer**: BOTH
- **Client**: Admin user management UI
- **Server**: User CRUD operations with super_admin protection

**APIs**:
- `GET /api/users` - Fetch all users
- `GET /api/users/paginated` - Fetch users with pagination and filtering
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (role changes, profile edits)
- `PATCH /api/users/:id` - Update user email
- `DELETE /api/users/:id` - Delete user (super_admin cannot be deleted)
- `DELETE /api/users/all` - Delete all users (development only)
- `PUT /api/users/:id/block` - Block user
- `PUT /api/users/:id/unblock` - Unblock user
- `GET /api/users/:id/orders` - Fetch user's order history
- `GET /api/users/:id/payments` - Fetch user's payment history
- `GET /api/users/:id/complaints` - Fetch user's complaints

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: User (Prisma)
- **MongoDB**: Order, Payment, Complaint

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED (admin panel is web-based)

---

### 1.4 Temporary Guest Sessions

**Description**: Allow guest users to browse and order without creating permanent accounts

**Responsible Layer**: CLIENT
- **Client**: Creates temp session in localStorage with role='guest'
- **Server**: None (temp sessions not persisted)

**APIs**: NONE (client-side only)

**Socket Events**: NONE

**Data Models**: 
- **Client localStorage**: temp_user_session

**Roles Allowed**: ALL (unauthenticated users)

**Android Native**: NOT_NEEDED (localStorage equivalent)

---

## MODULE 2: MENU MANAGEMENT

### 2.1 Menu Browsing

**Description**: Browse menu items by canteen, filter by category, search by name/description, vegetarian filtering

**Responsible Layer**: BOTH
- **Client**: Menu display, filtering UI, search interface
- **Server**: Optimized menu queries with server-side filtering

**APIs**:
- `GET /api/menu` - Fetch menu items with pagination and filtering
  - Query params: `canteenId`, `search`, `category`, `stockFilter`, `vegOnly`, `availableOnly`, `page`, `limit`, `sortBy`, `sortOrder`, `excludeIds`, `itemIds`
- `GET /api/menu/:id` - Fetch single menu item details
- `GET /api/categories` - Fetch categories with pagination and filtering
  - Query params: `canteenId`, `page`, `limit`, `search`, `sortBy`, `sortOrder`

**Socket Events**:
- **Receive**: `orderUpdate` with type `menu_updated` (menu changes broadcast)

**Data Models**:
- **MongoDB**: MenuItem, Category

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED (standard HTTP + image loading)

---

### 2.2 Menu Item Management (Admin/Owner)

**Description**: Create, update, delete menu items and categories, upload images, manage stock

**Responsible Layer**: BOTH
- **Client**: Menu management UI for admins/owners
- **Server**: Menu CRUD operations, image upload to Cloudinary

**APIs**:
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item (price, stock, availability, counter IDs)
- `DELETE /api/menu/:id` - Delete menu item
- `POST /api/menu/:id/image` - Upload menu item image (multer → Cloudinary)
- `DELETE /api/menu/:id/image` - Delete menu item image
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/:id/image` - Upload category image
- `DELETE /api/categories/:id/image` - Delete category image

**Socket Events**:
- **Emit**: Broadcasts `orderUpdate` with type `menu_updated` after changes

**Data Models**:
- **MongoDB**: MenuItem, Category
- **Cloudinary**: Image storage (CDN)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: 
- **Image Upload**: REQUIRED (Camera + Gallery access)
- **Image Compression**: OPTIONAL (server compresses to 20KB anyway)

---

### 2.3 Stock Management

**Description**: Real-time stock tracking, low-stock alerts, out-of-stock handling, atomic stock updates

**Responsible Layer**: BOTH
- **Client**: Stock display, low-stock indicators
- **Server**: Atomic stock deduction during order placement, stock service with MongoDB transactions (when supported)

**APIs**:
- `PUT /api/menu/:id` - Update menu item stock
- Stock updates happen automatically during order creation via `stockService.validateAndPrepareStockUpdates()`

**Socket Events**: NONE (stock updates trigger menu updates)

**Data Models**:
- **MongoDB**: MenuItem (stock field)

**Roles Allowed**: 
- **View**: ALL authenticated users
- **Update**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

### 2.4 Home Screen Content Curation

**Description**: Featured content on home screen - media banners, trending items, quick picks

**Responsible Layer**: BOTH
- **Client**: Home screen displays curated content
- **Server**: Batch API for optimized home data fetching

**APIs**:
- `GET /api/home-data` - Batch endpoint fetching media banners, trending items, quick picks, active orders
  - Query params: `canteenId`, `userId`
- `GET /api/media-banners` - Fetch media banners separately (if needed)

**Socket Events**:
- **Receive**: `orderUpdate` with type `banner_updated` (banner changes)

**Data Models**:
- **MongoDB**: MediaBanner, MenuItem (isTrending, isQuickPick flags)

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED (standard image loading)

---

### 2.5 Category Management

**Description**: Organize menu items into categories, category icons, category images

**Responsible Layer**: BOTH
- **Client**: Category selection UI
- **Server**: Category CRUD, compound unique index (name + canteenId)

**APIs**:
- `GET /api/categories` - Fetch categories with server-side filtering
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/:id/image` - Upload category image (10KB target)
- `DELETE /api/categories/:id/image` - Remove category image

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Category (compound index on name + canteenId)

**Roles Allowed**: 
- **View**: ALL authenticated users
- **Manage**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

## MODULE 3: ORDER MANAGEMENT

### 3.1 Order Placement

**Description**: Place food orders, cart management, counter ID assignment, order number generation

**Responsible Layer**: BOTH
- **Client**: Shopping cart, checkout flow
- **Server**: Order creation, stock validation, barcode generation

**APIs**:
- `POST /api/orders` - Create order
  - Validates stock availability
  - Deducts stock atomically
  - Generates 12-digit order number
  - Generates unique barcode
  - Assigns counter IDs from menu items
  - Creates payment record

**Socket Events**:
- **Emit**: Broadcasts `orderUpdate` with type `new_order` to canteen room
- **Emit**: Broadcasts to specific counter rooms via `broadcastToCounter()`

**Data Models**:
- **MongoDB**: Order, MenuItem (stock deduction), Payment
- **PostgreSQL**: User (customerId reference)

**Roles Allowed**: ALL authenticated users (student, staff, employee, guest, contractor, visitor)

**Android Native**: NOT_NEEDED

---

### 3.2 Order Tracking

**Description**: Real-time order status updates, order history, active orders

**Responsible Layer**: BOTH
- **Client**: Order status UI, order history list
- **Server**: Order status management, WebSocket broadcasts

**APIs**:
- `GET /api/orders` - Fetch orders with filtering (canteenId, counterId, isOffline, paymentStatus)
- `GET /api/orders/paginated` - Fetch orders with pagination
- `GET /api/orders/:id` - Fetch single order details
- `GET /api/orders/by-order-number/:orderNumber` - Fetch order by number
- `GET /api/orders/user/:userId/active` - Fetch user's active orders
- `GET /api/orders/user/:userId/history` - Fetch user's order history
- `GET /api/orders/canteen/:canteenId` - Fetch canteen's orders
- `GET /api/orders/counter/:counterId` - Fetch counter-specific orders

**Socket Events**:
- **Emit**: `orderUpdate` with type `order_status_changed` (status updates)
- **Emit**: `orderUpdate` with type `order_updated` (order modifications)
- **Receive**: Client listens to canteen room for real-time updates

**Data Models**:
- **MongoDB**: Order

**Roles Allowed**: 
- **Own Orders**: ALL authenticated users
- **All Orders**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: 
- **Push Notifications**: REQUIRED (Firebase Cloud Messaging for order status updates)

---

### 3.3 Order Status Management (Staff/Owner)

**Description**: Update order status (preparing → ready → delivered), mark items as ready, payment confirmation

**Responsible Layer**: BOTH
- **Client**: Order management interface for staff
- **Server**: Order status updates, WebSocket broadcasts, push notifications

**APIs**:
- `PUT /api/orders/:id` - Update order (status, itemStatusByCounter)
- `PATCH /api/orders/:id` - Partial order update
- `PATCH /api/orders/:id/status` - Update order status with old/new status tracking
- `PATCH /api/orders/:id/mark-seen` - Mark order as seen by staff

**Socket Events**:
- **Emit**: `orderUpdate` with type `order_status_changed` to canteen room
- **Emit**: Broadcasts to counter rooms via `broadcastToCounter()`
- **Emit**: Push notification to customer via `webPushService.sendOrderUpdate()`

**Data Models**:
- **MongoDB**: Order (status, itemStatusByCounter, seenBy)
- **PostgreSQL**: User (for push notification subscriptions)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED (WebSocket + push notifications sufficient)

---

### 3.4 Order Deletion (Development Only)

**Description**: Delete orders in development mode for testing

**Responsible Layer**: SERVER
- **Server**: Order deletion (only in NODE_ENV=development)

**APIs**:
- `DELETE /api/orders/:id` - Delete order (development mode only)

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Order

**Roles Allowed**: `admin`, `super_admin` (development mode only)

**Android Native**: NOT_NEEDED

---

### 3.5 Multi-Counter Order Distribution

**Description**: Distribute orders across multiple counters (store, payment, KOT), track item status per counter

**Responsible Layer**: BOTH
- **Client**: Counter interface displays counter-specific orders
- **Server**: Counter ID assignment, counter-based filtering, item status tracking

**APIs**:
- `GET /api/orders` - Filter by `counterId`
- `GET /api/orders/counter/:counterId` - Fetch counter-specific orders
- Order creation assigns: `storeCounterId`, `paymentCounterId`, `kotCounterId`, `allStoreCounterIds`, `allPaymentCounterIds`, `allKotCounterIds`

**Socket Events**:
- **Emit**: Broadcasts to specific counter rooms: `counter_${counterId}`
- **Receive**: Counter clients join room via `joinCounterRoom` event

**Data Models**:
- **MongoDB**: Order (counter ID fields, itemStatusByCounter)
- **MongoDB**: MenuItem (counter ID fields)

**Roles Allowed**: `canteen_owner`

**Android Native**: NOT_NEEDED

---

## MODULE 4: PAYMENT PROCESSING

### 4.1 Online Payment (Razorpay)

**Description**: Razorpay integration for online orders - order creation, payment verification, webhook handling

**Responsible Layer**: BOTH
- **Client**: Razorpay checkout UI, payment callback handling
- **Server**: Razorpay order creation, payment verification, webhook processing

**APIs**:
- `POST /api/payments/initiate` - Initiate Razorpay payment
  - Creates Razorpay order
  - Validates checkout session
  - Prevents duplicate payments
  - Stores payment record
- `POST /api/payments/verify` - Verify Razorpay payment signature
- `GET /api/payments/status/:merchantTransactionId` - Check payment status
- `POST /api/razorpay/webhook` - Razorpay webhook for payment events
- `GET /api/payments` - Fetch payment records

**Socket Events**:
- **Emit**: `orderUpdate` with type `payment_success` (successful payment)

**Data Models**:
- **MongoDB**: Payment, Order (paymentStatus, paymentId)
- **MongoDB**: CheckoutSession (payment tracking)

**Roles Allowed**: ALL authenticated users

**Android Native**: 
- **Razorpay SDK**: REQUIRED (Razorpay Android SDK for native payment flow)
- **UPI Intent**: OPTIONAL (for UPI app redirection)

---

### 4.2 POS/Counter Payments

**Description**: Counter-based payment for walk-in customers - QR code generation, offline payment confirmation

**Responsible Layer**: BOTH
- **Client**: POS interface with payment confirmation
- **Server**: Razorpay QR code generation, offline payment handling

**APIs**:
- `POST /api/pos/payments/initiate` - Initiate POS payment
  - Creates Razorpay order
  - Generates UPI QR code URL
  - Validates checkout session
- `POST /api/razorpay/qr/create` - Create Razorpay QR code
- `GET /api/razorpay/qr/:qrId` - Fetch QR code details
- `GET /api/razorpay/qr/:qrId/payments` - Fetch QR code payments
- `POST /api/razorpay/qr/:qrId/close` - Close QR code

**Socket Events**:
- **Emit**: Broadcasts payment confirmation to counter room

**Data Models**:
- **MongoDB**: Payment, Order (qrId, paymentStatus)

**Roles Allowed**: `canteen_owner`

**Android Native**: 
- **QR Code Display**: REQUIRED (ZXing or similar for QR display)
- **QR Code Scanning**: OPTIONAL (if owner needs to scan customer QR)

---

### 4.3 Checkout Session Management

**Description**: Prevent duplicate payments, session expiration, checkout locking

**Responsible Layer**: SERVER
- **Server**: CheckoutSessionService manages session lifecycle

**APIs**:
- Checkout sessions created automatically during payment initiation
- `POST /api/checkout-sessions` - Create checkout session
- `GET /api/checkout-sessions/:id` - Fetch session details
- `PUT /api/checkout-sessions/:id` - Update session status
- Session cleanup runs every 5 minutes (automatic)

**Socket Events**:
- **Emit**: `orderUpdate` with type `checkout_session_status_changed` (session status updates)

**Data Models**:
- **MongoDB**: CheckoutSession (in-memory via MongoDB or Redis if available)

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED

---

### 4.4 Payment Job Queue (Redis-based)

**Description**: Asynchronous payment processing for high load, job queue with BullMQ

**Responsible Layer**: SERVER
- **Server**: Payment queue (requires Redis), falls back to direct processing if unavailable

**APIs**:
- `POST /api/payments/initiate` - Uses queue if Redis available
- `GET /api/payments/job-status/:jobId` - Poll job status (for async processing)

**Socket Events**: NONE

**Data Models**:
- **Redis**: Job queue (BullMQ)
- **MongoDB**: Payment

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED

---

### 4.5 Payment Analytics

**Description**: Payment history, revenue tracking, payment status reports

**Responsible Layer**: BOTH
- **Client**: Payment analytics dashboard
- **Server**: Payment aggregation queries

**APIs**:
- `GET /api/payments` - Fetch payment records with filtering
- `GET /api/payments/:merchantTransactionId` - Fetch payment details
- `GET /api/users/:id/payments` - Fetch user's payment history
- `GET /api/admin/analytics` - Admin analytics (includes revenue)

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Payment, Order

**Roles Allowed**: 
- **Own Payments**: ALL authenticated users
- **All Payments**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED

---

## MODULE 5: REAL-TIME COMMUNICATION

### 5.1 WebSocket Connection Management

**Description**: Socket.IO connection, room-based architecture, connection health monitoring

**Responsible Layer**: BOTH
- **Client**: Socket.IO client, room joining, connection lifecycle
- **Server**: WebSocket server with room management

**APIs**:
- `GET /api/websocket/status` - Get WebSocket server status and stats

**Socket Events**:
- **Emit**: `joinCanteenRooms` - Join canteen-specific rooms
- **Emit**: `leaveCanteenRooms` - Leave canteen rooms
- **Emit**: `joinCounterRoom` - Join counter-specific room
- **Emit**: `leaveCounterRoom` - Leave counter room
- **Emit**: `joinDeliveryPersonRoom` - Join delivery person room
- **Emit**: `leaveDeliveryPersonRoom` - Leave delivery person room
- **Emit**: `ping` - Connection health check
- **Receive**: `roomJoined` - Room join confirmation
- **Receive**: `counterRoomJoined` - Counter room join confirmation
- **Receive**: `deliveryPersonRoomJoined` - Delivery room join confirmation
- **Receive**: `pong` - Connection health response
- **Receive**: `error` - WebSocket errors

**Data Models**: NONE (in-memory tracking)

**Roles Allowed**: ALL authenticated users

**Android Native**: 
- **Socket.IO**: REQUIRED (Socket.IO Android client library)

---

### 5.2 Order Real-Time Updates

**Description**: Broadcast order status changes, new orders, order modifications to connected clients

**Responsible Layer**: BOTH
- **Client**: Listens to `orderUpdate` events
- **Server**: Broadcasts to canteen/counter rooms

**Socket Events**:
- **Receive**: `orderUpdate` with types:
  - `new_order` - New order placed
  - `order_status_changed` - Order status updated
  - `order_updated` - Order modified
  - `payment_success` - Payment successful

**Data Models**: NONE (event-based)

**Roles Allowed**: ALL authenticated users (room-based filtering)

**Android Native**: 
- **Background Service**: OPTIONAL (to maintain WebSocket connection when app backgrounded)

---

### 5.3 Menu Real-Time Updates

**Description**: Broadcast menu changes, banner updates to all connected clients

**Responsible Layer**: BOTH
- **Client**: Listens to `orderUpdate` events (menu/banner updates)
- **Server**: Broadcasts menu changes globally or to canteen room

**Socket Events**:
- **Receive**: `orderUpdate` with types:
  - `menu_updated` - Menu item changed
  - `banner_updated` - Media banner changed

**Data Models**: NONE (event-based)

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED

---

### 5.4 Delivery Person Real-Time Assignment

**Description**: Notify delivery persons of new order assignments via dedicated rooms

**Responsible Layer**: BOTH
- **Client**: Delivery person app listens to personal room
- **Server**: Broadcasts to `delivery_person_${email}` room

**Socket Events**:
- **Emit**: `joinDeliveryPersonRoom` - Join personal delivery room
- **Receive**: `deliveryAssignment` - New order assigned

**Data Models**: NONE (event-based)

**Roles Allowed**: `delivery_person`

**Android Native**: 
- **Foreground Service**: REQUIRED (to keep WebSocket alive for delivery assignments)

---

## MODULE 6: BARCODE & ORDER VERIFICATION

### 6.1 Barcode Generation

**Description**: Generate unique barcodes for orders, 12-digit order numbers, 4-digit OTP extraction

**Responsible Layer**: SERVER
- **Server**: Barcode generation during order creation

**APIs**:
- Barcode generated automatically in `POST /api/orders`
- Format: `ORD${orderNumber}` (16 chars total)
- 4-digit OTP: First 4 digits of order number

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Order (barcode, orderNumber)

**Roles Allowed**: Automatic (system-generated)

**Android Native**: 
- **Barcode Display**: OPTIONAL (if order confirmation screen shows barcode)

---

### 6.2 Barcode Scanning & Verification

**Description**: Scan barcodes to verify order pickup, mark orders as delivered, prevent duplicate scanning

**Responsible Layer**: BOTH
- **Client**: Barcode scanner interface
- **Server**: Barcode validation, order status update

**APIs**:
- `POST /api/delivery/scan` - Scan barcode and mark order as delivered
  - Validates barcode exists
  - Checks if barcode already used
  - Checks order status is "ready"
  - Updates status to "delivered"
  - Marks barcode as used
- `GET /api/delivery/verify/:barcode` - Verify barcode without marking delivered

**Socket Events**:
- **Emit**: Broadcasts order status change (delivered) to canteen room

**Data Models**:
- **MongoDB**: Order (barcode, barcodeUsed, deliveredAt)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`, `delivery_person`

**Android Native**: 
- **Barcode Scanner**: REQUIRED (CameraX + ML Kit Barcode Scanning for camera-based scanning)
- **Camera Permission**: REQUIRED

---

### 6.3 Order Public Tracking (No Auth)

**Description**: Track order status via barcode/order number without authentication

**Responsible Layer**: BOTH
- **Client**: Public order tracking page
- **Server**: Order lookup by barcode/order number

**APIs**:
- `GET /api/orders/by-barcode/:barcode` - Fetch order by barcode (no auth)
- `GET /api/orders/by-order-number/:orderNumber` - Fetch order by number (no auth)

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Order

**Roles Allowed**: ALL (including unauthenticated)

**Android Native**: NOT_NEEDED

---

## MODULE 7: MEDIA MANAGEMENT

### 7.1 Media Banner Upload & Management

**Description**: Upload promotional banners (images/videos), reorder, toggle active status, Cloudinary storage

**Responsible Layer**: BOTH
- **Client**: Banner management UI
- **Server**: Multer file upload → Cloudinary storage, GridFS legacy support

**APIs**:
- `POST /api/media-banners` - Upload banner (50MB limit)
  - Accepts multipart/form-data with `file` field
  - Uploads to Cloudinary
  - Stores metadata in MongoDB
- `GET /api/media-banners` - Fetch all banners (admin flag for inactive banners)
- `GET /api/media-banners/:fileId/file` - Serve banner file (redirect to Cloudinary URL)
- `PATCH /api/media-banners/:id` - Update banner metadata
- `PATCH /api/media-banners/:id/toggle` - Toggle banner active status
- `DELETE /api/media-banners/:id` - Delete banner
- `POST /api/media-banners/reorder` - Reorder banners by displayOrder

**Socket Events**:
- **Emit**: Broadcasts `orderUpdate` with type `banner_updated` (banner changes)

**Data Models**:
- **MongoDB**: MediaBanner (cloudinaryUrl, fileId, displayOrder)
- **Cloudinary**: Media storage (images + videos)

**Roles Allowed**: 
- **View**: ALL authenticated users
- **Manage**: `admin`, `super_admin`

**Android Native**: 
- **Video Upload**: OPTIONAL (if banners support video)
- **Camera Access**: OPTIONAL (if capturing banner photos)
- **Gallery Access**: OPTIONAL (if selecting from gallery)

---

### 7.2 Menu Item Image Upload

**Description**: Upload menu item images (100KB limit), automatic compression to 20KB

**Responsible Layer**: BOTH
- **Client**: Image picker for menu items
- **Server**: Multer upload → Cloudinary with Sharp compression

**APIs**:
- `POST /api/menu/:id/image` - Upload menu item image
  - 100KB size limit at upload
  - Server compresses to 20KB target
  - Uploads to Cloudinary
- `DELETE /api/menu/:id/image` - Delete menu item image
- `GET /api/test-cloudinary` - Test Cloudinary configuration

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: MenuItem (imageUrl, imagePublicId)
- **Cloudinary**: Image storage

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: 
- **Camera Access**: REQUIRED (for taking food photos)
- **Gallery Access**: REQUIRED (for selecting existing photos)
- **Image Compression**: OPTIONAL (server compresses anyway)

---

### 7.3 Category Image Upload

**Description**: Upload category icons/images (100KB limit), automatic compression to 10KB

**Responsible Layer**: BOTH
- **Client**: Category image picker
- **Server**: Multer upload → Cloudinary with Sharp compression

**APIs**:
- `POST /api/categories/:id/image` - Upload category image (10KB target)
- `DELETE /api/categories/:id/image` - Delete category image

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Category (imageUrl, imagePublicId)
- **Cloudinary**: Image storage

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: 
- **Camera Access**: OPTIONAL
- **Gallery Access**: OPTIONAL

---

## MODULE 8: PUSH NOTIFICATIONS

### 8.1 Web Push Subscription Management

**Description**: Subscribe to push notifications, manage subscriptions, VAPID key-based authentication

**Responsible Layer**: BOTH
- **Client**: Service Worker push subscription
- **Server**: Web Push service (webPushService.ts)

**APIs**:
- `POST /api/push/subscribe` - Subscribe to push notifications
  - Stores subscription in database
  - Associates with user ID
- `POST /api/push/unsubscribe` - Unsubscribe from notifications
- `GET /api/push/vapid-public-key` - Get VAPID public key for subscription

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: PushSubscription (endpoint, keys, userId)

**Roles Allowed**: ALL authenticated users

**Android Native**: 
- **Firebase Cloud Messaging (FCM)**: REQUIRED (replaces Web Push for Android)
- **Notification Permission**: REQUIRED

---

### 8.2 Order Status Notifications

**Description**: Push notifications for order status changes (preparing, ready, delivered)

**Responsible Layer**: SERVER
- **Server**: Triggers push notifications on order status changes

**APIs**:
- Push sent automatically via `webPushService.sendOrderUpdate()` when order status changes
- Triggered by: `PUT /api/orders/:id`, `PATCH /api/orders/:id`, `POST /api/delivery/scan`

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: PushSubscription (to find user's subscriptions)
- **MongoDB**: Order (status triggers notification)

**Roles Allowed**: ALL authenticated users (receive notifications for own orders)

**Android Native**: 
- **FCM**: REQUIRED (notification delivery)
- **Notification Channels**: REQUIRED (Android 8.0+)

---

### 8.3 Custom Push Notifications (Admin)

**Description**: Admin panel to send custom push notifications to users/groups

**Responsible Layer**: BOTH
- **Client**: Admin notification composer
- **Server**: Web Push service bulk send

**APIs**:
- `POST /api/push/send` - Send custom push notification
  - Accepts: title, body, userId (single user)
- `POST /api/push/send-bulk` - Send to multiple users/roles

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: PushSubscription
- **PostgreSQL**: User (for targeting)

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: 
- **FCM**: REQUIRED (notification delivery)

---

## MODULE 9: SYSTEM SETTINGS & CONFIGURATION

### 9.1 System Settings Management

**Description**: Configure canteens, colleges, organizations, system-wide settings

**Responsible Layer**: BOTH
- **Client**: Admin system settings UI
- **Server**: SystemSettings CRUD (systemSettings.ts router)

**APIs**:
- `GET /api/system-settings` - Fetch all system settings
- `PUT /api/system-settings` - Update system settings
- `GET /api/system-settings/canteens` - Fetch canteen list
- `POST /api/system-settings/canteens` - Add canteen
- `PUT /api/system-settings/canteens/:id` - Update canteen
- `DELETE /api/system-settings/canteens/:id` - Delete canteen
- `GET /api/system-settings/canteens/by-owner/:email` - Get canteen by owner email
- Similar endpoints for: colleges, organizations, restaurants

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: SystemSettings (canteens, colleges, organizations, restaurants)

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED (admin panel web-based)

---

### 9.2 Canteen Settings (Owner)

**Description**: Per-canteen configuration - tax rate, charges, favorite counter

**Responsible Layer**: BOTH
- **Client**: Canteen owner settings UI
- **Server**: CanteenSettings management

**APIs**:
- `GET /api/canteens/:canteenId/settings` - Fetch canteen settings
  - Returns taxRate (default 5%), taxName (default "GST"), favoriteCounterId
- `PUT /api/canteens/:canteenId/settings` - Update canteen settings

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: CanteenSettings (taxRate, taxName, favoriteCounterId)

**Roles Allowed**: `canteen_owner`

**Android Native**: NOT_NEEDED

---

### 9.3 Checkout Charges Management

**Description**: Configure per-canteen charges (delivery fee, packaging, service charge)

**Responsible Layer**: BOTH
- **Client**: Charges management UI
- **Server**: CanteenCharge CRUD

**APIs**:
- `GET /api/canteens/:canteenId/charges` - Fetch all charges for canteen
- `POST /api/canteens/:canteenId/charges` - Create charge (name, type: percent/fixed, value, active)
- `PUT /api/canteen-charges/:id` - Update charge
- `DELETE /api/canteen-charges/:id` - Delete charge

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: CanteenCharge (canteenId, name, type, value, active)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

## MODULE 10: ANALYTICS & REPORTING

### 10.1 Admin Dashboard Analytics

**Description**: System-wide analytics - total revenue, orders, users, pending orders

**Responsible Layer**: BOTH
- **Client**: Admin dashboard charts
- **Server**: Aggregation queries across collections

**APIs**:
- `GET /api/admin/dashboard-stats` - Dashboard overview stats
  - Returns: totalRevenue, totalUsers, totalOrders, pendingOrders, completedOrders, recentOrders (last 5)
- `GET /api/admin/analytics` - Detailed analytics
  - Returns: totalOrders, totalRevenue, activeMenuItems, averageOrderValue

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Order, MenuItem
- **PostgreSQL**: User

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED (web-based dashboard)

---

### 10.2 Menu Analytics

**Description**: Per-canteen menu analytics - total items, active, out-of-stock, low stock

**Responsible Layer**: BOTH
- **Client**: Menu analytics UI for owner
- **Server**: Optimized menu item aggregation

**APIs**:
- `GET /api/canteens/:canteenId/menu-analytics` - Menu stats
  - Returns: totalItems, activeItems, outOfStockItems, lowStockItems (≤5)

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: MenuItem (available, stock)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

### 10.3 Order Analytics (Paginated)

**Description**: Advanced order filtering, pagination, date ranges, status filtering

**Responsible Layer**: BOTH
- **Client**: Order history with filters
- **Server**: Paginated order queries with complex filtering

**APIs**:
- `GET /api/orders/paginated` - Fetch orders with pagination
  - Query params: `page`, `limit`, `canteenId`, `isCounterOrder`, `status`, `paymentStatus`, `dateFrom`, `dateTo`, `search`
  - Returns: items, total, currentPage, totalPages, filters

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Order (indexed on status, createdAt, canteenId)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

## MODULE 11: DELIVERY MANAGEMENT

### 11.1 Delivery Person Management

**Description**: Manage delivery persons, assign to canteens, track availability

**Responsible Layer**: BOTH
- **Client**: Delivery person admin UI
- **Server**: DeliveryPerson CRUD (PostgreSQL via Prisma)

**APIs**:
- `POST /api/delivery-persons` - Create delivery person
  - Creates DeliveryPerson record
  - Creates User account with role='delivery_person'
  - Hashes password (bcrypt, 10 rounds)
- `GET /api/delivery-persons` - Fetch all delivery persons
- `GET /api/delivery-persons/:id` - Fetch delivery person by ID
- `GET /api/delivery-persons/by-email/:email` - Fetch by email
- `GET /api/delivery-persons/active` - Fetch active delivery persons
- `PUT /api/delivery-persons/:id` - Update delivery person
- `PATCH /api/delivery-persons/:id/availability` - Toggle availability
- `DELETE /api/delivery-persons/:id` - Delete delivery person

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: DeliveryPerson (id, deliveryPersonId, canteenId, name, phoneNumber, email, isActive, isAvailable, totalOrderDelivered)
- **PostgreSQL**: User (for login credentials)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED (admin UI)

---

### 11.2 Order Assignment to Delivery Person

**Description**: Assign orders to delivery persons, track delivery status

**Responsible Layer**: BOTH
- **Client**: Order assignment UI
- **Server**: Order update with delivery person assignment

**APIs**:
- `PUT /api/orders/:id` - Assign delivery person to order
  - Updates: deliveryPersonId, orderType='delivery'
  - Marks delivery person as unavailable
- `PATCH /api/orders/:id/status` - Update order status (triggers availability update)
  - When status becomes 'delivered', marks delivery person as available

**Socket Events**:
- **Emit**: Broadcasts to `delivery_person_${email}` room via `broadcastToDeliveryPerson()`

**Data Models**:
- **MongoDB**: Order (deliveryPersonId, orderType, deliveryAddress)
- **PostgreSQL**: DeliveryPerson (isAvailable)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: 
- **Location Services**: OPTIONAL (for delivery tracking)
- **Maps**: OPTIONAL (Google Maps for delivery navigation)

---

### 11.3 Delivery Person Portal

**Description**: Delivery person mobile app - view assigned orders, mark as delivered

**Responsible Layer**: BOTH
- **Client**: Delivery person app
- **Server**: Delivery-specific order queries

**APIs**:
- `GET /api/orders/delivery-person/:deliveryPersonId` - Fetch assigned orders
- `GET /api/delivery-persons/by-email/:email` - Fetch delivery person details
- `PUT /api/orders/:id` - Mark order as delivered
- `POST /api/delivery/scan` - Scan barcode to confirm delivery

**Socket Events**:
- **Emit**: `joinDeliveryPersonRoom` - Join personal delivery room
- **Receive**: `deliveryAssignment` - New order assigned

**Data Models**:
- **MongoDB**: Order (deliveryPersonId, orderType)
- **PostgreSQL**: DeliveryPerson

**Roles Allowed**: `delivery_person`

**Android Native**: 
- **Foreground Service**: REQUIRED (maintain WebSocket connection)
- **Barcode Scanner**: REQUIRED (scan customer barcodes)
- **Location Services**: OPTIONAL (delivery tracking)
- **Maps**: OPTIONAL (navigation)

---

## MODULE 12: AUTHENTICATION & AUTHORIZATION

### 12.1 Google OAuth Authentication

**Description**: Google Sign-In for users, OAuth token validation, user creation from Google profile

**Responsible Layer**: BOTH
- **Client**: Google Sign-In button, OAuth flow
- **Server**: Google OAuth routes (googleAuth.ts)

**APIs**:
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler
- `POST /api/auth/google/verify` - Verify Google ID token

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: User (email from Google profile)

**Roles Allowed**: ALL (unauthenticated users)

**Android Native**: 
- **Google Sign-In SDK**: REQUIRED (Android Google Sign-In)

---

### 12.2 Email/Password Authentication

**Description**: Email/password registration and login with bcrypt hashing

**Responsible Layer**: BOTH
- **Client**: Login/registration forms
- **Server**: Password hashing (bcrypt, 10 rounds), validation

**APIs**:
- `POST /api/auth/register` - Register with email/password
  - Validates email uniqueness
  - Hashes password (bcrypt)
  - Creates user with isProfileComplete=false
- `POST /api/auth/login` - Login with email/password
  - Verifies password hash
  - Returns user data + token
- `POST /api/auth/logout` - Logout (session cleanup)

**Socket Events**: NONE

**Data Models**:
- **PostgreSQL**: User (email, passwordHash)

**Roles Allowed**: ALL (unauthenticated users)

**Android Native**: NOT_NEEDED (standard form fields)

---

### 12.3 Session Management

**Description**: Express session management, session persistence, session validation

**Responsible Layer**: SERVER
- **Server**: express-session with memory store (or Redis if available)

**APIs**:
- Sessions managed automatically via express-session middleware
- `GET /api/users/:id/validate` - Validate session (check if user still exists)

**Socket Events**: NONE

**Data Models**:
- **Server Memory**: Session store (or Redis)

**Roles Allowed**: ALL authenticated users

**Android Native**: NOT_NEEDED (token-based auth sufficient)

---

## MODULE 13: HEALTH & DIAGNOSTICS

### 13.1 Health Checks

**Description**: Server health monitoring, database connectivity checks, schema validation

**Responsible Layer**: SERVER
- **Server**: Health check endpoints

**APIs**:
- `GET /api/health` - Comprehensive health check
  - Returns: PostgreSQL status, MongoDB status, server uptime, environment
- `GET /api/health/redis` - Redis health check (if Redis enabled)
- `GET /api/status` - Simple status check (returns `ok`)
- `GET /api/server-info` - Server info (startTime, uptime, version)

**Socket Events**: NONE

**Data Models**: NONE

**Roles Allowed**: ALL (no auth required)

**Android Native**: NOT_NEEDED

---

### 13.2 Database Diagnostics

**Description**: Schema validation, MongoDB transaction support detection, migration status

**Responsible Layer**: SERVER
- **Server**: Diagnostic endpoints for troubleshooting

**APIs**:
- `GET /api/schema-status` - Database schema health
  - Validates schema consistency
- `GET /api/mongodb-diagnostics` - MongoDB diagnostics
  - Returns: MongoDB version, transaction support, replica set status
- `GET /api/websocket/status` - WebSocket connection stats

**Socket Events**: NONE

**Data Models**: NONE

**Roles Allowed**: `admin`, `super_admin` (should be protected)

**Android Native**: NOT_NEEDED

---

## MODULE 14: COMPLAINT MANAGEMENT

### 14.1 Complaint Submission

**Description**: Submit complaints about orders, food quality, service issues

**Responsible Layer**: BOTH
- **Client**: Complaint form
- **Server**: Complaint storage and tracking

**APIs**:
- `POST /api/complaints` - Submit complaint
  - Fields: orderId, userId, complaintType, description, canteenId
- `GET /api/complaints` - Fetch all complaints (admin)
- `GET /api/complaints/:id` - Fetch complaint by ID
- `GET /api/users/:id/complaints` - Fetch user's complaints

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Complaint (orderId, userId, complaintType, description, status, resolution)

**Roles Allowed**: 
- **Submit**: ALL authenticated users
- **View All**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

### 14.2 Complaint Resolution (Admin)

**Description**: Admin/owner review and resolve complaints

**Responsible Layer**: BOTH
- **Client**: Complaint management UI
- **Server**: Complaint status updates

**APIs**:
- `PATCH /api/complaints/:id` - Update complaint (status, resolution, adminNotes)
- `DELETE /api/complaints/:id` - Delete complaint

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Complaint (status: pending/resolved/rejected)

**Roles Allowed**: `admin`, `super_admin`, `canteen_owner`

**Android Native**: NOT_NEEDED

---

## MODULE 15: LOGIN ISSUE TRACKING

### 15.1 Login Issue Reporting

**Description**: Track login failures, OAuth errors, authentication issues for debugging

**Responsible Layer**: BOTH
- **Client**: Automatic login issue reporting
- **Server**: Login issue storage

**APIs**:
- `POST /api/login-issues` - Report login issue
  - Fields: userEmail, issueType, description, deviceInfo, browserInfo
- `GET /api/login-issues` - Fetch all login issues (admin)
- `GET /api/login-issues/:id` - Fetch login issue by ID

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: LoginIssue (userEmail, issueType, description, status, resolvedAt, resolvedBy, adminNotes)

**Roles Allowed**: 
- **Report**: ALL (no auth required)
- **View**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED

---

### 15.2 Login Issue Management (Admin)

**Description**: Admin panel to review and resolve login issues

**Responsible Layer**: BOTH
- **Client**: Admin login issue dashboard
- **Server**: Login issue status updates

**APIs**:
- `PATCH /api/login-issues/:id` - Update login issue (status, adminNotes, resolvedBy)
- `DELETE /api/login-issues/:id` - Delete login issue

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: LoginIssue

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED

---

## MODULE 16: CODING CHALLENGES (GAMIFICATION)

### 16.1 Coding Challenge System

**Description**: Gamification feature - daily coding challenges, leaderboard, rewards

**Responsible Layer**: BOTH
- **Client**: Coding challenge UI, leaderboard
- **Server**: Challenge management, submission validation

**APIs**:
- `GET /api/coding-challenges` - Fetch active challenges
- `GET /api/coding-challenges/:id` - Fetch challenge details
- `POST /api/coding-challenges/:id/submit` - Submit challenge solution
- `GET /api/coding-challenges/leaderboard` - Fetch leaderboard

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: CodingChallenge (title, description, difficulty, testCases, submissions, leaderboard)

**Roles Allowed**: ALL authenticated users (feature can be disabled per canteen)

**Android Native**: 
- **Code Editor**: OPTIONAL (if challenges require code input)

---

## MODULE 17: RESTAURANT/TABLE MANAGEMENT

### 17.1 Restaurant QR Code System

**Description**: QR code-based table ordering, restaurant menu browsing

**Responsible Layer**: BOTH
- **Client**: Table-specific menu UI
- **Server**: Restaurant management routes (restaurantManagement.ts)

**APIs**:
- `GET /api/restaurants/:restaurantId/table/:tableNumber` - Fetch table details
- `GET /api/table/:restaurantId/:tableNumber/:hash` - Validate table QR code
- `POST /api/restaurants/:restaurantId/orders` - Place table order

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: SystemSettings (restaurants.list)

**Roles Allowed**: ALL (unauthenticated users can access via QR)

**Android Native**: 
- **QR Code Scanner**: OPTIONAL (if app scans table QR instead of web)

---

## MODULE 18: BIDDING SYSTEM (ENTERPRISE)

### 18.1 Vendor Bidding

**Description**: Enterprise feature - vendor bidding for contracts, RFQ management

**Responsible Layer**: BOTH
- **Client**: Bidding UI (admin + vendors)
- **Server**: Bidding routes (bidding.ts)

**APIs**:
- `GET /api/bidding/rfqs` - Fetch RFQs (Request for Quotation)
- `POST /api/bidding/rfqs` - Create RFQ
- `POST /api/bidding/rfqs/:id/bids` - Submit bid
- `GET /api/bidding/bids/:id` - Fetch bid details

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: RFQ, Bid (vendor bidding data)

**Roles Allowed**: `admin`, `super_admin` (vendor roles TBD)

**Android Native**: NOT_NEEDED (enterprise web feature)

---

## MODULE 19: PRINT AGENT INTEGRATION

### 19.1 KOT (Kitchen Order Ticket) Printing

**Description**: Print orders to kitchen printers, thermal printer integration

**Responsible Layer**: BOTH
- **Client**: Print agent desktop app (Electron)
- **Server**: Print agent routes (printAgent.ts), print job queue

**APIs**:
- `POST /api/print-agent/register` - Register print agent
- `GET /api/print-agent/pending-jobs` - Fetch pending print jobs
- `POST /api/print-agent/jobs/:id/complete` - Mark print job as complete
- `POST /api/print/order/:orderId` - Queue order for printing

**Socket Events**: NONE (polling-based)

**Data Models**:
- **MongoDB**: PrintJob (orderId, status, printerType, printData)

**Roles Allowed**: `canteen_owner` (print agent runs on owner's machine)

**Android Native**: NOT_NEEDED (desktop Electron app)

---

## MODULE 20: PAYOUT MANAGEMENT

### 20.1 Vendor Payout Processing

**Description**: Process vendor payouts, payout history, reconciliation

**Responsible Layer**: BOTH
- **Client**: Payout management UI (admin)
- **Server**: Payout routes (payoutRoutes.ts)

**APIs**:
- `GET /api/payouts` - Fetch payout records
- `POST /api/payouts` - Create payout
- `PUT /api/payouts/:id` - Update payout status
- `GET /api/payouts/vendor/:vendorId` - Fetch vendor payouts

**Socket Events**: NONE

**Data Models**:
- **MongoDB**: Payout (vendorId, amount, status, paymentMethod, transactionId)

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED (admin feature)

---

## MODULE 21: SITEMAP & SEO

### 21.1 Sitemap Generation

**Description**: Auto-generate sitemap.xml for SEO

**Responsible Layer**: SERVER
- **Server**: Sitemap routes (sitemap.ts)

**APIs**:
- `GET /api/sitemap.xml` - Generate and serve sitemap
- `GET /api/robots.txt` - Serve robots.txt

**Socket Events**: NONE

**Data Models**: NONE (dynamic generation)

**Roles Allowed**: ALL (public)

**Android Native**: NOT_NEEDED (SEO for web)

---

## MODULE 22: DATABASE MANAGEMENT

### 22.1 Database Backup & Restore

**Description**: Admin tools for database backup, restore, data export

**Responsible Layer**: BOTH
- **Client**: Database management UI (admin)
- **Server**: Database management routes (database-management.ts)

**APIs**:
- `POST /api/database/backup` - Create database backup
- `POST /api/database/restore` - Restore from backup
- `GET /api/database/export` - Export data (CSV/JSON)

**Socket Events**: NONE

**Data Models**: ALL (entire database)

**Roles Allowed**: `super_admin` only

**Android Native**: NOT_NEEDED (admin tool)

---

## MODULE 23: CACHING & PERFORMANCE

### 23.1 Redis Caching Layer

**Description**: Optional Redis caching for high-traffic endpoints

**Responsible Layer**: SERVER
- **Server**: Cache service (cacheService.ts)

**APIs**:
- Caching applied automatically to:
  - `GET /api/menu` (menu items)
  - `GET /api/categories` (categories)
  - `GET /api/home-data` (home screen data)
- Cache TTL: 60 seconds (configurable)

**Socket Events**: NONE

**Data Models**: NONE (cache layer)

**Roles Allowed**: Transparent (system-level)

**Android Native**: NOT_NEEDED

---

### 23.2 Performance Monitoring

**Description**: Track slow queries, API response times, cache hit rates

**Responsible Layer**: SERVER
- **Server**: Monitoring service (database-monitor.ts)

**APIs**:
- `GET /api/performance/metrics` - Fetch performance metrics
- Automatic logging of slow queries

**Socket Events**: NONE

**Data Models**: NONE (metrics)

**Roles Allowed**: `admin`, `super_admin`

**Android Native**: NOT_NEEDED

---

## MODULE 24: OFFLINE SUPPORT (PWA)

### 24.1 Service Worker & Offline Caching

**Description**: PWA service worker, offline menu caching, background sync

**Responsible Layer**: CLIENT
- **Client**: Service worker (sw.js, sw-offline.js)

**APIs**: NONE (client-side caching)

**Socket Events**: NONE

**Data Models**: 
- **Browser Cache API**: Cached menu items, images

**Roles Allowed**: ALL authenticated users

**Android Native**: 
- **WorkManager**: REQUIRED (replace Service Worker with Android WorkManager for background sync)
- **Room Database**: REQUIRED (local SQLite cache for offline data)

---

### 24.2 Background Sync (Orders)

**Description**: Queue orders offline, sync when connection restored

**Responsible Layer**: CLIENT
- **Client**: Service worker background sync

**APIs**:
- Syncs to: `POST /api/orders` when online

**Socket Events**: NONE

**Data Models**: 
- **IndexedDB**: Queued offline orders

**Roles Allowed**: ALL authenticated users

**Android Native**: 
- **WorkManager**: REQUIRED (one-time or periodic sync tasks)

---

## ANDROID NATIVE REQUIREMENTS SUMMARY

### CRITICAL (Must Implement)

1. **Firebase Cloud Messaging (FCM)** - Push notification delivery
2. **CameraX + ML Kit Barcode Scanning** - Barcode scanner for delivery verification
3. **Camera Permission** - Required for barcode scanning and image uploads
4. **Gallery Access** - Required for menu item image uploads
5. **Socket.IO Android Client** - Real-time order updates
6. **Google Sign-In SDK** - OAuth authentication
7. **Razorpay Android SDK** - Native payment flow
8. **WorkManager** - Background sync for offline orders
9. **Room Database** - Local data persistence for offline mode

### RECOMMENDED (Enhance UX)

1. **Notification Channels** - Android 8.0+ notification management
2. **Foreground Service** - Keep WebSocket alive for delivery persons
3. **ZXing Library** - QR code display for POS payments
4. **Image Compression** - Client-side image optimization before upload

### OPTIONAL (Advanced Features)

1. **Google Maps SDK** - Delivery person navigation
2. **Location Services** - Delivery tracking
3. **Background Location** - Delivery person real-time tracking
4. **Code Editor Widget** - If coding challenges need mobile support
5. **UPI Intent Handling** - Deep links to UPI apps for payments

---

## END OF DOCUMENT

**Total Capabilities Extracted**: 96 capabilities across 24 modules
**API Endpoints Analyzed**: 250+ endpoints
**WebSocket Events**: 20+ event types
**Data Models**: 25+ collections/tables
**Roles Defined**: 10 roles

**Critical Android Requirements**: 9 must-implement native features
**Recommended Android Features**: 4 UX enhancements
**Optional Android Features**: 5 advanced capabilities


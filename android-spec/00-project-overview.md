# 00 - PROJECT OVERVIEW

## DOCUMENT METADATA
- **Extraction Date**: 2025-12-31
- **Source**: Monorepo full system extraction
- **Backend Source of Truth**: Node.js + Express + MongoDB + PostgreSQL
- **Protocol**: Exhaustive code-derived analysis (no assumptions)

---

## 1. SYSTEM PURPOSE

**KIT-Canteen** is a multi-tenant food ordering and point-of-sale (POS) system designed for college campuses, corporate canteens, and restaurant management. The system supports real-time order tracking, payment processing, inventory management, and delivery operations.

### Core Business Functions
- Multi-role user management (students, staff, admins, canteen owners, delivery personnel)
- Real-time food ordering with live order tracking
- Payment gateway integration (Razorpay with UPI QR support)
- Multi-counter POS operations (Payment, Store, KOT)
- Delivery assignment and tracking
- Inventory and stock management
- Admin dashboard with analytics
- Push notification system
- Table management for dine-in operations

---

## 2. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  (React 18 + TypeScript + Vite + TailwindCSS + Capacitor)       │
│                                                                   │
│  • PWA (Progressive Web App) with offline support                │
│  • Mobile-ready (iOS/Android via Capacitor)                      │
│  • Service Worker for caching and background sync                │
│  • WebSocket client for real-time updates                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/REST + WebSocket (Socket.IO)
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                         SERVER LAYER                             │
│              (Node.js + Express + TypeScript)                    │
│                                                                   │
│  • RESTful API endpoints (/api/*)                                │
│  • WebSocket server (Socket.IO) for real-time events            │
│  • Session management (express-session)                          │
│  • File upload handling (Multer)                                 │
│  • Payment gateway integration (Razorpay)                        │
│  • Image processing (Cloudinary + Sharp)                         │
│  • Print Agent WebSocket server (thermal printing)               │
│  • Background job queue (BullMQ with Redis fallback)             │
└─────────────────────┬──────────────────┬────────────────────────┘
                      │                  │
                      │                  │
        ┌─────────────┴──────┐   ┌──────┴─────────────┐
        │  PostgreSQL        │   │    MongoDB         │
        │  (Prisma ORM)      │   │    (Mongoose)      │
        └────────────────────┘   └────────────────────┘
        User Authentication        Business Data
        - User accounts            - Orders
        - Delivery persons         - Menu items
        - Role management          - Categories
                                   - Payments
                                   - Notifications
                                   - System settings
                                   - Print jobs

        ┌────────────────────┐   ┌────────────────────┐
        │   Redis (Optional) │   │   Cloudinary       │
        │   Caching Layer    │   │   Media Storage    │
        └────────────────────┘   └────────────────────┘
        Rate limiting              - Menu images
        Session storage            - Category icons
        Cache fallback             - Media banners
```

---

## 3. MONOREPO STRUCTURE

```
sillobite/
├── client/                    # Frontend React application
│   ├── public/               # Static assets (manifest, SW, robots.txt)
│   └── src/
│       ├── components/       # React components (organized by domain)
│       │   ├── admin/       # Admin panel components
│       │   ├── auth/        # Authentication components
│       │   ├── canteen/     # Canteen management (POS, counters)
│       │   ├── checkout/    # Checkout flow
│       │   ├── common/      # Shared UI components
│       │   ├── delivery/    # Delivery person portal
│       │   ├── layout/      # Layout wrappers (splash, onboarding)
│       │   ├── menu/        # Menu browsing and item details
│       │   ├── orders/      # Order tracking and history
│       │   ├── payment/     # Payment processing
│       │   ├── profile/     # User profile management
│       │   └── ui/          # shadcn/ui design system components
│       ├── contexts/        # React Context providers
│       │   ├── CartContext.tsx          # Shopping cart state
│       │   ├── CanteenContext.tsx       # Selected canteen state
│       │   ├── FavoritesContext.tsx     # User favorites
│       │   ├── LocationContext.tsx      # User location
│       │   ├── NotificationContext.tsx  # Push notifications
│       │   └── ThemeContext.tsx         # Dark/light mode
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Utility libraries (QueryClient, logger)
│       ├── pages/           # Top-level page components
│       ├── services/        # API service layer
│       ├── types/           # TypeScript type definitions
│       ├── utils/           # Helper functions
│       ├── App.tsx          # Main app component with routing
│       ├── main.tsx         # Entry point (React root mount)
│       └── index.css        # Global styles (TailwindCSS)
│
├── server/                   # Backend Node.js application
│   ├── config/              # Configuration files
│   │   ├── database.ts     # MongoDB + PostgreSQL connection config
│   │   └── redis.ts        # Redis cache configuration
│   ├── migrations/          # Database migration scripts
│   ├── models/              # MongoDB Mongoose models
│   │   ├── mongodb-models.ts   # All MongoDB schemas
│   │   └── TempUserSession.ts  # Temporary session model
│   ├── monitoring/          # Database monitoring tools
│   ├── queues/              # Background job queues
│   │   └── paymentQueue.ts # Payment processing queue
│   ├── routes/              # Express route handlers (modular)
│   │   ├── auth.ts         # Email/password authentication
│   │   ├── googleAuth.ts   # Google OAuth 2.0
│   │   ├── bidding.ts      # Delivery bidding system
│   │   ├── health.ts       # Health check endpoints
│   │   ├── printAgent.ts   # Thermal printer integration
│   │   ├── payoutRoutes.ts # Canteen payout management
│   │   ├── restaurantManagement.ts  # Table/employee management
│   │   ├── systemSettings.ts # Global system configuration
│   │   ├── webPush.ts      # Push notification subscription
│   │   └── (others)        # Additional feature routes
│   ├── services/            # Business logic services
│   │   ├── cacheService.ts      # Redis/in-memory cache
│   │   ├── cloudinaryService.ts # Image upload/compression
│   │   ├── mediaService.ts      # Banner media management
│   │   ├── printAgentService.ts # Print job dispatch
│   │   ├── sessionCleanupService.ts # Session expiry cleanup
│   │   └── webPushService.ts    # VAPID push notifications
│   ├── types/               # TypeScript type extensions
│   ├── checkout-session-service.ts  # Checkout session tracking
│   ├── db.ts                # Prisma client singleton
│   ├── delivery-assignment-service.ts # Delivery person assignment
│   ├── health-check.ts      # Startup health validation
│   ├── index.ts             # Server entry point
│   ├── mongodb.ts           # MongoDB connection manager
│   ├── payment-session-service.ts # Payment duplicate prevention
│   ├── routes.ts            # Main route registration (9730 lines)
│   ├── startup-check.ts     # Pre-launch validation
│   ├── stock-service.ts     # Stock update transactions
│   ├── storage-hybrid.ts    # Hybrid PostgreSQL/MongoDB storage
│   ├── vite.ts              # Vite dev server middleware
│   └── websocket.ts         # Socket.IO WebSocket server
│
├── shared/                   # Code shared between client and server
│   ├── schema.ts            # Zod validation schemas + type exports
│   ├── utils.ts             # Shared utility functions
│   ├── razorpay.ts          # Razorpay payment integration
│   ├── phonepe.ts           # PhonePe payment gateway (legacy)
│   └── qrCodeUtils.ts       # QR code generation utilities
│
├── prisma/                   # Prisma ORM configuration
│   ├── schema.prisma        # PostgreSQL database schema
│   └── migrations/          # SQL migration files
│
├── scripts/                  # Build and deployment scripts
│   ├── build.js             # Production build script
│   ├── production-optimization.js  # Post-build optimizations
│   ├── start-production.js  # Production server starter
│   └── (others)             # Migration and fix scripts
│
├── .env                      # Environment variables (not in repo)
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler configuration
├── tailwind.config.ts       # TailwindCSS configuration
└── components.json          # shadcn/ui component config
```

### Folder Responsibilities

| Folder | Responsibility | Database | Notes |
|--------|---------------|----------|-------|
| `client/` | User interface, PWA, offline caching | None | React 18 + TypeScript + Vite |
| `server/` | REST API, WebSocket, business logic | MongoDB + PostgreSQL | Express + Socket.IO |
| `shared/` | Type definitions, validation, utilities | None | Shared between client/server |
| `prisma/` | PostgreSQL schema and migrations | PostgreSQL | User authentication only |

---

## 4. TECHNOLOGY STACK

### Frontend Stack
```
┌─────────────────────────────────────────────────┐
│ React 18.3.1 (UI framework)                     │
│ TypeScript 5.6.3 (type safety)                  │
│ Vite 5.4.14 (build tool + dev server)           │
│ Wouter 3.3.5 (client-side routing)              │
│ TailwindCSS 3.4.17 (styling)                    │
│ shadcn/ui (Radix UI components)                 │
│ @tanstack/react-query 5.60.5 (server state)     │
│ Socket.IO Client 4.8.1 (WebSocket)              │
│ Framer Motion 11.18.2 (animations)              │
│ Capacitor (native mobile wrapper)               │
│ Service Worker (offline PWA support)            │
└─────────────────────────────────────────────────┘
```

### Backend Stack
```
┌─────────────────────────────────────────────────┐
│ Node.js 18+ (runtime)                           │
│ Express 4.21.2 (web framework)                  │
│ TypeScript 5.6.3 (type safety)                  │
│ Socket.IO 4.8.1 (WebSocket server)              │
│ Mongoose 8.16.0 (MongoDB ODM)                   │
│ Prisma 6.16.2 (PostgreSQL ORM)                  │
│ BullMQ 5.65.0 (job queue)                       │
│ IORedis 5.8.2 (Redis client)                    │
│ Sharp 0.34.4 (image processing)                 │
│ Cloudinary 2.7.0 (media CDN)                    │
│ Razorpay 2.9.6 (payment gateway)                │
│ Multer 2.0.2 (file upload)                      │
│ Web-Push 3.6.7 (push notifications)             │
│ Bcrypt 6.0.0 (password hashing)                 │
│ Google Auth Library 10.3.0 (OAuth)              │
└─────────────────────────────────────────────────┘
```

### Database Layer
```
┌─────────────────────────────────────────────────┐
│ PostgreSQL (Prisma ORM)                         │
│  - User authentication (users table)            │
│  - Delivery persons (delivery_persons table)    │
│                                                  │
│ MongoDB (Mongoose ODM)                          │
│  - Orders, Payments, MenuItems, Categories      │
│  - Notifications, Coupons, Complaints           │
│  - System Settings, Print Jobs, Counters        │
│  - Restaurant Tables, Employees                 │
│  - Canteen Charges, User Addresses              │
│                                                  │
│ Redis (Optional - with in-memory fallback)      │
│  - Rate limiting                                │
│  - Session storage                              │
│  - Cache layer                                  │
└─────────────────────────────────────────────────┘
```

---

## 5. ENTRY POINTS

### Client Entry Point
**File**: `client/src/main.tsx` → `client/src/App.tsx`

```typescript
// main.tsx - Bootstrap sequence
1. Initialize Capacitor (native mobile)
2. Register Service Worker (PWA)
3. Mount React app at #root

// App.tsx - Application shell
1. Setup QueryClient (React Query)
2. Initialize contexts (Cart, Theme, Notifications, etc.)
3. Setup Wouter router with 80+ routes
4. Enable deployment detection (cache invalidation)
5. Enable activity tracking (session persistence)
6. Handle browser back navigation (PWA)
```

**Key Initialization Steps** (from `main.tsx`):
```typescript
- initializeCapacitor()           // Native mobile setup
- navigator.serviceWorker.register('/sw.js')  // PWA offline support
- updateManager.init(registration) // Auto-update detection
- createRoot(document.getElementById("root")!).render(<App />)
```

### Server Entry Point
**File**: `server/index.ts`

```typescript
// Startup sequence (async IIFE)
1. Configure Express middleware
   - Session management (express-session)
   - JSON body parser (10MB limit)
   - Request logging middleware

2. Perform startup health checks
   - performStartupCheck()          // Database connectivity
   - performStartupSchemaCheck()    // MongoDB schema validation
   - addPerformanceIndexes()        // Ensure indexes exist

3. Check Redis availability
   - isRedisAvailable()             // Cache layer detection

4. Register routes
   - registerRoutes(app)            // Import routes.ts
   - 200+ REST API endpoints

5. Initialize WebSocket server
   - initializeWebSocket(server, app)  // Socket.IO setup
   - Room-based architecture (canteen/counter rooms)

6. Initialize Print Agent
   - printAgentService.initialize(server)  // Thermal printer WebSocket

7. Setup error handling
   - Global error middleware

8. Start HTTP server
   - Port: 5000 (always, no override)
   - Host: localhost (Windows) or 0.0.0.0 (Unix)

9. Start background services
   - sessionCleanupService.start()  // Cleanup expired sessions
```

### WebSocket Initialization
**File**: `server/websocket.ts`

```typescript
// WebSocket server (Socket.IO)
- Transport: WebSocket + polling fallback
- CORS: Production/development origins
- Ping interval: 25s
- Ping timeout: 60s

// Room-based architecture
- canteen_<canteenId>               // Canteen-specific updates
- counter_<counterId>               // Counter interface updates
- delivery_person_<email>           // Delivery assignment notifications

// Event handlers
- joinCanteenRooms                  // Subscribe to canteen updates
- joinCounterRoom                   // Subscribe to counter updates
- joinDeliveryPersonRoom            // Subscribe to delivery updates
- ping/pong                         // Connection health check
```

---

## 6. CROSS-CUTTING CONCERNS

### 6.1 Real-Time Communication (WebSocket)

**Implementation**: Socket.IO (bidirectional WebSocket)

**Event Flow**:
```
Client                          Server
  |                               |
  |-- joinCanteenRooms ---------->| Store socket in room map
  |<- roomJoined ------------------|
  |                               |
  |                               | [New order created]
  |<- orderUpdate (new_order) -----|
  |                               |
  |                               | [Order status changed]
  |<- orderUpdate (status) -------|
```

**Broadcast Types** (from `websocket.ts`):
- `new_order` - Notify canteen of new order
- `order_status_changed` - Order workflow updates
- `order_updated` - General order modifications
- `banner_updated` - Media banner changes
- `checkout_session_status_changed` - Checkout timer updates
- `menu_updated` - Menu item modifications
- `deliveryAssignment` - Delivery person assignment

**Room Architecture**:
```typescript
// Tracked in WebSocketManager
private canteenRooms: Map<string, Set<string>>         // canteenId -> socketIds
private counterRooms: Map<string, Set<string>>         // counterId -> socketIds
private deliveryPersonRooms: Map<string, Set<string>>  // email -> socketIds
private connectedUsers: Map<string, SocketUser>        // socketId -> user info
```

### 6.2 Authentication & Authorization

**Dual Authentication System**:

1. **Google OAuth 2.0** (`server/routes/googleAuth.ts`)
   - Flow: Google Sign-In → `/api/auth/google` → Verify token → Create/update user
   - Firebase Auth for mobile (Capacitor)
   - Session cookie stored after verification

2. **Email/Password** (`server/routes/auth.ts`)
   - Flow: Email/password → `/api/auth/login` → Bcrypt verification → Session cookie
   - Password hashing: Bcrypt with 10 rounds
   - Registration: `/api/auth/register`

**Session Management**:
```typescript
// express-session configuration (server/index.ts)
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    sameSite: 'lax'
  }
}));
```

**Role-Based Access** (PostgreSQL User model):
- `student` - Order food, track orders
- `staff` / `employee` / `guest` - Order food with staff ID
- `canteen_owner` - Manage canteen, POS operations
- `admin` - User management, system settings
- `super_admin` - Full system access (only one allowed)
- `delivery_person` - Delivery portal access

**Protected Route Pattern** (client):
```typescript
<ProtectedRoute requireAuth={true}>  // Any authenticated user
<ProtectedRoute requiredRole="canteen_owner">  // Specific role
<ProtectedRoute requiredRoles={["admin", "super_admin"]}>  // Multiple roles
```

### 6.3 Payment Processing

**Primary Gateway**: Razorpay (UPI, cards, QR codes)

**Payment Flow** (`shared/razorpay.ts` + `server/routes.ts`):
```
1. User clicks "Pay Now"
2. Client: Create checkout session
   POST /api/checkout-sessions
3. Server: Validate session (duplicate prevention)
4. Server: Create Razorpay order
   razorpayInstance.orders.create()
5. Server: Save payment record (MongoDB Payment model)
6. Client: Open Razorpay checkout UI
7. User completes payment
8. Razorpay webhook: POST /api/razorpay/webhook
9. Server: Verify webhook signature
10. Server: Update order status → 'preparing'
11. Server: Broadcast WebSocket orderUpdate
12. Client: Redirect to order status page
```

**QR Code Payment** (POS):
```
1. Counter creates order with QR option
2. Server: createRazorpayQR()
3. Display QR code to customer
4. Customer scans and pays
5. Razorpay webhook: Payment captured
6. Server: Update order, broadcast to counter
```

**Duplicate Prevention** (`server/payment-session-service.ts`):
```typescript
// Checkout session tracking (MongoDB)
interface ICheckoutSession {
  sessionId: string;
  customerId: number;
  status: 'active' | 'completed' | 'abandoned' | 'expired' | 
          'payment_initiated' | 'payment_completed' | 'payment_failed';
  expiresAt: Date;
  lastActivity: Date;
}

// Payment session tracking (MongoDB)
interface IPaymentSession {
  sessionId: string;
  customerId: number;
  amount: number;
  orderData: string;  // JSON snapshot
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  expiresAt: Date;
}
```

### 6.4 File Upload & Media Management

**Image Upload Flow** (`server/services/cloudinaryService.ts`):
```
1. Client: Upload file (Multer middleware)
2. Server: Receive Buffer
3. Server: Compress with Sharp
   - Target: 2MB max (configurable)
   - Format preservation (PNG transparency)
   - Quality reduction (80 → 10)
   - Resize if needed (maintain aspect ratio)
4. Server: Upload to Cloudinary
   - Folder: menu-items, banners, categories
   - Auto transformations (800x600 limit)
5. Server: Return secure_url + public_id
6. Server: Save to MongoDB (imageUrl, imagePublicId)
```

**Media Types**:
- Menu item images (100KB limit → compressed to 20KB)
- Category icons (SVG or raster)
- Media banners (50MB limit → compressed to 2MB)
- Restaurant/table images

**Cloudinary Configuration**:
```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

### 6.5 Push Notifications

**Implementation**: Web Push API with VAPID keys

**Subscription Flow** (`server/services/webPushService.ts`):
```
1. Client: Request notification permission
2. Client: Service Worker generates subscription
3. Client: POST /api/webpush/subscribe
   { endpoint, keys: { p256dh, auth } }
4. Server: Store in MongoDB (TempUserSession model)
5. Server: Can now send push notifications
```

**Notification Triggers**:
- Order status changes (`orderUpdate` event)
- New order for canteen owners
- Delivery assignment
- Payment success/failure
- Admin announcements

**Template System** (MongoDB NotificationTemplate):
```typescript
interface INotificationTemplate {
  status: string;  // 'preparing', 'ready', 'completed'
  title: string;
  message: string;
  icon: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
  enabled: boolean;
}
```

### 6.6 Offline Support (PWA)

**Service Worker**: `client/public/sw.js`

**Cache Strategies**:
```javascript
// Static assets (HTML, CSS, JS)
- Strategy: Cache-first with network fallback
- Duration: Indefinite (until new version)

// API responses
- Strategy: Network-first with cache fallback
- Duration: Session-based
- Patterns: /api/*, /images/*

// Offline page
- Fallback when network unavailable
```

**Background Sync** (not fully implemented):
- Queue failed requests
- Retry when network restored
- Used for order submissions, analytics

**Update Detection** (`client/src/utils/updateManager.ts`):
```typescript
// Passive update detection
1. Service Worker detects new version
2. Show banner to user: "Update available"
3. User clicks "Refresh" → skipWaiting()
4. Reload page with new version
```

---

## 7. ENVIRONMENT VARIABLES

**Required Variables** (from code analysis):

### Database Configuration
```bash
# PostgreSQL (Prisma)
DATABASE_URL="postgresql://user:password@host:5432/database"
POSTGRES_LOCAL_PASSWORD="password"  # Dev fallback

# MongoDB (Mongoose)
MONGODB_URI="mongodb://localhost:27017/kit-canteen-dev"
# OR
MONGODB_ATLAS_URI="mongodb+srv://..."
# OR
MONGODB_LOCAL_URI="mongodb://localhost:27017/..."

# MongoDB Pool Sizing
MONGODB_MAX_POOL_SIZE="200"  # Default: 200
MONGODB_MIN_POOL_SIZE="50"   # Default: 50
```

### Redis Cache (Optional)
```bash
REDIS_URL="redis://localhost:6379"
# OR
REDIS_URI="redis://..."
REDIS_PASSWORD="your-redis-password"
REDIS_CLUSTER="true"  # If using cluster mode
REDIS_CLUSTER_NODES="host1:port1,host2:port2"

# Redis Timeouts
REDIS_MAX_RETRIES="3"
REDIS_RETRY_DELAY="50"
REDIS_CONNECT_TIMEOUT="10000"
REDIS_COMMAND_TIMEOUT="5000"
```

### Payment Gateway
```bash
# Razorpay (Primary)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# PhonePe (Legacy - not used in current code)
PHONEPE_MERCHANT_ID="..."
PHONEPE_SALT_KEY="..."
PHONEPE_SALT_INDEX="..."
```

### Media Storage
```bash
# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### Authentication
```bash
# Session Secret
SESSION_SECRET="change-in-production"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Firebase (for mobile OAuth)
# Configured in Firebase console, not in .env
```

### Push Notifications
```bash
# Web Push VAPID Keys
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"
```

### Server Configuration
```bash
NODE_ENV="development"  # or "production"
PORT=5000  # Ignored - server always uses 5000

# Client URL for CORS (production)
CLIENT_URL="https://your-domain.com"
```

---

## 8. DEPLOYMENT ASSUMPTIONS

### Target Platform: **Railway** (Evidence from code structure)

**Indicators**:
1. Single port (5000) for both API and static files
2. PostgreSQL + MongoDB dual database support
3. Redis optional with fallback
4. Environment variable-driven configuration
5. Production build script optimizations

### Build Process
```bash
# Development
npm run dev
# Runs: cross-env NODE_ENV=development tsx server/index.ts
# - Vite dev server (HMR)
# - Express API server
# - WebSocket server

# Production Build
npm run build:production
# Runs: node scripts/build.js && node scripts/production-optimization.js
# 1. Vite build (client) → dist/public/
# 2. esbuild (server) → dist/index.js
# 3. Optimize output (minify, tree-shake)

# Production Start
npm run start
# Runs: cross-env NODE_ENV=production node dist/index.js
# - Serve static files from dist/public/
# - Run Express API
# - WebSocket server
```

### Static File Serving (Production)
```typescript
// server/vite.ts
if (app.get("env") === "development") {
  await setupVite(app, server);  // Vite dev middleware
} else {
  serveStatic(app);  // Express.static for dist/public/
}
```

### Database Migration Strategy
```bash
# Prisma (PostgreSQL)
npx prisma migrate deploy  # Apply migrations

# MongoDB (Mongoose)
# No migrations - schema changes via Mongoose models
# Indexes created on startup (server/migrations/add-performance-indexes.ts)
```

### Scalability Fixes (from code comments)
```typescript
// SCALABILITY FIX: Increased MongoDB pool size
maxPoolSize: 200  // Was: 10
minPoolSize: 50   // Was: 2

// SCALABILITY FIX: Redis connection retry limit
MAX_REDIS_CONNECTION_ATTEMPTS = 3  // Stop after 3 failures

// SCALABILITY FIX: Lazy Redis connect
lazyConnect: true  // Only connect when needed
```

---

## 9. MAJOR SUBSYSTEMS

### 9.1 Order Management System

**Models** (MongoDB):
- `Order` - Main order document
- `OrderItem` - Line items (normalized)
- `MenuItem` - Menu catalog
- `Category` - Menu grouping

**Order Workflow**:
```
1. Cart → Checkout
2. Payment → Order creation
3. Order status: preparing
4. Canteen marks items ready (per counter)
5. Order status: ready
6. User picks up / Delivery assigned
7. Barcode scanned
8. Order status: completed
```

**Multi-Counter Support**:
```typescript
interface Order {
  storeCounterId?: string;      // Fulfillment counter
  paymentCounterId?: string;    // Payment verification counter
  kotCounterId?: string;         // Kitchen Order Ticket counter
  allStoreCounterIds: string[]; // All store counters involved
  allPaymentCounterIds: string[];
  allKotCounterIds: string[];
  itemStatusByCounter: {        // Per-counter item tracking
    [counterId: string]: {
      [itemId: string]: 'pending' | 'ready' | 'completed'
    }
  };
}
```

### 9.2 Point-of-Sale (POS) System

**Counter Types** (MongoDB Counter model):
- `payment` - Payment verification and order acceptance
- `store` - Order fulfillment and item preparation
- `kot` - Kitchen order display (optional)

**POS Features**:
- Offline order creation (pay-at-counter)
- QR code payment (Razorpay UPI)
- Real-time order display
- Item-level status tracking
- Barcode scanning for order completion
- Receipt printing (thermal printer integration)

**Routes** (client):
```typescript
/canteen-owner-dashboard/:canteenId
/canteen-owner-dashboard/:canteenId/counters
/canteen-owner-dashboard/:canteenId/counter/:counterId
/barcode-scanner  // Order completion via barcode
```

### 9.3 Inventory Management

**Stock Tracking** (`server/stock-service.ts`):
```typescript
class StockService {
  // MongoDB transaction support detection
  async validateAndPrepareStockUpdates(items): Promise<StockUpdate[]>
  
  // Atomic stock update (with/without transactions)
  async updateMenuItemsStock(updates: StockUpdate[]): Promise<void>
  
  // Check stock availability before order
  async checkStockAvailability(items): Promise<boolean>
}
```

**Transaction Support**:
- MongoDB 4.0+: Use transactions
- MongoDB 4.4 (MongoDB Atlas free tier): Non-transactional mode
- Fallback: Sequential updates with error handling

**Stock Fields** (MenuItem model):
```typescript
interface MenuItem {
  available: boolean;  // Item enabled/disabled
  stock: number;       // Quantity available
}
```

### 9.4 Delivery System

**Models**:
- `DeliveryPerson` (PostgreSQL) - Delivery person accounts
- `Order` (MongoDB) - Order delivery fields

**Delivery Assignment** (`server/delivery-assignment-service.ts`):
```typescript
// Manual assignment
POST /api/orders/:orderId/assign-delivery
{ deliveryPersonId: string }

// Order fields
interface Order {
  deliveryPersonId?: string;
  orderType: 'delivery' | 'takeaway';
  deliveryAddress?: {
    fullName, phoneNumber, addressLine1, city, pincode, etc.
  };
}
```

**Delivery Portal** (client):
```typescript
/delivery-portal  // Real-time order list
// Features:
// - View assigned orders
// - Mark order as delivered
// - WebSocket updates (delivery_person_<email> room)
```

### 9.5 Admin Dashboard

**Admin Routes** (80+ admin endpoints in `server/routes.ts`):
```typescript
/admin                           // Dashboard overview
/admin/analytics                 // Revenue, orders, users
/admin/user-management           // User CRUD
/admin/canteen-management        // Canteen configuration
/admin/restaurant-management     // Table/employee management
/admin/payment-management        // Payment tracking
/admin/notification-management   // Push notification templates
/admin/coupon-management         // Discount coupons
/admin/system-settings           // Global settings
/admin/database                  // Database management
/admin/payout-requests           // Canteen payouts
```

**System Settings** (MongoDB SystemSettings model):
```typescript
interface SystemSettings {
  maintenanceMode: {
    isActive: boolean;
    title, message, estimatedTime;
    targetingType: 'all' | 'specific' | 'college' | 'department';
  };
  colleges: {
    list: College[];  // College configuration
  };
  canteens: {
    list: Canteen[];  // All canteens
  };
  appVersion: {
    version, buildTimestamp;
  };
}
```

### 9.6 Print Agent System

**Thermal Printer Integration** (`server/services/printAgentService.ts`):
```typescript
// WebSocket server for print agents
class PrintAgentService {
  // Agent connects with pairing code
  async registerAgent(agentId, outletId, apiKey)
  
  // Create print job
  async createPrintJob(outletId, receiptType, content)
  
  // Job types: 'KOT', 'BILL', 'TOKEN'
}
```

**Models** (MongoDB):
- `PrintAgent` - Registered printers
- `PrintJob` - Print queue
- `Printer` - Printer configuration
- `PairingCode` - Temporary pairing codes

**Receipt Types**:
- `KOT` - Kitchen Order Ticket (items only)
- `BILL` - Full receipt (items + payment)
- `TOKEN` - Order token (barcode + order number)

---

## 10. DATA MODELS

### PostgreSQL Models (Prisma)

**User Model** (`prisma/schema.prisma`):
```prisma
model User {
  id                  Int      @id @default(autoincrement())
  email               String   @unique
  name                String
  phoneNumber         String?
  role                String   // student, staff, admin, etc.
  
  // Student fields
  registerNumber      String?  @unique
  college             String?
  department          String?
  joiningYear         Int?
  passingOutYear      Int?
  currentStudyYear    Int?
  isPassed            Boolean? @default(false)
  
  // Staff fields
  staffId             String?  @unique
  
  // Location selection
  selectedLocationType String?  // college, organization, restaurant
  selectedLocationId   String?
  
  // Profile status
  isProfileComplete   Boolean? @default(false)
  passwordHash        String?  // For email/password auth
  
  createdAt           DateTime @default(now())
}
```

**DeliveryPerson Model** (`prisma/schema.prisma`):
```prisma
model DeliveryPerson {
  id                  Int      @id @default(autoincrement())
  deliveryPersonId    String   @unique  // DP001, DP002, etc.
  canteenId           String
  name                String
  phoneNumber         String
  email               String?
  vehicleNumber       String?
  isActive            Boolean  @default(true)
  isAvailable         Boolean  @default(true)
  totalOrderDelivered Int      @default(0)
  createdAt           DateTime @default(now())
}
```

### MongoDB Models (Mongoose)

**Category Model** (`server/models/mongodb-models.ts`):
```typescript
interface ICategory {
  name: string;
  canteenId: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: Date;
}
// Indexes:
// - { name: 1, canteenId: 1 } unique
// - { canteenId: 1, name: 1 }
```

**MenuItem Model**:
```typescript
interface IMenuItem {
  name: string;
  price: number;
  categoryId?: ObjectId;
  canteenId: string;
  available: boolean;
  stock: number;
  description?: string;
  addOns: string;  // JSON array
  isVegetarian: boolean;
  isMarkable: boolean;      // Manual ready marking
  isTrending: boolean;
  isQuickPick: boolean;     // Quick order feature
  imageUrl?: string;
  imagePublicId?: string;
  storeCounterId?: string;
  paymentCounterId?: string;
  kotCounterId?: string;
  cookingTime?: number;     // Minutes
  calories?: number;        // kcal
  createdAt: Date;
}
// Indexes:
// - { canteenId: 1, available: 1, stock: 1 }
// - { canteenId: 1, categoryId: 1, available: 1 }
// - { canteenId: 1, isVegetarian: 1, available: 1 }
```

**Order Model**:
```typescript
interface IOrder {
  orderNumber: string;  // Unique identifier
  customerId?: number;  // PostgreSQL user ID
  customerName: string;
  collegeName?: string;
  items: string;        // JSON array
  amount: number;
  itemsSubtotal?: number;
  taxAmount?: number;
  chargesTotal?: number;
  originalAmount?: number;
  discountAmount?: number;
  appliedCoupon?: string;
  status: string;       // preparing, ready, completed, cancelled
  estimatedTime: number;
  barcode: string;      // Unique barcode for completion
  barcodeUsed: boolean;
  deliveredAt?: Date;
  seenBy?: number[];    // User IDs who viewed
  
  // Canteen/counter routing
  canteenId: string;
  counterId?: string;
  storeCounterId?: string;
  paymentCounterId?: string;
  kotCounterId?: string;
  allStoreCounterIds?: string[];
  allPaymentCounterIds?: string[];
  allKotCounterIds?: string[];
  itemStatusByCounter?: Record<string, Record<string, 'pending'|'ready'|'completed'>>;
  
  // Payment
  isOffline?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
  qrId?: string;
  paymentId?: string;
  paymentConfirmedBy?: string;
  rejectedBy?: string;
  
  // Delivery
  deliveryPersonId?: string;
  orderType?: 'delivery' | 'takeaway';
  deliveryAddress?: {
    label, fullName, phoneNumber, addressLine1, city, pincode, etc.
  };
  
  createdAt: Date;
}
// Indexes:
// - { customerId: 1, status: 1, createdAt: -1 }
// - { canteenId: 1, status: 1, createdAt: -1 }
// - { deliveryPersonId: 1, status: 1, createdAt: -1 }
```

**Payment Model**:
```typescript
interface IPayment {
  orderId?: ObjectId;
  canteenId?: string;
  merchantTransactionId: string;  // Unique
  razorpayTransactionId?: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  responseCode?: string;
  responseMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Indexes:
// - { canteenId: 1, createdAt: -1 }
// - { orderId: 1 }
```

---

## 11. API SURFACE AREA

**Total Routes**: 200+ RESTful endpoints (from `server/routes.ts`)

### Core API Patterns

```
┌─────────────────────────────────────────────────────────┐
│ Health & Status                                         │
├─────────────────────────────────────────────────────────┤
│ GET  /api/health                                        │
│ GET  /api/health/redis                                  │
│ GET  /api/status                                        │
│ GET  /api/server-info                                   │
│ GET  /api/schema-status                                 │
│ GET  /api/websocket/status                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ User Management                                         │
├─────────────────────────────────────────────────────────┤
│ GET    /api/users                                       │
│ GET    /api/users/paginated                             │
│ GET    /api/users/:id                                   │
│ POST   /api/users                                       │
│ PUT    /api/users/:id                                   │
│ PATCH  /api/users/:id                                   │
│ DELETE /api/users/:id                                   │
│ GET    /api/users/by-email/:email                       │
│ GET    /api/users/by-register/:registerNumber           │
│ GET    /api/users/by-staff/:staffId                     │
│ GET    /api/users/:id/validate                          │
│ PUT    /api/users/:id/location                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Authentication                                          │
├─────────────────────────────────────────────────────────┤
│ POST /api/auth/google          (Google OAuth)          │
│ POST /api/auth/login           (Email/password)        │
│ POST /api/auth/register                                 │
│ POST /api/auth/logout                                   │
│ GET  /api/auth/google/callback                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Menu & Categories                                       │
├─────────────────────────────────────────────────────────┤
│ GET    /api/categories                                  │
│ POST   /api/categories                                  │
│ PUT    /api/categories/:id                              │
│ DELETE /api/categories/:id                              │
│ GET    /api/menu                                        │
│ POST   /api/menu                                        │
│ PUT    /api/menu/:id                                    │
│ DELETE /api/menu/:id                                    │
│ POST   /api/menu/:id/image (Multer upload)             │
│ DELETE /api/menu/:id/image                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Orders                                                  │
├─────────────────────────────────────────────────────────┤
│ GET    /api/orders                                      │
│ GET    /api/orders/:id                                  │
│ POST   /api/orders                                      │
│ PATCH  /api/orders/:id/status                           │
│ POST   /api/orders/:id/verify-barcode                   │
│ POST   /api/orders/:id/assign-delivery                  │
│ GET    /api/orders/canteen/:canteenId                   │
│ GET    /api/orders/counter/:counterId                   │
│ GET    /api/orders/delivery-person/:deliveryPersonId    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Payments                                                │
├─────────────────────────────────────────────────────────┤
│ POST /api/razorpay/create-order                         │
│ POST /api/razorpay/verify-payment                       │
│ POST /api/razorpay/webhook                              │
│ POST /api/razorpay/create-qr                            │
│ GET  /api/razorpay/qr/:qrCodeId                         │
│ POST /api/razorpay/qr/:qrCodeId/close                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Checkout Sessions (Duplicate Prevention)               │
├─────────────────────────────────────────────────────────┤
│ POST   /api/checkout-sessions                           │
│ GET    /api/checkout-sessions/:sessionId                │
│ DELETE /api/checkout-sessions/:sessionId                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Canteen Management                                      │
├─────────────────────────────────────────────────────────┤
│ GET /api/canteens/:canteenId/charges                    │
│ GET /api/canteens/:canteenId/settings                   │
│ PUT /api/canteens/:canteenId/settings                   │
│ GET /api/canteens/:canteenId/menu-analytics             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ System Settings (Modular Routes)                       │
├─────────────────────────────────────────────────────────┤
│ routes/systemSettings.ts:                               │
│   GET  /api/system-settings                             │
│   PUT  /api/system-settings/maintenance                 │
│   PUT  /api/system-settings/colleges                    │
│   PUT  /api/system-settings/canteens                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Push Notifications (Web Push API)                      │
├─────────────────────────────────────────────────────────┤
│ routes/webPush.ts:                                      │
│   POST /api/webpush/subscribe                           │
│   POST /api/webpush/unsubscribe                         │
│   POST /api/webpush/send                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Print Agent (Thermal Printer)                          │
├─────────────────────────────────────────────────────────┤
│ routes/printAgent.ts:                                   │
│   POST /api/print-agent/register                        │
│   POST /api/print-agent/jobs                            │
│   GET  /api/print-agent/jobs/:jobId                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Restaurant Management                                   │
├─────────────────────────────────────────────────────────┤
│ routes/restaurantManagement.ts:                         │
│   GET/POST/PUT/DELETE /api/restaurants                  │
│   GET/POST/PUT/DELETE /api/restaurants/:id/tables       │
│   GET/POST/PUT/DELETE /api/restaurants/:id/employees    │
└─────────────────────────────────────────────────────────┘
```

---

## 12. ASCII DIAGRAMS

### Order Processing Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Customer  │         │   Server    │         │   Canteen   │
│    (PWA)    │         │   (API)     │         │    Owner    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. Add items to cart  │                       │
       ├───────────────────────>                       │
       │                       │                       │
       │ 2. Checkout           │                       │
       ├───────────────────────>                       │
       │                       │                       │
       │                       │ 3. Create checkout    │
       │                       │    session (MongoDB)  │
       │                       ├──────────────────────>│
       │                       │                       │
       │ 4. Payment gateway    │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 5. User pays          │                       │
       ├───────────────────────>                       │
       │                       │                       │
       │                       │ 6. Webhook: Payment   │
       │                       │<──────────────────────┤
       │                       │                       │
       │                       │ 7. Create order       │
       │                       │    (MongoDB)          │
       │                       ├──────────────────────>│
       │                       │                       │
       │                       │ 8. WebSocket broadcast│
       │                       │    (new_order)        │
       │                       ├───────────────────────>
       │                       │                       │
       │ 9. Redirect to order  │                       │
       │    status page        │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 10. WebSocket join    │                       │
       │     canteen room      │                       │
       ├───────────────────────>                       │
       │                       │                       │
       │                       │ 11. Mark item ready   │
       │                       │<───────────────────────
       │                       │                       │
       │                       │ 12. WebSocket update  │
       │<──────────────────────┤    (order_status)     │
       │                       ├───────────────────────>
       │                       │                       │
       │ 13. Order complete    │                       │
       │     (barcode scan)    │                       │
       │                       │<───────────────────────
       │                       │                       │
       │ 14. Update order      │                       │
       │     status: completed │                       │
       │                       ├──────────────────────>│
       │                       │                       │
       │ 15. WebSocket update  │                       │
       │<──────────────────────┤                       │
       │                       ├───────────────────────>
       └───────────────────────┴───────────────────────┘
```

### Database Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                         │
│                  (Node.js + Express + TypeScript)                │
└─────────────────┬─────────────────────┬──────────────────────────┘
                  │                     │
                  │                     │
        ┌─────────┴─────────┐ ┌─────────┴──────────┐
        │   Prisma Client   │ │ Mongoose ODM       │
        │   (PostgreSQL)    │ │ (MongoDB)          │
        └─────────┬─────────┘ └─────────┬──────────┘
                  │                     │
                  │                     │
        ┌─────────┴─────────┐ ┌─────────┴──────────┐
        │   PostgreSQL      │ │    MongoDB         │
        │   (User Auth)     │ │  (Business Data)   │
        └───────────────────┘ └────────────────────┘
        
POSTGRESQL SCHEMA (Prisma)
├── users
│   ├── id (PK, serial)
│   ├── email (unique)
│   ├── name
│   ├── role
│   ├── registerNumber (unique, nullable)
│   ├── staffId (unique, nullable)
│   └── passwordHash (nullable)
│
└── delivery_persons
    ├── id (PK, serial)
    ├── deliveryPersonId (unique)
    ├── canteenId
    ├── name
    ├── phoneNumber
    └── isActive

MONGODB COLLECTIONS (Mongoose)
├── categories
│   ├── _id (ObjectId)
│   ├── name
│   ├── canteenId
│   └── imageUrl
│
├── menuitems
│   ├── _id (ObjectId)
│   ├── name, price, categoryId
│   ├── canteenId, available, stock
│   ├── storeCounterId, paymentCounterId, kotCounterId
│   └── imageUrl, cookingTime, calories
│
├── orders
│   ├── _id (ObjectId)
│   ├── orderNumber (unique)
│   ├── customerId (references PostgreSQL users.id)
│   ├── items (JSON), amount, status
│   ├── canteenId, counterId
│   ├── deliveryPersonId
│   └── barcode (unique)
│
├── payments
│   ├── _id (ObjectId)
│   ├── orderId (references orders._id)
│   ├── merchantTransactionId (unique)
│   ├── amount, status
│   └── paymentMethod
│
├── counters
│   ├── _id (ObjectId)
│   ├── counterId (unique)
│   ├── canteenId, name, code
│   └── type (payment|store|kot)
│
├── coupons
│   ├── _id (ObjectId)
│   ├── code (unique)
│   ├── discountType, discountValue
│   ├── usageLimit, usedCount
│   └── validFrom, validUntil
│
├── systemsettings (singleton)
│   ├── _id (ObjectId)
│   ├── maintenanceMode { isActive, title, message }
│   ├── colleges { list: [...] }
│   ├── canteens { list: [...] }
│   └── appVersion { version, buildTimestamp }
│
├── printjobs
│   ├── _id (ObjectId)
│   ├── jobId (unique)
│   ├── outletId, agentId
│   ├── receiptType (KOT|BILL|TOKEN)
│   └── status (pending|sent|printed|failed)
│
└── (30+ more models...)
```

### WebSocket Room Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      Socket.IO Server (Port 5000)                 │
│                      WebSocket Manager                            │
└───────────────────────┬───────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │   Room Registry       │
            ├───────────────────────┤
            │ canteenRooms: Map     │
            │ counterRooms: Map     │
            │ deliveryPersonRooms   │
            └───────────┬───────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
│ canteen_C001 │ │counter_K01 │ │delivery_person │
│              │ │            │ │  _user@mail.com│
├──────────────┤ ├────────────┤ ├────────────────┤
│ socket_123   │ │socket_456  │ │ socket_789     │
│ socket_124   │ │socket_457  │ └────────────────┘
│ socket_125   │ └────────────┘
└──────────────┘

Event Flow: New Order
────────────────────────
1. POST /api/orders → Create order in MongoDB
2. broadcastNewOrder(canteenId, orderData)
3. io.to('canteen_C001').emit('orderUpdate', {
     type: 'new_order',
     data: orderData
   })
4. All sockets in room receive event
5. Client updates UI (React Query invalidation)

Event Flow: Counter Update
───────────────────────────
1. PATCH /api/orders/:id/item-status
2. broadcastToCounter(counterId, 'order_updated', data)
3. io.to('counter_K01').emit('orderUpdate', {
     type: 'order_updated',
     data: updatedOrder
   })
4. Counter interface refreshes order display
```

---

## 13. CROSS-REFERENCE INDEX

### Client-Server Data Flow

```
CLIENT ACTION                      API ENDPOINT                    DATABASE OPERATION
─────────────────────────────────────────────────────────────────────────────────────
User registration                  POST /api/users                 PostgreSQL: INSERT users
Google login                       POST /api/auth/google           PostgreSQL: INSERT/UPDATE users
Browse menu                        GET /api/menu?canteenId=X       MongoDB: MenuItem.find({ canteenId })
Add to cart                        (client-side only)              localStorage
Checkout                           POST /api/checkout-sessions     MongoDB: CheckoutSession.create()
Create payment                     POST /api/razorpay/create-order MongoDB: Payment.create()
Payment callback                   POST /api/razorpay/webhook      MongoDB: Order.create(), Payment.update()
Track order                        (WebSocket subscription)        MongoDB: Order.find()
Mark item ready                    PATCH /api/orders/:id/status    MongoDB: Order.updateOne()
Complete order (barcode)           POST /api/orders/:id/verify     MongoDB: Order.updateOne({ barcodeUsed: true })
View order history                 GET /api/orders?customerId=X    MongoDB: Order.find({ customerId })
Upload menu image                  POST /api/menu/:id/image        Cloudinary: upload(), MongoDB: MenuItem.update()
```

### Shared Type Definitions

**File**: `shared/schema.ts` (907 lines)

**Exported Types**:
- PostgreSQL types: `User`, `Prisma` (re-exported from `@prisma/client`)
- MongoDB types: `Category`, `MenuItem`, `Order`, `Payment`, `Notification`, etc.
- Insert types: `InsertUser`, `InsertMenuItem`, `InsertOrder`, etc.
- Validation schemas: Zod schemas for form validation

**Usage Pattern**:
```typescript
// Server
import { insertOrderSchema, type Order } from '@shared/schema';
const validated = insertOrderSchema.parse(req.body);

// Client
import { type MenuItem, type Order } from '@shared/schema';
const menuItems: MenuItem[] = await fetch('/api/menu').then(r => r.json());
```

---

## 14. NOTES & CAVEATS

### Known Limitations
1. **MongoDB Version Compatibility**: System detects MongoDB version at startup and adjusts transaction support. MongoDB 4.4 (Atlas free tier) runs without transactions.

2. **Redis Optional**: Redis is configured with a 3-retry limit. After failures, system falls back to in-memory caching.

3. **Single Port**: Server always runs on port 5000 (hardcoded). This is not configurable.

4. **Session Storage**: Express sessions use in-memory store (default). For production, should use Redis or MongoDB session store.

5. **File Upload Limits**:
   - Menu images: 100KB (compressed to 20KB)
   - Media banners: 50MB (compressed to 2MB)
   - JSON payload: 10MB

6. **WebSocket Reconnection**: Client must manually rejoin rooms after disconnect/reconnect.

7. **Offline Orders**: POS supports offline order creation, but requires manual payment confirmation later.

### Future Considerations (from TODOs in code)
- Review system not fully implemented (endpoint exists but returns empty array)
- Background sync for offline PWA submissions (queued but not processed)
- Email notification system (mentioned in admin panel, not implemented)
- Advanced analytics (basic metrics only)

### Performance Optimizations (from code comments)
- MongoDB connection pool: 200 max, 50 min (increased for scalability)
- Lazy Redis connection (only connect when needed)
- Checkout session debouncing (prevent duplicate broadcasts)
- Image compression before Cloudinary upload
- Manual chunking in Vite config (vendor, feature, context chunks)
- SSE removed (replaced with WebSocket for better scalability)

---

## END OF DOCUMENT

**Last Updated**: 2025-12-31  
**Extracted By**: Senior Software Architect (Automated System Extraction)  
**Source Commit**: Current HEAD (monorepo state at extraction time)  
**Backend Validation**: All features derived from implemented code, not specifications  
**Total Lines Analyzed**: ~50,000+ LOC across client, server, shared folders

# WebSocket Implementation - SilloBite Backend

**Extracted from**: Backend codebase analysis  
**Date**: 2026-01-03  
**Socket.IO Version**: v4

---

## Socket Overview

### Server Initialization

**File**: `server/websocket.ts` (lines 30-46)

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

// Initialized in server/index.ts at application startup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CLIENT_URL || 'https://your-domain.com'
      : ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,    // 60 seconds - if no pong received, disconnect
  pingInterval: 25000    // 25 seconds - send ping every 25s
});
```

**Startup Sequence** (`server/index.ts`):
```typescript
// Step 5 of application initialization
const server = http.createServer(app);
const webSocketManager = initializeWebSocket(server, app);
```

**WebSocket Manager Class**:
- **Pattern**: Singleton global instance
- **Architecture**: Room-based broadcasting
- **Connection Tracking**: Maps for users, rooms, and memberships

### Connection URL

- **Development**: `ws://localhost:5000` or `http://localhost:5000` (with polling fallback)
- **Production**: `wss://your-domain.com` or `https://your-domain.com`
- **Namespace**: Root (`/`) - no custom namespaces

### Transport Configuration

1. **Primary Transport**: WebSocket
2. **Fallback Transport**: HTTP long-polling
3. **Auto-upgrade**: Enabled (polling → WebSocket when available)

---

## Authentication

### Summary

**Authentication Status**: ❌ **NONE**

The WebSocket server has **NO authentication mechanism** implemented. Any client can:
- Connect to the server without credentials
- Join any canteen, counter, or delivery person room
- Receive all events broadcast to those rooms

### Evidence

**From** `server/websocket.ts` (lines 48-50):
```typescript
private setupEventHandlers(): void {
  this.io.on('connection', (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);
    // NO authentication check here
```

**Room Join Handler** (lines 53-104):
```typescript
socket.on('joinCanteenRooms', (data: any) => {
  const ids = Array.isArray(data) ? data : data.canteenIds || [];
  const userId = data.userId;  // Optional, not validated
  const userRole = data.userRole;  // Optional, not validated
  
  // NO verification that user owns these canteens
  // NO session validation
  // NO token verification
  
  ids.forEach(canteenId => {
    socket.join(`canteen_${canteenId}`);  // Join allowed for any ID
  });
});
```

### Security Documentation

**From** `android-spec/01-roles-and-permissions.md` (lines 772-829):

> **Actual Security**:
> - ProtectedRoute prevents honest users from accessing UI they shouldn't see
> - Backend has no defense against malicious actors
> - Anyone with curl can call any API endpoint
> - **Anyone with Socket.IO client can join any WebSocket room**

**Recommended (NOT IMPLEMENTED)**:
```typescript
// Example only - NOT in codebase
io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  // Validate sessionID against database
  // Attach user info to socket.data.user
  next();
});
```

### Print Agent Authentication (Separate Namespace)

**Exception**: Print Agent WebSocket (`/agent` namespace) **DOES** have authentication:

**File**: `server/services/printAgentService.ts` (lines 85-105)

```typescript
const auth = socket.handshake.auth;
const { agentId, outletId, apiKey } = auth;

// Validate authentication
if (!agentId || !outletId || !apiKey) {
  socket.emit('error', { message: 'Authentication required', code: 'AUTH_REQUIRED' });
  socket.disconnect();
  return;
}

// Verify against database
const agent = await PrintAgent.findOne({ agentId, outletId });
if (!agent || agent.apiKey !== apiKey) {
  socket.emit('error', { message: 'Invalid credentials' });
  socket.disconnect();
  return;
}
```

**Note**: This authentication only applies to the Print Agent namespace (`/agent`), not the main WebSocket connection.

---

## Rooms

### Room Architecture

**Room Types** (3 total):

| Room Type | Pattern | Purpose | Subscribers |
|-----------|---------|---------|-------------|
| **Canteen Rooms** | `canteen_{canteenId}` | Order updates, payment events, menu changes | Canteen owners, staff, customers |
| **Counter Rooms** | `counter_{counterId}` | Targeted order routing, item status updates | Counter operators (store, payment, KOT) |
| **Delivery Person Rooms** | `delivery_person_{email}` | Delivery assignments, pickup notifications | Individual delivery personnel |

### Room Tracking Data Structures

**File**: `server/websocket.ts` (lines 25-28)

```typescript
class WebSocketManager {
  private connectedUsers: Map<string, SocketUser> = new Map();
  private canteenRooms: Map<string, Set<string>> = new Map(); // canteenId -> Set<socketId>
  private counterRooms: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private deliveryPersonRooms: Map<string, Set<string>> = new Map(); // email -> Set<socketId>
}
```

**SocketUser Interface** (lines 6-13):
```typescript
export interface SocketUser {
  socketId: string;
  userId?: string;        // Optional, not validated
  userRole?: string;      // Optional, not validated
  canteenIds: string[];   // Canteens user joined
  counterIds: string[];   // Counters user joined
  connectedAt: Date;
}
```

### Room Join/Leave Events

#### 1. Join Canteen Rooms

**Client → Server**: `joinCanteenRooms`

**Payload**:
```typescript
// Option 1: Array format (legacy)
string[]

// Option 2: Object format
{
  canteenIds: string[];
  userId?: string;
  userRole?: string;
}
```

**Server Response**: `roomJoined`
```typescript
{
  type: 'connected',
  message: 'Successfully joined canteen rooms',
  canteenIds: string[],
  connectedAt: Date
}
```

**Example**:
```typescript
socket.emit('joinCanteenRooms', {
  canteenIds: ['canteen-1', 'canteen-2'],
  userId: '123',
  userRole: 'owner'
});
```

#### 2. Leave Canteen Rooms

**Client → Server**: `leaveCanteenRooms`

**Payload**:
```typescript
{
  canteenIds: string[]
}
```

**Server Response**: `left_room`
```typescript
{
  canteenIds: string[]
}
```

#### 3. Join Counter Room

**Client → Server**: `joinCounterRoom`

**Payload**:
```typescript
{
  counterId: string;   // e.g., "counter-store-1", "counter-payment-2"
  canteenId: string;
}
```

**Server Response**: `counterRoomJoined`
```typescript
{
  type: 'counter_connected',
  message: 'Successfully joined counter room',
  counterId: string,
  canteenId: string
}
```

#### 4. Leave Counter Room

**Client → Server**: `leaveCounterRoom`

**Payload**:
```typescript
{
  counterId: string
}
```

**Server Response**: `counterRoomLeft`
```typescript
{
  counterId: string
}
```

#### 5. Join Delivery Person Room

**Client → Server**: `joinDeliveryPersonRoom`

**Payload**:
```typescript
{
  email: string  // Delivery person email (unique identifier)
}
```

**Server Response**: `deliveryPersonRoomJoined`
```typescript
{
  email: string
}
```

#### 6. Leave Delivery Person Room

**Client → Server**: `leaveDeliveryPersonRoom`

**Payload**:
```typescript
{
  email: string
}
```

**Server Response**: None

### Disconnect Handling

**File**: `server/websocket.ts` (lines 220-223, 284-322)

```typescript
// Automatic cleanup on disconnect
socket.on('disconnect', (reason) => {
  console.log(`📡 Client disconnected: ${socket.id}, reason: ${reason}`);
  this.handleDisconnection(socket.id);
});

private handleDisconnection(socketId: string): void {
  const userInfo = this.connectedUsers.get(socketId);
  if (!userInfo) return;
  
  // Remove from all canteen rooms
  userInfo.canteenIds.forEach(canteenId => {
    const roomMembers = this.canteenRooms.get(canteenId);
    if (roomMembers) {
      roomMembers.delete(socketId);
      if (roomMembers.size === 0) {
        this.canteenRooms.delete(canteenId);  // Cleanup empty room
      }
    }
  });
  
  // Remove from all counter rooms
  userInfo.counterIds.forEach(counterId => {
    const roomMembers = this.counterRooms.get(counterId);
    if (roomMembers) {
      roomMembers.delete(socketId);
      if (roomMembers.size === 0) {
        this.counterRooms.delete(counterId);
      }
    }
  });
  
  // Remove from delivery person rooms
  for (const [email, members] of this.deliveryPersonRooms.entries()) {
    if (members.has(socketId)) {
      members.delete(socketId);
      if (members.size === 0) {
        this.deliveryPersonRooms.delete(email);
      }
    }
  }
  
  this.connectedUsers.delete(socketId);
  console.log(`🧹 Cleaned up disconnected user: ${socketId}`);
}
```

**Disconnect Reasons**:
- `transport close` - Network interruption
- `client namespace disconnect` - Client called `socket.disconnect()`
- `ping timeout` - No pong received within 60 seconds
- `transport error` - WebSocket/polling transport failure

---

## Events

### Event Overview

**Primary Event Channel**: `orderUpdate`

All order-related events are broadcast through the `orderUpdate` event with different `type` fields.

### Event Types

| Event Type | Description | Target Room(s) |
|------------|-------------|----------------|
| `new_order` | New order placed | Canteen + Counter rooms |
| `new_offline_order` | New offline order placed | Canteen + Counter rooms |
| `order_updated` | Order modified (items, amount) | Canteen room |
| `order_status_changed` | Order status transition | Canteen room |
| `item_status_changed` | Item-level status (mark ready) | Canteen room |
| `payment_confirmed` | Payment confirmed by counter | Canteen room |
| `payment_success` | Payment gateway success | Canteen room |
| `order_rejected` | Order rejected by counter | Canteen room |
| `checkout_session_status_changed` | Checkout timer update | Canteen room |
| `banner_updated` | Media banner changed | All clients |
| `menu_updated` | Menu items modified | All clients |

### OrderUpdate Event Structure

**File**: `server/websocket.ts` (lines 15-21)

```typescript
export interface OrderUpdateData {
  type: 'new_order' | 'order_updated' | 'order_status_changed' | 'banner_updated' | 'payment_success';
  data: any;                // Order object or relevant payload
  oldStatus?: string;       // Previous status (for status changes)
  newStatus?: string;       // New status (for status changes)
  orderNumber?: string;     // Order number for reference
}
```

**Extended Payload** (from client type definitions):
```typescript
interface OrderUpdateMessage {
  type: 
    | 'new_order' 
    | 'new_offline_order'
    | 'order_updated' 
    | 'order_status_changed' 
    | 'item_status_changed'
    | 'payment_success' 
    | 'payment_confirmed'
    | 'order_rejected'
    | 'checkout_session_status_changed'
    | 'banner_updated'
    | 'menu_updated';
  data: any;                          // Order object or relevant data
  oldStatus?: string;                 // Previous status
  newStatus?: string;                 // New status
  orderNumber?: string;               // Order number
  confirmedByCounter?: string;        // Counter that confirmed payment
  rejectedByCounter?: string;         // Counter that rejected order
  counterId?: string;                 // Target counter ID
  itemStatusByCounter?: Record<string, any>;
  sessionId?: string;                 // Checkout session ID
  timeRemaining?: number;             // Checkout session time (seconds)
  status?: string;                    // Checkout session status
  message?: string;                   // Human-readable message
}
```

### New Order Event

**Trigger**: Order created via API (`POST /api/orders`)

**Server Broadcast** (`server/routes.ts` lines 2847, `websocket.ts` lines 325-343):

```typescript
// Broadcast to canteen room
wsManager.broadcastNewOrder(order.canteenId, order);

// Implementation
public broadcastNewOrder(canteenId: string, orderData: any): void {
  const roomName = `canteen_${canteenId}`;
  const roomMembers = this.canteenRooms.get(canteenId);
  
  if (roomMembers && roomMembers.size > 0) {
    const message: OrderUpdateData = {
      type: 'new_order',
      data: orderData,
      orderNumber: orderData.orderNumber
    };
    
    this.io.to(roomName).emit('orderUpdate', message);
    console.log(`📢 Broadcasted new order ${orderData.orderNumber} to room ${roomName} (${roomMembers.size} clients)`);
  }
}
```

**Additional Counter Broadcast** (`server/routes.ts` lines 2850-2852):
```typescript
// Also broadcast to store counter rooms
order.allStoreCounterIds?.forEach(counterId => {
  wsManager.broadcastToCounter(counterId, 'new_order', order);
});
```

**Received by Clients** (`client/src/hooks/useWebSocket.ts` lines 280-287):
```typescript
socket.on('orderUpdate', (message: WebSocketMessage) => {
  switch (message.type) {
    case 'new_order':
      onNewOrder?.(message.data);
      break;
    case 'new_offline_order':
      onNewOrder?.(message.data);  // Same handler
      break;
```

### Order Status Changed Event

**Trigger**: Order status updated via API (`PUT /api/orders/:id`)

**Server Broadcast** (`websocket.ts` lines 346-366):

```typescript
public broadcastOrderStatusUpdate(
  canteenId: string, 
  orderData: any, 
  oldStatus: string, 
  newStatus: string
): void {
  const roomName = `canteen_${canteenId}`;
  const roomMembers = this.canteenRooms.get(canteenId);
  
  if (roomMembers && roomMembers.size > 0) {
    const message: OrderUpdateData = {
      type: 'order_status_changed',
      data: orderData,
      oldStatus,
      newStatus,
      orderNumber: orderData.orderNumber
    };
    
    this.io.to(roomName).emit('orderUpdate', message);
    console.log(`📢 Broadcasted status update for order ${orderData.orderNumber} to room ${roomName}`);
  }
}
```

**Client Handler** (`client/src/hooks/useWebSocket.ts` lines 293-301):
```typescript
case 'order_updated':
case 'order_status_changed':
  onOrderUpdate?.(message.data);
  if (message.oldStatus && message.newStatus) {
    onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
  }
  break;
```

**Status Transition Flow**:
```
pending → preparing → ready → out_for_delivery → delivered → completed
```

### Payment Confirmed Event

**Trigger**: Counter confirms offline payment (`PUT /api/orders/:id/payment-status`)

**Server Broadcast** (`server/routes.ts` lines 6675-6685):

```typescript
// Multiple broadcasts for payment confirmation
wsManager.broadcastNewOrder(order.canteenId, updatedOrder);

wsManager.broadcastToCanteen(order.canteenId, 'payment_confirmed', {
  order: updatedOrder,
  orderId
});

wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder);
```

**Why Multiple Events?**: Backward compatibility - different dashboard components listen to different event types.

### Checkout Session Status Changed Event

**Trigger**: Checkout timer countdown (`server/routes.ts` checkout session endpoints)

**Server Broadcast** (`websocket.ts` lines 379-444):

```typescript
public broadcastCheckoutSessionStatus(
  sessionId: string, 
  status: string, 
  timeRemaining: number, 
  canteenId?: string
): void {
  const now = Date.now();
  const BROADCAST_DEBOUNCE_MS = 2000;
  const TIME_CHANGE_THRESHOLD = 5;

  // Debounce logic - skip if:
  // 1. Last broadcast was < 2 seconds ago AND
  // 2. Time remaining changed by < 5 seconds
  const cached = this.checkoutSessionBroadcastCache.get(sessionId);
  if (cached) {
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);
    
    if (timeSinceLastBroadcast < BROADCAST_DEBOUNCE_MS && timeRemainingDiff < TIME_CHANGE_THRESHOLD) {
      return;  // Skip duplicate broadcast
    }
  }
  
  this.checkoutSessionBroadcastCache.set(sessionId, {
    lastBroadcast: now,
    lastTimeRemaining: timeRemaining
  });
  
  const message = {
    type: 'checkout_session_status_changed',
    sessionId,
    status,
    timeRemaining,
    data: { sessionId, status, timeRemaining }
  };
  
  if (canteenId) {
    this.io.to(`canteen_${canteenId}`).emit('orderUpdate', message);
  } else {
    this.io.emit('orderUpdate', message);  // Fallback to all clients
  }
}
```

**Debouncing Strategy**:
- Prevents excessive broadcasts during countdown
- Only broadcast if time changed by ≥5 seconds OR 2 seconds elapsed
- Cache cleanup: Remove entries older than 5 minutes

### Delivery Assignment Event

**Trigger**: Order assigned to delivery person (`PUT /api/orders/:id/assign-delivery-person`)

**Event Channel**: `deliveryAssignment` (separate from `orderUpdate`)

**Server Broadcast** (`server/routes.ts` lines 8130-8167):

```typescript
wsManager.broadcastToDeliveryPerson(deliveryPersonEmail, {
  type: 'delivery_assignment',
  data: {
    orderId: orderIdForMessage,
    orderNumber: result.orderNumber,
    customerName: result.customerName,
    amount: result.amount,
    items: result.items,
    address: result.address || 'Pickup from canteen',
    createdAt: result.createdAt,
    status: 'out_for_delivery',
    deliveryPersonId: deliveryPersonId
  }
});
```

**Implementation** (`websocket.ts` lines 537-558):

```typescript
public broadcastToDeliveryPerson(deliveryPersonEmail: string, message: any): void {
  const roomName = `delivery_person_${deliveryPersonEmail}`;
  const roomMembers = this.deliveryPersonRooms.get(deliveryPersonEmail);
  
  if (roomMembers && roomMembers.size > 0) {
    this.io.to(roomName).emit('deliveryAssignment', message);
    console.log(`🚚 ✅ Successfully broadcasted message to delivery person ${deliveryPersonEmail}`);
  } else {
    console.log(`📡 ❌ No clients in delivery person room ${roomName}`);
  }
}
```

### Ping/Pong Health Check

**Client → Server**: `ping`

**Server → Client**: `pong`

**Handler** (`websocket.ts` lines 215-217):
```typescript
socket.on('ping', () => {
  socket.emit('pong', { timestamp: Date.now() });
});
```

**Purpose**: Manual keepalive mechanism in addition to Socket.IO's built-in ping/pong

---

## Order Payload (JSON Example)

### Order Data Model

**Source**: `server/models/mongodb-models.ts` (lines 145-202)

```typescript
interface IOrder {
  orderNumber: string;              // Unique order identifier (e.g., "ORD-20260103-001")
  customerId?: number;              // PostgreSQL user ID (optional)
  customerName: string;             // Customer display name
  collegeName?: string;             // College name (if applicable)
  items: string;                    // JSON string of order items
  amount: number;                   // Total order amount (₹)
  itemsSubtotal?: number;           // Subtotal before taxes/charges
  taxAmount?: number;               // Tax amount (e.g., 5% GST)
  chargesTotal?: number;            // Total additional charges
  chargesApplied?: Array<{          // Breakdown of charges
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
  }>;
  originalAmount?: number;          // Amount before discount
  discountAmount?: number;          // Discount applied
  appliedCoupon?: string;           // Coupon code used
  status: string;                   // Order status (see below)
  estimatedTime: number;            // Estimated preparation time (minutes)
  barcode: string;                  // Unique barcode for order pickup
  barcodeUsed: boolean;             // Whether barcode has been scanned
  deliveredAt?: Date;               // Delivery/completion timestamp
  seenBy?: number[];                // User IDs who viewed this order
  canteenId: string;                // Canteen ID (MongoDB ObjectId)
  counterId?: string;               // Counter ID (generic)
  storeCounterId?: string;          // Store counter ID
  paymentCounterId?: string;        // Payment counter ID
  kotCounterId?: string;            // KOT counter ID
  paymentConfirmedBy?: string;      // Counter that confirmed payment
  rejectedBy?: string;              // Counter that rejected order
  allStoreCounterIds?: string[];    // All store counters for this order
  allPaymentCounterIds?: string[];  // All payment counters
  allKotCounterIds?: string[];      // All KOT counters
  allCounterIds?: string[];         // All counters combined
  isOffline?: boolean;              // Offline order flag
  paymentStatus?: string;           // 'PENDING', 'PAID', etc.
  paymentMethod?: string;           // 'online', 'offline', 'upi', 'cash'
  qrId?: string;                    // Razorpay QR code ID
  paymentId?: string;               // Razorpay payment ID
  isCounterOrder?: boolean;         // Counter-initiated order
  itemStatusByCounter?: {           // Item-level status per counter
    [counterId: string]: {
      [itemId: string]: 'pending' | 'ready' | 'completed'
    }
  };
  deliveryPersonId?: string;        // Assigned delivery person ID
  orderType?: 'delivery' | 'takeaway';
  deliveryAddress?: {               // Delivery address (if orderType=delivery)
    label?: string;
    fullName?: string;
    phoneNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  createdAt: Date;                  // Order creation timestamp
}
```

### Order Status Values

**Possible Status Values** (source: `server/routes.ts` order update endpoints):

```typescript
'pending'            // Order placed, awaiting confirmation
'preparing'          // Order confirmed, being prepared
'ready'              // Order ready for pickup/delivery
'out_for_delivery'   // Order assigned to delivery person
'delivered'          // Order delivered to customer
'completed'          // Order lifecycle complete
'cancelled'          // Order cancelled by customer/owner
```

### Items Field Structure

**Format**: JSON string (not object)

**Example** (parsed):
```json
[
  {
    "id": "6789abcdef012345",
    "name": "Chicken Biryani",
    "quantity": 2,
    "price": 150,
    "customization": "Extra spicy, no onions",
    "addons": [
      {
        "id": "addon-1",
        "name": "Raita",
        "price": 30
      }
    ]
  },
  {
    "id": "6789abcdef012346",
    "name": "Masala Dosa",
    "quantity": 1,
    "price": 80,
    "customization": null,
    "addons": []
  }
]
```

**Note**: When transmitted via WebSocket, `items` is a JSON string. Clients must parse it:
```typescript
const itemsArray = JSON.parse(orderData.items);
```

### Complete Order Payload Example

**WebSocket Event**:
```json
{
  "type": "new_order",
  "orderNumber": "ORD-20260103-001",
  "data": {
    "orderNumber": "ORD-20260103-001",
    "customerId": 12345,
    "customerName": "Rajesh Kumar",
    "collegeName": "IIT Delhi",
    "items": "[{\"id\":\"6789abcdef012345\",\"name\":\"Chicken Biryani\",\"quantity\":2,\"price\":150,\"customization\":\"Extra spicy\",\"addons\":[{\"id\":\"addon-1\",\"name\":\"Raita\",\"price\":30}]}]",
    "amount": 330,
    "itemsSubtotal": 300,
    "taxAmount": 15,
    "chargesTotal": 15,
    "chargesApplied": [
      {
        "name": "Packaging Charge",
        "type": "fixed",
        "value": 10,
        "amount": 10
      },
      {
        "name": "Service Tax",
        "type": "percent",
        "value": 5,
        "amount": 15
      }
    ],
    "originalAmount": 330,
    "discountAmount": 0,
    "appliedCoupon": null,
    "status": "preparing",
    "estimatedTime": 15,
    "barcode": "BRC-20260103-001-XYZ",
    "barcodeUsed": false,
    "deliveredAt": null,
    "seenBy": [],
    "canteenId": "60f7b3e4e5a1234567890abc",
    "counterId": null,
    "storeCounterId": "counter-store-1",
    "paymentCounterId": "counter-payment-1",
    "kotCounterId": "counter-kot-1",
    "allStoreCounterIds": ["counter-store-1"],
    "allPaymentCounterIds": ["counter-payment-1"],
    "allKotCounterIds": ["counter-kot-1"],
    "allCounterIds": ["counter-store-1", "counter-payment-1", "counter-kot-1"],
    "isOffline": false,
    "paymentStatus": "PAID",
    "paymentMethod": "online",
    "qrId": null,
    "paymentId": "pay_abc123xyz",
    "isCounterOrder": false,
    "itemStatusByCounter": {},
    "deliveryPersonId": null,
    "orderType": "takeaway",
    "deliveryAddress": null,
    "createdAt": "2026-01-03T07:30:00.000Z",
    "_id": "60f7b3e4e5a1234567890xyz"
  }
}
```

### Order Status Change Payload Example

```json
{
  "type": "order_status_changed",
  "data": {
    "orderNumber": "ORD-20260103-001",
    "status": "ready",
    "estimatedTime": 0,
    "canteenId": "60f7b3e4e5a1234567890abc",
    "_id": "60f7b3e4e5a1234567890xyz",
    "...": "... (other order fields)"
  },
  "oldStatus": "preparing",
  "newStatus": "ready",
  "orderNumber": "ORD-20260103-001"
}
```

### Payment Confirmed Payload Example

```json
{
  "type": "payment_confirmed",
  "data": {
    "order": {
      "orderNumber": "ORD-20260103-002",
      "paymentStatus": "PAID",
      "paymentConfirmedBy": "counter-payment-1",
      "...": "... (full order object)"
    },
    "orderId": "60f7b3e4e5a1234567890xyz"
  }
}
```

---

## Reconnect and Disconnect Handling

### Automatic Reconnection

**Handled by Socket.IO Client** (built-in):
- **Reconnection Strategy**: Exponential backoff
- **Initial Delay**: 1 second
- **Max Delay**: 5 seconds
- **Max Attempts**: Infinity (default)

**Android Implementation** (`android/app/src/main/java/.../SocketManager.kt` lines 84-88):
```kotlin
val options = IO.Options().apply {
  reconnection = true
  reconnectionDelay = calculateReconnectDelay()  // Custom calculation
  reconnectionDelayMax = 8000  // Max 8 seconds
  reconnectionAttempts = 10    // Max 10 attempts
}
```

**Custom Backoff Calculation** (`SocketManager.kt`):
```kotlin
private fun calculateReconnectDelay(): Long {
  val baseDelay = 1000L  // 1 second
  val maxDelay = 8000L   // 8 seconds
  val delay = baseDelay * (2.0.pow(reconnectAttempts.toDouble())).toLong()
  return delay.coerceAtMost(maxDelay)
}
```

**Reconnection Sequence**:
1. Connection lost → Socket.IO detects transport closure
2. Wait for backoff delay (1s, 2s, 4s, 8s, 8s, ...)
3. Attempt to reconnect
4. On success → Fire `connect` event
5. Client must re-join rooms manually (see below)

### Manual Room Rejoin

**CRITICAL**: Rooms are **NOT automatically rejoined** after reconnection.

**Client Responsibility** (`client/src/hooks/useWebSocket.ts` lines 164-170):
```typescript
socket.on('connect', () => {
  console.log('🔌 Socket connected:', socket.id);
  
  // Re-join rooms after reconnection
  if (canteenIds && canteenIds.length > 0) {
    socket.emit('joinCanteenRooms', canteenIds);
  }
});
```

**Android Implementation Pattern**:
```kotlin
socket?.on(Socket.EVENT_CONNECT) {
  Log.d(TAG, "Socket connected: ${socket?.id()}")
  
  // Re-join canteen rooms
  userCanteenIds?.let { ids ->
    socket?.emit("joinCanteenRooms", JSONObject().apply {
      put("canteenIds", JSONArray(ids))
      put("userId", userId)
      put("userRole", userRole)
    })
  }
  
  // Re-join counter room if applicable
  currentCounterId?.let { counterId ->
    socket?.emit("joinCounterRoom", JSONObject().apply {
      put("counterId", counterId)
      put("canteenId", canteenId)
    })
  }
}
```

### Disconnect Event Handling

**Server Side** (`websocket.ts` lines 220-223):
```typescript
socket.on('disconnect', (reason) => {
  console.log(`📡 Client disconnected: ${socket.id}, reason: ${reason}`);
  this.handleDisconnection(socket.id);
});
```

**Disconnect Reasons**:

| Reason | Description | Reconnect? |
|--------|-------------|------------|
| `transport close` | Network interruption | Yes (auto) |
| `client namespace disconnect` | Client called `disconnect()` | No (manual) |
| `ping timeout` | No pong received (60s) | Yes (auto) |
| `transport error` | WebSocket/polling error | Yes (auto) |
| `server namespace disconnect` | Server forced disconnect | Yes (auto) |

**Client Handling** (`client/src/hooks/useWebSocket.ts` lines 173-184):
```typescript
socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Server explicitly disconnected - reconnect manually
    socket.connect();
  }
  // Otherwise, Socket.IO will auto-reconnect
});
```

### Connection State Management

**Android Connection States** (`SocketManager.kt`):
```kotlin
sealed class ConnectionState {
  object Disconnected : ConnectionState()
  object Connecting : ConnectionState()
  object Connected : ConnectionState()
  data class Error(val message: String) : ConnectionState()
}
```

**State Flow**:
```
Disconnected → Connecting → Connected
     ↑            ↓            ↓
     ←←←←←←←← Error ←←←←←←←←←←
```

### Keepalive / Heartbeat

**Socket.IO Built-in Ping/Pong**:
- **Server → Client Ping**: Every 25 seconds
- **Client → Server Pong**: Immediate response
- **Timeout**: 60 seconds (if no pong, disconnect)

**Manual Keepalive** (optional, implemented by client):
```typescript
// Client sends manual ping
setInterval(() => {
  socket.emit('ping');
}, 15000);  // Every 15 seconds

// Server responds with pong
socket.on('pong', (data) => {
  console.log('Received pong:', data.timestamp);
});
```

**Android Spec** (`android-spec/05-socket-events.md`):
> - **Ping Interval**: 25 seconds (server) / 15 seconds (client keepalive)
> - **Ping Timeout**: 60 seconds

### Fallback Mechanisms

**When WebSocket Disconnected** (`android-spec/08-realtime-consistency.md` lines 70-74):

```
RECOVERY MECHANISMS:
• Fallback polling when WebSocket disconnected
• React Query cache invalidation on reconnect
• User manual refresh (pull-to-refresh)
• Keepalive ping/pong (15s interval, 30s timeout)
```

**No Event Replay**: 
- Events missed during disconnection are **NOT replayed**
- Client must fetch latest data via REST API on reconnect

---

## Additional Notes

### Print Agent WebSocket (Separate System)

**Namespace**: `/agent`  
**URL**: `wss://your-domain.com/agent`

**Authentication**: ✅ **YES** (agentId + apiKey)

**Purpose**: Thermal printer communication

**File**: `server/services/printAgentService.ts`

**Events**:
- `agent:register` - Register print agent
- `print:job` - Send print job to agent
- `print:ack` - Acknowledge print completion
- `ping` / `pong` - Health check

**Not covered in this document** - separate system for hardware integration.

### Event Ordering Guarantees

**Within Same Room**:
- Events are delivered in order (Socket.IO guarantee)
- Sequential broadcasts to same room maintain order

**Across Different Rooms**:
- No ordering guarantee
- Events may arrive out of order

**Status Transitions**:
- Server enforces valid state transitions
- Client should handle out-of-order messages gracefully

### Duplicate Event Handling

**Server Side**:
- **Checkout session updates**: Debounced (2s interval, 5s time change)
- **Other events**: No deduplication

**Client Responsibility**:
- Must implement idempotent handlers
- Use `orderNumber` or `_id` to detect duplicates
- Consider using `seenBy` field to track processed orders

### Broadcast Performance

**Optimizations**:
- Room-based targeting (avoid broadcasting to all clients)
- Debouncing for high-frequency events (checkout timers)
- Cache cleanup for old session data

**Limitations**:
- No message queuing (missed events are lost)
- No persistent event store
- No event replay on reconnect

### WebSocket Statistics API

**Endpoint**: Available via `getStats()` method

```typescript
{
  totalConnections: number;
  canteenRooms: { [canteenId: string]: number };
  counterRooms: { [counterId: string]: number };
  userRoles: { [role: string]: number };
}
```

---

## Summary

### Key Findings

1. **No Authentication**: WebSocket server is completely open - anyone can connect and join any room
2. **Room-Based Architecture**: 3 room types (canteen, counter, delivery person)
3. **Single Event Channel**: All order events broadcast via `orderUpdate` event with different `type` fields
4. **No Event Replay**: Missed events during disconnection are lost forever
5. **Manual Rejoin Required**: Clients must re-join rooms after reconnection
6. **Debounced Broadcasts**: Checkout session updates use debouncing to reduce load

### Implementation Checklist for Android

- [x] Connect to WebSocket server (no auth needed)
- [x] Join canteen rooms after connection
- [x] Listen to `orderUpdate` event
- [x] Parse `type` field to determine event type
- [x] Parse `items` JSON string in order data
- [x] Handle reconnection (re-join rooms)
- [x] Implement keepalive ping/pong
- [x] Handle disconnect gracefully
- [ ] Implement duplicate event detection
- [ ] Fallback polling on disconnect
- [ ] Cache invalidation on reconnect

---

**End of WebSocket Extraction**

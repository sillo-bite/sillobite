# Socket.IO Events Specification

**Version**: 1.0  
**Last Updated**: 2026-01-02

---

## Table of Contents

1. [Overview](#overview)
2. [Connection Architecture](#connection-architecture)
3. [Client-to-Server Events](#client-to-server-events)
4. [Server-to-Client Events](#server-to-client-events)
5. [Event Trigger Conditions](#event-trigger-conditions)
6. [Event Ordering Guarantees](#event-ordering-guarantees)
7. [Duplicate Delivery Handling](#duplicate-delivery-handling)
8. [Failure Impact Analysis](#failure-impact-analysis)
9. [Reconnection Behavior](#reconnection-behavior)
10. [Appendices](#appendices)

---

## Overview

The system uses **Socket.IO v4** for real-time bidirectional communication. The architecture is **room-based**, enabling targeted broadcasting to specific contexts (canteens, counters, delivery personnel).

### Transport Configuration

- **Primary Transport**: WebSocket
- **Fallback Transport**: HTTP long-polling
- **Ping Interval**: 25 seconds (server) / 15 seconds (client keepalive)
- **Ping Timeout**: 60 seconds
- **Auto-Reconnect**: Handled manually by client with exponential backoff
- **Max Reconnect Attempts**: 10

### CORS Configuration

```typescript
{
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}
```

---

## Connection Architecture

### Room Types

1. **Canteen Rooms**: `canteen_{canteenId}`
   - Subscribers: Canteen owners, staff, customers viewing orders
   - Purpose: Broadcast order updates, payment confirmations, menu changes

2. **Counter Rooms**: `counter_{counterId}`
   - Subscribers: Counter operators (store, payment, KOT)
   - Purpose: Targeted order routing, item status updates

3. **Delivery Person Rooms**: `delivery_person_{email}`
   - Subscribers: Individual delivery personnel
   - Purpose: Delivery assignments, order pickup notifications

### Connection Tracking

Server maintains:
- `Map<socketId, SocketUser>` - Connected users with metadata
- `Map<canteenId, Set<socketId>>` - Canteen room membership
- `Map<counterId, Set<socketId>>` - Counter room membership
- `Map<deliveryPersonEmail, Set<socketId>>` - Delivery person room membership

```typescript
interface SocketUser {
  socketId: string;
  userId?: string;
  userRole?: string;
  canteenIds: string[];
  counterIds: string[];
  connectedAt: Date;
}
```

---

## Client-to-Server Events

### 1. `joinCanteenRooms`

**Description**: Join one or more canteen-specific rooms to receive order and menu updates.

**Emitter**: Client

**Trigger Conditions**:
- User logs in or switches canteen context
- Component mount (e.g., canteen dashboard, user order list)
- Automatic on socket connection if canteenIds provided

**Payload Schema**:

```typescript
{
  canteenIds: string[];      // Array of canteen IDs to join
  userId?: string;           // Optional user ID for tracking
  userRole?: string;         // Optional role: 'owner', 'staff', 'student', etc.
}

// Legacy format (backward compatible)
string[]  // Direct array of canteen IDs
```

**Client-Side Emission**:

```typescript
// From useWebSocket.ts:184
socket.emit('joinCanteenRooms', canteenIds);

// Or with full payload:
socket.emit('joinCanteenRooms', {
  canteenIds: ['canteen-1', 'canteen-2'],
  userId: '123',
  userRole: 'owner'
});
```

**Server-Side Handler**:

```typescript
// From websocket.ts:53-104
socket.on('joinCanteenRooms', (data: any) => {
  // Handle both array and object formats
  const ids = Array.isArray(data) ? data : data.canteenIds || [];
  const userId = data.userId;
  const userRole = data.userRole;
  
  // Store user information
  connectedUsers.set(socket.id, {
    socketId: socket.id,
    userId,
    userRole,
    canteenIds: ids,
    counterIds: [],
    connectedAt: new Date()
  });
  
  // Join canteen rooms
  ids.forEach(canteenId => {
    const roomName = `canteen_${canteenId}`;
    socket.join(roomName);
    canteenRooms.get(canteenId)?.add(socket.id);
  });
  
  // Send confirmation
  socket.emit('roomJoined', {
    type: 'connected',
    message: 'Successfully joined canteen rooms',
    canteenIds: ids,
    connectedAt: new Date()
  });
});
```

**Response Event**: [`roomJoined`](#roomjoined)

**Failure Scenarios**:
- Invalid canteenIds format → Error emitted via `error` event
- Server error during room join → Error emitted

**Duplicate Handling**: **Idempotent** - Joining same room multiple times has no side effects

**Ordering Assumptions**: Should be first event after connection established

**Impact if Missed**: User won't receive real-time order updates for that canteen

---

### 2. `leaveCanteenRooms`

**Description**: Leave one or more canteen-specific rooms.

**Emitter**: Client

**Trigger Conditions**:
- User switches to different canteen context
- User logs out
- Component unmount (cleanup)

**Payload Schema**:

```typescript
{
  canteenIds: string[]
}
```

**Client-Side Emission**:

```typescript
// From useWebSocket.ts:397
socket.emit('leaveCanteenRooms', [canteenId]);
```

**Server-Side Handler**:

```typescript
// From websocket.ts:107-137
socket.on('leaveCanteenRooms', (data: { canteenIds: string[] }) => {
  const { canteenIds } = data;
  
  canteenIds.forEach(canteenId => {
    const roomName = `canteen_${canteenId}`;
    socket.leave(roomName);
    
    // Update tracking
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.canteenIds = userInfo.canteenIds.filter(id => id !== canteenId);
    }
    
    const roomMembers = canteenRooms.get(canteenId);
    if (roomMembers) {
      roomMembers.delete(socket.id);
      if (roomMembers.size === 0) {
        canteenRooms.delete(canteenId);
      }
    }
  });
  
  socket.emit('left_room', { canteenIds });
});
```

**Response Event**: [`left_room`](#left_room)

**Failure Scenarios**: None (graceful handling)

**Duplicate Handling**: **Idempotent**

**Ordering Assumptions**: None

**Impact if Missed**: User continues receiving updates for canteen they left (minor memory leak)

---

### 3. `joinCounterRoom`

**Description**: Join a counter-specific room to receive orders routed to that counter.

**Emitter**: Client (Counter role)

**Trigger Conditions**:
- Counter operator opens counter view
- Counter selection in POS interface

**Payload Schema**:

```typescript
{
  counterId: string;   // e.g., "counter-store-1", "counter-payment-2", "counter-kot-3"
  canteenId: string;   // Parent canteen ID
}
```

**Client-Side Emission**:

```typescript
// From useWebSocket.ts:405
socket.emit('joinCounterRoom', { counterId, canteenId });
```

**Server-Side Handler**:

```typescript
// From websocket.ts:140-181
socket.on('joinCounterRoom', (data: { counterId: string; canteenId: string }) => {
  const { counterId, canteenId } = data;
  const roomName = `counter_${counterId}`;
  
  socket.join(roomName);
  
  // Track room membership
  if (!counterRooms.has(counterId)) {
    counterRooms.set(counterId, new Set());
  }
  counterRooms.get(counterId)!.add(socket.id);
  
  // Update user info
  const userInfo = connectedUsers.get(socket.id);
  if (userInfo && !userInfo.counterIds.includes(counterId)) {
    userInfo.counterIds.push(counterId);
  }
  
  socket.emit('counterRoomJoined', {
    type: 'counter_connected',
    message: 'Successfully joined counter room',
    counterId,
    canteenId
  });
});
```

**Response Event**: [`counterRoomJoined`](#counterroomjoined)

**Failure Scenarios**:
- Invalid counterId → Error emitted
- Server error → Error emitted

**Duplicate Handling**: **Idempotent**

**Ordering Assumptions**: After `joinCanteenRooms`

**Impact if Missed**: Counter operator won't receive order assignments for that counter

---

### 4. `leaveCounterRoom`

**Description**: Leave a counter-specific room.

**Emitter**: Client (Counter role)

**Trigger Conditions**:
- Counter operator closes counter view
- Component unmount

**Payload Schema**:

```typescript
{
  counterId: string
}
```

**Client-Side Emission**:

```typescript
// From useWebSocket.ts:413
socket.emit('leaveCounterRoom', { counterId });
```

**Server-Side Handler**:

```typescript
// From websocket.ts:184-212
socket.on('leaveCounterRoom', (data: { counterId: string }) => {
  const { counterId } = data;
  const roomName = `counter_${counterId}`;
  
  socket.leave(roomName);
  
  // Update tracking
  const userInfo = connectedUsers.get(socket.id);
  if (userInfo) {
    userInfo.counterIds = userInfo.counterIds.filter(id => id !== counterId);
  }
  
  const roomMembers = counterRooms.get(counterId);
  if (roomMembers) {
    roomMembers.delete(socket.id);
    if (roomMembers.size === 0) {
      counterRooms.delete(counterId);
    }
  }
  
  socket.emit('counterRoomLeft', { counterId });
});
```

**Response Event**: [`counterRoomLeft`](#counterroomleft)

**Failure Scenarios**: None (graceful handling)

**Duplicate Handling**: **Idempotent**

**Ordering Assumptions**: None

**Impact if Missed**: Counter continues receiving updates (minor memory leak)

---

### 5. `joinDeliveryPersonRoom`

**Description**: Join a delivery person-specific room to receive delivery assignments.

**Emitter**: Client (Delivery role)

**Trigger Conditions**:
- Delivery person logs in
- Delivery person opens their dashboard

**Payload Schema**:

```typescript
{
  email: string  // Delivery person email (unique identifier)
}
```

**Client-Side Emission**:

```typescript
// From DeliveryHome.tsx:80
socket.emit('joinDeliveryPersonRoom', { email: user.email });
```

**Server-Side Handler**:

```typescript
// From websocket.ts:226-254
socket.on('joinDeliveryPersonRoom', (data: { email: string }) => {
  const { email } = data;
  if (!email) {
    console.error('❌ Email required for delivery person room');
    return;
  }
  
  const roomName = `delivery_person_${email}`;
  socket.join(roomName);
  
  // Track room membership
  if (!deliveryPersonRooms.has(email)) {
    deliveryPersonRooms.set(email, new Set());
  }
  deliveryPersonRooms.get(email)!.add(socket.id);
  
  // Update user info
  const userInfo = connectedUsers.get(socket.id);
  if (userInfo) {
    userInfo.userRole = 'delivery_person';
  }
  
  socket.emit('deliveryPersonRoomJoined', { email });
});
```

**Response Event**: [`deliveryPersonRoomJoined`](#deliverypersonroomjoined)

**Failure Scenarios**:
- Missing email → Silently ignored (logged)
- Server error → Error logged

**Duplicate Handling**: **Idempotent**

**Ordering Assumptions**: After connection established

**Impact if Missed**: Delivery person won't receive assignment notifications

---

### 6. `leaveDeliveryPersonRoom`

**Description**: Leave a delivery person-specific room.

**Emitter**: Client (Delivery role)

**Trigger Conditions**:
- Delivery person logs out
- Component unmount

**Payload Schema**:

```typescript
{
  email: string
}
```

**Client-Side Emission**:

```typescript
// From DeliveryHome.tsx:128
socket.emit('leaveDeliveryPersonRoom', { email: user.email });
```

**Server-Side Handler**:

```typescript
// From websocket.ts:257-274
socket.on('leaveDeliveryPersonRoom', (data: { email: string }) => {
  const { email } = data;
  const roomName = `delivery_person_${email}`;
  socket.leave(roomName);
  
  const roomMembers = deliveryPersonRooms.get(email);
  if (roomMembers) {
    roomMembers.delete(socket.id);
    if (roomMembers.size === 0) {
      deliveryPersonRooms.delete(email);
    }
  }
});
```

**Response Event**: None

**Failure Scenarios**: None (graceful handling)

**Duplicate Handling**: **Idempotent**

**Ordering Assumptions**: None

**Impact if Missed**: Delivery person continues receiving updates (minor memory leak)

---

### 7. `ping`

**Description**: Client keepalive ping to detect stale connections (PWA optimization).

**Emitter**: Client (every 15 seconds when connected)

**Trigger Conditions**:
- Automatic interval timer after connection
- PWA visibility change (page becomes visible)

**Payload Schema**: None (empty)

**Client-Side Emission**:

```typescript
// From useWebSocket.ts:212
socket.emit('ping');
```

**Server-Side Handler**:

```typescript
// From websocket.ts:215-217
socket.on('ping', () => {
  socket.emit('pong', { timestamp: Date.now() });
});
```

**Response Event**: [`pong`](#pong)

**Failure Scenarios**: None

**Duplicate Handling**: N/A (each ping is unique)

**Ordering Assumptions**: None

**Impact if Missed**: Connection liveness not verified; may delay reconnection detection

---

### 8. `disconnect`

**Description**: Built-in Socket.IO event when client disconnects.

**Emitter**: Socket.IO (automatic)

**Trigger Conditions**:
- Client closes connection (manual disconnect)
- Network failure / timeout
- Browser tab closed
- PWA app backgrounded (transport error)

**Payload Schema**: 

```typescript
reason: string  // Disconnect reason from Socket.IO
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:218-244
socket.on('disconnect', (reason) => {
  setIsConnected(false);
  stopKeepAlive();
  onDisconnected?.();
  
  // Attempt reconnect if not manual disconnect
  if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
    if (reason === 'transport close' || reason === 'transport error') {
      reconnectAttemptsRef.current = Math.max(0, reconnectAttemptsRef.current - 1);
    }
    
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      scheduleReconnect();
    }
  }
});
```

**Server-Side Handler**:

```typescript
// From websocket.ts:220-223
socket.on('disconnect', (reason) => {
  console.log(`📡 Client disconnected: ${socket.id}, reason: ${reason}`);
  handleDisconnection(socket.id);
});

// Cleanup function:
function handleDisconnection(socketId: string): void {
  const userInfo = connectedUsers.get(socketId);
  if (userInfo) {
    // Remove from all canteen rooms
    userInfo.canteenIds.forEach(canteenId => {
      canteenRooms.get(canteenId)?.delete(socketId);
      if (canteenRooms.get(canteenId)?.size === 0) {
        canteenRooms.delete(canteenId);
      }
    });
    
    // Remove from all counter rooms
    userInfo.counterIds.forEach(counterId => {
      counterRooms.get(counterId)?.delete(socketId);
      if (counterRooms.get(counterId)?.size === 0) {
        counterRooms.delete(counterId);
      }
    });
    
    // Remove from delivery person rooms
    for (const [email, members] of deliveryPersonRooms.entries()) {
      if (members.has(socketId)) {
        members.delete(socketId);
        if (members.size === 0) {
          deliveryPersonRooms.delete(email);
        }
      }
    }
    
    connectedUsers.delete(socketId);
  }
}
```

**Response Event**: None

**Failure Scenarios**: None

**Duplicate Handling**: N/A

**Ordering Assumptions**: Always last event in connection lifecycle

**Impact if Missed**: N/A (automatic cleanup happens on server)

---

## Server-to-Client Events

### 9. `orderUpdate`

**Description**: **Universal event for all order-related updates**. This is the primary event channel for order lifecycle changes.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions** (by message type):

| Message Type | Trigger Condition | Triggered From (Route/File) |
|--------------|-------------------|---------------------------|
| `new_order` | New order created | `POST /api/orders` (routes.ts:2726) |
| `new_offline_order` | Offline order payment confirmed | `POST /api/offline-orders/:id/confirm-payment` (routes.ts:6678) |
| `payment_confirmed` | Offline payment confirmed at counter | `POST /api/offline-orders/:id/confirm-payment` (routes.ts:6678) |
| `payment_success` | Payment completed successfully | PhonePe/Razorpay callback (routes.ts:5616, 6585) |
| `order_status_changed` | Order status updated | Any status change endpoint (routes.ts:7807, 7878, 8442, 8609) |
| `order_updated` | Order data modified | Mark ready from KOT counter (routes.ts:8278) |
| `item_status_changed` | Item-level status changed | Mark ready, out for delivery (routes.ts:8285, 8154) |
| `order_rejected` | Order rejected by counter | `POST /api/offline-orders/:id/reject` (routes.ts:7989) |
| `checkout_session_status_changed` | Checkout session timeout | Checkout session service timer (routes.ts:433) |
| `banner_updated` | Media banner modified | (Function exists but not triggered in code) |
| `menu_updated` | Menu item modified | (Function exists but not triggered in code) |

**Payload Schema**:

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
  oldStatus?: string;                 // Previous status (for status changes)
  newStatus?: string;                 // New status (for status changes)
  orderNumber?: string;               // Order number for reference
  confirmedByCounter?: string;        // Counter that confirmed payment
  rejectedByCounter?: string;         // Counter that rejected order
  counterId?: string;                 // Target counter ID
  itemStatusByCounter?: Record<string, any>;  // Item-level statuses
  sessionId?: string;                 // Checkout session ID
  timeRemaining?: number;             // Checkout session time (seconds)
  status?: string;                    // Checkout session status
  message?: string;                   // Human-readable message
}
```

**Server-Side Emission Examples**:

```typescript
// NEW ORDER - Broadcast to canteen room AND counter rooms
// From routes.ts:2726
const wsManager = getWebSocketManager();
wsManager.broadcastNewOrder(order.canteenId, order);  // To canteen room

// Also broadcast to counter rooms (store/payment/KOT)
order.allStoreCounterIds.forEach(counterId => {
  wsManager.broadcastToCounter(counterId, 'new_order', order);
});

// ORDER STATUS CHANGE - Broadcast to canteen room
// From routes.ts:7807
wsManager.broadcastOrderStatusUpdate(
  result.canteenId,   // canteenId
  result,             // order data
  oldOrder.status,    // old status
  result.status       // new status
);

// Internal implementation:
public broadcastOrderStatusUpdate(
  canteenId: string, 
  orderData: any, 
  oldStatus: string, 
  newStatus: string
): void {
  const roomName = `canteen_${canteenId}`;
  const message: OrderUpdateData = {
    type: 'order_status_changed',
    data: orderData,
    oldStatus,
    newStatus,
    orderNumber: orderData.orderNumber
  };
  
  this.io.to(roomName).emit('orderUpdate', message);
}

// PAYMENT CONFIRMED - Multiple broadcasts
// From routes.ts:6678
wsManager.broadcastNewOrder(order.canteenId, updatedOrder);  // To canteen

wsManager.broadcastToCanteen(order.canteenId, 'payment_confirmed', {
  order: updatedOrder,
  orderId
});

wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder);

// DELIVERY ASSIGNMENT - To specific delivery person
// From routes.ts:8130
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

// CHECKOUT SESSION STATUS - With debouncing
// From websocket.ts:379
public broadcastCheckoutSessionStatus(
  sessionId: string, 
  status: string, 
  timeRemaining: number, 
  canteenId?: string
): void {
  // Debounce: skip if broadcast within 2s AND time change < 5s
  const now = Date.now();
  const cached = checkoutSessionBroadcastCache.get(sessionId);
  
  if (cached) {
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);
    
    if (timeSinceLastBroadcast < 2000 && timeRemainingDiff < 5) {
      return;  // Skip duplicate broadcast
    }
  }
  
  checkoutSessionBroadcastCache.set(sessionId, {
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
    this.io.emit('orderUpdate', message);
  }
}
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:273-329
socket.on('orderUpdate', (message: WebSocketMessage) => {
  switch (message.type) {
    case 'new_order':
      onNewOrder?.(message.data);
      break;
      
    case 'new_offline_order':
      onNewOrder?.(message.data);
      break;
      
    case 'payment_confirmed':
      onNewOrder?.(message.data?.order ?? message.data);
      break;
      
    case 'order_updated':
    case 'order_status_changed':
      onOrderUpdate?.(message.data);
      if (message.oldStatus && message.newStatus) {
        onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
      }
      break;
      
    case 'item_status_changed':
      onItemStatusChange?.(message.data);
      onOrderUpdate?.(message.data);  // Backward compatibility
      if (message.oldStatus && message.newStatus) {
        onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
      }
      break;
      
    case 'banner_updated':
      onBannerUpdate?.(message.data);
      break;
      
    case 'payment_success':
      onPaymentSuccess?.(message.data);
      break;
      
    case 'order_rejected':
      if (message.rejectedByCounter) {
        onOrderRejected?.(message.data, message.rejectedByCounter);
      }
      break;
      
    case 'checkout_session_status_changed':
      if (message.sessionId && message.status && message.timeRemaining !== undefined) {
        onCheckoutSessionStatusChange?.(
          message.sessionId, 
          message.status, 
          message.timeRemaining
        );
      }
      break;
  }
});
```

**Failure Scenarios**:
- Client not in correct room → Event not received
- Network interruption → Event lost (no retry mechanism)
- Client handler throws error → Caught and logged

**Duplicate Handling**: 
- **Checkout session updates**: Debounced (2s interval, 5s time change threshold)
- **Order updates**: No built-in deduplication - client must handle
- **Payment confirmations**: May receive multiple types (`payment_confirmed`, `new_order`, `order_updated`) for same order

**Ordering Assumptions**: 
- Events within same room are ordered (Socket.IO guarantee)
- Cross-room events may arrive out of order
- Status transitions arrive in chronological order: `pending` → `preparing` → `ready` → `out_for_delivery` → `delivered` → `completed`

**Impact if Missed**:
- `new_order`: Order not shown in dashboard until manual refresh
- `order_status_changed`: Status displayed incorrectly; user confused
- `payment_confirmed`: Counter operator doesn't know payment is complete
- `checkout_session_status_changed`: User not warned of timeout; payment may fail
- `delivery_assignment`: Delivery person misses order assignment

---

### 10. `deliveryAssignment`

**Description**: Notify delivery person of new order assignment.

**Emitted By**: Server

**Listener(s)**: Client (Delivery role)

**Trigger Conditions**:
- Order marked as "out for delivery" with delivery person assigned
- Delivery assignment accepted by another delivery person (cancellation notification)

**Payload Schema**:

```typescript
// Assignment notification
{
  type: 'delivery_assignment';
  data: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    amount: number;
    items: string | any[];        // JSON string or parsed array
    address: string;
    createdAt: Date;
    status: 'out_for_delivery';
    deliveryPersonId: string;
  }
}

// Assignment accepted by another (cancellation)
{
  type: 'delivery_assignment_accepted';
  data: {
    orderId: string;
    orderNumber: string;
  }
}
```

**Server-Side Emission**:

```typescript
// From routes.ts:8130
const wsManager = getWebSocketManager();
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

// Internal implementation:
public broadcastToDeliveryPerson(
  deliveryPersonEmail: string, 
  message: any
): void {
  const roomName = `delivery_person_${deliveryPersonEmail}`;
  const roomMembers = deliveryPersonRooms.get(deliveryPersonEmail);
  
  if (roomMembers && roomMembers.size > 0) {
    this.io.to(roomName).emit('deliveryAssignment', message);
  }
}

// From delivery-assignment-service.ts:285
wsManager.broadcastToDeliveryPerson(deliveryPersonEmail, {
  type: 'delivery_assignment_accepted',
  data: {
    orderId,
    orderNumber: assignment.orderNumber
  }
});
```

**Client-Side Handler**:

```typescript
// From DeliveryHome.tsx:122
socket.on('deliveryAssignment', (message) => {
  if (message.type === 'delivery_assignment') {
    // New assignment - refetch orders
    setTimeout(() => {
      refetch();
    }, 500);
  } else if (message.type === 'delivery_assignment_accepted') {
    // Assignment taken by another - refetch
    refetch();
  }
});
```

**Failure Scenarios**:
- Delivery person not in room → Assignment not received (must rely on polling)
- Network interruption → Assignment lost
- Multiple delivery persons assigned simultaneously → Race condition (first to accept wins)

**Duplicate Handling**: No deduplication - client refetches order list

**Ordering Assumptions**: None (assignments are independent)

**Impact if Missed**: Delivery person misses order assignment; relies on manual refresh or polling

---

### 11. `roomJoined`

**Description**: Confirmation that client successfully joined canteen rooms.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server successfully processes `joinCanteenRooms` request

**Payload Schema**:

```typescript
{
  type: 'connected';
  message: string;                // "Successfully joined canteen rooms"
  canteenIds: string[];
  connectedAt: Date;
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:91-96
socket.emit('roomJoined', {
  type: 'connected',
  message: 'Successfully joined canteen rooms',
  canteenIds: ids,
  connectedAt: userInfo.connectedAt
});
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:331
socket.on('roomJoined', () => {
  // Confirmation only, typically no action needed
});
```

**Failure Scenarios**: None

**Duplicate Handling**: Can receive multiple confirmations if joining multiple times

**Ordering Assumptions**: Sent immediately after successful room join

**Impact if Missed**: No impact (confirmation only)

---

### 12. `left_room`

**Description**: Confirmation that client successfully left canteen rooms.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server successfully processes `leaveCanteenRooms` request

**Payload Schema**:

```typescript
{
  canteenIds: string[]
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:132
socket.emit('left_room', { canteenIds });
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:332
socket.on('left_room', () => {
  // Confirmation only
});
```

**Failure Scenarios**: None

**Duplicate Handling**: Idempotent

**Ordering Assumptions**: Sent immediately after successful room leave

**Impact if Missed**: No impact (confirmation only)

---

### 13. `counterRoomJoined`

**Description**: Confirmation that client successfully joined counter room.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server successfully processes `joinCounterRoom` request

**Payload Schema**:

```typescript
{
  type: 'counter_connected';
  message: string;               // "Successfully joined counter room"
  counterId: string;
  canteenId: string;
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:170-175
socket.emit('counterRoomJoined', {
  type: 'counter_connected',
  message: 'Successfully joined counter room',
  counterId,
  canteenId
});
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:333
socket.on('counterRoomJoined', () => {
  // Confirmation only
});
```

**Failure Scenarios**: None

**Duplicate Handling**: Idempotent

**Ordering Assumptions**: Sent immediately after successful room join

**Impact if Missed**: No impact (confirmation only)

---

### 14. `counterRoomLeft`

**Description**: Confirmation that client successfully left counter room.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server successfully processes `leaveCounterRoom` request

**Payload Schema**:

```typescript
{
  counterId: string
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:207
socket.emit('counterRoomLeft', { counterId });
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:334
socket.on('counterRoomLeft', () => {
  // Confirmation only
});
```

**Failure Scenarios**: None

**Duplicate Handling**: Idempotent

**Ordering Assumptions**: Sent immediately after successful room leave

**Impact if Missed**: No impact (confirmation only)

---

### 15. `deliveryPersonRoomJoined`

**Description**: Confirmation that delivery person successfully joined their room.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server successfully processes `joinDeliveryPersonRoom` request

**Payload Schema**:

```typescript
{
  email: string
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:250
socket.emit('deliveryPersonRoomJoined', { email });
```

**Client-Side Handler**:

```typescript
// Client typically doesn't listen for this (no handler in code)
// Can be added for confirmation UI
```

**Failure Scenarios**: None

**Duplicate Handling**: Idempotent

**Ordering Assumptions**: Sent immediately after successful room join

**Impact if Missed**: No impact (confirmation only)

---

### 16. `pong`

**Description**: Server response to client `ping` for keepalive.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Server receives `ping` event from client

**Payload Schema**:

```typescript
{
  timestamp: number  // Server timestamp in milliseconds
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:216
socket.emit('pong', { timestamp: Date.now() });
```

**Client-Side Handler**:

```typescript
// From useWebSocket.ts:335-337
socket.on('pong', () => {
  lastPongRef.current = Date.now();
});
```

**Failure Scenarios**: None

**Duplicate Handling**: N/A (each pong corresponds to a ping)

**Ordering Assumptions**: None

**Impact if Missed**: Client detects stale connection after 30s timeout, triggers reconnection

---

### 17. `error`

**Description**: Generic error message from server.

**Emitted By**: Server

**Listener(s)**: Client (`useWebSocket` hook)

**Trigger Conditions**:
- Room join/leave failure
- Server-side processing error

**Payload Schema**:

```typescript
{
  message: string  // Error description
}
```

**Server-Side Emission**:

```typescript
// From websocket.ts:102, 179
socket.emit('error', { message: 'Failed to join canteen rooms' });
socket.emit('error', { message: 'Failed to join counter room' });
```

**Client-Side Handler**:

```typescript
// No explicit handler in code, but Socket.IO emits 'error' event
// Can be added:
socket.on('error', (error) => {
  console.error('Socket error:', error);
  onError?.(error);
});
```

**Failure Scenarios**: N/A (this is the error notification)

**Duplicate Handling**: N/A

**Ordering Assumptions**: None

**Impact if Missed**: Error goes unnoticed, user may experience unexpected behavior

---

## Event Trigger Conditions

### Order Creation Flow

```
Client: POST /api/orders
  ↓
Server: Create order in MongoDB
  ↓
Server: wsManager.broadcastNewOrder(canteenId, order)
  ↓
Server: wsManager.broadcastToCounter(storeCounterId, 'new_order', order)
Server: wsManager.broadcastToCounter(paymentCounterId, 'new_order', order)
Server: wsManager.broadcastToCounter(kotCounterId, 'new_order', order)
  ↓
Clients in canteen room: Receive 'orderUpdate' with type='new_order'
Clients in counter rooms: Receive 'orderUpdate' with type='new_order'
```

### Order Status Change Flow

```
Client: POST /api/orders/:id/update-status
  ↓
Server: Update order in MongoDB
  ↓
Server: wsManager.broadcastOrderStatusUpdate(canteenId, order, oldStatus, newStatus)
  ↓
Server: wsManager.broadcastToCounter(counterId, 'order_status_changed', order)
  ↓
Clients in canteen room: Receive 'orderUpdate' with type='order_status_changed'
Clients in counter room: Receive 'orderUpdate' with type='order_status_changed'
```

### Payment Confirmation Flow (Offline Order)

```
Client (Counter): POST /api/offline-orders/:id/confirm-payment
  ↓
Server: Update order paymentStatus='PAID', status='preparing'
  ↓
Server: wsManager.broadcastNewOrder(canteenId, order)
Server: wsManager.broadcastToCanteen(canteenId, 'payment_confirmed', order)
Server: wsManager.broadcastToCanteen(canteenId, 'order_updated', order)
  ↓
Server: Broadcast to all store counter rooms with type='new_order'
Server: Broadcast to payment counter room with type='payment_confirmed'
  ↓
Clients: Receive 3 'orderUpdate' events:
  1. type='new_order' - Add to active orders
  2. type='payment_confirmed' - Remove from payment counter UI
  3. type='order_updated' - Update order details
```

### Delivery Assignment Flow

```
Client (Counter): POST /api/orders/:id/out-for-delivery
  ↓
Server: Update order deliveryPersonId, status='out_for_delivery'
Server: Update delivery person isAvailable=false
  ↓
Server: wsManager.broadcastOrderStatusUpdate(canteenId, order, oldStatus, newStatus)
  ↓
Server: wsManager.broadcastToDeliveryPerson(deliveryPersonEmail, {
  type: 'delivery_assignment',
  data: { orderId, orderNumber, customerName, amount, items, address }
})
  ↓
Server: wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', order)
  ↓
Delivery Person: Receives 'deliveryAssignment' event
Counter Operator: Receives 'orderUpdate' with type='item_status_changed'
Customer: Receives 'orderUpdate' with type='order_status_changed'
```

### Mark Ready Flow (from KOT Counter)

```
Client (KOT Counter): POST /api/orders/:id/mark-ready
  ↓
Server: Update order itemStatusByCounter[kotCounterId]='ready'
  ↓
Server: wsManager.broadcastOrderStatusUpdate(canteenId, order, oldStatus, newStatus)
Server: wsManager.broadcastToCanteen(canteenId, 'order_updated', order)
Server: wsManager.broadcastToCanteen(canteenId, 'item_status_changed', order)
  ↓
Server: Broadcast to store counter rooms with type='item_status_changed'
  ↓
Store Counter: Receives event, updates UI to show items ready for processing
Customer: Receives 3 events (status change, order update, item status change)
```

### Checkout Session Timeout Flow

```
Server (Timer): Checkout session expires
  ↓
Server: wsManager.broadcastCheckoutSessionStatus(sessionId, 'expired', 0, canteenId)
  ↓
Debounce Check: Skip if broadcast within 2s AND time change < 5s
  ↓
Server: io.to(`canteen_${canteenId}`).emit('orderUpdate', {
  type: 'checkout_session_status_changed',
  sessionId,
  status: 'expired',
  timeRemaining: 0
})
  ↓
Client: Receives event, shows timeout notification, clears cart
```

---

## Event Ordering Guarantees

### Guarantees Provided by Socket.IO

1. **Events within same room**: Messages sent to the same room are delivered in order.
   ```
   canteen_1: new_order (Order A) → order_status_changed (Order A)
   ```

2. **Events from same socket**: Client receives events in the order they were sent to that socket.
   ```
   Socket ABC: roomJoined → orderUpdate → orderUpdate
   ```

### NOT Guaranteed

1. **Cross-room events**: Events sent to different rooms may arrive out of order.
   ```
   canteen_1 room: new_order (Order A)
   counter_1 room: new_order (Order A)
   // May arrive in either order
   ```

2. **Events from different server methods**: Sequential server calls don't guarantee order.
   ```typescript
   wsManager.broadcastNewOrder(canteenId, order);  // Call 1
   wsManager.broadcastToCounter(counterId, order); // Call 2
   // Call 2 might arrive before Call 1
   ```

3. **Events across reconnections**: After reconnect, client misses events sent during disconnection.

### Ordering Strategies

**Server-side strategies:**

1. **Combine related updates**: Send multiple updates in single message
   ```typescript
   // Instead of:
   broadcastNewOrder(order);
   broadcastToCounter(counterId, order);
   
   // Do:
   broadcastToCanteen(canteenId, {
     type: 'new_order',
     data: order,
     targetCounters: [storeCounterId, paymentCounterId]
   });
   ```

2. **Add sequence numbers**: Include timestamp or sequence in payload
   ```typescript
   {
     type: 'order_status_changed',
     data: order,
     timestamp: Date.now(),
     sequenceId: order.statusChangeCount
   }
   ```

**Client-side strategies:**

1. **Use latest data**: Always use most recent order data from API on refetch
2. **Optimistic updates**: Apply update immediately, revert if server rejects
3. **Deduplication**: Track processed event IDs to ignore duplicates
4. **Full refresh**: Refetch order list periodically to resync state

---

## Duplicate Delivery Handling

### Sources of Duplicates

1. **Multiple broadcasts for same event**: Payment confirmation sends 3 messages
   - `new_order`
   - `payment_confirmed`
   - `order_updated`

2. **Reconnection**: Client may miss disconnect and join same room twice

3. **Retry logic**: Client retries failed API calls, triggering duplicate broadcasts

4. **Multiple clients**: Same user on multiple devices receives same event

### Server-Side Deduplication

**Checkout Session Status (Debounced)**:

```typescript
// From websocket.ts:379-413
private checkoutSessionBroadcastCache: Map<string, { 
  lastBroadcast: number; 
  lastTimeRemaining: number 
}> = new Map();

public broadcastCheckoutSessionStatus(...) {
  const now = Date.now();
  const BROADCAST_DEBOUNCE_MS = 2000;
  const TIME_CHANGE_THRESHOLD = 5;
  
  const cached = this.checkoutSessionBroadcastCache.get(sessionId);
  if (cached) {
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);
    
    if (timeSinceLastBroadcast < BROADCAST_DEBOUNCE_MS && 
        timeRemainingDiff < TIME_CHANGE_THRESHOLD) {
      return;  // Skip duplicate broadcast
    }
  }
  
  this.checkoutSessionBroadcastCache.set(sessionId, {
    lastBroadcast: now,
    lastTimeRemaining: timeRemaining
  });
  
  // Broadcast message...
}
```

**Room Join (Idempotent)**:

```typescript
// Joining same room multiple times has no effect
socket.join('canteen_1');  // First join
socket.join('canteen_1');  // No-op
```

### Client-Side Deduplication

**No built-in deduplication** - Client must implement:

```typescript
// Example: Track processed order IDs
const processedOrderIds = new Set<string>();

socket.on('orderUpdate', (message) => {
  const orderId = message.data?.id || message.data?.orderNumber;
  
  if (!orderId) return;
  
  // Deduplicate by order ID + timestamp
  const eventKey = `${orderId}-${message.type}-${message.data?.updatedAt}`;
  
  if (processedOrderIds.has(eventKey)) {
    console.log('Duplicate event ignored:', eventKey);
    return;
  }
  
  processedOrderIds.add(eventKey);
  
  // Process event...
});
```

**Alternative: Use latest data from API**:

```typescript
// On any orderUpdate event, refetch full order
socket.on('orderUpdate', (message) => {
  if (message.type === 'order_status_changed') {
    // Refetch order list to get latest state
    refetchOrders();
  }
});
```

---

## Failure Impact Analysis

| Event Missed | Impact Severity | User Impact | Recovery Method |
|--------------|----------------|-------------|-----------------|
| `joinCanteenRooms` confirmation | **Low** | No real-time updates | Automatic reconnect |
| `new_order` | **Critical** | Order not shown in dashboard | Manual refresh, polling |
| `order_status_changed` | **High** | Incorrect order status displayed | Manual refresh |
| `payment_confirmed` | **Critical** | Counter operator doesn't release order | Manual refresh, polling |
| `checkout_session_status_changed` | **High** | User not warned of timeout | Client-side timer as backup |
| `delivery_assignment` | **Critical** | Delivery person misses assignment | Polling, manual check |
| `item_status_changed` | **Medium** | Incorrect item status (ready/not ready) | Full order refetch |
| `order_rejected` | **Medium** | Counter doesn't remove order from UI | Manual refresh |
| `payment_success` | **Low** | Status page not updated (payment already processed) | Refresh status page |
| `ping`/`pong` | **Low** | Delayed reconnection detection | 30s timeout triggers reconnect |
| `disconnect` | **N/A** | Automatic cleanup | Automatic reconnection |

### Critical Paths Requiring Fallback

1. **New Order Notification**:
   - **Fallback**: Polling `/api/orders?status=pending` every 30s
   - **Implementation**: Counter dashboard polls if no WebSocket

2. **Payment Confirmation**:
   - **Fallback**: Polling `/api/orders?paymentStatus=PENDING` every 15s
   - **Implementation**: Payment counter polls for pending payments

3. **Delivery Assignment**:
   - **Fallback**: Polling `/api/delivery-persons/by-email/:email/orders` every 60s
   - **Implementation**: Delivery app refetches orders periodically

4. **Checkout Session Timeout**:
   - **Fallback**: Client-side timer started at checkout
   - **Implementation**: `CheckoutContext` tracks session expiry locally

---

## Reconnection Behavior

### Client-Side Reconnection

**Configuration**:

```typescript
// From useWebSocket.ts:160-168
const socket = io(getWebSocketURL(), {
  transports: ['websocket', 'polling'],
  timeout: 20000,               // 20s timeout for PWA
  reconnection: false,          // Manual reconnection
  autoConnect: true,
  forceNew: true,               // Force new connection
  upgrade: true,                // Allow transport upgrades
  rememberUpgrade: false        // Don't remember to prevent stale connections
});
```

**Reconnection Strategy**:

```typescript
// From useWebSocket.ts:348-379
const scheduleReconnect = useCallback(() => {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }
  
  const baseDelay = 1000;        // 1s base
  const maxDelay = 8000;         // 8s max
  const delay = Math.min(
    baseDelay * Math.pow(1.5, reconnectAttemptsRef.current), 
    maxDelay
  );
  
  reconnectAttemptsRef.current++;
  
  reconnectTimeoutRef.current = setTimeout(() => {
    if (reconnectAttemptsRef.current <= maxReconnectAttempts && enabled) {
      hasConnectedRef.current = false;
      connect();
    } else {
      // Max attempts reached, reset after 30s
      setTimeout(() => {
        reconnectAttemptsRef.current = 0;
        scheduleReconnect();
      }, 30000);
    }
  }, delay);
}, [enabled]);
```

**Reconnection Attempts**:

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | 1.0s | 1s |
| 2 | 1.5s | 2.5s |
| 3 | 2.25s | 4.75s |
| 4 | 3.37s | 8.12s |
| 5 | 5.06s | 13.18s |
| 6 | 7.59s (capped at 8s) | 21.18s |
| 7 | 8s | 29.18s |
| 8 | 8s | 37.18s |
| 9 | 8s | 45.18s |
| 10 | 8s | 53.18s |
| **Max reached** | Wait 30s, reset attempts | - |

**PWA-Specific Optimizations**:

```typescript
// From useWebSocket.ts:456-521

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Page became visible - check connection
    setTimeout(() => {
      const socket = socketRef.current;
      
      if (!socket?.connected || !isConnected) {
        reconnectAttemptsRef.current = 0;
        reconnect();
      } else {
        // Verify connection with ping
        const timeSinceLastPong = Date.now() - lastPongRef.current;
        if (timeSinceLastPong > 30000) {
          reconnect();
        } else {
          socket.emit('ping');
        }
      }
    }, 500);  // Wait for network to stabilize
  } else {
    // Page hidden - stop keepalive to save battery
    stopKeepAlive();
  }
});

// Handle network online/offline events
window.addEventListener('online', () => {
  if (!isConnected && enabled) {
    reconnectAttemptsRef.current = 0;
    reconnect();
  }
});

window.addEventListener('offline', () => {
  // Connection will be lost naturally
});
```

**Transport Error Handling**:

```typescript
// From useWebSocket.ts:229-243
socket.on('disconnect', (reason) => {
  // Be more forgiving with transport errors (common in PWA)
  if (reason === 'transport close' || reason === 'transport error') {
    reconnectAttemptsRef.current = Math.max(0, reconnectAttemptsRef.current - 1);
  }
  
  if (reconnectAttemptsRef.current < maxReconnectAttempts) {
    scheduleReconnect();
  }
});
```

### Server-Side Connection Tracking

**No persistence** - Server does not track disconnections or buffer messages:

- Disconnected clients are immediately removed from all rooms
- Messages sent during disconnection are **lost**
- Client must refetch state after reconnection

**Cleanup on Disconnect**:

```typescript
// From websocket.ts:284-322
private handleDisconnection(socketId: string): void {
  const userInfo = connectedUsers.get(socketId);
  if (userInfo) {
    // Remove from all canteen rooms
    userInfo.canteenIds.forEach(canteenId => {
      canteenRooms.get(canteenId)?.delete(socketId);
      if (canteenRooms.get(canteenId)?.size === 0) {
        canteenRooms.delete(canteenId);
      }
    });
    
    // Remove from all counter rooms
    userInfo.counterIds.forEach(counterId => {
      counterRooms.get(counterId)?.delete(socketId);
      if (counterRooms.get(counterId)?.size === 0) {
        counterRooms.delete(counterId);
      }
    });
    
    // Remove from delivery person rooms
    for (const [email, members] of deliveryPersonRooms.entries()) {
      if (members.has(socketId)) {
        members.delete(socketId);
        if (members.size === 0) {
          deliveryPersonRooms.delete(email);
        }
      }
    }
    
    connectedUsers.delete(socketId);
  }
}
```

---

## Appendices

### Appendix A: Complete Event Flow Diagram

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│ (Customer)  │                    │             │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ socket.connect()                 │
       ├─────────────────────────────────>│
       │                                  │
       │ socket.emit('joinCanteenRooms')  │
       ├─────────────────────────────────>│
       │                                  │ Join room: canteen_1
       │                                  │ Track socketId → canteenIds
       │                                  │
       │ socket.on('roomJoined')          │
       │<─────────────────────────────────┤
       │                                  │
       │                                  │
       │ (Order created by another user)  │
       │                                  │ wsManager.broadcastNewOrder()
       │                                  │
       │ socket.on('orderUpdate')         │
       │   type='new_order'               │
       │<─────────────────────────────────┤
       │                                  │
       │ (Order status changes)           │
       │                                  │ wsManager.broadcastOrderStatusUpdate()
       │                                  │
       │ socket.on('orderUpdate')         │
       │   type='order_status_changed'    │
       │<─────────────────────────────────┤
       │                                  │
       │ socket.emit('ping')              │
       ├─────────────────────────────────>│
       │                                  │
       │ socket.on('pong')                │
       │<─────────────────────────────────┤
       │                                  │
       │ socket.disconnect()              │
       ├─────────────────────────────────>│
       │                                  │ handleDisconnection()
       │                                  │ Clean up rooms
       │                                  │
```

### Appendix B: Counter Order Routing Logic

**Order routing depends on item properties and counter assignments:**

```typescript
// Pseudo-code from routes.ts order creation

// For each order:
const hasMarkableItem = items.some(item => item.isMarkable);
const hasMarkableItemWithKot = items.some(item => 
  item.isMarkable && item.kotCounterId
);

// Routing logic:
if (hasMarkableItemWithKot && allKotCounterIds.length > 0) {
  // Route to BOTH KOT and store counters
  broadcastToCounters(allKotCounterIds, order);       // KOT prepares
  broadcastToCounters(allStoreCounterIds, order);     // Store waits for ready
} else if (hasMarkableItem && allStoreCounterIds.length > 0) {
  // Route to store counters only
  broadcastToCounters(allStoreCounterIds, order);
}

// Always route to payment counter (for offline orders)
if (allPaymentCounterIds.length > 0) {
  broadcastToCounters(allPaymentCounterIds, order);
}
```

**Item Status Progression**:

```
KOT Counter:
  pending → preparing (auto) → ready (manual: mark-ready)

Store Counter:
  - If item has KOT: waiting_for_kot → ready (auto when KOT marks ready) → out_for_delivery
  - If item no KOT: pending → ready (manual: mark-ready) → out_for_delivery

Payment Counter:
  pending_payment → paid (manual: confirm-payment) → removed from counter UI
```

### Appendix C: WebSocket URL Configuration

```typescript
// From useWebSocket.ts:90-118
const getWebSocketURL = () => {
  const wsBaseUrl = getWebSocketUrl();  // From apiConfig.ts
  
  // Convert HTTP to WebSocket protocol
  if (wsBaseUrl.startsWith('ws://') || wsBaseUrl.startsWith('wss://')) {
    return wsBaseUrl;
  }
  
  if (wsBaseUrl.startsWith('http://')) {
    return wsBaseUrl.replace('http://', 'ws://');
  }
  if (wsBaseUrl.startsWith('https://')) {
    return wsBaseUrl.replace('https://', 'wss://');
  }
  
  // Default fallback
  if (typeof window === 'undefined') return 'ws://localhost:5000';
  
  // Development: always localhost:5000
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:5000';
  }
  
  // Production: same host as web app
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
};
```

### Appendix D: Event Statistics API

Server exposes statistics endpoint for monitoring:

```typescript
// From websocket.ts:561-590
public getStats(): {
  totalConnections: number;
  canteenRooms: { [canteenId: string]: number };
  counterRooms: { [counterId: string]: number };
  userRoles: { [role: string]: number };
} {
  const stats = {
    totalConnections: connectedUsers.size,
    canteenRooms: {},
    counterRooms: {},
    userRoles: {}
  };
  
  canteenRooms.forEach((members, canteenId) => {
    stats.canteenRooms[canteenId] = members.size;
  });
  
  counterRooms.forEach((members, counterId) => {
    stats.counterRooms[counterId] = members.size;
  });
  
  connectedUsers.forEach(user => {
    const role = user.userRole || 'anonymous';
    stats.userRoles[role] = (stats.userRoles[role] || 0) + 1;
  });
  
  return stats;
}
```

**Usage**: Can be exposed via REST endpoint for monitoring dashboard

---

**End of Document**

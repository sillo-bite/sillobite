# 08 - Real-Time Consistency Model

**Document Version**: 1.0  
**Last Updated**: 2026-01-02  
**Purpose**: Comprehensive analysis of realtime behavior, consistency guarantees, failure modes, and recovery mechanisms

---

## Table of Contents

1. [Overview](#1-overview)
2. [Realtime Architecture](#2-realtime-architecture)
3. [Frontend Assumptions](#3-frontend-assumptions)
4. [Event Ordering Guarantees](#4-event-ordering-guarantees)
5. [Disconnect and Reconnect Behavior](#5-disconnect-and-reconnect-behavior)
6. [Multi-Device Scenarios](#6-multi-device-scenarios)
7. [Cross-Role Realtime Interactions](#7-cross-role-realtime-interactions)
8. [Event Criticality Classification](#8-event-criticality-classification)
9. [Duplicate Event Handling](#9-duplicate-event-handling)
10. [Failure Modes and Recovery](#10-failure-modes-and-recovery)

---

## 1. Overview

### Consistency Model

The system implements **eventual consistency** with **at-least-once delivery** for realtime events:

- ✅ **Eventually Consistent**: All clients converge to same state eventually
- ✅ **At-Least-Once Delivery**: Events may be delivered multiple times (client must handle duplicates)
- ⚠️ **No Global Ordering**: Events from different sources may arrive out-of-order
- ⚠️ **No Replay**: Events missed during disconnect are lost forever
- ⚠️ **Last-Write-Wins**: Concurrent updates result in last write winning (no conflict resolution)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     REALTIME LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   CLIENT A   │   │   CLIENT B   │   │   CLIENT C   │   │
│  │  (Browser 1) │   │  (Browser 2) │   │   (Mobile)   │   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
│         │                   │                   │           │
│         │  localStorage     │  localStorage     │           │
│         │  events           │  events           │           │
│         │  (cross-tab)      │  (cross-tab)      │           │
│         └───────────────────┴───────────────────┘           │
│                             │                                │
│                             │ WebSocket (Socket.IO)          │
│                             │ • Rooms-based broadcast        │
│                             │ • Auto-reconnect (exponential) │
│                             │ • NO event replay              │
│                             │                                │
│                    ┌────────▼────────┐                      │
│                    │   SERVER        │                      │
│                    │  (Node.js)      │                      │
│                    │  • websocket.ts │                      │
│                    └────────┬────────┘                      │
│                             │                                │
│                    ┌────────▼────────┐                      │
│                    │   DATABASES     │                      │
│                    │ • PostgreSQL    │ (User auth)          │
│                    │ • MongoDB       │ (Business data)      │
│                    └─────────────────┘                      │
│                                                               │
│  RECOVERY MECHANISMS:                                        │
│  • Fallback polling when WebSocket disconnected              │
│  • React Query cache invalidation on reconnect               │
│  • User manual refresh (pull-to-refresh)                     │
│  • Keepalive ping/pong (15s interval, 30s timeout)          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Realtime Architecture

### 2.1 WebSocket Server Configuration

**File**: `server/websocket.ts`

```typescript
// Socket.IO Server Configuration (lines 31-42)
this.io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CLIENT_URL || 'https://your-domain.com'
      : ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],  // WebSocket preferred, polling fallback
  pingTimeout: 60000,    // 60 seconds - if no pong received, disconnect
  pingInterval: 25000    // 25 seconds - send ping every 25s
});
```

**Guarantees**:
- ✅ Automatic transport upgrade (polling → websocket)
- ✅ Built-in ping/pong heartbeat (25s interval)
- ✅ Connection timeout after 60s of inactivity
- ⚠️ NO authentication/authorization on room joining

### 2.2 Room-Based Architecture

**Room Types** (lines 26-28):
```typescript
private canteenRooms: Map<string, Set<string>> = new Map();      // canteen_<id> → socketIds
private counterRooms: Map<string, Set<string>> = new Map();      // counter_<id> → socketIds
private deliveryPersonRooms: Map<string, Set<string>> = new Map(); // delivery_person_<email> → socketIds
```

**Room Naming Convention**:
- `canteen_<canteenId>` - All users interested in a canteen (students, owners, admin)
- `counter_<counterId>` - Counter staff for specific counter
- `delivery_person_<email>` - Individual delivery person's personal room

**Room Authorization**: **NONE** ⚠️
- Any socket can join any room (no validation)
- Trust model: Client self-identifies and joins appropriate rooms
- Risk: Malicious client can join any room and receive all events

### 2.3 Event Types

**Event Channels**:
1. `orderUpdate` - Primary channel for all order-related events
2. `deliveryAssignment` - Delivery person assignments
3. `roomJoined`, `counterRoomJoined` - Connection confirmations
4. `pong` - Keepalive responses
5. `error` - Error notifications

**Message Types on `orderUpdate` channel** (line 16):
```typescript
type: 'new_order' 
    | 'order_updated' 
    | 'order_status_changed' 
    | 'item_status_changed'
    | 'banner_updated' 
    | 'payment_success'
    | 'payment_confirmed'
    | 'order_rejected'
    | 'checkout_session_status_changed'
    | 'menu_updated'
```

---

## 3. Frontend Assumptions

**File**: `client/src/hooks/useWebSocket.ts`

### 3.1 Connection Assumptions

```typescript
// Socket.IO Client Configuration (lines 160-168)
const socket = io(getWebSocketURL(), {
  transports: ['websocket', 'polling'],
  timeout: 20000,            // 20s connection timeout
  reconnection: false,       // Manual reconnection (custom logic)
  autoConnect: true,
  forceNew: true,            // Always create new connection
  upgrade: true,             // Allow transport upgrades
  rememberUpgrade: false     // Don't remember upgrade (prevent stale connections)
});
```

**Assumptions**:
1. ✅ **Transport Flexibility**: WebSocket preferred, polling fallback
2. ✅ **Fresh Connections**: Always start with new connection (no stale state)
3. ⚠️ **Manual Reconnection**: App handles reconnection logic (exponential backoff)
4. ⚠️ **No Built-in Replay**: Socket.IO reconnection doesn't replay missed events

### 3.2 Room Join Assumptions

```typescript
// Join Canteen Rooms on Connect (lines 183-185)
socket.on('connect', () => {
  if (canteenIds.length > 0) {
    socket.emit('joinCanteenRooms', canteenIds);
  }
});
```

**Critical Assumption**: **Client must re-join rooms on every reconnect**

**Why**: 
- Each WebSocket connection has unique socket ID
- Server tracks room membership by socket ID
- Old socket ID cleaned up on disconnect (lines 284-321 in websocket.ts)
- New connection = empty room membership

**Failure Mode**:
```
Time  | Event                          | Room Membership
------+--------------------------------+-------------------------
T0    | Client connects                | []
T1    | socket.emit('joinCanteenRooms')| [canteen_1]
T2    | (5 minutes)                    | [canteen_1]
T3    | Network drops, disconnect      | [] (server cleanup)
T4    | Auto-reconnect                 | [] ⚠️ NO ROOMS
T5    | socket.emit('joinCanteenRooms')| [canteen_1] ✅ Fixed
```

### 3.3 Event Delivery Assumptions

**Assumption 1: Events are NOT persisted**
- No event queue on server
- Events broadcast immediately
- If client disconnected, event lost

**Assumption 2: Events may be duplicated**
- Client may reconnect mid-event
- Server may broadcast multiple times (e.g., payment confirmed → new order → order updated)
- Client must handle duplicate events idempotently

**Assumption 3: Events may arrive out-of-order**
- Different broadcast paths (canteen room vs counter room)
- Network latency varies
- No sequence numbers or causal ordering

**Assumption 4: Fallback to polling when disconnected**
```typescript
// Polling Fallback Pattern (from OrderStatusPage.tsx:386-402)
const pollingStatus = useOrderStatusPolling({
  orderId: orderId || '',
  enabled: !!orderId,
  isWebSocketConnected: webSocketStatus.isConnected,
  isWebSocketConnecting: webSocketStatus.isConnecting,
  onDataUpdate: (updatedOrder) => {
    queryClient.setQueryData(['/api/orders', orderId], updatedOrder);
  },
  pollingInterval: 4000  // Poll every 4 seconds when WebSocket down
});
```

---

## 4. Event Ordering Guarantees

### 4.1 Socket.IO Guarantees

**Within Same Room** ✅:
```
canteen_1: event A → event B → event C
All clients in canteen_1 receive: A → B → C (in order)
```

**From Same Socket** ✅:
```
socketABC: emit(event1) → emit(event2) → emit(event3)
Receiver gets: event1 → event2 → event3 (in order)
```

**Cross-Room Events** ⚠️ NO GUARANTEE:
```
Time  | Server Action                          | Client Receives
------+----------------------------------------+-------------------------
T0    | io.to(canteen_1).emit('order_created') | (pending)
T1    | io.to(counter_1).emit('order_created') | (pending)
T2    |                                        | counter_1 event arrives
T3    |                                        | canteen_1 event arrives
```

Client may receive counter event before canteen event (network latency).

### 4.2 Broadcast Patterns

**Pattern 1: Single Broadcast** (Most events)
```typescript
// From websocket.ts:325-343
public broadcastNewOrder(canteenId: string, orderData: any): void {
  const roomName = `canteen_${canteenId}`;
  const message: OrderUpdateData = {
    type: 'new_order',
    data: orderData,
    orderNumber: orderData.orderNumber
  };
  
  this.io.to(roomName).emit('orderUpdate', message);
}
```

**Pattern 2: Multi-Room Broadcast** (New orders to store counters)
```typescript
// From routes.ts:2726 (after order creation)
const wsManager = getWebSocketManager();
wsManager.broadcastNewOrder(order.canteenId, order);  // To canteen room

// Also broadcast to counter rooms
order.allStoreCounterIds.forEach(counterId => {
  wsManager.broadcastToCounter(counterId, 'new_order', order);
});
```

**Ordering Guarantee**: ⚠️ **NONE**
- `canteen_<id>` broadcast and `counter_<id>` broadcasts are independent
- Client may receive counter event first, then canteen event
- Or vice versa (network latency)

**Pattern 3: Sequential Broadcasts** (Payment confirmed flow)
```typescript
// From routes.ts:6678-6750 (payment confirmation)
wsManager.broadcastNewOrder(order.canteenId, updatedOrder);          // Broadcast 1
wsManager.broadcastToCanteen(order.canteenId, 'payment_confirmed', {...}); // Broadcast 2
wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder); // Broadcast 3

// Also broadcast to counter rooms
order.allStoreCounterIds.forEach(counterId => {
  wsManager.broadcastToCounter(counterId, 'new_order', updatedOrder); // Broadcast 4
});
```

**Client Receives**: 3-4 events for same logical action
- Event 1: `new_order` (to canteen room)
- Event 2: `payment_confirmed` (to canteen room)
- Event 3: `order_updated` (to canteen room)
- Event 4: `new_order` (to counter rooms)

**Ordering Guarantee**: **SEQUENTIAL** ✅ (Broadcasts 1-3 to same room)
- Events 1, 2, 3 arrive in order (same room)
- Event 4 may arrive anytime (different room)

---

## 5. Disconnect and Reconnect Behavior

### 5.1 Disconnect Handling

**Server-Side Cleanup** (websocket.ts:284-322):
```typescript
private handleDisconnection(socketId: string): void {
  const userInfo = this.connectedUsers.get(socketId);
  if (userInfo) {
    // Remove from all canteen rooms
    userInfo.canteenIds.forEach(canteenId => {
      this.canteenRooms.get(canteenId)?.delete(socketId);
    });
    
    // Remove from all counter rooms
    userInfo.counterIds.forEach(counterId => {
      this.counterRooms.get(counterId)?.delete(socketId);
    });
    
    // Remove from delivery person rooms
    for (const [email, members] of this.deliveryPersonRooms.entries()) {
      if (members.has(socketId)) {
        members.delete(socketId);
      }
    }
    
    this.connectedUsers.delete(socketId);
  }
}
```

**Result**: All room memberships lost immediately on disconnect

**Client-Side Detection** (useWebSocket.ts:218-244):
```typescript
socket.on('disconnect', (reason) => {
  setIsConnected(false);
  stopKeepAlive();
  onDisconnected?.();

  // Auto-reconnect except for manual disconnects
  if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
    // More forgiving for transport errors
    if (reason === 'transport close' || reason === 'transport error') {
      reconnectAttemptsRef.current = Math.max(0, reconnectAttemptsRef.current - 1);
    }
    
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      scheduleReconnect();
    }
  }
});
```

**Disconnect Reasons** (from Socket.IO):
- `transport close` - Network issue, auto-reconnect ✅
- `transport error` - Transport failed, auto-reconnect ✅
- `ping timeout` - No pong received for 60s, auto-reconnect ✅
- `io client disconnect` - Manual disconnect, no reconnect ❌
- `io server disconnect` - Server closed, no reconnect ❌

### 5.2 Reconnection Strategy

**Exponential Backoff** (useWebSocket.ts:350-379):
```typescript
const scheduleReconnect = useCallback(() => {
  const baseDelay = 1000;     // 1 second
  const maxDelay = 8000;      // 8 seconds (reduced for PWA)
  const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current), maxDelay);
  reconnectAttemptsRef.current++;
  
  reconnectTimeoutRef.current = setTimeout(() => {
    if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
      connect();  // Trigger new connection
    } else {
      // Max attempts reached, reset after 30s
      setTimeout(() => {
        reconnectAttemptsRef.current = 0;
        scheduleReconnect();
      }, 30000);
    }
  }, delay);
}, []);
```

**Reconnection Timeline**:
```
Attempt | Delay     | Cumulative Time
--------|-----------|------------------
1       | 1.0s      | 1.0s
2       | 1.5s      | 2.5s
3       | 2.25s     | 4.75s
4       | 3.38s     | 8.13s
5       | 5.06s     | 13.19s
6       | 7.59s     | 20.78s
7       | 8.0s (max)| 28.78s
8       | 8.0s      | 36.78s
9       | 8.0s      | 44.78s
10      | 8.0s      | 52.78s (max attempts)
```

**After 10 Attempts**: Wait 30s, then reset attempts to 0 and retry

### 5.3 Room Re-Join on Reconnect

**Critical Pattern** ✅:
```typescript
// From useWebSocket.ts:173-185
socket.on('connect', () => {
  setIsConnected(true);
  reconnectAttemptsRef.current = 0;  // Reset attempts
  
  // ⚠️ CRITICAL: Re-join rooms on reconnect
  if (canteenIds.length > 0) {
    socket.emit('joinCanteenRooms', canteenIds);
  }
});
```

**Why This Matters**:
- Reconnection creates **new socket ID**
- Server has **no memory** of previous room memberships
- Without re-join, client receives NO events

**Example Flow**:
```
T0: Client connects (socketId = ABC)
T1: Client joins canteen_1
T2: Server broadcasts new_order → ABC receives ✅
T3: Network drops, disconnect
T4: Server removes ABC from canteen_1
T5: Client reconnects (socketId = XYZ)
T6: Server broadcasts new_order → ABC gone, XYZ not in room ❌
T7: Client emits joinCanteenRooms → XYZ added to canteen_1
T8: Server broadcasts new_order → XYZ receives ✅
```

**Gap**: Events between T5 and T7 are **LOST** ⚠️

### 5.4 Missed Event Recovery

**No Event Replay** ⚠️:
- Server does NOT queue events
- Events broadcast once and forgotten
- Missed events are lost forever

**Recovery Mechanisms**:

**1. React Query Cache Invalidation on Reconnect**:
```typescript
// Pattern: Invalidate cache on reconnect (from useMultiCanteenWebSocket.ts:19-29)
const handleNewOrder = useCallback((order: any) => {
  queryClient.invalidateQueries({ queryKey: ['/api/orders', order.canteenId] });
  queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated'] });
  queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated] });
}, [queryClient]);
```

**Result**: Next component render triggers fresh API call

**2. Fallback Polling When Disconnected**:
```typescript
// Pattern: Poll when WebSocket down (from OrderStatusPage.tsx:386-402)
const pollingStatus = useOrderStatusPolling({
  orderId,
  enabled: !!orderId,
  isWebSocketConnected,
  isWebSocketConnecting,
  pollingInterval: 4000  // Poll every 4s when disconnected
});
```

**3. Keepalive Ping/Pong**:
```typescript
// From useWebSocket.ts:189-215
keepAliveIntervalRef.current = setInterval(() => {
  const timeSinceLastPong = Date.now() - lastPongRef.current;
  
  if (timeSinceLastPong > 30000) {
    // No pong received in 30s, connection stale
    socket.disconnect();
    scheduleReconnect();
  } else {
    socket.emit('ping');  // Send ping
  }
}, 15000);  // Every 15 seconds
```

**4. Page Visibility Detection**:
```typescript
// From useWebSocket.ts:456-492
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    // Page became visible (app foregrounded)
    const timeSinceLastPong = Date.now() - lastPongRef.current;
    if (timeSinceLastPong > 30000) {
      reconnect();  // Connection stale, reconnect
    } else {
      socket.emit('ping');  // Verify connection
    }
  } else {
    // Page hidden (app backgrounded)
    stopKeepAlive();  // Save battery
  }
};
```

**5. Network Online/Offline Events**:
```typescript
// From useWebSocket.ts:497-511
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

---

## 6. Multi-Device Scenarios

### 6.1 Same User, Multiple Devices

**Architecture**:
```
User A                          Server                          Database
  |                               |                               |
Device 1 (socketId=ABC)           |                               |
  ├─ joinCanteenRooms([1])        |                               |
  |                               ├─ canteenRooms[1] = {ABC}     |
  |                               |                               |
Device 2 (socketId=XYZ)           |                               |
  ├─ joinCanteenRooms([1])        |                               |
  |                               ├─ canteenRooms[1] = {ABC, XYZ} |
  |                               |                               |
  |                               | [New order created]           |
  |                               ├─ io.to(canteen_1).emit(...)   |
  |<─ orderUpdate ────────────────┤                               |
Device 2                          │                               |
  |<─ orderUpdate ────────────────┘                               |
```

**Guarantee**: ✅ Both devices receive all events (at-least-once)

**Scenario 1: Order Status Tracking**
```
Time  | Device 1 (Phone)           | Device 2 (Laptop)          | Server
------+----------------------------+---------------------------+------------------
T0    | View order #1234           | View order #1234          |
T1    | Status: preparing          | Status: preparing         |
T2    |                            |                           | Chef marks ready
T3    | WS: order_status_changed   | WS: order_status_changed  |
T4    | Status: ready ✅           | Status: ready ✅          |
```

**Result**: ✅ Synchronized (both update to "ready")

**Scenario 2: Cart Management** (Multi-Device)

**Problem**: Cart stored in **localStorage** (device-specific, no cross-device sync)

```
Time  | Device 1 (Phone)           | Device 2 (Laptop)
------+----------------------------+---------------------------
T0    | cart = [{item1: 1}]        | cart = []
T1    | addToCart(item2, 1)        |
T2    | cart = [{item1:1, item2:1}]| cart = [] ⚠️
T3    |                            | addToCart(item3, 1)
T4    | cart = [{item1:1, item2:1}]| cart = [{item3:1}] ⚠️
```

**Result**: ❌ **NOT synchronized** across devices

**Workaround**: User must manually add items on each device

**Why Not Synced**:
- Cart stored in localStorage (browser-specific)
- No server-side cart state
- No WebSocket broadcast for cart changes

**Exception**: Favorites ARE synced (server-side state)

### 6.2 Same User, Multiple Browser Tabs (Same Device)

**Cross-Tab Synchronization via `storage` Event**:

```typescript
// Pattern: Cross-Tab Cart Sync (from CartContext.tsx:110-163)
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith('digital-canteen-cart-')) {
      return;
    }
    
    const canteenId = e.key.replace('digital-canteen-cart-', '');
    
    if (canteenId === currentCanteenId && e.newValue) {
      const parsedCart = JSON.parse(e.newValue);
      setCart(parsedCart);  // Sync from other tab
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, [currentCanteenId]);
```

**Same-Tab Sync via Custom Event**:
```typescript
// Emit (CartContext.tsx:103-106)
window.dispatchEvent(new CustomEvent('cartUpdated', { 
  detail: { canteenId, cart } 
}));

// Listen (CartContext.tsx:145-155)
window.addEventListener('cartUpdated', (e: CustomEvent) => {
  if (e.detail.canteenId === currentCanteenId) {
    setCart(e.detail.cart);
  }
});
```

**Why Both Mechanisms?**:
- `storage` event: Fires in **other tabs** only (not origin tab)
- Custom event: Fires in **same tab** (for components)

**Timeline Example**:
```
Time  | Tab A                    | Tab B                    | localStorage
------+-------------------------+-------------------------+------------------
T0    | cart = [{item1: 1}]     | cart = [{item1: 1}]     | [{item1: 1}]
T1    | addToCart(item2, 1)     |                         |
T2    | setCart([...])          |                         |
T3    | localStorage.setItem()  |                         | [{item1:1, item2:1}]
T4    | dispatchEvent('cartUpdated') (same tab)          |
T5    |                         | storage event (cross-tab) ⚠️
T6    |                         | setCart([{item1:1, item2:1}]) | 
T7    |                         | cart = [{item1:1, item2:1}] ✅ Synced
```

**Race Condition Risk** ⚠️:
```
Time  | Tab A                    | Tab B                    | localStorage
------+-------------------------+-------------------------+------------------
T0    | cart = [{item1: 1}]     | cart = [{item1: 1}]     | [{item1: 1}]
T1    | addToCart(item2, 1)     |                         |
T2    | cart = [{item1:1, item2:1}] |                     |
T3    |                         | addToCart(item3, 1)     |
T4    | localStorage.set([{item1:1, item2:1}]) |          | [{item1:1, item2:1}]
T5    |                         | cart = [{item1:1, item3:1}] |
T6    |                         | localStorage.set([...]) | [{item1:1, item3:1}]
T7    | (storage event)         |                         | [{item1:1, item3:1}]
T8    | cart = [{item1:1, item3:1}] ⚠️ item2 lost        |

Result: Last-write-wins (item2 lost)
```

**Mitigation**: User unlikely to use multiple tabs simultaneously. If occurs, can re-add.

### 6.3 Multiple Roles, Same Canteen

**Scenario**: Admin + Owner + Counter Staff all watching same canteen

```
Time  | Admin (socketId=A)       | Owner (socketId=B)       | Counter (socketId=C)
------+-------------------------+-------------------------+-------------------------
T0    | joinCanteenRooms([1])   | joinCanteenRooms([1])   | joinCanteenRooms([1])
      |                         |                         | joinCounterRoom(store_1)
T1    |                         |                         | [New order created]
T2    | WS: new_order ✅        | WS: new_order ✅        | WS: new_order ✅
      |                         |                         | WS: new_order (counter) ✅
T3    |                         |                         | [Mark order ready]
T4    | WS: order_status_changed✅ | WS: order_status_changed✅ | WS: item_status_changed✅
```

**Result**: ✅ All roles receive events (room-based filtering, no role validation)

**Security Note** ⚠️:
- Server does NOT validate user role when joining rooms
- Malicious client can join any room (e.g., admin client joins counter room)
- Trust model: Client self-identifies correctly

---

## 7. Cross-Role Realtime Interactions

### 7.1 Student → Canteen Owner → Counter Staff

**Flow**: Student places online order

```
STEP 1: Student places order
  ↓
Student (Device A)
  ├─ POST /api/orders (create order)
  ↓
Server
  ├─ Save order to MongoDB
  ├─ Broadcast to canteen room
  │   wsManager.broadcastNewOrder(canteenId, order)
  │   → io.to('canteen_1').emit('orderUpdate', { type: 'new_order', data: order })
  ├─ Broadcast to counter rooms (store/payment/KOT)
  │   order.allStoreCounterIds.forEach(counterId => {
  │     wsManager.broadcastToCounter(counterId, 'new_order', order)
  │   })
  ↓
Canteen Owner (Device B)
  ├─ Receives: orderUpdate { type: 'new_order' } ✅
  ├─ Invalidates: queryClient.invalidateQueries(['/api/orders'])
  ├─ UI: Shows new order in dashboard
  ↓
Counter Staff (Device C)
  ├─ Receives: orderUpdate { type: 'new_order' } ✅ (canteen room)
  ├─ Receives: orderUpdate { type: 'new_order' } ✅ (counter room)
  ├─ Invalidates: queryClient.invalidateQueries(['/api/orders'])
  ├─ UI: Shows new order in counter interface
  ↓
Student (Device A)
  ├─ Navigate to /order-tracking/:id
  ├─ WebSocket connected
  ├─ Status: "pending" → "preparing"
```

**Events Received**:
- Owner: 1 event (`new_order` from canteen room)
- Counter: 2 events (`new_order` from canteen room + counter room) ⚠️ Duplicate
- Student: 0 events (not subscribed to canteen room at this point)

### 7.2 Counter Staff → Student → Owner

**Flow**: Counter staff marks order ready

```
STEP 1: Counter staff marks ready
  ↓
Counter Staff (Device C)
  ├─ POST /api/orders/:id/mark-ready
  ↓
Server
  ├─ Update order.itemStatusByCounter[kotCounterId] = 'ready'
  ├─ Broadcast status change
  │   wsManager.broadcastOrderStatusUpdate(canteenId, order, oldStatus, newStatus)
  │   → io.to('canteen_1').emit('orderUpdate', { type: 'order_status_changed' })
  ├─ Broadcast to counter rooms
  │   wsManager.broadcastToCounter(counterId, 'item_status_changed', order)
  ↓
Student (Device A) - Watching order status
  ├─ Receives: orderUpdate { type: 'order_status_changed', newStatus: 'ready' } ✅
  ├─ Invalidates: queryClient.invalidateQueries(['/api/orders', orderId])
  ├─ UI: Status changes to "ready" ✅
  ├─ Push notification: "Your order is ready!"
  ↓
Canteen Owner (Device B)
  ├─ Receives: orderUpdate { type: 'order_status_changed' } ✅
  ├─ Invalidates: queryClient.invalidateQueries(['/api/orders'])
  ├─ UI: Order status updates in dashboard
  ↓
Counter Staff (Device C)
  ├─ Receives: orderUpdate { type: 'order_status_changed' } ✅ (canteen room)
  ├─ Receives: orderUpdate { type: 'item_status_changed' } ✅ (counter room)
  ├─ Invalidates: queryClient.invalidateQueries(['/api/orders'])
  ├─ UI: Order status updates ⚠️ 2 cache invalidations
```

**Events Received**:
- Student: 1 event (`order_status_changed` from canteen room)
- Owner: 1 event (`order_status_changed` from canteen room)
- Counter: 2 events (`order_status_changed` + `item_status_changed`) ⚠️ Duplicate

**Optimization**: Client handles duplicates idempotently (cache invalidation is idempotent)

### 7.3 Payment Gateway → Server → All Roles

**Flow**: Payment webhook confirms payment

```
STEP 1: Payment gateway (Razorpay) sends webhook
  ↓
Server
  ├─ POST /api/payments/webhook/razorpay
  ├─ Verify webhook signature
  ├─ Update order: paymentStatus = 'PAID', status = 'preparing'
  ├─ Sequential broadcasts (lines 6678-6750 in routes.ts):
  │   1. wsManager.broadcastNewOrder(canteenId, order)
  │   2. wsManager.broadcastToCanteen(canteenId, 'payment_confirmed', {...})
  │   3. wsManager.broadcastToCanteen(canteenId, 'order_updated', order)
  │   4. Broadcast to store counters: wsManager.broadcastToCounter(counterId, 'new_order', order)
  ↓
Student (Device A) - Watching order status
  ├─ Receives: orderUpdate { type: 'new_order' } ✅
  ├─ Receives: orderUpdate { type: 'payment_confirmed' } ✅
  ├─ Receives: orderUpdate { type: 'order_updated' } ✅
  ├─ Total: 3 events ⚠️ (all for same logical action)
  ├─ Invalidates: queryClient.invalidateQueries 3 times
  ├─ UI: Shows "Payment successful! Order preparing..." ✅
  ↓
Canteen Owner (Device B)
  ├─ Receives: 3 events (same as student)
  ├─ UI: New order appears in dashboard ✅
  ↓
Counter Staff (Device C)
  ├─ Receives: 3 events from canteen room
  ├─ Receives: 1 event from counter room ('new_order')
  ├─ Total: 4 events ⚠️
  ├─ Invalidates: queryClient.invalidateQueries 4 times
  ├─ UI: Order appears in counter interface ✅
```

**Why Multiple Broadcasts?**:
1. `new_order` - Add to active orders list
2. `payment_confirmed` - Remove from payment pending list (if any)
3. `order_updated` - Update order details
4. `new_order` (counter) - Notify counter staff specifically

**Result**: Client receives 3-4 events for same order, must handle idempotently

### 7.4 Delivery Assignment Flow

**Flow**: Order ready for delivery → Sequential assignment to delivery persons

```
STEP 1: Counter staff marks "Out for Delivery"
  ↓
Counter Staff
  ├─ POST /api/orders/:id/out-for-delivery
  ↓
Server (Delivery Assignment Service)
  ├─ Get available delivery persons for canteen
  ├─ Sort by: totalOrderDelivered ASC, createdAt ASC
  ├─ deliveryPersons = [DP1, DP2, DP3]
  ├─ Start sequential assignment
  │   ├─ Mark DP1 as unavailable (isAvailable = false)
  │   ├─ wsManager.broadcastToDeliveryPerson(DP1.email, {
  │   │     type: 'delivery_assignment_request',
  │   │     data: { orderId, orderNumber, timeout: 120000 }
  │   │   })
  │   ├─ Set 2-minute timer
  ↓
Delivery Person 1 (Device D1)
  ├─ Receives: deliveryAssignment { type: 'delivery_assignment_request' } ✅
  ├─ UI: Shows notification "New delivery: Order #1234"
  ├─ Audio: new-delivery.mp3
  ├─ User has 2 minutes to accept
  │
  ├─ Scenario A: DP1 accepts
  │   ├─ POST /api/delivery/assignments/:orderId/accept
  │   ├─ Server: Clear timer, assign order, mark as unavailable
  │   ├─ wsManager.broadcastOrderStatusUpdate(canteenId, order, 'ready', 'out_for_delivery')
  │   ├─ Student receives: order_status_changed ✅
  │   ├─ Owner receives: order_status_changed ✅
  │   └─ ✅ Assignment complete
  │
  ├─ Scenario B: DP1 rejects or timeout
  │   ├─ Server: Mark DP1 as available again
  │   ├─ Move to next delivery person
  │   ├─ Mark DP2 as unavailable
  │   ├─ wsManager.broadcastToDeliveryPerson(DP2.email, {...})
  │   └─ Repeat cycle
  ↓
Delivery Person 2 (Device D2)
  ├─ Receives: deliveryAssignment { type: 'delivery_assignment_request' } ✅
  ├─ (Same flow as DP1)
```

**Guarantees**:
- ✅ Only ONE delivery person receives assignment at a time (sequential)
- ✅ 2-minute timeout per delivery person
- ✅ Cycles through all available persons, then repeats
- ⚠️ If all timeout, order stays in "ready" state (manual intervention)

**Missed Assignment Scenario**:
```
Time  | Delivery Person          | Server Action
------+-------------------------+----------------------------------
T0    | DP1 app open, connected | Send assignment → DP1
T1-120| DP1 doesn't notice      | Timer running
T120  | (Timeout)               | Mark DP1 available, try DP2
T121  | DP1 closes notification | Assignment moved to DP2 ✅
```

---

## 8. Event Criticality Classification

### 8.1 CRITICAL Events (Must Never Be Missed)

**Definition**: Events that represent irreversible business actions or affect user experience significantly.

| Event Type | Business Impact | Missed Consequence | Recovery Mechanism |
|------------|----------------|--------------------|--------------------|
| `payment_success` | Payment confirmed, money deducted | User paid but order not created ⚠️ | Razorpay webhook + idempotency key |
| `order_status_changed` (to `delivered`) | Order completed, delivery confirmed | User waiting indefinitely | Fallback polling (4s interval) |
| `delivery_assignment_request` | Delivery person must accept | Order not delivered | 2-minute timeout, try next person |
| `checkout_session_status_changed` (to `expired`) | Stock restored, checkout failed | User thinks session valid | Client-side timer + polling fallback |

**Recovery Pattern for CRITICAL Events**:
```typescript
// Pattern 1: Idempotent API design
POST /api/payments/webhook/razorpay
  → Check merchantTransactionId (unique)
  → If already processed, return 200 OK
  → Else, process payment and create order

// Pattern 2: Fallback polling
const { data } = useQuery({
  queryKey: ['/api/orders', orderId],
  queryFn: fetchOrder,
  refetchInterval: socket?.connected ? false : 4000  // Poll if disconnected
});

// Pattern 3: Client-side timeout
useEffect(() => {
  if (sessionTimeLeft <= 0) {
    // Session expired, show dialog
    setShowTimeoutDialog(true);
    navigate('/cart');
  }
}, [sessionTimeLeft]);
```

### 8.2 EVENTUALLY_CONSISTENT Events

**Definition**: Events that represent state changes that will be discovered through other means (API polling, user refresh).

| Event Type | Business Impact | Missed Consequence | Recovery Mechanism |
|------------|----------------|--------------------|--------------------|
| `new_order` | New order placed | Staff doesn't see immediately | Polling every 30s, manual refresh |
| `order_status_changed` (non-terminal states) | Order in progress | User sees stale status | Polling on order tracking page |
| `item_status_changed` | Item marked ready | Counter staff sees stale status | Polling + manual refresh |
| `menu_updated` | Menu item changed | Users see old menu | React Query staleTime (30s) |
| `banner_updated` | Banner changed | Users see old banner | React Query cache + manual refresh |

**Recovery Pattern**:
```typescript
// Pattern: React Query with staleTime
const { data: orders } = useQuery({
  queryKey: ['/api/orders/active'],
  queryFn: fetchActiveOrders,
  staleTime: 30000,         // Consider data stale after 30s
  refetchInterval: 30000,   // Refetch every 30s (if component mounted)
  refetchOnWindowFocus: true // Refetch when user returns to tab
});
```

**User-Initiated Recovery**:
- Pull-to-refresh gesture
- Manual refresh button
- Navigate away and back

### 8.3 SAFE_TO_DROP Events

**Definition**: Events that are purely informational or have no business impact if missed.

| Event Type | Business Impact | Missed Consequence | Recovery Mechanism |
|------------|----------------|--------------------|--------------------|
| `roomJoined` | Connection confirmation | No impact (client knows if connected) | None needed |
| `counterRoomJoined` | Counter room confirmation | No impact | None needed |
| `pong` | Keepalive response | Client uses timeout to detect stale connection | Keepalive timer (30s timeout) |
| `order_updated` (duplicate) | Same as order_status_changed | Already handled by primary event | Idempotent cache invalidation |

**No Recovery Needed**: These events are not critical for business logic.

### 8.4 Debounced Events

**Definition**: Events with rate limiting to reduce network traffic.

**Checkout Session Status** (from websocket.ts:379-444):
```typescript
public broadcastCheckoutSessionStatus(...) {
  const BROADCAST_DEBOUNCE_MS = 2000;        // Don't broadcast within 2s
  const TIME_CHANGE_THRESHOLD = 5;           // Only if time changed >5s

  const cached = this.checkoutSessionBroadcastCache.get(sessionId);
  if (cached) {
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);

    // Skip if last broadcast <2s ago AND time change <5s
    if (timeSinceLastBroadcast < BROADCAST_DEBOUNCE_MS && 
        timeRemainingDiff < TIME_CHANGE_THRESHOLD) {
      return;  // ⚠️ Event DROPPED (intentionally)
    }
  }
  
  // Broadcast event
  this.io.to(roomName).emit('orderUpdate', {...});
}
```

**Why Debounce?**:
- Checkout session timer broadcasts every second (potentially)
- Would generate 300 events over 5 minutes
- Debouncing reduces to ~60 events (every 5 seconds)

**Result**: Some `checkout_session_status_changed` events intentionally dropped ✅

**Client Compensation**: Client has its own countdown timer (not relying solely on WebSocket)

---

## 9. Duplicate Event Handling

### 9.1 Sources of Duplicates

**1. Multi-Room Broadcasts**:
```typescript
// Counter staff receives BOTH broadcasts
wsManager.broadcastNewOrder(canteenId, order);          // Canteen room
wsManager.broadcastToCounter(counterId, 'new_order', order); // Counter room
```

**2. Sequential Broadcasts for Same Action**:
```typescript
// Payment confirmed flow (routes.ts:6678-6750)
wsManager.broadcastNewOrder(canteenId, order);                    // Event 1
wsManager.broadcastToCanteen(canteenId, 'payment_confirmed', {}); // Event 2
wsManager.broadcastToCanteen(canteenId, 'order_updated', order);  // Event 3
```

**3. Reconnection Mid-Event**:
```
T0: Server broadcasts event → Client disconnected ❌
T1: Client reconnects
T2: Client refetches via React Query → Gets same data ✅
T3: Server broadcasts again (unrelated event) → Client receives ✅
```

**Result**: Client may process same order update twice

### 9.2 Client-Side Deduplication

**Pattern 1: Idempotent Cache Invalidation**:
```typescript
// From useMultiCanteenWebSocket.ts:20-29
const handleNewOrder = useCallback((order: any) => {
  // Invalidate queries (idempotent operation)
  queryClient.invalidateQueries({ queryKey: ['/api/orders', order.canteenId] });
  queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated'] });
  
  // Result: Multiple invalidations → Single API call (React Query dedupes)
}, [queryClient]);
```

**Why It Works**: React Query batches invalidations and deduplicates fetch requests

**Pattern 2: Direct Cache Update (Idempotent)**:
```typescript
// From OrderStatusPage.tsx:391-396
onDataUpdate: (updatedOrder) => {
  queryClient.setQueryData(['/api/orders', orderId], updatedOrder);
  // Result: Multiple calls with same data → Same final state
}
```

**Why It Works**: Setting cache to same value multiple times is idempotent

**Pattern 3: Event Type Handling**:
```typescript
// From useWebSocket.ts:280-328
socket.on('orderUpdate', (message: WebSocketMessage) => {
  switch (message.type) {
    case 'new_order':
      onNewOrder?.(message.data);
      break;
    case 'payment_confirmed':
      onNewOrder?.((message as any).data?.order ?? message.data); // Same callback
      break;
    case 'order_updated':
    case 'order_status_changed':
      onOrderUpdate?.(message.data); // Same callback
      if (message.oldStatus && message.newStatus) {
        onOrderStatusChange?.(message.data, message.oldStatus, message.newStatus);
      }
      break;
    case 'item_status_changed':
      onItemStatusChange?.(message.data);
      onOrderUpdate?.(message.data); // Call both ⚠️
      break;
  }
});
```

**Result**: 
- `payment_confirmed` + `new_order` → Both trigger `onNewOrder` callback
- `item_status_changed` + `order_status_changed` → Trigger different callbacks

**Optimization**: Components handle callbacks idempotently

### 9.3 Server-Side Deduplication (Checkout Sessions)

**Debounce Logic** (websocket.ts:379-444):
```typescript
private checkoutSessionBroadcastCache: Map<string, { 
  lastBroadcast: number; 
  lastTimeRemaining: number 
}> = new Map();

public broadcastCheckoutSessionStatus(...) {
  const cached = this.checkoutSessionBroadcastCache.get(sessionId);
  
  // Skip if broadcasted recently AND time hasn't changed much
  if (cached) {
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);
    
    if (timeSinceLastBroadcast < 2000 && timeRemainingDiff < 5) {
      return;  // Drop duplicate
    }
  }
  
  // Update cache
  this.checkoutSessionBroadcastCache.set(sessionId, {
    lastBroadcast: now,
    lastTimeRemaining: timeRemaining
  });
  
  // Broadcast
  this.io.to(roomName).emit('orderUpdate', message);
}
```

**Cache Cleanup** (lines 406-413):
```typescript
// Clean up old cache entries (older than 5 minutes)
if (this.checkoutSessionBroadcastCache.size > 1000) {
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  for (const [key, value] of this.checkoutSessionBroadcastCache.entries()) {
    if (value.lastBroadcast < fiveMinutesAgo) {
      this.checkoutSessionBroadcastCache.delete(key);
    }
  }
}
```

---

## 10. Failure Modes and Recovery

### 10.1 WebSocket Connection Lost

**Failure Scenario**:
```
T0: Client connected, receiving events ✅
T1: Network drops (mobile switches WiFi → 4G)
T2: Socket.IO detects disconnect (ping timeout after 60s)
T3: Client triggers reconnect (exponential backoff)
T4: (10 seconds pass during reconnect)
T5: Client reconnects ✅
T6: Client re-joins rooms ✅
```

**Events Missed**: All events between T1 and T6 (potentially 10+ seconds of events)

**Recovery**:
1. **React Query Invalidation**:
   ```typescript
   socket.on('connect', () => {
     // Invalidate all queries to force refetch
     queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
   });
   ```

2. **Fallback Polling** (if reconnection fails):
   ```typescript
   const { data } = useQuery({
     queryKey: ['/api/orders', orderId],
     queryFn: fetchOrder,
     refetchInterval: socket?.connected ? false : 4000  // Poll every 4s
   });
   ```

3. **User Manual Refresh**:
   - Pull-to-refresh gesture
   - Refresh button
   - Navigate away and back

**Result**: ✅ Eventually consistent (within 4-30 seconds)

### 10.2 Checkout Session Timeout During Payment

**Failure Scenario**:
```
Time  | User Action                 | Server State               | Client State
------+----------------------------+---------------------------+------------------
T0    | Create checkout session     | session.expiresAt = T0+5m | sessionTimeLeft = 300s
T290s | Initiate Razorpay payment   | session.status = 'active' | sessionTimeLeft = 10s
T295s | (In Razorpay modal)         | session.status = 'active' | sessionTimeLeft = 5s
T300s |                             | Session expires ⚠️         | sessionTimeLeft = 0s
      |                             | Stock restored            | 
T310s | Complete payment in modal   | session.status = 'expired'| showTimeoutDialog = true
T311s | Razorpay callback           | Payment verified ✅       | 
T312s | Server checks session       | Session expired ❌        | 
```

**Problem**: Payment succeeded but session expired (stock already restored)

**Resolution** (from routes.ts:3604-3867):
```typescript
// Payment initiation endpoint
app.post("/api/payments/initiate", async (req, res) => {
  const { checkoutSessionId } = req.body;
  
  // Validate session exists and is active
  const checkoutSession = await CheckoutSessionService.getSession(checkoutSessionId);
  if (!checkoutSession) {
    return res.status(404).json({ message: "Checkout session not found or expired" });
  }
  
  // Check for duplicate payment from same session (idempotency)
  const duplicate = await CheckoutSessionService.checkDuplicatePaymentFromSession(checkoutSessionId);
  if (duplicate.isDuplicate) {
    return res.status(409).json({ message: "Payment already in progress" });
  }
  
  // Create payment record BEFORE session expires
  // This ensures we can track payment even if session expires
  await storage.createPayment({
    merchantTransactionId: merchantOrderId,
    checkoutSessionId: checkoutSessionId,
    amount: amount * 100,
    status: PAYMENT_STATUS.PENDING
  });
  
  // Payment webhook will handle session expiry gracefully
});
```

**Webhook Handling** (from routes.ts:6500-6750):
```typescript
// Payment webhook (Razorpay callback)
app.post("/api/payments/webhook/razorpay", async (req, res) => {
  // Verify signature
  const isValidSignature = verifyRazorpaySignature(req.body, req.headers['x-razorpay-signature']);
  if (!isValidSignature) {
    return res.status(400).json({ message: "Invalid signature" });
  }
  
  // Get payment record (has checkoutSessionId)
  const payment = await storage.getPaymentByRazorpayOrderId(razorpayOrderId);
  
  // Get session (may be expired)
  const session = await CheckoutSessionService.getSession(payment.checkoutSessionId);
  
  if (session.status === 'expired') {
    // Session expired BUT payment succeeded
    // Create order anyway, re-reserve stock
    console.log("⚠️ Session expired but payment succeeded, creating order anyway");
    
    // Re-reserve stock (atomic operation)
    await stockService.processStockUpdates(session.cartItems);
    
    // Create order
    const order = await storage.createOrder({
      ...session.metadata,
      paymentStatus: 'PAID'
    });
    
    // Mark session as completed (not expired)
    await CheckoutSessionService.completeSession(session.sessionId);
    
    return res.status(200).json({ order });
  }
  
  // Normal flow: session still active
  // ...
});
```

**Result**: ✅ Payment never lost, order created even if session expired

**Key Safeguards**:
1. Payment record created BEFORE session expires (preserves checkoutSessionId link)
2. Webhook checks session status and re-reserves stock if needed
3. Idempotency via `merchantTransactionId` (prevents double-charging)

### 10.3 Delivery Assignment Timeout

**Failure Scenario**:
```
Time  | Delivery Person         | Server Action
------+------------------------+----------------------------------
T0    | DP1 app open           | Assign order to DP1
      |                        | Mark DP1 unavailable
      |                        | broadcastToDeliveryPerson(DP1)
      |                        | Set 2-minute timer
T1-60 | DP1 driving            | Timer running
T60   | DP1 doesn't see notif  | Timer running
T120  | (Timeout)              | Clear timer
      |                        | Mark DP1 available ✅
      |                        | Try next: DP2
T121  |                        | Assign to DP2
      |                        | Mark DP2 unavailable
      |                        | broadcastToDeliveryPerson(DP2)
T180  | DP2 accepts            | ✅ Order assigned to DP2
```

**Recovery**: Automatic (sequential fallback to next delivery person)

**Cycle Behavior** (from delivery-assignment-service.ts:84-87):
```typescript
// Check if we've cycled through all persons - reset to start
if (assignment.currentDeliveryPersonIndex >= assignment.deliveryPersonIds.length) {
  console.log(`🔄 Cycled through all delivery persons, resetting to first person`);
  assignment.currentDeliveryPersonIndex = 0; // Reset to start of cycle
}
```

**Worst Case**: All delivery persons timeout → Cycles back to first → Repeats indefinitely

**Manual Intervention**: If all timeout repeatedly, owner must assign manually or mark order as pickup

### 10.4 Multi-Tab Cart Race Condition

**Failure Scenario**:
```
Time  | Tab A                    | Tab B                    | localStorage
------+-------------------------+-------------------------+------------------
T0    | cart = [{item1: 1}]     | cart = [{item1: 1}]     | [{item1: 1}]
T1    | addToCart(item2, 1)     |                         |
T2    | cart = [{item1:1, item2:1}] |                     |
T3    |                         | addToCart(item3, 1)     |
T4    | localStorage.set([...]) |                         | [{item1:1, item2:1}]
T5    |                         | cart = [{item1:1, item3:1}] |
T6    |                         | localStorage.set([...]) | [{item1:1, item3:1}]
T7    | (storage event)         |                         | [{item1:1, item3:1}]
T8    | cart = [{item1:1, item3:1}] ⚠️ item2 lost        |
```

**Problem**: Last-write-wins (item2 lost)

**Likelihood**: Low (user unlikely to use 2 tabs simultaneously)

**Recovery**: User re-adds lost item manually

**Mitigation Options** (NOT implemented):
1. Operational Transform (CRDT-based merge)
2. Server-side cart state (adds latency)
3. localStorage locking (complex, brittle)

**Current Decision**: Accept race condition (rare, low impact, easy recovery)

---

## Summary Table: Consistency Guarantees

| Aspect | Guarantee | Mechanism | Failure Mode |
|--------|-----------|-----------|--------------|
| **Event Delivery** | At-least-once | Socket.IO rooms | Disconnect → events lost |
| **Event Ordering** | Within-room only | Socket.IO guarantee | Cross-room: no order |
| **Room Membership** | Explicit join required | Client re-joins on reconnect | Forgot to re-join → no events |
| **Duplicate Events** | Possible | Client handles idempotently | Multiple cache invalidations |
| **Reconnection** | Exponential backoff | Custom logic (max 10 attempts) | Max attempts → 30s pause → retry |
| **Missed Events** | No replay | React Query cache invalidation | Eventual consistency (4-30s) |
| **Multi-Device** | Eventually consistent | WebSocket + localStorage | Cart: device-specific (no sync) |
| **Cross-Tab** | Eventually consistent | `storage` event + custom event | Race condition (last-write-wins) |
| **Critical Events** | Idempotent + polling | Payment webhook, delivery timeout | Graceful degradation |
| **Session Expiry** | Grace period + re-reserve | Webhook checks session status | Order created even if expired |

---

**End of Real-Time Consistency Specification**

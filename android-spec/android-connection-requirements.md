# Android Helper Connection Requirements

**Target**: Canteen Owner Dashboard Android App  
**Purpose**: Receive real-time order notifications for specific canteen and counter rooms  
**Extracted From**: Backend codebase analysis  
**Date**: 2026-01-03

---

## Overview

For the Android Helper app to receive order notifications, it must:
1. **Establish WebSocket connection** to server
2. **Obtain canteenId** from authenticated owner
3. **Obtain counterId(s)** (optional, for counter-specific orders)
4. **Join canteen room** via Socket.IO event
5. **Join counter room(s)** (optional, for counter-specific notifications)
6. **Listen for orderUpdate events** to receive order notifications

---

## 1. Prerequisites

### 1.1 Server Connection Details

**WebSocket URL**:
- **Development**: `http://localhost:5000` or `ws://localhost:5000`
- **Production**: `https://your-domain.com` or `wss://your-domain.com`

**Socket.IO Configuration**:
```typescript
{
  transports: ['websocket', 'polling'],  // WebSocket primary, polling fallback
  pingTimeout: 60000,    // 60 seconds
  pingInterval: 25000,   // 25 seconds
  reconnection: true,    // Enable auto-reconnection
  reconnectionDelay: 1000,     // Initial delay: 1 second
  reconnectionDelayMax: 8000,  // Max delay: 8 seconds
  reconnectionAttempts: 10     // Max attempts before giving up
}
```

**Source**: `server/websocket.ts` (lines 31-42), `android/app/.../SocketManager.kt` (lines 84-88)

### 1.2 Authentication Status

**WebSocket Authentication**: ❌ **NONE**

The WebSocket server has **NO authentication mechanism**. Any client can:
- Connect without credentials
- Join any canteen room
- Join any counter room
- Receive all events in those rooms

**Source**: `server/websocket.ts` (lines 48-50, 53-104), `android-spec/websocket-extraction.md` (lines 60-96)

**Implication for Android App**: No JWT token or session validation required for WebSocket connection. However, the app should still authenticate via REST API to obtain canteenId.

---

## 2. Obtaining CanteenId

### 2.1 REST API: Get Canteen by Owner Email

**Endpoint**: `GET /api/system-settings/canteens/by-owner/:email`

**Authentication**: None (application-level - app should only call with authenticated user's email)

**Path Parameters**:
- `email`: Canteen owner's email address (string)

**Response** (200 OK):
```typescript
{
  canteen: {
    id: string;                   // MongoDB ObjectId - REQUIRED for room join
    name: string;                 // Canteen display name
    code: string;                 // Unique canteen code
    description?: string;
    location?: string;
    contactNumber?: string;
    email?: string;
    canteenOwnerEmail: string;    // Should match request email
    operatingHours?: {
      open: string;
      close: string;
      days: string[];
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
}
```

**Errors**:
- `404`: No canteens found in system
- `404`: Canteen not found for this owner
- `500`: Database error

**Source**: `server/routes/systemSettings.ts` (lines 2697-2721), `client/src/hooks/useCanteenByOwner.ts` (lines 1-34)

**Example Usage**:
```kotlin
// After user authenticates (email/password or Google OAuth)
val ownerEmail = userSession.email

val canteenResponse = apiClient.get("/api/system-settings/canteens/by-owner/$ownerEmail")
val canteenId = canteenResponse.canteen.id  // This is the canteenId needed for room join
```

### 2.2 Alternative: User Validation Response

**Endpoint**: `GET /api/users/:id/validate`

**Authentication**: None (session-based - validates existing user session)

**Path Parameters**:
- `id`: User ID (PostgreSQL integer)

**Response** (200 OK) - For Canteen Owners:
```typescript
{
  id: number;
  name: string;
  email: string;
  role: "canteen_owner";
  phoneNumber?: string;
  // ... other user fields
  
  // Canteen data included for canteen_owner role only
  canteenId?: string;       // MongoDB ObjectId
  canteenName?: string;
  canteenCode?: string;
}
```

**Source**: `server/routes.ts` (lines 631-698), specifically lines 656-698 include canteen data for owners

**Note**: This endpoint is primarily for session validation. If canteen data is not included in the response, fall back to using `/api/system-settings/canteens/by-owner/:email`.

---

## 3. Obtaining CounterId(s)

### 3.1 REST API: Get Counters for Canteen

**Endpoint**: `GET /api/counters?canteenId={canteenId}`

**Authentication**: None (application-level)

**Query Parameters**:
- `canteenId`: Canteen ID (string) - **REQUIRED**
- `type`: Filter by counter type (optional) - Values: `'payment' | 'store' | 'kot'`

**Response** (200 OK):
```typescript
Counter[] // Array of counter objects

interface Counter {
  _id: string;                 // MongoDB ObjectId - REQUIRED for counter room join
  name: string;                // e.g., "Payment Counter 1", "Store Counter 2"
  type: 'payment' | 'store' | 'kot';
  canteenId: string;           // Must match request canteenId
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

**Errors**:
- `400`: Missing canteenId parameter
- `500`: Database error

**Source**: `server/routes.ts` (lines 7620-7636)

**Example Usage**:
```kotlin
// After obtaining canteenId
val countersResponse = apiClient.get("/api/counters?canteenId=$canteenId")
val counterIds = countersResponse.map { it._id }  // List of counter IDs

// Optional: Filter by type
val paymentCounters = countersResponse.filter { it.type == "payment" }
val storeCounters = countersResponse.filter { it.type == "store" }
val kotCounters = countersResponse.filter { it.type == "kot" }
```

### 3.2 Counter Types Explanation

| Counter Type | Purpose | Order Flow |
|-------------|---------|------------|
| **`payment`** | Process payments for orders | Customer pays → Payment counter confirms → Order proceeds |
| **`store`** | Fulfill and hand over orders | Order ready → Customer picks up from store counter |
| **`kot`** | Kitchen Order Ticket - food preparation | Order placed → KOT counter receives → Kitchen prepares |

**Source**: `android-spec/websocket-extraction.md` (lines 155-159)

**Which Counters to Join**:
- **For general order monitoring**: Join **canteen room only** (receives all orders)
- **For counter-specific operations**: Join **counter room(s)** (receives orders assigned to that counter)
- **For full dashboard functionality**: Join **both** canteen room and all counter rooms

---

## 4. WebSocket Connection Setup

### 4.1 Socket.IO Client Initialization

**Library**: `io.socket:socket.io-client:2.1.0` (minimum)

**Kotlin Implementation**:
```kotlin
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import org.json.JSONArray
import java.net.URI

class SocketManager(private val serverUrl: String) {
    private var socket: Socket? = null
    
    fun connect(userId: String, userRole: String) {
        val options = IO.Options().apply {
            // Transport configuration
            transports = arrayOf(io.socket.engineio.client.transports.WebSocket.NAME)
            
            // Reconnection configuration
            reconnection = true
            reconnectionDelay = 1000L        // 1 second initial delay
            reconnectionDelayMax = 8000L     // 8 seconds max delay
            reconnectionAttempts = 10        // Max 10 attempts
            
            // Timeout configuration
            timeout = 15000L  // 15 second connection timeout
            
            // NO auth object needed (server has no authentication)
            // auth = mapOf("token" to "...") // NOT REQUIRED
        }
        
        socket = IO.socket(URI.create(serverUrl), options)
        setupEventHandlers()
        socket?.connect()
    }
    
    private fun setupEventHandlers() {
        socket?.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected: ${socket?.id()}")
            // Connection successful - ready to join rooms
        }
        
        socket?.on(Socket.EVENT_DISCONNECT) { args ->
            val reason = args.firstOrNull() as? String ?: "unknown"
            Log.d(TAG, "Socket disconnected: $reason")
        }
        
        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG, "Connection error: ${args.firstOrNull()}")
        }
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket?.off()  // Remove all listeners
        socket = null
    }
    
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }
}
```

**Source**: `android/app/.../SocketManager.kt` (lines 70-162), `android-spec/websocket-extraction.md` (lines 46-57, 941-984)

### 4.2 Connection Lifecycle

**Connection States**:
```
Disconnected → Connecting → Connected → (Disconnect/Error) → Reconnecting → Connected
```

**Automatic Reconnection**:
- **Enabled by default** with exponential backoff
- **Initial delay**: 1 second
- **Max delay**: 8 seconds
- **Max attempts**: 10
- **Jitter**: ±30% randomness to avoid thundering herd

**Manual Reconnection**:
```kotlin
fun reconnect() {
    if (socket?.connected() == false) {
        socket?.connect()
    }
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 941-1026)

---

## 5. Joining Canteen Room

### 5.1 Socket Event: `joinCanteenRooms`

**Event Name**: `joinCanteenRooms`  
**Direction**: Client → Server  
**Purpose**: Join one or more canteen rooms to receive order updates

**Payload Options**:

**Option 1: Object Format (Recommended)**:
```kotlin
val payload = JSONObject().apply {
    put("canteenIds", JSONArray().apply {
        put(canteenId)  // Can add multiple canteen IDs
    })
    put("userId", userId)        // Optional: User ID for tracking
    put("userRole", "canteen_owner")  // Optional: Role for tracking
}

socket?.emit("joinCanteenRooms", payload)
```

**Option 2: Legacy Array Format**:
```kotlin
val canteenIdsArray = JSONArray().apply {
    put(canteenId)
}

socket?.emit("joinCanteenRooms", canteenIdsArray)
```

**Source**: `server/websocket.ts` (lines 53-104), `android-spec/websocket-extraction.md` (lines 188-222), `android-spec/05-socket-events.md` (lines 89-162)

### 5.2 Server Response: `roomJoined`

**Event Name**: `roomJoined`  
**Direction**: Server → Client  
**Purpose**: Confirm successful room join

**Payload**:
```typescript
{
  type: "connected",
  message: "Successfully joined canteen rooms",
  canteenIds: string[],
  connectedAt: Date
}
```

**Kotlin Handler**:
```kotlin
socket?.on("roomJoined") { args ->
    val data = args.firstOrNull() as? JSONObject
    val canteenIds = data?.optJSONArray("canteenIds")
    val connectedAt = data?.optString("connectedAt")
    
    Log.d(TAG, "Joined canteen rooms: $canteenIds at $connectedAt")
    // Update UI: Connection successful
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 205-213), `android-spec/05-socket-events.md` (lines 1028-1051)

### 5.3 Room Naming Convention

**Pattern**: `canteen_{canteenId}`

**Example**:
- CanteenId: `"60f7b3e4e5a1234567890abc"`
- Room Name: `"canteen_60f7b3e4e5a1234567890abc"`

**Server-Side Join Logic** (`server/websocket.ts` lines 77-88):
```typescript
ids.forEach(canteenId => {
  const roomName = `canteen_${canteenId}`;
  socket.join(roomName);
  this.canteenRooms.get(canteenId)!.add(socket.id);
});
```

**Source**: `server/websocket.ts` (lines 77-88), `android-spec/websocket-extraction.md` (lines 149-159)

### 5.4 Error Handling

**Potential Errors**:
- Invalid canteenIds format → Server emits `error` event
- Server error → Server emits `error` event

**Kotlin Error Handler**:
```kotlin
socket?.on("error") { args ->
    val errorData = args.firstOrNull() as? JSONObject
    val message = errorData?.optString("message") ?: "Unknown error"
    
    Log.e(TAG, "Socket error: $message")
    // Show user-friendly error message
}
```

**Source**: `android-spec/05-socket-events.md` (lines 166-169)

---

## 6. Joining Counter Room(s) (Optional)

### 6.1 Socket Event: `joinCounterRoom`

**Event Name**: `joinCounterRoom`  
**Direction**: Client → Server  
**Purpose**: Join a specific counter room to receive counter-specific orders

**Payload**:
```kotlin
val payload = JSONObject().apply {
    put("counterId", counterId)    // REQUIRED: Counter ID from /api/counters
    put("canteenId", canteenId)    // REQUIRED: Parent canteen ID
}

socket?.emit("joinCounterRoom", payload)
```

**Source**: `server/websocket.ts` (lines 140-181), `android-spec/websocket-extraction.md` (lines 242-262), `android-spec/05-socket-events.md` (lines 246-313)

### 6.2 Server Response: `counterRoomJoined`

**Event Name**: `counterRoomJoined`  
**Direction**: Server → Client  
**Purpose**: Confirm successful counter room join

**Payload**:
```typescript
{
  type: "counter_connected",
  message: "Successfully joined counter room",
  counterId: string,
  canteenId: string
}
```

**Kotlin Handler**:
```kotlin
socket?.on("counterRoomJoined") { args ->
    val data = args.firstOrNull() as? JSONObject
    val counterId = data?.optString("counterId")
    val canteenId = data?.optString("canteenId")
    
    Log.d(TAG, "Joined counter room: $counterId in canteen $canteenId")
    // Update UI: Counter-specific monitoring active
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 254-262), `android-spec/05-socket-events.md` (lines 294-303)

### 6.3 Room Naming Convention

**Pattern**: `counter_{counterId}`

**Example**:
- CounterId: `"counter-store-1"`
- Room Name: `"counter_counter-store-1"`

**Server-Side Join Logic** (`server/websocket.ts` lines 143-157):
```typescript
const { counterId, canteenId } = data;
const roomName = `counter_${counterId}`;

socket.join(roomName);
this.counterRooms.get(counterId)!.add(socket.id);
```

**Source**: `server/websocket.ts` (lines 143-157), `android-spec/websocket-extraction.md` (lines 149-159)

### 6.4 Joining Multiple Counters

**Scenario**: Canteen has multiple counters (e.g., 2 store counters, 1 payment counter, 1 KOT counter)

**Approach**: Emit `joinCounterRoom` for each counter sequentially

```kotlin
fun joinAllCounters(canteenId: String, counterIds: List<String>) {
    counterIds.forEach { counterId ->
        val payload = JSONObject().apply {
            put("counterId", counterId)
            put("canteenId", canteenId)
        }
        socket?.emit("joinCounterRoom", payload)
        
        // Small delay to avoid overwhelming server
        Thread.sleep(100)
    }
}
```

**Source**: Inferred from `server/websocket.ts` (lines 140-181) - server handles multiple sequential joins

---

## 7. Receiving Order Notifications

### 7.1 Socket Event: `orderUpdate`

**Event Name**: `orderUpdate`  
**Direction**: Server → Client  
**Purpose**: Broadcast order updates to all clients in canteen/counter rooms

**Payload Structure**:
```typescript
interface OrderUpdateMessage {
  type: 
    | 'new_order'                     // New order placed
    | 'new_offline_order'             // Offline order placed
    | 'order_updated'                 // Order modified
    | 'order_status_changed'          // Status transition
    | 'item_status_changed'           // Item-level status
    | 'payment_confirmed'             // Payment confirmed
    | 'payment_success'               // Payment gateway success
    | 'order_rejected'                // Order rejected
    | 'checkout_session_status_changed'  // Checkout timer
    | 'banner_updated'                // Banner changed
    | 'menu_updated';                 // Menu modified
  
  data: any;                          // Full order object or relevant data
  oldStatus?: string;                 // Previous status (for status changes)
  newStatus?: string;                 // New status (for status changes)
  orderNumber?: string;               // Order number for reference
  confirmedByCounter?: string;        // Counter that confirmed payment
  rejectedByCounter?: string;         // Counter that rejected order
  counterId?: string;                 // Target counter ID
  sessionId?: string;                 // Checkout session ID
  timeRemaining?: number;             // Checkout time (seconds)
  status?: string;                    // Checkout status
  message?: string;                   // Human-readable message
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 397-438), `server/websocket.ts` (lines 15-21), `android-spec/05-socket-events.md` (lines 669-698)

### 7.2 Critical Event: `new_order`

**When Triggered**:
- Customer places order via API (`POST /api/orders`)
- Order created successfully in database

**Server Broadcast** (`server/routes.ts` line 2847, `websocket.ts` lines 325-343):
```typescript
// 1. Broadcast to canteen room
wsManager.broadcastNewOrder(order.canteenId, order);

// 2. Also broadcast to counter rooms
order.allStoreCounterIds?.forEach(counterId => {
  wsManager.broadcastToCounter(counterId, 'new_order', order);
});
```

**Android Handler**:
```kotlin
socket?.on("orderUpdate") { args ->
    val message = args.firstOrNull() as? JSONObject
    val type = message?.optString("type")
    val data = message?.optJSONObject("data")
    val orderNumber = message?.optString("orderNumber")
    
    when (type) {
        "new_order", "new_offline_order" -> {
            // CRITICAL: New order received
            handleNewOrder(data, orderNumber)
        }
        "order_status_changed" -> {
            val oldStatus = message.optString("oldStatus")
            val newStatus = message.optString("newStatus")
            handleOrderStatusChange(data, oldStatus, newStatus)
        }
        "payment_confirmed" -> {
            handlePaymentConfirmed(data)
        }
        // ... handle other event types
    }
}

private fun handleNewOrder(orderData: JSONObject?, orderNumber: String?) {
    // Parse order data
    val customerId = orderData?.optInt("customerId")
    val customerName = orderData?.optString("customerName")
    val amount = orderData?.optDouble("amount")
    val itemsJson = orderData?.optString("items")  // JSON string, needs parsing
    val status = orderData?.optString("status")
    
    // Trigger foreground service (show notification + alarm)
    startOrderForegroundService(orderNumber, customerName, amount)
    
    // Update UI if app is in foreground
    if (isAppInForeground()) {
        showInAppAlert("New order #$orderNumber from $customerName")
    }
    
    // Log for debugging
    Log.d(TAG, "New order received: #$orderNumber, customer: $customerName, amount: ₹$amount")
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 441-488), `client/src/hooks/useWebSocket.ts` (lines 280-287), `android-spec/05-socket-events.md` (lines 702-810)

### 7.3 Order Data Structure

**Full Order Object** (sent in `data` field):
```typescript
{
  _id: string;                        // MongoDB ObjectId
  orderNumber: string;                // e.g., "ORD-20260103-001"
  customerId?: number;                // PostgreSQL user ID
  customerName: string;
  collegeName?: string;
  items: string;                      // JSON string - MUST be parsed
  amount: number;                     // Total amount (₹)
  itemsSubtotal?: number;
  taxAmount?: number;
  chargesTotal?: number;
  chargesApplied?: Array<{...}>;
  originalAmount?: number;
  discountAmount?: number;
  appliedCoupon?: string;
  status: string;                     // 'pending' | 'preparing' | 'ready' | ...
  estimatedTime: number;              // Minutes
  barcode: string;
  barcodeUsed: boolean;
  deliveredAt?: Date;
  seenBy?: number[];
  canteenId: string;                  // Matches joined canteen
  counterId?: string;
  storeCounterId?: string;
  paymentCounterId?: string;
  kotCounterId?: string;
  paymentConfirmedBy?: string;
  rejectedBy?: string;
  allStoreCounterIds?: string[];
  allPaymentCounterIds?: string[];
  allKotCounterIds?: string[];
  allCounterIds?: string[];
  isOffline?: boolean;
  paymentStatus?: string;             // 'PENDING' | 'PAID'
  paymentMethod?: string;             // 'online' | 'offline' | 'upi' | 'cash'
  qrId?: string;
  paymentId?: string;
  isCounterOrder?: boolean;
  itemStatusByCounter?: {...};
  deliveryPersonId?: string;
  orderType?: 'delivery' | 'takeaway';
  deliveryAddress?: {...};
  createdAt: Date;
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 595-695), `server/models/mongodb-models.ts` (lines 145-202)

**Critical Field: `items`**:
- **Format**: JSON string (not object)
- **Must be parsed**: `val itemsArray = JSONArray(order.items)`

**Example**:
```json
"[{\"id\":\"6789abc\",\"name\":\"Chicken Biryani\",\"quantity\":2,\"price\":150,\"customization\":\"Extra spicy\"}]"
```

**Parsing in Kotlin**:
```kotlin
fun parseOrderItems(itemsJsonString: String): List<OrderItem> {
    val itemsArray = JSONArray(itemsJsonString)
    val items = mutableListOf<OrderItem>()
    
    for (i in 0 until itemsArray.length()) {
        val item = itemsArray.getJSONObject(i)
        items.add(OrderItem(
            id = item.optString("id"),
            name = item.optString("name"),
            quantity = item.optInt("quantity"),
            price = item.optDouble("price"),
            customization = item.optString("customization", null)
        ))
    }
    
    return items
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 736-763)

---

## 8. Connection Lifecycle Management

### 8.1 Initial Connection Sequence

**Step-by-Step Flow**:

1. **User Authenticates** (REST API)
   ```kotlin
   val loginResponse = apiClient.post("/api/auth/login", loginData)
   val userId = loginResponse.user.id
   val userEmail = loginResponse.user.email
   val userRole = loginResponse.user.role  // Should be "canteen_owner"
   ```

2. **Fetch CanteenId** (REST API)
   ```kotlin
   val canteenResponse = apiClient.get("/api/system-settings/canteens/by-owner/$userEmail")
   val canteenId = canteenResponse.canteen.id
   ```

3. **Connect to WebSocket** (Socket.IO)
   ```kotlin
   socketManager.connect(userId, userRole)
   ```

4. **Wait for Connection** (Event Handler)
   ```kotlin
   socket?.on(Socket.EVENT_CONNECT) {
       // Connection established
       joinCanteenRoom(canteenId)
   }
   ```

5. **Join Canteen Room** (Socket Event)
   ```kotlin
   fun joinCanteenRoom(canteenId: String) {
       val payload = JSONObject().apply {
           put("canteenIds", JSONArray().apply { put(canteenId) })
           put("userId", userId)
           put("userRole", "canteen_owner")
       }
       socket?.emit("joinCanteenRooms", payload)
   }
   ```

6. **Wait for Room Join Confirmation** (Event Handler)
   ```kotlin
   socket?.on("roomJoined") { args ->
       val data = args.firstOrNull() as? JSONObject
       // Room joined successfully
       
       // Optionally: Join counter rooms
       joinCounterRooms(canteenId)
   }
   ```

7. **Start Listening for Orders** (Event Handler)
   ```kotlin
   socket?.on("orderUpdate") { args ->
       // Handle order notifications
       val message = args.firstOrNull() as? JSONObject
       handleOrderUpdate(message)
   }
   ```

**Source**: Compiled from `android-spec/07-user-flows.md` (lines 1596-1698), `android-spec/11-android-architecture-mapping.md` (lines 908-918)

### 8.2 Reconnection Handling

**Automatic Reconnection**:
- Socket.IO client handles reconnection automatically
- Exponential backoff: 1s → 2s → 4s → 8s
- Max 10 attempts before giving up

**Manual Room Rejoin** (CRITICAL):
- **Rooms are NOT automatically rejoined after reconnection**
- App MUST re-emit `joinCanteenRooms` and `joinCounterRoom` events after reconnect

```kotlin
socket?.on(Socket.EVENT_CONNECT) {
    Log.d(TAG, "Socket reconnected: ${socket?.id()}")
    
    // CRITICAL: Re-join canteen room
    joinCanteenRoom(canteenId)
    
    // CRITICAL: Re-join counter rooms (if previously joined)
    counterIds.forEach { counterId ->
        joinCounterRoom(counterId, canteenId)
    }
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 1003-1051), `client/src/hooks/useWebSocket.ts` (lines 164-170)

### 8.3 Disconnect Handling

**Server-Side Cleanup**:
- Server automatically removes socket from all rooms on disconnect
- No manual cleanup needed from client side

**Client-Side Cleanup** (optional, for clean shutdown):
```kotlin
fun disconnect() {
    // Optionally: Leave rooms explicitly before disconnect
    leaveCanteenRooms(canteenId)
    counterIds.forEach { leaveCounterRoom(it) }
    
    // Disconnect socket
    socket?.disconnect()
    socket?.off()  // Remove all event listeners
    socket = null
}

private fun leaveCanteenRooms(canteenId: String) {
    val payload = JSONObject().apply {
        put("canteenIds", JSONArray().apply { put(canteenId) })
    }
    socket?.emit("leaveCanteenRooms", payload)
}

private fun leaveCounterRoom(counterId: String) {
    val payload = JSONObject().apply {
        put("counterId", counterId)
    }
    socket?.emit("leaveCounterRoom", payload)
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 313-370), `server/websocket.ts` (lines 220-322)

---

## 9. Complete Implementation Example

### 9.1 Kotlin SocketManager (Full Implementation)

```kotlin
package com.example.sillobite.data.remote.socket

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

class SocketManager(
    private val serverUrl: String,
    private val userId: String,
    private val userRole: String
) {
    private var socket: Socket? = null
    private var canteenId: String? = null
    private val counterIds = mutableSetOf<String>()
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState
    
    private val _orderUpdates = MutableStateFlow<OrderUpdate?>(null)
    val orderUpdates: StateFlow<OrderUpdate?> = _orderUpdates
    
    companion object {
        private const val TAG = "SocketManager"
    }
    
    sealed class ConnectionState {
        object Disconnected : ConnectionState()
        object Connecting : ConnectionState()
        object Connected : ConnectionState()
        data class Error(val message: String) : ConnectionState()
    }
    
    data class OrderUpdate(
        val type: String,
        val data: JSONObject?,
        val orderNumber: String?,
        val oldStatus: String?,
        val newStatus: String?
    )
    
    fun connect() {
        if (socket?.connected() == true) {
            Log.d(TAG, "Already connected")
            return
        }
        
        _connectionState.value = ConnectionState.Connecting
        
        val options = IO.Options().apply {
            transports = arrayOf(io.socket.engineio.client.transports.WebSocket.NAME)
            reconnection = true
            reconnectionDelay = 1000L
            reconnectionDelayMax = 8000L
            reconnectionAttempts = 10
            timeout = 15000L
        }
        
        try {
            socket = IO.socket(URI.create(serverUrl), options)
            setupEventHandlers()
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create socket", e)
            _connectionState.value = ConnectionState.Error("Connection failed: ${e.message}")
        }
    }
    
    private fun setupEventHandlers() {
        socket?.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected: ${socket?.id()}")
            _connectionState.value = ConnectionState.Connected
            
            // Auto-rejoin rooms after reconnection
            canteenId?.let { joinCanteenRoom(it) }
            counterIds.forEach { joinCounterRoom(it, canteenId ?: "") }
        }
        
        socket?.on(Socket.EVENT_DISCONNECT) { args ->
            val reason = args.firstOrNull() as? String ?: "unknown"
            Log.d(TAG, "Socket disconnected: $reason")
            _connectionState.value = ConnectionState.Disconnected
        }
        
        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val error = args.firstOrNull()?.toString() ?: "Unknown error"
            Log.e(TAG, "Connection error: $error")
            _connectionState.value = ConnectionState.Error(error)
        }
        
        socket?.on("roomJoined") { args ->
            val data = args.firstOrNull() as? JSONObject
            val joinedCanteenIds = data?.optJSONArray("canteenIds")
            Log.d(TAG, "Joined canteen rooms: $joinedCanteenIds")
        }
        
        socket?.on("counterRoomJoined") { args ->
            val data = args.firstOrNull() as? JSONObject
            val counterId = data?.optString("counterId")
            Log.d(TAG, "Joined counter room: $counterId")
        }
        
        socket?.on("orderUpdate") { args ->
            val message = args.firstOrNull() as? JSONObject
            val type = message?.optString("type") ?: return@on
            val data = message.optJSONObject("data")
            val orderNumber = message.optString("orderNumber")
            val oldStatus = message.optString("oldStatus")
            val newStatus = message.optString("newStatus")
            
            val orderUpdate = OrderUpdate(type, data, orderNumber, oldStatus, newStatus)
            _orderUpdates.value = orderUpdate
            
            Log.d(TAG, "Order update received: type=$type, orderNumber=$orderNumber")
        }
        
        socket?.on("error") { args ->
            val errorData = args.firstOrNull() as? JSONObject
            val message = errorData?.optString("message") ?: "Unknown error"
            Log.e(TAG, "Socket error: $message")
        }
    }
    
    fun joinCanteenRoom(canteenId: String) {
        this.canteenId = canteenId
        
        val payload = JSONObject().apply {
            put("canteenIds", JSONArray().apply { put(canteenId) })
            put("userId", userId)
            put("userRole", userRole)
        }
        
        socket?.emit("joinCanteenRooms", payload)
        Log.d(TAG, "Joining canteen room: $canteenId")
    }
    
    fun joinCounterRoom(counterId: String, canteenId: String) {
        counterIds.add(counterId)
        
        val payload = JSONObject().apply {
            put("counterId", counterId)
            put("canteenId", canteenId)
        }
        
        socket?.emit("joinCounterRoom", payload)
        Log.d(TAG, "Joining counter room: $counterId")
    }
    
    fun leaveCanteenRoom(canteenId: String) {
        val payload = JSONObject().apply {
            put("canteenIds", JSONArray().apply { put(canteenId) })
        }
        
        socket?.emit("leaveCanteenRooms", payload)
        this.canteenId = null
        Log.d(TAG, "Leaving canteen room: $canteenId")
    }
    
    fun leaveCounterRoom(counterId: String) {
        val payload = JSONObject().apply {
            put("counterId", counterId)
        }
        
        socket?.emit("leaveCounterRoom", payload)
        counterIds.remove(counterId)
        Log.d(TAG, "Leaving counter room: $counterId")
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        canteenId = null
        counterIds.clear()
        _connectionState.value = ConnectionState.Disconnected
        Log.d(TAG, "Disconnected and cleaned up")
    }
    
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }
}
```

### 9.2 Usage Example

```kotlin
// In your Application class or Activity
class MainActivity : AppCompatActivity() {
    private lateinit var socketManager: SocketManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 1. Authenticate user (REST API)
        val userEmail = "owner@example.com"
        val canteenId = fetchCanteenId(userEmail)  // REST API call
        
        // 2. Initialize SocketManager
        socketManager = SocketManager(
            serverUrl = "http://your-server.com",
            userId = "123",
            userRole = "canteen_owner"
        )
        
        // 3. Connect to WebSocket
        socketManager.connect()
        
        // 4. Observe connection state
        lifecycleScope.launch {
            socketManager.connectionState.collect { state ->
                when (state) {
                    is SocketManager.ConnectionState.Connected -> {
                        // Connection successful, join rooms
                        socketManager.joinCanteenRoom(canteenId)
                        
                        // Optional: Join counter rooms
                        val counterIds = fetchCounterIds(canteenId)  // REST API call
                        counterIds.forEach { counterId ->
                            socketManager.joinCounterRoom(counterId, canteenId)
                        }
                    }
                    is SocketManager.ConnectionState.Error -> {
                        Log.e(TAG, "Connection error: ${state.message}")
                    }
                    else -> {
                        // Handle other states
                    }
                }
            }
        }
        
        // 5. Observe order updates
        lifecycleScope.launch {
            socketManager.orderUpdates.collect { orderUpdate ->
                orderUpdate?.let {
                    when (it.type) {
                        "new_order" -> {
                            handleNewOrder(it.data, it.orderNumber)
                        }
                        "order_status_changed" -> {
                            handleOrderStatusChange(it.data, it.oldStatus, it.newStatus)
                        }
                        // Handle other types
                    }
                }
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
    }
    
    private fun handleNewOrder(orderData: JSONObject?, orderNumber: String?) {
        // Start foreground service (notification + alarm)
        val intent = Intent(this, OrderForegroundService::class.java).apply {
            action = OrderForegroundService.ACTION_START_FOREGROUND
            putExtra(OrderForegroundService.EXTRA_ORDER_COUNT, 1)
        }
        startService(intent)
        
        // Log for debugging
        Log.d(TAG, "New order received: $orderNumber")
    }
}
```

---

## 10. Troubleshooting

### 10.1 Connection Issues

**Problem**: Socket fails to connect

**Possible Causes**:
1. **Incorrect server URL** - Check if URL includes protocol (`http://` or `https://`)
2. **Network permission missing** - Add `<uses-permission android:name="android.permission.INTERNET" />` to AndroidManifest.xml
3. **CORS policy** - Server must allow origin from app (should be configured in server already)
4. **Server not running** - Verify server is running on specified URL

**Debug Steps**:
```kotlin
socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
    val error = args.firstOrNull()
    Log.e(TAG, "Connection error details: $error")
    // Check error type: timeout, refused, network error, etc.
}
```

**Source**: `android-spec/websocket-extraction.md` (lines 941-1026)

### 10.2 Room Join Issues

**Problem**: `roomJoined` event never received

**Possible Causes**:
1. **Not connected yet** - Wait for `Socket.EVENT_CONNECT` before emitting `joinCanteenRooms`
2. **Invalid canteenId format** - CanteenId must be valid MongoDB ObjectId string
3. **Server error** - Check server logs for error messages

**Debug Steps**:
```kotlin
socket?.on("error") { args ->
    val errorData = args.firstOrNull() as? JSONObject
    Log.e(TAG, "Room join error: ${errorData?.optString("message")}")
}
```

**Source**: `android-spec/05-socket-events.md` (lines 166-174)

### 10.3 Missing Order Notifications

**Problem**: `orderUpdate` events not received

**Possible Causes**:
1. **Not joined canteen room** - Verify `roomJoined` event received before expecting order updates
2. **Wrong canteenId** - CanteenId in room join must match canteenId in order
3. **Connection dropped** - Socket disconnected, need to reconnect and rejoin rooms

**Debug Steps**:
```kotlin
// Check connection state
if (!socketManager.isConnected()) {
    Log.e(TAG, "Socket not connected - reconnecting...")
    socketManager.connect()
}

// Verify room joined
socket?.on("roomJoined") { args ->
    Log.d(TAG, "Room joined successfully: ${args.firstOrNull()}")
}

// Log all incoming orderUpdate events
socket?.on("orderUpdate") { args ->
    Log.d(TAG, "Order update received (raw): ${args.firstOrNull()}")
}
```

**Source**: `android-spec/08-realtime-consistency.md` (lines 70-74), `android-spec/websocket-extraction.md` (lines 1003-1051)

---

## 11. Summary Checklist

### Required Steps for Android Helper App:

- [ ] **1. Authenticate user via REST API** (`POST /api/auth/login`)
- [ ] **2. Retrieve canteenId via REST API** (`GET /api/system-settings/canteens/by-owner/:email`)
- [ ] **3. Initialize Socket.IO client** (library: `io.socket:socket.io-client:2.1.0+`)
- [ ] **4. Configure socket options** (transports, reconnection, timeout)
- [ ] **5. Connect to WebSocket server** (`socket.connect()`)
- [ ] **6. Wait for `Socket.EVENT_CONNECT`** (confirm connection established)
- [ ] **7. Emit `joinCanteenRooms` event** (with canteenId in payload)
- [ ] **8. Wait for `roomJoined` response** (confirm room join successful)
- [ ] **9. Listen to `orderUpdate` events** (receive order notifications)
- [ ] **10. Handle `new_order` type** (trigger foreground service, show notification)
- [ ] **11. Implement reconnection handling** (rejoin rooms after reconnect)
- [ ] **12. [Optional] Retrieve counterIds** (`GET /api/counters?canteenId=...`)
- [ ] **13. [Optional] Emit `joinCounterRoom`** (for counter-specific orders)
- [ ] **14. [Optional] Wait for `counterRoomJoined`** (confirm counter room join)

### Optional Steps (for full functionality):

- [ ] **Fetch counter list** (`GET /api/counters?canteenId=...`)
- [ ] **Join multiple counter rooms** (store, payment, KOT)
- [ ] **Handle other order event types** (order_status_changed, payment_confirmed, etc.)
- [ ] **Implement manual reconnect** (retry button in UI)
- [ ] **Add connection state UI** (show connected/disconnected indicator)
- [ ] **Log all socket events** (for debugging)

---

## 12. References

**Backend Source Files**:
- `server/websocket.ts` - WebSocket server implementation
- `server/routes/systemSettings.ts` - Canteen management API
- `server/routes.ts` - Counter management API
- `server/models/mongodb-models.ts` - Order data model

**Android Documentation**:
- `android-spec/websocket-extraction.md` - Complete WebSocket analysis
- `android-spec/05-socket-events.md` - Socket event specifications
- `android-spec/11-android-architecture-mapping.md` - Android implementation examples
- `android-spec/07-user-flows.md` - User flow diagrams

**Client Implementation**:
- `client/src/hooks/useWebSocket.ts` - React WebSocket hook
- `client/src/components/canteen/CanteenOwnerDashboardSidebar.tsx` - Owner dashboard

**Android Implementation**:
- `android/app/src/main/java/.../SocketManager.kt` - Android socket manager

---

**End of Document**

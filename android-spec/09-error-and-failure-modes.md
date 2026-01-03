# 09 - Error and Failure Modes

**Document Version**: 1.0  
**Last Updated**: 2026-01-02  
**Purpose**: Comprehensive classification of failure scenarios, detection mechanisms, recovery strategies, and Android-specific considerations

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backend Failures](#2-backend-failures)
3. [Client Failures](#3-client-failures)
4. [Realtime Failures](#4-realtime-failures)
5. [Partial Success Scenarios](#5-partial-success-scenarios)
6. [Data Consistency Failures](#6-data-consistency-failures)
7. [Android-Specific Risks](#7-android-specific-risks)
8. [Recovery Strategies Summary](#8-recovery-strategies-summary)

---

## 1. Overview

### Failure Classification Matrix

| Category | Detection | Recovery | Automatic | Manual | Android Risk |
|----------|-----------|----------|-----------|--------|--------------|
| **Backend Timeout** | 15s client timeout | Retry 1x | ✅ | ❌ | HIGH |
| **Backend 5xx** | HTTP status code | Retry 1x | ✅ | ❌ | MEDIUM |
| **Backend 4xx** | HTTP status code | Show error | ❌ | ✅ | LOW |
| **Network Loss** | Fetch AbortError | Polling fallback | ✅ | ✅ | HIGH |
| **WebSocket Disconnect** | ping/pong timeout | Exponential backoff | ✅ | ❌ | HIGH |
| **Missed Events** | No detection | Cache invalidation | ⚠️ | ✅ | HIGH |
| **Stale Cache** | React Query staleTimes | Auto-refetch | ✅ | ✅ | MEDIUM |
| **App Killed** | No detection | Restart + reload | ❌ | ✅ | HIGH |
| **Partial Success** | Varies by scenario | Varies | ⚠️ | ⚠️ | CRITICAL |

### Key Principles

1. **Optimistic Updates**: Update UI immediately, revert on failure
2. **Idempotent Operations**: Safe to retry (payment, order creation use idempotency keys)
3. **Graceful Degradation**: System remains functional with reduced features
4. **User Feedback**: Clear error messages with actionable recovery steps
5. **No Silent Failures**: All errors logged and surfaced to user or admin

---

## 2. Backend Failures

### 2.1 API Request Timeout (15 seconds)

**File**: `client/src/lib/queryClient.ts:34-96`

```typescript
const apiRequest = async (url: string, options?: RequestInit): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch(fullUrl, {
      signal: controller.signal,
      ...options,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as any).name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
};
```

**Detection**: AbortController fires after 15s

**Current Behavior**:
- Client throws error: "Request timeout - please try again"
- React Query automatically retries once (`retry: 1`)
- If retry fails, error displayed to user

**Recovery**:
- ✅ Automatic: 1 retry attempt
- ✅ Manual: User can refresh or retry action

**Android Gaps**:
1. ⚠️ **No network quality detection** - timeout may be too aggressive for 2G/3G
2. ⚠️ **No progressive timeout** - same 15s for all request types (order creation vs menu fetch)
3. ⚠️ **No retry backoff** - retry immediately (could compound server load)

**Android Recommendation**:
```kotlin
// Adaptive timeout based on network type
val timeout = when (connectionType) {
    WIFI -> 15_000L
    MOBILE_4G -> 20_000L
    MOBILE_3G -> 30_000L
    MOBILE_2G -> 45_000L
    else -> 15_000L
}

// Exponential backoff for retries
val retryDelay = baseDelay * (2 ^ attemptNumber)
```

### 2.2 Backend 5xx Errors

**Detection**: HTTP status 500-599

**Current Behavior** (from `routes.ts`):
```typescript
// Generic 500 handler pattern (e.g., routes.ts:2332-2338)
} catch (error) {
  console.error("❌ Error in endpoint:", error);
  res.status(500).json({ 
    success: false,
    message: "Internal server error",
    // ⚠️ No error details exposed to client (security)
  });
}
```

**Recovery**:
- ✅ Automatic: React Query retries once
- ❌ Manual: User sees generic "Internal server error" (no actionable info)

**Specific 5xx Scenarios**:

#### 2.2.1 Database Connection Failure

**Scenario**:
```
Client → POST /api/orders
Server → MongoDB connection timeout
Server → 500 { message: "Internal server error" }
Client → React Query retry (fails again)
Client → Show error to user
```

**Impact**: Order not created, payment NOT initiated (fail-safe)

**Recovery**:
- ⚠️ User must retry manually
- ⚠️ Cart preserved in localStorage (data not lost)

**Android Gap**: No distinction between transient error (retry may succeed) vs permanent error (don't retry)

#### 2.2.2 Payment Queue Timeout (30 seconds)

**File**: `routes.ts:3739-3773`

```typescript
// Payment job timeout
const jobTimeout = 30000; // 30 seconds

try {
  const jobResult = await Promise.race([
    paymentJob.waitUntilFinished(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Job timeout')), jobTimeout)
    )
  ]);
  
  // Job completed successfully
  return res.json({ success: true, ... });
} catch (timeoutError) {
  // Job still processing
  if (timeoutError.message === 'Job timeout') {
    return res.status(202).json({
      success: true,
      message: 'Payment processing started',
      jobId: paymentJob.id,
      status: 'processing'
    });
  }
}
```

**Detection**: Promise.race() timeout after 30s

**Current Behavior**:
- Server returns HTTP 202 (Accepted) with `jobId`
- Client must poll `/api/payments/job-status/:jobId` for completion
- Job continues processing in background

**Recovery**:
- ✅ Automatic: Client polls job status
- ⚠️ If polling fails, payment may complete but client never knows

**Android Gap**: 
- Client may not implement job status polling
- Background job completion notification not sent (no push notification)

### 2.3 Backend 4xx Validation Errors

**Detection**: HTTP status 400-499

**Common 4xx Responses**:

#### 2.3.1 400 Bad Request (Validation Error)

```typescript
// Pattern from systemSettings.ts:4491
if (!organizationId || !hash || !address) {
  return res.status(400).json({ error: 'Organization ID, hash, and address are required' });
}
```

**Recovery**: ❌ No automatic retry (client input error)

#### 2.3.2 401 Unauthorized

```typescript
// Pattern from printAgent.ts:77
if (!isValidApiKey) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

**Recovery**: ❌ Manual (re-authenticate)

**Android Gap**: No automatic token refresh logic (web uses session-based auth)

#### 2.3.3 404 Not Found

```typescript
// Pattern from routes.ts:3555
if (!issue) {
  return res.status(404).json({ message: "Login issue not found" });
}
```

**Recovery**: ❌ User error (resource doesn't exist)

#### 2.3.4 429 Too Many Requests

```typescript
// Pattern: Duplicate order prevention (routes.ts:2359-2364)
return res.status(429).json({
  success: false,
  message: duplicateCheck.message,
  existingSession: duplicateCheck.existingSession,
  errorCode: 'DUPLICATE_ORDER_SESSION'
});
```

**Detection**: HTTP 429 + `errorCode: 'DUPLICATE_ORDER_SESSION'`

**Current Behavior**:
- Client shows error: "Duplicate order detected"
- User must wait 10 minutes or complete existing order

**Recovery**: ❌ No automatic retry (intentional throttling)

**Android Gap**: No local deduplication (relies entirely on server)

**Rate Limiting** (printAgent.ts:87-108):
```typescript
const limit = 100; // 100 requests per minute
if (record.count > limit) {
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

**Recovery**: ⚠️ Exponential backoff NOT implemented (client retries immediately)

---

## 3. Client Failures

### 3.1 Network Loss

**Detection**: Multiple mechanisms

#### 3.1.1 Fetch AbortError

```typescript
// From queryClient.ts:89-95
} catch (error) {
  clearTimeout(timeoutId);
  if ((error as any).name === 'AbortError') {
    throw new Error('Request timeout - please try again');
  }
  throw error;
}
```

#### 3.1.2 Browser Online/Offline Events

```typescript
// From useWebSocket.ts:497-511
window.addEventListener('online', () => {
  console.log('🌐 Network came online, checking WebSocket connection...');
  if (!isConnected && enabled) {
    reconnectAttemptsRef.current = 0;
    reconnect();
  }
});

window.addEventListener('offline', () => {
  console.log('🌐 Network went offline');
  // Connection will be lost naturally, no need to disconnect manually
});
```

**Current Behavior**:
1. **Online Event**: Trigger WebSocket reconnect
2. **Offline Event**: Logged (no action taken)

**Android Gap**: 
- ⚠️ No offline mode (app unusable without network)
- ⚠️ No offline queue for actions (cart operations fail)
- ⚠️ No offline data persistence beyond localStorage

### 3.2 App Killed by OS

**Scenario**: Android kills app to reclaim memory

**Detection**: NONE ⚠️

**Current Behavior**:
1. App state in memory LOST (React state cleared)
2. localStorage persists:
   - Cart data (`digital-canteen-cart-<canteenId>`)
   - User session (`user` or `temp_user_session`)
   - Selected location (`selectedLocation`)
3. WebSocket connection severed
4. React Query cache cleared

**Recovery**:
1. User reopens app
2. React initializes fresh
3. Load cart from localStorage ✅
4. Load user from localStorage ✅
5. Reconnect WebSocket ✅
6. Refetch all data (cold start) ⚠️

**Android Gap**:
- ⚠️ No state restoration for:
  - Checkout session ID (if in checkout flow)
  - Payment in progress (user loses payment screen)
  - Form data (unsaved profile edits)

**Android Recommendation**:
```kotlin
// Save critical state to SharedPreferences on pause
override fun onPause() {
    super.onPause()
    // Save checkout session
    if (checkoutSessionId != null) {
        prefs.edit()
            .putString("checkout_session_id", checkoutSessionId)
            .putLong("checkout_session_expiry", expiryTime)
            .apply()
    }
}

// Restore on resume
override fun onResume() {
    super.onResume()
    val sessionId = prefs.getString("checkout_session_id", null)
    if (sessionId != null) {
        // Check if still valid
        val expiry = prefs.getLong("checkout_session_expiry", 0)
        if (System.currentTimeMillis() < expiry) {
            // Resume checkout
        }
    }
}
```

### 3.3 Stale Cache

**Detection**: React Query `staleTime` expiry

**Default Configuration** (queryClient.ts:5-31):
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,     // Disabled (WebSocket handles updates)
      refetchOnMount: false,           // Disabled
      refetchInterval: false,          // Disabled
    },
  },
});
```

**Per-Query Overrides**:

| Query | staleTime | gcTime | Refetch | Reason |
|-------|-----------|--------|---------|--------|
| `/api/media-banners` | 15 min | 30 min | No | Static content, WebSocket updates |
| `/api/home` | 30s | 5 min | No | Dynamic content, frequent changes |
| `/api/orders/:id` | 0 | 5 min | Polling (4s if WS down) | Real-time tracking |
| `/api/menu` | 5 min | 10 min | No | Semi-static, WebSocket updates |

**Stale Cache Scenarios**:

#### 3.3.1 Menu Prices Changed (User Sees Old Prices)

```
Time  | Server Action           | Client State
------+------------------------+--------------------------------
T0    | Owner updates prices    | Cache fresh (staleTime: 5min)
T1    | WebSocket broadcast     | Cache invalidated ✅
T2    | User on menu page       | Refetch triggered ✅
T3    | User in checkout        | Using cached prices ⚠️
T4    | (5 minutes pass)        | Cache marked stale
T5    | User submits order      | Server validates with latest prices ✅
```

**Protection**: Server-side price validation (source of truth)

#### 3.3.2 Stock Depleted (User Sees "Available" but Out of Stock)

**Detection**: Real-time via WebSocket + polling fallback

```typescript
// From useStockValidation.ts:70-83
const { data: stockData, isLoading, error, refetch } = useQuery({
  queryKey: ['/api/stock/status', itemIds.join(',')],
  queryFn: async () => {
    try {
      const response = await apiRequest(`/api/stock/status?...`);
      return response;
    } catch (error) {
      console.error('Stock validation API error:', error);
      // Return empty array on error to allow graceful degradation
      return [];
    }
  },
  // ... staleTime, etc.
});
```

**Recovery**: Checkout flow validates stock before payment

**Android Gap**: No optimistic stock deduction (user may checkout item that just sold out)

### 3.4 Service Worker Cache Mismatch

**Scenario**: New deployment, user has old service worker

**Detection**: Service worker update check

```typescript
// From updateManager.ts:102-135
applyUpdate(): void {
  console.log('🔄 Applying update...');
  
  // Tell the new service worker to skip waiting
  this.newWorker.postMessage({ type: 'SKIP_WAITING' });
}

private handleSuccessfulUpdate(): void {
  // Clear old caches
  this.clearOldCaches();
  
  // Reload with cache buster
  setTimeout(() => {
    const cacheBuster = `?v=${Date.now()}`;
    const currentUrl = window.location.href.split('?')[0];
    window.location.href = currentUrl + cacheBuster;
  }, 1000);
}
```

**Recovery**: ✅ Automatic reload with cache bypass

**Android Gap**: 
- Android uses native code (no service worker)
- App update via Play Store
- ⚠️ Must handle API version mismatch explicitly

---

## 4. Realtime Failures

### 4.1 Missed WebSocket Events

**Root Causes**:
1. Client disconnected during event broadcast
2. Client not in correct room (forgot to rejoin)
3. Event delivered but client ignored (bug)

**Detection**: NONE ⚠️

**Example Failure**:
```
Time  | Event                          | Client State
------+--------------------------------+---------------------------
T0    | Client connected to canteen_1  | Receiving events ✅
T1    | Network drops                  | Disconnected (not detected yet)
T5    | Server: Order #1234 ready      | Event broadcast → no client ❌
T10   | Client detects disconnect      | Trigger reconnect
T15   | Client reconnects              | Re-join canteen_1
T16   | Server: Order #1235 created    | Event received ✅
      |                                | Order #1234 "ready" MISSED ❌
```

**Recovery Mechanisms**:

#### 4.1.1 React Query Cache Invalidation on Reconnect

```typescript
// Pattern: Invalidate on reconnect (from useWebSocket.ts:173-185)
socket.on('connect', () => {
  // Re-join rooms
  if (canteenIds.length > 0) {
    socket.emit('joinCanteenRooms', canteenIds);
  }
  
  // ⚠️ NO automatic cache invalidation
  // Components must implement this
});
```

**Android Gap**: No standardized "refetch on reconnect" pattern

#### 4.1.2 Fallback Polling

```typescript
// Pattern: Poll when WebSocket down (from OrderStatusPage.tsx)
const pollingStatus = useOrderStatusPolling({
  orderId,
  enabled: !!orderId,
  isWebSocketConnected,
  pollingInterval: 4000  // Poll every 4s when disconnected
});
```

**Coverage**: ⚠️ Only implemented for order tracking, not dashboard/menu

### 4.2 Delayed Event Delivery

**Scenario**: Event takes >10s to arrive (network congestion)

**Detection**: NONE

**Impact**:
- User sees outdated order status
- User may place duplicate order
- Counter staff may miss urgent updates

**Current Mitigation**: Fallback polling (4s interval) fills gap

**Android Gap**: No event timestamp comparison (can't detect "this event is old")

### 4.3 Event Ordering Violations

**From [08-realtime-consistency.md](file:///d:/steepanProjects/sillobite-pos/sillobite/android-spec/08-realtime-consistency.md#4-event-ordering-guarantees)**:

- ✅ Within-room ordering guaranteed
- ⚠️ Cross-room ordering NOT guaranteed

**Failure Scenario**:
```
Time  | Server Broadcasts              | Client A Receives (counter staff)
------+--------------------------------+----------------------------------
T0    | io.to('canteen_1').emit('A')   |
T1    | io.to('counter_1').emit('B')   |
T2    |                                | Event B (counter room) ✅
T3    |                                | Event A (canteen room) ⚠️ OUT OF ORDER
```

**Impact**: Counter staff sees event B before event A (wrong order)

**Mitigation**: App logic tolerant of out-of-order events (idempotent updates)

**Android Gap**: No sequence numbers (can't detect out-of-order delivery)

### 4.4 Duplicate Events

**Sources** (from 08-realtime-consistency.md):
1. Multi-room broadcasts (client in both rooms)
2. Sequential broadcasts for same action (payment confirmed → 3 events)
3. Reconnection mid-event

**Detection**: ✅ Idempotent cache invalidation

```typescript
// From useMultiCanteenWebSocket.ts:20-29
const handleNewOrder = useCallback((order: any) => {
  // Invalidate queries (idempotent operation)
  queryClient.invalidateQueries({ queryKey: ['/api/orders', order.canteenId] });
  queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated'] });
  
  // Multiple invalidations → Single API call (React Query dedupes)
}, [queryClient]);
```

**Recovery**: ✅ Automatic (idempotent operations)

**Android Gap**: Must implement deduplication at network layer (OkHttp interceptor)

---

## 5. Partial Success Scenarios

### 5.1 Order Created, WebSocket Broadcast Failed

**Scenario**:
```
Client → POST /api/orders
Server → Save order to MongoDB ✅
Server → wsManager.broadcastNewOrder(canteenId, order)
Server → WebSocket broadcast fails (no clients connected) ⚠️
Client ← 200 OK { order } ✅
```

**Result**:
- ✅ Client knows order created (has order ID)
- ❌ Counter staff does NOT see new order (WebSocket failed)
- ❌ Owner dashboard does NOT update

**Detection**: Server logs "📡 No clients in room" (not surfaced to client)

**Recovery**:
- ⚠️ Automatic: Counter staff polling (if implemented)
- ✅ Manual: Counter staff clicks refresh

**Android Gap**: No error feedback to user ("Order placed successfully" but staff never sees it)

### 5.2 Payment Success, Order Creation Failed

**Scenario** (Razorpay webhook):
```
Time  | Event                              | State
------+------------------------------------+------------------
T0    | User completes payment in Razorpay | Payment: PENDING
T1    | Razorpay webhook → Server          |
T2    | Server validates signature ✅      | Payment: PENDING
T3    | Server creates order... FAILS ❌   | Payment: PAID
      | (MongoDB connection timeout)       | Order: NOT CREATED ⚠️
T4    | Server returns 500 to Razorpay     |
T5    | Razorpay retries webhook (1 hour later) | Payment: PAID
T6    | Server creates order ✅            | Order: CREATED ✅
```

**Protection**: Payment webhook is idempotent (checks `merchantTransactionId`)

**Recovery**: ✅ Automatic (Razorpay retries up to 24 hours)

**Android Gap**: User sees "Payment processing..." indefinitely (no progress update)

### 5.3 Checkout Session Expired, Payment Success

**From [08-realtime-consistency.md](file:///d:/steepanProjects/sillobite-pos/sillobite/android-spec/08-realtime-consistency.md#102-checkout-session-timeout-during-payment)**:

```
Time  | User Action                 | Server State               | Client State
------+----------------------------+---------------------------+------------------
T0    | Create checkout session     | session.expiresAt = T0+5m | sessionTimeLeft = 300s
T290s | Initiate payment            | session.status = 'active' | sessionTimeLeft = 10s
T300s |                             | Session expires ⚠️         | sessionTimeLeft = 0s
      |                             | Stock restored            | showTimeoutDialog
T310s | Complete payment in Razorpay |                          |
T311s | Razorpay webhook            | Session expired ❌        |
T312s | Server checks session       | Payment verified ✅       |
T313s | Re-reserve stock ✅         | Order created ✅          |
```

**Protection**: Webhook re-reserves stock if session expired

**Recovery**: ✅ Automatic (order created despite session expiry)

**Android Gap**: User sees timeout error but order may still succeed (confusing UX)

### 5.4 Stock Reserved, Payment Failed, Stock Not Restored

**Scenario**:
```
T0: User creates checkout session → Reserve stock (item.stock -= quantity)
T1: User initiates payment → Razorpay modal opens
T2: User closes modal (payment cancelled)
T3: Client abandons checkout session (unmount)
T4: Stock remains reserved ⚠️ (should be restored)
T5: Cleanup job runs (every 60s) → Restore stock ✅
```

**Detection**: Checkout session cleanup job (server/checkout-session-service.ts:150-175)

```typescript
static async cleanupExpiredSessions(): Promise<number> {
  const expiredSessions = await CheckoutSession.find({
    status: { $in: ['active', 'payment_initiated'] },
    expiresAt: { $lt: new Date() }
  });
  
  // Restore stock for each expired session
  for (const session of expiredSessions) {
    await this.restoreStockForSession(session.sessionId);
  }
  
  // Mark as expired
  await CheckoutSession.updateMany({...}, { status: 'expired' });
}
```

**Recovery**: ✅ Automatic (up to 6 minutes: 5min session + 1min job interval)

**Android Gap**: 
- Stock unavailable for up to 6 minutes
- No immediate notification to user ("Sorry, item sold out" may be temporary)

---

## 6. Data Consistency Failures

### 6.1 Cart Sync Race Condition (Multi-Tab)

**From [08-realtime-consistency.md](file:///d:/steepanProjects/sillobite-pos/sillobite/android-spec/08-realtime-consistency.md#61-same-user-multiple-devices)**:

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

**Detection**: NONE

**Recovery**: ⚠️ User must re-add lost item

**Android Gap**: localStorage doesn't sync across devices (cart is device-local)

### 6.2 Order Status Update Lost (MongoDB Write Failure)

**Scenario**:
```
Counter Staff → POST /api/orders/:id/mark-ready
Server → Update MongoDB... FAILS (connection timeout) ❌
Server → 500 Internal Server Error
Counter Staff ← Error toast: "Failed to update order"
```

**Detection**: HTTP 500 response

**Recovery**:
- ❌ No automatic retry
- ✅ Manual: Staff clicks "Mark Ready" again
- ⚠️ Idempotency: Server checks current status before update

**Android Gap**: No offline queue (action lost if network unavailable)

### 6.3 User Session Validation Failure

**From useAuth.ts:157-174**:

```typescript
// Database validation
const response = await apiRequest('/api/auth/validate-session', {
  method: 'POST',
  body: JSON.stringify({ user: authState.user })
});

if (response.status === 401 || response.status === 403) {
  // Session invalid, clear
  clearPWAAuth();
  return null;
} else {
  // For other errors (500, network), keep session
  console.warn(`⚠️ User validation failed, keeping PWA session`);
  return authState.user;
}
```

**Behavior**:
- 401/403: Clear session (logout)
- 500/Network Error: Keep session (graceful degradation)

**Android Gap**: Session may persist even if server-side session expired (eventual inconsistency)

---

## 7. Android-Specific Risks

### 7.1 Background Restrictions

**Risk**: Android 12+ aggressive battery optimization

**Impact**:
- WebSocket connection severed when app backgrounded
- No push notifications for order updates (Web Push not available)
- Checkout session may expire while app in background

**Mitigation**:
```kotlin
// Request exemption from battery optimization
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    val intent = Intent()
    intent.action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
    intent.data = Uri.parse("package:$packageName")
    startActivity(intent)
}

// Use foreground service for critical operations
class CheckoutService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Checkout in progress...")
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }
}
```

### 7.2 Network Type Detection

**Risk**: User on 2G/3G, 15s timeout too aggressive

**Current**: Single timeout (15s) for all network types

**Android Recommendation**:
```kotlin
val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
val network = connectivityManager.activeNetwork
val capabilities = connectivityManager.getNetworkCapabilities(network)

val timeout = when {
    capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> 15_000L
    capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> {
        val telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        when (telephonyManager.networkType) {
            TelephonyManager.NETWORK_TYPE_LTE -> 20_000L  // 4G
            TelephonyManager.NETWORK_TYPE_UMTS -> 30_000L // 3G
            TelephonyManager.NETWORK_TYPE_EDGE -> 45_000L // 2G
            else -> 15_000L
        }
    }
    else -> 15_000L
}

OkHttpClient.Builder()
    .connectTimeout(timeout, TimeUnit.MILLISECONDS)
    .readTimeout(timeout, TimeUnit.MILLISECONDS)
    .writeTimeout(timeout, TimeUnit.MILLISECONDS)
    .build()
```

### 7.3 Data Saver Mode

**Risk**: Android Data Saver blocks background data

**Impact**:
- WebSocket connections fail in background
- Image preloading fails (CacheUtils.preloadImages)
- Push notifications not received

**Detection**:
```kotlin
val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
val restrictBackgroundStatus = connectivityManager.restrictBackgroundStatus

when (restrictBackgroundStatus) {
    ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED -> {
        // Data Saver ON - show warning
        showDataSaverWarning()
    }
    ConnectivityManager.RESTRICT_BACKGROUND_STATUS_WHITELISTED -> {
        // App whitelisted - proceed normally
    }
    ConnectivityManager.RESTRICT_BACKGROUND_STATUS_DISABLED -> {
        // Data Saver OFF - proceed normally
    }
}
```

### 7.4 Storage Limitations

**Risk**: localStorage equivalent has size limits

**Current Web Storage**:
- Cart: ~50KB per canteen (100 items)
- User session: ~5KB
- Banner cache: ~500KB (images cached separately)
- Total: ~1MB

**Android Recommendation**:
```kotlin
// Use Room Database instead of SharedPreferences for large data
@Database(entities = [CartItem::class, CachedBanner::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cartDao(): CartDao
    abstract fun bannerDao(): BannerDao
}

// Periodic cleanup
class CacheCleanupWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val database = AppDatabase.getInstance(applicationContext)
        // Delete cache older than 7 days
        database.bannerDao().deleteOlderThan(System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000)
        return Result.success()
    }
}
```

### 7.5 WebView Limitations

**If using WebView for web app**:

**Risk 1**: WebSocket connections less stable
```kotlin
// Enable all WebView features
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    databaseEnabled = true
    setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW)
}

// Monitor WebView lifecycle
webView.webViewClient = object : WebViewClient() {
    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        // Inject network status monitoring
        view?.evaluateJavascript("""
            window.addEventListener('online', () => {
                Android.onNetworkStatusChanged(true);
            });
            window.addEventListener('offline', () => {
                Android.onNetworkStatusChanged(false);
            });
        """, null)
    }
}
```

**Risk 2**: Service workers may not work
- PWA features limited in WebView
- Use TWA (Trusted Web Activity) for full PWA support

### 7.6 Payment Gateway Integration

**Risk**: Razorpay SDK may behave differently on Android

**Current Web Flow**:
```typescript
// Web: Razorpay Checkout modal
const razorpay = new Razorpay({
  key: RAZORPAY_KEY_ID,
  order_id: razorpayOrderId,
  handler: (response) => {
    // Payment success callback
  }
});
razorpay.open();
```

**Android Gap**:
- Razorpay modal may open in external browser (loses app context)
- Deep link return may fail (user stuck in browser)

**Android Recommendation**:
```kotlin
// Use Razorpay Android SDK (not WebView)
val razorpay = Razorpay(this, RAZORPAY_KEY_ID)

razorpay.open(activity, options)

// Implement callback
override fun onPaymentSuccess(razorpayPaymentId: String?) {
    // Verify payment with server
    verifyPayment(razorpayPaymentId, razorpayOrderId, razorpaySignature)
}

override fun onPaymentError(code: Int, response: String?) {
    // Handle payment failure
    when (code) {
        Razorpay.PAYMENT_CANCELED -> showError("Payment cancelled")
        Razorpay.NETWORK_ERROR -> showError("Network error. Please try again.")
        else -> showError("Payment failed: $response")
    }
}
```

### 7.7 Push Notifications (Web Push Not Available)

**Risk**: Web Push API not available on Android native

**Current Web**:
```typescript
// Web: Service Worker Push Notifications
navigator.serviceWorker.ready.then((registration) => {
  registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey
  });
});
```

**Android Alternative**:
```kotlin
// Use Firebase Cloud Messaging (FCM)
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Handle notification
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(remoteMessage.notification?.title)
            .setContentText(remoteMessage.notification?.body)
            .setSmallIcon(R.drawable.ic_notification)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    override fun onNewToken(token: String) {
        // Send token to server
        registerFCMToken(token)
    }
}
```

**Server Changes Required**:
- Add FCM endpoint: `POST /api/push/register-fcm-token`
- Send notifications via FCM API (not Web Push)

---

## 8. Recovery Strategies Summary

### 8.1 Automatic Recovery

| Failure | Detection Time | Recovery Time | Success Rate | Android Support |
|---------|---------------|---------------|--------------|-----------------|
| **Network Timeout** | 15s | Immediate (retry) | ~70% | ✅ |
| **WebSocket Disconnect** | 30s (ping timeout) | 1-8s (exponential backoff) | ~95% | ✅ |
| **Missed Event** | None | Next API call | ~80% | ⚠️ (implement polling) |
| **Stale Cache** | staleTimes (varies) | Immediate (refetch) | 100% | ✅ |
| **Checkout Session Expiry** | Client timer | 0-60s (cleanup job) | 100% | ⚠️ (may lose session on background) |
| **Payment Webhook Retry** | 1 hour | Up to 24 hours | ~99% | ✅ |

### 8.2 Manual Recovery

| Failure | User Action | Complexity | Android Support |
|---------|-------------|------------|-----------------|
| **Backend 4xx** | Fix input, retry | LOW | ✅ |
| **Backend 5xx** | Retry request | LOW | ✅ |
| **App Killed** | Reopen app | LOW | ⚠️ (may lose state) |
| **Cart Race Condition** | Re-add lost items | MEDIUM | ✅ |
| **Order Not Showing** | Refresh dashboard | LOW | ✅ |

### 8.3 No Recovery (Data Loss)

| Failure | Impact | Mitigation | Android Gap |
|---------|--------|------------|-------------|
| **Missed WebSocket Event** | Staff may not see order | Fallback polling (NOT implemented for all screens) | HIGH - Implement comprehensive polling |
| **Form Data in Memory** | Lost on app kill | localStorage save on change | HIGH - Save to SharedPreferences |
| **Checkout Session on Background** | Session expires, stock restored | Foreground service | CRITICAL - Prevent background kill |
| **Payment in Progress** | User loses payment screen | Resume via order ID | CRITICAL - Deep link to order status |

### 8.4 Android Implementation Checklist

- [ ] Adaptive timeouts based on network type
- [ ] Foreground service for checkout flow
- [ ] Persistent state in Room Database (not just SharedPreferences)
- [ ] FCM integration for push notifications (not Web Push)
- [ ] Deep linking for payment return flow
- [ ] Comprehensive polling fallback for all real-time screens
- [ ] Offline mode with operation queue (create order, add to cart)
- [ ] Data Saver detection and warning
- [ ] Battery optimization exemption request
- [ ] Network quality indicator in UI
- [ ] Retry mechanism with exponential backoff
- [ ] Duplicate request deduplication (OkHttp interceptor)
- [ ] Session persistence across app restarts
- [ ] Crash analytics integration (Firebase Crashlytics)
- [ ] WebView feature detection (if using hybrid approach)

---

**End of Error and Failure Modes Specification**

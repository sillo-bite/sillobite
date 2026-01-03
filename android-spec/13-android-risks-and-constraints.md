# 13 - ANDROID RISKS AND CONSTRAINTS

## DOCUMENT METADATA
- **Extraction Date**: 2026-01-02
- **Source**: Android platform documentation, android-spec/09-error-and-failure-modes.md, android-spec/11-android-architecture-mapping.md
- **Protocol**: Identify platform-specific risks with impact analysis and mitigation strategies
- **Purpose**: Prevent production failures from Android platform constraints

---

## RISK CLASSIFICATION

### Severity Levels

**CRITICAL**: App unusable, data loss, payment failures  
**HIGH**: Core features broken, poor UX  
**MEDIUM**: Degraded experience, workarounds available  
**LOW**: Minor inconvenience, rare occurrence  

### Timeline Classification

**MVP**: Must be addressed before launch  
**POST-MVP**: Can be deferred to post-launch  
**OPTIONAL**: Nice-to-have, low priority  

---

## RISK CATEGORY 1: BATTERY OPTIMIZATION

### Risk 1.1: Doze Mode WebSocket Disconnection

**Description**: Android Doze mode (introduced in Android 6.0) aggressively restricts network access when device is stationary and screen off for extended periods (>30 minutes). WebSocket connections are severed, preventing real-time order status updates.

**Impact**: 
- **Severity**: HIGH
- **Affected Features**:
  - Real-time order status updates (customer app)
  - Delivery assignments (delivery app - CRITICAL)
  - Menu stock updates
- **User Experience**: User checks phone after 1 hour, order marked "ready" 30 minutes ago but notification not received
- **Business Impact**: Customer misses pickup window, food goes cold, refund requests

**Detection**:
```kotlin
// Doze mode detection
val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
val isDozing = !powerManager.isInteractive && !powerManager.isIgnoringBatteryOptimizations(packageName)
```

**Mitigation Strategy**:

**Option 1: High-Priority FCM Notifications (RECOMMENDED for MVP)**
```kotlin
// Backend sends FCM with priority=high when order status changes
{
  "message": {
    "token": fcmToken,
    "notification": {
      "title": "Order Ready",
      "body": "Your order #1234 is ready for pickup"
    },
    "android": {
      "priority": "high" // Wakes device from Doze
    },
    "data": {
      "orderId": "1234",
      "status": "ready"
    }
  }
}
```

**Why This Works**: High-priority FCM messages can wake device from Doze mode for up to 10 seconds, allowing order updates.

**Option 2: Foreground Service (Delivery App Only)**
```kotlin
class DeliveryService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Waiting for deliveries...")
        startForeground(NOTIFICATION_ID, notification)
        
        // WebSocket connection maintained even in Doze
        socketManager.connect()
        
        return START_STICKY
    }
}
```

**Why This Works**: Foreground services are exempt from Doze restrictions.

**Option 3: WorkManager Periodic Sync (Fallback)**
```kotlin
val syncRequest = PeriodicWorkRequestBuilder<OrderSyncWorker>(15, TimeUnit.MINUTES)
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build())
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "order_status_sync",
    ExistingPeriodicWorkPolicy.KEEP,
    syncRequest
)
```

**Limitations**: WorkManager periodic tasks run at most once per 15 minutes (Android 12+), not suitable for real-time updates.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Customer App: Option 1 (FCM high-priority) + Option 3 (WorkManager fallback)
- Delivery App: Option 2 (Foreground Service) - REQUIRED

**Testing**:
```bash
# Enable Doze mode immediately (ADB)
adb shell dumpsys deviceidle force-idle

# Trigger order status change on backend
# Verify FCM notification received

# Exit Doze mode
adb shell dumpsys deviceidle unforce
```

---

### Risk 1.2: App Standby Network Restrictions

**Description**: App Standby restricts background network access for apps not recently used. After 24 hours of inactivity, app enters "Rare" bucket with severely limited network access.

**Impact**:
- **Severity**: MEDIUM
- **Affected Features**:
  - Background order sync (WorkManager)
  - FCM token refresh
  - Cache refresh
- **User Experience**: User opens app after 2 days, sees stale menu data, order sync delayed
- **Business Impact**: User orders unavailable items (stock depleted), order fails

**Standby Buckets**:
```
Active: Currently using app - No restrictions
Working Set: Used in last ~24h - Light restrictions
Frequent: Used in last ~2 days - Moderate restrictions
Rare: Not used in 2+ days - HEAVY restrictions (WorkManager runs max once per 24h)
```

**Mitigation Strategy**:

**Option 1: Cache with Expiry Indicators (RECOMMENDED)**
```kotlin
@Entity(tableName = "menu_items")
data class CachedMenuItem(
    @PrimaryKey val id: String,
    val name: String,
    val price: Double,
    val stock: Int?,
    val available: Boolean,
    val cachedAt: Long // Timestamp
)

// UI layer
val cacheAge = System.currentTimeMillis() - menuItem.cachedAt
if (cacheAge > 24 * 60 * 60 * 1000) {
    showCacheWarning("Menu data is ${cacheAge / (60 * 60 * 1000)}h old. Refresh to see latest.")
}
```

**Option 2: Aggressive Refresh on App Launch**
```kotlin
class SplashViewModel @Inject constructor(
    private val menuRepository: MenuRepository,
    private val orderRepository: OrderRepository
) : ViewModel() {
    
    init {
        viewModelScope.launch {
            // Refresh critical data on app launch
            menuRepository.refreshMenu(canteenId)
            orderRepository.refreshActiveOrders(userId)
        }
    }
}
```

**Option 3: Request Battery Optimization Exemption (Last Resort)**
```kotlin
// Only for delivery app, NOT customer app
val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
    data = Uri.parse("package:$packageName")
}
startActivity(intent)
```

**WARNING**: Google Play rejects apps requesting battery optimization exemption without valid use case. Only acceptable for delivery/ride-sharing apps.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Cache expiry warnings
- Option 2: Aggressive refresh on launch
- Option 3: Delivery app only (foreground service is better solution)

---

### Risk 1.3: Background Service Limitations (Android 8.0+)

**Description**: Android 8.0+ prohibits background services from running indefinitely. Background services are killed after ~1 minute if app not in foreground.

**Impact**:
- **Severity**: HIGH (Delivery App), MEDIUM (Customer App)
- **Affected Features**:
  - WebSocket connection maintenance
  - Real-time order updates when app backgrounded
- **User Experience**: User switches to another app, WebSocket disconnects, misses order update
- **Business Impact**: Delivery person misses assignment, order delayed

**Mitigation Strategy**:

**Option 1: Foreground Service with Persistent Notification (Delivery App)**
```kotlin
class WebSocketService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // MUST show persistent notification
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sillobite Delivery")
            .setContentText("Listening for delivery assignments")
            .setSmallIcon(R.drawable.ic_delivery)
            .setOngoing(true) // Cannot be swiped away
            .setPriority(NotificationCompat.PRIORITY_LOW) // Silent notification
            .build()
        
        startForeground(NOTIFICATION_ID, notification)
        
        socketManager.connect()
        
        return START_STICKY
    }
}
```

**Trade-off**: Persistent notification annoys users, but required for foreground service.

**Option 2: No Background WebSocket (Customer App)**
```kotlin
// Accept that WebSocket disconnects when app backgrounded
// Rely on FCM for push notifications
// Reconnect WebSocket on app resume

override fun onResume() {
    super.onResume()
    socketManager.connect(canteenId)
}

override fun onPause() {
    super.onPause()
    if (!isDeliveryApp) {
        socketManager.disconnect() // Graceful disconnect
    }
}
```

**Why This Works**: Customer app doesn't need real-time updates when backgrounded. FCM notifications sufficient.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Customer App: Option 2 (disconnect when backgrounded, FCM for notifications)
- Delivery App: Option 1 (foreground service REQUIRED)

---

## RISK CATEGORY 2: OEM BACKGROUND KILL BEHAVIORS

### Risk 2.1: Aggressive OEM Task Killers (Xiaomi, Oppo, Vivo, OnePlus)

**Description**: Chinese OEM manufacturers (Xiaomi MIUI, Oppo ColorOS, Vivo FuntouchOS, OnePlus OxygenOS) aggressively kill background apps to "optimize" battery. Apps killed even when whitelisted in battery optimization.

**Impact**:
- **Severity**: CRITICAL (Delivery App), HIGH (Customer App)
- **Affected Features**:
  - Foreground service killed (despite START_STICKY)
  - WorkManager jobs canceled
  - FCM notifications delayed/dropped
  - Offline order queue not synced
- **User Experience**: Delivery person misses assignments despite app "running". Customer's offline order never syncs.
- **Business Impact**: Lost revenue, poor delivery experience, refunds

**OEM-Specific Behaviors**:

| OEM | Behavior | Market Share | Mitigation Difficulty |
|-----|----------|--------------|----------------------|
| **Xiaomi MIUI** | Kills apps after 5-10 min if screen locked, ignores battery whitelist | 15% global | HIGH - Requires manual user settings |
| **Oppo ColorOS** | "Battery Optimization" kills apps despite exemption | 8% global | HIGH - Requires manual user settings |
| **Vivo FuntouchOS** | "Background app freeze" kills even foreground services | 6% global | VERY HIGH - Settings deeply nested |
| **OnePlus OxygenOS** | "Adaptive Battery" kills apps based on ML prediction | 2% global | MEDIUM - Settings accessible |
| **Samsung OneUI** | Relatively respectful of Android standards | 20% global | LOW - Standard Android behavior |
| **Google Pixel** | Standard Android behavior | 5% global | NONE - Works as designed |

**Detection**:
```kotlin
// Detect OEM
val manufacturer = Build.MANUFACTURER.lowercase()
val isAggressiveOEM = when {
    manufacturer.contains("xiaomi") -> true
    manufacturer.contains("oppo") -> true
    manufacturer.contains("vivo") -> true
    manufacturer.contains("oneplus") -> true
    manufacturer.contains("huawei") -> true
    else -> false
}
```

**Mitigation Strategy**:

**Option 1: In-App User Education (RECOMMENDED)**
```kotlin
if (isAggressiveOEM && !isPowerSaveWhitelisted()) {
    showDialog {
        title = "Background Restrictions Detected"
        message = """
            Your device (${Build.MANUFACTURER}) may kill this app in the background.
            
            To receive order updates reliably:
            1. Go to Settings > Battery > App Battery Saver
            2. Find "Sillobite"
            3. Select "No restrictions"
        """.trimIndent()
        positiveButton("Open Settings") {
            openBatterySettings()
        }
        negativeButton("Later")
    }
}

fun openBatterySettings() {
    try {
        val intent = when {
            Build.MANUFACTURER.contains("xiaomi") -> 
                Intent("miui.intent.action.POWER_HIDE_MODE_APP_LIST")
            Build.MANUFACTURER.contains("oppo") -> 
                Intent().setClassName("com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity")
            else -> 
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        }
        startActivity(intent)
    } catch (e: Exception) {
        // Fallback to generic settings
        startActivity(Intent(Settings.ACTION_SETTINGS))
    }
}
```

**Option 2: Auto-Restart on Kill (Partial Mitigation)**
```kotlin
class RestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            // Restart foreground service on device boot
            if (isDeliveryApp()) {
                val serviceIntent = Intent(context, WebSocketService::class.java)
                ContextCompat.startForegroundService(context, serviceIntent)
            }
        }
    }
}

// Manifest
<receiver android:name=".RestartReceiver">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.QUICKBOOT_POWERON" />
    </intent-filter>
</receiver>
```

**Option 3: WorkManager with Expedited Jobs (Android 12+)**
```kotlin
// For critical tasks like order sync
val syncRequest = OneTimeWorkRequestBuilder<OrderSyncWorker>()
    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build())
    .build()
```

**Expedited Jobs**: Android 12+ allows "expedited" jobs that are less likely to be killed, but quota is limited (10-15 minutes per day).

**Option 4: Keep App in Recent Apps (User Behavior)**
```kotlin
// Educate users NOT to swipe app away from recent apps
if (isAggressiveOEM) {
    showOnboarding {
        """
        💡 Tip: Don't swipe this app away from recent apps.
        
        Swiping away tells Android to stop the app completely,
        and you won't receive order updates.
        
        Use the home button instead.
        """.trimIndent()
    }
}
```

**Reality**: Many users habitually swipe away all apps. This mitigation has low success rate.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: In-app education (show once on first launch for delivery app, optional for customer app)
- Option 2: Auto-restart receiver
- Option 3: Expedited WorkManager for order sync
- Option 4: Onboarding tip (delivery app only)

**Testing**:
```bash
# Test on physical Xiaomi/Oppo/Vivo device
# 1. Lock screen for 10 minutes
# 2. Trigger order update on backend
# 3. Verify notification received (often fails without user whitelist)
```

---

### Risk 2.2: Manufacturer-Specific Notification Throttling

**Description**: Some OEMs throttle notification delivery to "reduce spam". Notifications delayed by 5-15 minutes or batched.

**Impact**:
- **Severity**: HIGH
- **Affected Features**:
  - Order ready notifications
  - Delivery assignment notifications
- **User Experience**: User receives "Order ready" notification 10 minutes after order actually ready
- **Business Impact**: Cold food, missed pickups, refunds

**Mitigation Strategy**:

**Option 1: High-Priority Notification Channel**
```kotlin
val channel = NotificationChannel(
    CHANNEL_ORDER_UPDATES,
    "Order Updates",
    NotificationManager.IMPORTANCE_HIGH // Bypasses some throttling
).apply {
    description = "Real-time order status notifications"
    setBypassDnd(true) // Bypass Do Not Disturb (requires permission)
    enableVibration(true)
    enableLights(true)
}
notificationManager.createNotificationChannel(channel)
```

**Option 2: Critical FCM Priority**
```json
{
  "message": {
    "android": {
      "priority": "high",
      "notification": {
        "channel_id": "ORDER_UPDATES",
        "notification_priority": "PRIORITY_MAX"
      }
    }
  }
}
```

**Option 3: In-App Alert (Fallback)**
```kotlin
// Show in-app alert if app is open when order ready
socketManager.orderUpdates
    .filter { it is OrderUpdateEvent.StatusChanged && it.newStatus == "ready" }
    .collect { event ->
        if (isAppInForeground()) {
            showInAppAlert("Your order is ready for pickup!")
        }
    }
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- All three options (layered approach)

---

## RISK CATEGORY 3: NETWORK VOLATILITY

### Risk 3.1: Frequent Network Switching (WiFi ↔ Mobile Data)

**Description**: College campuses have spotty WiFi. User walks between buildings, device constantly switches between WiFi and mobile data, causing connection drops.

**Impact**:
- **Severity**: MEDIUM
- **Affected Features**:
  - WebSocket disconnections (every network switch)
  - API request failures mid-request
  - Image loading failures
- **User Experience**: Menu fails to load, order placement fails halfway
- **Business Impact**: Cart abandonment, frustration

**Network Transition Timeline**:
```
T+0s: Walking away from WiFi AP, signal weakens
T+2s: WiFi disconnects
T+3s: No connectivity (gap period)
T+5s: Mobile data connects
T+7s: WebSocket reconnect triggered
T+10s: WebSocket connected, app functional again

Total Downtime: 10 seconds
```

**Mitigation Strategy**:

**Option 1: Exponential Backoff Reconnection (IMPLEMENTED)**
```kotlin
// From android-spec/05-socket-events.md
class SocketManager {
    private var reconnectAttempts = 0
    
    fun scheduleReconnect() {
        val baseDelay = 1000L // 1 second
        val maxDelay = 8000L // 8 seconds
        val delay = min(baseDelay * (1.5.pow(reconnectAttempts)), maxDelay)
        
        handler.postDelayed({
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                connect()
                reconnectAttempts++
            }
        }, delay.toLong())
    }
}
```

**Reconnection Timeline**:
- Attempt 1: 1s delay
- Attempt 2: 1.5s delay
- Attempt 3: 2.25s delay
- Attempt 4: 3.4s delay
- Attempt 5: 5.1s delay
- Attempt 6-10: 8s delay (capped)

**Option 2: Network Callback Monitoring**
```kotlin
class NetworkMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // Network available, trigger immediate reconnect
            socketManager.reconnectNow()
        }
        
        override fun onLost(network: Network) {
            // Network lost, mark as disconnected
            _connectionState.value = ConnectionState.Disconnected
        }
        
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            val validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            
            if (hasInternet && validated) {
                // Actual internet connectivity (not just connected to WiFi with no internet)
                socketManager.reconnectNow()
            }
        }
    }
    
    fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        
        connectivityManager.registerNetworkCallback(request, networkCallback)
    }
}
```

**Option 3: Retry Failed API Requests**
```kotlin
// Retrofit + OkHttp retry interceptor
class RetryInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        var response = chain.proceed(request)
        var tryCount = 0
        
        while (!response.isSuccessful && tryCount < 3) {
            tryCount++
            
            // Retry only on network errors, not 4xx/5xx
            if (response.code() !in 400..599) {
                response.close()
                Thread.sleep(1000L * tryCount) // 1s, 2s, 3s
                response = chain.proceed(request)
            } else {
                break
            }
        }
        
        return response
    }
}
```

**Option 4: Optimistic UI Updates**
```kotlin
// Show success immediately, sync in background
fun addToCart(item: MenuItem) {
    viewModelScope.launch {
        // 1. Update local database immediately (optimistic)
        cartRepository.addItem(item)
        
        // 2. UI updates immediately via Flow
        // User sees cart updated instantly
        
        // 3. Sync to backend in background (best effort)
        // If fails, kept in local database, synced later
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Exponential backoff (already in architecture)
- Option 2: Network monitoring for smart reconnect
- Option 3: Retry interceptor
- Option 4: Optimistic UI (cart, menu browsing)

---

### Risk 3.2: Captive Portal WiFi (College Network Authentication)

**Description**: College WiFi requires browser-based authentication (captive portal). Device shows "Connected to WiFi" but no actual internet until user logs in via browser.

**Impact**:
- **Severity**: HIGH
- **Affected Features**:
  - All API calls fail with timeout
  - WebSocket connection fails
  - FCM notifications not received
- **User Experience**: App shows "Loading..." indefinitely, user frustrated
- **Business Impact**: App perceived as "broken", uninstalls

**Detection**:
```kotlin
val network = connectivityManager.activeNetwork
val capabilities = connectivityManager.getNetworkCapabilities(network)

val isConnected = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
val isValidated = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true

if (isConnected && !isValidated) {
    // Connected to WiFi but no internet (likely captive portal)
    showCaptivePortalWarning()
}
```

**Mitigation Strategy**:

**Option 1: Captive Portal Detection & Warning**
```kotlin
class NetworkMonitor {
    fun detectCaptivePortal(): Boolean {
        return try {
            val url = URL("http://clients3.google.com/generate_204")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            connection.instanceFollowRedirects = false
            connection.connect()
            
            // Google returns 204 No Content if no captive portal
            // Captive portal returns 200 with redirect
            val responseCode = connection.responseCode
            responseCode != 204
        } catch (e: Exception) {
            false
        }
    }
    
    suspend fun monitorCaptivePortal() {
        if (detectCaptivePortal()) {
            withContext(Dispatchers.Main) {
                showCaptivePortalDialog()
            }
        }
    }
}

fun showCaptivePortalDialog() {
    AlertDialog.Builder(context)
        .setTitle("WiFi Login Required")
        .setMessage("You're connected to WiFi but need to log in first. Open your browser to complete WiFi login.")
        .setPositiveButton("Open Browser") { _, _ ->
            // Opens captive portal in browser
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("http://detectportal.firefox.com")))
        }
        .show()
}
```

**Option 2: Automatic Fallback to Mobile Data**
```kotlin
// Android 9+ allows binding specific requests to mobile data
val mobileNetwork = connectivityManager.allNetworks.find { network ->
    val capabilities = connectivityManager.getNetworkCapabilities(network)
    capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true
}

if (mobileNetwork != null && captivePortalDetected) {
    // Bind critical requests to mobile data
    connectivityManager.bindProcessToNetwork(mobileNetwork)
    
    // Make critical API call (order placement, payment)
    orderRepository.createOrder(cart)
    
    // Unbind after critical operation
    connectivityManager.bindProcessToNetwork(null)
}
```

**WARNING**: `bindProcessToNetwork` affects ALL network requests in the process. Use carefully.

**Option 3: Offline Mode with Sync Queue**
```kotlin
// Treat captive portal WiFi as "offline"
if (detectCaptivePortal()) {
    // Queue order for later sync
    orderRepository.queueOrderOffline(cart)
    
    showToast("WiFi login required. Order saved and will sync after you log in.")
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Captive portal detection & warning
- Option 3: Offline queue (already planned for offline support)
- Option 2: SKIP (too risky, poor UX)

---

### Risk 3.3: Metered Connection (Mobile Data)

**Description**: User on mobile data with limited data plan. Large image downloads, video banners consume data quota.

**Impact**:
- **Severity**: LOW
- **Affected Features**:
  - Menu item images
  - Media banners
- **User Experience**: User avoids using app on mobile data, uses only on WiFi
- **Business Impact**: Reduced engagement, fewer orders

**Mitigation Strategy**:

**Option 1: Data Saver Mode Detection**
```kotlin
val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
val isDataSaverEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
    connectivityManager.restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED
} else {
    false
}

if (isDataSaverEnabled) {
    // Disable image loading, show placeholders
    Coil.imageLoader(context).newBuilder()
        .placeholder(R.drawable.placeholder_image)
        .error(R.drawable.placeholder_image)
        .build()
}
```

**Option 2: Image Quality Adjustment**
```kotlin
val isOnMobileData = connectivityManager.activeNetworkInfo?.type == ConnectivityManager.TYPE_MOBILE

val imageLoader = ImageLoader.Builder(context)
    .components {
        if (isOnMobileData) {
            // Load lower quality images on mobile data
            add(ImageDecoderDecoder.Factory())
        }
    }
    .diskCache {
        DiskCache.Builder()
            .directory(context.cacheDir.resolve("image_cache"))
            .maxSizePercent(0.02) // 2% of disk space
            .build()
    }
    .build()
```

**Option 3: User Preference**
```kotlin
// Settings screen
Switch("Load images on mobile data") {
    isChecked = preferences.loadImagesOnMobileData
    onCheckedChange = { checked ->
        preferences.loadImagesOnMobileData = checked
    }
}

// Repository
if (!isOnWiFi && !preferences.loadImagesOnMobileData) {
    return MenuItem(
        id = dto.id,
        name = dto.name,
        imageUrl = null, // Don't load image
        // ...
    )
}
```

**MVP Decision**: **POST-MVP**
- Option 3: User preference (nice-to-have)
- Options 1-2: SKIP for MVP (server already compresses images to 20KB)

---

## RISK CATEGORY 4: SOCKET RECONNECT STRATEGIES

### Risk 4.1: Reconnection Storm (Multiple Clients Reconnecting Simultaneously)

**Description**: Server restarts or network outage affects all connected clients. When server comes back online, all clients reconnect simultaneously, overwhelming server.

**Impact**:
- **Severity**: HIGH (Server-side), MEDIUM (Client-side)
- **Affected Features**:
  - WebSocket server overload
  - Slow reconnection for all users
- **User Experience**: App shows "Connecting..." for 30+ seconds
- **Business Impact**: Perceived downtime, user frustration

**Reconnection Storm Timeline**:
```
T+0s: Server restarts
T+1s: 1000 clients detect disconnect
T+2s: All 1000 clients attempt reconnect simultaneously
T+3s: Server overwhelmed, accepts only 100 connections
T+5s: Remaining 900 clients retry
T+7s: Server still overloaded
T+30s: Eventually all clients reconnected
```

**Mitigation Strategy**:

**Option 1: Jittered Exponential Backoff (RECOMMENDED)**
```kotlin
class SocketManager {
    private val random = Random()
    
    fun scheduleReconnect() {
        val baseDelay = 1000L
        val maxDelay = 8000L
        val exponentialDelay = min(baseDelay * (1.5.pow(reconnectAttempts)), maxDelay)
        
        // Add random jitter: ±30%
        val jitter = exponentialDelay * (0.7 + random.nextDouble() * 0.6)
        val finalDelay = jitter.toLong()
        
        handler.postDelayed({
            connect()
        }, finalDelay)
    }
}
```

**Jitter Distribution** (attempt 1):
- Without jitter: All clients reconnect at T+1s
- With jitter: Clients reconnect between T+0.7s and T+1.6s (spread out)

**Option 2: Server-Side Connection Rate Limiting**
```typescript
// Backend: server/websocket.ts
const connectionLimiter = new Map<string, number>()

io.on('connection', (socket) => {
    const clientIp = socket.handshake.address
    const now = Date.now()
    const lastConnection = connectionLimiter.get(clientIp) || 0
    
    if (now - lastConnection < 1000) {
        // Reject connection if reconnecting too fast
        socket.emit('error', { message: 'Reconnecting too fast, wait 1 second' })
        socket.disconnect(true)
        return
    }
    
    connectionLimiter.set(clientIp, now)
    
    // Handle connection
})
```

**Option 3: Connection Backpressure Signal**
```typescript
// Backend: Send backpressure signal when overloaded
if (connectedClients.size > 5000) {
    socket.emit('backpressure', {
        message: 'Server busy, retry in 10 seconds',
        retryAfter: 10000
    })
    socket.disconnect(true)
}

// Android client: Respect backpressure
socket.on('backpressure') { data ->
    val retryAfter = data.getLong("retryAfter")
    handler.postDelayed({
        connect()
    }, retryAfter)
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Jittered exponential backoff (client-side)
- Option 2: BACKEND TEAM MUST IMPLEMENT (rate limiting)
- Option 3: SKIP for MVP (complex, low ROI)

---

### Risk 4.2: Reconnection Loop (Failing to Connect, Retrying Forever)

**Description**: Server has persistent issue (e.g., MongoDB down, Redis unavailable). Client retries connection forever, draining battery.

**Impact**:
- **Severity**: MEDIUM
- **Affected Features**:
  - Battery drain from endless retries
  - WebSocket never connects
- **User Experience**: App shows "Connecting..." forever, battery drains faster
- **Business Impact**: App perceived as broken, battery complaints, uninstalls

**Mitigation Strategy**:

**Option 1: Maximum Retry Limit (RECOMMENDED)**
```kotlin
class SocketManager {
    companion object {
        const val MAX_RECONNECT_ATTEMPTS = 10
    }
    
    private var reconnectAttempts = 0
    
    fun connect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            // Give up after 10 attempts
            _connectionState.value = ConnectionState.Failed("Connection failed after 10 attempts")
            
            // Show error to user
            showPersistentError("Unable to connect. Please check your internet connection and restart the app.")
            return
        }
        
        socket.connect()
        reconnectAttempts++
    }
    
    // Reset counter on successful connection
    socket.on(Socket.EVENT_CONNECT) {
        reconnectAttempts = 0
        _connectionState.value = ConnectionState.Connected
    }
}
```

**Option 2: Circuit Breaker Pattern**
```kotlin
class SocketConnectionCircuitBreaker {
    private var state = State.CLOSED
    private var failureCount = 0
    private var lastFailureTime = 0L
    
    enum class State {
        CLOSED,  // Normal operation, allow connections
        OPEN,    // Too many failures, block connections
        HALF_OPEN // Testing if server recovered
    }
    
    fun shouldAttemptConnection(): Boolean {
        return when (state) {
            State.CLOSED -> true
            State.OPEN -> {
                // After 60 seconds, try one connection (half-open)
                if (System.currentTimeMillis() - lastFailureTime > 60000) {
                    state = State.HALF_OPEN
                    true
                } else {
                    false
                }
            }
            State.HALF_OPEN -> true
        }
    }
    
    fun recordSuccess() {
        failureCount = 0
        state = State.CLOSED
    }
    
    fun recordFailure() {
        failureCount++
        lastFailureTime = System.currentTimeMillis()
        
        if (failureCount >= 5) {
            // After 5 failures, open circuit (stop trying)
            state = State.OPEN
        }
    }
}
```

**Option 3: Graceful Degradation to Polling**
```kotlin
if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    // Fall back to polling API for order status
    startPollingOrderStatus()
}

fun startPollingOrderStatus() {
    viewModelScope.launch {
        while (isActive) {
            delay(30000) // Poll every 30 seconds
            orderRepository.refreshActiveOrders(userId)
        }
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Max retry limit (10 attempts)
- Option 3: Polling fallback (already planned)
- Option 2: SKIP (over-engineered for MVP)

---

### Risk 4.3: Duplicate Event Delivery After Reconnect

**Description**: WebSocket disconnects mid-event. Server sends event, but client doesn't receive it. Client reconnects, server re-sends event, causing duplicate processing.

**Impact**:
- **Severity**: HIGH (if no deduplication)
- **Affected Features**:
  - Order status updates (order marked "ready" twice)
  - Menu updates (menu refreshed twice)
  - Duplicate notifications
- **User Experience**: Duplicate push notifications ("Order ready" sent twice)
- **Business Impact**: Annoying duplicate notifications, user confusion

**Scenario**:
```
T+0s: Server broadcasts "order_status_changed" (orderId: 123, status: ready)
T+1s: Client A receives event, updates UI
T+2s: Client B WebSocket disconnects (didn't receive event)
T+5s: Client B reconnects
T+6s: Client B polls /api/orders/123, sees status=ready, triggers local update
T+7s: Server re-broadcasts "order_status_changed" (to all clients including B)
T+8s: Client B processes event AGAIN (duplicate)
```

**Mitigation Strategy**:

**Option 1: Event Deduplication (RECOMMENDED)**
```kotlin
class OrderRepository @Inject constructor(
    private val orderDao: OrderDao,
    private val socketManager: SocketManager
) {
    private val processedEvents = mutableSetOf<String>()
    
    init {
        viewModelScope.launch {
            socketManager.orderUpdates.collect { event ->
                when (event) {
                    is OrderUpdateEvent.StatusChanged -> {
                        // Create unique event ID
                        val eventId = "${event.orderId}_${event.newStatus}_${event.timestamp}"
                        
                        if (processedEvents.contains(eventId)) {
                            // Duplicate event, ignore
                            return@collect
                        }
                        
                        processedEvents.add(eventId)
                        
                        // Process event
                        orderDao.updateStatus(event.orderId, event.newStatus)
                        
                        // Clean up old events (keep only last 100)
                        if (processedEvents.size > 100) {
                            processedEvents.clear()
                        }
                    }
                }
            }
        }
    }
}
```

**Option 2: Idempotent Updates (Room Database)**
```kotlin
@Dao
interface OrderDao {
    // This is naturally idempotent - updating same order to same status twice is no-op
    @Query("UPDATE orders SET status = :status, updatedAt = :updatedAt WHERE id = :orderId AND status != :status")
    suspend fun updateStatus(orderId: String, status: String, updatedAt: Long = System.currentTimeMillis())
}
```

**Why This Works**: If order already has `status = "ready"`, second update is no-op (0 rows affected).

**Option 3: Server-Side Event Sequence Numbers**
```typescript
// Backend: Add sequence number to events
let eventSequence = 0

io.to(`canteen_${canteenId}`).emit('orderUpdate', {
    type: 'order_status_changed',
    data: { orderId, oldStatus, newStatus },
    sequence: ++eventSequence,
    timestamp: Date.now()
})

// Android: Track last received sequence number
class SocketManager {
    private var lastSequence = 0
    
    socket.on('orderUpdate') { args ->
        val data = args[0] as JSONObject
        val sequence = data.getInt("sequence")
        
        if (sequence <= lastSequence) {
            // Old event, already processed
            return@on
        }
        
        lastSequence = sequence
        processEvent(data)
    }
}
```

**WARNING**: Sequence numbers don't work well with multi-server deployments (each server has its own sequence). Use UUIDs instead.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Event deduplication (client-side)
- Option 2: Idempotent updates (already natural in Room)
- Option 3: SKIP (backend complexity)

---

## RISK CATEGORY 5: ALARM/NOTIFICATION GUARANTEES

### Risk 5.1: Notification Permission Denial (Android 13+)

**Description**: Android 13+ requires explicit runtime permission for notifications (`POST_NOTIFICATIONS`). User can deny permission, blocking all notifications.

**Impact**:
- **Severity**: CRITICAL
- **Affected Features**:
  - All order status notifications
  - Delivery assignments
  - Payment confirmations
- **User Experience**: User never receives "Order ready" notification, misses pickup
- **Business Impact**: Missed pickups, refunds, poor UX

**Mitigation Strategy**:

**Option 1: Request Permission at Optimal Time (RECOMMENDED)**
```kotlin
// DON'T request on app launch (users likely to deny)
// DO request when user places first order

class CheckoutViewModel : ViewModel() {
    fun placeOrder(cart: List<CartItem>) {
        viewModelScope.launch {
            // Place order first
            val result = placeOrderUseCase(cart)
            
            if (result.isSuccess) {
                // NOW request notification permission
                // User understands value ("get notified when order ready")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    requestNotificationPermission()
                }
            }
        }
    }
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
fun requestNotificationPermission() {
    when {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) 
            == PackageManager.PERMISSION_GRANTED -> {
            // Already granted
        }
        shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
            // User previously denied, show rationale
            showRationaleDialog {
                title = "Get Order Updates"
                message = "We'll notify you when your order is ready for pickup."
                positiveButton("Enable") {
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
        else -> {
            // First time, request directly
            requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
```

**Option 2: In-App Alerts as Fallback**
```kotlin
// If notification permission denied, show in-app alerts
class OrderStatusMonitor {
    fun monitorOrderStatus(orderId: String) {
        if (!hasNotificationPermission()) {
            // Poll order status and show in-app alert
            viewModelScope.launch {
                orderRepository.getOrderById(orderId)
                    .collect { order ->
                        if (order.status == OrderStatus.READY && isAppInForeground()) {
                            showInAppAlert("Your order is ready for pickup!")
                            playNotificationSound()
                        }
                    }
            }
        }
    }
}
```

**Option 3: Persistent Banner**
```kotlin
// Show banner if notifications disabled
@Composable
fun OrderTrackingScreen() {
    val hasNotificationPermission = remember { checkNotificationPermission() }
    
    Column {
        if (!hasNotificationPermission) {
            Banner(
                message = "Notifications disabled. You won't be notified when your order is ready.",
                action = "Enable"
            ) {
                openNotificationSettings()
            }
        }
        
        // Rest of UI
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Request at optimal time (after first order)
- Option 2: In-app alerts (foreground only)
- Option 3: Persistent banner

---

### Risk 5.2: Notification Channel Disabled by User

**Description**: User disables specific notification channel ("Order Updates") in Android settings, blocking order notifications while keeping other app notifications.

**Impact**:
- **Severity**: HIGH
- **Affected Features**:
  - Order status notifications
- **User Experience**: User receives some notifications (e.g., promotions) but not order updates
- **Business Impact**: Missed pickups despite notifications "enabled"

**Mitigation Strategy**:

**Option 1: Channel Status Detection**
```kotlin
fun isNotificationChannelEnabled(channelId: String): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = notificationManager.getNotificationChannel(channelId)
        return channel?.importance != NotificationManager.IMPORTANCE_NONE
    }
    return true
}

// Check before showing order
if (!isNotificationChannelEnabled(CHANNEL_ORDER_UPDATES)) {
    showChannelDisabledWarning()
}
```

**Option 2: Open Channel Settings**
```kotlin
fun openNotificationChannelSettings(channelId: String) {
    val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
    }
    context.startActivity(intent)
}
```

**Option 3: Multiple Notification Channels (Fallback)**
```kotlin
// Create backup channel
val primaryChannel = NotificationChannel(
    "ORDER_UPDATES_PRIMARY",
    "Order Updates",
    NotificationManager.IMPORTANCE_HIGH
)

val backupChannel = NotificationChannel(
    "ORDER_UPDATES_BACKUP",
    "Important Order Notifications",
    NotificationManager.IMPORTANCE_HIGH
)

// Try primary channel, fall back to backup if disabled
val channelToUse = if (isNotificationChannelEnabled("ORDER_UPDATES_PRIMARY")) {
    "ORDER_UPDATES_PRIMARY"
} else {
    "ORDER_UPDATES_BACKUP"
}
```

**WARNING**: Using multiple channels for same purpose violates Android guidelines, may be flagged in Play Store review.

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Channel status detection
- Option 2: Open channel settings (in warning dialog)
- Option 3: SKIP (against guidelines)

---

### Risk 5.3: Notification Delivery Delay (Doze + Battery Saver)

**Description**: Notifications delayed by 5-15 minutes when device in Doze mode + Battery Saver enabled.

**Impact**:
- **Severity**: HIGH
- **Affected Features**:
  - Order status notifications
- **User Experience**: User receives "Order ready" notification 10 minutes late
- **Business Impact**: Cold food, complaints

**Mitigation Strategy**:

**Option 1: High-Priority FCM (RECOMMENDED)**
```json
{
  "message": {
    "token": fcmToken,
    "android": {
      "priority": "high", // Bypasses most delays
      "notification": {
        "channel_id": "ORDER_UPDATES",
        "notification_priority": "PRIORITY_MAX"
      }
    },
    "data": {
      "orderId": "123",
      "status": "ready"
    }
  }
}
```

**FCM Priority Behavior**:
- `normal`: Delivered within 15 minutes (batched)
- `high`: Delivered immediately (wakes device from Doze for up to 10 seconds)

**Option 2: Time-Sensitive Notification (Android 12+)**
```kotlin
val notification = NotificationCompat.Builder(context, CHANNEL_ID)
    .setContentTitle("Order Ready")
    .setContentText("Your order is ready for pickup")
    .setPriority(NotificationCompat.PRIORITY_HIGH)
    .setCategory(NotificationCompat.CATEGORY_STATUS) // Time-sensitive
    .build()
```

**Option 3: SMS Fallback (Last Resort)**
```kotlin
// If critical notification not delivered within 2 minutes, send SMS
// Requires backend integration with Twilio/AWS SNS
// NOT RECOMMENDED for MVP (cost, complexity)
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: High-priority FCM (backend configuration)
- Option 2: Time-sensitive notification category
- Option 3: SKIP (too expensive)

---

## RISK CATEGORY 6: DATA CONSISTENCY GUARANTEES

### Risk 6.1: Offline Order Duplication

**Description**: User places order while offline. Order queued in PendingOrder table. Network comes back online briefly, WorkManager starts sync but network drops mid-request. Order partially sent to server, but client doesn't receive confirmation. WorkManager retries, creates duplicate order.

**Impact**:
- **Severity**: CRITICAL
- **Affected Features**:
  - Order placement
  - Payment charges (user charged twice)
- **User Experience**: User sees one order in app, but two orders created on backend, double charged
- **Business Impact**: Payment disputes, refunds, loss of trust

**Scenario**:
```
T+0s: User places order offline, saved to PendingOrder table
T+60s: Network comes online, WorkManager starts sync
T+65s: POST /api/orders sent to server
T+67s: Server creates order in MongoDB, deducts stock
T+68s: Network drops BEFORE response reaches client
T+70s: Client doesn't receive success response, marks order as "failed"
T+90s: WorkManager retries (exponential backoff)
T+95s: POST /api/orders sent AGAIN
T+97s: Server creates DUPLICATE order (different order ID)
```

**Mitigation Strategy**:

**Option 1: Idempotency Keys (RECOMMENDED)**
```kotlin
// Client: Generate idempotency key per order
data class PendingOrder(
    val id: String, // UUID generated on device
    val userId: String,
    val items: String,
    val totalAmount: Double,
    val idempotencyKey: String = UUID.randomUUID().toString(), // CRITICAL
    val createdAt: Long
)

// WorkManager: Send idempotency key in header
class OrderSyncWorker : CoroutineWorker() {
    override suspend fun doWork(): Result {
        val pendingOrder = pendingOrderDao.getPendingOrders().firstOrNull() ?: return Result.success()
        
        val response = orderApi.createOrder(
            request = CreateOrderRequest(pendingOrder),
            idempotencyKey = pendingOrder.idempotencyKey // Header
        )
        
        if (response.isSuccessful) {
            pendingOrderDao.delete(pendingOrder)
            return Result.success()
        }
        
        return Result.retry()
    }
}

// Retrofit API
interface OrderApi {
    @POST("orders")
    suspend fun createOrder(
        @Body request: CreateOrderRequest,
        @Header("X-Idempotency-Key") idempotencyKey: String
    ): Response<ApiResponse<OrderDto>>
}
```

**Backend: Idempotency Key Validation**
```typescript
// server/routes.ts
const processedIdempotencyKeys = new Map<string, { orderId: string, timestamp: number }>()

app.post('/api/orders', async (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key']
    
    if (!idempotencyKey) {
        return res.status(400).json({ success: false, message: 'Idempotency key required' })
    }
    
    // Check if order with this key already processed
    const existingOrder = processedIdempotencyKeys.get(idempotencyKey)
    if (existingOrder) {
        // Return existing order (idempotent)
        const order = await Order.findById(existingOrder.orderId)
        return res.json({ success: true, data: order })
    }
    
    // Create new order
    const order = await Order.create(req.body)
    
    // Store idempotency key (expires after 24h)
    processedIdempotencyKeys.set(idempotencyKey, {
        orderId: order._id,
        timestamp: Date.now()
    })
    
    // Clean up old keys
    cleanupOldIdempotencyKeys()
    
    res.json({ success: true, data: order })
})
```

**Option 2: Client-Side Order ID**
```kotlin
// Client generates order ID (UUID)
data class PendingOrder(
    val orderId: String = UUID.randomUUID().toString(), // Client-generated
    // ...
)

// Backend: Use client-generated order ID
app.post('/api/orders', async (req, res) => {
    const { orderId, items, totalAmount } = req.body
    
    // Check if order with this ID already exists
    const existingOrder = await Order.findOne({ orderId })
    if (existingOrder) {
        // Idempotent - return existing order
        return res.json({ success: true, data: existingOrder })
    }
    
    // Create order with client-provided ID
    const order = await Order.create({ _id: orderId, items, totalAmount })
    res.json({ success: true, data: order })
})
```

**Option 3: Duplicate Detection (Backend Fallback)**
```typescript
// Backend: Detect duplicate orders by userId + items + amount + timestamp
app.post('/api/orders', async (req, res) => {
    const { userId, items, totalAmount } = req.body
    
    // Check for duplicate order in last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    const duplicateOrder = await Order.findOne({
        userId,
        totalAmount,
        createdAt: { $gt: fiveMinutesAgo }
        // Deep equality check on items (expensive)
    })
    
    if (duplicateOrder && areItemsEqual(duplicateOrder.items, items)) {
        return res.status(429).json({
            success: false,
            message: 'Duplicate order detected',
            errorCode: 'DUPLICATE_ORDER'
        })
    }
    
    // Create order
    const order = await Order.create(req.body)
    res.json({ success: true, data: order })
})
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Idempotency keys (BACKEND + ANDROID)
- Option 2: SKIP (less robust than idempotency keys)
- Option 3: Backend fallback (already implemented per 04-rest-apis.md)

---

### Risk 6.2: Cart-Menu Price Discrepancy

**Description**: User adds item to cart (price ₹200). Menu price updated on backend (now ₹250). User proceeds to checkout, cart shows ₹200 but backend expects ₹250. Payment fails or user charged wrong amount.

**Impact**:
- **Severity**: HIGH
- **Affected Features**:
  - Checkout flow
  - Payment processing
- **User Experience**: User sees ₹200 in cart, but payment screen shows ₹250, confusion
- **Business Impact**: Payment disputes, cart abandonment

**Scenario**:
```
T+0s: User adds "Pizza" to cart (price: ₹200, cached from menu)
T+10min: Admin updates Pizza price to ₹250 on backend
T+15min: Backend broadcasts `menu_updated` event
T+16min: User's device offline, doesn't receive event
T+20min: User proceeds to checkout
T+21min: POST /api/orders with items: [{ id: "pizza", price: 200, quantity: 1 }]
T+22min: Backend validates: Pizza current price is ₹250, not ₹200
T+23min: Backend returns 400 error: "Price mismatch"
```

**Mitigation Strategy**:

**Option 1: Price Validation at Checkout (RECOMMENDED)**
```kotlin
class PlaceOrderUseCase @Inject constructor(
    private val cartRepository: CartRepository,
    private val menuRepository: MenuRepository,
    private val orderRepository: OrderRepository
) {
    suspend operator fun invoke(cart: List<CartItem>): Result<Order> {
        // 1. Fetch latest menu prices from API
        val latestPrices = menuRepository.fetchLatestPrices(cart.map { it.menuItemId })
        
        // 2. Validate cart prices against latest prices
        val priceDiscrepancies = cart.mapNotNull { cartItem ->
            val latestPrice = latestPrices[cartItem.menuItemId]
            if (latestPrice != null && latestPrice != cartItem.price) {
                PriceDiscrepancy(cartItem.name, cartItem.price, latestPrice)
            } else null
        }
        
        // 3. If price changed, show warning to user
        if (priceDiscrepancies.isNotEmpty()) {
            return Result.failure(PriceChangedException(priceDiscrepancies))
        }
        
        // 4. Proceed with order
        return orderRepository.createOrder(cart)
    }
}

// ViewModel: Handle price change error
viewModel.placeOrder(cart)
    .onFailure { error ->
        if (error is PriceChangedException) {
            showPriceChangeDialog(error.discrepancies) {
                // Update cart with latest prices
                cartRepository.updatePrices(error.discrepancies)
                // Retry order
                placeOrder(cart)
            }
        }
    }
```

**UI: Price Change Dialog**
```kotlin
@Composable
fun PriceChangeDialog(discrepancies: List<PriceDiscrepancy>) {
    AlertDialog(
        title = { Text("Price Updated") },
        text = {
            Column {
                Text("Some prices have changed:")
                discrepancies.forEach { d ->
                    Text("${d.itemName}: ₹${d.oldPrice} → ₹${d.newPrice}")
                }
            }
        },
        confirmButton = {
            Button(onClick = { /* Update cart and retry */ }) {
                Text("Continue with new price")
            }
        },
        dismissButton = {
            TextButton(onClick = { /* Cancel order */ }) {
                Text("Cancel")
            }
        }
    )
}
```

**Option 2: Server-Side Price Validation (Always Do)**
```typescript
// Backend: ALWAYS validate prices, ignore client-provided prices
app.post('/api/orders', async (req, res) => {
    const { items } = req.body
    
    // Fetch current prices from database
    const menuItems = await MenuItem.find({ _id: { $in: items.map(i => i.id) } })
    
    // Validate prices
    for (const item of items) {
        const menuItem = menuItems.find(m => m._id.toString() === item.id)
        if (!menuItem) {
            return res.status(400).json({ success: false, message: `Item ${item.id} not found` })
        }
        
        if (menuItem.price !== item.price) {
            return res.status(400).json({
                success: false,
                message: `Price mismatch for ${menuItem.name}. Expected ₹${menuItem.price}, got ₹${item.price}`,
                errorCode: 'PRICE_MISMATCH',
                data: {
                    itemId: item.id,
                    expectedPrice: menuItem.price,
                    providedPrice: item.price
                }
            })
        }
    }
    
    // Create order with VALIDATED prices
    const order = await Order.create({
        items: items.map(item => ({
            ...item,
            price: menuItems.find(m => m._id.toString() === item.id).price // Use DB price
        })),
        totalAmount: calculateTotal(items, menuItems)
    })
    
    res.json({ success: true, data: order })
})
```

**Option 3: Cart Staleness Warning**
```kotlin
// Show warning if cart items are old
@Composable
fun CartScreen() {
    val cartItems = viewModel.cartItems.collectAsState()
    val oldestItem = cartItems.value.minByOrNull { it.addedAt }
    
    if (oldestItem != null) {
        val age = System.currentTimeMillis() - oldestItem.addedAt
        if (age > 24 * 60 * 60 * 1000) { // 24 hours
            Banner(
                message = "Cart items are ${age / (60 * 60 * 1000)}h old. Prices may have changed.",
                action = "Refresh"
            ) {
                viewModel.refreshCart()
            }
        }
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Client-side price validation at checkout
- Option 2: Server-side validation (BACKEND MUST IMPLEMENT)
- Option 3: Cart staleness warning (nice-to-have)

---

### Risk 6.3: Stock Depletion During Checkout

**Description**: User adds item to cart (stock: 10). Other users order same item. By the time user checks out, stock depleted (stock: 0). Order fails, cart abandoned.

**Impact**:
- **Severity**: MEDIUM
- **Affected Features**:
  - Order placement
  - Cart validation
- **User Experience**: User goes through entire checkout flow, payment fails at last step due to out-of-stock
- **Business Impact**: Cart abandonment, frustration

**Scenario**:
```
T+0s: User A adds "Samosa" to cart (stock: 5)
T+2min: User B orders 5 Samosas, stock depleted to 0
T+5min: User A proceeds to checkout
T+6min: POST /api/orders with items: [{ id: "samosa", quantity: 1 }]
T+7min: Backend validates stock: Samosa out of stock
T+8min: Backend returns 400 error: "Item out of stock"
```

**Mitigation Strategy**:

**Option 1: Stock Validation Before Payment (RECOMMENDED)**
```kotlin
class CheckoutViewModel : ViewModel() {
    fun initiateCheckout(cart: List<CartItem>) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            
            // Validate stock BEFORE creating checkout session
            val stockValidation = orderRepository.validateStock(cart)
            
            if (stockValidation is Result.Failure) {
                _uiState.value = UiState.Error(stockValidation.error.message)
                return@launch
            }
            
            // Stock available, create checkout session
            val checkoutSession = checkoutRepository.createSession(cart)
            
            if (checkoutSession.isSuccess) {
                // Proceed to payment
                navigateToPayment(checkoutSession.getOrNull()!!)
            }
        }
    }
}

// Repository
suspend fun validateStock(cart: List<CartItem>): Result<Unit> {
    val response = orderApi.validateStock(ValidateStockRequest(cart))
    
    if (response.isSuccessful) {
        val validation = response.body()?.data
        if (validation?.allAvailable == true) {
            return Result.success(Unit)
        } else {
            val unavailableItems = validation?.unavailableItems ?: emptyList()
            return Result.failure(StockUnavailableException(unavailableItems))
        }
    }
    
    return Result.failure(Exception("Stock validation failed"))
}
```

**Backend: Stock Validation Endpoint**
```typescript
app.post('/api/orders/validate-stock', async (req, res) => {
    const { items } = req.body
    
    const unavailableItems = []
    
    for (const item of items) {
        const menuItem = await MenuItem.findById(item.menuItemId)
        
        if (!menuItem || !menuItem.available) {
            unavailableItems.push({
                menuItemId: item.menuItemId,
                name: menuItem?.name || 'Unknown',
                reason: 'unavailable'
            })
        } else if (menuItem.stock !== null && menuItem.stock < item.quantity) {
            unavailableItems.push({
                menuItemId: item.menuItemId,
                name: menuItem.name,
                reason: 'insufficient_stock',
                available: menuItem.stock,
                requested: item.quantity
            })
        }
    }
    
    if (unavailableItems.length > 0) {
        return res.json({
            success: false,
            message: 'Some items are unavailable',
            errorCode: 'STOCK_UNAVAILABLE',
            data: {
                allAvailable: false,
                unavailableItems
            }
        })
    }
    
    res.json({
        success: true,
        data: { allAvailable: true, unavailableItems: [] }
    })
})
```

**Option 2: Real-Time Stock Updates via WebSocket**
```kotlin
// Listen to stock updates
socketManager.stockUpdates
    .collect { event ->
        when (event) {
            is StockUpdateEvent.StockChanged -> {
                // Update cart item availability
                cartRepository.updateItemAvailability(event.menuItemId, event.newStock)
                
                // Show warning if cart item out of stock
                if (event.newStock == 0) {
                    val cartItem = cartRepository.getCartItem(event.menuItemId)
                    if (cartItem != null) {
                        showToast("${cartItem.name} is now out of stock")
                    }
                }
            }
        }
    }
```

**Option 3: Auto-Remove Unavailable Items from Cart**
```kotlin
fun removeUnavailableItems(cart: List<CartItem>): List<CartItem> {
    return cart.filter { item ->
        val menuItem = menuRepository.getMenuItem(item.menuItemId)
        menuItem?.available == true && (menuItem.stock == null || menuItem.stock > 0)
    }
}

// Before checkout
val availableCart = removeUnavailableItems(cart)
if (availableCart.size < cart.size) {
    showDialog {
        title = "Some items removed"
        message = "${cart.size - availableCart.size} items were out of stock and removed from cart."
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Stock validation before payment (backend + Android)
- Option 2: Real-time stock updates (already in architecture)
- Option 3: Auto-remove unavailable items

---

### Risk 6.4: Payment Success but Order Not Created

**Description**: User completes payment (Razorpay/PhonePe), payment successful on gateway side, but network drops before order created in backend. User charged, but no order exists.

**Impact**:
- **Severity**: CRITICAL
- **Affected Features**:
  - Payment flow
  - Order creation
- **User Experience**: User sees payment success screen, but order doesn't appear in order history. Money deducted, no order.
- **Business Impact**: Payment disputes, refunds, legal issues

**Scenario**:
```
T+0s: User initiates Razorpay payment
T+5s: User completes payment in Razorpay SDK
T+7s: Razorpay webhook notifies backend (payment successful)
T+8s: Backend creates payment record in database
T+9s: Backend starts creating order in MongoDB
T+10s: Network drops, MongoDB connection times out
T+11s: Order NOT created, but payment successful
T+15s: User sees payment success in Razorpay SDK
T+16s: User returns to app, expects order confirmation, but order not found
```

**Mitigation Strategy**:

**Option 1: Idempotent Order Creation from Payment Webhook (RECOMMENDED)**
```typescript
// Backend: Payment webhook handler
app.post('/api/webhooks/razorpay', async (req, res) => {
    const { razorpay_payment_id, razorpay_signature, metadata } = req.body
    
    // Verify signature
    if (!verifyRazorpaySignature(razorpay_payment_id, razorpay_signature)) {
        return res.status(400).json({ success: false, message: 'Invalid signature' })
    }
    
    // Check if order already created for this payment
    const existingOrder = await Order.findOne({ paymentId: razorpay_payment_id })
    if (existingOrder) {
        // Idempotent - order already created
        return res.json({ success: true, data: existingOrder })
    }
    
    // Create order atomically
    const session = await mongoose.startSession()
    session.startTransaction()
    
    try {
        // 1. Create payment record
        const payment = await Payment.create([{
            razorpayPaymentId: razorpay_payment_id,
            amount: metadata.amount,
            status: 'captured'
        }], { session })
        
        // 2. Create order
        const order = await Order.create([{
            userId: metadata.userId,
            items: metadata.items,
            totalAmount: metadata.amount,
            paymentId: razorpay_payment_id,
            status: 'placed'
        }], { session })
        
        // 3. Deduct stock
        for (const item of metadata.items) {
            await MenuItem.findByIdAndUpdate(
                item.menuItemId,
                { $inc: { stock: -item.quantity } },
                { session }
            )
        }
        
        await session.commitTransaction()
        
        // Send confirmation notification
        sendOrderConfirmationNotification(order[0])
        
        res.json({ success: true, data: order[0] })
    } catch (error) {
        await session.abortTransaction()
        
        // Critical: Payment captured but order failed
        // Log for manual reconciliation
        logger.error('CRITICAL: Payment captured but order creation failed', {
            paymentId: razorpay_payment_id,
            error: error.message
        })
        
        // Attempt refund
        await initiateRefund(razorpay_payment_id, metadata.amount)
        
        res.status(500).json({ success: false, message: 'Order creation failed, refund initiated' })
    } finally {
        session.endSession()
    }
})
```

**Option 2: Client-Side Payment Verification Polling**
```kotlin
class PaymentVerificationUseCase @Inject constructor(
    private val orderRepository: OrderRepository,
    private val paymentRepository: PaymentRepository
) {
    suspend operator fun invoke(paymentId: String, maxAttempts: Int = 10): Result<Order> {
        repeat(maxAttempts) { attempt ->
            delay(2000L * (attempt + 1)) // 2s, 4s, 6s, ...
            
            // Poll backend for order associated with payment
            val order = orderRepository.getOrderByPaymentId(paymentId)
            
            if (order != null) {
                return Result.success(order)
            }
        }
        
        // After 10 attempts (total 110 seconds), give up
        return Result.failure(Exception("Order not found after payment"))
    }
}

// Usage after payment success
fun onPaymentSuccess(paymentId: String) {
    viewModelScope.launch {
        _uiState.value = UiState.Loading("Confirming order...")
        
        val result = paymentVerificationUseCase(paymentId)
        
        if (result.isSuccess) {
            val order = result.getOrNull()!!
            navigateToOrderConfirmation(order)
        } else {
            // Payment successful but order not found
            showPaymentSuccessButOrderPendingScreen(paymentId)
        }
    }
}
```

**Option 3: Offline Payment Queue**
```kotlin
@Entity(tableName = "pending_payments")
data class PendingPayment(
    @PrimaryKey val paymentId: String,
    val userId: String,
    val cartJson: String, // Serialized cart
    val amount: Double,
    val timestamp: Long,
    val retries: Int = 0
)

// If order creation fails after payment, queue for retry
class PaymentSyncWorker : CoroutineWorker() {
    override suspend fun doWork(): Result {
        val pendingPayments = pendingPaymentDao.getAll()
        
        for (payment in pendingPayments) {
            val order = orderRepository.getOrderByPaymentId(payment.paymentId)
            
            if (order != null) {
                // Order already exists, remove from queue
                pendingPaymentDao.delete(payment)
            } else {
                // Try to create order
                val result = orderRepository.createOrderFromPayment(payment)
                
                if (result.isSuccess) {
                    pendingPaymentDao.delete(payment)
                } else if (payment.retries >= 10) {
                    // After 10 retries, escalate to support
                    notifySupport(payment)
                    pendingPaymentDao.delete(payment)
                } else {
                    // Increment retry count
                    pendingPaymentDao.update(payment.copy(retries = payment.retries + 1))
                }
            }
        }
        
        return Result.success()
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Idempotent webhook handler with transaction (BACKEND CRITICAL)
- Option 2: Client-side payment verification polling
- Option 3: Offline payment queue (safety net)

---

### Risk 6.5: Stale Cache Showing Wrong Data

**Description**: User sees outdated menu data from cache (item marked available, but actually out of stock). User orders, order fails.

**Impact**:
- **Severity**: MEDIUM
- **Affected Features**:
  - Menu browsing
  - Order placement
- **User Experience**: User sees item as available, adds to cart, checkout fails
- **Business Impact**: Cart abandonment, frustration

**Mitigation Strategy**:

**Option 1: Cache Expiry with Visual Indicator (RECOMMENDED)**
```kotlin
@Composable
fun MenuScreen() {
    val cacheStatus = viewModel.cacheStatus.collectAsState()
    
    Column {
        when (cacheStatus.value) {
            is CacheStatus.Fresh -> {
                // No indicator needed
            }
            is CacheStatus.Stale -> {
                Banner(
                    message = "Menu data is ${cacheStatus.value.ageInMinutes} minutes old. Pull to refresh.",
                    backgroundColor = Color.Yellow
                )
            }
            is CacheStatus.Expired -> {
                Banner(
                    message = "Menu data is outdated. Refreshing...",
                    backgroundColor = Color.Red
                ) {
                    viewModel.refreshMenu()
                }
            }
        }
        
        // Menu content
    }
}

// ViewModel
sealed class CacheStatus {
    object Fresh : CacheStatus() // < 5 minutes
    data class Stale(val ageInMinutes: Int) : CacheStatus() // 5-30 minutes
    data class Expired(val ageInMinutes: Int) : CacheStatus() // > 30 minutes
}
```

**Option 2: Aggressive Refresh on App Resume**
```kotlin
class MenuViewModel : ViewModel() {
    fun onAppResumed() {
        viewModelScope.launch {
            val cacheAge = menuRepository.getCacheAge()
            
            if (cacheAge > 5 * 60 * 1000) { // > 5 minutes
                // Refresh in background
                menuRepository.refreshMenu(canteenId)
            }
        }
    }
}
```

**Option 3: Cache-Aside Pattern with TTL**
```kotlin
class MenuRepository {
    private val CACHE_TTL = 10 * 60 * 1000L // 10 minutes
    
    suspend fun getMenu(canteenId: String): Flow<List<MenuItem>> {
        return flow {
            // 1. Emit cached data immediately
            val cachedItems = menuDao.getMenuItems(canteenId).first()
            if (cachedItems.isNotEmpty()) {
                emit(cachedItems.map { it.toDomainModel() })
            }
            
            // 2. Check cache age
            val cacheAge = System.currentTimeMillis() - (cachedItems.firstOrNull()?.cachedAt ?: 0)
            
            // 3. If cache expired, fetch from API
            if (cacheAge > CACHE_TTL || cachedItems.isEmpty()) {
                val freshItems = menuApi.getMenu(canteenId)
                if (freshItems.isSuccessful) {
                    val items = freshItems.body()?.data ?: emptyList()
                    menuDao.insertAll(items.map { it.toEntity() })
                    emit(items.map { it.toDomainModel() })
                }
            }
        }
    }
}
```

**MVP Decision**: **MVP - MUST IMPLEMENT**
- Option 1: Cache expiry indicator
- Option 2: Aggressive refresh on resume
- Option 3: Cache-aside with TTL (already in architecture)

---

## RISK SUMMARY TABLE

| Risk ID | Risk Name | Severity | MVP Priority | Mitigation Complexity |
|---------|-----------|----------|--------------|----------------------|
| 1.1 | Doze Mode WebSocket Disconnection | HIGH | MVP | MEDIUM (FCM + WorkManager) |
| 1.2 | App Standby Network Restrictions | MEDIUM | MVP | LOW (Cache expiry warnings) |
| 1.3 | Background Service Limitations | HIGH | MVP | LOW (Foreground service) |
| 2.1 | Aggressive OEM Task Killers | CRITICAL | MVP | HIGH (User education) |
| 2.2 | Notification Throttling | HIGH | MVP | MEDIUM (High-priority channels) |
| 3.1 | Network Switching (WiFi ↔ Mobile) | MEDIUM | MVP | MEDIUM (Exponential backoff) |
| 3.2 | Captive Portal WiFi | HIGH | MVP | MEDIUM (Detection + warning) |
| 3.3 | Metered Connection (Mobile Data) | LOW | POST-MVP | LOW (User preference) |
| 4.1 | Reconnection Storm | HIGH | MVP | MEDIUM (Jittered backoff) |
| 4.2 | Reconnection Loop | MEDIUM | MVP | LOW (Max retry limit) |
| 4.3 | Duplicate Event Delivery | HIGH | MVP | MEDIUM (Deduplication) |
| 5.1 | Notification Permission Denial | CRITICAL | MVP | LOW (Request at optimal time) |
| 5.2 | Notification Channel Disabled | HIGH | MVP | LOW (Channel status detection) |
| 5.3 | Notification Delivery Delay | HIGH | MVP | LOW (High-priority FCM) |
| 6.1 | Offline Order Duplication | CRITICAL | MVP | HIGH (Idempotency keys) |
| 6.2 | Cart-Menu Price Discrepancy | HIGH | MVP | MEDIUM (Price validation) |
| 6.3 | Stock Depletion During Checkout | MEDIUM | MVP | MEDIUM (Stock validation API) |
| 6.4 | Payment Success but Order Not Created | CRITICAL | MVP | HIGH (Webhook + polling) |
| 6.5 | Stale Cache Showing Wrong Data | MEDIUM | MVP | LOW (Cache expiry indicator) |

---

## MVP MITIGATION CHECKLIST

### MUST IMPLEMENT FOR MVP

**Battery & Background Execution**
- [ ] High-priority FCM notifications for order updates
- [ ] Foreground service for delivery app (with persistent notification)
- [ ] WorkManager periodic sync (15-minute interval fallback)
- [ ] Cache expiry warnings ("Data is X hours old")
- [ ] Aggressive data refresh on app launch/resume

**OEM Background Kill Prevention**
- [ ] Detect aggressive OEMs (Xiaomi, Oppo, Vivo)
- [ ] Show in-app education dialog (battery whitelist instructions)
- [ ] Deep-link to manufacturer-specific battery settings
- [ ] Auto-restart receiver (BOOT_COMPLETED)
- [ ] High-priority notification channels (IMPORTANCE_HIGH)

**Network Volatility**
- [ ] Exponential backoff reconnection (1s, 1.5s, 2.25s, ...)
- [ ] Network callback monitoring (smart reconnect on network available)
- [ ] Retry interceptor for API calls (3 retries with backoff)
- [ ] Captive portal detection (http://clients3.google.com/generate_204)
- [ ] Captive portal warning dialog with browser launch

**WebSocket Reconnection**
- [ ] Jittered exponential backoff (±30% randomness)
- [ ] Maximum retry limit (10 attempts)
- [ ] Event deduplication (processedEvents set)
- [ ] Idempotent Room database updates (WHERE status != newStatus)

**Notification Guarantees**
- [ ] Request POST_NOTIFICATIONS permission at optimal time (after first order)
- [ ] In-app alert fallback if permission denied
- [ ] Notification channel status detection
- [ ] High-priority FCM configuration (priority: high)
- [ ] Time-sensitive notification category (Android 12+)

**Data Consistency**
- [ ] Idempotency keys for order creation (X-Idempotency-Key header)
- [ ] Backend idempotency key validation (24h cache)
- [ ] Price validation before checkout (fetchLatestPrices)
- [ ] Server-side price validation (ignore client prices)
- [ ] Stock validation API endpoint (POST /api/orders/validate-stock)
- [ ] Payment verification polling (10 attempts, 2s intervals)
- [ ] Idempotent payment webhook handler (MongoDB transaction)
- [ ] Offline payment queue (PendingPayment table + WorkManager)

---

## POST-MVP ENHANCEMENTS

**Battery Optimization**
- [ ] Battery usage analytics (track battery drain per feature)
- [ ] Adaptive sync intervals based on battery level
- [ ] Smart notification batching (batch non-urgent notifications)

**OEM Compatibility**
- [ ] Automated OEM-specific testing (Xiaomi, Oppo, Vivo devices)
- [ ] OEM whitelist success tracking (analytics)
- [ ] Alternative delivery mechanisms (SMS fallback for critical notifications)

**Network Resilience**
- [ ] Bandwidth-aware image loading (low/medium/high quality)
- [ ] Data saver mode respect (detect ConnectivityManager.RESTRICT_BACKGROUND_STATUS)
- [ ] Prefetching on WiFi (download menu images for offline use)
- [ ] P2P sync (Nearby/WiFi Direct for peer-to-peer order sync)

**Advanced WebSocket**
- [ ] WebSocket connection pooling (reuse connections)
- [ ] Server-sent event (SSE) fallback (if WebSocket blocked by firewall)
- [ ] WebRTC data channel (peer-to-peer updates)

**Notification Enhancements**
- [ ] Smart notification grouping (group multiple order updates)
- [ ] Notification action buttons ("View Order", "Reorder")
- [ ] Adaptive notification priority (ML-based importance prediction)
- [ ] Silent notification mode (scheduled quiet hours)

**Data Consistency**
- [ ] Conflict-free replicated data types (CRDTs) for offline-first sync
- [ ] Operational transformation for collaborative editing
- [ ] Vector clocks for causality tracking
- [ ] Multi-version concurrency control (MVCC) for optimistic locking

---

## TESTING STRATEGY

### Device Matrix (MVP Testing)

| Manufacturer | Device | Android Version | Battery Behavior | Priority |
|--------------|--------|-----------------|------------------|----------|
| Google | Pixel 7 | Android 14 | Standard | HIGH |
| Samsung | Galaxy S23 | Android 14 | Moderate | HIGH |
| Xiaomi | Redmi Note 12 | MIUI 14 (Android 13) | Aggressive | CRITICAL |
| Oppo | Reno 8 | ColorOS 13 (Android 13) | Aggressive | HIGH |
| OnePlus | Nord CE 3 | OxygenOS 13 (Android 13) | Moderate | MEDIUM |
| Vivo | V27 | FuntouchOS 13 (Android 13) | Aggressive | MEDIUM |

**Testing Scenarios**:
1. **Doze Mode Test**: Lock screen for 30 minutes, verify FCM notification received
2. **App Standby Test**: Don't use app for 48 hours, verify WorkManager runs
3. **OEM Kill Test**: Lock screen on Xiaomi device, verify foreground service not killed
4. **Network Switch Test**: Walk between WiFi and mobile data, verify WebSocket reconnects
5. **Captive Portal Test**: Connect to WiFi with browser login, verify warning shown
6. **Payment Test**: Complete payment, kill app immediately, verify order created via webhook
7. **Offline Test**: Enable airplane mode, place order, verify queued and synced after online

### ADB Commands for Testing

```bash
# Enable Doze mode immediately
adb shell dumpsys deviceidle force-idle

# Exit Doze mode
adb shell dumpsys deviceidle unforce

# Enable App Standby (Rare bucket)
adb shell am set-inactive <package-name> true

# Disable App Standby
adb shell am set-inactive <package-name> false

# Kill background processes
adb shell am kill-all

# Simulate low battery (15%)
adb shell dumpsys battery set level 15

# Reset battery
adb shell dumpsys battery reset

# Block network (simulate network loss)
adb shell svc wifi disable
adb shell svc data disable

# Restore network
adb shell svc wifi enable
adb shell svc data enable

# Force stop app
adb shell am force-stop <package-name>

# Check foreground services
adb shell dumpsys activity services | grep <package-name>

# Check notification channels
adb shell dumpsys notification | grep <package-name>
```

---

## MONITORING & ALERTING

### Key Metrics to Track

**Battery & Background**
- Foreground service uptime (target: >95% for delivery app)
- Doze mode notification delivery rate (target: >90%)
- WorkManager job success rate (target: >98%)
- Battery drain per hour (target: <3% per hour)

**Network & Connectivity**
- WebSocket reconnection frequency (baseline: <5 per hour)
- API retry rate (baseline: <10% of requests)
- Average reconnection time (target: <5 seconds)
- Captive portal detection rate (track false positives)

**Notifications**
- Notification permission grant rate (target: >70%)
- Notification delivery latency (target: <5 seconds for high-priority)
- Notification channel disabled rate (track per-channel)

**Data Consistency**
- Duplicate order rate (target: 0%)
- Payment success but order not created (target: 0%, critical alert)
- Price mismatch errors (track frequency, indicates stale cache)
- Stock validation failure rate (track item-level)

### Crash Reporting

```kotlin
// Firebase Crashlytics custom keys
FirebaseCrashlytics.getInstance().apply {
    setCustomKey("device_manufacturer", Build.MANUFACTURER)
    setCustomKey("android_version", Build.VERSION.SDK_INT)
    setCustomKey("doze_enabled", powerManager.isDeviceIdleMode)
    setCustomKey("battery_optimization_ignored", powerManager.isIgnoringBatteryOptimizations(packageName))
    setCustomKey("notification_permission_granted", hasNotificationPermission())
    setCustomKey("websocket_state", socketManager.connectionState.value.toString())
}
```

---

## CONCLUSION

Android platform constraints pose significant risks to real-time food ordering app functionality. The most critical risks are:

1. **OEM Background Kill Behaviors** (CRITICAL): Affects 30%+ of users (Xiaomi, Oppo, Vivo). Mitigation requires user education and foreground services.

2. **Payment-Order Consistency** (CRITICAL): Payment captured but order not created. Requires idempotent webhooks, atomic transactions, and client-side polling.

3. **Notification Delivery Guarantees** (CRITICAL): Android 13+ permission model and battery optimizations delay notifications. Requires high-priority FCM and in-app fallbacks.

4. **Network Volatility** (HIGH): College WiFi unreliable. Requires exponential backoff, captive portal detection, and offline queue.

All MVP-priority mitigations MUST be implemented before launch to prevent payment disputes, order failures, and user churn. Post-MVP enhancements can incrementally improve reliability and battery efficiency.

**BACKEND DEPENDENCIES** (must be implemented by backend team):
- Idempotency key validation (order creation, payment webhooks)
- High-priority FCM configuration
- Stock validation API endpoint
- WebSocket reconnection rate limiting
- Atomic payment-order transactions

**Estimated Implementation Effort**:
- MVP Mitigations: 2 weeks (parallel with Phase 4-6 of android-spec/12)
- Testing & Validation: 1 week (physical device testing on OEM devices)
- Post-MVP Enhancements: 4 weeks (iterative improvements)

---

## DOCUMENT END
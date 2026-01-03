# Android Implementation Plan

**Version**: 1.0  
**Last Updated**: 2025-12-31  
**Status**: Executable Build Plan

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Android MVP Scope](#android-mvp-scope)
3. [Native-Only Features](#native-only-features)
4. [Shared Logic Mapping](#shared-logic-mapping)
5. [Web-Only Features (Excluded)](#web-only-features-excluded)
6. [Implementation Sequence](#implementation-sequence)
7. [Blocking Dependencies](#blocking-dependencies)
8. [Technical Risks](#technical-risks)
9. [Non-Negotiable Android Constraints](#non-negotiable-android-constraints)
10. [Build Plan Execution](#build-plan-execution)

---

## Executive Summary

This document provides an **executable build plan** for the Android application based on **23,820+ lines of extracted system documentation**. The plan is data-driven, prioritizes correctness, and defines clear success criteria for each phase.

### Key Metrics

| Metric | Value |
|--------|-------|
| **Total Documentation Analyzed** | 23,820+ lines across 9 specifications |
| **REST API Endpoints** | 87 endpoints across 12 categories |
| **WebSocket Events** | 15 server→client, 4 client→server |
| **Database Models** | 21 models (Prisma + MongoDB) |
| **User Roles** | 7 roles with distinct capabilities |
| **User Flows** | 14 complete flows documented |
| **Android MVP Timeline** | 16-20 weeks (4 phases) |
| **Target Android Version** | API 24+ (Android 7.0+, 87.6% market) |

### Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│                     ANDROID ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐       ┌──────────────┐                    │
│  │   Jetpack    │       │  Kotlin      │                    │
│  │   Compose    │──────▶│  Coroutines  │                    │
│  │   (Native UI)│       │  (Async)     │                    │
│  └──────────────┘       └──────────────┘                    │
│         │                      │                             │
│         ▼                      ▼                             │
│  ┌──────────────────────────────────────┐                   │
│  │      ViewModel + StateFlow/Flow       │                   │
│  │    (State Management - MVVM Pattern)  │                   │
│  └──────────────────────────────────────┘                   │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────┐                   │
│  │         Repository Layer              │                   │
│  │  (Business Logic - from Web Contexts) │                   │
│  └──────────────────────────────────────┘                   │
│         │              │              │                      │
│         ▼              ▼              ▼                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Retrofit│  │  Socket  │  │   Room   │                  │
│  │   (REST) │  │  (WSS)   │  │ (Offline)│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│         │              │              │                      │
│         └──────────────┴──────────────┘                      │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────┐                 │
│  │        Existing Backend APIs            │                 │
│  │  (87 REST endpoints + 19 socket events) │                 │
│  └────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: **Reuse backend logic 100%, rebuild UI natively.**

---

## Android MVP Scope

### Definition of MVP

The Android MVP enables **core order flow** for **guest/student users** with **real-time order tracking**. This represents the **highest business value** with the **lowest implementation risk**.

### In-Scope Features (MVP)

#### 1. Authentication (Week 1-2)
- ✅ Email/password login
- ✅ Google OAuth login
- ✅ Temporary guest access (QR code scan)
- ✅ Profile setup (name, phone, location)
- ✅ Session management (JWT token storage)

**Success Criteria**: User can authenticate via all 3 methods and complete profile setup.

#### 2. Location & Canteen Selection (Week 2-3)
- ✅ GPS location detection
- ✅ Manual location selection (college/organization/restaurant)
- ✅ Canteen list with filters (by location, isActive)
- ✅ Canteen priority-based auto-selection
- ✅ Canteen details (hours, contact, menu preview)

**Success Criteria**: User can select canteen based on location with 100% filter accuracy.

#### 3. Menu Browsing (Week 3-4)
- ✅ Category-based menu display
- ✅ Item details (name, price, image, nutrition, allergies)
- ✅ Search functionality (by name, category)
- ✅ Favorites management (add/remove)
- ✅ Stock availability indicators
- ✅ QuickPick items display

**Success Criteria**: User can browse 1000+ items with smooth scrolling and instant search.

#### 4. Cart Management (Week 4-5)
- ✅ Add to cart with quantity selection
- ✅ Per-canteen cart isolation
- ✅ Cart validation (counter IDs, canteen switch)
- ✅ Item customization (if supported)
- ✅ Cart persistence (local storage)
- ✅ Cart summary (subtotal, tax, total)

**Success Criteria**: Cart operations complete in <100ms with zero data loss on app restart.

#### 5. Checkout & Payment (Week 5-7)
- ✅ Session creation with stock validation
- ✅ Counter selection (store + payment)
- ✅ Delivery option selection (pickup/delivery)
- ✅ Payment method selection (online/cash)
- ✅ Razorpay integration (initiate, verify)
- ✅ Order creation after payment
- ✅ Payment retry on failure

**Success Criteria**: 100% payment accuracy with proper error handling and retry logic.

#### 6. Order Tracking (Week 7-9)
- ✅ Real-time order status updates (WebSocket)
- ✅ Order details display (items, amounts, counters)
- ✅ Status timeline (pending → preparing → ready → completed)
- ✅ Barcode/QR display for pickup
- ✅ Order history (paginated, 10 per page)
- ✅ Order cancellation (within time limit)
- ✅ Reorder functionality

**Success Criteria**: Order updates appear within 2 seconds of status change.

#### 7. Push Notifications (Week 8-9)
- ✅ FCM integration
- ✅ Order status notifications
- ✅ Promotional notifications (opt-in)
- ✅ Notification preferences management

**Success Criteria**: 95%+ notification delivery rate with <5s latency.

#### 8. Offline Support (Week 9-10)
- ✅ Menu caching (last fetched data)
- ✅ Cart persistence
- ✅ Favorites sync
- ✅ Offline-to-online queue for operations
- ✅ Conflict resolution on reconnect

**Success Criteria**: App usable offline for browsing, cart operations complete on reconnect.

### Out-of-Scope (Post-MVP)

❌ Admin dashboard (web-only recommended)  
❌ Canteen owner dashboard (web-only recommended)  
❌ Counter staff interfaces (KOT/POS - dedicated native app)  
❌ Delivery person app (separate native app)  
❌ Analytics/reports (web-only)  
❌ Payment reconciliation (web-only)  
❌ User management (web-only)  
❌ Bidding system (web-only)  
❌ Print agent integration (hardware-specific)

---

## Native-Only Features

These features **must be implemented natively** in Android and **cannot be replicated from the web**.

### 1. Push Notifications (FCM)

**Rationale**: Web uses Web Push API (service workers), Android requires Firebase Cloud Messaging.

```kotlin
// Implementation: FCM Service
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Handle notification data payload
        val notificationType = remoteMessage.data["type"] // "order", "promo"
        val orderId = remoteMessage.data["orderId"]
        
        when (notificationType) {
            "order" -> showOrderNotification(orderId, remoteMessage.data)
            "promo" -> showPromoNotification(remoteMessage.data)
        }
    }
    
    override fun onNewToken(token: String) {
        // Register token with backend
        // POST /api/web-push/subscribe { token, platform: "android" }
    }
}
```

**Backend Integration**:
- **Existing**: `POST /api/web-push/subscribe` (body: `{ subscription }`)
- **Required Change**: Accept `{ token: string, platform: "android" | "web" }`
- **Server Logic**: Route to FCM for Android, Web Push for web

### 2. Camera/QR Code Scanning

**Rationale**: Web uses `jsQR` library with canvas, Android uses CameraX + ML Kit.

```kotlin
// Implementation: CameraX + ML Kit Barcode Scanning
class QRScannerFragment : Fragment() {
    private val barcodeScanner = BarcodeScanning.getClient()
    
    @OptIn(ExperimentalGetImage::class)
    private val imageAnalyzer = ImageAnalysis.Analyzer { imageProxy ->
        val mediaImage = imageProxy.image ?: return@Analyzer
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        
        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                barcodes.firstOrNull()?.let { barcode ->
                    val qrData = barcode.rawValue // "ORDER:<orderId>" or "TABLE:<tableId>"
                    handleQRCode(qrData)
                }
            }
            .addOnCompleteListener { imageProxy.close() }
    }
}
```

**Use Cases**:
- Scan order barcode for pickup verification
- Scan table QR code for temp user session (`GET /api/temp-user-sessions/by-table/:tableId`)

### 3. GPS Location Services

**Rationale**: Web uses browser geolocation API, Android uses FusedLocationProviderClient.

```kotlin
// Implementation: Fused Location Provider
class LocationRepository(private val context: Context) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    
    suspend fun getCurrentLocation(): Location? = suspendCoroutine { continuation ->
        if (checkLocationPermission()) {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                continuation.resume(location)
            }
        } else {
            continuation.resume(null)
        }
    }
    
    fun checkLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }
}
```

**Backend Integration**: Use location for filtering canteens (`GET /api/system-settings/canteens?lat=&lng=`)

### 4. Offline Storage (Room Database)

**Rationale**: Web uses IndexedDB, Android uses Room for type-safe SQL.

```kotlin
@Database(
    entities = [
        MenuItem::class,
        Category::class,
        Canteen::class,
        Order::class,
        CartItem::class,
        Favorite::class
    ],
    version = 1
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun menuDao(): MenuDao
    abstract fun orderDao(): OrderDao
    abstract fun cartDao(): CartDao
    abstract fun favoriteDao(): FavoriteDao
}

// Sync strategy: Cache-first with periodic refresh
class MenuRepository(
    private val api: ApiService,
    private val db: AppDatabase
) {
    suspend fun getMenuItems(canteenId: String): List<MenuItem> {
        // Try local cache first
        val cachedItems = db.menuDao().getByCanteen(canteenId)
        if (cachedItems.isNotEmpty() && !isCacheStale(canteenId)) {
            return cachedItems
        }
        
        // Fetch from API
        return try {
            val items = api.getMenuItems(canteenId)
            db.menuDao().insertAll(items) // Update cache
            items
        } catch (e: Exception) {
            cachedItems // Fallback to stale cache
        }
    }
}
```

### 5. Background Sync (WorkManager)

**Rationale**: Web uses service workers, Android uses WorkManager for deferrable tasks.

```kotlin
// Implementation: Periodic sync for offline operations
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repository = OfflineQueueRepository(applicationContext)
        
        // Process pending cart operations
        repository.getPendingCartOperations().forEach { operation ->
            try {
                when (operation.type) {
                    "ADD" -> api.addToCart(operation.data)
                    "REMOVE" -> api.removeFromCart(operation.data)
                }
                repository.markCompleted(operation.id)
            } catch (e: Exception) {
                Log.e("SyncWorker", "Failed to sync: ${e.message}")
            }
        }
        
        return Result.success()
    }
}

// Schedule periodic sync
val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build())
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "offline-sync",
    ExistingPeriodicWorkPolicy.KEEP,
    syncRequest
)
```

### 6. Deep Linking

**Rationale**: Web uses URL routing, Android uses deep links for external navigation.

```kotlin
// AndroidManifest.xml
<activity android:name=".MainActivity">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Order tracking: sillobite://order/ORDER123 -->
        <data android:scheme="sillobite" android:host="order" />
        
        <!-- Menu deep link: https://sillobite.com/menu/canteen123 -->
        <data android:scheme="https" android:host="sillobite.com" android:pathPrefix="/menu" />
    </intent-filter>
</activity>

// Handle deep link in Activity
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        intent?.data?.let { uri ->
            when (uri.host) {
                "order" -> navigateToOrderTracking(uri.lastPathSegment)
                "menu" -> navigateToMenu(uri.lastPathSegment)
            }
        }
    }
}
```

### 7. Biometric Authentication

**Rationale**: Native Android BiometricPrompt API for fingerprint/face unlock.

```kotlin
class BiometricAuthHelper(private val activity: FragmentActivity) {
    private val executor = ContextCompat.getMainExecutor(activity)
    private val biometricPrompt = BiometricPrompt(activity, executor,
        object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                // Retrieve stored credentials and auto-login
                val encryptedCreds = getEncryptedCredentials()
                loginWithStoredCredentials(encryptedCreds)
            }
        }
    )
    
    fun authenticate() {
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Authentication")
            .setSubtitle("Log in using your fingerprint")
            .setNegativeButtonText("Use password")
            .build()
        
        biometricPrompt.authenticate(promptInfo)
    }
}
```

---

## Shared Logic Mapping

This section maps **web business logic to Android implementations**. The backend APIs remain unchanged; only the client-side implementation differs.

### 1. Authentication Logic

**Web Implementation** (React Context):
- File: `client/src/contexts/AuthContext.tsx` (implicit from user flows)
- State: `{ user, isAuthenticated, isLoading }`
- Actions: `login()`, `logout()`, `register()`, `checkSession()`

**Android Mapping**:
```kotlin
// ViewModel
class AuthViewModel(private val authRepository: AuthRepository) : ViewModel() {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Initial)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()
    
    fun login(email: String, password: String) = viewModelScope.launch {
        _authState.value = AuthState.Loading
        val result = authRepository.login(email, password)
        _authState.value = when {
            result.isSuccess -> AuthState.Authenticated(result.getOrNull()!!)
            else -> AuthState.Error(result.exceptionOrNull()?.message ?: "Login failed")
        }
    }
}

// Repository (API calls)
class AuthRepository(private val api: ApiService) {
    suspend fun login(email: String, password: String): Result<User> {
        return try {
            // POST /api/auth/login
            val response = api.login(LoginRequest(email, password))
            // Store JWT in encrypted SharedPreferences
            securePrefs.edit().putString("jwt_token", response.token).apply()
            Result.success(response.user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

**Shared Logic**:
- ✅ JWT token storage (web: `localStorage`, Android: `EncryptedSharedPreferences`)
- ✅ Session validation (web: check token expiry, Android: same)
- ✅ Auto-login (web: on page load, Android: on app launch)
- ✅ Google OAuth (web: popup, Android: Google Sign-In SDK)

### 2. Cart Management Logic

**Web Implementation** (React Context):
- File: `client/src/contexts/CartContext.tsx` (432 lines)
- State: `{ cart: CartItem[], currentCanteenId: string }`
- Actions: `addToCart()`, `removeFromCart()`, `updateQuantity()`, `clearCart()`, `validateCartCanteen()`

**Android Mapping**:
```kotlin
// ViewModel
class CartViewModel(
    private val cartRepository: CartRepository,
    private val canteenRepository: CanteenRepository
) : ViewModel() {
    private val _cart = MutableStateFlow<List<CartItem>>(emptyList())
    val cart: StateFlow<List<CartItem>> = _cart.asStateFlow()
    
    private val _currentCanteenId = MutableStateFlow<String?>(null)
    val currentCanteenId: StateFlow<String?> = _currentCanteenId.asStateFlow()
    
    fun addToCart(item: MenuItem, quantity: Int = 1) = viewModelScope.launch {
        // Validation: Counter IDs required (from web CartContext.tsx line 156)
        if (item.storeCounterId.isNullOrEmpty() || item.paymentCounterId.isNullOrEmpty()) {
            _cartError.value = "Counter IDs are required"
            return@launch
        }
        
        // Validation: Canteen switch (from web CartContext.tsx line 121-137)
        if (_currentCanteenId.value != null && _currentCanteenId.value != item.canteenId) {
            _cartConflict.value = CartConflict(
                message = "Your cart contains items from a different canteen. Clear cart?",
                onConfirm = { clearCartAndAdd(item, quantity) }
            )
            return@launch
        }
        
        // Add to cart
        val updatedCart = _cart.value.toMutableList()
        val existingItem = updatedCart.find { it.id == item.id }
        if (existingItem != null) {
            existingItem.quantity += quantity
        } else {
            updatedCart.add(CartItem(item, quantity))
        }
        
        _cart.value = updatedCart
        _currentCanteenId.value = item.canteenId
        
        // Persist to local storage
        cartRepository.saveCart(updatedCart, item.canteenId)
        
        // Cross-device sync (emit custom event equivalent)
        // In Android: Use WorkManager to sync with server
    }
}

// Repository (local persistence)
class CartRepository(private val db: AppDatabase, private val prefs: SharedPreferences) {
    fun saveCart(cart: List<CartItem>, canteenId: String) {
        // Per-canteen isolation (from web CartContext.tsx line 30)
        val key = "cart_$canteenId"
        val json = Gson().toJson(cart)
        prefs.edit().putString(key, json).apply()
        
        // Also save to Room for offline access
        db.cartDao().insertAll(cart.map { it.toEntity(canteenId) })
    }
    
    fun loadCart(canteenId: String): List<CartItem> {
        val key = "cart_$canteenId"
        val json = prefs.getString(key, null) ?: return emptyList()
        return Gson().fromJson(json, Array<CartItem>::class.java).toList()
    }
}
```

**Shared Logic**:
- ✅ Per-canteen cart isolation (web: `localStorage` key per canteen, Android: same)
- ✅ Counter ID validation (web: line 156, Android: same check)
- ✅ Canteen switch validation (web: line 121-137, Android: same flow)
- ✅ Cart persistence (web: `useEffect` on cart change, Android: on each mutation)

### 3. Canteen Selection Logic

**Web Implementation** (React Context):
- File: `client/src/contexts/CanteenContext.tsx` (348 lines)
- State: `{ canteens, selectedCanteen, selectedLocationType }`
- Actions: `selectCanteen()`, `setLocationType()`, `refreshCanteens()`

**Android Mapping**:
```kotlin
// ViewModel
class CanteenViewModel(
    private val canteenRepository: CanteenRepository,
    private val locationRepository: LocationRepository
) : ViewModel() {
    private val _canteens = MutableStateFlow<List<Canteen>>(emptyList())
    val canteens: StateFlow<List<Canteen>> = _canteens.asStateFlow()
    
    private val _selectedCanteen = MutableStateFlow<Canteen?>(null)
    val selectedCanteen: StateFlow<Canteen?> = _selectedCanteen.asStateFlow()
    
    private val _selectedLocationType = MutableStateFlow<LocationType?>(null)
    val selectedLocationType: StateFlow<LocationType?> = _selectedLocationType.asStateFlow()
    
    init {
        loadCanteens()
    }
    
    fun loadCanteens() = viewModelScope.launch {
        _isLoading.value = true
        
        // Get location filters (from web CanteenContext.tsx line 61-76)
        val locationType = _selectedLocationType.value
        val params = when (locationType) {
            LocationType.COLLEGE -> mapOf("institutionType" to "college")
            LocationType.ORGANIZATION -> mapOf("institutionType" to "organization")
            LocationType.RESTAURANT -> mapOf("institutionType" to "restaurant")
            null -> emptyMap()
        }
        
        val result = canteenRepository.getCanteens(params)
        result.onSuccess { canteenList ->
            // Priority sorting (from web CanteenContext.tsx line 85-94)
            val sorted = canteenList.sortedWith(compareBy<Canteen> { it.priority ?: 0 }
                .thenBy { it.name })
            
            _canteens.value = sorted
            
            // Auto-select highest priority (from web CanteenContext.tsx line 106-118)
            if (_selectedCanteen.value == null || 
                !sorted.any { it.id == _selectedCanteen.value?.id && it.isActive }) {
                _selectedCanteen.value = sorted.firstOrNull { it.isActive } ?: sorted.firstOrNull()
            }
        }
        
        _isLoading.value = false
    }
    
    fun selectCanteen(canteen: Canteen) {
        _selectedCanteen.value = canteen
        // Mark as manual selection to prevent auto-override
        hasManuallySelected = true
    }
}
```

**Shared Logic**:
- ✅ Location-based filtering (web: `institutionType` query param, Android: same)
- ✅ Priority-based sorting (web: line 85-94, Android: same)
- ✅ Auto-selection (web: line 106-118, Android: same logic)
- ✅ Manual selection tracking (web: `hasManuallySelected` ref, Android: boolean flag)

### 4. Order Tracking Logic

**Web Implementation** (React Query + WebSocket):
- File: `client/src/hooks/usePaginatedOrders.ts` (76 lines)
- State: `{ data: orders, isLoading, hasNextPage, fetchNextPage }`
- Socket: Listen to `orderUpdate` events (types: `new_order`, `order_status_changed`, etc.)

**Android Mapping**:
```kotlin
// ViewModel
class OrderViewModel(
    private val orderRepository: OrderRepository,
    private val socketService: SocketService
) : ViewModel() {
    private val _orders = MutableStateFlow<PagingData<Order>>(PagingData.empty())
    val orders: StateFlow<PagingData<Order>> = _orders.asStateFlow()
    
    init {
        loadOrders()
        observeOrderUpdates()
    }
    
    fun loadOrders() = viewModelScope.launch {
        // Pagination with Paging 3 library
        Pager(
            config = PagingConfig(pageSize = 10, enablePlaceholders = false),
            pagingSourceFactory = { OrderPagingSource(orderRepository) }
        ).flow.cachedIn(viewModelScope)
            .collectLatest { _orders.value = it }
    }
    
    private fun observeOrderUpdates() = viewModelScope.launch {
        socketService.orderUpdates.collect { event ->
            when (event.type) {
                "new_order" -> refreshOrders()
                "order_status_changed" -> updateOrderStatus(event.orderId, event.status)
                "item_status_changed" -> updateItemStatus(event.orderId, event.itemId, event.status)
            }
        }
    }
}

// WebSocket Service
class SocketService(private val baseUrl: String) {
    private val socket = IO.socket(baseUrl)
    private val _orderUpdates = MutableSharedFlow<OrderUpdateEvent>()
    val orderUpdates: SharedFlow<OrderUpdateEvent> = _orderUpdates.asSharedFlow()
    
    init {
        socket.on("orderUpdate") { args ->
            val json = args[0] as JSONObject
            val event = Gson().fromJson(json.toString(), OrderUpdateEvent::class.java)
            viewModelScope.launch { _orderUpdates.emit(event) }
        }
        socket.connect()
    }
    
    fun joinCanteenRoom(canteenId: String) {
        socket.emit("joinCanteenRooms", JSONObject().put("canteenIds", JSONArray().put(canteenId)))
    }
}
```

**Shared Logic**:
- ✅ Pagination (web: `useInfiniteQuery` with `hasNextPage`, Android: Paging 3)
- ✅ Real-time updates (web: Socket.IO events, Android: Socket.IO Android client)
- ✅ Status update handling (web: update React Query cache, Android: update Room + StateFlow)

### 5. Payment Logic

**Web Implementation**:
- Files: `client/src/components/payment/*` (8 components)
- Flow: Create session → Load Razorpay script → Open checkout → Verify payment

**Android Mapping**:
```kotlin
// ViewModel
class PaymentViewModel(
    private val paymentRepository: PaymentRepository,
    private val checkoutRepository: CheckoutRepository
) : ViewModel() {
    private val _paymentState = MutableStateFlow<PaymentState>(PaymentState.Initial)
    val paymentState: StateFlow<PaymentState> = _paymentState.asStateFlow()
    
    fun initiatePayment(cartItems: List<CartItem>, deliveryOption: String) = viewModelScope.launch {
        _paymentState.value = PaymentState.Creating
        
        // Step 1: Create checkout session (POST /api/checkout/sessions)
        val sessionResult = checkoutRepository.createSession(
            CheckoutSessionRequest(
                cartItems = cartItems.map { it.toApiModel() },
                paymentCounterId = cartItems.first().paymentCounterId,
                storeCounterId = cartItems.first().storeCounterId,
                deliveryOption = deliveryOption
            )
        )
        
        sessionResult.onSuccess { session ->
            // Step 2: Create payment order (POST /api/payments/orders)
            val orderResult = paymentRepository.createPaymentOrder(
                PaymentOrderRequest(
                    amount = session.total,
                    currency = "INR",
                    sessionId = session.id
                )
            )
            
            orderResult.onSuccess { paymentOrder ->
                _paymentState.value = PaymentState.ReadyToCheckout(paymentOrder)
            }.onFailure { error ->
                _paymentState.value = PaymentState.Error(error.message ?: "Payment creation failed")
            }
        }
    }
    
    fun openRazorpayCheckout(activity: Activity, paymentOrder: PaymentOrder) {
        val checkout = Checkout()
        checkout.setKeyID(BuildConfig.RAZORPAY_KEY_ID)
        
        val options = JSONObject()
        options.put("order_id", paymentOrder.razorpayOrderId)
        options.put("amount", paymentOrder.amount * 100) // Convert to paise
        options.put("currency", "INR")
        options.put("name", "Sillobite")
        options.put("description", "Order Payment")
        
        checkout.open(activity, options)
    }
    
    fun verifyPayment(razorpayPaymentId: String, razorpayOrderId: String, razorpaySignature: String) = viewModelScope.launch {
        _paymentState.value = PaymentState.Verifying
        
        // POST /api/payments/verify
        val result = paymentRepository.verifyPayment(
            PaymentVerificationRequest(
                razorpayPaymentId = razorpayPaymentId,
                razorpayOrderId = razorpayOrderId,
                razorpaySignature = razorpaySignature
            )
        )
        
        result.onSuccess { verification ->
            if (verification.success) {
                _paymentState.value = PaymentState.Success(verification.order)
            } else {
                _paymentState.value = PaymentState.Error("Payment verification failed")
            }
        }
    }
}

// Activity (Razorpay callback)
class CheckoutActivity : AppCompatActivity(), PaymentResultListener {
    override fun onPaymentSuccess(razorpayPaymentId: String) {
        // Extract order ID and signature from Razorpay response
        viewModel.verifyPayment(razorpayPaymentId, razorpayOrderId, razorpaySignature)
    }
    
    override fun onPaymentError(code: Int, response: String) {
        viewModel.handlePaymentError(code, response)
    }
}
```

**Shared Logic**:
- ✅ Session creation with stock validation (web + Android: same API)
- ✅ Payment order creation (web + Android: same API)
- ✅ Razorpay integration (web: checkout.js, Android: Razorpay Android SDK)
- ✅ Payment verification (web + Android: same API)
- ✅ Retry on failure (web + Android: same retry logic)

### 6. React Query Cache → Android Room

**Web Implementation** (React Query):
- File: `client/src/lib/queryClient.ts` (133 lines)
- Config: `staleTime: 5min`, `gcTime: 10min`, `retry: 1`, `refetchOnWindowFocus: false`
- Invalidation: `queryClient.invalidateQueries()` after mutations

**Android Mapping**:
```kotlin
// Repository pattern with Room + API
class MenuRepository(
    private val api: ApiService,
    private val db: AppDatabase,
    private val socketService: SocketService
) {
    // Cache-first strategy
    fun getMenuItems(canteenId: String): Flow<List<MenuItem>> = flow {
        // 1. Emit cached data immediately
        val cached = db.menuDao().getByCanteen(canteenId)
        if (cached.isNotEmpty()) {
            emit(cached)
        }
        
        // 2. Check if cache is stale (5 minutes = React Query staleTime)
        val lastFetch = prefs.getLong("menu_last_fetch_$canteenId", 0)
        val isStale = System.currentTimeMillis() - lastFetch > 5 * 60 * 1000
        
        // 3. Fetch from API if stale or no cache
        if (isStale || cached.isEmpty()) {
            try {
                val fresh = api.getMenuItems(canteenId)
                db.menuDao().insertAll(fresh) // Update cache
                prefs.edit().putLong("menu_last_fetch_$canteenId", System.currentTimeMillis()).apply()
                emit(fresh)
            } catch (e: Exception) {
                // Fallback to cached data on error
                if (cached.isEmpty()) throw e
            }
        }
    }.flowOn(Dispatchers.IO)
    
    // WebSocket invalidation (equivalent to React Query invalidateQueries)
    init {
        viewModelScope.launch {
            socketService.menuUpdates.collect { event ->
                when (event.type) {
                    "menu_updated" -> {
                        // Invalidate cache for specific canteen
                        db.menuDao().deleteByCanteen(event.canteenId)
                        prefs.edit().remove("menu_last_fetch_${event.canteenId}").apply()
                    }
                }
            }
        }
    }
}
```

**Shared Patterns**:
- ✅ Stale-while-revalidate (web: React Query, Android: Room + timestamp)
- ✅ Cache invalidation (web: `invalidateQueries`, Android: delete Room data)
- ✅ Retry logic (web: `retry: 1`, Android: exponential backoff)
- ✅ WebSocket-driven updates (web: invalidate on socket event, Android: same)

---

## Web-Only Features (Excluded)

These features are **explicitly excluded** from the Android MVP due to **low mobile usage** or **hardware/platform constraints**.

### 1. Admin Dashboard ❌

**Rationale**: Admin operations (user management, canteen approval, system settings) are **desktop-intensive** and represent <5% of mobile traffic.

**Excluded Features**:
- User management (create, edit, delete users)
- Canteen approval workflow
- Menu management (bulk operations)
- Analytics reports (complex charts)
- Payment reconciliation

**Recommendation**: Keep as **web-only**. Admin users prefer desktop for productivity.

### 2. Canteen Owner Dashboard ❌

**Rationale**: Owner operations (analytics, order processing, staff management) require **large screen real estate** and **keyboard input**.

**Excluded Features**:
- Revenue analytics (charts, reports)
- Staff management (create, assign roles)
- Menu bulk import (XML/CSV upload)
- Counter configuration (complex forms)
- Payout management

**Recommendation**: Keep as **web-only** or create **separate native app** for owners (post-MVP).

### 3. Counter Staff Interfaces (KOT/POS) ❌

**Rationale**: Counter staff use **dedicated hardware** (tablets, POS terminals) with **fixed installations**. Mobile phones are unsuitable.

**Excluded Features**:
- KOT (Kitchen Order Ticket) view
- Store counter operations
- Payment counter operations
- Print agent integration

**Recommendation**: Create **separate Android app** for tablets (post-MVP) with offline-first architecture.

### 4. Delivery Person App ❌

**Rationale**: Delivery logistics require **separate product** with different flows (GPS tracking, route optimization, proof of delivery).

**Excluded Features**:
- Delivery assignment
- Route navigation
- Proof of delivery (signature/photo)
- Earnings dashboard

**Recommendation**: Create **separate Android app** (post-MVP) with integration to existing backend APIs.

### 5. Print Agent Integration ❌

**Rationale**: Print agent requires **local network hardware** (thermal printers) and **desktop OS** (Windows/Mac).

**Excluded Features**:
- Print agent registration
- Print job queue management
- Printer status monitoring

**Recommendation**: Keep as **desktop-only** (Electron app).

### 6. Bidding System ❌

**Rationale**: Bidding is **web-specific feature** for canteen position priority. Not applicable to mobile users.

**Excluded Features**:
- Create/manage bids
- Bid approval workflow
- Bidding analytics

**Recommendation**: Keep as **web-only**.

### 7. Web Push Notifications ❌

**Rationale**: Android uses **FCM (Firebase Cloud Messaging)** instead of Web Push API.

**Excluded Features**:
- Service worker registration
- Web Push subscription
- `pushManager.subscribe()`

**Replacement**: Native FCM implementation (see [Native-Only Features](#native-only-features)).

---

## Implementation Sequence

This section defines the **ordered implementation sequence** with clear **phase gates** and **success criteria**.

### Phase 0: Project Setup (Week 0-1)

**Goal**: Establish Android project structure with all dependencies and tooling.

#### Tasks
1. **Create Android Studio project**
   - Minimum SDK: API 24 (Android 7.0, 87.6% market coverage)
   - Target SDK: API 34 (Android 14)
   - Language: Kotlin
   - Build system: Gradle with Kotlin DSL

2. **Add core dependencies**
   ```gradle
   // build.gradle.kts (app)
   dependencies {
       // Jetpack Compose (UI)
       implementation("androidx.compose.ui:ui:1.5.4")
       implementation("androidx.compose.material3:material3:1.1.2")
       implementation("androidx.compose.ui:ui-tooling-preview:1.5.4")
       
       // Navigation
       implementation("androidx.navigation:navigation-compose:2.7.5")
       
       // ViewModel + Lifecycle
       implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
       implementation("androidx.lifecycle:lifecycle-runtime-compose:2.6.2")
       
       // Coroutines
       implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
       
       // Networking
       implementation("com.squareup.retrofit2:retrofit:2.9.0")
       implementation("com.squareup.retrofit2:converter-gson:2.9.0")
       implementation("com.squareup.okhttp3:logging-interceptor:4.11.0")
       
       // WebSocket
       implementation("io.socket:socket.io-client:2.1.0")
       
       // Room (offline storage)
       implementation("androidx.room:room-runtime:2.6.0")
       implementation("androidx.room:room-ktx:2.6.0")
       kapt("androidx.room:room-compiler:2.6.0")
       
       // Paging 3
       implementation("androidx.paging:paging-runtime:3.2.1")
       implementation("androidx.paging:paging-compose:3.2.1")
       
       // Image loading
       implementation("io.coil-kt:coil-compose:2.5.0")
       
       // Dependency injection
       implementation("io.insert-koin:koin-android:3.5.0")
       implementation("io.insert-koin:koin-androidx-compose:3.5.0")
       
       // Security (encrypted storage)
       implementation("androidx.security:security-crypto:1.1.0-alpha06")
       
       // Firebase (notifications)
       implementation("com.google.firebase:firebase-messaging:23.3.1")
       implementation("com.google.firebase:firebase-analytics:21.5.0")
       
       // Razorpay (payments)
       implementation("com.razorpay:checkout:1.6.33")
       
       // Google Sign-In
       implementation("com.google.android.gms:play-services-auth:20.7.0")
       
       // Camera (QR scanning)
       implementation("androidx.camera:camera-camera2:1.3.0")
       implementation("androidx.camera:camera-lifecycle:1.3.0")
       implementation("androidx.camera:camera-view:1.3.0")
       implementation("com.google.mlkit:barcode-scanning:17.2.0")
       
       // Location
       implementation("com.google.android.gms:play-services-location:21.0.1")
       
       // WorkManager (background sync)
       implementation("androidx.work:work-runtime-ktx:2.9.0")
   }
   ```

3. **Configure build variants**
   ```gradle
   android {
       buildTypes {
           debug {
               applicationIdSuffix = ".debug"
               buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5000\"") // Emulator
               buildConfigField("String", "RAZORPAY_KEY_ID", "\"rzp_test_xxx\"")
           }
           release {
               buildConfigField("String", "API_BASE_URL", "\"https://api.sillobite.com\"")
               buildConfigField("String", "RAZORPAY_KEY_ID", "\"rzp_live_xxx\"")
               minifyEnabled = true
               proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
           }
       }
   }
   ```

4. **Set up CI/CD (optional but recommended)**
   - GitHub Actions for build automation
   - Automated APK generation on PR
   - Firebase App Distribution for QA builds

**Success Criteria**:
- ✅ Project compiles without errors
- ✅ All dependencies resolve correctly
- ✅ Blank Compose screen displays on emulator

---

### Phase 1: Core Infrastructure (Week 1-3)

**Goal**: Implement foundational networking, storage, and state management layers.

#### 1.1 Networking Layer (Week 1)

**Tasks**:
1. **Create Retrofit API service**
   ```kotlin
   interface ApiService {
       // Authentication
       @POST("/api/auth/login")
       suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
       
       @POST("/api/auth/register")
       suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>
       
       @GET("/api/auth/session")
       suspend fun getSession(@Header("Authorization") token: String): Response<User>
       
       // Canteens
       @GET("/api/system-settings/canteens")
       suspend fun getCanteens(@QueryMap filters: Map<String, String>): Response<List<Canteen>>
       
       @GET("/api/canteens/{id}")
       suspend fun getCanteenById(@Path("id") id: String): Response<Canteen>
       
       // Menu
       @GET("/api/menu")
       suspend fun getMenuItems(@Query("canteenId") canteenId: String): Response<List<MenuItem>>
       
       @GET("/api/categories")
       suspend fun getCategories(@Query("canteenId") canteenId: String): Response<List<Category>>
       
       // Orders
       @POST("/api/orders")
       suspend fun createOrder(@Body request: CreateOrderRequest): Response<Order>
       
       @GET("/api/orders/paginated")
       suspend fun getOrders(
           @Query("canteenId") canteenId: String,
           @Query("page") page: Int,
           @Query("limit") limit: Int
       ): Response<PaginatedOrdersResponse>
       
       // Payments
       @POST("/api/payments/orders")
       suspend fun createPaymentOrder(@Body request: PaymentOrderRequest): Response<PaymentOrder>
       
       @POST("/api/payments/verify")
       suspend fun verifyPayment(@Body request: PaymentVerificationRequest): Response<PaymentVerification>
       
       // Checkout
       @POST("/api/checkout/sessions")
       suspend fun createCheckoutSession(@Body request: CheckoutSessionRequest): Response<CheckoutSession>
   }
   ```

2. **Create Retrofit instance with interceptors**
   ```kotlin
   object NetworkModule {
       private val loggingInterceptor = HttpLoggingInterceptor().apply {
           level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
       }
       
       private val authInterceptor = Interceptor { chain ->
           val token = getStoredToken() // From encrypted SharedPreferences
           val request = if (token != null) {
               chain.request().newBuilder()
                   .header("Authorization", "Bearer $token")
                   .build()
           } else {
               chain.request()
           }
           chain.proceed(request)
       }
       
       private val okHttpClient = OkHttpClient.Builder()
           .addInterceptor(loggingInterceptor)
           .addInterceptor(authInterceptor)
           .connectTimeout(30, TimeUnit.SECONDS)
           .readTimeout(30, TimeUnit.SECONDS)
           .writeTimeout(30, TimeUnit.SECONDS)
           .build()
       
       val retrofit: Retrofit = Retrofit.Builder()
           .baseUrl(BuildConfig.API_BASE_URL)
           .client(okHttpClient)
           .addConverterFactory(GsonConverterFactory.create())
           .build()
       
       val apiService: ApiService = retrofit.create(ApiService::class.java)
   }
   ```

3. **Create WebSocket service**
   ```kotlin
   class SocketService {
       private val socket: Socket = IO.socket(BuildConfig.API_BASE_URL)
       
       private val _connectionState = MutableStateFlow(SocketState.DISCONNECTED)
       val connectionState: StateFlow<SocketState> = _connectionState.asStateFlow()
       
       private val _orderUpdates = MutableSharedFlow<OrderUpdateEvent>()
       val orderUpdates: SharedFlow<OrderUpdateEvent> = _orderUpdates.asSharedFlow()
       
       init {
           socket.on(Socket.EVENT_CONNECT) {
               _connectionState.value = SocketState.CONNECTED
           }
           
           socket.on(Socket.EVENT_DISCONNECT) {
               _connectionState.value = SocketState.DISCONNECTED
           }
           
           socket.on("orderUpdate") { args ->
               val json = args[0] as JSONObject
               val event = Gson().fromJson(json.toString(), OrderUpdateEvent::class.java)
               viewModelScope.launch { _orderUpdates.emit(event) }
           }
       }
       
       fun connect() {
           if (!socket.connected()) {
               socket.connect()
           }
       }
       
       fun disconnect() {
           socket.disconnect()
       }
       
       fun joinCanteenRoom(canteenId: String) {
           socket.emit("joinCanteenRooms", JSONObject().put("canteenIds", JSONArray().put(canteenId)))
       }
   }
   ```

**Success Criteria**:
- ✅ Successful API call to `/api/auth/login` from Android
- ✅ JWT token attached to subsequent requests
- ✅ WebSocket connects and receives test event
- ✅ Network errors handled gracefully

#### 1.2 Local Storage Layer (Week 2)

**Tasks**:
1. **Create Room database**
   ```kotlin
   @Database(
       entities = [
           UserEntity::class,
           CanteenEntity::class,
           MenuItemEntity::class,
           CategoryEntity::class,
           CartItemEntity::class,
           OrderEntity::class,
           FavoriteEntity::class
       ],
       version = 1,
       exportSchema = false
   )
   abstract class AppDatabase : RoomDatabase() {
       abstract fun userDao(): UserDao
       abstract fun canteenDao(): CanteenDao
       abstract fun menuDao(): MenuDao
       abstract fun cartDao(): CartDao
       abstract fun orderDao(): OrderDao
       abstract fun favoriteDao(): FavoriteDao
       
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

2. **Create DAOs for all entities**
   ```kotlin
   @Dao
   interface MenuDao {
       @Query("SELECT * FROM menu_items WHERE canteenId = :canteenId")
       fun getByCanteen(canteenId: String): List<MenuItemEntity>
       
       @Insert(onConflict = OnConflictStrategy.REPLACE)
       suspend fun insertAll(items: List<MenuItemEntity>)
       
       @Query("DELETE FROM menu_items WHERE canteenId = :canteenId")
       suspend fun deleteByCanteen(canteenId: String)
       
       @Query("SELECT * FROM menu_items WHERE name LIKE '%' || :query || '%'")
       fun search(query: String): Flow<List<MenuItemEntity>>
   }
   ```

3. **Create encrypted SharedPreferences**
   ```kotlin
   object SecurePrefs {
       private lateinit var prefs: SharedPreferences
       
       fun init(context: Context) {
           val masterKey = MasterKey.Builder(context)
               .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
               .build()
           
           prefs = EncryptedSharedPreferences.create(
               context,
               "secure_prefs",
               masterKey,
               EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
               EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
           )
       }
       
       fun saveToken(token: String) {
           prefs.edit().putString("jwt_token", token).apply()
       }
       
       fun getToken(): String? {
           return prefs.getString("jwt_token", null)
       }
       
       fun clearToken() {
           prefs.edit().remove("jwt_token").apply()
       }
   }
   ```

**Success Criteria**:
- ✅ Room database created successfully
- ✅ Data persists across app restarts
- ✅ Encrypted SharedPreferences stores JWT securely
- ✅ DAO queries return correct data

#### 1.3 Repository Pattern (Week 3)

**Tasks**:
1. **Create repositories for all domains**
   ```kotlin
   class AuthRepository(
       private val api: ApiService,
       private val db: AppDatabase,
       private val prefs: SecurePrefs
   ) {
       suspend fun login(email: String, password: String): Result<User> {
           return try {
               val response = api.login(LoginRequest(email, password))
               if (response.isSuccessful && response.body() != null) {
                   val loginResponse = response.body()!!
                   prefs.saveToken(loginResponse.token)
                   db.userDao().insert(loginResponse.user.toEntity())
                   Result.success(loginResponse.user)
               } else {
                   Result.failure(ApiException(response.code(), response.message()))
               }
           } catch (e: Exception) {
               Result.failure(e)
           }
       }
       
       suspend fun getSession(): Result<User> {
           val token = prefs.getToken() ?: return Result.failure(Exception("No token"))
           return try {
               val response = api.getSession("Bearer $token")
               if (response.isSuccessful && response.body() != null) {
                   val user = response.body()!!
                   db.userDao().insert(user.toEntity())
                   Result.success(user)
               } else {
                   Result.failure(ApiException(response.code(), response.message()))
               }
           } catch (e: Exception) {
               Result.failure(e)
           }
       }
   }
   ```

2. **Implement cache-first strategies**
   ```kotlin
   class MenuRepository(
       private val api: ApiService,
       private val db: AppDatabase,
       private val prefs: SharedPreferences
   ) {
       fun getMenuItems(canteenId: String): Flow<Resource<List<MenuItem>>> = flow {
           // 1. Emit loading state
           emit(Resource.Loading())
           
           // 2. Emit cached data immediately
           val cached = db.menuDao().getByCanteen(canteenId)
           if (cached.isNotEmpty()) {
               emit(Resource.Success(cached.map { it.toDomain() }))
           }
           
           // 3. Check if cache is stale
           val lastFetch = prefs.getLong("menu_last_fetch_$canteenId", 0)
           val isStale = System.currentTimeMillis() - lastFetch > 5 * 60 * 1000 // 5 min
           
           // 4. Fetch from API if stale or no cache
           if (isStale || cached.isEmpty()) {
               try {
                   val response = api.getMenuItems(canteenId)
                   if (response.isSuccessful && response.body() != null) {
                       val items = response.body()!!
                       db.menuDao().insertAll(items.map { it.toEntity() })
                       prefs.edit().putLong("menu_last_fetch_$canteenId", System.currentTimeMillis()).apply()
                       emit(Resource.Success(items))
                   } else {
                       emit(Resource.Error(response.message()))
                   }
               } catch (e: Exception) {
                   emit(Resource.Error(e.message ?: "Unknown error"))
               }
           }
       }.flowOn(Dispatchers.IO)
   }
   ```

**Success Criteria**:
- ✅ All repositories implement consistent error handling
- ✅ Cache-first strategy works for menu/canteen data
- ✅ Network failures fallback to cached data gracefully

---

### Phase 2: Authentication & Core UI (Week 3-5)

**Goal**: Implement authentication flows and navigation structure.

#### 2.1 Authentication Screens (Week 3-4)

**Tasks**:
1. **Create login screen**
   ```kotlin
   @Composable
   fun LoginScreen(
       onLoginSuccess: () -> Unit,
       onNavigateToRegister: () -> Unit,
       viewModel: AuthViewModel = koinViewModel()
   ) {
       val authState by viewModel.authState.collectAsState()
       
       Column(modifier = Modifier.padding(16.dp)) {
           OutlinedTextField(
               value = email,
               onValueChange = { email = it },
               label = { Text("Email") },
               keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
           )
           
           OutlinedTextField(
               value = password,
               onValueChange = { password = it },
               label = { Text("Password") },
               visualTransformation = PasswordVisualTransformation(),
               keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
           )
           
           Button(
               onClick = { viewModel.login(email, password) },
               modifier = Modifier.fillMaxWidth(),
               enabled = authState !is AuthState.Loading
           ) {
               if (authState is AuthState.Loading) {
                   CircularProgressIndicator(modifier = Modifier.size(24.dp))
               } else {
                   Text("Login")
               }
           }
           
           // Google Sign-In button
           Button(
               onClick = { viewModel.loginWithGoogle() },
               modifier = Modifier.fillMaxWidth()
           ) {
               Text("Continue with Google")
           }
           
           TextButton(onClick = onNavigateToRegister) {
               Text("Don't have an account? Register")
           }
       }
       
       // Handle state changes
       LaunchedEffect(authState) {
           when (authState) {
               is AuthState.Authenticated -> onLoginSuccess()
               is AuthState.Error -> {
                   // Show error toast
               }
               else -> {}
           }
       }
   }
   ```

2. **Create Google Sign-In integration**
   ```kotlin
   class AuthViewModel(
       private val authRepository: AuthRepository
   ) : ViewModel() {
       private val _authState = MutableStateFlow<AuthState>(AuthState.Initial)
       val authState: StateFlow<AuthState> = _authState.asStateFlow()
       
       fun loginWithGoogle() {
           // Trigger Google Sign-In intent from Activity
           _googleSignInTrigger.value = true
       }
       
       fun handleGoogleSignInResult(idToken: String) = viewModelScope.launch {
           _authState.value = AuthState.Loading
           val result = authRepository.loginWithGoogle(idToken)
           _authState.value = when {
               result.isSuccess -> AuthState.Authenticated(result.getOrNull()!!)
               else -> AuthState.Error(result.exceptionOrNull()?.message ?: "Google login failed")
           }
       }
   }
   ```

3. **Create profile setup screen** (for incomplete profiles)
   ```kotlin
   @Composable
   fun ProfileSetupScreen(
       onProfileComplete: () -> Unit,
       viewModel: ProfileViewModel = koinViewModel()
   ) {
       // Name, phone, location fields
       // POST /api/users/{userId} to update profile
   }
   ```

**Success Criteria**:
- ✅ User can login with email/password
- ✅ User can login with Google OAuth
- ✅ JWT token stored securely after login
- ✅ Profile setup screen appears for incomplete profiles
- ✅ Session persists across app restarts

#### 2.2 Navigation Structure (Week 4)

**Tasks**:
1. **Create navigation graph**
   ```kotlin
   @Composable
   fun AppNavigation(
       authState: AuthState,
       startDestination: String
   ) {
       val navController = rememberNavController()
       
       NavHost(navController = navController, startDestination = startDestination) {
           // Auth flow
           composable("login") {
               LoginScreen(
                   onLoginSuccess = { navController.navigate("home") { popUpTo("login") { inclusive = true } } },
                   onNavigateToRegister = { navController.navigate("register") }
               )
           }
           
           composable("register") {
               RegisterScreen(
                   onRegisterSuccess = { navController.navigate("profile-setup") }
               )
           }
           
           composable("profile-setup") {
               ProfileSetupScreen(
                   onProfileComplete = { navController.navigate("home") { popUpTo("login") { inclusive = true } } }
               )
           }
           
           // Main app
           composable("home") {
               HomeScreen(navController)
           }
           
           composable("canteen/{canteenId}") { backStackEntry ->
               CanteenScreen(
                   canteenId = backStackEntry.arguments?.getString("canteenId")!!,
                   navController = navController
               )
           }
           
           composable("cart") {
               CartScreen(navController)
           }
           
           composable("checkout") {
               CheckoutScreen(navController)
           }
           
           composable("order/{orderId}") { backStackEntry ->
               OrderTrackingScreen(
                   orderId = backStackEntry.arguments?.getString("orderId")!!
               )
           }
       }
   }
   ```

2. **Create bottom navigation**
   ```kotlin
   @Composable
   fun MainScreen() {
       val navController = rememberNavController()
       
       Scaffold(
           bottomBar = {
               NavigationBar {
                   NavigationBarItem(
                       icon = { Icon(Icons.Default.Home, contentDescription = null) },
                       label = { Text("Home") },
                       selected = currentRoute == "home",
                       onClick = { navController.navigate("home") }
                   )
                   NavigationBarItem(
                       icon = { Icon(Icons.Default.ShoppingCart, contentDescription = null) },
                       label = { Text("Cart") },
                       selected = currentRoute == "cart",
                       onClick = { navController.navigate("cart") }
                   )
                   NavigationBarItem(
                       icon = { Icon(Icons.Default.Person, contentDescription = null) },
                       label = { Text("Profile") },
                       selected = currentRoute == "profile",
                       onClick = { navController.navigate("profile") }
                   )
               }
           }
       ) { paddingValues ->
           NavHost(navController, startDestination = "home", Modifier.padding(paddingValues)) {
               // Screen definitions
           }
       }
   }
   ```

**Success Criteria**:
- ✅ Navigation between screens works correctly
- ✅ Back button behavior is intuitive
- ✅ Deep links work for order tracking
- ✅ Bottom navigation highlights current tab

---

### Phase 3: Core Features (Week 5-9)

**Goal**: Implement menu browsing, cart, checkout, and order tracking.

#### 3.1 Canteen Selection (Week 5)

**Tasks**:
1. **Create canteen list screen**
   ```kotlin
   @Composable
   fun CanteenListScreen(
       onCanteenSelected: (String) -> Unit,
       viewModel: CanteenViewModel = koinViewModel()
   ) {
       val canteens by viewModel.canteens.collectAsState()
       val selectedLocationType by viewModel.selectedLocationType.collectAsState()
       
       Column {
           // Location filter chips
           Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
               FilterChip(
                   selected = selectedLocationType == LocationType.COLLEGE,
                   onClick = { viewModel.setLocationType(LocationType.COLLEGE) },
                   label = { Text("College") }
               )
               FilterChip(
                   selected = selectedLocationType == LocationType.ORGANIZATION,
                   onClick = { viewModel.setLocationType(LocationType.ORGANIZATION) },
                   label = { Text("Organization") }
               )
               FilterChip(
                   selected = selectedLocationType == LocationType.RESTAURANT,
                   onClick = { viewModel.setLocationType(LocationType.RESTAURANT) },
                   label = { Text("Restaurant") }
               )
           }
           
           // Canteen list
           LazyColumn {
               items(canteens) { canteen ->
                   CanteenItem(
                       canteen = canteen,
                       onClick = { onCanteenSelected(canteen.id) }
                   )
               }
           }
       }
   }
   ```

**Success Criteria**:
- ✅ Canteens load and display correctly
- ✅ Location filters work (college/organization/restaurant)
- ✅ Priority sorting is correct
- ✅ Auto-selection works for single active canteen

#### 3.2 Menu Browsing (Week 6)

**Tasks**:
1. **Create menu screen with categories**
   ```kotlin
   @Composable
   fun MenuScreen(
       canteenId: String,
       viewModel: MenuViewModel = koinViewModel()
   ) {
       val menuItems by viewModel.menuItems.collectAsState()
       val categories by viewModel.categories.collectAsState()
       val searchQuery by viewModel.searchQuery.collectAsState()
       
       Column {
           // Search bar
           OutlinedTextField(
               value = searchQuery,
               onValueChange = { viewModel.setSearchQuery(it) },
               placeholder = { Text("Search menu items") },
               modifier = Modifier.fillMaxWidth()
           )
           
           // Category tabs
           ScrollableTabRow(selectedTabIndex = selectedCategoryIndex) {
               categories.forEachIndexed { index, category ->
                   Tab(
                       selected = index == selectedCategoryIndex,
                       onClick = { selectedCategoryIndex = index },
                       text = { Text(category.name) }
                   )
               }
           }
           
           // Menu items grid
           LazyVerticalGrid(columns = GridCells.Fixed(2)) {
               items(menuItems.filter { it.categoryId == categories[selectedCategoryIndex].id }) { item ->
                   MenuItemCard(
                       item = item,
                       onAddToCart = { viewModel.addToCart(item) },
                       onToggleFavorite = { viewModel.toggleFavorite(item.id) }
                   )
               }
           }
       }
   }
   ```

2. **Create menu item detail sheet**
   ```kotlin
   @OptIn(ExperimentalMaterial3Api::class)
   @Composable
   fun MenuItemDetailSheet(
       item: MenuItem,
       onAddToCart: (Int) -> Unit,
       onDismiss: () -> Unit
   ) {
       var quantity by remember { mutableStateOf(1) }
       
       ModalBottomSheet(onDismissRequest = onDismiss) {
           Column(modifier = Modifier.padding(16.dp)) {
               AsyncImage(
                   model = item.image,
                   contentDescription = item.name,
                   modifier = Modifier.fillMaxWidth().height(200.dp)
               )
               
               Text(item.name, style = MaterialTheme.typography.headlineMedium)
               Text("₹${item.price}", style = MaterialTheme.typography.titleLarge)
               
               if (!item.allergies.isNullOrEmpty()) {
                   Text("Allergies: ${item.allergies.joinToString()}", color = Color.Red)
               }
               
               if (item.calories != null) {
                   Text("${item.calories} kcal")
               }
               
               // Quantity selector
               Row {
                   IconButton(onClick = { if (quantity > 1) quantity-- }) {
                       Icon(Icons.Default.Remove, contentDescription = null)
                   }
                   Text(quantity.toString(), modifier = Modifier.align(Alignment.CenterVertically))
                   IconButton(onClick = { quantity++ }) {
                       Icon(Icons.Default.Add, contentDescription = null)
                   }
               }
               
               Button(
                   onClick = { onAddToCart(quantity) },
                   modifier = Modifier.fillMaxWidth()
               ) {
                   Text("Add to Cart - ₹${item.price * quantity}")
               }
           }
       }
   }
   ```

**Success Criteria**:
- ✅ Menu items load and display correctly
- ✅ Search filters items in real-time
- ✅ Category tabs scroll horizontally
- ✅ Item details sheet shows nutrition info
- ✅ Favorites toggle persists across sessions

#### 3.3 Cart Management (Week 6-7)

**Tasks**:
1. **Create cart screen**
   ```kotlin
   @Composable
   fun CartScreen(
       onProceedToCheckout: () -> Unit,
       viewModel: CartViewModel = koinViewModel()
   ) {
       val cart by viewModel.cart.collectAsState()
       val subtotal by viewModel.subtotal.collectAsState()
       val tax by viewModel.tax.collectAsState()
       val total by viewModel.total.collectAsState()
       
       if (cart.isEmpty()) {
           EmptyCartView()
       } else {
           Column {
               LazyColumn(modifier = Modifier.weight(1f)) {
                   items(cart) { cartItem ->
                       CartItemRow(
                           item = cartItem,
                           onUpdateQuantity = { newQty -> viewModel.updateQuantity(cartItem.id, newQty) },
                           onRemove = { viewModel.removeFromCart(cartItem.id) }
                       )
                   }
               }
               
               // Summary
               Card(modifier = Modifier.fillMaxWidth()) {
                   Column(modifier = Modifier.padding(16.dp)) {
                       Row(modifier = Modifier.fillMaxWidth()) {
                           Text("Subtotal")
                           Spacer(Modifier.weight(1f))
                           Text("₹$subtotal")
                       }
                       Row(modifier = Modifier.fillMaxWidth()) {
                           Text("Tax (GST)")
                           Spacer(Modifier.weight(1f))
                           Text("₹$tax")
                       }
                       Divider(modifier = Modifier.padding(vertical = 8.dp))
                       Row(modifier = Modifier.fillMaxWidth()) {
                           Text("Total", style = MaterialTheme.typography.titleLarge)
                           Spacer(Modifier.weight(1f))
                           Text("₹$total", style = MaterialTheme.typography.titleLarge)
                       }
                       
                       Button(
                           onClick = onProceedToCheckout,
                           modifier = Modifier.fillMaxWidth()
                       ) {
                           Text("Proceed to Checkout")
                       }
                   }
               }
           }
       }
   }
   ```

2. **Implement cart validation**
   ```kotlin
   class CartViewModel(private val cartRepository: CartRepository) : ViewModel() {
       fun addToCart(item: MenuItem, quantity: Int) = viewModelScope.launch {
           // Validation 1: Counter IDs required
           if (item.storeCounterId.isNullOrEmpty() || item.paymentCounterId.isNullOrEmpty()) {
               _cartError.value = "Counter IDs are required for this item"
               return@launch
           }
           
           // Validation 2: Canteen switch
           if (_currentCanteenId.value != null && _currentCanteenId.value != item.canteenId) {
               _cartConflict.value = CartConflict(
                   message = "Your cart contains items from ${getCurrentCanteenName()}. Clear cart?",
                   onConfirm = { clearCartAndAdd(item, quantity) }
               )
               return@launch
           }
           
           // Add to cart
           val updatedCart = _cart.value.toMutableList()
           val existing = updatedCart.find { it.id == item.id }
           if (existing != null) {
               existing.quantity += quantity
           } else {
               updatedCart.add(CartItem(item, quantity))
           }
           
           _cart.value = updatedCart
           _currentCanteenId.value = item.canteenId
           cartRepository.saveCart(updatedCart, item.canteenId)
       }
   }
   ```

**Success Criteria**:
- ✅ Cart operations complete in <100ms
- ✅ Cart persists across app restarts
- ✅ Canteen switch validation works correctly
- ✅ Counter ID validation prevents invalid items
- ✅ Cart summary calculations are accurate

#### 3.4 Checkout & Payment (Week 7-8)

**Tasks**:
1. **Create checkout screen**
   ```kotlin
   @Composable
   fun CheckoutScreen(
       onPaymentSuccess: (String) -> Unit,
       viewModel: CheckoutViewModel = koinViewModel()
   ) {
       val checkoutState by viewModel.checkoutState.collectAsState()
       val deliveryOption by viewModel.deliveryOption.collectAsState()
       val paymentMethod by viewModel.paymentMethod.collectAsState()
       
       Column {
           // Delivery option
           Text("Delivery Option", style = MaterialTheme.typography.titleMedium)
           Row {
               RadioButton(
                   selected = deliveryOption == "pickup",
                   onClick = { viewModel.setDeliveryOption("pickup") }
               )
               Text("Pickup from Counter")
               
               RadioButton(
                   selected = deliveryOption == "delivery",
                   onClick = { viewModel.setDeliveryOption("delivery") }
               )
               Text("Delivery")
           }
           
           // Payment method
           Text("Payment Method", style = MaterialTheme.typography.titleMedium)
           Row {
               RadioButton(
                   selected = paymentMethod == "online",
                   onClick = { viewModel.setPaymentMethod("online") }
               )
               Text("Pay Online")
               
               RadioButton(
                   selected = paymentMethod == "cash",
                   onClick = { viewModel.setPaymentMethod("cash") }
               )
               Text("Cash on Delivery")
           }
           
           Button(
               onClick = { viewModel.proceedToPayment() },
               modifier = Modifier.fillMaxWidth(),
               enabled = checkoutState !is CheckoutState.Processing
           ) {
               Text(if (paymentMethod == "online") "Pay Now" else "Place Order")
           }
       }
       
       // Handle checkout state
       LaunchedEffect(checkoutState) {
           when (val state = checkoutState) {
               is CheckoutState.ReadyToCheckout -> {
                   // Open Razorpay for online payment
                   if (paymentMethod == "online") {
                       openRazorpayCheckout(state.paymentOrder)
                   }
               }
               is CheckoutState.Success -> {
                   onPaymentSuccess(state.orderId)
               }
               else -> {}
           }
       }
   }
   ```

2. **Integrate Razorpay**
   ```kotlin
   class CheckoutActivity : ComponentActivity(), PaymentResultListener {
       private val viewModel: CheckoutViewModel by viewModels()
       
       fun openRazorpayCheckout(paymentOrder: PaymentOrder) {
           val checkout = Checkout()
           checkout.setKeyID(BuildConfig.RAZORPAY_KEY_ID)
           
           val options = JSONObject()
           options.put("order_id", paymentOrder.razorpayOrderId)
           options.put("amount", paymentOrder.amount * 100) // Convert to paise
           options.put("currency", "INR")
           options.put("name", "Sillobite")
           options.put("description", "Order Payment")
           options.put("image", "https://sillobite.com/logo.png")
           
           val prefill = JSONObject()
           prefill.put("email", viewModel.getUserEmail())
           prefill.put("contact", viewModel.getUserPhone())
           options.put("prefill", prefill)
           
           checkout.open(this, options)
       }
       
       override fun onPaymentSuccess(razorpayPaymentId: String, data: PaymentData) {
           viewModel.verifyPayment(
               razorpayPaymentId,
               data.orderId,
               data.signature
           )
       }
       
       override fun onPaymentError(code: Int, response: String, data: PaymentData?) {
           viewModel.handlePaymentError(code, response)
       }
   }
   ```

**Success Criteria**:
- ✅ Checkout session creation validates stock
- ✅ Razorpay payment flow completes successfully
- ✅ Payment verification creates order on backend
- ✅ Failed payments allow retry
- ✅ Cash on delivery skips payment gateway

#### 3.5 Order Tracking (Week 8-9)

**Tasks**:
1. **Create order tracking screen**
   ```kotlin
   @Composable
   fun OrderTrackingScreen(
       orderId: String,
       viewModel: OrderViewModel = koinViewModel()
   ) {
       val order by viewModel.getOrder(orderId).collectAsState(initial = null)
       
       order?.let { orderData ->
           Column {
               // Order status timeline
               StatusTimeline(
                   currentStatus = orderData.status,
                   statuses = listOf("pending", "preparing", "ready", "completed")
               )
               
               // Order details
               Card {
                   Column(modifier = Modifier.padding(16.dp)) {
                       Text("Order #${orderData.orderNumber}", style = MaterialTheme.typography.titleLarge)
                       Text("Placed at ${formatTimestamp(orderData.createdAt)}")
                       
                       Divider(modifier = Modifier.padding(vertical = 8.dp))
                       
                       orderData.items.forEach { item ->
                           OrderItemRow(item)
                       }
                       
                       Divider(modifier = Modifier.padding(vertical = 8.dp))
                       
                       Text("Total: ₹${orderData.amount}", style = MaterialTheme.typography.titleMedium)
                   }
               }
               
               // Barcode for pickup
               if (orderData.status == "ready") {
                   Card {
                       Column(modifier = Modifier.padding(16.dp)) {
                           Text("Show this at pickup counter")
                           BarcodeImage(data = "ORDER:${orderData.id}")
                       }
                   }
               }
               
               // Cancel button (if within time limit)
               if (orderData.canCancel) {
                   OutlinedButton(
                       onClick = { viewModel.cancelOrder(orderId) },
                       modifier = Modifier.fillMaxWidth()
                   ) {
                       Text("Cancel Order")
                   }
               }
           }
       }
   }
   ```

2. **Implement real-time order updates**
   ```kotlin
   class OrderViewModel(
       private val orderRepository: OrderRepository,
       private val socketService: SocketService
   ) : ViewModel() {
       init {
           observeOrderUpdates()
       }
       
       private fun observeOrderUpdates() = viewModelScope.launch {
           socketService.orderUpdates.collect { event ->
               when (event.type) {
                   "order_status_changed" -> {
                       updateOrderInCache(event.orderId, event.status)
                   }
                   "item_status_changed" -> {
                       updateItemStatusInCache(event.orderId, event.itemId, event.itemStatus)
                   }
               }
           }
       }
       
       fun getOrder(orderId: String): Flow<Order?> = flow {
           // Emit cached order
           val cached = db.orderDao().getById(orderId)
           if (cached != null) {
               emit(cached.toDomain())
           }
           
           // Fetch from API
           try {
               val order = api.getOrderById(orderId)
               db.orderDao().insert(order.toEntity())
               emit(order)
           } catch (e: Exception) {
               // Fallback to cache
           }
       }.flowOn(Dispatchers.IO)
   }
   ```

**Success Criteria**:
- ✅ Order updates appear within 2 seconds of status change
- ✅ Status timeline shows correct progress
- ✅ Barcode displays correctly for pickup
- ✅ Order cancellation works within time limit
- ✅ Order history loads with pagination

---

### Phase 4: Advanced Features (Week 9-12)

**Goal**: Implement push notifications, offline support, and polish.

#### 4.1 Push Notifications (Week 9-10)

**Tasks**:
1. **Integrate Firebase Cloud Messaging**
   ```kotlin
   class MyFirebaseMessagingService : FirebaseMessagingService() {
       override fun onMessageReceived(remoteMessage: RemoteMessage) {
           val notificationType = remoteMessage.data["type"] // "order", "promo"
           val orderId = remoteMessage.data["orderId"]
           val title = remoteMessage.notification?.title ?: "New Notification"
           val body = remoteMessage.notification?.body ?: ""
           
           when (notificationType) {
               "order" -> showOrderNotification(orderId, title, body)
               "promo" -> showPromoNotification(title, body)
           }
       }
       
       override fun onNewToken(token: String) {
           // Register token with backend
           viewModelScope.launch {
               api.registerFCMToken(FCMTokenRequest(token, "android"))
           }
       }
       
       private fun showOrderNotification(orderId: String?, title: String, body: String) {
           val intent = Intent(this, MainActivity::class.java).apply {
               putExtra("orderId", orderId)
               flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
           }
           val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
           
           val notification = NotificationCompat.Builder(this, "order_updates")
               .setSmallIcon(R.drawable.ic_notification)
               .setContentTitle(title)
               .setContentText(body)
               .setPriority(NotificationCompat.PRIORITY_HIGH)
               .setAutoCancel(true)
               .setContentIntent(pendingIntent)
               .build()
           
           NotificationManagerCompat.from(this).notify(Random.nextInt(), notification)
       }
   }
   ```

2. **Create notification channels**
   ```kotlin
   object NotificationChannels {
       const val ORDER_UPDATES = "order_updates"
       const val PROMOTIONS = "promotions"
       
       fun createChannels(context: Context) {
           if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
               val orderChannel = NotificationChannel(
                   ORDER_UPDATES,
                   "Order Updates",
                   NotificationManager.IMPORTANCE_HIGH
               ).apply {
                   description = "Notifications about your order status"
                   enableVibration(true)
               }
               
               val promoChannel = NotificationChannel(
                   PROMOTIONS,
                   "Promotions",
                   NotificationManager.IMPORTANCE_DEFAULT
               ).apply {
                   description = "Promotional offers and updates"
               }
               
               val notificationManager = context.getSystemService(NotificationManager::class.java)
               notificationManager.createNotificationChannel(orderChannel)
               notificationManager.createNotificationChannel(promoChannel)
           }
       }
   }
   ```

**Success Criteria**:
- ✅ FCM token registers with backend on app launch
- ✅ Order notifications appear with correct data
- ✅ Tapping notification navigates to order tracking
- ✅ Notification permissions requested appropriately (Android 13+)
- ✅ 95%+ delivery rate measured in Firebase Console

#### 4.2 Offline Support (Week 10-11)

**Tasks**:
1. **Implement offline queue**
   ```kotlin
   @Entity(tableName = "offline_operations")
   data class OfflineOperation(
       @PrimaryKey val id: String,
       val type: String, // "add_to_cart", "remove_from_cart", "update_quantity"
       val data: String, // JSON payload
       val timestamp: Long,
       val status: String // "pending", "completed", "failed"
   )
   
   class OfflineQueueRepository(private val db: AppDatabase) {
       suspend fun enqueue(operation: OfflineOperation) {
           db.offlineDao().insert(operation)
       }
       
       suspend fun getPendingOperations(): List<OfflineOperation> {
           return db.offlineDao().getPending()
       }
       
       suspend fun markCompleted(id: String) {
           db.offlineDao().updateStatus(id, "completed")
       }
   }
   ```

2. **Create sync worker**
   ```kotlin
   class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
       override suspend fun doWork(): Result {
           val offlineQueue = OfflineQueueRepository(AppDatabase.getDatabase(applicationContext))
           val api = NetworkModule.apiService
           
           val pendingOps = offlineQueue.getPendingOperations()
           var successCount = 0
           var failureCount = 0
           
           pendingOps.forEach { op ->
               try {
                   when (op.type) {
                       "add_to_cart" -> {
                           // Sync cart to server if needed
                       }
                       "remove_from_cart" -> {
                           // Sync removal
                       }
                   }
                   offlineQueue.markCompleted(op.id)
                   successCount++
               } catch (e: Exception) {
                   Log.e("SyncWorker", "Failed to sync ${op.id}: ${e.message}")
                   failureCount++
               }
           }
           
           return if (failureCount == 0) Result.success() else Result.retry()
       }
   }
   
   // Schedule periodic sync
   fun schedulePeriodicSync(context: Context) {
       val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
           .setConstraints(Constraints.Builder()
               .setRequiredNetworkType(NetworkType.CONNECTED)
               .build())
           .build()
       
       WorkManager.getInstance(context).enqueueUniquePeriodicWork(
           "offline-sync",
           ExistingPeriodicWorkPolicy.KEEP,
           syncRequest
       )
   }
   ```

3. **Implement conflict resolution**
   ```kotlin
   class FavoriteSyncRepository(
       private val api: ApiService,
       private val db: AppDatabase
   ) {
       suspend fun syncFavorites() {
           // Get local favorites
           val localFavorites = db.favoriteDao().getAll()
           
           // Get server favorites
           val serverFavorites = api.getFavorites()
           
           // Union merge (no data loss)
           val mergedIds = (localFavorites.map { it.itemId } + serverFavorites.map { it.itemId }).toSet()
           
           // Update local
           mergedIds.forEach { itemId ->
               if (!localFavorites.any { it.itemId == itemId }) {
                   db.favoriteDao().insert(Favorite(itemId))
               }
           }
           
           // Update server
           mergedIds.forEach { itemId ->
               if (!serverFavorites.any { it.itemId == itemId }) {
                   api.addFavorite(itemId)
               }
           }
       }
   }
   ```

**Success Criteria**:
- ✅ App usable offline for browsing cached menu
- ✅ Cart operations persist and sync on reconnect
- ✅ Favorites merge correctly (union strategy)
- ✅ Offline indicator shows in UI when disconnected
- ✅ Sync completes within 30 seconds of reconnect

#### 4.3 Polish & Optimization (Week 11-12)

**Tasks**:
1. **Implement loading skeletons**
2. **Add pull-to-refresh**
3. **Optimize images with Coil caching**
4. **Add haptic feedback for interactions**
5. **Implement search history**
6. **Add reorder functionality**
7. **Create onboarding flow for first-time users**
8. **Add app shortcuts for quick actions**
9. **Implement biometric authentication (optional)**
10. **Add crash reporting (Firebase Crashlytics)**

**Success Criteria**:
- ✅ App feels responsive (<100ms interaction feedback)
- ✅ Images load progressively with placeholders
- ✅ Smooth 60fps animations throughout
- ✅ Zero memory leaks detected
- ✅ APK size <25MB

---

## Blocking Dependencies

This section identifies **blocking dependencies** that must be resolved before proceeding with implementation.

### 1. Backend API Modifications

#### 1.1 FCM Token Registration

**Current State**: `POST /api/web-push/subscribe` expects Web Push subscription object.

**Required Change**:
```typescript
// server/routes/webPush.ts
router.post('/subscribe', async (req, res) => {
  const { subscription, token, platform } = req.body;
  
  if (platform === 'android') {
    // Store FCM token
    await User.findByIdAndUpdate(req.user.id, {
      fcmToken: token,
      fcmPlatform: 'android'
    });
  } else {
    // Store Web Push subscription (existing logic)
    await User.findByIdAndUpdate(req.user.id, {
      webPushSubscription: subscription
    });
  }
  
  res.json({ success: true });
});
```

**Impact**: Blocks Phase 4.1 (Push Notifications)

#### 1.2 Barcode Generation for Orders

**Current State**: Orders do not include barcode data in response.

**Required Change**:
```typescript
// server/routes.ts (order creation)
const order = await Order.create({
  // ... existing fields
  barcodeData: `ORDER:${orderId}`, // Add this field
});
```

**Impact**: Blocks Phase 3.5 (Order Tracking - Barcode Display)

### 2. Environment Configuration

**Required Variables**:
```properties
# Android app needs these in BuildConfig
API_BASE_URL=https://api.sillobite.com
RAZORPAY_KEY_ID=rzp_live_xxx
GOOGLE_SIGN_IN_CLIENT_ID=xxx.apps.googleusercontent.com
```

**Impact**: Blocks Phase 0 (Project Setup)

### 3. Firebase Project Setup

**Required Steps**:
1. Create Firebase project for Android app
2. Add Android app to Firebase (package name: `com.sillobite.app`)
3. Download `google-services.json` and place in `app/` directory
4. Enable Firebase Cloud Messaging
5. Generate Server Key for backend to send FCM messages

**Impact**: Blocks Phase 4.1 (Push Notifications)

### 4. Google Sign-In Configuration

**Required Steps**:
1. Create OAuth 2.0 Client ID in Google Cloud Console
2. Configure authorized redirect URIs
3. Add SHA-1 fingerprint for Android app

**Impact**: Blocks Phase 2.1 (Authentication - Google OAuth)

### 5. Razorpay Android SDK Setup

**Required Steps**:
1. Add Razorpay Maven repository to project
2. Configure Razorpay Key ID in build config
3. Add ProGuard rules for Razorpay SDK

**Impact**: Blocks Phase 3.4 (Checkout & Payment)

---

## Technical Risks

This section identifies **technical risks** and **mitigation strategies**.

### Risk 1: WebSocket Connection Stability on Mobile

**Description**: Mobile networks (cellular, WiFi) are less stable than desktop broadband. Frequent disconnects may cause missed order updates.

**Impact**: HIGH - Core feature (real-time order tracking) may not work reliably.

**Mitigation**:
1. **Implement automatic reconnection** with exponential backoff:
   ```kotlin
   class SocketService {
       private var reconnectAttempts = 0
       private val maxReconnectAttempts = 10
       
       init {
           socket.on(Socket.EVENT_DISCONNECT) {
               scheduleReconnect()
           }
       }
       
       private fun scheduleReconnect() {
           if (reconnectAttempts < maxReconnectAttempts) {
               val delay = (2.0.pow(reconnectAttempts) * 1000).toLong() // Exponential backoff
               Handler(Looper.getMainLooper()).postDelayed({
                   socket.connect()
                   reconnectAttempts++
               }, delay)
           }
       }
   }
   ```

2. **Implement missed event recovery**: On reconnect, fetch latest order status from API.

3. **Show connection status** in UI so users know when real-time updates are unavailable.

### Risk 2: Payment Gateway Integration Complexity

**Description**: Razorpay Android SDK has different behavior than web SDK. Payment failures, signature verification, and retry logic may have edge cases.

**Impact**: HIGH - Payment failures lead to lost orders and revenue.

**Mitigation**:
1. **Extensive testing**:
   - Test all failure scenarios (network error, user cancellation, insufficient balance)
   - Test signature verification with invalid signatures
   - Test retry flow after payment failure

2. **Implement idempotency**: Use unique `sessionId` to prevent duplicate orders if user retries.

3. **Add detailed logging** for all payment operations to diagnose issues in production.

4. **Implement payment timeout**: If verification takes >30s, show "verifying..." message and poll backend.

### Risk 3: Image Loading Performance

**Description**: Menu items have images loaded from Cloudinary. On slow networks, images may take >5s to load, degrading UX.

**Impact**: MEDIUM - Poor UX, high data usage.

**Mitigation**:
1. **Use Coil image library** with aggressive caching:
   ```kotlin
   val imageLoader = ImageLoader.Builder(context)
       .memoryCache {
           MemoryCache.Builder(context)
               .maxSizePercent(0.25) // 25% of app memory
               .build()
       }
       .diskCache {
           DiskCache.Builder()
               .directory(context.cacheDir.resolve("image_cache"))
               .maxSizeBytes(50 * 1024 * 1024) // 50MB
               .build()
       }
       .build()
   ```

2. **Request optimized image sizes** from Cloudinary:
   ```kotlin
   val imageUrl = "${item.image}?w=400&h=400&c=fill" // Request 400x400 thumbnail
   ```

3. **Implement progressive loading** with blur placeholder.

### Risk 4: Room Database Migrations

**Description**: Schema changes in future versions require migrations. Missing migrations cause app crashes.

**Impact**: HIGH - App crashes on update if migrations not handled.

**Mitigation**:
1. **Always provide migrations**:
   ```kotlin
   val MIGRATION_1_2 = object : Migration(1, 2) {
       override fun migrate(database: SupportSQLiteDatabase) {
           database.execSQL("ALTER TABLE menu_items ADD COLUMN calories INTEGER")
       }
   }
   
   Room.databaseBuilder(context, AppDatabase::class.java, "sillobite_db")
       .addMigrations(MIGRATION_1_2)
       .build()
   ```

2. **Test migrations thoroughly** with automated tests.

3. **Fallback strategy**: `fallbackToDestructiveMigration()` for dev builds only.

### Risk 5: Background Sync Reliability

**Description**: Android's battery optimization may kill WorkManager tasks, preventing offline operations from syncing.

**Impact**: MEDIUM - Offline cart additions may not sync to server.

**Mitigation**:
1. **Use expedited work** for time-sensitive sync:
   ```kotlin
   val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
       .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
       .build()
   ```

2. **Sync on app launch** in addition to periodic sync:
   ```kotlin
   class MainActivity : ComponentActivity() {
       override fun onResume() {
           super.onResume()
           triggerImmediateSync()
       }
   }
   ```

3. **Show sync status** in UI so users know when operations are pending.

### Risk 6: APK Size Bloat

**Description**: Dependencies (Compose, Retrofit, Room, Firebase, Razorpay) may cause APK size >50MB, deterring downloads.

**Impact**: MEDIUM - Lower download conversion rate.

**Mitigation**:
1. **Enable R8 minification** in release builds:
   ```gradle
   buildTypes {
       release {
           minifyEnabled = true
           shrinkResources = true
       }
   }
   ```

2. **Use Android App Bundle** (.aab) instead of APK for Google Play:
   - Reduces download size by ~30% (only downloads resources for user's device)

3. **Profile app size**:
   ```bash
   ./gradlew assembleRelease
   bundletool build-apks --bundle=app/release/app-release.aab --output=output.apks
   bundletool get-size total --apks=output.apks
   ```

4. **Target size**: <25MB for base APK

---

## Non-Negotiable Android Constraints

These constraints **must be followed** to ensure app quality and compliance.

### 1. Minimum SDK Version

**Constraint**: `minSdkVersion = 24` (Android 7.0)

**Rationale**:
- Covers 87.6% of Android devices (as of 2024)
- Supports modern Android features (Notification Channels, EncryptedSharedPreferences)
- Avoids legacy APIs deprecated in Android 7+

**Impact**: Users on Android 6 and below cannot install the app. This is acceptable (<13% market share).

### 2. Target SDK Version

**Constraint**: `targetSdkVersion = 34` (Android 14)

**Rationale**:
- **Google Play requirement**: New apps must target API 33+ (Aug 2023)
- Ensures compatibility with latest Android security features
- Avoids Play Store rejection

**Impact**: Must handle Android 13+ notification permissions, Android 12+ splash screen API.

### 3. Material Design 3

**Constraint**: Use Material Design 3 (Material You) components.

**Rationale**:
- Native Android look and feel
- Automatic theming based on user's device theme
- Accessibility built-in

**Impact**: UI must use `androidx.compose.material3` components, not Material 2.

### 4. HTTPS Only

**Constraint**: All network requests must use HTTPS.

**Rationale**:
- Android enforces cleartext traffic restrictions by default (API 28+)
- Security best practice (prevents MITM attacks)
- Google Play requirement

**Impact**: Backend APIs must have valid SSL certificates. Cannot use `http://` in production.

### 5. ProGuard/R8 Enabled in Release

**Constraint**: Code obfuscation must be enabled for release builds.

**Rationale**:
- Reduces APK size by ~40%
- Protects against reverse engineering
- Industry standard

**Impact**: Must provide ProGuard rules for all libraries (Razorpay, Room, Retrofit).

### 6. No Hardcoded Credentials

**Constraint**: API keys, secrets must be in BuildConfig or remote config, never hardcoded.

**Rationale**:
- Security (prevents key extraction from APK)
- Flexibility (can change keys without app update)

**Impact**: Use BuildConfig for compile-time secrets, Firebase Remote Config for runtime secrets.

### 7. 60fps UI Performance

**Constraint**: All screens must render at 60fps on mid-range devices (Snapdragon 660+).

**Rationale**:
- User expectation for modern apps
- Prevents negative reviews

**Impact**:
- Use LazyColumn/LazyGrid (not ScrollColumn with large lists)
- Avoid blocking UI thread (all I/O on background coroutines)
- Profile with Android Studio's CPU Profiler

### 8. Accessibility Support

**Constraint**: All interactive elements must have content descriptions.

**Rationale**:
- Legal requirement (ADA compliance in US)
- Google Play ranking factor
- Inclusivity

**Impact**: Add `contentDescription` to all icons, images, buttons.

### 9. Battery Optimization

**Constraint**: App must not drain >5% battery per hour in background.

**Rationale**:
- Android will flag app as "battery drain" and recommend uninstall
- User expectation

**Impact**:
- Use WorkManager (not foreground services) for background tasks
- Disconnect WebSocket when app is in background
- Use JobScheduler for deferred tasks

### 10. Data Privacy (GDPR Compliance)

**Constraint**: Must provide data deletion functionality and privacy policy.

**Rationale**:
- Legal requirement (GDPR, CCPA)
- Google Play requirement

**Impact**: Add "Delete Account" option in settings, link to privacy policy.

---

## Build Plan Execution

### Phase Gate Criteria

**Phase 0 Gate**: Project compiles, dependencies resolve, blank screen displays.  
**Phase 1 Gate**: Successful API call to login endpoint, JWT stored, WebSocket connects.  
**Phase 2 Gate**: User can login, navigate between screens, session persists.  
**Phase 3 Gate**: Complete order flow works end-to-end (browse → cart → checkout → pay → track).  
**Phase 4 Gate**: App works offline, notifications deliver, performance meets 60fps target.

### Testing Strategy

1. **Unit Tests** (Per Phase):
   - Repository layer (mock API responses)
   - ViewModel logic (state transitions)
   - Utility functions (validation, formatting)
   - **Target**: 80% code coverage

2. **Integration Tests** (Phase 3 Gate):
   - End-to-end order flow
   - Payment flow with test Razorpay credentials
   - WebSocket reconnection
   - **Target**: All critical paths tested

3. **UI Tests** (Phase 4 Gate):
   - Compose UI tests for all screens
   - Accessibility scanner
   - **Target**: All screens navigate correctly

4. **Manual QA** (Pre-Release):
   - Test on 5 real devices (different Android versions)
   - Network conditions (3G, WiFi, airplane mode)
   - Battery drain test (overnight with app in background)

### Release Checklist

- [ ] All phase gates passed
- [ ] Unit test coverage >80%
- [ ] No memory leaks detected
- [ ] APK size <25MB
- [ ] ProGuard enabled
- [ ] Firebase Crashlytics integrated
- [ ] Privacy policy linked in app
- [ ] Google Play Store listing prepared (screenshots, description)
- [ ] Beta testing completed (50+ users for 2 weeks)
- [ ] Backend APIs load-tested for mobile traffic
- [ ] Rollout plan prepared (5% → 25% → 50% → 100% over 1 week)

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| App Startup Time | <2s (cold start) | Android Studio Profiler |
| API Response Time | P95 <500ms | Backend monitoring |
| Crash-Free Rate | >99.5% | Firebase Crashlytics |
| ANR Rate | <0.1% | Google Play Console |
| Battery Drain | <5%/hour (background) | Battery Historian |
| APK Size | <25MB | Build output |
| Offline Support | 100% browsing, 95% cart sync | Manual testing |
| Notification Delivery | >95% | Firebase Analytics |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Install-to-Registration Rate | >60% | Firebase Analytics |
| Registration-to-Order Rate | >40% | Backend analytics |
| Order Completion Rate | >85% | Backend analytics |
| Payment Success Rate | >95% | Razorpay dashboard |
| Day-1 Retention | >50% | Firebase Analytics |
| Day-7 Retention | >30% | Firebase Analytics |
| Average Order Value | ≥Web AOV | Backend analytics |

---

## Appendices

### Appendix A: API Compatibility Matrix

| Backend API Endpoint | Web Client | Android Client | Notes |
|---------------------|------------|----------------|-------|
| `POST /api/auth/login` | ✅ | ✅ | Identical |
| `GET /api/menu?canteenId=X` | ✅ | ✅ | Identical |
| `POST /api/orders` | ✅ | ✅ | Identical |
| `POST /api/payments/verify` | ✅ | ✅ | Identical |
| `POST /api/web-push/subscribe` | ✅ | ⚠️ | Requires modification for FCM |
| `POST /api/print-agent/*` | ✅ | ❌ | Web-only |

### Appendix B: Dependency Versions

```gradle
// Core
kotlin = "1.9.20"
compose = "1.5.4"
material3 = "1.1.2"

// Networking
retrofit = "2.9.0"
okhttp = "4.11.0"
socket-io = "2.1.0"

// Storage
room = "2.6.0"
security-crypto = "1.1.0-alpha06"

// Firebase
firebase-messaging = "23.3.1"
firebase-analytics = "21.5.0"

// Payments
razorpay = "1.6.33"

// Image Loading
coil = "2.5.0"

// Dependency Injection
koin = "3.5.0"
```

### Appendix C: File Structure

```
app/src/main/java/com/sillobite/app/
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt
│   │   ├── dao/
│   │   │   ├── MenuDao.kt
│   │   │   ├── OrderDao.kt
│   │   │   └── CartDao.kt
│   │   └── entities/
│   ├── remote/
│   │   ├── ApiService.kt
│   │   ├── SocketService.kt
│   │   └── dto/
│   └── repository/
│       ├── AuthRepository.kt
│       ├── MenuRepository.kt
│       ├── OrderRepository.kt
│       └── PaymentRepository.kt
├── domain/
│   ├── model/
│   │   ├── User.kt
│   │   ├── MenuItem.kt
│   │   └── Order.kt
│   └── usecase/
├── presentation/
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   └── LoginViewModel.kt
│   ├── menu/
│   │   ├── MenuScreen.kt
│   │   └── MenuViewModel.kt
│   ├── cart/
│   │   ├── CartScreen.kt
│   │   └── CartViewModel.kt
│   └── order/
│       ├── OrderTrackingScreen.kt
│       └── OrderViewModel.kt
├── navigation/
│   └── AppNavigation.kt
├── di/
│   └── AppModule.kt
└── MainActivity.kt
```

---

## Conclusion

This implementation plan provides an **executable roadmap** for building the Android app based on **23,820+ lines of extracted system documentation**. The plan prioritizes:

1. **Correctness**: All business logic reused from web, validated against backend APIs
2. **Feasibility**: 16-20 week timeline with clear phase gates
3. **Risk Mitigation**: All blocking dependencies and technical risks identified upfront
4. **Quality**: Non-negotiable constraints ensure production-ready app

**Next Steps**:
1. Resolve blocking dependencies (FCM setup, backend API modifications)
2. Begin Phase 0: Project setup
3. Weekly progress reviews against phase gate criteria
4. Continuous testing throughout development

**Estimated Effort**: 16-20 weeks (1 full-time Android developer)

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-31  
**Status**: Ready for Implementation
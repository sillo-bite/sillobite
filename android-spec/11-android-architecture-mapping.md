# 11 - ANDROID ARCHITECTURE MAPPING

## DOCUMENT METADATA
- **Extraction Date**: 2026-01-02
- **Source**: android-spec/02-capability-map.md, android-spec/04-rest-apis.md, android-spec/05-socket-events.md, android-spec/10-android-mvp-scope.md
- **Protocol**: Map backend capabilities to concrete Android architecture components
- **Architecture Pattern**: MVVM (Model-View-ViewModel) + Repository Pattern + Clean Architecture principles

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Layer Definitions](#layer-definitions)
3. [REST API Component Mapping](#rest-api-component-mapping)
4. [WebSocket Component Mapping](#websocket-component-mapping)
5. [Foreground Service Requirements](#foreground-service-requirements)
6. [Background Work Strategy](#background-work-strategy)
7. [Local Storage Strategy](#local-storage-strategy)
8. [Dependency Injection Setup](#dependency-injection-setup)
9. [Complete Component Catalog](#complete-component-catalog)

---

## ARCHITECTURE OVERVIEW

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Activities  │  │  Fragments   │  │   Compose    │          │
│  │  /Screens    │  │              │  │   Screens    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                       │
│                    ┌───────▼────────┐                            │
│                    │   ViewModels   │ (LiveData/StateFlow)       │
│                    └───────┬────────┘                            │
└────────────────────────────┼──────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────┐
│                     DOMAIN LAYER                                  │
│                    ┌───────▼────────┐                            │
│                    │   Use Cases    │ (Business Logic)           │
│                    └───────┬────────┘                            │
│                            │                                       │
│                    ┌───────▼────────┐                            │
│                    │ Domain Models  │ (User, MenuItem, Order)    │
│                    └────────────────┘                            │
└───────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────┐
│                      DATA LAYER                                   │
│                    ┌───────▼────────┐                            │
│                    │  Repositories  │ (Single Source of Truth)   │
│                    └───┬────────┬───┘                            │
│                        │        │                                 │
│            ┌───────────┘        └───────────┐                    │
│            │                                 │                    │
│    ┌───────▼────────┐              ┌────────▼──────┐            │
│    │ Remote Source  │              │ Local Source  │            │
│    │ ┌────────────┐ │              │ ┌───────────┐ │            │
│    │ │ Retrofit   │ │              │ │   Room    │ │            │
│    │ │  API       │ │              │ │ Database  │ │            │
│    │ └────────────┘ │              │ └───────────┘ │            │
│    │ ┌────────────┐ │              │ ┌───────────┐ │            │
│    │ │ Socket.IO  │ │              │ │  Shared   │ │            │
│    │ │  Client    │ │              │ │  Prefs    │ │            │
│    │ └────────────┘ │              │ └───────────┘ │            │
│    └────────────────┘              └───────────────┘            │
└───────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────┐
│                    SERVICES LAYER                                 │
│    ┌────────────────┐     ┌────────────────┐                    │
│    │  Foreground    │     │  WorkManager   │                    │
│    │   Service      │     │    Workers     │                    │
│    │ (WebSocket)    │     │ (Offline Sync) │                    │
│    └────────────────┘     └────────────────┘                    │
└───────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Single Source of Truth**: Room Database is the source of truth for data
4. **Offline-First**: App functions without network, syncs when available
5. **Reactive**: UI observes data changes via Flow/LiveData
6. **Testable**: Interfaces enable mocking for unit tests

---

## LAYER DEFINITIONS

### 1. PRESENTATION LAYER (UI + ViewModel)

**Responsibility**: Display data, handle user interactions, navigate between screens

#### Components

**1.1 Activities / Fragments / Compose Screens**
- **Technology**: Jetpack Compose OR XML + ViewBinding
- **Lifecycle**: Managed by Android framework
- **Data Access**: NONE (observes ViewModel only)
- **Business Logic**: NONE (delegates to ViewModel)
- **State Management**: Observes `StateFlow<UiState>` from ViewModel

**Example**:
```kotlin
@Composable
fun MenuListScreen(
    viewModel: MenuViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    when (uiState) {
        is UiState.Loading -> LoadingIndicator()
        is UiState.Success -> MenuList(uiState.data)
        is UiState.Error -> ErrorMessage(uiState.message)
    }
}
```

**1.2 ViewModels**
- **Technology**: `androidx.lifecycle.ViewModel`
- **Lifecycle**: Survives configuration changes (rotation)
- **Data Access**: Via Use Cases or Repositories
- **Business Logic**: Orchestrates use cases, manages UI state
- **Threading**: Uses Kotlin Coroutines (`viewModelScope`)

**Example**:
```kotlin
@HiltViewModel
class MenuViewModel @Inject constructor(
    private val getMenuUseCase: GetMenuUseCase,
    private val refreshMenuUseCase: RefreshMenuUseCase
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<UiState<List<MenuItem>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<MenuItem>>> = _uiState.asStateFlow()
    
    init {
        loadMenu()
    }
    
    fun loadMenu(canteenId: String) {
        viewModelScope.launch {
            getMenuUseCase(canteenId)
                .onStart { _uiState.value = UiState.Loading }
                .catch { _uiState.value = UiState.Error(it.message) }
                .collect { menu -> _uiState.value = UiState.Success(menu) }
        }
    }
    
    fun refreshMenu(canteenId: String) {
        viewModelScope.launch {
            refreshMenuUseCase(canteenId)
        }
    }
}
```

**UiState Sealed Class**:
```kotlin
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
```

---

### 2. DOMAIN LAYER (Use Cases + Domain Models)

**Responsibility**: Business logic, independent of frameworks

#### Components

**2.1 Use Cases** (Interactors)
- **Purpose**: Encapsulate single business operation
- **Naming**: Verb + Noun (e.g., `GetMenuUseCase`, `PlaceOrderUseCase`)
- **Dependencies**: Repositories only (no Android dependencies)
- **Testing**: Easily unit testable

**Example**:
```kotlin
class GetMenuUseCase @Inject constructor(
    private val menuRepository: MenuRepository
) {
    operator fun invoke(canteenId: String): Flow<List<MenuItem>> {
        return menuRepository.getMenuItemsFlow(canteenId)
    }
}

class PlaceOrderUseCase @Inject constructor(
    private val orderRepository: OrderRepository,
    private val cartRepository: CartRepository
) {
    suspend operator fun invoke(cartItems: List<CartItem>): Result<Order> {
        // Validate cart
        if (cartItems.isEmpty()) {
            return Result.failure(Exception("Cart is empty"))
        }
        
        // Create order
        val result = orderRepository.createOrder(cartItems)
        
        // Clear cart on success
        if (result.isSuccess) {
            cartRepository.clearCart()
        }
        
        return result
    }
}
```

**2.2 Domain Models**
- **Purpose**: Business entities (pure Kotlin classes)
- **Location**: `domain/models/`
- **No Android Dependencies**: Can be used in JVM tests

**Example**:
```kotlin
data class MenuItem(
    val id: String,
    val name: String,
    val description: String?,
    val price: Double,
    val imageUrl: String?,
    val categoryId: String?,
    val stock: Int?,
    val isAvailable: Boolean,
    val isVeg: Boolean,
    val canteenId: String
)

data class Order(
    val id: String,
    val userId: String,
    val canteenId: String,
    val items: List<OrderItem>,
    val totalAmount: Double,
    val status: OrderStatus,
    val paymentStatus: PaymentStatus,
    val createdAt: Long,
    val barcode: String?,
    val orderNumber: String?
)

enum class OrderStatus {
    PENDING, PREPARING, READY, DELIVERED, CANCELLED
}
```

---

### 3. DATA LAYER (Repositories + Data Sources)

**Responsibility**: Manage data from multiple sources (network, database, cache)

#### Components

**3.1 Repositories**
- **Purpose**: Single source of truth, abstract data sources
- **Pattern**: Repository Pattern (interface + implementation)
- **Data Flow**: Local DB → UI (via Flow), Network → Local DB
- **Caching Strategy**: Network-bound resource pattern

**Example**:
```kotlin
interface MenuRepository {
    fun getMenuItemsFlow(canteenId: String): Flow<List<MenuItem>>
    suspend fun refreshMenu(canteenId: String): Result<Unit>
    suspend fun getMenuItemById(id: String): MenuItem?
}

class MenuRepositoryImpl @Inject constructor(
    private val menuApi: MenuApi,
    private val menuItemDao: MenuItemDao,
    private val socketManager: SocketManager
) : MenuRepository {
    
    override fun getMenuItemsFlow(canteenId: String): Flow<List<MenuItem>> {
        return menuItemDao.getMenuItems(canteenId)
            .map { entities -> entities.map { it.toDomainModel() } }
    }
    
    override suspend fun refreshMenu(canteenId: String): Result<Unit> {
        return try {
            val response = menuApi.getMenu(canteenId)
            if (response.isSuccessful) {
                val items = response.body()?.data ?: emptyList()
                menuItemDao.insertAll(items.map { it.toEntity() })
                Result.success(Unit)
            } else {
                Result.failure(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun getMenuItemById(id: String): MenuItem? {
        return menuItemDao.getMenuItemById(id)?.toDomainModel()
    }
}
```

**3.2 Remote Data Sources**

**3.2.1 Retrofit API Interfaces**
- **Technology**: Retrofit 2 + OkHttp 4
- **Location**: `data/remote/api/`
- **Responsibility**: HTTP API calls

**Example**:
```kotlin
interface MenuApi {
    @GET("menu")
    suspend fun getMenu(
        @Query("canteenId") canteenId: String,
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("vegOnly") vegOnly: Boolean? = null,
        @Query("availableOnly") availableOnly: Boolean? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<MenuItemDto>>>
    
    @GET("menu/{id}")
    suspend fun getMenuItem(
        @Path("id") id: String
    ): Response<ApiResponse<MenuItemDto>>
}

interface OrderApi {
    @POST("orders")
    suspend fun createOrder(
        @Body request: CreateOrderRequest
    ): Response<ApiResponse<OrderDto>>
    
    @GET("orders/user/{userId}/active")
    suspend fun getActiveOrders(
        @Path("userId") userId: String
    ): Response<ApiResponse<List<OrderDto>>>
}
```

**3.2.2 Socket.IO Manager**
- **Technology**: Socket.IO Android Client
- **Location**: `data/remote/socket/`
- **Responsibility**: WebSocket connection, event handling
- **Lifecycle**: Managed by Application class or Foreground Service

**Example**:
```kotlin
@Singleton
class SocketManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val authRepository: AuthRepository
) {
    private var socket: Socket? = null
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    private val _orderUpdates = MutableSharedFlow<OrderUpdateEvent>()
    val orderUpdates: SharedFlow<OrderUpdateEvent> = _orderUpdates.asSharedFlow()
    
    fun connect(canteenId: String) {
        if (socket?.connected() == true) return
        
        val opts = IO.Options().apply {
            transports = arrayOf(WebSocket.NAME)
            reconnection = true
            reconnectionDelay = 1000
            reconnectionDelayMax = 8000
        }
        
        socket = IO.socket(BuildConfig.API_URL, opts).apply {
            on(Socket.EVENT_CONNECT) {
                _connectionState.value = ConnectionState.Connected
                joinCanteenRoom(canteenId)
            }
            
            on(Socket.EVENT_DISCONNECT) {
                _connectionState.value = ConnectionState.Disconnected
            }
            
            on("orderUpdate") { args ->
                handleOrderUpdate(args[0] as JSONObject)
            }
            
            connect()
        }
    }
    
    private fun joinCanteenRoom(canteenId: String) {
        socket?.emit("joinCanteenRooms", JSONObject().apply {
            put("canteenIds", JSONArray().put(canteenId))
        })
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}

sealed class ConnectionState {
    object Connected : ConnectionState()
    object Disconnected : ConnectionState()
    object Reconnecting : ConnectionState()
}
```

**3.3 Local Data Sources**

**3.3.1 Room Database**
- **Technology**: `androidx.room:room-runtime`
- **Location**: `data/local/database/`
- **Responsibility**: Persistent storage (SQLite)
- **Schema Version**: Managed via migrations

**Database Definition**:
```kotlin
@Database(
    entities = [
        CachedMenuItem::class,
        CachedCategory::class,
        CartItem::class,
        CachedOrder::class,
        PendingOrder::class,
        UserSession::class
    ],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun menuItemDao(): MenuItemDao
    abstract fun categoryDao(): CategoryDao
    abstract fun cartItemDao(): CartItemDao
    abstract fun orderDao(): OrderDao
    abstract fun pendingOrderDao(): PendingOrderDao
    abstract fun userSessionDao(): UserSessionDao
}
```

**DAO Example**:
```kotlin
@Dao
interface MenuItemDao {
    @Query("SELECT * FROM menu_items WHERE canteenId = :canteenId AND available = 1 ORDER BY name ASC")
    fun getMenuItems(canteenId: String): Flow<List<CachedMenuItem>>
    
    @Query("SELECT * FROM menu_items WHERE id = :id")
    suspend fun getMenuItemById(id: String): CachedMenuItem?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CachedMenuItem>)
    
    @Query("DELETE FROM menu_items WHERE cachedAt < :expiryTime")
    suspend fun deleteExpired(expiryTime: Long)
    
    @Query("UPDATE menu_items SET stock = :stock, available = :available WHERE id = :id")
    suspend fun updateStock(id: String, stock: Int?, available: Boolean)
}
```

**Entity Example**:
```kotlin
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

// Mapper extension functions
fun CachedMenuItem.toDomainModel() = MenuItem(
    id = id,
    name = name,
    description = description,
    price = price,
    imageUrl = imageUrl,
    categoryId = categoryId,
    stock = stock,
    isAvailable = available,
    isVeg = isVeg,
    canteenId = canteenId
)

fun MenuItemDto.toEntity(canteenId: String) = CachedMenuItem(
    id = _id,
    canteenId = canteenId,
    name = name,
    description = description,
    price = price,
    stock = stock,
    available = available,
    imageUrl = imageUrl,
    categoryId = categoryId,
    isVeg = isVeg,
    cachedAt = System.currentTimeMillis()
)
```

**3.3.2 SharedPreferences / DataStore**
- **Technology**: `androidx.datastore:datastore-preferences` (recommended) OR SharedPreferences (legacy)
- **Location**: `data/local/preferences/`
- **Responsibility**: Key-value storage (user settings, tokens)

**DataStore Example**:
```kotlin
@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val Context.dataStore by preferencesDataStore(name = "user_prefs")
    
    private object Keys {
        val USER_ID = stringPreferencesKey("user_id")
        val USER_EMAIL = stringPreferencesKey("user_email")
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val SELECTED_CANTEEN_ID = stringPreferencesKey("selected_canteen_id")
        val FCM_TOKEN = stringPreferencesKey("fcm_token")
    }
    
    val userSession: Flow<UserSession?> = context.dataStore.data
        .map { prefs ->
            val userId = prefs[Keys.USER_ID]
            if (userId != null) {
                UserSession(
                    userId = userId,
                    email = prefs[Keys.USER_EMAIL] ?: "",
                    authToken = prefs[Keys.AUTH_TOKEN],
                    selectedCanteenId = prefs[Keys.SELECTED_CANTEEN_ID]
                )
            } else null
        }
    
    suspend fun saveUserSession(session: UserSession) {
        context.dataStore.edit { prefs ->
            prefs[Keys.USER_ID] = session.userId
            prefs[Keys.USER_EMAIL] = session.email
            session.authToken?.let { prefs[Keys.AUTH_TOKEN] = it }
            session.selectedCanteenId?.let { prefs[Keys.SELECTED_CANTEEN_ID] = it }
        }
    }
    
    suspend fun clearUserSession() {
        context.dataStore.edit { it.clear() }
    }
}

data class UserSession(
    val userId: String,
    val email: String,
    val authToken: String?,
    val selectedCanteenId: String?
)
```

---

### 4. SERVICES LAYER

**Responsibility**: Background operations, long-running tasks

#### Components

**4.1 Foreground Service** (WebSocket Connection)
- **Purpose**: Maintain WebSocket connection when app backgrounded
- **Technology**: Android Service with `startForeground()`
- **Use Case**: Delivery person app (real-time order assignments)
- **Required For Customer App**: NO (optional, improves UX)

**4.2 WorkManager Workers** (Offline Sync)
- **Purpose**: Background sync of pending orders
- **Technology**: `androidx.work:work-runtime-ktx`
- **Constraints**: NetworkType.CONNECTED
- **Retry Policy**: Exponential backoff

---

## REST API COMPONENT MAPPING

### Mapping Table

| Backend API Endpoint | Android Component | Layer | Storage | Notes |
|---------------------|-------------------|-------|---------|-------|
| **Authentication** |
| `POST /api/auth/register` | `AuthRepository.register()` | Data | SharedPreferences (token) | Saves user session |
| `POST /api/auth/login` | `AuthRepository.login()` | Data | SharedPreferences (token) | Saves user session |
| `GET /api/auth/google` | `AuthRepository.googleSignIn()` | Data | SharedPreferences (token) | Google Sign-In SDK |
| `POST /api/auth/google/verify` | `AuthRepository.verifyGoogleToken()` | Data | SharedPreferences (token) | Server-side verification |
| `POST /api/auth/logout` | `AuthRepository.logout()` | Data | SharedPreferences (clear) | Clears local session |
| `GET /api/users/:id/validate` | `AuthRepository.validateSession()` | Data | SharedPreferences (read) | On app launch |
| **User Management** |
| `GET /api/users/:id` | `UserRepository.getUser()` | Data | Room (UserSession) | Cache user data |
| `PUT /api/users/:id` | `UserRepository.updateUser()` | Data | Room (UserSession) | Profile updates |
| `PUT /api/users/:id/location` | `UserRepository.updateLocation()` | Data | SharedPreferences | Canteen selection |
| `GET /api/locations/:type` | `LocationRepository.getLocations()` | Data | Room (cache) | System settings |
| **Menu Browsing** |
| `GET /api/menu` | `MenuRepository.refreshMenu()` | Data | Room (CachedMenuItem) | Pagination support |
| `GET /api/menu/:id` | `MenuRepository.getMenuItemById()` | Data | Room (read) | Single item detail |
| `GET /api/categories` | `CategoryRepository.refreshCategories()` | Data | Room (CachedCategory) | Category list |
| `GET /api/home-data` | `HomeRepository.getHomeData()` | Data | Room (multiple tables) | Batch endpoint |
| **Order Management** |
| `POST /api/orders` | `OrderRepository.createOrder()` | Data | Room (PendingOrder if offline) | WorkManager sync |
| `GET /api/orders/user/:userId/active` | `OrderRepository.getActiveOrders()` | Data | Room (CachedOrder) | Real-time via WebSocket |
| `GET /api/orders/user/:userId/history` | `OrderRepository.getOrderHistory()` | Data | Room (CachedOrder) | Pagination |
| `GET /api/orders/:id` | `OrderRepository.getOrderById()` | Data | Room (read) | Order detail |
| **Payment Processing** |
| `POST /api/payments/initiate` | `PaymentRepository.initiatePayment()` | Data | Room (Payment record) | Razorpay order creation |
| `POST /api/payments/verify` | `PaymentRepository.verifyPayment()` | Data | Room (update status) | After Razorpay callback |
| `GET /api/payments/status/:id` | `PaymentRepository.getPaymentStatus()` | Data | Room (read) | Polling fallback |
| **Checkout Sessions** |
| `POST /api/checkout-sessions` | `CheckoutRepository.createSession()` | Data | NONE (ephemeral) | Before payment |
| `GET /api/checkout-sessions/:id` | `CheckoutRepository.getSession()` | Data | NONE | Session validation |
| **Push Notifications** |
| `POST /api/push/subscribe` | `NotificationRepository.subscribe()` | Data | SharedPreferences (FCM token) | On FCM token received |
| `POST /api/push/unsubscribe` | `NotificationRepository.unsubscribe()` | Data | SharedPreferences (clear) | On logout |
| `GET /api/push/vapid-public-key` | N/A (Android uses FCM) | - | - | Web Push only |

### REST API Repository Examples

#### AuthRepository

```kotlin
interface AuthRepository {
    suspend fun register(email: String, password: String): Result<User>
    suspend fun login(email: String, password: String): Result<User>
    suspend fun googleSignIn(idToken: String): Result<User>
    suspend fun logout(): Result<Unit>
    suspend fun validateSession(): Result<User?>
    fun getCurrentUser(): Flow<User?>
}

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val userPreferences: UserPreferences,
    private val userSessionDao: UserSessionDao
) : AuthRepository {
    
    override suspend fun login(email: String, password: String): Result<User> {
        return try {
            val response = authApi.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val user = response.body()?.user
                if (user != null) {
                    userPreferences.saveUserSession(UserSession(
                        userId = user.id,
                        email = user.email,
                        authToken = user.token
                    ))
                    userSessionDao.insertUser(user.toEntity())
                    Result.success(user.toDomainModel())
                } else {
                    Result.failure(Exception("User data missing"))
                }
            } else {
                Result.failure(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override fun getCurrentUser(): Flow<User?> {
        return userSessionDao.getCurrentUser().map { it?.toDomainModel() }
    }
}
```

#### MenuRepository

```kotlin
interface MenuRepository {
    fun getMenuItemsFlow(canteenId: String, filters: MenuFilters? = null): Flow<List<MenuItem>>
    suspend fun refreshMenu(canteenId: String): Result<Unit>
    suspend fun searchMenu(canteenId: String, query: String): List<MenuItem>
    suspend fun getMenuItemById(id: String): MenuItem?
}

@Singleton
class MenuRepositoryImpl @Inject constructor(
    private val menuApi: MenuApi,
    private val menuItemDao: MenuItemDao,
    private val socketManager: SocketManager,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) : MenuRepository {
    
    override fun getMenuItemsFlow(canteenId: String, filters: MenuFilters?): Flow<List<MenuItem>> {
        return menuItemDao.getMenuItems(
            canteenId = canteenId,
            vegOnly = filters?.vegOnly ?: false,
            availableOnly = filters?.availableOnly ?: true
        ).map { entities -> entities.map { it.toDomainModel() } }
    }
    
    override suspend fun refreshMenu(canteenId: String): Result<Unit> = withContext(ioDispatcher) {
        try {
            val response = menuApi.getMenu(canteenId = canteenId, limit = 100)
            if (response.isSuccessful) {
                val items = response.body()?.data ?: emptyList()
                menuItemDao.insertAll(items.map { it.toEntity(canteenId) })
                Result.success(Unit)
            } else {
                Result.failure(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

data class MenuFilters(
    val vegOnly: Boolean = false,
    val availableOnly: Boolean = true,
    val categoryId: String? = null,
    val search: String? = null
)
```

#### OrderRepository

```kotlin
interface OrderRepository {
    fun getActiveOrdersFlow(userId: String): Flow<List<Order>>
    suspend fun getOrderHistory(userId: String, page: Int, limit: Int): Result<List<Order>>
    suspend fun createOrder(cartItems: List<CartItem>): Result<Order>
    suspend fun getOrderById(orderId: String): Order?
}

@Singleton
class OrderRepositoryImpl @Inject constructor(
    private val orderApi: OrderApi,
    private val orderDao: OrderDao,
    private val pendingOrderDao: PendingOrderDao,
    private val networkMonitor: NetworkMonitor,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) : OrderRepository {
    
    override fun getActiveOrdersFlow(userId: String): Flow<List<Order>> {
        return orderDao.getActiveOrders(userId).map { it.map { entity -> entity.toDomainModel() } }
    }
    
    override suspend fun createOrder(cartItems: List<CartItem>): Result<Order> = withContext(ioDispatcher) {
        if (!networkMonitor.isOnline()) {
            // Queue order for offline sync
            val pendingOrder = PendingOrder(
                id = UUID.randomUUID().toString(),
                userId = getCurrentUserId(),
                canteenId = cartItems.first().canteenId,
                items = Json.encodeToString(cartItems),
                totalAmount = cartItems.sumOf { it.price * it.quantity },
                status = PendingOrderStatus.PENDING,
                createdAt = System.currentTimeMillis()
            )
            pendingOrderDao.insert(pendingOrder)
            
            // Schedule WorkManager sync
            scheduleOrderSync()
            
            return@withContext Result.failure(OfflineOrderException("Order queued for sync"))
        }
        
        try {
            val response = orderApi.createOrder(CreateOrderRequest(cartItems))
            if (response.isSuccessful) {
                val order = response.body()?.data
                if (order != null) {
                    orderDao.insert(order.toEntity())
                    Result.success(order.toDomainModel())
                } else {
                    Result.failure(Exception("Order data missing"))
                }
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

---

## WEBSOCKET COMPONENT MAPPING

### WebSocket Event → Android Component Mapping

| WebSocket Event | Direction | Android Component | Handling Logic | Storage Impact |
|----------------|-----------|-------------------|----------------|----------------|
| **Client → Server Events** |
| `joinCanteenRooms` | C→S | `SocketManager.joinCanteenRoom()` | On connection established | NONE |
| `leaveCanteenRooms` | C→S | `SocketManager.leaveCanteenRoom()` | On disconnect/logout | NONE |
| `joinCounterRoom` | C→S | `SocketManager.joinCounterRoom()` | Owner app only | NONE |
| `joinDeliveryPersonRoom` | C→S | `SocketManager.joinDeliveryPersonRoom()` | Delivery app only | NONE |
| `ping` | C→S | `SocketManager.sendPing()` | Keepalive (every 15s) | NONE |
| **Server → Client Events** |
| `roomJoined` | S→C | `SocketManager.onRoomJoined()` | Confirmation callback | NONE |
| `pong` | S→C | `SocketManager.onPong()` | Keepalive response | NONE |
| `orderUpdate` (type: `new_order`) | S→C | `OrderRepository.handleNewOrder()` | Insert order in Room | Room (CachedOrder) |
| `orderUpdate` (type: `order_status_changed`) | S→C | `OrderRepository.handleStatusChange()` | Update order status | Room (update) |
| `orderUpdate` (type: `order_updated`) | S→C | `OrderRepository.handleOrderUpdate()` | Update order data | Room (update) |
| `orderUpdate` (type: `payment_success`) | S→C | `OrderRepository.handlePaymentSuccess()` | Update payment status | Room (update) |
| `orderUpdate` (type: `menu_updated`) | S→C | `MenuRepository.handleMenuUpdate()` | Invalidate cache, trigger refresh | Room (delete/refresh) |
| `orderUpdate` (type: `banner_updated`) | S→C | `HomeRepository.handleBannerUpdate()` | Invalidate banner cache | Room (delete/refresh) |
| `deliveryAssignment` | S→C | `DeliveryRepository.handleAssignment()` | Delivery app: show notification | Room (DeliveryAssignment) |
| `error` | S→C | `SocketManager.onError()` | Log error, emit error state | NONE |

### SocketManager Implementation

```kotlin
@Singleton
class SocketManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val userPreferences: UserPreferences,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    private var socket: Socket? = null
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    private val _orderUpdates = MutableSharedFlow<OrderUpdateEvent>(extraBufferCapacity = 10)
    val orderUpdates: SharedFlow<OrderUpdateEvent> = _orderUpdates.asSharedFlow()
    
    private val _menuUpdates = MutableSharedFlow<MenuUpdateEvent>(extraBufferCapacity = 10)
    val menuUpdates: SharedFlow<MenuUpdateEvent> = _menuUpdates.asSharedFlow()
    
    fun connect(canteenId: String) {
        if (socket?.connected() == true) {
            Log.d(TAG, "Socket already connected")
            return
        }
        
        val opts = IO.Options().apply {
            transports = arrayOf(WebSocket.NAME)
            reconnection = true
            reconnectionDelay = 1000
            reconnectionDelayMax = 8000
            timeout = 15000
        }
        
        socket = IO.socket(BuildConfig.API_URL, opts).apply {
            setupEventHandlers()
            connect()
        }
    }
    
    private fun Socket.setupEventHandlers() {
        on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            _connectionState.value = ConnectionState.Connected
            
            // Auto-join canteen room
            CoroutineScope(ioDispatcher).launch {
                val session = userPreferences.userSession.first()
                session?.selectedCanteenId?.let { joinCanteenRoom(it) }
            }
        }
        
        on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
            _connectionState.value = ConnectionState.Disconnected
        }
        
        on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG, "Connection error: ${args.getOrNull(0)}")
            _connectionState.value = ConnectionState.Error(args.getOrNull(0).toString())
        }
        
        on("roomJoined") { args ->
            val data = args.getOrNull(0) as? JSONObject
            Log.d(TAG, "Room joined: $data")
        }
        
        on("orderUpdate") { args ->
            handleOrderUpdate(args.getOrNull(0) as? JSONObject)
        }
        
        on("pong") {
            Log.v(TAG, "Pong received")
        }
        
        on("error") { args ->
            Log.e(TAG, "Socket error: ${args.getOrNull(0)}")
        }
    }
    
    private fun joinCanteenRoom(canteenId: String) {
        val payload = JSONObject().apply {
            put("canteenIds", JSONArray().put(canteenId))
        }
        socket?.emit("joinCanteenRooms", payload)
        Log.d(TAG, "Joining canteen room: $canteenId")
    }
    
    private fun handleOrderUpdate(data: JSONObject?) {
        if (data == null) return
        
        try {
            val type = data.getString("type")
            val eventData = data.getJSONObject("data")
            
            val event = when (type) {
                "new_order" -> OrderUpdateEvent.NewOrder(parseOrder(eventData))
                "order_status_changed" -> OrderUpdateEvent.StatusChanged(
                    orderId = eventData.getString("orderId"),
                    oldStatus = eventData.getString("oldStatus"),
                    newStatus = eventData.getString("newStatus")
                )
                "order_updated" -> OrderUpdateEvent.OrderUpdated(parseOrder(eventData))
                "payment_success" -> OrderUpdateEvent.PaymentSuccess(
                    orderId = eventData.getString("orderId"),
                    paymentId = eventData.getString("paymentId")
                )
                "menu_updated" -> {
                    _menuUpdates.tryEmit(MenuUpdateEvent.MenuItemsUpdated(
                        canteenId = eventData.getString("canteenId")
                    ))
                    return
                }
                "banner_updated" -> {
                    _menuUpdates.tryEmit(MenuUpdateEvent.BannersUpdated)
                    return
                }
                else -> {
                    Log.w(TAG, "Unknown order update type: $type")
                    return
                }
            }
            
            _orderUpdates.tryEmit(event)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse order update", e)
        }
    }
    
    fun sendPing() {
        socket?.emit("ping")
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _connectionState.value = ConnectionState.Disconnected
    }
    
    companion object {
        private const val TAG = "SocketManager"
    }
}

sealed class ConnectionState {
    object Connected : ConnectionState()
    object Disconnected : ConnectionState()
    object Reconnecting : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}

sealed class OrderUpdateEvent {
    data class NewOrder(val order: Order) : OrderUpdateEvent()
    data class StatusChanged(val orderId: String, val oldStatus: String, val newStatus: String) : OrderUpdateEvent()
    data class OrderUpdated(val order: Order) : OrderUpdateEvent()
    data class PaymentSuccess(val orderId: String, val paymentId: String) : OrderUpdateEvent()
}

sealed class MenuUpdateEvent {
    data class MenuItemsUpdated(val canteenId: String) : MenuUpdateEvent()
    object BannersUpdated : MenuUpdateEvent()
}
```

### WebSocket Event Handling in Repository

```kotlin
@Singleton
class OrderRepositoryImpl @Inject constructor(
    private val orderApi: OrderApi,
    private val orderDao: OrderDao,
    private val socketManager: SocketManager
) : OrderRepository {
    
    init {
        // Listen to WebSocket events
        CoroutineScope(Dispatchers.IO).launch {
            socketManager.orderUpdates.collect { event ->
                when (event) {
                    is OrderUpdateEvent.NewOrder -> handleNewOrder(event.order)
                    is OrderUpdateEvent.StatusChanged -> handleStatusChange(event)
                    is OrderUpdateEvent.OrderUpdated -> handleOrderUpdate(event.order)
                    is OrderUpdateEvent.PaymentSuccess -> handlePaymentSuccess(event)
                }
            }
        }
    }
    
    private suspend fun handleNewOrder(order: Order) {
        orderDao.insert(order.toEntity())
        Log.d(TAG, "New order inserted: ${order.id}")
    }
    
    private suspend fun handleStatusChange(event: OrderUpdateEvent.StatusChanged) {
        orderDao.updateStatus(event.orderId, event.newStatus)
        Log.d(TAG, "Order status updated: ${event.orderId} -> ${event.newStatus}")
    }
    
    private suspend fun handleOrderUpdate(order: Order) {
        orderDao.update(order.toEntity())
        Log.d(TAG, "Order updated: ${order.id}")
    }
    
    private suspend fun handlePaymentSuccess(event: OrderUpdateEvent.PaymentSuccess) {
        orderDao.updatePaymentStatus(event.orderId, "success", event.paymentId)
        Log.d(TAG, "Payment success: ${event.orderId}")
    }
}
```

---

## FOREGROUND SERVICE REQUIREMENTS

### When to Use Foreground Service

| App Type | Foreground Service | Reason |
|----------|-------------------|---------|
| **Customer App** | OPTIONAL (Not MVP) | Improves UX for real-time order updates, but not critical (push notifications + polling fallback sufficient) |
| **Delivery Person App** | REQUIRED | Must receive instant delivery assignments, WebSocket must stay alive in background |
| **Canteen Owner App** | OPTIONAL | Nice-to-have for instant order alerts, but desktop app is primary interface |

### Foreground Service Implementation (Delivery App)

```kotlin
class WebSocketForegroundService : Service() {
    
    @Inject
    lateinit var socketManager: SocketManager
    
    @Inject
    lateinit var userPreferences: UserPreferences
    
    private lateinit var notificationManager: NotificationManager
    
    override fun onCreate() {
        super.onCreate()
        (application as MyApplication).appComponent.inject(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // Connect WebSocket
        CoroutineScope(Dispatchers.IO).launch {
            val session = userPreferences.userSession.first()
            if (session != null) {
                socketManager.connect(session.selectedCanteenId ?: "")
                
                // Listen for connection state
                socketManager.connectionState.collect { state ->
                    when (state) {
                        ConnectionState.Connected -> updateNotification("Connected - Waiting for deliveries")
                        ConnectionState.Disconnected -> updateNotification("Disconnected - Reconnecting...")
                        is ConnectionState.Error -> updateNotification("Error: ${state.message}")
                        else -> {}
                    }
                }
            }
        }
        
        return START_STICKY
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sillobite Delivery")
            .setContentText("Waiting for delivery assignments...")
            .setSmallIcon(R.drawable.ic_delivery)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }
    
    private fun updateNotification(message: String) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sillobite Delivery")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_delivery)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Delivery Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps WebSocket connection alive for delivery assignments"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "websocket_service"
    }
}
```

**Service Declaration (AndroidManifest.xml)**:
```xml
<service
    android:name=".services.WebSocketForegroundService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="dataSync" />
```

**Start Service**:
```kotlin
class DeliveryActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Start foreground service
        val intent = Intent(this, WebSocketForegroundService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        
        // Stop service when app closed
        val intent = Intent(this, WebSocketForegroundService::class.java)
        stopService(intent)
    }
}
```

---

## BACKGROUND WORK STRATEGY

### WorkManager for Offline Order Sync

**Use Case**: Sync pending orders when network available

#### Worker Implementation

```kotlin
class OrderSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    @Inject
    lateinit var orderRepository: OrderRepository
    
    @Inject
    lateinit var pendingOrderDao: PendingOrderDao
    
    init {
        (context.applicationContext as MyApplication).appComponent.inject(this)
    }
    
    override suspend fun doWork(): Result {
        Log.d(TAG, "Starting order sync")
        
        val pendingOrders = pendingOrderDao.getPendingOrders()
        if (pendingOrders.isEmpty()) {
            Log.d(TAG, "No pending orders to sync")
            return Result.success()
        }
        
        var allSynced = true
        
        for (order in pendingOrders) {
            try {
                val result = syncOrder(order)
                if (result.isSuccess) {
                    pendingOrderDao.delete(order)
                    Log.d(TAG, "Order ${order.id} synced successfully")
                } else {
                    val error = result.exceptionOrNull()
                    if (error is HttpException && error.code() in 400..499) {
                        // Non-retryable error (client error)
                        pendingOrderDao.delete(order)
                        Log.e(TAG, "Order ${order.id} rejected by server: ${error.message()}")
                    } else {
                        // Retryable error (5xx, network)
                        pendingOrderDao.update(order.copy(
                            retryCount = order.retryCount + 1,
                            lastRetryAt = System.currentTimeMillis()
                        ))
                        allSynced = false
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync order ${order.id}", e)
                allSynced = false
            }
        }
        
        return if (allSynced) {
            Result.success()
        } else {
            Result.retry()
        }
    }
    
    private suspend fun syncOrder(pendingOrder: PendingOrder): kotlin.Result<Order> {
        val cartItems = Json.decodeFromString<List<CartItem>>(pendingOrder.items)
        return orderRepository.createOrder(cartItems)
    }
    
    companion object {
        private const val TAG = "OrderSyncWorker"
    }
}
```

#### Schedule WorkManager

```kotlin
@Singleton
class WorkManagerScheduler @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    fun scheduleOrderSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        
        val syncRequest = OneTimeWorkRequestBuilder<OrderSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                1, TimeUnit.MINUTES
            )
            .addTag("order_sync")
            .build()
        
        WorkManager.getInstance(context).enqueueUniqueWork(
            "order_sync",
            ExistingWorkPolicy.KEEP,
            syncRequest
        )
        
        Log.d(TAG, "Order sync scheduled")
    }
    
    fun cancelOrderSync() {
        WorkManager.getInstance(context).cancelUniqueWork("order_sync")
    }
    
    companion object {
        private const val TAG = "WorkManagerScheduler"
    }
}
```

### What Runs in Background vs Foreground

| Operation | Execution Context | Component | Notes |
|-----------|-------------------|-----------|-------|
| **WebSocket Connection (Customer App)** | Foreground only (OPTIONAL background via service) | SocketManager | Connection drops when app backgrounded (Android restrictions) |
| **WebSocket Connection (Delivery App)** | Foreground + Background (via Foreground Service) | WebSocketForegroundService | REQUIRED for instant delivery assignments |
| **Offline Order Sync** | Background (WorkManager) | OrderSyncWorker | Triggered when network available |
| **API Calls** | Foreground + Background (WorkManager) | Repository + Retrofit | Background API calls via WorkManager only |
| **FCM Notifications** | Background (FCM wakes app) | FirebaseMessagingService | System handles wake-up |
| **Database Operations** | Foreground + Background | Room DAOs | Safe from any context |
| **SharedPreferences/DataStore** | Foreground + Background | UserPreferences | Safe from any context |

---

## LOCAL STORAGE STRATEGY

### Storage Decision Matrix

| Data Type | Storage | Reason | TTL | Example |
|-----------|---------|--------|-----|---------|
| **User Session** | SharedPreferences / DataStore | Small key-value data, fast access | Permanent (until logout) | userId, authToken, email |
| **Menu Items** | Room Database | Complex data, queryable, offline browsing | 5 minutes (configurable) | MenuItem, Category |
| **Cart Items** | Room Database | Persistent across app restarts | Permanent (until order placed) | CartItem |
| **Active Orders** | Room Database | Real-time updates, query by status | Permanent (until delivered) | Order |
| **Order History** | Room Database | Paginated list, search | 7 days (cache) | Order |
| **Pending Orders** | Room Database | Offline queue for WorkManager | Until synced | PendingOrder |
| **FCM Token** | SharedPreferences / DataStore | Single value, infrequent access | Permanent (until app uninstall) | fcmToken |
| **App Settings** | SharedPreferences / DataStore | User preferences (theme, notifications) | Permanent | darkMode, notificationsEnabled |
| **Image Cache** | Coil Disk Cache | Large binary data | 30 days (Coil default) | Menu item images |

### Room Database Schema

```kotlin
@Database(
    entities = [
        // User & Auth
        CachedUser::class,
        
        // Menu
        CachedMenuItem::class,
        CachedCategory::class,
        
        // Cart & Orders
        CartItem::class,
        CachedOrder::class,
        PendingOrder::class,
        
        // Payments
        CachedPayment::class,
        
        // Home Screen
        CachedBanner::class
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    
    // DAOs
    abstract fun userDao(): UserDao
    abstract fun menuItemDao(): MenuItemDao
    abstract fun categoryDao(): CategoryDao
    abstract fun cartItemDao(): CartItemDao
    abstract fun orderDao(): OrderDao
    abstract fun pendingOrderDao(): PendingOrderDao
    abstract fun paymentDao(): PaymentDao
    abstract fun bannerDao(): BannerDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sillobite_db"
                )
                    .addMigrations(MIGRATION_1_2) // Add migrations as needed
                    .fallbackToDestructiveMigration() // Development only
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
```

### Type Converters

```kotlin
class Converters {
    @TypeConverter
    fun fromOrderItemList(value: List<OrderItem>): String {
        return Json.encodeToString(value)
    }
    
    @TypeConverter
    fun toOrderItemList(value: String): List<OrderItem> {
        return Json.decodeFromString(value)
    }
    
    @TypeConverter
    fun fromStringList(value: List<String>): String {
        return Json.encodeToString(value)
    }
    
    @TypeConverter
    fun toStringList(value: String): List<String> {
        return Json.decodeFromString(value)
    }
}
```

### Cache Invalidation Strategy

```kotlin
@Singleton
class CacheManager @Inject constructor(
    private val menuItemDao: MenuItemDao,
    private val categoryDao: CategoryDao,
    private val orderDao: OrderDao,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    
    suspend fun invalidateMenuCache(canteenId: String) = withContext(ioDispatcher) {
        val expiryTime = System.currentTimeMillis() - MENU_CACHE_TTL
        menuItemDao.deleteExpired(expiryTime)
        Log.d(TAG, "Menu cache invalidated for canteen: $canteenId")
    }
    
    suspend fun invalidateOrderCache(olderThan: Long = 7 * 24 * 60 * 60 * 1000L) = withContext(ioDispatcher) {
        val expiryTime = System.currentTimeMillis() - olderThan
        orderDao.deleteExpired(expiryTime)
        Log.d(TAG, "Order cache invalidated")
    }
    
    suspend fun clearAllCache() = withContext(ioDispatcher) {
        menuItemDao.deleteAll()
        categoryDao.deleteAll()
        orderDao.deleteAll()
        Log.d(TAG, "All cache cleared")
    }
    
    companion object {
        private const val TAG = "CacheManager"
        private const val MENU_CACHE_TTL = 5 * 60 * 1000L // 5 minutes
    }
}
```

---

## DEPENDENCY INJECTION SETUP

### Hilt Modules

#### AppModule (Application-level dependencies)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return AppDatabase.getDatabase(context)
    }
    
    @Provides
    @Singleton
    fun provideUserPreferences(@ApplicationContext context: Context): UserPreferences {
        return UserPreferences(context)
    }
    
    @Provides
    @Singleton
    fun provideWorkManagerScheduler(@ApplicationContext context: Context): WorkManagerScheduler {
        return WorkManagerScheduler(context)
    }
    
    @Provides
    @Singleton
    fun provideNetworkMonitor(@ApplicationContext context: Context): NetworkMonitor {
        return NetworkMonitor(context)
    }
    
    @Provides
    @IoDispatcher
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO
    
    @Provides
    @MainDispatcher
    fun provideMainDispatcher(): CoroutineDispatcher = Dispatchers.Main
}

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class IoDispatcher

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class MainDispatcher
```

#### NetworkModule (Retrofit + OkHttp)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        userPreferences: UserPreferences
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                
                // Add auth token if available
                runBlocking {
                    val session = userPreferences.userSession.first()
                    session?.authToken?.let { token ->
                        request.addHeader("Authorization", "Bearer $token")
                    }
                }
                
                chain.proceed(request.build())
            }
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
    
    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi {
        return retrofit.create(AuthApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideMenuApi(retrofit: Retrofit): MenuApi {
        return retrofit.create(MenuApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideOrderApi(retrofit: Retrofit): OrderApi {
        return retrofit.create(OrderApi::class.java)
    }
    
    @Provides
    @Singleton
    fun providePaymentApi(retrofit: Retrofit): PaymentApi {
        return retrofit.create(PaymentApi::class.java)
    }
}
```

#### RepositoryModule (Repository bindings)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    
    @Binds
    @Singleton
    abstract fun bindAuthRepository(
        impl: AuthRepositoryImpl
    ): AuthRepository
    
    @Binds
    @Singleton
    abstract fun bindMenuRepository(
        impl: MenuRepositoryImpl
    ): MenuRepository
    
    @Binds
    @Singleton
    abstract fun bindOrderRepository(
        impl: OrderRepositoryImpl
    ): OrderRepository
    
    @Binds
    @Singleton
    abstract fun bindPaymentRepository(
        impl: PaymentRepositoryImpl
    ): PaymentRepository
    
    @Binds
    @Singleton
    abstract fun bindCartRepository(
        impl: CartRepositoryImpl
    ): CartRepository
}
```

#### DatabaseModule (DAO providers)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    
    @Provides
    fun provideUserDao(database: AppDatabase): UserDao {
        return database.userDao()
    }
    
    @Provides
    fun provideMenuItemDao(database: AppDatabase): MenuItemDao {
        return database.menuItemDao()
    }
    
    @Provides
    fun provideCategoryDao(database: AppDatabase): CategoryDao {
        return database.categoryDao()
    }
    
    @Provides
    fun provideCartItemDao(database: AppDatabase): CartItemDao {
        return database.cartItemDao()
    }
    
    @Provides
    fun provideOrderDao(database: AppDatabase): OrderDao {
        return database.orderDao()
    }
    
    @Provides
    fun providePendingOrderDao(database: AppDatabase): PendingOrderDao {
        return database.pendingOrderDao()
    }
    
    @Provides
    fun providePaymentDao(database: AppDatabase): PaymentDao {
        return database.paymentDao()
    }
}
```

---

## COMPLETE COMPONENT CATALOG

### Customer App MVP Component Breakdown

#### Presentation Layer (UI + ViewModel)

| Screen | Activity/Fragment | ViewModel | Use Cases | Repository Dependencies |
|--------|-------------------|-----------|-----------|------------------------|
| **Authentication** |
| Login | `LoginActivity` | `LoginViewModel` | `LoginUseCase`, `GoogleSignInUseCase` | `AuthRepository` |
| Register | `RegisterActivity` | `RegisterViewModel` | `RegisterUseCase` | `AuthRepository` |
| Profile Setup | `ProfileSetupActivity` | `ProfileSetupViewModel` | `UpdateUserUseCase`, `GetLocationsUseCase` | `UserRepository`, `LocationRepository` |
| **Home** |
| Home Screen | `HomeFragment` | `HomeViewModel` | `GetHomeDataUseCase`, `GetActiveOrdersUseCase` | `HomeRepository`, `OrderRepository` |
| **Menu** |
| Menu List | `MenuListFragment` | `MenuViewModel` | `GetMenuUseCase`, `RefreshMenuUseCase`, `SearchMenuUseCase` | `MenuRepository` |
| Menu Item Detail | `MenuItemDetailFragment` | `MenuItemDetailViewModel` | `GetMenuItemByIdUseCase`, `AddToCartUseCase` | `MenuRepository`, `CartRepository` |
| **Cart & Checkout** |
| Cart | `CartFragment` | `CartViewModel` | `GetCartItemsUseCase`, `UpdateCartUseCase`, `ClearCartUseCase` | `CartRepository` |
| Checkout | `CheckoutFragment` | `CheckoutViewModel` | `CreateCheckoutSessionUseCase`, `PlaceOrderUseCase` | `CheckoutRepository`, `OrderRepository` |
| **Payment** |
| Payment | `PaymentActivity` | `PaymentViewModel` | `InitiatePaymentUseCase`, `VerifyPaymentUseCase` | `PaymentRepository` |
| **Orders** |
| Active Orders | `ActiveOrdersFragment` | `ActiveOrdersViewModel` | `GetActiveOrdersUseCase`, `RefreshOrdersUseCase` | `OrderRepository` |
| Order History | `OrderHistoryFragment` | `OrderHistoryViewModel` | `GetOrderHistoryUseCase` | `OrderRepository` |
| Order Detail | `OrderDetailFragment` | `OrderDetailViewModel` | `GetOrderByIdUseCase` | `OrderRepository` |
| **Profile** |
| Profile | `ProfileFragment` | `ProfileViewModel` | `GetCurrentUserUseCase`, `UpdateUserUseCase`, `LogoutUseCase` | `UserRepository`, `AuthRepository` |
| Settings | `SettingsFragment` | `SettingsViewModel` | `GetSettingsUseCase`, `UpdateSettingsUseCase` | `SettingsRepository` |

**Total Components**: 14 screens, 14 ViewModels, 25+ Use Cases, 10+ Repositories

---

#### Domain Layer (Use Cases)

| Use Case | Repository | Returns | Notes |
|----------|-----------|---------|-------|
| **Authentication** |
| `LoginUseCase` | `AuthRepository` | `Result<User>` | Email/password login |
| `RegisterUseCase` | `AuthRepository` | `Result<User>` | Create new user |
| `GoogleSignInUseCase` | `AuthRepository` | `Result<User>` | Google OAuth flow |
| `ValidateSessionUseCase` | `AuthRepository` | `Result<User?>` | On app launch |
| `LogoutUseCase` | `AuthRepository` | `Result<Unit>` | Clear session |
| **User** |
| `GetCurrentUserUseCase` | `UserRepository` | `Flow<User?>` | Observe user changes |
| `UpdateUserUseCase` | `UserRepository` | `Result<User>` | Profile updates |
| `UpdateLocationUseCase` | `UserRepository` | `Result<Unit>` | Canteen selection |
| **Menu** |
| `GetMenuUseCase` | `MenuRepository` | `Flow<List<MenuItem>>` | Observe menu changes |
| `RefreshMenuUseCase` | `MenuRepository` | `Result<Unit>` | Pull-to-refresh |
| `SearchMenuUseCase` | `MenuRepository` | `Result<List<MenuItem>>` | Search by query |
| `GetMenuItemByIdUseCase` | `MenuRepository` | `MenuItem?` | Single item detail |
| **Cart** |
| `GetCartItemsUseCase` | `CartRepository` | `Flow<List<CartItem>>` | Observe cart changes |
| `AddToCartUseCase` | `CartRepository` | `Result<Unit>` | Add item to cart |
| `UpdateCartItemUseCase` | `CartRepository` | `Result<Unit>` | Update quantity |
| `RemoveFromCartUseCase` | `CartRepository` | `Result<Unit>` | Remove item |
| `ClearCartUseCase` | `CartRepository` | `Result<Unit>` | After order placed |
| **Orders** |
| `PlaceOrderUseCase` | `OrderRepository`, `CartRepository` | `Result<Order>` | Create order from cart |
| `GetActiveOrdersUseCase` | `OrderRepository` | `Flow<List<Order>>` | Real-time updates |
| `GetOrderHistoryUseCase` | `OrderRepository` | `Result<List<Order>>` | Paginated history |
| `GetOrderByIdUseCase` | `OrderRepository` | `Order?` | Single order detail |
| **Payment** |
| `InitiatePaymentUseCase` | `PaymentRepository` | `Result<RazorpayOrder>` | Create Razorpay order |
| `VerifyPaymentUseCase` | `PaymentRepository` | `Result<Payment>` | After Razorpay callback |
| **Home** |
| `GetHomeDataUseCase` | `HomeRepository` | `Result<HomeData>` | Banners, trending, quick picks |

**Total Use Cases**: 25+ use cases

---

#### Data Layer (Repositories + Data Sources)

**Repositories**:

| Repository | Remote Source | Local Source | Sync Strategy |
|------------|---------------|--------------|---------------|
| `AuthRepository` | `AuthApi` | `UserPreferences` (session) | Write-through (save to local after API success) |
| `UserRepository` | `UserApi` | `UserDao` (Room) | Network-bound (fetch from API, update local) |
| `MenuRepository` | `MenuApi` | `MenuItemDao` (Room) | Cache-first (read from Room, refresh from API) |
| `CategoryRepository` | `CategoryApi` | `CategoryDao` (Room) | Cache-first |
| `CartRepository` | NONE | `CartItemDao` (Room) | Local-only |
| `OrderRepository` | `OrderApi` | `OrderDao`, `PendingOrderDao` (Room) | Network-bound + offline queue |
| `PaymentRepository` | `PaymentApi` | `PaymentDao` (Room) | Network-bound |
| `HomeRepository` | `HomeApi` | `BannerDao` (Room) | Cache-first |
| `CheckoutRepository` | `CheckoutApi` | NONE (ephemeral) | Network-only |
| `LocationRepository` | `LocationApi` | `LocationDao` (Room) | Cache-first |

**Total Repositories**: 10 repositories

**Retrofit API Interfaces**: 8+ interfaces (AuthApi, UserApi, MenuApi, OrderApi, PaymentApi, HomeApi, CheckoutApi, LocationApi)

**Room DAOs**: 10+ DAOs (UserDao, MenuItemDao, CategoryDao, CartItemDao, OrderDao, PendingOrderDao, PaymentDao, BannerDao, LocationDao)

**Room Entities**: 10+ entities (CachedUser, CachedMenuItem, CachedCategory, CartItem, CachedOrder, PendingOrder, CachedPayment, CachedBanner, CachedLocation)

---

#### Services Layer

| Component | Type | Purpose | Required For |
|-----------|------|---------|-------------|
| `WebSocketForegroundService` | Foreground Service | Maintain WebSocket connection in background | Delivery App (MUST), Customer App (OPTIONAL) |
| `OrderSyncWorker` | WorkManager Worker | Sync pending orders when network available | Customer App (MUST) |
| `CacheCleanupWorker` | WorkManager Worker | Clean expired cache (periodic) | Customer App (OPTIONAL) |
| `FirebaseMessagingService` | FCM Service | Receive push notifications | Customer App (MUST) |

---

### Architecture Flow Examples

#### Example 1: Menu Browsing Flow

```
[User opens Menu Screen]
         ↓
[MenuFragment] observes MenuViewModel.uiState
         ↓
[MenuViewModel] calls GetMenuUseCase(canteenId)
         ↓
[GetMenuUseCase] calls MenuRepository.getMenuItemsFlow(canteenId)
         ↓
[MenuRepository] returns Flow<List<MenuItem>> from MenuItemDao
         ↓
[MenuItemDao] queries Room Database (cached menu)
         ↓
[MenuFragment] displays menu items

[Background refresh triggered]
         ↓
[MenuViewModel] calls RefreshMenuUseCase(canteenId)
         ↓
[RefreshMenuUseCase] calls MenuRepository.refreshMenu(canteenId)
         ↓
[MenuRepository] calls MenuApi.getMenu(canteenId)
         ↓
[Retrofit] sends GET /api/menu?canteenId=X
         ↓
[Server] returns menu items
         ↓
[MenuRepository] inserts items into MenuItemDao (Room)
         ↓
[MenuItemDao] updates Room Database
         ↓
[Room] emits new data via Flow<List<MenuItem>>
         ↓
[MenuViewModel] receives updated data
         ↓
[MenuFragment] automatically updates UI (reactive)
```

---

#### Example 2: Order Placement Flow (Online)

```
[User clicks "Place Order" in CartFragment]
         ↓
[CartViewModel] calls PlaceOrderUseCase(cartItems)
         ↓
[PlaceOrderUseCase] checks network connectivity
         ↓
[NetworkMonitor] returns true (online)
         ↓
[PlaceOrderUseCase] calls OrderRepository.createOrder(cartItems)
         ↓
[OrderRepository] calls OrderApi.createOrder(request)
         ↓
[Retrofit] sends POST /api/orders
         ↓
[Server] creates order, deducts stock, generates barcode
         ↓
[Server] returns Order with status=pending
         ↓
[OrderRepository] inserts order into OrderDao (Room)
         ↓
[PlaceOrderUseCase] calls CartRepository.clearCart()
         ↓
[CartRepository] clears CartItemDao (Room)
         ↓
[CartViewModel] navigates to PaymentActivity
         ↓
[PaymentViewModel] calls InitiatePaymentUseCase(orderId)
         ↓
[PaymentRepository] calls PaymentApi.initiatePayment(orderId)
         ↓
[Retrofit] sends POST /api/payments/initiate
         ↓
[Server] creates Razorpay order
         ↓
[Server] returns razorpayOrderId, amount
         ↓
[PaymentViewModel] launches Razorpay SDK
         ↓
[Razorpay SDK] opens payment UI (native modal)
         ↓
[User completes payment]
         ↓
[Razorpay SDK] calls onPaymentSuccess(razorpayPaymentId)
         ↓
[PaymentViewModel] calls VerifyPaymentUseCase(razorpayPaymentId, razorpayOrderId)
         ↓
[PaymentRepository] calls PaymentApi.verifyPayment(request)
         ↓
[Retrofit] sends POST /api/payments/verify
         ↓
[Server] verifies signature, updates order.paymentStatus
         ↓
[Server] broadcasts WebSocket event: orderUpdate (type: payment_success)
         ↓
[SocketManager] receives event
         ↓
[OrderRepository] handles PaymentSuccessEvent, updates OrderDao
         ↓
[OrderDao] updates order in Room Database
         ↓
[ActiveOrdersViewModel] observes OrderDao.getActiveOrders()
         ↓
[Room] emits updated order via Flow
         ↓
[ActiveOrdersFragment] displays "Payment Successful"
```

---

#### Example 3: Order Placement Flow (Offline)

```
[User clicks "Place Order" in CartFragment]
         ↓
[CartViewModel] calls PlaceOrderUseCase(cartItems)
         ↓
[PlaceOrderUseCase] checks network connectivity
         ↓
[NetworkMonitor] returns false (offline)
         ↓
[PlaceOrderUseCase] calls OrderRepository.queueOrderOffline(cartItems)
         ↓
[OrderRepository] creates PendingOrder entity
         ↓
[OrderRepository] inserts into PendingOrderDao (Room)
         ↓
[OrderRepository] schedules WorkManager sync
         ↓
[WorkManagerScheduler] enqueues OrderSyncWorker with NetworkType.CONNECTED constraint
         ↓
[PlaceOrderUseCase] returns Result.failure(OfflineOrderException)
         ↓
[CartViewModel] shows Toast: "Order queued, will sync when online"
         ↓
[CartViewModel] clears cart (optimistic UX)
         ↓

[User connects to network]
         ↓
[WorkManager] detects network connectivity
         ↓
[OrderSyncWorker] executes doWork()
         ↓
[OrderSyncWorker] fetches PendingOrderDao.getPendingOrders()
         ↓
[PendingOrderDao] returns list of pending orders
         ↓
[OrderSyncWorker] loops through each pending order
         ↓
[OrderSyncWorker] calls OrderApi.createOrder(request)
         ↓
[Retrofit] sends POST /api/orders
         ↓
[Server] processes order
         ↓
[Server] returns success: Order created
         ↓
[OrderSyncWorker] inserts order into OrderDao (Room)
         ↓
[OrderSyncWorker] deletes pending order from PendingOrderDao
         ↓
[OrderSyncWorker] returns Result.success()
         ↓
[WorkManager] completes worker
         ↓
[ActiveOrdersViewModel] observes OrderDao.getActiveOrders()
         ↓
[Room] emits new order via Flow
         ↓
[ActiveOrdersFragment] displays synced order
```

---

#### Example 4: Real-Time Order Status Update

```
[Canteen staff marks order as "ready" on web dashboard]
         ↓
[Server] updates Order.status = "ready" in MongoDB
         ↓
[Server] broadcasts WebSocket event to canteen_${canteenId} room:
  {
    type: "orderUpdate",
    data: {
      type: "order_status_changed",
      orderId: "123",
      oldStatus: "preparing",
      newStatus: "ready"
    }
  }
         ↓
[SocketManager] (running in app or foreground service) receives event
         ↓
[SocketManager] parses event, creates OrderUpdateEvent.StatusChanged
         ↓
[SocketManager] emits event via MutableSharedFlow<OrderUpdateEvent>
         ↓
[OrderRepository] (subscribed to orderUpdates) receives event
         ↓
[OrderRepository] calls OrderDao.updateStatus(orderId, "ready")
         ↓
[OrderDao] updates order in Room Database
         ↓
[Room] emits updated order via Flow<List<Order>>
         ↓
[ActiveOrdersViewModel] observes flow, receives updated order
         ↓
[ActiveOrdersFragment] automatically updates UI (reactive)
         ↓
[ActiveOrdersFragment] shows "Your order is ready for pickup!"

[Simultaneously]
         ↓
[Server] sends push notification via FCM:
  {
    "title": "Order Ready",
    "body": "Your order #123 is ready for pickup",
    "data": { "orderId": "123", "status": "ready" }
  }
         ↓
[FCM] delivers notification to device
         ↓
[FirebaseMessagingService] receives notification in onMessageReceived()
         ↓
[FirebaseMessagingService] displays system notification
         ↓
[User taps notification]
         ↓
[NotificationManager] launches app with deep link: app://orders/123
         ↓
[MainActivity] handles deep link, navigates to OrderDetailFragment
         ↓
[OrderDetailViewModel] calls GetOrderByIdUseCase("123")
         ↓
[OrderRepository] returns order from OrderDao (already updated via WebSocket)
         ↓
[OrderDetailFragment] displays order details with status="ready"
```

---

## CAPABILITY → ANDROID COMPONENT MAPPING

### Authentication & User Management

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Google OAuth Login** | `GET /api/auth/google`, `POST /api/auth/google/verify` | NONE | `LoginViewModel` → `GoogleSignInUseCase` → `AuthRepository` → Google Sign-In SDK | SharedPreferences (userId, email, authToken) | Foreground (user-initiated) |
| **Email/Password Login** | `POST /api/auth/login` | NONE | `LoginViewModel` → `LoginUseCase` → `AuthRepository` → `AuthApi` | SharedPreferences (userId, email, authToken) | Foreground (user-initiated) |
| **Register** | `POST /api/auth/register` | NONE | `RegisterViewModel` → `RegisterUseCase` → `AuthRepository` → `AuthApi` | SharedPreferences (userId, email, authToken) | Foreground (user-initiated) |
| **Session Validation** | `GET /api/users/:id/validate` | NONE | `SplashViewModel` → `ValidateSessionUseCase` → `AuthRepository` → `AuthApi` | SharedPreferences (read session) | Foreground (app launch) |
| **Logout** | `POST /api/auth/logout` | NONE | `ProfileViewModel` → `LogoutUseCase` → `AuthRepository` → `AuthApi` + `UserPreferences.clearUserSession()` | SharedPreferences (clear all) | Foreground (user-initiated) |
| **Profile Setup** | `PUT /api/users/:id`, `PUT /api/users/:id/location` | NONE | `ProfileSetupViewModel` → `UpdateUserUseCase` → `UserRepository` → `UserApi` | Room (CachedUser), SharedPreferences (selectedCanteenId) | Foreground (user-initiated) |

---

### Menu Browsing

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Menu Item List** | `GET /api/menu` | `orderUpdate` (type: `menu_updated`) | `MenuViewModel` → `GetMenuUseCase` → `MenuRepository` → `MenuApi` + `MenuItemDao` | Room (CachedMenuItem, TTL=5min) | Foreground (user browsing) |
| **Menu Item Detail** | `GET /api/menu/:id` | NONE | `MenuItemDetailViewModel` → `GetMenuItemByIdUseCase` → `MenuRepository` → `MenuItemDao` (Room) | Room (CachedMenuItem) | Foreground (user viewing) |
| **Category List** | `GET /api/categories` | NONE | `MenuViewModel` → `GetCategoriesUseCase` → `CategoryRepository` → `CategoryApi` + `CategoryDao` | Room (CachedCategory, TTL=5min) | Foreground (user browsing) |
| **Menu Search** | `GET /api/menu?search=` | NONE | `MenuViewModel` → `SearchMenuUseCase` → `MenuRepository` → `MenuApi` | NONE (live search) | Foreground (user typing) |
| **Stock Display** | `GET /api/menu` (stock field) | `orderUpdate` (type: `menu_updated`) | `MenuViewModel` observes `MenuRepository.getMenuItemsFlow()` → `MenuItemDao` (Room) | Room (CachedMenuItem.stock, updated via WebSocket) | Foreground (real-time) |
| **Home Screen Content** | `GET /api/home-data` | `orderUpdate` (type: `banner_updated`) | `HomeViewModel` → `GetHomeDataUseCase` → `HomeRepository` → `HomeApi` + `BannerDao` | Room (CachedBanner, CachedMenuItem) | Foreground (user on home screen) |

**WebSocket Integration**:
- `SocketManager` subscribes to `orderUpdate` events with type `menu_updated`
- On event received: `MenuRepository.handleMenuUpdate()` → `MenuItemDao.deleteExpired()` → Trigger refresh from API
- UI automatically updates via Flow (reactive)

---

### Shopping Cart

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Add to Cart** | NONE (client-side) | NONE | `MenuItemDetailViewModel` → `AddToCartUseCase` → `CartRepository` → `CartItemDao` | Room (CartItem) | Foreground (user action) |
| **View Cart** | NONE (client-side) | NONE | `CartViewModel` → `GetCartItemsUseCase` → `CartRepository` → `CartItemDao` | Room (CartItem) | Foreground (user viewing cart) |
| **Update Quantity** | NONE (client-side) | NONE | `CartViewModel` → `UpdateCartItemUseCase` → `CartRepository` → `CartItemDao` | Room (CartItem.quantity updated) | Foreground (user action) |
| **Remove from Cart** | NONE (client-side) | NONE | `CartViewModel` → `RemoveFromCartUseCase` → `CartRepository` → `CartItemDao.delete()` | Room (CartItem deleted) | Foreground (user action) |
| **Clear Cart** | NONE (client-side) | NONE | `PlaceOrderUseCase` → `CartRepository.clearCart()` → `CartItemDao.deleteAll()` | Room (all CartItems deleted) | Foreground (after order placed) |

**Notes**:
- Cart is **100% local** (no API calls until checkout)
- Cart persists across app restarts (Room Database)
- Cart validation happens at checkout (validate stock availability, price changes)

---

### Order Management

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Place Order (Online)** | `POST /api/orders` | `orderUpdate` (type: `new_order`) | `CheckoutViewModel` → `PlaceOrderUseCase` → `OrderRepository` → `OrderApi` | Room (CachedOrder) | Foreground (user action) |
| **Place Order (Offline)** | `POST /api/orders` (delayed) | NONE | `CheckoutViewModel` → `PlaceOrderUseCase` → `OrderRepository` → `PendingOrderDao` → `WorkManager` (OrderSyncWorker) | Room (PendingOrder) | Foreground (user action) + Background (sync worker) |
| **Active Orders** | `GET /api/orders/user/:userId/active` | `orderUpdate` (type: `order_status_changed`) | `ActiveOrdersViewModel` → `GetActiveOrdersUseCase` → `OrderRepository` → `OrderDao` | Room (CachedOrder) | Foreground (user viewing) + Background (WebSocket updates) |
| **Order History** | `GET /api/orders/user/:userId/history` | NONE | `OrderHistoryViewModel` → `GetOrderHistoryUseCase` → `OrderRepository` → `OrderApi` + `OrderDao` | Room (CachedOrder, paginated) | Foreground (user viewing history) |
| **Order Detail** | `GET /api/orders/:id` | `orderUpdate` (type: `order_updated`) | `OrderDetailViewModel` → `GetOrderByIdUseCase` → `OrderRepository` → `OrderDao` | Room (CachedOrder) | Foreground (user viewing detail) |
| **Real-Time Status Updates** | NONE | `orderUpdate` (type: `order_status_changed`) | `SocketManager` → `OrderRepository.handleStatusChange()` → `OrderDao.updateStatus()` | Room (CachedOrder.status updated) | Background (WebSocket) |

**WebSocket Integration**:
- `SocketManager` subscribes to `orderUpdate` events
- Event types: `new_order`, `order_status_changed`, `order_updated`, `payment_success`
- On event received: `OrderRepository` updates Room Database
- UI automatically updates via Flow (reactive)

---

### Payment Processing

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Initiate Payment** | `POST /api/payments/initiate` | NONE | `PaymentViewModel` → `InitiatePaymentUseCase` → `PaymentRepository` → `PaymentApi` | Room (CachedPayment, status=pending) | Foreground (after order placed) |
| **Razorpay Checkout** | NONE (client SDK) | NONE | `PaymentViewModel` → Razorpay SDK → `onPaymentSuccess()` callback | NONE | Foreground (Razorpay modal) |
| **Verify Payment** | `POST /api/payments/verify` | `orderUpdate` (type: `payment_success`) | `PaymentViewModel` → `VerifyPaymentUseCase` → `PaymentRepository` → `PaymentApi` | Room (CachedPayment.status=success) | Foreground (after Razorpay callback) |
| **Payment Status Polling** | `GET /api/payments/status/:id` | NONE | `PaymentViewModel` → `GetPaymentStatusUseCase` → `PaymentRepository` → `PaymentApi` | Room (CachedPayment updated) | Foreground (fallback if webhook delayed) |
| **Checkout Session** | `POST /api/checkout-sessions`, `GET /api/checkout-sessions/:id` | NONE | `CheckoutViewModel` → `CreateCheckoutSessionUseCase` → `CheckoutRepository` → `CheckoutApi` | NONE (ephemeral, no local storage) | Foreground (before payment) |

**Razorpay Integration**:
- `PaymentViewModel` uses Razorpay Android SDK: `com.razorpay:checkout:1.6.33`
- Payment flow: Initiate → Razorpay Modal → Success/Failure Callback → Verify on server
- Supports: UPI, Cards, Wallets, NetBanking

---

### Push Notifications

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Subscribe to Push** | `POST /api/push/subscribe` | NONE | `FirebaseMessagingService.onNewToken()` → `NotificationRepository` → `PushApi` | SharedPreferences (fcmToken) | Background (FCM token received) |
| **Unsubscribe from Push** | `POST /api/push/unsubscribe` | NONE | `LogoutUseCase` → `NotificationRepository` → `PushApi` | SharedPreferences (fcmToken cleared) | Foreground (logout) |
| **Receive Order Notification** | NONE | NONE (FCM) | `FirebaseMessagingService.onMessageReceived()` → `NotificationManager.notify()` | NONE | Background (FCM delivers) |
| **Handle Notification Tap** | NONE | NONE | `MainActivity.handleIntent()` → Deep Link → `OrderDetailFragment` | NONE | Foreground (user taps notification) |

**FCM Integration**:
- **Library**: `com.google.firebase:firebase-messaging:23.4.0`
- **Permission**: `android.permission.POST_NOTIFICATIONS` (Android 13+)
- **Notification Channels**: "Order Updates", "Delivery Alerts"
- **Notification Types**: Order status changed, payment success, order ready

---

### Offline Support

| Backend Capability | REST API | Socket Event | Android Components | Storage | Execution Context |
|--------------------|----------|--------------|-------------------|---------|-------------------|
| **Offline Menu Browsing** | NONE (local cache) | NONE | `MenuViewModel` → `GetMenuUseCase` → `MenuRepository` → `MenuItemDao` | Room (CachedMenuItem, TTL=5min) | Foreground (offline mode) |
| **Offline Cart Management** | NONE (local cart) | NONE | `CartViewModel` → `CartRepository` → `CartItemDao` | Room (CartItem) | Foreground (offline mode) |
| **Queue Order Offline** | NONE (queued locally) | NONE | `PlaceOrderUseCase` → `OrderRepository` → `PendingOrderDao` → `WorkManager` | Room (PendingOrder) | Foreground (offline order placement) |
| **Sync Orders in Background** | `POST /api/orders` (retried) | NONE | `OrderSyncWorker` → `OrderRepository` → `OrderApi` | Room (PendingOrder → CachedOrder) | Background (WorkManager) |
| **Cache Cleanup** | NONE | NONE | `CacheCleanupWorker` → `CacheManager` → DAOs | Room (delete expired entries) | Background (WorkManager, periodic) |

**Offline Strategy**:
- **Cache-First**: Read from Room Database, refresh from API in background
- **Network-Bound Resource**: Fetch from API → Update Room → UI observes Room via Flow
- **Offline Queue**: Write to PendingOrderDao → WorkManager syncs when online (NetworkType.CONNECTED)
- **TTL**: Menu items expire after 5 minutes, orders never expire (unless delivered)

---

## SUMMARY

### Layer Responsibilities

| Layer | Responsibilities | Components | Android Lifecycle |
|-------|-----------------|------------|------------------|
| **Presentation** | Display data, handle user input, navigate | Activities, Fragments, Compose Screens, ViewModels | Tied to UI lifecycle (onCreate, onDestroy) |
| **Domain** | Business logic, independent of frameworks | Use Cases, Domain Models | No lifecycle (pure Kotlin) |
| **Data** | Manage data from multiple sources (network, database, cache) | Repositories, Retrofit APIs, Room DAOs, Socket.IO, SharedPreferences | Singleton (injected via Hilt) |
| **Services** | Background operations, long-running tasks | Foreground Service, WorkManager Workers, FCM Service | Managed by Android OS |

---

### REST API Logic Location

| REST API Endpoint | Lives In | Layer | Access Via |
|-------------------|----------|-------|------------|
| All API calls | Retrofit interface (e.g., `MenuApi`, `OrderApi`) | Data Layer (Remote Source) | Repository |
| API response parsing | Repository implementation | Data Layer | Mapper functions (DTO → Entity → Domain Model) |
| API error handling | Repository implementation | Data Layer | `try/catch` → `Result<T>` |
| API authentication | OkHttp Interceptor | Data Layer | Inject auth token from UserPreferences |
| API timeout | OkHttpClient configuration | Data Layer | 15s connect/read/write timeout |
| API retry logic | Repository implementation OR WorkManager | Data Layer | Manual retry OR WorkManager backoff |

**Key Point**: ViewModels and Use Cases **NEVER** call Retrofit directly. They only call Repository interfaces.

---

### WebSocket Logic Location

| WebSocket Concern | Lives In | Layer | Access Via |
|-------------------|----------|-------|------------|
| Socket connection management | `SocketManager` | Data Layer | Singleton (injected via Hilt) |
| Event emission (client → server) | `SocketManager` methods | Data Layer | `socketManager.joinCanteenRoom()`, `socketManager.sendPing()` |
| Event reception (server → client) | `SocketManager` event handlers | Data Layer | `socket.on("orderUpdate")` |
| Event parsing | `SocketManager` | Data Layer | `JSONObject` → Sealed class (`OrderUpdateEvent`) |
| Event propagation | `MutableSharedFlow<OrderUpdateEvent>` | Data Layer | Repository subscribes to SharedFlow |
| Event handling | Repository implementation | Data Layer | Update Room Database on event received |
| Connection state | `StateFlow<ConnectionState>` | Data Layer | ViewModel observes for UI updates |

**Key Point**: UI never interacts with Socket.IO directly. UI observes Room Database (single source of truth), which is updated by WebSocket events via Repository.

---

### Foreground Service Usage

| App Type | Foreground Service | What Runs | Why |
|----------|-------------------|-----------|-----|
| **Customer App** | OPTIONAL (not MVP) | `WebSocketForegroundService` | Improve UX for real-time order updates (WebSocket stays alive when app backgrounded) |
| **Delivery Person App** | REQUIRED | `WebSocketForegroundService` | CRITICAL for instant delivery assignments (WebSocket MUST stay alive in background) |
| **Canteen Owner App** | OPTIONAL | `WebSocketForegroundService` | Nice-to-have for instant order alerts (web dashboard is primary interface) |

**Service Type**: `android:foregroundServiceType="dataSync"`

**Notification**: Persistent notification required ("Waiting for deliveries...")

---

### Background Work Strategy

| Work Type | Execution | Component | Constraints | Retry Policy |
|-----------|-----------|-----------|-------------|-------------|
| **Offline Order Sync** | Background (WorkManager) | `OrderSyncWorker` | NetworkType.CONNECTED | Exponential backoff (1min → 10min) |
| **Cache Cleanup** | Background (WorkManager, periodic) | `CacheCleanupWorker` | NONE | N/A (periodic, every 24 hours) |
| **FCM Notification Reception** | Background (FCM wakes app) | `FirebaseMessagingService` | NONE | N/A (system-managed) |
| **WebSocket Connection** | Foreground (customer) OR Foreground + Background (delivery) | `SocketManager` OR `WebSocketForegroundService` | NONE | Exponential backoff (1s → 8s) |

**Key Principle**: Only **read-only** operations or **idempotent writes** run in background. Critical write operations (order placement, payment) require foreground context.

---

### Local Storage Strategy

| Data Type | Storage Technology | Access Pattern | TTL | Size Estimate |
|-----------|-------------------|----------------|-----|---------------|
| **User Session** (userId, authToken, email) | SharedPreferences / DataStore | Read on app launch, write on login/logout | Permanent (until logout) | < 1 KB |
| **Menu Items** | Room Database (CachedMenuItem) | Read via Flow, write on API refresh | 5 minutes | 50-100 items × 500 bytes = 25-50 KB |
| **Cart Items** | Room Database (CartItem) | Read via Flow, write on user action | Permanent (until order placed) | 1-20 items × 200 bytes = 200 bytes - 4 KB |
| **Active Orders** | Room Database (CachedOrder) | Read via Flow, write on API + WebSocket | Permanent (until delivered) | 5-10 orders × 1 KB = 5-10 KB |
| **Order History** | Room Database (CachedOrder) | Read on demand, write on API response | 7 days | 50 orders × 1 KB = 50 KB |
| **Pending Orders** | Room Database (PendingOrder) | Write on offline order, delete after sync | Until synced | 1-5 orders × 500 bytes = 500 bytes - 2.5 KB |
| **FCM Token** | SharedPreferences / DataStore | Read on API subscribe call | Permanent (until app uninstall) | < 500 bytes |
| **App Settings** (theme, notifications) | SharedPreferences / DataStore | Read on app launch, write on settings change | Permanent | < 1 KB |
| **Menu Item Images** | Coil Disk Cache | Loaded by Coil, auto-managed | 30 days (Coil default) | 50 images × 20 KB = 1 MB |

**Total Estimated Storage**: 2-5 MB (including image cache)

**Cache Strategy**: Cache-first with background refresh (offline-first architecture)

---

## END OF DOCUMENT

**Document Version**: 1.0  
**Last Updated**: 2026-01-02  
**Total Screens**: 14 screens  
**Total ViewModels**: 14 ViewModels  
**Total Use Cases**: 25+ use cases  
**Total Repositories**: 10 repositories  
**Total DAOs**: 10+ DAOs  
**Total Entities**: 10+ entities  
**Total API Interfaces**: 8+ interfaces  

**Architecture Pattern**: MVVM + Repository Pattern + Clean Architecture  
**Data Flow**: Network → Repository → Room Database → ViewModel → UI (reactive via Flow)  
**Offline Strategy**: Cache-first with background sync (offline-first)  
**Real-Time Strategy**: WebSocket → Repository → Room Database → UI (reactive)  

**Key Principles**:  
✅ **Single Source of Truth**: Room Database is the source of truth  
✅ **Reactive UI**: UI observes data via Flow (no manual UI updates)  
✅ **Offline-First**: App functions without network, syncs when available  
✅ **Separation of Concerns**: Each layer has clear responsibilities  
✅ **Testable**: Interfaces enable unit testing without Android dependencies
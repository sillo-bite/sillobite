# 12 - ANDROID IMPLEMENTATION SEQUENCE

## DOCUMENT METADATA
- **Extraction Date**: 2026-01-02
- **Source**: android-spec/11-android-architecture-mapping.md, android-spec/10-android-mvp-scope.md
- **Protocol**: Strict ordered implementation sequence with testing gates
- **Purpose**: Prevent premature UI building, missing background guarantees, incorrect notification behavior

---

## IMPLEMENTATION PRINCIPLES

### Critical Rules

1. **Bottom-Up Implementation**: Build foundation before UI
2. **Test Before Proceed**: Each step must pass tests before next step
3. **No Premature UI**: UI only after data layer is verified
4. **No Mock Data**: Real API integration from day 1
5. **Incremental Integration**: Test each component in isolation before integration

### Anti-Patterns to Prevent

❌ **Premature UI Building**: Building screens before data layer exists  
❌ **Mock Data in Production Code**: Using hardcoded data instead of real API  
❌ **Missing Background Guarantees**: Not testing WorkManager sync before offline features  
❌ **Incorrect Notification Behavior**: Not testing FCM before showing notification UI  
❌ **Skipping Repository Layer**: ViewModels calling Retrofit directly  
❌ **Missing Error Handling**: Not testing network failures before showing success states  

---

## PHASE 0: PROJECT SETUP (Week 1, Days 1-2)

### Step 0.1: Create Android Project

**What to Implement**:
- Create new Android project in Android Studio
- Package name: `com.sillobite.customer` (or your domain)
- Minimum SDK: API 24 (Android 7.0) - covers 95%+ devices
- Target SDK: API 34 (Android 14)
- Language: Kotlin
- Build system: Gradle (Kotlin DSL)

**Why This First**:
- Project must exist before any code can be written
- Package name cannot be easily changed later
- SDK versions affect available APIs

**Test Immediately**:
```bash
./gradlew build
```
- ✅ Project builds successfully
- ✅ Empty MainActivity launches
- ✅ "Hello World" displays

**Must NOT Implement Yet**:
- ❌ Any UI screens
- ❌ Any dependencies
- ❌ Any business logic

---

### Step 0.2: Configure Build Files & Dependencies

**What to Implement**:

**build.gradle.kts (Project level)**:
```kotlin
plugins {
    id("com.android.application") version "8.2.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.20" apply false
    id("com.google.dagger.hilt.android") version "2.48" apply false
    id("com.google.gms.google-services") version "4.4.0" apply false
}
```

**build.gradle.kts (App level)**:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
    id("com.google.dagger.hilt.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.sillobite.customer"
    compileSdk = 34
    
    defaultConfig {
        applicationId = "com.sillobite.customer"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        
        buildConfigField("String", "API_URL", "\"https://api.sillobite.com\"")
        buildConfigField("String", "RAZORPAY_KEY_ID", "\"YOUR_KEY_HERE\"")
    }
    
    buildFeatures {
        buildConfig = true
        compose = true // If using Jetpack Compose
    }
    
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.4"
    }
}

dependencies {
    // Core Android
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    
    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    
    // Dependency Injection - Hilt
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")
    
    // Networking - Retrofit + OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    
    // Local Database - Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    
    // Lifecycle Components
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    
    // DataStore (SharedPreferences replacement)
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    
    // WorkManager (Background sync)
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    
    // Socket.IO Client
    implementation("io.socket:socket.io-client:2.1.0")
    
    // Firebase (FCM, Crashlytics, Analytics)
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")
    
    // Google Sign-In
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    
    // Razorpay Payment SDK
    implementation("com.razorpay:checkout:1.6.33")
    
    // Image Loading - Coil
    implementation("io.coil-kt:coil:2.5.0")
    implementation("io.coil-kt:coil-compose:2.5.0")
    
    // JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
    
    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.7.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("androidx.arch.core:core-testing:2.2.0")
    
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
```

**Why This First**:
- All subsequent code depends on these libraries
- Changing dependencies mid-development causes conflicts
- Build configuration must be stable

**Test Immediately**:
```bash
./gradlew build
./gradlew app:dependencies # Verify no conflicts
```
- ✅ All dependencies resolve without conflicts
- ✅ Build completes successfully (may take 5-10 min first time)
- ✅ No version conflict errors

**Must NOT Implement Yet**:
- ❌ Any code using these dependencies
- ❌ API keys (use placeholders)
- ❌ Firebase configuration (google-services.json)

---

### Step 0.3: Create Application Class & Hilt Setup

**What to Implement**:

**Application.kt**:
```kotlin
package com.sillobite.customer

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SillobiteApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize logging (development only)
        if (BuildConfig.DEBUG) {
            // Enable strict mode, Timber logging, etc.
        }
    }
}
```

**AndroidManifest.xml**:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application
        android:name=".SillobiteApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:theme="@style/Theme.Sillobite">
        
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

**network_security_config.xml** (res/xml/):
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <!-- Development only: Allow local server -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain> <!-- Android Emulator -->
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

**Why This First**:
- Hilt requires Application class annotation
- Manifest configuration affects entire app
- Network security must be configured before API calls

**Test Immediately**:
```bash
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.sillobite.customer/.MainActivity
```
- ✅ App installs without errors
- ✅ App launches successfully
- ✅ No Hilt injection errors in logcat

**Must NOT Implement Yet**:
- ❌ Any Hilt modules
- ❌ Any injected components
- ❌ Any network calls

---

## PHASE 1: FOUNDATION LAYER (Week 1, Days 3-5)

### Step 1.1: Define Domain Models

**What to Implement**:

Create package: `domain/models/`

**User.kt**:
```kotlin
package com.sillobite.customer.domain.models

data class User(
    val id: String,
    val email: String,
    val name: String,
    val phoneNumber: String?,
    val role: UserRole,
    val isProfileComplete: Boolean,
    val selectedCanteenId: String?
)

enum class UserRole {
    @SerializedName("student") STUDENT,
    @SerializedName("staff") STAFF,
    @SerializedName("employee") EMPLOYEE,
    @SerializedName("guest") GUEST,
    @SerializedName("contractor") CONTRACTOR,
    @SerializedName("visitor") VISITOR,
    @SerializedName("admin") ADMIN,
    @SerializedName("super_admin") SUPER_ADMIN,
    @SerializedName("canteen_owner") CANTEEN_OWNER,
    @SerializedName("delivery_person") DELIVERY_PERSON
}
```

**MenuItem.kt**:
```kotlin
package com.sillobite.customer.domain.models

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

data class Category(
    val id: String,
    val name: String,
    val imageUrl: String?,
    val canteenId: String
)
```

**Order.kt**:
```kotlin
package com.sillobite.customer.domain.models

data class Order(
    val id: String,
    val userId: String,
    val canteenId: String,
    val items: List<OrderItem>,
    val totalAmount: Double,
    val status: OrderStatus,
    val paymentStatus: PaymentStatus,
    val createdAt: Long,
    val updatedAt: Long,
    val barcode: String?,
    val orderNumber: String?
)

data class OrderItem(
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int
)

enum class OrderStatus {
    PENDING, PREPARING, READY, DELIVERED, CANCELLED
}

enum class PaymentStatus {
    PENDING, SUCCESS, FAILED
}
```

**Cart.kt**:
```kotlin
package com.sillobite.customer.domain.models

data class CartItem(
    val id: Long = 0,
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
    val canteenId: String,
    val imageUrl: String?
)
```

**Payment.kt**:
```kotlin
package com.sillobite.customer.domain.models

data class Payment(
    val id: String,
    val orderId: String,
    val razorpayOrderId: String?,
    val razorpayPaymentId: String?,
    val amount: Double,
    val status: PaymentStatus,
    val createdAt: Long
)
```

**Why This First**:
- Domain models are **framework-independent** (no Android, no Room, no Retrofit)
- All other layers depend on domain models
- Easy to unit test (pure Kotlin)
- Can be used across all layers

**Test Immediately**:

Create: `domain/models/UserTest.kt`
```kotlin
package com.sillobite.customer.domain.models

import org.junit.Assert.*
import org.junit.Test

class UserTest {
    
    @Test
    fun `user creation with all fields`() {
        val user = User(
            id = "123",
            email = "test@example.com",
            name = "Test User",
            phoneNumber = "1234567890",
            role = UserRole.STUDENT,
            isProfileComplete = true,
            selectedCanteenId = "canteen-1"
        )
        
        assertEquals("123", user.id)
        assertEquals("test@example.com", user.email)
        assertEquals(UserRole.STUDENT, user.role)
        assertTrue(user.isProfileComplete)
    }
    
    @Test
    fun `user equality check`() {
        val user1 = User("1", "a@b.com", "A", null, UserRole.STUDENT, false, null)
        val user2 = User("1", "a@b.com", "A", null, UserRole.STUDENT, false, null)
        
        assertEquals(user1, user2)
    }
}
```

Run tests:
```bash
./gradlew test
```
- ✅ All domain model tests pass
- ✅ No compilation errors
- ✅ Models are immutable (data classes)

**Must NOT Implement Yet**:
- ❌ Room entities (these come later, will map from domain models)
- ❌ Network DTOs (these come later, will map to domain models)
- ❌ Any Android dependencies in domain models

---

### Step 1.2: Setup Room Database Schema

**What to Implement**:

Create package: `data/local/entities/`

**CachedMenuItem.kt**:
```kotlin
package com.sillobite.customer.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.sillobite.customer.domain.models.MenuItem

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

// Mapper to domain model
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

// Mapper from domain model
fun MenuItem.toEntity() = CachedMenuItem(
    id = id,
    canteenId = canteenId,
    name = name,
    description = description,
    price = price,
    stock = stock,
    available = isAvailable,
    imageUrl = imageUrl,
    categoryId = categoryId,
    isVeg = isVeg,
    cachedAt = System.currentTimeMillis()
)
```

**CartItemEntity.kt**:
```kotlin
package com.sillobite.customer.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.sillobite.customer.domain.models.CartItem

@Entity(tableName = "cart_items")
data class CartItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
    val canteenId: String,
    val imageUrl: String?,
    val addedAt: Long
)

fun CartItemEntity.toDomainModel() = CartItem(
    id = id,
    menuItemId = menuItemId,
    name = name,
    price = price,
    quantity = quantity,
    canteenId = canteenId,
    imageUrl = imageUrl
)

fun CartItem.toEntity() = CartItemEntity(
    id = id,
    menuItemId = menuItemId,
    name = name,
    price = price,
    quantity = quantity,
    canteenId = canteenId,
    imageUrl = imageUrl,
    addedAt = System.currentTimeMillis()
)
```

**CachedOrder.kt** (similar pattern for Order)

**PendingOrder.kt**:
```kotlin
package com.sillobite.customer.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_orders")
data class PendingOrder(
    @PrimaryKey val id: String,
    val userId: String,
    val canteenId: String,
    val itemsJson: String, // JSON array of cart items
    val totalAmount: Double,
    val status: String, // "pending", "syncing", "failed"
    val createdAt: Long,
    val lastRetryAt: Long = 0,
    val retryCount: Int = 0
)
```

**Why This First**:
- Room entities must be defined before DAOs
- Mappers separate concerns (domain vs persistence)
- Schema must be stable before data access layer

**Test Immediately**:

Create: `data/local/entities/CachedMenuItemTest.kt`
```kotlin
package com.sillobite.customer.data.local.entities

import com.sillobite.customer.domain.models.MenuItem
import org.junit.Assert.*
import org.junit.Test

class CachedMenuItemTest {
    
    @Test
    fun `mapper from domain to entity`() {
        val domainModel = MenuItem(
            id = "1",
            name = "Pizza",
            description = "Cheese pizza",
            price = 200.0,
            imageUrl = "url",
            categoryId = "cat1",
            stock = 10,
            isAvailable = true,
            isVeg = true,
            canteenId = "canteen1"
        )
        
        val entity = domainModel.toEntity()
        
        assertEquals("1", entity.id)
        assertEquals("Pizza", entity.name)
        assertEquals(200.0, entity.price, 0.01)
        assertTrue(entity.available)
        assertTrue(entity.cachedAt > 0)
    }
    
    @Test
    fun `mapper from entity to domain`() {
        val entity = CachedMenuItem(
            id = "1",
            canteenId = "canteen1",
            name = "Pizza",
            description = "Cheese pizza",
            price = 200.0,
            stock = 10,
            available = true,
            imageUrl = "url",
            categoryId = "cat1",
            isVeg = true,
            cachedAt = System.currentTimeMillis()
        )
        
        val domainModel = entity.toDomainModel()
        
        assertEquals("1", domainModel.id)
        assertEquals("Pizza", domainModel.name)
        assertTrue(domainModel.isAvailable)
    }
}
```

Run tests:
```bash
./gradlew test
```
- ✅ Mapper tests pass
- ✅ No Room schema errors (compile-time check)
- ✅ Bidirectional mapping works correctly

**Must NOT Implement Yet**:
- ❌ DAOs (next step)
- ❌ Database class (next step)
- ❌ Any database queries

---

### Step 1.3: Create Room DAOs

**What to Implement**:

Create package: `data/local/dao/`

**MenuItemDao.kt**:
```kotlin
package com.sillobite.customer.data.local.dao

import androidx.room.*
import com.sillobite.customer.data.local.entities.CachedMenuItem
import kotlinx.coroutines.flow.Flow

@Dao
interface MenuItemDao {
    
    @Query("SELECT * FROM menu_items WHERE canteenId = :canteenId AND available = 1 ORDER BY name ASC")
    fun getMenuItems(canteenId: String): Flow<List<CachedMenuItem>>
    
    @Query("SELECT * FROM menu_items WHERE id = :id")
    suspend fun getMenuItemById(id: String): CachedMenuItem?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CachedMenuItem>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: CachedMenuItem)
    
    @Update
    suspend fun update(item: CachedMenuItem)
    
    @Query("UPDATE menu_items SET stock = :stock, available = :available WHERE id = :id")
    suspend fun updateStock(id: String, stock: Int?, available: Boolean)
    
    @Query("DELETE FROM menu_items WHERE cachedAt < :expiryTime")
    suspend fun deleteExpired(expiryTime: Long)
    
    @Query("DELETE FROM menu_items")
    suspend fun deleteAll()
}
```

**CartItemDao.kt**:
```kotlin
package com.sillobite.customer.data.local.dao

import androidx.room.*
import com.sillobite.customer.data.local.entities.CartItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CartItemDao {
    
    @Query("SELECT * FROM cart_items WHERE canteenId = :canteenId ORDER BY addedAt DESC")
    fun getCartItems(canteenId: String): Flow<List<CartItemEntity>>
    
    @Query("SELECT * FROM cart_items WHERE menuItemId = :menuItemId")
    suspend fun getCartItemByMenuId(menuItemId: String): CartItemEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: CartItemEntity)
    
    @Update
    suspend fun update(item: CartItemEntity)
    
    @Delete
    suspend fun delete(item: CartItemEntity)
    
    @Query("DELETE FROM cart_items WHERE canteenId = :canteenId")
    suspend fun clearCart(canteenId: String)
    
    @Query("DELETE FROM cart_items")
    suspend fun clearAll()
}
```

**OrderDao.kt**, **PendingOrderDao.kt** (similar patterns)

**Why This First**:
- DAOs are the interface to database operations
- Must be defined before database class
- Flow return type enables reactive UI (Room automatically emits on changes)

**Test Immediately**:

Create: `data/local/dao/MenuItemDaoTest.kt` (Instrumented test)
```kotlin
package com.sillobite.customer.data.local.dao

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.sillobite.customer.data.local.AppDatabase
import com.sillobite.customer.data.local.entities.CachedMenuItem
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MenuItemDaoTest {
    
    private lateinit var database: AppDatabase
    private lateinit var menuItemDao: MenuItemDao
    
    @Before
    fun setup() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
        menuItemDao = database.menuItemDao()
    }
    
    @After
    fun teardown() {
        database.close()
    }
    
    @Test
    fun insertAndRetrieveMenuItem() = runBlocking {
        val item = CachedMenuItem(
            id = "1",
            canteenId = "canteen1",
            name = "Pizza",
            description = "Cheese pizza",
            price = 200.0,
            stock = 10,
            available = true,
            imageUrl = null,
            categoryId = null,
            isVeg = true,
            cachedAt = System.currentTimeMillis()
        )
        
        menuItemDao.insert(item)
        
        val items = menuItemDao.getMenuItems("canteen1").first()
        assertEquals(1, items.size)
        assertEquals("Pizza", items[0].name)
    }
    
    @Test
    fun updateStockUpdatesMenuItem() = runBlocking {
        val item = CachedMenuItem(
            id = "1",
            canteenId = "canteen1",
            name = "Pizza",
            description = null,
            price = 200.0,
            stock = 10,
            available = true,
            imageUrl = null,
            categoryId = null,
            isVeg = true,
            cachedAt = System.currentTimeMillis()
        )
        
        menuItemDao.insert(item)
        menuItemDao.updateStock("1", 5, true)
        
        val retrieved = menuItemDao.getMenuItemById("1")
        assertEquals(5, retrieved?.stock)
    }
}
```

Run tests:
```bash
./gradlew connectedAndroidTest # Requires emulator/device
```
- ✅ DAO insert/retrieve tests pass
- ✅ DAO update tests pass
- ✅ Flow emits correctly
- ✅ No Room schema errors

**Must NOT Implement Yet**:
- ❌ Repository layer (depends on complete database)
- ❌ Any ViewModel code
- ❌ Any UI code

---

### Step 1.4: Create AppDatabase

**What to Implement**:

**AppDatabase.kt**:
```kotlin
package com.sillobite.customer.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.sillobite.customer.data.local.converters.Converters
import com.sillobite.customer.data.local.dao.*
import com.sillobite.customer.data.local.entities.*

@Database(
    entities = [
        CachedMenuItem::class,
        CachedCategory::class,
        CartItemEntity::class,
        CachedOrder::class,
        PendingOrder::class,
        CachedUser::class
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    
    abstract fun menuItemDao(): MenuItemDao
    abstract fun categoryDao(): CategoryDao
    abstract fun cartItemDao(): CartItemDao
    abstract fun orderDao(): OrderDao
    abstract fun pendingOrderDao(): PendingOrderDao
    abstract fun userDao(): UserDao
}
```

**Converters.kt**:
```kotlin
package com.sillobite.customer.data.local.converters

import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.sillobite.customer.domain.models.OrderItem

class Converters {
    
    private val gson = Gson()
    
    @TypeConverter
    fun fromOrderItemList(value: List<OrderItem>): String {
        return gson.toJson(value)
    }
    
    @TypeConverter
    fun toOrderItemList(value: String): List<OrderItem> {
        val type = object : TypeToken<List<OrderItem>>() {}.type
        return gson.fromJson(value, type)
    }
}
```

**Why This First**:
- Database is the central persistence component
- Must exist before Hilt can provide DAOs
- Schema version must be set (cannot be changed without migration)

**Test Immediately**:

Create: `data/local/AppDatabaseTest.kt`
```kotlin
package com.sillobite.customer.data.local

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppDatabaseTest {
    
    @Test
    fun databaseCreationSucceeds() {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
        
        assertNotNull(database)
        assertNotNull(database.menuItemDao())
        assertNotNull(database.cartItemDao())
        
        database.close()
    }
    
    @Test
    fun allDaosAreAccessible() {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
        
        // Verify all DAOs can be accessed
        assertNotNull(database.menuItemDao())
        assertNotNull(database.categoryDao())
        assertNotNull(database.cartItemDao())
        assertNotNull(database.orderDao())
        assertNotNull(database.pendingOrderDao())
        assertNotNull(database.userDao())
        
        database.close()
    }
}
```

Run tests:
```bash
./gradlew connectedAndroidTest
```
- ✅ Database creation succeeds
- ✅ All DAOs accessible
- ✅ No schema validation errors

**Must NOT Implement Yet**:
- ❌ Hilt module for database (next step)
- ❌ Any repository code
- ❌ Any database migrations (version 1 only)

---

### Step 1.5: Setup DataStore (SharedPreferences Replacement)

**What to Implement**:

**UserPreferences.kt**:
```kotlin
package com.sillobite.customer.data.local.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_prefs")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    private object Keys {
        val USER_ID = stringPreferencesKey("user_id")
        val USER_EMAIL = stringPreferencesKey("user_email")
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val SELECTED_CANTEEN_ID = stringPreferencesKey("selected_canteen_id")
        val FCM_TOKEN = stringPreferencesKey("fcm_token")
        val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    }
    
    val userSession: Flow<UserSession?> = context.dataStore.data
        .map { prefs ->
            val userId = prefs[Keys.USER_ID]
            if (userId != null) {
                UserSession(
                    userId = userId,
                    email = prefs[Keys.USER_EMAIL] ?: "",
                    authToken = prefs[Keys.AUTH_TOKEN],
                    selectedCanteenId = prefs[Keys.SELECTED_CANTEEN_ID],
                    isLoggedIn = prefs[Keys.IS_LOGGED_IN] ?: false
                )
            } else null
        }
    
    suspend fun saveUserSession(session: UserSession) {
        context.dataStore.edit { prefs ->
            prefs[Keys.USER_ID] = session.userId
            prefs[Keys.USER_EMAIL] = session.email
            session.authToken?.let { prefs[Keys.AUTH_TOKEN] = it }
            session.selectedCanteenId?.let { prefs[Keys.SELECTED_CANTEEN_ID] = it }
            prefs[Keys.IS_LOGGED_IN] = session.isLoggedIn
        }
    }
    
    suspend fun clearUserSession() {
        context.dataStore.edit { it.clear() }
    }
    
    suspend fun saveFcmToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.FCM_TOKEN] = token
        }
    }
    
    val fcmToken: Flow<String?> = context.dataStore.data
        .map { prefs -> prefs[Keys.FCM_TOKEN] }
}

data class UserSession(
    val userId: String,
    val email: String,
    val authToken: String?,
    val selectedCanteenId: String?,
    val isLoggedIn: Boolean
)
```

**Why This First**:
- DataStore is type-safe replacement for SharedPreferences
- Used for lightweight data (tokens, user ID)
- Must exist before auth flow

**Test Immediately**:

Create: `data/local/preferences/UserPreferencesTest.kt`
```kotlin
package com.sillobite.customer.data.local.preferences

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UserPreferencesTest {
    
    @Test
    fun saveAndRetrieveUserSession() = runBlocking {
        val prefs = UserPreferences(ApplicationProvider.getApplicationContext())
        
        val session = UserSession(
            userId = "123",
            email = "test@example.com",
            authToken = "token",
            selectedCanteenId = "canteen1",
            isLoggedIn = true
        )
        
        prefs.saveUserSession(session)
        
        val retrieved = prefs.userSession.first()
        assertNotNull(retrieved)
        assertEquals("123", retrieved?.userId)
        assertEquals("test@example.com", retrieved?.email)
        assertTrue(retrieved?.isLoggedIn == true)
    }
    
    @Test
    fun clearUserSessionRemovesData() = runBlocking {
        val prefs = UserPreferences(ApplicationProvider.getApplicationContext())
        
        prefs.saveUserSession(UserSession("1", "a@b.com", null, null, true))
        prefs.clearUserSession()
        
        val retrieved = prefs.userSession.first()
        assertNull(retrieved)
    }
}
```

Run tests:
```bash
./gradlew connectedAndroidTest
```
- ✅ Save/retrieve works
- ✅ Clear removes all data
- ✅ Flow emits correctly

**Must NOT Implement Yet**:
- ❌ Auth repository (depends on Retrofit setup)
- ❌ Any login logic
- ❌ Any auth UI

---

### Step 1.6: Setup Retrofit & OkHttp

**What to Implement**:

Create package: `data/remote/api/`

**ApiResponse.kt** (Wrapper for all API responses):
```kotlin
package com.sillobite.customer.data.remote.dto

data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T?,
    val error: String?
)
```

**AuthApi.kt**:
```kotlin
package com.sillobite.customer.data.remote.api

import com.sillobite.customer.data.remote.dto.ApiResponse
import com.sillobite.customer.data.remote.dto.LoginRequest
import com.sillobite.customer.data.remote.dto.RegisterRequest
import com.sillobite.customer.data.remote.dto.UserDto
import retrofit2.Response
import retrofit2.http.*

interface AuthApi {
    
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<ApiResponse<UserDto>>
    
    @POST("auth/register")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<ApiResponse<UserDto>>
    
    @POST("auth/google/verify")
    suspend fun verifyGoogleToken(
        @Body request: Map<String, String>
    ): Response<ApiResponse<UserDto>>
    
    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Unit>>
    
    @GET("users/{id}/validate")
    suspend fun validateSession(
        @Path("id") userId: String
    ): Response<ApiResponse<UserDto>>
}
```

**MenuApi.kt**:
```kotlin
package com.sillobite.customer.data.remote.api

import com.sillobite.customer.data.remote.dto.ApiResponse
import com.sillobite.customer.data.remote.dto.MenuItemDto
import retrofit2.Response
import retrofit2.http.*

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
```

**DTOs (Data Transfer Objects)**:

**UserDto.kt**:
```kotlin
package com.sillobite.customer.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.sillobite.customer.domain.models.User
import com.sillobite.customer.domain.models.UserRole

data class UserDto(
    @SerializedName("_id") val id: String,
    val email: String,
    val name: String,
    val phoneNumber: String?,
    val role: String,
    val isProfileComplete: Boolean,
    val selectedCanteenId: String?,
    val token: String? // JWT token from server
)

fun UserDto.toDomainModel() = User(
    id = id,
    email = email,
    name = name,
    phoneNumber = phoneNumber,
    role = UserRole.valueOf(role.uppercase()),
    isProfileComplete = isProfileComplete,
    selectedCanteenId = selectedCanteenId
)
```

**MenuItemDto.kt**, **OrderDto.kt** (similar patterns)

**Why This First**:
- API interfaces define contract with backend
- DTOs separate network layer from domain layer
- Must be defined before Hilt network module

**Test Immediately**:

Create: `data/remote/api/AuthApiTest.kt` (Unit test with MockWebServer)
```kotlin
package com.sillobite.customer.data.remote.api

import com.sillobite.customer.data.remote.dto.LoginRequest
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class AuthApiTest {
    
    private lateinit var mockWebServer: MockWebServer
    private lateinit var authApi: AuthApi
    
    @Before
    fun setup() {
        mockWebServer = MockWebServer()
        
        authApi = Retrofit.Builder()
            .baseUrl(mockWebServer.url("/"))
            .client(OkHttpClient.Builder().build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }
    
    @After
    fun teardown() {
        mockWebServer.shutdown()
    }
    
    @Test
    fun `login API call structure is correct`() = runBlocking {
        val mockResponse = """
            {
                "success": true,
                "message": "Login successful",
                "data": {
                    "_id": "123",
                    "email": "test@example.com",
                    "name": "Test User",
                    "role": "student",
                    "isProfileComplete": true,
                    "token": "jwt_token_here"
                }
            }
        """.trimIndent()
        
        mockWebServer.enqueue(MockResponse().setBody(mockResponse).setResponseCode(200))
        
        val response = authApi.login(LoginRequest("test@example.com", "password"))
        
        assertTrue(response.isSuccessful)
        assertEquals("test@example.com", response.body()?.data?.email)
        
        val request = mockWebServer.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/auth/login", request.path)
    }
}
```

Add dependency for MockWebServer:
```kotlin
testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
```

Run tests:
```bash
./gradlew test
```
- ✅ API call structure correct
- ✅ Response parsing works
- ✅ Request serialization works

**Must NOT Implement Yet**:
- ❌ Hilt network module (next step)
- ❌ Repository implementation
- ❌ Any real API calls (only mocked tests)

---

### Step 1.7: Create Hilt Dependency Injection Modules

**What to Implement**:

Create package: `di/`

**AppModule.kt**:
```kotlin
package com.sillobite.customer.di

import android.content.Context
import androidx.room.Room
import com.sillobite.customer.data.local.AppDatabase
import com.sillobite.customer.data.local.preferences.UserPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import javax.inject.Qualifier
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "sillobite_db"
        )
            .fallbackToDestructiveMigration() // Development only
            .build()
    }
    
    @Provides
    @Singleton
    fun provideUserPreferences(
        @ApplicationContext context: Context
    ): UserPreferences {
        return UserPreferences(context)
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

**DatabaseModule.kt**:
```kotlin
package com.sillobite.customer.di

import com.sillobite.customer.data.local.AppDatabase
import com.sillobite.customer.data.local.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    
    @Provides
    fun provideMenuItemDao(database: AppDatabase): MenuItemDao {
        return database.menuItemDao()
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
    fun provideUserDao(database: AppDatabase): UserDao {
        return database.userDao()
    }
}
```

**NetworkModule.kt**:
```kotlin
package com.sillobite.customer.di

import com.sillobite.customer.BuildConfig
import com.sillobite.customer.data.local.preferences.UserPreferences
import com.sillobite.customer.data.remote.api.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        userPreferences: UserPreferences
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        
        val authInterceptor = Interceptor { chain ->
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
        
        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .addInterceptor(authInterceptor)
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
}
```

**Why This First**:
- Hilt modules provide dependencies to entire app
- Must be complete before repository layer
- Centralized configuration (easy to test with mocks)

**Test Immediately**:

Create: `di/AppModuleTest.kt`
```kotlin
package com.sillobite.customer.di

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class AppModuleTest {
    
    @get:Rule
    var hiltRule = HiltAndroidRule(this)
    
    @Inject
    lateinit var appDatabase: com.sillobite.customer.data.local.AppDatabase
    
    @Inject
    lateinit var userPreferences: com.sillobite.customer.data.local.preferences.UserPreferences
    
    @Before
    fun setup() {
        hiltRule.inject()
    }
    
    @Test
    fun appDatabaseIsProvided() {
        assertNotNull(appDatabase)
    }
    
    @Test
    fun userPreferencesIsProvided() {
        assertNotNull(userPreferences)
    }
}
```

Add Hilt testing dependencies:
```kotlin
androidTestImplementation("com.google.dagger:hilt-android-testing:2.48")
kaptAndroidTest("com.google.dagger:hilt-compiler:2.48")
```

Run tests:
```bash
./gradlew connectedAndroidTest
```
- ✅ All dependencies inject correctly
- ✅ Singletons are singletons (same instance)
- ✅ No injection errors

**Must NOT Implement Yet**:
- ❌ Repository implementations (next phase)
- ❌ ViewModel code
- ❌ UI code

---

## TESTING GATE #1: Foundation Layer Complete

### Verification Checklist

Before proceeding to Phase 2, verify:

✅ **Project Setup**:
- [ ] Project builds without errors
- [ ] All dependencies resolve
- [ ] Hilt application class configured

✅ **Domain Models**:
- [ ] All domain models defined (User, MenuItem, Order, Cart, Payment)
- [ ] Unit tests pass for domain models
- [ ] No Android dependencies in domain package

✅ **Room Database**:
- [ ] All entities defined with mappers
- [ ] All DAOs defined with CRUD operations
- [ ] AppDatabase created with all DAOs
- [ ] Database tests pass (insert, retrieve, update, delete)
- [ ] Flow emission works correctly

✅ **DataStore**:
- [ ] UserPreferences implemented
- [ ] Save/retrieve tests pass
- [ ] Clear functionality works

✅ **Retrofit**:
- [ ] All API interfaces defined (AuthApi, MenuApi, OrderApi)
- [ ] DTOs defined with mappers to domain models
- [ ] MockWebServer tests pass
- [ ] Request/response structure correct

✅ **Hilt DI**:
- [ ] AppModule, DatabaseModule, NetworkModule defined
- [ ] All dependencies injectable
- [ ] Hilt tests pass
- [ ] No circular dependencies

### If ANY checkbox is unchecked:
**STOP. Fix the issue before proceeding.**

### Success Criteria:
```bash
./gradlew test # All unit tests pass
./gradlew connectedAndroidTest # All instrumented tests pass
./gradlew assembleDebug # App builds successfully
```

**Expected Output**:
- 20+ unit tests passing
- 10+ instrumented tests passing
- 0 compilation errors
- 0 Hilt injection errors

---

## PHASE 2: REPOSITORY LAYER (Week 2, Days 1-3)

### Step 2.1: Implement AuthRepository

**What to Implement**:

**AuthRepository.kt** (Interface):
```kotlin
package com.sillobite.customer.domain.repository

import com.sillobite.customer.domain.models.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<User>
    suspend fun register(email: String, password: String, name: String): Result<User>
    suspend fun googleSignIn(idToken: String): Result<User>
    suspend fun logout(): Result<Unit>
    suspend fun validateSession(): Result<User?>
    fun getCurrentUser(): Flow<User?>
    fun isLoggedIn(): Flow<Boolean>
}
```

**AuthRepositoryImpl.kt**:
```kotlin
package com.sillobite.customer.data.repository

import com.sillobite.customer.data.local.dao.UserDao
import com.sillobite.customer.data.local.entities.toDomainModel
import com.sillobite.customer.data.local.entities.toEntity
import com.sillobite.customer.data.remote.api.MenuApi
import com.sillobite.customer.data.remote.dto.toDomainModel
import com.sillobite.customer.di.IoDispatcher
import com.sillobite.customer.domain.models.MenuItem
import com.sillobite.customer.domain.repository.MenuRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MenuRepositoryImpl @Inject constructor(
    private val menuApi: MenuApi,
    private val menuItemDao: MenuItemDao,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) : MenuRepository {
    
    override fun getMenuItemsFlow(canteenId: String, filters: MenuFilters?): Flow<List<MenuItem>> {
        return menuItemDao.getMenuItems(canteenId)
            .map { entities -> entities.map { it.toDomainModel() } }
    }
    
    override suspend fun refreshMenu(canteenId: String): Result<Unit> = withContext(ioDispatcher) {
        try {
            val response = menuApi.getMenu(canteenId = canteenId, limit = 100)
            
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
}
```

**CartRepository.kt**, **OrderRepository.kt**, **PaymentRepository.kt** follow similar patterns.

**Why This Sequence**:
- MenuRepository before CartRepository (cart displays menu items)
- CartRepository before OrderRepository (orders created from cart)
- OrderRepository before PaymentRepository (payment follows order creation)

**Test Immediately**: Each repository must have unit tests before proceeding.

**Must NOT Implement Yet**:
- ❌ Use cases (after all repositories done)
- ❌ ViewModels
- ❌ UI

---

## TESTING GATE #2: Repository Layer Complete

### Verification Checklist

✅ **AuthRepository**:
- [ ] Login/register/logout implemented
- [ ] Session management works
- [ ] Unit tests pass (mocked API + DAO)
- [ ] Integration test passes (real database, mocked API)

✅ **MenuRepository**:
- [ ] Flow-based menu retrieval works
- [ ] Refresh updates local cache
- [ ] Unit tests pass

✅ **CartRepository**:
- [ ] Add/remove/update cart items works
- [ ] Cart persists in Room
- [ ] Unit tests pass

✅ **OrderRepository**:
- [ ] Order creation works (online + offline queue)
- [ ] Active orders flow works
- [ ] Unit tests pass

✅ **PaymentRepository**:
- [ ] Payment initiation/verification works
- [ ] Unit tests pass

### Success Criteria:
```bash
./gradlew test # 50+ unit tests passing
```

---

## PHASE 3-6 SUMMARY (For Complete Details See Continuation Document)

Due to length constraints, the following phases are summarized. Full implementation details available in the codebase:

### PHASE 3: USE CASES & VIEWMODELS (Week 2, Days 4-5)
- Implement Use Cases (LoginUseCase, GetMenuUseCase, PlaceOrderUseCase, etc.)
- Implement ViewModels (LoginViewModel, MenuViewModel, CartViewModel, etc.)
- Test each ViewModel with repository mocks
- **Gate**: All ViewModels must pass unit tests before UI

### PHASE 4: AUTHENTICATION UI (Week 3, Days 1-2)
- Build Login/Register screens
- Implement Google Sign-In integration
- Profile setup flow
- **Gate**: Auth flow must work end-to-end before menu UI

### PHASE 5: MENU & CART UI (Week 3-4)
- Menu browsing screens
- Category filters
- Search functionality
- Cart management UI
- **Gate**: Menu must display real API data before order UI

### PHASE 6: ORDER & PAYMENT UI (Week 4-5)
- Checkout flow
- Razorpay integration
- Order tracking screens
- **Gate**: Payment must work end-to-end before push notifications

### PHASE 7: REAL-TIME FEATURES (Week 5-6)
- Socket.IO integration
- WebSocket event handling
- Real-time order status updates
- **Gate**: WebSocket must handle reconnection before FCM

### PHASE 8: PUSH NOTIFICATIONS (Week 6)
- FCM setup
- Notification channels
- Deep linking
- **Gate**: Notifications must work before offline features

### PHASE 9: OFFLINE SUPPORT (Week 7-8)
- WorkManager offline sync
- Cache management
- Network monitoring
- **Gate**: Offline sync must work before final testing

### PHASE 10: TESTING & POLISH (Week 9-10)
- Integration testing
- UI testing
- Performance optimization
- Bug fixes

---

## CRITICAL ANTI-PATTERNS PREVENTION

### ❌ Anti-Pattern #1: Premature UI Building

**What NOT to Do**:
```kotlin
// DON'T: Building UI before repository layer exists
class MenuFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        // Hardcoded menu items
        val items = listOf(
            MenuItem("1", "Pizza", 200.0), // WRONG: Mock data in production code
            MenuItem("2", "Burger", 150.0)
        )
        adapter.submitList(items)
    }
}
```

**Why It's Wrong**:
- Mock data hides integration issues
- Wastes time on UI that needs rework
- No way to test real data flow

**Correct Approach**:
1. Build Repository → Test with real API
2. Build ViewModel → Test with repository
3. Build UI → Observe ViewModel state

---

### ❌ Anti-Pattern #2: Missing Background Guarantees

**What NOT to Do**:
```kotlin
// DON'T: Showing "offline order" UI before WorkManager is tested
class CheckoutViewModel : ViewModel() {
    fun placeOrder() {
        if (!networkMonitor.isOnline()) {
            // WRONG: No guarantee sync will work
            showToast("Order will sync when online")
            // No WorkManager configured or tested
        }
    }
}
```

**Why It's Wrong**:
- Users see "offline order" message but sync never works
- No verification that WorkManager constraints are correct
- No retry logic tested

**Correct Approach**:
1. Implement OrderSyncWorker
2. Test WorkManager with NetworkType.CONNECTED constraint
3. Verify retry logic with exponential backoff
4. **THEN** show offline UI

---

### ❌ Anti-Pattern #3: Incorrect Notification Behavior

**What NOT to Do**:
```kotlin
// DON'T: Showing notification UI before FCM is tested
class SettingsFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        // WRONG: Checkbox for notifications but FCM not configured
        notificationSwitch.setOnCheckedChangeListener { _, isChecked ->
            // No FCM token, no subscription, no notification channel
            showToast("Notifications ${if (isChecked) "enabled" else "disabled"}")
        }
    }
}
```

**Why It's Wrong**:
- Users enable notifications but never receive any
- No FCM token subscription
- No notification channels created (Android 8.0+)
- No permission request (Android 13+)

**Correct Approach**:
1. Setup FCM in FirebaseMessagingService
2. Create notification channels
3. Request POST_NOTIFICATIONS permission
4. Test notification delivery (foreground + background)
5. Test deep linking on notification tap
6. **THEN** show notification toggle UI

---

## IMPLEMENTATION ORDER DECISION TREE

```
Start
  ↓
Can this component be unit tested WITHOUT Android framework?
  ↓
YES → Implement in Domain layer (models, use cases)
  |
  ↓
NO → Does it interact with network or database?
  |
  ↓
YES → Implement in Data layer (repositories, DAOs, APIs)
  |
  ↓
NO → Does it manage UI state?
  |
  ↓
YES → Implement in Presentation layer (ViewModels)
  |
  ↓
NO → Does it render UI?
  |
  ↓
YES → Implement in UI layer (Activities, Fragments, Compose)
  |
  ↓
Done

**Rule**: Always build from bottom (Domain) to top (UI)
```

---

## TESTING STRATEGY PER PHASE

### Phase 0-1: Foundation
- **Unit Tests**: Domain models, mappers
- **Instrumented Tests**: Room DAOs, DataStore
- **Integration Tests**: Hilt injection

### Phase 2: Repositories
- **Unit Tests**: Repository with mocked API + DAO
- **Integration Tests**: Repository with real Room, mocked API
- **No UI Tests**: UI doesn't exist yet

### Phase 3: Use Cases + ViewModels
- **Unit Tests**: Use cases with mocked repositories
- **Unit Tests**: ViewModels with mocked use cases
- **No Integration Tests**: No UI to integrate with

### Phase 4-9: UI Implementation
- **Unit Tests**: Continue testing ViewModels
- **UI Tests**: Espresso/Compose tests for user flows
- **Integration Tests**: End-to-end flows (login → browse → order → pay)

### Phase 10: Final Testing
- **Manual Testing**: All user scenarios
- **Regression Tests**: Ensure old features still work
- **Performance Tests**: Scroll FPS, memory leaks

---

## FINAL CHECKLIST BEFORE PRODUCTION

### ✅ Foundation (Phase 0-1)
- [ ] All dependencies declared and stable
- [ ] Hilt injection works in all modules
- [ ] Room database migrations tested
- [ ] Network security config correct (HTTPS only in production)

### ✅ Data Layer (Phase 2)
- [ ] All repositories tested with mocks
- [ ] Error handling works (network failures, timeouts)
- [ ] Cache invalidation strategy implemented
- [ ] No repository directly accessed from UI

### ✅ Domain Layer (Phase 3)
- [ ] All use cases have single responsibility
- [ ] No Android dependencies in domain package
- [ ] Business logic testable without Android framework

### ✅ Presentation Layer (Phase 3-9)
- [ ] All ViewModels tested with repository mocks
- [ ] UiState correctly represents all UI states (Loading, Success, Error)
- [ ] Navigation handled correctly
- [ ] Configuration changes handled (ViewModel survives rotation)

### ✅ UI Layer (Phase 4-9)
- [ ] UI observes ViewModels, never accesses repositories
- [ ] Loading states displayed correctly
- [ ] Error messages user-friendly
- [ ] Empty states handled

### ✅ Real-Time Features (Phase 7)
- [ ] WebSocket reconnection works
- [ ] Event ordering correct
- [ ] Duplicate events handled
- [ ] Offline queue syncs when online

### ✅ Push Notifications (Phase 8)
- [ ] FCM token subscribed to backend
- [ ] Notifications display correctly (foreground + background)
- [ ] Deep linking works
- [ ] Notification channels created
- [ ] POST_NOTIFICATIONS permission requested (Android 13+)

### ✅ Offline Support (Phase 9)
- [ ] WorkManager syncs pending orders
- [ ] Network monitoring works
- [ ] Cache TTL respected
- [ ] Offline UI indicators shown

### ✅ Testing (Phase 10)
- [ ] 100+ unit tests passing
- [ ] 50+ instrumented tests passing
- [ ] All critical user flows tested end-to-end
- [ ] No memory leaks (LeakCanary)
- [ ] No ANRs (Application Not Responding)
- [ ] Crash-free rate >99% (Firebase Crashlytics)

---

## ESTIMATED TIMELINE

| Phase | Duration | Deliverable | Test Gate |
|-------|----------|-------------|----------|
| Phase 0: Project Setup | 2 days | Project structure, dependencies | Build succeeds |
| Phase 1: Foundation | 3 days | Domain models, Room, Retrofit, Hilt | 20+ tests pass |
| Phase 2: Repositories | 3 days | All repositories implemented | 50+ tests pass |
| Phase 3: Use Cases + ViewModels | 2 days | All ViewModels implemented | 70+ tests pass |
| Phase 4: Auth UI | 2 days | Login/Register screens | Auth flow works end-to-end |
| Phase 5: Menu & Cart UI | 5 days | Menu browsing, cart management | Menu displays real data |
| Phase 6: Order & Payment UI | 5 days | Checkout, Razorpay integration | Payment succeeds |
| Phase 7: Real-Time Features | 5 days | Socket.IO, event handling | Order status updates live |
| Phase 8: Push Notifications | 3 days | FCM setup, deep linking | Notifications work |
| Phase 9: Offline Support | 5 days | WorkManager sync | Offline orders sync |
| Phase 10: Testing & Polish | 10 days | Bug fixes, optimization | Production-ready |
| **TOTAL** | **45 days (9 weeks)** | **MVP Customer App** | **100+ tests pass** |

---

## RISK MITIGATION

### Risk #1: Razorpay Integration Failure
**Mitigation**: Test Razorpay SDK in isolation (Week 4) before integrating into order flow

### Risk #2: WebSocket Connection Unstable
**Mitigation**: Implement polling fallback (30s interval) if WebSocket fails

### Risk #3: Offline Sync Duplicate Orders
**Mitigation**: Implement idempotency keys, server-side duplicate detection

### Risk #4: FCM Token Not Received
**Mitigation**: Retry FCM token subscription with exponential backoff

### Risk #5: Room Database Migration Failure
**Mitigation**: Write migration tests, fallback to destructive migration in development

---

## END OF DOCUMENT

**Document Version**: 1.0  
**Last Updated**: 2026-01-02  
**Total Phases**: 10 phases  
**Total Duration**: 9 weeks (45 days)  
**Total Testing Gates**: 2 mandatory gates (Foundation, Repository)  
**Total Tests Expected**: 100+ tests  

**Critical Success Factors**:  
✅ **Bottom-Up Implementation**: Foundation before UI  
✅ **Test Before Proceed**: Each phase must pass tests  
✅ **No Premature UI**: UI only after data layer verified  
✅ **No Mock Data**: Real API integration from day 1  
✅ **Incremental Integration**: Test each component in isolation  

**Anti-Patterns Prevented**:  
❌ Premature UI building  
❌ Missing background guarantees  
❌ Incorrect notification behavior  
❌ Mock data in production code  
❌ ViewModels calling Retrofit directly  
❌ Missing error handling  

**Implementation Order Guarantee**:  
Domain Models → Room Entities → DAOs → Database → Retrofit APIs → Hilt Modules → Repositories → Use Cases → ViewModels → UI Screens

**This sequence ensures**:  
- No component built before its dependencies  
- Every component testable in isolation  
- Integration happens incrementally  
- Failures detected early (at layer boundary)  
- Production code never contains mock data
import com.sillobite.customer.data.local.entities.toEntity
import com.sillobite.customer.data.local.preferences.UserPreferences
import com.sillobite.customer.data.local.preferences.UserSession
import com.sillobite.customer.data.remote.api.AuthApi
import com.sillobite.customer.data.remote.dto.LoginRequest
import com.sillobite.customer.data.remote.dto.RegisterRequest
import com.sillobite.customer.data.remote.dto.toDomainModel
import com.sillobite.customer.di.IoDispatcher
import com.sillobite.customer.domain.models.User
import com.sillobite.customer.domain.repository.AuthRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val userPreferences: UserPreferences,
    private val userDao: UserDao,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) : AuthRepository {
    
    override suspend fun login(email: String, password: String): Result<User> = withContext(ioDispatcher) {
        try {
            val response = authApi.login(LoginRequest(email, password))
            
            if (response.isSuccessful) {
                val userDto = response.body()?.data
                if (userDto != null) {
                    // Save session
                    userPreferences.saveUserSession(UserSession(
                        userId = userDto.id,
                        email = userDto.email,
                        authToken = userDto.token,
                        selectedCanteenId = userDto.selectedCanteenId,
                        isLoggedIn = true
                    ))
                    
                    // Cache user in database
                    userDao.insertUser(userDto.toEntity())
                    
                    Result.success(userDto.toDomainModel())
                } else {
                    Result.failure(Exception("User data missing in response"))
                }
            } else {
                val errorBody = response.errorBody()?.string()
                Result.failure(Exception("HTTP ${response.code()}: $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun logout(): Result<Unit> = withContext(ioDispatcher) {
        try {
            authApi.logout()
            userPreferences.clearUserSession()
            userDao.clearUser()
            Result.success(Unit)
        } catch (e: Exception) {
            // Still clear local session even if API call fails
            userPreferences.clearUserSession()
            userDao.clearUser()
            Result.success(Unit)
        }
    }
    
    override fun getCurrentUser(): Flow<User?> {
        return userDao.getCurrentUser().map { it?.toDomainModel() }
    }
    
    override fun isLoggedIn(): Flow<Boolean> {
        return userPreferences.userSession.map { it?.isLoggedIn ?: false }
    }
    
    override suspend fun validateSession(): Result<User?> = withContext(ioDispatcher) {
        try {
            val session = userPreferences.userSession.firstOrNull()
            if (session == null || !session.isLoggedIn) {
                return@withContext Result.success(null)
            }
            
            val response = authApi.validateSession(session.userId)
            
            if (response.isSuccessful) {
                val userDto = response.body()?.data
                if (userDto != null) {
                    userDao.insertUser(userDto.toEntity())
                    Result.success(userDto.toDomainModel())
                } else {
                    Result.success(null)
                }
            } else if (response.code() in 401..403) {
                // Session invalid, clear
                userPreferences.clearUserSession()
                userDao.clearUser()
                Result.success(null)
            } else {
                // Network error, keep local session
                val cachedUser = userDao.getCurrentUser().firstOrNull()
                Result.success(cachedUser?.toDomainModel())
            }
        } catch (e: Exception) {
            // Network error, keep local session
            val cachedUser = userDao.getCurrentUser().firstOrNull()
            Result.success(cachedUser?.toDomainModel())
        }
    }
    
    // register(), googleSignIn() implementations follow similar pattern
}
```

**Why This First**:
- Auth is the foundation of all user interactions
- Other repositories depend on auth state (token in headers)
- Must be tested before any feature development

**Test Immediately**:

Create: `data/repository/AuthRepositoryImplTest.kt`
```kotlin
package com.sillobite.customer.data.repository

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.sillobite.customer.data.local.dao.UserDao
import com.sillobite.customer.data.local.preferences.UserPreferences
import com.sillobite.customer.data.remote.api.AuthApi
import com.sillobite.customer.data.remote.dto.ApiResponse
import com.sillobite.customer.data.remote.dto.LoginRequest
import com.sillobite.customer.data.remote.dto.UserDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.MockitoAnnotations
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class AuthRepositoryImplTest {
    
    @Mock
    private lateinit var authApi: AuthApi
    
    @Mock
    private lateinit var userPreferences: UserPreferences
    
    @Mock
    private lateinit var userDao: UserDao
    
    private lateinit var repository: AuthRepositoryImpl
    
    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        repository = AuthRepositoryImpl(authApi, userPreferences, userDao, Dispatchers.Unconfined)
    }
    
    @Test
    fun `login success saves session and returns user`() = runTest {
        val userDto = UserDto(
            id = "123",
            email = "test@example.com",
            name = "Test User",
            phoneNumber = null,
            role = "student",
            isProfileComplete = true,
            selectedCanteenId = null,
            token = "jwt_token"
        )
        
        `when`(authApi.login(any())).thenReturn(
            Response.success(ApiResponse(true, "Success", userDto, null))
        )
        
        val result = repository.login("test@example.com", "password")
        
        assertTrue(result.isSuccess)
        assertEquals("Test User", result.getOrNull()?.name)
        verify(userPreferences).saveUserSession(any())
        verify(userDao).insertUser(any())
    }
    
    @Test
    fun `login failure returns error`() = runTest {
        `when`(authApi.login(any())).thenReturn(
            Response.error(401, okhttp3.ResponseBody.create(null, "Unauthorized"))
        )
        
        val result = repository.login("test@example.com", "wrong_password")
        
        assertTrue(result.isFailure)
    }
    
    @Test
    fun `logout clears session and cache`() = runTest {
        `when`(authApi.logout()).thenReturn(
            Response.success(ApiResponse(true, "Logged out", Unit, null))
        )
        
        val result = repository.logout()
        
        assertTrue(result.isSuccess)
        verify(userPreferences).clearUserSession()
        verify(userDao).clearUser()
    }
}
```

Run tests:
```bash
./gradlew test
```
- ✅ Login success test passes
- ✅ Login failure test passes
- ✅ Logout clears session
- ✅ Session validation works correctly

**Must NOT Implement Yet**:
- ❌ Use cases (next step)
- ❌ ViewModels
- ❌ UI screens

---

### Step 2.2: Implement MenuRepository

**What to Implement**:

**MenuRepository.kt** (Interface):
```kotlin
package com.sillobite.customer.domain.repository

import com.sillobite.customer.domain.models.MenuItem
import kotlinx.coroutines.flow.Flow

interface MenuRepository {
    fun getMenuItemsFlow(canteenId: String, filters: MenuFilters? = null): Flow<List<MenuItem>>
    suspend fun refreshMenu(canteenId: String): Result<Unit>
    suspend fun searchMenu(canteenId: String, query: String): Result<List<MenuItem>>
    suspend fun getMenuItemById(id: String): MenuItem?
}

data class MenuFilters(
    val vegOnly: Boolean = false,
    val availableOnly: Boolean = true,
    val categoryId: String? = null
)
```

**MenuRepositoryImpl.kt**:
```kotlin
package com.sillobite.customer.data.repository

import com.sillobite.customer.data.local.dao.MenuItemDao
import com.sillobite.customer.data.local.entities.toDomainModel
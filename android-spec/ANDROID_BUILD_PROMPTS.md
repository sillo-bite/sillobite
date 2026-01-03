# Android Notification Helper - Step-by-Step Build Prompts

**Project**: Canteen Owner Order Notification Helper  
**Platform**: Android (Kotlin)  
**Purpose**: Real-time order notifications for canteen owners via WebSocket  
**Date**: 2026-01-03

---

## Overview

This document contains step-by-step prompts to guide an AI or developer through building an Android notification helper app. Each prompt is self-contained and describes **what to build**, **requirements**, and **expected behavior** - without providing actual code.

---

## Table of Contents

1. [Project Setup & Configuration](#phase-1-project-setup--configuration)
2. [Authentication System](#phase-2-authentication-system)
3. [WebSocket Connection](#phase-3-websocket-connection)
4. [Foreground Service & Notifications](#phase-4-foreground-service--notifications)
5. [User Interface](#phase-5-user-interface)
6. [Testing & Validation](#phase-6-testing--validation)
7. [Build & Deployment](#phase-7-build--deployment)

---

## Phase 1: Project Setup & Configuration

### Prompt 1.1: Create Android Project Structure

**Task**: Initialize a new Android project with proper configuration for a notification helper app.

**Requirements**:
- Project name: "CanteenOwnerHelper" or similar
- Package name following convention: `com.sillobite.owner.helper`
- Language: Kotlin only
- Minimum SDK: API 26 (Android 8.0 Oreo)
- Target SDK: API 34 (Android 14)
- Build system: Gradle with Kotlin DSL
- Architecture pattern: Single Activity with Jetpack Compose

**Expected Output**:
- Project directory structure created
- `build.gradle.kts` files configured
- `settings.gradle.kts` configured

**Reference**: Based on `android-spec/android-connection-requirements.md` (section 1.1)

---

### Prompt 1.2: Configure Dependencies

**Task**: Add all required dependencies to the project's build configuration.

**Dependencies to Include**:

1. **Core Android**:
   - AndroidX Core KTX
   - Lifecycle Runtime KTX
   - Activity Compose

2. **Jetpack Compose**:
   - Compose BOM (Bill of Materials)
   - UI components
   - Material 3
   - Material Icons Extended
   - Navigation Compose

3. **Networking**:
   - Socket.IO Client for Android (version 2.1.0 or compatible)
   - OkHttp (required by Socket.IO)
   - Retrofit (for REST API calls)
   - Gson converter for Retrofit

4. **Storage**:
   - DataStore Preferences (for secure token storage)

5. **Coroutines**:
   - Kotlinx Coroutines Android

6. **Testing**:
   - JUnit
   - AndroidX Test
   - Espresso
   - Compose UI Test

**Build Features to Enable**:
- Compose support
- BuildConfig generation

**Kotlin Options**:
- JVM target: Java 17
- Compose compiler extension

**Expected Output**:
- All dependencies declared in `app/build.gradle.kts`
- Build features configured
- Project syncs successfully

**Reference**: Based on `android-spec/14-android-dependency-configuration.md`

---

### Prompt 1.3: Configure Android Manifest

**Task**: Create AndroidManifest.xml with all required permissions and service declarations.

**Permissions Required**:
1. `INTERNET` - For WebSocket and REST API communication
2. `FOREGROUND_SERVICE` - For persistent notification service
3. `FOREGROUND_SERVICE_DATA_SYNC` - Specific foreground service type (Android 14+)
4. `POST_NOTIFICATIONS` - For displaying notifications (Android 13+)
5. `VIBRATE` - For notification vibration
6. `WAKE_LOCK` - To keep service alive

**Application Configuration**:
- Custom Application class (to be created)
- App name, icon, theme references
- Support RTL layouts
- Backup rules

**Service Declaration**:
- Foreground service for order notifications
- Service type: `dataSync`
- Not exported (internal use only)

**Activity Declaration**:
- Main launcher activity
- Single activity architecture
- Launch mode: standard

**Expected Output**:
- Complete AndroidManifest.xml file
- All permissions declared
- Service and activity properly configured

**Reference**: Based on `android/app/src/main/AndroidManifest.xml` and `android-spec/android-connection-requirements.md` (section 1.1)

---

### Prompt 1.4: Create Application Class

**Task**: Create a custom Application class to initialize app-wide components.

**Responsibilities**:
- Initialize DataStore for secure storage
- Create singleton instances for:
  - API client (Retrofit)
  - Socket manager (Socket.IO)
  - Token storage manager
- Create notification channel for order notifications

**Notification Channel Configuration**:
- Channel ID: "order_notifications"
- Channel Name: "Order Notifications"
- Importance: HIGH (for heads-up notifications)
- Features enabled:
  - Lights (LED notification)
  - Vibration
  - Badge display
- Description: "Critical order notifications that require immediate attention"

**Lifecycle**:
- onCreate: Initialize all components
- Create notification channel (Android 8.0+)
- Provide public accessors for managers

**Expected Output**:
- Application class properly extending Android Application
- All managers initialized
- Notification channel created
- Registered in AndroidManifest

**Reference**: Based on `android/app/src/main/java/.../service/OrderForegroundService.kt` (lines 220-230)

---

## Phase 2: Authentication System

### Prompt 2.1: Create Secure Token Storage

**Task**: Build a secure storage system using DataStore Preferences for user session data.

**Data to Store**:
1. `email` - User's email address (String)
2. `userId` - PostgreSQL user ID (String)
3. `userRole` - User role, must be "canteen_owner" (String)
4. `canteenId` - MongoDB ObjectId of owner's canteen (String)
5. `canteenName` - Display name of canteen (String)
6. `serverUrl` - WebSocket/API server base URL (String)
7. `isAuthenticated` - Authentication status flag (Boolean)

**Required Operations**:
1. **Save session** - Save complete user session atomically
2. **Get session** - Retrieve session as observable Flow
3. **Get session sync** - Retrieve session synchronously (suspend function)
4. **Check authentication** - Return Flow<Boolean> for auth state
5. **Clear session** - Delete all stored data (logout)
6. **Get specific fields** - Individual getters for canteenId, serverUrl

**Technical Requirements**:
- Use DataStore Preferences (NOT SharedPreferences)
- All operations thread-safe
- Observable state changes via Kotlin Flow
- Handle null cases gracefully
- Log all operations for debugging

**Expected Output**:
- TokenStorage class with all operations
- Data class for UserSession
- Flow-based reactive state
- Proper error handling

**Reference**: Memory - "Android Secure Token Storage Requirements", `android-spec/android-connection-requirements.md` (section 2)

---

### Prompt 2.2: Create REST API Client

**Task**: Build a REST API client using Retrofit for authentication and canteen data retrieval.

**Base Configuration**:
- Base URL: Configurable (default: http://10.0.2.2:5000 for emulator)
- Timeout: 30 seconds for all operations
- Logging: HTTP request/response logging in debug mode
- JSON serialization: Gson with lenient parsing

**API Endpoints to Implement**:

1. **Login**:
   - Method: POST
   - Path: `/api/auth/login`
   - Request body: `{ identifier: string, password: string }`
   - Response: `{ message: string, user: User }`
   - User fields: id, email, name, role, phoneNumber

2. **Get Canteen by Owner**:
   - Method: GET
   - Path: `/api/system-settings/canteens/by-owner/:email`
   - Path parameter: email (owner's email)
   - Response: `{ canteen: Canteen }`
   - Canteen fields: id, name, code, canteenOwnerEmail, isActive, location, contactNumber

3. **Get Counters**:
   - Method: GET
   - Path: `/api/counters`
   - Query parameter: `canteenId` (MongoDB ObjectId)
   - Response: Array of Counter objects
   - Counter fields: _id, name, type, canteenId, isActive, description

**Features**:
- Dynamic base URL configuration
- Retrofit interface with suspend functions
- OkHttp logging interceptor
- Gson converter
- Data classes for all request/response models

**Error Handling**:
- Network timeout
- HTTP error codes (401, 404, 500)
- JSON parsing errors
- Unknown host exceptions

**Expected Output**:
- ApiClient class with initialization method
- Retrofit service interface
- All data classes for requests/responses
- Proper error propagation

**Reference**: `android-spec/04-rest-apis.md`, `android-spec/android-connection-requirements.md` (sections 2-3)

---

### Prompt 2.3: Build Login Screen UI

**Task**: Create a login screen using Jetpack Compose with Material 3 design.

**UI Components Required**:
1. **App Branding**:
   - App icon/logo
   - App title: "Canteen Owner Helper"

2. **Input Fields**:
   - Server URL text field
     - Label: "Server URL"
     - Placeholder: "http://10.0.2.2:5000"
     - Keyboard type: URI
     - Leading icon: Cloud icon
   - Email text field
     - Label: "Email"
     - Placeholder: "owner@example.com"
     - Keyboard type: Email
     - Leading icon: Email icon
     - Error state support
   - Password text field
     - Label: "Password"
     - Obscured input
     - Leading icon: Lock icon
     - Trailing icon: Visibility toggle
     - Error state support

3. **Actions**:
   - Login button
     - Full width
     - Shows loading indicator during authentication
     - Disabled when inputs invalid or loading
     - Icon: Login icon

4. **Status Display**:
   - Loading indicator during authentication
   - Error message card (red background)
   - Error icon with message text

**Behavior**:
- All fields enabled/disabled together during loading
- Real-time validation feedback
- Error messages clear when user types
- Keyboard automatically dismisses on login
- Navigate to home screen on success

**Expected Output**:
- LoginScreen composable function
- Material 3 design system
- Proper state management
- Accessibility support

**Reference**: Based on `client/src/components/auth/LoginScreen.tsx`

---

### Prompt 2.4: Create Login ViewModel

**Task**: Build a ViewModel to handle login business logic.

**UI State to Manage**:
- serverUrl (String, default: "http://10.0.2.2:5000")
- email (String, default: "")
- password (String, default: "")
- isLoading (Boolean, default: false)
- isAuthenticated (Boolean, default: false)
- emailError (String?, nullable)
- passwordError (String?, nullable)
- errorMessage (String?, nullable)

**Input Handlers**:
1. `onServerUrlChange(url: String)` - Update server URL, clear errors
2. `onEmailChange(email: String)` - Update email, clear email error
3. `onPasswordChange(password: String)` - Update password, clear password error

**Validation Logic**:
1. **Email validation**:
   - Must not be blank
   - Must match email pattern (use Android Patterns.EMAIL_ADDRESS)
   - Set emailError if invalid

2. **Password validation**:
   - Must not be blank
   - Must be at least 6 characters
   - Set passwordError if invalid

3. **Server URL validation**:
   - Must not be blank
   - Set generic errorMessage if invalid

**Login Flow** (onLoginClick):
1. Validate all inputs - stop if any invalid
2. Set isLoading = true
3. Initialize API client with server URL
4. Call login API with email and password
5. Verify user role is "canteen_owner" (reject if not)
6. Call get canteen API with user email
7. Create UserSession object with all data
8. Save session to TokenStorage
9. Set isAuthenticated = true
10. Handle errors appropriately

**Error Handling**:
- HTTP 401: "Invalid email or password"
- HTTP 404: "No canteen found for this owner"
- HTTP 500: "Server error. Please try again later"
- SocketTimeoutException: "Connection timeout. Check server URL and internet"
- UnknownHostException: "Cannot reach server. Check server URL: {url}"
- Other exceptions: "Login failed: {message}"

**Expected Output**:
- LoginViewModel extending AndroidViewModel
- UI state as StateFlow
- Proper error handling for all scenarios
- Logging for debugging

**Reference**: `android-spec/android-connection-requirements.md` (section 8.1), `client/src/components/auth/LoginScreen.tsx`

---

## Phase 3: WebSocket Connection

### Prompt 3.1: Create Socket Manager

**Task**: Build a WebSocket manager using Socket.IO client for real-time order updates.

**Connection Configuration**:
- Server URL: Retrieved from TokenStorage
- Transport: WebSocket primary, polling fallback
- Reconnection: Enabled
- Reconnection delay: Start at 1 second
- Reconnection delay max: 8 seconds
- Reconnection attempts: 10 maximum
- Connection timeout: 15 seconds

**Connection States to Track**:
1. Disconnected - Not connected
2. Connecting - Connection in progress
3. Connected - Successfully connected
4. Error(message) - Connection failed with reason

**Socket Events to Handle**:
1. **connect** - Connection established
   - Log socket ID
   - Reset reconnect attempts counter
   - Update state to Connected
   - Auto-rejoin all rooms (CRITICAL: rooms not auto-rejoined by server)

2. **connect_error** - Connection failed
   - Log error details
   - Update state to Error

3. **disconnect** - Connection lost
   - Log disconnect reason
   - Update state to Disconnected

4. **roomJoined** - Canteen room join confirmation
   - Receive canteenIds array
   - Log joined rooms

5. **counterRoomJoined** - Counter room join confirmation
   - Receive counterId and canteenId
   - Log confirmation

6. **orderUpdate** - New order or order status change (CRITICAL)
   - Parse message JSON
   - Extract: type, data, orderNumber, oldStatus, newStatus
   - Emit to observable Flow
   - Log event details

7. **error** - Socket error
   - Log error message

**Room Management**:

1. **Join Canteen Room**:
   - Emit event: "joinCanteenRooms"
   - Payload: `{ canteenIds: [canteenId], userId: userId, userRole: "canteen_owner" }`
   - Store canteenId for reconnection

2. **Join Counter Room** (optional):
   - Emit event: "joinCounterRoom"
   - Payload: `{ counterId: counterId, canteenId: canteenId }`
   - Store counterId for reconnection

3. **Leave Canteen Room**:
   - Emit event: "leaveCanteenRooms"
   - Payload: `{ canteenIds: [canteenId] }`
   - Clear stored canteenId

4. **Leave Counter Room**:
   - Emit event: "leaveCounterRoom"
   - Payload: `{ counterId: counterId }`
   - Remove from stored counterIds

**Order Update Data Structure**:
- type: String (e.g., "new_order", "order_status_changed")
- data: JSONObject (full order data)
- orderNumber: String
- oldStatus: String (for status changes)
- newStatus: String (for status changes)
- timestamp: Long (local timestamp of receipt)

**Observable State**:
- Connection state: StateFlow<ConnectionState>
- Order updates: StateFlow<OrderUpdate?>

**Reconnection Strategy**:
- Calculate exponential backoff: base 1s * 2^attempts, max 8s
- Track reconnection attempts
- Reset counter on successful connection
- Auto-rejoin all stored rooms on reconnection (CRITICAL)

**Expected Output**:
- SocketManager class
- Connection state management
- Room join/leave logic
- Order event parsing
- Observable Flows for UI
- Proper lifecycle management

**Reference**: `android-spec/android-connection-requirements.md` (section 9.1), `server/websocket.ts`, Memory - "Manual room rejoin required after WebSocket reconnection"

---

## Phase 4: Foreground Service & Notifications

### Prompt 4.1: Create Foreground Service

**Task**: Build a foreground service that displays persistent notifications and plays alarm sounds for critical orders.

**Service Configuration**:
- Type: Foreground Service (dataSync type)
- Notification ID: 1001 (constant)
- Notification Channel: Use channel created in Application class

**Service Actions** (via Intent):
1. **ACTION_START_FOREGROUND**:
   - Extra: EXTRA_ORDER_COUNT (Int)
   - Start foreground service
   - Display notification
   - Start alarm sound

2. **ACTION_UPDATE_COUNT**:
   - Extra: EXTRA_ORDER_COUNT (Int)
   - Update notification with new count
   - Keep alarm playing

3. **ACTION_STOP_FOREGROUND**:
   - Stop alarm sound
   - Remove notification
   - Stop service

**Notification Requirements**:
- Priority: HIGH (heads-up notification)
- Category: ALARM
- Ongoing: true (non-dismissible)
- AutoCancel: false
- Small icon: App notification icon
- Title: "New Order Received"
- Text: 
  - 1 order: "1 critical order requires attention"
  - Multiple: "{count} critical orders require attention"
- ContentIntent: Opens MainActivity when tapped
- Vibration pattern: [200ms, 100ms, 200ms]
- LED light: Red color, 1 second on/off

**MediaPlayer Configuration**:
- Audio source: `res/raw/order_alarm.mp3` (if exists, else system default)
- Audio attributes: USAGE_ALARM, CONTENT_TYPE_SONIFICATION
- Looping: true (plays continuously)
- Initialize in onCreate, release in onDestroy

**Alarm Sound Behavior**:
- Start when first critical order received
- Loop continuously until service stopped
- Safe from duplicate starts (check isPlaying flag)
- Pause and reset to beginning on stop
- Release MediaPlayer on service destroy

**Lifecycle**:
- onCreate: Initialize notification manager and MediaPlayer
- onStartCommand: Handle action intents
- onDestroy: Release MediaPlayer, cleanup
- Return START_STICKY (restart if killed by system)

**Update Logic**:
- If orderCount > 0: Update notification, ensure alarm playing
- If orderCount == 0: Stop service automatically

**Expected Output**:
- OrderForegroundService class extending Service
- Notification builder method
- MediaPlayer management
- Action handlers
- Proper lifecycle management
- Logging for debugging

**Reference**: `android/app/src/main/java/.../service/OrderForegroundService.kt`, `android-spec/android-helper-responsibilities.md` (sound behavior rules)

---

### Prompt 4.2: Add Alarm Sound Resource

**Task**: Add alarm sound file to project resources.

**Requirements**:
- Location: `app/src/main/res/raw/order_alarm.mp3`
- Format: MP3 audio file
- Duration: 3-5 seconds (will loop automatically)
- Volume level: Clear and attention-grabbing, not startling
- File size: Under 100KB recommended

**Fallback Behavior**:
- If file not provided, service uses: `android.provider.Settings.System.DEFAULT_NOTIFICATION_URI`
- This is handled in MediaPlayer initialization

**Sound Selection Guidelines**:
- Should be distinctive (not easily confused with other notifications)
- Professional tone (not annoying or jarring)
- Clear enough to hear in busy canteen environment
- Not so loud as to startle users

**Expected Output**:
- MP3 file placed in res/raw/ directory
- File named: order_alarm.mp3
- Service can load and play the file

**Reference**: `android/app/src/main/java/.../service/OrderForegroundService.kt` (lines 244-251)

---

### Prompt 4.3: Request Notification Permission

**Task**: Create a composable function to request POST_NOTIFICATIONS permission (Android 13+).

**Platform Check**:
- Only request permission on Android 13+ (API 33+)
- Below Android 13: Auto-grant (no permission needed)

**Permission Flow**:
1. Check if permission already granted
   - If yes: Invoke callback with true
   - If no: Continue to step 2

2. Check if should show rationale
   - If yes: Show rationale dialog first
   - If no: Request permission directly

3. Rationale dialog content:
   - Title: "Notification Permission Required"
   - Message: "This app needs notification permission to alert you when new orders arrive. Without this permission, you may miss important orders."
   - Actions:
     - Confirm: "Allow" (request permission)
     - Dismiss: "Deny" (return false)

4. Request permission:
   - Use rememberPermissionState (Accompanist library)
   - Launch permission request
   - Handle result

5. Permission denied permanently:
   - Option to open app settings
   - Show dialog explaining how to enable in settings

**Callback**:
- onPermissionResult: (Boolean) -> Unit
- Called with true if granted, false if denied

**UI Integration**:
- Can be shown as dialog
- Can be shown as dedicated screen
- Should be requested after login, before monitoring starts

**Expected Output**:
- Composable function for permission request
- Rationale dialog
- Settings navigation option
- Proper callback handling

**Reference**: Android notification permission best practices, Android 13+ requirements

---

## Phase 5: User Interface

### Prompt 5.1: Create Home Screen

**Task**: Build the main monitoring screen showing connection status and active orders.

**Screen Layout**:

1. **Top App Bar**:
   - Title: "Order Monitor"
   - Actions:
     - Settings icon button (navigate to settings)
     - Logout icon button (logout and navigate to login)

2. **Canteen Info Card**:
   - Display canteen name (large text)
   - Display owner email
   - Styled as Material 3 Card

3. **Connection Status Card**:
   - Label: "WebSocket Status:"
   - Status text with color:
     - "Connected" - Primary color
     - "Connecting..." - Default color
     - "Disconnected" - Error color
   - If active orders > 0: Show count below status
     - Text: "{count} active orders"
     - Styled prominently

4. **Control Section** (conditional):
   - Show when monitoring service is running
   - "Stop Monitoring" button
     - Full width
     - Red/error color
     - Stop icon
     - Sends ACTION_STOP_FOREGROUND to service

**Data Display**:
- Canteen name from TokenStorage
- Owner email from TokenStorage
- Socket connection state from SocketManager
- Active order count from ViewModel state

**Behavior**:
- Auto-connect socket on screen load if not connected
- Observe socket connection state changes
- Observe order update events
- Update UI reactively when new orders arrive
- Navigate to settings when settings button tapped
- Handle logout (clear session, disconnect socket, navigate to login)

**Expected Output**:
- HomeScreen composable function
- ViewModel for business logic
- Reactive UI updates
- Proper navigation

**Reference**: Standard Android dashboard patterns, `android-spec/android-helper-responsibilities.md`

---

### Prompt 5.2: Create Home ViewModel

**Task**: Build a ViewModel to manage home screen business logic.

**UI State to Manage**:
- canteenName: String
- canteenId: String
- ownerEmail: String
- isSocketConnected: Boolean
- isSocketConnecting: Boolean
- activeOrderCount: Int
- isServiceRunning: Boolean

**Initialization**:
1. Load user session from TokenStorage
2. Update UI state with session data
3. Connect socket if not already connected
4. Observe socket connection state changes
5. Observe order update events

**Order Handling**:
1. Listen for orderUpdate events from SocketManager
2. Filter for "new_order" and "new_offline_order" types
3. Increment activeOrderCount
4. Start or update foreground service:
   - Create Intent with ACTION_START_FOREGROUND or ACTION_UPDATE_COUNT
   - Include EXTRA_ORDER_COUNT with current count
   - Start service via context.startService()

**Socket Connection**:
- Observe SocketManager.connectionState Flow
- Map states to UI boolean flags:
  - Connected → isSocketConnected = true
  - Connecting → isSocketConnecting = true
  - Disconnected → both false
  - Error → isSocketConnected = false

**Lifecycle**:
- Initialize: Load session, connect socket, start observing
- onCleared: Do NOT disconnect socket (must persist)

**Expected Output**:
- HomeViewModel extending AndroidViewModel
- UI state as StateFlow
- Order event handling logic
- Service start/update logic
- Socket state observation

**Reference**: `android-spec/android-connection-requirements.md` (section 8), Memory - "Critical Socket Event: New Order Received"

---

### Prompt 5.3: Create Settings Screen

**Task**: Build a settings screen to display app and canteen configuration.

**Screen Layout**:

1. **Top App Bar**:
   - Title: "Settings"
   - Navigation icon: Back arrow (navigate back)

2. **Server Configuration Section**:
   - OutlinedTextField (disabled, read-only)
   - Label: "Server URL"
   - Value: Current server URL from session
   - Purpose: Display only, not editable

3. **Canteen Information Section**:
   - Section header: "Canteen Information"
   - Text rows:
     - "Name: {canteenName}"
     - "ID: {canteenId}"
   - Styled as body text

4. **App Information Section**:
   - Text: "App Version: {versionName}"
   - Small text style
   - Positioned at bottom or in separate section

**Data Sources**:
- Server URL: TokenStorage.serverUrl
- Canteen name: TokenStorage.canteenName
- Canteen ID: TokenStorage.canteenId
- App version: BuildConfig.VERSION_NAME

**Behavior**:
- All fields read-only (display only)
- Back button navigates to previous screen
- No edit functionality (configuration set at login)

**Future Enhancements** (optional mentions):
- Sound volume control
- Notification priority toggle
- Theme selection
- About section

**Expected Output**:
- SettingsScreen composable function
- ViewModel for data loading
- Read-only field display
- Proper navigation

**Reference**: Standard Android settings screen patterns

---

### Prompt 5.4: Create Settings ViewModel

**Task**: Build a ViewModel to load and provide settings data.

**UI State to Manage**:
- serverUrl: String
- canteenName: String
- canteenId: String
- appVersion: String (from BuildConfig.VERSION_NAME)

**Initialization**:
1. Load user session from TokenStorage
2. Extract serverUrl, canteenName, canteenId
3. Update UI state
4. Get app version from BuildConfig

**Data Flow**:
- TokenStorage.getUserSession() → Flow → collect → update state
- Reactive updates if session changes

**Expected Output**:
- SettingsViewModel extending AndroidViewModel
- UI state as StateFlow
- Session data loading
- No edit operations

---

### Prompt 5.5: Setup Navigation Graph

**Task**: Create navigation structure for the app using Navigation Compose.

**Screen Destinations**:
1. **Login Screen** - Route: "login"
   - Start destination if not authenticated
   - On login success: Navigate to Home, clear back stack

2. **Home Screen** - Route: "home"
   - Start destination if authenticated
   - On settings click: Navigate to Settings
   - On logout click: Navigate to Login, clear entire back stack

3. **Settings Screen** - Route: "settings"
   - On back click: Pop back stack

**Navigation Rules**:
- Login → Home: Clear back stack (prevent back to login)
- Home → Settings: Normal navigation
- Settings → Home: Pop back stack
- Logout from any screen: Navigate to Login, clear all back stack

**Authentication Check**:
- Read isAuthenticated from TokenStorage.isAuthenticated() Flow
- Determine start destination based on auth state
- Collected as state in MainActivity

**Expected Output**:
- Screen sealed class with route constants
- AppNavigation composable function
- NavHost with all destinations
- Proper back stack management

**Reference**: Jetpack Compose navigation best practices

---

### Prompt 5.6: Setup MainActivity

**Task**: Create the main entry point activity for the app.

**Responsibilities**:
1. Set Compose content
2. Apply Material 3 theme
3. Observe authentication state from TokenStorage
4. Pass authentication state to navigation
5. Setup proper window configuration

**Theme Application**:
- Custom theme: "CanteenOwnerHelperTheme" or similar
- Material 3 design system
- Dynamic color support (Android 12+)
- Dark/Light theme based on system preference

**Layout**:
- Full screen Surface
- Background color from theme
- AppNavigation as content
- Pass isAuthenticated state to navigation

**Lifecycle**:
- onCreate: Set compose content
- No other lifecycle management needed (handled by ViewModels and services)

**Expected Output**:
- MainActivity class extending ComponentActivity
- Compose setup
- Theme application
- Authentication state observation

**Reference**: Standard Jetpack Compose single-activity architecture

---

### Prompt 5.7: Create Material 3 Theme

**Task**: Setup Material 3 theme with color scheme and typography.

**Theme Structure**:

1. **Color Scheme**:
   - Light color scheme with Material 3 colors
   - Dark color scheme with Material 3 colors
   - Dynamic color support (Android 12+)
   - Primary color: Purple/Blue tone suitable for restaurant/food apps
   - Error color: Standard Material red
   - All semantic color tokens defined

2. **Typography**:
   - Material 3 type scale
   - Default font family initially
   - Proper text styles for all components

3. **Theme Composable**:
   - Parameter: darkTheme (detect from system)
   - Parameter: dynamicColor (enable for Android 12+)
   - Select appropriate color scheme
   - Apply to MaterialTheme

**Color Definitions**:
- Create Color.kt with all color constants
- Light theme colors
- Dark theme colors
- Follow Material 3 naming convention (md_theme_light_*, md_theme_dark_*)

**Typography**:
- Create Type.kt with Typography definition
- Define text styles for different text types

**System UI**:
- Configure status bar color
- Configure status bar icon color (light/dark based on theme)

**Expected Output**:
- Theme.kt with theme composable
- Color.kt with color definitions
- Type.kt with typography
- Dynamic theme switching

**Reference**: Material 3 design guidelines, Jetpack Compose theming

---

### Prompt 5.8: Create App Icons and Resources

**Task**: Add required drawable resources and app icons.

**Resources Needed**:

1. **Notification Icon** (`ic_notification.xml`):
   - Vector drawable
   - Simple icon (bell, food, or restaurant icon)
   - 24dp size
   - Monochrome (single color)
   - Used in notification small icon

2. **App Launcher Icon**:
   - Adaptive icon (foreground + background)
   - Various densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
   - Represents canteen/food service/notifications

3. **Other Icons** (if not using Material Icons):
   - Login, logout, settings icons
   - Or use Material Icons Extended library

**Icon Guidelines**:
- Follow Material Design icon principles
- Notification icon must be monochrome (Android requirement)
- Launcher icon should be recognizable
- Adaptive icon for Android 8.0+

**Expected Output**:
- ic_notification.xml vector drawable
- App launcher icons in all densities
- Proper resource organization

---

## Phase 6: Testing & Validation

### Prompt 6.1: Unit Test - TokenStorage

**Task**: Write unit tests for TokenStorage functionality.

**Test Cases**:
1. Save and retrieve complete user session
2. Retrieve null when no session exists
3. Check authentication returns false when not authenticated
4. Check authentication returns true when authenticated
5. Clear session removes all data
6. Get specific fields (canteenId, serverUrl) individually
7. Observable Flow emits updates when session changes

**Test Framework**:
- JUnit 4 or 5
- Kotlinx Coroutines Test
- Turbine or similar for Flow testing

**Mock/Fake**:
- Use in-memory DataStore or test DataStore

**Expected Output**:
- TokenStorageTest.kt with all test cases
- All tests passing
- Code coverage > 80%

---

### Prompt 6.2: Unit Test - ApiClient

**Task**: Write unit tests for ApiClient REST API calls.

**Test Cases**:
1. Successful login returns user data
2. Login with wrong credentials returns 401 error
3. Get canteen by owner returns canteen data
4. Get canteen with non-existent email returns 404
5. Get counters returns list of counters
6. Network timeout throws appropriate exception
7. Base URL configuration updates correctly

**Test Framework**:
- JUnit
- MockWebServer (OkHttp) for API mocking
- Kotlinx Coroutines Test

**Mock Responses**:
- JSON responses for success cases
- HTTP error codes for failure cases

**Expected Output**:
- ApiClientTest.kt with all test cases
- MockWebServer setup and teardown
- All tests passing

---

### Prompt 6.3: Unit Test - SocketManager

**Task**: Write unit tests for SocketManager connection and event handling.

**Test Cases**:
1. Connect establishes socket connection
2. Connection state changes from Disconnected → Connecting → Connected
3. Join canteen room emits correct payload
4. Join counter room emits correct payload
5. Order update event is parsed and emitted
6. Reconnection rejoins stored rooms automatically
7. Disconnect cleans up properly

**Test Framework**:
- JUnit
- MockK for Socket.IO mocking
- Kotlinx Coroutines Test
- Turbine for Flow testing

**Mocking**:
- Mock Socket.IO Socket interface
- Mock Socket.IO events

**Expected Output**:
- SocketManagerTest.kt with all test cases
- Proper mocking setup
- All tests passing

---

### Prompt 6.4: Unit Test - ViewModels

**Task**: Write unit tests for Login, Home, and Settings ViewModels.

**LoginViewModel Tests**:
1. Input validation (email format, password length)
2. Successful login updates isAuthenticated to true
3. Wrong credentials shows error message
4. Network error shows timeout message
5. Non-owner role rejection

**HomeViewModel Tests**:
1. User session loads correctly
2. Socket connects on initialization
3. New order increments activeOrderCount
4. Service starts when order received

**SettingsViewModel Tests**:
1. Settings data loads from TokenStorage

**Test Framework**:
- JUnit
- MockK for dependency mocking
- Kotlinx Coroutines Test
- Turbine for StateFlow testing

**Expected Output**:
- Test files for each ViewModel
- All business logic covered
- All tests passing

---

### Prompt 6.5: Integration Test - Login Flow

**Task**: Write end-to-end integration test for complete login flow.

**Test Scenario**:
1. Launch app with no session (not authenticated)
2. Enter server URL, email, password
3. Tap login button
4. API calls executed (mocked server)
5. Session saved to TokenStorage
6. Navigation to Home screen
7. Socket connects automatically

**Test Framework**:
- AndroidX Test (Espresso or Compose Test)
- MockWebServer for API
- Hilt or manual DI for test dependencies

**Expected Output**:
- LoginFlowTest.kt
- Complete flow validation
- Test passes

---

### Prompt 6.6: Integration Test - Order Notification

**Task**: Write integration test for receiving order notification.

**Test Scenario**:
1. User authenticated and on Home screen
2. Socket connected to server
3. Simulate new order event from socket
4. Verify order count increments
5. Verify foreground service starts
6. Verify notification displayed

**Test Framework**:
- AndroidX Test
- MockK or real Socket.IO test server
- Notification testing utils

**Expected Output**:
- OrderNotificationTest.kt
- End-to-end notification flow validated
- Test passes

---

### Prompt 6.7: Manual Testing Checklist

**Task**: Perform comprehensive manual testing on real device.

**Test Scenarios**:

**Authentication**:
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials shows error
- [ ] Login with wrong role shows rejection message
- [ ] Network timeout shows appropriate error
- [ ] Server URL with wrong format shows error

**WebSocket Connection**:
- [ ] Socket connects after login
- [ ] Socket reconnects after disconnect
- [ ] Rooms rejoined after reconnection
- [ ] Connection status displayed correctly

**Order Notifications**:
- [ ] New order creates notification
- [ ] Notification is persistent (non-dismissible)
- [ ] Alarm sound plays and loops
- [ ] Multiple orders increment counter
- [ ] Notification updates with new count

**Foreground Service**:
- [ ] Service survives screen lock
- [ ] Service survives app going to background
- [ ] Service survives device rotation
- [ ] Stop button stops service and alarm

**Permissions** (Android 13+):
- [ ] Notification permission requested
- [ ] Rationale shown before request
- [ ] Permission grant enables notifications
- [ ] Permission deny shows warning

**UI/Navigation**:
- [ ] Login navigates to Home
- [ ] Logout clears session and returns to Login
- [ ] Settings displays correct data
- [ ] Back navigation works correctly

**Edge Cases**:
- [ ] App works on slow network
- [ ] App handles server downtime gracefully
- [ ] App handles invalid JSON from socket
- [ ] App handles rapid multiple orders

**Expected Output**:
- Completed checklist
- All scenarios passing
- Issues documented for fixes

---

## Phase 7: Build & Deployment

### Prompt 7.1: Configure ProGuard/R8

**Task**: Setup code shrinking and obfuscation for release builds.

**ProGuard Rules to Add**:
1. Keep Socket.IO classes
2. Keep Retrofit interfaces
3. Keep data classes used for JSON serialization
4. Keep Gson annotations
5. Keep composable functions

**Configuration**:
- Enable minification in release build type
- Enable resource shrinking
- Use ProGuard rules file

**Expected Output**:
- proguard-rules.pro configured
- Release build succeeds
- App functions correctly with ProGuard enabled

---

### Prompt 7.2: Generate Signed APK

**Task**: Create a signed release APK for distribution.

**Steps**:
1. Create keystore (if not exists):
   - Key alias
   - Key password
   - Store password
   - Validity: 25+ years

2. Configure signing in build.gradle:
   - Signing config for release
   - Reference keystore file
   - Provide credentials (via gradle.properties or environment variables)

3. Build release APK:
   - Run: `./gradlew assembleRelease`
   - Output: `app/build/outputs/apk/release/app-release.apk`

**Security**:
- DO NOT commit keystore to version control
- DO NOT commit passwords to version control
- Use environment variables or gradle.properties (gitignored)

**Expected Output**:
- Signed release APK
- App installable on devices
- All functionality works in release build

---

### Prompt 7.3: Test on Multiple Devices

**Task**: Test app on various Android devices and versions.

**Device Matrix**:
1. Android 8.0 (API 26) - Minimum SDK
2. Android 10 (API 29) - Common version
3. Android 13 (API 33) - Notification permission introduced
4. Android 14 (API 34) - Target SDK

**Device Types**:
- Phone (small screen)
- Tablet (large screen)
- Different manufacturers (Samsung, Google, Xiaomi)

**Test Focus**:
- UI layout on different screen sizes
- Notification behavior across versions
- Permission requests (Android 13+)
- Foreground service restrictions
- Battery optimization impact

**Expected Output**:
- Test results documented
- Device-specific issues identified
- Compatibility confirmed

---

### Prompt 7.4: Create User Documentation

**Task**: Write simple user guide for canteen owners.

**Documentation Sections**:

1. **Installation**:
   - Download APK
   - Enable "Install from unknown sources" if needed
   - Install app
   - Grant necessary permissions

2. **Setup**:
   - First launch
   - Enter server URL (provide default)
   - Login with canteen owner credentials
   - Grant notification permission

3. **Usage**:
   - App connects automatically
   - Notification appears when new order arrives
   - Alarm plays until acknowledged
   - Tap notification to see order (opens dashboard website)
   - Keep app running in background

4. **Troubleshooting**:
   - Connection issues: Check internet and server URL
   - No notifications: Check permission settings
   - No sound: Check notification volume
   - Service stopped: Disable battery optimization for app

5. **FAQ**:
   - Why does app need these permissions?
   - Why does service run in background?
   - How to stop notifications?
   - What happens if phone restarts?

**Expected Output**:
- User guide document (PDF or markdown)
- Simple language, non-technical
- Screenshots for key steps

---

## Summary

This prompt sheet provides comprehensive step-by-step guidance for building an Android notification helper app for canteen owners. Each prompt is self-contained and describes requirements without providing implementation code.

**Total Phases**: 7  
**Total Prompts**: 35+  
**Estimated Build Time**: 8-12 hours for experienced Android developer  

**Key Technical Stack**:
- Kotlin + Jetpack Compose
- Material 3 Design
- Socket.IO Client
- Retrofit + OkHttp
- DataStore Preferences
- Foreground Service
- MediaPlayer

**Critical Implementation Notes**:
1. WebSocket has NO authentication - use protected canteenId access
2. Rooms must be manually rejoined after reconnection
3. Foreground service must use dataSync type (Android 14+)
4. Notification permission required (Android 13+)
5. Order items field is JSON string - must parse

**Reference Documents**:
- `android-spec/websocket-extraction.md` - WebSocket protocol details
- `android-spec/android-connection-requirements.md` - Connection requirements
- `android-spec/android-helper-responsibilities.md` - App behavior rules

---

**End of Prompt Sheet**

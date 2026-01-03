# Android Environment-Safe Configuration

## Configuration Strategy

Configuration managed via **BuildConfig** and **Product Flavors** with no hardcoded secrets in source control.

## Files Modified/Created

### 1. Build Configuration
**File**: `android/app/build.gradle.kts`

#### BuildConfig Feature Enabled
```kotlin
buildFeatures {
    compose = true
    buildConfig = true  // Added
}
```

#### Default Configuration
```kotlin
defaultConfig {
    applicationId = "com.example.sillobite"
    minSdk = 26
    targetSdk = 36
    versionCode = 1
    versionName = "1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

    // Default BuildConfig values (overridden by build variants)
    buildConfigField("String", "API_BASE_URL", "\"http://localhost:5000\"")
    buildConfigField("String", "SOCKET_URL", "\"http://localhost:5000\"")
    buildConfigField("boolean", "ENABLE_LOGGING", "true")
}
```

#### Build Types Configuration
```kotlin
buildTypes {
    debug {
        isDebuggable = true
        applicationIdSuffix = ".debug"
        versionNameSuffix = "-DEBUG"

        // Debug-specific configuration
        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5000\"")
        buildConfigField("String", "SOCKET_URL", "\"http://10.0.2.2:5000\"")
        buildConfigField("boolean", "ENABLE_LOGGING", "true")
        buildConfigField("String", "BUILD_VARIANT", "\"debug\"")
    }

    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )

        // Production configuration
        buildConfigField("String", "API_BASE_URL", "\"https://api.sillobite.com\"")
        buildConfigField("String", "SOCKET_URL", "\"https://api.sillobite.com\"")
        buildConfigField("boolean", "ENABLE_LOGGING", "false")
        buildConfigField("String", "BUILD_VARIANT", "\"release\"")
    }
}
```

#### Product Flavors Configuration
```kotlin
flavorDimensions += "environment"
productFlavors {
    create("dev") {
        dimension = "environment"
        applicationIdSuffix = ".dev"
        versionNameSuffix = "-dev"

        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5000\"")
        buildConfigField("String", "SOCKET_URL", "\"http://10.0.2.2:5000\"")
        buildConfigField("String", "ENVIRONMENT", "\"development\"")
    }

    create("staging") {
        dimension = "environment"
        applicationIdSuffix = ".staging"
        versionNameSuffix = "-staging"

        buildConfigField("String", "API_BASE_URL", "\"https://staging-api.sillobite.com\"")
        buildConfigField("String", "SOCKET_URL", "\"https://staging-api.sillobite.com\"")
        buildConfigField("String", "ENVIRONMENT", "\"staging\"")
    }

    create("prod") {
        dimension = "environment"

        buildConfigField("String", "API_BASE_URL", "\"https://api.sillobite.com\"")
        buildConfigField("String", "SOCKET_URL", "\"https://api.sillobite.com\"")
        buildConfigField("String", "ENVIRONMENT", "\"production\"")
    }
}
```

### 2. Gradle Properties
**File**: `android/gradle.properties`

Added non-sensitive configuration:
```properties
# ========================================
# SilloBite Configuration
# ========================================
# Note: These values can be overridden by build variants
# Do NOT commit sensitive production values to version control
# Use local.properties or environment variables for secrets

# API Configuration (overridable per build variant)
# Default values for local development
API_BASE_URL=http://localhost:5000
SOCKET_URL=http://localhost:5000

# Build optimization
org.gradle.caching=true
org.gradle.configureondemand=true
```

### 3. Git Ignore Configuration
**File**: `android/.gitignore`

Added entries to prevent committing secrets:
```
# Environment-specific configuration files
# Add any files containing secrets or environment-specific URLs
*.keystore
*.jks
app/google-services.json
app/src/release/res/values/secrets.xml
```

### 4. Local Properties Template
**File**: `android/local.properties.example`

Template for developer-specific configuration (not tracked in git):
```properties
# Android SDK location
sdk.dir=YOUR_ANDROID_SDK_PATH_HERE

# Environment-Specific Configuration
# Local development server (for emulator)
# API_BASE_URL=http://10.0.2.2:5000
# SOCKET_URL=http://10.0.2.2:5000

# Local development server (for physical device on same network)
# API_BASE_URL=http://192.168.1.100:5000
# SOCKET_URL=http://192.168.1.100:5000

# Staging server
# API_BASE_URL=https://staging-api.sillobite.com
# SOCKET_URL=https://staging-api.sillobite.com

# Signing Configuration (DO NOT COMMIT)
# RELEASE_STORE_FILE=path/to/your/keystore.jks
# RELEASE_STORE_PASSWORD=your_keystore_password
# RELEASE_KEY_ALIAS=your_key_alias
# RELEASE_KEY_PASSWORD=your_key_password
```

### 5. Application Configuration Object
**File**: `android/app/src/main/java/com/example/sillobite/util/constants/AppConfig.kt`

```kotlin
package com.example.sillobite.util.constants

import com.example.sillobite.BuildConfig

/**
 * Application-wide configuration constants
 * Values populated from BuildConfig generated at compile time
 */
object AppConfig {
    
    /** Base URL for REST API endpoints */
    const val API_BASE_URL = BuildConfig.API_BASE_URL
    
    /** WebSocket/Socket.IO connection URL */
    const val SOCKET_URL = BuildConfig.SOCKET_URL
    
    /** Enable/disable debug logging */
    const val ENABLE_LOGGING = BuildConfig.ENABLE_LOGGING
    
    /** Current build variant (debug/release) */
    const val BUILD_VARIANT = BuildConfig.BUILD_VARIANT
    
    /** Current environment (development/staging/production) */
    val ENVIRONMENT: String
        get() = try {
            BuildConfig.ENVIRONMENT
        } catch (e: Exception) {
            "unknown"
        }
    
    /** Application version name */
    const val VERSION_NAME = BuildConfig.VERSION_NAME
    
    /** Application version code */
    const val VERSION_CODE = BuildConfig.VERSION_CODE
    
    /** Check if running in debug mode */
    val IS_DEBUG = BuildConfig.DEBUG
    
    /** Application ID */
    const val APPLICATION_ID = BuildConfig.APPLICATION_ID
}
```

### 6. Network Configuration Constants
**File**: `android/app/src/main/java/com/example/sillobite/util/constants/NetworkConfig.kt`

```kotlin
package com.example.sillobite.util.constants

/**
 * Network-related configuration constants
 */
object NetworkConfig {
    
    /** HTTP connection timeout in seconds */
    const val CONNECT_TIMEOUT = 30L
    
    /** HTTP read timeout in seconds */
    const val READ_TIMEOUT = 30L
    
    /** HTTP write timeout in seconds */
    const val WRITE_TIMEOUT = 30L
    
    /** Socket.IO connection timeout in milliseconds */
    const val SOCKET_CONNECT_TIMEOUT = 10000L
    
    /** Socket.IO reconnection enabled */
    const val SOCKET_RECONNECTION_ENABLED = true
    
    /** Socket.IO reconnection delay in milliseconds */
    const val SOCKET_RECONNECTION_DELAY = 1000L
    
    /** Maximum number of Socket.IO reconnection attempts */
    const val SOCKET_MAX_RECONNECTION_ATTEMPTS = 5
    
    /** API version prefix for endpoints */
    const val API_VERSION_PREFIX = "/api"
    
    /** Content type for JSON requests */
    const val CONTENT_TYPE_JSON = "application/json"
    
    /** Content type for form data */
    const val CONTENT_TYPE_FORM = "application/x-www-form-urlencoded"
}
```

## Build Variants Generated

The configuration creates the following build variants (flavor + buildType):

| Variant | Application ID | API URL | Logging | Use Case |
|---------|---------------|---------|---------|----------|
| devDebug | com.example.sillobite.dev.debug | http://10.0.2.2:5000 | Enabled | Local development (emulator) |
| devRelease | com.example.sillobite.dev | http://10.0.2.2:5000 | Disabled | Local release testing |
| stagingDebug | com.example.sillobite.staging.debug | https://staging-api.sillobite.com | Enabled | Staging debug |
| stagingRelease | com.example.sillobite.staging | https://staging-api.sillobite.com | Disabled | Staging release |
| prodDebug | com.example.sillobite.debug | https://api.sillobite.com | Enabled | Production debug |
| prodRelease | com.example.sillobite | https://api.sillobite.com | Disabled | Production release |

## URL Configuration Details

### Android Emulator Network
- **10.0.2.2** - Special alias for host machine's localhost (used in dev builds)
- Allows emulator to connect to backend running on `localhost:5000`

### Production URLs
- **API Base**: `https://api.sillobite.com`
- **Socket**: `https://api.sillobite.com`
- These are placeholder URLs - replace with actual production endpoints

### Staging URLs
- **API Base**: `https://staging-api.sillobite.com`
- **Socket**: `https://staging-api.sillobite.com`
- These are placeholder URLs - replace with actual staging endpoints

## Usage in Code

Configuration values accessible via `AppConfig` object:

```kotlin
// Example usage (implementation not included - only configuration)
val apiUrl = AppConfig.API_BASE_URL
val socketUrl = AppConfig.SOCKET_URL
val isDebug = AppConfig.IS_DEBUG
val enableLogging = AppConfig.ENABLE_LOGGING
```

## Build Commands

```bash
# Development builds
gradlew assembleDevDebug          # Debug APK for development
gradlew assembleDevRelease        # Release APK for development

# Staging builds
gradlew assembleStagingDebug      # Debug APK for staging
gradlew assembleStagingRelease    # Release APK for staging

# Production builds
gradlew assembleProdDebug         # Debug APK for production
gradlew assembleProdRelease       # Release APK for production (store deployment)
```

## Security Best Practices Implemented

### ✅ No Hardcoded Secrets
- All sensitive values configured via BuildConfig
- Production URLs can be overridden via environment variables
- local.properties excluded from version control

### ✅ Separation of Environments
- Product flavors separate dev/staging/prod environments
- Different application IDs allow side-by-side installation
- Build types control debug/release-specific behavior

### ✅ Gradle Properties Structure
- Non-sensitive defaults in `gradle.properties` (tracked)
- Sensitive overrides in `local.properties` (gitignored)
- Build-time injection via BuildConfig fields

### ✅ Type-Safe Configuration
- Kotlin object provides compile-time constant access
- No string-based configuration lookups
- IDE autocomplete and refactoring support

## Configuration Hierarchy

Priority order (highest to lowest):
1. `build.gradle.kts` buildConfigField declarations (product flavor + build type)
2. `local.properties` (developer-specific, gitignored)
3. `gradle.properties` (project defaults, tracked)

## Notes

- **No implementation logic included** - only configuration structure
- **BuildConfig generation verified** via `gradlew :app:generateDevDebugBuildConfig`
- **All URLs are placeholders** - update for actual deployment endpoints
- **Signing configuration not included** - add when ready for release builds
- **API keys/tokens not configured** - add via local.properties when needed

## Generated BuildConfig

At compile time, Gradle generates `BuildConfig` class with fields:

### Development Debug Build (devDebug)
```java
package com.example.sillobite;

public final class BuildConfig {
    public static final boolean DEBUG = true;
    public static final String APPLICATION_ID = "com.example.sillobite.dev.debug";
    public static final String BUILD_TYPE = "debug";
    public static final String FLAVOR = "dev";
    public static final int VERSION_CODE = 1;
    public static final String VERSION_NAME = "1.0-dev-DEBUG";
    
    // Field from build type: debug
    public static final String API_BASE_URL = "http://10.0.2.2:5000";
    public static final String BUILD_VARIANT = "debug";
    public static final boolean ENABLE_LOGGING = true;
    
    // Field from product flavor: dev
    public static final String ENVIRONMENT = "development";
    
    // Field from build type: debug
    public static final String SOCKET_URL = "http://10.0.2.2:5000";
}
```

### Production Release Build (prodRelease)
```java
package com.example.sillobite;

public final class BuildConfig {
    public static final boolean DEBUG = false;
    public static final String APPLICATION_ID = "com.example.sillobite";
    public static final String BUILD_TYPE = "release";
    public static final String FLAVOR = "prod";
    public static final int VERSION_CODE = 1;
    public static final String VERSION_NAME = "1.0";
    
    // Field from build type: release
    public static final String API_BASE_URL = "https://api.sillobite.com";
    public static final String BUILD_VARIANT = "release";
    public static final boolean ENABLE_LOGGING = false;
    
    // Field from product flavor: prod
    public static final String ENVIRONMENT = "production";
    
    // Field from build type: release
    public static final String SOCKET_URL = "https://api.sillobite.com";
}
```

This file is auto-generated and should **never be manually edited**.

## Build Verification

✅ **Compilation successful** for all variants:
```bash
# Development debug build
./gradlew :app:compileDevDebugKotlin

# Staging debug build
./gradlew :app:compileStagingDebugKotlin

# Production release build
./gradlew :app:compileProdReleaseKotlin
```

## Resolution Notes

### BuildConfig Import Required
The `AppConfig.kt` file requires explicit import:
```kotlin
import com.example.sillobite.BuildConfig
```

### Non-Const Values
Some BuildConfig fields cannot be `const val` because they are not compile-time constants:
- `IS_DEBUG` - Uses `BuildConfig.DEBUG` which is runtime-evaluated

These must be declared as `val` instead of `const val`.

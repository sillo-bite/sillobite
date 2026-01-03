# CanteenOwnerHelper - Android Project

## Project Overview

**Purpose**: Notification helper app for canteen owners to receive real-time order notifications.

**Package Name**: `com.sillobite.owner.helper`

**Project Name**: CanteenOwnerHelper

## Configuration

### SDK Versions
- **Min SDK**: API 26 (Android 8.0 Oreo)
- **Target SDK**: API 34 (Android 14)
- **Compile SDK**: API 34

### Build System
- **Gradle**: 8.13.2
- **Android Gradle Plugin**: 8.7.3
- **Kotlin**: 2.0.21
- **JVM Target**: 11

### Architecture
- **Pattern**: Single Activity with Jetpack Compose
- **UI Framework**: Jetpack Compose with Material 3

## Project Structure

```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/sillobite/owner/helper/
│   │       │   ├── MainActivity.kt
│   │       │   └── ui/
│   │       │       └── theme/
│   │       │           ├── Color.kt
│   │       │           ├── Theme.kt
│   │       │           └── Type.kt
│   │       ├── res/
│   │       │   ├── values/
│   │       │   │   ├── colors.xml
│   │       │   │   ├── strings.xml
│   │       │   │   └── themes.xml
│   │       │   ├── xml/
│   │       │   │   ├── backup_rules.xml
│   │       │   │   └── data_extraction_rules.xml
│   │       │   └── mipmap-*/ (icon placeholders)
│   │       └── AndroidManifest.xml
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
│   ├── libs.versions.toml
│   └── wrapper/
│       └── gradle-wrapper.properties
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
└── .gitignore
```

## Dependencies

### Core AndroidX
- `androidx.core:core-ktx:1.15.0`
- `androidx.lifecycle:lifecycle-runtime-ktx:2.8.7`
- `androidx.activity:activity-compose:1.9.3`

### Jetpack Compose
- `androidx.compose:compose-bom:2024.12.01`
- `androidx.compose.ui:ui`
- `androidx.compose.ui:ui-graphics`
- `androidx.compose.ui:ui-tooling-preview`
- `androidx.compose.material3:material3`

### Networking
- `com.squareup.retrofit2:retrofit:2.9.0`
- `com.squareup.retrofit2:converter-gson:2.9.0`
- `com.squareup.okhttp3:okhttp:4.12.0`
- `com.squareup.okhttp3:logging-interceptor:4.12.0`
- `io.socket:socket.io-client:2.1.0`

### Coroutines
- `org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0`
- `org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0`

### Lifecycle ViewModel
- `androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0`
- `androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0`
- `androidx.lifecycle:lifecycle-livedata-ktx:2.10.0`

## Permissions

The following permissions are declared in AndroidManifest.xml:

- `INTERNET` - Required for network communication
- `ACCESS_NETWORK_STATE` - Check network connectivity
- `FOREGROUND_SERVICE` - Run foreground service for notifications
- `FOREGROUND_SERVICE_DATA_SYNC` - Specific foreground service type
- `POST_NOTIFICATIONS` - Show notifications (API 33+)

## Current Status

✅ **Completed**:
- Project directory structure created
- Gradle configuration files (settings.gradle.kts, gradle.properties, libs.versions.toml)
- Project-level build.gradle.kts
- App module build.gradle.kts with all dependencies
- AndroidManifest.xml with required permissions
- MainActivity.kt with Jetpack Compose setup
- Compose theme files (Color.kt, Theme.kt, Type.kt)
- Resource files (strings.xml, colors.xml, themes.xml)
- XML configuration files (backup_rules.xml, data_extraction_rules.xml)
- ProGuard rules configuration
- .gitignore for Android project

⚠️ **Missing**:
- App launcher icons (placeholder directories created in mipmap-*)
- Gradle wrapper JAR file (gradlew and gradlew.bat)

## Next Steps

### 1. Generate App Icons
Use one of the following methods:
- **Android Studio**: Right-click on `res` → New → Image Asset
- **Online Tools**:
  - [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/)
  - [Icon Kitchen](https://icon.kitchen/)

Required icon sizes:
- mipmap-mdpi: 48x48px
- mipmap-hdpi: 72x72px
- mipmap-xhdpi: 96x96px
- mipmap-xxhdpi: 144x144px
- mipmap-xxxhdpi: 192x192px

### 2. Initialize Gradle Wrapper
Run this command in the `android` directory:
```bash
gradle wrapper --gradle-version 8.13.2
```

This will generate:
- `gradlew` (Unix/Mac executable)
- `gradlew.bat` (Windows executable)
- `gradle/wrapper/gradle-wrapper.jar`

### 3. Open in Android Studio
1. Open Android Studio
2. Click "Open" and select the `android` folder
3. Wait for Gradle sync to complete
4. Verify that all dependencies resolve correctly

### 4. Test Build
```bash
# From android directory
./gradlew assembleDebug
```

### 5. Run on Device/Emulator
- Connect an Android device or start an emulator
- Click "Run" in Android Studio
- The app should launch showing "Canteen Owner Helper"

## Connection Requirements Reference

For implementing WebSocket connection and order notifications, refer to:
- `../android-spec/android-connection-requirements.md` - Complete connection guide
- `../android-spec/14-android-dependency-configuration.md` - Dependency configuration
- `../android-spec/ANDROID_BUILD_PROMPTS.md` - Build instructions

## Notes

- All dependencies are configured via version catalog (libs.versions.toml)
- No feature code or business logic has been added yet
- This is a clean project structure ready for implementation
- ProGuard rules are configured for all networking libraries

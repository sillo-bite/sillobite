# Release Build Guide - Canteen Owner Helper

## Overview

This guide explains how to create a signed release APK for distribution.

---

## Prerequisites

- Android Studio installed
- JDK 17 configured
- Project built successfully in debug mode

---

## Step 1: Create Keystore (First Time Only)

### Option A: Using Android Studio

1. **Open Android Studio**
2. **Build** → **Generate Signed Bundle / APK**
3. Select **APK** → **Next**
4. Click **Create new...**
5. Fill in the form:
   - **Key store path**: `d:\steepanProjects\sillobite-pos\sillobite\android\app\release-keystore.jks`
   - **Password**: Choose a strong password (store it securely!)
   - **Alias**: `canteen-owner-helper` (or your choice)
   - **Password**: Key password (can be same as store password)
   - **Validity**: 25+ years (default is 25)
   - **Certificate**:
     - First and Last Name: `Sillobite`
     - Organizational Unit: `Development`
     - Organization: `Sillobite`
     - City: Your city
     - State: Your state
     - Country Code: `IN` (or your country)

6. Click **OK**

### Option B: Using Command Line

```bash
# Navigate to android/app directory
cd d:\steepanProjects\sillobite-pos\sillobite\android\app

# Generate keystore (valid for 10,000 days ≈ 27 years)
keytool -genkeypair -v \
  -keystore release-keystore.jks \
  -alias canteen-owner-helper \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Sillobite, OU=Development, O=Sillobite, L=YourCity, ST=YourState, C=IN"
```

**PowerShell (Windows):**
```powershell
keytool -genkeypair -v `
  -keystore release-keystore.jks `
  -alias canteen-owner-helper `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass YOUR_STORE_PASSWORD `
  -keypass YOUR_KEY_PASSWORD `
  -dname "CN=Sillobite, OU=Development, O=Sillobite, L=YourCity, ST=YourState, C=IN"
```

---

## Step 2: Configure Signing Credentials

### Option A: Using gradle.properties (Recommended for Local Development)

1. **Edit** `android/gradle.properties`
2. **Uncomment and fill in** the signing configuration:

```properties
RELEASE_STORE_FILE=release-keystore.jks
RELEASE_STORE_PASSWORD=your_store_password_here
RELEASE_KEY_ALIAS=canteen-owner-helper
RELEASE_KEY_PASSWORD=your_key_password_here
```

3. **IMPORTANT**: Add `gradle.properties` to `.gitignore` if you're using this method:

```bash
# Add to android/.gitignore
gradle.properties
```

### Option B: Using Environment Variables (Recommended for CI/CD)

Set these environment variables:

**Windows PowerShell:**
```powershell
$env:RELEASE_STORE_FILE="release-keystore.jks"
$env:RELEASE_STORE_PASSWORD="your_store_password"
$env:RELEASE_KEY_ALIAS="canteen-owner-helper"
$env:RELEASE_KEY_PASSWORD="your_key_password"
```

**Windows CMD:**
```cmd
set RELEASE_STORE_FILE=release-keystore.jks
set RELEASE_STORE_PASSWORD=your_store_password
set RELEASE_KEY_ALIAS=canteen-owner-helper
set RELEASE_KEY_PASSWORD=your_key_password
```

**Linux/macOS:**
```bash
export RELEASE_STORE_FILE=release-keystore.jks
export RELEASE_STORE_PASSWORD=your_store_password
export RELEASE_KEY_ALIAS=canteen-owner-helper
export RELEASE_KEY_PASSWORD=your_key_password
```

---

## Step 3: Build Release APK

### Option A: Using Android Studio

1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** → **Next**
3. Select existing keystore: `release-keystore.jks`
4. Enter passwords
5. Select **release** build variant
6. Click **Finish**

Output location: `android/app/build/outputs/apk/release/app-release.apk`

### Option B: Using Gradle Command

**From Android Studio Terminal:**
```bash
./gradlew assembleRelease
```

**From Windows PowerShell (if gradlew exists):**
```powershell
cd d:\steepanProjects\sillobite-pos\sillobite\android
.\gradlew.bat assembleRelease
```

Output location: `android/app/build/outputs/apk/release/app-release.apk`

---

## Step 4: Verify the APK

### Check APK Signature

```bash
# Navigate to APK location
cd d:\steepanProjects\sillobite-pos\sillobite\android\app\build\outputs\apk\release

# Verify signature
jarsigner -verify -verbose -certs app-release.apk
```

Expected output should include:
```
jar verified.
```

### Check APK Info

```bash
# Using Android SDK build-tools
aapt dump badging app-release.apk
```

Look for:
- `package: name='com.sillobite.owner.helper'`
- `versionCode='1' versionName='1.0'`
- `minSdkVersion='26'`

---

## Step 5: Test the Release APK

### Install on Device/Emulator

```bash
adb install app-release.apk
```

### Test All Features

- ✅ Login with email/password
- ✅ Socket.IO connection to server
- ✅ Receive order notifications
- ✅ Notification sound plays (once or repeat based on settings)
- ✅ Settings screen - toggle alarm repeat mode
- ✅ Logout functionality
- ✅ App icon displays correctly
- ✅ No crashes or errors

---

## Security Best Practices

### ✅ DO:
1. **Keep keystore file safe** - Store it in a secure location
2. **Backup keystore** - Keep multiple copies in different secure locations
3. **Use strong passwords** - At least 16 characters with mixed case, numbers, symbols
4. **Use environment variables** for CI/CD pipelines
5. **Keep ProGuard mapping files** - Save `mapping.txt` for each release
6. **Version control mapping files** - Store them for crash report deobfuscation

### ❌ DON'T:
1. **DON'T commit keystore to Git** - Already in `.gitignore`
2. **DON'T commit passwords** - Use environment variables or gitignored `gradle.properties`
3. **DON'T share keystore file** - Keep it private
4. **DON'T lose keystore** - You cannot update app on Google Play without original keystore
5. **DON'T use weak passwords** - App security depends on it

---

## File Locations

### Keystore
```
android/app/release-keystore.jks (gitignored ✓)
```

### Release APK
```
android/app/build/outputs/apk/release/app-release.apk
```

### ProGuard Mapping
```
android/app/build/outputs/mapping/release/mapping.txt
```

### Build Configuration
```
android/app/build.gradle.kts (signing config)
android/gradle.properties (credentials - template)
android/app/proguard-rules.pro (obfuscation rules)
```

---

## Troubleshooting

### Error: "Keystore file not found"
**Solution**: Check the path in `RELEASE_STORE_FILE` is correct relative to `android/app/` directory.

### Error: "Invalid keystore format"
**Solution**: Ensure you created a `.jks` keystore, not `.keystore` format.

### Error: "Wrong password"
**Solution**: Double-check `RELEASE_STORE_PASSWORD` and `RELEASE_KEY_PASSWORD` values.

### Error: "ProGuard error"
**Solution**: Check `proguard-rules.pro` for any missing keep rules. Test with `isMinifyEnabled = false` first.

### Error: "Resource not found"
**Solution**: Clean and rebuild: `./gradlew clean assembleRelease`

---

## APK Size Optimization

With ProGuard enabled, your release APK will be significantly smaller:

- **Debug APK**: ~15-20 MB
- **Release APK (with ProGuard)**: ~8-12 MB (40-50% reduction)

---

## Distribution

### Google Play Store
1. Use **Android App Bundle (AAB)** instead of APK:
   ```bash
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

2. Upload to Google Play Console
3. Upload ProGuard mapping file for crash reports

### Direct Distribution
- Use the signed APK: `app-release.apk`
- Host on your server or distribute directly
- Users must enable "Install from unknown sources"

---

## Next Steps

1. ✅ Create keystore (one-time setup)
2. ✅ Configure credentials
3. ✅ Build release APK
4. ✅ Test thoroughly
5. ✅ Backup keystore and passwords
6. 📦 Prepare for distribution

---

## Important Notes

- **Keystore is irreplaceable**: If lost, you cannot update the app on Google Play
- **Save ProGuard mappings**: Required to deobfuscate crash reports
- **Test before distribution**: Always test release builds on real devices
- **Version management**: Increment `versionCode` and `versionName` for each release

---

For questions or issues, refer to:
- [Android Developer Documentation](https://developer.android.com/studio/publish/app-signing)
- [ProGuard Configuration](https://developer.android.com/studio/build/shrink-code)

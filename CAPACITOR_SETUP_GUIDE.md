# Capacitor Native App Setup & Testing Guide

This guide will help you set up and test your Dinez Canteen app as a native Android application using Capacitor.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or higher) - Already installed ✓
2. **Java Development Kit (JDK)** - Version 11 or higher
   - Download from: https://adoptium.net/
   - Or use: `choco install openjdk11` (Windows with Chocolatey)
3. **Android Studio** - Latest version
   - Download from: https://developer.android.com/studio
   - During installation, make sure to install:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (AVD)
4. **Android SDK Command Line Tools**
   - Can be installed via Android Studio's SDK Manager

## 🚀 Step-by-Step Setup

### Step 1: Install Android Platform

Run the following command to add the Android platform:

```bash
npx cap add android
```

This will create an `android/` folder in your project root.

### Step 2: Configure API Base URL for Native Apps

For native apps to connect to your backend, you need to configure the API base URL:

**Option A: Using Environment Variables (Recommended)**

Create a `.env` file in the root directory (if it doesn't exist) and add:

```env
# For Development (Local Testing)
VITE_API_BASE_URL=http://10.0.2.2:5000

# For Production (replace with your actual server URL)
# VITE_API_BASE_URL=https://your-production-api.com

# WebSocket URL (optional, will be derived from API URL)
# VITE_WS_BASE_URL=ws://10.0.2.2:5000
```

**Important Notes:**
- For Android Emulator: Use `10.0.2.2` instead of `localhost` - this is the emulator's alias for your host machine's `127.0.0.1`
- For Physical Device: Use your computer's IP address (e.g., `http://192.168.1.100:5000`)
  - Find your IP: 
    - Windows: `ipconfig` (look for IPv4 Address)
    - Mac/Linux: `ifconfig` or `ip addr`

**Option B: Update capacitor.config.ts**

You can also hardcode the server URL in `capacitor.config.ts`:

```typescript
server: {
  androidScheme: 'https',
  url: 'http://10.0.2.2:5000', // For emulator
  cleartext: true, // Allow HTTP connections
},
```

### Step 3: Build and Sync

Build your frontend and sync with Capacitor:

```bash
# Build the frontend
npm run build:mobile

# Sync with Capacitor (copies web assets to native projects)
npx cap sync
```

### Step 4: Configure Android Permissions

The Android platform may need some permissions. These are typically auto-configured, but check `android/app/src/main/AndroidManifest.xml` if needed.

Required permissions for this app:
- Internet (for API calls)
- Camera (for barcode scanning - already configured via barcode-scanner plugin)
- Network State (for checking connectivity)

### Step 5: Start Your Backend Server

Make sure your backend server is running on port 5000:

```bash
npm run dev
```

Or if using production mode:

```bash
npm run start
```

**Important:** The backend must be accessible from the Android device/emulator:
- For emulator: `http://10.0.2.2:5000`
- For physical device: `http://YOUR_IP_ADDRESS:5000`

## 🧪 Testing in Android Emulator

### Step 1: Create an Android Virtual Device (AVD)

1. Open **Android Studio**
2. Go to **Tools → Device Manager** (or **AVD Manager**)
3. Click **Create Device**
4. Select a device (e.g., Pixel 5)
5. Select a system image (e.g., Android 13 - API 33)
6. Click **Finish**

### Step 2: Start the Emulator

1. In Android Studio's Device Manager, click the ▶️ play button next to your AVD
2. Wait for the emulator to fully boot

### Step 3: Build and Run the App

**Option A: Using Capacitor CLI (Recommended)**

```bash
npm run cap:run:android
```

This will:
1. Build the frontend
2. Sync with Capacitor
3. Open Android Studio
4. You can then run the app from Android Studio

**Option B: Manual Steps**

```bash
# 1. Build frontend
npm run build:mobile

# 2. Sync with Capacitor
npx cap sync

# 3. Open Android Studio
npx cap open android
```

Then in Android Studio:
1. Wait for Gradle sync to complete
2. Select your AVD from the device dropdown
3. Click the **Run** button (▶️) or press `Shift+F10`

### Step 4: Verify the Connection

Once the app launches:

1. **Check Console Logs:**
   - In Android Studio, open the **Logcat** tab
   - Filter by your app's package name: `com.dinez.canteen`
   - Look for API connection logs

2. **Test Features:**
   - Try logging in
   - Browse menu items
   - Check if API calls are working
   - Test WebSocket connections (real-time updates)

3. **Debug Network Issues:**
   - If API calls fail, check:
     - Backend server is running
     - Correct IP address/URL configured
     - Firewall isn't blocking connections
     - Emulator can reach host machine (ping 10.0.2.2)

## 🔧 Testing on Physical Android Device

### Step 1: Enable Developer Mode

1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times
3. Go back to Settings
4. Find **Developer Options**
5. Enable **USB Debugging**

### Step 2: Connect Device

1. Connect your Android device via USB
2. On your device, accept the USB debugging prompt
3. Verify connection: `adb devices` (should list your device)

### Step 3: Configure API URL

Update your `.env` or `capacitor.config.ts` with your computer's IP address:

```env
VITE_API_BASE_URL=http://192.168.1.100:5000  # Replace with your actual IP
```

Make sure your device and computer are on the same WiFi network!

### Step 4: Run the App

```bash
npm run cap:run:android
```

Select your physical device from the device dropdown in Android Studio and run.

## 🐛 Troubleshooting

### Issue: App can't connect to backend

**Solutions:**
- Verify backend is running: `curl http://localhost:5000/health` (or your health endpoint)
- Check API URL configuration
- For emulator: Use `10.0.2.2` instead of `localhost`
- For physical device: Use your computer's IP address
- Check firewall settings

### Issue: Build errors in Android Studio

**Solutions:**
- Clean and rebuild: **Build → Clean Project**, then **Build → Rebuild Project**
- Invalidate caches: **File → Invalidate Caches / Restart**
- Check Java version: Should be JDK 11+
- Sync Gradle: Click the "Sync Now" banner if it appears

### Issue: WebSocket not connecting

**Solutions:**
- Verify WebSocket URL is correct
- Check backend WebSocket server is running
- Ensure network security config allows cleartext traffic (if using HTTP)
- Check Logcat for WebSocket connection errors

### Issue: App crashes on launch

**Solutions:**
- Check Logcat for error messages
- Verify all Capacitor plugins are properly installed
- Clear app data: **Settings → Apps → Dinez Canteen → Clear Data**
- Rebuild and reinstall the app

### Issue: Cannot find module errors

**Solutions:**
- Run `npm install` to ensure all dependencies are installed
- Delete `node_modules` and `package-lock.json`, then run `npm install` again
- Check that Capacitor packages are installed: `npm list @capacitor/core`

## 📱 Additional Configuration

### Configure App Icons and Splash Screen

Icons and splash screens can be configured in:
- `android/app/src/main/res/` - Android resources

You can use Capacitor's icon and splash screen generators:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

### Configure App Permissions

Edit `android/app/src/main/AndroidManifest.xml` to add/modify permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Production Build

For production builds:

1. Update `capacitor.config.ts` with production API URL
2. Build release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. Find APK at: `android/app/build/outputs/apk/release/app-release.apk`

## 📚 Useful Commands

```bash
# Build frontend for mobile
npm run build:mobile

# Sync Capacitor (after building)
npx cap sync

# Copy web assets only (faster than sync)
npx cap copy

# Update native dependencies
npx cap update

# Open Android Studio
npx cap open android

# Check Capacitor version
npx cap --version

# List installed platforms
npx cap ls
```

## 🔗 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Development Guide](https://developer.android.com/studio)
- [Capacitor Android Configuration](https://capacitorjs.com/docs/android/configuration)

## ✅ Checklist

- [ ] Java JDK 11+ installed
- [ ] Android Studio installed
- [ ] Android SDK configured
- [ ] AVD (Emulator) created
- [ ] Backend server running
- [ ] API base URL configured
- [ ] Frontend built successfully
- [ ] Capacitor synced
- [ ] App running in emulator/device
- [ ] API connections working
- [ ] WebSocket connections working

## 🎉 Next Steps

Once you have the app running:

1. Test all major features (login, menu, orders, payments)
2. Test on different Android versions if possible
3. Test on physical devices for better performance insights
4. Configure production API URLs for release builds
5. Set up app signing for Google Play Store (if needed)

---

**Need Help?** Check the troubleshooting section above or refer to the Capacitor documentation.











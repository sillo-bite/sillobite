# Capacitor Quick Start Guide

## 🚀 Quick Setup Steps

### 1. ✅ Android Platform Installed

The Android platform has been successfully added to your project. The `android/` folder contains your native Android project.

### 2. Configure API URL

Create or update `.env` file in project root:

```env
# For Android Emulator
VITE_API_BASE_URL=http://10.0.2.2:5000

# For Physical Device (replace with your computer's IP)
# VITE_API_BASE_URL=http://192.168.1.100:5000
```

**To find your IP address:**
- Windows: Run `ipconfig` in CMD
- Mac/Linux: Run `ifconfig` or `ip addr`

### 3. Start Backend Server

```bash
npm run dev
```

Make sure it's running on port 5000.

### 4. Build and Run

```bash
# Build frontend
npm run build:mobile

# Sync with Capacitor
npx cap sync

# Open Android Studio
npx cap open android
```

### 5. Run in Emulator

1. In Android Studio, create/start an Android Virtual Device (AVD)
2. Click the Run button (▶️)
3. Select your emulator and run

## 📱 Testing Checklist

- [ ] App launches without crashes
- [ ] Can connect to backend API
- [ ] Login works
- [ ] Menu items load
- [ ] WebSocket connections work
- [ ] Real-time updates work

## 🔧 Common Issues

**Can't connect to backend:**
- For emulator: Use `10.0.2.2` instead of `localhost`
- For physical device: Use your computer's IP address
- Ensure backend is running
- Check firewall settings

**Build errors:**
- Clean project in Android Studio: **Build → Clean Project**
- Invalidate caches: **File → Invalidate Caches / Restart**

## 📚 Full Documentation

See `CAPACITOR_SETUP_GUIDE.md` for detailed instructions.

## 🎯 Next Steps

1. Test all features in the emulator
2. Test on a physical device
3. Configure production API URLs
4. Build release APK for distribution





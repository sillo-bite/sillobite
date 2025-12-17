import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sillobyte.canteen',
  appName: 'Sillobyte Canteen',
  webDir: 'dist/public',
  server: {
    // For development - allow localhost connections
    // In production, you should set this to your production URL
    androidScheme: 'https',
    // Development: Use 10.0.2.2 for Android emulator (alias for host machine's localhost)
    // For physical device: Use your computer's IP address (e.g., http://192.168.1.100:5000)
    // Uncomment and modify as needed:
    // url: 'http://10.0.2.2:5000', // Android emulator
    // url: 'http://192.168.1.100:5000', // Physical device (replace with your IP)
    // cleartext: true, // Allow HTTP (not HTTPS) connections
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#6d47ff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#6d47ff',
    },
    Keyboard: {
      resize: 'body',
      style: 'light',
      resizeOnFullScreen: true,
    },
  },
};

export default config;


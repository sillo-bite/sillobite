import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Initialize Capacitor plugins and configure the app for native platforms
 */
export async function initializeCapacitor() {
  const isNative = Capacitor.isNativePlatform();
  
  if (!isNative) {
    // Running in browser - no initialization needed
    return;
  }

  try {
    // Configure Status Bar
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#6d47ff' });
    }

    // Hide splash screen after a short delay
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      // Keep splash screen visible initially, hide it after app is ready
      setTimeout(async () => {
        await SplashScreen.hide();
      }, 2000);
    }

    // Configure Keyboard
    if (Capacitor.isPluginAvailable('Keyboard')) {
      Keyboard.setAccessoryBarVisible({ isVisible: true });
      Keyboard.setScroll({ isDisabled: false });
    }

    console.log('✅ Capacitor initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Capacitor:', error);
  }
}

/**
 * Check if the app is running on a native platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the platform name (ios, android, web)
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}











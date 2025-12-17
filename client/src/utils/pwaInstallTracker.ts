/**
 * PWA Installation Tracker
 * Tracks and prevents multiple PWA installations on mobile devices
 */

const INSTALLATION_STORAGE_KEY = 'pwa_installation_tracker';
const INSTALLATION_TIMESTAMP_KEY = 'pwa_installation_timestamp';

interface InstallationData {
  installed: boolean;
  timestamp: number;
  deviceId: string;
  userAgent: string;
}

/**
 * Generate a simple device identifier based on available browser APIs
 * This helps track installations across sessions
 */
function generateDeviceId(): string {
  try {
    // Try to use existing device ID from storage
    const existingId = localStorage.getItem('device_id');
    if (existingId) {
      return existingId;
    }

    // Generate a new device ID based on available browser features
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Device fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Device fingerprint', 4, 17);
      
      const fingerprint = canvas.toDataURL();
      const hash = btoa(fingerprint).substring(0, 16);
      localStorage.setItem('device_id', hash);
      return hash;
    }
  } catch (e) {
    console.warn('Could not generate device ID:', e);
  }

  // Fallback: use timestamp + random
  const fallbackId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('device_id', fallbackId);
  return fallbackId;
}

/**
 * Check if PWA is already installed using multiple detection methods
 */
export async function isPWAAlreadyInstalled(): Promise<boolean> {
  // Method 1: Check display mode (most reliable - means we're running in standalone mode)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;

  if (isStandalone) {
    // If we're in standalone mode, mark as installed (in case it wasn't marked before)
    markPWAAsInstalled();
    return true;
  }

  // Method 2: Check localStorage for installation marker (critical for iOS)
  // On iOS, when browsing in Safari, we can't detect standalone mode,
  // but we can check if we've ever been in standalone mode before
  const installData = getInstallationData();
  if (installData?.installed) {
    // Verify it's from the same device
    const currentDeviceId = generateDeviceId();
    if (installData.deviceId === currentDeviceId) {
      // For iOS specifically, also check if we're on iOS and have installation marker
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // On iOS, if we have an installation marker, consider it installed
        // This prevents showing install banner when user visits in Safari after installing
        return true;
      }
      return true;
    }
  }

  // Method 3: Check service worker registrations
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      // If we have active service worker registrations, check if any are from installed PWA
      for (const registration of registrations) {
        // Check if service worker is controlling pages (indicates installed PWA)
        if (registration.active && navigator.serviceWorker.controller) {
          // Additional check: see if we're in a controlled context
          const isControlled = navigator.serviceWorker.controller !== null;
          if (isControlled) {
            // Check localStorage for installation marker
            const installData = getInstallationData();
            if (installData?.installed) {
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error checking service worker registrations:', error);
    }
  }

  // Method 4: Check URL parameter (for PWA launches)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('pwa') === 'true') {
    // If launched with pwa=true, mark as installed
    markPWAAsInstalled();
    return true;
  }

  return false;
}

/**
 * Get installation data from localStorage
 */
function getInstallationData(): InstallationData | null {
  try {
    const data = localStorage.getItem(INSTALLATION_STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as InstallationData;
    }
  } catch (error) {
    console.warn('Error reading installation data:', error);
  }
  return null;
}

/**
 * Mark PWA as installed
 */
export function markPWAAsInstalled(): void {
  const deviceId = generateDeviceId();
  const installData: InstallationData = {
    installed: true,
    timestamp: Date.now(),
    deviceId: deviceId,
    userAgent: navigator.userAgent
  };

  try {
    localStorage.setItem(INSTALLATION_STORAGE_KEY, JSON.stringify(installData));
    localStorage.setItem(INSTALLATION_TIMESTAMP_KEY, installData.timestamp.toString());
    localStorage.setItem('pwa_installed', 'true'); // Keep for backward compatibility
    
    console.log('✅ PWA installation marked:', installData);
  } catch (error) {
    console.error('Error marking PWA as installed:', error);
  }
}

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
}

/**
 * Check if we should prevent installation (mobile device with existing installation)
 */
export async function shouldPreventInstallation(): Promise<boolean> {
  if (!isMobileDevice()) {
    // Desktop: allow multiple installations (different browsers/profiles)
    return false;
  }

  // Mobile: check if already installed
  const alreadyInstalled = await isPWAAlreadyInstalled();
  
  // For iOS specifically, be more aggressive about preventing installation
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && alreadyInstalled) {
    console.log('🚫 iOS: Installation prevented - PWA already installed on this device');
    return true;
  }

  return alreadyInstalled;
}

/**
 * Clear installation data (for testing/debugging)
 */
export function clearInstallationData(): void {
  localStorage.removeItem(INSTALLATION_STORAGE_KEY);
  localStorage.removeItem(INSTALLATION_TIMESTAMP_KEY);
  localStorage.removeItem('pwa_installed');
  console.log('🧹 Installation data cleared');
}


import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { updateManager } from './utils/updateManager'
// Import 100% passive update detector (ZERO automatic calls)
import './utils/passiveUpdateDetector'
import { initializeCapacitor, isNativePlatform } from './utils/capacitorInit'

// Initialize Capacitor for native platforms
initializeCapacitor();

// Suppress service worker errors in development and native apps
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNative = isNativePlatform();

// Service Workers are not needed/available in native apps
if (!isNative) {
  if (isDevelopment) {
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('ServiceWorker') || 
          event.reason?.message?.includes('sw.js') ||
          event.reason?.message?.includes('Failed to update a ServiceWorker')) {
        event.preventDefault(); // Prevent error from showing in console
        return;
      }
    });
  }
// Note: Status bar color is now managed by individual pages/components
// to match their visible UI (header or background color)
// The initial color is set in index.html as a fallback


  // Register Service Worker for PWA with comprehensive update handling
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          if (!isDevelopment) {
            console.log('✅ Service Worker registered successfully:', registration.scope);
          }
          
          // Initialize update manager (handles dev mode internally - no update checks)
          updateManager.init(registration);
          
          if (!isDevelopment) {
            console.log('🚀 PWA Update Manager initialized');
          }
        })
        .catch(error => {
          // Silently fail in development, only log in production
          if (!isDevelopment) {
            console.error('❌ Service Worker registration failed:', error);
          }
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

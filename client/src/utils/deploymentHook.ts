// Deployment detection hook for cache invalidation
import { useEffect } from 'react';
import { CacheManager } from './cacheManager';
import { AppUpdater } from './appUpdater';
import { queryClient } from '@/lib/queryClient';

export function useDeploymentDetection() {
  useEffect(() => {
    const checkForDeploymentUpdate = async () => {
      try {
        // Skip in development mode
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDevelopment) return;

        // Make queryClient globally available for cache clearing
        window.queryClient = queryClient;
        
        // Check for new deployment
        const updateDetected = await CacheManager.checkForUpdate();
        
        if (updateDetected) {
          // Show user-friendly notification
          console.log('📱 App updated! New features are now available.');
          AppUpdater.showUpdateNotification();
        }

        // Also check for service worker updates
        const swUpdateAvailable = await CacheManager.checkServiceWorkerUpdate();
        if (swUpdateAvailable) {
          console.log('🔄 Service Worker update available');
          AppUpdater.showServiceWorkerUpdateNotification();
          await CacheManager.activateWaitingServiceWorker();
        }
        
      } catch (error) {
        // Only log errors in production
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isDevelopment) {
          console.error('Error checking for deployment updates:', error);
        }
      }
    };

    // Check immediately on app load only (no periodic polling)
    checkForDeploymentUpdate();
  }, []);
}

// Global notification function declaration
declare global {
  interface Window {
    showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  }
}
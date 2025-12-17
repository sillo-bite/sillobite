import { Capacitor } from '@capacitor/core';

/**
 * Get the API base URL based on the environment
 * - For web (localhost): uses relative URLs (same origin)
 * - For native apps: uses the configured server URL or defaults to localhost
 * - For production: uses the production server URL
 */
export function getApiBaseUrl(): string {
  const isNative = Capacitor.isNativePlatform();
  
  // Check if we have a custom API URL set
  const customApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (customApiUrl) {
    return customApiUrl;
  }
  
  // For native platforms, use the configured server URL or default
  if (isNative) {
    // In development, use localhost with the default port
    // In production, this should be set via VITE_API_BASE_URL
    const devApiUrl = 'http://localhost:5000';
    const prodApiUrl = 'https://your-production-api.com'; // TODO: Replace with your production URL
    
    // Check if we're in development mode
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      return devApiUrl;
    }
    
    return prodApiUrl;
  }
  
  // For web platform, use relative URLs (same origin)
  // This works with Vite's proxy in development
  return '';
}

/**
 * Get the WebSocket URL based on the environment
 */
export function getWebSocketUrl(): string {
  const isNative = Capacitor.isNativePlatform();
  
  // Check if we have a custom WebSocket URL set
  const customWsUrl = import.meta.env.VITE_WS_BASE_URL;
  
  if (customWsUrl) {
    return customWsUrl;
  }
  
  // For native platforms, use the configured server URL
  if (isNative) {
    const apiBaseUrl = getApiBaseUrl();
    // Convert http:// to ws:// and https:// to wss://
    return apiBaseUrl.replace(/^http/, 'ws');
  }
  
  // For web platform, determine from current location
  if (typeof window === 'undefined') {
    return 'ws://localhost:5000';
  }
  
  // Use the same protocol and host as the current page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
}











/**
 * Get the API base URL based on the environment
 * - For web (localhost): uses relative URLs (same origin)
 * - For production: uses the production server URL
 */
export function getApiBaseUrl(): string {
  // Check if we have a custom API URL set
  const customApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (customApiUrl) {
    return customApiUrl;
  }
  
  // For web platform, use relative URLs (same origin)
  // This works with Vite's proxy in development
  return '';
}

/**
 * Get the WebSocket URL based on the environment
 */
export function getWebSocketUrl(): string {
  // Check if we have a custom WebSocket URL set
  const customWsUrl = import.meta.env.VITE_WS_BASE_URL;
  
  if (customWsUrl) {
    return customWsUrl;
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











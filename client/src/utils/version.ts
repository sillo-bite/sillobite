// App version and build information
export const APP_CONFIG = {
  version: '1.0.0',
  buildTime: Date.now(),
  environment: import.meta.env.MODE || 'development'
};

// Generate build hash for cache busting
export const getBuildHash = (): string => {
  return APP_CONFIG.buildTime.toString(36);
};

// Get full version string
export const getVersionString = (): string => {
  return `v${APP_CONFIG.version} (${APP_CONFIG.environment})`;
};

// Check if this is a production build
export const isProduction = (): boolean => {
  return APP_CONFIG.environment === 'production';
};

// Get cache-busting query parameter
export const getCacheBuster = (): string => {
  return `?v=${getBuildHash()}`;
};
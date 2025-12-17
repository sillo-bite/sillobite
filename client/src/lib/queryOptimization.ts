/**
 * Global query optimization configuration
 * This centralizes all query settings to prevent unnecessary API calls
 */

export const QUERY_OPTIMIZATION_CONFIG = {
  // Static data (rarely changes) - very aggressive caching
  STATIC_DATA: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  },
  
  // Semi-static data (changes occasionally) - moderate caching
  SEMI_STATIC_DATA: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  },
  
  // Dynamic data (changes frequently) - light caching
  DYNAMIC_DATA: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false, // Use trigger-based updates instead of polling
  },
  
  // Real-time data (changes constantly) - minimal caching
  REALTIME_DATA: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false, // Use trigger-based updates instead of polling
  }
};

/**
 * Query key patterns for different data types
 */
export const QUERY_KEYS = {
  // Static data
  STATIC: {
    COLLEGES: ['/api/system-settings/colleges'],
    APP_VERSION: ['/api/system-settings/app-version'],
    SERVER_INFO: ['/api/server-info'],
  },
  
  // Semi-static data
  SEMI_STATIC: {
    SYSTEM_SETTINGS: ['/api/system-settings'],
    CANTEENS: ['/api/system-settings/canteens'],
    CATEGORIES: ['/api/categories'],
    USER_VALIDATION: (userId: string) => [`/api/users/${userId}/validate`],
    MAINTENANCE_STATUS: (userId: string) => [`/api/system-settings/maintenance-status/${userId}`],
  },
  
  // Dynamic data
  DYNAMIC: {
    MENU: ['/api/menu'],
    MENU_WITH_CANTEEN: (canteenId: string) => ['/api/menu', canteenId],
    ORDERS: ['/api/orders'],
    ORDERS_PAGINATED: ['/api/orders/paginated'],
    ORDERS_ACTIVE_PAGINATED: ['/api/orders/active/paginated'],
  },
  
  // Real-time data
  REALTIME: {
    NOTIFICATIONS: ['/api/notifications'],
    MEDIA_BANNERS: ['/api/media-banners'],
  }
};

/**
 * Get optimized query options based on data type
 */
export function getOptimizedQueryOptions(dataType: 'STATIC' | 'SEMI_STATIC' | 'DYNAMIC' | 'REALTIME') {
  const configKey = `${dataType}_DATA` as keyof typeof QUERY_OPTIMIZATION_CONFIG;
  return QUERY_OPTIMIZATION_CONFIG[configKey];
}

/**
 * Check if a query should be refetched based on its last fetch time
 */
export function shouldRefetchQuery(lastFetchTime: number, dataType: 'STATIC' | 'SEMI_STATIC' | 'DYNAMIC' | 'REALTIME'): boolean {
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  
  switch (dataType) {
    case 'STATIC':
      return timeSinceLastFetch > 30 * 60 * 1000; // 30 minutes
    case 'SEMI_STATIC':
      return timeSinceLastFetch > 10 * 60 * 1000; // 10 minutes
    case 'DYNAMIC':
      return timeSinceLastFetch > 2 * 60 * 1000; // 2 minutes
    case 'REALTIME':
      return timeSinceLastFetch > 30 * 1000; // 30 seconds
    default:
      return true;
  }
}

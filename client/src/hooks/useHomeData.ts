import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { MenuItem, Order } from '@shared/schema';

interface MediaBanner {
  id: string;
  name: string;
  type: 'image' | 'video';
  cloudinaryUrl?: string;
  fileId?: string;
  originalName: string;
  mimeType?: string;
}

interface HomeDataResponse {
  mediaBanners: MediaBanner[];
  trendingItems: MenuItem[];
  quickPicks: MenuItem[];
  activeOrders: Order[]; // User's active orders
  codingChallengesEnabled?: boolean; // Content settings from canteen
  timestamp: string;
}

export function useHomeData(canteenId: string | null, userId: number | null = null, enabled: boolean = true) {
  return useQuery<HomeDataResponse>({
    // Always include userId in query key for consistency (even if null)
    // This prevents key structure changes that trigger unnecessary fetches
    queryKey: ['home-data', canteenId, userId],
    queryFn: async () => {
      if (!canteenId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🏠 useHomeData - No canteen ID provided`);
        }
        return { 
          mediaBanners: [], 
          trendingItems: [], 
          quickPicks: [],
          activeOrders: [],
          timestamp: new Date().toISOString() 
        };
      }

      let url = `/api/home-data?canteenId=${canteenId}`;
      if (userId) {
        url += `&userId=${userId}`;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`🏠 ===== HOME DATA API REQUEST =====`);
        console.log(`🏠 useHomeData - Canteen ID:`, canteenId);
        console.log(`🏠 useHomeData - User ID:`, userId);
        console.log(`🏠 useHomeData - Full URL:`, url);
        console.log(`🏠 ===== END HOME DATA API REQUEST =====`);
      }

      const result = await apiRequest(url);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🏠 ===== HOME DATA API RESPONSE =====`);
        console.log(`🏠 useHomeData - Response Success:`, !!result);
        console.log(`🏠 useHomeData - Media Banners:`, result?.mediaBanners?.length || 0);
        console.log(`🏠 useHomeData - Trending Items:`, result?.trendingItems?.length || 0);
        console.log(`🏠 useHomeData - Quick Picks:`, result?.quickPicks?.length || 0);
        console.log(`🏠 useHomeData - Active Orders:`, result?.activeOrders?.length || 0);
        console.log(`🏠 ===== END HOME DATA API RESPONSE =====`);
      }

      return result;
    },
    enabled: !!canteenId && enabled,
    staleTime: 1000 * 30, // 30 seconds - prevents rapid refetches
    gcTime: 1000 * 60 * 5, // 5 minutes cache time
    refetchOnWindowFocus: false, // Disable - WebSocket handles real-time updates
    refetchOnMount: false, // Don't refetch on mount - use cache if fresh
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 2,
    // Network mode to deduplicate simultaneous requests
    networkMode: 'online',
  });
}

import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Canteen {
  id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  canteenOwnerEmail?: string;
  collegeId?: string;
  organizationId?: string;
  operatingHours?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  imagePublicId?: string;
  trendingItems?: Array<{ name: string; price: number }>; // Array of trending menu items with name and price (0-4 items)
  categories?: string[]; // Array of category names for this canteen
}

interface CanteensResponse {
  canteens: Canteen[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export function useCanteensLazyLoad(
  institutionType: string | null,
  institutionId: string | null,
  limit: number = 5,
  enabled: boolean = true
) {
  return useInfiniteQuery<CanteensResponse>({
    queryKey: ['canteens-lazy-load', institutionType, institutionId, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!institutionType || !institutionId) {
        console.log(`🏪 useCanteensLazyLoad - Missing required parameters:`, { institutionType, institutionId });
        return { canteens: [], total: 0, hasMore: false, limit, offset: 0 };
      }

      const offset = (pageParam as number) * limit;
      const url = `/api/system-settings/canteens/by-institution?institutionType=${encodeURIComponent(institutionType)}&institutionId=${encodeURIComponent(institutionId)}&limit=${limit}&offset=${offset}`;

      console.log(`🏪 ===== LAZY LOAD CANTEENS API REQUEST =====`);
      console.log(`🏪 useCanteensLazyLoad - Institution Type:`, institutionType);
      console.log(`🏪 useCanteensLazyLoad - Institution ID:`, institutionId);
      console.log(`🏪 useCanteensLazyLoad - Limit:`, limit);
      console.log(`🏪 useCanteensLazyLoad - Offset:`, offset);
      console.log(`🏪 useCanteensLazyLoad - Full URL:`, url);
      console.log(`🏪 ===== END LAZY LOAD CANTEENS API REQUEST =====`);

      const result = await apiRequest(url);

      console.log(`🏪 ===== LAZY LOAD CANTEENS API RESPONSE =====`);
      console.log(`🏪 useCanteensLazyLoad - Response Success:`, result?.success);
      console.log(`🏪 useCanteensLazyLoad - Canteens Count:`, result?.canteens?.length || 0);
      console.log(`🏪 useCanteensLazyLoad - Total:`, result?.total);
      console.log(`🏪 useCanteensLazyLoad - Has More:`, result?.hasMore);
      console.log(`🏪 ===== END LAZY LOAD CANTEENS API RESPONSE =====`);

      return result;
    },
    getNextPageParam: (lastPage, allPages) => {
      // If there are more canteens to load, return the next page number
      if (lastPage.hasMore) {
        return allPages.length;
      }
      return undefined; // No more pages
    },
    enabled: !!institutionType && !!institutionId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

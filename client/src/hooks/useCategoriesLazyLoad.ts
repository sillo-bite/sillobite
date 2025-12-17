import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Category } from '@shared/schema';

interface CategoriesResponse {
  items: Category[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export function useCategoriesLazyLoad(
  canteenId: string | null,
  limit: number = 5,
  enabled: boolean = true
) {
  return useInfiniteQuery<CategoriesResponse>({
    queryKey: ['categories-lazy-load', canteenId, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!canteenId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`📂 useCategoriesLazyLoad - No canteen ID provided`);
        }
        return { items: [], total: 0, hasMore: false, limit, offset: 0 };
      }

      const offset = (pageParam as number) * limit;
      const url = `/api/categories?canteenId=${canteenId}&limit=${limit}&offset=${offset}`;

      if (process.env.NODE_ENV === 'development') {
        console.log(`📂 ===== LAZY LOAD CATEGORIES API REQUEST =====`);
        console.log(`📂 useCategoriesLazyLoad - Canteen ID:`, canteenId);
        console.log(`📂 useCategoriesLazyLoad - Limit:`, limit);
        console.log(`📂 useCategoriesLazyLoad - Offset:`, offset);
        console.log(`📂 useCategoriesLazyLoad - Full URL:`, url);
        console.log(`📂 ===== END LAZY LOAD CATEGORIES API REQUEST =====`);
      }

      const result = await apiRequest(url);

      if (process.env.NODE_ENV === 'development') {
        console.log(`📂 ===== LAZY LOAD CATEGORIES API RESPONSE =====`);
        console.log(`📂 useCategoriesLazyLoad - Response Success:`, result?.success);
        console.log(`📂 useCategoriesLazyLoad - Categories Count:`, result?.items?.length || 0);
        console.log(`📂 useCategoriesLazyLoad - Total:`, result?.total);
        console.log(`📂 useCategoriesLazyLoad - Has More:`, result?.hasMore);
        console.log(`📂 ===== END LAZY LOAD CATEGORIES API RESPONSE =====`);
      }

      return result;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length;
    },
    enabled: !!canteenId && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

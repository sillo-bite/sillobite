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

/**
 * Lazy load categories with support for dynamic initial page size
 * @param canteenId - The canteen ID to fetch categories for
 * @param initialLimit - Number of categories to fetch on first load (can be dynamic based on screen width)
 * @param subsequentLimit - Number of categories to fetch on subsequent scroll loads (default: 5)
 * @param enabled - Whether to enable the query
 */
export function useCategoriesLazyLoad(
  canteenId: string | null,
  initialLimit: number = 5,
  enabled: boolean = true,
  subsequentLimit: number = 5
) {
  return useInfiniteQuery<CategoriesResponse>({
    queryKey: ['categories-lazy-load', canteenId, initialLimit, subsequentLimit],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!canteenId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`📂 useCategoriesLazyLoad - No canteen ID provided`);
        }
        return { items: [], total: 0, hasMore: false, limit: initialLimit, offset: 0 };
      }

      // Use initialLimit for first page (pageParam === 0), subsequentLimit for rest
      const isFirstPage = (pageParam as number) === 0;
      const currentLimit = isFirstPage ? initialLimit : subsequentLimit;

      // Calculate offset based on previous pages
      // First page: offset 0
      // Subsequent pages: offset = initialLimit + (pageIndex - 1) * subsequentLimit
      let offset: number;
      if (isFirstPage) {
        offset = 0;
      } else {
        offset = initialLimit + ((pageParam as number) - 1) * subsequentLimit;
      }

      const url = `/api/categories?canteenId=${canteenId}&limit=${currentLimit}&offset=${offset}`;

      if (process.env.NODE_ENV === 'development') {
        console.log(`📂 ===== LAZY LOAD CATEGORIES API REQUEST =====`);
        console.log(`📂 useCategoriesLazyLoad - Canteen ID:`, canteenId);
        console.log(`📂 useCategoriesLazyLoad - Page:`, pageParam);
        console.log(`📂 useCategoriesLazyLoad - Limit:`, currentLimit);
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

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface OrderSearchResult {
  orders: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function useOrderSearch(query: string, page: number = 1, limit: number = 15) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the search query to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, error } = useQuery<OrderSearchResult>({
    queryKey: ['/api/orders/search', debouncedQuery, page, limit],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        return {
          orders: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page
        };
      }

      const response = await fetch(`/api/orders/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to search orders');
      }
      return response.json();
    },
    enabled: !!debouncedQuery && debouncedQuery.trim().length > 0,
  });

  return {
    orders: data?.orders || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.currentPage || page,
    isLoading,
    error,
    hasResults: (data?.orders?.length || 0) > 0,
    isSearching: !!debouncedQuery && debouncedQuery.trim().length > 0
  };
}
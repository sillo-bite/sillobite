import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PaginatedActiveOrdersResult {
  orders: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export const usePaginatedActiveOrders = (initialPage: number = 1, pageSize: number = 15, canteenId?: string, customerId?: number, enabled: boolean = true) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const { data, isLoading, error, refetch } = useQuery<PaginatedActiveOrdersResult>({
    queryKey: ['/api/orders/active/paginated', currentPage, pageSize, canteenId, customerId],
    queryFn: async () => {
      let url = `/api/orders/active/paginated?page=${currentPage}&limit=${pageSize}`;
      if (canteenId) {
        url += `&canteenId=${canteenId}`;
      }
      if (customerId) {
        url += `&customerId=${customerId}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch paginated active orders');
      }
      return response.json();
    },
    enabled, 
    staleTime: 1000 * 30, // 30 seconds - prevents rapid refetches while keeping data relatively fresh
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache
    refetchInterval: false, // Disable polling - using SSE for real-time updates
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount for fresh data
  });

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToNextPage = () => {
    if (data && currentPage < data.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    if (data) {
      setCurrentPage(data.totalPages);
    }
  };

  return {
    orders: data?.orders || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage,
    isLoading,
    error,
    refetch,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage: data ? currentPage < data.totalPages : false,
    hasPreviousPage: currentPage > 1,
  };
};
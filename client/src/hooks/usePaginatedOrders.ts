import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PaginatedOrdersResult {
  orders: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export const usePaginatedOrders = (initialPage: number = 1, pageSize: number = 15, canteenId?: string) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const { data, isLoading, error, refetch } = useQuery<PaginatedOrdersResult>({
    queryKey: ['/api/orders/paginated', currentPage, pageSize, canteenId],
    queryFn: async () => {
      let url = `/api/orders/paginated?page=${currentPage}&limit=${pageSize}`;
      if (canteenId) {
        url += `&canteenId=${canteenId}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch paginated orders');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - proper caching for pagination
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache longer
    refetchInterval: false, // Disable polling - using SSE for real-time updates
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount if data is fresh
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
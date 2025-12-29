import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { MenuItem, Category } from "@shared/schema";

export function usePosData(canteenId: string, searchQuery: string, selectedCategory: string) {
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsLimit = 10;

  // Fetch menu items with server-side filtering
  const { data: menuData, isLoading: menuLoading } = useQuery<{
    items: MenuItem[];
    pagination?: any;
  }>({
    queryKey: ['/api/menu', canteenId, searchQuery, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({
        canteenId,
        availableOnly: 'true',
        limit: '1000'
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      
      return apiRequest(`/api/menu?${params.toString()}`);
    },
    enabled: !!canteenId,
  });

  const menuItemsData = menuData?.items || [];

  // Fetch categories
  const { data: categoriesResponse } = useQuery<{
    items: Category[];
    pagination?: any;
  } | Category[]>({
    queryKey: ['/api/categories', canteenId],
    queryFn: () => apiRequest(`/api/categories?canteenId=${canteenId}`),
    enabled: !!canteenId,
  });

  // Handle both response formats (object with items property or direct array)
  const categoriesData = Array.isArray(categoriesResponse) 
    ? categoriesResponse 
    : (categoriesResponse?.items || []);

  // Fetch recent transactions (orders) with pagination
  const { data: transactionsResponse, refetch: refetchTransactions } = useQuery<{
    orders: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: ['/api/orders/paginated', canteenId, currentPage, 'pos-transactions'],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/orders/paginated?canteenId=${canteenId}&page=${currentPage}&limit=${transactionsLimit}&isCounterOrder=true`
      );
      return response;
    },
    enabled: !!canteenId,
  });

  // Fetch canteen settings (tax rate)
  const { data: canteenSettings } = useQuery<{
    taxRate: number;
    taxName: string;
  }>({
    queryKey: ['/api/canteens/settings', canteenId],
    queryFn: () => apiRequest(`/api/canteens/${canteenId}/settings`),
    enabled: !!canteenId,
  });

  return {
    menuItems: menuItemsData,
    categories: categoriesData,
    transactions: transactionsResponse?.orders || [],
    transactionsPagination: {
      currentPage: transactionsResponse?.currentPage || 1,
      totalPages: transactionsResponse?.totalPages || 1,
      totalCount: transactionsResponse?.totalCount || 0,
    },
    canteenSettings: canteenSettings || { taxRate: 5, taxName: 'GST' },
    isLoading: menuLoading,
    refetchTransactions,
    setTransactionsPage: setCurrentPage,
  };
}


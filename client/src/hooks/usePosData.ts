import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { MenuItem, Category } from "@shared/schema";

export function usePosData(canteenId: string, searchQuery: string, selectedCategory: string) {
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsLimit = 10;

  // Fetch menu items
  const { data: menuData, isLoading: menuLoading } = useQuery<{
    items: MenuItem[];
    pagination?: any;
  }>({
    queryKey: ['/api/menu', canteenId],
    queryFn: () => apiRequest(`/api/menu?canteenId=${canteenId}&availableOnly=true&limit=1000`),
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

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    if (!Array.isArray(menuItemsData)) {
      return [];
    }
    let filtered = menuItemsData.filter(item => item.available && item.stock > 0);
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.categoryId === selectedCategory);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [menuItemsData, selectedCategory, searchQuery]);

  return {
    menuItems: filteredMenuItems,
    categories: categoriesData,
    transactions: transactionsResponse?.orders || [],
    transactionsPagination: {
      currentPage: transactionsResponse?.currentPage || 1,
      totalPages: transactionsResponse?.totalPages || 1,
      totalCount: transactionsResponse?.totalCount || 0,
    },
    isLoading: menuLoading,
    refetchTransactions,
    setTransactionsPage: setCurrentPage,
  };
}


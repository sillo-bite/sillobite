import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { MenuItem, Category } from "@shared/schema";

export function usePosData(canteenId: string, searchQuery: string, selectedCategory: string) {
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

  // Fetch recent transactions (orders)
  const { data: transactionsData = [], refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ['/api/orders', canteenId, 'pos-transactions'],
    queryFn: async () => {
      const response = await apiRequest(`/api/orders?canteenId=${canteenId}&limit=50`);
      // Handle both array and object response formats
      const orders = Array.isArray(response) ? response : (response?.items || response?.orders || []);
      // Filter for offline/counter orders which are POS transactions
      return Array.isArray(orders) ? orders.filter((order: any) => order.isOffline || order.isCounterOrder || order.status === 'completed') : [];
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
    transactions: transactionsData,
    isLoading: menuLoading,
    refetchTransactions,
  };
}


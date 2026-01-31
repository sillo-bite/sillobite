import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { MenuItem, Category, Order, User } from "@shared/schema";
import { UserRole } from "@shared/schema";

/**
 * Custom hook for synchronized data fetching across all dashboards
 * Ensures real-time data consistency between admin, canteen owner, and student views
 */
export function useDataSync() {
  const { canteenId } = useParams();

  // Fetch categories
  const categoriesQuery = useQuery<{
    items: Category[];
    pagination?: any;
  }>({
    queryKey: ["/api/categories", canteenId],
    queryFn: async () => {
      const url = canteenId
        ? `/api/categories?canteenId=${canteenId}&limit=1000`
        : '/api/categories?limit=1000';
      return await apiRequest(url);
    },
    enabled: !!canteenId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch menu items
  const menuItemsQuery = useQuery<{
    items: MenuItem[];
    pagination?: any;
  }>({
    queryKey: ["/api/menu", canteenId],
    queryFn: async () => {
      const url = canteenId
        ? `/api/menu?canteenId=${canteenId}&limit=1000`
        : '/api/menu?limit=1000';
      return await apiRequest(url);
    },
    enabled: !!canteenId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch orders (paginated - just get count)
  const ordersQuery = useQuery<{
    orders: Order[];
    totalCount?: number;
    pagination?: any;
  }>({
    queryKey: ["/api/orders/paginated", canteenId],
    queryFn: async () => {
      const url = canteenId
        ? `/api/orders/paginated?canteenId=${canteenId}&page=1&limit=1`
        : '/api/orders/paginated?page=1&limit=1';
      return await apiRequest(url);
    },
    enabled: !!canteenId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const analyticsQuery = {
    data: null,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve()
  };

  // Extract data arrays
  const categories = categoriesQuery.data?.items || [];
  const menuItems = menuItemsQuery.data?.items || [];
  const orders = ordersQuery.data?.orders || [];
  const totalOrdersCount = ordersQuery.data?.totalCount || 0;

  // Computed values for dashboard consistency
  const stats = {
    totalCategories: categories.length,
    totalMenuItems: menuItems.length,
    availableItems: menuItems.filter(item => item.available).length,
    totalOrders: totalOrdersCount || orders.length,
    pendingOrders: orders.filter(order => order.status === 'preparing').length,
    completedOrders: orders.filter(order => order.status === 'completed').length,
    totalRevenue: orders.reduce((sum, order) => sum + (order.amount || 0), 0),
  };

  // Combined loading state
  const isLoading = categoriesQuery.isLoading || menuItemsQuery.isLoading || ordersQuery.isLoading;

  // Combined error state (excluding analytics errors as they're optional)
  const hasError = categoriesQuery.error || menuItemsQuery.error || ordersQuery.error;

  return {
    // Raw data
    categories,
    menuItems,
    orders,
    analytics: analyticsQuery.data,

    // Computed stats
    stats,

    // Loading and error states
    isLoading,
    hasError,

    // Refetch functions for manual sync
    refetch: {
      categories: categoriesQuery.refetch,
      menuItems: menuItemsQuery.refetch,
      orders: ordersQuery.refetch,
      analytics: analyticsQuery.refetch,
      all: async () => {
        await Promise.all([
          categoriesQuery.refetch(),
          menuItemsQuery.refetch(),
          ordersQuery.refetch(),
        ]);
        analyticsQuery.refetch();
      }
    },

    // Individual query states for granular control
    queries: {
      categories: categoriesQuery,
      menuItems: menuItemsQuery,
      orders: ordersQuery,
      analytics: analyticsQuery,
    }
  };
}

/**
 * Hook specifically for authentication state synchronization
 */
export function useAuthSync() {
  const [user, setUser] = useState(() => {
    try {
      // Check for server temp user session first
      const tempUserSession = localStorage.getItem('temp_user_session');
      if (tempUserSession) {
        const parsed = JSON.parse(tempUserSession);
        return { ...parsed, isTemporary: true, role: UserRole.GUEST };
      }

      // Fall back to regular user
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        // Check for server temp user session first
        const tempUserSession = localStorage.getItem('temp_user_session');
        if (tempUserSession) {
          const parsed = JSON.parse(tempUserSession);
          setUser({ ...parsed, isTemporary: true, role: UserRole.GUEST });
          return;
        }

        // Fall back to regular user
        const newUser = JSON.parse(localStorage.getItem('user') || 'null');
        setUser(newUser);
      } catch {
        setUser(null);
      }
    };

    // Listen for storage events (from other tabs)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (from same tab)
    window.addEventListener('userAuthChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userAuthChange', handleStorageChange);
    };
  }, []);

  // Debug logging for authentication state (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log("🔐 useAuthSync Debug:", {
      localStorage_user: localStorage.getItem('user'),
      temp_user_session: localStorage.getItem('temp_user_session'),
      parsed_user: user,
      isAuthenticated: !!user,
      userRole: user?.role,
      userCollege: user?.college,
      userEmail: user?.email,
      isTemporary: user?.isTemporary
    });
  }

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN,
    isSuperAdmin: user?.role === UserRole.SUPER_ADMIN,
    isCanteenOwner: user?.role === UserRole.CANTEEN_OWNER,
    isStudent: user?.role === UserRole.STUDENT,
    isStaff: user?.role === UserRole.STAFF,
    isEmployee: user?.role === UserRole.EMPLOYEE,
    isGuest: user?.role === UserRole.GUEST,
    isContractor: user?.role === UserRole.CONTRACTOR,
    isVisitor: user?.role === UserRole.VISITOR,
    hasRole: (role: string) => user?.role === role,
  };
}
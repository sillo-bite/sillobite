import { useQuery } from "@tanstack/react-query";

interface FilteredOrdersParams {
  canteenId?: string;
  search?: string;
  status?: string;
  dateRange?: string;
  amountRange?: string;
  paymentMethod?: string;
  collegeFilter?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface FilteredOrdersResult {
  orders: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function useFilteredOrders(params: FilteredOrdersParams) {
  const {
    canteenId,
    search = "",
    status = "all",
    dateRange = "all",
    amountRange = "all",
    paymentMethod = "all",
    collegeFilter = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 15
  } = params;

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (canteenId) queryParams.set('canteenId', canteenId);
  if (search) queryParams.set('search', search);
  if (status !== 'all') queryParams.set('status', status);
  if (dateRange !== 'all') queryParams.set('dateRange', dateRange);
  if (amountRange !== 'all') queryParams.set('amountRange', amountRange);
  if (paymentMethod !== 'all') queryParams.set('paymentMethod', paymentMethod);
  if (collegeFilter !== 'all') queryParams.set('collegeFilter', collegeFilter);
  queryParams.set('sortBy', sortBy);
  queryParams.set('sortOrder', sortOrder);
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());

  const { data, isLoading, error, refetch } = useQuery<FilteredOrdersResult>({
    queryKey: ['/api/orders/filtered', queryParams.toString()],
    queryFn: async () => {
      console.log('🔍 Fetching filtered orders with params:', queryParams.toString());
      const response = await fetch(`/api/orders/filtered?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch filtered orders: ${response.status}`);
      }
      const result = await response.json();
      console.log('🔍 Filtered orders result:', result);
      return result;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - server-side filtering with caching
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });

  return {
    orders: data?.orders || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.currentPage || 1,
    isLoading,
    error,
    refetch,
  };
}

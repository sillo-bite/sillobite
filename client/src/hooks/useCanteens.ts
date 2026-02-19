import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Canteen {
  id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  canteenOwnerEmail?: string;
  collegeId?: string; // Legacy field - kept for backward compatibility
  collegeIds?: string[]; // Array of college IDs this canteen serves
  organizationId?: string; // Legacy field - kept for backward compatibility
  organizationIds?: string[]; // Array of organization IDs this canteen serves
  restaurantId?: string; // New field for restaurant type canteens
  type?: 'college' | 'organization' | 'restaurant'; // New field to specify canteen type
  operatingHours?: {
    open: string;
    close: string;
    days: string[];
  };
  isActive: boolean;
  priority?: number; // Priority for ordering (lower number = higher priority)
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string; // URL for the canteen profile picture
  imagePublicId?: string; // Cloudinary Public ID
  bannerUrl?: string; // Canteen banner URL (4:3 ratio)
  bannerPublicId?: string; // Canteen banner public ID
  ownerSidebarConfig?: Record<string, boolean>;
  trendingItems?: Array<{ name: string; price: number }>; // Array of trending menu items with name and price (0-4 items)
  categories?: string[]; // Array of category names for this canteen
}

export interface CanteensResponse {
  canteens: Canteen[];
}

export interface AddCanteenRequest {
  name: string;
  code: string;
  description?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  canteenOwnerEmail?: string;
  collegeId?: string; // Legacy field - kept for backward compatibility
  collegeIds?: string[]; // Array of college IDs this canteen serves
  organizationId?: string; // Legacy field - kept for backward compatibility
  organizationIds?: string[]; // Array of organization IDs this canteen serves
  restaurantId?: string; // New field for restaurant type canteens
  type?: 'college' | 'organization' | 'restaurant'; // New field to specify canteen type
  operatingHours?: {
    open: string;
    close: string;
    days: string[];
  };
  isActive?: boolean;
}

export interface UpdateCanteenRequest extends Partial<AddCanteenRequest> {
  id: string;
}

export function useCanteens(enabled: boolean = true) {
  return useQuery<CanteensResponse>({
    queryKey: ['/api/system-settings/canteens'],
    queryFn: () => apiRequest('/api/system-settings/canteens'),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCanteen(id: string | undefined, enabled: boolean = true) {
  return useQuery<Canteen>({
    queryKey: ['/api/system-settings/canteens', id],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${id}`),
    enabled: !!id && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCanteensByCollege(collegeId: string | undefined, enabled: boolean = true) {
  return useQuery<CanteensResponse>({
    queryKey: ['/api/system-settings/canteens/by-college', collegeId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/by-college/${collegeId}`),
    enabled: !!collegeId && enabled, // Only run query if collegeId is provided and enabled
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCanteensByOrganization(organizationId: string | undefined, enabled: boolean = true) {
  return useQuery<CanteensResponse>({
    queryKey: ['/api/system-settings/canteens/by-organization', organizationId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/by-organization/${organizationId}`),
    enabled: !!organizationId && enabled, // Only run query if organizationId is provided and enabled
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCanteensByRestaurant(restaurantId: string | undefined, enabled: boolean = true) {
  return useQuery<CanteensResponse>({
    queryKey: ['/api/system-settings/canteens/by-restaurant', restaurantId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/by-restaurant/${restaurantId}`),
    enabled: !!restaurantId && enabled, // Only run query if restaurantId is provided and enabled
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActiveCanteens() {
  const { data, ...rest } = useCanteens();

  return {
    ...rest,
    data: data ? {
      canteens: data.canteens.filter(canteen => canteen.isActive)
    } : undefined
  };
}

export function useAddCanteen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canteenData: AddCanteenRequest) =>
      apiRequest('/api/system-settings/canteens', {
        method: 'POST',
        body: JSON.stringify(canteenData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    },
  });
}

export function useUpdateCanteen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...canteenData }: UpdateCanteenRequest) =>
      apiRequest(`/api/system-settings/canteens/${id}`, {
        method: 'PUT',
        body: JSON.stringify(canteenData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    },
  });
}

export function useDeleteCanteen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/system-settings/canteens/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    },
  });
}

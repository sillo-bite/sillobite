import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface CanteenByOwnerResponse {
  canteen: {
    id: string;
    name: string;
    code: string;
    description?: string;
    location?: string;
    contactNumber?: string;
    email?: string;
    canteenOwnerEmail?: string;
    operatingHours?: {
      open: string;
      close: string;
      days: string[];
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function useCanteenByOwner(email: string) {
  return useQuery<CanteenByOwnerResponse>({
    queryKey: ['/api/system-settings/canteens/by-owner', email],
    queryFn: () => apiRequest(`/api/system-settings/canteens/by-owner/${email}`),
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}


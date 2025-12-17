import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Canteen {
  id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  canteenOwnerEmail?: string;
  collegeId?: string;
  organizationId?: string;
  operatingHours?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CanteensResponse {
  canteens: Canteen[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/**
 * Hook to fetch canteens by institution (college or organization) with pagination
 * Used for preloading canteens on profile setup completion
 */
export function useCanteensByInstitution(
  institutionType: string | null,
  institutionId: string | null,
  limit: number = 5,
  offset: number = 0,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['canteens-by-institution', institutionType, institutionId, limit, offset],
    queryFn: async (): Promise<CanteensResponse | null> => {
      if (!institutionType || !institutionId) {
        console.log(`🏪 useCanteensByInstitution - Missing required parameters:`, {
          institutionType,
          institutionId
        });
        return null;
      }
      
      const url = `/api/system-settings/canteens/by-institution?institutionType=${encodeURIComponent(institutionType)}&institutionId=${encodeURIComponent(institutionId)}&limit=${limit}&offset=${offset}`;
      
      console.log(`🏪 ===== CANTEENS API REQUEST =====`);
      console.log(`🏪 useCanteensByInstitution - Institution Type:`, institutionType);
      console.log(`🏪 useCanteensByInstitution - Institution ID:`, institutionId);
      console.log(`🏪 useCanteensByInstitution - Limit:`, limit);
      console.log(`🏪 useCanteensByInstitution - Offset:`, offset);
      console.log(`🏪 useCanteensByInstitution - Full URL:`, url);
      console.log(`🏪 ===== END CANTEENS API REQUEST =====`);
      
      const result = await apiRequest(url);
      
      console.log(`🏪 ===== CANTEENS API RESPONSE =====`);
      console.log(`🏪 useCanteensByInstitution - Response Success:`, !!result);
      console.log(`🏪 useCanteensByInstitution - Canteens Count:`, result?.canteens?.length || 0);
      console.log(`🏪 useCanteensByInstitution - Total:`, result?.total || 0);
      console.log(`🏪 useCanteensByInstitution - Has More:`, result?.hasMore || false);
      console.log(`🏪 useCanteensByInstitution - Limit:`, result?.limit || 0);
      console.log(`🏪 useCanteensByInstitution - Offset:`, result?.offset || 0);
      
      // Log each canteen
      if (result?.canteens) {
        result.canteens.forEach((canteen: Canteen, index: number) => {
          console.log(`🏪 Canteen ${index + 1}:`, {
            id: canteen.id,
            name: canteen.name,
            code: canteen.code,
            isActive: canteen.isActive,
            collegeId: canteen.collegeId,
            organizationId: canteen.organizationId
          });
        });
      }
      
      console.log(`🏪 ===== END CANTEENS API RESPONSE =====`);
      
      return result;
    },
    enabled: !!institutionType && !!institutionId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

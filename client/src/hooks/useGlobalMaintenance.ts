import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * Global maintenance check hook to prevent multiple components from making the same API calls
 * This should be used at the app level instead of in individual components
 */
export function useGlobalMaintenance() {
  const { user } = useAuth();
  
  // Query for user-specific maintenance status (uses the new targeting logic)
  const { data: userMaintenanceCheck, isLoading: userMaintenanceLoading } = useQuery({
    queryKey: [`/api/system-settings/maintenance-status/${user?.id}`],
    enabled: !!user?.id, // Only query when user ID is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic polling
    refetchOnMount: false, // Disable refetch on component mount
    refetchOnWindowFocus: false, // Disable refetch on window focus
  });

  // Fallback: Query for general maintenance status only for unauthenticated users
  const { data: generalMaintenanceStatus, isLoading: generalMaintenanceLoading } = useQuery({
    queryKey: ['/api/system-settings/maintenance-status'],
    enabled: !user?.id, // Only query when there's no authenticated user
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic polling
    refetchOnMount: false, // Disable refetch on component mount
    refetchOnWindowFocus: false, // Disable refetch on window focus
  });

  return {
    userMaintenanceCheck,
    generalMaintenanceStatus,
    isLoading: userMaintenanceLoading || generalMaintenanceLoading,
    shouldShowMaintenance: () => {
      if (!user?.id) {
        return false; // No user, no maintenance check
      }

      if (userMaintenanceCheck) {
        const maintenanceCheck = userMaintenanceCheck as any;
        return maintenanceCheck.showMaintenance;
      }

      return false;
    },
    getMaintenanceInfo: () => {
      if (userMaintenanceCheck) {
        const maintenanceCheck = userMaintenanceCheck as any;
        return {
          title: maintenanceCheck.maintenanceInfo?.title || 'System Maintenance',
          message: maintenanceCheck.maintenanceInfo?.message || 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: maintenanceCheck.maintenanceInfo?.estimatedTime,
          contactInfo: maintenanceCheck.maintenanceInfo?.contactInfo
        };
      }
      return null;
    }
  };
}

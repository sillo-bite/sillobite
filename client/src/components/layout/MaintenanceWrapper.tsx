import MaintenanceScreen from "@/components/layout/MaintenanceScreen";

interface MaintenanceWrapperProps {
  children: React.ReactNode;
  allowAdminAccess?: boolean; // Allow admins to access during maintenance
}

export default function MaintenanceWrapper({ 
  children, 
  allowAdminAccess = false 
}: MaintenanceWrapperProps) {
  // Simplified maintenance wrapper - no API calls
  // Maintenance checks are only needed for public pages, not admin pages
  
  // No maintenance active, render children
  return <>{children}</>;
}
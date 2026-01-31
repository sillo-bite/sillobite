import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { CanteenAdminSidebar } from "./CanteenAdminSidebar";
import SyncStatus from "@/components/common/SyncStatus";
import { useAuthSync } from "@/hooks/useDataSync";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LogOut, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import NotificationPanel from "@/components/common/NotificationPanel";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";

interface CanteenAdminLayoutProps {
  children: React.ReactNode;
  canteenId: string;
}

// Enhanced Sidebar Toggle Component
function EnhancedSidebarToggle() {
  const { open, toggleSidebar, isMobile } = useSidebar();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9"
            data-testid="sidebar-toggle"
          >
            {open ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {open ? "Collapse Sidebar" : "Expand Sidebar"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CanteenAdminLayout({ children, canteenId }: CanteenAdminLayoutProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuthSync();

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  // Use real notification context
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  } = useNotificationContext();

  // Notification handlers
  const handleToggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  const handleMarkAsRead = useCallback((id: string) => {
    markAsRead(id);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Fetch only the specific canteen data (more efficient than fetching all canteens)
  const { data: canteenData } = useQuery({
    queryKey: ['/api/system-settings/canteens', canteenId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${canteenId}`),
    enabled: !!canteenId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get canteen name from data
  const canteenName = canteenData?.name || 'Canteen';

  const handleLogout = async () => {
    try {
      // Clear any stored authentication data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');

      // Redirect to login
      setLocation('/admin/login');

    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      setLocation('/admin/login');
    }
  }, [user, setLocation]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CanteenAdminSidebar canteenName={canteenName} />

        <div className="flex-1 flex flex-col">
          {/* Enhanced Header with Sync Status */}
          <header className="h-14 flex items-center justify-between border-b bg-card px-4">
            <div className="flex items-center space-x-4">
              <EnhancedSidebarToggle />
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {canteenName} - Admin Panel
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <SyncStatus />
              <NotificationPanel
                isOpen={showNotifications}
                onClose={handleCloseNotifications}
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {user?.role === UserRole.SUPER_ADMIN ? 'Super Admin' : 'Admin'} - {user?.email}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

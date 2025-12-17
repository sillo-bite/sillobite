import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import SyncStatus from "@/components/common/SyncStatus";
import { useAuthSync } from "@/hooks/useDataSync";
import { signOutGoogle } from "@/lib/googleAuth";
import { CacheManager } from "@/utils/cacheManager";
import { clearPWAAuth } from "@/utils/pwaAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LogOut, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import NotificationPanel from "@/components/common/NotificationPanel";
import { useNotificationContext } from "@/contexts/NotificationContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Enhanced Sidebar Toggle Component
function EnhancedSidebarToggle() {
  const { open, toggleSidebar, isMobile } = useSidebar();
  
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-8 w-8 p-0 hover:bg-accent transition-colors"
              data-testid="button-toggle-sidebar"
            >
              {isMobile ? (
                <Menu className="h-4 w-4" />
              ) : open ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {isMobile 
                ? "Toggle Menu" 
                : open 
                ? "Hide Sidebar (Ctrl+B)" 
                : "Show Sidebar (Ctrl+B)"
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Additional Label for Desktop */}
      {!isMobile && (
        <span className="text-xs text-muted-foreground hidden lg:inline-block">
          {open ? "Hide Panel" : "Show Panel"}
        </span>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin, isSuperAdmin } = useAuthSync();
  
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

  const handleLogout = async () => {
    console.log("🚀 Complete logout initiated...");
    
    // Sign out from Google OAuth to clear cached Google accounts
    try {
      signOutGoogle();
      console.log("✅ Google OAuth session cleared");
    } catch (error) {
      console.warn("⚠️ Google OAuth signOut failed:", error);
    }
    
    // Complete cache clearing for logout
    try {
      await CacheManager.clearLogoutCaches();
      console.log("✅ Complete logout cache clearing finished");
    } catch (error) {
      console.warn("⚠️ Cache clearing failed:", error);
    }
    
    // Clear local app session
    clearPWAAuth();
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userAuthChange'));
    
    // Force reload to ensure clean state
    setTimeout(() => {
      setLocation("/login");
    }, 100);
  };

  // Enhanced security check for admin access
  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, setLocation]);

  // Return early if not properly authenticated
  if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Admin authentication required</p>
          <Button onClick={() => setLocation("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Enhanced Header with Sync Status */}
          <header className="h-14 flex items-center justify-between border-b bg-card px-4">
            <div className="flex items-center space-x-4">
              <EnhancedSidebarToggle />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Canteen Control Panel</h1>
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
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'} - {user?.email}
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
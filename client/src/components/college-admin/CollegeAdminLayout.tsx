import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { CollegeAdminSidebar } from "./CollegeAdminSidebar";
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
import { UserRole } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CollegeAdminLayoutProps {
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

export default function CollegeAdminLayout({ children }: CollegeAdminLayoutProps) {
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

    const handleCloseNotifications = useCallback(() => {
        setShowNotifications(false);
    }, []);

    const handleMarkAsRead = useCallback((id: string) => {
        markAsRead(id);
    }, [markAsRead]);

    const handleMarkAllAsRead = useCallback(() => {
        markAllAsRead();
    }, [markAllAsRead]);

    // Fetch college details for the admin
    // Fetch college details for the admin
    const {
        data: collegeData,
        isLoading: isLoadingCollege,
        isError,
        error,
        status,
        fetchStatus
    } = useQuery({
        queryKey: ['/api/system-settings/admin/my-college'],
        queryFn: async () => {
            console.log("🚀 Initiating API fetch for my-college...");
            try {
                // Force cache bypass with timestamp
                const data = await apiRequest(`/api/system-settings/admin/my-college?_t=${Date.now()}`);
                console.log("🚀 College Admin Layout - Fetched Data:", data);
                return data;
            } catch (err) {
                console.error("🚀 API Fetch Error:", err);
                throw err;
            }
        },
        enabled: !!user?.email && (isAdmin || isSuperAdmin)
    });

    console.log("🚀 College Admin Layout - Render State:", {
        isLoadingCollege,
        collegeData,
        userEmail: user?.email,
        isAdmin,
        isError,
        error: error ? String(error) : null,
        status,
        fetchStatus
    });

    const handleLogout = async () => {
        console.log("🚀 Complete logout initiated...");

        // Sign out from Google OAuth to clear cached Google accounts
        try {
            signOutGoogle();
        } catch (error) {
            console.warn("⚠️ Google OAuth signOut failed:", error);
        }

        // Complete cache clearing for logout
        try {
            await CacheManager.clearLogoutCaches();
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

    // Security check for college admin access
    useEffect(() => {
        // Both ADMIN and SUPER_ADMIN can access, but primarily for ADMIN
        if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) {
            setLocation("/login");
            return;
        }
    }, [isAuthenticated, isAdmin, isSuperAdmin, setLocation]);

    if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) {
        return null; // Or loading spinner
    }

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background">
                <CollegeAdminSidebar />

                <div className="flex-1 flex flex-col">
                    {/* Enhanced Header with Sync Status */}
                    <header className="h-14 flex items-center justify-between border-b bg-card px-4">
                        <div className="flex items-center space-x-4">
                            <EnhancedSidebarToggle />
                            <div>
                                <h1 className="text-lg font-semibold text-foreground">
                                    {isLoadingCollege ? 'Loading...' : (collegeData?.college?.name || 'College Admin Portal')}
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
                                    {user?.role === UserRole.SUPER_ADMIN ? 'Super Admin' : 'College Admin'} - {user?.email}
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
                    <main className="flex-1 overflow-auto p-6">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}

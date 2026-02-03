import { useLocation, Link } from "wouter";
import {
    LayoutDashboard,
    Users,
    BarChart3,
    Settings,
    GraduationCap,
    Briefcase,
    FileText,
    Utensils
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
    { title: "Dashboard", url: "/college-admin", icon: LayoutDashboard },
    { title: "Canteens", url: "/college-admin/canteens", icon: Utensils },
    { title: "Reports", url: "/college-admin/reports", icon: BarChart3 },
];

const managementItems = [
    { title: "Students", url: "/college-admin/students", icon: GraduationCap },
    { title: "Staff", url: "/college-admin/staff", icon: Briefcase },
    { title: "All Users", url: "/college-admin/users", icon: Users },
];

const systemItems = [
    { title: "Settings", url: "/college-admin/settings", icon: Settings },
];

export function CollegeAdminSidebar() {
    const { state } = useSidebar();
    const [location] = useLocation();
    const currentPath = location;
    const collapsed = state === "collapsed";

    const isActive = (path: string) => currentPath === path;
    const getNavCls = ({ isActive }: { isActive: boolean }) =>
        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50"
        }`;

    const renderMenuGroup = (items: typeof mainItems, label: string) => (
        <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                                <Link
                                    href={item.url}
                                    className={getNavCls({ isActive: isActive(item.url) })}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {!collapsed && <span>{item.title}</span>}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );

    return (
        <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
            <SidebarContent className="py-4">
                {renderMenuGroup(mainItems, "Overview")}
                {renderMenuGroup(managementItems, "Management")}
                {renderMenuGroup(systemItems, "System")}
            </SidebarContent>
        </Sidebar>
    );
}

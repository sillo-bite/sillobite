import { useLocation, Link, useRoute } from "wouter";
import {
  LayoutDashboard,
  BarChart3,
  Menu,
  ShoppingCart,
  CreditCard,
  Bell,
  Star,
  Ticket,
  ArrowLeft,
  Utensils,
  Store,
  FileText
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

interface CanteenAdminSidebarProps {
  canteenName?: string;
}

const mainItems = [
  { title: "Overview", url: "", icon: LayoutDashboard },
  { title: "Analytics", url: "analytics", icon: BarChart3 },
];

const managementItems = [
  { title: "Menu Management", url: "menu", icon: Menu },
  { title: "Orders Management", url: "orders", icon: ShoppingCart },
  { title: "Payment Management", url: "payments", icon: CreditCard },
  { title: "Counter Management", url: "counters", icon: Store },
  { title: "Notification Management", url: "notifications", icon: Bell },
];

const contentItems = [
  { title: "Review Management", url: "reviews", icon: Star },
  { title: "Coupon Management", url: "coupons", icon: Ticket },
];

const contentManagementItems = [
  { title: "Content Management", url: "content", icon: FileText },
];

export function CanteenAdminSidebar({ canteenName }: CanteenAdminSidebarProps) {
  const { state } = useSidebar();
  const [location] = useLocation();
  const [match, params] = useRoute("/admin/canteen/:canteenId/:page?");
  const collapsed = state === "collapsed";
  
  const canteenId = params?.canteenId;

  const isActive = (path: string) => location === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
      isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50"
    }`;

  const renderMenuGroup = (items: typeof mainItems, label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel>{!collapsed && label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const href = item.url === "" 
              ? `/admin/canteen/${canteenId}` 
              : `/admin/canteen/${canteenId}/${item.url}`;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link 
                    href={href} 
                    className={getNavCls({ isActive: isActive(href) })}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="py-4">
        {/* Back to Admin */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link 
                    href="/admin/canteen-management" 
                    className={getNavCls({ isActive: false })}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {!collapsed && <span>Back to Canteens</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Canteen Info */}
        {!collapsed && canteenName && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-3 py-2 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Utensils className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{canteenName}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Canteen Admin Panel
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderMenuGroup(mainItems, "Dashboard")}
        {renderMenuGroup(managementItems, "Management")}
        {renderMenuGroup(contentItems, "Content")}
        {renderMenuGroup(contentManagementItems, "Content Management")}
      </SidebarContent>
    </Sidebar>
  );
}

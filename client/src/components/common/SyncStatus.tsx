import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useDataSync } from "@/hooks/useDataSync";

/**
 * Component to show real-time synchronization status
 * Displays across all dashboards to confirm data consistency
 */
export default function SyncStatus() {
  const { isLoading, hasError, stats, queries } = useDataSync();

  const getSyncStatus = () => {
    // Check for critical errors only (not analytics)
    const criticalError = queries.categories.error || queries.menuItems.error || queries.orders.error;
    
    if (criticalError) return { icon: WifiOff, text: "Sync Error", variant: "destructive" as const };
    if (isLoading) return { icon: RefreshCw, text: "Syncing...", variant: "secondary" as const };
    return { icon: Wifi, text: "Synced", variant: "default" as const };
  };

  const status = getSyncStatus();
  const Icon = status.icon;

  return (
    <div className="flex items-center space-x-2 text-xs">
      <Badge variant={status.variant} className="flex items-center space-x-1">
        <Icon className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        <span>{status.text}</span>
      </Badge>
      
      {status.variant !== "destructive" && !isLoading && (
        <div className="flex items-center space-x-1 text-muted-foreground">
          <span>{stats.totalMenuItems} items</span>
          <span>•</span>
          <span>{stats.totalCategories} categories</span>
          <span>•</span>
          <span>{stats.totalOrders} orders</span>
        </div>
      )}
    </div>
  );
}
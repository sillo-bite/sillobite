import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Zap, Star, Clock } from "lucide-react";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuItem } from "@shared/schema";
import OwnerCard from "@/components/owner/OwnerCard";

interface QuickPickConfigPanelProps {
  canteenId?: string;
}

export function QuickPickConfigPanel({ canteenId }: QuickPickConfigPanelProps) {
  const [activeInnerTab, setActiveInnerTab] = useState<"all" | "quickpicks" | "preview">("all");

  const { data: menuData, isLoading: menuItemsLoading } = useQuery<{
    items: MenuItem[];
    pagination: any;
  }>({
    queryKey: ["/api/menu", canteenId],
    queryFn: async () => {
      const url = canteenId
        ? `/api/menu?canteenId=${canteenId}&limit=1000`
        : '/api/menu?limit=1000';
      const response = await apiRequest(url);
      return response;
    },
    enabled: !!canteenId,
    staleTime: 1000 * 30,
    refetchOnMount: true,
  });

  const menuItems = menuData?.items || [];

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MenuItem> }) => {
      return apiRequest(`/api/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
    },
    onError: () => {
      // Handle error silently
    },
  });

  const handleToggleQuickPick = (menuItem: MenuItem) => {
    updateMenuItemMutation.mutate({
      id: menuItem.id,
      data: { isQuickPick: !menuItem.isQuickPick },
    });
  };

  const quickPickItems = menuItems.filter(item => item.isQuickPick);
  const availableItems = menuItems.filter(item => item.available);

  // Render content based on active inner tab
  const renderInnerTabContent = () => {
    if (activeInnerTab === "all") {
      if (availableItems.length === 0) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            No menu items available. Add some menu items first.
          </div>
        );
      }
      return (
        <div className="grid gap-3">
          {availableItems.map((item, index) => (
            <Card key={item.id || `item-${index}`} className="p-4 bg-card border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-foreground break-words">{item.name}</div>
                      {item.isQuickPick && (
                        <Badge variant="secondary" className="bg-accent text-accent-foreground border-border text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          Quick Pick
                        </Badge>
                      )}
                      {item.isTrending && (
                        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40 text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ₹{item.price} • Stock: {item.stock}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {item.isQuickPick ? "Quick Pick" : "Regular"}
                  </div>
                  <Switch
                    checked={item.isQuickPick}
                    onCheckedChange={() => handleToggleQuickPick(item)}
                    disabled={updateMenuItemMutation.isPending}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (activeInnerTab === "quickpicks") {
      if (quickPickItems.length === 0) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No quick pick items yet</p>
            <p className="text-sm mt-2">Toggle items in "All Items" to mark them as quick picks</p>
          </div>
        );
      }
      return (
        <div className="grid gap-3">
          {quickPickItems.map((item, index) => (
            <Card key={item.id || `quickpick-${index}`} className="p-4 bg-card border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-foreground break-words">{item.name}</div>
                      <Badge variant="secondary" className="bg-accent text-accent-foreground border-border text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Quick Pick
                      </Badge>
                      {item.isTrending && (
                        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40 text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ₹{item.price} • Stock: {item.stock}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Switch
                    checked={item.isQuickPick}
                    onCheckedChange={() => handleToggleQuickPick(item)}
                    disabled={updateMenuItemMutation.isPending}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    // Preview tab
    if (quickPickItems.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No quick pick items to preview</p>
          <p className="text-sm mt-2">Mark some items as quick picks to see the preview</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mb-3">
            This is how these items will appear in the "Quick Picks" section:
          </div>
          <div className="grid gap-3">
            {quickPickItems.map((item, index) => (
              <div key={item.id || `quickpick-${index}`} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                <div className="w-12 h-12 bg-primary rounded-lg flex-shrink-0 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-foreground break-words">{item.name}</div>
                    <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                    <Badge variant="secondary" className="bg-accent text-accent-foreground border-border text-xs">
                      ⚡ Quick Pick
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">Fast ordering available</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary">₹{item.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center p-4 bg-accent border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium text-foreground">Quick Pick Items</div>
              <div className="text-sm text-muted-foreground">
                {quickPickItems.length} items marked as quick picks
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-accent text-accent-foreground border-border">
            {quickPickItems.length} quick picks
          </Badge>
        </div>
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-warning mt-0.5">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">Quick Picks Tips</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Choose popular, fast-to-prepare items as quick picks</li>
                <li>• Keep quick picks limited to 5-8 items for better user experience</li>
                <li>• Ensure quick pick items are always in stock</li>
                <li>• Quick picks appear prominently on the home screen for faster ordering</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (menuItemsLoading) {
    return (
      <OwnerCard
        title="⚡ Quick Picks Configuration"
        description="Configure which menu items appear as Quick Picks for fast ordering."
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        contentClassName="flex-1 min-h-0 overflow-y-auto p-4 app-scrollbar"
      >
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading menu items...</div>
        </div>
      </OwnerCard>
    );
  }

  return (
    <OwnerCard
      title="⚡ Quick Picks Configuration"
      description="Configure which menu items appear as Quick Picks for fast ordering."
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      contentClassName="flex-1 flex flex-col min-h-0 overflow-hidden p-0"
    >
      {/* Inner Tabs */}
      <Tabs value={activeInnerTab} onValueChange={(v) => setActiveInnerTab(v as "all" | "quickpicks" | "preview")} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex-shrink-0 border-b border-border">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="all">
              All Items ({availableItems.length})
            </TabsTrigger>
            <TabsTrigger value="quickpicks">
              Quick Picks ({quickPickItems.length})
            </TabsTrigger>
            <TabsTrigger value="preview">
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Single shared scroll area */}
        <div className="cm-scroll-area flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-4 app-scrollbar">
          {renderInnerTabContent()}
        </div>
      </Tabs>
    </OwnerCard>
  );
}

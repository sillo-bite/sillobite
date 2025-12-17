import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Flame, Star } from "lucide-react";
import { VegIndicator } from "@/components/ui/VegIndicator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuItem } from "@shared/schema";

interface TrendingItemsManagerProps {
  canteenId?: string;
  noCardWrapper?: boolean;
}

export function TrendingItemsManager({ canteenId, noCardWrapper = false }: TrendingItemsManagerProps) {
  const { data: menuData, isLoading: menuItemsLoading } = useQuery<{
    items: MenuItem[];
    pagination: any;
  }>({
    queryKey: ["/api/menu", canteenId],
    queryFn: async () => {
      const url = canteenId 
        ? `/api/menu?canteenId=${canteenId}&limit=1000` // Get all items for trending management
        : '/api/menu?limit=1000';
      const response = await apiRequest(url);
      return response;
    },
    enabled: !!canteenId, // Only run when canteenId is available
    staleTime: 1000 * 30,
    refetchOnMount: true,
  });

  const menuItems = menuData?.items || [];

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItem> }) => {
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
      },
  });

  const handleToggleTrending = (menuItem: MenuItem) => {
    updateMenuItemMutation.mutate({
      id: menuItem.id,
      data: { isTrending: !menuItem.isTrending },
    });
  };

  const trendingItems = menuItems.filter(item => item.isTrending);
  const availableItems = menuItems.filter(item => item.available);

  if (menuItemsLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Flame className="w-5 h-5 text-primary" />
            Trending Items Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading menu items...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Flame className="w-5 h-5 text-primary" />
          Trending Items Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure which menu items appear in the "Trending Now" section on users' home page.
          Simply toggle the trending status for any menu item.
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="all">All Items ({availableItems.length})</TabsTrigger>
              <TabsTrigger value="trending">Trending ({trendingItems.length})</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="flex-1 flex flex-col min-h-0 px-4 pb-4 mt-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 app-scrollbar">
              {availableItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No menu items available. Add some menu items first.
                </div>
              ) : (
                <div className="grid gap-3">
                  {availableItems.map((item, index) => (
                    <Card key={item.id || `item-${index}`} className="p-4 bg-card border-border">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-foreground break-words">{item.name}</div>
                              {item.isTrending && (
                                <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40 text-xs">
                                  <Flame className="w-3 h-3 mr-1" />
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
                            {item.isTrending ? "Trending" : "Not trending"}
                          </div>
                          <Switch
                            checked={item.isTrending}
                            onCheckedChange={() => handleToggleTrending(item)}
                            disabled={updateMenuItemMutation.isPending}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trending" className="flex-1 flex flex-col min-h-0 px-4 pb-4 mt-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 app-scrollbar">
              {trendingItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Flame className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No trending items yet</p>
                  <p className="text-sm mt-2">Toggle items in "All Items" to mark them as trending</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {trendingItems.map((item, index) => (
                    <Card key={item.id || `trending-${index}`} className="p-4 bg-card border-border">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-foreground break-words">{item.name}</div>
                              <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40 text-xs">
                                <Flame className="w-3 h-3 mr-1" />
                                Trending
                              </Badge>
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
                            checked={item.isTrending}
                            onCheckedChange={() => handleToggleTrending(item)}
                            disabled={updateMenuItemMutation.isPending}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 flex flex-col min-h-0 px-4 pb-4 mt-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 app-scrollbar">
              {trendingItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No trending items to preview</p>
                  <p className="text-sm mt-2">Mark some items as trending to see the preview</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-muted rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-3">
                      This is how these items will appear in the "Trending Now" section:
                    </div>
                    <div className="grid gap-3">
                      {trendingItems.map((item, index) => (
                        <div key={item.id || `trending-${index}`} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                          <div className="w-12 h-12 bg-primary rounded-lg flex-shrink-0 flex items-center justify-center">
                            <Flame className="w-6 h-6 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-foreground break-words">{item.name}</div>
                              <VegIndicator isVegetarian={item.isVegetarian} size="sm" />
                              <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40 text-xs">
                                🔥 Trending
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">Available now</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary">₹{item.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-warning/10 border border-warning/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-warning" />
                      <div>
                        <div className="font-medium text-foreground">Currently Trending</div>
                        <div className="text-sm text-muted-foreground">
                          {trendingItems.length} items marked as trending
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/40">
                      {trendingItems.length} trending
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );

  if (noCardWrapper) {
    return content;
  }

  return <Card className="bg-card border-border">{content}</Card>;
}
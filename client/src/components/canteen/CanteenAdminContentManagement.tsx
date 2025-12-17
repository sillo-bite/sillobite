import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Code, Save, Shield, HandCoins, Truck } from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";

interface CanteenAdminContentManagementProps {
  canteenId: string;
}

export default function CanteenAdminContentManagement({ canteenId }: CanteenAdminContentManagementProps) {
  const { user } = useAuthSync();
  const queryClient = useQueryClient();
  const [codingChallengesEnabled, setCodingChallengesEnabled] = useState(false);
  const [payAtCounterEnabled, setPayAtCounterEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const ownerSidebarDefaults = {
    overview: true,
    counters: true,
    orders: true,
    "payment-counter": true,
    "pos-billing": true,
    menu: true,
    content: true,
    analytics: true,
    "delivery-management": true,
    payout: true,
    "position-bidding": true,
    "store-mode": true
  };
  const ownerSidebarItems = [
    { key: "overview", label: "Overview" },
    { key: "counters", label: "Counter Selection" },
    { key: "orders", label: "Orders" },
    { key: "payment-counter", label: "Payment Counter" },
    { key: "pos-billing", label: "POS Billing" },
    { key: "menu", label: "Menu Management" },
    { key: "content", label: "Content Manager" },
    { key: "analytics", label: "Analytics" },
    { key: "delivery-management", label: "Delivery Management" },
    { key: "payout", label: "Payout" },
    { key: "position-bidding", label: "Bid for Position" },
    { key: "store-mode", label: "Store Mode" },
  ];
  const [ownerSidebarConfig, setOwnerSidebarConfig] = useState<Record<string, boolean>>(ownerSidebarDefaults);

  // Fetch current canteen settings
  const { data: canteenData, isLoading } = useQuery({
    queryKey: ['/api/system-settings/canteens', canteenId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${canteenId}`),
    enabled: !!canteenId,
  });

  // Update local state when canteen data loads
  useEffect(() => {
    if (canteenData) {
      setCodingChallengesEnabled(canteenData.codingChallengesEnabled ?? false);
      setPayAtCounterEnabled(canteenData.payAtCounterEnabled ?? true);
      setDeliveryEnabled(canteenData.deliveryEnabled ?? true);
      // Only overwrite sidebar config when server explicitly provides it
      if (canteenData.ownerSidebarConfig) {
        setOwnerSidebarConfig({
          ...ownerSidebarDefaults,
          ...(canteenData.ownerSidebarConfig || {})
        });
      }
    }
  }, [canteenData]);

  // Mutation to update content settings
  const updateContentSettingsMutation = useMutation({
    mutationFn: async (settings: { codingChallengesEnabled?: boolean; ownerSidebarConfig?: Record<string, boolean>; payAtCounterEnabled?: boolean; deliveryEnabled?: boolean }) => {
      return apiRequest(`/api/system-settings/canteens/${canteenId}/content-settings`, {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens', canteenId] });
      queryClient.invalidateQueries({ queryKey: ['home-data'] });
    },
  });

  const handleToggleCodingChallenges = (enabled: boolean) => {
    setCodingChallengesEnabled(enabled);
    updateContentSettingsMutation.mutate({ codingChallengesEnabled: enabled });
  };

  const handleTogglePayAtCounter = (enabled: boolean) => {
    setPayAtCounterEnabled(enabled);
    updateContentSettingsMutation.mutate({ payAtCounterEnabled: enabled });
  };

  const handleToggleDelivery = (enabled: boolean) => {
    setDeliveryEnabled(enabled);
    updateContentSettingsMutation.mutate({ deliveryEnabled: enabled });
  };

  const handleToggleSidebarItem = (key: string, enabled: boolean) => {
    const nextConfig = { ...ownerSidebarConfig, [key]: enabled };
    setOwnerSidebarConfig(nextConfig);
    updateContentSettingsMutation.mutate({ ownerSidebarConfig: nextConfig });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage content features and visibility for your canteen
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Code className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Coding Challenges</CardTitle>
              <CardDescription>
                Enable or disable the coding challenges feature for users
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="coding-challenges-toggle" className="text-base">
                Enable Coding Challenges
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, users will see the coding challenges feature on the home screen.
                When disabled, the feature will be hidden from users.
              </p>
            </div>
            <Switch
              id="coding-challenges-toggle"
              checked={codingChallengesEnabled}
              onCheckedChange={handleToggleCodingChallenges}
              disabled={updateContentSettingsMutation.isPending}
            />
          </div>
          
          {updateContentSettingsMutation.isPending && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving changes...</span>
            </div>
          )}
          
          {updateContentSettingsMutation.isSuccess && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <span>✓ Settings saved successfully</span>
            </div>
          )}
          
          {updateContentSettingsMutation.isError && (
            <div className="flex items-center space-x-2 text-sm text-red-600">
              <span>✗ Failed to save settings. Please try again.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <HandCoins className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Pay at Counter</CardTitle>
              <CardDescription>
                Control whether users can choose pay-at-counter during checkout
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pay-at-counter-toggle" className="text-base">
                Enable Pay at Counter
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, the offline pay-at-counter option is hidden at checkout.
              </p>
            </div>
            <Switch
              id="pay-at-counter-toggle"
              checked={payAtCounterEnabled}
              onCheckedChange={handleTogglePayAtCounter}
              disabled={updateContentSettingsMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Truck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Delivery Orders</CardTitle>
              <CardDescription>
                Control whether users can place delivery orders for this canteen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="delivery-toggle" className="text-base">
                Enable Delivery
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, the delivery order type is hidden at checkout.
              </p>
            </div>
            <Switch
              id="delivery-toggle"
              checked={deliveryEnabled}
              onCheckedChange={handleToggleDelivery}
              disabled={updateContentSettingsMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Canteen Owner Dashboard</CardTitle>
              <CardDescription>
                Choose which sidebar items the canteen owner can see and use
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownerSidebarItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between border rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">Toggle visibility on owner dashboard</p>
                </div>
                <Switch
                  checked={ownerSidebarConfig[item.key] ?? true}
                  onCheckedChange={(checked) => handleToggleSidebarItem(item.key, checked)}
                  disabled={updateContentSettingsMutation.isPending}
                />
              </div>
            ))}
          </div>
          {updateContentSettingsMutation.isPending && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving changes...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}















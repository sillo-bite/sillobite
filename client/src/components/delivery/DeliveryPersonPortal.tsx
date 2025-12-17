import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Truck, 
  LogOut,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import DeliveryHome from "./DeliveryHome";
import DeliveryProfile from "./DeliveryProfile";
import DeliveryEarnings from "./DeliveryEarnings";
import DeliveryBottomNavigation from "./DeliveryBottomNavigation";

export default function DeliveryPersonPortal() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<"home" | "profile" | "earnings">("home");

  // Get delivery person info by email
  const { data: deliveryPerson, isLoading: personLoading } = useQuery({
    queryKey: [`/api/delivery-persons/by-email/${user?.email}`],
    queryFn: async () => {
      if (!user?.email) return null;
      return apiRequest(`/api/delivery-persons/by-email/${user.email}`);
    },
    enabled: !!user?.email,
  });

  // Note: Orders query is handled in DeliveryHome component to avoid duplicate queries

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      setLocation("/login");
    }
  };

  const handleTabChange = (tab: "home" | "profile" | "earnings") => {
    setCurrentTab(tab);
    // Scroll to top when changing tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = () => {
    // Invalidate queries to trigger refetch in all components using this query
    queryClient.invalidateQueries({ queryKey: [`/api/delivery-persons/by-email/${user?.email}/orders`] });
  };

  if (personLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!deliveryPerson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Delivery Person Not Found</h2>
            <p className="text-muted-foreground mb-4">
              Your account is not associated with a delivery person profile.
            </p>
            <Button onClick={handleLogout}>Log Out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Truck className="w-6 h-6" />
            <h1 className="text-xl font-bold">Delivery Portal</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span>{deliveryPerson.name}</span>
          <span className="opacity-75">•</span>
          <span className="opacity-75">{deliveryPerson.deliveryPersonId}</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {currentTab === "home" && (
          <DeliveryHome 
            deliveryPerson={deliveryPerson} 
            onRefresh={handleRefresh}
          />
        )}
        {currentTab === "profile" && (
          <DeliveryProfile 
            deliveryPerson={deliveryPerson}
            user={user}
          />
        )}
        {currentTab === "earnings" && (
          <DeliveryEarnings 
            deliveryPerson={deliveryPerson}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <DeliveryBottomNavigation 
        currentTab={currentTab}
        onNavigate={handleTabChange}
      />
    </div>
  );
}


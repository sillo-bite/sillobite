import { ChefHat } from "lucide-react";
import RestaurantInfoManager from "./RestaurantInfoManager";

export default function RestaurantManagementPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <ChefHat className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Restaurant Management</h1>
      </div>

      <RestaurantInfoManager />
    </div>
  );
}

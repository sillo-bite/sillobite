import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Save, X, Table, MapPin, Users, Building, Wifi, Eye, EyeOff } from "lucide-react";
import { RestaurantTable, InsertRestaurantTable, Restaurant, RestaurantEmployee } from "@shared/schema";
import { insertRestaurantTableSchema } from "@shared/schema";

export default function TableManager() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<RestaurantEmployee[]>([]);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [formData, setFormData] = useState<Partial<InsertRestaurantTable>>({
    restaurantId: "",
    tableNumber: "",
    floor: 1,
    location: "",
    seatingCapacity: 4,
    tableType: "regular",
    isAccessible: false,
    assignedWaiter: "",
    assignedHost: "",
    status: "available",
    specialFeatures: [],
    isActive: true
  });

  const [newSpecialFeature, setNewSpecialFeature] = useState("");

  const tableTypes = [
    { value: "regular", label: "Regular" },
    { value: "booth", label: "Booth" },
    { value: "bar", label: "Bar" },
    { value: "outdoor", label: "Outdoor" },
    { value: "private", label: "Private" },
    { value: "family", label: "Family" }
  ];

  const tableStatuses = [
    { value: "available", label: "Available", color: "bg-green-100 text-green-800" },
    { value: "occupied", label: "Occupied", color: "bg-red-100 text-red-800" },
    { value: "reserved", label: "Reserved", color: "bg-yellow-100 text-yellow-800" },
    { value: "maintenance", label: "Maintenance", color: "bg-orange-100 text-orange-800" },
    { value: "cleaning", label: "Cleaning", color: "bg-blue-100 text-blue-800" }
  ];

  const commonSpecialFeatures = [
    "TV", "Power Outlet", "View", "Window Seat", "Quiet Area", "High Chair Available",
    "Wheelchair Accessible", "Private Space", "Outdoor Seating", "Bar View",
    "Kitchen View", "Garden View", "Street View", "Pool View", "Music System"
  ];

  useEffect(() => {
    fetchRestaurants();
    fetchEmployees();
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchTables(selectedRestaurant);
      fetchEmployees(selectedRestaurant);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch("/api/admin/restaurants");
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data);
      }
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    }
  };

  const fetchEmployees = async (restaurantId?: string) => {
    try {
      const url = restaurantId 
        ? `/api/admin/restaurants/${restaurantId}/employees`
        : "/api/admin/employees";
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchTables = async (restaurantId?: string) => {
    try {
      setLoading(true);
      const url = restaurantId 
        ? `/api/admin/restaurants/${restaurantId}/tables`
        : "/api/admin/tables";
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Ensure we have a valid restaurant ID
      if (!formData.restaurantId || formData.restaurantId === "all") {
        throw new Error("Please select a restaurant");
      }
      
      // Convert "none" values back to empty strings for the API
      const dataToSave = {
        ...formData,
        assignedWaiter: formData.assignedWaiter === "none" ? "" : formData.assignedWaiter,
        assignedHost: formData.assignedHost === "none" ? "" : formData.assignedHost
      };
      
      const validatedData = insertRestaurantTableSchema.parse(dataToSave);
      
      const url = editingTable 
        ? `/api/admin/tables/${editingTable.id}`
        : "/api/admin/tables";
      
      const method = editingTable ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData)
      });

      if (response.ok) {
        await fetchTables(selectedRestaurant);
        resetForm();
      }
    } catch (error) {
      console.error("Error saving table:", error);
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    
    try {
      const response = await fetch(`/api/admin/tables/${tableId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await fetchTables(selectedRestaurant);
      }
    } catch (error) {
      console.error("Error deleting table:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      restaurantId: selectedRestaurant && selectedRestaurant !== "all" ? selectedRestaurant : "",
      tableNumber: "",
      floor: 1,
      location: "",
      seatingCapacity: 4,
      tableType: "regular",
      isAccessible: false,
      assignedWaiter: "none",
      assignedHost: "none",
      status: "available",
      specialFeatures: [],
      isActive: true
    });
    setEditingTable(null);
    setIsAddingNew(false);
    setNewSpecialFeature("");
  };

  const startEdit = (table: RestaurantTable) => {
    setFormData({
      restaurantId: table.restaurantId,
      tableNumber: table.tableNumber,
      floor: table.floor,
      location: table.location,
      seatingCapacity: table.seatingCapacity,
      tableType: table.tableType,
      isAccessible: table.isAccessible,
      assignedWaiter: table.assignedWaiter || "none",
      assignedHost: table.assignedHost || "none",
      status: table.status,
      specialFeatures: table.specialFeatures || [],
      isActive: table.isActive
    });
    setEditingTable(table);
    setIsAddingNew(false);
  };

  const addSpecialFeature = () => {
    if (newSpecialFeature.trim() && !formData.specialFeatures?.includes(newSpecialFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        specialFeatures: [...(prev.specialFeatures || []), newSpecialFeature.trim()]
      }));
      setNewSpecialFeature("");
    }
  };

  const removeSpecialFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      specialFeatures: prev.specialFeatures?.filter(f => f !== feature) || []
    }));
  };

  const getTableTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      regular: "bg-blue-100 text-blue-800",
      booth: "bg-purple-100 text-purple-800",
      bar: "bg-orange-100 text-orange-800",
      outdoor: "bg-green-100 text-green-800",
      private: "bg-pink-100 text-pink-800",
      family: "bg-yellow-100 text-yellow-800"
    };
    return colors[type] || colors.regular;
  };

  const getStatusColor = (status: string) => {
    const statusObj = tableStatuses.find(s => s.value === status);
    return statusObj?.color || "bg-gray-100 text-gray-800";
  };

  const filteredTables = selectedRestaurant && selectedRestaurant !== "all"
    ? tables.filter(table => table.restaurantId === selectedRestaurant)
    : tables;

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Table Management</h2>
        <Button 
          onClick={() => setIsAddingNew(true)} 
          className="flex items-center space-x-2"
          disabled={!selectedRestaurant || selectedRestaurant === "all"}
        >
          <Plus className="h-4 w-4" />
          <span>Add Table</span>
        </Button>
      </div>

      {/* Restaurant Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="restaurant-filter">Filter by Restaurant:</Label>
            <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a restaurant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Restaurants</SelectItem>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table List */}
      {!isAddingNew && !editingTable && (
        <div className="grid gap-4">
          {filteredTables.map((table) => (
            <Card key={table.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-semibold">Table {table.tableNumber}</h3>
                      <Badge variant={table.isActive ? "default" : "secondary"}>
                        {table.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge className={getStatusColor(table.status)}>
                        {tableStatuses.find(s => s.value === table.status)?.label || table.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Building className="h-4 w-4" />
                        <span>Floor {table.floor}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{table.location}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{table.seatingCapacity} seats</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTableTypeColor(table.tableType)}>
                        {tableTypes.find(t => t.value === table.tableType)?.label || table.tableType}
                      </Badge>
                      {table.isAccessible && (
                        <Badge variant="outline" className="text-green-600">
                          <Eye className="h-3 w-3 mr-1" />
                          Accessible
                        </Badge>
                      )}
                    </div>
                    {table.assignedWaiter && (
                      <div className="text-sm text-muted-foreground">
                        Waiter: {getEmployeeName(table.assignedWaiter)}
                      </div>
                    )}
                    {table.assignedHost && (
                      <div className="text-sm text-muted-foreground">
                        Host: {getEmployeeName(table.assignedHost)}
                      </div>
                    )}
                    {table.specialFeatures && table.specialFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {table.specialFeatures.slice(0, 3).map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {table.specialFeatures.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{table.specialFeatures.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(table)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(table.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAddingNew || editingTable) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTable ? "Edit Table" : "Add New Table"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableNumber">Table Number *</Label>
                <Input
                  id="tableNumber"
                  value={formData.tableNumber || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
                  placeholder="Enter table number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">Floor *</Label>
                <Input
                  id="floor"
                  type="number"
                  min="1"
                  value={formData.floor || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Near window, Center, Private booth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seatingCapacity">Seating Capacity *</Label>
                <Input
                  id="seatingCapacity"
                  type="number"
                  min="1"
                  value={formData.seatingCapacity || 4}
                  onChange={(e) => setFormData(prev => ({ ...prev, seatingCapacity: parseInt(e.target.value) || 4 }))}
                />
              </div>
            </div>

            {/* Restaurant Selection */}
            <div className="space-y-2">
              <Label htmlFor="restaurantId">Restaurant *</Label>
              <Select
                value={formData.restaurantId || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, restaurantId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table Type and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableType">Table Type *</Label>
                <Select
                  value={formData.tableType || "regular"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tableType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tableTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status || "available"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tableStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Employee Assignments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignedWaiter">Assigned Waiter</Label>
                <Select
                  value={formData.assignedWaiter || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedWaiter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select waiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No waiter assigned</SelectItem>
                    {employees
                      .filter(emp => emp.role === "waiter" && emp.isActive)
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedHost">Assigned Host</Label>
                <Select
                  value={formData.assignedHost || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedHost: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select host" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No host assigned</SelectItem>
                    {employees
                      .filter(emp => emp.role === "host" && emp.isActive)
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Special Features */}
            <div className="space-y-4">
              <Label>Special Features</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.specialFeatures?.map((feature) => (
                  <Badge key={feature} variant="secondary" className="flex items-center space-x-1">
                    <span>{feature}</span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeSpecialFeature(feature)} />
                  </Badge>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newSpecialFeature}
                  onChange={(e) => setNewSpecialFeature(e.target.value)}
                  placeholder="Add special feature"
                  onKeyPress={(e) => e.key === "Enter" && addSpecialFeature()}
                />
                <Button onClick={addSpecialFeature} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {commonSpecialFeatures.map((feature) => (
                  <Button
                    key={feature}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!formData.specialFeatures?.includes(feature)) {
                        setFormData(prev => ({
                          ...prev,
                          specialFeatures: [...(prev.specialFeatures || []), feature]
                        }));
                      }
                    }}
                    disabled={formData.specialFeatures?.includes(feature)}
                  >
                    {feature}
                  </Button>
                ))}
              </div>
            </div>

            {/* Accessibility and Status */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isAccessible"
                  checked={formData.isAccessible || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAccessible: checked }))}
                />
                <Label htmlFor="isAccessible">Wheelchair Accessible</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active Table</Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex items-center space-x-2">
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

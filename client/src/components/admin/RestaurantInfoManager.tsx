import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TimePicker } from "@/components/ui/time-picker";
import QRCodeDisplay from "@/components/ui/qr-code-display";
import { Plus, Edit, Save, X, Upload, MapPin, Phone, Mail, Globe, Clock, Users, Building, ChefHat } from "lucide-react";
import { Restaurant, InsertRestaurant, RestaurantEmployee, InsertRestaurantEmployee, RestaurantTable, InsertRestaurantTable } from "@shared/schema";
import { insertRestaurantSchema, insertRestaurantEmployeeSchema, insertRestaurantTableSchema } from "@shared/schema";

export default function RestaurantInfoManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [restaurantEmployees, setRestaurantEmployees] = useState<RestaurantEmployee[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<RestaurantEmployee | null>(null);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertRestaurant>>({
    name: "",
    description: "",
    address: "",
    contactNumber: "",
    email: "",
    website: "",
    totalFloors: 1,
    totalKitchens: 1,
    totalSeatingCapacity: 50,
    operatingHours: {
      open: "09:00",
      close: "22:00",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    amenities: [],
    cuisineTypes: [],
    priceRange: "moderate",
    hasParking: false,
    hasWifi: false,
    hasDelivery: false,
    hasTakeaway: false,
    hasDineIn: true,
    isActive: true
  });

  const [newAmenity, setNewAmenity] = useState("");
  const [newCuisineType, setNewCuisineType] = useState("");
  
  // Employee form data
  const [employeeFormData, setEmployeeFormData] = useState<Partial<InsertRestaurantEmployee>>({
    restaurantId: "",
    name: "",
    email: "",
    phoneNumber: "",
    employeeId: "",
    role: "waiter",
    department: "service",
    shift: "morning",
    salary: undefined,
    hireDate: new Date(),
    isActive: true,
    assignedTables: []
  });
  
  // Table form data
  const [tableFormData, setTableFormData] = useState<Partial<InsertRestaurantTable>>({
    restaurantId: "",
    tableNumber: "",
    floor: 1,
    location: "",
    seatingCapacity: 4,
    tableType: "regular",
    isAccessible: false,
    assignedWaiter: "none",
    assignedHost: "none",
    assignedBartender: "none",
    assignedBusser: "none",
    assignedCleaner: "none",
    assignedSecurity: "none",
    status: "available",
    specialFeatures: [],
    isActive: true,
    qrCodeUrl: ""
  });
  
  const [newSpecialFeature, setNewSpecialFeature] = useState("");
  const [customShiftStart, setCustomShiftStart] = useState("");
  const [customShiftEnd, setCustomShiftEnd] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');

  const commonAmenities = [
    "Parking", "WiFi", "Air Conditioning", "Outdoor Seating", "Bar", "Live Music",
    "Private Dining", "Wheelchair Accessible", "Pet Friendly", "Valet Parking",
    "Takeout", "Delivery", "Catering", "Event Space", "Kids Menu"
  ];

  const commonCuisineTypes = [
    "Italian", "Chinese", "Indian", "Mexican", "Japanese", "Thai", "French",
    "American", "Mediterranean", "Korean", "Vietnamese", "Spanish", "Greek",
    "Lebanese", "Turkish", "Fusion", "Vegetarian", "Vegan", "Seafood", "Steakhouse"
  ];

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantEmployees(selectedRestaurant.id);
      fetchRestaurantTables(selectedRestaurant.id);
    }
  }, [selectedRestaurant]);

  // Update form data when editingRestaurant changes
  useEffect(() => {
    if (editingRestaurant) {
      console.log("Editing restaurant changed, updating form data:", editingRestaurant);
      setFormData({
        name: editingRestaurant.name,
        description: editingRestaurant.description || "",
        address: editingRestaurant.address,
        contactNumber: editingRestaurant.contactNumber,
        email: editingRestaurant.email || "",
        website: editingRestaurant.website || "",
        totalFloors: editingRestaurant.totalFloors,
        totalKitchens: editingRestaurant.totalKitchens,
        totalSeatingCapacity: editingRestaurant.totalSeatingCapacity,
        operatingHours: editingRestaurant.operatingHours,
        amenities: editingRestaurant.amenities,
        cuisineTypes: editingRestaurant.cuisineTypes,
        priceRange: editingRestaurant.priceRange,
        hasParking: editingRestaurant.hasParking,
        hasWifi: editingRestaurant.hasWifi,
        hasDelivery: editingRestaurant.hasDelivery,
        hasTakeaway: editingRestaurant.hasTakeaway,
        hasDineIn: editingRestaurant.hasDineIn,
        isActive: editingRestaurant.isActive
      });
    }
  }, [editingRestaurant]);


  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/restaurants");
      if (response.ok) {
        const data = await response.json();
        // Transform MongoDB _id to id for frontend compatibility
        const transformedData = data.map((restaurant: any) => ({
          ...restaurant,
          id: restaurant._id,
          createdAt: new Date(restaurant.createdAt),
          updatedAt: new Date(restaurant.updatedAt),
          // Ensure all required fields are present with defaults
          amenities: restaurant.amenities || [],
          cuisineTypes: restaurant.cuisineTypes || [],
          operatingHours: restaurant.operatingHours || {
            open: "09:00",
            close: "22:00",
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
          }
        }));
        setRestaurants(transformedData);
      }
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantEmployees = async (restaurantId: string) => {
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/employees`);
      if (response.ok) {
        const data = await response.json();
        // Transform MongoDB _id to id for frontend compatibility
        const transformedData = data.map((employee: any) => ({
          ...employee,
          id: employee._id,
          hireDate: new Date(employee.hireDate),
          createdAt: new Date(employee.createdAt),
          updatedAt: new Date(employee.updatedAt)
        }));
        setRestaurantEmployees(transformedData);
      }
    } catch (error) {
      console.error("Error fetching restaurant employees:", error);
    }
  };

  const fetchRestaurantTables = async (restaurantId: string) => {
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/tables`);
      if (response.ok) {
        const data = await response.json();
        // Transform MongoDB _id to id for frontend compatibility
        const transformedData = data.map((table: any) => ({
          ...table,
          id: table._id,
          createdAt: new Date(table.createdAt),
          updatedAt: new Date(table.updatedAt)
        }));
        setRestaurantTables(transformedData);
      }
    } catch (error) {
      console.error("Error fetching restaurant tables:", error);
    }
  };

  const handleSave = async () => {
    try {
      // Clean up empty strings to undefined for optional fields
      const cleanedData = {
        ...formData,
        email: formData.email?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        description: formData.description?.trim() || undefined
      };
      
      const validatedData = insertRestaurantSchema.parse(cleanedData);
      
      const url = editingRestaurant 
        ? `/api/admin/restaurants/${editingRestaurant.id}`
        : "/api/admin/restaurants";
      
      const method = editingRestaurant ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData)
      });

      if (response.ok) {
        await fetchRestaurants();
        resetForm();
      }
    } catch (error) {
      console.error("Error saving restaurant:", error);
    }
  };

  const handleDelete = async (restaurantId: string) => {
    if (!confirm("Are you sure you want to delete this restaurant?")) return;
    
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await fetchRestaurants();
      }
    } catch (error) {
      console.error("Error deleting restaurant:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      address: "",
      contactNumber: "",
      email: "",
      website: "",
      totalFloors: 1,
      totalKitchens: 1,
      totalSeatingCapacity: 50,
      operatingHours: {
        open: "09:00",
        close: "22:00",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      },
      amenities: [],
      cuisineTypes: [],
      priceRange: "moderate",
      hasParking: false,
      hasWifi: false,
      hasDelivery: false,
      hasTakeaway: false,
      hasDineIn: true,
      isActive: true
    });
    setEditingRestaurant(null);
    setIsAddingNew(false);
    setNewAmenity("");
    setNewCuisineType("");
  };

  // Employee management functions
  const handleSaveEmployee = async () => {
    try {
      if (!selectedRestaurant) {
        throw new Error("Please select a restaurant first");
      }
      
      // Prepare data with custom shift timing if applicable
      const employeeData = {
        ...employeeFormData,
        restaurantId: selectedRestaurant.id
      };
      
      // Add custom shift timing if shift is custom
      if (employeeFormData.shift === "custom") {
        (employeeData as any).customShiftStart = customShiftStart;
        (employeeData as any).customShiftEnd = customShiftEnd;
      }
      
      const validatedData = insertRestaurantEmployeeSchema.parse(employeeData);
      
      const url = editingEmployee 
        ? `/api/admin/employees/${editingEmployee.id}`
        : "/api/admin/employees";
      
      const method = editingEmployee ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData)
      });

      if (response.ok) {
        await fetchRestaurantEmployees(selectedRestaurant.id);
        resetEmployeeForm();
      }
    } catch (error) {
      console.error("Error saving employee:", error);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: "DELETE"
      });

      if (response.ok && selectedRestaurant) {
        await fetchRestaurantEmployees(selectedRestaurant.id);
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeFormData({
      restaurantId: selectedRestaurant?.id || "",
      name: "",
      email: "",
      phoneNumber: "",
      employeeId: "",
      role: "waiter",
      department: "service",
      shift: "morning",
      salary: undefined,
      hireDate: new Date(),
      isActive: true,
      assignedTables: []
    });
    setCustomShiftStart("");
    setCustomShiftEnd("");
    setEditingEmployee(null);
    setIsAddingEmployee(false);
    setIsEmployeeDialogOpen(false);
  };

  const startEditEmployee = (employee: RestaurantEmployee) => {
    setEmployeeFormData({
      restaurantId: employee.restaurantId,
      name: employee.name,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
      employeeId: employee.employeeId,
      role: employee.role,
      department: employee.department,
      shift: employee.shift,
      salary: employee.salary,
      hireDate: new Date(employee.hireDate),
      isActive: employee.isActive,
      assignedTables: employee.assignedTables || []
    });
    
    // Handle custom shift timing if it exists
    if (employee.shift === "custom" && (employee as any).customShiftStart && (employee as any).customShiftEnd) {
      setCustomShiftStart((employee as any).customShiftStart);
      setCustomShiftEnd((employee as any).customShiftEnd);
    } else {
      setCustomShiftStart("");
      setCustomShiftEnd("");
    }
    
    setEditingEmployee(employee);
    setIsAddingEmployee(false);
    setIsEmployeeDialogOpen(true);
  };

  // Table management functions
  const handleSaveTable = async () => {
    try {
      if (!selectedRestaurant) {
        throw new Error("Please select a restaurant first");
      }
      
      const dataToSave = {
        ...tableFormData,
        restaurantId: selectedRestaurant.id,
        assignedWaiter: tableFormData.assignedWaiter === "none" ? "" : tableFormData.assignedWaiter,
        assignedHost: tableFormData.assignedHost === "none" ? "" : tableFormData.assignedHost
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
        await fetchRestaurantTables(selectedRestaurant.id);
        resetTableForm();
      }
    } catch (error) {
      console.error("Error saving table:", error);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    
    try {
      const response = await fetch(`/api/admin/tables/${tableId}`, {
        method: "DELETE"
      });

      if (response.ok && selectedRestaurant) {
        await fetchRestaurantTables(selectedRestaurant.id);
      }
    } catch (error) {
      console.error("Error deleting table:", error);
    }
  };

  const resetTableForm = () => {
    setTableFormData({
      restaurantId: selectedRestaurant?.id || "",
      tableNumber: "",
      floor: 1,
      location: "",
      seatingCapacity: 4,
      tableType: "regular",
      isAccessible: false,
      assignedWaiter: "none",
      assignedHost: "none",
      assignedBartender: "none",
      assignedBusser: "none",
      assignedCleaner: "none",
      assignedSecurity: "none",
      status: "available",
      specialFeatures: [],
      isActive: true,
      qrCodeUrl: ""
    });
    setEditingTable(null);
    setIsAddingTable(false);
    setNewSpecialFeature("");
    setIsTableDialogOpen(false);
  };

  const startEditTable = (table: RestaurantTable) => {
    setTableFormData({
      restaurantId: table.restaurantId,
      tableNumber: table.tableNumber,
      floor: table.floor,
      location: table.location,
      seatingCapacity: table.seatingCapacity,
      tableType: table.tableType,
      isAccessible: table.isAccessible,
      assignedWaiter: table.assignedWaiter || "none",
      assignedHost: table.assignedHost || "none",
      assignedBartender: table.assignedBartender || "none",
      assignedBusser: table.assignedBusser || "none",
      assignedCleaner: table.assignedCleaner || "none",
      assignedSecurity: table.assignedSecurity || "none",
      status: table.status,
      specialFeatures: table.specialFeatures || [],
      isActive: table.isActive,
      qrCodeUrl: table.qrCodeUrl || ""
    });
    setEditingTable(table);
    setIsAddingTable(false);
    setIsTableDialogOpen(true);
  };

  const addSpecialFeature = () => {
    if (newSpecialFeature.trim() && !tableFormData.specialFeatures?.includes(newSpecialFeature.trim())) {
      setTableFormData(prev => ({
        ...prev,
        specialFeatures: [...(prev.specialFeatures || []), newSpecialFeature.trim()]
      }));
      setNewSpecialFeature("");
    }
  };

  const generateQRCode = async () => {
    if (!selectedRestaurant || !tableFormData.tableNumber) {
      alert("Please select a restaurant and enter a table number first");
      return;
    }

    try {
      // Get the current domain (localhost:5000 or production domain)
      const currentDomain = window.location.origin;
      
      // Call the backend to generate a proper QR code URL with secure hash
      const response = await fetch('/api/admin/generate-qr-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          tableNumber: tableFormData.tableNumber,
          baseUrl: currentDomain
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const { qrCodeUrl } = await response.json();
      
      setTableFormData(prev => ({
        ...prev,
        qrCodeUrl: qrCodeUrl
      }));
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  const removeSpecialFeature = (feature: string) => {
    setTableFormData(prev => ({
      ...prev,
      specialFeatures: prev.specialFeatures?.filter(f => f !== feature) || []
    }));
  };

  const startEdit = (restaurant: Restaurant) => {
    console.log("Starting edit for restaurant:", restaurant);
    setEditingRestaurant(restaurant);
    setIsAddingNew(false);
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !formData.amenities?.includes(newAmenity.trim())) {
      setFormData(prev => ({
        ...prev,
        amenities: [...(prev.amenities || []), newAmenity.trim()]
      }));
      setNewAmenity("");
    }
  };

  const removeAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities?.filter(a => a !== amenity) || []
    }));
  };

  const addCuisineType = () => {
    if (newCuisineType.trim() && !formData.cuisineTypes?.includes(newCuisineType.trim())) {
      setFormData(prev => ({
        ...prev,
        cuisineTypes: [...(prev.cuisineTypes || []), newCuisineType.trim()]
      }));
      setNewCuisineType("");
    }
  };

  const removeCuisineType = (cuisineType: string) => {
    setFormData(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes?.filter(c => c !== cuisineType) || []
    }));
  };

  const toggleDay = (day: string) => {
    const currentDays = formData.operatingHours?.days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours!,
        days: newDays
      }
    }));
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const departments = [
    { value: "kitchen", label: "Kitchen" },
    { value: "service", label: "Service" },
    { value: "management", label: "Management" },
    { value: "cleaning", label: "Cleaning" },
    { value: "security", label: "Security" },
    { value: "other", label: "Other" }
  ];

  const rolesByDepartment = {
    kitchen: [
      { value: "chef", label: "Chef" },
      { value: "sous_chef", label: "Sous Chef" },
      { value: "line_cook", label: "Line Cook" },
      { value: "prep_cook", label: "Prep Cook" },
      { value: "pastry_chef", label: "Pastry Chef" },
      { value: "kitchen_manager", label: "Kitchen Manager" },
      { value: "dishwasher", label: "Dishwasher" }
    ],
    service: [
      { value: "waiter", label: "Waiter" },
      { value: "waitress", label: "Waitress" },
      { value: "server", label: "Server" },
      { value: "bartender", label: "Bartender" },
      { value: "host", label: "Host" },
      { value: "hostess", label: "Hostess" },
      { value: "busser", label: "Busser" },
      { value: "food_runner", label: "Food Runner" },
      { value: "barback", label: "Barback" }
    ],
    management: [
      { value: "manager", label: "Manager" },
      { value: "assistant_manager", label: "Assistant Manager" },
      { value: "general_manager", label: "General Manager" },
      { value: "operations_manager", label: "Operations Manager" },
      { value: "shift_supervisor", label: "Shift Supervisor" }
    ],
    cleaning: [
      { value: "cleaner", label: "Cleaner" },
      { value: "janitor", label: "Janitor" },
      { value: "maintenance", label: "Maintenance" },
      { value: "housekeeping", label: "Housekeeping" }
    ],
    security: [
      { value: "security_guard", label: "Security Guard" },
      { value: "bouncer", label: "Bouncer" },
      { value: "security_manager", label: "Security Manager" }
    ],
    other: [
      { value: "cashier", label: "Cashier" },
      { value: "receptionist", label: "Receptionist" },
      { value: "delivery_driver", label: "Delivery Driver" },
      { value: "other", label: "Other" }
    ]
  };

  const shifts = [
    { value: "morning", label: "Morning (6:00 AM - 2:00 PM)" },
    { value: "afternoon", label: "Afternoon (2:00 PM - 10:00 PM)" },
    { value: "evening", label: "Evening (4:00 PM - 12:00 AM)" },
    { value: "night", label: "Night (10:00 PM - 6:00 AM)" },
    { value: "full_day", label: "Full Day (8:00 AM - 8:00 PM)" },
    { value: "custom", label: "Custom Timing" }
  ];

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Restaurant Management</h2>
        <Button onClick={() => setIsAddingNew(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Restaurant</span>
        </Button>
      </div>

      {/* Restaurant List */}
      {!isAddingNew && !editingRestaurant && (
        <div className="grid gap-4">
          {restaurants.map((restaurant) => (
            <Card key={restaurant.id} className={selectedRestaurant?.id === restaurant.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-semibold">{restaurant.name}</h3>
                      <Badge variant={restaurant.isActive ? "default" : "secondary"}>
                        {restaurant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{restaurant.address}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="h-4 w-4" />
                        <span>{restaurant.contactNumber}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Building className="h-4 w-4" />
                        <span>{restaurant.totalFloors} floors</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ChefHat className="h-4 w-4" />
                        <span>{restaurant.totalKitchens} kitchens</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{restaurant.totalSeatingCapacity} seats</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {restaurant.cuisineTypes.slice(0, 3).map((cuisine) => (
                        <Badge key={cuisine} variant="outline" className="text-xs">
                          {cuisine}
                        </Badge>
                      ))}
                      {restaurant.cuisineTypes.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{restaurant.cuisineTypes.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant={selectedRestaurant?.id === restaurant.id ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setSelectedRestaurant(selectedRestaurant?.id === restaurant.id ? null : restaurant)}
                    >
                      {selectedRestaurant?.id === restaurant.id ? "Hide Details" : "Manage"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(restaurant)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(restaurant.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Restaurant Details Section */}
                {selectedRestaurant?.id === restaurant.id && (
                  <div className="mt-6 pt-6 border-t space-y-6">
                    {/* Restaurant Info */}
                    <div>
                      <h4 className="text-lg font-semibold mb-3">Restaurant Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Description:</span> {restaurant.description || "No description"}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {restaurant.email || "No email"}
                        </div>
                        <div>
                          <span className="font-medium">Website:</span> {restaurant.website || "No website"}
                        </div>
                        <div>
                          <span className="font-medium">Price Range:</span> {restaurant.priceRange}
                        </div>
                        <div>
                          <span className="font-medium">Operating Hours:</span> {restaurant.operatingHours.open} - {restaurant.operatingHours.close}
                        </div>
                        <div>
                          <span className="font-medium">Operating Days:</span> {restaurant.operatingHours.days.join(", ")}
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className="font-medium">Amenities:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {restaurant.amenities.map((amenity) => (
                            <Badge key={amenity} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Employee Management */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-semibold">Employees ({restaurantEmployees.length})</h4>
                        <Dialog 
                          open={isEmployeeDialogOpen} 
                          onOpenChange={(open) => {
                            // Prevent dialog from closing when time picker is open
                            if (!open && showTimePicker) {
                              return;
                            }
                            setIsEmployeeDialogOpen(open);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              onClick={() => {
                                setIsAddingEmployee(true);
                                setEditingEmployee(null);
                                resetEmployeeForm();
                                setIsEmployeeDialogOpen(true);
                              }} 
                              size="sm" 
                              className="flex items-center space-x-1"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Employee</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent 
                            className="max-w-2xl max-h-[90vh] overflow-y-auto"
                            style={{ pointerEvents: showTimePicker ? 'none' : 'auto' }}
                          >
                            <DialogHeader>
                              <DialogTitle>
                                {editingEmployee ? "Edit Employee" : "Add New Employee"}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {/* Employee Form Content */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="emp-name">Employee Name *</Label>
                                  <Input
                                    id="emp-name"
                                    value={employeeFormData.name || ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter employee name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="emp-id">Employee ID *</Label>
                                  <Input
                                    id="emp-id"
                                    value={employeeFormData.employeeId || ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                                    placeholder="Enter employee ID"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="emp-email">Email *</Label>
                                  <Input
                                    id="emp-email"
                                    type="email"
                                    value={employeeFormData.email || ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="Enter email address"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="emp-phone">Phone Number *</Label>
                                  <Input
                                    id="emp-phone"
                                    value={employeeFormData.phoneNumber || ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    placeholder="Enter phone number"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="emp-dept">Department *</Label>
                                  <Select
                                    value={employeeFormData.department || "service"}
                                    onValueChange={(value) => {
                                      const department = value as any;
                                      const availableRoles = rolesByDepartment[department] || [];
                                      setEmployeeFormData(prev => ({ 
                                        ...prev, 
                                        department,
                                        role: availableRoles.length > 0 ? availableRoles[0].value : undefined
                                      }));
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {departments.map((dept) => (
                                        <SelectItem key={dept.value} value={dept.value}>
                                          {dept.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="emp-role">Role *</Label>
                                  <Select
                                    value={employeeFormData.role || ""}
                                    onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, role: value as any }))}
                                    disabled={!employeeFormData.department}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={employeeFormData.department ? "Select role" : "Select department first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {employeeFormData.department && rolesByDepartment[employeeFormData.department as keyof typeof rolesByDepartment]?.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                          {role.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="emp-shift" className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4" />
                                    <span>Shift *</span>
                                  </Label>
                                  <Select
                                    value={employeeFormData.shift || "morning"}
                                    onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, shift: value as any }))}
                                  >
                                    <SelectTrigger className="border-2 border-gray-200 focus:border-blue-500">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {shifts.map((shift) => (
                                        <SelectItem key={shift.value} value={shift.value} className="py-3">
                                          <div className="flex items-center space-x-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="font-medium">{shift.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Custom Shift Timing */}
                              {employeeFormData.shift === "custom" && (
                                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                    <h4 className="text-lg font-semibold text-blue-900">Custom Shift Timing</h4>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Start Time */}
                                    <div className="space-y-3">
                                      <Label className="text-sm font-medium text-blue-800">
                                        🕐 Start Time *
                                      </Label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setTimePickerType('start');
                                          setShowTimePicker(true);
                                        }}
                                        className="w-full justify-between text-lg font-mono bg-white border-2 border-blue-200 hover:border-blue-500 rounded-lg px-4 py-3 h-12"
                                      >
                                        <span className={customShiftStart ? "text-gray-900" : "text-gray-400"}>
                                          {customShiftStart || "Select start time"}
                                        </span>
                                        <Clock className="h-4 w-4 text-blue-400" />
                                      </Button>
                                    </div>

                                    {/* End Time */}
                                    <div className="space-y-3">
                                      <Label className="text-sm font-medium text-blue-800">
                                        🕕 End Time *
                                      </Label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setTimePickerType('end');
                                          setShowTimePicker(true);
                                        }}
                                        className="w-full justify-between text-lg font-mono bg-white border-2 border-blue-200 hover:border-blue-500 rounded-lg px-4 py-3 h-12"
                                      >
                                        <span className={customShiftEnd ? "text-gray-900" : "text-gray-400"}>
                                          {customShiftEnd || "Select end time"}
                                        </span>
                                        <Clock className="h-4 w-4 text-blue-400" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Quick Time Presets */}
                                  <div className="mt-4">
                                    <Label className="text-sm font-medium text-blue-800 mb-2 block">
                                      ⚡ Quick Presets
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                      {[
                                        { label: "Early Morning", start: "05:00", end: "13:00" },
                                        { label: "Morning", start: "06:00", end: "14:00" },
                                        { label: "Afternoon", start: "14:00", end: "22:00" },
                                        { label: "Evening", start: "16:00", end: "00:00" },
                                        { label: "Night", start: "22:00", end: "06:00" },
                                        { label: "Split Shift", start: "10:00", end: "14:00" }
                                      ].map((preset) => (
                                        <Button
                                          key={preset.label}
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCustomShiftStart(preset.start);
                                            setCustomShiftEnd(preset.end);
                                          }}
                                          className="text-xs border-blue-200 hover:bg-blue-100 hover:border-blue-300"
                                        >
                                          {preset.label}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Time Range Display */}
                                  <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span className="text-sm font-medium text-gray-700">Shift Duration:</span>
                                      </div>
                                      <div className="text-right">
                                        {customShiftStart && customShiftEnd ? (
                                          <div>
                                            <div className="text-lg font-mono font-semibold text-blue-600">
                                              {customShiftStart} - {customShiftEnd}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {(() => {
                                                const start = new Date(`2000-01-01T${customShiftStart}`);
                                                const end = new Date(`2000-01-01T${customShiftEnd}`);
                                                if (end < start) end.setDate(end.getDate() + 1); // Handle overnight shifts
                                                const diff = end.getTime() - start.getTime();
                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                return `${hours}h ${minutes}m`;
                                              })()}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm text-gray-400 italic">
                                            Please select start and end times
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="emp-salary">Salary (₹)</Label>
                                  <Input
                                    id="emp-salary"
                                    type="number"
                                    value={employeeFormData.salary || ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ 
                                      ...prev, 
                                      salary: e.target.value ? parseFloat(e.target.value) : undefined 
                                    }))}
                                    placeholder="Enter salary"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="emp-hire-date">Hire Date *</Label>
                                  <Input
                                    id="emp-hire-date"
                                    type="date"
                                    value={employeeFormData.hireDate ? employeeFormData.hireDate.toISOString().split('T')[0] : ""}
                                    onChange={(e) => setEmployeeFormData(prev => ({ 
                                      ...prev, 
                                      hireDate: new Date(e.target.value) 
                                    }))}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="emp-active"
                                  checked={employeeFormData.isActive || false}
                                  onCheckedChange={(checked) => setEmployeeFormData(prev => ({ ...prev, isActive: checked }))}
                                />
                                <Label htmlFor="emp-active">Active Employee</Label>
                              </div>

                              <div className="flex justify-end space-x-2">
                                <Button variant="outline" onClick={resetEmployeeForm}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveEmployee} className="flex items-center space-x-2">
                                  <Save className="h-4 w-4" />
                                  <span>Save</span>
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      {restaurantEmployees.length > 0 ? (
                        <div className="grid gap-2">
                          {restaurantEmployees.map((employee) => {
                            const departmentLabel = departments.find(d => d.value === employee.department)?.label;
                            const roleLabel = rolesByDepartment[employee.department as keyof typeof rolesByDepartment]?.find(r => r.value === employee.role)?.label || employee.role;
                            
                            // Handle shift display with custom timing
                            let shiftLabel = shifts.find(s => s.value === employee.shift)?.label;
                            if (employee.shift === "custom" && (employee as any).customShiftStart && (employee as any).customShiftEnd) {
                              shiftLabel = `Custom (${(employee as any).customShiftStart} - ${(employee as any).customShiftEnd})`;
                            }
                            
                            return (
                              <div key={employee.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                <div>
                                  <div className="font-medium">{employee.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {roleLabel} • {departmentLabel} • {shiftLabel}
                                  </div>
                                </div>
                                <div className="flex space-x-1">
                                  <Button variant="outline" size="sm" onClick={() => startEditEmployee(employee)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteEmployee(employee.id)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No employees added yet.</p>
                      )}
                    </div>

                    {/* Table Management */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-semibold">Tables ({restaurantTables.length})</h4>
                        <Dialog 
                          open={isTableDialogOpen} 
                          onOpenChange={(open) => {
                            // Prevent dialog from closing when time picker is open
                            if (!open && showTimePicker) {
                              return;
                            }
                            setIsTableDialogOpen(open);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              onClick={() => {
                                setIsAddingTable(true);
                                setEditingTable(null);
                                resetTableForm();
                                setIsTableDialogOpen(true);
                              }} 
                              size="sm" 
                              className="flex items-center space-x-1"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Table</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent 
                            className="max-w-2xl max-h-[90vh] overflow-y-auto"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                          >
                            <DialogHeader>
                              <DialogTitle>
                                {editingTable ? "Edit Table" : "Add New Table"}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {/* Table Form Content */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="table-number">Table Number *</Label>
                                  <Input
                                    id="table-number"
                                    value={tableFormData.tableNumber || ""}
                                    onChange={(e) => setTableFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
                                    placeholder="Enter table number"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="table-floor">Floor *</Label>
                                  <Select
                                    value={tableFormData.floor?.toString() || "1"}
                                    onValueChange={(value) => setTableFormData(prev => ({ ...prev, floor: parseInt(value) }))}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select floor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {selectedRestaurant && selectedRestaurant.totalFloors > 0 && Array.from({ length: selectedRestaurant.totalFloors }, (_, i) => i + 1).map((floor) => (
                                        <SelectItem key={floor} value={floor.toString()}>
                                          Floor {floor}
                                        </SelectItem>
                                      ))}
                                      {(!selectedRestaurant || selectedRestaurant.totalFloors <= 0) && (
                                        <SelectItem value="1" disabled>
                                          No floors available - Please set total floors in restaurant details
                                        </SelectItem>
                                      )}
                                      {/* Debug info - remove in production */}
                                      {selectedRestaurant && (
                                        <div className="text-xs text-gray-500 p-2">
                                          Debug: Restaurant has {selectedRestaurant.totalFloors} floors
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="table-location">Location *</Label>
                                  <Input
                                    id="table-location"
                                    value={tableFormData.location || ""}
                                    onChange={(e) => setTableFormData(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="e.g., Near window, Center, Private booth"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="table-capacity">Seating Capacity *</Label>
                                  <Input
                                    id="table-capacity"
                                    type="number"
                                    min="1"
                                    value={tableFormData.seatingCapacity || 4}
                                    onChange={(e) => setTableFormData(prev => ({ ...prev, seatingCapacity: parseInt(e.target.value) || 4 }))}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="table-type">Table Type *</Label>
                                  <Select
                                    value={tableFormData.tableType || "regular"}
                                    onValueChange={(value) => setTableFormData(prev => ({ ...prev, tableType: value as any }))}
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
                                  <Label htmlFor="table-status">Status *</Label>
                                  <Select
                                    value={tableFormData.status || "available"}
                                    onValueChange={(value) => setTableFormData(prev => ({ ...prev, status: value as any }))}
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

                              {/* Employee Assignment Section */}
                              <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                  <Users className="h-5 w-5 text-blue-600" />
                                  <Label className="text-lg font-semibold text-blue-800">Employee Assignment (Optional)</Label>
                                </div>
                                
                                {/* Service Department */}
                                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <Label className="text-sm font-medium text-blue-800 flex items-center space-x-2">
                                    <span>🍽️</span>
                                    <span>Service Department</span>
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="table-waiter" className="text-sm">Waiter/Server</Label>
                                      <Select
                                        value={tableFormData.assignedWaiter || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedWaiter: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select waiter/server" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No waiter assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => ["waiter", "waitress", "server"].includes(emp.role) && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name} ({employee.role})
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="table-host" className="text-sm">Host/Hostess</Label>
                                      <Select
                                        value={tableFormData.assignedHost || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedHost: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select host/hostess" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No host assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => ["host", "hostess"].includes(emp.role) && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name} ({employee.role})
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="table-bartender" className="text-sm">Bartender</Label>
                                      <Select
                                        value={tableFormData.assignedBartender || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedBartender: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select bartender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No bartender assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => emp.role === "bartender" && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="table-busser" className="text-sm">Busser</Label>
                                      <Select
                                        value={tableFormData.assignedBusser || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedBusser: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select busser" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No busser assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => emp.role === "busser" && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>


                                {/* Support Department */}
                                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <Label className="text-sm font-medium text-gray-800 flex items-center space-x-2">
                                    <span>🧹</span>
                                    <span>Support Department</span>
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="table-cleaner" className="text-sm">Cleaner</Label>
                                      <Select
                                        value={tableFormData.assignedCleaner || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedCleaner: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select cleaner" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No cleaner assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => emp.role === "cleaner" && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="table-security" className="text-sm">Security</Label>
                                      <Select
                                        value={tableFormData.assignedSecurity || "none"}
                                        onValueChange={(value) => setTableFormData(prev => ({ ...prev, assignedSecurity: value }))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select security" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No security assigned</SelectItem>
                                          {restaurantEmployees
                                            .filter(emp => emp.role === "security_guard" && emp.isActive)
                                            .map((employee) => (
                                              <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <Label>Special Features</Label>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {tableFormData.specialFeatures?.map((feature) => (
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
                                        if (!tableFormData.specialFeatures?.includes(feature)) {
                                          setTableFormData(prev => ({
                                            ...prev,
                                            specialFeatures: [...(prev.specialFeatures || []), feature]
                                          }));
                                        }
                                      }}
                                      disabled={tableFormData.specialFeatures?.includes(feature)}
                                    >
                                      {feature}
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              {/* QR Code Generation Section */}
                              <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <Label className="text-lg font-semibold text-green-800">QR Code Generation</Label>
                                </div>
                                
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <Label className="text-sm font-medium text-green-800">Generate QR Code for Table</Label>
                                        <p className="text-xs text-green-600 mt-1">
                                          Creates a QR code that customers can scan to access this table's menu
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateQRCode()}
                                        className="border-green-300 text-green-700 hover:bg-green-100"
                                      >
                                        Generate QR Code
                                      </Button>
                                    </div>
                                    
                                    {tableFormData.qrCodeUrl && (
                                      <div className="mt-4 p-3 bg-white rounded border border-green-200">
                                        <Label className="text-sm font-medium text-green-800 mb-3 block">Generated QR Code:</Label>
                                        <QRCodeDisplay 
                                          url={tableFormData.qrCodeUrl}
                                          size={150}
                                          showActions={true}
                                          className="w-full"
                                        />
                                        <div className="mt-3 text-xs text-green-600 text-center">
                                          Customers can scan this QR code to access the table menu
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id="table-accessible"
                                    checked={tableFormData.isAccessible || false}
                                    onCheckedChange={(checked) => setTableFormData(prev => ({ ...prev, isAccessible: checked }))}
                                  />
                                  <Label htmlFor="table-accessible">Wheelchair Accessible</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id="table-active"
                                    checked={tableFormData.isActive || false}
                                    onCheckedChange={(checked) => setTableFormData(prev => ({ ...prev, isActive: checked }))}
                                  />
                                  <Label htmlFor="table-active">Active Table</Label>
                                </div>
                              </div>

                              <div className="flex justify-end space-x-2">
                                <Button variant="outline" onClick={resetTableForm}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveTable} className="flex items-center space-x-2">
                                  <Save className="h-4 w-4" />
                                  <span>Save</span>
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      {restaurantTables.length > 0 ? (
                        <div className="grid gap-2">
                          {restaurantTables.map((table) => {
                            const tableTypeLabel = tableTypes.find(t => t.value === table.tableType)?.label;
                            
                            return (
                              <div key={table.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                                <div>
                                  <div className="font-medium">Table {table.tableNumber}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Floor {table.floor} • {table.location} • {table.seatingCapacity} seats • {tableTypeLabel}
                                  </div>
                                </div>
                                <div className="flex space-x-1">
                                  <Button variant="outline" size="sm" onClick={() => startEditTable(table)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteTable(table.id)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No tables added yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAddingNew || editingRestaurant) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingRestaurant ? "Edit Restaurant" : "Add New Restaurant"}
            </CardTitle>
            {editingRestaurant && (
              <div className="text-sm text-muted-foreground">
                Debug: Form data name = "{formData.name}", editing restaurant name = "{editingRestaurant.name}"
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter restaurant name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number *</Label>
                <Input
                  id="contactNumber"
                  value={formData.contactNumber || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="Enter contact number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={formData.address || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter full address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="Enter website URL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter restaurant description"
                rows={3}
              />
            </div>

            {/* Restaurant Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalFloors">Total Floors *</Label>
                <Input
                  id="totalFloors"
                  type="number"
                  min="1"
                  value={formData.totalFloors || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalFloors: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalKitchens">Total Kitchens *</Label>
                <Input
                  id="totalKitchens"
                  type="number"
                  min="1"
                  value={formData.totalKitchens || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalKitchens: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSeatingCapacity">Seating Capacity *</Label>
                <Input
                  id="totalSeatingCapacity"
                  type="number"
                  min="1"
                  value={formData.totalSeatingCapacity || 50}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalSeatingCapacity: parseInt(e.target.value) || 50 }))}
                />
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-4">
              <Label>Operating Hours *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openTime">Opening Time</Label>
                  <Input
                    id="openTime"
                    type="time"
                    value={formData.operatingHours?.open || "09:00"}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      operatingHours: { ...prev.operatingHours!, open: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closeTime">Closing Time</Label>
                  <Input
                    id="closeTime"
                    type="time"
                    value={formData.operatingHours?.close || "22:00"}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      operatingHours: { ...prev.operatingHours!, close: e.target.value }
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Operating Days</Label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <Button
                      key={day}
                      variant={formData.operatingHours?.days?.includes(day) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label htmlFor="priceRange">Price Range</Label>
              <Select
                value={formData.priceRange || "moderate"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priceRange: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="expensive">Expensive</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amenities */}
            <div className="space-y-4">
              <Label>Amenities</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.amenities?.map((amenity) => (
                  <Badge key={amenity} variant="secondary" className="flex items-center space-x-1">
                    <span>{amenity}</span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeAmenity(amenity)} />
                  </Badge>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  placeholder="Add amenity"
                  onKeyPress={(e) => e.key === "Enter" && addAmenity()}
                />
                <Button onClick={addAmenity} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {commonAmenities.map((amenity) => (
                  <Button
                    key={amenity}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!formData.amenities?.includes(amenity)) {
                        setFormData(prev => ({
                          ...prev,
                          amenities: [...(prev.amenities || []), amenity]
                        }));
                      }
                    }}
                    disabled={formData.amenities?.includes(amenity)}
                  >
                    {amenity}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cuisine Types */}
            <div className="space-y-4">
              <Label>Cuisine Types</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.cuisineTypes?.map((cuisine) => (
                  <Badge key={cuisine} variant="secondary" className="flex items-center space-x-1">
                    <span>{cuisine}</span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeCuisineType(cuisine)} />
                  </Badge>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newCuisineType}
                  onChange={(e) => setNewCuisineType(e.target.value)}
                  placeholder="Add cuisine type"
                  onKeyPress={(e) => e.key === "Enter" && addCuisineType()}
                />
                <Button onClick={addCuisineType} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {commonCuisineTypes.map((cuisine) => (
                  <Button
                    key={cuisine}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!formData.cuisineTypes?.includes(cuisine)) {
                        setFormData(prev => ({
                          ...prev,
                          cuisineTypes: [...(prev.cuisineTypes || []), cuisine]
                        }));
                      }
                    }}
                    disabled={formData.cuisineTypes?.includes(cuisine)}
                  >
                    {cuisine}
                  </Button>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <Label>Features</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasParking"
                    checked={formData.hasParking || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasParking: checked }))}
                  />
                  <Label htmlFor="hasParking">Parking</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasWifi"
                    checked={formData.hasWifi || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasWifi: checked }))}
                  />
                  <Label htmlFor="hasWifi">WiFi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasDelivery"
                    checked={formData.hasDelivery || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasDelivery: checked }))}
                  />
                  <Label htmlFor="hasDelivery">Delivery</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasTakeaway"
                    checked={formData.hasTakeaway || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasTakeaway: checked }))}
                  />
                  <Label htmlFor="hasTakeaway">Takeaway</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasDineIn"
                    checked={formData.hasDineIn || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasDineIn: checked }))}
                  />
                  <Label htmlFor="hasDineIn">Dine In</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
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

      {/* Time Picker Modal */}
      {showTimePicker && (
        <TimePicker
          value={timePickerType === 'start' ? customShiftStart : customShiftEnd}
          onChange={(time) => {
            if (timePickerType === 'start') {
              setCustomShiftStart(time);
            } else {
              setCustomShiftEnd(time);
            }
          }}
          onClose={() => {
            setShowTimePicker(false);
            // Don't close the dialog when time picker closes
          }}
          use12Hour={true}
        />
      )}

    </div>
  );
}

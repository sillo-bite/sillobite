import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Save, X, Users, Phone, Mail, Calendar, DollarSign, MapPin } from "lucide-react";
import { RestaurantEmployee, InsertRestaurantEmployee, Restaurant } from "@shared/schema";
import { insertRestaurantEmployeeSchema } from "@shared/schema";

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<RestaurantEmployee[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<RestaurantEmployee | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [formData, setFormData] = useState<Partial<InsertRestaurantEmployee>>({
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

  const roles = [
    { value: "manager", label: "Manager" },
    { value: "chef", label: "Chef" },
    { value: "waiter", label: "Waiter" },
    { value: "cashier", label: "Cashier" },
    { value: "host", label: "Host" },
    { value: "bartender", label: "Bartender" },
    { value: "cleaner", label: "Cleaner" },
    { value: "security", label: "Security" },
    { value: "other", label: "Other" }
  ];

  const departments = [
    { value: "kitchen", label: "Kitchen" },
    { value: "service", label: "Service" },
    { value: "management", label: "Management" },
    { value: "cleaning", label: "Cleaning" },
    { value: "security", label: "Security" },
    { value: "other", label: "Other" }
  ];

  const shifts = [
    { value: "morning", label: "Morning" },
    { value: "afternoon", label: "Afternoon" },
    { value: "evening", label: "Evening" },
    { value: "night", label: "Night" },
    { value: "full_day", label: "Full Day" }
  ];

  useEffect(() => {
    fetchRestaurants();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
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
      setLoading(true);
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
      
      const validatedData = insertRestaurantEmployeeSchema.parse(formData);
      
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
        await fetchEmployees(selectedRestaurant);
        resetForm();
      }
    } catch (error) {
      console.error("Error saving employee:", error);
    }
  };

  const handleDelete = async (employeeId: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await fetchEmployees(selectedRestaurant);
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      restaurantId: selectedRestaurant && selectedRestaurant !== "all" ? selectedRestaurant : "",
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
    setEditingEmployee(null);
    setIsAddingNew(false);
  };

  const startEdit = (employee: RestaurantEmployee) => {
    setFormData({
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
    setEditingEmployee(employee);
    setIsAddingNew(false);
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      manager: "bg-blue-100 text-blue-800",
      chef: "bg-orange-100 text-orange-800",
      waiter: "bg-green-100 text-green-800",
      cashier: "bg-purple-100 text-purple-800",
      host: "bg-pink-100 text-pink-800",
      bartender: "bg-yellow-100 text-yellow-800",
      cleaner: "bg-gray-100 text-gray-800",
      security: "bg-red-100 text-red-800",
      other: "bg-slate-100 text-slate-800"
    };
    return colors[role] || colors.other;
  };

  const getDepartmentColor = (department: string) => {
    const colors: { [key: string]: string } = {
      kitchen: "bg-orange-100 text-orange-800",
      service: "bg-green-100 text-green-800",
      management: "bg-blue-100 text-blue-800",
      cleaning: "bg-gray-100 text-gray-800",
      security: "bg-red-100 text-red-800",
      other: "bg-slate-100 text-slate-800"
    };
    return colors[department] || colors.other;
  };

  const getShiftColor = (shift: string) => {
    const colors: { [key: string]: string } = {
      morning: "bg-yellow-100 text-yellow-800",
      afternoon: "bg-orange-100 text-orange-800",
      evening: "bg-purple-100 text-purple-800",
      night: "bg-indigo-100 text-indigo-800",
      full_day: "bg-green-100 text-green-800"
    };
    return colors[shift] || colors.morning;
  };

  const filteredEmployees = selectedRestaurant && selectedRestaurant !== "all"
    ? employees.filter(emp => emp.restaurantId === selectedRestaurant)
    : employees;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Employee Management</h2>
        <Button 
          onClick={() => setIsAddingNew(true)} 
          className="flex items-center space-x-2"
          disabled={!selectedRestaurant || selectedRestaurant === "all"}
        >
          <Plus className="h-4 w-4" />
          <span>Add Employee</span>
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

      {/* Employee List */}
      {!isAddingNew && !editingEmployee && (
        <div className="grid gap-4">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-semibold">{employee.name}</h3>
                      <Badge variant={employee.isActive ? "default" : "secondary"}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Mail className="h-4 w-4" />
                        <span>{employee.email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="h-4 w-4" />
                        <span>{employee.phoneNumber}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>ID: {employee.employeeId}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Hired: {new Date(employee.hireDate).toLocaleDateString()}</span>
                      </div>
                      {employee.salary && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4" />
                          <span>₹{employee.salary.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getRoleColor(employee.role)}>
                        {roles.find(r => r.value === employee.role)?.label || employee.role}
                      </Badge>
                      <Badge className={getDepartmentColor(employee.department)}>
                        {departments.find(d => d.value === employee.department)?.label || employee.department}
                      </Badge>
                      <Badge className={getShiftColor(employee.shift)}>
                        {shifts.find(s => s.value === employee.shift)?.label || employee.shift}
                      </Badge>
                    </div>
                    {employee.assignedTables && employee.assignedTables.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Assigned Tables: {employee.assignedTables.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(employee)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(employee.id)}>
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
      {(isAddingNew || editingEmployee) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Employee Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter employee name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  placeholder="Enter employee ID"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Enter phone number"
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

            {/* Role and Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role || "waiter"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department || "service"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, department: value as any }))}
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
            </div>

            {/* Shift and Salary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift">Shift *</Label>
                <Select
                  value={formData.shift || "morning"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, shift: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.value} value={shift.value}>
                        {shift.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary">Salary (₹)</Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.salary || ""}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    salary: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  placeholder="Enter salary"
                />
              </div>
            </div>

            {/* Hire Date */}
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate ? formData.hireDate.toISOString().split('T')[0] : ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  hireDate: new Date(e.target.value) 
                }))}
              />
            </div>

            {/* Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active Employee</Label>
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

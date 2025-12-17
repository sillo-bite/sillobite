import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerButton, OwnerBadge } from "@/components/owner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Package, Phone, Mail, User, X, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { DeliveryPerson, Order } from "@shared/schema";
import { formatOrderIdDisplay } from "@shared/utils";

interface DeliveryManagementProps {
  canteenId: string;
}

export default function DeliveryManagement({ canteenId }: DeliveryManagementProps) {
  const queryClient = useQueryClient();
  const [selectedPerson, setSelectedPerson] = useState<DeliveryPerson | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
    password: "",
    employeeId: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    dateOfBirth: "",
    dateOfJoining: "",
    vehicleNumber: "",
    licenseNumber: "",
    emergencyContact: "",
    emergencyContactName: "",
    salary: "",
    notes: ""
  });

  // Fetch delivery persons
  const { data: deliveryPersons, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/canteens/${canteenId}/delivery-persons`],
    queryFn: async () => {
      try {
        if (!canteenId) {
          return [] as DeliveryPerson[];
        }
        
        const url = `/api/canteens/${canteenId}/delivery-persons`;
        const response = await apiRequest(url);
        
        // Check if response is HTML (error case)
        if (typeof response === 'string' && response.trim().startsWith('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. Please restart the server.');
        }
        
        // Ensure response is an array
        if (Array.isArray(response)) {
          return response as DeliveryPerson[];
        }
        
        // If response is not an array, return empty array
        return [] as DeliveryPerson[];
      } catch (err) {
        throw err; // Re-throw to let React Query handle the error
      }
    },
    enabled: !!canteenId,
    retry: 1
  });

  // Ensure deliveryPersons is always an array
  const safeDeliveryPersons = Array.isArray(deliveryPersons) ? deliveryPersons : [];

  // Fetch orders for selected delivery person
  const { data: assignedOrders, isLoading: ordersLoading } = useQuery({
    queryKey: [`/api/delivery-persons/${selectedPerson?.id}/orders`],
    queryFn: async () => {
      if (!selectedPerson?.id) return [];
      try {
        const response = await apiRequest(`/api/delivery-persons/${selectedPerson.id}/orders`);
        // Ensure response is an array
        if (Array.isArray(response)) {
          return response as Order[];
        }
        return [] as Order[];
      } catch (err) {
        return [] as Order[];
      }
    },
    enabled: !!selectedPerson?.id && showOrdersDialog
  });

  // Ensure assignedOrders is always an array
  const safeAssignedOrders = Array.isArray(assignedOrders) ? assignedOrders : [];

  // Create delivery person mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest(`/api/canteens/${canteenId}/delivery-persons`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/delivery-persons`] });
      setShowAddDialog(false);
      setFormData({ 
        name: "", 
        phoneNumber: "", 
        email: "", 
        password: "",
        employeeId: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        dateOfBirth: "",
        dateOfJoining: "",
        vehicleNumber: "",
        licenseNumber: "",
        emergencyContact: "",
        emergencyContactName: "",
        salary: "",
        notes: ""
      });
    }
  });

  // Delete delivery person mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/delivery-persons/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/delivery-persons`] });
    }
  });

  // Update availability mutation
  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      return apiRequest(`/api/delivery-persons/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isAvailable }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/delivery-persons`] });
    }
  });

  const handleAdd = () => {
    if (!formData.name || !formData.phoneNumber) {
      alert("Name and phone number are required");
      return;
    }
    if (!formData.email || formData.email.trim() === '') {
      alert("Email is required for delivery person to access their portal");
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      alert("Please enter a valid email address");
      return;
    }
    if (!formData.password || formData.password.trim() === '') {
      alert("Password is required for delivery person to log in");
      return;
    }
    // Validate password strength (minimum 6 characters)
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to remove this delivery person?")) {
      deleteMutation.mutate(id.toString());
    }
  };

  const handleViewOrders = (person: DeliveryPerson) => {
    setSelectedPerson(person);
    setShowOrdersDialog(true);
  };

  const getOrderStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("completed") || statusLower.includes("delivered")) {
      return "bg-success/20 text-success border-success/40";
    }
    if (statusLower.includes("preparing") || statusLower.includes("ready")) {
      return "bg-primary/20 text-primary border-primary/40";
    }
    if (statusLower.includes("pending")) {
      return "bg-warning/20 text-warning border-warning/40";
    }
    if (statusLower.includes("cancelled")) {
      return "bg-destructive/20 text-destructive border-destructive/40";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <Card className="flex-1 flex flex-col min-h-0 bg-card border-border">
        <CardHeader className="flex-shrink-0 p-3 sm:p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg text-foreground">Delivery Management</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                Manage delivery persons and track assigned orders
              </p>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <OwnerButton 
                  size="sm" 
                  variant="primary"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Delivery Person
                </OwnerButton>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Delivery Person</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Add a new delivery person to manage order deliveries
            </DialogDescription>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 app-scrollbar">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email (required for login)"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Email is required for delivery person to log in to their portal
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password (min 6 characters)"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Password must be at least 6 characters long
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      placeholder="Enter employee ID (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Address Information</h3>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address (optional)"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Enter city (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Enter state (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="Enter pincode (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateOfJoining">Date of Joining</Label>
                    <Input
                      id="dateOfJoining"
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Vehicle Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                    <Input
                      id="vehicleNumber"
                      value={formData.vehicleNumber}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                      placeholder="Enter vehicle number (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="Enter license number (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContactName">Contact Name</Label>
                    <Input
                      id="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      placeholder="Enter emergency contact name (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContact">Contact Number</Label>
                    <Input
                      id="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      placeholder="Enter emergency contact number (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b border-border pb-2 text-foreground">Employment Information</h3>
                <div>
                  <Label htmlFor="salary">Salary (₹)</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="Enter salary (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    className="flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter any additional notes (optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                <OwnerButton 
                  variant="secondary" 
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </OwnerButton>
                <OwnerButton 
                  variant="primary"
                  onClick={handleAdd} 
                  disabled={createMutation.isPending}
                  isLoading={createMutation.isPending}
                >
                  Add Delivery Person
                </OwnerButton>
              </div>
            </div>
          </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 pt-2">
          {/* Delivery Persons Count */}
          <div className="mb-2.5 flex-shrink-0">
            <Card className="bg-card border-border">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Delivery Persons</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground">{safeDeliveryPersons.length}</p>
                  </div>
                  <Package className="w-7 h-7 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-2.5 flex-shrink-0">
              <Card className="bg-card border-destructive">
                <CardContent className="p-2.5">
                  <p className="text-xs text-destructive break-words">
                    Error loading delivery persons: {error instanceof Error ? error.message : 'Unknown error'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Delivery Persons Grid - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : safeDeliveryPersons.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-base font-medium mb-2 text-foreground">No delivery persons yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Add your first delivery person to get started
                  </p>
                  <OwnerButton 
                    size="sm" 
                    variant="primary"
                    onClick={() => setShowAddDialog(true)} 
                    icon={<Plus className="w-3 h-3" />}
                  >
                    Add Delivery Person
                  </OwnerButton>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-3">
                {safeDeliveryPersons.map((person) => (
                  <Card
                    key={person.id}
                    className="cursor-pointer hover:shadow-card transition-shadow bg-card border-border"
                    onClick={() => handleViewOrders(person)}
                  >
                    <CardHeader className="p-2.5 pb-2 border-b border-border">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xs sm:text-sm flex items-center text-foreground break-words min-w-0 flex-1">
                          <User className="w-3.5 h-3.5 mr-1.5 text-primary flex-shrink-0" />
                          <span className="break-words">{person.name}</span>
                        </CardTitle>
                        <OwnerButton
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(person.id);
                          }}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </OwnerButton>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2.5 pt-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 mr-1.5 flex-shrink-0" />
                          <span className="break-words">{person.phoneNumber}</span>
                        </div>
                        <div className="flex items-center text-xs font-medium text-primary">
                          <Package className="w-3 h-3 mr-1.5 flex-shrink-0" />
                          <span className="break-words">ID: {person.deliveryPersonId}</span>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex items-center justify-between p-1.5 bg-muted rounded-md border border-border">
                          <div className="flex items-center text-xs min-w-0">
                            <Package className="w-3 h-3 mr-1.5 text-primary flex-shrink-0" />
                            <span className="font-medium text-foreground break-words">Orders:</span>
                            <span className="ml-1 font-bold text-primary whitespace-nowrap">{person.totalOrderDelivered || 0}</span>
                          </div>
                        </div>

                        {/* Availability Toggle */}
                        <div className="flex items-center justify-between p-1.5 border border-border rounded-md">
                          <div className="flex items-center text-xs min-w-0">
                            {person.isAvailable ? (
                              <CheckCircle className="w-3 h-3 mr-1.5 text-success flex-shrink-0" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className={person.isAvailable ? "text-success font-medium break-words" : "text-muted-foreground break-words"}>
                              {person.isAvailable ? "Available" : "Unavailable"}
                            </span>
                          </div>
                          <Switch
                            checked={person.isAvailable}
                            onCheckedChange={(checked) => {
                              updateAvailabilityMutation.mutate({ id: person.id.toString(), isAvailable: checked });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={updateAvailabilityMutation.isPending}
                            className="flex-shrink-0"
                          />
                        </div>

                        {person.email && (
                          <div className="flex items-start text-xs text-muted-foreground">
                            <Mail className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5" />
                            <span className="break-words min-w-0">{person.email}</span>
                          </div>
                        )}
                        {person.employeeId && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <User className="w-3 h-3 mr-1.5 flex-shrink-0" />
                            <span className="break-words">Emp ID: {person.employeeId}</span>
                          </div>
                        )}
                        {person.vehicleNumber && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Package className="w-3 h-3 mr-1.5 flex-shrink-0" />
                            <span className="break-words">Vehicle: {person.vehicleNumber}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto app-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Orders Assigned to {selectedPerson?.name}</span>
              <OwnerButton
                variant="icon"
                size="icon"
                onClick={() => setShowOrdersDialog(false)}
              >
                <X className="w-4 h-4" />
              </OwnerButton>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {ordersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : safeAssignedOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">No orders assigned</p>
                <p className="text-sm text-muted-foreground">
                  This delivery person currently has no active orders
                </p>
              </div>
            ) : (
              safeAssignedOrders.map((order) => {
                const formatted = formatOrderIdDisplay(order.orderNumber || order.id);
                return (
                  <Card key={order.id} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <div className="flex items-center font-medium text-foreground break-words">
                              <span>#{formatted.prefix}</span>
                              <span className="bg-primary/20 text-primary font-bold px-1 rounded ml-0">
                                {formatted.highlighted}
                              </span>
                            </div>
                            <Badge className={`${getOrderStatusColor(order.status)} break-words`}>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                            <p className="text-foreground break-words"><span className="text-muted-foreground">Customer:</span> {order.customerName}</p>
                            <p className="text-foreground break-words"><span className="text-muted-foreground">Amount:</span> ₹{order.amount}</p>
                            <p className="text-foreground break-words"><span className="text-muted-foreground">Created:</span> {new Date(order.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


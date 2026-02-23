import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  BookOpen,
  UtensilsCrossed,
  Settings,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  Download,
  ArrowUpDown
} from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import QRCodeDisplay from "@/components/ui/qr-code-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// QR Code Address Interface
interface QRCodeAddress {
  label: string;
  fullName?: string;
  phoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

// QR Code Management Component
function QRCodeManagement({ organizationId }: { organizationId: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [addressForm, setAddressForm] = useState<QRCodeAddress>({
    label: '',
    fullName: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
  });

  // Fetch QR codes
  const { data: qrCodesData, isLoading: qrCodesLoading, refetch: refetchQRCodes } = useQuery({
    queryKey: [`/api/system-settings/organizations/${organizationId}/qr-codes`],
    queryFn: async () => {
      const response = await fetch(`/api/system-settings/organizations/${organizationId}/qr-codes`);
      if (!response.ok) {
        throw new Error('Failed to fetch QR codes');
      }
      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const qrCodes = qrCodesData?.qrCodes || [];

  // Create QR code mutation
  const createQRCodeMutation = useMutation({
    mutationFn: async (fullAddress: QRCodeAddress) => {
      const response = await fetch(`/api/system-settings/organizations/${organizationId}/qr-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: fullAddress.addressLine1, // For backward compatibility
          fullAddress
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create QR code');
      }
      return response.json();
    },
    onSuccess: () => {
      // Reset form
      setAddressForm({
        label: '',
        fullName: '',
        phoneNumber: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
      });
      setShowCreateDialog(false);
      refetchQRCodes();
    },
  });

  // Delete QR code mutation
  const deleteQRCodeMutation = useMutation({
    mutationFn: async (qrId: string) => {
      const response = await fetch(`/api/system-settings/organizations/${organizationId}/qr-codes/${qrId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete QR code');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchQRCodes();
    },
  });

  const handleCreateQRCode = () => {
    // Validate required fields
    if (!addressForm.label.trim() || !addressForm.addressLine1.trim() ||
      !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.pincode.trim()) {
      alert('Please fill in all required fields (Label, Address Line 1, City, State, Pincode)');
      return;
    }
    setIsCreating(true);
    createQRCodeMutation.mutate(addressForm, {
      onSettled: () => {
        setIsCreating(false);
      },
    });
  };

  const handleDeleteQRCode = (qrId: string) => {
    if (confirm('Are you sure you want to delete this QR code?')) {
      deleteQRCodeMutation.mutate(qrId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <QrCode className="w-5 h-5" />
            <span>QR Code Management</span>
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create QR Code</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New QR Code</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Enter the address details. This address will be automatically added to users who scan this QR code.
                </p>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Label */}
                <div className="space-y-2">
                  <Label htmlFor="label">Address Label *</Label>
                  <Input
                    id="label"
                    placeholder="e.g., Main Campus, Building A, Floor 2"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    required
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name (Optional)</Label>
                  <Input
                    id="fullName"
                    placeholder="Will use user's name if not provided"
                    value={addressForm.fullName || ''}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="Will use user's phone if not provided"
                    value={addressForm.phoneNumber || ''}
                    onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                  />
                </div>

                {/* Address Line 1 */}
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Textarea
                    id="addressLine1"
                    placeholder="House/Flat No., Building Name, Street"
                    value={addressForm.addressLine1}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                    required
                    rows={2}
                  />
                </div>

                {/* Address Line 2 */}
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                  <Textarea
                    id="addressLine2"
                    placeholder="Area, Locality"
                    value={addressForm.addressLine2 || ''}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                    rows={2}
                  />
                </div>

                {/* City, State, Pincode in a row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="Enter city"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      placeholder="Enter state"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      placeholder="Enter pincode"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Landmark */}
                <div className="space-y-2">
                  <Label htmlFor="landmark">Landmark (Optional)</Label>
                  <Input
                    id="landmark"
                    placeholder="Nearby landmark"
                    value={addressForm.landmark || ''}
                    onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateQRCode}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    {isCreating ? 'Creating...' : 'Create QR Code'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {qrCodesLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading QR codes...</p>
          </div>
        ) : qrCodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No QR codes created yet. Create your first QR code to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qrCode: any) => (
              <Card key={qrCode.qrId} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm font-medium flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">
                          {qrCode.fullAddress?.label || qrCode.address}
                        </span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {qrCode.fullAddress?.addressLine1 && (
                          <span className="block truncate">{qrCode.fullAddress.addressLine1}</span>
                        )}
                        Created: {new Date(qrCode.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteQRCode(qrCode.qrId)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <QRCodeDisplay
                    url={qrCode.qrCodeUrl}
                    size={150}
                    showActions={true}
                    className="w-full"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizationAdminPanel() {
  const [match, params] = useRoute("/admin/organization/:organizationId");
  const [, setLocation] = useLocation();
  const { user } = useAuthSync();
  const organizationId = params?.organizationId;
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch organization details
  const { data: organizationData, isLoading: orgLoading } = useQuery({
    queryKey: [`/api/system-settings/organizations/${organizationId}`],
    queryFn: async () => {
      const response = await fetch(`/api/system-settings/organizations/${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }
      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch organization users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: [`/api/admin/organization/${organizationId}/users`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organization/${organizationId}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch organization canteens
  const { data: canteensData, isLoading: canteensLoading } = useQuery({
    queryKey: [`/api/system-settings/canteens/by-organization/${organizationId}`],
    queryFn: async () => {
      const response = await fetch(`/api/system-settings/canteens/by-organization/${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch canteens');
      }
      return response.json();
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const organization = organizationData?.organization;
  const users = usersData?.users || [];
  const canteens = canteensData?.canteens || [];

  const queryClient = useQueryClient();

  // Local state for priority inputs
  const [priorityInputs, setPriorityInputs] = useState<Record<string, string>>({});

  // Initialize priority inputs from canteens data
  React.useEffect(() => {
    if (canteens.length > 0) {
      setPriorityInputs(prev => {
        const newPriorityInputs = { ...prev };
        canteens.forEach((canteen: any) => {
          const inputKey = `priority-${canteen.id}`;
          // Only initialize if not already set
          if (newPriorityInputs[inputKey] === undefined) {
            newPriorityInputs[inputKey] = String(canteen.priority ?? 0);
          }
        });
        return newPriorityInputs;
      });
    }
  }, [canteens.map((c: any) => c.id).join(',')]); // Only re-run when canteen IDs change

  // Update canteen priority mutation
  const updateCanteenPriorityMutation = useMutation({
    mutationFn: async ({ canteenId, priority }: { canteenId: string; priority: number }) => {
      console.log('Updating canteen priority:', { canteenId, priority });
      const response = await fetch(`/api/system-settings/canteens/${canteenId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority: Number(priority) }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to update priority:', error);
        throw new Error(error.error || 'Failed to update priority');
      }
      const result = await response.json();
      console.log('Priority update result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Priority updated successfully, invalidating queries');
      queryClient.invalidateQueries({ queryKey: [`/api/system-settings/canteens/by-organization/${organizationId}`] });
    },
    onError: (error) => {
      console.error('Error updating priority:', error);
    },
  });

  // Calculate statistics
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u: any) => u.isActive !== false).length,
    totalDepartments: organization?.departments?.length || 0,
    activeDepartments: organization?.departments?.filter((d: any) => d.isActive !== false).length || 0,
    totalCanteens: canteens.length,
    activeCanteens: canteens.filter((c: any) => c.isActive !== false).length,
    employees: users.filter((u: any) => u.role === 'employee').length,
    contractors: users.filter((u: any) => u.role === 'contractor').length,
    visitors: users.filter((u: any) => u.role === 'visitor').length,
    guests: users.filter((u: any) => u.role === 'guest').length,
  };

  if (!organizationId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Organization ID not found</p>
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/organization-management")}
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Organizations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orgLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Organization not found</p>
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/organization-management")}
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Organizations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin/organization-management")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold">{organization.name}</h1>
              <Badge variant={organization.isActive ? "default" : "secondary"}>
                {organization.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Code: {organization.code} • {organization.companyType || 'Organization'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Departments</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Users ({stats.totalUsers})</span>
          </TabsTrigger>
          <TabsTrigger value="canteens" className="flex items-center space-x-2">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Canteens ({stats.totalCanteens})</span>
          </TabsTrigger>
          <TabsTrigger value="qr-codes" className="flex items-center space-x-2">
            <QrCode className="w-4 h-4" />
            <span>QR Codes</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeUsers} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDepartments}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeDepartments} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Canteens</CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCanteens}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeCanteens} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {organization.isActive ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {organization.isActive ? 'Active' : 'Inactive'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>Organization Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Organization Name</Label>
                  <p className="text-base">{organization.name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Code</Label>
                  <p className="text-base font-mono">{organization.code}</p>
                </div>
                {organization.description && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                    <p className="text-base">{organization.description}</p>
                  </div>
                )}
                {organization.companyType && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">Company Type</Label>
                    <p className="text-base">{organization.companyType}</p>
                  </div>
                )}
                {organization.industry && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">Industry</Label>
                    <p className="text-base">{organization.industry}</p>
                  </div>
                )}
                {organization.location && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>Location</span>
                    </Label>
                    <p className="text-base">{organization.location}</p>
                  </div>
                )}
                {organization.contactEmail && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>Contact Email</span>
                    </Label>
                    <p className="text-base">{organization.contactEmail}</p>
                  </div>
                )}
                {organization.contactPhone && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                      <Phone className="w-3 h-3" />
                      <span>Contact Phone</span>
                    </Label>
                    <p className="text-base">{organization.contactPhone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Roles Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>User Roles Breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{stats.employees}</div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">{stats.contractors}</div>
                  <p className="text-sm text-muted-foreground">Contractors</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">{stats.visitors}</div>
                  <p className="text-sm text-muted-foreground">Visitors</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                  <div className="text-2xl font-bold">{stats.guests}</div>
                  <p className="text-sm text-muted-foreground">Guests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Departments</span>
                  <Badge variant="outline">{stats.totalDepartments}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {organization.departments && organization.departments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {organization.departments.map((department: any) => (
                    <div key={department.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium">{department.code}</h4>
                            <Badge variant={department.isActive ? "default" : "secondary"} className="text-xs">
                              {department.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{department.name}</p>
                          {department.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {department.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Type: {department.departmentType || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No departments found for this organization.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Users</span>
                  <Badge variant="outline">{stats.totalUsers}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading users...</p>
                </div>
              ) : users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user: any) => (
                    <div key={user.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{user.name}</h4>
                            <Badge variant="outline" className="text-xs capitalize">
                              {user.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.department && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Department: {user.department}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No users found for this organization.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Canteens Tab */}
        <TabsContent value="canteens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  <span>Canteens</span>
                  <Badge variant="outline">{stats.totalCanteens}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canteensLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading canteens...</p>
                </div>
              ) : canteens.length > 0 ? (
                <div className="space-y-4">
                  {canteens.map((canteen: any) => {
                    const canteenPriority = canteen.priority ?? 0;
                    const inputKey = `priority-${canteen.id}`;
                    const currentInputValue = priorityInputs[inputKey] ?? String(canteenPriority);

                    const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                      setPriorityInputs(prev => ({
                        ...prev,
                        [inputKey]: e.target.value
                      }));
                    };

                    const handlePriorityBlur = () => {
                      const newPriority = parseInt(currentInputValue) || 0;
                      if (newPriority !== canteenPriority) {
                        updateCanteenPriorityMutation.mutate({
                          canteenId: canteen.id,
                          priority: newPriority
                        });
                      } else {
                        // Reset to server value if unchanged
                        setPriorityInputs(prev => {
                          const newState = { ...prev };
                          delete newState[inputKey];
                          return newState;
                        });
                      }
                    };

                    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    };

                    return (
                      <div
                        key={canteen.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => setLocation(`/admin/canteen/${canteen.id}`)}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium">{canteen.name}</h4>
                              <Badge variant={canteen.isActive ? "default" : "secondary"} className="text-xs">
                                {canteen.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            {canteen.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {canteen.description}
                              </p>
                            )}
                            {canteen.location && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{canteen.location}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={inputKey} className="text-xs text-muted-foreground flex items-center space-x-1">
                                <ArrowUpDown className="w-3 h-3" />
                                <span>Priority:</span>
                              </Label>
                              <Input
                                id={inputKey}
                                type="number"
                                min="0"
                                value={currentInputValue}
                                onChange={handlePriorityChange}
                                onBlur={handlePriorityBlur}
                                className="w-20 h-8 text-sm"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                                disabled={updateCanteenPriorityMutation.isPending}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No canteens associated with this organization.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Codes Tab */}
        <TabsContent value="qr-codes" className="space-y-4">
          <QRCodeManagement organizationId={organizationId || ''} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Organization Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Active Roles</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <CheckCircle2 className={`w-4 h-4 ${organization.activeRoles?.employee ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-sm">Employee</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <CheckCircle2 className={`w-4 h-4 ${organization.activeRoles?.contractor ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-sm">Contractor</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <CheckCircle2 className={`w-4 h-4 ${organization.activeRoles?.visitor ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-sm">Visitor</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <CheckCircle2 className={`w-4 h-4 ${organization.activeRoles?.guest ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="text-sm">Guest</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(organization.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last Updated: {new Date(organization.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Calendar, Users, Percent, IndianRupee, Clock, Eye, UserPlus, History, Search, Filter, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface CanteenAdminCouponManagementProps {
  canteenId: string;
}

interface CouponUsageHistory {
  userId: number;
  orderId: string;
  orderNumber: string;
  discountAmount: number;
  usedAt: string;
}

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  usedCount: number;
  usedBy: number[];
  assignmentType?: 'all' | 'specific';
  assignedUsers?: number[];
  usageHistory?: CouponUsageHistory[];
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  createdBy: number;
  createdAt: string;
}

export default function CanteenAdminCouponManagement({ canteenId }: CanteenAdminCouponManagementProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<Coupon | null>(null);

  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 0,
    minimumOrderAmount: 0,
    maxDiscountAmount: 0,
    usageLimit: 1,
    assignmentType: "all" as "all" | "specific",
    assignedUsers: [] as number[],
    validFrom: "",
    validUntil: "",
    isActive: true
  });

  // Fetch coupons
  const { data: coupons = [], isLoading: couponsLoading } = useQuery<Coupon[]>({
    queryKey: [`/api/canteens/${canteenId}/coupons`],
    refetchInterval: false,
  });

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/canteens/${canteenId}/coupons`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/coupons`] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
    }
  });

  // Update coupon mutation
  const updateCouponMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/canteens/${canteenId}/coupons/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/coupons`] });
      setEditDialogOpen(false);
      setSelectedCoupon(null);
    },
    onError: (error: any) => {
    }
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      return apiRequest(`/api/canteens/${canteenId}/coupons/${couponId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/coupons`] });
    },
    onError: (error: any) => {
    }
  });

  // Toggle coupon status mutation
  const toggleCouponStatusMutation = useMutation({
    mutationFn: async (couponId: string) => {
      return apiRequest(`/api/canteens/${canteenId}/coupons/${couponId}/toggle`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/canteens/${canteenId}/coupons`] });
    },
    onError: (error: any) => {
    }
  });

  const resetForm = () => {
    setCouponForm({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: 0,
      minimumOrderAmount: 0,
      maxDiscountAmount: 0,
      usageLimit: 1,
      assignmentType: "all",
      assignedUsers: [],
      validFrom: "",
      validUntil: "",
      isActive: true
    });
  };

  const handleCreateCoupon = () => {
    if (!couponForm.code || !couponForm.description || !couponForm.validFrom || !couponForm.validUntil) {
      return;
    }

    createCouponMutation.mutate({
      ...couponForm,
      canteenId: canteenId
    });
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderAmount: coupon.minimumOrderAmount || 0,
      maxDiscountAmount: coupon.maxDiscountAmount || 0,
      usageLimit: coupon.usageLimit,
      assignmentType: coupon.assignmentType || "all",
      assignedUsers: coupon.assignedUsers || [],
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      isActive: coupon.isActive
    });
    setEditDialogOpen(true);
  };

  const handleUpdateCoupon = () => {
    if (!selectedCoupon) return;

    updateCouponMutation.mutate({
      id: selectedCoupon.id,
      ...couponForm,
      canteenId: canteenId
    });
  };

  const handleDeleteCoupon = (couponId: string) => {
    deleteCouponMutation.mutate(couponId);
  };

  const handleToggleCouponStatus = (couponId: string) => {
    toggleCouponStatusMutation.mutate(couponId);
  };

  const handleViewUsage = (coupon: Coupon) => {
    setSelectedCouponForUsage(coupon);
    setUsageDialogOpen(true);
  };

  const getStatusColor = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);

    if (!coupon.isActive) return "bg-muted text-muted-foreground";
    if (now < validFrom) return "bg-blue-100 text-blue-800";
    if (now > validUntil) return "bg-destructive text-destructive-foreground";
    if (coupon.usedCount >= coupon.usageLimit) return "bg-warning text-warning-foreground";
    return "bg-success text-success-foreground";
  };

  const getStatusText = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);

    if (!coupon.isActive) return "Inactive";
    if (now < validFrom) return "Scheduled";
    if (now > validUntil) return "Expired";
    if (coupon.usedCount >= coupon.usageLimit) return "Fully Used";
    return "Active";
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.description.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus = getStatusText(coupon) === "Active";
    } else if (statusFilter === "inactive") {
      matchesStatus = getStatusText(coupon) === "Inactive";
    } else if (statusFilter === "expired") {
      matchesStatus = getStatusText(coupon) === "Expired";
    } else if (statusFilter === "scheduled") {
      matchesStatus = getStatusText(coupon) === "Scheduled";
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6" data-testid="canteen-admin-coupon-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/admin/canteen/${canteenId}`)}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Coupon Management</h1>
            <p className="text-muted-foreground">Create and manage discount coupons for this canteen</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-coupon">
                <Plus className="h-4 w-4 mr-2" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-background">
              <DialogHeader>
                <DialogTitle>Create New Coupon</DialogTitle>
                <DialogDescription>
                  Create a new discount coupon for your canteen customers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Coupon Code *</Label>
                    <Input
                      id="code"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., WELCOME20"
                      data-testid="input-coupon-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Input
                      id="description"
                      value={couponForm.description}
                      onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                      placeholder="e.g., Welcome discount"
                      data-testid="input-coupon-description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discountType">Discount Type</Label>
                    <Select
                      value={couponForm.discountType}
                      onValueChange={(value: "percentage" | "fixed") => setCouponForm({ ...couponForm, discountType: value })}
                    >
                      <SelectTrigger data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">Discount Value *</Label>
                    <Input
                      id="discountValue"
                      type="number"
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                      placeholder={couponForm.discountType === "percentage" ? "20" : "50"}
                      data-testid="input-discount-value"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minimumOrderAmount">Minimum Order Amount</Label>
                    <Input
                      id="minimumOrderAmount"
                      type="number"
                      value={couponForm.minimumOrderAmount}
                      onChange={(e) => setCouponForm({ ...couponForm, minimumOrderAmount: Number(e.target.value) })}
                      placeholder="100"
                      data-testid="input-minimum-order"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDiscountAmount">Max Discount Amount</Label>
                    <Input
                      id="maxDiscountAmount"
                      type="number"
                      value={couponForm.maxDiscountAmount}
                      onChange={(e) => setCouponForm({ ...couponForm, maxDiscountAmount: Number(e.target.value) })}
                      placeholder="200"
                      data-testid="input-max-discount"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usageLimit">Usage Limit</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      value={couponForm.usageLimit}
                      onChange={(e) => setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })}
                      placeholder="100"
                      data-testid="input-usage-limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignmentType">Assignment Type</Label>
                    <Select
                      value={couponForm.assignmentType}
                      onValueChange={(value: "all" | "specific") => setCouponForm({ ...couponForm, assignmentType: value })}
                    >
                      <SelectTrigger data-testid="select-assignment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="specific">Specific Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">Valid From *</Label>
                    <Input
                      id="validFrom"
                      type="datetime-local"
                      value={couponForm.validFrom}
                      onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                      data-testid="input-valid-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Valid Until *</Label>
                    <Input
                      id="validUntil"
                      type="datetime-local"
                      value={couponForm.validUntil}
                      onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                      data-testid="input-valid-until"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={couponForm.isActive}
                    onCheckedChange={(checked) => setCouponForm({ ...couponForm, isActive: checked })}
                    data-testid="toggle-coupon-active"
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCoupon} disabled={createCouponMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Coupon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Percent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-coupons">
                  {coupons.length}
                </p>
                <p className="text-xs text-muted-foreground">Total Coupons</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active-coupons">
                  {coupons.filter(c => getStatusText(c) === "Active").length}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-scheduled-coupons">
                  {coupons.filter(c => getStatusText(c) === "Scheduled").length}
                </p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-destructive/20 rounded-lg flex items-center justify-center">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-expired-coupons">
                  {coupons.filter(c => getStatusText(c) === "Expired").length}
                </p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search coupons by code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coupons List */}
      <div className="space-y-4">
        {filteredCoupons.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Percent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Coupons Found</h3>
              <p className="text-muted-foreground">
                {coupons.length === 0
                  ? "No coupons have been created for this canteen yet."
                  : "No coupons match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCoupons.map((coupon) => (
            <Card key={coupon.id} className="hover:shadow-lg transition-shadow" data-testid={`coupon-card-${coupon.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Percent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{coupon.code}</h4>
                      <p className="text-sm text-muted-foreground">{coupon.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(coupon)} data-testid={`status-${coupon.id}`}>
                      {getStatusText(coupon)}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleCouponStatus(coupon.id)}
                      data-testid={`toggle-${coupon.id}`}
                    >
                      {coupon.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Discount</p>
                    <p className="font-medium">
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}%`
                        : `₹${coupon.discountValue}`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Usage</p>
                    <p className="font-medium">{coupon.usedCount} / {coupon.usageLimit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valid From</p>
                    <p className="font-medium">{format(new Date(coupon.validFrom), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valid Until</p>
                    <p className="font-medium">{format(new Date(coupon.validUntil), "MMM dd, yyyy")}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{coupon.assignmentType === "all" ? "All Users" : `${coupon.assignedUsers?.length || 0} Users`}</span>
                    </span>
                    {(coupon.minimumOrderAmount ?? 0) > 0 && (
                      <span className="flex items-center space-x-1">
                        <IndianRupee className="h-3 w-3" />
                        <span>Min ₹{coupon.minimumOrderAmount}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewUsage(coupon)}
                      data-testid={`usage-${coupon.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Usage
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditCoupon(coupon)}
                      data-testid={`edit-${coupon.id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          data-testid={`delete-${coupon.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the coupon "{coupon.code}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCoupon(coupon.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Coupon Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-background">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
            <DialogDescription>
              Update the coupon details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Coupon Code *</Label>
                <Input
                  id="edit-code"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., WELCOME20"
                  data-testid="input-edit-coupon-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description *</Label>
                <Input
                  id="edit-description"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  placeholder="e.g., Welcome discount"
                  data-testid="input-edit-coupon-description"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-discountType">Discount Type</Label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(value: "percentage" | "fixed") => setCouponForm({ ...couponForm, discountType: value })}
                >
                  <SelectTrigger data-testid="select-edit-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-discountValue">Discount Value *</Label>
                <Input
                  id="edit-discountValue"
                  type="number"
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                  placeholder={couponForm.discountType === "percentage" ? "20" : "50"}
                  data-testid="input-edit-discount-value"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-usageLimit">Usage Limit</Label>
                <Input
                  id="edit-usageLimit"
                  type="number"
                  value={couponForm.usageLimit}
                  onChange={(e) => setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })}
                  placeholder="100"
                  data-testid="input-edit-usage-limit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-assignmentType">Assignment Type</Label>
                <Select
                  value={couponForm.assignmentType}
                  onValueChange={(value: "all" | "specific") => setCouponForm({ ...couponForm, assignmentType: value })}
                >
                  <SelectTrigger data-testid="select-edit-assignment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="specific">Specific Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={couponForm.isActive}
                onCheckedChange={(checked) => setCouponForm({ ...couponForm, isActive: checked })}
                data-testid="toggle-edit-coupon-active"
              />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCoupon} disabled={updateCouponMutation.isPending}>
              <Edit className="h-4 w-4 mr-2" />
              Update Coupon
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage History Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-background">
          <DialogHeader>
            <DialogTitle>Coupon Usage History</DialogTitle>
            <DialogDescription>
              View the usage history for "{selectedCouponForUsage?.code}".
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {selectedCouponForUsage?.usageHistory?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No usage history available for this coupon.
                </div>
              ) : (
                selectedCouponForUsage?.usageHistory?.map((usage, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Order #{usage.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        User ID: {usage.userId} • {format(new Date(usage.usedAt), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₹{usage.discountAmount}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setUsageDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
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
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Calendar, Users, Percent, IndianRupee, Clock, Eye, UserPlus, History, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { getUserIdFromStorage } from "@/utils/userStorage";

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

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  identifier?: string;
  department?: string;
  createdAt: string;
}

interface UsageDetails {
  totalUsed: number;
  usersWhoUsed: User[];
  usageHistory: CouponUsageHistory[];
  assignedUsers?: User[];
}

interface CouponForm {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maxDiscountAmount: number;
  usageLimit: number;
  validFrom: string;
  validUntil: string;
  assignmentType: 'all' | 'specific';
  assignedUsers: number[];
  canteenId: string;
}

export default function AdminCouponManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showUsageDialog, setShowUsageDialog] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [formData, setFormData] = useState<CouponForm>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minimumOrderAmount: 0,
    maxDiscountAmount: 0,
    usageLimit: 100,
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // 30 days from now
    assignmentType: 'all',
    assignedUsers: [],
    canteenId: ''
  });

  const queryClient = useQueryClient();
  
  // Get user ID from localStorage (assuming the user is logged in as admin)
  const getCurrentUserId = () => {
    return getUserIdFromStorage() || 1; // fallback admin ID
  };

  // Fetch coupons
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['/api/coupons'],
    queryFn: () => fetch('/api/coupons').then(res => res.json())
  });

  // Fetch canteens for selection
  const { data: canteensData } = useQuery({
    queryKey: ['/api/system-settings/canteens'],
    queryFn: () => fetch('/api/system-settings/canteens').then(res => res.json())
  });

  const canteens = canteensData?.canteens || [];

  // Fetch users for assignment
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/admin/users', { search: userSearchTerm, role: selectedRole }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userSearchTerm) params.set('search', userSearchTerm);
      if (selectedRole && selectedRole !== 'all') params.set('role', selectedRole);
      return fetch(`/api/admin/users?${params.toString()}`).then(res => res.json());
    },
    enabled: showAssignDialog !== null
  });

  // Fetch coupon usage details
  const { data: usageData, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['/api/coupons', showUsageDialog, 'usage'],
    queryFn: () => fetch(`/api/coupons/${showUsageDialog}/usage`).then(res => res.json()),
    enabled: !!showUsageDialog
  });

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: (data: CouponForm) => apiRequest('/api/coupons', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        createdBy: getCurrentUserId(),
        minimumOrderAmount: data.minimumOrderAmount || undefined,
        maxDiscountAmount: data.maxDiscountAmount || undefined,
        assignmentType: data.assignmentType || 'all',
        assignedUsers: data.assignedUsers || [],
        canteenId: data.canteenId
      })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      setShowCreateDialog(false);
      resetForm();
      alert('Coupon created successfully!');
    },
    onError: (error: any) => {
      console.error('Error creating coupon:', error);
      alert(error.message || 'Failed to create coupon. Please try again.');
    }
  });

  // Update coupon mutation
  const updateCouponMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CouponForm> }) => 
      apiRequest(`/api/coupons/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
          minimumOrderAmount: data.minimumOrderAmount || undefined,
          maxDiscountAmount: data.maxDiscountAmount || undefined,
          assignmentType: data.assignmentType || 'all',
          assignedUsers: data.assignedUsers || [],
          canteenId: data.canteenId
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      setEditingCoupon(null);
      resetForm();
      alert('Coupon updated successfully!');
    },
    onError: (error: any) => {
      console.error('Error updating coupon:', error);
      alert(error.message || 'Failed to update coupon. Please try again.');
    }
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/coupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      },
    onError: (error: any) => {
      }
  });

  // Toggle coupon status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/coupons/${id}/toggle`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      },
    onError: (error: any) => {
      }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrderAmount: 0,
      maxDiscountAmount: 0,
      usageLimit: 100,
      validFrom: new Date().toISOString().slice(0, 16),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      assignmentType: 'all',
      assignedUsers: [],
      canteenId: ''
    });
  };

  const handleInputChange = (field: keyof CouponForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.canteenId) {
      alert('Please select a canteen');
      return;
    }

    if (new Date(formData.validFrom) >= new Date(formData.validUntil)) {
      alert('Valid from date must be before valid until date');
      return;
    }

    if (editingCoupon) {
      updateCouponMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createCouponMutation.mutate(formData);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderAmount: coupon.minimumOrderAmount || 0,
      maxDiscountAmount: coupon.maxDiscountAmount || 0,
      usageLimit: coupon.usageLimit,
      validFrom: new Date(coupon.validFrom).toISOString().slice(0, 16),
      validUntil: new Date(coupon.validUntil).toISOString().slice(0, 16),
      assignmentType: coupon.assignmentType || 'all',
      assignedUsers: coupon.assignedUsers || [],
      canteenId: (coupon as any).canteenId || ''
    });
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discountType === 'percentage') {
      return `${coupon.discountValue}% off`;
    } else {
      return `₹${coupon.discountValue} off`;
    }
  };

  const getCouponStatusColor = (coupon: Coupon) => {
    if (!coupon.isActive) return 'bg-gray-500';
    
    const now = new Date();
    const validUntil = new Date(coupon.validUntil);
    
    if (now > validUntil) return 'bg-red-500';
    if (coupon.usedCount >= coupon.usageLimit) return 'bg-orange-500';
    
    return 'bg-green-500';
  };

  const getCouponStatusText = (coupon: Coupon) => {
    if (!coupon.isActive) return 'Inactive';
    
    const now = new Date();
    const validUntil = new Date(coupon.validUntil);
    
    if (now > validUntil) return 'Expired';
    if (coupon.usedCount >= coupon.usageLimit) return 'Limit Reached';
    
    return 'Active';
  };

  // Assign coupon to users mutation
  const assignCouponMutation = useMutation({
    mutationFn: ({ couponId, userIds }: { couponId: string; userIds: number[] }) => 
      apiRequest(`/api/coupons/${couponId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userIds })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
      setShowAssignDialog(null);
      setSelectedUsers([]);
      },
    onError: (error: any) => {
      }
  });

  // Handle user selection for assignment
  const handleUserSelection = (userId: number, checked: boolean) => {
    setSelectedUsers(prev => 
      checked ? [...prev, userId] : prev.filter(id => id !== userId)
    );
  };

  // Handle assign all selected users
  const handleAssignUsers = () => {
    if (showAssignDialog && selectedUsers.length > 0) {
      assignCouponMutation.mutate({ 
        couponId: showAssignDialog, 
        userIds: selectedUsers 
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Coupon Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage discount coupons</p>
        </div>
        
        <Dialog open={showCreateDialog || !!editingCoupon} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingCoupon(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </DialogTitle>
              <DialogDescription>
                {editingCoupon ? 'Update the coupon details' : 'Create a new discount coupon for customers'}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {/* Canteen Selection */}
                <div className="space-y-2">
                  <Label htmlFor="canteenId">Canteen *</Label>
                  <Select value={formData.canteenId} onValueChange={(value) => handleInputChange('canteenId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a canteen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">🌍 Global (All Canteens)</span>
                        </div>
                      </SelectItem>
                      <Separator className="my-2" />
                      {canteens.map((canteen: any) => (
                        <SelectItem key={canteen.id} value={canteen.id}>
                          {canteen.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.canteenId === 'GLOBAL' && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      ℹ️ This coupon will be valid across all canteens
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Coupon Code *</Label>
                    <Input
                      id="code"
                      placeholder="e.g., WELCOME10"
                      value={formData.code}
                      onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountType">Discount Type *</Label>
                    <Select value={formData.discountType} onValueChange={(value: 'percentage' | 'fixed') => handleInputChange('discountType', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the coupon"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">
                      Discount Value * {formData.discountType === 'percentage' ? '(%)' : '(₹)'}
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      min="1"
                      max={formData.discountType === 'percentage' ? 100 : undefined}
                      value={formData.discountValue}
                      onChange={(e) => handleInputChange('discountValue', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usageLimit">Usage Limit *</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      min="1"
                      placeholder="e.g., 100"
                      value={formData.usageLimit}
                      onChange={(e) => handleInputChange('usageLimit', Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minimumOrderAmount">Minimum Order Amount (₹)</Label>
                    <Input
                      id="minimumOrderAmount"
                      type="number"
                      min="0"
                      value={formData.minimumOrderAmount}
                      onChange={(e) => handleInputChange('minimumOrderAmount', Number(e.target.value))}
                    />
                  </div>
                  {formData.discountType === 'percentage' && (
                    <div className="space-y-2">
                      <Label htmlFor="maxDiscountAmount">Max Discount Amount (₹)</Label>
                      <Input
                        id="maxDiscountAmount"
                        type="number"
                        min="0"
                        value={formData.maxDiscountAmount}
                        onChange={(e) => handleInputChange('maxDiscountAmount', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">Valid From *</Label>
                    <Input
                      id="validFrom"
                      type="datetime-local"
                      value={formData.validFrom}
                      onChange={(e) => handleInputChange('validFrom', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Valid Until *</Label>
                    <Input
                      id="validUntil"
                      type="datetime-local"
                      value={formData.validUntil}
                      onChange={(e) => handleInputChange('validUntil', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignmentType">Assignment Type *</Label>
                  <Select value={formData.assignmentType} onValueChange={(value: 'all' | 'specific') => handleInputChange('assignmentType', value)}>
                    <SelectTrigger data-testid="select-assignment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Available to All Users</SelectItem>
                      <SelectItem value="specific">Assign to Specific Users</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.assignmentType === 'specific' && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Note: You can assign users to this coupon after creating it
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setEditingCoupon(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createCouponMutation.isPending || updateCouponMutation.isPending}>
                {createCouponMutation.isPending || updateCouponMutation.isPending ? 'Saving...' : (editingCoupon ? 'Update' : 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Percent className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No coupons yet</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Create your first discount coupon to start offering deals to customers
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Coupon
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon: Coupon) => (
            <Card key={coupon.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-mono">{coupon.code}</CardTitle>
                    <Badge className={`${getCouponStatusColor(coupon)} text-white text-xs`}>
                      {getCouponStatusText(coupon)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {getDiscountDisplay(coupon)}
                    </div>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {coupon.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4 mr-1" />
                    Used: {coupon.usedCount}/{coupon.usageLimit}
                  </div>
                  <div className="text-right text-gray-600 dark:text-gray-400">
                    {Math.round((coupon.usedCount / coupon.usageLimit) * 100)}%
                  </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(coupon.usedCount / coupon.usageLimit) * 100}%` }}
                  ></div>
                </div>

                {coupon.minimumOrderAmount && coupon.minimumOrderAmount > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Min order: ₹{coupon.minimumOrderAmount}
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4 mr-1" />
                  Valid until {format(new Date(coupon.validUntil), "MMM dd, yyyy")}
                </div>

                {/* Assignment type display */}
                {coupon.assignmentType === 'specific' && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                    Assigned to {coupon.assignedUsers?.length || 0} specific user(s)
                  </div>
                )}

                {/* Global coupon indicator */}
                {(coupon as any).canteenId === 'GLOBAL' && (
                  <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-medium">
                    🌍 Global - Valid in all canteens
                  </div>
                )}

                <div className="flex flex-col space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUsageDialog(coupon.id)}
                        data-testid={`button-view-usage-${coupon.id}`}
                        title="View detailed usage information"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAssignDialog(coupon.id);
                          // Pre-select currently assigned users
                          setSelectedUsers(coupon.assignedUsers || []);
                        }}
                        data-testid={`button-assign-users-${coupon.id}`}
                        title="Assign to specific users"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(coupon)}
                        disabled={updateCouponMutation.isPending}
                        data-testid={`button-edit-${coupon.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate(coupon.id)}
                        disabled={toggleStatusMutation.isPending}
                        data-testid={`button-toggle-${coupon.id}`}
                      >
                        {coupon.isActive ? (
                          <ToggleRight className="w-4 h-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={deleteCouponMutation.isPending}
                          data-testid={`button-delete-${coupon.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
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
                          <AlertDialogAction onClick={() => deleteCouponMutation.mutate(coupon.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Details Dialog */}
      <Dialog open={!!showUsageDialog} onOpenChange={() => setShowUsageDialog(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Coupon Usage Details
            </DialogTitle>
            <DialogDescription>
              {showUsageDialog && coupons.find((c: Coupon) => c.id === showUsageDialog)?.code && 
                `Detailed usage information for coupon "${coupons.find((c: Coupon) => c.id === showUsageDialog)?.code}"`
              }
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingUsage ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : usageData && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="users">Users Who Used</TabsTrigger>
                  <TabsTrigger value="history">Usage History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">{usageData.usageDetails?.totalUsed || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Uses</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">{usageData.usageDetails?.usersWhoUsed?.length || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Unique Users</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {usageData.coupon?.assignmentType === 'specific' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Assignment Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">Assignment Type:</span> Specific Users Only
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Assigned Users:</span> {usageData.usageDetails?.assignedUsers?.length || 0}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Users Who Used:</span> {usageData.usageDetails?.usersWhoUsed?.length || 0} of {usageData.usageDetails?.assignedUsers?.length || 0} assigned
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="users" className="mt-4">
                  {usageData.usageDetails?.usersWhoUsed?.length ? (
                    <div className="space-y-2">
                      {usageData.usageDetails.usersWhoUsed.map((user: User) => (
                        <Card key={user.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                                <div className="text-xs text-gray-500">
                                  {user.role === 'student' ? `Student • ${user.identifier}` : `Staff • ${user.identifier}`}
                                  {user.department && ` • ${user.department}`}
                                </div>
                              </div>
                              <Badge variant="secondary">{user.role}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No users have used this coupon yet
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="history" className="mt-4">
                  {usageData.usageDetails?.usageHistory?.length ? (
                    <div className="space-y-3">
                      {usageData.usageDetails.usageHistory.map((usage: CouponUsageHistory, index: number) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="font-medium">Order #{usage.orderNumber}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  User ID: {usage.userId}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {format(new Date(usage.usedAt), "MMM dd, yyyy 'at' HH:mm")}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">-₹{usage.discountAmount}</div>
                                <div className="text-xs text-gray-500">Discount Applied</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No usage history available
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* User Assignment Dialog */}
      <Dialog open={!!showAssignDialog} onOpenChange={() => {
        setShowAssignDialog(null);
        setSelectedUsers([]);
        setUserSearchTerm('');
        setSelectedRole('all');
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Assign Coupon to Users
            </DialogTitle>
            <DialogDescription>
              {showAssignDialog && coupons.find((c: Coupon) => c.id === showAssignDialog)?.code && 
                `Select users to assign the coupon "${coupons.find((c: Coupon) => c.id === showAssignDialog)?.code}" to`
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Search and Filter Controls */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, register number..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-user-search"
                  />
                </div>
              </div>
              <div className="w-32">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-role-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedUsers.length} user(s) selected for assignment
                </div>
                {showAssignDialog && coupons.find((c: Coupon) => c.id === showAssignDialog)?.assignedUsers?.length && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ({coupons.find((c: Coupon) => c.id === showAssignDialog)?.assignedUsers?.length || 0} currently assigned)
                  </div>
                )}
              </div>
            )}
          </div>
          
          <ScrollArea className="max-h-[50vh] pr-4">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : users.length ? (
              <div className="space-y-2">
                {users.map((user: User) => (
                  <Card key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={(checked) => handleUserSelection(user.id, !!checked)}
                            data-testid={`checkbox-user-${user.id}`}
                          />
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                            <div className="text-xs text-gray-500">
                              {user.role === 'student' ? `Student • ${user.identifier}` : `Staff • ${user.identifier}`}
                              {user.department && ` • ${user.department}`}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">{user.role}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No users found matching your search criteria
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAssignDialog(null);
                setSelectedUsers([]);
                setUserSearchTerm('');
                setSelectedRole('all');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignUsers}
              disabled={selectedUsers.length === 0 || assignCouponMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignCouponMutation.isPending ? 'Assigning...' : `Assign to ${selectedUsers.length} user(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
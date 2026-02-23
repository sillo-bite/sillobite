import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Pagination } from "@/components/ui/pagination";
import {
  ArrowLeft, Search, Filter, Plus, Edit, Trash2, Mail, Phone,
  MapPin, Star, Ban, Shield, Users, UserCheck, UserX,
  MessageSquare, CreditCard, Gift, AlertTriangle, School, Briefcase, RefreshCcw, Download, BarChart3, User,
  Calendar, ShoppingBag, Receipt, Settings
} from "lucide-react";
import { getDepartmentFullName, getStudyYearDisplay } from "@shared/utils";
import { useActiveColleges, useDepartmentsByCollege } from "@/hooks/useColleges";

export default function AdminUserManagementPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch active colleges and departments
  const { data: collegesData } = useActiveColleges();

  // Fetch organizations
  const { data: organizationsData } = useQuery({
    queryKey: ['/api/system-settings/organizations'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings/organizations');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const [activeTab, setActiveTab] = useState("all-users");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterCollege, setFilterCollege] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  // Get departments for selected college
  const { data: departmentsByCollegeData } = useDepartmentsByCollege(
    filterCollege !== "all" ? filterCollege : undefined
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });
  const [editDialog, setEditDialog] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });
  const [userDetailsDialog, setUserDetailsDialog] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: '',
    registerNumber: '',
    college: '',
    department: '',
    joiningYear: '',
    passingOutYear: '',
    currentStudyYear: '',
    staffId: ''
  });

  // Fetch paginated users from database with filtering
  const { data: usersData, isLoading, refetch, error: usersError } = useQuery({
    queryKey: ['/api/users/paginated', currentPage, itemsPerPage, searchTerm, filterRole, filterCollege, filterDepartment, filterYear],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterRole !== 'all' && { role: filterRole }),
        ...(filterCollege !== 'all' && { college: filterCollege }),
        ...(filterDepartment !== 'all' && { department: filterDepartment }),
        ...(filterYear !== 'all' && { year: filterYear })
      });

      const response = await fetch(`/api/users/paginated?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    refetchInterval: false, // Disabled automatic refresh
    staleTime: 30000, // Data is fresh for 30 seconds
  });

  const users: any[] = usersData?.users || [];
  const totalPages = usersData?.totalPages || 0;
  const totalCount = usersData?.totalCount || 0;

  // Use optimized dashboard stats for statistics
  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Mock data for user management page to avoid breaking existing functionality
  const analyticsData = dashboardStats || { totalRevenue: 0, totalUsers: 0, totalOrders: 0 };
  const ordersData: any[] = [];
  const analyticsLoading = statsLoading;
  const ordersLoading = statsLoading;

  // Fetch all payments data for spending analysis
  const { data: paymentsData = [], isLoading: paymentsLoading, refetch: refetchPayments } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    queryFn: async () => {
      const response = await fetch('/api/payments');
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: false,
  });

  // Real complaints data from API
  const { data: complaintsData = [], isLoading: complaintsLoading, refetch: refetchComplaints } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
    refetchInterval: false, // Refresh every minute
  });

  const [complaints, setComplaints] = useState<any[]>(complaintsData);

  // Update complaints when API data changes
  useEffect(() => {
    setComplaints(complaintsData);
  }, [complaintsData]);

  // User-specific data queries for details popup
  const { data: userOrders = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userDetailsDialog.user?.id, 'orders'],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userDetailsDialog.user.id}/orders`);
      if (!response.ok) throw new Error('Failed to fetch user orders');
      return response.json();
    },
    enabled: !!userDetailsDialog.user?.id,
  });

  const { data: userPayments = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userDetailsDialog.user?.id, 'payments'],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userDetailsDialog.user.id}/payments`);
      if (!response.ok) throw new Error('Failed to fetch user payments');
      return response.json();
    },
    enabled: !!userDetailsDialog.user?.id,
  });

  const { data: userComplaints = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userDetailsDialog.user?.id, 'complaints'],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userDetailsDialog.user.id}/complaints`);
      if (!response.ok) throw new Error('Failed to fetch user complaints');
      return response.json();
    },
    enabled: !!userDetailsDialog.user?.id,
  });

  // Combined loading state
  const isDataLoading = isLoading || analyticsLoading || ordersLoading || paymentsLoading || complaintsLoading;

  // Calculate real user spending data
  const userSpendingData = users.map(user => {
    const userOrders = ordersData.filter(order => order.userId === user.id);
    const userPayments = paymentsData.filter(payment => payment.userId === user.id && payment.status === 'success');
    const totalSpending = userOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const orderCount = userOrders.length;
    const avgOrderValue = orderCount > 0 ? totalSpending / orderCount : 0;

    return {
      ...user,
      totalSpending,
      orderCount,
      avgOrderValue,
      userOrders,
      userPayments
    };
  });

  // Calculate real revenue by user type
  const calculateRealRevenueByType = () => {
    const studentSpending = userSpendingData.filter(u => u.role === 'student').reduce((sum, u) => sum + u.totalSpending, 0);
    const employeeSpending = userSpendingData.filter(u => u.role === 'employee').reduce((sum, u) => sum + u.totalSpending, 0);
    const contractorSpending = userSpendingData.filter(u => u.role === 'contractor').reduce((sum, u) => sum + u.totalSpending, 0);
    const visitorSpending = userSpendingData.filter(u => u.role === 'visitor').reduce((sum, u) => sum + u.totalSpending, 0);
    const guestSpending = userSpendingData.filter(u => u.role === 'guest').reduce((sum, u) => sum + u.totalSpending, 0);
    const staffSpending = userSpendingData.filter(u => u.role === 'staff').reduce((sum, u) => sum + u.totalSpending, 0);
    const canteenOwnerSpending = userSpendingData.filter(u => u.role === 'canteen_owner' || u.role === 'canteen-owner').reduce((sum, u) => sum + u.totalSpending, 0);
    const adminSpending = userSpendingData.filter(u => u.role === 'admin').reduce((sum, u) => sum + u.totalSpending, 0);

    return {
      studentRevenue: studentSpending,
      employeeRevenue: employeeSpending,
      contractorRevenue: contractorSpending,
      visitorRevenue: visitorSpending,
      guestRevenue: guestSpending,
      staffRevenue: staffSpending,
      canteenOwnerRevenue: canteenOwnerSpending,
      adminRevenue: adminSpending,
      totalCalculatedRevenue: studentSpending + employeeSpending + contractorSpending + visitorSpending + guestSpending + staffSpending + canteenOwnerSpending + adminSpending
    };
  };

  const realRevenue = calculateRealRevenueByType();

  // Refresh all data function
  const refreshAllData = async () => {
    try {
      await Promise.all([
        refetch(),
        refetchStats(),
        refetchPayments()
      ]);

      // Invalidate query cache to force fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });

    } catch (error) {
    }
  };

  const handleUserAction = async (userId: number, action: string) => {
    try {
      const statusToUpdate = action === 'suspend' ? 'Suspended' : 'Active';

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: statusToUpdate }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      await refetch(); // Refresh data
    } catch (error) {
    }
  };

  const handleUserUpdate = async (userId: number, userData: any, userName: string) => {
    try {
      console.log('🔄 Starting user update for:', { userId, userName, newRole: userData.role });

      // Prepare the update data
      const updateData: any = {
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber || null,
        role: userData.role,
        college: userData.college || null,
      };

      // Add role-specific fields
      if (userData.role === 'student') {
        updateData.registerNumber = userData.registerNumber || null;
        updateData.department = userData.department || null;
        updateData.joiningYear = userData.joiningYear ? parseInt(userData.joiningYear) : null;
        updateData.passingOutYear = userData.passingOutYear ? parseInt(userData.passingOutYear) : null;
        updateData.currentStudyYear = userData.currentStudyYear ? parseInt(userData.currentStudyYear) : null;
        updateData.staffId = null; // Clear staff fields
      } else if (userData.role === 'staff') {
        updateData.staffId = userData.staffId || null;
        updateData.registerNumber = null; // Clear student fields
        updateData.department = null;
        updateData.joiningYear = null;
        updateData.passingOutYear = null;
        updateData.currentStudyYear = null;
      } else if (userData.role === 'employee' || userData.role === 'guest' || userData.role === 'contractor' || userData.role === 'visitor') {
        updateData.registerNumber = userData.staffId || null; // Use staffId field value for registerNumber
        updateData.staffId = null; // Clear staff field
        updateData.department = null;
        updateData.joiningYear = null;
        updateData.passingOutYear = null;
        updateData.currentStudyYear = null;
      } else {
        // For admin, super_admin and canteen_owner, clear all role-specific fields
        updateData.registerNumber = null;
        updateData.department = null;
        updateData.joiningYear = null;
        updateData.passingOutYear = null;
        updateData.currentStudyYear = null;
        updateData.staffId = null;
      }

      console.log('📋 Sending update request:', updateData);

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('📨 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Update failed with error:', errorData);
        throw new Error(errorData.message || 'Failed to update user');
      }

      const updatedUser = await response.json();
      console.log('✅ User updated successfully:', updatedUser);

      setEditDialog({ open: false, user: null });

      // Force cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await refetch(); // Also explicitly refetch
    } catch (error: any) {
    }
  };

  const canChangeRole = (currentRole: string, newRole: string) => {
    // Staff cannot change to student and vice versa
    if ((currentRole === 'staff' && newRole === 'student') ||
      (currentRole === 'student' && newRole === 'staff')) {
      return false;
    }
    return true;
  };

  const getAvailableRoles = (currentRole: string) => {
    const allRoles = ['admin', 'super_admin', 'canteen_owner', 'student', 'staff', 'employee', 'guest', 'contractor', 'visitor'];
    return allRoles.filter(role => canChangeRole(currentRole, role));
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    try {
      console.log('🗑️ Starting user deletion for:', { userId, userName });

      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });

      console.log('📨 Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Delete failed with error:', errorData);
        throw new Error('Failed to delete user');
      }

      const result = await response.json();
      console.log('✅ User deleted successfully:', result);

      setDeleteDialog({ open: false, user: null });

      // Force cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await refetch(); // Also explicitly refetch
    } catch (error) {
    }
  };

  // Block/Unblock user functions
  const handleBlockUser = async (userId: number, userName: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method: 'PUT',
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
    }
  };

  const handleUnblockUser = async (userId: number, userName: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/unblock`, {
        method: 'PUT',
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      } else {
        throw new Error('Failed to unblock user');
      }
    } catch (error) {
    }
  };

  // Reset department filter when college changes
  useEffect(() => {
    if (filterCollege === "all") {
      setFilterDepartment("all");
    }
  }, [filterCollege]);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterCollege, filterDepartment, filterYear]);

  // Pagination is now handled server-side

  // Pagination handlers
  const goToPage = (page: number) => setCurrentPage(page);
  const goToNextPage = () => setCurrentPage(Math.min(currentPage + 1, totalPages));
  const goToPreviousPage = () => setCurrentPage(Math.max(currentPage - 1, 1));
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);

  // Calculate real statistics from live data
  const stats = {
    totalUsers: totalCount, // Use total count from API
    activeUsers: users.filter(u => u.status === "Active" || !u.status).length, // Default to active if no status
    suspendedUsers: users.filter(u => u.status === "Suspended" || u.status === "Banned").length,
    newUsersThisMonth: users.filter(u => {
      const createdDate = new Date(u.createdAt);
      const now = new Date();
      return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
    }).length,
    totalRevenue: analyticsData?.totalRevenue || realRevenue.totalCalculatedRevenue,
    avgOrderValue: analyticsData?.averageOrderValue || (ordersData.length > 0 ? realRevenue.totalCalculatedRevenue / ordersData.length : 0),
    totalOrders: analyticsData?.totalOrders || ordersData.length,
    // User role breakdown
    students: users.filter(u => u.role === 'student').length,
    employees: users.filter(u => u.role === 'employee').length,
    contractors: users.filter(u => u.role === 'contractor').length,
    visitors: users.filter(u => u.role === 'visitor').length,
    guests: users.filter(u => u.role === 'guest').length,
    canteenOwner: users.filter(u => u.role === 'canteen_owner' || u.role === 'canteen-owner').length,
    staff: users.filter(u => u.role === 'staff').length,
    admins: users.filter(u => {
      const role = (u.role || '').toLowerCase();
      return role === 'admin' || role === 'super admin' || role === 'super_admin' || role === 'superadmin';
    }).length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/admin")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">User Management</h1>
              <p className="text-sm text-muted-foreground">Manage customers, staff, and administrators • Live data syncing</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={refreshAllData}
            disabled={isDataLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCcw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
            <span>{isDataLoading ? 'Syncing...' : 'Refresh Data'}</span>
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all-users" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>All Users</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Complaints</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-actions" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Bulk Actions</span>
            </TabsTrigger>
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="all-users" className="mt-6">
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Users</p>
                        <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-5 h-5 text-success" />
                      <div>
                        <p className="text-sm text-muted-foreground">Active</p>
                        <p className="text-2xl font-bold">{stats.activeUsers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <UserX className="w-5 h-5 text-warning" />
                      <div>
                        <p className="text-sm text-muted-foreground">Suspended</p>
                        <p className="text-2xl font-bold">{stats.suspendedUsers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Plus className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">New This Month</p>
                        <p className="text-2xl font-bold">{stats.newUsersThisMonth}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Search and Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                          <Input
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                            data-testid="input-search-users"
                          />
                        </div>
                      </div>
                      <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="w-40" data-testid="select-filter-role">
                          <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                          <SelectItem value="visitor">Visitor</SelectItem>
                          <SelectItem value="canteen_owner">Canteen Owner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Student-specific filters and Add User button */}
                    {(filterRole === "student" || filterRole === "all") && (
                      <div className="flex flex-col md:flex-row gap-4 pt-2 border-t items-start md:items-center">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <School className="w-4 h-4" />
                          <span>Student Filters:</span>
                        </div>
                        <Select value={filterCollege} onValueChange={setFilterCollege}>
                          <SelectTrigger className="w-48" data-testid="select-filter-college">
                            <SelectValue placeholder="Filter by college" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Colleges</SelectItem>
                            {collegesData?.colleges?.map((college) => (
                              <SelectItem key={college.id} value={college.id}>
                                {college.code} - {college.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={filterDepartment}
                          onValueChange={setFilterDepartment}
                          disabled={filterCollege === "all"}
                        >
                          <SelectTrigger className="w-48" data-testid="select-filter-department">
                            <SelectValue placeholder={filterCollege === "all" ? "Select college first" : "Filter by department"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {filterCollege !== "all" && departmentsByCollegeData?.departments?.map((dept) => (
                              <SelectItem key={dept.code} value={dept.code}>
                                {dept.code} - {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={filterYear} onValueChange={setFilterYear}>
                          <SelectTrigger className="w-36" data-testid="select-filter-year">
                            <SelectValue placeholder="Filter by year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            <SelectItem value="1st">1st Year</SelectItem>
                            <SelectItem value="2nd">2nd Year</SelectItem>
                            <SelectItem value="3rd">3rd Year</SelectItem>
                            <SelectItem value="4th">4th Year</SelectItem>
                          </SelectContent>
                        </Select>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="food" size="sm" className="ml-auto">
                              <Plus className="w-4 h-4 mr-1" />
                              Add User
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New User</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Name</Label>
                                  <Input placeholder="Full name" />
                                </div>
                                <div>
                                  <Label>Email</Label>
                                  <Input placeholder="email@institution.edu" />
                                </div>
                                <div>
                                  <Label>Phone</Label>
                                  <Input placeholder="+91 XXXXXXXXXX" />
                                </div>
                                <div>
                                  <Label>Role</Label>
                                  <Select>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="student">Student</SelectItem>
                                      <SelectItem value="staff">Staff</SelectItem>
                                      <SelectItem value="employee">Employee</SelectItem>
                                      <SelectItem value="guest">Guest</SelectItem>
                                      <SelectItem value="contractor">Contractor</SelectItem>
                                      <SelectItem value="visitor">Visitor</SelectItem>
                                      <SelectItem value="canteen_owner">Canteen Owner</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      {/* Only show Super Admin option if no super admin exists */}
                                      {!users.some(u => u.role === 'super_admin') && (
                                        <SelectItem value="super_admin">Super Admin</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>College/Organization</Label>
                                  <Select>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select college or organization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <optgroup label="Colleges">
                                        {collegesData?.colleges?.filter(college => college.isActive).map(college => (
                                          <SelectItem key={college.id} value={college.id}>
                                            {college.name} ({college.code})
                                          </SelectItem>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Organizations">
                                        {organizationsData?.organizations?.filter((org: any) => org.isActive).map((org: any) => (
                                          <SelectItem key={org.id} value={org.id}>
                                            {org.name} ({org.code})
                                          </SelectItem>
                                        ))}
                                      </optgroup>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label>Address</Label>
                                <Textarea placeholder="Enter address" />
                              </div>
                              <Button variant="food" className="w-full" onClick={async () => {
                                try {
                                  // TODO: Implement actual user creation via API
                                  // const response = await fetch('/api/users', {
                                  //   method: 'POST',
                                  //   headers: { 'Content-Type': 'application/json' },
                                  //   body: JSON.stringify(newUserData)
                                  // });
                                } catch (error) {
                                }
                              }}>
                                Add User
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card>
                <CardHeader>
                  <CardTitle>Users ({totalCount})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setUserDetailsDialog({ open: true, user })}
                        data-testid={`user-card-${user.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={user.avatar} alt={user.name} />
                              <AvatarFallback>{user.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold">{user.name}</h3>
                                <Badge variant={user.status === "Active" ? "default" : user.status === "Suspended" ? "destructive" : "secondary"}>
                                  {user.status || "Active"}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {user.role?.replace('_', ' ') || 'student'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <Mail className="w-3 h-3" />
                                  <span>{user.email}</span>
                                </div>
                                {user.phoneNumber && (
                                  <div className="flex items-center space-x-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{user.phoneNumber}</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>{user.role?.replace('_', ' ') || 'student'}</span>
                                </div>

                                {/* Student/Employee/Contractor/Visitor/Guest specific information */}
                                {(user.role === 'student' || user.role === 'employee' || user.role === 'contractor' || user.role === 'visitor' || user.role === 'guest') && user.registerNumber && (
                                  <div className="flex items-center space-x-1">
                                    <School className="w-3 h-3" />
                                    <span className="font-mono">{user.registerNumber}</span>
                                  </div>
                                )}
                                {(user.role === 'student' || user.role === 'employee' || user.role === 'contractor' || user.role === 'visitor' || user.role === 'guest') && user.department && (
                                  <div className="flex items-center space-x-1">
                                    <School className="w-3 h-3" />
                                    <span>{user.department} - {getDepartmentFullName(user.department)}</span>
                                  </div>
                                )}

                                {/* Staff specific information */}
                                {user.role === 'staff' && user.staffId && (
                                  <div className="flex items-center space-x-1">
                                    <Briefcase className="w-3 h-3" />
                                    <span className="font-mono">Staff ID: {user.staffId}</span>
                                  </div>
                                )}

                                {/* Organization/College information */}
                                {user.college && (
                                  <div className="flex items-center space-x-1">
                                    <School className="w-3 h-3" />
                                    <span>
                                      {(user.role === 'employee' || user.role === 'contractor' || user.role === 'visitor' || user.role === 'guest') ?
                                        `Org: ${organizationsData?.organizations?.find((org: any) => org.id === user.college)?.name || user.college}` :
                                        `College: ${collegesData?.colleges?.find(college => college.id === user.college)?.name || user.college}`
                                      }
                                    </span>
                                  </div>
                                )}

                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">User ID: </span>
                                  <span className="font-mono text-xs">{user.id}</span>
                                </div>
                                {(user.role === 'student' || user.role === 'employee' || user.role === 'contractor' || user.role === 'visitor' || user.role === 'guest') && user.currentStudyYear && (
                                  <div>
                                    <span className="text-muted-foreground">Year: </span>
                                    <span className="font-medium">{getStudyYearDisplay(user.currentStudyYear)}</span>
                                  </div>
                                )}
                                {(user.role === 'student' || user.role === 'employee' || user.role === 'contractor' || user.role === 'visitor' || user.role === 'guest') && (
                                  <div>
                                    <span className="text-muted-foreground">Status: </span>
                                    <span className="font-medium">{user.isPassed ? 'Alumni' : 'Active'}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col space-y-1">
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                              setEditDialog({ open: true, user });
                              setEditFormData({
                                name: user.name || '',
                                email: user.email || '',
                                phoneNumber: user.phoneNumber || '',
                                role: user.role || '',
                                registerNumber: user.registerNumber || '',
                                college: user.college || '',
                                department: user.department || '',
                                joiningYear: user.joiningYear?.toString() || '',
                                passingOutYear: user.passingOutYear?.toString() || '',
                                currentStudyYear: user.currentStudyYear?.toString() || '',
                                staffId: user.role === 'staff' ? (user.staffId || '') : (user.registerNumber || '')
                              });
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {user.status === "Active" && (
                              <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation(); // Prevent card click
                                handleUserAction(user.id, "suspend");
                              }}>
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            {/* Hide delete button for super admin */}
                            {user.role !== 'super_admin' && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => {
                                e.stopPropagation(); // Prevent card click
                                setDeleteDialog({ open: true, user });
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {users.length === 0 && !isLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        No users found matching your criteria.
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={goToPage}
                      onNextPage={goToNextPage}
                      onPreviousPage={goToPreviousPage}
                      onFirstPage={goToFirstPage}
                      onLastPage={goToLastPage}
                      hasNextPage={currentPage < totalPages}
                      hasPreviousPage={currentPage > 1}
                      totalCount={totalCount}
                      pageSize={itemsPerPage}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="grid gap-6">
              {/* Header with Actions */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">User Analytics Dashboard</h2>
                  <p className="text-sm text-muted-foreground">Real-time insights and user behavior analytics</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={refreshAllData}
                    disabled={isDataLoading}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCcw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csvContent = `Role,Count,Percentage\nStudents,${stats.students},${Math.round((stats.students / stats.totalUsers) * 100)}%\nCanteen Owner,${stats.canteenOwner},${Math.round((stats.canteenOwner / stats.totalUsers) * 100)}%\nStaff,${stats.staff},${Math.round((stats.staff / stats.totalUsers) * 100)}%\nAdmins,${stats.admins},${Math.round((stats.admins / stats.totalUsers) * 100)}%`;
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `user_analytics_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                </div>
              </div>

              {/* Real-time User Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setFilterRole("student");
                  setActiveTab("all-users");
                }}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.students}</div>
                      <div className="text-sm text-muted-foreground">Students</div>
                      <div className="text-xs text-blue-500 mt-1">Click to filter</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setFilterRole("canteen_owner");
                  setActiveTab("all-users");
                }}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.canteenOwner}</div>
                      <div className="text-sm text-muted-foreground">Canteen Owner</div>
                      <div className="text-xs text-green-500 mt-1">Click to filter</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setFilterRole("staff");
                  setActiveTab("all-users");
                }}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.staff}</div>
                      <div className="text-sm text-muted-foreground">Staff</div>
                      <div className="text-xs text-purple-500 mt-1">Click to filter</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setFilterRole("admin");
                  setActiveTab("all-users");
                }}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.admins}</div>
                      <div className="text-sm text-muted-foreground">Admins</div>
                      <div className="text-xs text-red-500 mt-1">Click to filter</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Revenue Analytics</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLocation("/admin/analytics");
                        }}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total Revenue</span>
                        <span className="font-bold text-green-600">₹{stats.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Order Value</span>
                        <span className="font-bold text-blue-600">₹{stats.avgOrderValue}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Orders</span>
                        <span className="font-bold text-purple-600">{stats.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue per User</span>
                        <span className="font-bold text-orange-600">₹{Math.round(stats.totalRevenue / stats.totalUsers) || 0}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const topSpenders = users
                              .slice(0, 3)
                              .map(user => user.name)
                              .join(', ');
                          }}
                        >
                          View Top Contributors
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>User Behavior</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const behaviorData = `User Behavior Report - ${new Date().toLocaleDateString()}\n\nMost Active Role: ${stats.students >= stats.canteenOwner && stats.students >= stats.staff ? 'Students' : stats.canteenOwner >= stats.staff ? 'Canteen Owner' : 'Staff'}\nActive Users: ${stats.activeUsers}\nNew This Month: ${stats.newUsersThisMonth}\nUser Engagement: ${Math.round((stats.activeUsers / stats.totalUsers) * 100) || 0}%\nTotal Revenue: ₹${stats.totalRevenue.toLocaleString()}\nRevenue per User: ₹${Math.round(stats.totalRevenue / stats.totalUsers) || 0}`;
                          const blob = new Blob([behaviorData], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `user_behavior_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Most Active Role</span>
                        <Badge variant="default" className="font-bold">
                          {stats.students >= stats.canteenOwner && stats.students >= stats.staff ? 'Students' :
                            stats.canteenOwner >= stats.staff ? 'Canteen Owner' : 'Staff'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Users</span>
                        <span className="font-bold text-green-600">{stats.activeUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>New This Month</span>
                        <span className="font-bold text-blue-600">{stats.newUsersThisMonth}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>User Engagement</span>
                        <span className="font-bold text-purple-600">{Math.round((stats.activeUsers / stats.totalUsers) * 100) || 0}%</span>
                      </div>
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                          }}
                        >
                          View Detailed Insights
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comprehensive Business Analytics */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Comprehensive Business Analytics</h3>
                </div>

                {/* Revenue Analysis by User Type */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Revenue Analysis by User Type</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const revenueData = `Revenue Analysis by User Type - ${new Date().toLocaleDateString()}\n\nStudents: ₹${realRevenue.studentRevenue.toLocaleString()} (${Math.round((realRevenue.studentRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%)\nStaff: ₹${realRevenue.staffRevenue.toLocaleString()} (${Math.round((realRevenue.staffRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%)\nCanteen Owners: ₹${realRevenue.canteenOwnerRevenue.toLocaleString()} (${Math.round((realRevenue.canteenOwnerRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%)\nAdmins: ₹${realRevenue.adminRevenue.toLocaleString()} (${Math.round((realRevenue.adminRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%)\n\nTotal Revenue: ₹${realRevenue.totalCalculatedRevenue.toLocaleString()}\nAverage per Student: ₹${Math.round(realRevenue.studentRevenue / Math.max(stats.students, 1))}\nAverage per Staff: ₹${Math.round(realRevenue.staffRevenue / Math.max(stats.staff, 1))}\nAverage per Canteen Owner: ₹${Math.round(realRevenue.canteenOwnerRevenue / Math.max(stats.canteenOwner, 1))}`;
                          const blob = new Blob([revenueData], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `revenue_analysis_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export Revenue
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Students Revenue */}
                      <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <School className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-800 dark:text-blue-200">Students</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{stats.students} users</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Revenue</span>
                            <span className="font-bold text-blue-600">₹{realRevenue.studentRevenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Avg per Student</span>
                            <span className="font-medium text-blue-600">₹{Math.round(realRevenue.studentRevenue / Math.max(stats.students, 1))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Revenue Share</span>
                            <span className="font-bold text-blue-600">{Math.round((realRevenue.studentRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%</span>
                          </div>
                          <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.round((realRevenue.studentRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Staff Revenue */}
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Briefcase className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-800 dark:text-green-200">Staff</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{stats.staff} users</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Revenue</span>
                            <span className="font-bold text-green-600">₹{realRevenue.staffRevenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Avg per Staff</span>
                            <span className="font-medium text-green-600">₹{Math.round(realRevenue.staffRevenue / Math.max(stats.staff, 1))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Revenue Share</span>
                            <span className="font-bold text-green-600">{Math.round((realRevenue.staffRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%</span>
                          </div>
                          <div className="mt-2 bg-green-200 dark:bg-green-800 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.round((realRevenue.staffRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Canteen Owners Revenue */}
                      <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Receipt className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-purple-800 dark:text-purple-200">Canteen Owners</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{stats.canteenOwner} users</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Revenue</span>
                            <span className="font-bold text-purple-600">₹{realRevenue.canteenOwnerRevenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Avg per Owner</span>
                            <span className="font-medium text-purple-600">₹{Math.round(realRevenue.canteenOwnerRevenue / Math.max(stats.canteenOwner, 1))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Revenue Share</span>
                            <span className="font-bold text-purple-600">{Math.round((realRevenue.canteenOwnerRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%</span>
                          </div>
                          <div className="mt-2 bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.round((realRevenue.canteenOwnerRevenue / Math.max(realRevenue.totalCalculatedRevenue, 1)) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Spenders Analysis */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Spending Patterns Analysis</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const topStudents = userSpendingData.filter(u => u.role === 'student').sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 5);
                          const topEmployees = userSpendingData.filter(u => u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor').sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 5);
                          const topStaff = userSpendingData.filter(u => u.role === 'staff' || u.role === 'admin').sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 5);
                          const spendingData = `Spending Patterns Analysis - ${new Date().toLocaleDateString()}\n\n=== TOP STUDENT SPENDERS (Real Data) ===\n${topStudents.map((user, i) => `${i + 1}. ${user.name} - ₹${user.totalSpending.toLocaleString()} (${user.orderCount} orders) - ${user.department || 'N/A'}`).join('\n')}\n\n=== TOP EMPLOYEE/CONTRACTOR/VISITOR SPENDERS (Real Data) ===\n${topEmployees.map((user, i) => `${i + 1}. ${user.name} - ₹${user.totalSpending.toLocaleString()} (${user.orderCount} orders) - ${user.role} - ${user.department || 'N/A'}`).join('\n')}\n\n=== TOP STAFF/ADMIN SPENDERS (Real Data) ===\n${topStaff.map((user, i) => `${i + 1}. ${user.name} - ₹${user.totalSpending.toLocaleString()} (${user.orderCount} orders) - ${user.role}`).join('\n')}\n\nNote: Spending amounts are calculated from actual order data and payments.`;
                          const blob = new Blob([spendingData], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `spending_analysis_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export Spending
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Students */}
                      <div>
                        <h4 className="font-medium mb-4 flex items-center space-x-2">
                          <School className="w-4 h-4 text-blue-600" />
                          <span>Top Student Spenders</span>
                        </h4>
                        <div className="space-y-3">
                          {userSpendingData.filter(u => u.role === 'student').sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 5).map((user, index) => {
                            return (
                              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-white' :
                                    index === 1 ? 'bg-gray-400 text-white' :
                                      index === 2 ? 'bg-amber-600 text-white' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-xs text-muted-foreground">{user.department || 'N/A'} • {user.email}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">₹{user.totalSpending.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{user.orderCount} orders</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Top Staff & Others */}
                      <div>
                        <h4 className="font-medium mb-4 flex items-center space-x-2">
                          <Briefcase className="w-4 h-4 text-green-600" />
                          <span>Top Staff & Admin Spenders</span>
                        </h4>
                        <div className="space-y-3">
                          {userSpendingData.filter(u => u.role === 'staff' || u.role === 'admin').sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 5).map((user, index) => {
                            return (
                              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-emerald-500 text-white' :
                                    index === 1 ? 'bg-teal-400 text-white' : 'bg-green-100 text-green-600'
                                    }`}>
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-xs text-muted-foreground">{user.role?.replace('_', ' ')} • {user.email}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">₹{user.totalSpending.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{user.orderCount} orders</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Spending Insights */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                        <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">Highest Spender</h5>
                        <div className="text-sm">
                          <div className="font-bold">{(() => {
                            const topSpender = userSpendingData.sort((a, b) => b.totalSpending - a.totalSpending)[0];
                            return topSpender?.name || 'N/A';
                          })()}</div>
                          <div className="text-red-600">₹{(() => {
                            const topSpender = userSpendingData.sort((a, b) => b.totalSpending - a.totalSpending)[0];
                            return (topSpender?.totalSpending || 0).toLocaleString();
                          })()}</div>
                        </div>
                      </div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Average Spending</h5>
                        <div className="text-sm">
                          <div className="font-bold">All Users</div>
                          <div className="text-yellow-600">₹{(() => {
                            const totalSpending = userSpendingData.reduce((sum, user) => sum + user.totalSpending, 0);
                            return Math.round(totalSpending / Math.max(userSpendingData.length, 1)).toLocaleString();
                          })()}</div>
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Lowest Spender</h5>
                        <div className="text-sm">
                          <div className="font-bold">{(() => {
                            const sortedSpenders = userSpendingData.sort((a, b) => a.totalSpending - b.totalSpending);
                            const lowestSpender = sortedSpenders.find(user => user.totalSpending > 0);
                            return lowestSpender?.name || 'N/A';
                          })()}</div>
                          <div className="text-blue-600">₹{(() => {
                            const sortedSpenders = userSpendingData.sort((a, b) => a.totalSpending - b.totalSpending);
                            const lowestSpender = sortedSpenders.find(user => user.totalSpending > 0);
                            return (lowestSpender?.totalSpending || 0).toLocaleString();
                          })()}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Student Demographics Analysis */}
                <div className="flex items-center space-x-2 mb-4 mt-8">
                  <School className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Student Demographics & Spending</h3>
                </div>

                {/* Department-wise Revenue & Business Analysis */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Department-wise Revenue & Business Analysis</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const students = users.filter(u => u.role === 'student');
                          const employees = users.filter(u => u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor');
                          const deptData: Record<string, number> = {};
                          students.forEach(student => {
                            if (student.department) {
                              deptData[student.department] = (deptData[student.department] || 0) + 1;
                            }
                          });
                          employees.forEach(employee => {
                            if (employee.department) {
                              deptData[employee.department] = (deptData[employee.department] || 0) + 1;
                            }
                          });
                          const reportData = Object.entries(deptData).map(([dept, count]) => {
                            const deptStudents = userSpendingData.filter(u => u.role === 'student' && u.department === dept);
                            const deptEmployees = userSpendingData.filter(u => (u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor') && u.department === dept);
                            const deptRevenue = deptStudents.reduce((sum, student) => sum + student.totalSpending, 0) + deptEmployees.reduce((sum, employee) => sum + employee.totalSpending, 0);
                            const avgPerUser = count > 0 ? Math.round(deptRevenue / count) : 0;
                            const totalOrders = deptStudents.reduce((sum, student) => sum + student.orderCount, 0) + deptEmployees.reduce((sum, employee) => sum + employee.orderCount, 0);
                            return `${dept} (${getDepartmentFullName(dept)})\n- Users: ${count} (Students + Employees)\n- Revenue: ₹${deptRevenue.toLocaleString()}\n- Avg per User: ₹${avgPerUser.toLocaleString()}\n- Total Orders: ${totalOrders} (real data)\n`;
                          }).join('\n');

                          const blob = new Blob([`Department Business Analysis - ${new Date().toLocaleDateString()}\n\n${reportData}`], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `department_business_analysis_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export Business Data
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(users.filter(u => u.role === 'student' || u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor').reduce((acc: Record<string, number>, user) => {
                        if (user.department) {
                          acc[user.department] = (acc[user.department] || 0) + 1;
                        }
                        return acc;
                      }, {})).map(([dept, count]) => {
                        const userCount = count as number;
                        const totalUsers = users.filter(u => u.role === 'student' || u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor').length;
                        const deptStudents = userSpendingData.filter(u => u.role === 'student' && u.department === dept);
                        const deptEmployees = userSpendingData.filter(u => (u.role === 'employee' || u.role === 'contractor' || u.role === 'visitor') && u.department === dept);
                        const deptRevenue = deptStudents.reduce((sum, student) => sum + student.totalSpending, 0) + deptEmployees.reduce((sum, employee) => sum + employee.totalSpending, 0);
                        const avgPerUser = userCount > 0 ? Math.round(deptRevenue / userCount) : 0;
                        const actualOrders = deptStudents.reduce((sum, student) => sum + student.orderCount, 0) + deptEmployees.reduce((sum, employee) => sum + employee.orderCount, 0);

                        return (
                          <div
                            key={dept}
                            className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => {
                              setFilterDepartment(dept);
                              setFilterRole("student");
                              setActiveTab("all-users");
                            }}
                            data-testid={`dept-card-${dept}`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-primary">{dept}</div>
                                <Badge variant="outline" className="text-xs">{userCount} users</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {getDepartmentFullName(dept)}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-muted-foreground">Revenue</div>
                                  <div className="font-bold text-green-600">₹{deptRevenue.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Avg/User</div>
                                  <div className="font-bold text-blue-600">₹{avgPerUser.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Share</div>
                                  <div className="font-bold text-purple-600">{Math.round((userCount / totalUsers) * 100)}%</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Orders</div>
                                  <div className="font-bold text-orange-600">{actualOrders}</div>
                                </div>
                              </div>
                              <div className="text-xs text-primary mt-2 text-center">Click to filter users</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {users.filter(u => u.role === 'student' && !u.department).length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800 dark:text-yellow-200">
                            {users.filter(u => u.role === 'student' && !u.department).length} students have no department assigned - missing revenue data
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Year-wise Revenue & Business Analysis */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Year-wise Revenue & Business Analysis</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const students = users.filter(u => u.role === 'student');
                          const currentYear = new Date().getFullYear();
                          const yearData = {
                            '1st Year': students.filter(s => s.passingOutYear === (currentYear + 4) || s.currentStudyYear === 1).length,
                            '2nd Year': students.filter(s => s.passingOutYear === (currentYear + 3) || s.currentStudyYear === 2).length,
                            '3rd Year': students.filter(s => s.passingOutYear === (currentYear + 2) || s.currentStudyYear === 3).length,
                            '4th Year': students.filter(s => s.passingOutYear === (currentYear + 1) || s.currentStudyYear === 4).length
                          };
                          const reportData = Object.entries(yearData).map(([year, count]) => {
                            const yearRevenue = Math.round((count / students.length) * stats.totalRevenue * 0.7);
                            const avgPerStudent = count > 0 ? Math.round(yearRevenue / count) : 0;
                            const spendingPattern = year.includes('1st') ? 'Lower' : year.includes('2nd') ? 'Moderate' : year.includes('3rd') ? 'High' : 'Highest';
                            return `${year}\n- Students: ${count} (${Math.round((count / students.length) * 100)}%)\n- Revenue: ₹${yearRevenue.toLocaleString()}\n- Avg per Student: ₹${avgPerStudent.toLocaleString()}\n- Spending Pattern: ${spendingPattern}\n- Orders: ~${Math.round(count * (year.includes('4th') ? 3.5 : year.includes('3rd') ? 3 : year.includes('2nd') ? 2.5 : 2))} estimated\n`;
                          }).join('\n');

                          const blob = new Blob([`Year Business Analysis - ${new Date().toLocaleDateString()}\n\n${reportData}`], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `year_business_analysis_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export Business Data
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(() => {
                        const students = users.filter(u => u.role === 'student');
                        const currentYear = new Date().getFullYear();
                        const yearData = {
                          '1st': students.filter(s => s.passingOutYear === (currentYear + 4) || s.currentStudyYear === 1).length,
                          '2nd': students.filter(s => s.passingOutYear === (currentYear + 3) || s.currentStudyYear === 2).length,
                          '3rd': students.filter(s => s.passingOutYear === (currentYear + 2) || s.currentStudyYear === 3).length,
                          '4th': students.filter(s => s.passingOutYear === (currentYear + 1) || s.currentStudyYear === 4).length
                        };

                        return Object.entries(yearData).map(([year, count]) => {
                          const yearRevenue = Math.round((count / students.length) * stats.totalRevenue * 0.7);
                          const avgPerStudent = count > 0 ? Math.round(yearRevenue / count) : 0;
                          const orderMultiplier = year === '4th' ? 3.5 : year === '3rd' ? 3 : year === '2nd' ? 2.5 : 2;
                          const estimatedOrders = Math.round(count * orderMultiplier);
                          const spendingTrend = year === '1st' ? 'Lower' : year === '2nd' ? 'Moderate' : year === '3rd' ? 'High' : 'Highest';
                          const trendColor = year === '1st' ? 'text-blue-600' : year === '2nd' ? 'text-green-600' : year === '3rd' ? 'text-orange-600' : 'text-red-600';

                          return (
                            <div
                              key={year}
                              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => {
                                setFilterYear(year);
                                setFilterRole("student");
                                setActiveTab("all-users");
                              }}
                              data-testid={`year-card-${year}`}
                            >
                              <div className="space-y-3">
                                <div className="text-center">
                                  <div className="text-sm font-bold text-primary">{year} Year</div>
                                  <div className="text-2xl font-bold text-blue-600">{count}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {students.length > 0 ? Math.round((count / students.length) * 100) : 0}% of students
                                  </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Revenue</span>
                                    <span className="font-bold text-green-600">₹{yearRevenue.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Avg/Student</span>
                                    <span className="font-bold text-blue-600">₹{avgPerStudent.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">~Orders</span>
                                    <span className="font-bold text-purple-600">{estimatedOrders}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Spending</span>
                                    <span className={`font-bold ${trendColor}`}>{spendingTrend}</span>
                                  </div>
                                </div>

                                <div className="text-xs text-center text-primary mt-2">Click to filter</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Spending Pattern Insights</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-blue-600 font-bold">1st Year</div>
                          <div className="text-xs text-muted-foreground">New to campus, lower spending</div>
                        </div>
                        <div>
                          <div className="text-green-600 font-bold">2nd Year</div>
                          <div className="text-xs text-muted-foreground">Settling in, moderate spending</div>
                        </div>
                        <div>
                          <div className="text-orange-600 font-bold">3rd Year</div>
                          <div className="text-xs text-muted-foreground">Active social life, high spending</div>
                        </div>
                        <div>
                          <div className="text-red-600 font-bold">4th Year</div>
                          <div className="text-xs text-muted-foreground">Final year, highest spending</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Department + Year Combined Matrix */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Department × Year Matrix</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const students = users.filter(u => u.role === 'student');
                          const currentYear = new Date().getFullYear();
                          const matrix: Record<string, Record<string, number>> = {};

                          students.forEach(student => {
                            if (student.department) {
                              if (!matrix[student.department]) matrix[student.department] = { '1st': 0, '2nd': 0, '3rd': 0, '4th': 0 };
                              if (student.passingOutYear === (currentYear + 4) || student.currentStudyYear === 1) matrix[student.department]['1st']++;
                              else if (student.passingOutYear === (currentYear + 3) || student.currentStudyYear === 2) matrix[student.department]['2nd']++;
                              else if (student.passingOutYear === (currentYear + 2) || student.currentStudyYear === 3) matrix[student.department]['3rd']++;
                              else if (student.passingOutYear === (currentYear + 1) || student.currentStudyYear === 4) matrix[student.department]['4th']++;
                            }
                          });

                          const reportData = Object.entries(matrix).map(([dept, years]) =>
                            `${dept}: 1st(${years['1st']}) 2nd(${years['2nd']}) 3rd(${years['3rd']}) 4th(${years['4th']}) Total(${years['1st'] + years['2nd'] + years['3rd'] + years['4th']})`
                          ).join('\n');

                          const blob = new Blob([`Department × Year Matrix - ${new Date().toLocaleDateString()}\n\n${reportData}`], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `dept_year_matrix_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export Matrix
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium">Department</th>
                            <th className="text-center p-2 font-medium">1st Year</th>
                            <th className="text-center p-2 font-medium">2nd Year</th>
                            <th className="text-center p-2 font-medium">3rd Year</th>
                            <th className="text-center p-2 font-medium">4th Year</th>
                            <th className="text-center p-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const students = users.filter(u => u.role === 'student');
                            const currentYear = new Date().getFullYear();
                            const departments = Array.from(new Set(students.map((s: any) => s.department).filter(Boolean))) as string[];

                            return departments.map(dept => {
                              const deptStudents = students.filter(s => s.department === dept);
                              const year1 = deptStudents.filter(s => s.passingOutYear === (currentYear + 4) || s.currentStudyYear === 1).length;
                              const year2 = deptStudents.filter(s => s.passingOutYear === (currentYear + 3) || s.currentStudyYear === 2).length;
                              const year3 = deptStudents.filter(s => s.passingOutYear === (currentYear + 2) || s.currentStudyYear === 3).length;
                              const year4 = deptStudents.filter(s => s.passingOutYear === (currentYear + 1) || s.currentStudyYear === 4).length;
                              const total = year1 + year2 + year3 + year4;

                              return (
                                <tr key={dept} className="border-b hover:bg-muted/50">
                                  <td className="p-2 font-medium">{dept}</td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${year1 > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'text-muted-foreground'}`}
                                    >
                                      {year1}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${year2 > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'text-muted-foreground'}`}
                                    >
                                      {year2}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${year3 > 0 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'text-muted-foreground'}`}
                                    >
                                      {year3}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${year4 > 0 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'text-muted-foreground'}`}
                                    >
                                      {year4}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary font-bold">
                                      {total}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                      {users.filter(u => u.role === 'student').some(s => !s.department) && (
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-sm">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="text-yellow-800 dark:text-yellow-200">
                              Some students are not included in the matrix due to missing department information
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Real-time Insights Panel */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Live Data Insights</CardTitle>
                    <div className="flex space-x-2">
                      <Badge variant={isDataLoading ? "secondary" : "default"}>
                        {isDataLoading ? 'Updating...' : 'Live'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const students = users.filter(u => u.role === 'student');
                          const deptData: Record<string, number> = students.reduce((acc, student) => {
                            if (student.department) {
                              acc[student.department] = (acc[student.department] || 0) + 1;
                            }
                            return acc;
                          }, {});
                          const insightsData = `Comprehensive User Analytics - ${new Date().toLocaleDateString()}\n\n=== USER BREAKDOWN ===\nTotal Users: ${stats.totalUsers}\nStudents: ${stats.students} (${Math.round((stats.students / stats.totalUsers) * 100)}%)\nCanteen Owner: ${stats.canteenOwner} (${Math.round((stats.canteenOwner / stats.totalUsers) * 100)}%)\nStaff: ${stats.staff} (${Math.round((stats.staff / stats.totalUsers) * 100)}%)\nAdmins: ${stats.admins} (${Math.round((stats.admins / stats.totalUsers) * 100)}%)\n\n=== DEPARTMENT ANALYSIS ===\n${Object.entries(deptData).map(([dept, count]) => `${dept}: ${count} students`).join('\n')}\n\n=== REVENUE BREAKDOWN ===\nStudent Revenue: ₹${Math.round(stats.totalRevenue * 0.7).toLocaleString()} (70%)\nStaff Revenue: ₹${Math.round(stats.totalRevenue * 0.2).toLocaleString()} (20%)\nCanteen Owner Revenue: ₹${Math.round(stats.totalRevenue * 0.1).toLocaleString()} (10%)\n\n=== ENGAGEMENT METRICS ===\nActive Users: ${stats.activeUsers}\nEngagement Rate: ${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%\nNew Users This Month: ${stats.newUsersThisMonth}\n\n=== BUSINESS INSIGHTS ===\nTotal Revenue: ₹${stats.totalRevenue.toLocaleString()}\nRevenue per User: ₹${Math.round(stats.totalRevenue / stats.totalUsers) || 0}\nAverage Order Value: ₹${stats.avgOrderValue}\nTotal Orders: ${stats.totalOrders}\nHighest Spender Category: ${stats.staff > 0 ? 'Staff' : 'Students'}\n\nGenerated by Canteen Management System`;
                          const blob = new Blob([insightsData], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `comprehensive_analytics_${new Date().toISOString().split('T')[0]}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Complete Report
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Comprehensive Analytics</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                        {Array.from(users.filter(u => u.role === 'student').reduce((acc, s) => {
                          if (s.department) acc.add(s.department);
                          return acc;
                        }, new Set<string>())).length} departments • {stats.students} students • ₹{Math.round(stats.totalRevenue * 0.7).toLocaleString()} student revenue
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-blue-700 hover:text-blue-800"
                        onClick={() => {
                          setFilterRole("student");
                          setActiveTab("all-users");
                        }}
                      >
                        View Full Analytics
                      </Button>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <h4 className="font-medium text-green-800 dark:text-green-200">Revenue Performance</h4>
                      <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                        ₹{Math.round(stats.totalRevenue / stats.totalUsers) || 0} per user average
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-green-700 hover:text-green-800"
                        onClick={() => {
                          setLocation("/admin/analytics");
                        }}
                      >
                        View Analytics
                      </Button>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <h4 className="font-medium text-purple-800 dark:text-purple-200">Engagement Rate</h4>
                      <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                        {Math.round((stats.activeUsers / stats.totalUsers) * 100) || 0}% active users
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-purple-700 hover:text-purple-800"
                        onClick={() => {
                        }}
                      >
                        Analyze Trends
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints" className="mt-6">
            <div className="grid gap-6">
              {/* Complaints Dashboard Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Complaints Management</h2>
                  <p className="text-sm text-muted-foreground">Monitor and resolve user complaints efficiently</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/complaints/generate-samples', {
                          method: 'POST',
                        });
                        const result = await response.json();

                        if (result.success) {
                          await refetchComplaints(); // Refresh complaints from database
                        } else {
                          throw new Error(result.message);
                        }
                      } catch (error) {
                      }
                    }}
                    disabled={isDataLoading || complaintsLoading}
                  >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${isDataLoading ? 'animate-spin' : ''}`} />
                    Sync Complaints
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const complaintsData = `Complaints Report - ${new Date().toLocaleDateString()}\n\n${complaints.map(c => `Subject: ${c.subject}\nUser: ${c.userName}\nPriority: ${c.priority}\nStatus: ${c.status}\nDescription: ${c.description}\nDate: ${c.date}\n\n`).join('')}Generated by Canteen Management System`;
                      const blob = new Blob([complaintsData], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `complaints_report_${new Date().toISOString().split('T')[0]}.txt`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>

              {/* Complaints Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{complaints.filter(c => c.status === 'Open').length}</div>
                      <div className="text-sm text-muted-foreground">Open Issues</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{complaints.filter(c => c.priority === 'High').length}</div>
                      <div className="text-sm text-muted-foreground">High Priority</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{complaints.filter(c => c.status === 'Resolved').length}</div>
                      <div className="text-sm text-muted-foreground">Resolved</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{complaints.length}</div>
                      <div className="text-sm text-muted-foreground">Total Complaints</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Active Complaints List */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Active Complaints</CardTitle>
                    <div className="flex space-x-2">
                      <Select defaultValue="all">
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priority</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {complaints.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Complaints Found</h3>
                        <p className="text-muted-foreground">Click 'Sync Complaints' to load user feedback</p>
                      </div>
                    ) : (
                      complaints.map((complaint) => (
                        <div key={complaint.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold">{complaint.subject}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {complaint.category || 'General'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                <User className="w-3 h-3 inline mr-1" />
                                {complaint.userName} • {complaint.date}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={complaint.priority === "High" ? "destructive" : complaint.priority === "Medium" ? "secondary" : "default"}>
                                {complaint.priority}
                              </Badge>
                              <Badge variant={complaint.status === "Open" ? "destructive" : "default"}>
                                {complaint.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{complaint.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
                                } catch (error) {
                                }
                              }}
                              disabled={complaint.status === 'Resolved'}
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Reply
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/complaints/${complaint.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      status: 'Resolved',
                                      resolvedBy: 'Admin',
                                      resolvedAt: new Date().toISOString()
                                    })
                                  });

                                  if (response.ok) {
                                    await refetchComplaints(); // Refresh data from API
                                  } else {
                                    throw new Error('Failed to update complaint');
                                  }
                                } catch (error) {
                                }
                              }}
                              disabled={complaint.status === 'Resolved'}
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              {complaint.status === 'Resolved' ? 'Resolved' : 'Resolve'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/complaints/${complaint.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      priority: 'High',
                                      adminNotes: 'Escalated by admin'
                                    })
                                  });

                                  if (response.ok) {
                                    await refetchComplaints(); // Refresh data from API
                                  } else {
                                    throw new Error('Failed to escalate complaint');
                                  }
                                } catch (error) {
                                }
                              }}
                              disabled={complaint.priority === 'High'}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {complaint.priority === 'High' ? 'Escalated' : 'Escalate'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (window.confirm(`Remove complaint: ${complaint.subject}?`)) {
                                  try {
                                    const response = await fetch(`/api/complaints/${complaint.id}`, {
                                      method: 'DELETE'
                                    });

                                    if (response.ok) {
                                      await refetchComplaints(); // Refresh data from API
                                    } else {
                                      throw new Error('Failed to delete complaint');
                                    }
                                  } catch (error) {
                                  }
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bulk Actions Tab */}
          <TabsContent value="bulk-actions" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bulk User Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                      onClick={() => setLocation("/admin/user-management/send-email")}
                      data-testid="button-send-email"
                    >
                      <Mail className="w-6 h-6" />
                      <span className="text-sm">Send Email</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                      onClick={() => setLocation("/admin/user-management/add-loyalty-points")}
                      data-testid="button-add-loyalty-points"
                    >
                      <Gift className="w-6 h-6" />
                      <span className="text-sm">Add Loyalty Points</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                      onClick={() => setLocation("/admin/user-management/apply-discount")}
                      data-testid="button-apply-discount"
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="text-sm">Apply Discount</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                      onClick={() => {
                      }}
                      data-testid="button-send-warning"
                    >
                      <AlertTriangle className="w-6 h-6" />
                      <span className="text-sm">Send Warning</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/admin/user-management/export-data")}
                      data-testid="button-export-data"
                    >
                      Export User Data
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/admin/user-management/import-users")}
                      data-testid="button-import-users"
                    >
                      Import Users
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                      }}
                      data-testid="button-backup-database"
                    >
                      Backup Database
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                      }}
                      data-testid="button-generate-report"
                    >
                      Generate Report
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                      }}
                      data-testid="button-clean-inactive-users"
                    >
                      Clean Inactive Users
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                      }}
                      data-testid="button-update-permissions"
                    >
                      Update Permissions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete User Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Are you sure you want to delete <strong>{deleteDialog.user?.name}</strong>?
                This action cannot be undone and will permanently remove all user data.
              </p>
              <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Warning</p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      This will delete all orders, payments, and associated data for this user.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialog({ open: false, user: null })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteUser(deleteDialog.user?.id, deleteDialog.user?.name)}
                >
                  Delete User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Details Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, user: null })}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email Address</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editFormData.phoneNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={editFormData.role}
                    onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
                    disabled={editDialog.user?.role === 'super_admin'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles(editDialog.user?.role || '').map(role => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1).replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editDialog.user?.role === 'super_admin' && (
                    <p className="text-xs text-muted-foreground">
                      Super admin role cannot be changed. There must always be at least one super admin.
                    </p>
                  )}
                </div>
              </div>

              {/* College/Organization Selection */}
              <div className="space-y-2">
                <Label htmlFor="edit-college">
                  {(editFormData.role === 'employee' || editFormData.role === 'contractor' || editFormData.role === 'visitor' || editFormData.role === 'guest') ? 'Organization' : 'College'}
                </Label>
                {(editFormData.role === 'employee' || editFormData.role === 'contractor' || editFormData.role === 'visitor' || editFormData.role === 'guest') ? (
                  <Select
                    value={editFormData.college}
                    onValueChange={(value) => setEditFormData({ ...editFormData, college: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationsData?.organizations?.filter((org: any) => org.isActive).map((org: any) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={editFormData.college}
                    onValueChange={(value) => setEditFormData({ ...editFormData, college: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select college" />
                    </SelectTrigger>
                    <SelectContent>
                      {collegesData?.colleges?.filter(college => college.isActive).map(college => (
                        <SelectItem key={college.id} value={college.id}>
                          {college.name} ({college.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Role-specific Information */}
              {editFormData.role === 'student' && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-register">Register Number</Label>
                      <Input
                        id="edit-register"
                        value={editFormData.registerNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, registerNumber: e.target.value })}
                        placeholder="Enter register number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-department">Department</Label>
                      <Input
                        id="edit-department"
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                        placeholder="Enter department"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-joining-year">Joining Year</Label>
                      <Input
                        id="edit-joining-year"
                        type="number"
                        value={editFormData.joiningYear}
                        onChange={(e) => setEditFormData({ ...editFormData, joiningYear: e.target.value })}
                        placeholder="2020"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-passing-year">Passing Year</Label>
                      <Input
                        id="edit-passing-year"
                        type="number"
                        value={editFormData.passingOutYear}
                        onChange={(e) => setEditFormData({ ...editFormData, passingOutYear: e.target.value })}
                        placeholder="2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-current-year">Current Study Year</Label>
                      <Input
                        id="edit-current-year"
                        type="number"
                        value={editFormData.currentStudyYear}
                        onChange={(e) => setEditFormData({ ...editFormData, currentStudyYear: e.target.value })}
                        placeholder="3"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(editFormData.role === 'staff' || editFormData.role === 'employee' || editFormData.role === 'guest' || editFormData.role === 'contractor' || editFormData.role === 'visitor') && (
                <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200">
                    {editFormData.role === 'staff' ? 'Staff' :
                      editFormData.role === 'employee' ? 'Employee' :
                        editFormData.role === 'guest' ? 'Guest' :
                          editFormData.role === 'contractor' ? 'Contractor' :
                            editFormData.role === 'visitor' ? 'Visitor' : 'Staff'} Information
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="edit-staff-id">
                      {editFormData.role === 'staff' ? 'Staff ID' :
                        editFormData.role === 'employee' ? 'Employee ID' :
                          editFormData.role === 'guest' ? 'Guest ID' :
                            editFormData.role === 'contractor' ? 'Contractor ID' :
                              editFormData.role === 'visitor' ? 'Visitor ID' : 'ID'}
                    </Label>
                    <Input
                      id="edit-staff-id"
                      value={editFormData.staffId}
                      onChange={(e) => setEditFormData({ ...editFormData, staffId: e.target.value })}
                      placeholder={`Enter ${editFormData.role} ID`}
                    />
                  </div>
                </div>
              )}

              {/* Role Change Warning */}
              {editFormData.role !== editDialog.user?.role && (
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Role Change Warning</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Changing role from <strong>{editDialog.user?.role}</strong> to <strong>{editFormData.role}</strong> will
                        {editFormData.role === 'student' || editFormData.role === 'staff' ? ' require additional information' : ' clear role-specific data'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDialog({ open: false, user: null });
                    setEditFormData({
                      name: '', email: '', phoneNumber: '', role: '',
                      registerNumber: '', college: '', department: '', joiningYear: '',
                      passingOutYear: '', currentStudyYear: '', staffId: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editFormData.name && editFormData.email && editFormData.role) {
                      handleUserUpdate(editDialog.user?.id, editFormData, editDialog.user?.name);
                    }
                  }}
                  disabled={!editFormData.name || !editFormData.email || !editFormData.role}
                >
                  Update User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comprehensive User Details Dialog */}
        <Dialog
          open={userDetailsDialog.open}
          onOpenChange={(open) => setUserDetailsDialog({ open, user: open ? userDetailsDialog.user : null })}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={userDetailsDialog.user?.avatar} alt={userDetailsDialog.user?.name} />
                  <AvatarFallback>
                    {userDetailsDialog.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-lg">{userDetailsDialog.user?.name}</div>
                  <div className="text-sm text-muted-foreground">{userDetailsDialog.user?.email}</div>
                </div>
                <div className="flex-1" />
                <Badge
                  variant={userDetailsDialog.user?.role?.startsWith('blocked_') ? 'destructive' : 'default'}
                  className="ml-auto"
                >
                  {userDetailsDialog.user?.role?.startsWith('blocked_')
                    ? `Blocked (${userDetailsDialog.user.role.replace('blocked_', '')})`
                    : userDetailsDialog.user?.role || 'student'
                  }
                </Badge>
              </DialogTitle>
            </DialogHeader>

            {userDetailsDialog.user && (
              <div className="space-y-6">
                {/* User Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>User Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Email</Label>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{userDetailsDialog.user.email}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Phone</Label>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{userDetailsDialog.user.phoneNumber || 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Join Date</Label>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(userDetailsDialog.user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">User ID</Label>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span>#{userDetailsDialog.user.id}</span>
                      </div>
                    </div>
                    {userDetailsDialog.user.registerNumber && (
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Register Number</Label>
                        <div className="flex items-center space-x-2">
                          <School className="w-4 h-4 text-muted-foreground" />
                          <span>{userDetailsDialog.user.registerNumber}</span>
                        </div>
                      </div>
                    )}
                    {userDetailsDialog.user.staffId && (
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Staff ID</Label>
                        <div className="flex items-center space-x-2">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <span>{userDetailsDialog.user.staffId}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tabs for different sections */}
                <Tabs defaultValue="orders" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="orders" className="flex items-center space-x-2">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Orders ({userOrders.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4" />
                      <span>Payments ({userPayments.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="complaints" className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Complaints ({userComplaints.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="flex items-center space-x-2">
                      <Settings className="w-4 h-4" />
                      <span>Actions</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Orders Tab */}
                  <TabsContent value="orders" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Order History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userOrders.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No orders found</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {userOrders.map((order: any, index: number) => (
                              <div key={order.id || index} className="border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">#{order.orderNumber}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(order.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                                      {order.status}
                                    </Badge>
                                    <div className="text-sm font-medium mt-1">₹{order.amount}</div>
                                  </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {JSON.parse(order.items || '[]').map((item: any, i: number) =>
                                    item.name
                                  ).join(', ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Payments Tab */}
                  <TabsContent value="payments" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Payment History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userPayments.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No payments found</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {userPayments.map((payment: any, index: number) => (
                              <div key={payment.id || index} className="border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">₹{payment.amount}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(payment.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <Badge
                                    variant={payment.status === 'success' ? 'default' :
                                      payment.status === 'failed' ? 'destructive' : 'secondary'}
                                  >
                                    {payment.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Transaction ID: {payment.merchantTransactionId}
                                </div>
                                {payment.paymentMethod && (
                                  <div className="text-xs text-muted-foreground">
                                    Method: {payment.paymentMethod}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Complaints Tab */}
                  <TabsContent value="complaints" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Complaints & Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userComplaints.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No complaints found</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {userComplaints.map((complaint: any, index: number) => (
                              <div key={complaint.id || index} className="border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium">{complaint.subject}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {complaint.description}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end space-y-1">
                                    <Badge
                                      variant={complaint.status === 'Resolved' ? 'default' :
                                        complaint.status === 'Open' ? 'destructive' : 'secondary'}
                                    >
                                      {complaint.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {complaint.priority}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Created: {new Date(complaint.createdAt).toLocaleDateString()}
                                </div>
                                {complaint.adminNotes && (
                                  <div className="text-xs bg-muted rounded p-2">
                                    <span className="font-medium">Admin Notes: </span>
                                    {complaint.adminNotes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Actions Tab */}
                  <TabsContent value="actions" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Administrative Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Block/Unblock User */}
                          {userDetailsDialog.user.role?.startsWith('blocked_') ? (
                            <Button
                              onClick={() => {
                                handleUnblockUser(userDetailsDialog.user.id, userDetailsDialog.user.name);
                                setUserDetailsDialog({ open: false, user: null });
                              }}
                              className="w-full"
                              variant="default"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Unblock User
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                handleBlockUser(userDetailsDialog.user.id, userDetailsDialog.user.name);
                                setUserDetailsDialog({ open: false, user: null });
                              }}
                              className="w-full"
                              variant="destructive"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Block User
                            </Button>
                          )}

                          {/* Edit User */}
                          <Button
                            onClick={() => {
                              setEditFormData({
                                name: userDetailsDialog.user.name || '',
                                email: userDetailsDialog.user.email || '',
                                phoneNumber: userDetailsDialog.user.phoneNumber || '',
                                role: userDetailsDialog.user.role || '',
                                registerNumber: userDetailsDialog.user.registerNumber || '',
                                college: userDetailsDialog.user.college || '',
                                department: userDetailsDialog.user.department || '',
                                joiningYear: userDetailsDialog.user.joiningYear || '',
                                passingOutYear: userDetailsDialog.user.passingOutYear || '',
                                currentStudyYear: userDetailsDialog.user.currentStudyYear || '',
                                staffId: userDetailsDialog.user.role === 'staff' ? (userDetailsDialog.user.staffId || '') : (userDetailsDialog.user.registerNumber || '')
                              });
                              setEditDialog({ open: true, user: userDetailsDialog.user });
                              setUserDetailsDialog({ open: false, user: null });
                            }}
                            className="w-full"
                            variant="outline"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                          </Button>

                          {/* Send Email */}
                          <Button
                            onClick={() => {
                              // Future implementation for sending email
                            }}
                            className="w-full"
                            variant="outline"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Send Email
                          </Button>

                          {/* Reset Password */}
                          <Button
                            onClick={() => {
                              // Future implementation for password reset
                            }}
                            className="w-full"
                            variant="outline"
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Reset Password
                          </Button>
                        </div>

                        {/* User Statistics */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{userOrders.length}</div>
                            <div className="text-sm text-muted-foreground">Total Orders</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              ₹{userOrders.reduce((total, order) => total + (order.amount || 0), 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Spent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{userComplaints.length}</div>
                            <div className="text-sm text-muted-foreground">Complaints</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
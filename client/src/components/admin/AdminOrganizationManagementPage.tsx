import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, Plus, Edit, Trash2, BookOpen, Settings, X, Check, FileText
} from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import OrganizationRegistrationFormatBuilder from "./OrganizationRegistrationFormatBuilder";

export default function AdminOrganizationManagementPage() {
  const { user } = useAuthSync();
  const [, setLocation] = useLocation();

  // Organization management state
  const [organizations, setOrganizations] = useState<Array<{
    id: string;
    name: string;
    code: string;
    description?: string;
    companyType: string;
    industry?: string;
    location?: string;
    contactEmail?: string;
    contactPhone?: string;
    isActive: boolean;
    activeRoles: {
      employee: boolean;
      contractor: boolean;
      visitor: boolean;
      guest: boolean;
    };
    departments: Array<{
      id: string;
      name: string;
      code: string;
      description?: string;
      isActive: boolean;
      departmentType: string;
      registrationFormats?: Array<{
        id: string;
        name: string;
        formats: {
          employee: any;
          contractor: any;
          visitor: any;
          guest: any;
        };
        createdAt: Date;
        updatedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }>>([]);
  const [isEditingOrganization, setIsEditingOrganization] = useState<string | null>(null);
  const [newOrganization, setNewOrganization] = useState({ 
    name: '', 
    code: '', 
    description: '', 
    companyType: 'Other',
    industry: '',
    location: '',
    contactEmail: '',
    contactPhone: '',
    isActive: true 
  });
  const [showAddOrganization, setShowAddOrganization] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);
  const [showRoleManagement, setShowRoleManagement] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<{
    employee: boolean;
    contractor: boolean;
    visitor: boolean;
    guest: boolean;
  }>({
    employee: true,
    contractor: true,
    visitor: true,
    guest: true
  });
  
  // Department management state
  const [showAddDepartment, setShowAddDepartment] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    code: '',
    description: '',
    departmentType: 'Other',
    isActive: true
  });
  const [isEditingDepartment, setIsEditingDepartment] = useState<string | null>(null);
  
  // Format management state
  const [showFormatBuilder, setShowFormatBuilder] = useState<{ orgId: string; deptId: string } | null>(null);
  const [editingFormat, setEditingFormat] = useState<{ orgId: string; deptId: string; formatId: string } | null>(null);
  const [existingFormats, setExistingFormats] = useState<Array<{ name: string }>>([]);
  const [showFormatList, setShowFormatList] = useState<{ orgId: string; deptId: string } | null>(null);

  // Fetch organizations
  const { data: organizationsData, isLoading: organizationsLoading } = useQuery({
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

  // Update organizations when data loads
  React.useEffect(() => {
    console.log('🏢 Organizations data received:', organizationsData);
    if (organizationsData && typeof organizationsData === 'object' && organizationsData !== null && 'organizations' in organizationsData) {
      const orgData = organizationsData as { organizations: Array<any> };
      console.log('🏢 Organizations data loaded:', orgData.organizations?.map(o => ({
        id: o.id,
        name: o.name,
        code: o.code,
        activeRoles: o.activeRoles
      })));
      
      // Transform the data to match our new schema
      const transformedOrganizations = orgData.organizations?.map((org: any) => {
        console.log('🏢 Processing organization:', { id: org.id, name: org.name, departments: org.departments });
        return {
          id: org.id,
          name: org.name,
          code: org.code,
          description: org.description,
          companyType: org.companyType || 'Other',
          industry: org.industry,
          location: org.location,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          isActive: org.isActive,
          activeRoles: {
            employee: org.activeRoles?.employee ?? true,
            contractor: org.activeRoles?.contractor ?? true,
            visitor: org.activeRoles?.visitor ?? true,
            guest: org.activeRoles?.guest ?? true
          },
          departments: org.departments || [],
          createdAt: org.createdAt,
          updatedAt: org.updatedAt
        };
      }) || [];
      
      console.log('🏢 Transformed organizations:', transformedOrganizations);
      setOrganizations(transformedOrganizations);
    }
  }, [organizationsData]);

  // Organization management mutations
  const addOrganizationMutation = useMutation({
    mutationFn: async (orgData: { 
      name: string; 
      code: string; 
      description: string; 
      companyType: string;
      industry: string;
      location: string;
      contactEmail: string;
      contactPhone: string;
      isActive: boolean 
    }) => {
      console.log('🏢 addOrganizationMutation.mutationFn called with:', orgData);
      console.log('🏢 User ID:', user?.id);
      const requestData = {
        ...orgData,
        updatedBy: user?.id
      };
      console.log('🏢 Request data:', requestData);
      
      return apiRequest('/api/system-settings/organizations', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      console.log('🏢 addOrganizationMutation.onSuccess called with:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
      setShowAddOrganization(false);
      setNewOrganization({ 
        name: '', 
        code: '', 
        description: '', 
        companyType: 'Other',
        industry: '',
        location: '',
        contactEmail: '',
        contactPhone: '',
        isActive: true 
      });
    },
    onError: (error: any) => {
      console.error('🏢 addOrganizationMutation.onError:', error);
    }
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; name?: string; code?: string; description?: string; isActive?: boolean }) => {
      return apiRequest(`/api/system-settings/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
    },
    onError: (error: any) => {
      console.error('Error updating organization:', error);
    }
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/system-settings/organizations/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
    },
    onError: (error: any) => {
      console.error('Error deleting organization:', error);
    }
  });

  // Role management mutation
  const updateOrganizationRolesMutation = useMutation({
    mutationFn: async ({ organizationId, activeRoles }: { organizationId: string; activeRoles: { employee: boolean; contractor: boolean; visitor: boolean; guest: boolean } }) => {
      return apiRequest(`/api/system-settings/organizations/${organizationId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({
          activeRoles,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
      setShowRoleManagement(null);
    },
    onError: (error: any) => {
      console.error('Error updating organization roles:', error);
    }
  });

  // Organization management handlers
  const handleAddOrganization = () => {
    console.log('🏢 handleAddOrganization called with data:', newOrganization);
    if (!newOrganization.name.trim() || !newOrganization.code.trim()) {
      console.log('🏢 Validation failed - missing name or code');
      return;
    }
    console.log('🏢 Calling addOrganizationMutation.mutate...');
    addOrganizationMutation.mutate(newOrganization);
  };

  const handleUpdateOrganization = (id: string, updateData: { name?: string; code?: string; description?: string; isActive?: boolean }) => {
    updateOrganizationMutation.mutate({ id, ...updateData });
  };

  const handleDeleteOrganization = (id: string) => {
    const organization = organizations.find(org => org.id === id);
    if (organization && window.confirm(`Are you sure you want to delete the organization "${organization.name}"? This action cannot be undone.`)) {
      deleteOrganizationMutation.mutate(id);
    }
  };

  const handleToggleOrganizationStatus = (id: string, isActive: boolean) => {
    handleUpdateOrganization(id, { isActive });
  };

  // Role management handlers
  const handleOpenRoleManagement = (organizationId: string) => {
    const organization = organizations.find(o => o.id === organizationId);
    console.log('🔧 Opening role management for organization:', {
      organizationId,
      organization: organization ? { id: organization.id, name: organization.name, activeRoles: organization.activeRoles } : 'Not found'
    });
    if (organization && organization.activeRoles) {
      setEditingRoles(organization.activeRoles);
    } else {
      // Set default roles if organization doesn't have activeRoles
      setEditingRoles({
        employee: true,
        contractor: true,
        visitor: true,
        guest: true
      });
    }
    setShowRoleManagement(organizationId);
  };

  const handleCloseRoleManagement = () => {
    setShowRoleManagement(null);
    setEditingRoles({
      employee: true,
      contractor: true,
      visitor: true,
      guest: true
    });
  };

  const handleSaveRoleManagement = (organizationId: string) => {
    console.log('💾 Saving role management:', { organizationId, activeRoles: editingRoles });
    updateOrganizationRolesMutation.mutate({ organizationId, activeRoles: editingRoles });
  };

  const handleRoleToggle = (role: 'employee' | 'contractor' | 'visitor' | 'guest') => {
    setEditingRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  // Department management mutations
  const addDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, departmentData }: { orgId: string; departmentData: any }) => {
      console.log('🏢 addDepartmentMutation.mutationFn called with:', { orgId, departmentData });
      console.log('🏢 User ID:', user?.id);
      const requestData = {
        ...departmentData,
        updatedBy: user?.id
      };
      console.log('🏢 Request data:', requestData);
      
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments`, {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      console.log('🏢 addDepartmentMutation.onSuccess called with:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
      setShowAddDepartment(null);
      setNewDepartment({
        name: '',
        code: '',
        description: '',
        departmentType: 'Other',
        isActive: true
      });
    },
    onError: (error: any) => {
      console.error('🏢 addDepartmentMutation.onError:', error);
    }
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, deptId, updateData }: { orgId: string; deptId: string; updateData: any }) => {
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
    },
    onError: (error: any) => {
      console.error('Error updating department:', error);
    }
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, deptId }: { orgId: string; deptId: string }) => {
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments/${deptId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
    },
    onError: (error: any) => {
      console.error('Error deleting department:', error);
    }
  });

  // Department management handlers
  const handleAddDepartment = (orgId: string) => {
    console.log('🏢 handleAddDepartment called with:', { orgId, newDepartment });
    if (!newDepartment.name.trim() || !newDepartment.code.trim()) {
      console.log('🏢 Validation failed - missing name or code');
      return;
    }
    console.log('🏢 Calling addDepartmentMutation.mutate...');
    addDepartmentMutation.mutate({ orgId, departmentData: newDepartment });
  };

  const handleUpdateDepartment = (orgId: string, deptId: string, updateData: any) => {
    updateDepartmentMutation.mutate({ orgId, deptId, updateData });
  };

  const handleDeleteDepartment = (orgId: string, deptId: string) => {
    if (confirm('Are you sure you want to delete this department?')) {
      deleteDepartmentMutation.mutate({ orgId, deptId });
    }
  };

  // Format management mutations
  const addFormatMutation = useMutation({
    mutationFn: async ({ orgId, deptId, formatData }: { orgId: string; deptId: string; formatData: any }) => {
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments/${deptId}/registration-formats`, {
        method: 'POST',
        body: JSON.stringify({
          ...formatData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
      setShowFormatBuilder(null);
      setEditingFormat(null);
    },
    onError: (error: any) => {
      console.error('Error adding format:', error);
    }
  });

  const updateFormatMutation = useMutation({
    mutationFn: async ({ orgId, deptId, formatId, formatData }: { orgId: string; deptId: string; formatId: string; formatData: any }) => {
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments/${deptId}/registration-formats/${formatId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...formatData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
      setShowFormatBuilder(null);
      setEditingFormat(null);
    },
    onError: (error: any) => {
      console.error('Error updating format:', error);
    }
  });

  const deleteFormatMutation = useMutation({
    mutationFn: async ({ orgId, deptId, formatId }: { orgId: string; deptId: string; formatId: string }) => {
      return apiRequest(`/api/system-settings/organizations/${orgId}/departments/${deptId}/registration-formats/${formatId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/organizations'] });
    },
    onError: (error: any) => {
      console.error('Error deleting format:', error);
    }
  });

  // Format management handlers
  const handleOpenFormatList = (orgId: string, deptId: string) => {
    setShowFormatList({ orgId, deptId });
    setShowFormatBuilder(null);
    setEditingFormat(null);
  };

  const handleOpenFormatBuilder = (orgId: string, deptId: string) => {
    const organization = organizations.find(o => o.id === orgId);
    const department = organization?.departments.find(d => d.id === deptId);
    const formats = department?.registrationFormats || [];
    
    setExistingFormats(formats.map(f => ({ name: f.name })));
    setShowFormatBuilder({ orgId, deptId });
    setEditingFormat(null);
    setShowFormatList(null);
  };

  const handleEditFormat = (orgId: string, deptId: string, formatId: string) => {
    const organization = organizations.find(o => o.id === orgId);
    const department = organization?.departments.find(d => d.id === deptId);
    const format = department?.registrationFormats?.find(f => f.id === formatId);
    const formats = department?.registrationFormats || [];
    
    setExistingFormats(formats.map(f => ({ name: f.name })));
    setEditingFormat({ orgId, deptId, formatId });
    setShowFormatBuilder(null);
  };

  const handleSaveFormat = (format: any, formatName: string) => {
    if (editingFormat) {
      updateFormatMutation.mutate({
        orgId: editingFormat.orgId,
        deptId: editingFormat.deptId,
        formatId: editingFormat.formatId,
        formatData: { name: formatName, formats: format }
      });
    } else if (showFormatBuilder) {
      addFormatMutation.mutate({
        orgId: showFormatBuilder.orgId,
        deptId: showFormatBuilder.deptId,
        formatData: { name: formatName, formats: format }
      });
    }
  };

  const handleDeleteFormat = (orgId: string, deptId: string, formatId: string) => {
    if (confirm('Are you sure you want to delete this registration format?')) {
      deleteFormatMutation.mutate({ orgId, deptId, formatId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Corporate Organization Management</h1>
          <p className="text-muted-foreground">
            Manage corporate companies, their departments, and employee role settings
          </p>
        </div>
        <Button
          onClick={() => setShowAddOrganization(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Organization</span>
        </Button>
      </div>

      {/* Add Organization Form */}
      {showAddOrganization && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5" />
              <span>Add New Corporate Organization</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Enter organization name"
                  value={newOrganization.name}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-code">Organization Code</Label>
                <Input
                  id="org-code"
                  placeholder="Enter organization code"
                  value={newOrganization.code}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">Description (Optional)</Label>
              <Textarea
                id="org-description"
                placeholder="Enter organization description"
                value={newOrganization.description}
                onChange={(e) => setNewOrganization(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-company-type">Company Type</Label>
                <select
                  id="org-company-type"
                  value={newOrganization.companyType}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, companyType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="IT">IT</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Government">Government</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-industry">Industry</Label>
                <Input
                  id="org-industry"
                  placeholder="Enter industry (e.g., Software, Automotive)"
                  value={newOrganization.industry}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, industry: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-location">Location</Label>
                <Input
                  id="org-location"
                  placeholder="Enter company location"
                  value={newOrganization.location}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-contact-email">Contact Email</Label>
                <Input
                  id="org-contact-email"
                  type="email"
                  placeholder="Enter contact email"
                  value={newOrganization.contactEmail}
                  onChange={(e) => setNewOrganization(prev => ({ ...prev, contactEmail: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">Contact Phone</Label>
              <Input
                id="org-contact-phone"
                placeholder="Enter contact phone number"
                value={newOrganization.contactPhone}
                onChange={(e) => setNewOrganization(prev => ({ ...prev, contactPhone: e.target.value }))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newOrganization.isActive}
                onCheckedChange={(checked) => setNewOrganization(prev => ({ ...prev, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs text-left">
              <div><strong>Debug - Form State:</strong></div>
              <div>Name: "{newOrganization.name}"</div>
              <div>Code: "{newOrganization.code}"</div>
              <div>Description: "{newOrganization.description}"</div>
              <div>Company Type: "{newOrganization.companyType}"</div>
              <div>Industry: "{newOrganization.industry}"</div>
              <div>Location: "{newOrganization.location}"</div>
              <div>Contact Email: "{newOrganization.contactEmail}"</div>
              <div>Contact Phone: "{newOrganization.contactPhone}"</div>
              <div>Is Active: {newOrganization.isActive ? 'Yes' : 'No'}</div>
              <div>User ID: {user?.id || 'Not available'}</div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddOrganization(false);
                  setNewOrganization({ 
                    name: '', 
                    code: '', 
                    description: '', 
                    companyType: 'Other',
                    industry: '',
                    location: '',
                    contactEmail: '',
                    contactPhone: '',
                    isActive: true 
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log('🏢 Add Organization button clicked!');
                  alert('Button clicked! Check console for details.');
                  handleAddOrganization();
                }}
                disabled={addOrganizationMutation.isPending}
              >
                {addOrganizationMutation.isPending ? 'Adding...' : 'Add Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="w-5 h-5" />
            <span>Organizations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {organizationsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading organizations...</p>
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No organizations found. Add your first organization above.</p>
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs text-left">
                <div><strong>Debug Info:</strong></div>
                <div>Organizations Loading: {organizationsLoading ? 'Yes' : 'No'}</div>
                <div>Organizations Data: {organizationsData ? 'Received' : 'Not Received'}</div>
                <div>Organizations Count: {organizations.length}</div>
                <div>Raw Data: {JSON.stringify(organizationsData, null, 2)}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {organizations.map((organization) => (
                <div 
                  key={organization.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800"
                  onClick={(e) => {
                    // Prevent navigation when clicking on action buttons
                    if ((e.target as HTMLElement).closest('button')) {
                      return;
                    }
                    setLocation(`/admin/organization/${organization.id}`);
                  }}
                >
                  {/* Organization Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-lg">{organization.code}</h4>
                        <Badge variant={organization.isActive ? "default" : "secondary"}>
                          {organization.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {organization.name}
                      </p>
                      {organization.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {organization.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {organization.departments.filter((d: any) => d.isActive).length} active departments
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingOrganization(isEditingOrganization === organization.id ? null : organization.id)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteOrganization(organization.id)}
                        disabled={deleteOrganizationMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Organization Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={organization.isActive}
                        onCheckedChange={(checked) => handleToggleOrganizationStatus(organization.id, checked)}
                        disabled={updateOrganizationMutation.isPending}
                      />
                      <span className="text-xs text-muted-foreground">
                        {organization.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRoleManagement(organization.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Manage Roles
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrganization(selectedOrganization === organization.id ? null : organization.id)}
                      >
                        {selectedOrganization === organization.id ? 'Hide Departments' : 'Manage Departments'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Edit Organization Mode */}
                  {isEditingOrganization === organization.id && (
                    <div className="mb-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`edit-org-name-${organization.id}`}>Organization Name</Label>
                          <Input
                            id={`edit-org-name-${organization.id}`}
                            defaultValue={organization.name}
                            onBlur={(e) => {
                              const newName = e.target.value.trim();
                              if (newName && newName !== organization.name) {
                                handleUpdateOrganization(organization.id, { name: newName });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newName = e.currentTarget.value.trim();
                                if (newName && newName !== organization.name) {
                                  handleUpdateOrganization(organization.id, { name: newName });
                                }
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-org-code-${organization.id}`}>Organization Code</Label>
                          <Input
                            id={`edit-org-code-${organization.id}`}
                            defaultValue={organization.code}
                            onBlur={(e) => {
                              const newCode = e.target.value.trim().toUpperCase();
                              if (newCode && newCode !== organization.code) {
                                handleUpdateOrganization(organization.id, { code: newCode });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newCode = e.currentTarget.value.trim().toUpperCase();
                                if (newCode && newCode !== organization.code) {
                                  handleUpdateOrganization(organization.id, { code: newCode });
                                }
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-org-description-${organization.id}`}>Description</Label>
                        <Textarea
                          id={`edit-org-description-${organization.id}`}
                          defaultValue={organization.description || ''}
                          onBlur={(e) => {
                            const newDescription = e.target.value.trim();
                            if (newDescription !== (organization.description || '')) {
                              handleUpdateOrganization(organization.id, { description: newDescription });
                            }
                          }}
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingOrganization(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Role Management Section */}
                  {showRoleManagement === organization.id && (
                    <div className="mb-4 pt-4 border-t space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-sm">Manage Active Roles</h5>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCloseRoleManagement}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveRoleManagement(organization.id)}
                            disabled={updateOrganizationRolesMutation.isPending}
                          >
                            {updateOrganizationRolesMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingRoles.employee}
                            onCheckedChange={() => handleRoleToggle('employee')}
                          />
                          <Label className="text-sm">Employee</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingRoles.contractor}
                            onCheckedChange={() => handleRoleToggle('contractor')}
                          />
                          <Label className="text-sm">Contractor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingRoles.visitor}
                            onCheckedChange={() => handleRoleToggle('visitor')}
                          />
                          <Label className="text-sm">Visitor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingRoles.guest}
                            onCheckedChange={() => handleRoleToggle('guest')}
                          />
                          <Label className="text-sm">Guest</Label>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Only enabled roles will be available for selection during user registration.
                      </div>
                    </div>
                  )}
                  
                  {/* Colleges Section */}
                  {selectedOrganization === organization.id && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium flex items-center space-x-2">
                          <BookOpen className="w-4 h-4" />
                          <span>Departments in {organization.code}</span>
                          <Badge variant="outline" className="text-xs">
                            {organization.departments.filter((d: any) => d.isActive).length} Active
                          </Badge>
                        </h5>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddDepartment(organization.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Department
                        </Button>
                      </div>
                      
                      {/* Departments List */}
                      {(() => {
                        console.log('🏢 Rendering departments for organization:', organization.id, 'departments:', organization.departments);
                        return organization.departments.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No departments found in this organization.</p>
                            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs text-left">
                              <div><strong>Debug Info:</strong></div>
                              <div>Organization ID: {organization.id}</div>
                              <div>Departments Array: {JSON.stringify(organization.departments)}</div>
                              <div>Departments Length: {organization.departments.length}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {organization.departments.map((department) => (
                            <div key={department.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h6 className="font-medium text-sm">{department.code}</h6>
                                    <Badge variant={department.isActive ? "default" : "secondary"} className="text-xs">
                                      {department.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {department.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {department.departmentType}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <Switch
                                    checked={department.isActive}
                                    onCheckedChange={(checked) => {
                                      handleUpdateDepartment(organization.id, department.id, { isActive: checked });
                                    }}
                                    className="scale-75"
                                  />
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditingDepartment(department.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenFormatList(organization.id, department.id)}
                                    className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="View Registration Formats"
                                  >
                                    <FileText className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteDepartment(organization.id, department.id)}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Department Form */}
      {showAddDepartment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>Add New Department</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Department Name</Label>
                <Input
                  id="dept-name"
                  placeholder="Enter department name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-code">Department Code</Label>
                <Input
                  id="dept-code"
                  placeholder="Enter department code"
                  value={newDepartment.code}
                  onChange={(e) => setNewDepartment(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-description">Description (Optional)</Label>
              <Textarea
                id="dept-description"
                placeholder="Enter department description"
                value={newDepartment.description}
                onChange={(e) => setNewDepartment(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-type">Department Type</Label>
              <select
                id="dept-type"
                value={newDepartment.departmentType}
                onChange={(e) => setNewDepartment(prev => ({ ...prev, departmentType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Support">Support</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newDepartment.isActive}
                onCheckedChange={(checked) => setNewDepartment(prev => ({ ...prev, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDepartment(null);
                  setNewDepartment({
                    name: '',
                    code: '',
                    description: '',
                    departmentType: 'Other',
                    isActive: true
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleAddDepartment(showAddDepartment)}
                disabled={addDepartmentMutation.isPending}
              >
                {addDepartmentMutation.isPending ? 'Adding...' : 'Add Department'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration Format List */}
      {showFormatList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Registration Formats
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {(() => {
                    const org = organizations.find(o => o.id === showFormatList.orgId);
                    const dept = org?.departments.find(d => d.id === showFormatList.deptId);
                    return `${org?.name} - ${dept?.name}`;
                  })()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const org = organizations.find(o => o.id === showFormatList.orgId);
                    const dept = org?.departments.find(d => d.id === showFormatList.deptId);
                    const formats = dept?.registrationFormats || [];
                    setExistingFormats(formats.map(f => ({ name: f.name })));
                    setShowFormatBuilder({ orgId: showFormatList.orgId, deptId: showFormatList.deptId });
                    setShowFormatList(null);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Format
                </Button>
                <Button variant="outline" onClick={() => setShowFormatList(null)}>
                  Close
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowFormatList(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              {(() => {
                const org = organizations.find(o => o.id === showFormatList.orgId);
                const dept = org?.departments.find(d => d.id === showFormatList.deptId);
                const formats = dept?.registrationFormats || [];
                
                if (formats.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No Registration Formats
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        No registration formats have been created for this department yet.
                      </p>
                      <Button
                        onClick={() => {
                          setExistingFormats([]);
                          setShowFormatBuilder({ orgId: showFormatList.orgId, deptId: showFormatList.deptId });
                          setShowFormatList(null);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Format
                      </Button>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      {formats.map((format) => (
                        <Card key={format.id} className="border border-gray-200 dark:border-gray-700">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{format.name}</CardTitle>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Created: {new Date(format.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditFormat(showFormatList.orgId, showFormatList.deptId, format.id)}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteFormat(showFormatList.orgId, showFormatList.deptId, format.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(format.formats).map(([role, roleFormat]: [string, any]) => {
                                if (!roleFormat || !roleFormat.structure || roleFormat.structure.length === 0) {
                                  return null;
                                }
                                
                                return (
                                  <div key={role} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                                        {role} Format
                                      </h4>
                                      <Badge variant="outline">
                                        {roleFormat.totalLength} characters
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      <p><strong>Structure:</strong> {roleFormat.structure.length} positions</p>
                                      {roleFormat.example && (
                                        <p><strong>Example:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{roleFormat.example}</code></p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Registration Format Builder */}
      {(showFormatBuilder || editingFormat) && (
        <OrganizationRegistrationFormatBuilder
          onSave={handleSaveFormat}
          onCancel={() => {
            setShowFormatBuilder(null);
            setEditingFormat(null);
          }}
          initialFormat={editingFormat ? (() => {
            const org = organizations.find(o => o.id === editingFormat.orgId);
            const dept = org?.departments.find(d => d.id === editingFormat.deptId);
            const format = dept?.registrationFormats?.find(f => f.id === editingFormat.formatId);
            return format?.formats;
          })() : undefined}
          initialFormatName={editingFormat ? (() => {
            const org = organizations.find(o => o.id === editingFormat.orgId);
            const dept = org?.departments.find(d => d.id === editingFormat.deptId);
            const format = dept?.registrationFormats?.find(f => f.id === editingFormat.formatId);
            return format?.name || '';
          })() : ''}
          isEditing={!!editingFormat}
          existingFormats={existingFormats}
        />
      )}
    </div>
  );
}

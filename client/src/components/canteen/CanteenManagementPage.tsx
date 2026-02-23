import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Plus, Edit, Trash2, Utensils, Save, X, ChevronDown
} from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import { useCanteens, useAddCanteen, useUpdateCanteen, useDeleteCanteen, type Canteen } from "@/hooks/useCanteens";
import { useColleges, type College } from "@/hooks/useColleges";
export default function CanteenManagementPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuthSync();

  // Canteen management state
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [isEditingCanteen, setIsEditingCanteen] = useState<string | null>(null);
  const [newCanteen, setNewCanteen] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    contactNumber: '',
    email: '',
    canteenOwnerEmail: '',
    collegeId: '', // Legacy field
    collegeIds: [] as string[], // Array of college IDs
    organizationId: '', // Legacy field
    organizationIds: [] as string[], // Array of organization IDs
    restaurantId: '',
    type: 'college' as 'college' | 'organization' | 'restaurant',
    operatingHours: {
      open: '07:00',
      close: '20:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    isActive: true
  });
  // Allow multiple association types simultaneously
  const [enableCollege, setEnableCollege] = useState(true);
  const [enableOrganization, setEnableOrganization] = useState(false);
  const [enableRestaurant, setEnableRestaurant] = useState(false);
  const [showAddCanteen, setShowAddCanteen] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch canteens, colleges, organizations, and restaurants
  const { data: canteensData, isLoading: canteensLoading } = useCanteens();
  const { data: collegesData, isLoading: collegesLoading } = useColleges();
  const { data: organizationsData, isLoading: organizationsLoading } = useQuery({
    queryKey: ['/api/system-settings/organizations'],
    queryFn: async () => {
      const response = await apiRequest('/api/system-settings/organizations');
      return response;
    }
  });
  const { data: restaurantsData, isLoading: restaurantsLoading } = useQuery({
    queryKey: ['/api/admin/restaurants'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/restaurants');
      return response;
    }
  });

  // Debug logs
  React.useEffect(() => {
    console.log('Colleges data:', collegesData);
    console.log('Canteens data:', canteensData);
  }, [collegesData, canteensData]);

  // Update canteens when data loads
  React.useEffect(() => {
    if (canteensData && typeof canteensData === 'object' && canteensData !== null && 'canteens' in canteensData) {
      const canteenData = canteensData as { canteens: Canteen[] };
      setCanteens(canteenData.canteens || []);
    }
  }, [canteensData]);

  // Update restaurants when data loads
  React.useEffect(() => {
    if (restaurantsData && Array.isArray(restaurantsData)) {
      setRestaurants(restaurantsData);
    }
  }, [restaurantsData]);

  // Removed: auto-assigning default college to canteens without collegeId to avoid unintended KIT assignment

  // Canteen management mutations
  // Derive a single type value for backend compatibility based on selections
  const deriveType = (data: typeof newCanteen) => {
    if (data.restaurantId) return 'restaurant';
    if (data.organizationIds.length > 0 || data.organizationId) return 'organization';
    return 'college';
  };

  const addCanteenMutation = useMutation({
    mutationFn: async (canteenData: typeof newCanteen) => {
      console.log('Sending canteen data:', canteenData); // Debug log
      return apiRequest('/api/system-settings/canteens', {
        method: 'POST',
        body: JSON.stringify({
          ...canteenData,
          type: deriveType(canteenData),
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
      setNewCanteen({
        name: '',
        code: '',
        description: '',
        location: '',
        contactNumber: '',
        email: '',
        canteenOwnerEmail: '',
        collegeId: '',
        collegeIds: [],
        organizationId: '',
        organizationIds: [],
        restaurantId: '',
        type: 'college',
        operatingHours: {
          open: '07:00',
          close: '20:00',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        },
        isActive: true
      });
      setEnableCollege(true);
      setEnableOrganization(false);
      setEnableRestaurant(false);
      setShowAddCanteen(false);
    },
    onError: (error: any) => {
      console.error('Error adding canteen:', error);
    }
  });

  const updateCanteenMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string;[key: string]: any }) => {
      console.log('Updating canteen:', { id, updateData }); // Debug log
      return apiRequest(`/api/system-settings/canteens/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
      setIsEditingCanteen(null);
    },
    onError: (error: any) => {
      console.error('Error updating canteen:', error);
    }
  });

  const deleteCanteenMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/system-settings/canteens/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    },
    onError: (error: any) => {
      console.error('Error deleting canteen:', error);
    }
  });

  // Canteen management handlers
  const handleAddCanteen = () => {
    console.log('Form data before validation:', newCanteen); // Debug log
    const hasCollege = enableCollege && (newCanteen.collegeIds?.length > 0 || newCanteen.collegeId);
    const hasOrg = enableOrganization && (newCanteen.organizationIds?.length > 0 || newCanteen.organizationId);
    const hasRestaurant = enableRestaurant && newCanteen.restaurantId;
    const hasValidAssociation = hasCollege || hasOrg || hasRestaurant;
    if (!newCanteen.name.trim() || !newCanteen.code.trim() || !hasValidAssociation) {
      return;
    }
    addCanteenMutation.mutate(newCanteen);
  };

  const handleUpdateCanteen = (id: string, updates: Partial<Canteen>) => {
    updateCanteenMutation.mutate({ id, ...updates });
  };

  const handleDeleteCanteen = (id: string) => {
    if (window.confirm(`Are you sure you want to delete this canteen? This action cannot be undone.`)) {
      deleteCanteenMutation.mutate(id);
    }
  };

  const handleToggleCanteenStatus = (id: string, isActive: boolean) => {
    handleUpdateCanteen(id, { isActive });
  };

  const handleEditCanteen = (canteen: Canteen) => {
    setIsEditingCanteen(canteen.id);
    const hasCollege = (canteen.collegeIds && canteen.collegeIds.length > 0) || !!canteen.collegeId;
    const hasOrg = (canteen.organizationIds && canteen.organizationIds.length > 0) || !!canteen.organizationId;
    const hasRestaurant = !!canteen.restaurantId;
    setEnableCollege(hasCollege || (!hasOrg && !hasRestaurant)); // default on if nothing else
    setEnableOrganization(hasOrg);
    setEnableRestaurant(hasRestaurant);
    setNewCanteen({
      name: canteen.name,
      code: canteen.code,
      description: canteen.description || '',
      location: canteen.location || '',
      contactNumber: canteen.contactNumber || '',
      email: canteen.email || '',
      canteenOwnerEmail: canteen.canteenOwnerEmail || '',
      collegeId: canteen.collegeId || '',
      collegeIds: canteen.collegeIds || (canteen.collegeId ? [canteen.collegeId] : []),
      organizationId: canteen.organizationId || '',
      organizationIds: canteen.organizationIds || (canteen.organizationId ? [canteen.organizationId] : []),
      restaurantId: canteen.restaurantId || '',
      type: deriveType(canteen as any),
      operatingHours: canteen.operatingHours || {
        open: '07:00',
        close: '20:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      },
      isActive: canteen.isActive
    });
    setShowAddCanteen(true);
  };

  const handleCancelEdit = () => {
    setIsEditingCanteen(null);
    setShowAddCanteen(false);
    setNewCanteen({
      name: '',
      code: '',
      description: '',
      location: '',
      contactNumber: '',
      email: '',
      canteenOwnerEmail: '',
      collegeId: '',
      collegeIds: [],
      organizationId: '',
      organizationIds: [],
      restaurantId: '',
      type: 'college',
      operatingHours: {
        open: '07:00',
        close: '20:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      },
      isActive: true
    });
    setEnableCollege(true);
    setEnableOrganization(false);
    setEnableRestaurant(false);
  };

  const handleSaveEdit = () => {
    console.log('Save edit - Form data:', newCanteen); // Debug log
    const hasCollege = enableCollege && (newCanteen.collegeIds?.length > 0 || newCanteen.collegeId);
    const hasOrg = enableOrganization && (newCanteen.organizationIds?.length > 0 || newCanteen.organizationId);
    const hasRestaurant = enableRestaurant && newCanteen.restaurantId;
    const hasValidAssociation = hasCollege || hasOrg || hasRestaurant;
    if (!newCanteen.name.trim() || !newCanteen.code.trim() || !hasValidAssociation) {
      return;
    }
    const payload = { ...newCanteen, type: deriveType(newCanteen) };
    if (isEditingCanteen) {
      handleUpdateCanteen(isEditingCanteen, payload as any);
    } else {
      addCanteenMutation.mutate(payload as any);
    }
  };

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Toggle checkbox selection
  const toggleSelection = (id: string, type: 'college' | 'organization') => {
    if (type === 'college') {
      const currentIds = newCanteen.collegeIds || [];
      const newIds = currentIds.includes(id)
        ? currentIds.filter(selectedId => selectedId !== id)
        : [...currentIds, id];
      setNewCanteen({
        ...newCanteen,
        collegeIds: newIds,
        collegeId: newIds[0] || newCanteen.collegeId || '',
      });
    } else {
      const currentIds = newCanteen.organizationIds || [];
      const newIds = currentIds.includes(id)
        ? currentIds.filter(selectedId => selectedId !== id)
        : [...currentIds, id];
      setNewCanteen({
        ...newCanteen,
        organizationIds: newIds,
        organizationId: newIds[0] || newCanteen.organizationId || '',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/admin')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Admin</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <Utensils className="w-8 h-8 text-blue-600" />
                  <span>Canteen Management</span>
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage canteens, operating hours, and contact information
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-sm">
                {canteens.filter(c => c.isActive).length} Active Canteens
              </Badge>
            </div>
          </div>
        </div>

        {/* Add/Edit Canteen Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>{isEditingCanteen ? 'Edit Canteen' : 'Add New Canteen'}</span>
              </span>
              <div className="flex items-center space-x-2">
                {showAddCanteen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="flex items-center space-x-1"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (showAddCanteen) {
                      handleCancelEdit();
                    } else {
                      setShowAddCanteen(true);
                      setIsEditingCanteen(null);
                    }
                  }}
                  className="flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddCanteen ? 'Hide Form' : 'Add Canteen'}</span>
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          {showAddCanteen && (
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="canteen-name">Canteen Name *</Label>
                    <Input
                      id="canteen-name"
                      value={newCanteen.name}
                      onChange={(e) => setNewCanteen({ ...newCanteen, name: e.target.value })}
                      placeholder="e.g., MAIN-CANTEEN"
                    />
                  </div>
                  <div>
                    <Label htmlFor="canteen-code">Canteen Code *</Label>
                    <Input
                      id="canteen-code"
                      value={newCanteen.code}
                      onChange={(e) => setNewCanteen({ ...newCanteen, code: e.target.value })}
                      placeholder="e.g., MAIN-CANTEEN"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="canteen-description">Description</Label>
                  <Textarea
                    id="canteen-description"
                    value={newCanteen.description}
                    onChange={(e) => setNewCanteen({ ...newCanteen, description: e.target.value })}
                    placeholder="Brief description of the canteen"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="canteen-location">Location</Label>
                    <Input
                      id="canteen-location"
                      value={newCanteen.location}
                      onChange={(e) => setNewCanteen({ ...newCanteen, location: e.target.value })}
                      placeholder="e.g., Ground Floor, Main Building"
                    />
                  </div>
                  <div>
                    <Label htmlFor="canteen-contact">Contact Number</Label>
                    <Input
                      id="canteen-contact"
                      value={newCanteen.contactNumber}
                      onChange={(e) => setNewCanteen({ ...newCanteen, contactNumber: e.target.value })}
                      placeholder="e.g., +91-9876543210"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="canteen-email">Email</Label>
                  <Input
                    id="canteen-email"
                    type="email"
                    value={newCanteen.email}
                    onChange={(e) => setNewCanteen({ ...newCanteen, email: e.target.value })}
                    placeholder="e.g., canteen@institution.edu"
                  />
                </div>

                <div>
                  <Label htmlFor="canteen-owner-email">Canteen Owner Email</Label>
                  <Input
                    id="canteen-owner-email"
                    type="email"
                    value={newCanteen.canteenOwnerEmail}
                    onChange={(e) => setNewCanteen({ ...newCanteen, canteenOwnerEmail: e.target.value })}
                    placeholder="e.g., canteenowner@institution.edu"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Canteen Associations (choose any combination)</Label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={enableCollege}
                        onCheckedChange={(checked) => {
                          const enabled = Boolean(checked);
                          setEnableCollege(enabled);
                          if (!enabled) {
                            setNewCanteen({ ...newCanteen, collegeIds: [], collegeId: '' });
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">College</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={enableOrganization}
                        onCheckedChange={(checked) => {
                          const enabled = Boolean(checked);
                          setEnableOrganization(enabled);
                          if (!enabled) {
                            setNewCanteen({ ...newCanteen, organizationIds: [], organizationId: '' });
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Organization</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={enableRestaurant}
                        onCheckedChange={(checked) => {
                          const enabled = Boolean(checked);
                          setEnableRestaurant(enabled);
                          if (enabled) {
                            // disable other associations when restaurant is chosen
                            setEnableCollege(false);
                            setEnableOrganization(false);
                            setNewCanteen({ ...newCanteen, collegeIds: [], collegeId: '', organizationIds: [], organizationId: '' });
                          } else {
                            setNewCanteen({ ...newCanteen, restaurantId: '' });
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Restaurant</span>
                    </label>
                  </div>

                  {/* College selection */}
                  {enableCollege && (
                    <div>
                      <Label>Colleges * (select multiple)</Label>
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white text-left flex items-center justify-between"
                          disabled={collegesLoading}
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {newCanteen.collegeIds?.length
                              ? `${newCanteen.collegeIds.length} college(s) selected`
                              : 'Select colleges'}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {collegesData?.colleges?.filter(college => college.isActive).length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500">No colleges available</div>
                            ) : (
                              collegesData?.colleges?.filter(college => college.isActive).map((college: College) => {
                                const isSelected = newCanteen.collegeIds?.includes(college.id) || false;
                                return (
                                  <label
                                    key={college.id}
                                    className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelection(college.id, 'college')}
                                      className="mr-3"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                      {college.name} ({college.code})
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Click to select multiple colleges</p>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Selected colleges</p>
                        {newCanteen.collegeIds && newCanteen.collegeIds.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                            {newCanteen.collegeIds.map(id => {
                              const college = collegesData?.colleges?.find(c => c.id === id);
                              return (
                                <li key={id}>
                                  {college ? `${college.name} (${college.code})` : id}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-500">None selected</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Organization selection */}
                  {enableOrganization && (
                    <div>
                      <Label>Organizations * (select multiple)</Label>
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white text-left flex items-center justify-between"
                          disabled={organizationsLoading}
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {newCanteen.organizationIds?.length
                              ? `${newCanteen.organizationIds.length} organization(s) selected`
                              : 'Select organizations'}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {organizationsData?.organizations?.filter((org: any) => org.isActive).length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500">No organizations available</div>
                            ) : (
                              organizationsData?.organizations?.filter((org: any) => org.isActive).map((org: any) => {
                                const isSelected = newCanteen.organizationIds?.includes(org.id) || false;
                                return (
                                  <label
                                    key={org.id}
                                    className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelection(org.id, 'organization')}
                                      className="mr-3"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                      {org.name} ({org.code})
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Click to select multiple organizations</p>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Selected organizations</p>
                        {newCanteen.organizationIds && newCanteen.organizationIds.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                            {newCanteen.organizationIds.map(id => {
                              const org = organizationsData?.organizations?.find((o: any) => o.id === id);
                              return (
                                <li key={id}>
                                  {org ? `${org.name} (${org.code})` : id}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-500">None selected</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Restaurant selection */}
                  {enableRestaurant && (
                    <div>
                      <Label>Restaurant *</Label>
                      <select
                        id="canteen-association"
                        value={newCanteen.restaurantId}
                        onChange={(e) => {
                          setNewCanteen({ ...newCanteen, restaurantId: e.target.value, type: 'restaurant' });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        required
                        disabled={restaurantsLoading}
                      >
                        <option value="">
                          {restaurantsLoading ? 'Loading restaurants...' : 'Select a restaurant'}
                        </option>
                        {restaurants.filter(restaurant => restaurant.isActive).map((restaurant: any) => (
                          <option key={restaurant._id || restaurant.id} value={restaurant._id || restaurant.id}>
                            {restaurant.name} ({restaurant.address})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Select one restaurant</p>
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Selected restaurant</p>
                        {newCanteen.restaurantId ? (
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {(() => {
                              const restaurant = restaurants.find((r: any) => (r._id || r.id) === newCanteen.restaurantId);
                              return restaurant ? `${restaurant.name} (${restaurant.address})` : newCanteen.restaurantId;
                            })()}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">None selected</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="canteen-open">Opening Time</Label>
                    <Input
                      id="canteen-open"
                      type="time"
                      value={newCanteen.operatingHours.open}
                      onChange={(e) => setNewCanteen({
                        ...newCanteen,
                        operatingHours: { ...newCanteen.operatingHours, open: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="canteen-close">Closing Time</Label>
                    <Input
                      id="canteen-close"
                      type="time"
                      value={newCanteen.operatingHours.close}
                      onChange={(e) => setNewCanteen({
                        ...newCanteen,
                        operatingHours: { ...newCanteen.operatingHours, close: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newCanteen.isActive}
                    onCheckedChange={(checked) => setNewCanteen({ ...newCanteen, isActive: checked })}
                  />
                  <Label>Active</Label>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={addCanteenMutation.isPending || updateCanteenMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={addCanteenMutation.isPending || updateCanteenMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {addCanteenMutation.isPending || updateCanteenMutation.isPending ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{isEditingCanteen ? 'Updating...' : 'Adding...'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Save className="w-4 h-4" />
                        <span>{isEditingCanteen ? 'Update Canteen' : 'Add Canteen'}</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Canteens List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Utensils className="w-5 h-5" />
              <span>Current Canteens</span>
              <Badge variant="outline" className="text-xs">
                {canteens.length} Total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canteensLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-4">Loading canteens...</p>
              </div>
            ) : canteens.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Utensils className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No canteens found</h3>
                <p className="text-sm mb-4">Get started by adding your first canteen above.</p>
                <Button
                  onClick={() => setShowAddCanteen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Canteen
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {canteens.map((canteen) => (
                  <div
                    key={canteen.id}
                    className="border rounded-lg p-6 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 cursor-pointer"
                    onClick={() => setLocation(`/admin/canteen/${canteen.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{canteen.name}</h4>
                          <Badge variant={canteen.isActive ? "default" : "secondary"}>
                            {canteen.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-sm text-gray-500 font-mono">({canteen.code})</span>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {canteen.type === 'restaurant' ? 'Restaurant' :
                              canteen.type === 'organization' ? 'Organization' :
                                'College'}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {canteen.type === 'restaurant' ? (
                              <>🍽️ {canteen.restaurantId ? (restaurants.find(restaurant => (restaurant._id || restaurant.id) === canteen.restaurantId)?.name || 'Unknown Restaurant') : 'No Restaurant Selected'}</>
                            ) : canteen.type === 'organization' ? (
                              <>🏢 {
                                (canteen.organizationIds && canteen.organizationIds.length > 0)
                                  ? canteen.organizationIds.map(orgId => {
                                    const org = organizationsData?.organizations?.find((org: any) => org.id === orgId);
                                    return org?.name || 'Unknown';
                                  }).join(', ')
                                  : (canteen.organizationId
                                    ? (organizationsData?.organizations?.find((org: any) => org.id === canteen.organizationId)?.name || 'Unknown Organization')
                                    : 'No Organization Selected')
                              }</>
                            ) : (
                              <>🏫 {
                                (canteen.collegeIds && canteen.collegeIds.length > 0)
                                  ? canteen.collegeIds.map(collegeId => {
                                    const college = collegesData?.colleges?.find(college => college.id === collegeId);
                                    return college?.name || 'Unknown';
                                  }).join(', ')
                                  : (canteen.collegeId
                                    ? (collegesData?.colleges?.find(college => college.id === canteen.collegeId)?.name || 'Unknown College')
                                    : 'No College Selected')
                              }</>
                            )}
                          </Badge>
                        </div>

                        {canteen.description && (
                          <p className="text-gray-600 dark:text-gray-300 mb-3">{canteen.description}</p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                            <span className="text-lg">🏫</span>
                            <span>{canteen.collegeId ? (collegesData?.colleges?.find(college => college.id === canteen.collegeId)?.name || 'Unknown College') : 'No College Selected'}</span>
                          </div>
                          {canteen.location && (
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                              <span className="text-lg">📍</span>
                              <span>{canteen.location}</span>
                            </div>
                          )}
                          {canteen.contactNumber && (
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                              <span className="text-lg">📞</span>
                              <span>{canteen.contactNumber}</span>
                            </div>
                          )}
                          {canteen.email && (
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                              <span className="text-lg">✉️</span>
                              <span>{canteen.email}</span>
                            </div>
                          )}
                          {canteen.canteenOwnerEmail && (
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                              <span className="text-lg">👤</span>
                              <span>Owner: {canteen.canteenOwnerEmail}</span>
                            </div>
                          )}
                          {canteen.operatingHours && (
                            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                              <span className="text-lg">🕒</span>
                              <span>{canteen.operatingHours.open} - {canteen.operatingHours.close}</span>
                            </div>
                          )}
                        </div>

                        {canteen.operatingHours?.days && (
                          <div className="mt-3">
                            <span className="text-sm text-gray-500">Operating Days: </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {canteen.operatingHours.days.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Switch
                          checked={canteen.isActive}
                          onCheckedChange={(checked) => handleToggleCanteenStatus(canteen.id, checked)}
                          disabled={updateCanteenMutation.isPending}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCanteen(canteen);
                          }}
                          disabled={updateCanteenMutation.isPending}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCanteen(canteen.id);
                          }}
                          disabled={deleteCanteenMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Note */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <p className="mb-2 font-medium text-blue-900 dark:text-blue-100">
                <Utensils className="w-4 h-4 inline mr-2" />
                Canteen Management Information:
              </p>
              <ul className="space-y-1 text-xs">
                <li>• Canteens can be associated with users and orders for better organization</li>
                <li>• Operating hours help users know when canteens are available</li>
                <li>• Contact information is displayed to users for support</li>
                <li>• Only active canteens will be available for selection in the application</li>
                <li>• Changes to canteen information will be reflected immediately across the application</li>
                <li>• Canteen codes should be unique and descriptive for easy identification</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

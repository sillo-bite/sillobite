import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Save, Shield, Globe, Database, Bell, 
  Mail, Smartphone, CreditCard, FileText, AlertTriangle,
  Server, Wifi, Lock, Key, Palette, Monitor, RefreshCw, 
  Download, Zap, Info, HardDriveIcon, Settings, 
  Clock, Phone, Target, Users, GraduationCap, Plus, Edit, Trash2, BookOpen, } from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import { CacheManager } from "@/utils/cacheManager";
import { UpdateManager } from "@/utils/updateManager";
import { passiveUpdateDetector } from "@/utils/passiveUpdateDetector";
export default function AdminSystemSettingsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuthSync();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version: string; cacheVersion: string }>({
    version: '1.0.0',
    cacheVersion: 'unknown'
  });

  // Fetch system settings
  const { data: systemSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/system-settings'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });




  // Maintenance mode state
  const [maintenanceSettings, setMaintenanceSettings] = useState({
    isActive: false,
    title: 'System Maintenance',
    message: 'We are currently performing system maintenance. Please check back later.',
    estimatedTime: '',
    contactInfo: '',
    targetingType: 'all' as 'all' | 'specific' | 'college' | 'department' | 'year' | 'year_college' | 'year_department',
    specificUsers: [] as string[],
    targetColleges: [] as string[],
    targetDepartments: [] as string[],
    targetYears: [] as number[],
    yearType: 'current' as 'joining' | 'passing' | 'current'
  });

  // Update maintenance settings when data loads
  React.useEffect(() => {
    if (systemSettings) {
      const settings = systemSettings as any;
      setMaintenanceSettings({
        isActive: settings.maintenanceMode?.isActive || false,
        title: settings.maintenanceMode?.title || 'System Maintenance',
        message: settings.maintenanceMode?.message || 'We are currently performing system maintenance. Please check back later.',
        estimatedTime: settings.maintenanceMode?.estimatedTime || '',
        contactInfo: settings.maintenanceMode?.contactInfo || '',
        targetingType: settings.maintenanceMode?.targetingType || 'all',
        specificUsers: settings.maintenanceMode?.specificUsers || [],
        targetColleges: settings.maintenanceMode?.targetColleges || [],
        targetDepartments: settings.maintenanceMode?.targetDepartments || [],
        targetYears: settings.maintenanceMode?.targetYears || [],
        yearType: settings.maintenanceMode?.yearType || 'current'
      });
    }
  }, [systemSettings]);



  // Maintenance mode update mutation
  const updateMaintenanceMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return apiRequest('/api/system-settings/maintenance', {
        method: 'PATCH',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/maintenance-status'] });
      },
    onError: (error) => {
      console.error('Error updating maintenance settings:', error);
      }
  });



  const [generalSettings, setGeneralSettings] = useState({
    canteenName: "Main Campus Canteen",
    operatingHours: "9:00 AM - 9:00 PM",
    deliveryCharges: 20,
    taxRate: 5,
    currency: "INR",
    timezone: "Asia/Kolkata",
    language: "English"
  });

  const [features, setFeatures] = useState({
    onlineOrdering: true,
    mobileApp: true,
    smsNotifications: true,
    emailNotifications: true,
    pushNotifications: true,
    loyaltyProgram: false,
    multiplePayments: true,
    orderTracking: true,
    feedbackSystem: true,
    promotions: true
  });

  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordPolicy: "Standard",
    dataEncryption: true,
    auditLogs: true,
    backupFrequency: "Daily"
  });

  const [notifications, setNotifications] = useState({
    orderNotifications: true,
    lowStockAlerts: true,
    systemAlerts: true,
    revenueReports: false,
    customerFeedback: true
  });




  // Load version info and update status on component mount
  React.useEffect(() => {
    // Check for version info
    UpdateManager.getVersionInfo().then(setVersionInfo);
    
    // Check if update is available
    const checkUpdateStatus = () => {
      const manager = UpdateManager.getInstance();
      setUpdateAvailable(manager.isUpdateReady());
    };
    
    checkUpdateStatus();
  }, []);

  const handleSave = async () => {
    try {
      // Save maintenance settings if any changes were made
      await updateMaintenanceMutation.mutateAsync({
        isActive: maintenanceSettings.isActive,
        title: maintenanceSettings.title,
        message: maintenanceSettings.message,
        estimatedTime: maintenanceSettings.estimatedTime,
        contactInfo: maintenanceSettings.contactInfo,
        targetingType: maintenanceSettings.targetingType,
        specificUsers: maintenanceSettings.specificUsers,
        targetColleges: maintenanceSettings.targetColleges,
        targetDepartments: maintenanceSettings.targetDepartments,
        targetYears: maintenanceSettings.targetYears,
        yearType: maintenanceSettings.yearType
      });
      
      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      
      } catch (error) {
      }
  };

  const toggleFeature = (feature: string) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: !prev[feature as keyof typeof prev]
    }));
  };

  const toggleNotification = (notification: string) => {
    setNotifications(prev => ({
      ...prev,
      [notification]: !prev[notification as keyof typeof prev]
    }));
  };

  // Maintenance mode handlers
  const toggleMaintenanceMode = async () => {
    const newIsActive = !maintenanceSettings.isActive;
    
    // Update local state immediately for responsiveness
    setMaintenanceSettings(prev => ({ ...prev, isActive: newIsActive }));
    
    // Update via API
    await updateMaintenanceMutation.mutateAsync({
      isActive: newIsActive,
      title: maintenanceSettings.title,
      message: maintenanceSettings.message,
      estimatedTime: maintenanceSettings.estimatedTime,
      contactInfo: maintenanceSettings.contactInfo,
      targetingType: maintenanceSettings.targetingType,
      specificUsers: maintenanceSettings.specificUsers,
      targetColleges: maintenanceSettings.targetColleges,
      targetDepartments: maintenanceSettings.targetDepartments,
      targetYears: maintenanceSettings.targetYears,
      yearType: maintenanceSettings.yearType
    });
  };

  const updateMaintenanceDetails = async () => {
    await updateMaintenanceMutation.mutateAsync({
      isActive: maintenanceSettings.isActive,
      title: maintenanceSettings.title,
      message: maintenanceSettings.message,
      estimatedTime: maintenanceSettings.estimatedTime,
      contactInfo: maintenanceSettings.contactInfo,
      targetingType: maintenanceSettings.targetingType,
      specificUsers: maintenanceSettings.specificUsers,
      targetColleges: maintenanceSettings.targetColleges,
      targetDepartments: maintenanceSettings.targetDepartments,
      targetYears: maintenanceSettings.targetYears,
      yearType: maintenanceSettings.yearType
    });
  };

  const handleMaintenanceFieldChange = (field: string, value: string | string[] | number[]) => {
    setMaintenanceSettings(prev => ({ ...prev, [field]: value }));
  };

  // College management handlers
  const handleAddCollege = () => {
    if (!newCollege.name.trim() || !newCollege.code.trim()) {
      return;
    }
    addCollegeMutation.mutate(newCollege);
  };

  const handleUpdateCollege = (id: string, updates: { name?: string; code?: string; isActive?: boolean }) => {
    updateCollegeMutation.mutate({ id, ...updates });
  };

  const handleDeleteCollege = (id: string) => {
    if (window.confirm(`Are you sure you want to delete this college? This will also delete all departments in this college. This action cannot be undone.`)) {
      deleteCollegeMutation.mutate(id);
    }
  };

  const handleToggleCollegeStatus = (id: string, isActive: boolean) => {
    handleUpdateCollege(id, { isActive });
  };

  const handleAddDepartmentToCollege = (collegeId: string) => {
    if (!newDepartment.code.trim() || !newDepartment.name.trim()) {
      return;
    }
    addDepartmentToCollegeMutation.mutate({ collegeId, ...newDepartment });
  };

  const handleUpdateDepartmentInCollege = (collegeId: string, deptCode: string, updates: { name?: string; isActive?: boolean }) => {
    updateDepartmentInCollegeMutation.mutate({ collegeId, deptCode, ...updates });
  };

  const handleDeleteDepartmentFromCollege = (collegeId: string, deptCode: string) => {
    if (window.confirm(`Are you sure you want to delete department ${deptCode}? This action cannot be undone.`)) {
      deleteDepartmentFromCollegeMutation.mutate({ collegeId, deptCode });
    }
  };

  const handleToggleDepartmentStatusInCollege = (collegeId: string, deptCode: string, isActive: boolean) => {
    handleUpdateDepartmentInCollege(collegeId, deptCode, { isActive });
  };


  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await CacheManager.forceRefresh();
    } catch (error) {
      console.error('Force refresh failed:', error);
      } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      await passiveUpdateDetector.manualCheck();
      } catch (error) {
      console.error('Update check failed:', error);
      }
  };

  const handleUpdateApp = () => {
    const manager = UpdateManager.getInstance();
    manager.applyUpdate();
  };

  const handleClearCache = async () => {
    try {
      await CacheManager.clearAllCaches();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Cache clear failed:', error);
      }
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
              <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
              <p className="text-sm text-muted-foreground">Configure application settings and features</p>
            </div>
          </div>
          <Button variant="food" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="w-5 h-5" />
              <span>General Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="canteenName">Canteen Name</Label>
                <Input
                  id="canteenName"
                  value={generalSettings.canteenName}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, canteenName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatingHours">Operating Hours</Label>
                <Input
                  id="operatingHours"
                  value={generalSettings.operatingHours}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, operatingHours: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryCharges">Delivery Charges (₹)</Label>
                <Input
                  id="deliveryCharges"
                  type="number"
                  value={generalSettings.deliveryCharges}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, deliveryCharges: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  value={generalSettings.taxRate}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, taxRate: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={generalSettings.timezone} onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, timezone: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Maintenance Mode</span>
              <Badge 
                variant={maintenanceSettings.isActive ? "destructive" : "secondary"}
                data-testid="maintenance-status"
              >
                {maintenanceSettings.isActive ? "ACTIVE" : "Inactive"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-center space-x-3">
                <AlertTriangle className={`w-6 h-6 ${maintenanceSettings.isActive ? 'text-red-600' : 'text-amber-600'}`} />
                <div>
                  <h3 className="font-medium">System Maintenance Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {maintenanceSettings.isActive 
                      ? "⚠️ Application is currently in maintenance mode - users cannot access the app"
                      : "Toggle to enable maintenance mode and block user access"
                    }
                  </p>
                </div>
              </div>
              <Switch
                checked={maintenanceSettings.isActive}
                onCheckedChange={toggleMaintenanceMode}
                disabled={updateMaintenanceMutation.isPending}
                data-testid="switch-maintenance-mode"
              />
            </div>

            {/* Maintenance Details */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maintenanceTitle">Maintenance Title</Label>
                <Input
                  id="maintenanceTitle"
                  value={maintenanceSettings.title}
                  onChange={(e) => handleMaintenanceFieldChange('title', e.target.value)}
                  placeholder="System Maintenance"
                  data-testid="input-maintenance-title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={maintenanceSettings.message}
                  onChange={(e) => handleMaintenanceFieldChange('message', e.target.value)}
                  placeholder="We are currently performing system maintenance. Please check back later."
                  rows={3}
                  data-testid="textarea-maintenance-message"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime" className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Estimated Duration (Optional)</span>
                  </Label>
                  <Input
                    id="estimatedTime"
                    value={maintenanceSettings.estimatedTime}
                    onChange={(e) => handleMaintenanceFieldChange('estimatedTime', e.target.value)}
                    placeholder="e.g., 2 hours, 30 minutes"
                    data-testid="input-estimated-time"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactInfo" className="flex items-center space-x-1">
                    <Phone className="w-4 h-4" />
                    <span>Contact Information (Optional)</span>
                  </Label>
                  <Input
                    id="contactInfo"
                    value={maintenanceSettings.contactInfo}
                    onChange={(e) => handleMaintenanceFieldChange('contactInfo', e.target.value)}
                    placeholder="e.g., support@canteen.com or +91-1234567890"
                    data-testid="input-contact-info"
                  />
                </div>
              </div>
            </div>

            {/* Targeting Options */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium">Maintenance Targeting</h4>
                <Badge variant="outline" className="text-xs">
                  {maintenanceSettings.targetingType === 'all' ? 'All Users' : 'Customized'}
                </Badge>
              </div>

              <div className="space-y-4 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="targetingType">Who should see the maintenance notice?</Label>
                  <Select 
                    value={maintenanceSettings.targetingType} 
                    onValueChange={(value: typeof maintenanceSettings.targetingType) => 
                      handleMaintenanceFieldChange('targetingType', value)
                    }
                  >
                    <SelectTrigger data-testid="select-targeting-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users (Students & Staff)</SelectItem>
                      <SelectItem value="specific">Specific Users (Reg No / Staff ID)</SelectItem>
                      <SelectItem value="college">By College</SelectItem>
                      <SelectItem value="department">By Department</SelectItem>
                      <SelectItem value="year">By Academic Year</SelectItem>
                      <SelectItem value="year_college">By Year + College</SelectItem>
                      <SelectItem value="year_department">By Year + Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Specific Users Input */}
                {maintenanceSettings.targetingType === 'specific' && (
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Registration Numbers or Staff IDs (comma-separated)</span>
                    </Label>
                    <Textarea
                      value={maintenanceSettings.specificUsers.join(', ')}
                      onChange={(e) => handleMaintenanceFieldChange('specificUsers', 
                        e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                      )}
                      placeholder="Example: 7115123ABC456, STF001, 7115124XYZ789, STF002"
                      rows={3}
                      data-testid="textarea-specific-users"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mix student registration numbers (7115XXABC123) and staff IDs (ABC123) separated by commas
                    </p>
                  </div>
                )}

                {/* College Selection */}
                {(maintenanceSettings.targetingType === 'college' || maintenanceSettings.targetingType === 'year_college') && (
                  <div className="space-y-2">
                    <Label>Select Colleges</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {colleges.filter(college => college.isActive).map(college => (
                        <div key={college.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <input
                            type="checkbox"
                            id={`college-${college.id}`}
                            checked={maintenanceSettings.targetColleges.includes(college.code)}
                            onChange={(e) => {
                              const currentColleges = maintenanceSettings.targetColleges;
                              if (e.target.checked) {
                                handleMaintenanceFieldChange('targetColleges', [...currentColleges, college.code]);
                              } else {
                                handleMaintenanceFieldChange('targetColleges', currentColleges.filter(c => c !== college.code));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                            data-testid={`checkbox-college-${college.id}`}
                          />
                          <Label htmlFor={`college-${college.id}`} className="text-sm font-medium cursor-pointer select-none">
                            {college.code} - {college.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select one or more colleges. Selected: {maintenanceSettings.targetColleges.join(', ') || 'None'}
                    </p>
                  </div>
                )}

                {/* Department Selection */}
                {(maintenanceSettings.targetingType === 'department' || maintenanceSettings.targetingType === 'year_department') && (
                  <div className="space-y-2">
                    <Label>Select Departments</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {colleges.flatMap(college => 
                        college.departments.filter(dept => dept.isActive).map(dept => (
                          <div key={`${college.code}-${dept.code}`} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              id={`dept-${college.code}-${dept.code}`}
                              checked={maintenanceSettings.targetDepartments.includes(dept.code)}
                              onChange={(e) => {
                                const currentDepts = maintenanceSettings.targetDepartments;
                                if (e.target.checked) {
                                  handleMaintenanceFieldChange('targetDepartments', [...currentDepts, dept.code]);
                                } else {
                                  handleMaintenanceFieldChange('targetDepartments', currentDepts.filter(d => d !== dept.code));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                              data-testid={`checkbox-dept-${college.code}-${dept.code}`}
                            />
                            <Label htmlFor={`dept-${college.code}-${dept.code}`} className="text-sm font-medium cursor-pointer select-none">
                              {college.code} - {dept.code} - {dept.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select one or more departments. Selected: {maintenanceSettings.targetDepartments.join(', ') || 'None'}
                    </p>
                  </div>
                )}

                {/* Year Selection */}
                {(maintenanceSettings.targetingType === 'year' || maintenanceSettings.targetingType === 'year_department') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Year Type</Label>
                      <Select 
                        value={maintenanceSettings.yearType} 
                        onValueChange={(value: typeof maintenanceSettings.yearType) => 
                          handleMaintenanceFieldChange('yearType', value)
                        }
                      >
                        <SelectTrigger data-testid="select-year-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current Study Year (1, 2, 3, 4)</SelectItem>
                          <SelectItem value="joining">Joining Year (2021, 2022, 2023, 2024)</SelectItem>
                          <SelectItem value="passing">Passing Out Year (2024, 2025, 2026, 2027)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center space-x-2">
                        <GraduationCap className="w-4 h-4" />
                        <span>Select Years</span>
                      </Label>
                      <div className="grid grid-cols-4 gap-2">
                        {(() => {
                          let availableYears: number[] = [];
                          if (maintenanceSettings.yearType === 'current') {
                            availableYears = [1, 2, 3, 4];
                          } else if (maintenanceSettings.yearType === 'joining') {
                            availableYears = [2020, 2021, 2022, 2023, 2024, 2025];
                          } else if (maintenanceSettings.yearType === 'passing') {
                            availableYears = [2024, 2025, 2026, 2027, 2028, 2029];
                          }
                          
                          return availableYears.map(year => (
                            <div key={year} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <input
                                type="checkbox"
                                id={`year-${year}`}
                                checked={maintenanceSettings.targetYears.includes(year)}
                                onChange={(e) => {
                                  const currentYears = maintenanceSettings.targetYears;
                                  if (e.target.checked) {
                                    handleMaintenanceFieldChange('targetYears', [...currentYears, year]);
                                  } else {
                                    handleMaintenanceFieldChange('targetYears', currentYears.filter(y => y !== year));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                data-testid={`checkbox-year-${year}`}
                              />
                              <Label htmlFor={`year-${year}`} className="text-sm font-medium cursor-pointer select-none">
                                {maintenanceSettings.yearType === 'current' ? `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year` : year}
                              </Label>
                            </div>
                          ));
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {maintenanceSettings.yearType === 'current' && "Select academic years (1st, 2nd, 3rd, 4th year students)"}
                        {maintenanceSettings.yearType === 'joining' && "Select joining years (year students joined the college)"}
                        {maintenanceSettings.yearType === 'passing' && "Select passing out years (year students graduate)"}
                        {maintenanceSettings.targetYears.length > 0 && (
                          <span className="block mt-1 font-medium">
                            Selected: {maintenanceSettings.targetYears.sort().join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Preview of targeting */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                  <p className="text-sm font-medium mb-2">Targeting Summary:</p>
                  <p className="text-xs text-muted-foreground">
                    {maintenanceSettings.targetingType === 'all' && "Maintenance notice will be shown to ALL users (students and staff)"}
                    {maintenanceSettings.targetingType === 'specific' && 
                      `Maintenance notice will be shown to ${maintenanceSettings.specificUsers.length} specific users`
                    }
                    {maintenanceSettings.targetingType === 'college' && 
                      `Maintenance notice will be shown to users in colleges: ${maintenanceSettings.targetColleges.join(', ') || 'None selected'}`
                    }
                    {maintenanceSettings.targetingType === 'department' && 
                      `Maintenance notice will be shown to users in departments: ${maintenanceSettings.targetDepartments.join(', ') || 'None selected'}`
                    }
                    {maintenanceSettings.targetingType === 'year' && 
                      `Maintenance notice will be shown to users with ${maintenanceSettings.yearType} year: ${maintenanceSettings.targetYears.join(', ') || 'None selected'}`
                    }
                    {maintenanceSettings.targetingType === 'year_college' && 
                      `Maintenance notice will be shown to users in colleges [${maintenanceSettings.targetColleges.join(', ') || 'None'}] with ${maintenanceSettings.yearType} year [${maintenanceSettings.targetYears.join(', ') || 'None'}]`
                    }
                    {maintenanceSettings.targetingType === 'year_department' && 
                      `Maintenance notice will be shown to users in departments [${maintenanceSettings.targetDepartments.join(', ') || 'None'}] with ${maintenanceSettings.yearType} year [${maintenanceSettings.targetYears.join(', ') || 'None'}]`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={updateMaintenanceDetails}
                disabled={updateMaintenanceMutation.isPending}
                className="flex-1"
                data-testid="button-save-maintenance"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMaintenanceMutation.isPending ? "Saving..." : "Save Maintenance Settings"}
              </Button>
              
              {maintenanceSettings.isActive && (
                <Button 
                  onClick={() => toggleMaintenanceMode()}
                  variant="outline"
                  disabled={updateMaintenanceMutation.isPending}
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  data-testid="button-disable-maintenance"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Disable Maintenance Mode
                </Button>
              )}
            </div>

            {/* Warning Note */}
            <div className="text-xs text-gray-600 bg-gray-50 dark:bg-gray-900 rounded p-3">
              <p className="mb-2"><strong>⚠️ Important:</strong></p>
              <ul className="space-y-1 text-xs">
                <li>• When maintenance mode is active, users will see a full-screen maintenance message</li>
                <li>• Users cannot access any part of the application during maintenance</li>
                <li>• Admin users can still access the admin panel to toggle maintenance mode off</li>
                <li>• The maintenance status is checked every 30 seconds automatically</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Feature Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="w-5 h-5" />
              <span>Feature Controls</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature === 'onlineOrdering' && 'Allow customers to place orders online'}
                      {feature === 'mobileApp' && 'Enable mobile application features'}
                      {feature === 'smsNotifications' && 'Send SMS updates to customers'}
                      {feature === 'emailNotifications' && 'Send email notifications'}
                      {feature === 'pushNotifications' && 'Send push notifications to mobile'}
                      {feature === 'loyaltyProgram' && 'Enable customer loyalty rewards'}
                      {feature === 'multiplePayments' && 'Accept multiple payment methods'}
                      {feature === 'orderTracking' && 'Real-time order tracking'}
                      {feature === 'feedbackSystem' && 'Customer feedback and ratings'}
                      {feature === 'promotions' && 'Promotional offers and discounts'}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleFeature(feature)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Security & Privacy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
                </div>
                <Switch
                  checked={security.twoFactorAuth}
                  onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, twoFactorAuth: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">Data Encryption</h3>
                  <p className="text-sm text-muted-foreground">Encrypt sensitive data</p>
                </div>
                <Switch
                  checked={security.dataEncryption}
                  onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, dataEncryption: checked }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  value={security.sessionTimeout}
                  onChange={(e) => setSecurity(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Password Policy</Label>
                <Select value={security.passwordPolicy} onValueChange={(value) => setSecurity(prev => ({ ...prev, passwordPolicy: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic (6+ characters)</SelectItem>
                    <SelectItem value="Standard">Standard (8+ chars, mixed case)</SelectItem>
                    <SelectItem value="Strong">Strong (12+ chars, symbols)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Notification Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(notifications).map(([notification, enabled]) => (
                <div key={notification} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium capitalize">{notification.replace(/([A-Z])/g, ' $1').trim()}</h3>
                    <p className="text-sm text-muted-foreground">
                      {notification === 'orderNotifications' && 'Get notified about new orders'}
                      {notification === 'lowStockAlerts' && 'Alerts when inventory is low'}
                      {notification === 'systemAlerts' && 'System health and error notifications'}
                      {notification === 'revenueReports' && 'Daily revenue summary emails'}
                      {notification === 'customerFeedback' && 'New customer feedback notifications'}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleNotification(notification)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>System Health & Maintenance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg text-center">
                  <Database className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="font-medium">Database</p>
                  <Badge variant="default">Healthy</Badge>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Wifi className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="font-medium">Network</p>
                  <Badge variant="default">Online</Badge>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Server className="w-8 h-8 mx-auto mb-2 text-warning" />
                  <p className="font-medium">Server</p>
                  <Badge variant="secondary">Maintenance</Badge>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="font-medium">Security</p>
                  <Badge variant="default">Secure</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <Button variant="outline" className="w-full">
                  <Database className="w-4 h-4 mr-2" />
                  Backup Now
                </Button>
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Export Logs
                </Button>
                <Button variant="outline" className="w-full">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  System Check
                </Button>
                <Button variant="outline" className="w-full">
                  <Monitor className="w-4 h-4 mr-2" />
                  Performance
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Updates & Cache Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>App Updates & Cache Management</span>
              {updateAvailable && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Download className="w-3 h-3 mr-1" />
                  Update Available
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Version Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <Info className="w-4 h-4" />
                      <span>Current Version</span>
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">App version: <span className="font-mono">{versionInfo.version}</span></p>
                  <p className="text-sm text-muted-foreground">Cache version: <span className="font-mono">{versionInfo.cacheVersion}</span></p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <Server className="w-4 h-4" />
                      <span>Update Status</span>
                    </h3>
                    <Badge variant={updateAvailable ? "default" : "secondary"}>
                      {updateAvailable ? "Update Ready" : "Up to Date"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {updateAvailable 
                      ? "A new version is available and ready to install."
                      : "You're running the latest version of the application."
                    }
                  </p>
                </div>
              </div>

              {/* Update Available Section */}
              {updateAvailable && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start mb-3">
                    <Info className="w-4 h-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-green-800 font-medium">New version ready!</p>
                      <p className="text-green-700 mt-1">
                        An updated version with improvements and bug fixes is available.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleUpdateApp}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                    data-testid="button-update-app"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Install Update Now
                  </Button>
                </div>
              )}

              {/* Update Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={handleCheckForUpdates}
                  variant="outline"
                  className="w-full"
                  data-testid="button-check-updates"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Check for Updates
                </Button>
                <Button 
                  onClick={handleClearCache}
                  variant="outline"
                  className="w-full"
                  data-testid="button-clear-cache"
                >
                  <HardDriveIcon className="w-4 h-4 mr-2" />
                  Clear Cache
                </Button>
                <Button 
                  onClick={handleForceRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  className="w-full"
                  data-testid="button-force-refresh"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Force Refresh
                    </>
                  )}
                </Button>
              </div>

              {/* Instructions */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                <p className="mb-2"><strong>Update Management:</strong></p>
                <ul className="space-y-1 text-xs">
                  <li><strong>• Check for Updates:</strong> Manually check for new app versions</li>
                  <li><strong>• Clear Cache:</strong> Clear app cache while preserving user session</li>
                  <li><strong>• Force Refresh:</strong> Complete app reload with cache bypass</li>
                </ul>
                <p className="mt-2"><strong>Note:</strong> Updates are automatically detected. When available, just click "Install Update Now" - no app reinstallation needed.</p>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Integration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="w-5 h-5" />
              <span>Integrations & APIs</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <CreditCard className="w-4 h-4" />
                      <span>Payment Gateway</span>
                    </h3>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Razorpay payment gateway integration</p>
                  <Button variant="outline" size="sm" className="mt-2">Configure</Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>Email Service</span>
                    </h3>
                    <Badge variant="secondary">Inactive</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">SMTP configuration for emails</p>
                  <Button variant="outline" size="sm" className="mt-2">Setup</Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <Smartphone className="w-4 h-4" />
                      <span>SMS Service</span>
                    </h3>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">SMS notifications via Twilio</p>
                  <Button variant="outline" size="sm" className="mt-2">Configure</Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium flex items-center space-x-2">
                      <Key className="w-4 h-4" />
                      <span>API Access</span>
                    </h3>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">External API access keys</p>
                  <Button variant="outline" size="sm" className="mt-2">Manage</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
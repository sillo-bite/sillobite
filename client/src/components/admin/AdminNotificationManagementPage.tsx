import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, Bell, Send, Plus, Eye, Edit, Trash2, 
  Users, MessageSquare, Megaphone, Clock, Check, X,
  Heart, Coffee, ChefHat, Sparkles, Timer, Play, Pause, Save,
  Smartphone, Settings, TestTube, BarChart3, Shield
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PushStats {
  totalSubscriptions: number;
  roleStats: Record<string, number>;
  uniqueUsers: number;
  isConfigured: boolean;
  vapidPublicKey: string | null;
  lastUpdated: number;
}

interface OrderStatusTemplate {
  id: string;
  status: string;
  title: string;
  message: string;
  icon: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
  enabled: boolean;
}

interface CustomTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  icon: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
  enabled: boolean;
  createdBy: number;
}

interface AdvancedBroadcastForm {
  targetType: 'all' | 'role' | 'department' | 'year' | 'specific_users' | 'register_numbers' | 'staff_ids';
  values: string[];
  title: string;
  message: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
}


export default function AdminNotificationManagementPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OrderStatusTemplate | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testUserId, setTestUserId] = useState("");
  const [testOrderNumber, setTestOrderNumber] = useState("");
  const [testStatus, setTestStatus] = useState("preparing");

  // Custom template state
  const [customTemplateDialogOpen, setCustomTemplateDialogOpen] = useState(false);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);
  const [customTemplateForm, setCustomTemplateForm] = useState({
    name: "",
    title: "",
    message: "",
    icon: "🔔",
    priority: "normal" as "normal" | "high",
    requireInteraction: false
  });

  // Advanced broadcast state
  const [advancedBroadcastDialogOpen, setAdvancedBroadcastDialogOpen] = useState(false);
  const [advancedBroadcastForm, setAdvancedBroadcastForm] = useState<AdvancedBroadcastForm>({
    targetType: "all",
    values: [],
    title: "",
    message: "",
    priority: "normal",
    requireInteraction: false
  });
  const [targetValues, setTargetValues] = useState("");

  // Fetch push notification statistics
  const { data: pushStats, isLoading: statsLoading } = useQuery<PushStats>({
    queryKey: ['/api/push/stats'],
    refetchInterval: false, // Disabled automatic refresh
  });

  // Fetch notification templates
  const { data: orderTemplates = [], isLoading: templatesLoading } = useQuery<OrderStatusTemplate[]>({
    queryKey: ['/api/push/templates'],
    refetchInterval: false, // Disabled automatic refresh
  });

  // Fetch custom notification templates
  const { data: customTemplates = [], isLoading: customTemplatesLoading } = useQuery<CustomTemplate[]>({
    queryKey: ['/api/push/custom-templates'],
    refetchInterval: false, // Disabled automatic refresh
  });

  // Send test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async (data: { userId: string; title: string; message: string }) => {
      return apiRequest('/api/push/send-test', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      },
    onError: (error: any) => {
      }
  });

  // Send test order status notification mutation
  const testOrderNotificationMutation = useMutation({
    mutationFn: async (data: { userId: string; orderNumber?: string; status: string }) => {
      return apiRequest('/api/push/test-order-status', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setTestDialogOpen(false);
    },
    onError: (error: any) => {
      }
  });

  // Send broadcast notification mutation
  const broadcastMutation = useMutation({
    mutationFn: async (data: { title: string; body: string; url?: string }) => {
      return apiRequest('/api/push/send-to-all', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      },
    onError: (error: any) => {
      }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: OrderStatusTemplate) => {
      return apiRequest(`/api/push/templates/${template.status}`, {
        method: 'PUT',
        body: JSON.stringify(template),
      });
    },
    onSuccess: (_, template) => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/templates'] });
      },
    onError: (error: any) => {
      }
  });

  // Create custom template mutation
  const createCustomTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/push/custom-templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/custom-templates'] });
      setCustomTemplateDialogOpen(false);
      setCustomTemplateForm({
        name: "",
        title: "",
        message: "",
        icon: "🔔",
        priority: "normal",
        requireInteraction: false
      });
    },
    onError: (error: any) => {
      }
  });

  // Delete custom template mutation
  const deleteCustomTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest(`/api/push/custom-templates/${templateId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/custom-templates'] });
      },
    onError: (error: any) => {
      }
  });

  // Advanced broadcast mutation
  const advancedBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/push/send-advanced', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      setAdvancedBroadcastDialogOpen(false);
      setAdvancedBroadcastForm({
        targetType: "all",
        values: [],
        title: "",
        message: "",
        priority: "normal",
        requireInteraction: false
      });
      setTargetValues("");
    },
    onError: (error: any) => {
      }
  });

  // Send custom template notification mutation
  const sendCustomTemplateNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/push/send-custom-template', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      },
    onError: (error: any) => {
      }
  });

  const handleToggleTemplate = (templateId: string) => {
    const template = orderTemplates.find(t => t.id === templateId);
    if (template) {
      const updatedTemplate = { ...template, enabled: !template.enabled };
      updateTemplateMutation.mutate(updatedTemplate);
    }
  };

  const handleEditTemplate = (template: OrderStatusTemplate) => {
    setSelectedTemplate(template);
    setEditDialogOpen(true);
  };

  const handleCreateCustomTemplate = () => {
    if (!customTemplateForm.name || !customTemplateForm.title || !customTemplateForm.message) {
      return;
    }

    createCustomTemplateMutation.mutate({
      ...customTemplateForm,
      createdBy: 1 // Should be the current admin user ID
    });
  };

  const resetBroadcastForm = () => {
    setAdvancedBroadcastForm({
      targetType: "all",
      values: [],
      title: "",
      message: "",
      priority: "normal",
      requireInteraction: false
    });
    setTargetValues("");
    setSelectedCustomTemplate(null);
  };

  const handleAdvancedBroadcast = () => {
    if (!advancedBroadcastForm.title || !advancedBroadcastForm.message) {
      return;
    }

    const values = targetValues ? targetValues.split(',').map(v => v.trim()).filter(v => v) : [];
    
    advancedBroadcastMutation.mutate({
      targetType: advancedBroadcastForm.targetType,
      values,
      title: advancedBroadcastForm.title,
      body: advancedBroadcastForm.message,
      priority: advancedBroadcastForm.priority,
      requireInteraction: advancedBroadcastForm.requireInteraction
    });
  };

  const handleSendCustomTemplate = (templateId: string, targetType: string, values: string[]) => {
    sendCustomTemplateNotificationMutation.mutate({
      templateId,
      targetType,
      values
    });
  };

  const handleSaveTemplate = () => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate(selectedTemplate);
      setEditDialogOpen(false);
      setSelectedTemplate(null);
    }
  };

  const handleSendTestOrder = () => {
    if (!testUserId.trim()) {
      return;
    }

    testOrderNotificationMutation.mutate({
      userId: testUserId,
      orderNumber: testOrderNumber || undefined,
      status: testStatus,
    });
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground";
  };

  const getPriorityColor = (priority: string) => {
    return priority === 'high' ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  };

  return (
    <div className="p-6 space-y-6" data-testid="admin-notification-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/admin")}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Push Notification Management</h1>
            <p className="text-muted-foreground">Web Push + VAPID notification system for order updates</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setTestDialogOpen(true)}
            variant="outline"
            data-testid="button-test-notification"
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test Notification
          </Button>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">System Status</span>
            <Badge variant={pushStats?.isConfigured ? "default" : "destructive"} data-testid="status-badge">
              {pushStats?.isConfigured ? "Active" : "Not Configured"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-subscriptions">
                  {statsLoading ? "..." : pushStats?.totalSubscriptions || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Subscriptions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-users">
                  {statsLoading ? "..." : pushStats?.uniqueUsers || 0}
                </p>
                <p className="text-xs text-muted-foreground">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-admins">
                  {statsLoading ? "..." : pushStats?.roleStats?.admin || 0}
                </p>
                <p className="text-xs text-muted-foreground">Admin Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-students">
                  {statsLoading ? "..." : pushStats?.roleStats?.student || 0}
                </p>
                <p className="text-xs text-muted-foreground">Student Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        {["overview", "templates", "custom-templates", "broadcast", "settings"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
            className="capitalize"
            data-testid={`tab-${tab}`}
          >
            {tab === "overview" && <BarChart3 className="h-4 w-4 mr-2" />}
            {tab === "templates" && <MessageSquare className="h-4 w-4 mr-2" />}
            {tab === "custom-templates" && <Plus className="h-4 w-4 mr-2" />}
            {tab === "broadcast" && <Megaphone className="h-4 w-4 mr-2" />}
            {tab === "settings" && <Settings className="h-4 w-4 mr-2" />}
            {tab.replace('-', ' ')}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">VAPID Configuration</Label>
                  <p className="text-sm" data-testid="vapid-status">
                    {pushStats?.isConfigured ? "✅ Configured" : "❌ Not Configured"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Public Key</Label>
                  <p className="text-sm font-mono text-muted-foreground" data-testid="vapid-key">
                    {pushStats?.vapidPublicKey ? `${pushStats.vapidPublicKey.substring(0, 20)}...` : "Not Available"}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Subscription Distribution by Role</Label>
                <div className="flex space-x-2">
                  {pushStats?.roleStats && Object.entries(pushStats.roleStats).map(([role, count]) => (
                    <Badge key={role} variant="outline" data-testid={`role-stat-${role}`}>
                      {role}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex space-x-3">
                <Button
                  onClick={() => testNotificationMutation.mutate({ 
                    userId: "demo", 
                    title: "Demo Notification", 
                    message: "This is a test notification from the admin panel!" 
                  })}
                  disabled={testNotificationMutation.isPending}
                  data-testid="button-send-demo"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Demo Notification
                </Button>
                <Button
                  variant="outline"
                  onClick={() => broadcastMutation.mutate({ 
                    title: "System Announcement", 
                    body: "This is a test broadcast message to all users." 
                  })}
                  disabled={broadcastMutation.isPending}
                  data-testid="button-broadcast"
                >
                  <Megaphone className="h-4 w-4 mr-2" />
                  Test Broadcast
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Order Status Notification Templates</h2>
            <Badge variant="outline" data-testid="template-count">
              {templatesLoading ? "Loading..." : `${orderTemplates.filter(t => t.enabled).length} / ${orderTemplates.length} Active`}
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {orderTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow" data-testid={`template-card-${template.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{template.icon}</span>
                      <div>
                        <h3 className="font-semibold text-sm capitalize">{template.status}</h3>
                        <div className="flex space-x-1 mt-1">
                          <Badge variant="outline" className={getPriorityColor(template.priority)}>
                            {template.priority}
                          </Badge>
                          {template.requireInteraction && (
                            <Badge variant="outline" className="text-xs">
                              Interactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Switch 
                      checked={template.enabled}
                      onCheckedChange={() => handleToggleTemplate(template.id)}
                      data-testid={`toggle-template-${template.id}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-foreground">{template.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{template.message}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditTemplate(template)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Turn on/off all push notifications system-wide</p>
                </div>
                <Switch 
                  checked={notificationEnabled}
                  onCheckedChange={setNotificationEnabled}
                  data-testid="toggle-global-notifications"
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notification Types</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Order Status Updates</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payment Confirmations</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">New Order Alerts (Admin)</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Custom Templates Tab */}
      {activeTab === "custom-templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Custom Notification Templates</h2>
              <p className="text-muted-foreground">Create and manage custom broadcast templates</p>
            </div>
            <Dialog open={customTemplateDialogOpen} onOpenChange={setCustomTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-custom-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-background">
                <DialogHeader>
                  <DialogTitle>Create Custom Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input
                      id="templateName"
                      value={customTemplateForm.name}
                      onChange={(e) => setCustomTemplateForm({ ...customTemplateForm, name: e.target.value })}
                      placeholder="e.g., Weekly Update"
                      data-testid="input-template-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="templateTitle">Notification Title</Label>
                    <Input
                      id="templateTitle"
                      value={customTemplateForm.title}
                      onChange={(e) => setCustomTemplateForm({ ...customTemplateForm, title: e.target.value })}
                      placeholder="e.g., Weekly Newsletter"
                      data-testid="input-template-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="templateMessage">Message</Label>
                    <Textarea
                      id="templateMessage"
                      value={customTemplateForm.message}
                      onChange={(e) => setCustomTemplateForm({ ...customTemplateForm, message: e.target.value })}
                      placeholder="e.g., Check out this week's updates..."
                      className="min-h-[80px]"
                      data-testid="textarea-template-message"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateIcon">Icon</Label>
                      <Input
                        id="templateIcon"
                        value={customTemplateForm.icon}
                        onChange={(e) => setCustomTemplateForm({ ...customTemplateForm, icon: e.target.value })}
                        placeholder="🔔"
                        data-testid="input-template-icon"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="templatePriority">Priority</Label>
                      <Select 
                        value={customTemplateForm.priority} 
                        onValueChange={(value: "normal" | "high") => setCustomTemplateForm({ ...customTemplateForm, priority: value })}
                      >
                        <SelectTrigger data-testid="select-template-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={customTemplateForm.requireInteraction}
                      onCheckedChange={(checked) => setCustomTemplateForm({ ...customTemplateForm, requireInteraction: checked })}
                      data-testid="toggle-template-interaction"
                    />
                    <Label>Require user interaction</Label>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setCustomTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCustomTemplate} disabled={createCustomTemplateMutation.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {customTemplatesLoading ? (
              <div className="text-center py-8">Loading custom templates...</div>
            ) : customTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No custom templates created yet. Create your first template above.
              </div>
            ) : (
              customTemplates.map((template) => (
                <Card key={template.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{template.icon}</span>
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge variant={template.priority === 'high' ? 'destructive' : 'secondary'}>
                            {template.priority}
                          </Badge>
                        </div>
                        <p className="font-medium">{template.title}</p>
                        <p className="text-muted-foreground text-sm">{template.message}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            resetBroadcastForm();
                            setSelectedCustomTemplate(template);
                            setAdvancedBroadcastForm({
                              targetType: "all",
                              values: [],
                              title: template.title,
                              message: template.message,
                              priority: template.priority,
                              requireInteraction: template.requireInteraction
                            });
                            setAdvancedBroadcastDialogOpen(true);
                          }}
                          data-testid={`button-send-template-${template.id}`}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCustomTemplateMutation.mutate(template.id)}
                          disabled={deleteCustomTemplateMutation.isPending}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Advanced Broadcast Tab */}
      {activeTab === "broadcast" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Advanced Broadcast</h2>
              <p className="text-muted-foreground">Send targeted notifications to specific groups</p>
            </div>
            <Dialog open={advancedBroadcastDialogOpen} onOpenChange={(open) => {
              setAdvancedBroadcastDialogOpen(open);
              if (open) resetBroadcastForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-broadcast">
                  <Megaphone className="h-4 w-4 mr-2" />
                  Create Broadcast
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] bg-background">
                <DialogHeader>
                  <DialogTitle>Create Advanced Broadcast</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="templateSelect">Use Custom Template (Optional)</Label>
                    <Select 
                      value={selectedCustomTemplate?.id || "new"} 
                      onValueChange={(value) => {
                        if (value && value !== "new") {
                          const template = customTemplates.find(t => t.id === value);
                          if (template) {
                            setSelectedCustomTemplate(template);
                            setAdvancedBroadcastForm({
                              ...advancedBroadcastForm,
                              title: template.title,
                              message: template.message,
                              priority: template.priority,
                              requireInteraction: template.requireInteraction
                            });
                          }
                        } else {
                          setSelectedCustomTemplate(null);
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-custom-template">
                        <SelectValue placeholder="Choose a template or create new" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Create New Notification</SelectItem>
                        {customTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.icon} {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcastTitle">Notification Title</Label>
                    <Input
                      id="broadcastTitle"
                      value={advancedBroadcastForm.title}
                      onChange={(e) => setAdvancedBroadcastForm({ ...advancedBroadcastForm, title: e.target.value })}
                      placeholder="e.g., Important Announcement"
                      data-testid="input-broadcast-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcastMessage">Message</Label>
                    <Textarea
                      id="broadcastMessage"
                      value={advancedBroadcastForm.message}
                      onChange={(e) => setAdvancedBroadcastForm({ ...advancedBroadcastForm, message: e.target.value })}
                      placeholder="e.g., Please check the latest updates..."
                      className="min-h-[80px]"
                      data-testid="textarea-broadcast-message"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetType">Target Audience</Label>
                    <Select 
                      value={advancedBroadcastForm.targetType} 
                      onValueChange={(value: any) => {
                        setAdvancedBroadcastForm({ ...advancedBroadcastForm, targetType: value });
                        setTargetValues(""); // Reset target values when changing type
                      }}
                    >
                      <SelectTrigger data-testid="select-target-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="role">By Role</SelectItem>
                        <SelectItem value="department">By Department</SelectItem>
                        <SelectItem value="year">By Study Year</SelectItem>
                        <SelectItem value="specific_users">Specific User IDs</SelectItem>
                        <SelectItem value="register_numbers">By Register Numbers</SelectItem>
                        <SelectItem value="staff_ids">By Staff IDs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {advancedBroadcastForm.targetType !== "all" && (
                    <div className="space-y-2">
                      <Label htmlFor="targetValues">Target Values</Label>
                      {advancedBroadcastForm.targetType === "role" ? (
                        <Select 
                          value={targetValues} 
                          onValueChange={(value) => setTargetValues(value)}
                        >
                          <SelectTrigger data-testid="select-target-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="faculty">Faculty</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : advancedBroadcastForm.targetType === "department" ? (
                        <Select 
                          value={targetValues} 
                          onValueChange={(value) => setTargetValues(value)}
                        >
                          <SelectTrigger data-testid="select-target-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CSE">Computer Science Engineering</SelectItem>
                            <SelectItem value="ECE">Electronics & Communication</SelectItem>
                            <SelectItem value="MECH">Mechanical Engineering</SelectItem>
                            <SelectItem value="CIVIL">Civil Engineering</SelectItem>
                            <SelectItem value="EEE">Electrical & Electronics</SelectItem>
                            <SelectItem value="IT">Information Technology</SelectItem>
                            <SelectItem value="MBA">Master of Business Administration</SelectItem>
                            <SelectItem value="MCA">Master of Computer Applications</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : advancedBroadcastForm.targetType === "year" ? (
                        <Select 
                          value={targetValues} 
                          onValueChange={(value) => setTargetValues(value)}
                        >
                          <SelectTrigger data-testid="select-target-year">
                            <SelectValue placeholder="Select study year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1st Year</SelectItem>
                            <SelectItem value="2">2nd Year</SelectItem>
                            <SelectItem value="3">3rd Year</SelectItem>
                            <SelectItem value="4">4th Year</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <>
                          <Input
                            id="targetValues"
                            value={targetValues}
                            onChange={(e) => setTargetValues(e.target.value)}
                            placeholder={
                              advancedBroadcastForm.targetType === "specific_users" ? "e.g., 1, 2, 3" :
                              advancedBroadcastForm.targetType === "register_numbers" ? "e.g., 7115CSE001, 7115ECE002" :
                              "e.g., CSE001, ECE002"
                            }
                            data-testid="input-target-values"
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter comma-separated values for targeting
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="broadcastPriority">Priority</Label>
                      <Select 
                        value={advancedBroadcastForm.priority} 
                        onValueChange={(value: "normal" | "high") => setAdvancedBroadcastForm({ ...advancedBroadcastForm, priority: value })}
                      >
                        <SelectTrigger data-testid="select-broadcast-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch 
                        checked={advancedBroadcastForm.requireInteraction}
                        onCheckedChange={(checked) => setAdvancedBroadcastForm({ ...advancedBroadcastForm, requireInteraction: checked })}
                        data-testid="toggle-broadcast-interaction"
                      />
                      <Label>Require interaction</Label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setAdvancedBroadcastDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAdvancedBroadcast} disabled={advancedBroadcastMutation.isPending}>
                    <Megaphone className="h-4 w-4 mr-2" />
                    Send Broadcast
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Broadcast Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => {
                    resetBroadcastForm();
                    setAdvancedBroadcastForm({
                      targetType: "role",
                      values: ["student"],
                      title: "",
                      message: "",
                      priority: "normal",
                      requireInteraction: false
                    });
                    setTargetValues("student");
                    setAdvancedBroadcastDialogOpen(true);
                  }}
                  data-testid="button-broadcast-students"
                >
                  <Users className="h-6 w-6 mb-2" />
                  All Students
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => {
                    resetBroadcastForm();
                    setAdvancedBroadcastForm({
                      targetType: "department",
                      values: [],
                      title: "",
                      message: "",
                      priority: "normal",
                      requireInteraction: false
                    });
                    setTargetValues("");
                    setAdvancedBroadcastDialogOpen(true);
                  }}
                  data-testid="button-broadcast-department"
                >
                  <Shield className="h-6 w-6 mb-2" />
                  By Department
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col"
                  onClick={() => {
                    resetBroadcastForm();
                    setAdvancedBroadcastForm({
                      targetType: "year",
                      values: [],
                      title: "",
                      message: "",
                      priority: "normal",
                      requireInteraction: false
                    });
                    setTargetValues("");
                    setAdvancedBroadcastDialogOpen(true);
                  }}
                  data-testid="button-broadcast-year"
                >
                  <Clock className="h-6 w-6 mb-2" />
                  By Study Year
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit Notification Template</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="icon" className="text-right">Icon</Label>
                <Input
                  id="icon"
                  value={selectedTemplate.icon}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, icon: e.target.value })}
                  className="col-span-3"
                  placeholder="🔔"
                  data-testid="input-icon"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">Title</Label>
                <Input
                  id="title"
                  value={selectedTemplate.title}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, title: e.target.value })}
                  className="col-span-3"
                  placeholder="Order Ready!"
                  data-testid="input-title"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">Priority</Label>
                <Select 
                  value={selectedTemplate.priority} 
                  onValueChange={(value) => setSelectedTemplate({ ...selectedTemplate, priority: value as 'normal' | 'high' })}
                >
                  <SelectTrigger className="col-span-3" data-testid="select-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="message" className="text-right pt-2">Message</Label>
                <Textarea
                  id="message"
                  value={selectedTemplate.message}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, message: e.target.value })}
                  className="col-span-3 min-h-[80px]"
                  placeholder="Your order is ready for collection at the counter."
                  data-testid="textarea-message"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Interactive</Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <Switch 
                    checked={selectedTemplate.requireInteraction}
                    onCheckedChange={(checked) => setSelectedTemplate({ ...selectedTemplate, requireInteraction: checked })}
                    data-testid="toggle-interaction"
                  />
                  <span className="text-sm text-muted-foreground">Require user interaction</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Notification Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <TestTube className="h-5 w-5" />
              <span>Send Test Order Notification</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testUserId">User ID</Label>
              <Input
                id="testUserId"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Enter user ID"
                data-testid="input-test-user-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testOrderNumber">Order Number (Optional)</Label>
              <Input
                id="testOrderNumber"
                value={testOrderNumber}
                onChange={(e) => setTestOrderNumber(e.target.value)}
                placeholder="Leave empty for random"
                data-testid="input-test-order-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testStatus">Order Status</Label>
              <Select value={testStatus} onValueChange={setTestStatus}>
                <SelectTrigger data-testid="select-test-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="pending">Order Placed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready for Pickup</SelectItem>
                  <SelectItem value="completed">Order Delivered (Admin)</SelectItem>
                  <SelectItem value="delivered">Order Delivered (Barcode)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setTestDialogOpen(false)}
              data-testid="button-cancel-test"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendTestOrder}
              disabled={testOrderNotificationMutation.isPending}
              data-testid="button-send-test"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
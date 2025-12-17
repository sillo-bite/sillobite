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

interface CanteenAdminNotificationManagementProps {
  canteenId: string;
}

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

export default function CanteenAdminNotificationManagement({ canteenId }: CanteenAdminNotificationManagementProps) {
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
    refetchInterval: false,
  });

  // Fetch notification templates
  const { data: orderTemplates = [], isLoading: templatesLoading } = useQuery<OrderStatusTemplate[]>({
    queryKey: ['/api/push/templates'],
    refetchInterval: false,
  });

  // Fetch custom notification templates
  const { data: customTemplates = [], isLoading: customTemplatesLoading } = useQuery<CustomTemplate[]>({
    queryKey: ['/api/push/custom-templates'],
    refetchInterval: false,
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
    <div className="p-6 space-y-6" data-testid="canteen-admin-notification-management">
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
            <h1 className="text-2xl font-bold text-foreground">Notification Management</h1>
            <p className="text-muted-foreground">Manage push notifications for this canteen</p>
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
        {["overview", "templates", "settings"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
            className="capitalize"
            data-testid={`tab-${tab}`}
          >
            {tab === "overview" && <BarChart3 className="h-4 w-4 mr-2" />}
            {tab === "templates" && <MessageSquare className="h-4 w-4 mr-2" />}
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
                    message: "This is a test notification from the canteen admin panel!" 
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
                    title: "Canteen Announcement", 
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
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Turn on/off all push notifications for this canteen</p>
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
                    <span className="text-sm">New Order Alerts</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
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




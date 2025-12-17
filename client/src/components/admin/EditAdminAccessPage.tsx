import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
export default function EditAdminAccessPage() {
  const [, setLocation] = useLocation();
  const { userId } = useParams();
  // Mock data - in real app, this would come from API based on userId
  const [adminUser, setAdminUser] = useState({
    id: userId || "1",
    name: "John Doe",
    email: "admin@canteen.local",
    role: "Manager",
    permissions: ["Orders", "Menu"]
  });

  const availablePermissions = ["All Access", "Orders", "Menu", "Analytics", "User Management", "Settings"];
  const availableRoles = ["Super Admin", "Manager", "Staff", "Viewer"];

  const handleSave = () => {
    // In real app, save to API
    setLocation("/admin/admin-access");
  };

  const handleDelete = () => {
    // In real app, delete from API
    setLocation("/admin/admin-access");
  };

  const togglePermission = (permission: string) => {
    setAdminUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
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
              onClick={() => setLocation("/admin/admin-access")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Admin Access</h1>
              <p className="text-sm text-muted-foreground">Modify user permissions and role</p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleDelete}
            className="flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete User</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Role</Label>
              <Select
                value={adminUser.role}
                onValueChange={(value) => setAdminUser(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Permissions</Label>
              <div className="grid grid-cols-2 gap-3">
                {availablePermissions.map((permission) => (
                  <div key={permission} className="flex items-center space-x-3 p-2">
                    <Checkbox
                      id={permission}
                      checked={adminUser.permissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label 
                      htmlFor={permission} 
                      className="text-sm font-normal cursor-pointer select-none"
                    >
                      {permission}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6">
              <Button 
                variant="food" 
                onClick={handleSave}
                className="flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setLocation("/admin/admin-access")}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, Plus, ExternalLink, Hash, Users
} from "lucide-react";
import { useAuthSync } from "@/hooks/useDataSync";
import { useLocation } from "wouter";

export default function AdminCollegeManagementPage() {
  const { user } = useAuthSync();
  const [, setLocation] = useLocation();

  // College management state
  const [colleges, setColleges] = useState<Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    departments: Array<any>;
    activeRoles: {
      student: boolean;
      staff: boolean;
      employee: boolean;
      guest: boolean;
    };
    adminEmail?: string;
  }>>([]);

  const [newCollege, setNewCollege] = useState({ name: '', code: '', isActive: true, adminEmail: '' });
  const [showAddCollege, setShowAddCollege] = useState(false);

  // Fetch colleges
  const { data: collegesData, isLoading: collegesLoading } = useQuery({
    queryKey: ['/api/system-settings/colleges'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Update colleges when data loads
  React.useEffect(() => {
    if (collegesData && typeof collegesData === 'object' && collegesData !== null && 'colleges' in collegesData) {
      setColleges((collegesData as any).colleges || []);
    }
  }, [collegesData]);

  // College management mutations
  const addCollegeMutation = useMutation({
    mutationFn: async (collegeData: { name: string; code: string; isActive: boolean; adminEmail?: string }) => {
      return apiRequest('/api/system-settings/colleges', {
        method: 'POST',
        body: JSON.stringify({
          ...collegeData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
      setNewCollege({ name: '', code: '', isActive: true, adminEmail: '' });
      setShowAddCollege(false);
    },
    onError: (error: any) => {
      console.error('Error adding college:', error);
    }
  });

  const updateCollegeMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; name?: string; code?: string; isActive?: boolean; adminEmail?: string }) => {
      return apiRequest(`/api/system-settings/colleges/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updatedBy: user?.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/colleges'] });
    },
    onError: (error: any) => {
      console.error('Error updating college:', error);
    }
  });

  // College management handlers
  const handleAddCollege = () => {
    if (!newCollege.name.trim() || !newCollege.code.trim()) {
      return;
    }
    addCollegeMutation.mutate(newCollege);
  };

  const handleToggleCollegeStatus = (e: React.MouseEvent, id: string, isActive: boolean) => {
    e.stopPropagation();
    updateCollegeMutation.mutate({ id, isActive });
  };

  const activeRolesCount = (roles: any) => {
    if (!roles) return 0;
    return Object.values(roles).filter(Boolean).length;
  };

  if (collegesLoading) {
    return <div className="p-8 text-center">Loading colleges...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">College Management</h1>
          <p className="text-muted-foreground">
            Manage colleges, departments, and user roles
          </p>
        </div>
        <Button onClick={() => setShowAddCollege(!showAddCollege)}>
          <Plus className="w-4 h-4 mr-2" />
          Add College
        </Button>
      </div>

      {showAddCollege && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Add New College</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>College Name</Label>
                <Input
                  placeholder="e.g. Example Engineering College"
                  value={newCollege.name}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>College Code</Label>
                <Input
                  placeholder="e.g. EEC"
                  value={newCollege.code}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Email (Optional)</Label>
                <Input
                  placeholder="admin@college.edu"
                  value={newCollege.adminEmail}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, adminEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    checked={newCollege.isActive}
                    onCheckedChange={(checked) => setNewCollege(prev => ({ ...prev, isActive: checked }))}
                  />
                  <span>{newCollege.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="ghost" onClick={() => setShowAddCollege(false)}>Cancel</Button>
              <Button onClick={handleAddCollege} disabled={addCollegeMutation.isPending}>
                {addCollegeMutation.isPending ? 'Adding...' : 'Add College'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {colleges.map((college) => (
          <Card
            key={college.id}
            className="group cursor-pointer hover:shadow-lg transition-all border-l-4 hover:border-primary border-l-transparent"
            onClick={() => setLocation(`/admin/college-management/${college.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform" />
                    {college.code}
                  </CardTitle>
                </div>
                <Switch
                  checked={college.isActive}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(checked) => handleToggleCollegeStatus({ stopPropagation: () => { } } as any, college.id, checked)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-medium mb-4 line-clamp-1" title={college.name}>{college.name}</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
                  <span className="flex items-center">
                    <Hash className="w-4 h-4 mr-2" />
                    Departments
                  </span>
                  <Badge variant="secondary">{college.departments?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Active Roles
                  </span>
                  <Badge variant="secondary">{activeRolesCount(college.activeRoles)}</Badge>
                </div>
              </div>

              <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground" variant="outline">
                Manage Details <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {colleges.length === 0 && !collegesLoading && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Colleges Found</h3>
          <p className="text-muted-foreground mb-4">Get started by adding your first college.</p>
          <Button onClick={() => setShowAddCollege(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add College
          </Button>
        </div>
      )}
    </div>
  );
}

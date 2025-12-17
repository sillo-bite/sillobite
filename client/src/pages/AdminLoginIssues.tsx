import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, MessageSquare, CheckCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LoginIssue {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  registerNumber?: string;
  staffId?: string;
  issueType: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export default function AdminLoginIssues() {
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<LoginIssue | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [resolvedBy, setResolvedBy] = useState("");

  const { data: issues = [], isLoading, error } = useQuery<LoginIssue[]>({
    queryKey: ["/api/login-issues"],
    refetchInterval: false, // Disabled automatic refresh
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest(`/api/login-issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/login-issues"] });
      setSelectedIssue(null);
      setAdminNotes("");
      setNewStatus("");
      setResolvedBy("");
    },
    onError: () => {
      },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/login-issues/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/login-issues"] });
      },
    onError: () => {
      },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="destructive"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "in_progress":
        return <Badge variant="default"><RefreshCw className="w-3 h-3 mr-1" />In Progress</Badge>;
      case "resolved":
        return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getIssueTypeBadge = (type: string) => {
    const typeMap: { [key: string]: { label: string; variant: any } } = {
      forgot_email: { label: "Forgot Email", variant: "default" },
      account_locked: { label: "Account Locked", variant: "destructive" },
      email_changed: { label: "Email Changed", variant: "secondary" },
      registration_problem: { label: "Registration Problem", variant: "outline" },
      other: { label: "Other", variant: "outline" },
    };

    const config = typeMap[type] || { label: type, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleUpdateIssue = () => {
    if (!selectedIssue) return;

    const updates: any = {};
    if (newStatus) {
      updates.status = newStatus;
      if (newStatus === "resolved" && resolvedBy) {
        updates.resolvedBy = resolvedBy;
      }
    }
    if (adminNotes !== selectedIssue.adminNotes) {
      updates.adminNotes = adminNotes;
    }

    updateIssueMutation.mutate({ id: selectedIssue.id, updates });
  };

  const openIssueDialog = (issue: LoginIssue) => {
    setSelectedIssue(issue);
    setAdminNotes(issue.adminNotes || "");
    setNewStatus(issue.status);
    setResolvedBy(issue.resolvedBy || "");
  };

  const pendingCount = issues.filter((issue) => issue.status === "pending").length;
  const inProgressCount = issues.filter((issue) => issue.status === "in_progress").length;
  const resolvedCount = issues.filter((issue) => issue.status === "resolved").length;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading login issues...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Issues</h3>
            <p className="text-muted-foreground">Unable to load login issues. Please refresh the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Login Issues Management</h1>
          <p className="text-muted-foreground">Monitor and resolve user login problems</p>
        </div>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/login-issues"] })}
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Issues</p>
                <p className="text-2xl font-bold">{issues.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-red-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Login Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Login Issues</h3>
              <p className="text-muted-foreground">Great! There are currently no reported login issues.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <div key={issue.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{issue.name}</h3>
                        {getStatusBadge(issue.status)}
                        {getIssueTypeBadge(issue.issueType)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {issue.registerNumber && <p>Register: {issue.registerNumber}</p>}
                        {issue.staffId && <p>Staff ID: {issue.staffId}</p>}
                        {issue.email && <p>Email: {issue.email}</p>}
                        {issue.phoneNumber && <p>Phone: {issue.phoneNumber}</p>}
                        <p>Reported: {new Date(issue.createdAt).toLocaleString()}</p>
                        {issue.resolvedAt && <p>Resolved: {new Date(issue.resolvedAt).toLocaleString()}</p>}
                        {issue.resolvedBy && <p>Resolved by: {issue.resolvedBy}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openIssueDialog(issue)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Login Issue Details</DialogTitle>
                          </DialogHeader>
                          
                          {selectedIssue && (
                            <div className="space-y-6">
                              {/* Issue Details */}
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Name</Label>
                                    <p className="font-medium">{selectedIssue.name}</p>
                                  </div>
                                  <div>
                                    <Label>Issue Type</Label>
                                    <p>{getIssueTypeBadge(selectedIssue.issueType)}</p>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <p>{getStatusBadge(selectedIssue.status)}</p>
                                  </div>
                                  <div>
                                    <Label>Reported</Label>
                                    <p>{new Date(selectedIssue.createdAt).toLocaleString()}</p>
                                  </div>
                                </div>

                                <div>
                                  <Label>Description</Label>
                                  <div className="mt-1 p-3 bg-muted rounded-md">
                                    <p className="whitespace-pre-wrap">{selectedIssue.description}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {selectedIssue.email && (
                                    <div>
                                      <Label>Email</Label>
                                      <p>{selectedIssue.email}</p>
                                    </div>
                                  )}
                                  {selectedIssue.phoneNumber && (
                                    <div>
                                      <Label>Phone</Label>
                                      <p>{selectedIssue.phoneNumber}</p>
                                    </div>
                                  )}
                                  {selectedIssue.registerNumber && (
                                    <div>
                                      <Label>Register Number</Label>
                                      <p>{selectedIssue.registerNumber}</p>
                                    </div>
                                  )}
                                  {selectedIssue.staffId && (
                                    <div>
                                      <Label>Staff ID</Label>
                                      <p>{selectedIssue.staffId}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Admin Actions */}
                              <div className="border-t pt-4 space-y-4">
                                <h4 className="font-semibold">Admin Actions</h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Update Status</Label>
                                    <Select value={newStatus} onValueChange={setNewStatus}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {newStatus === "resolved" && (
                                    <div>
                                      <Label>Resolved By</Label>
                                      <Input
                                        value={resolvedBy}
                                        onChange={(e) => setResolvedBy(e.target.value)}
                                        placeholder="Enter admin name"
                                      />
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <Label>Admin Notes</Label>
                                  <Textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Add notes about resolution steps, communication with user, etc."
                                    rows={4}
                                  />
                                </div>

                                <div className="flex gap-3 pt-4">
                                  <Button 
                                    onClick={handleUpdateIssue}
                                    disabled={updateIssueMutation.isPending}
                                    className="flex-1"
                                  >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    {updateIssueMutation.isPending ? "Updating..." : "Update Issue"}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to delete this issue?")) {
                                        deleteIssueMutation.mutate(selectedIssue.id);
                                        setSelectedIssue(null);
                                      }
                                    }}
                                    disabled={deleteIssueMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm line-clamp-2">{issue.description}</p>
                  </div>
                  
                  {issue.adminNotes && (
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground">Admin Notes:</p>
                      <p className="text-sm line-clamp-1">{issue.adminNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
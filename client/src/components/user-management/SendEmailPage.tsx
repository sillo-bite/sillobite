import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Mail, Send, Users, Loader2 } from "lucide-react";
export default function SendEmailPage() {
  const [, setLocation] = useLocation();
  const [isSending, setIsSending] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: "",
    message: "",
    userGroup: "all"
  });

  // Fetch users to get actual counts for each group
  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  // Calculate user counts for each group
  const getUserCount = (groupValue: string) => {
    if (usersLoading) return 0;
    switch (groupValue) {
      case 'all': return users.length;
      case 'students': return users.filter(u => u.role === 'student').length;
      case 'faculty': return users.filter(u => u.role === 'faculty').length;
      case 'staff': return users.filter(u => u.role === 'staff').length;
      case 'active': return users.filter(u => u.status === 'Active' || !u.status).length;
      case 'inactive': return users.filter(u => u.status === 'Suspended' || u.status === 'Inactive').length;
      default: return 0;
    }
  };

  const userGroups = [
    { value: "all", label: "All Users", count: getUserCount("all") },
    { value: "students", label: "Students Only", count: getUserCount("students") },
    { value: "faculty", label: "Faculty Only", count: getUserCount("faculty") },
    { value: "staff", label: "Staff Only", count: getUserCount("staff") },
    { value: "active", label: "Active Users", count: getUserCount("active") },
    { value: "inactive", label: "Inactive Users", count: getUserCount("inactive") }
  ];

  const handleSendEmail = async () => {
    if (!emailData.subject.trim() || !emailData.message.trim()) {
      return;
    }

    if (emailData.subject.length > 100) {
      return;
    }

    setIsSending(true);
    
    try {
      // TODO: Replace with actual API endpoint for sending bulk emails
      // const response = await fetch('/api/admin/send-bulk-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     userGroup: emailData.userGroup,
      //     subject: emailData.subject,
      //     message: emailData.message
      //   })
      // });
      // 
      // if (!response.ok) {
      //   throw new Error('Failed to send emails');
      // }
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const selectedGroup = userGroups.find(g => g.value === emailData.userGroup);
      const recipientCount = selectedGroup?.count || 0;
      
      setLocation("/admin/user-management");
    } catch (error) {
      } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin/user-management")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Send Bulk Email</h1>
              <p className="text-sm text-muted-foreground">Send notifications to users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Email Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userGroup">Select User Group</Label>
                <Select 
                  value={emailData.userGroup} 
                  onValueChange={(value) => setEmailData(prev => ({ ...prev, userGroup: value }))}
                  data-testid="select-user-group"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose user group" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGroups.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label} ({group.count} users)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {usersLoading && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Loading user counts...
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  maxLength={100}
                  data-testid="input-email-subject"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {emailData.subject.length}/100 characters
                </p>
              </div>

              <div>
                <Label htmlFor="message">Email Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter your message here..."
                  className="min-h-32"
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={2000}
                  data-testid="textarea-email-message"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {emailData.message.length}/2000 characters
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Email Preview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="mb-4">
                  <strong>To:</strong> {userGroups.find(g => g.value === emailData.userGroup)?.label} 
                  <span className="text-muted-foreground">({userGroups.find(g => g.value === emailData.userGroup)?.count || 0} recipients)</span>
                </div>
                <div className="mb-4">
                  <strong>Subject:</strong> {emailData.subject || "No subject"}
                </div>
                <div>
                  <strong>Message:</strong>
                  <div className="mt-2 whitespace-pre-wrap">
                    {emailData.message || "No message content"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/admin/user-management")}
              disabled={isSending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleSendEmail}
              disabled={!emailData.subject.trim() || !emailData.message.trim() || isSending}
              className="flex items-center space-x-2"
              data-testid="button-send-email"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Email</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
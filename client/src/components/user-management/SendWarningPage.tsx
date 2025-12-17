import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Send } from "lucide-react";
export default function SendWarningPage() {
  const [, setLocation] = useLocation();
  const [warningData, setWarningData] = useState({
    userGroup: "individual",
    selectedUser: "",
    warningType: "general",
    subject: "",
    message: "",
    severity: "low"
  });

  const warningTypes = [
    { value: "general", label: "General Warning" },
    { value: "payment", label: "Payment Issues" },
    { value: "behavior", label: "Behavioral Warning" },
    { value: "policy", label: "Policy Violation" },
    { value: "spam", label: "Spam/Abuse" },
    { value: "account", label: "Account Security" }
  ];

  const severityLevels = [
    { value: "low", label: "Low", color: "secondary" },
    { value: "medium", label: "Medium", color: "warning" },
    { value: "high", label: "High", color: "destructive" }
  ];

  const mockUsers: any[] = []; // Will be populated from actual user data when user management system is implemented

  const handleSendWarning = () => {
    setLocation("/admin/user-management");
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
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Send Warning</h1>
              <p className="text-sm text-muted-foreground">Issue warnings to users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Warning Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userGroup">Target</Label>
                  <Select value={warningData.userGroup} onValueChange={(value) => setWarningData(prev => ({ ...prev, userGroup: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual User</SelectItem>
                      <SelectItem value="multiple">Multiple Users</SelectItem>
                      <SelectItem value="all">All Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {warningData.userGroup === "individual" && (
                  <div>
                    <Label htmlFor="selectedUser">Select User</Label>
                    <Select value={warningData.selectedUser} onValueChange={(value) => setWarningData(prev => ({ ...prev, selectedUser: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose user" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warningType">Warning Type</Label>
                  <Select value={warningData.warningType} onValueChange={(value) => setWarningData(prev => ({ ...prev, warningType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warning type" />
                    </SelectTrigger>
                    <SelectContent>
                      {warningTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="severity">Severity Level</Label>
                  <Select value={warningData.severity} onValueChange={(value) => setWarningData(prev => ({ ...prev, severity: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {severityLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Warning Subject</Label>
                <Input
                  id="subject"
                  placeholder="Enter warning subject"
                  value={warningData.subject}
                  onChange={(e) => setWarningData(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="message">Warning Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter detailed warning message..."
                  className="min-h-32"
                  value={warningData.message}
                  onChange={(e) => setWarningData(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warning Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    <strong>Official Warning</strong>
                  </div>
                  <Badge variant={severityLevels.find(s => s.value === warningData.severity)?.color as any}>
                    {severityLevels.find(s => s.value === warningData.severity)?.label} Priority
                  </Badge>
                </div>
                
                <div className="mb-4">
                  <strong>Type:</strong> {warningTypes.find(t => t.value === warningData.warningType)?.label}
                </div>
                
                <div className="mb-4">
                  <strong>Subject:</strong> {warningData.subject || "No subject"}
                </div>
                
                <div>
                  <strong>Message:</strong>
                  <div className="mt-2 whitespace-pre-wrap">
                    {warningData.message || "No message content"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setLocation("/admin/user-management")}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSendWarning}
              disabled={!warningData.subject || !warningData.message}
              className="flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Warning</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
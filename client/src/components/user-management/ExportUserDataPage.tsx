import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, FileText, Calendar } from "lucide-react";
export default function ExportUserDataPage() {
  const [, setLocation] = useLocation();
  const [exportConfig, setExportConfig] = useState({
    userGroup: "all",
    format: "csv",
    dateRange: "all-time",
    fields: [] as string[]
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const userGroups = [
    { value: "all", label: "All Users" },
    { value: "active", label: "Active Users" },
    { value: "inactive", label: "Inactive Users" },
    { value: "students", label: "Students Only" },
    { value: "faculty", label: "Faculty Only" },
    { value: "staff", label: "Staff Only" }
  ];

  const exportFormats = [
    { value: "csv", label: "CSV (Comma Separated)" },
    { value: "excel", label: "Excel (XLSX)" },
    { value: "json", label: "JSON" },
    { value: "pdf", label: "PDF Report" }
  ];

  const dateRanges = [
    { value: "all-time", label: "All Time" },
    { value: "last-30", label: "Last 30 Days" },
    { value: "last-90", label: "Last 90 Days" },
    { value: "this-year", label: "This Year" },
    { value: "last-year", label: "Last Year" }
  ];

  const availableFields = [
    { id: "basic", label: "Basic Info (Name, Email, Phone)" },
    { id: "profile", label: "Profile Details" },
    { id: "orders", label: "Order History" },
    { id: "payments", label: "Payment Information" },
    { id: "preferences", label: "User Preferences" },
    { id: "activity", label: "Activity Logs" },
    { id: "feedback", label: "Feedback & Reviews" },
    { id: "loyalty", label: "Loyalty Points" }
  ];

  const handleFieldChange = (fieldId: string, checked: boolean) => {
    setExportConfig(prev => ({
      ...prev,
      fields: checked 
        ? [...prev.fields, fieldId]
        : prev.fields.filter(f => f !== fieldId)
    }));
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);

    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
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
              <h1 className="text-2xl font-bold text-foreground">Export User Data</h1>
              <p className="text-sm text-muted-foreground">Download user information and analytics</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Export Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="userGroup">User Group</Label>
                  <Select value={exportConfig.userGroup} onValueChange={(value) => setExportConfig(prev => ({ ...prev, userGroup: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select users" />
                    </SelectTrigger>
                    <SelectContent>
                      {userGroups.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="format">Export Format</Label>
                  <Select value={exportConfig.format} onValueChange={(value) => setExportConfig(prev => ({ ...prev, format: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {exportFormats.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dateRange">Date Range</Label>
                  <Select value={exportConfig.dateRange} onValueChange={(value) => setExportConfig(prev => ({ ...prev, dateRange: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Data Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {availableFields.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.id}
                      checked={exportConfig.fields.includes(field.id)}
                      onCheckedChange={(checked) => handleFieldChange(field.id, checked as boolean)}
                    />
                    <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Export Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Users:</span>
                  <div className="font-medium">{userGroups.find(g => g.value === exportConfig.userGroup)?.label}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Export Format:</span>
                  <div className="font-medium">{exportFormats.find(f => f.value === exportConfig.format)?.label}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Period:</span>
                  <div className="font-medium">{dateRanges.find(r => r.value === exportConfig.dateRange)?.label}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Fields:</span>
                  <div className="font-medium">{exportConfig.fields.length} selected</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Records:</span>
                  <div className="font-medium">~1,245 users</div>
                </div>
                <div>
                  <span className="text-muted-foreground">File Size:</span>
                  <div className="font-medium">~2.3 MB</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isExporting && (
            <Card>
              <CardHeader>
                <CardTitle>Export in Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Exporting data...</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <Progress value={exportProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setLocation("/admin/user-management")}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleExport}
              disabled={exportConfig.fields.length === 0 || isExporting}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Exporting..." : "Export Data"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertTriangle, X } from "lucide-react";
export default function ImportUsersPage() {
  const [, setLocation] = useLocation();
  const [importConfig, setImportConfig] = useState({
    fileFormat: "csv",
    duplicateHandling: "skip",
    defaultRole: "student"
  });
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);

  const fileFormats = [
    { value: "csv", label: "CSV File" },
    { value: "excel", label: "Excel (XLSX)" },
    { value: "json", label: "JSON File" }
  ];

  const duplicateOptions = [
    { value: "skip", label: "Skip duplicates" },
    { value: "update", label: "Update existing" },
    { value: "create", label: "Create new entries" }
  ];

  const roleOptions = [
    { value: "student", label: "Student" },
    { value: "faculty", label: "Faculty" },
    { value: "staff", label: "Staff" }
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = () => {
    if (!file) return;
    
    setIsImporting(true);
    setImportProgress(0);

    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsImporting(false);
          setImportResults({
            total: 150,
            successful: 145,
            skipped: 3,
            failed: 2,
            errors: [
              "Row 15: Invalid email format",
              "Row 23: Phone number already exists"
            ]
          });
          return 100;
        }
        return prev + 5;
      });
    }, 150);
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
              <h1 className="text-2xl font-bold text-foreground">Import Users</h1>
              <p className="text-sm text-muted-foreground">Bulk import users from file</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Import Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fileFormat">File Format</Label>
                  <Select value={importConfig.fileFormat} onValueChange={(value) => setImportConfig(prev => ({ ...prev, fileFormat: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {fileFormats.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="duplicateHandling">Duplicate Handling</Label>
                  <Select value={importConfig.duplicateHandling} onValueChange={(value) => setImportConfig(prev => ({ ...prev, duplicateHandling: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Handle duplicates" />
                    </SelectTrigger>
                    <SelectContent>
                      {duplicateOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="defaultRole">Default Role</Label>
                  <Select value={importConfig.defaultRole} onValueChange={(value) => setImportConfig(prev => ({ ...prev, defaultRole: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select default role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
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
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>File Upload</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.json"
                  onChange={handleFileChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                />
              </div>

              {file && (
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB • {importConfig.fileFormat.toUpperCase()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <h4 className="font-medium mb-2">Required Fields</h4>
                <p className="text-sm text-muted-foreground">
                  Your file should contain the following columns: <strong>name</strong>, <strong>email</strong>, <strong>phone</strong> (optional), <strong>role</strong> (optional)
                </p>
              </div>
            </CardContent>
          </Card>

          {isImporting && (
            <Card>
              <CardHeader>
                <CardTitle>Import in Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing users...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {importResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span>Import Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{importResults.total}</div>
                    <div className="text-sm text-muted-foreground">Total Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{importResults.successful}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">{importResults.skipped}</div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">{importResults.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span>Errors</span>
                    </h4>
                    <div className="space-y-1">
                      {importResults.errors.map((error: string, index: number) => (
                        <div key={index} className="text-sm text-muted-foreground p-2 bg-muted rounded">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setLocation("/admin/user-management")}>
              {importResults ? "Done" : "Cancel"}
            </Button>
            {!importResults && (
              <Button 
                variant="default" 
                onClick={handleImport}
                disabled={!file || isImporting}
                className="flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? "Importing..." : "Import Users"}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
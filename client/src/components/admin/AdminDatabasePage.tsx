import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Database, Download, Upload, RefreshCw, 
  HardDrive, Activity, Clock, AlertTriangle, CheckCircle,
  FileText, Search, Settings, Trash2, Archive, Monitor,
  Server, Cpu, BarChart3, Zap, Shield, AlertCircle,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
interface DatabaseMetrics {
  postgresql: {
    connected: boolean;
    responseTime: number;
    connectionCount: number;
    databaseSize: number;
    totalTables: number;
    totalRecords: number;
    activeQueries: number;
    cacheHitRatio?: number;
    error?: string;
  };
  mongodb: {
    connected: boolean;
    responseTime: number;
    connectionCount: number;
    databaseSize: number;
    collections: number;
    totalDocuments: number;
    indexSize: number;
    currentOp: number;
    replicationLag?: number;
    version: string;
    features: {
      transactions: boolean;
      changeStreams: boolean;
      textSearch: boolean;
      aggregation: boolean;
      gridFS: boolean;
    };
    error?: string;
  };
  overall: {
    totalSize: number;
    totalConnections: number;
    averageResponseTime: number;
    healthScore: number;
    status: 'healthy' | 'warning' | 'critical';
    alerts: Array<{
      type: 'info' | 'warning' | 'error';
      source: 'postgresql' | 'mongodb' | 'system';
      message: string;
      timestamp: string;
      resolved: boolean;
    }>;
  };
  timestamp: string;
}

export default function AdminDatabasePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperation, setSelectedOperation] = useState<string[]>([]);

  // Force component refresh to ensure no old cached queries run
  useEffect(() => {
    console.log('🔄 Database management page loaded - all automatic polling disabled');
    return () => {
      console.log('🛑 Database management page unmounted - cleaning up any pending queries');
    };
  }, []);

  // Fetch database metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['/api/database/metrics'],
    enabled: false, // Only fetch when manually triggered
    refetchInterval: false, // Explicitly disable automatic refetching
    refetchOnMount: false, // Explicitly disable refetch on mount
    refetchOnWindowFocus: false, // Explicitly disable refetch on focus
  });

  // Fetch database stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/database/stats'],
    enabled: false, // Only fetch when manually triggered
    refetchInterval: false, // Explicitly disable automatic refetching
    refetchOnMount: false, // Explicitly disable refetch on mount
    refetchOnWindowFocus: false, // Explicitly disable refetch on focus
  });

  // Fetch collections/tables
  const { data: collections, isLoading: collectionsLoading, refetch: refetchCollections } = useQuery({
    queryKey: ['/api/database/collections'],
    enabled: false, // Only fetch when manually triggered
    refetchInterval: false, // Explicitly disable automatic refetching
    refetchOnMount: false, // Explicitly disable refetch on mount
    refetchOnWindowFocus: false, // Explicitly disable refetch on focus
  });

  // Fetch alerts
  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ['/api/database/alerts'],
    enabled: false, // Only fetch when manually triggered
    refetchInterval: false, // Explicitly disable automatic refetching
    refetchOnMount: false, // Explicitly disable refetch on mount
    refetchOnWindowFocus: false, // Explicitly disable refetch on focus
  });

  // Maintenance operations mutation
  const maintenanceMutation = useMutation({
    mutationFn: async (operations: string[]) => {
      const response = await fetch('/api/database/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });
      if (!response.ok) throw new Error('Maintenance operation failed');
      return response.json();
    },
    onSuccess: () => {
      refetchMetrics();
    },
    onError: (error) => {
      }
  });

  // Backup mutation
  const backupMutation = useMutation({
    mutationFn: async (type: 'mongodb' | 'postgresql' | 'full') => {
      const response = await fetch('/api/database/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!response.ok) throw new Error('Backup operation failed');
      return response.json();
    },
    onSuccess: async (data, type) => {
      if (type === 'postgresql' && data.backup?.downloadUrl) {
        // For PostgreSQL backups, trigger immediate download of SQL file
        try {
          const downloadResponse = await fetch(data.backup.downloadUrl);
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.backup.filename || `postgresql_backup_${Date.now()}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            } else {
            throw new Error('Failed to download backup file');
          }
        } catch (error) {
          }
      } else {
        }
    },
    onError: (error) => {
      }
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "Healthy":
      case "Completed": return "bg-success text-success-foreground";
      case "warning":
      case "Warning": return "bg-warning text-warning-foreground";
      case "critical":
      case "Error": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "Healthy":
      case "Completed": return <CheckCircle className="h-3 w-3" />;
      case "warning":
      case "Warning": return <AlertTriangle className="h-3 w-3" />;
      case "critical":
      case "Error": return <AlertCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getHealthTrend = (score: number) => {
    if (score >= 80) return { icon: TrendingUp, color: "text-success" };
    if (score >= 60) return { icon: Minus, color: "text-warning" };
    return { icon: TrendingDown, color: "text-destructive" };
  };

  const handleMaintenance = () => {
    if (selectedOperation.length === 0) {
      return;
    }
    maintenanceMutation.mutate(selectedOperation);
  };

  const handleBackup = (type: 'mongodb' | 'postgresql' | 'full') => {
    backupMutation.mutate(type);
  };

  const toggleOperation = (operation: string) => {
    setSelectedOperation(prev => 
      prev.includes(operation) 
        ? prev.filter(op => op !== operation)
        : [...prev, operation]
    );
  };

  // Show initial load state only when no data exists yet
  if ((metricsLoading || statsLoading) && !metrics && !stats) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Loading database information...</p>
            <Button onClick={() => {
              refetchMetrics();
              refetchStats();
              refetchCollections();
              refetchAlerts();
            }} variant="outline">
              Load Database Data
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const dbMetrics = metrics as DatabaseMetrics | undefined;
  const overallStats = (stats as any)?.overall || {};

  return (
    <div className="p-6 space-y-6" data-testid="admin-database-page">
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
            <h1 className="text-2xl font-bold text-foreground">Database Management</h1>
            <p className="text-muted-foreground">Monitor and manage PostgreSQL and MongoDB databases</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              refetchMetrics();
              refetchStats();
              refetchCollections();
              refetchAlerts();
            }}
            disabled={metricsLoading || statsLoading || collectionsLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(metricsLoading || statsLoading || collectionsLoading) ? 'animate-spin' : ''}`} />
            {(metricsLoading || statsLoading || collectionsLoading) ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      {dbMetrics?.overall && (
        <Alert className={`border-l-4 ${
          dbMetrics.overall.status === 'healthy' ? 'border-l-success' :
          dbMetrics.overall.status === 'warning' ? 'border-l-warning' : 'border-l-destructive'
        }`}>
          <div className="flex items-center space-x-2">
            {getStatusIcon(dbMetrics.overall.status)}
            <AlertDescription className="text-sm">
              <strong>System Health: {dbMetrics.overall.status.toUpperCase()}</strong> - 
              Health Score: {dbMetrics.overall.healthScore}% | 
              Average Response Time: {dbMetrics.overall.averageResponseTime}ms | 
              Active Alerts: {dbMetrics.overall.alerts.length}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="postgresql" data-testid="tab-postgresql">PostgreSQL</TabsTrigger>
          <TabsTrigger value="mongodb" data-testid="tab-mongodb">MongoDB</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts ({(alertsData as any)?.count || 0})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Overall Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-size">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatBytes(overallStats.totalSize || 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Size</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-health-score">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                    <Activity className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dbMetrics?.overall.healthScore || 0}%</p>
                    <p className="text-xs text-muted-foreground">Health Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-connections">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                    <Server className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dbMetrics?.overall.totalConnections || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Connections</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-response-time">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-info/20 rounded-lg flex items-center justify-center">
                    <Zap className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dbMetrics?.overall.averageResponseTime || 0}ms</p>
                    <p className="text-xs text-muted-foreground">Avg Response</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Database Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-postgresql-overview">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  <span>PostgreSQL</span>
                  <Badge className={getStatusColor(dbMetrics?.postgresql?.connected ? 'healthy' : 'critical')}>
                    {dbMetrics?.postgresql?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Database Size</p>
                    <p className="text-lg font-semibold">{formatBytes(dbMetrics?.postgresql.databaseSize || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tables</p>
                    <p className="text-lg font-semibold">{dbMetrics?.postgresql.totalTables || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Records</p>
                    <p className="text-lg font-semibold">{(dbMetrics?.postgresql.totalRecords || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Connections</p>
                    <p className="text-lg font-semibold">{dbMetrics?.postgresql.connectionCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-mongodb-overview">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-green-500" />
                  <span>MongoDB</span>
                  <Badge className={getStatusColor(dbMetrics?.mongodb?.connected ? 'healthy' : 'critical')}>
                    {dbMetrics?.mongodb?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Database Size</p>
                    <p className="text-lg font-semibold">{formatBytes(dbMetrics?.mongodb.databaseSize || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Collections</p>
                    <p className="text-lg font-semibold">{dbMetrics?.mongodb.collections || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Documents</p>
                    <p className="text-lg font-semibold">{(dbMetrics?.mongodb.totalDocuments || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Version</p>
                    <p className="text-lg font-semibold">{dbMetrics?.mongodb.version || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PostgreSQL Tab */}
        <TabsContent value="postgresql" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" data-testid="card-postgresql-details">
              <CardHeader>
                <CardTitle>PostgreSQL Database Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Response Time</p>
                    <p className="text-xl font-bold">{dbMetrics?.postgresql.responseTime || 0}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Queries</p>
                    <p className="text-xl font-bold">{dbMetrics?.postgresql.activeQueries || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cache Hit Ratio</p>
                    <p className="text-xl font-bold">
                      {dbMetrics?.postgresql.cacheHitRatio ? 
                        `${dbMetrics.postgresql.cacheHitRatio.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
                
                {(collections as any)?.postgresql?.tables && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Tables</h4>
                    {(collections as any).postgresql.tables.map((table: any) => (
                      <div key={table.name} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium">{table.name}</span>
                        <div className="text-sm text-muted-foreground">
                          {table.count.toLocaleString()} records
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-postgresql-actions">
              <CardHeader>
                <CardTitle>PostgreSQL Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => handleBackup('postgresql')}
                  disabled={backupMutation.isPending}
                  data-testid="button-backup-postgresql"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Backup PostgreSQL
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => maintenanceMutation.mutate(['analyze_postgres'])}
                  disabled={maintenanceMutation.isPending}
                  data-testid="button-analyze-postgresql"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analyze Database
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => maintenanceMutation.mutate(['vacuum_postgres'])}
                  disabled={maintenanceMutation.isPending}
                  data-testid="button-vacuum-postgresql"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Vacuum & Analyze
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MongoDB Tab */}
        <TabsContent value="mongodb" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" data-testid="card-mongodb-details">
              <CardHeader>
                <CardTitle>MongoDB Database Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Response Time</p>
                    <p className="text-xl font-bold">{dbMetrics?.mongodb.responseTime || 0}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Operations</p>
                    <p className="text-xl font-bold">{dbMetrics?.mongodb.currentOp || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Index Size</p>
                    <p className="text-xl font-bold">{formatBytes(dbMetrics?.mongodb.indexSize || 0)}</p>
                  </div>
                </div>

                {/* MongoDB Features */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Supported Features</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {dbMetrics?.mongodb.features && Object.entries(dbMetrics.mongodb.features).map(([feature, supported]) => (
                      <div key={feature} className="flex items-center space-x-2">
                        {supported ? 
                          <CheckCircle className="h-4 w-4 text-success" /> : 
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        }
                        <span className="text-sm capitalize">{feature.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {(collections as any)?.mongodb?.collections && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Collections</h4>
                    {(collections as any).mongodb.collections.map((collection: any) => (
                      <div key={collection.name} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium">{collection.name}</span>
                        <div className="text-sm text-muted-foreground">
                          {collection.count.toLocaleString()} docs
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-mongodb-actions">
              <CardHeader>
                <CardTitle>MongoDB Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => handleBackup('mongodb')}
                  disabled={backupMutation.isPending}
                  data-testid="button-backup-mongodb"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Backup MongoDB
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => maintenanceMutation.mutate(['compact_mongo'])}
                  disabled={maintenanceMutation.isPending}
                  data-testid="button-compact-mongodb"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Compact Database
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => maintenanceMutation.mutate(['rebuild_indexes'])}
                  disabled={maintenanceMutation.isPending}
                  data-testid="button-rebuild-indexes"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Rebuild Indexes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card data-testid="card-maintenance-operations">
            <CardHeader>
              <CardTitle>Database Maintenance Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold">PostgreSQL Operations</h4>
                  {[
                    { id: 'analyze_postgres', label: 'Analyze Database', description: 'Update table statistics' },
                    { id: 'vacuum_postgres', label: 'Vacuum & Analyze', description: 'Clean up and optimize' }
                  ].map((op) => (
                    <div key={op.id} className="flex items-center space-x-3 p-3 border rounded">
                      <input
                        type="checkbox"
                        id={op.id}
                        checked={selectedOperation.includes(op.id)}
                        onChange={() => toggleOperation(op.id)}
                        className="rounded"
                        data-testid={`checkbox-${op.id}`}
                      />
                      <div>
                        <label htmlFor={op.id} className="font-medium cursor-pointer">
                          {op.label}
                        </label>
                        <p className="text-sm text-muted-foreground">{op.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">MongoDB Operations</h4>
                  {[
                    { id: 'compact_mongo', label: 'Compact Collections', description: 'Optimize storage usage' },
                    { id: 'rebuild_indexes', label: 'Rebuild Indexes', description: 'Optimize query performance' }
                  ].map((op) => (
                    <div key={op.id} className="flex items-center space-x-3 p-3 border rounded">
                      <input
                        type="checkbox"
                        id={op.id}
                        checked={selectedOperation.includes(op.id)}
                        onChange={() => toggleOperation(op.id)}
                        className="rounded"
                        data-testid={`checkbox-${op.id}`}
                      />
                      <div>
                        <label htmlFor={op.id} className="font-medium cursor-pointer">
                          {op.label}
                        </label>
                        <p className="text-sm text-muted-foreground">{op.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {selectedOperation.length} operation(s) selected
                  </p>
                </div>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedOperation([])}
                    disabled={selectedOperation.length === 0}
                    data-testid="button-clear-operations"
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={handleMaintenance}
                    disabled={selectedOperation.length === 0 || maintenanceMutation.isPending}
                    data-testid="button-run-maintenance"
                  >
                    {maintenanceMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Run Selected Operations
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card data-testid="card-database-alerts">
            <CardHeader>
              <CardTitle>Database Alerts & Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {(alertsData as any)?.alerts && (alertsData as any).alerts.length > 0 ? (
                <div className="space-y-3">
                  {(alertsData as any).alerts.map((alert: any, index: number) => (
                    <Alert key={index} className={`${
                      alert.type === 'error' ? 'border-destructive' :
                      alert.type === 'warning' ? 'border-warning' : 'border-info'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {alert.type === 'error' ? <AlertCircle className="h-4 w-4 text-destructive" /> :
                           alert.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                           <CheckCircle className="h-4 w-4 text-info" />}
                          <div>
                            <AlertDescription>
                              <strong className="capitalize">{alert.source}:</strong> {alert.message}
                            </AlertDescription>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            // Resolve alert functionality would go here
                            refetchAlerts();
                          }}
                          data-testid={`button-resolve-alert-${index}`}
                        >
                          Resolve
                        </Button>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                  <p className="text-lg font-semibold">No Active Alerts</p>
                  <p className="text-muted-foreground">All database systems are operating normally.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Printer, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Monitor,
  Wifi,
  Usb,
  Bluetooth,
  Copy,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PrintAgent {
  agentId: string;
  outletId: string;
  version: string;
  platform: string;
  status: 'online' | 'offline';
  capabilities: {
    usb: boolean;
    network: boolean;
    bluetooth: boolean;
    windows: boolean;
  };
  lastSeen: string;
  createdAt: string;
  printers: Array<{
    id: string;
    name: string;
    type: 'usb' | 'network' | 'bluetooth' | 'windows';
    isDefault: boolean;
  }>;
}

interface PrintJob {
  jobId: string;
  agentId?: string;
  receiptType: 'KOT' | 'BILL' | 'TOKEN';
  priority: 'normal' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'printed' | 'failed' | 'retrying';
  error?: string;
  orderNumber?: string;
  createdAt: string;
  sentAt?: string;
  printedAt?: string;
}

interface PrintAgentStats {
  agents: {
    total: number;
    online: number;
    offline: number;
  };
  jobs: {
    total: number;
    pending: number;
    printed: number;
    failed: number;
  };
  websocket: {
    connectedAgents: number;
    totalOutlets: number;
    outletDistribution: Record<string, number>;
  };
}

export default function PrintAgentManagement({ canteenId }: { canteenId: string }) {
  const [agents, setAgents] = useState<PrintAgent[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [stats, setStats] = useState<PrintAgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`/api/print/agents?outletId=${canteenId}`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch print agents');
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/print/jobs/history?outletId=${canteenId}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch print jobs');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/print/stats?outletId=${canteenId}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAgents(), fetchJobs(), fetchStats()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [canteenId]);

  const generatePairingCode = async () => {
    setGeneratingCode(true);
    try {
      const response = await fetch('/api/print/pair/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId: canteenId, expiresInMinutes: 15 }),
      });

      if (!response.ok) throw new Error('Failed to generate pairing code');

      const data = await response.json();
      setPairingCode(data.code);
      setShowPairingDialog(true);

      toast.success(`Pairing Code Generated: ${data.code} (expires in ${data.expiresInMinutes} minutes)`);
    } catch (error) {
      console.error('Error generating pairing code:', error);
      toast.error('Failed to generate pairing code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode);
    toast.success('Pairing code copied to clipboard');
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      const response = await fetch(`/api/print/agents/${agentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete agent');

      toast.success('Agent deleted successfully');

      await loadData();
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const sendTestPrint = async () => {
    try {
      const response = await fetch('/api/print/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId: canteenId, receiptType: 'TOKEN' }),
      });

      if (!response.ok) throw new Error('Failed to send test print');

      const data = await response.json();
      toast.success(`Test Print Sent - Job ID: ${data.jobId}`);

      await fetchJobs();
    } catch (error) {
      console.error('Error sending test print:', error);
      toast.error('Failed to send test print');
    }
  };

  const getPrinterTypeIcon = (type: string) => {
    switch (type) {
      case 'usb': return <Usb className="h-4 w-4" />;
      case 'network': return <Wifi className="h-4 w-4" />;
      case 'bluetooth': return <Bluetooth className="h-4 w-4" />;
      case 'windows': return <Monitor className="h-4 w-4" />;
      default: return <Printer className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Online</Badge>;
      case 'offline':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Offline</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'printed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Printed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'retrying':
        return <Badge className="bg-yellow-500"><RefreshCw className="h-3 w-3 mr-1" />Retrying</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="h-6 w-6" />
            Print Agent Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage print agents and monitor print jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={sendTestPrint} variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Test Print
          </Button>
          <Button onClick={generatePairingCode} disabled={generatingCode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.agents.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.agents.online} online, {stats.agents.offline} offline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.jobs.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.jobs.pending} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Printed Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.jobs.printed}</div>
              <p className="text-xs text-muted-foreground">
                Successfully printed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.jobs.failed}</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
          <TabsTrigger value="jobs">Print Jobs ({jobs.length})</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          {agents.length === 0 ? (
            <Alert>
              <Printer className="h-4 w-4" />
              <AlertDescription>
                No print agents connected. Click "Add Agent" to generate a pairing code.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <Card key={agent.agentId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{agent.agentId}</CardTitle>
                        <CardDescription>
                          {agent.platform} • v{agent.version}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(agent.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAgent(agent.agentId)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Capabilities */}
                    <div>
                      <p className="text-sm font-medium mb-2">Capabilities</p>
                      <div className="flex gap-2 flex-wrap">
                        {agent.capabilities.usb && (
                          <Badge variant="outline">
                            <Usb className="h-3 w-3 mr-1" />USB
                          </Badge>
                        )}
                        {agent.capabilities.network && (
                          <Badge variant="outline">
                            <Wifi className="h-3 w-3 mr-1" />Network
                          </Badge>
                        )}
                        {agent.capabilities.bluetooth && (
                          <Badge variant="outline">
                            <Bluetooth className="h-3 w-3 mr-1" />Bluetooth
                          </Badge>
                        )}
                        {agent.capabilities.windows && (
                          <Badge variant="outline">
                            <Monitor className="h-3 w-3 mr-1" />Windows
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Printers */}
                    {agent.printers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Printers ({agent.printers.length})
                        </p>
                        <div className="space-y-2">
                          {agent.printers.map((printer) => (
                            <div
                              key={printer.id}
                              className="flex items-center gap-2 text-sm p-2 bg-muted rounded"
                            >
                              {getPrinterTypeIcon(printer.type)}
                              <span className="flex-1">{printer.name}</span>
                              {printer.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last Seen */}
                    <div className="text-xs text-muted-foreground">
                      Last seen: {new Date(agent.lastSeen).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Print Job History</CardTitle>
              <CardDescription>Recent print jobs for this outlet</CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <Alert>
                  <AlertDescription>No print jobs found</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.jobId}>
                        <TableCell className="font-mono text-xs">
                          {job.jobId.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.receiptType}</Badge>
                        </TableCell>
                        <TableCell>{job.orderNumber || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              job.priority === 'urgent'
                                ? 'destructive'
                                : job.priority === 'high'
                                ? 'default'
                                : 'outline'
                            }
                          >
                            {job.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.agentId ? job.agentId.substring(0, 8) : '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(job.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pairing Dialog */}
      <Dialog open={showPairingDialog} onOpenChange={setShowPairingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pairing Code Generated</DialogTitle>
            <DialogDescription>
              Use this code in the Print Agent application to pair it with this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={pairingCode}
                readOnly
                className="font-mono text-2xl text-center tracking-widest"
              />
              <Button onClick={copyPairingCode} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This code will expire in 15 minutes. Enter it in the Print Agent application
                to complete pairing.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPairingDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


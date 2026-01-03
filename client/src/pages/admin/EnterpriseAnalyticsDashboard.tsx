/**
 * Enterprise Analytics Dashboard - FinOps, Security & Compliance Overview
 * 
 * Provides:
 * - AI cost governance metrics
 * - Provider health monitoring
 * - Security violation trends
 * - Compliance status overview
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Shield,
  Server,
  MessageSquare,
  Brain,
  Lock,
  FileText,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Settings,
  Eye,
  AlertCircle,
} from 'lucide-react';

// API helper
const apiRequest = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!response.ok) throw new Error('API request failed');
  return response.json();
};

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

// Format number with K/M suffix
const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Health status colors
const getHealthColor = (status: string) => {
  switch (status) {
    case 'HEALTHY': return 'text-green-500';
    case 'DEGRADED': return 'text-yellow-500';
    case 'UNHEALTHY': return 'text-orange-500';
    case 'DOWN': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

const getHealthBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    HEALTHY: 'default',
    DEGRADED: 'secondary',
    UNHEALTHY: 'destructive',
    DOWN: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
};

// Chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function EnterpriseAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const queryClient = useQueryClient();

  // Fetch all governance data
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['governance', 'health'],
    queryFn: () => apiRequest('/api/admin/governance/health'),
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: togglesData } = useQuery({
    queryKey: ['governance', 'toggles'],
    queryFn: () => apiRequest('/api/admin/governance/toggles'),
  });

  const { data: securityData } = useQuery({
    queryKey: ['governance', 'security', 'violations'],
    queryFn: () => apiRequest('/api/admin/governance/security/violations?limit=50'),
  });

  const { data: aiSecurityData } = useQuery({
    queryKey: ['governance', 'security', 'ai'],
    queryFn: () => apiRequest('/api/admin/governance/security/ai?limit=50'),
  });

  const { data: complianceData } = useQuery({
    queryKey: ['governance', 'compliance', 'dashboard'],
    queryFn: () => apiRequest('/api/admin/governance/compliance/dashboard'),
  });

  const { data: incidentData } = useQuery({
    queryKey: ['governance', 'incident'],
    queryFn: () => apiRequest('/api/admin/governance/incident'),
  });

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/admin/governance/toggles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['governance'] }),
  });

  const incidentMutation = useMutation({
    mutationFn: (activate: boolean) => apiRequest(
      `/api/admin/governance/incident/${activate ? 'activate' : 'deactivate'}`,
      { method: 'POST', body: JSON.stringify({ modeType: 'MAINTENANCE_MODE' }) }
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['governance', 'incident'] }),
  });

  const resetCircuitMutation = useMutation({
    mutationFn: (providerCode: string) => apiRequest(
      `/api/admin/governance/health/${providerCode}/reset-circuit`,
      { method: 'POST' }
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['governance', 'health'] }),
  });

  // Prepare chart data
  const prepareProviderChartData = () => {
    if (!healthData?.providers) return [];
    return healthData.providers.map((p: any) => ({
      name: p.providerCode,
      successRate: p.successRate,
      latency: p.avgLatencyMs,
      requests: p.requestsLast24h,
    }));
  };

  const prepareSecurityTrendData = () => {
    if (!securityData?.violations) return [];
    const byDay = new Map<string, number>();
    securityData.violations.forEach((v: any) => {
      const date = new Date(v.createdAt).toISOString().split('T')[0];
      byDay.set(date, (byDay.get(date) || 0) + 1);
    });
    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, violations: count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days
  };

  const prepareSeverityData = () => {
    if (!securityData?.violations) return [];
    const bySeverity: Record<string, number> = {};
    securityData.violations.forEach((v: any) => {
      bySeverity[v.severity || 'UNKNOWN'] = (bySeverity[v.severity || 'UNKNOWN'] || 0) + 1;
    });
    return Object.entries(bySeverity).map(([name, value]) => ({ name, value }));
  };

  // Active incident alert
  const activeIncident = incidentData?.active;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Analytics</h1>
          <p className="text-muted-foreground">
            FinOps, Security & Compliance Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Active Incident Banner */}
      {activeIncident && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Incident Mode: {activeIncident.modeType}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{activeIncident.incidentDescription || 'System is in incident mode'}</span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => incidentMutation.mutate(false)}
            >
              Deactivate
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Provider Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthData?.dashboard?.summary?.healthy || 0} / {healthData?.dashboard?.summary?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthData?.dashboard?.summary?.degraded || 0} degraded, {healthData?.dashboard?.summary?.down || 0} down
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Violations (24h)</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityData?.violations?.filter((v: any) => 
                Date.now() - new Date(v.createdAt).getTime() < 24 * 60 * 60 * 1000
              ).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {aiSecurityData?.incidents?.filter((i: any) =>
                Date.now() - new Date(i.createdAt).getTime() < 24 * 60 * 60 * 1000
              ).length || 0} AI security incidents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceData?.retentionPolicies?.active || 0} Active
            </div>
            <p className="text-xs text-muted-foreground">
              {complianceData?.integrity?.lockedRecords || 0} immutable records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Breaches (24h)</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {complianceData?.dataBreaches24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {complianceData?.integrity?.tamperAttempts24h || 0} tamper attempts blocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Provider Success Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Provider Success Rates</CardTitle>
                <CardDescription>24-hour rolling window</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={prepareProviderChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="successRate" fill="#0088FE" name="Success Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Security Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Security Violations Trend</CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={prepareSecurityTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="violations" 
                      stroke="#FF8042" 
                      fill="#FF8042" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Violations by Severity */}
            <Card>
              <CardHeader>
                <CardTitle>Violations by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={prepareSeverityData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {prepareSeverityData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Incidents */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
                <CardDescription>Last 10 provider issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {healthData?.dashboard?.recentIncidents?.slice(0, 5).map((incident: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{incident.providerCode}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(incident.occurredAt).toLocaleString()}
                      </div>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-4">No recent incidents</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Health Status</CardTitle>
              <CardDescription>Real-time health monitoring for all integration providers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>P95 Latency</TableHead>
                    <TableHead>Requests (24h)</TableHead>
                    <TableHead>Circuit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthData?.providers?.map((provider: any) => (
                    <TableRow key={provider.providerCode}>
                      <TableCell className="font-medium">{provider.providerCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{provider.providerType}</Badge>
                      </TableCell>
                      <TableCell>{getHealthBadge(provider.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={provider.successRate} 
                            className="w-16 h-2" 
                          />
                          <span className="text-sm">{provider.successRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{provider.avgLatencyMs}ms</TableCell>
                      <TableCell>{provider.p95LatencyMs}ms</TableCell>
                      <TableCell>{formatNumber(provider.requestsLast24h)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={provider.circuitState === 'CLOSED' ? 'default' : 'destructive'}
                        >
                          {provider.circuitState}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {provider.circuitState !== 'CLOSED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetCircuitMutation.mutate(provider.providerCode)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No providers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Security Violations</CardTitle>
                <CardDescription>Recent unauthorized access attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityData?.violations?.slice(0, 20).map((violation: any) => (
                    <div 
                      key={violation.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            violation.severity === 'CRITICAL' ? 'text-red-500' :
                            violation.severity === 'HIGH' ? 'text-orange-500' :
                            'text-yellow-500'
                          }`} />
                          <span className="font-medium">{violation.violationType}</span>
                          <Badge variant="outline">{violation.severity}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(violation.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {violation.reason}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Path: {violation.requestPath}</span>
                        {violation.userId && <span>User: {violation.userId}</span>}
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      No violations recorded
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Security Incidents</CardTitle>
                <CardDescription>Prompt injection & jailbreak attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {aiSecurityData?.incidents?.slice(0, 20).map((incident: any) => (
                    <div 
                      key={incident.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          <span className="font-medium">{incident.incidentType}</span>
                          <Badge variant="outline">{incident.actionTaken}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(incident.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {incident.inputExcerpt && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {incident.inputExcerpt.substring(0, 100)}...
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Confidence: {(incident.confidenceScore * 100).toFixed(0)}%</span>
                        <span>Method: {incident.detectionMethod}</span>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      No AI security incidents
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Retention Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {complianceData?.retentionPolicies?.active} / {complianceData?.retentionPolicies?.total}
                </div>
                <p className="text-sm text-muted-foreground">Active policies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Purges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatNumber(complianceData?.recentPurges?.recordsPurged || 0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Records purged ({complianceData?.recentPurges?.count || 0} jobs)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Immutable Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatNumber(complianceData?.integrity?.lockedRecords || 0)}
                </div>
                <p className="text-sm text-muted-foreground">Protected records</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Immutable Record Integrity</CardTitle>
              <CardDescription>Records protected from modification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">By Entity Type</h4>
                  <div className="space-y-2">
                    {Object.entries(complianceData?.integrity?.byEntityType || {}).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{type}</span>
                        <Badge variant="outline">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Integrity Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Checksums Verified: {complianceData?.integrity?.checksumVerifications?.verified || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Failed Verifications: {complianceData?.integrity?.checksumVerifications?.failed || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span>Tamper Attempts (24h): {complianceData?.integrity?.tamperAttempts24h || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generate Compliance Report</CardTitle>
                  <CardDescription>Export data for audits and compliance reviews</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  AI Usage Report
                </Button>
                <Button variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Report
                </Button>
                <Button variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  Audit Log Export
                </Button>
                <Button variant="outline">
                  <Lock className="h-4 w-4 mr-2" />
                  Access Matrix
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Kill Switches */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Kill Switches
                </CardTitle>
                <CardDescription>Global feature toggles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['AI_ENABLED', 'WHATSAPP_ENABLED', 'EMAIL_ENABLED', 'OUTBOUND_MESSAGING', 'NEW_SIGNUPS'].map((toggleType) => {
                    const toggle = togglesData?.toggles?.find(
                      (t: any) => t.toggleType === toggleType && t.scope === 'GLOBAL'
                    );
                    const isEnabled = toggle?.isEnabled ?? true;
                    
                    return (
                      <div key={toggleType} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{toggleType.replace(/_/g, ' ')}</p>
                          {toggle?.reason && (
                            <p className="text-xs text-muted-foreground">{toggle.reason}</p>
                          )}
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => {
                            toggleMutation.mutate({
                              scope: 'GLOBAL',
                              toggleType,
                              isEnabled: checked,
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Incident Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Incident Mode
                </CardTitle>
                <CardDescription>Emergency system controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeIncident ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Active: {activeIncident.modeType}</AlertTitle>
                      <AlertDescription>
                        Activated at: {new Date(activeIncident.activatedAt).toLocaleString()}
                        <br />
                        By: {activeIncident.activatedBy}
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="mt-2"
                          onClick={() => incidentMutation.mutate(false)}
                        >
                          Deactivate Now
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => incidentMutation.mutate(true)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Activate Maintenance Mode
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full justify-start"
                        onClick={() => {
                          if (confirm('This will lock down the entire system. Are you sure?')) {
                            // Would use different mutation for emergency lockdown
                          }
                        }}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Emergency Lockdown
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-2">Recent Mode History</h4>
                  <div className="space-y-2">
                    {incidentData?.history?.slice(0, 5).map((mode: any) => (
                      <div key={mode.id} className="flex items-center justify-between text-sm">
                        <span>{mode.modeType}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={mode.isActive ? 'destructive' : 'secondary'}>
                            {mode.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-muted-foreground">
                            {new Date(mode.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * SLA Reports Dashboard
 * Comprehensive SLA metrics and breach analysis
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  Users,
  Timer,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// API function
async function fetchSLAMetrics(period: string) {
  const res = await fetch(`/api/support/sla/metrics?period=${period}`);
  if (!res.ok) throw new Error('Failed to fetch SLA metrics');
  return res.json();
}

const COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  primary: '#3b82f6',
  muted: '#9ca3af',
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

export default function SLAReportsDashboard() {
  const [period, setPeriod] = useState('7d');
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sla-metrics', period],
    queryFn: () => fetchSLAMetrics(period),
  });
  
  // Mock data for demonstration (replace with actual API data)
  const metrics = data || {
    summary: {
      total_tickets: 156,
      resolved_within_sla: 142,
      sla_compliance_rate: 91.03,
      avg_response_time_hours: 2.4,
      avg_resolution_time_hours: 18.6,
      breaches_this_period: 14,
      breaches_trend: -12.5,
    },
    by_priority: [
      { priority: 'Urgent', total: 12, breached: 2, compliance: 83.3 },
      { priority: 'High', total: 34, breached: 5, compliance: 85.3 },
      { priority: 'Medium', total: 68, breached: 4, compliance: 94.1 },
      { priority: 'Low', total: 42, breached: 3, compliance: 92.9 },
    ],
    by_category: [
      { category: 'Technical', total: 45, breached: 5, compliance: 88.9 },
      { category: 'Billing', total: 38, breached: 2, compliance: 94.7 },
      { category: 'Account', total: 28, breached: 3, compliance: 89.3 },
      { category: 'Feature Request', total: 25, breached: 2, compliance: 92.0 },
      { category: 'Integration', total: 20, breached: 2, compliance: 90.0 },
    ],
    trend: [
      { date: 'Mon', tickets: 22, breached: 2, compliance: 90.9 },
      { date: 'Tue', tickets: 28, breached: 3, compliance: 89.3 },
      { date: 'Wed', tickets: 24, breached: 1, compliance: 95.8 },
      { date: 'Thu', tickets: 20, breached: 2, compliance: 90.0 },
      { date: 'Fri', tickets: 26, breached: 3, compliance: 88.5 },
      { date: 'Sat', tickets: 18, breached: 1, compliance: 94.4 },
      { date: 'Sun', tickets: 18, breached: 2, compliance: 88.9 },
    ],
    agent_performance: [
      { name: 'John Smith', tickets: 42, avg_response: 1.8, avg_resolution: 14.2, compliance: 95.2 },
      { name: 'Sarah Johnson', tickets: 38, avg_response: 2.1, avg_resolution: 16.8, compliance: 92.1 },
      { name: 'Mike Wilson', tickets: 35, avg_response: 2.5, avg_resolution: 20.1, compliance: 88.6 },
      { name: 'Emily Davis', tickets: 28, avg_response: 1.9, avg_resolution: 15.5, compliance: 93.8 },
      { name: 'Chris Brown', tickets: 13, avg_response: 3.2, avg_resolution: 24.3, compliance: 84.6 },
    ],
    recent_breaches: [
      { ticket_number: 'TKT-1234', subject: 'Payment processing issue', priority: 'urgent', breached_at: '2024-01-02T14:30:00Z', breach_type: 'response', assigned_to: 'John Smith' },
      { ticket_number: 'TKT-1231', subject: 'Cannot access dashboard', priority: 'high', breached_at: '2024-01-02T10:15:00Z', breach_type: 'resolution', assigned_to: 'Sarah Johnson' },
      { ticket_number: 'TKT-1228', subject: 'API rate limiting', priority: 'medium', breached_at: '2024-01-01T22:45:00Z', breach_type: 'response', assigned_to: null },
    ],
    sla_targets: {
      urgent: { response: 1, resolution: 4 },
      high: { response: 4, resolution: 24 },
      medium: { response: 8, resolution: 48 },
      low: { response: 24, resolution: 72 },
    },
  };
  
  const compliancePieData = [
    { name: 'Met SLA', value: metrics.summary.resolved_within_sla, color: COLORS.success },
    { name: 'Breached', value: metrics.summary.breaches_this_period, color: COLORS.danger },
  ];
  
  const exportReport = () => {
    // TODO: Implement CSV/PDF export
    console.log('Exporting report...');
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold">SLA Reports</h1>
          <p className="text-sm text-muted-foreground">
            Monitor SLA compliance and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" onClick={exportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 text-primary" />
                  <Badge 
                    className={cn(
                      metrics.summary.sla_compliance_rate >= 90 
                        ? "bg-green-100 text-green-700" 
                        : metrics.summary.sla_compliance_rate >= 80 
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    )}
                  >
                    {metrics.summary.sla_compliance_rate >= 90 ? 'Excellent' : 
                     metrics.summary.sla_compliance_rate >= 80 ? 'Fair' : 'Critical'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.summary.sla_compliance_rate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">SLA Compliance</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.summary.avg_response_time_hours}h</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Timer className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.summary.avg_resolution_time_hours}h</p>
                <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  {metrics.summary.breaches_trend !== 0 && (
                    <div className={cn(
                      "flex items-center text-xs",
                      metrics.summary.breaches_trend < 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {metrics.summary.breaches_trend < 0 ? (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      )}
                      {Math.abs(metrics.summary.breaches_trend)}%
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-red-600">{metrics.summary.breaches_this_period}</p>
                <p className="text-sm text-muted-foreground">SLA Breaches</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.summary.resolved_within_sla}</p>
                <p className="text-sm text-muted-foreground">Resolved in SLA</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Compliance Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Trend</CardTitle>
                <CardDescription>Daily SLA compliance rate</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Compliance']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="compliance" 
                      stroke={COLORS.primary}
                      fill={COLORS.primary}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Tickets & Breaches */}
            <Card>
              <CardHeader>
                <CardTitle>Tickets vs Breaches</CardTitle>
                <CardDescription>Daily ticket volume and breaches</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tickets" name="Total Tickets" fill={COLORS.primary} />
                    <Bar dataKey="breached" name="Breached" fill={COLORS.danger} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* Priority & Category Analysis */}
          <div className="grid grid-cols-2 gap-6">
            {/* By Priority */}
            <Card>
              <CardHeader>
                <CardTitle>SLA by Priority</CardTitle>
                <CardDescription>Compliance rate per priority level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.by_priority} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="priority" type="category" width={80} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Compliance']}
                    />
                    <Bar 
                      dataKey="compliance" 
                      fill={COLORS.primary}
                      radius={[0, 4, 4, 0]}
                    >
                      {metrics.by_priority.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.compliance >= 90 ? COLORS.success :
                            entry.compliance >= 80 ? COLORS.warning : COLORS.danger
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                
                {/* SLA Targets Reference */}
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2 text-sm">SLA Targets (hours)</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    {Object.entries(metrics.sla_targets).map(([priority, targets]: [string, any]) => (
                      <div key={priority}>
                        <p className="font-medium capitalize">{priority}</p>
                        <p className="text-muted-foreground">
                          Response: {targets.response}h
                        </p>
                        <p className="text-muted-foreground">
                          Resolution: {targets.resolution}h
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* By Category */}
            <Card>
              <CardHeader>
                <CardTitle>SLA by Category</CardTitle>
                <CardDescription>Compliance rate per ticket category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.by_category} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="category" type="category" width={100} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Compliance']}
                    />
                    <Bar 
                      dataKey="compliance" 
                      fill={COLORS.primary}
                      radius={[0, 4, 4, 0]}
                    >
                      {metrics.by_category.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.compliance >= 90 ? COLORS.success :
                            entry.compliance >= 80 ? COLORS.warning : COLORS.danger
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* Agent Performance & Recent Breaches */}
          <div className="grid grid-cols-2 gap-6">
            {/* Agent Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
                <CardDescription>SLA compliance by support agent</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Tickets</TableHead>
                      <TableHead className="text-right">Avg Response</TableHead>
                      <TableHead className="text-right">Avg Resolution</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.agent_performance.map((agent: any) => (
                      <TableRow key={agent.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            {agent.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{agent.tickets}</TableCell>
                        <TableCell className="text-right">{agent.avg_response}h</TableCell>
                        <TableCell className="text-right">{agent.avg_resolution}h</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            className={cn(
                              agent.compliance >= 90 
                                ? "bg-green-100 text-green-700" 
                                : agent.compliance >= 80 
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            )}
                          >
                            {agent.compliance.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            {/* Recent Breaches */}
            <Card>
              <CardHeader>
                <CardTitle>Recent SLA Breaches</CardTitle>
                <CardDescription>Latest tickets that breached SLA</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Agent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.recent_breaches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                          No breaches in this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      metrics.recent_breaches.map((breach: any) => (
                        <TableRow key={breach.ticket_number}>
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm">{breach.ticket_number}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {breach.subject}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={cn(
                                breach.priority === 'urgent' && 'bg-red-100 text-red-700',
                                breach.priority === 'high' && 'bg-orange-100 text-orange-700',
                                breach.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                                breach.priority === 'low' && 'bg-green-100 text-green-700'
                              )}
                            >
                              {breach.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {breach.breach_type === 'response' ? 'First Response' : 'Resolution'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {breach.assigned_to || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          {/* Compliance Distribution Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Overall SLA Compliance Distribution</CardTitle>
              <CardDescription>Tickets meeting vs breaching SLA in selected period</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="flex items-center gap-12">
                <ResponsiveContainer width={300} height={300}>
                  <PieChart>
                    <Pie
                      data={compliancePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {compliancePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: COLORS.success }}
                    />
                    <div>
                      <p className="font-medium">{metrics.summary.resolved_within_sla} Tickets</p>
                      <p className="text-sm text-muted-foreground">Resolved within SLA</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: COLORS.danger }}
                    />
                    <div>
                      <p className="font-medium">{metrics.summary.breaches_this_period} Tickets</p>
                      <p className="text-sm text-muted-foreground">Breached SLA</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-3xl font-bold text-primary">
                      {metrics.summary.sla_compliance_rate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Overall Compliance Rate</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

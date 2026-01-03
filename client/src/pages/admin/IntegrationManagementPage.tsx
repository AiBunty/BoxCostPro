/**
 * Integration Management Page
 * Admin interface for managing LLM, messaging, and automation providers
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Zap, 
  MessageSquare, 
  Brain, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Settings,
  TestTube,
  Shield,
  Activity,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// API functions
async function fetchLLMProviders() {
  const res = await fetch('/api/integration/llm/health');
  if (!res.ok) throw new Error('Failed to fetch LLM providers');
  return res.json();
}

async function fetchMessagingProviders() {
  const res = await fetch('/api/integration/messaging/providers');
  if (!res.ok) throw new Error('Failed to fetch messaging providers');
  return res.json();
}

async function fetchAutomationStatus() {
  const res = await fetch('/api/integration/automation/status');
  if (!res.ok) throw new Error('Failed to fetch automation status');
  return res.json();
}

async function testMessaging(provider: string, phone: string) {
  const res = await fetch('/api/integration/messaging/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, testPhone: phone }),
  });
  if (!res.ok) throw new Error('Failed to send test message');
  return res.json();
}

interface ProviderStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  available: boolean;
  responseTime?: number;
  lastChecked?: string;
  error?: string;
}

export default function IntegrationManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testPhone, setTestPhone] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  
  // Fetch data
  const { data: llmData, isLoading: llmLoading, refetch: refetchLLM } = useQuery({
    queryKey: ['integration', 'llm'],
    queryFn: fetchLLMProviders,
    refetchInterval: 60000, // Refresh every minute
  });
  
  const { data: messagingData, isLoading: messagingLoading, refetch: refetchMessaging } = useQuery({
    queryKey: ['integration', 'messaging'],
    queryFn: fetchMessagingProviders,
    refetchInterval: 60000,
  });
  
  const { data: automationData, isLoading: automationLoading, refetch: refetchAutomation } = useQuery({
    queryKey: ['integration', 'automation'],
    queryFn: fetchAutomationStatus,
    refetchInterval: 60000,
  });
  
  const testMessageMutation = useMutation({
    mutationFn: ({ provider, phone }: { provider: string; phone: string }) => 
      testMessaging(provider, phone),
    onSuccess: (data) => {
      toast({
        title: 'Test Message Sent',
        description: data.message || 'Check your WhatsApp for the test message',
      });
      setTestDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-muted-foreground" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-700">Degraded</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };
  
  const refreshAll = () => {
    refetchLLM();
    refetchMessaging();
    refetchAutomation();
    toast({
      title: 'Refreshing',
      description: 'Checking all provider connections...',
    });
  };
  
  const handleTestMessage = (provider: string) => {
    setSelectedProvider(provider);
    setTestDialogOpen(true);
  };
  
  const sendTestMessage = () => {
    if (!testPhone) {
      toast({
        title: 'Phone Required',
        description: 'Please enter a phone number with country code',
        variant: 'destructive',
      });
      return;
    }
    testMessageMutation.mutate({ provider: selectedProvider, phone: testPhone });
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold">Integration Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI providers, messaging channels, and automation workflows
          </p>
        </div>
        <Button onClick={refreshAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </div>
      
      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">LLM Providers</CardTitle>
                <Brain className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {llmData?.providers?.filter((p: ProviderStatus) => p.status === 'healthy').length || 0}
                  <span className="text-muted-foreground text-lg"> / {llmData?.providers?.length || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground">Healthy providers</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Messaging Channels</CardTitle>
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {messagingData?.providers?.filter((p: ProviderStatus) => p.available).length || 0}
                  <span className="text-muted-foreground text-lg"> / {messagingData?.providers?.length || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground">Available channels</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Automation</CardTitle>
                <Zap className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {automationData?.status === 'healthy' ? (
                    <span className="text-green-600">Connected</span>
                  ) : (
                    <span className="text-red-600">Disconnected</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">n8n workflow engine</p>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="llm" className="space-y-6">
            <TabsList>
              <TabsTrigger value="llm" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                LLM Providers
              </TabsTrigger>
              <TabsTrigger value="messaging" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Messaging
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Automation
              </TabsTrigger>
            </TabsList>
            
            {/* LLM Providers Tab */}
            <TabsContent value="llm" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Language Model Providers</CardTitle>
                  <CardDescription>
                    Configure and monitor AI providers for ticket response suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Last Checked</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {llmLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : llmData?.providers?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No LLM providers configured
                          </TableCell>
                        </TableRow>
                      ) : (
                        llmData?.providers?.map((provider: any, index: number) => (
                          <TableRow key={provider.name}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(provider.status)}
                                {provider.name}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(provider.status)}</TableCell>
                            <TableCell>
                              {provider.responseTime ? `${provider.responseTime}ms` : '-'}
                            </TableCell>
                            <TableCell>
                              {provider.lastChecked 
                                ? new Date(provider.lastChecked).toLocaleTimeString()
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{index + 1}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <Settings className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Fallback Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Failover Configuration</CardTitle>
                  <CardDescription>
                    Configure automatic failover when primary provider is unavailable
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Auto-Failover</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically switch to next available provider on failure
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Circuit Breaker</Label>
                      <p className="text-sm text-muted-foreground">
                        Temporarily disable provider after 3 consecutive failures
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Messaging Tab */}
            <TabsContent value="messaging" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp Messaging Providers</CardTitle>
                  <CardDescription>
                    Configure WhatsApp business messaging for customer communication
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messagingLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : messagingData?.providers?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No messaging providers configured
                          </TableCell>
                        </TableRow>
                      ) : (
                        messagingData?.providers?.map((provider: any) => (
                          <TableRow key={provider.name}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {provider.available ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                {provider.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              {provider.available ? (
                                <Badge className="bg-green-100 text-green-700">Available</Badge>
                              ) : (
                                <Badge variant="destructive">Unavailable</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {provider.type || 'WhatsApp'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {provider.lastActivity 
                                ? new Date(provider.lastActivity).toLocaleString()
                                : 'Never'
                              }
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleTestMessage(provider.name)}
                                disabled={!provider.available}
                              >
                                <TestTube className="w-4 h-4 mr-1" />
                                Test
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Settings className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Webhook Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                  <CardDescription>
                    Incoming webhook URLs for receiving WhatsApp messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={`${window.location.origin}/api/webhooks/whatsapp`}
                        readOnly 
                      />
                      <Button variant="outline" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/whatsapp`);
                        toast({ title: 'Copied to clipboard' });
                      }}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure this URL in your WhatsApp Business API settings
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Automation Tab */}
            <TabsContent value="automation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>n8n Workflow Automation</CardTitle>
                  <CardDescription>
                    Automate support workflows with n8n integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {automationLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Connection Status */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center",
                            automationData?.status === 'healthy' 
                              ? "bg-green-100" 
                              : "bg-red-100"
                          )}>
                            {automationData?.status === 'healthy' ? (
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                              <XCircle className="w-6 h-6 text-red-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">n8n Connection</h4>
                            <p className="text-sm text-muted-foreground">
                              {automationData?.url || 'Not configured'}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(automationData?.status || 'unknown')}
                      </div>
                      
                      {/* Available Workflows */}
                      <div>
                        <h4 className="font-medium mb-4">Available Workflows</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Workflow</TableHead>
                              <TableHead>Trigger Event</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Executions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {automationData?.workflows?.map((workflow: any) => (
                              <TableRow key={workflow.id}>
                                <TableCell className="font-medium">
                                  {workflow.name}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{workflow.trigger}</Badge>
                                </TableCell>
                                <TableCell>
                                  {workflow.active ? (
                                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </TableCell>
                                <TableCell>{workflow.executions || 0}</TableCell>
                              </TableRow>
                            )) || (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                  No workflows configured yet
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Automation Events */}
                      <div>
                        <h4 className="font-medium mb-4">Published Events</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { event: 'ticket.created', description: 'New ticket created' },
                            { event: 'ticket.updated', description: 'Ticket status changed' },
                            { event: 'ticket.sla_warning', description: 'SLA deadline approaching' },
                            { event: 'ticket.sla_breached', description: 'SLA has been breached' },
                            { event: 'ticket.assigned', description: 'Ticket assigned to agent' },
                            { event: 'message.received', description: 'New message on ticket' },
                          ].map((item) => (
                            <div 
                              key={item.event}
                              className="flex items-center gap-3 p-3 border rounded-lg"
                            >
                              <Activity className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-mono text-sm">{item.event}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
      
      {/* Test Message Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Message</DialogTitle>
            <DialogDescription>
              Send a test WhatsApp message to verify {selectedProvider} is working correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1234567890"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Include country code (e.g., +1 for US)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendTestMessage}
              disabled={testMessageMutation.isPending}
            >
              {testMessageMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Test'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

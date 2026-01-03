/**
 * Admin Support Dashboard Page
 * Full-featured support management for agents and managers
 */

import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Inbox, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Users,
  BarChart3,
  Settings,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketCard, TicketCardSkeleton } from '@/components/support/TicketCard';
import { TicketThread } from '@/components/support/TicketThread';
import { 
  useTickets, 
  useTicket, 
  useTicketStats,
  useAgentWorkload,
  useSLAMetrics,
} from '@/hooks/useSupport';
import { Ticket, TicketStatus, TicketPriority } from '@/types/support';

type ViewMode = 'tickets' | 'agents' | 'sla';
type FilterTab = 'all' | 'open' | 'mine' | 'unassigned' | 'breached';

export default function AdminSupportPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('tickets');
  const [activeTab, setActiveTab] = useState<FilterTab>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [priorityFilters, setPriorityFilters] = useState<TicketPriority[]>([]);
  
  // Fetch data
  const { data: ticketsData, isLoading: isLoadingTickets, refetch } = useTickets();
  const { data: selectedTicketData, isLoading: isLoadingTicket } = useTicket(selectedTicketId);
  const { data: statsData } = useTicketStats();
  const { data: workloadData } = useAgentWorkload();
  const { data: slaData } = useSLAMetrics();
  
  const tickets: Ticket[] = ticketsData?.tickets || ticketsData?.data?.tickets || [];
  const selectedTicket = selectedTicketData?.ticket || selectedTicketData;
  const stats = statsData || {};
  const workload = workloadData || [];
  const slaMetrics = slaData || {};
  
  // Filter tickets based on active tab
  const filteredTickets = useMemo(() => {
    let result = tickets;
    
    // Tab filter
    switch (activeTab) {
      case 'open':
        result = result.filter((t: Ticket) => 
          ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_support'].includes(t.status)
        );
        break;
      case 'unassigned':
        result = result.filter((t: Ticket) => !t.assigned_to);
        break;
      case 'breached':
        result = result.filter((t: Ticket) => t.sla_breached);
        break;
      // 'mine' would require current user ID
      // 'all' shows everything
    }
    
    // Priority filter
    if (priorityFilters.length > 0) {
      result = result.filter((t: Ticket) => priorityFilters.includes(t.priority));
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t: Ticket) =>
          t.subject.toLowerCase().includes(query) ||
          t.ticket_number.toLowerCase().includes(query) ||
          t.user_email?.toLowerCase().includes(query) ||
          t.user_name?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [tickets, activeTab, priorityFilters, searchQuery]);
  
  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
  };
  
  const handleCloseThread = () => {
    setSelectedTicketId(null);
  };
  
  const togglePriorityFilter = (priority: TicketPriority) => {
    setPriorityFilters(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold">Support Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage tickets, agents, and SLA compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 p-4 border-b">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-bold">{stats.open_count || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold">{stats.unassigned_count || 0}</p>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Breached</p>
                <p className="text-2xl font-bold text-red-600">
                  {tickets.filter((t: Ticket) => t.sla_breached).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{stats.avg_response_time_hours || '-'}h</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.tickets_today || 0}</p>
              </div>
              <Inbox className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ticket List Panel */}
        <div className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-200',
          selectedTicketId ? 'w-[450px]' : 'w-full max-w-[700px]'
        )}>
          {/* Filters Bar */}
          <div className="p-4 space-y-4 border-b bg-background">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
                <TabsTrigger value="unassigned" className="flex-1">
                  Unassigned
                  {stats.unassigned_count > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {stats.unassigned_count}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="breached" className="flex-1">
                  SLA Breached
                  {tickets.filter((t: Ticket) => t.sla_breached).length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {tickets.filter((t: Ticket) => t.sla_breached).length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Search & Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by subject, ticket #, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Priority</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(['urgent', 'high', 'medium', 'low'] as TicketPriority[]).map((priority) => (
                    <DropdownMenuCheckboxItem
                      key={priority}
                      checked={priorityFilters.includes(priority)}
                      onCheckedChange={() => togglePriorityFilter(priority)}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Active Filters */}
            {priorityFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {priorityFilters.map((priority) => (
                  <Badge
                    key={priority}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => togglePriorityFilter(priority)}
                  >
                    {priority}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPriorityFilters([])}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
            
            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>
          </div>
          
          {/* Ticket List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoadingTickets ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TicketCardSkeleton key={i} />
                ))
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg mb-1">No tickets found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or search
                  </p>
                </div>
              ) : (
                filteredTickets.map((ticket: Ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    isSelected={ticket.id === selectedTicketId}
                    onClick={() => handleTicketSelect(ticket)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Ticket Thread Panel */}
        {selectedTicketId && (
          <div className="flex-1 overflow-hidden">
            {isLoadingTicket ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : selectedTicket ? (
              <TicketThread
                ticket={selectedTicket}
                isAdmin={true}
                onClose={handleCloseThread}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Ticket not found
              </div>
            )}
          </div>
        )}
        
        {/* Empty State when no ticket selected */}
        {!selectedTicketId && filteredTickets.length > 0 && (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-1">Select a ticket</h3>
              <p className="text-sm text-muted-foreground">
                Click on a ticket to view details and respond
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

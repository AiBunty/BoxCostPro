/**
 * Support Page Component
 * Main support ticket page with email-style inbox layout
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CreateTicketDialog } from '@/components/support/CreateTicketDialog';
import { useTickets, useTicket } from '@/hooks/useSupport';
import { Ticket, TicketStatus, TicketPriority } from '@/types/support';

type FilterTab = 'all' | 'open' | 'resolved';

const filterTabConfig: Record<FilterTab, { statuses: TicketStatus[]; icon: any }> = {
  all: { 
    statuses: ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed'], 
    icon: Inbox 
  },
  open: { 
    statuses: ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_support'], 
    icon: Clock 
  },
  resolved: { 
    statuses: ['resolved', 'closed'], 
    icon: CheckCircle2 
  },
};

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [priorityFilters, setPriorityFilters] = useState<TicketPriority[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Fetch tickets
  const { data: ticketsData, isLoading: isLoadingTickets } = useTickets({
    status: filterTabConfig[activeTab].statuses,
    priority: priorityFilters.length > 0 ? priorityFilters : undefined,
    search: searchQuery || undefined,
  });
  
  // Fetch selected ticket details
  const { data: selectedTicketData, isLoading: isLoadingTicket } = useTicket(selectedTicketId);
  
  const tickets: Ticket[] = ticketsData?.tickets || ticketsData?.data?.tickets || [];
  const selectedTicket = selectedTicketData?.ticket || selectedTicketData;
  
  // Filter tickets client-side for search
  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    const query = searchQuery.toLowerCase();
    return tickets.filter(
      (t: Ticket) =>
        t.subject.toLowerCase().includes(query) ||
        t.ticket_number.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  }, [tickets, searchQuery]);
  
  // Count tickets by status
  const ticketCounts = useMemo(() => {
    const all = tickets.length;
    const open = tickets.filter((t: Ticket) => 
      ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_support'].includes(t.status)
    ).length;
    const resolved = tickets.filter((t: Ticket) => 
      ['resolved', 'closed'].includes(t.status)
    ).length;
    return { all, open, resolved };
  }, [tickets]);
  
  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
  };
  
  const handleTicketCreated = (ticketId: string) => {
    setSelectedTicketId(ticketId);
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
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">
            Get help with your account and services
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ticket List Panel */}
        <div className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-200',
          selectedTicketId ? 'w-[400px]' : 'w-full max-w-[600px]'
        )}>
          {/* Filters Bar */}
          <div className="p-4 space-y-4 border-b bg-background">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">
                  <Inbox className="w-4 h-4 mr-2" />
                  All ({ticketCounts.all})
                </TabsTrigger>
                <TabsTrigger value="open" className="flex-1">
                  <Clock className="w-4 h-4 mr-2" />
                  Open ({ticketCounts.open})
                </TabsTrigger>
                <TabsTrigger value="resolved" className="flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Resolved ({ticketCounts.resolved})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Search & Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
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
          </div>
          
          {/* Ticket List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoadingTickets ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <TicketCardSkeleton key={i} />
                ))
              ) : filteredTickets.length === 0 ? (
                // Empty state
                <div className="text-center py-12">
                  <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg mb-1">No tickets found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchQuery
                      ? 'Try adjusting your search or filters'
                      : 'Create a new ticket to get help'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Ticket
                    </Button>
                  )}
                </div>
              ) : (
                // Ticket cards
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
                isAdmin={false}
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
                Click on a ticket to view the conversation
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleTicketCreated}
      />
    </div>
  );
}

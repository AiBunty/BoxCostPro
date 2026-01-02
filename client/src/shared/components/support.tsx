import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Ticket, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Send,
  User,
  Headphones,
  ChevronLeft
} from "lucide-react";
import { Link } from "wouter";

interface SupportTicket {
  id: string;
  ticketNo: string;
  userId: string;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  category: string | null;
  assignedTo: string | null;
  isEscalated: boolean;
  resolutionNote: string | null;
  closedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  assignee?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  messages?: SupportMessage[];
}

interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-600'
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500'
};

export default function SupportPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("my-tickets");
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isInternalMessage, setIsInternalMessage] = useState(false);
  
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("general");
  const [newTicketPriority, setNewTicketPriority] = useState("medium");

  const isSupportStaff = user?.role === 'support_agent' || user?.role === 'support_manager' || 
                         user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'owner';

  const { data: myTickets = [], isLoading: loadingMyTickets } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets/mine'],
  });

  const { data: allTickets = [], isLoading: loadingAllTickets } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets'],
    enabled: isSupportStaff,
  });

  const { data: selectedTicketDetails, refetch: refetchTicket } = useQuery<SupportTicket>({
    queryKey: ['/api/support/tickets', selectedTicket?.id],
    enabled: !!selectedTicket?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: { subject: string; description: string; category: string; priority: string }) =>
      apiRequest('POST', '/api/support/tickets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      setShowNewTicketDialog(false);
      resetNewTicketForm();
      toast({ title: "Ticket Created", description: "Your support ticket has been submitted." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to Create Ticket", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { ticketId: string; message: string; isInternal: boolean }) =>
      apiRequest('POST', `/api/support/tickets/${data.ticketId}/messages`, data),
    onSuccess: () => {
      refetchTicket();
      setNewMessage("");
      setIsInternalMessage(false);
      toast({ title: "Message Sent" });
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: (ticketId: string) =>
      apiRequest('POST', `/api/support/tickets/${ticketId}/assign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      refetchTicket();
      toast({ title: "Ticket Assigned", description: "You are now assigned to this ticket." });
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: (data: { ticketId: string; resolutionNote: string }) =>
      apiRequest('POST', `/api/support/tickets/${data.ticketId}/close`, { resolutionNote: data.resolutionNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      setSelectedTicket(null);
      toast({ title: "Ticket Closed" });
    },
  });

  const resetNewTicketForm = () => {
    setNewTicketSubject("");
    setNewTicketDescription("");
    setNewTicketCategory("general");
    setNewTicketPriority("medium");
  };

  const getPriorityBadge = (priority: string) => (
    <Badge className={priorityColors[priority] || 'bg-gray-500'}>
      {priority}
    </Badge>
  );

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status] || 'bg-gray-500'}>
      {status.replace('_', ' ')}
    </Badge>
  );

  const renderTicketList = (tickets: SupportTicket[], showUser: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          {showUser && <TableHead>User</TableHead>}
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
            <TableCell>
              <div>
                <p className="font-medium">{ticket.ticketNo}</p>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">{ticket.subject}</p>
              </div>
            </TableCell>
            {showUser && (
              <TableCell>
                <p className="text-sm">
                  {[ticket.user?.firstName, ticket.user?.lastName].filter(Boolean).join(' ') || ticket.user?.email}
                </p>
              </TableCell>
            )}
            <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
            <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedTicket(ticket)}
                data-testid={`button-view-ticket-${ticket.id}`}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {tickets.length === 0 && (
          <TableRow>
            <TableCell colSpan={showUser ? 6 : 5} className="text-center text-muted-foreground py-8">
              No tickets found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Support</h1>
              <p className="text-sm text-muted-foreground">
                {isSupportStaff ? 'Manage support tickets' : 'Get help with your account'}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNewTicketDialog(true)} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-tickets" className="gap-2">
              <Ticket className="h-4 w-4" />
              My Tickets
            </TabsTrigger>
            {isSupportStaff && (
              <TabsTrigger value="all-tickets" className="gap-2">
                <Headphones className="h-4 w-4" />
                All Tickets
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-tickets" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Support Tickets</CardTitle>
                <CardDescription>Track your support requests</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMyTickets ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  renderTicketList(myTickets)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSupportStaff && (
            <TabsContent value="all-tickets" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Support Tickets</CardTitle>
                  <CardDescription>Manage all customer support requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAllTickets ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    renderTicketList(allTickets, true)
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and we'll help you resolve it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="Brief description of your issue"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
                data-testid="input-ticket-subject"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Provide details about your issue..."
                value={newTicketDescription}
                onChange={(e) => setNewTicketDescription(e.target.value)}
                rows={4}
                data-testid="input-ticket-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={newTicketCategory} onValueChange={setNewTicketCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={newTicketPriority} onValueChange={setNewTicketPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTicketDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTicketMutation.mutate({
                subject: newTicketSubject,
                description: newTicketDescription,
                category: newTicketCategory,
                priority: newTicketPriority,
              })}
              disabled={!newTicketSubject.trim() || createTicketMutation.isPending}
              data-testid="button-submit-ticket"
            >
              {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicketDetails?.ticketNo || selectedTicket?.ticketNo}
              {getStatusBadge(selectedTicketDetails?.status || selectedTicket?.status || 'open')}
            </DialogTitle>
            <DialogDescription>{selectedTicketDetails?.subject || selectedTicket?.subject}</DialogDescription>
          </DialogHeader>
          
          {selectedTicketDetails && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Priority: {getPriorityBadge(selectedTicketDetails.priority)}</span>
                <span>Category: {selectedTicketDetails.category || 'General'}</span>
                {selectedTicketDetails.assignee && (
                  <span>Assigned: {[selectedTicketDetails.assignee.firstName, selectedTicketDetails.assignee.lastName].filter(Boolean).join(' ')}</span>
                )}
              </div>

              {selectedTicketDetails.description && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicketDetails.description}</p>
                </div>
              )}

              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-4">
                  {selectedTicketDetails.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === 'support' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.senderType === 'support' 
                            ? 'bg-muted' 
                            : 'bg-primary text-primary-foreground'
                        } ${msg.isInternal ? 'border-2 border-yellow-500' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.senderType === 'support' ? (
                            <Headphones className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          <span className="text-xs opacity-75">
                            {msg.senderType === 'support' ? 'Support' : 'You'}
                            {msg.isInternal && ' (Internal)'}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!selectedTicketDetails.messages || selectedTicketDetails.messages.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No messages yet</p>
                  )}
                </div>
              </ScrollArea>

              {selectedTicketDetails.status !== 'closed' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    data-testid="input-message"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSupportStaff && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isInternalMessage}
                            onChange={(e) => setIsInternalMessage(e.target.checked)}
                          />
                          Internal note
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSupportStaff && !selectedTicketDetails.assignedTo && (
                        <Button
                          variant="outline"
                          onClick={() => assignTicketMutation.mutate(selectedTicketDetails.id)}
                          disabled={assignTicketMutation.isPending}
                          data-testid="button-assign-ticket"
                        >
                          Assign to Me
                        </Button>
                      )}
                      {isSupportStaff && selectedTicketDetails.status !== 'closed' && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const resolution = prompt("Enter resolution note:");
                            if (resolution && resolution.length >= 5) {
                              closeTicketMutation.mutate({ 
                                ticketId: selectedTicketDetails.id, 
                                resolutionNote: resolution 
                              });
                            }
                          }}
                          data-testid="button-close-ticket"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Close
                        </Button>
                      )}
                      <Button
                        onClick={() => sendMessageMutation.mutate({
                          ticketId: selectedTicketDetails.id,
                          message: newMessage,
                          isInternal: isInternalMessage,
                        })}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedTicketDetails.status === 'closed' && selectedTicketDetails.resolutionNote && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">Resolution:</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{selectedTicketDetails.resolutionNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

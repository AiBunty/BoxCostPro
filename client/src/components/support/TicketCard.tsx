/**
 * Ticket Card Component
 * Email-style card for displaying ticket summary in list view
 */

import { formatDistanceToNow } from 'date-fns';
import { 
  Circle, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare,
  User,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Ticket, TicketStatus, TicketPriority } from '@/types/support';

interface TicketCardProps {
  ticket: Ticket;
  isSelected?: boolean;
  onClick?: () => void;
}

const statusConfig: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  waiting_for_customer: { label: 'Awaiting Reply', color: 'bg-purple-100 text-purple-800', icon: Clock },
  waiting_for_support: { label: 'Pending Support', color: 'bg-orange-100 text-orange-800', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle2 },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

export function TicketCard({ ticket, isSelected, onClick }: TicketCardProps) {
  const status = statusConfig[ticket.status] || statusConfig.open;
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
  const StatusIcon = status.icon;
  
  const isUnread = ticket.status === 'open' || ticket.status === 'waiting_for_support';
  const isUrgent = ticket.priority === 'urgent' || ticket.priority === 'high';
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md border-l-4',
        isSelected && 'ring-2 ring-primary shadow-md',
        isUrgent ? 'border-l-red-500' : 'border-l-transparent',
        isUnread && 'bg-blue-50/50'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Unread indicator */}
            {isUnread && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            
            {/* Ticket Number */}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
              #{ticket.ticket_number}
            </span>
            
            {/* Status Badge */}
            <Badge variant="secondary" className={cn('text-xs', status.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
            
            {/* Priority Badge (only for high/urgent) */}
            {isUrgent && (
              <Badge variant="secondary" className={cn('text-xs', priority.color)}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {priority.label}
              </Badge>
            )}
          </div>
          
          {/* Timestamp */}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
          </span>
        </div>
        
        {/* Subject */}
        <h3 className={cn(
          'text-sm mb-2 line-clamp-1',
          isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
        )}>
          {ticket.subject}
        </h3>
        
        {/* Preview of description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {ticket.description}
        </p>
        
        {/* Footer Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Assigned to */}
            {ticket.assigned_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {ticket.assigned_name}
              </span>
            )}
            
            {/* Message count */}
            {ticket.message_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {ticket.message_count}
              </span>
            )}
            
            {/* SLA warning */}
            {ticket.sla_breached && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                SLA Breached
              </Badge>
            )}
          </div>
          
          <ChevronRight className="w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Ticket Card Skeleton for loading state
 */
export function TicketCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-transparent">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-5 w-3/4 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-full bg-muted animate-pulse rounded mb-1" />
        <div className="h-4 w-2/3 bg-muted animate-pulse rounded mb-3" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-4 w-4 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

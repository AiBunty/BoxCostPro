/**
 * Ticket Thread Component
 * Email-style threaded conversation view for a ticket
 */

import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  Headphones,
  MessageSquare,
  Lock,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TicketWithMessages, TicketMessage, TicketStatus } from '@/types/support';
import { useReplyToTicket, useAIDraft, useTicketSLA } from '@/hooks/useSupport';
import { useToast } from '@/hooks/use-toast';

interface TicketThreadProps {
  ticket: TicketWithMessages;
  isAdmin?: boolean;
  onClose?: () => void;
}

const statusConfig: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  waiting_for_customer: { label: 'Awaiting Reply', color: 'bg-purple-100 text-purple-800' },
  waiting_for_support: { label: 'Pending Support', color: 'bg-orange-100 text-orange-800' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800' },
};

function MessageBubble({ message, isCurrentUser }: { message: TicketMessage; isCurrentUser: boolean }) {
  const isSystem = message.sender_type === 'system';
  const isAI = message.sender_type === 'ai';
  const isSupport = message.sender_type === 'support';
  const isWhatsApp = message.sender_type === 'whatsapp';
  
  // Determine bubble style
  const bubbleClass = cn(
    'max-w-[80%] rounded-lg p-4',
    isSystem && 'bg-muted text-muted-foreground text-center mx-auto max-w-full',
    isCurrentUser && !isSystem && 'bg-primary text-primary-foreground ml-auto',
    !isCurrentUser && !isSystem && 'bg-muted mr-auto',
    message.is_internal && 'border-2 border-dashed border-yellow-400 bg-yellow-50'
  );
  
  const avatarIcon = isAI ? Bot : isSupport ? Headphones : isWhatsApp ? MessageSquare : User;
  const AvatarIcon = avatarIcon;
  
  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-muted text-muted-foreground text-xs px-4 py-2 rounded-full">
          {message.message}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('flex gap-3 mb-4', isCurrentUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className={cn(
          isSupport && 'bg-blue-100 text-blue-700',
          isAI && 'bg-purple-100 text-purple-700',
          isWhatsApp && 'bg-green-100 text-green-700'
        )}>
          <AvatarIcon className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      
      {/* Message Content */}
      <div className={cn('flex flex-col gap-1', isCurrentUser && 'items-end')}>
        {/* Sender info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{message.sender_name}</span>
          {message.is_internal && (
            <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-400">
              <Lock className="w-3 h-3 mr-1" />
              Internal Note
            </Badge>
          )}
          {isAI && message.ai_confidence !== undefined && (
            <Badge variant="outline" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              AI ({Math.round(message.ai_confidence * 100)}%)
            </Badge>
          )}
          <span>•</span>
          <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
        </div>
        
        {/* Message bubble */}
        <div className={bubbleClass}>
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          
          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-current/10">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs hover:underline"
                >
                  <Paperclip className="w-3 h-3" />
                  {attachment.filename}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SLAIndicator({ ticketId }: { ticketId: string }) {
  const { data: sla } = useTicketSLA(ticketId);
  
  if (!sla) return null;
  
  const formatTime = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    if (minutes <= 0) return 'Breached';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };
  
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg text-sm',
      sla.status === 'OK' && 'bg-green-50 text-green-700',
      sla.status === 'WARNING' && 'bg-yellow-50 text-yellow-700',
      sla.status === 'CRITICAL' && 'bg-orange-50 text-orange-700',
      sla.status === 'BREACHED' && 'bg-red-50 text-red-700'
    )}>
      {sla.status === 'OK' ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : sla.status === 'BREACHED' ? (
        <AlertTriangle className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      
      <div className="flex-1">
        <span className="font-medium">SLA Status: {sla.status}</span>
      </div>
      
      {sla.firstResponseMinutesRemaining !== null && (
        <div className="text-xs">
          First Response: {formatTime(sla.firstResponseMinutesRemaining)}
        </div>
      )}
      
      {sla.resolutionMinutesRemaining !== null && (
        <div className="text-xs">
          Resolution: {formatTime(sla.resolutionMinutesRemaining)}
        </div>
      )}
    </div>
  );
}

export function TicketThread({ ticket, isAdmin = false, onClose }: TicketThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showAIDraft, setShowAIDraft] = useState(false);
  const [aiDraft, setAiDraft] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const replyMutation = useReplyToTicket(ticket.id);
  const aiDraftMutation = useAIDraft(ticket.id);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages]);
  
  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    
    try {
      await replyMutation.mutateAsync({
        message: replyText.trim(),
        is_internal: isInternal,
      });
      setReplyText('');
      setIsInternal(false);
      toast({
        title: 'Reply sent',
        description: 'Your message has been sent successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reply',
        variant: 'destructive',
      });
    }
  };
  
  const handleGenerateAIDraft = async () => {
    try {
      const result = await aiDraftMutation.mutateAsync({
        recentMessages: ticket.messages.slice(-5),
      });
      setAiDraft(result.data);
      setShowAIDraft(true);
    } catch (error) {
      toast({
        title: 'AI Draft Error',
        description: error instanceof Error ? error.message : 'Failed to generate AI draft',
        variant: 'destructive',
      });
    }
  };
  
  const handleUseAIDraft = () => {
    if (aiDraft?.draftReply) {
      setReplyText(aiDraft.draftReply);
      setShowAIDraft(false);
      setAiDraft(null);
    }
  };
  
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
  const status = statusConfig[ticket.status] || statusConfig.open;
  
  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">
                #{ticket.ticket_number}
              </span>
              <Badge className={status.color}>{status.label}</Badge>
              <Badge variant="outline">{ticket.category}</Badge>
            </div>
            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Opened {format(new Date(ticket.created_at), 'PPp')} by {ticket.user_name}
            </p>
          </div>
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
        
        {/* SLA Indicator */}
        {isAdmin && <SLAIndicator ticketId={ticket.id} />}
      </CardHeader>
      
      <Separator />
      
      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4">
        {ticket.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isCurrentUser={message.sender_type === 'user' && !isAdmin}
          />
        ))}
        <div ref={messagesEndRef} />
      </CardContent>
      
      {/* AI Draft Panel */}
      {showAIDraft && aiDraft && (
        <div className="border-t bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-purple-600 mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-purple-800">AI Draft Suggestion</span>
                <Badge variant="outline" className="text-xs">
                  Confidence: {Math.round((aiDraft.confidence || 0) * 100)}%
                </Badge>
                {aiDraft.requiresEscalation && (
                  <Badge variant="destructive" className="text-xs">
                    Escalation Recommended
                  </Badge>
                )}
              </div>
              <p className="text-sm text-purple-900 whitespace-pre-wrap mb-3">
                {aiDraft.draftReply}
              </p>
              <Alert className="mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {aiDraft.disclaimer}
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUseAIDraft}>
                  Use This Draft
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAIDraft(false)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Reply Input */}
      {!isClosed && (
        <div className="border-t p-4 flex-shrink-0">
          {isAdmin && (
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Lock className="w-4 h-4 text-yellow-600" />
                <span>Internal Note (hidden from customer)</span>
              </label>
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={isInternal ? 'Add an internal note...' : 'Type your reply...'}
              className={cn(
                'flex-1 min-h-[80px] resize-none',
                isInternal && 'border-yellow-400 bg-yellow-50'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendReply();
                }
              }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                <Paperclip className="w-4 h-4 mr-1" />
                Attach
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateAIDraft}
                  disabled={aiDraftMutation.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {aiDraftMutation.isPending ? 'Generating...' : 'AI Draft'}
                </Button>
              )}
            </div>
            
            <Button 
              onClick={handleSendReply}
              disabled={!replyText.trim() || replyMutation.isPending}
            >
              <Send className="w-4 h-4 mr-1" />
              {replyMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Press Ctrl+Enter or Cmd+Enter to send
          </p>
        </div>
      )}
      
      {/* Closed ticket notice */}
      {isClosed && (
        <div className="border-t p-4 bg-muted text-center text-sm text-muted-foreground">
          This ticket has been {ticket.status}. 
          {ticket.status === 'resolved' && (
            <span> If you need more help, you can create a new ticket.</span>
          )}
        </div>
      )}
    </Card>
  );
}

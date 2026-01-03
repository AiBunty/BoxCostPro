/**
 * Support Ticket Types
 * Shared types for support ticket system
 */

export type TicketStatus = 
  | 'open' 
  | 'in_progress' 
  | 'waiting_for_customer' 
  | 'waiting_for_support' 
  | 'resolved' 
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketCategory = 
  | 'billing_payment'
  | 'subscription_plan'
  | 'technical_bug'
  | 'feature_request'
  | 'account_access'
  | 'data_export'
  | 'integration_api'
  | 'performance'
  | 'security'
  | 'onboarding'
  | 'general';

export type MessageSenderType = 'user' | 'support' | 'system' | 'whatsapp' | 'ai';

export interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  user_id: number;
  user_email: string;
  user_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  escalation_level: number;
  sla_breached: boolean;
  message_count: number;
  last_message_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: number;
  sender_name: string;
  sender_type: MessageSenderType;
  message: string;
  is_internal: boolean;
  attachments: Attachment[];
  created_at: string;
  ai_confidence?: number;
  ai_draft_id?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
}

export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

export interface TicketCategory {
  code: string;
  name: string;
  icon: string;
  description?: string;
}

export interface TicketPriorityOption {
  code: TicketPriority;
  name: string;
  color: string;
  slaFirstResponse: string;
  slaResolution: string;
}

export interface SLAStatus {
  ticketId: number;
  priority: string;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  firstResponseMinutesRemaining: number | null;
  resolutionMinutesRemaining: number | null;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'BREACHED';
}

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  attachments?: File[];
}

export interface ReplyTicketRequest {
  message: string;
  is_internal?: boolean;
  attachments?: File[];
}

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory;
  search?: string;
  assignedTo?: number;
}

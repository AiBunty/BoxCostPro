/**
 * Support Ticket Service
 * Complete workflow: Create → Email → Reply → Close
 * With mandatory email notifications for every interaction
 */

import { randomUUID } from 'crypto';
import { sendTicketCreatedEmail, sendTicketReplyEmail, sendEmail } from './emailNotification';

// Ticket types and priorities
export type TicketCategory = 
  | 'general'
  | 'billing'
  | 'technical'
  | 'feature_request'
  | 'bug_report'
  | 'account';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 
  | 'open'
  | 'in_progress'
  | 'waiting_for_customer'
  | 'waiting_for_support'
  | 'resolved'
  | 'closed';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  assigned_to?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  closed_at?: Date;
  first_response_at?: Date;
  satisfaction_rating?: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'user' | 'support' | 'system';
  message: string;
  attachments?: string[];
  is_internal?: boolean;
  created_at: Date;
}

export interface CreateTicketRequest {
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  attachments?: string[];
}

export interface ReplyToTicketRequest {
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'user' | 'support';
  message: string;
  attachments?: string[];
  is_internal?: boolean;
  new_status?: TicketStatus;
  new_priority?: TicketPriority;
  assign_to?: string;
}

/**
 * Generate unique ticket number
 * Format: TKT-YYYYMM-NNNN
 */
async function generateTicketNumber(db: any): Promise<string> {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  // Get count for this month
  const result = await db.query(`
    SELECT COUNT(*) as count 
    FROM support_tickets 
    WHERE ticket_number LIKE $1
  `, [`TKT-${yearMonth}-%`]);
  
  const count = parseInt(result.rows[0].count) + 1;
  return `TKT-${yearMonth}-${String(count).padStart(4, '0')}`;
}

/**
 * Create a new support ticket
 * - Creates ticket in database
 * - Sends email to user confirming ticket creation
 * - Sends email to support team (if configured)
 * - Logs audit trail
 */
export async function createTicket(
  request: CreateTicketRequest,
  db: any,
  emailConfig: any
): Promise<{ ticket: SupportTicket; emailResult: any }> {
  const ticketId = randomUUID();
  const ticketNumber = await generateTicketNumber(db);
  const now = new Date();
  
  // Determine priority if not provided
  const priority = request.priority || determinePriority(request.category, request.subject, request.description);
  
  // Insert ticket
  await db.query(`
    INSERT INTO support_tickets (
      id, ticket_number, tenant_id, user_id, user_email, user_name,
      category, priority, status, subject, description, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
  `, [
    ticketId, ticketNumber, request.tenant_id, request.user_id,
    request.user_email, request.user_name, request.category, priority,
    'open', request.subject, request.description, now, now
  ]);
  
  // Insert initial message
  await db.query(`
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_name, sender_type, message, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
  `, [
    randomUUID(), ticketId, request.user_id, request.user_name,
    'user', request.description, now
  ]);
  
  // Log audit
  await logTicketAudit(db, ticketId, request.tenant_id, 'created', request.user_id, {
    category: request.category,
    priority,
    subject: request.subject
  });
  
  // Send confirmation email to user
  const emailResult = await sendTicketCreatedEmail(
    request.user_email,
    request.user_name,
    ticketNumber,
    request.subject,
    request.description,
    request.tenant_id,
    ticketId,
    db,
    emailConfig
  );
  
  // Send notification to support team
  const supportEmails = await getSupportTeamEmails(db, request.tenant_id);
  if (supportEmails.length > 0) {
    await sendEmail({
      template_type: 'system_notification',
      recipients: supportEmails.map(email => ({ email, type: 'to' as const })),
      body_variables: {
        notification_title: 'New Support Ticket',
        notification_message: `New ticket #${ticketNumber} created by ${request.user_name}`,
        ticket_number: ticketNumber,
        ticket_subject: request.subject,
        ticket_priority: priority,
        ticket_category: request.category,
        action_url: `/admin/support/${ticketId}`,
        current_year: now.getFullYear()
      },
      tenant_id: request.tenant_id,
      reference_type: 'support_ticket',
      reference_id: ticketId,
      priority: priority === 'urgent' ? 'high' : 'normal'
    }, db, emailConfig);
  }
  
  const ticket: SupportTicket = {
    id: ticketId,
    ticket_number: ticketNumber,
    tenant_id: request.tenant_id,
    user_id: request.user_id,
    user_email: request.user_email,
    user_name: request.user_name,
    category: request.category,
    priority,
    status: 'open',
    subject: request.subject,
    description: request.description,
    created_at: now,
    updated_at: now
  };
  
  return { ticket, emailResult };
}

/**
 * Reply to a support ticket
 * - Adds message to ticket
 * - Updates ticket status if needed
 * - Sends email notification to other party
 * - Logs audit trail
 */
export async function replyToTicket(
  request: ReplyToTicketRequest,
  db: any,
  emailConfig: any
): Promise<{ message: TicketMessage; emailResult: any }> {
  const messageId = randomUUID();
  const now = new Date();
  
  // Get ticket details
  const ticketResult = await db.query(`
    SELECT * FROM support_tickets WHERE id = $1
  `, [request.ticket_id]);
  
  if (ticketResult.rows.length === 0) {
    throw new Error('Ticket not found');
  }
  
  const ticket = ticketResult.rows[0];
  
  // Check if ticket is closed
  if (ticket.status === 'closed') {
    throw new Error('Cannot reply to a closed ticket. Please open a new ticket.');
  }
  
  // Insert message
  await db.query(`
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_name, sender_type, 
      message, is_internal, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
  `, [
    messageId, request.ticket_id, request.sender_id, request.sender_name,
    request.sender_type, request.message, request.is_internal || false, now
  ]);
  
  // Determine new status
  let newStatus = request.new_status;
  if (!newStatus) {
    if (request.sender_type === 'support') {
      // First response tracking
      if (!ticket.first_response_at) {
        await db.query(`
          UPDATE support_tickets SET first_response_at = $1 WHERE id = $2
        `, [now, request.ticket_id]);
      }
      newStatus = 'waiting_for_customer';
    } else {
      newStatus = 'waiting_for_support';
    }
  }
  
  // Update ticket
  const updates: string[] = ['updated_at = $1'];
  const values: any[] = [now];
  let paramCount = 1;
  
  if (newStatus && newStatus !== ticket.status) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    values.push(newStatus);
  }
  
  if (request.new_priority && request.new_priority !== ticket.priority) {
    paramCount++;
    updates.push(`priority = $${paramCount}`);
    values.push(request.new_priority);
  }
  
  if (request.assign_to && request.assign_to !== ticket.assigned_to) {
    paramCount++;
    updates.push(`assigned_to = $${paramCount}`);
    values.push(request.assign_to);
  }
  
  paramCount++;
  values.push(request.ticket_id);
  
  await db.query(`
    UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${paramCount}
  `, values);
  
  // Log audit
  await logTicketAudit(db, request.ticket_id, ticket.tenant_id, 'reply_added', request.sender_id, {
    sender_type: request.sender_type,
    new_status: newStatus,
    message_preview: request.message.substring(0, 100)
  });
  
  // Send email notification (skip for internal notes)
  let emailResult = null;
  if (!request.is_internal) {
    if (request.sender_type === 'support') {
      // Notify user
      emailResult = await sendTicketReplyEmail(
        ticket.user_email,
        ticket.user_name,
        ticket.ticket_number,
        ticket.subject,
        request.message,
        request.sender_name,
        ticket.tenant_id,
        request.ticket_id,
        db,
        emailConfig
      );
    } else {
      // Notify support team
      const supportEmails = await getSupportTeamEmails(db, ticket.tenant_id);
      if (supportEmails.length > 0) {
        emailResult = await sendEmail({
          template_type: 'support_ticket_reply',
          recipients: supportEmails.map(email => ({ email, type: 'to' as const })),
          body_variables: {
            recipient_name: 'Support Team',
            ticket_number: ticket.ticket_number,
            ticket_subject: ticket.subject,
            reply_message: request.message,
            replier_name: request.sender_name,
            current_year: now.getFullYear()
          },
          tenant_id: ticket.tenant_id,
          reference_type: 'support_ticket',
          reference_id: request.ticket_id,
          priority: ticket.priority === 'urgent' ? 'high' : 'normal'
        }, db, emailConfig);
      }
    }
  }
  
  const message: TicketMessage = {
    id: messageId,
    ticket_id: request.ticket_id,
    sender_id: request.sender_id,
    sender_name: request.sender_name,
    sender_type: request.sender_type,
    message: request.message,
    is_internal: request.is_internal,
    created_at: now
  };
  
  return { message, emailResult };
}

/**
 * Resolve a support ticket
 */
export async function resolveTicket(
  ticketId: string,
  resolvedBy: string,
  resolution: string,
  db: any,
  emailConfig: any
): Promise<{ success: boolean; emailResult: any }> {
  const now = new Date();
  
  // Get ticket
  const ticketResult = await db.query(`
    SELECT * FROM support_tickets WHERE id = $1
  `, [ticketId]);
  
  if (ticketResult.rows.length === 0) {
    throw new Error('Ticket not found');
  }
  
  const ticket = ticketResult.rows[0];
  
  // Update ticket
  await db.query(`
    UPDATE support_tickets 
    SET status = 'resolved', resolved_at = $1, updated_at = $1
    WHERE id = $2
  `, [now, ticketId]);
  
  // Add resolution message
  await db.query(`
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_name, sender_type, message, created_at
    ) VALUES (
      $1, $2, $3, $4, 'system', $5, $6
    )
  `, [
    randomUUID(), ticketId, resolvedBy, 'System',
    `Ticket resolved. Resolution: ${resolution}`, now
  ]);
  
  // Log audit
  await logTicketAudit(db, ticketId, ticket.tenant_id, 'resolved', resolvedBy, {
    resolution
  });
  
  // Send email to user
  const emailResult = await sendEmail({
    template_type: 'support_ticket_closed',
    recipients: [{ email: ticket.user_email, name: ticket.user_name, type: 'to' }],
    body_variables: {
      user_name: ticket.user_name,
      ticket_number: ticket.ticket_number,
      ticket_subject: ticket.subject,
      resolution_message: resolution,
      satisfaction_survey_url: `/feedback/ticket/${ticketId}`,
      current_year: now.getFullYear()
    },
    tenant_id: ticket.tenant_id,
    reference_type: 'support_ticket',
    reference_id: ticketId,
    priority: 'normal'
  }, db, emailConfig);
  
  return { success: true, emailResult };
}

/**
 * Close a support ticket
 */
export async function closeTicket(
  ticketId: string,
  closedBy: string,
  reason: string,
  db: any,
  emailConfig: any
): Promise<{ success: boolean; emailResult: any }> {
  const now = new Date();
  
  // Get ticket
  const ticketResult = await db.query(`
    SELECT * FROM support_tickets WHERE id = $1
  `, [ticketId]);
  
  if (ticketResult.rows.length === 0) {
    throw new Error('Ticket not found');
  }
  
  const ticket = ticketResult.rows[0];
  
  // Update ticket
  await db.query(`
    UPDATE support_tickets 
    SET status = 'closed', closed_at = $1, updated_at = $1
    WHERE id = $2
  `, [now, ticketId]);
  
  // Add closing message
  await db.query(`
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_name, sender_type, message, created_at
    ) VALUES (
      $1, $2, $3, $4, 'system', $5, $6
    )
  `, [
    randomUUID(), ticketId, closedBy, 'System',
    `Ticket closed. Reason: ${reason}`, now
  ]);
  
  // Log audit
  await logTicketAudit(db, ticketId, ticket.tenant_id, 'closed', closedBy, {
    reason
  });
  
  // Send email to user
  const emailResult = await sendEmail({
    template_type: 'support_ticket_closed',
    recipients: [{ email: ticket.user_email, name: ticket.user_name, type: 'to' }],
    body_variables: {
      user_name: ticket.user_name,
      ticket_number: ticket.ticket_number,
      ticket_subject: ticket.subject,
      resolution_message: reason,
      satisfaction_survey_url: `/feedback/ticket/${ticketId}`,
      current_year: now.getFullYear()
    },
    tenant_id: ticket.tenant_id,
    reference_type: 'support_ticket',
    reference_id: ticketId,
    priority: 'normal'
  }, db, emailConfig);
  
  return { success: true, emailResult };
}

/**
 * Get ticket with all messages
 */
export async function getTicketWithMessages(
  ticketId: string,
  db: any
): Promise<{ ticket: SupportTicket; messages: TicketMessage[] }> {
  const ticketResult = await db.query(`
    SELECT * FROM support_tickets WHERE id = $1
  `, [ticketId]);
  
  if (ticketResult.rows.length === 0) {
    throw new Error('Ticket not found');
  }
  
  const messagesResult = await db.query(`
    SELECT * FROM support_ticket_messages 
    WHERE ticket_id = $1 
    ORDER BY created_at ASC
  `, [ticketId]);
  
  return {
    ticket: ticketResult.rows[0],
    messages: messagesResult.rows
  };
}

/**
 * List tickets with filtering
 */
export async function listTickets(
  tenantId: string,
  filters: {
    status?: TicketStatus | TicketStatus[];
    priority?: TicketPriority | TicketPriority[];
    category?: TicketCategory;
    user_id?: string;
    assigned_to?: string;
    search?: string;
  },
  pagination: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  },
  db: any
): Promise<{ tickets: SupportTicket[]; total: number; page: number; limit: number }> {
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 20, 100);
  const offset = (page - 1) * limit;
  const sortBy = pagination.sort_by || 'created_at';
  const sortOrder = pagination.sort_order || 'desc';
  
  let whereClause = 'WHERE tenant_id = $1';
  const params: any[] = [tenantId];
  let paramCount = 1;
  
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    paramCount++;
    whereClause += ` AND status = ANY($${paramCount})`;
    params.push(statuses);
  }
  
  if (filters.priority) {
    const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
    paramCount++;
    whereClause += ` AND priority = ANY($${paramCount})`;
    params.push(priorities);
  }
  
  if (filters.category) {
    paramCount++;
    whereClause += ` AND category = $${paramCount}`;
    params.push(filters.category);
  }
  
  if (filters.user_id) {
    paramCount++;
    whereClause += ` AND user_id = $${paramCount}`;
    params.push(filters.user_id);
  }
  
  if (filters.assigned_to) {
    paramCount++;
    whereClause += ` AND assigned_to = $${paramCount}`;
    params.push(filters.assigned_to);
  }
  
  if (filters.search) {
    paramCount++;
    whereClause += ` AND (subject ILIKE $${paramCount} OR description ILIKE $${paramCount} OR ticket_number ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
  }
  
  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM support_tickets ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);
  
  // Get tickets
  const ticketsResult = await db.query(`
    SELECT * FROM support_tickets 
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `, [...params, limit, offset]);
  
  return {
    tickets: ticketsResult.rows,
    total,
    page,
    limit
  };
}

/**
 * Auto-determine ticket priority based on keywords
 */
function determinePriority(category: TicketCategory, subject: string, description: string): TicketPriority {
  const text = `${subject} ${description}`.toLowerCase();
  
  // Urgent keywords
  const urgentKeywords = ['urgent', 'emergency', 'critical', 'down', 'not working', 'broken', 'immediately', 'asap'];
  if (urgentKeywords.some(kw => text.includes(kw))) {
    return 'urgent';
  }
  
  // High priority keywords
  const highKeywords = ['important', 'high priority', 'serious', 'blocking', 'cannot', 'error', 'failed'];
  if (highKeywords.some(kw => text.includes(kw))) {
    return 'high';
  }
  
  // Billing is usually higher priority
  if (category === 'billing') {
    return 'high';
  }
  
  // Feature requests are lower priority
  if (category === 'feature_request') {
    return 'low';
  }
  
  return 'medium';
}

/**
 * Get support team emails for a tenant
 */
async function getSupportTeamEmails(db: any, tenantId: string): Promise<string[]> {
  const result = await db.query(`
    SELECT u.email 
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role IN ('admin', 'super_admin', 'support')
    AND (ur.tenant_id = $1 OR ur.tenant_id IS NULL)
    AND u.is_active = true
  `, [tenantId]);
  
  return result.rows.map((r: any) => r.email);
}

/**
 * Log ticket audit
 */
async function logTicketAudit(
  db: any,
  ticketId: string,
  tenantId: string,
  action: string,
  userId: string,
  details: Record<string, any>
): Promise<void> {
  await db.query(`
    INSERT INTO system_audit_logs (
      id, action_type, entity_type, entity_id, 
      tenant_id, user_id, changes, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
  `, [
    randomUUID(),
    `ticket_${action}`,
    'support_ticket',
    ticketId,
    tenantId,
    userId,
    JSON.stringify(details),
    new Date()
  ]);
}

export default {
  createTicket,
  replyToTicket,
  resolveTicket,
  closeTicket,
  getTicketWithMessages,
  listTickets
};

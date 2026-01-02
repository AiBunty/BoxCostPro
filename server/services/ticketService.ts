import { storage } from "../storage";
import { logTicketResolved, logTicketAssigned } from "./adminAuditService";
import type { SupportTicket } from "@shared/schema";

/**
 * Support Ticket Service
 * 
 * Handles ticket lifecycle management:
 * OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
 * 
 * Tracks SLA times and resolution metrics.
 */

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// SLA targets (in hours)
const SLA_TARGETS: Record<TicketPriority, number> = {
  'LOW': 48,
  'MEDIUM': 24,
  'HIGH': 12,
  'URGENT': 4,
};

/**
 * Calculate SLA status based on priority and age
 */
export function calculateSLAStatus(
  priority: TicketPriority,
  createdAt: Date,
  resolvedAt?: Date
): { slaHours: number; remainingHours: number; isBreach: boolean } {
  const targetSLA = SLA_TARGETS[priority];
  const checkTime = resolvedAt || new Date();
  const hoursElapsed = (checkTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  const remainingHours = Math.max(0, targetSLA - hoursElapsed);

  return {
    slaHours: targetSLA,
    remainingHours,
    isBreach: hoursElapsed > targetSLA,
  };
}

/**
 * Assign ticket to a support staff member
 */
export async function assignTicket(
  ticketId: string,
  staffId: string,
  actorStaffId: string,
  actorRole: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SupportTicket> {
  const ticket = await storage.getSupportTicket(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const beforeState = { ...ticket };

  // Update assignment
  const updatedTicket = await storage.updateSupportTicket(ticketId, {
    assignedTo: staffId,
    status: 'in_progress' as any,
  });

  if (!updatedTicket) {
    throw new Error('Failed to update ticket');
  }

  // Log to audit
  await logTicketAssigned(
    actorStaffId,
    actorRole,
    ticketId,
    beforeState,
    updatedTicket,
    ipAddress,
    userAgent
  );

  return updatedTicket;
}

/**
 * Resolve a ticket
 */
export async function resolveTicket(
  ticketId: string,
  resolutionNote: string,
  actorStaffId: string,
  actorRole: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SupportTicket> {
  const ticket = await storage.getSupportTicket(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const beforeState = { ...ticket };
  const now = new Date();

  // Calculate resolution time in hours (use ticket creation time if available)
  let resolutionTime = 0;
  if (ticket.createdAt) {
    resolutionTime = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
  }

  // Update ticket
  const updatedTicket = await storage.updateSupportTicket(ticketId, {
    status: 'closed' as any,
    resolutionNote,
    closedAt: now,
  });

  if (!updatedTicket) {
    throw new Error('Failed to update ticket');
  }

  // Update staff metrics
  if (ticket.assignedTo) {
    await updateStaffMetricsOnResolve(
      ticket.assignedTo,
      resolutionTime
    );
  }

  // Log to audit
  await logTicketResolved(
    actorStaffId,
    actorRole,
    ticketId,
    beforeState,
    updatedTicket,
    resolutionTime,
    ipAddress,
    userAgent
  );

  return updatedTicket;
}

/**
 * Close a resolved ticket
 */
export async function closeTicket(
  ticketId: string,
  closedBy: string,
  actorStaffId: string,
  actorRole: string
): Promise<SupportTicket> {
  const ticket = await storage.getSupportTicket(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.status !== 'closed') {
    throw new Error('Ticket can only be closed once');
  }

  const updatedTicket = await storage.updateSupportTicket(ticketId, {
    closedAt: new Date(),
    closedBy,
  });

  if (!updatedTicket) {
    throw new Error('Failed to close ticket');
  }

  return updatedTicket;
}

/**
 * Add internal note to ticket
 */
export async function addTicketNote(
  ticketId: string,
  staffId: string,
  content: string
): Promise<any> {
  const ticket = await storage.getSupportTicket(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return storage.createTicketNote({
    ticketId,
    staffId,
    content,
  });
}

/**
 * Get ticket with full details including notes
 */
export async function getTicketDetails(ticketId: string): Promise<any> {
  const ticket = await storage.getSupportTicket(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const notes = await storage.getTicketNotes(ticketId);
  const assignedStaff = ticket.assignedTo 
    ? await storage.getStaff(ticket.assignedTo)
    : null;

  const slaStatus = calculateSLAStatus(
    (ticket.priority as TicketPriority) || 'MEDIUM',
    ticket.createdAt || new Date(),
    ticket.closedAt || undefined
  );

  return {
    ...ticket,
    notes,
    assignedStaff,
    slaStatus,
  };
}

/**
 * Update staff metrics when ticket is resolved
 */
async function updateStaffMetricsOnResolve(
  staffId: string,
  resolutionTime: number
): Promise<void> {
  try {
    const metrics = await storage.getStaffMetrics(staffId);
    
    if (!metrics) {
      await storage.createStaffMetrics({
        staffId,
        ticketsResolved: 1,
        avgResolutionTime: resolutionTime,
      });
      return;
    }

    // Calculate new average - use 0 as default for null values
    const currentAvg = metrics.avgResolutionTime || 0;
    const currentResolved = metrics.ticketsResolved || 0;
    const newAvg = (currentAvg * currentResolved + resolutionTime) /
      (currentResolved + 1);

    await storage.updateStaffMetrics(staffId, {
      ticketsResolved: currentResolved + 1,
      avgResolutionTime: newAvg,
    });
  } catch (error) {
    console.error('[ticketService] Failed to update metrics:', error);
    // Don't throw - metrics update should not fail the main operation
  }
}

/**
 * Get all open tickets assigned to a staff member
 */
export async function getOpenTicketsForStaff(staffId: string): Promise<SupportTicket[]> {
  return storage.getSupportTicketsForStaff(staffId, ['OPEN', 'IN_PROGRESS']);
}

/**
 * Get ticket analytics
 */
export async function getTicketAnalytics(filters?: {
  startDate?: Date;
  endDate?: Date;
  priority?: TicketPriority;
}): Promise<{
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  slaBreaches: number;
  byPriority: Record<string, number>;
}> {
  return storage.getTicketAnalytics(filters);
}

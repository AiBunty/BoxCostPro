/**
 * SLA Monitor Service
 * 
 * Monitors ticket SLA compliance and triggers:
 * - Warning notifications when SLA is about to breach
 * - Escalation when SLA is breached
 * - Auto-assignment when ticket is unassigned
 * 
 * Runs as a background job (cron) every 5 minutes
 */

import { db } from '../db';
import { eq, and, lt, gt, isNull, sql, or, desc } from 'drizzle-orm';
import { publishEvent } from '../integrations/automation';

// SLA Targets (in minutes) - loaded from database or defaults
interface SLATarget {
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalateToRole: string;
}

const DEFAULT_SLA_TARGETS: SLATarget[] = [
  { priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 2880, escalateToRole: 'support_agent' },
  { priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 1440, escalateToRole: 'support_agent' },
  { priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 720, escalateToRole: 'support_manager' },
  { priority: 'URGENT', firstResponseMinutes: 15, resolutionMinutes: 240, escalateToRole: 'support_manager' },
];

// Warning thresholds (percentage of SLA remaining)
const WARNING_THRESHOLD = 0.25; // 25% time remaining
const CRITICAL_THRESHOLD = 0.10; // 10% time remaining

interface TicketForSLA {
  id: number;
  priority: string;
  status: string;
  assignedAgentId: number | null;
  createdAt: Date;
  firstResponseAt: Date | null;
  slaBreachedAt: Date | null;
  escalationLevel: number;
  tenantId: number;
  userId: number;
  subject: string;
}

interface SLACheckResult {
  ticketId: number;
  priority: string;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  firstResponseMinutesRemaining: number | null;
  resolutionMinutesRemaining: number | null;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'BREACHED';
  action: 'NONE' | 'WARN' | 'ESCALATE' | 'URGENT_ESCALATE';
}

/**
 * Load SLA targets from database or use defaults
 */
async function loadSLATargets(): Promise<SLATarget[]> {
  try {
    // In production, query support_sla_rules table
    // For now, return defaults
    return DEFAULT_SLA_TARGETS;
  } catch (error) {
    console.error('[SLAMonitor] Failed to load SLA targets:', error);
    return DEFAULT_SLA_TARGETS;
  }
}

/**
 * Get SLA target for a priority level
 */
function getSLATarget(priority: string, targets: SLATarget[]): SLATarget {
  return targets.find(t => t.priority === priority) || targets[1]; // Default to MEDIUM
}

/**
 * Calculate SLA status for a ticket
 */
function calculateSLAStatus(
  ticket: TicketForSLA,
  slaTarget: SLATarget,
  now: Date
): SLACheckResult {
  const createdAt = new Date(ticket.createdAt);
  const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  
  // First response SLA
  let firstResponseBreached = false;
  let firstResponseMinutesRemaining: number | null = null;
  
  if (!ticket.firstResponseAt) {
    firstResponseMinutesRemaining = slaTarget.firstResponseMinutes - elapsedMinutes;
    firstResponseBreached = firstResponseMinutesRemaining <= 0;
  }
  
  // Resolution SLA (only for open tickets)
  let resolutionBreached = false;
  let resolutionMinutesRemaining: number | null = null;
  
  if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    resolutionMinutesRemaining = slaTarget.resolutionMinutes - elapsedMinutes;
    resolutionBreached = resolutionMinutesRemaining <= 0;
  }
  
  // Determine status and action
  let status: SLACheckResult['status'] = 'OK';
  let action: SLACheckResult['action'] = 'NONE';
  
  if (firstResponseBreached || resolutionBreached) {
    status = 'BREACHED';
    action = ticket.escalationLevel >= 2 ? 'URGENT_ESCALATE' : 'ESCALATE';
  } else {
    // Check warning thresholds
    const firstResponseRatio = firstResponseMinutesRemaining !== null
      ? firstResponseMinutesRemaining / slaTarget.firstResponseMinutes
      : 1;
    const resolutionRatio = resolutionMinutesRemaining !== null
      ? resolutionMinutesRemaining / slaTarget.resolutionMinutes
      : 1;
    
    const minRatio = Math.min(firstResponseRatio, resolutionRatio);
    
    if (minRatio <= CRITICAL_THRESHOLD) {
      status = 'CRITICAL';
      action = 'WARN';
    } else if (minRatio <= WARNING_THRESHOLD) {
      status = 'WARNING';
      action = 'WARN';
    }
  }
  
  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    firstResponseBreached,
    resolutionBreached,
    firstResponseMinutesRemaining,
    resolutionMinutesRemaining,
    status,
    action,
  };
}

/**
 * Escalate a ticket
 */
async function escalateTicket(
  ticket: TicketForSLA,
  slaResult: SLACheckResult,
  slaTarget: SLATarget
): Promise<void> {
  try {
    const newEscalationLevel = ticket.escalationLevel + 1;
    
    // Update ticket in database
    // In production, update supportTicketsExtended table
    console.log(`[SLAMonitor] Escalating ticket #${ticket.id} to level ${newEscalationLevel}`);
    
    // Publish escalation event
    publishEvent('ticket.escalated', {
      ticketId: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      previousLevel: ticket.escalationLevel,
      newLevel: newEscalationLevel,
      reason: slaResult.firstResponseBreached ? 'first_response_breach' : 'resolution_breach',
      escalateToRole: slaTarget.escalateToRole,
      breachedAt: new Date().toISOString(),
    }, {
      tenantId: ticket.tenantId,
      userId: ticket.userId,
    });
    
    // Also publish SLA breach event
    publishEvent('ticket.sla_breached', {
      ticketId: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      firstResponseBreached: slaResult.firstResponseBreached,
      resolutionBreached: slaResult.resolutionBreached,
      escalationLevel: newEscalationLevel,
    }, {
      tenantId: ticket.tenantId,
      userId: ticket.userId,
    });
    
    // Log to audit
    console.log(`[SLAMonitor] Ticket #${ticket.id} escalated - SLA breach: FR=${slaResult.firstResponseBreached}, RES=${slaResult.resolutionBreached}`);
    
  } catch (error) {
    console.error(`[SLAMonitor] Failed to escalate ticket #${ticket.id}:`, error);
  }
}

/**
 * Send SLA warning notification
 */
async function sendSLAWarning(
  ticket: TicketForSLA,
  slaResult: SLACheckResult
): Promise<void> {
  try {
    // Calculate time remaining
    const minRemaining = Math.min(
      slaResult.firstResponseMinutesRemaining ?? Infinity,
      slaResult.resolutionMinutesRemaining ?? Infinity
    );
    
    const formattedTime = minRemaining < 60
      ? `${Math.round(minRemaining)} minutes`
      : `${Math.round(minRemaining / 60)} hours`;
    
    console.log(`[SLAMonitor] SLA ${slaResult.status} for ticket #${ticket.id}: ${formattedTime} remaining`);
    
    // In production, send email/WhatsApp notification to assigned agent
    // and to support managers if critical
    
  } catch (error) {
    console.error(`[SLAMonitor] Failed to send warning for ticket #${ticket.id}:`, error);
  }
}

/**
 * Find tickets needing SLA attention
 */
async function findTicketsForSLACheck(): Promise<TicketForSLA[]> {
  try {
    // In production, query supportTicketsExtended
    // For now, return empty array (will be wired to actual table)
    
    // Example query structure:
    // SELECT * FROM support_tickets_extended
    // WHERE status NOT IN ('RESOLVED', 'CLOSED')
    // AND (sla_breached_at IS NULL OR escalation_level < 3)
    // ORDER BY priority DESC, created_at ASC
    // LIMIT 100
    
    return [];
    
  } catch (error) {
    console.error('[SLAMonitor] Failed to fetch tickets:', error);
    return [];
  }
}

/**
 * Main SLA check job
 */
export async function runSLACheck(): Promise<{
  checked: number;
  warnings: number;
  escalations: number;
  errors: number;
}> {
  const startTime = Date.now();
  console.log('[SLAMonitor] Starting SLA check...');
  
  const stats = {
    checked: 0,
    warnings: 0,
    escalations: 0,
    errors: 0,
  };
  
  try {
    const slaTargets = await loadSLATargets();
    const tickets = await findTicketsForSLACheck();
    const now = new Date();
    
    for (const ticket of tickets) {
      try {
        const slaTarget = getSLATarget(ticket.priority, slaTargets);
        const result = calculateSLAStatus(ticket, slaTarget, now);
        
        stats.checked++;
        
        switch (result.action) {
          case 'ESCALATE':
          case 'URGENT_ESCALATE':
            await escalateTicket(ticket, result, slaTarget);
            stats.escalations++;
            break;
          
          case 'WARN':
            await sendSLAWarning(ticket, result);
            stats.warnings++;
            break;
          
          case 'NONE':
            // Ticket is within SLA
            break;
        }
        
      } catch (error) {
        stats.errors++;
        console.error(`[SLAMonitor] Error processing ticket #${ticket.id}:`, error);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(
      `[SLAMonitor] Completed in ${duration}ms: ${stats.checked} checked, ` +
      `${stats.warnings} warnings, ${stats.escalations} escalations, ${stats.errors} errors`
    );
    
    return stats;
    
  } catch (error) {
    console.error('[SLAMonitor] SLA check failed:', error);
    throw error;
  }
}

/**
 * Start the SLA monitor cron job
 */
export function startSLAMonitor(intervalMinutes: number = 5): NodeJS.Timeout {
  console.log(`[SLAMonitor] Starting SLA monitor, checking every ${intervalMinutes} minutes`);
  
  // Run immediately on start
  runSLACheck().catch(console.error);
  
  // Then run on interval
  const intervalMs = intervalMinutes * 60 * 1000;
  return setInterval(() => {
    runSLACheck().catch(console.error);
  }, intervalMs);
}

/**
 * Calculate SLA metrics for reporting
 */
export async function getSLAMetrics(
  tenantId?: number,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalTickets: number;
  breachedTickets: number;
  averageFirstResponseMinutes: number;
  averageResolutionMinutes: number;
  slaComplianceRate: number;
  byPriority: Record<string, {
    total: number;
    breached: number;
    avgFirstResponse: number;
    avgResolution: number;
  }>;
}> {
  try {
    // In production, query from database with proper aggregation
    // For now, return mock data structure
    
    return {
      totalTickets: 0,
      breachedTickets: 0,
      averageFirstResponseMinutes: 0,
      averageResolutionMinutes: 0,
      slaComplianceRate: 100,
      byPriority: {
        LOW: { total: 0, breached: 0, avgFirstResponse: 0, avgResolution: 0 },
        MEDIUM: { total: 0, breached: 0, avgFirstResponse: 0, avgResolution: 0 },
        HIGH: { total: 0, breached: 0, avgFirstResponse: 0, avgResolution: 0 },
        URGENT: { total: 0, breached: 0, avgFirstResponse: 0, avgResolution: 0 },
      },
    };
    
  } catch (error) {
    console.error('[SLAMonitor] Failed to get SLA metrics:', error);
    throw error;
  }
}

/**
 * Get current SLA status for a specific ticket
 */
export async function getTicketSLAStatus(
  ticketId: number
): Promise<SLACheckResult | null> {
  try {
    // In production, fetch ticket and calculate status
    // For now, return null
    return null;
    
  } catch (error) {
    console.error(`[SLAMonitor] Failed to get SLA status for ticket #${ticketId}:`, error);
    return null;
  }
}

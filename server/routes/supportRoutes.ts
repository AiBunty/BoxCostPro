/**
 * Support Ticket API Routes
 * Full CRUD operations for support ticket system
 * 
 * Enhanced with:
 * - SLA tracking and monitoring
 * - Auto-assignment engine
 * - AI draft suggestions
 * - WhatsApp integration
 * - Automation events
 */

import { Router, Request, Response } from 'express';
import supportTicketService from '../services/supportTicket';
import { publishEvent } from '../integrations/automation';
import { assignTicket, getAssignmentRecommendations, getAgentWorkloadStats } from '../services/ticketAutoAssignmentService';
import { getTicketSLAStatus, getSLAMetrics, runSLACheck } from '../services/slaMonitorService';
import { createAIOrchestrator } from '../services/ai';

const router = Router();

/**
 * Create a new support ticket
 */
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId, userEmail, userName, emailConfig } = req as any;
    const { category, priority, subject, description, attachments } = req.body;
    
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }
    
    const result = await supportTicketService.createTicket({
      tenant_id: tenantId,
      user_id: userId,
      user_email: userEmail,
      user_name: userName || userEmail,
      category: category || 'general',
      priority,
      subject,
      description,
      attachments
    }, db, emailConfig);
    
    res.status(201).json({
      ticket: result.ticket,
      email_sent: result.emailResult?.success || false
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

/**
 * List tickets (with filtering)
 */
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId, userRole } = req as any;
    const { 
      status, priority, category, search,
      page, limit, sort_by, sort_order 
    } = req.query;
    
    // Regular users can only see their own tickets
    const filters: any = {};
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      filters.user_id = userId;
    }
    
    if (status) filters.status = (status as string).split(',');
    if (priority) filters.priority = (priority as string).split(',');
    if (category) filters.category = category as string;
    if (search) filters.search = search as string;
    
    const result = await supportTicketService.listTickets(
      tenantId,
      filters,
      {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sort_by: sort_by as string,
        sort_order: sort_order as 'asc' | 'desc'
      },
      db
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error listing tickets:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

/**
 * Get single ticket with messages
 */
router.get('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const { db, userId, userRole } = req as any;
    const { id } = req.params;
    
    const result = await supportTicketService.getTicketWithMessages(id, db);
    
    // Check access
    if (userRole !== 'admin' && userRole !== 'super_admin' && result.ticket.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Filter internal notes for non-admin users
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      result.messages = result.messages.filter(m => !m.is_internal);
    }
    
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    console.error('Error getting ticket:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

/**
 * Reply to a ticket
 */
router.post('/tickets/:id/reply', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId, userName, userRole, emailConfig } = req as any;
    const { id } = req.params;
    const { message, is_internal, new_status, new_priority, assign_to, attachments } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Check access
    const ticketResult = await db.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    const ticket = ticketResult.rows[0];
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    
    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await supportTicketService.replyToTicket({
      ticket_id: id,
      sender_id: userId,
      sender_name: userName,
      sender_type: isAdmin ? 'support' : 'user',
      message,
      is_internal: isAdmin ? is_internal : false,
      new_status: isAdmin ? new_status : undefined,
      new_priority: isAdmin ? new_priority : undefined,
      assign_to: isAdmin ? assign_to : undefined,
      attachments
    }, db, emailConfig);
    
    res.json({
      message: result.message,
      email_sent: result.emailResult?.success || false
    });
  } catch (error: any) {
    if (error.message.includes('closed')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error replying to ticket:', error);
    res.status(500).json({ error: 'Failed to reply to ticket' });
  }
});

/**
 * Resolve a ticket (admin only)
 */
router.post('/tickets/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { db, userId, userRole, emailConfig } = req as any;
    const { id } = req.params;
    const { resolution } = req.body;
    
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (!resolution) {
      return res.status(400).json({ error: 'Resolution message is required' });
    }
    
    const result = await supportTicketService.resolveTicket(id, userId, resolution, db, emailConfig);
    
    res.json({
      success: result.success,
      email_sent: result.emailResult?.success || false
    });
  } catch (error: any) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    console.error('Error resolving ticket:', error);
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

/**
 * Close a ticket (admin only)
 */
router.post('/tickets/:id/close', async (req: Request, res: Response) => {
  try {
    const { db, userId, userRole, emailConfig } = req as any;
    const { id } = req.params;
    const { reason } = req.body;
    
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await supportTicketService.closeTicket(id, userId, reason || 'Closed by admin', db, emailConfig);
    
    res.json({
      success: result.success,
      email_sent: result.emailResult?.success || false
    });
  } catch (error: any) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    console.error('Error closing ticket:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

/**
 * Update ticket (admin only) - change priority, assign, etc.
 */
router.patch('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const { db, userId, userRole } = req as any;
    const { id } = req.params;
    const { priority, assigned_to, status, category } = req.body;
    
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramCount = 0;
    
    if (priority) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
    }
    
    if (assigned_to !== undefined) {
      paramCount++;
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to || null);
    }
    
    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
      
      if (status === 'resolved') {
        updates.push('resolved_at = NOW()');
      } else if (status === 'closed') {
        updates.push('closed_at = NOW()');
      }
    }
    
    if (category) {
      paramCount++;
      updates.push(`category = $${paramCount}`);
      values.push(category);
    }
    
    if (updates.length === 1) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    paramCount++;
    values.push(id);
    
    await db.query(`
      UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${paramCount}
    `, values);
    
    res.json({ success: true, message: 'Ticket updated' });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

/**
 * Get ticket statistics (admin only)
 */
router.get('/tickets/stats/summary', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Get counts by status
    const statusResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM support_tickets
      WHERE tenant_id = $1
      GROUP BY status
    `, [tenantId]);
    
    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach((row: any) => {
      byStatus[row.status] = parseInt(row.count);
    });
    
    // Get counts by priority
    const priorityResult = await db.query(`
      SELECT priority, COUNT(*) as count
      FROM support_tickets
      WHERE tenant_id = $1 AND status NOT IN ('resolved', 'closed')
      GROUP BY priority
    `, [tenantId]);
    
    const byPriority: Record<string, number> = {};
    priorityResult.rows.forEach((row: any) => {
      byPriority[row.priority] = parseInt(row.count);
    });
    
    // Average response time
    const avgResponseResult = await db.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) as avg_hours
      FROM support_tickets
      WHERE tenant_id = $1 AND first_response_at IS NOT NULL
    `, [tenantId]);
    
    const avgResponseHours = avgResponseResult.rows[0]?.avg_hours 
      ? parseFloat(avgResponseResult.rows[0].avg_hours).toFixed(1) 
      : null;
    
    // Tickets created today
    const todayResult = await db.query(`
      SELECT COUNT(*) as count
      FROM support_tickets
      WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [tenantId]);
    
    // Unassigned tickets
    const unassignedResult = await db.query(`
      SELECT COUNT(*) as count
      FROM support_tickets
      WHERE tenant_id = $1 AND assigned_to IS NULL AND status NOT IN ('resolved', 'closed')
    `, [tenantId]);
    
    res.json({
      by_status: byStatus,
      by_priority: byPriority,
      avg_response_time_hours: avgResponseHours,
      tickets_today: parseInt(todayResult.rows[0].count),
      unassigned_count: parseInt(unassignedResult.rows[0].count),
      open_count: (byStatus['open'] || 0) + (byStatus['in_progress'] || 0) + 
                  (byStatus['waiting_for_customer'] || 0) + (byStatus['waiting_for_support'] || 0)
    });
  } catch (error) {
    console.error('Error getting ticket stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * Register support routes with Express app
 */
export function registerSupportRoutes(
  app: any, 
  combinedAuth: any, 
  requireAdminAuth: any
) {
  // Apply authentication middleware to all routes
  app.use('/api/support', combinedAuth, router);
  
  console.log('[Routes] Support ticket routes registered at /api/support');
}

// ============================================
// ENHANCED FEATURES - SLA, Auto-Assignment, AI
// ============================================

/**
 * GET /api/support/tickets/:id/sla
 * Get SLA status for a ticket
 */
router.get('/tickets/:id/sla', async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    
    const slaStatus = await getTicketSLAStatus(ticketId);
    
    res.json({
      success: true,
      data: slaStatus,
    });
  } catch (error) {
    console.error('[Support API] Get SLA status failed:', error);
    res.status(500).json({ error: 'Failed to get SLA status' });
  }
});

/**
 * GET /api/support/sla/metrics
 * Get SLA metrics for reporting (admin only)
 */
router.get('/sla/metrics', async (req: Request, res: Response) => {
  try {
    const { userRole, tenantId } = req as any;
    const { startDate, endDate } = req.query;
    
    if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'support_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const metrics = await getSLAMetrics(
      tenantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[Support API] Get SLA metrics failed:', error);
    res.status(500).json({ error: 'Failed to get SLA metrics' });
  }
});

/**
 * POST /api/support/sla/check
 * Trigger manual SLA check (admin only)
 */
router.post('/sla/check', async (req: Request, res: Response) => {
  try {
    const { userRole } = req as any;
    
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await runSLACheck();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Support API] SLA check failed:', error);
    res.status(500).json({ error: 'Failed to run SLA check' });
  }
});

/**
 * GET /api/support/agents/workload
 * Get agent workload statistics (manager/admin only)
 */
router.get('/agents/workload', async (req: Request, res: Response) => {
  try {
    const { userRole } = req as any;
    
    if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'support_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await getAgentWorkloadStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Support API] Get workload failed:', error);
    res.status(500).json({ error: 'Failed to get workload stats' });
  }
});

/**
 * GET /api/support/tickets/:id/assignment-recommendations
 * Get assignment recommendations for a ticket (manager/admin only)
 */
router.get('/tickets/:id/assignment-recommendations', async (req: Request, res: Response) => {
  try {
    const { userRole, tenantId } = req as any;
    const ticketId = parseInt(req.params.id, 10);
    
    if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'support_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // In production, fetch actual ticket first
    const recommendations = await getAssignmentRecommendations({
      id: ticketId,
      category: 'GENERAL_INQUIRY',
      priority: 'MEDIUM',
      tenantId: tenantId || 0,
      subject: 'Test',
      assignedAgentId: null,
    });
    
    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('[Support API] Get recommendations failed:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/**
 * POST /api/support/tickets/:id/auto-assign
 * Trigger auto-assignment for a ticket (manager/admin only)
 */
router.post('/tickets/:id/auto-assign', async (req: Request, res: Response) => {
  try {
    const { userRole, tenantId } = req as any;
    const ticketId = parseInt(req.params.id, 10);
    const { strategy } = req.body;
    
    if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'support_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // In production, fetch actual ticket first
    const result = await assignTicket({
      id: ticketId,
      category: 'GENERAL_INQUIRY',
      priority: 'MEDIUM',
      tenantId: tenantId || 0,
      subject: 'Ticket',
      assignedAgentId: null,
    }, { strategy });
    
    if (result.success) {
      publishEvent('ticket.updated', {
        ticketId,
        action: 'auto-assigned',
        agentId: result.agentId,
        agentName: result.agentName,
      }, { tenantId });
    }
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[Support API] Auto-assign failed:', error);
    res.status(500).json({ error: 'Failed to auto-assign ticket' });
  }
});

/**
 * POST /api/support/tickets/:id/ai-draft
 * Get AI-generated draft reply for a ticket
 * Returns draft for human review - NEVER auto-sends
 */
router.post('/tickets/:id/ai-draft', async (req: Request, res: Response) => {
  try {
    const { userRole, userId, db, tenantId } = req as any;
    const ticketId = req.params.id;

    // Only support staff can use AI drafts
    if (!['support_agent', 'support_manager', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const aiOrchestrator = createAIOrchestrator(db);
    const result = await aiOrchestrator.generateDraftReply({
      ticketId,
      requestedBy: userId,
      tenantId,
    });

    res.json({
      success: result.success,
      data: {
        draftReply: result.reply,
        confidenceScore: result.confidenceScore,
        confidenceLevel: result.confidenceLevel,
        actionDecision: result.actionDecision,
        requiresHumanApproval: result.requiresHumanApproval,
        suggestedActions: result.suggestedActions,
        knowledgeUsed: result.knowledgeUsed,
        // CRITICAL: This is a DRAFT - agent must review and send manually
        status: 'DRAFT_PENDING_APPROVAL',
        disclaimer: 'This is an AI-generated draft. Review carefully before sending.',
      },
    });
  } catch (error) {
    console.error('[Support API] AI draft failed:', error);
    res.status(500).json({ error: 'Failed to generate AI draft' });
  }
});

/**
 * POST /api/support/tickets/:id/escalate
 * Manually escalate a ticket (support staff only)
 */
router.post('/tickets/:id/escalate', async (req: Request, res: Response) => {
  try {
    const { userRole, userId, tenantId } = req as any;
    const ticketId = parseInt(req.params.id, 10);
    const { reason, escalateTo } = req.body;
    
    if (!['support_agent', 'support_manager', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // In production: Update escalation_level in database
    
    publishEvent('ticket.escalated', {
      ticketId,
      escalatedBy: userId,
      reason,
      escalateTo,
    }, { tenantId, userId });
    
    res.json({
      success: true,
      data: {
        id: ticketId,
        escalated: true,
        escalatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Support API] Escalate ticket failed:', error);
    res.status(500).json({ error: 'Failed to escalate ticket' });
  }
});

/**
 * GET /api/support/categories
 * Get available ticket categories with SaaS-focused options
 */
router.get('/categories', async (req: Request, res: Response) => {
  const categories = [
    { code: 'billing_payment', name: 'Billing & Payment', icon: 'credit-card', description: 'Invoice, payment issues, refunds' },
    { code: 'subscription_plan', name: 'Subscription & Plan', icon: 'package', description: 'Plan changes, upgrades, cancellations' },
    { code: 'technical_bug', name: 'Technical Issue / Bug', icon: 'bug', description: 'Errors, bugs, unexpected behavior' },
    { code: 'feature_request', name: 'Feature Request', icon: 'lightbulb', description: 'New feature suggestions' },
    { code: 'account_access', name: 'Account & Access', icon: 'user', description: 'Login, password, permissions' },
    { code: 'data_export', name: 'Data Export', icon: 'download', description: 'Export data, GDPR requests' },
    { code: 'integration_api', name: 'Integration & API', icon: 'plug', description: 'API access, webhooks, integrations' },
    { code: 'performance', name: 'Performance', icon: 'zap', description: 'Slow loading, timeouts' },
    { code: 'security', name: 'Security', icon: 'shield', description: 'Security concerns, 2FA' },
    { code: 'onboarding', name: 'Onboarding', icon: 'book-open', description: 'Setup help, getting started' },
    { code: 'general', name: 'General Inquiry', icon: 'help-circle', description: 'Other questions' },
  ];
  
  res.json({
    success: true,
    data: categories,
  });
});

/**
 * GET /api/support/priorities
 * Get available priorities with SLA targets
 */
router.get('/priorities', async (req: Request, res: Response) => {
  const priorities = [
    { code: 'low', name: 'Low', color: '#6B7280', slaFirstResponse: '8 hours', slaResolution: '48 hours' },
    { code: 'medium', name: 'Medium', color: '#3B82F6', slaFirstResponse: '4 hours', slaResolution: '24 hours' },
    { code: 'high', name: 'High', color: '#F59E0B', slaFirstResponse: '1 hour', slaResolution: '12 hours' },
    { code: 'urgent', name: 'Urgent', color: '#EF4444', slaFirstResponse: '15 minutes', slaResolution: '4 hours' },
  ];
  
  res.json({
    success: true,
    data: priorities,
  });
});

export default router;

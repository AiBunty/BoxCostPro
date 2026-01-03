/**
 * Audit Log API Routes
 * Query, filter, and export audit logs
 */

import { Router, Request, Response } from 'express';
import auditService from '../services/auditLogger';

const router = Router();

/**
 * Query audit logs with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    
    // Admin only
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { 
      action_types, entity_types, entity_id, user_id,
      from_date, to_date, search, ip_address,
      page, limit, sort_order 
    } = req.query;
    
    const filter: any = { tenant_id: tenantId };
    
    if (action_types) filter.action_types = (action_types as string).split(',');
    if (entity_types) filter.entity_types = (entity_types as string).split(',');
    if (entity_id) filter.entity_id = entity_id as string;
    if (user_id) filter.user_id = user_id as string;
    if (from_date) filter.from_date = new Date(from_date as string);
    if (to_date) filter.to_date = new Date(to_date as string);
    if (search) filter.search = search as string;
    if (ip_address) filter.ip_address = ip_address as string;
    
    const result = await auditService.queryAuditLogs(
      filter,
      {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        sort_order: (sort_order as 'asc' | 'desc') || 'desc'
      },
      db
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({ error: 'Failed to query audit logs' });
  }
});

/**
 * Get audit history for a specific entity
 */
router.get('/entity/:type/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    const { type, id } = req.params;
    
    // Admin only
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const history = await auditService.getEntityAuditHistory(
      type as any,
      id,
      tenantId,
      db
    );
    
    res.json({ history });
  } catch (error) {
    console.error('Error getting entity audit history:', error);
    res.status(500).json({ error: 'Failed to get audit history' });
  }
});

/**
 * Get audit statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    const { days } = req.query;
    
    // Admin only
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const stats = await auditService.getAuditStatistics(
      tenantId,
      days ? parseInt(days as string) : 30,
      db
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting audit statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * Export audit logs to CSV
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    
    // Admin only
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { 
      action_types, entity_types, from_date, to_date 
    } = req.query;
    
    const filter: any = { tenant_id: tenantId };
    
    if (action_types) filter.action_types = (action_types as string).split(',');
    if (entity_types) filter.entity_types = (entity_types as string).split(',');
    if (from_date) filter.from_date = new Date(from_date as string);
    if (to_date) filter.to_date = new Date(to_date as string);
    
    const csv = await auditService.exportAuditLogsToCSV(filter, db);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * Export audit logs to JSON
 */
router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userRole } = req as any;
    
    // Admin only
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { 
      action_types, entity_types, from_date, to_date 
    } = req.query;
    
    const filter: any = { tenant_id: tenantId };
    
    if (action_types) filter.action_types = (action_types as string).split(',');
    if (entity_types) filter.entity_types = (entity_types as string).split(',');
    if (from_date) filter.from_date = new Date(from_date as string);
    if (to_date) filter.to_date = new Date(to_date as string);
    
    const json = await auditService.exportAuditLogsToJSON(filter, db);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.json`);
    res.send(json);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * Get action types for filtering UI
 */
router.get('/action-types', async (req: Request, res: Response) => {
  const actionTypes = [
    // Authentication
    { value: 'user_login', label: 'User Login', category: 'Authentication' },
    { value: 'user_logout', label: 'User Logout', category: 'Authentication' },
    { value: 'login_failed', label: 'Login Failed', category: 'Authentication' },
    { value: 'password_changed', label: 'Password Changed', category: 'Authentication' },
    // User management
    { value: 'user_created', label: 'User Created', category: 'User Management' },
    { value: 'user_updated', label: 'User Updated', category: 'User Management' },
    { value: 'user_deleted', label: 'User Deleted', category: 'User Management' },
    { value: 'role_assigned', label: 'Role Assigned', category: 'User Management' },
    // Documents
    { value: 'quotation_created', label: 'Quotation Created', category: 'Documents' },
    { value: 'quotation_updated', label: 'Quotation Updated', category: 'Documents' },
    { value: 'quotation_sent', label: 'Quotation Sent', category: 'Documents' },
    { value: 'invoice_created', label: 'Invoice Created', category: 'Documents' },
    { value: 'invoice_updated', label: 'Invoice Updated', category: 'Documents' },
    { value: 'invoice_sent', label: 'Invoice Sent', category: 'Documents' },
    // Templates
    { value: 'template_created', label: 'Template Created', category: 'Templates' },
    { value: 'template_updated', label: 'Template Updated', category: 'Templates' },
    { value: 'template_deleted', label: 'Template Deleted', category: 'Templates' },
    // Costings
    { value: 'costing_created', label: 'Costing Created', category: 'Costings' },
    { value: 'costing_updated', label: 'Costing Updated', category: 'Costings' },
    { value: 'costing_deleted', label: 'Costing Deleted', category: 'Costings' },
    // Support
    { value: 'ticket_created', label: 'Ticket Created', category: 'Support' },
    { value: 'ticket_reply_added', label: 'Ticket Reply', category: 'Support' },
    { value: 'ticket_closed', label: 'Ticket Closed', category: 'Support' },
    // System
    { value: 'settings_updated', label: 'Settings Updated', category: 'System' },
    { value: 'data_export', label: 'Data Export', category: 'System' },
    { value: 'email_sent', label: 'Email Sent', category: 'System' }
  ];
  
  res.json({ action_types: actionTypes });
});

/**
 * Get entity types for filtering UI
 */
router.get('/entity-types', async (req: Request, res: Response) => {
  const entityTypes = [
    { value: 'user', label: 'User' },
    { value: 'quotation', label: 'Quotation' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'costing', label: 'Costing' },
    { value: 'party', label: 'Party' },
    { value: 'template', label: 'Template' },
    { value: 'support_ticket', label: 'Support Ticket' },
    { value: 'email', label: 'Email' },
    { value: 'settings', label: 'Settings' },
    { value: 'approval', label: 'Approval' }
  ];
  
  res.json({ entity_types: entityTypes });
});

/**
 * Register audit routes with Express app
 */
export function registerAuditRoutes(
  app: any, 
  combinedAuth: any, 
  requireAdminAuth: any
) {
  // Apply authentication middleware to all routes
  // Admin only - all routes already check userRole internally
  app.use('/api/audit', combinedAuth, router);
  
  console.log('[Routes] Audit log routes registered at /api/audit');
}

export default router;

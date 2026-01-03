/**
 * Audit Logging Service
 * Append-only, immutable audit logs for all system activities
 * With export capabilities and compliance features
 */

import { randomUUID } from 'crypto';

export type AuditActionType =
  // Authentication
  | 'user_login'
  | 'user_logout'
  | 'login_failed'
  | 'password_changed'
  | 'password_reset_requested'
  // User management
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'role_assigned'
  | 'role_removed'
  // Documents
  | 'quotation_created'
  | 'quotation_updated'
  | 'quotation_deleted'
  | 'quotation_sent'
  | 'quotation_accepted'
  | 'quotation_rejected'
  | 'invoice_created'
  | 'invoice_updated'
  | 'invoice_deleted'
  | 'invoice_sent'
  | 'invoice_paid'
  // Templates
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  // Costings
  | 'costing_created'
  | 'costing_updated'
  | 'costing_deleted'
  | 'costing_shared'
  // Parties
  | 'party_created'
  | 'party_updated'
  | 'party_deleted'
  // Support
  | 'ticket_created'
  | 'ticket_reply_added'
  | 'ticket_resolved'
  | 'ticket_closed'
  // Emails
  | 'email_sent'
  | 'email_failed'
  // System
  | 'settings_updated'
  | 'export_requested'
  | 'data_export'
  | 'data_import'
  // Approvals
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected';

export type EntityType =
  | 'user'
  | 'quotation'
  | 'invoice'
  | 'costing'
  | 'party'
  | 'template'
  | 'support_ticket'
  | 'email'
  | 'settings'
  | 'approval'
  | 'subscription'
  | 'payment';

export interface AuditLogEntry {
  id: string;
  action_type: AuditActionType;
  entity_type: EntityType;
  entity_id: string;
  tenant_id: string;
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface AuditLogFilter {
  tenant_id: string;
  action_types?: AuditActionType[];
  entity_types?: EntityType[];
  entity_id?: string;
  user_id?: string;
  from_date?: Date;
  to_date?: Date;
  search?: string;
  ip_address?: string;
}

export interface AuditLogPagination {
  page?: number;
  limit?: number;
  sort_order?: 'asc' | 'desc';
}

/**
 * Create an audit log entry
 * This is append-only - entries cannot be modified or deleted
 */
export async function createAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'created_at'>,
  db: any
): Promise<AuditLogEntry> {
  const id = randomUUID();
  const created_at = new Date();
  
  await db.query(`
    INSERT INTO system_audit_logs (
      id, action_type, entity_type, entity_id,
      tenant_id, user_id, changes, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
  `, [
    id,
    entry.action_type,
    entry.entity_type,
    entry.entity_id,
    entry.tenant_id,
    entry.user_id,
    JSON.stringify({
      old_values: entry.old_values,
      new_values: entry.new_values,
      changes: entry.changes,
      metadata: entry.metadata,
      user_email: entry.user_email,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent
    }),
    created_at
  ]);
  
  return {
    ...entry,
    id,
    created_at
  };
}

/**
 * Query audit logs with filtering and pagination
 */
export async function queryAuditLogs(
  filter: AuditLogFilter,
  pagination: AuditLogPagination,
  db: any
): Promise<{ logs: AuditLogEntry[]; total: number; page: number; limit: number }> {
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 50, 500);
  const offset = (page - 1) * limit;
  const sortOrder = pagination.sort_order || 'desc';
  
  let whereClause = 'WHERE tenant_id = $1';
  const params: any[] = [filter.tenant_id];
  let paramCount = 1;
  
  if (filter.action_types && filter.action_types.length > 0) {
    paramCount++;
    whereClause += ` AND action_type = ANY($${paramCount})`;
    params.push(filter.action_types);
  }
  
  if (filter.entity_types && filter.entity_types.length > 0) {
    paramCount++;
    whereClause += ` AND entity_type = ANY($${paramCount})`;
    params.push(filter.entity_types);
  }
  
  if (filter.entity_id) {
    paramCount++;
    whereClause += ` AND entity_id = $${paramCount}`;
    params.push(filter.entity_id);
  }
  
  if (filter.user_id) {
    paramCount++;
    whereClause += ` AND user_id = $${paramCount}`;
    params.push(filter.user_id);
  }
  
  if (filter.from_date) {
    paramCount++;
    whereClause += ` AND created_at >= $${paramCount}`;
    params.push(filter.from_date);
  }
  
  if (filter.to_date) {
    paramCount++;
    whereClause += ` AND created_at <= $${paramCount}`;
    params.push(filter.to_date);
  }
  
  if (filter.search) {
    paramCount++;
    whereClause += ` AND (
      action_type ILIKE $${paramCount} OR 
      entity_type ILIKE $${paramCount} OR 
      entity_id ILIKE $${paramCount} OR
      changes::text ILIKE $${paramCount}
    )`;
    params.push(`%${filter.search}%`);
  }
  
  if (filter.ip_address) {
    paramCount++;
    whereClause += ` AND changes->>'ip_address' = $${paramCount}`;
    params.push(filter.ip_address);
  }
  
  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM system_audit_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);
  
  // Get logs
  const logsResult = await db.query(`
    SELECT * FROM system_audit_logs 
    ${whereClause}
    ORDER BY created_at ${sortOrder}
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `, [...params, limit, offset]);
  
  // Parse the logs
  const logs = logsResult.rows.map((row: any) => {
    const changes = row.changes || {};
    return {
      id: row.id,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      user_email: changes.user_email,
      ip_address: changes.ip_address,
      user_agent: changes.user_agent,
      old_values: changes.old_values,
      new_values: changes.new_values,
      changes: changes.changes,
      metadata: changes.metadata,
      created_at: row.created_at
    };
  });
  
  return { logs, total, page, limit };
}

/**
 * Get audit log for a specific entity
 */
export async function getEntityAuditHistory(
  entityType: EntityType,
  entityId: string,
  tenantId: string,
  db: any
): Promise<AuditLogEntry[]> {
  const result = await db.query(`
    SELECT * FROM system_audit_logs
    WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
    ORDER BY created_at ASC
  `, [entityType, entityId, tenantId]);
  
  return result.rows.map((row: any) => {
    const changes = row.changes || {};
    return {
      id: row.id,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      user_email: changes.user_email,
      ip_address: changes.ip_address,
      user_agent: changes.user_agent,
      old_values: changes.old_values,
      new_values: changes.new_values,
      changes: changes.changes,
      metadata: changes.metadata,
      created_at: row.created_at
    };
  });
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogsToCSV(
  filter: AuditLogFilter,
  db: any
): Promise<string> {
  const { logs } = await queryAuditLogs(filter, { limit: 10000 }, db);
  
  const headers = [
    'ID',
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'User ID',
    'User Email',
    'IP Address',
    'Changes'
  ];
  
  const rows = logs.map(log => [
    log.id,
    log.created_at.toISOString(),
    log.action_type,
    log.entity_type,
    log.entity_id,
    log.user_id || '',
    log.user_email || '',
    log.ip_address || '',
    JSON.stringify(log.changes || {}).replace(/"/g, '""')
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Log the export action
  await createAuditLog({
    action_type: 'data_export',
    entity_type: 'settings',
    entity_id: 'audit_logs',
    tenant_id: filter.tenant_id,
    metadata: {
      export_type: 'csv',
      record_count: logs.length,
      filter_applied: filter
    }
  }, db);
  
  return csvContent;
}

/**
 * Export audit logs to JSON format
 */
export async function exportAuditLogsToJSON(
  filter: AuditLogFilter,
  db: any
): Promise<string> {
  const { logs } = await queryAuditLogs(filter, { limit: 10000 }, db);
  
  // Log the export action
  await createAuditLog({
    action_type: 'data_export',
    entity_type: 'settings',
    entity_id: 'audit_logs',
    tenant_id: filter.tenant_id,
    metadata: {
      export_type: 'json',
      record_count: logs.length,
      filter_applied: filter
    }
  }, db);
  
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    tenant_id: filter.tenant_id,
    filter_applied: filter,
    total_records: logs.length,
    logs
  }, null, 2);
}

/**
 * Get audit statistics for dashboard
 */
export async function getAuditStatistics(
  tenantId: string,
  days: number,
  db: any
): Promise<{
  total_actions: number;
  actions_by_type: Record<string, number>;
  actions_by_user: Array<{ user_id: string; count: number }>;
  actions_by_day: Array<{ date: string; count: number }>;
  top_entities: Array<{ entity_type: string; entity_id: string; count: number }>;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  // Total actions
  const totalResult = await db.query(`
    SELECT COUNT(*) as count FROM system_audit_logs
    WHERE tenant_id = $1 AND created_at >= $2
  `, [tenantId, fromDate]);
  
  const total_actions = parseInt(totalResult.rows[0].count);
  
  // Actions by type
  const byTypeResult = await db.query(`
    SELECT action_type, COUNT(*) as count 
    FROM system_audit_logs
    WHERE tenant_id = $1 AND created_at >= $2
    GROUP BY action_type
    ORDER BY count DESC
  `, [tenantId, fromDate]);
  
  const actions_by_type: Record<string, number> = {};
  byTypeResult.rows.forEach((row: any) => {
    actions_by_type[row.action_type] = parseInt(row.count);
  });
  
  // Actions by user
  const byUserResult = await db.query(`
    SELECT user_id, COUNT(*) as count 
    FROM system_audit_logs
    WHERE tenant_id = $1 AND created_at >= $2 AND user_id IS NOT NULL
    GROUP BY user_id
    ORDER BY count DESC
    LIMIT 10
  `, [tenantId, fromDate]);
  
  const actions_by_user = byUserResult.rows.map((row: any) => ({
    user_id: row.user_id,
    count: parseInt(row.count)
  }));
  
  // Actions by day
  const byDayResult = await db.query(`
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM system_audit_logs
    WHERE tenant_id = $1 AND created_at >= $2
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [tenantId, fromDate]);
  
  const actions_by_day = byDayResult.rows.map((row: any) => ({
    date: row.date.toISOString().split('T')[0],
    count: parseInt(row.count)
  }));
  
  // Top entities
  const topEntitiesResult = await db.query(`
    SELECT entity_type, entity_id, COUNT(*) as count 
    FROM system_audit_logs
    WHERE tenant_id = $1 AND created_at >= $2
    GROUP BY entity_type, entity_id
    ORDER BY count DESC
    LIMIT 10
  `, [tenantId, fromDate]);
  
  const top_entities = topEntitiesResult.rows.map((row: any) => ({
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    count: parseInt(row.count)
  }));
  
  return {
    total_actions,
    actions_by_type,
    actions_by_user,
    actions_by_day,
    top_entities
  };
}

// ============================================
// Convenience functions for common audit events
// ============================================

export function logUserLogin(
  userId: string,
  userEmail: string,
  tenantId: string,
  ipAddress: string,
  userAgent: string,
  db: any
): Promise<AuditLogEntry> {
  return createAuditLog({
    action_type: 'user_login',
    entity_type: 'user',
    entity_id: userId,
    tenant_id: tenantId,
    user_id: userId,
    user_email: userEmail,
    ip_address: ipAddress,
    user_agent: userAgent
  }, db);
}

export function logEntityCreated(
  entityType: EntityType,
  entityId: string,
  tenantId: string,
  userId: string,
  newValues: Record<string, any>,
  db: any
): Promise<AuditLogEntry> {
  const actionMap: Record<EntityType, AuditActionType> = {
    user: 'user_created',
    quotation: 'quotation_created',
    invoice: 'invoice_created',
    costing: 'costing_created',
    party: 'party_created',
    template: 'template_created',
    support_ticket: 'ticket_created',
    email: 'email_sent',
    settings: 'settings_updated',
    approval: 'approval_requested',
    subscription: 'user_created',
    payment: 'invoice_paid'
  };
  
  return createAuditLog({
    action_type: actionMap[entityType],
    entity_type: entityType,
    entity_id: entityId,
    tenant_id: tenantId,
    user_id: userId,
    new_values: newValues
  }, db);
}

export function logEntityUpdated(
  entityType: EntityType,
  entityId: string,
  tenantId: string,
  userId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  db: any
): Promise<AuditLogEntry> {
  const actionMap: Record<EntityType, AuditActionType> = {
    user: 'user_updated',
    quotation: 'quotation_updated',
    invoice: 'invoice_updated',
    costing: 'costing_updated',
    party: 'party_updated',
    template: 'template_updated',
    support_ticket: 'ticket_reply_added',
    email: 'email_sent',
    settings: 'settings_updated',
    approval: 'approval_granted',
    subscription: 'user_updated',
    payment: 'invoice_paid'
  };
  
  // Calculate diff
  const changes: Record<string, { from: any; to: any }> = {};
  for (const key of Object.keys(newValues)) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changes[key] = { from: oldValues[key], to: newValues[key] };
    }
  }
  
  return createAuditLog({
    action_type: actionMap[entityType],
    entity_type: entityType,
    entity_id: entityId,
    tenant_id: tenantId,
    user_id: userId,
    old_values: oldValues,
    new_values: newValues,
    changes
  }, db);
}

export function logEntityDeleted(
  entityType: EntityType,
  entityId: string,
  tenantId: string,
  userId: string,
  deletedValues: Record<string, any>,
  db: any
): Promise<AuditLogEntry> {
  const actionMap: Record<EntityType, AuditActionType> = {
    user: 'user_deleted',
    quotation: 'quotation_deleted',
    invoice: 'invoice_deleted',
    costing: 'costing_deleted',
    party: 'party_deleted',
    template: 'template_deleted',
    support_ticket: 'ticket_closed',
    email: 'email_failed',
    settings: 'settings_updated',
    approval: 'approval_rejected',
    subscription: 'user_deleted',
    payment: 'invoice_deleted'
  };
  
  return createAuditLog({
    action_type: actionMap[entityType],
    entity_type: entityType,
    entity_id: entityId,
    tenant_id: tenantId,
    user_id: userId,
    old_values: deletedValues
  }, db);
}

export default {
  createAuditLog,
  queryAuditLogs,
  getEntityAuditHistory,
  exportAuditLogsToCSV,
  exportAuditLogsToJSON,
  getAuditStatistics,
  logUserLogin,
  logEntityCreated,
  logEntityUpdated,
  logEntityDeleted
};

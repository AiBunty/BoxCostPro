import { storage } from "../storage";
import type { InsertAdminAuditLog } from "@shared/schema";

/**
 * Admin Audit Service
 * 
 * Handles all admin action logging for compliance, security, and audit purposes.
 * Logs are immutable and fire-and-forget async.
 */

/**
 * Log an admin action asynchronously (non-blocking)
 */
export async function logAdminAuditAsync(log: Omit<InsertAdminAuditLog, 'createdAt'>): Promise<void> {
  try {
    // Fire and forget - don't block the main request
    void storage.createAdminAuditLog(log);
  } catch (error) {
    console.error("[adminAuditService] Failed to log audit:", error);
    // Don't throw - audit logging should not crash the main operation
  }
}

/**
 * Log an admin action synchronously (blocking - use sparingly for critical operations)
 */
export async function logAdminAudit(log: Omit<InsertAdminAuditLog, 'createdAt'>): Promise<string> {
  try {
    const auditLog = await storage.createAdminAuditLog(log);
    return auditLog.id;
  } catch (error) {
    console.error("[adminAuditService] Failed to log audit:", error);
    throw new Error("Failed to record audit log");
  }
}

/**
 * Audit context helpers
 */

export function getBeforeState(data: any): Record<string, any> {
  return data;
}

export function getAfterState(data: any): Record<string, any> {
  return data;
}

/**
 * Template: Staff management
 */
export async function logStaffCreated(
  actorStaffId: string,
  actorRole: string,
  newStaffId: string,
  newStaffData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'create_staff',
    entityType: 'staff',
    entityId: newStaffId,
    beforeState: null,
    afterState: newStaffData,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logStaffDisabled(
  actorStaffId: string,
  actorRole: string,
  targetStaffId: string,
  beforeState: any,
  afterState: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'disable_staff',
    entityType: 'staff',
    entityId: targetStaffId,
    beforeState,
    afterState,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Template: Ticket management
 */
export async function logTicketCreated(
  actorStaffId: string,
  actorRole: string,
  ticketId: string,
  ticketData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'create_ticket',
    entityType: 'ticket',
    entityId: ticketId,
    beforeState: null,
    afterState: ticketData,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logTicketAssigned(
  actorStaffId: string,
  actorRole: string,
  ticketId: string,
  beforeState: any,
  afterState: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'assign_ticket',
    entityType: 'ticket',
    entityId: ticketId,
    beforeState,
    afterState,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logTicketResolved(
  actorStaffId: string,
  actorRole: string,
  ticketId: string,
  beforeState: any,
  afterState: any,
  resolutionTime: number, // in hours
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'resolve_ticket',
    entityType: 'ticket',
    entityId: ticketId,
    beforeState,
    afterState: { ...afterState, resolutionTime },
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Template: Coupon management
 */
export async function logCouponCreated(
  actorStaffId: string,
  actorRole: string,
  couponId: string,
  couponData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'create_coupon',
    entityType: 'coupon',
    entityId: couponId,
    beforeState: null,
    afterState: couponData,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logCouponAssigned(
  actorStaffId: string,
  actorRole: string,
  couponId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'assign_coupon',
    entityType: 'coupon',
    entityId: couponId,
    beforeState: null,
    afterState: { userId },
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Template: Finance/Invoice management
 */
export async function logInvoiceCreated(
  actorStaffId: string,
  actorRole: string,
  invoiceId: string,
  invoiceData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'create_invoice',
    entityType: 'invoice',
    entityId: invoiceId,
    beforeState: null,
    afterState: invoiceData,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logCreditNoteCreated(
  actorStaffId: string,
  actorRole: string,
  creditNoteId: string,
  creditNoteData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'create_credit_note',
    entityType: 'credit_note',
    entityId: creditNoteId,
    beforeState: null,
    afterState: creditNoteData,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

export async function logRefundProcessed(
  actorStaffId: string,
  actorRole: string,
  paymentId: string,
  refundAmount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'process_refund',
    entityType: 'payment',
    entityId: paymentId,
    beforeState: null,
    afterState: { refundAmount },
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Template: Configuration & System
 */
export async function logGatewayConfigured(
  actorStaffId: string,
  actorRole: string,
  gateway: string,
  beforeState: any,
  afterState: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action: 'configure_payment_gateways',
    entityType: 'gateway',
    entityId: gateway,
    beforeState,
    afterState,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Template: Error logging
 */
export async function logAuditError(
  actorStaffId: string,
  actorRole: string,
  action: string,
  entityType: string,
  entityId: string | null,
  failureReason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAdminAuditAsync({
    actorStaffId,
    actorRole,
    action,
    entityType,
    entityId,
    beforeState: null,
    afterState: null,
    status: 'failed',
    failureReason,
    ipAddress,
    userAgent,
  });
}

/**
 * Retrieve audit logs with filtering
 */
export async function getAuditLogs(filters: {
  staffId?: string;
  role?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  return storage.getAdminAuditLogs(filters);
}

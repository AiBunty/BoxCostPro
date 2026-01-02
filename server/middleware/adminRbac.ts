import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { AdminRole } from "@shared/schema";

/**
 * ENTERPRISE ADMIN RBAC SYSTEM
 * 
 * Enforces strict role-based access control for admin operations.
 * All permission checks are SERVER-SIDE ENFORCED.
 */

// Permission Matrix: Role -> Actions allowed
const PERMISSION_MATRIX: Record<AdminRole, Set<string>> = {
  SUPER_ADMIN: new Set([
    // Staff management
    'create_staff',
    'list_staff',
    'disable_staff',
    'view_staff_activity',
    'reset_staff_password',
    
    // Support tickets (full access)
    'create_ticket',
    'list_tickets',
    'assign_ticket',
    'resolve_ticket',
    'close_ticket',
    'add_ticket_note',
    'view_all_tickets',
    
    // Coupons (full access)
    'create_coupon',
    'list_coupons',
    'assign_coupon',
    'approve_coupon',
    'override_coupon',
    'delete_coupon',
    
    // Finance & Invoices
    'view_payments',
    'create_invoice',
    'finalize_invoice',
    'create_credit_note',
    'process_refund',
    'export_gst',
    
    // Configuration
    'configure_payment_gateways',
    'configure_roles',
    'view_audit_logs',
    'export_audit_logs',
    
    // Analytics
    'view_staff_analytics',
    'view_ticket_analytics',
    'view_coupon_analytics',
    'view_revenue_analytics',
    'export_analytics',
  ]),

  SUPPORT_STAFF: new Set([
    // Support tickets only
    'create_ticket',
    'list_tickets',
    'view_assigned_tickets',
    'resolve_ticket',
    'close_ticket',
    'add_ticket_note',
    
    // View-only access to customer data
    'view_user_profile',
    'view_user_subscriptions',
    'view_user_payments_readonly',
    'view_user_invoices_readonly',
    
    // Limited permissions on own metrics
    'view_own_metrics',
  ]),

  SUPPORT_VIEWER: new Set([
    // Read-only support access
    'list_tickets',
    'view_ticket_details',
    'view_assigned_tickets',
    
    // Read-only customer data
    'view_user_profile',
    'view_user_subscriptions',
    'view_user_payments_readonly',
    'view_user_invoices_readonly',
    
    // Own metrics only
    'view_own_metrics',
  ]),

  MARKETING_STAFF: new Set([
    // Coupon operations (with limits enforced)
    'create_coupon',
    'list_coupons',
    'assign_coupon_to_user',
    'assign_coupon_to_business',
    'view_coupon_performance',
    
    // Own metrics
    'view_own_metrics',
  ]),

  FINANCE_ADMIN: new Set([
    // Financial operations (read + write)
    'view_payments',
    'list_payments',
    'view_invoices',
    'list_invoices',
    'create_invoice',
    'finalize_invoice',
    'create_credit_note',
    'process_refund',
    'export_gst',
    'view_gst_reports',
    
    // Limited view of tickets and users
    'view_user_profile',
    'view_user_subscriptions',
  ]),
};

/**
 * Check if a staff member has permission for an action
 * @param role The admin role
 * @param action The action attempting to be performed
 * @returns true if permitted, false otherwise
 */
export function hasPermission(role: AdminRole, action: string): boolean {
  const permissions = PERMISSION_MATRIX[role];
  if (!permissions) {
    return false;
  }
  return permissions.has(action);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: AdminRole): string[] {
  const permissions = PERMISSION_MATRIX[role];
  return permissions ? Array.from(permissions) : [];
}

/**
 * Middleware: Verify authenticated admin and attach staff info to request
 */
export const verifyAdminAuth = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get user ID from Clerk auth
    const userId = req.userId || req.user?.claims?.sub;
    
    if (!userId) {
      res.status(401).json({ message: "Unauthorized: No user" });
      return;
    }

    // Fetch staff record for this user
    const staffMember = await storage.getStaffByUserId(userId);
    
    if (!staffMember) {
      res.status(403).json({ message: "Forbidden: Not an admin staff member" });
      return;
    }

    if (staffMember.status !== 'active') {
      res.status(403).json({ message: "Forbidden: Staff account disabled" });
      return;
    }

    // Attach to request
    req.staffId = staffMember.id;
    req.staffRole = staffMember.role;
    req.staff = staffMember;

    next();
  } catch (error) {
    console.error("[adminRbac] verifyAdminAuth error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware: Enforce permission for an action
 */
export const enforcePermission = (action: string) => {
  return async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.staffRole as AdminRole;
      
      if (!role) {
        res.status(401).json({ message: "Unauthorized: Staff not verified" });
        return;
      }

      if (!hasPermission(role, action)) {
        // Log the unauthorized attempt (dynamically require to avoid circular dependency)
        const { logAdminAuditAsync } = await import("../services/adminAuditService");
        await logAdminAuditAsync({
          actorStaffId: req.staffId,
          actorRole: role,
          action,
          entityType: 'permission_denied',
          status: 'failed',
          failureReason: `Role ${role} does not have permission for action: ${action}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.status(403).json({ 
          message: `Forbidden: Role ${role} does not have permission for this action` 
        });
        return;
      }

      next();
    } catch (error) {
      console.error("[adminRbac] enforcePermission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

/**
 * Middleware: Require specific role(s)
 */
export const requireRole = (...roles: AdminRole[]) => {
  return async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.staffRole as AdminRole;
      
      if (!role) {
        res.status(401).json({ message: "Unauthorized: Staff not verified" });
        return;
      }

      if (!roles.includes(role)) {
        res.status(403).json({ 
          message: `Forbidden: Requires one of roles: ${roles.join(', ')}` 
        });
        return;
      }

      next();
    } catch (error) {
      console.error("[adminRbac] requireRole error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

/**
 * Helper: Check if staff can view this staff member's data
 */
export async function canViewStaff(viewerStaffId: string, targetStaffId: string): Promise<boolean> {
  const viewerStaff = await storage.getStaff(viewerStaffId);
  
  // SUPER_ADMIN can view all
  if (viewerStaff?.role === 'SUPER_ADMIN') {
    return true;
  }

  // Others can only view themselves
  return viewerStaffId === targetStaffId;
}

/**
 * Helper: Check if staff can modify coupon (create/assign)
 * MARKETING_STAFF have limits; SUPER_ADMIN and FINANCE_ADMIN can override
 */
export function canCreateCoupon(role: AdminRole): boolean {
  return ['SUPER_ADMIN', 'MARKETING_STAFF', 'FINANCE_ADMIN'].includes(role);
}

/**
 * Helper: Check coupon creation limits for MARKETING_STAFF
 * @returns { maxDiscountPercent, maxUsageCount, maxExpiryDays }
 */
export function getCouponLimits(role: AdminRole): { maxDiscountPercent: number; maxUsageCount: number; maxExpiryDays: number } | null {
  if (role === 'MARKETING_STAFF') {
    return {
      maxDiscountPercent: 30, // Max 30% discount
      maxUsageCount: 100, // Max 100 uses
      maxExpiryDays: 90, // Max 90 days expiry
    };
  }

  // SUPER_ADMIN and others have no limits
  return null;
}

/**
 * Helper: Check if coupon violates MARKETING_STAFF limits
 */
export function validateCouponLimits(
  role: AdminRole,
  discountPercent: number,
  usageLimit: number,
  expiryDays: number
): { valid: boolean; error?: string } {
  if (role !== 'MARKETING_STAFF') {
    return { valid: true };
  }

  const limits = getCouponLimits(role);
  if (!limits) {
    return { valid: true };
  }

  if (discountPercent > limits.maxDiscountPercent) {
    return {
      valid: false,
      error: `Discount cannot exceed ${limits.maxDiscountPercent}% for Marketing Staff`,
    };
  }

  if (usageLimit > limits.maxUsageCount) {
    return {
      valid: false,
      error: `Usage limit cannot exceed ${limits.maxUsageCount} for Marketing Staff`,
    };
  }

  if (expiryDays > limits.maxExpiryDays) {
    return {
      valid: false,
      error: `Expiry cannot exceed ${limits.maxExpiryDays} days for Marketing Staff`,
    };
  }

  return { valid: true };
}

/**
 * Helper: Check if staff can view financial records
 */
export function canViewFinance(role: AdminRole): boolean {
  return ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role);
}

/**
 * Helper: Check if staff can view support tickets
 */
export function canViewTickets(role: AdminRole): boolean {
  return ['SUPER_ADMIN', 'SUPPORT_STAFF'].includes(role);
}

/**
 * Helper: Check if staff can view analytics
 */
export function canViewAnalytics(role: AdminRole): boolean {
  return role === 'SUPER_ADMIN';
}

/**
 * Helper: Check if staff can export data
 */
export function canExportData(role: AdminRole): boolean {
  return role === 'SUPER_ADMIN';
}

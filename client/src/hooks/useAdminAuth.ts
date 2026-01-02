import { useQuery } from "@tanstack/react-query";

// Admin roles that grant access to admin panel
const ADMIN_ROLES = ['admin', 'super_admin', 'support_manager', 'owner'] as const;
type AdminRole = typeof ADMIN_ROLES[number];

// Map database roles to permission sets
const ROLE_TO_PERMISSION_ROLE: Record<string, string> = {
  'super_admin': 'SUPER_ADMIN',
  'admin': 'SUPER_ADMIN',
  'owner': 'SUPER_ADMIN',
  'support_manager': 'SUPPORT_STAFF',
  'support_agent': 'SUPPORT_STAFF',
};

// Permission matrix matching backend
const PERMISSION_MATRIX: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set([
    "create_staff",
    "list_staff",
    "disable_staff",
    "create_ticket",
    "list_tickets",
    "view_all_tickets",
    "assign_ticket",
    "resolve_ticket",
    "add_ticket_note",
    "create_coupon",
    "list_coupons",
    "assign_coupon_to_user",
    "view_staff_analytics",
    "view_ticket_analytics",
    "view_coupon_analytics",
    "view_revenue_analytics",
    "view_audit_logs",
    "export_analytics",
    "export_audit_logs",
    "export_staff_analytics",
    "export_ticket_analytics",
    "export_coupon_analytics",
  ]),
  SUPPORT_STAFF: new Set([
    "create_ticket",
    "list_tickets",
    "view_all_tickets",
    "assign_ticket",
    "resolve_ticket",
    "add_ticket_note",
  ]),
  MARKETING_STAFF: new Set([
    "create_coupon",
    "list_coupons",
    "assign_coupon_to_user",
    "view_staff_analytics",
  ]),
  FINANCE_ADMIN: new Set([
    "view_staff_analytics",
    "view_revenue_analytics",
    "view_ticket_analytics",
    "view_audit_logs",
  ]),
};

/**
 * Hook for admin-specific authentication and permissions
 * Uses /api/auth/user endpoint (same as AdminRoleGuard)
 */
export function useAdminAuth() {
  // Use the same endpoint as AdminRoleGuard for consistency
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Map user.role to permission role
  const userRole = user?.role as string | undefined;
  const permissionRole = userRole ? ROLE_TO_PERMISSION_ROLE[userRole] : undefined;
  const isAdmin = ADMIN_ROLES.includes(userRole as AdminRole);
  const staffId = user?.id;

  /**
   * Check if user has permission for an action
   */
  const hasPermission = (action: string): boolean => {
    if (!permissionRole) return false;
    return PERMISSION_MATRIX[permissionRole]?.has(action) ?? false;
  };

  /**
   * Get all permissions for current role
   */
  const getPermissions = (): Set<string> => {
    if (!permissionRole) return new Set();
    return PERMISSION_MATRIX[permissionRole] ?? new Set();
  };

  /**
   * Assert user has permission, throw if not
   */
  const assertPermission = (action: string): void => {
    if (!hasPermission(action)) {
      throw new Error(`Unauthorized: ${action}`);
    }
  };

  /**
   * Get coupon creation limits for role
   */
  const getCouponLimits = () => {
    switch (permissionRole) {
      case "SUPER_ADMIN":
        return { maxDiscountPercent: 100, maxUsageCount: Infinity, maxExpiryDays: Infinity };
      case "MARKETING_STAFF":
        return { maxDiscountPercent: 30, maxUsageCount: 100, maxExpiryDays: 90 };
      default:
        return { maxDiscountPercent: 0, maxUsageCount: 0, maxExpiryDays: 0 };
    }
  };

  /**
   * Check if role can manage other staff
   */
  const canManageStaff = (): boolean => permissionRole === "SUPER_ADMIN";

  /**
   * Check if role can manage tickets
   */
  const canManageTickets = (): boolean =>
    permissionRole === "SUPER_ADMIN" || permissionRole === "SUPPORT_STAFF";

  /**
   * Check if role can manage coupons
   */
  const canManageCoupons = (): boolean =>
    permissionRole === "SUPER_ADMIN" || permissionRole === "MARKETING_STAFF";

  /**
   * Check if role can view analytics
   */
  const canViewAnalytics = (): boolean => !!permissionRole;

  /**
   * Check if role can view revenue data
   */
  const canViewRevenue = (): boolean =>
    permissionRole === "SUPER_ADMIN" || permissionRole === "FINANCE_ADMIN";

  /**
   * Check if role can view audit logs
   */
  const canViewAuditLogs = (): boolean =>
    permissionRole === "SUPER_ADMIN" || permissionRole === "FINANCE_ADMIN";

  return {
    // State
    isAdmin,
    isLoading,
    error,
    adminUser: user,
    role: permissionRole,
    staffId,

    // Permission checks
    hasPermission,
    getPermissions,
    assertPermission,

    // Role-specific checks
    canManageStaff,
    canManageTickets,
    canManageCoupons,
    canViewAnalytics,
    canViewRevenue,
    canViewAuditLogs,

    // Limits
    getCouponLimits,
  };
}

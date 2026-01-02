/**
 * RBAC (Role-Based Access Control) Constants
 * 
 * ⚠️ SINGLE SOURCE OF TRUTH for all role definitions
 * 
 * DO NOT hardcode role strings elsewhere in the codebase.
 * Always import from this file.
 * 
 * Last Updated: December 31, 2025
 */

// ============================================
// USER-LEVEL ROLES (User Panel)
// ============================================
export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  SUPPORT_AGENT: 'support_agent',
  SUPPORT_MANAGER: 'support_manager',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// ============================================
// ADMIN PANEL ROLES (Admin Panel Only)
// ============================================
export const AdminRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SUPPORT_STAFF: 'SUPPORT_STAFF',
  SUPPORT_VIEWER: 'SUPPORT_VIEWER',
  MARKETING_STAFF: 'MARKETING_STAFF',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
} as const;

export type AdminRoleType = typeof AdminRole[keyof typeof AdminRole];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has admin-level access (User Panel)
 * @param role - User's role from users.role column
 */
export function isAdmin(role?: string | null): boolean {
  if (!role) return false;
  return [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
  ].includes(role as any);
}

/**
 * Check if user has super admin access (User Panel)
 * @param role - User's role from users.role column
 */
export function isSuperAdmin(role?: string | null): boolean {
  if (!role) return false;
  return [
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
  ].includes(role as any);
}

/**
 * Check if user has owner-level access (highest privilege)
 * @param role - User's role from users.role column
 */
export function isOwner(role?: string | null): boolean {
  return role === UserRole.OWNER;
}

/**
 * Check if user has support staff access
 * @param role - User's role from users.role column
 */
export function isSupportStaff(role?: string | null): boolean {
  if (!role) return false;
  return [
    UserRole.SUPPORT_AGENT,
    UserRole.SUPPORT_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
  ].includes(role as any);
}

/**
 * Check if user is regular user (no special permissions)
 * @param role - User's role from users.role column
 */
export function isRegularUser(role?: string | null): boolean {
  return role === UserRole.USER;
}

/**
 * Check if user can manage other users
 * @param role - User's role from users.role column
 */
export function canManageUsers(role?: string | null): boolean {
  return isSuperAdmin(role);
}

/**
 * Check if user can view admin panel
 * @param role - User's role from users.role column
 */
export function canAccessAdminPanel(role?: string | null): boolean {
  return isAdmin(role);
}

// ============================================
// ADMIN PANEL PERMISSIONS
// ============================================

export const AdminPermission = {
  // User Management
  VIEW_USERS: 'view_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  
  // Tickets
  VIEW_TICKETS: 'view_tickets',
  CREATE_TICKETS: 'create_tickets',
  EDIT_TICKETS: 'edit_tickets',
  DELETE_TICKETS: 'delete_tickets',
  
  // Financial
  VIEW_PAYMENTS: 'view_payments',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  MANAGE_COUPONS: 'manage_coupons',
  
  // Settings
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_STAFF: 'manage_staff',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
} as const;

/**
 * Check if admin role has specific permission
 * @param adminRole - User's admin role from users.admin_role column
 * @param permission - Permission to check
 */
export function hasAdminPermission(adminRole: string, permission: string): boolean {
  const permissions: Record<string, Set<string>> = {
    [AdminRole.SUPER_ADMIN]: new Set(Object.values(AdminPermission)),
    
    [AdminRole.SUPPORT_STAFF]: new Set([
      AdminPermission.VIEW_USERS,
      AdminPermission.EDIT_USERS,
      AdminPermission.VIEW_TICKETS,
      AdminPermission.CREATE_TICKETS,
      AdminPermission.EDIT_TICKETS,
      AdminPermission.VIEW_PAYMENTS,
    ]),
    
    [AdminRole.SUPPORT_VIEWER]: new Set([
      AdminPermission.VIEW_USERS,
      AdminPermission.VIEW_TICKETS,
      AdminPermission.VIEW_PAYMENTS,
    ]),
    
    [AdminRole.MARKETING_STAFF]: new Set([
      AdminPermission.VIEW_USERS,
      AdminPermission.MANAGE_COUPONS,
    ]),
    
    [AdminRole.FINANCE_ADMIN]: new Set([
      AdminPermission.VIEW_USERS,
      AdminPermission.VIEW_PAYMENTS,
      AdminPermission.MANAGE_SUBSCRIPTIONS,
      AdminPermission.MANAGE_COUPONS,
    ]),
  };

  return permissions[adminRole]?.has(permission) || false;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate if a string is a valid user role
 */
export function isValidUserRole(role: string): role is UserRoleType {
  return Object.values(UserRole).includes(role as UserRoleType);
}

/**
 * Validate if a string is a valid admin role
 */
export function isValidAdminRole(role: string): role is AdminRoleType {
  return Object.values(AdminRole).includes(role as AdminRoleType);
}

// ============================================
// ROLE ARRAYS (for iteration/checking)
// ============================================

/**
 * All user roles that grant admin access
 */
export const ADMIN_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
] as const;

/**
 * All user roles that grant super admin access
 */
export const SUPER_ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
] as const;

/**
 * All support staff roles
 */
export const SUPPORT_ROLES = [
  UserRole.SUPPORT_AGENT,
  UserRole.SUPPORT_MANAGER,
] as const;

// ============================================
// DOCUMENTATION
// ============================================

/**
 * ARCHITECTURE NOTES:
 * 
 * USER ROLES (users.role column):
 * - user: Regular user with no special permissions
 * - admin: Can manage users and support tickets
 * - super_admin: Full admin access (but not owner)
 * - owner: Ultimate access, can manage billing and settings
 * - support_agent: Can view and respond to support tickets
 * - support_manager: Can manage support team
 * 
 * ADMIN ROLES (users.admin_role column):
 * - SUPER_ADMIN: Full access to admin panel
 * - SUPPORT_STAFF: Can manage tickets and users
 * - SUPPORT_VIEWER: Read-only access to tickets
 * - MARKETING_STAFF: Can manage coupons and promotions
 * - FINANCE_ADMIN: Can manage payments and subscriptions
 * 
 * SEPARATION OF CONCERNS:
 * - User Panel uses users.role
 * - Admin Panel uses users.admin_role
 * - These are separate permission systems
 * - User app should NEVER check admin roles
 * - Admin app can check both user and admin roles
 * 
 * USAGE:
 * ```typescript
 * import { isAdmin, isSuperAdmin, UserRole } from '@shared/rbac';
 * 
 * // Check if user is admin
 * if (isAdmin(user.role)) {
 *   // Grant admin access
 * }
 * 
 * // Check specific role
 * if (user.role === UserRole.OWNER) {
 *   // Owner-only feature
 * }
 * ```
 * 
 * ⚠️ WARNING:
 * DO NOT hardcode role strings like 'admin' or 'super_admin'
 * Always use the constants from this file
 */

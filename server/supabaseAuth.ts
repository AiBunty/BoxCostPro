import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { logAuthEventAsync, notifyAdminAsync, sendWelcomeEmail, extractClientInfo } from './services/authService';
import { ensureTenantContext, TenantContext } from './tenantContext';

// Supabase removed: this module now provides session-aware middleware
// to populate `req.supabaseUser` where possible for compatibility.

export const isSupabaseConfigured = false;

export interface SupabaseUser {
  id: string;
  supabaseUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
}

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseUser;
      tenantId?: string;
      tenantContext?: TenantContext;
    }
  }
}

export async function supabaseAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    // If request already has a session-authenticated user (passport/req.login),
    // map that to req.supabaseUser for compatibility with routes that expect it.

    // Case 1: OIDC passport user with claims.sub
    const sessionUser: any = (req as any).user;
    let appUserId: string | undefined;

    if (sessionUser && sessionUser.claims && sessionUser.claims.sub) {
      appUserId = sessionUser.claims.sub;
    } else if (sessionUser && sessionUser.userId) {
      appUserId = sessionUser.userId;
    }

    if (appUserId) {
      const appUser = await storage.getUser(appUserId);
      if (appUser) {
        (req as any).supabaseUser = {
          id: appUser.id,
          supabaseUserId: appUser.supabaseUserId || appUser.id,
          email: appUser.email || null,
          firstName: appUser.firstName || null,
          lastName: appUser.lastName || null,
          role: appUser.role || null,
        } as SupabaseUser;

        (req as any).userId = appUser.id;

        try {
          const tenantContext = await ensureTenantContext(appUser.id);
          req.tenantId = tenantContext.tenantId;
          req.tenantContext = tenantContext;
        } catch (tenantError) {
          // non-fatal
          console.warn('Failed to resolve tenant context for session user', tenantError);
        }
      }
    }

    // Otherwise, do nothing (bearer token/Supabase token verification disabled)
    return next();
  } catch (error) {
    console.error('Supabase auth middleware error (stubbed):', error);
    return next();
  }
}

export function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Accept either supabaseUser or session-authenticated user
  if (!(req as any).supabaseUser && !(req as any).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const role = (req as any).supabaseUser?.role || (req as any).user?.role || null;
  if (!role) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (role !== 'owner' && role !== 'super_admin') {
    return res.status(403).json({ message: "Forbidden: Owner access required" });
  }
  next();
}

// Role hierarchy: user < support_agent < support_manager < admin < super_admin
export const ROLE_LEVELS: Record<string, number> = {
  'user': 0,
  'support_agent': 1,
  'support_manager': 2,
  'admin': 3,
  'super_admin': 4,
  'owner': 4,
};

export type UserRole = 'user' | 'support_agent' | 'support_manager' | 'admin' | 'super_admin' | 'owner';

export function hasRoleLevel(userRole: string | null, requiredRole: UserRole): boolean {
  const userLevel = ROLE_LEVELS[userRole || 'user'] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).supabaseUser?.role || (req as any).user?.role || null;
    if (!role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!hasRoleLevel(role, minRole)) {
      return res.status(403).json({ 
        message: `Forbidden: ${minRole} role or higher required`,
        requiredRole: minRole,
        currentRole: role || 'user'
      });
    }

    next();
  };
}

// Convenience role middleware for common checks
export const requireSupportAgent = requireRole('support_agent');
export const requireSupportManager = requireRole('support_manager');
export const requireAdmin = requireRole('admin');
export const requireSuperAdmin = requireRole('super_admin');

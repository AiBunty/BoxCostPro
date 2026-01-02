import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ['admin', 'super_admin', 'support_manager', 'owner'];
const SUPER_ADMIN_ROLES = ['super_admin', 'owner'];
const SUPPORT_AGENT_ROLES = ['support_agent', 'support_manager', 'admin', 'super_admin', 'owner'];
const SUPPORT_MANAGER_ROLES = ['support_manager', 'admin', 'super_admin', 'owner'];

/**
 * Middleware to enforce admin-level access
 * Use this on all /api/admin/* routes
 */
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.warn('[adminAuth] Unauthorized access attempt - no user in request');
      return res.status(401).json({ 
        error: "Authentication required",
        message: "You must be logged in to access this resource"
      });
    }

    // Fetch user from database to get current role
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      console.warn('[adminAuth] User not found in database:', req.user.id);
      return res.status(401).json({ 
        error: "User not found",
        message: "Your user account could not be verified"
      });
    }

    // Check if user has admin role
    if (!ADMIN_ROLES.includes(dbUser.role || '')) {
      console.warn('[adminAuth] Access denied - insufficient permissions', {
        userId: dbUser.id,
        role: dbUser.role,
        path: req.path,
        method: req.method
      });
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You do not have permission to access this resource",
        requiredRole: "admin",
        currentRole: dbUser.role || 'user'
      });
    }

    // Enforce 2FA for admin users (unless disabled via env variable)
    const require2FA = process.env.ADMIN_REQUIRE_2FA !== 'false';
    if (require2FA && !dbUser.twoFactorEnabled) {
      console.warn('[adminAuth] 2FA not enabled for admin user', {
        userId: dbUser.id,
        role: dbUser.role,
      });
      return res.status(403).json({ 
        error: "2FA Required",
        message: "Two-factor authentication must be enabled for admin access",
        action: "setup_2fa",
        redirectTo: "/admin/2fa-setup"
      });
    }

    // Attach role to request for downstream handlers
    req.user.role = dbUser.role;
    
    console.log('[adminAuth] Access granted', {
      userId: dbUser.id,
      role: dbUser.role,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    console.error('[adminAuth] Error checking admin permissions:', error);
    res.status(500).json({ 
      error: "Internal server error",
      message: "Failed to verify permissions"
    });
  }
}

/**
 * Middleware to enforce super admin access only
 * Use for critical operations like user role changes, system settings
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required" 
      });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      return res.status(401).json({ 
        error: "User not found" 
      });
    }

    if (!SUPER_ADMIN_ROLES.includes(dbUser.role || '')) {
      console.warn('[adminAuth] Super admin access denied', {
        userId: dbUser.id,
        role: dbUser.role,
        path: req.path
      });
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Super admin access required",
        requiredRole: "super_admin",
        currentRole: dbUser.role || 'user'
      });
    }

    req.user.role = dbUser.role;
    next();
  } catch (error) {
    console.error('[adminAuth] Error checking super admin permissions:', error);
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
}

/**
 * Middleware to enforce support agent access
 * Support agents can handle tickets
 */
export async function requireSupportAgent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required" 
      });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      return res.status(401).json({ 
        error: "User not found" 
      });
    }

    if (!SUPPORT_AGENT_ROLES.includes(dbUser.role || '')) {
      console.warn('[adminAuth] Support agent access denied', {
        userId: dbUser.id,
        role: dbUser.role,
        path: req.path
      });
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Support agent access required",
        requiredRole: "support_agent",
        currentRole: dbUser.role || 'user'
      });
    }

    req.user.role = dbUser.role;
    next();
  } catch (error) {
    console.error('[adminAuth] Error checking support agent permissions:', error);
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
}

/**
 * Middleware to enforce support manager access
 * Support managers can escalate and manage support operations
 */
export async function requireSupportManager(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required" 
      });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      return res.status(401).json({ 
        error: "User not found" 
      });
    }

    if (!SUPPORT_MANAGER_ROLES.includes(dbUser.role || '')) {
      console.warn('[adminAuth] Support manager access denied', {
        userId: dbUser.id,
        role: dbUser.role,
        path: req.path
      });
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Support manager access required",
        requiredRole: "support_manager",
        currentRole: dbUser.role || 'user'
      });
    }

    req.user.role = dbUser.role;
    next();
  } catch (error) {
    console.error('[adminAuth] Error checking support manager permissions:', error);
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
}

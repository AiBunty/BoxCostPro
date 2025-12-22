import { Request, Response, NextFunction } from "express";
import { createClient } from '@supabase/supabase-js';
import { storage } from "./storage";
import { logAuthEventAsync, notifyAdminAsync, sendWelcomeEmail, extractClientInfo } from './services/authService';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = supabaseUrl && (supabaseServiceKey || supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const isSupabaseConfigured = !!supabaseAdmin;

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
    }
  }
}

export async function supabaseAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return next();
    }

    if (!supabaseAdmin) {
      console.warn('Supabase not configured, skipping token verification');
      return next();
    }

    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      return next();
    }

    let appUser = await storage.getUserBySupabaseId(supabaseUser.id);
    const { ipAddress, userAgent } = extractClientInfo(req);
    const isNewUser = !appUser;

    if (!appUser) {
      const signupMethod = supabaseUser.app_metadata?.provider || 'email';
      appUser = await storage.upsertUser({
        supabaseUserId: supabaseUser.id,
        email: supabaseUser.email || undefined,
        firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.full_name?.split(' ')[0] || null,
        lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
        authProvider: signupMethod,
        signupMethod: signupMethod,
        emailVerified: supabaseUser.email_confirmed_at ? true : false,
        accountStatus: 'new_user',
      });

      const userName = appUser.firstName && appUser.lastName 
        ? `${appUser.firstName} ${appUser.lastName}`.trim() 
        : appUser.firstName || 'Unknown';

      logAuthEventAsync({
        userId: appUser.id,
        email: appUser.email || undefined,
        action: 'SIGNUP',
        status: 'success',
        ipAddress,
        userAgent,
        metadata: { signupMethod, provider: supabaseUser.app_metadata?.provider },
      });

      notifyAdminAsync({
        subject: 'New User Signup',
        eventType: 'SIGNUP',
        userEmail: appUser.email || undefined,
        userName,
        signupMethod,
        ipAddress,
        additionalInfo: {
          'Provider': supabaseUser.app_metadata?.provider || 'email',
          'Email Verified': supabaseUser.email_confirmed_at ? 'Yes' : 'No',
        },
      });

      if (appUser.email) {
        sendWelcomeEmail({
          email: appUser.email,
          userName,
          signupMethod,
        });
      }
    } else {
      // Check if account is suspended or deleted
      if (appUser.accountStatus === 'suspended' || appUser.accountStatus === 'deleted') {
        logAuthEventAsync({
          userId: appUser.id,
          email: appUser.email || undefined,
          action: 'LOGIN',
          status: 'failed',
          ipAddress,
          userAgent,
          metadata: { reason: 'account_' + appUser.accountStatus, provider: supabaseUser.app_metadata?.provider },
        });
        return next();
      }
      
      // Check if account is locked due to failed login attempts
      const isLocked = await storage.isAccountLocked(appUser.id);
      if (isLocked) {
        logAuthEventAsync({
          userId: appUser.id,
          email: appUser.email || undefined,
          action: 'LOGIN',
          status: 'failed',
          ipAddress,
          userAgent,
          metadata: { reason: 'account_locked', provider: supabaseUser.app_metadata?.provider },
        });
        // Don't set user - they're locked out
        return next();
      }
      
      logAuthEventAsync({
        userId: appUser.id,
        email: appUser.email || undefined,
        action: 'LOGIN',
        status: 'success',
        ipAddress,
        userAgent,
        metadata: { provider: supabaseUser.app_metadata?.provider },
      });

      await storage.resetFailedLoginAttempts(appUser.id);
    }

    req.supabaseUser = {
      id: appUser.id,
      supabaseUserId: supabaseUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      role: appUser.role,
    };
    
    // Also set req.userId for combinedAuth middleware compatibility
    (req as any).userId = appUser.id;

    next();
  } catch (error) {
    console.error('Supabase auth middleware error:', error);
    next();
  }
}

export function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.supabaseUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.supabaseUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.supabaseUser.role !== 'owner' && req.supabaseUser.role !== 'super_admin') {
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
  'owner': 4, // Legacy 'owner' maps to super_admin level
};

export type UserRole = 'user' | 'support_agent' | 'support_manager' | 'admin' | 'super_admin' | 'owner';

export function hasRoleLevel(userRole: string | null, requiredRole: UserRole): boolean {
  const userLevel = ROLE_LEVELS[userRole || 'user'] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.supabaseUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!hasRoleLevel(req.supabaseUser.role, minRole)) {
      return res.status(403).json({ 
        message: `Forbidden: ${minRole} role or higher required`,
        requiredRole: minRole,
        currentRole: req.supabaseUser.role || 'user'
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

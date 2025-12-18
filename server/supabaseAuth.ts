import { Request, Response, NextFunction } from "express";
import { createClient } from '@supabase/supabase-js';
import { storage } from "./storage";

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

    if (!appUser) {
      appUser = await storage.upsertUser({
        supabaseUserId: supabaseUser.id,
        email: supabaseUser.email || undefined,
        firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.full_name?.split(' ')[0] || null,
        lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
        authProvider: supabaseUser.app_metadata?.provider || 'supabase',
      });
    }

    req.supabaseUser = {
      id: appUser.id,
      supabaseUserId: supabaseUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      role: appUser.role,
    };

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
  if (req.supabaseUser.role !== 'owner') {
    return res.status(403).json({ message: "Forbidden: Owner access required" });
  }
  next();
}

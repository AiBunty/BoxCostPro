import { Request, Response, NextFunction } from "express";
import { isAfter } from "date-fns";
import { and, eq } from "drizzle-orm";
import { admins, adminSessions } from "@shared/schema";
import { db } from "../db";
import { isIdleExpired, isIpAllowed, logAdminAuth } from "../services/adminSecurity";

const IDLE_MINUTES = 30;
const ADMIN_ROLES = ["admin", "super_admin"];
const SUPER_ADMIN_ROLES = ["super_admin"];
const SUPPORT_AGENT_ROLES = ["support_agent", "support_manager", "admin", "super_admin"];
const SUPPORT_MANAGER_ROLES = ["support_manager", "admin", "super_admin"];

/**
 * Validates the internal admin session cookie and attaches admin/session to the request.
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.admin_session;
    if (!token) return res.status(401).json({ error: "Admin authentication required" });

    const [session] = await db.select().from(adminSessions).where(eq(adminSessions.sessionToken, token));
    if (!session) return res.status(401).json({ error: "Invalid session" });

    if (isAfter(new Date(), session.expiresAt)) {
      await logAdminAuth(session.adminId, "SESSION_EXPIRED", req.ip, req.headers["user-agent"] as string);
      await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
      return res.status(401).json({ error: "Session expired" });
    }

    if (isIdleExpired(session.lastActivityAt, IDLE_MINUTES)) {
      await logAdminAuth(session.adminId, "SESSION_EXPIRED", req.ip, req.headers["user-agent"] as string);
      await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
      return res.status(401).json({ error: "Session idle timeout" });
    }

    const ipAllowed = await isIpAllowed(session.adminId, req.ip);
    if (!ipAllowed) return res.status(403).json({ error: "IP not allowed" });

    const [admin] = await db
      .select()
      .from(admins)
      .where(and(eq(admins.id, session.adminId), eq(admins.isActive, true)));
    if (!admin) return res.status(403).json({ error: "Admin inactive" });

    await db
      .update(adminSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(adminSessions.id, session.id));

    (req as any).admin = admin;
    (req as any).adminSession = session;
    return next();
  } catch (error) {
    console.error("[adminAuth] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Alias for legacy call-sites
export const requireAdminAuth = adminAuth;

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin;
  if (!admin) return res.status(401).json({ error: "Admin authentication required" });
  if (!SUPER_ADMIN_ROLES.includes(admin.role)) return res.status(403).json({ error: "Super admin required" });
  return next();
}

export function requireSupportAgent(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin;
  if (!admin) return res.status(401).json({ error: "Admin authentication required" });
  if (!SUPPORT_AGENT_ROLES.includes(admin.role)) return res.status(403).json({ error: "Support agent access required" });
  return next();
}

export function requireSupportManager(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin;
  if (!admin) return res.status(401).json({ error: "Admin authentication required" });
  if (!SUPPORT_MANAGER_ROLES.includes(admin.role)) return res.status(403).json({ error: "Support manager access required" });
  return next();
}

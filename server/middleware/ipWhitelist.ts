import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { allowedAdminIps } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Extract client IP address from request
 * Handles various proxy configurations (X-Forwarded-For, X-Real-IP, etc.)
 */
export function extractClientIP(req: Request): string {
  // Check X-Forwarded-For header (load balancer, proxy)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIP = ips.split(',')[0].trim();
    if (clientIP) return clientIP;
  }

  // Check X-Real-IP header (nginx, some proxies)
  const realIP = req.headers['x-real-ip'];
  if (realIP && typeof realIP === 'string') {
    return realIP.trim();
  }

  // Fallback to socket remote address
  const socketIP = req.socket.remoteAddress;
  if (socketIP) {
    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    return socketIP.replace(/^::ffff:/, '');
  }

  return 'unknown';
}

/**
 * Check if an IP address is whitelisted for admin access
 */
async function isIPWhitelisted(ipAddress: string, userId?: string): Promise<boolean> {
  try {
    // Check environment variable for static IP whitelist (comma-separated)
    const staticWhitelist = process.env.ADMIN_IP_WHITELIST;
    if (staticWhitelist) {
      const allowedIPs = staticWhitelist.split(',').map(ip => ip.trim());
      if (allowedIPs.includes(ipAddress)) {
        console.log('[IP Whitelist] Static whitelist match:', ipAddress);
        return true;
      }
    }

    // Check database for dynamic IP whitelist
    const conditions = [
      eq(allowedAdminIps.ipAddress, ipAddress),
      eq(allowedAdminIps.isActive, true),
    ];

    // If userId is provided, check user-specific IPs
    // Also check for global IPs (userId = null)
    const userSpecificIPs = userId
      ? await db
          .select()
          .from(allowedAdminIps)
          .where(and(...conditions, eq(allowedAdminIps.userId, userId)))
      : [];

    const globalIPs = await db
      .select()
      .from(allowedAdminIps)
      .where(and(...conditions, eq(allowedAdminIps.userId, null as any)));

    if (userSpecificIPs.length > 0 || globalIPs.length > 0) {
      // Update last used timestamp
      await db
        .update(allowedAdminIps)
        .set({ lastUsedAt: new Date() })
        .where(eq(allowedAdminIps.ipAddress, ipAddress));

      console.log('[IP Whitelist] Database match:', ipAddress);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('[IP Whitelist] Error checking whitelist:', error);
    // If the table doesn't exist (development), allow access
    if (error?.code === '42P01') {
      console.log('[IP Whitelist] Table not found - allowing access in development');
      return true;
    }
    // Fail open in case of database error (log but allow access)
    // In production, you might want to fail closed instead
    return false;
  }
}

/**
 * Middleware to enforce IP whitelisting for admin routes
 * Use this on all /api/admin/* routes after authentication
 */
export async function requireWhitelistedIP(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip IP check if feature is disabled
    if (process.env.ADMIN_IP_WHITELIST_ENABLED === 'false') {
      console.log('[IP Whitelist] Feature disabled, allowing access');
      return next();
    }

    // Extract client IP
    const clientIP = extractClientIP(req);
    console.log('[IP Whitelist] Checking IP:', clientIP);

    if (clientIP === 'unknown') {
      console.warn('[IP Whitelist] Unable to determine client IP');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Unable to verify IP address',
      });
    }

    // Check if user is authenticated
    const userId = (req as any).user?.id;
    if (!userId) {
      console.warn('[IP Whitelist] No authenticated user found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check whitelist
    const isAllowed = await isIPWhitelisted(clientIP, userId);

    if (!isAllowed) {
      console.warn('[IP Whitelist] Access denied for IP:', clientIP, 'User:', userId);
      
      // Log audit event (import from existing audit logging)
      try {
        const { logAdminAuditEventAsync } = await import('../services/adminAuditService');
        await logAdminAuditEventAsync({
          staffId: userId,
          action: 'IP_ACCESS_DENIED',
          targetType: 'admin_access',
          targetId: null,
          changes: {
            ipAddress: clientIP,
            reason: 'IP not whitelisted',
          },
          ipAddress: clientIP,
        });
      } catch (auditError) {
        console.error('[IP Whitelist] Failed to log audit event:', auditError);
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Your IP address is not authorized for admin access',
        details: {
          ipAddress: clientIP,
          help: 'Contact your system administrator to whitelist your IP address',
        },
      });
    }

    console.log('[IP Whitelist] Access granted for IP:', clientIP);
    next();
  } catch (error: any) {
    console.error('[IP Whitelist] Middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify IP whitelist',
    });
  }
}

/**
 * Storage methods for IP whitelist management
 */
export const ipWhitelistStorage = {
  /**
   * Add an IP to the whitelist
   */
  async addIP(data: {
    ipAddress: string;
    userId?: string;
    description?: string;
    createdBy: string;
  }) {
    const [result] = await db
      .insert(allowedAdminIps)
      .values({
        ipAddress: data.ipAddress,
        userId: data.userId || null,
        description: data.description,
        createdBy: data.createdBy,
        isActive: true,
      })
      .returning();
    return result;
  },

  /**
   * Get all whitelisted IPs (optionally filtered by user)
   */
  async getIPs(userId?: string) {
    if (userId) {
      return await db
        .select()
        .from(allowedAdminIps)
        .where(eq(allowedAdminIps.userId, userId));
    }
    return await db.select().from(allowedAdminIps);
  },

  /**
   * Remove an IP from whitelist
   */
  async removeIP(id: string) {
    await db
      .update(allowedAdminIps)
      .set({ isActive: false })
      .where(eq(allowedAdminIps.id, id));
  },

  /**
   * Delete an IP permanently
   */
  async deleteIP(id: string) {
    await db.delete(allowedAdminIps).where(eq(allowedAdminIps.id, id));
  },
};

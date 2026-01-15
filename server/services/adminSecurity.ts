import crypto from 'crypto';
import { addMinutes, isAfter } from 'date-fns';
import { db } from '../db';
import { admins, adminSessions, adminLoginAuditLogs, adminAllowedIps } from '@shared/schema';
import { eq, or, isNull } from 'drizzle-orm';

// Generate strong random session token
export function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function createAdminSession(adminId: string, ip: string | null, ua: string | null, ttlMinutes = 60) {
  const token = generateSessionToken();
  const expiresAt = addMinutes(new Date(), ttlMinutes);
  await db.insert(adminSessions).values({
    adminId,
    sessionToken: token,
    ipAddress: ip || null,
    userAgent: ua || null,
    lastActivityAt: new Date(),
    expiresAt,
  });
  return token;
}

export async function destroyAdminSession(token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.sessionToken, token));
}

export function isIdleExpired(lastActivity: Date, maxIdleMinutes = 30) {
  return isAfter(new Date(), addMinutes(lastActivity, maxIdleMinutes));
}

// Basic IPv4 CIDR check without extra deps
function ipToLong(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!range || Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

export async function isIpAllowed(adminId: string, ip: string | undefined): Promise<boolean> {
  if (!ip) return false;
  const rules = await db
    .select()
    .from(adminAllowedIps)
    .where(or(eq(adminAllowedIps.adminId, adminId), isNull(adminAllowedIps.adminId)));
  if (rules.length === 0) return true;
  return rules.some((r) => {
    const cidr = r.ipAddressCidr;
    if (!cidr) return false;
    if (cidr.includes('/')) return ipInCidr(ip, cidr);
    return ip === cidr;
  });
}

export async function logAdminAuth(adminId: string | null, action: string, ip?: string, ua?: string) {
  await db.insert(adminLoginAuditLogs).values({
    adminId: adminId || null,
    action,
    ipAddress: ip || null,
    userAgent: ua || null,
  });
}

export async function getAdminByEmail(email: string) {
  const [admin] = await db.select().from(admins).where(eq(admins.email, email));
  return admin;
}

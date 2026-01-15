import { Router } from "express";
import bcrypt from "bcrypt";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "../db";
import { admins, adminSessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { adminAuth, requireSuperAdmin } from "../middleware/adminAuth";
import { createAdminSession, destroyAdminSession, logAdminAuth } from "../services/adminSecurity";
import { encrypt, decrypt } from "../utils/encryption";
import { addMinutes } from "date-fns";

const router = Router();

// GET /api/admin/auth/profile
router.get("/profile", adminAuth, async (req, res) => {
  const admin = (req as any).admin;
  if (!admin) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Return admin profile without sensitive data
  const { passwordHash, twofaSecretEncrypted, ...safeAdmin } = admin;
  return res.json(safeAdmin);
});

// POST /api/admin/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const [admin] = await db.select().from(admins).where(eq(admins.email, String(email).toLowerCase()));
  if (!admin || !admin.isActive) {
    await logAdminAuth(null, "LOGIN_FAILED", req.ip, req.headers["user-agent"] as string);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    await logAdminAuth(admin.id, "LOGIN_FAILED", req.ip, req.headers["user-agent"] as string);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (admin.twofaEnabled) {
    return res.json({ requires2FA: true });
  }

  const token = await createAdminSession(admin.id, req.ip || null, req.headers["user-agent"] as string);
  
  // Cookie settings - secure only in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie("admin_session", token, { 
    httpOnly: true, 
    sameSite: "lax", 
    secure: isProduction,
    path: "/" 
  });
  
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  await logAdminAuth(admin.id, "LOGIN_SUCCESS", req.ip, req.headers["user-agent"] as string);
  return res.json({ success: true });
});

// POST /api/admin/auth/login/2fa
router.post("/login/2fa", async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

  const [admin] = await db.select().from(admins).where(eq(admins.email, String(email).toLowerCase()));
  if (!admin || !admin.isActive || !admin.twofaEnabled || !admin.twofaSecretEncrypted) {
    await logAdminAuth(admin?.id || null, "2FA_FAILED", req.ip, req.headers["user-agent"] as string);
    return res.status(401).json({ error: "Invalid 2FA" });
  }

  const secret = decrypt(admin.twofaSecretEncrypted);
  const valid = authenticator.verify({ token: code, secret });
  if (!valid) {
    await logAdminAuth(admin.id, "2FA_FAILED", req.ip, req.headers["user-agent"] as string);
    return res.status(401).json({ error: "Invalid 2FA code" });
  }

  const token = await createAdminSession(admin.id, req.ip || null, req.headers["user-agent"] as string);
  
  // Cookie settings - secure only in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie("admin_session", token, { 
    httpOnly: true, 
    sameSite: "lax", 
    secure: isProduction,
    path: "/" 
  });
  
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  await logAdminAuth(admin.id, "LOGIN_SUCCESS", req.ip, req.headers["user-agent"] as string);
  return res.json({ success: true });
});

// POST /api/admin/auth/logout
router.post("/logout", adminAuth, async (req, res) => {
  const token = (req as any).cookies?.admin_session;
  if (token) await destroyAdminSession(token);
  res.clearCookie("admin_session", { path: "/" });
  await logAdminAuth((req as any).admin?.id || null, "LOGOUT", req.ip, req.headers["user-agent"] as string);
  return res.json({ success: true });
});

// 2FA setup (super_admin)
router.post("/security/2fa/setup", adminAuth, requireSuperAdmin, async (req, res) => {
  const admin = (req as any).admin;
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(admin.email, "BoxCostPro Admin", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  await db.update(admins).set({ twofaSecretEncrypted: encrypt(secret) }).where(eq(admins.id, admin.id));
  return res.json({ otpauthUrl: otpauth, qrDataUrl });
});

router.post("/security/2fa/verify", adminAuth, requireSuperAdmin, async (req, res) => {
  const { code } = req.body || {};
  const admin = (req as any).admin;
  const [fresh] = await db.select().from(admins).where(eq(admins.id, admin.id));
  if (!fresh?.twofaSecretEncrypted) return res.status(400).json({ error: "No secret set" });
  const secret = decrypt(fresh.twofaSecretEncrypted);
  const valid = authenticator.verify({ token: code, secret });
  if (!valid) return res.status(401).json({ error: "Invalid code" });
  await db.update(admins).set({ twofaEnabled: true }).where(eq(admins.id, admin.id));
  return res.json({ success: true });
});

router.post("/security/2fa/disable", adminAuth, requireSuperAdmin, async (req, res) => {
  const admin = (req as any).admin;
  await db.update(admins).set({ twofaEnabled: false, twofaSecretEncrypted: null }).where(eq(admins.id, admin.id));
  return res.json({ success: true });
});

// Impersonation (super_admin only)
router.post("/impersonate/start", adminAuth, requireSuperAdmin, async (req, res) => {
  const { userId } = req.body || {};
  const session = (req as any).adminSession;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const expiresAt = addMinutes(new Date(), 10);
  await db.update(adminSessions).set({ impersonatedUserId: userId, expiresAt }).where(eq(adminSessions.id, session.id));
  await logAdminAuth((req as any).admin.id, "IMPERSONATION_START", req.ip, req.headers["user-agent"] as string);
  return res.json({ success: true, expiresAt });
});

router.post("/impersonate/end", adminAuth, async (req, res) => {
  const session = (req as any).adminSession;
  await db.update(adminSessions).set({ impersonatedUserId: null, expiresAt: addMinutes(new Date(), 60) }).where(eq(adminSessions.id, session.id));
  await logAdminAuth((req as any).admin.id, "IMPERSONATION_END", req.ip, req.headers["user-agent"] as string);
  return res.json({ success: true });
});

export default router;

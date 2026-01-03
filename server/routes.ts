import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createOnboardingGuard, onboardingRateLimiter } from "./middleware/onboardingGuard";
import { requireAdminAuth, requireSuperAdmin as requireSuperAdminAuth, requireSupportAgent, requireSupportManager } from "./middleware/adminAuth";
import { requireWhitelistedIP } from "./middleware/ipWhitelist";
import { db } from "./db";
import { users, allowedAdminIps, adminAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getClerkUser } from "./clerkAuth";
import { ensureTenantContext } from "./tenantContext";
import { logAuthEventAsync, notifyAdminAsync, sendWelcomeEmail } from "./services/authService";
import { registerAdminRoutes } from "./routes/adminRoutes";
import { registerTemplateRoutes } from "./routes/templateRoutes";
import { registerSupportRoutes } from "./routes/supportRoutes";
import { registerAuditRoutes } from "./routes/auditRoutes";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { validateGSTIN, extractPANFromGST, getStateFromGST, LOCKED_LEGAL_FIELDS, type LockedLegalField } from "./utils/gstValidation";
import { generateInvoiceNumber, getCurrentFinancialYear } from "./services/invoiceNumbering";
import { calculateGST, type GSTBreakdown } from "./services/gstCalculation";
import { initializeRazorpay, createRazorpayOrder, verifyRazorpaySignature, fetchPaymentDetails } from "./services/razorpayService";
import { generateInvoicePDF } from "./services/pdfInvoiceService";
import { sendWelcomeEmail as sendSignupWelcomeEmail, sendInvoiceEmail } from "./services/signupEmailService";
import { z } from "zod";
import { 
  insertCompanyProfileSchema, 
  insertPartyProfileSchema, 
  insertQuoteSchema, 
  insertAppSettingsSchema, 
  insertRateMemorySchema, 
  insertSubscriptionPlanSchema, 
  insertCouponSchema, 
  insertTrialInviteSchema, 
  insertFlutingSettingSchema, 
  insertChatbotWidgetSchema,
  insertPaperPriceSchema,
  insertPaperBfPriceSchema,
  insertShadePremiumSchema,
  insertPaperPricingRulesSchema,
  insertUserQuoteTermsSchema,
  insertBoxSpecificationSchema,
  insertBoxSpecVersionSchema,
  insertOnboardingStatusSchema,
  insertSupportTicketSchema,
  insertSupportMessageSchema
} from "@shared/schema";

// Combined auth middleware - checks Clerk authentication
const combinedAuth = async (req: any, res: Response, next: NextFunction) => {
  // First check Clerk Auth
  const clerkUser = await getClerkUser(req);
  if (clerkUser) {
    let appUser = await storage.getUserByClerkId(clerkUser.id);

    // If not found by Clerk ID, check by email (user may exist from before)
    if (!appUser && clerkUser.email) {
      appUser = await storage.getUserByEmail(clerkUser.email);
      if (appUser) {
        // Link existing user to Clerk ID
        console.log('[Clerk Auth] Linking existing user to Clerk ID:', clerkUser.email);
        await storage.updateUser(appUser.id, { clerkUserId: clerkUser.id });
      }
    }

    // If user still doesn't exist in our database, create them (but check for admin restrictions)
    if (!appUser) {
      console.log('[Clerk Auth] Creating new user for Clerk user:', clerkUser.email);

      // Check if this is the first user (should be super admin)
      const existingUsers = await storage.getAllUsers();
      const isFirstUser = existingUsers.length === 0;

      // Create user in our database
      appUser = await storage.upsertUser({
        email: clerkUser.email,
        clerkUserId: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.profileImageUrl,
        role: isFirstUser ? 'super_admin' : 'user', // First user is super admin
        emailVerified: clerkUser.emailVerified,
      });

      console.log('[Clerk Auth] Created user:', appUser.id, 'Role:', appUser.role);
    }

    console.log('[combinedAuth] Clerk auth successful:', {
      clerkUserId: clerkUser.id,
      appUserId: appUser.id,
      email: appUser.email,
      role: appUser.role
    });

    // Ensure tenant context exists for Clerk users and attach to request
    try {
      const tenantContext = await ensureTenantContext(appUser.id);
      req.tenantId = tenantContext?.tenantId;
      req.tenantContext = tenantContext;
    } catch (err) {
      console.warn('[combinedAuth] Failed to resolve tenant context for Clerk user:', err);
    }

    req.userId = appUser.id;
    req.clerkUser = clerkUser;
    req.user = appUser;
    return next();
  }

  // Fall back to session-based auth (for existing sessions)
  if (req.user?.claims?.sub) {
    req.userId = req.user.claims.sub;
    return next();
  }
  if (req.user?.userId) {
    req.userId = req.user.userId;
    return next();
  }
  if (req.user?.id) {
    req.userId = req.user.id;
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};

// Owner authorization middleware
const isOwner = async (req: any, res: Response, next: NextFunction) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await storage.getUser(userId);
  if (!user || user.role !== 'owner') {
    return res.status(403).json({ message: "Forbidden: Owner access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for proper HTTPS handling
  app.set("trust proxy", 1);

  // NOTE: Clerk middleware is already set up in app.ts
  // All authentication is handled by Clerk

  // ========== CRITICAL: ONBOARDING GUARD ==========
  // BLOCKS all protected routes until user is verified
  // This is BACKEND enforcement - users CANNOT bypass via API calls
  app.use(createOnboardingGuard(storage));

  // ========== HEALTH CHECK ENDPOINTS ==========
  // Public health check for load balancers and monitoring
  const { getSystemHealth } = await import('./utils/healthChecks');
  
  app.get('/health', async (_req, res) => {
    try {
      const health = await getSystemHealth();
      const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      console.error('[Health Check] Error:', error);
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ========== AUTH HEALTH CHECK ==========
  // Verifies Clerk is the only auth provider and no legacy auth is present
  app.get('/api/system/health/auth', async (_req, res) => {
    const forbiddenEnvVars: string[] = [];
    
    // Check for forbidden environment variables
    const FORBIDDEN_PATTERNS = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEON_AUTH_JWKS_URL',
      'NEON_AUTH_URL',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ];
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (process.env[pattern]) {
        forbiddenEnvVars.push(pattern);
      }
    }
    
    // Check Clerk is configured
    const clerkConfigured = !!(
      process.env.CLERK_SECRET_KEY && 
      (process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY)
    );
    
    const authHealth = {
      auth_provider: 'clerk',
      clerk_verified: clerkConfigured,
      other_auth_detected: forbiddenEnvVars.length > 0,
      forbidden_env_vars: forbiddenEnvVars,
      timestamp: new Date().toISOString(),
    };
    
    const statusCode = clerkConfigured && forbiddenEnvVars.length === 0 ? 200 : 503;
    res.status(statusCode).json(authHealth);
  });

  // Sync 2FA status from Clerk to database
  app.patch('/api/auth/user/2fa-status', combinedAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { twoFactorEnabled, twoFactorMethod } = req.body;

      // Validate input
      if (typeof twoFactorEnabled !== 'boolean') {
        return res.status(400).json({ error: "twoFactorEnabled must be a boolean" });
      }

      // Update user in database
      const [updatedUser] = await db
        .update(users)
        .set({
          twoFactorEnabled,
          twoFactorMethod: twoFactorMethod || 'totp',
          twoFactorVerifiedAt: twoFactorEnabled ? new Date() : null,
        })
        .where(eq(users.id, userId))
        .returning();

      // Log the status change to audit logs
      const auditAction = twoFactorEnabled ? '2FA_ENABLED' : '2FA_DISABLED';
      await db.insert(adminAuditLogs).values({
        userId,
        action: auditAction,
        category: 'SECURITY',
        details: { method: twoFactorMethod || 'totp' },
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });

      console.log(`[2FA Status] User ${userId} ${twoFactorEnabled ? 'enabled' : 'disabled'} 2FA`);

      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          twoFactorEnabled: updatedUser.twoFactorEnabled,
          twoFactorMethod: updatedUser.twoFactorMethod,
        },
      });
    } catch (error: any) {
      console.error('[2FA Status Sync] Error:', error);
      res.status(500).json({ error: "Failed to sync 2FA status" });
    }
  });

  // Detailed admin health check with system metrics
  app.get('/api/admin/health', combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const health = await getSystemHealth();
      
      // Add admin-specific details
      const detailedHealth = {
        ...health,
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '5000',
        processInfo: {
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          },
        },
        requestUser: {
          id: req.user?.id,
          email: req.user?.email,
          role: req.user?.role,
        },
      };
      
      const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(detailedHealth);
    } catch (error: any) {
      console.error('[Admin Health Check] Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Admin health check failed',
        details: error.message,
      });
    }
  });

  // Database health check with row counts for debugging
  app.get('/api/admin/health/db', combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { sql } = await import('drizzle-orm');
      
      // Get counts from key tables
      const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      
      const { coupons, supportTickets, tenants, companyProfiles, userSubscriptions } = await import('@shared/schema');
      
      const [couponsCount] = await db.select({ count: sql<number>`count(*)` }).from(coupons);
      const [ticketsCount] = await db.select({ count: sql<number>`count(*)` }).from(supportTickets);
      const [tenantsCount] = await db.select({ count: sql<number>`count(*)` }).from(tenants);
      const [companiesCount] = await db.select({ count: sql<number>`count(*)` }).from(companyProfiles);
      const [subscriptionsCount] = await db.select({ count: sql<number>`count(*)` }).from(userSubscriptions);
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        databaseConnected: true,
        tableCounts: {
          users: Number(usersCount?.count || 0),
          coupons: Number(couponsCount?.count || 0),
          supportTickets: Number(ticketsCount?.count || 0),
          tenants: Number(tenantsCount?.count || 0),
          companyProfiles: Number(companiesCount?.count || 0),
          userSubscriptions: Number(subscriptionsCount?.count || 0),
        },
      });
    } catch (error: any) {
      console.error('[DB Health Check] Error:', error);
      res.status(503).json({
        status: 'error',
        databaseConnected: false,
        message: 'Database health check failed',
        details: error.message,
      });
    }
  });

  // Auth routes - Clerk-authenticated endpoints
  app.get('/api/auth/user', combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Also fetch user profile for onboarding status
      const profile = await storage.getUserProfile(userId);
      
      res.json({
        ...user,
        profile: profile || null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout route - Clerk handles logout on the client side
  // This endpoint is for any server-side session cleanup if needed
  app.post('/api/auth/logout', async (req: any, res) => {
    // Clerk manages authentication state on the client
    // Server just acknowledges the logout request
    res.json({ message: "Logged out successfully" });
  });
  // ==================== EMAIL/PASSWORD AUTHENTICATION ====================

  // Sign in with email and password
  app.post('/api/auth/signin', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // TODO: Add password verification here when password field is added to users table
      // For now, just log them in (temporary - needs proper password hashing)

      // Create session
      req.login({ userId: user.id }, (err: any) => {
        if (err) {
          console.error('[Auth] Session creation failed:', err);
          return res.status(500).json({ error: 'Failed to create session' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        });
      });
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      res.status(500).json({ error: 'Sign in failed' });
    }
  });

  // Sign up with email and password
  app.post('/api/auth/signup', async (req: any, res) => {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Parse full name
      const nameParts = (fullName || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Hash password before storing
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with hashed password
      const newUser = await storage.upsertUser({
        email,
        firstName,
        lastName,
        role: 'user',
        passwordHash,
      });

      // Create session
      req.login({ userId: newUser.id }, (err: any) => {
        if (err) {
          console.error('[Auth] Session creation failed:', err);
          return res.status(500).json({ error: 'Failed to create session' });
        }

        res.json({
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
          }
        });
      });
    } catch (error: any) {
      console.error('[Auth] Sign up error:', error);
      res.status(500).json({ error: 'Sign up failed' });
    }
  });

  // Sign in with email and password
  app.post('/api/auth/signin', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user has a password (might be Google OAuth only user)
      if (!user.passwordHash) {
        return res.status(400).json({ error: 'This account uses Google sign-in. Please sign in with Google.' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Create session
      req.login({ userId: user.id }, (err: any) => {
        if (err) {
          console.error('[Auth] Session creation failed:', err);
          return res.status(500).json({ error: 'Failed to create session' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        });
      });
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      res.status(500).json({ error: 'Sign in failed' });
    }
  });

  // User Profile routes
  app.get('/api/user-profile', combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      let profile = await storage.getUserProfile(userId);
      
      // Auto-create profile if missing
      if (!profile) {
        profile = await storage.createUserProfile({ userId });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  const userProfileUpdateSchema = z.object({
    paperSetupDone: z.boolean().optional(),
    termsSetupDone: z.boolean().optional(),
    onboardingCompleted: z.boolean().optional(),
    preferredCurrency: z.string().optional(),
    timezone: z.string().optional(),
  });

  app.patch('/api/user-profile', combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const validatedData = userProfileUpdateSchema.parse(req.body);
      const profile = await storage.updateUserProfile(userId, validatedData);
      res.json(profile);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  const completeProfileSchema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(1),
    companyName: z.string().optional(),
    countryCode: z.string().min(1),
    mobileNumber: z.string().min(8).max(12),
  });

  app.post('/api/user/complete-profile', combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = completeProfileSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updatedUser = await storage.updateUser(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        mobileNo: data.mobileNumber,
        countryCode: data.countryCode,
        companyName: data.companyName || undefined,
        accountStatus: user.emailVerified ? 'email_verified' : 'new_user',
      });
      
      let profile = await storage.getUserProfile(userId);
      if (!profile) {
        profile = await storage.createUserProfile({ userId });
      }
      
      res.json({ user: updatedUser, profile });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      console.error("Error completing profile:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });

  // ========================================
  // SIGNUP FLOW HELPER FUNCTIONS
  // ========================================

  // Helper: Complete Signup Flow (creates user + subscription + invoice + sends emails)
  async function completeSignupFlow(params: {
    tempProfile: any;
    plan: any;
    billingCycle: string;
    couponCode?: string;
    paymentMethod: 'razorpay' | 'coupon';
    razorpayPaymentId?: string | null;
    razorpayOrderId?: string | null;
    transactionId?: string | null;
  }): Promise<{ userId: string; invoiceId: string }> {
    const { tempProfile, plan, billingCycle, couponCode, paymentMethod, razorpayPaymentId, razorpayOrderId, transactionId } = params;

    // 1. Create User Account with hashed password
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const nameParts = tempProfile.authorizedPersonName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const user = await storage.upsertUser({
      email: tempProfile.businessEmail,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      mobileNo: tempProfile.mobileNumber,
      companyName: tempProfile.businessName,
      role: 'user',
      emailVerified: true,
      paymentCompleted: true,
      temporaryProfileId: tempProfile.id,
    });

    // 2. Convert Temporary Profile → Master Company Profile
    const companyProfile = await storage.createCompanyProfile({
      userId: user.id,
      companyName: tempProfile.businessName,
      ownerName: tempProfile.authorizedPersonName,
      email: tempProfile.businessEmail,
      phone: tempProfile.mobileNumber,
      gstNo: tempProfile.gstin,
      panNo: tempProfile.panNo,
      stateCode: tempProfile.stateCode,
      stateName: tempProfile.stateName,
      address: tempProfile.fullBusinessAddress,
      website: tempProfile.website,
      isDefault: true,
    });

    // 3. Create User Subscription
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);
    if (billingCycle === 'monthly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    const subscription = await storage.createUserSubscription({
      userId: user.id,
      planId: plan.id,
      status: 'active',
      billingCycle,
      currentPeriodStart,
      currentPeriodEnd,
      razorpaySubscriptionId: null,
      couponApplied: couponCode || null,
    });

    // 4. Generate Invoice
    const invoice = await generateSubscriptionInvoice({
      user,
      companyProfile,
      subscription,
      plan,
      billingCycle,
      couponCode,
      razorpayPaymentId,
      razorpayOrderId,
      transactionId,
    });

    // 5. Update payment transaction with user and subscription IDs
    if (transactionId) {
      await storage.updatePaymentTransaction(transactionId, {
        userId: user.id,
        subscriptionId: subscription.id,
      });
    }

    // 6. Increment coupon usage
    if (couponCode) {
      const coupon = await storage.getCouponByCode(couponCode);
      if (coupon) {
        await storage.incrementCouponUsage(coupon.id);
      }
    }

    // 7. Send Welcome Email
    if (user.email) {
      await sendSignupWelcomeEmail(user.email, {
        firstName: user.firstName || 'User',
        email: user.email,
        temporaryPassword: randomPassword,
        planName: plan.name,
      });
    }

    // 8. Send Invoice Email
    if (user.email) {
      await sendInvoiceEmail(storage, user.email, invoice.id);
    }

    // 9. Delete Temporary Profile
    await storage.deleteTempProfile(tempProfile.id);

    // 10. Notify Admin (fire-and-forget)
    notifyAdminAsync({
      subject: 'New Paid Signup',
      eventType: 'SIGNUP',
      userEmail: user.email || undefined,
      userName: `${user.firstName} ${user.lastName}`.trim() || undefined,
      signupMethod: 'payment_first',
      additionalInfo: {
        planName: plan.name,
        billingCycle,
        paymentMethod,
        amount: paymentMethod === 'razorpay' ? plan[billingCycle === 'monthly' ? 'priceMonthly' : 'priceYearly'] : 0,
        couponCode: couponCode || null,
      },
    });

    return {
      userId: user.id,
      invoiceId: invoice.id,
    };
  }

  // Helper: Generate Subscription Invoice
  async function generateSubscriptionInvoice(params: {
    user: any;
    companyProfile: any;
    subscription: any;
    plan: any;
    billingCycle: string;
    couponCode?: string;
    razorpayPaymentId?: string | null;
    razorpayOrderId?: string | null;
    transactionId?: string | null;
  }): Promise<any> {
    const { user, companyProfile, subscription, plan, billingCycle, couponCode, razorpayPaymentId, razorpayOrderId, transactionId } = params;

    // Get seller details (your company)
    const sellerCompanyProfile = await storage.getSellerProfile();
    if (!sellerCompanyProfile) {
      throw new Error('Seller company profile not configured. Please set up seller profile in admin panel.');
    }

    // Calculate pricing
    const subtotal = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
    let discountAmount = 0;

    if (couponCode) {
      const coupon = await storage.getCouponByCode(couponCode);
      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountAmount = (subtotal * coupon.discountValue) / 100;
        } else {
          discountAmount = coupon.discountValue;
        }
      }
    }

    const taxableValue = Math.max(0, subtotal - discountAmount);

    // Calculate GST
    const gstBreakdown = calculateGST(
      subtotal,
      sellerCompanyProfile.stateCode,
      companyProfile.stateCode,
      discountAmount
    );

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(storage);
    const financialYear = getCurrentFinancialYear();

    // Get default invoice template
    const template = await storage.getDefaultInvoiceTemplate();
    if (!template) {
      throw new Error('Default invoice template not found. Please create an invoice template in admin panel.');
    }

    // Create invoice record
    const invoice = await storage.createInvoice({
      invoiceNumber,
      invoiceDate: new Date(),
      financialYear,

      sellerCompanyName: sellerCompanyProfile.companyName,
      sellerGstin: sellerCompanyProfile.gstin,
      sellerAddress: sellerCompanyProfile.address,
      sellerStateCode: sellerCompanyProfile.stateCode,
      sellerStateName: sellerCompanyProfile.stateName,

      buyerCompanyName: companyProfile.companyName,
      buyerGstin: companyProfile.gstNo,
      buyerAddress: companyProfile.address,
      buyerStateCode: companyProfile.stateCode,
      buyerStateName: companyProfile.stateName,
      buyerEmail: companyProfile.email,
      buyerPhone: companyProfile.phone,

      userId: user.id,
      subscriptionId: subscription.id,
      planName: plan.name,
      billingCycle,

      lineItems: JSON.stringify([
        {
          description: `${plan.name} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
          hsnSac: '998314', // HSN/SAC for SaaS services
          quantity: 1,
          unitPrice: subtotal,
          taxableValue: taxableValue,
        },
      ]),

      subtotal,
      discountAmount,
      taxableValue,

      cgstRate: gstBreakdown.cgstRate,
      cgstAmount: gstBreakdown.cgstAmount,
      sgstRate: gstBreakdown.sgstRate,
      sgstAmount: gstBreakdown.sgstAmount,
      igstRate: gstBreakdown.igstRate,
      igstAmount: gstBreakdown.igstAmount,

      totalTax: gstBreakdown.totalTax,
      grandTotal: gstBreakdown.grandTotal,

      paymentTransactionId: transactionId || null,
      razorpayPaymentId,
      razorpayOrderId,
      couponCode: couponCode || null,
      couponDiscount: discountAmount,

      invoiceTemplateId: template.id,
      status: 'generated',
    });

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(storage, invoice.id);

    // Save PDF to local storage
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const uploadsDir = path.join(__dirname, '../uploads/invoices');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const pdfPath = path.join(uploadsDir, `${invoiceNumber.replace(/\//g, '_')}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Update invoice with PDF path
    await storage.updateInvoice(invoice.id, {
      pdfUrl: pdfPath,
      pdfGeneratedAt: new Date(),
    });

    return invoice;
  }

  // ========================================
  // SIGNUP FLOW ENDPOINTS (Payment-First)
  // ========================================

  // STEP 1: Create Temporary Business Profile
  app.post("/api/signup/business-profile", async (req: any, res) => {
    try {
      const data = req.body;

      // Validate GSTIN
      if (data.gstin) {
        const gstValidation = validateGSTIN(data.gstin);
        if (!gstValidation.valid) {
          return res.status(400).json({
            success: false,
            error: gstValidation.error,
          });
        }
      }

      // Check if email already exists in users or temp profiles
      const existingUser = await storage.getUserByEmail(data.businessEmail);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists',
        });
      }

      const existingTemp = await storage.getTempProfileByEmail(data.businessEmail);
      if (existingTemp) {
        // Reuse existing temp profile if within 24 hours
        if (new Date(existingTemp.expiresAt) > new Date()) {
          return res.json({
            success: true,
            sessionToken: existingTemp.sessionToken,
            tempProfileId: existingTemp.id,
          });
        } else {
          // Delete expired temp profile
          await storage.deleteTempProfile(existingTemp.id);
        }
      }

      // Create temporary business profile
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tempProfile = await storage.createTempBusinessProfile({
        ...data,
        sessionToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        gstinValidated: true,
      });

      res.json({
        success: true,
        sessionToken: tempProfile.sessionToken,
        tempProfileId: tempProfile.id,
      });

    } catch (error: any) {
      console.error('Error creating temp business profile:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // STEP 2: Create Payment Order (with coupon support)
  app.post("/api/signup/create-payment-order", async (req: any, res) => {
    try {
      const { sessionToken, planId, billingCycle, couponCode } = req.body;

      // Verify session token
      const tempProfile = await storage.getTempProfileBySession(sessionToken);
      if (!tempProfile) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired session',
        });
      }

      // Get plan
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan || !plan.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription plan',
        });
      }

      // Calculate amount
      let amount = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
      let couponDiscount = 0;

      // Apply coupon
      if (couponCode) {
        const coupon = await storage.getCouponByCode(couponCode);
        if (coupon && coupon.isActive) {
          // Check validity dates
          const now = new Date();
          if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return res.status(400).json({ success: false, error: 'Coupon not yet valid' });
          }
          if (coupon.validUntil && new Date(coupon.validUntil) < now) {
            return res.status(400).json({ success: false, error: 'Coupon expired' });
          }

          // Check usage limit
          if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            return res.status(400).json({ success: false, error: 'Coupon usage limit reached' });
          }

          // Calculate discount
          if (coupon.discountType === 'percentage') {
            couponDiscount = (amount * coupon.discountValue) / 100;
          } else {
            couponDiscount = coupon.discountValue;
          }

          amount = Math.max(0, amount - couponDiscount);
        }
      }

      // If amount is 0, return immediately (free subscription via coupon)
      if (amount === 0) {
        return res.json({
          success: true,
          isFree: true,
          couponCode,
        });
      }

      // Get Razorpay credentials from environment
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!razorpayKeyId || !razorpayKeySecret) {
        return res.status(500).json({
          success: false,
          error: 'Payment gateway not configured',
        });
      }

      // Initialize Razorpay
      initializeRazorpay(razorpayKeyId, razorpayKeySecret);

      // Create Razorpay order
      const amountInPaise = Math.round(amount * 100);
      const receipt = `signup_${tempProfile.id}_${Date.now()}`;

      const razorpayOrder = await createRazorpayOrder(amountInPaise, 'INR', receipt, {
        sessionToken,
        planId,
        billingCycle,
        couponCode: couponCode || '',
      });

      // Store order in payment_transactions
      await storage.createPaymentTransaction({
        userId: null, // User doesn't exist yet
        subscriptionId: null,
        razorpayOrderId: razorpayOrder.id,
        amount,
        currency: 'INR',
        status: 'pending',
      });

      res.json({
        success: true,
        razorpayKeyId: razorpayKeyId,
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: 'INR',
      });

    } catch (error: any) {
      console.error('Error creating payment order:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // STEP 3: Complete Signup (Free - 100% Coupon)
  app.post("/api/signup/complete-free", async (req: any, res) => {
    try {
      const { sessionToken, planId, billingCycle, couponCode } = req.body;

      // Verify session
      const tempProfile = await storage.getTempProfileBySession(sessionToken);
      if (!tempProfile) {
        return res.status(400).json({ success: false, error: 'Invalid session' });
      }

      // Verify coupon gives 100% discount
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid plan' });
      }

      let amount = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;

      const coupon = await storage.getCouponByCode(couponCode);
      if (!coupon) {
        return res.status(400).json({ success: false, error: 'Invalid coupon' });
      }

      let discount = 0;
      if (coupon.discountType === 'percentage') {
        discount = (amount * coupon.discountValue) / 100;
      } else {
        discount = coupon.discountValue;
      }

      const finalAmount = amount - discount;
      if (finalAmount !== 0) {
        return res.status(400).json({ success: false, error: 'Coupon does not provide 100% discount' });
      }

      // Create user, subscription, invoice, send emails
      const result = await completeSignupFlow({
        tempProfile,
        plan,
        billingCycle,
        couponCode,
        paymentMethod: 'coupon',
        razorpayPaymentId: null,
        razorpayOrderId: null,
      });

      res.json({
        success: true,
        userId: result.userId,
        invoiceId: result.invoiceId,
      });

    } catch (error: any) {
      console.error('Error completing free signup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // STEP 3: Complete Signup (Paid - Razorpay)
  app.post("/api/signup/complete-payment", async (req: any, res) => {
    try {
      const { sessionToken, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      // Verify session
      const tempProfile = await storage.getTempProfileBySession(sessionToken);
      if (!tempProfile) {
        return res.status(400).json({ success: false, error: 'Invalid session' });
      }

      // Verify Razorpay signature
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpayKeySecret) {
        return res.status(500).json({ success: false, error: 'Payment gateway not configured' });
      }

      const isValid = verifyRazorpaySignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        razorpayKeySecret
      );

      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }

      // Get payment transaction
      const transaction = await storage.getPaymentTransactionByOrderId(razorpayOrderId);
      if (!transaction) {
        return res.status(400).json({ success: false, error: 'Payment transaction not found' });
      }

      // Update transaction status
      await storage.updatePaymentTransaction(transaction.id, {
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
      });

      // Get plan from Razorpay payment details
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      if (razorpayKeyId) {
        initializeRazorpay(razorpayKeyId, razorpayKeySecret);
      }

      const paymentDetails = await fetchPaymentDetails(razorpayPaymentId);
      const planId = paymentDetails.notes?.planId;
      const billingCycle = paymentDetails.notes?.billingCycle || 'monthly';
      const couponCode = paymentDetails.notes?.couponCode || null;

      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Plan not found' });
      }

      // Create user, subscription, invoice, send emails
      const result = await completeSignupFlow({
        tempProfile,
        plan,
        billingCycle,
        couponCode,
        paymentMethod: 'razorpay',
        razorpayPaymentId,
        razorpayOrderId,
        transactionId: transaction.id,
      });

      res.json({
        success: true,
        userId: result.userId,
        invoiceId: result.invoiceId,
      });

    } catch (error: any) {
      console.error('Error completing paid signup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========================================
  // INVOICE ENDPOINTS
  // ========================================

  // Get invoice by ID
  app.get("/api/invoices/:id", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const invoiceId = req.params.id;

      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Verify user owns this invoice
      if (invoice.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoice' });
    }
  });

  // Download invoice PDF
  app.get("/api/invoices/:id/download", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const invoiceId = req.params.id;

      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Verify user owns this invoice
      if (invoice.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!invoice.pdfUrl) {
        return res.status(404).json({ error: 'Invoice PDF not generated' });
      }

      // Read PDF file
      const fs = await import('fs');
      const pdfBuffer = fs.readFileSync(invoice.pdfUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber.replace(/\//g, '_')}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      res.status(500).json({ error: 'Failed to download invoice' });
    }
  });

  // Get all invoices for user
  app.get("/api/invoices", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const invoices = await storage.getInvoicesByUser(userId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  // Admin: Get all invoices
  app.get("/api/admin/invoices", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  // Admin: Resend invoice email
  app.post("/api/admin/invoices/:id/resend-email", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      await sendInvoiceEmail(storage, invoice.buyerEmail, invoiceId);

      await storage.updateInvoice(invoiceId, {
        emailSent: true,
        emailSentAt: new Date(),
      });

      res.json({ success: true, message: 'Invoice email sent' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to resend email' });
    }
  });

  // Admin: Get all payments/transactions
  app.get("/api/admin/payments", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      // Return empty array for now - implement when payment system is ready
      res.json({ payments: [], total: 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  // Admin: Get all reports
  app.get("/api/admin/reports", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      // Return empty array for now - implement when reporting system is ready
      res.json({ reports: [], total: 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  // ========================================
  // SELLER PROFILE ENDPOINTS (Admin Only)
  // ========================================

  // Get seller profile
  app.get("/api/admin/seller-profile", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const seller = await storage.getSellerProfile();
      if (!seller) {
        return res.status(404).json({ error: 'Seller profile not configured' });
      }
      res.json(seller);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch seller profile' });
    }
  });

  // Create or update seller profile
  app.post("/api/admin/seller-profile", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const data = req.body;

      // Validate GSTIN
      const gstValidation = validateGSTIN(data.gstin);
      if (!gstValidation.valid) {
        return res.status(400).json({ error: gstValidation.error });
      }

      // Check if seller profile already exists
      const existingSeller = await storage.getSellerProfile();

      if (existingSeller) {
        // Update existing
        const updated = await storage.updateSellerProfile(existingSeller.id, data);
        res.json({ success: true, profile: updated });
      } else {
        // Create new
        const created = await storage.createSellerProfile(data);
        res.json({ success: true, profile: created });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Company Profiles (protected, tenant-scoped)
  app.get("/api/company-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const profiles = await storage.getAllCompanyProfiles(userId, tenantId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/company-profiles/default", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const profile = await storage.getDefaultCompanyProfile(userId, tenantId);
      if (!profile) {
        return res.status(404).json({ error: "No default profile found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default profile" });
    }
  });

  app.get("/api/company-profiles/:id", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const profile = await storage.getCompanyProfile(req.params.id, tenantId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/company-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId || userId; // Fallback to userId if no tenantId (single-tenant mode)

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const data = insertCompanyProfileSchema.parse({ ...req.body, userId, tenantId });

      // GSTIN VALIDATION (if provided)
      if (data.gstNo) {
        const gstValidation = validateGSTIN(data.gstNo);
        if (!gstValidation.valid) {
          return res.status(400).json({
            message: "Invalid GSTIN",
            error: gstValidation.error
          });
        }

        // Auto-derive PAN and State from GSTIN
        data.panNo = extractPANFromGST(data.gstNo);
        const stateInfo = getStateFromGST(data.gstNo);
        if (stateInfo) {
          data.stateCode = stateInfo.code;
          data.stateName = stateInfo.name;
        }
      }

      // Check if financial documents exist (for this tenant)
      const existingQuotes = await storage.getQuotesByTenant(tenantId);
      const hasSentQuotes = existingQuotes.some((q: any) => q.status === 'sent' || q.status === 'accepted');

      if (hasSentQuotes) {
        data.hasFinancialDocs = true;
        data.lockedAt = new Date();
        data.lockedReason = 'Quote already sent to customer';
      }

      // Preflight: if GST already exists anywhere, reuse/update it to current tenant to avoid unique collisions
      if (data.gstNo) {
        const existingTenantProfile = await storage.getCompanyProfileByGst(data.gstNo, tenantId);
        if (existingTenantProfile) {
          const updated = await storage.updateCompanyProfile(existingTenantProfile.id, data, tenantId);
          console.warn('[Company Profile] Reused existing tenant GST profile', { tenantId, profileId: existingTenantProfile.id });
          return res.status(200).json(updated);
        }

        const legacyProfile = await storage.getAnyCompanyProfileByGst(data.gstNo);
        if (legacyProfile) {
          const updated = await storage.updateCompanyProfile(legacyProfile.id, { ...data, tenantId }, tenantId);
          console.warn('[Company Profile] Adopted legacy GST profile into tenant', { tenantId, profileId: legacyProfile.id });
          return res.status(200).json(updated);
        }
      }

      // Create fresh profile if no conflicts
      const profile = await storage.createCompanyProfile(data);
      return res.status(201).json(profile);
    } catch (error: any) {
      console.error("Error creating company profile:", error);
      res.status(500).json({ message: error.message || "Failed to create profile" });
    }
  });

  app.patch("/api/company-profiles/:id", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId || userId; // Fallback to userId if no tenantId (single-tenant mode)
      const profileId = req.params.id;

      // DEBUG: Log auth context
      console.log('[BUSINESS PROFILE PATCH] Auth Debug:', {
        userId,
        reqUser: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null,
        clerkUser: req.clerkUser ? { id: req.clerkUser.id, email: req.clerkUser.email } : null,
        tenantId,
        profileId
      });

      if (!userId) {
        console.error('[BUSINESS PROFILE PATCH] No userId in request - auth middleware failed');
        return res.status(401).json({ message: "Unauthorized: No user ID" });
      }

      // Fetch existing profile to check lock status
      const existingProfile = await storage.getCompanyProfile(profileId, tenantId);

      if (!existingProfile) {
        console.log('[BUSINESS PROFILE PATCH] Profile not found:', { profileId, tenantId });
        return res.status(404).json({ message: "Profile not found" });
      }

      // DEBUG: Log ownership comparison
      console.log('[BUSINESS PROFILE PATCH] Ownership check:', {
        existingProfileUserId: existingProfile.userId,
        requestUserId: userId,
        match: existingProfile.userId === userId
      });

      // Check onboarding status to determine if ownership check should be bypassed
      const onboardingStatus = await storage.getOnboardingStatus(userId);
      const isOnboarding = onboardingStatus && onboardingStatus.verificationStatus !== 'approved';

      if (isOnboarding) {
        // During onboarding: Allow creator to edit their own profile
        if (existingProfile.userId !== userId) {
          console.log('[BUSINESS PROFILE PATCH] Ownership mismatch during onboarding');
          return res.status(403).json({
            message: "You can only edit your own business profile during onboarding"
          });
        }
      } else {
        // After verification: Only profile owner or super_admin can edit
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
        const isProfileOwner = existingProfile.userId === userId;

        console.log('[BUSINESS PROFILE PATCH] Post-verification auth check:', {
          isSuperAdmin,
          isProfileOwner,
          userRole: user?.role
        });

        if (!isSuperAdmin && !isProfileOwner) {
          console.log('[BUSINESS PROFILE PATCH] Access denied - not owner or admin');
          return res.status(403).json({
            message: "Only the account owner can edit business profile details"
          });
        }
      }

      const updates = insertCompanyProfileSchema.partial().parse(req.body);

      // INVOICE-SAFE LOCKING ENFORCEMENT
      if (existingProfile.hasFinancialDocs) {
        const attemptedLockedFields = Object.keys(updates).filter(key =>
          LOCKED_LEGAL_FIELDS.includes(key as LockedLegalField)
        );

        if (attemptedLockedFields.length > 0) {
          return res.status(403).json({
            message: "Cannot modify legal fields after financial documents have been issued",
            lockedFields: attemptedLockedFields,
            lockedReason: existingProfile.lockedReason,
            lockedAt: existingProfile.lockedAt,
          });
        }
      }

      // GSTIN VALIDATION (if GSTIN is being updated)
      if (updates.gstNo) {
        const gstValidation = validateGSTIN(updates.gstNo);
        if (!gstValidation.valid) {
          return res.status(400).json({
            message: "Invalid GSTIN",
            error: gstValidation.error
          });
        }

        // Auto-derive PAN and State from new GSTIN
        updates.panNo = extractPANFromGST(updates.gstNo);
        const stateInfo = getStateFromGST(updates.gstNo);
        if (stateInfo) {
          updates.stateCode = stateInfo.code;
          updates.stateName = stateInfo.name;
        }
      }

      // PREVENT MANUAL OVERRIDE of auto-derived fields
      if (existingProfile.gstNo && !updates.gstNo) {
        // If GST exists and not being changed, don't allow PAN/state manual edit
        delete updates.panNo;
        delete updates.stateCode;
        delete updates.stateName;
      }

      const updatedProfile = await storage.updateCompanyProfile(
        profileId,
        updates,
        tenantId
      );

      res.json(updatedProfile);
    } catch (error: any) {
      console.error("Error updating company profile:", error);
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.post("/api/company-profiles/:id/set-default", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      await storage.setDefaultCompanyProfile(req.params.id, userId, tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to set default profile" });
    }
  });

  // Lock company profile after first financial document
  app.post("/api/company-profiles/:id/lock", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const profileId = req.params.id;
      const { reason } = req.body;

      const profile = await storage.getCompanyProfile(profileId, tenantId);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      if (profile.hasFinancialDocs) {
        return res.status(400).json({ message: "Profile already locked" });
      }

      const updatedProfile = await storage.updateCompanyProfile(
        profileId,
        {
          hasFinancialDocs: true,
          lockedAt: new Date(),
          lockedReason: reason || 'Financial document issued',
        },
        tenantId
      );

      res.json({
        success: true,
        message: 'Legal fields locked successfully',
        profile: updatedProfile
      });
    } catch (error: any) {
      console.error("Error locking profile:", error);
      res.status(500).json({ message: error.message || "Failed to lock profile" });
    }
  });

  // Party Profiles (protected, tenant-scoped)
  app.get("/api/party-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const profiles = await storage.getAllPartyProfiles(userId, tenantId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch party profiles" });
    }
  });

  app.get("/api/party-profiles/search", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const search = req.query.q as string || "";
      const profiles = await storage.searchPartyProfiles(userId, search, tenantId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to search party profiles" });
    }
  });

  app.post("/api/party-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      // Include tenantId in creation - never accept from frontend
      const data = insertPartyProfileSchema.parse({ ...req.body, userId, tenantId });
      const profile = await storage.createPartyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid party profile data" });
    }
  });

  app.patch("/api/party-profiles/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertPartyProfileSchema.partial().parse(req.body);
      const tenantId = req.tenantId;
      const profile = await storage.updatePartyProfile(req.params.id, data, tenantId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(400).json({ error: "Failed to update party profile" });
    }
  });

  app.delete("/api/party-profiles/:id", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const success = await storage.deletePartyProfile(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === "PARTY_HAS_QUOTES") {
        return res.status(409).json({ 
          error: "Cannot delete party with existing quotes. Please delete all related quotes first." 
        });
      }
      res.status(500).json({ error: "Failed to delete party profile" });
    }
  });

  // Quotes (protected, tenant-scoped)
  app.get("/api/quotes", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const partyName = req.query.partyName as string | undefined;
      const boxName = req.query.boxName as string | undefined;
      const boxSize = req.query.boxSize as string | undefined;
      const includeItems = req.query.include === 'items';
      
      if (includeItems) {
        // Return quotes with their active version items (for reports)
        const quotes = await storage.getAllQuotesWithItems(userId, tenantId);
        return res.json(quotes);
      }
      
      if (partyName || boxName || boxSize) {
        const quotes = await storage.searchQuotes(userId, { partyName, boxName, boxSize }, tenantId);
        res.json(quotes);
      } else {
        const quotes = await storage.getAllQuotes(userId, tenantId);
        res.json(quotes);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const quote = await storage.getQuote(req.params.id, tenantId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes", combinedAuth, async (req: any, res) => {
    // ==================== TRACE LOG 1: ENTRY ====================
    console.log("QUOTE SAVE HIT", JSON.stringify(req.body, null, 2));
    
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const { items, paymentTerms, deliveryDays, transportCharge, transportRemark, totalValue, boardThickness, partyId, ...quoteData } = req.body;
      
      // VALIDATION: Ensure required fields exist
      if (!partyId) {
        console.log("QUOTE SAVE VALIDATION FAILED: Missing partyId");
        return res.status(400).json({ success: false, error: "Party is required. Please select a customer." });
      }
      if (!items || items.length === 0) {
        console.log("QUOTE SAVE VALIDATION FAILED: No items");
        return res.status(400).json({ success: false, error: "At least one item is required." });
      }
      
      // Validate items have valid qty and rate
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          console.log(`QUOTE SAVE VALIDATION FAILED: Item ${i + 1} has invalid quantity`);
          return res.status(400).json({ success: false, error: `Item ${i + 1}: Quantity must be a positive number.` });
        }
      }
      
      // ==================== TRACE LOG 2: VALIDATION PASSED ====================
      console.log("QUOTE PAYLOAD VALID");
      console.log("[Quote Save] User ID:", userId);
      console.log("[Quote Save] Party ID:", partyId);
      console.log("[Quote Save] Items count:", items.length);
      
      // Get flute settings for snapshot
      const fluteSettingsData = await storage.getFluteSettings(userId);
      const fluteFactors: Record<string, number> = {};
      const fluteHeights: Record<string, number> = {};
      fluteSettingsData.forEach((s: any) => {
        fluteFactors[s.fluteType] = s.flutingFactor || 1.35;
        fluteHeights[s.fluteType] = s.fluteHeight || 2.5;
      });
      
      // Get business defaults for GST snapshot (India GST for Corrugated Boxes = 5%)
      const businessDefaults = await storage.getBusinessDefaults(userId);
      const gstPercent = businessDefaults?.defaultGstPercent ?? 5;
      const roundOffEnabled = businessDefaults?.roundOffEnabled ?? true;
      
      // DUPLICATE DETECTION: Check if a quote with same Party+BoxName+BoxSize exists
      let existingQuote = null;
      let isNewVersion = false;
      
      if (partyId && items && items.length > 0) {
        // Get all existing quotes for this party (tenant-scoped)
        const existingQuotes = await storage.getQuotesByPartyId(partyId, userId, tenantId);
        
        // For each existing quote, check if any item matches by boxName+dimensions
        for (const eq of existingQuotes) {
          if (eq.activeVersionId) {
            const versionItems = await storage.getQuoteItemVersionsByVersionId(eq.activeVersionId);
            
            // Check if any new item matches an existing item
            for (const newItem of items) {
              const matchingItem = versionItems.find((vi: any) => {
                const boxNameMatch = vi.boxName?.toLowerCase() === (newItem.boxName || '').toLowerCase();
                const lengthMatch = Math.abs((vi.length || 0) - (newItem.length || 0)) < 1; // 1mm tolerance
                const widthMatch = Math.abs((vi.width || 0) - (newItem.width || 0)) < 1;
                const heightMatch = !newItem.height || Math.abs((vi.height || 0) - (newItem.height || 0)) < 1;
                return boxNameMatch && lengthMatch && widthMatch && heightMatch;
              });
              
              if (matchingItem) {
                existingQuote = eq;
                isNewVersion = true;
                break;
              }
            }
            if (existingQuote) break;
          }
        }
      }
      
      let quote;
      let quoteNo: string;
      
      // ==================== TRACE LOG 3: STARTING TRANSACTION ====================
      console.log("STARTING QUOTE TRANSACTION");
      
      if (existingQuote && isNewVersion) {
        // Use existing quote, will create new version
        quote = existingQuote;
        quoteNo = quote.quoteNo;
        console.log("USING EXISTING QUOTE FOR NEW VERSION:", quote.id);
      } else {
        // Generate new quote number and create new quote (tenant-scoped)
        quoteNo = await storage.generateQuoteNumber(userId, tenantId);
        console.log("GENERATED QUOTE NO:", quoteNo);
        
        // Create the quote record with tenant isolation
        quote = await storage.createQuote({
          ...quoteData,
          partyId,
          userId,
          tenantId, // Multi-tenant isolation - never accept from frontend
          quoteNo,
          status: 'draft',
          totalValue: 0, // Initial value, will be updated when version is created
        });
        
        // ==================== TRACE LOG 4: QUOTE CREATED ====================
        console.log("QUOTE CREATED", quote?.id || "UNDEFINED!");
        if (!quote || !quote.id) {
          throw new Error("Quote creation failed - no ID returned");
        }
      }
      
      // Calculate totals with round-off logic
      const subtotal = items?.reduce((sum: number, item: any) => sum + (item.totalValue || 0), 0) || 0;
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const rawTotal = subtotal + gstAmount + (transportCharge || 0);
      
      // Apply round-off if enabled (round to nearest rupee)
      let finalTotal: number;
      let roundOffValue: number = 0;
      if (roundOffEnabled) {
        finalTotal = Math.round(rawTotal);
        roundOffValue = parseFloat((finalTotal - rawTotal).toFixed(2));
      } else {
        finalTotal = parseFloat(rawTotal.toFixed(2));
      }
      
      // ==================== TRACE LOG 5: TOTALS CALCULATED ====================
      console.log("TOTALS", { subtotal, gstAmount, rawTotal, roundOffEnabled, roundOffValue, finalTotal, transportCharge: transportCharge || 0 });
      
      // Get next version number (1 for new quotes, next number for existing)
      const versionNo = isNewVersion ? await storage.getNextVersionNumber(quote.id) : 1;
      console.log("VERSION NUMBER:", versionNo);
      
      // Create quote version with snapshots
      const version = await storage.createQuoteVersion({
        quoteId: quote.id,
        versionNo,
        paymentTerms: paymentTerms || null,
        deliveryDays: deliveryDays || null,
        transportCharge: transportCharge || null,
        transportRemark: transportRemark || null,
        subtotal,
        gstPercent,
        gstAmount,
        roundOffEnabled,
        roundOffValue,
        finalTotal,
        isNegotiated: false,
        isLocked: false,
        // Snapshot board thickness
        boardThicknessMm: boardThickness || null,
        // Snapshot flute factors and heights (actual user settings, not defaults)
        fluteFactorA: fluteFactors['A'] ?? null,
        fluteFactorB: fluteFactors['B'] ?? null,
        fluteFactorC: fluteFactors['C'] ?? null,
        fluteFactorE: fluteFactors['E'] ?? null,
        fluteFactorF: fluteFactors['F'] ?? null,
        fluteHeightA: fluteHeights['A'] ?? null,
        fluteHeightB: fluteHeights['B'] ?? null,
        fluteHeightC: fluteHeights['C'] ?? null,
        fluteHeightE: fluteHeights['E'] ?? null,
        fluteHeightF: fluteHeights['F'] ?? null,
        createdBy: userId,
      });
      
      // ==================== TRACE LOG 6: VERSION CREATED ====================
      console.log("VERSION CREATED", version?.id || "UNDEFINED!");
      if (!version || !version.id) {
        throw new Error("Version creation failed - no ID returned");
      }
      
      // Create quote item versions with full snapshot data
      if (items && items.length > 0) {
        const itemVersions = items.map((item: any, index: number) => {
          const originalCost = item.totalCostPerBox || 0;
          const negotiatedCost = item.negotiatedPrice || null;
          const finalCost = negotiatedCost || originalCost;
          const qty = item.quantity || 0;
          
          // Include negotiation metadata in the snapshot
          const itemSnapshot = {
            ...item,
            negotiationMode: item.negotiationMode || 'none',
            negotiationValue: item.negotiationValue || null,
            originalCostPerBox: originalCost,
            negotiatedPrice: negotiatedCost,
          };
          
          return {
            quoteVersionId: version.id,
            itemIndex: index,
            itemType: item.itemType || 'rsc',
            boxName: item.boxName || 'Unnamed',
            boxDescription: item.boxDescription || null,
            ply: item.ply || '5',
            length: item.length || 0,
            width: item.width || 0,
            height: item.height || null,
            quantity: qty,
            sheetLength: item.sheetLength || null,
            sheetWidth: item.sheetWidth || null,
            sheetWeight: item.sheetWeight || null,
            originalCostPerBox: originalCost,
            negotiatedCostPerBox: negotiatedCost,
            finalCostPerBox: finalCost,
            originalTotalCost: originalCost * qty,
            negotiatedTotalCost: negotiatedCost ? negotiatedCost * qty : null,
            finalTotalCost: finalCost * qty,
            itemDataSnapshot: itemSnapshot, // Full item data with negotiation metadata
          };
        });
        await storage.createQuoteItemVersions(itemVersions);
        
        // ==================== TRACE LOG 7: ITEMS SAVED ====================
        console.log("ITEMS SAVED", itemVersions.length);
      }
      
      // Update quote with active version ID AND calculated totalValue (CRITICAL FIX)
      const updatedQuote = await storage.updateQuote(quote.id, { 
        activeVersionId: version.id,
        totalValue: finalTotal  // This was missing - totalValue was always 0
      }, tenantId);
      
      // ==================== TRACE LOG 8: QUOTE UPDATED ====================
      console.log("QUOTE UPDATED WITH TOTAL", { 
        quoteId: quote.id, 
        activeVersionId: version.id, 
        totalValue: finalTotal,
        updateResult: updatedQuote ? "SUCCESS" : "FAILED"
      });
      
      if (!updatedQuote) {
        console.error("CRITICAL: Quote update returned undefined!");
        throw new Error("Failed to update quote with final total");
      }
      
      // ==================== TRACE LOG 9: SUCCESS ====================
      console.log("QUOTE SAVE SUCCESS", {
        quoteId: quote.id,
        quoteNo,
        versionNo,
        subtotal,
        gstAmount,
        finalTotal,
        isNewVersion
      });
      
      // Return clear success response with all info frontend needs
      res.status(201).json({
        success: true,
        quoteId: quote.id,
        quoteNo,
        versionNo,
        isNewVersion, // True if this was added to an existing quote
        totalValue: finalTotal,
        activeVersionId: version.id,
      });
    } catch (error: any) {
      // ==================== HARD FAIL ERROR HANDLING ====================
      console.error("QUOTE SAVE ERROR", error);
      console.error("QUOTE SAVE ERROR MESSAGE:", error?.message || 'Unknown error');
      console.error("QUOTE SAVE ERROR STACK:", error?.stack || 'No stack trace');
      
      res.status(500).json({ 
        success: false, 
        error: error?.message || "Quote save failed",
        message: error?.message || "Quote save failed"
      });
    }
  });

  app.patch("/api/quotes/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertQuoteSchema.partial().parse(req.body);
      const tenantId = req.tenantId;
      const quote = await storage.updateQuote(req.params.id, data, tenantId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(400).json({ error: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const success = await storage.deleteQuote(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Create new quote version (for edits or negotiation)
  // Every edit creates a new version; negotiation locks the version
  app.post("/api/quotes/:id/versions", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;
      const { items, isNegotiated, negotiationType, negotiationValue, boardThickness, ...versionData } = req.body;
      
      // Get existing quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Get next version number
      const versionNo = await storage.getNextVersionNumber(quoteId);
      
      // Get flute settings for snapshot (use actual user settings, not defaults)
      const fluteSettingsData = await storage.getFluteSettings(userId);
      const fluteFactors: Record<string, number | null> = {};
      const fluteHeights: Record<string, number | null> = {};
      fluteSettingsData.forEach((s: any) => {
        fluteFactors[s.fluteType] = s.flutingFactor;
        fluteHeights[s.fluteType] = s.fluteHeight;
      });
      
      // Get business defaults for GST snapshot (India GST for Corrugated Boxes = 5%)
      const businessDefaults = await storage.getBusinessDefaults(userId);
      const gstPercent = businessDefaults?.defaultGstPercent ?? 5;
      const roundOffEnabled = businessDefaults?.roundOffEnabled ?? true;
      
      // Calculate totals with round-off
      const subtotal = items?.reduce((sum: number, item: any) => {
        const price = item.negotiatedPrice || item.totalCostPerBox || 0;
        const qty = item.quantity || 0;
        return sum + (price * qty);
      }, 0) || 0;
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const transportCharge = versionData.transportCharge || 0;
      const rawTotal = subtotal + gstAmount + transportCharge;
      
      // Apply round-off if enabled
      let finalTotal: number;
      let roundOffValue: number = 0;
      if (roundOffEnabled) {
        finalTotal = Math.round(rawTotal);
        roundOffValue = parseFloat((finalTotal - rawTotal).toFixed(2));
      } else {
        finalTotal = parseFloat(rawTotal.toFixed(2));
      }
      
      // Create new version (negotiated versions are locked)
      const version = await storage.createQuoteVersion({
        quoteId,
        versionNo,
        paymentTerms: versionData.paymentTerms || null,
        deliveryDays: versionData.deliveryDays || null,
        transportCharge: versionData.transportCharge || null,
        transportRemark: versionData.transportRemark || null,
        subtotal,
        gstPercent,
        gstAmount,
        roundOffEnabled,
        roundOffValue,
        finalTotal,
        isNegotiated: isNegotiated || false,
        negotiationType: negotiationType || null,
        negotiationValue: negotiationValue != null ? Number(negotiationValue) : null,
        isLocked: isNegotiated || false, // Lock negotiated versions
        // Snapshot board thickness
        boardThicknessMm: boardThickness || null,
        // Snapshot flute factors and heights (actual user settings, not defaults)
        fluteFactorA: fluteFactors['A'] ?? null,
        fluteFactorB: fluteFactors['B'] ?? null,
        fluteFactorC: fluteFactors['C'] ?? null,
        fluteFactorE: fluteFactors['E'] ?? null,
        fluteFactorF: fluteFactors['F'] ?? null,
        fluteHeightA: fluteHeights['A'] ?? null,
        fluteHeightB: fluteHeights['B'] ?? null,
        fluteHeightC: fluteHeights['C'] ?? null,
        fluteHeightE: fluteHeights['E'] ?? null,
        fluteHeightF: fluteHeights['F'] ?? null,
        createdBy: userId,
      });
      
      // Create quote item versions with negotiation metadata
      if (items && items.length > 0) {
        const itemVersions = items.map((item: any, index: number) => {
          const originalCost = item.totalCostPerBox || 0;
          const negotiatedCost = item.negotiatedPrice || null;
          const finalCost = negotiatedCost || originalCost;
          const qty = item.quantity || 0;
          
          // Include negotiation metadata in the snapshot
          const itemSnapshot = {
            ...item,
            negotiationMode: item.negotiationMode || 'none',
            negotiationValue: item.negotiationValue || null,
            originalCostPerBox: originalCost,
            negotiatedPrice: negotiatedCost,
          };
          
          return {
            quoteVersionId: version.id,
            itemIndex: index,
            itemType: item.itemType || 'rsc',
            boxName: item.boxName || 'Unnamed',
            boxDescription: item.boxDescription || null,
            ply: item.ply || '5',
            length: item.length || 0,
            width: item.width || 0,
            height: item.height || null,
            quantity: qty,
            sheetLength: item.sheetLength || null,
            sheetWidth: item.sheetWidth || null,
            sheetWeight: item.sheetWeight || null,
            originalCostPerBox: originalCost,
            negotiatedCostPerBox: negotiatedCost,
            finalCostPerBox: finalCost,
            originalTotalCost: originalCost * qty,
            negotiatedTotalCost: negotiatedCost ? negotiatedCost * qty : null,
            finalTotalCost: finalCost * qty,
            itemDataSnapshot: itemSnapshot, // Full item data with negotiation metadata
          };
        });
        await storage.createQuoteItemVersions(itemVersions);
      }
      
      // Archive previous version if one exists
      if (quote.activeVersionId) {
        await storage.archiveQuoteVersion(quote.activeVersionId);
      }
      
      // Update quote with new active version ID AND totalValue (CRITICAL FIX)
      const tenantId = req.tenantId;
      await storage.updateQuote(quoteId, { 
        activeVersionId: version.id,
        totalValue: finalTotal
      }, tenantId);
      
      // Log version creation for audit trail
      console.log("[Audit] Quote version created:", {
        action: "QUOTE_VERSION_CREATED",
        quoteId,
        quoteNo: quote.quoteNo,
        versionNo,
        previousVersionId: quote.activeVersionId,
        newVersionId: version.id,
        userId,
        timestamp: new Date().toISOString()
      });
      
      console.log("[Quote Version] Version created successfully:");
      console.log("[Quote Version] - Quote ID:", quoteId);
      console.log("[Quote Version] - Version No:", versionNo);
      console.log("[Quote Version] - Final Total:", finalTotal);
      
      res.status(201).json({
        success: true,
        quoteId,
        quoteNo: quote.quoteNo,
        versionNo,
        totalValue: finalTotal,
        activeVersionId: version.id,
        isNegotiated: isNegotiated || false,
      });
    } catch (error) {
      console.error("Failed to create quote version:", error);
      res.status(400).json({ error: "Failed to create quote version" });
    }
  });

  // Get all versions for a quote
  app.get("/api/quotes/:id/versions", combinedAuth, async (req: any, res) => {
    try {
      const versions = await storage.getQuoteVersionsByQuoteId(req.params.id);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote versions" });
    }
  });

  // Get quote with active version and items
  app.get("/api/quotes/:id/full", combinedAuth, async (req: any, res) => {
    try {
      const result = await storage.getQuoteWithActiveVersion(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote details" });
    }
  });

  // Generate branded Quote PDF
  app.get("/api/quotes/:id/pdf", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;
      
      // Get quote with active version and items
      const quoteData = await storage.getQuoteWithActiveVersion(quoteId);
      if (!quoteData) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Verify quote belongs to user
      if (quoteData.quote.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get business profile
      const companyProfile = await storage.getCompanyProfile(userId);
      const businessDefaults = await storage.getBusinessDefaults(userId);
      
      // Import PDFKit
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Quote_${quoteData.quote.quoteNo}.pdf`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      const { quote, version, items } = quoteData;
      
      // Header - Company Info
      doc.fontSize(20).font('Helvetica-Bold')
         .text(companyProfile?.companyName || 'BoxCost Pro', { align: 'center' });
      
      if (companyProfile?.address) {
        doc.fontSize(10).font('Helvetica')
           .text(companyProfile.address, { align: 'center' });
      }
      if (companyProfile?.phone || companyProfile?.email) {
        doc.fontSize(10)
           .text(`${companyProfile?.phone || ''} | ${companyProfile?.email || ''}`, { align: 'center' });
      }
      if (companyProfile?.gstNo) {
        doc.fontSize(10).text(`GSTIN: ${companyProfile.gstNo}`, { align: 'center' });
      }
      
      doc.moveDown(1.5);
      
      // Quote Title
      doc.fontSize(16).font('Helvetica-Bold')
         .text('QUOTATION', { align: 'center' });
      doc.moveDown(0.5);
      
      // Quote Details Box
      const leftCol = 50;
      const rightCol = 350;
      
      doc.fontSize(10).font('Helvetica-Bold').text('Quote Details', leftCol);
      doc.moveDown(0.3);
      doc.font('Helvetica')
         .text(`Quote No: ${quote.quoteNo}`, leftCol)
         .text(`Version: ${version?.versionNo || 1}`, leftCol)
         .text(`Date: ${new Date(quote.createdAt || Date.now()).toLocaleDateString('en-IN')}`, leftCol);
      
      // Party Details
      doc.font('Helvetica-Bold').text('Bill To:', rightCol, doc.y - 45);
      doc.font('Helvetica')
         .text(quote.partyName || 'Customer', rightCol)
         .text(quote.customerCompany || '', rightCol)
         .text(quote.customerMobile || '', rightCol);
      
      doc.moveDown(1.5);
      
      // Items Table Header
      const tableTop = doc.y;
      const colWidths = [30, 160, 50, 70, 70, 70];
      const cols = [50, 80, 240, 290, 360, 430];
      
      doc.font('Helvetica-Bold').fontSize(9)
         .text('Sr.', cols[0], tableTop)
         .text('Item Description', cols[1], tableTop)
         .text('Qty', cols[2], tableTop)
         .text('Rate', cols[3], tableTop)
         .text('Amount', cols[4], tableTop);
      
      // Draw header line
      doc.moveTo(50, tableTop + 12).lineTo(530, tableTop + 12).stroke();
      
      // Items
      let y = tableTop + 20;
      items.forEach((item: any, index: number) => {
        const qty = item.quantity || 0;
        const rate = item.finalCostPerBox || item.originalCostPerBox || 0;
        const amount = item.finalTotalCost || (rate * qty);
        
        const description = `${item.boxName || 'Box'} - ${item.ply || '5'} Ply | ${item.length || 0}x${item.width || 0}${item.height ? 'x' + item.height : ''} mm`;
        
        doc.font('Helvetica').fontSize(9)
           .text((index + 1).toString(), cols[0], y)
           .text(description.substring(0, 40), cols[1], y)
           .text(qty.toString(), cols[2], y)
           .text(`₹${rate.toFixed(2)}`, cols[3], y)
           .text(`₹${amount.toFixed(2)}`, cols[4], y);
        
        y += 18;
        
        // Page break if needed
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });
      
      // Draw line after items
      doc.moveTo(50, y).lineTo(530, y).stroke();
      y += 15;
      
      // Totals
      const totalsX = 380;
      
      doc.font('Helvetica').fontSize(10)
         .text('Subtotal:', totalsX, y)
         .text(`₹${(version?.subtotal || 0).toFixed(2)}`, 480, y, { width: 50, align: 'right' });
      y += 18;
      
      doc.text(`GST @ ${version?.gstPercent || 18}%:`, totalsX, y)
         .text(`₹${(version?.gstAmount || 0).toFixed(2)}`, 480, y, { width: 50, align: 'right' });
      y += 18;
      
      if (version?.transportCharge) {
        doc.text('Transport:', totalsX, y)
           .text(`₹${version.transportCharge.toFixed(2)}`, 480, y, { width: 50, align: 'right' });
        y += 18;
      }
      
      doc.font('Helvetica-Bold')
         .text('Grand Total:', totalsX, y)
         .text(`₹${(version?.finalTotal || 0).toFixed(2)}`, 480, y, { width: 50, align: 'right' });
      
      y += 30;
      
      // Payment & Delivery Terms
      if (version?.paymentTerms || version?.deliveryDays) {
        doc.font('Helvetica-Bold').fontSize(10).text('Terms & Conditions:', 50, y);
        y += 15;
        doc.font('Helvetica').fontSize(9);
        
        if (version?.paymentTerms) {
          doc.text(`Payment Terms: ${version.paymentTerms}`, 50, y);
          y += 12;
        }
        if (version?.deliveryDays) {
          doc.text(`Delivery: ${version.deliveryDays} days`, 50, y);
          y += 12;
        }
      }
      
      // Footer
      doc.fontSize(8).font('Helvetica')
         .text('Generated by BoxCost Pro', 50, 750, { align: 'center' });
      
      doc.end();
      
      console.log("[PDF] Generated PDF for Quote:", quote.quoteNo);
      
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Bulk negotiate: Update negotiated prices for multiple items across quotes
  // Creates a new version for each affected quote with negotiated prices
  app.post("/api/quotes/:id/bulk-negotiate", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;
      const { negotiations } = req.body; // Array of { itemIndex, negotiatedPrice }
      
      if (!negotiations || !Array.isArray(negotiations) || negotiations.length === 0) {
        return res.status(400).json({ error: "No negotiations provided" });
      }
      
      // Get existing quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Get current active version and items
      const quoteData = await storage.getQuoteWithActiveVersion(quoteId);
      if (!quoteData || !quoteData.version) {
        return res.status(400).json({ error: "Quote has no active version" });
      }
      
      const existingItems = quoteData.items || [];
      
      // Get next version number
      const versionNo = await storage.getNextVersionNumber(quoteId);
      
      // Get flute settings for snapshot
      const fluteSettingsData = await storage.getFluteSettings(userId);
      const fluteFactors: Record<string, number | null> = {};
      const fluteHeights: Record<string, number | null> = {};
      fluteSettingsData.forEach((s: any) => {
        fluteFactors[s.fluteType] = s.flutingFactor;
        fluteHeights[s.fluteType] = s.fluteHeight;
      });
      
      // Get business defaults for GST snapshot (India GST for Corrugated Boxes = 5%)
      const businessDefaults = await storage.getBusinessDefaults(userId);
      const gstPercent = businessDefaults?.defaultGstPercent ?? 5;
      const roundOffEnabled = businessDefaults?.roundOffEnabled ?? true;
      
      // Create negotiation map for quick lookup
      const negotiationMap = new Map<number, number>();
      negotiations.forEach((n: { itemIndex: number; negotiatedPrice: number }) => {
        negotiationMap.set(n.itemIndex, n.negotiatedPrice);
      });
      
      // Apply negotiated prices to items
      const updatedItems = existingItems.map((item: any, idx: number) => {
        const newNegotiatedPrice = negotiationMap.get(idx);
        if (newNegotiatedPrice !== undefined) {
          return {
            ...item,
            negotiatedPrice: newNegotiatedPrice,
            negotiationMode: 'fixed',
            negotiationValue: newNegotiatedPrice,
            originalPrice: item.totalCostPerBox || item.originalPrice,
          };
        }
        return item;
      });
      
      // Calculate totals with round-off
      const subtotal = updatedItems.reduce((sum: number, item: any) => {
        const price = item.negotiatedPrice || item.totalCostPerBox || 0;
        const qty = item.quantity || 0;
        return sum + (price * qty);
      }, 0);
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const transportCharge = quoteData.version.transportCharge || 0;
      const rawTotal = subtotal + gstAmount + transportCharge;
      
      // Apply round-off if enabled
      let finalTotal: number;
      let roundOffValue: number = 0;
      if (roundOffEnabled) {
        finalTotal = Math.round(rawTotal);
        roundOffValue = parseFloat((finalTotal - rawTotal).toFixed(2));
      } else {
        finalTotal = parseFloat(rawTotal.toFixed(2));
      }
      
      // Create new version (locked because it's negotiated)
      const newVersion = await storage.createQuoteVersion({
        quoteId,
        versionNo,
        paymentTerms: quoteData.version.paymentTerms || null,
        deliveryDays: quoteData.version.deliveryDays || null,
        transportCharge: quoteData.version.transportCharge || null,
        transportRemark: quoteData.version.transportRemark || null,
        subtotal,
        gstPercent,
        gstAmount,
        roundOffEnabled,
        roundOffValue,
        finalTotal,
        isNegotiated: true,
        negotiationType: 'bulk',
        negotiationValue: null,
        isLocked: true, // Lock negotiated versions
        boardThicknessMm: quoteData.version.boardThicknessMm || null,
        fluteFactorA: fluteFactors['A'] ?? null,
        fluteFactorB: fluteFactors['B'] ?? null,
        fluteFactorC: fluteFactors['C'] ?? null,
        fluteFactorE: fluteFactors['E'] ?? null,
        fluteFactorF: fluteFactors['F'] ?? null,
        fluteHeightA: fluteHeights['A'] ?? null,
        fluteHeightB: fluteHeights['B'] ?? null,
        fluteHeightC: fluteHeights['C'] ?? null,
        fluteHeightE: fluteHeights['E'] ?? null,
        fluteHeightF: fluteHeights['F'] ?? null,
      });
      
      // Create item versions
      if (updatedItems.length > 0) {
        const itemVersions = updatedItems.map((item: any, index: number) => {
          const originalCost = parseFloat(item.totalCostPerBox || item.originalPrice || 0);
          const negotiatedCost = item.negotiatedPrice ? parseFloat(item.negotiatedPrice) : null;
          const finalCost = negotiatedCost || originalCost;
          const qty = item.quantity || 1;
          
          const itemSnapshot = {
            ...item,
            negotiationMode: item.negotiationMode || 'none',
            negotiationValue: item.negotiationValue || null,
            originalCostPerBox: originalCost,
          };
          
          return {
            quoteVersionId: newVersion.id,
            itemIndex: index,
            itemType: item.type || item.itemType || 'rsc',
            boxName: item.boxName || 'Unnamed',
            boxDescription: item.boxDescription || null,
            ply: item.ply || '5',
            length: item.length || 0,
            width: item.width || 0,
            height: item.height || null,
            quantity: qty,
            sheetLength: item.sheetLength || null,
            sheetWidth: item.sheetWidth || null,
            sheetWeight: item.sheetWeight || null,
            originalCostPerBox: originalCost,
            negotiatedCostPerBox: negotiatedCost,
            finalCostPerBox: finalCost,
            originalTotalCost: originalCost * qty,
            negotiatedTotalCost: negotiatedCost ? negotiatedCost * qty : null,
            finalTotalCost: finalCost * qty,
            itemDataSnapshot: itemSnapshot,
          };
        });
        await storage.createQuoteItemVersions(itemVersions);
      }
      
      // Update quote with new active version ID AND totalValue (CRITICAL FIX)
      const tenantId2 = req.tenantId;
      await storage.updateQuote(quoteId, { 
        activeVersionId: newVersion.id,
        totalValue: newVersion.finalTotal
      }, tenantId2);
      
      console.log("[Bulk Negotiate] Negotiation saved successfully:");
      console.log("[Bulk Negotiate] - Quote ID:", quoteId);
      console.log("[Bulk Negotiate] - Version No:", newVersion.versionNo);
      console.log("[Bulk Negotiate] - Final Total:", newVersion.finalTotal);
      
      res.status(201).json({
        success: true,
        versionId: newVersion.id,
        versionNo: newVersion.versionNo,
        quoteNo: quote.quoteNo,
        totalValue: newVersion.finalTotal,
      });
    } catch (error) {
      console.error("Failed to bulk negotiate:", error);
      res.status(400).json({ error: "Failed to save negotiated prices" });
    }
  });

  // Rate Memory (protected, tenant-scoped)
  app.get("/api/rate-memory", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      const rates = await storage.getAllRateMemory(tenantId, userId);
      res.json(rates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate memory" });
    }
  });

  app.get("/api/rate-memory/:bf/:shade", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      const rate = await storage.getRateMemoryByKey(req.params.bf, req.params.shade, tenantId, userId);
      if (!rate) {
        return res.status(404).json({ error: "Rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate" });
    }
  });

  app.post("/api/rate-memory", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      const { bfValue, shade, rate } = req.body;
      const saved = await storage.saveOrUpdateRateMemory(bfValue, shade, rate, tenantId, userId);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save rate" });
    }
  });

  // App Settings (protected, tenant-scoped)
  app.get("/api/settings", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      const settings = await storage.getAppSettings(tenantId, userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", combinedAuth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      const data = insertAppSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAppSettings(data, tenantId, userId);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  // ========== FLUTING SETTINGS (per user) ==========
  app.get("/api/fluting-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getFlutingSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fluting settings" });
    }
  });

  // Check if user has configured fluting settings (for first-time setup)
  app.get("/api/fluting-settings/status", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getFlutingSettings(userId);
      const requiredFluteTypes = ['A', 'B', 'C', 'E', 'F'];
      const configuredTypes = settings.map(s => s.fluteType);
      const isConfigured = requiredFluteTypes.every(type => configuredTypes.includes(type));
      res.json({ 
        configured: isConfigured, 
        configuredCount: configuredTypes.length,
        requiredCount: requiredFluteTypes.length,
        missingTypes: requiredFluteTypes.filter(t => !configuredTypes.includes(t))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check fluting settings status" });
    }
  });

  app.post("/api/fluting-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertFlutingSettingSchema.parse({ ...req.body, userId });
      const setting = await storage.saveFlutingSetting(data);
      
      // Check if all required flute types are now configured
      const allSettings = await storage.getFlutingSettings(userId);
      const requiredFluteTypes = ['A', 'B', 'C', 'E', 'F'];
      const configuredTypes = allSettings.map(s => s.fluteType);
      const isConfigured = requiredFluteTypes.every(type => configuredTypes.includes(type));
      
      res.status(201).json({ ...setting, allConfigured: isConfigured });
    } catch (error) {
      res.status(400).json({ error: "Failed to save fluting setting" });
    }
  });

  app.delete("/api/fluting-settings/:id", combinedAuth, async (req: any, res) => {
    try {
      await storage.deleteFlutingSetting(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete fluting setting" });
    }
  });

  // ========== FLUTE SETTINGS - NEW (per user, technical constants) ==========
  app.get("/api/flute-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getFluteSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flute settings" });
    }
  });

  app.get("/api/flute-settings/status", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getFluteSettings(userId);
      const requiredFluteTypes = ['A', 'B', 'C', 'E', 'F'];
      const configuredTypes = settings.map(s => s.fluteType);
      const isConfigured = requiredFluteTypes.every(type => configuredTypes.includes(type));
      res.json({ 
        configured: isConfigured, 
        configuredCount: configuredTypes.length,
        requiredCount: requiredFluteTypes.length,
        missingTypes: requiredFluteTypes.filter(t => !configuredTypes.includes(t))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check flute settings status" });
    }
  });

  app.post("/api/flute-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { settings } = req.body;
      
      if (!Array.isArray(settings)) {
        return res.status(400).json({ error: "Settings must be an array" });
      }
      
      const settingsWithUserId = settings.map((s: any) => ({
        userId,
        fluteType: s.fluteType,
        flutingFactor: s.flutingFactor,
        fluteHeightMm: s.fluteHeightMm
      }));
      
      const saved = await storage.saveFluteSettings(settingsWithUserId);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save flute settings" });
    }
  });

  app.patch("/api/flute-settings/:id", combinedAuth, async (req: any, res) => {
    try {
      const updated = await storage.updateFluteSetting(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Flute setting not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update flute setting" });
    }
  });

  // ========== BUSINESS DEFAULTS (per user) ==========
  app.get("/api/business-defaults", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const defaults = await storage.getBusinessDefaults(userId);
      if (!defaults) {
        // Return default values if no settings exist (India GST for Corrugated Boxes = 5%)
        return res.json({
          userId,
          defaultGstPercent: 5,
          gstRegistered: true,
          gstNumber: null,
          igstApplicable: false,
          roundOffEnabled: true
        });
      }
      res.json(defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch business defaults" });
    }
  });

  app.post("/api/business-defaults", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = { ...req.body, userId };
      const saved = await storage.saveBusinessDefaults(data);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save business defaults" });
    }
  });

  // ========== PAPER PRICES (per user) ==========
  app.get("/api/paper-prices", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const prices = await storage.getPaperPrices(userId);
      res.json(prices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch paper prices" });
    }
  });

  app.get("/api/paper-prices/:id", combinedAuth, async (req: any, res) => {
    try {
      const price = await storage.getPaperPrice(req.params.id);
      if (!price) {
        return res.status(404).json({ error: "Paper price not found" });
      }
      res.json(price);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch paper price" });
    }
  });

  app.post("/api/paper-prices", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // Ensure user exists in database (handles OIDC test bypass scenarios)
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        await storage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      const data = insertPaperPriceSchema.parse({ ...req.body, userId });
      const price = await storage.createPaperPrice(data);
      res.status(201).json(price);
    } catch (error: any) {
      console.error("Paper price creation error:", error);
      res.status(400).json({ error: "Failed to create paper price", details: error?.message });
    }
  });

  app.patch("/api/paper-prices/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertPaperPriceSchema.partial().parse(req.body);
      const price = await storage.updatePaperPrice(req.params.id, data);
      if (!price) {
        return res.status(404).json({ error: "Paper price not found" });
      }
      res.json(price);
    } catch (error) {
      res.status(400).json({ error: "Failed to update paper price" });
    }
  });

  app.delete("/api/paper-prices/:id", combinedAuth, async (req: any, res) => {
    try {
      await storage.deletePaperPrice(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete paper price" });
    }
  });

  // Lookup paper price by GSM/BF/Shade for calculator auto-fill
  app.get("/api/paper-prices/lookup/:gsm/:bf/:shade", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const gsm = parseInt(req.params.gsm);
      const bf = parseInt(req.params.bf);
      const shade = req.params.shade;
      
      const price = await storage.getPaperPriceBySpec(userId, gsm, bf, shade);
      if (!price) {
        return res.status(404).json({ error: "Paper price not found for this specification" });
      }
      
      // Get pricing rules to calculate final price
      const rules = await storage.getPaperPricingRules(userId);
      let gsmAdjustment = 0;
      let marketAdjustment = 0;
      
      if (rules) {
        // Apply GSM adjustment based on user's rules
        if (gsm <= (rules.lowGsmLimit || 101)) {
          gsmAdjustment = rules.lowGsmAdjustment || 0;
        } else if (gsm >= (rules.highGsmLimit || 201)) {
          gsmAdjustment = rules.highGsmAdjustment || 0;
        }
        marketAdjustment = rules.marketAdjustment || 0;
      }
      
      const finalRate = price.basePrice + gsmAdjustment + marketAdjustment;
      
      res.json({
        ...price,
        gsmAdjustment,
        marketAdjustment,
        finalRate
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup paper price" });
    }
  });

  // ========== PAPER PRICING RULES (per user) ==========
  app.get("/api/paper-pricing-rules", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const rules = await storage.getPaperPricingRules(userId);
      res.json(rules || {
        lowGsmLimit: 101,
        lowGsmAdjustment: 1,
        highGsmLimit: 201,
        highGsmAdjustment: 1,
        marketAdjustment: 0,
        paperSetupCompleted: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch paper pricing rules" });
    }
  });

  app.post("/api/paper-pricing-rules", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertPaperPricingRulesSchema.parse({ ...req.body, userId });
      const rules = await storage.createOrUpdatePaperPricingRules(data);
      res.status(201).json(rules);
    } catch (error) {
      console.error("Failed to save paper pricing rules:", error);
      res.status(400).json({ error: "Failed to save paper pricing rules" });
    }
  });

  // Paper Setup Status (for first-login check)
  app.get("/api/paper-setup-status", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const status = await storage.getPaperSetupStatus(userId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to check paper setup status" });
    }
  });

  // ========== BF-BASED PAPER PRICES (per user) ==========
  
  // Default BF prices for new users
  const DEFAULT_BF_PRICES = [
    { bf: 14, basePrice: 32.00 },
    { bf: 16, basePrice: 33.00 },
    { bf: 18, basePrice: 34.00 },
    { bf: 20, basePrice: 35.00 },
    { bf: 22, basePrice: 36.50 },
    { bf: 24, basePrice: 38.50 },
    { bf: 28, basePrice: 44.50 },
    { bf: 35, basePrice: 50.00 }
  ];
  
  // Default paper shade types with ₹0 premium (user can edit premiums later)
  const DEFAULT_SHADE_TYPES = [
    { shade: "Kraft/Natural", premium: 0 },
    { shade: "Golden Kraft", premium: 0 },
    { shade: "Testliner", premium: 0 },
    { shade: "Virgin Kraft Liner", premium: 0 },
    { shade: "White Kraft Liner", premium: 0 },
    { shade: "White Top Testliner", premium: 0 },
    { shade: "Duplex Grey Back (LWC)", premium: 0 },
    { shade: "Duplex Grey Back (HWC)", premium: 0 },
    { shade: "Semi Chemical Fluting", premium: 0 },
    { shade: "Recycled Fluting", premium: 0 },
    { shade: "Bagass (Agro based)", premium: 0 }
  ];
  
  app.get("/api/paper-bf-prices", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const prices = await storage.getPaperBfPrices(userId);
      res.json(prices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BF paper prices" });
    }
  });
  
  // Initialize default BF prices for new users
  app.post("/api/paper-bf-prices/init-defaults", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // Ensure user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        await storage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      // Check and create BF prices if needed
      const existingPrices = await storage.getPaperBfPrices(userId);
      const createdPrices = [];
      if (existingPrices.length === 0) {
        for (const price of DEFAULT_BF_PRICES) {
          const created = await storage.createPaperBfPrice({ userId, ...price });
          createdPrices.push(created);
        }
      }
      
      // Check and create default shade types if needed
      const existingShades = await storage.getShadePremiums(userId);
      const createdShades = [];
      if (existingShades.length === 0) {
        for (const shadeType of DEFAULT_SHADE_TYPES) {
          const created = await storage.createShadePremium({ userId, ...shadeType });
          createdShades.push(created);
        }
      }
      
      const alreadyConfigured = existingPrices.length > 0 && existingShades.length > 0;
      if (alreadyConfigured) {
        return res.json({ message: "User already has defaults configured", prices: existingPrices, shades: existingShades });
      }
      
      res.status(201).json({ 
        message: "Default prices and shades initialized", 
        prices: createdPrices.length > 0 ? createdPrices : existingPrices, 
        shades: createdShades.length > 0 ? createdShades : existingShades 
      });
    } catch (error: any) {
      console.error("Init defaults error:", error);
      res.status(400).json({ error: "Failed to initialize default prices", details: error?.message });
    }
  });

  app.post("/api/paper-bf-prices", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // Ensure user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        await storage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      const data = insertPaperBfPriceSchema.parse({ ...req.body, userId });
      
      // Check if BF already exists for this user
      const existing = await storage.getPaperBfPriceByBf(userId, data.bf);
      if (existing) {
        const updated = await storage.updatePaperBfPrice(existing.id, { basePrice: data.basePrice });
        return res.json(updated);
      }
      
      const price = await storage.createPaperBfPrice(data);
      res.status(201).json(price);
    } catch (error: any) {
      console.error("BF price creation error:", error);
      res.status(400).json({ error: "Failed to create BF paper price", details: error?.message });
    }
  });

  app.patch("/api/paper-bf-prices/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertPaperBfPriceSchema.partial().parse(req.body);
      const price = await storage.updatePaperBfPrice(req.params.id, data);
      if (!price) {
        return res.status(404).json({ error: "BF price not found" });
      }
      res.json(price);
    } catch (error) {
      res.status(400).json({ error: "Failed to update BF price" });
    }
  });

  app.delete("/api/paper-bf-prices/:id", combinedAuth, async (req: any, res) => {
    try {
      await storage.deletePaperBfPrice(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete BF price" });
    }
  });

  // ========== PAPER SHADES MASTER TABLE (global) ==========
  app.get("/api/paper-shades", combinedAuth, async (req: any, res) => {
    try {
      const shades = await storage.getPaperShades();
      res.json(shades);
    } catch (error) {
      console.error("Failed to fetch paper shades:", error);
      res.status(500).json({ error: "Failed to fetch paper shades" });
    }
  });

  // ========== SHADE PREMIUMS (per user) ==========
  app.get("/api/shade-premiums", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const premiums = await storage.getShadePremiums(userId);
      res.json(premiums);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shade premiums" });
    }
  });

  app.post("/api/shade-premiums", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // Ensure user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        await storage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      const data = insertShadePremiumSchema.parse({ ...req.body, userId });
      
      // Check if shade already exists for this user
      const existing = await storage.getShadePremiumByShade(userId, data.shade);
      if (existing) {
        const updated = await storage.updateShadePremium(existing.id, { premium: data.premium });
        return res.json(updated);
      }
      
      const premium = await storage.createShadePremium(data);
      res.status(201).json(premium);
    } catch (error: any) {
      console.error("Shade premium creation error:", error);
      res.status(400).json({ error: "Failed to create shade premium", details: error?.message });
    }
  });

  app.patch("/api/shade-premiums/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertShadePremiumSchema.partial().parse(req.body);
      const premium = await storage.updateShadePremium(req.params.id, data);
      if (!premium) {
        return res.status(404).json({ error: "Shade premium not found" });
      }
      res.json(premium);
    } catch (error) {
      res.status(400).json({ error: "Failed to update shade premium" });
    }
  });

  app.delete("/api/shade-premiums/:id", combinedAuth, async (req: any, res) => {
    try {
      await storage.deleteShadePremium(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete shade premium" });
    }
  });

  // Calculate paper rate with new BF-based pricing
  app.get("/api/calculate-paper-rate/:bf/:gsm/:shade", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const bf = parseInt(req.params.bf);
      const gsm = parseInt(req.params.gsm);
      const shade = req.params.shade;
      
      // Get BF base price
      const bfPrice = await storage.getPaperBfPriceByBf(userId, bf);
      if (!bfPrice) {
        return res.status(404).json({ error: "No base price found for this BF" });
      }
      
      // Get pricing rules
      const rules = await storage.getPaperPricingRules(userId);
      let gsmAdjustment = 0;
      let marketAdjustment = 0;
      
      if (rules) {
        if (gsm <= (rules.lowGsmLimit || 101)) {
          gsmAdjustment = rules.lowGsmAdjustment || 0;
        } else if (gsm >= (rules.highGsmLimit || 201)) {
          gsmAdjustment = rules.highGsmAdjustment || 0;
        }
        marketAdjustment = rules.marketAdjustment || 0;
      }
      
      // Get shade premium
      const shadePremiumEntry = await storage.getShadePremiumByShade(userId, shade);
      const shadePremium = shadePremiumEntry?.premium || 0;
      
      // Calculate final rate
      const finalRate = bfPrice.basePrice + gsmAdjustment + shadePremium + marketAdjustment;
      
      res.json({
        bfBasePrice: bfPrice.basePrice,
        gsmAdjustment,
        shadePremium,
        marketAdjustment,
        finalRate
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate paper rate" });
    }
  });

  // ========== USER QUOTE TERMS (per user) ==========
  app.get("/api/user-quote-terms", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const terms = await storage.getUserQuoteTerms(userId);
      res.json(terms || {
        validityDays: 7,
        defaultDeliveryText: "10-15 working days after order confirmation and advance payment",
        defaultPaymentType: "advance",
        defaultCreditDays: null
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user quote terms" });
    }
  });

  app.post("/api/user-quote-terms", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertUserQuoteTermsSchema.parse({ ...req.body, userId });
      const terms = await storage.createOrUpdateUserQuoteTerms(data);
      res.status(201).json(terms);
    } catch (error) {
      res.status(400).json({ error: "Failed to save user quote terms" });
    }
  });

  // ========== BOX SPECIFICATIONS (per user with versioning) ==========
  app.get("/api/box-specifications", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const customerId = req.query.customerId as string | undefined;
      const specs = await storage.getBoxSpecifications(userId, customerId);
      res.json(specs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch box specifications" });
    }
  });

  app.get("/api/box-specifications/:id", combinedAuth, async (req: any, res) => {
    try {
      const spec = await storage.getBoxSpecification(req.params.id);
      if (!spec) {
        return res.status(404).json({ error: "Box specification not found" });
      }
      res.json(spec);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch box specification" });
    }
  });

  app.get("/api/box-specifications/:id/versions", combinedAuth, async (req: any, res) => {
    try {
      const versions = await storage.getBoxSpecVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch box specification versions" });
    }
  });

  // Create or update box specification with versioning
  app.post("/api/box-specifications", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { customerId, boxType, length, breadth, height, ply, dataSnapshot, changeNote } = req.body;
      
      // Check for existing spec with same unique combination
      const existingSpec = await storage.findExistingBoxSpec(
        userId, customerId || null, boxType, length, breadth, height || null, ply
      );
      
      if (existingSpec) {
        // Create new version for existing spec
        const newVersionNumber = (existingSpec.currentVersion || 1) + 1;
        
        await storage.createBoxSpecVersion({
          specId: existingSpec.id,
          versionNumber: newVersionNumber,
          dataSnapshot,
          editedBy: userId,
          changeNote
        });
        
        // Update master record
        const updatedSpec = await storage.updateBoxSpecification(existingSpec.id, {
          currentVersion: newVersionNumber
        });
        
        res.status(201).json({ 
          spec: updatedSpec, 
          versionNumber: newVersionNumber, 
          isNewSpec: false 
        });
      } else {
        // Create new spec with version 1
        const spec = await storage.createBoxSpecification({
          userId,
          customerId: customerId || null,
          boxType,
          length,
          breadth,
          height: height || null,
          ply,
          currentVersion: 1,
          isActive: true
        });
        
        await storage.createBoxSpecVersion({
          specId: spec.id,
          versionNumber: 1,
          dataSnapshot,
          editedBy: userId,
          changeNote: changeNote || "Initial version"
        });
        
        res.status(201).json({ 
          spec, 
          versionNumber: 1, 
          isNewSpec: true 
        });
      }
    } catch (error) {
      console.error("Failed to save box specification:", error);
      res.status(400).json({ error: "Failed to save box specification" });
    }
  });

  // Restore a previous version
  app.post("/api/box-specifications/:id/restore/:versionNumber", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const specId = req.params.id;
      const versionNumber = parseInt(req.params.versionNumber);
      
      const spec = await storage.getBoxSpecification(specId);
      if (!spec) {
        return res.status(404).json({ error: "Box specification not found" });
      }
      
      const version = await storage.getBoxSpecVersion(specId, versionNumber);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      // Create a new version with the restored data
      const newVersionNumber = (spec.currentVersion || 1) + 1;
      
      await storage.createBoxSpecVersion({
        specId,
        versionNumber: newVersionNumber,
        dataSnapshot: version.dataSnapshot as Record<string, unknown>,
        editedBy: userId,
        changeNote: `Restored from version ${versionNumber}`
      });
      
      await storage.updateBoxSpecification(specId, {
        currentVersion: newVersionNumber
      });
      
      res.json({ 
        success: true, 
        newVersionNumber,
        message: `Restored to version ${versionNumber}` 
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to restore version" });
    }
  });

  // ========== CHATBOT WIDGETS (per user) ==========
  app.get("/api/chatbot-widgets", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const widgets = await storage.getChatbotWidgets(userId);
      res.json(widgets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chatbot widgets" });
    }
  });

  app.post("/api/chatbot-widgets", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertChatbotWidgetSchema.parse({ ...req.body, userId });
      const widget = await storage.createChatbotWidget(data);
      res.status(201).json(widget);
    } catch (error) {
      res.status(400).json({ error: "Failed to create chatbot widget" });
    }
  });

  app.patch("/api/chatbot-widgets/:id", combinedAuth, async (req: any, res) => {
    try {
      const data = insertChatbotWidgetSchema.partial().parse(req.body);
      const widget = await storage.updateChatbotWidget(req.params.id, data);
      if (!widget) {
        return res.status(404).json({ error: "Widget not found" });
      }
      res.json(widget);
    } catch (error) {
      res.status(400).json({ error: "Failed to update chatbot widget" });
    }
  });

  app.delete("/api/chatbot-widgets/:id", combinedAuth, async (req: any, res) => {
    try {
      await storage.deleteChatbotWidget(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete chatbot widget" });
    }
  });

  // ========== PUBLIC CHATBOT API (for embedded widgets) ==========
  app.post("/api/chatbot/quote", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Invalid API token" });
      }
      
      const token = authHeader.split(' ')[1];
      const widget = await storage.getChatbotWidgetByToken(token);
      
      if (!widget || !widget.isActive) {
        return res.status(401).json({ error: "Invalid or inactive widget" });
      }
      
      // Check allowed domains if configured
      const origin = req.headers.origin;
      const allowedDomains = widget.allowedDomains as string[] || [];
      if (allowedDomains.length > 0 && origin && !allowedDomains.includes(origin)) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      
      // Get user's fluting settings for calculation
      const flutingSettings = await storage.getFlutingSettings(widget.userId);
      
      // Process costing request
      const { type, length, width, height, ply, fluteType } = req.body;
      
      // Return calculated values (simplified - would need full calculation logic)
      res.json({
        message: "Quote calculation received",
        dimensions: { length, width, height },
        ply,
        fluteType,
        flutingSettings: flutingSettings.map(s => ({ fluteType: s.fluteType, factor: s.flutingFactor })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process quote request" });
    }
  });

  // ========== ADMIN ROUTES (Owner only) ==========
  
  // Subscription Plans
  app.get("/api/admin/subscription-plans", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  app.post("/api/admin/subscription-plans", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const data = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(data);
      res.status(201).json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to create subscription plan" });
    }
  });

  app.patch("/api/admin/subscription-plans/:id", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const data = insertSubscriptionPlanSchema.partial().parse(req.body);
      const plan = await storage.updateSubscriptionPlan(req.params.id, data);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to update subscription plan" });
    }
  });

  app.delete("/api/admin/subscription-plans/:id", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      await storage.deleteSubscriptionPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete subscription plan" });
    }
  });

  // User Subscriptions (Admin view)
  app.get("/api/admin/subscriptions", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const subscriptions = await storage.getAllUserSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Coupons
  app.get("/api/admin/coupons", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const allCoupons = await storage.getAllCoupons();
      res.json({ coupons: allCoupons, total: allCoupons.length });
    } catch (error) {
      console.error("[admin] Error fetching coupons:", error);
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      // Map client fields to schema fields
      const { code, discountType, discountValue, maxUsage, perUserLimit, expiryDate } = req.body;
      
      if (!code || !discountValue) {
        return res.status(400).json({ error: "Coupon code and discount value are required" });
      }
      
      const couponData = {
        code: code.toUpperCase(),
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue),
        maxUses: maxUsage ? parseInt(maxUsage, 10) : null,
        validUntil: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
      };
      
      const data = insertCouponSchema.parse(couponData);
      const coupon = await storage.createCoupon(data);
      res.status(201).json({ success: true, coupon, message: `Coupon ${code} created successfully` });
    } catch (error: any) {
      console.error("[admin] Error creating coupon:", error);
      // Check for unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({ error: "A coupon with this code already exists" });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid coupon data", details: error.errors });
      }
      res.status(400).json({ error: error.message || "Failed to create coupon" });
    }
  });

  app.patch("/api/admin/coupons/:id", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const data = insertCouponSchema.partial().parse(req.body);
      const coupon = await storage.updateCoupon(req.params.id, data);
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      res.status(400).json({ error: "Failed to update coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      await storage.deleteCoupon(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete coupon" });
    }
  });

  // Trial Invites
  app.get("/api/admin/trial-invites", combinedAuth, requireSuperAdminAuth, async (req: any, res) => {
    try {
      const invites = await storage.getAllTrialInvites();
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trial invites" });
    }
  });

  app.post("/api/admin/trial-invites", combinedAuth, requireSuperAdminAuth, async (req: any, res) => {
    try {
      const data = insertTrialInviteSchema.parse(req.body);
      const invite = await storage.createTrialInvite(data);
      
      // TODO: Send email with trial link
      // The invite.inviteToken can be used to generate a signup link
      
      res.status(201).json(invite);
    } catch (error) {
      res.status(400).json({ error: "Failed to create trial invite" });
    }
  });

  // Payment Transactions (Admin view)
  app.get("/api/admin/transactions", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const transactions = await storage.getAllPaymentTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Owner Settings
  app.get("/api/admin/settings", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const settings = await storage.getOwnerSettings();
      // Mask sensitive data
      res.json({
        ...settings,
        razorpayKeySecret: settings.razorpayKeySecret ? '********' : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner settings" });
    }
  });

  app.patch("/api/admin/settings", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const settings = await storage.updateOwnerSettings(req.body);
      res.json({
        ...settings,
        razorpayKeySecret: settings.razorpayKeySecret ? '********' : null,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update owner settings" });
    }
  });

  // ========== IP WHITELIST MANAGEMENT ==========
  const { ipWhitelistStorage, extractClientIP } = await import('./middleware/ipWhitelist');

  // Get current IP address (public endpoint for admins to see their IP)
  app.get("/api/admin/my-ip", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const clientIP = extractClientIP(req);
      res.json({
        ipAddress: clientIP,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get IP address" });
    }
  });

  // List all whitelisted IPs (super admin only)
  app.get("/api/admin/ip-whitelist", combinedAuth, requireSuperAdminAuth, async (req: any, res) => {
    try {
      const ips = await ipWhitelistStorage.getIPs();
      res.json(ips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IP whitelist" });
    }
  });

  // List user's whitelisted IPs
  app.get("/api/admin/ip-whitelist/my-ips", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ips = await ipWhitelistStorage.getIPs(userId);
      res.json(ips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch your IP whitelist" });
    }
  });

  // Add IP to whitelist
  app.post("/api/admin/ip-whitelist", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { ipAddress, description, userId } = req.body;
      const createdBy = req.user.id;

      // Validate IP address format
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
      
      if (!ipv4Regex.test(ipAddress) && !ipv6Regex.test(ipAddress)) {
        return res.status(400).json({ error: "Invalid IP address format" });
      }

      // Only super admins can add IPs for other users
      if (userId && userId !== createdBy) {
        const [user] = await db.select().from(users).where(eq(users.id, createdBy)).limit(1);
        if (!user || !['super_admin', 'owner'].includes(user.role || '')) {
          return res.status(403).json({ error: "Insufficient permissions to add IP for another user" });
        }
      }

      const result = await ipWhitelistStorage.addIP({
        ipAddress,
        userId: userId || createdBy,
        description,
        createdBy,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('[IP Whitelist] Add error:', error);
      res.status(500).json({ error: "Failed to add IP to whitelist" });
    }
  });

  // Remove IP from whitelist
  app.delete("/api/admin/ip-whitelist/:id", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if IP belongs to user or if user is super admin
      const [ip] = await db.select().from(allowedAdminIps).where(eq(allowedAdminIps.id, id)).limit(1);
      
      if (!ip) {
        return res.status(404).json({ error: "IP not found" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const isSuperAdmin = user && ['super_admin', 'owner'].includes(user.role || '');

      if (ip.userId !== userId && !isSuperAdmin) {
        return res.status(403).json({ error: "You can only remove your own IPs" });
      }

      await ipWhitelistStorage.removeIP(id);
      res.json({ message: "IP removed from whitelist" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove IP from whitelist" });
    }
  });

  // ========== RAZORPAY INTEGRATION ==========
  app.post("/api/payments/create-order", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { planId, billingCycle, couponCode } = req.body;
      
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      let amount = billingCycle === 'yearly' ? (plan.priceYearly || plan.priceMonthly * 12) : plan.priceMonthly;
      
      // Apply coupon if provided
      if (couponCode) {
        const coupon = await storage.getCouponByCode(couponCode);
        if (coupon && coupon.isActive) {
          if (coupon.discountType === 'percentage') {
            amount = amount * (1 - coupon.discountValue / 100);
          } else {
            amount = Math.max(0, amount - coupon.discountValue);
          }
        }
      }
      
      // Create payment transaction record
      const transaction = await storage.createPaymentTransaction({
        userId,
        amount: amount * 100, // Convert to paise
        status: 'pending',
      });
      
      // In production, this would create a Razorpay order
      // For now, return the transaction details
      res.json({
        transactionId: transaction.id,
        amount: amount * 100,
        currency: 'INR',
        planId,
        billingCycle,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { transactionId, razorpayPaymentId, razorpayOrderId, razorpaySignature, planId, billingCycle, couponCode } = req.body;
      
      // In production, verify the signature with Razorpay
      // For now, mark the transaction as successful
      
      await storage.updatePaymentTransaction(transactionId, {
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
        status: 'success',
      });
      
      // Create or update user subscription
      const existingSub = await storage.getUserSubscription(userId);
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
      
      if (existingSub) {
        await storage.updateUserSubscription(existingSub.id, {
          planId,
          billingCycle,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          couponApplied: couponCode,
        });
      } else {
        await storage.createUserSubscription({
          userId,
          planId,
          billingCycle,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          couponApplied: couponCode,
        });
      }
      
      // Increment coupon usage if applied
      if (couponCode) {
        const coupon = await storage.getCouponByCode(couponCode);
        if (coupon) {
          await storage.incrementCouponUsage(coupon.id);
        }
      }
      
      res.json({ success: true, message: "Payment verified and subscription activated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // User subscription status
  app.get("/api/subscription", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const subscription = await storage.getUserSubscription(userId);
      const user = await storage.getUser(userId);
      
      res.json({
        subscription,
        subscriptionStatus: user?.subscriptionStatus,
        trialEndsAt: user?.trialEndsAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Public subscription plans
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans.filter(p => p.isActive));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Validate coupon
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.body;
      const coupon = await storage.getCouponByCode(code);
      
      if (!coupon) {
        return res.status(404).json({ valid: false, error: "Coupon not found" });
      }
      
      if (!coupon.isActive) {
        return res.status(400).json({ valid: false, error: "Coupon is inactive" });
      }
      
      if (coupon.maxUses && coupon.usedCount && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ valid: false, error: "Coupon usage limit reached" });
      }
      
      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return res.status(400).json({ valid: false, error: "Coupon not yet valid" });
      }
      
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return res.status(400).json({ valid: false, error: "Coupon expired" });
      }
      
      res.json({
        valid: true,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  // ==================== ONBOARDING STATUS ROUTES ====================
  
  // Get current user's onboarding status (rate limited: 10 req/min)
  app.get("/api/onboarding/status", combinedAuth, onboardingRateLimiter, async (req: any, res) => {
    try {
      const userId = req.userId;
      let status = await storage.getOnboardingStatus(userId);
      
      // If no status exists, create one
      if (!status) {
        status = await storage.createOnboardingStatus({ userId });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching onboarding status:", error);
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });
  
  // Update onboarding progress
  app.patch("/api/onboarding/status", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const updates = req.body;
      
      // Ensure onboarding status exists
      let status = await storage.getOnboardingStatus(userId);
      if (!status) {
        status = await storage.createOnboardingStatus({ userId, ...updates });
      } else {
        status = await storage.updateOnboardingStatus(userId, updates);
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      res.status(500).json({ error: "Failed to update onboarding status" });
    }
  });
  
  // Submit for admin verification
  app.post("/api/onboarding/submit-for-verification", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const status = await storage.getOnboardingStatus(userId);

      if (!status) {
        return res.status(400).json({ error: "Please complete onboarding first" });
      }

      // Check if all onboarding steps are complete
      if (!status.businessProfileDone || !status.paperSetupDone || !status.fluteSetupDone ||
          !status.taxSetupDone || !status.termsSetupDone) {
        return res.status(400).json({
          error: "Please complete all onboarding steps before submitting for verification",
          missingSteps: {
            businessProfile: !status.businessProfileDone,
            paperSetup: !status.paperSetupDone,
            fluteSetup: !status.fluteSetupDone,
            taxSetup: !status.taxSetupDone,
            termsSetup: !status.termsSetupDone
          }
        });
      }

      const updatedStatus = await storage.submitForVerification(userId);

      // Send email notification to admin
      try {
        const user = await storage.getUser(userId);
        const companyProfile = await storage.getCompanyProfileByUserId(userId);

        if (user && companyProfile) {
          const { sendSystemEmailAsync } = await import('./services/adminEmailService');
          const { getAdminVerificationSubmittedEmailHTML, getAdminVerificationSubmittedEmailText } = await import('./services/emailTemplates/verificationEmails');

          const adminEmail = process.env.ADMIN_EMAIL || 'admin@boxcostpro.com';
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

          await sendSystemEmailAsync(storage, {
            to: adminEmail,
            subject: `🔔 Business Ready for Verification: ${companyProfile.companyName}`,
            html: getAdminVerificationSubmittedEmailHTML({
              businessName: companyProfile.companyName,
              ownerName: `${user.firstName} ${user.lastName}`,
              email: user.email,
              submittedAt: new Date().toLocaleString(),
              verificationUrl: `${frontendUrl}/admin/users`,
            }),
            text: getAdminVerificationSubmittedEmailText({
              businessName: companyProfile.companyName,
              ownerName: `${user.firstName} ${user.lastName}`,
              email: user.email,
              submittedAt: new Date().toLocaleString(),
              verificationUrl: `${frontendUrl}/admin/users`,
            }),
            emailType: 'verification_submitted',
            relatedEntityId: userId,
          });

          console.log(`[Verification] Admin notification sent for user ${userId}`);
        }
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error('[Verification] Failed to send admin email:', emailError);
      }

      res.json(updatedStatus);
    } catch (error) {
      console.error("Error submitting for verification:", error);
      res.status(500).json({ error: "Failed to submit for verification" });
    }
  });
  
  // ==================== ADMIN VERIFICATION ROUTES ====================
  
  // Get admin stats (admin+)
  app.get("/api/admin/stats", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });
  
  // Get all pending verifications (admin+)
  app.get("/api/admin/verifications/pending", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const pending = await storage.getPendingVerifications();
      
      // Enrich with user details
      const enrichedPending = await Promise.all(pending.map(async (status) => {
        const user = await storage.getUser(status.userId);
        const company = await storage.getDefaultCompanyProfile(status.userId);
        return { ...status, user, company };
      }));
      
      res.json(enrichedPending);
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      res.status(500).json({ error: "Failed to fetch pending verifications" });
    }
  });
  
  // Get all onboarding statuses (admin+)
  app.get("/api/admin/onboarding", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const statuses = await storage.getAllOnboardingStatuses();
      
      // Enrich with user details
      const enrichedStatuses = await Promise.all(statuses.map(async (status) => {
        const user = await storage.getUser(status.userId);
        const company = await storage.getDefaultCompanyProfile(status.userId);
        return { ...status, user, company };
      }));
      
      res.json(enrichedStatuses);
    } catch (error) {
      console.error("Error fetching onboarding statuses:", error);
      res.status(500).json({ error: "Failed to fetch onboarding statuses" });
    }
  });
  
  // Get all users (admin+)
  app.get("/api/admin/users", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { page = '1', limit = '10', search, status } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      
      let allUsers = await storage.getAllUsers();
      
      // Apply search filter
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        allUsers = allUsers.filter(user => 
          (user.email?.toLowerCase().includes(searchLower)) ||
          (user.firstName?.toLowerCase().includes(searchLower)) ||
          (user.lastName?.toLowerCase().includes(searchLower)) ||
          (user.companyName?.toLowerCase().includes(searchLower))
        );
      }
      
      // Apply status filter
      if (status && status !== 'all' && typeof status === 'string') {
        allUsers = allUsers.filter(user => user.accountStatus === status);
      }
      
      const total = allUsers.length;
      
      // Apply pagination
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedUsers = allUsers.slice(startIndex, startIndex + limitNum);
      
      // Get onboarding status for each user
      const enrichedUsers = await Promise.all(paginatedUsers.map(async (user) => {
        const onboardingStatus = await storage.getOnboardingStatus(user.id);
        const company = await storage.getDefaultCompanyProfile(user.id);
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
        return { 
          ...user, 
          name,
          company: company?.companyName || user.companyName || null,
          tenantName: company?.companyName || null,
          status: user.accountStatus || 'active',
          onboardingStatus, 
        };
      }));
      
      res.json({ users: enrichedUsers, total, page: pageNum, limit: limitNum });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Get user details (admin+)
  app.get("/api/admin/users/:userId", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const onboardingStatus = await storage.getOnboardingStatus(userId);
      const company = await storage.getDefaultCompanyProfile(userId);
      const adminActions = await storage.getAdminActions(userId);
      
      res.json({ user, onboardingStatus, company, adminActions });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });
  
  // Approve user (admin+)
  app.post("/api/admin/users/:userId/approve", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminUserId = req.userId;

      const status = await storage.getOnboardingStatus(userId);
      if (!status) {
        return res.status(400).json({ error: "User has no onboarding record" });
      }

      if (!status.submittedForVerification) {
        return res.status(400).json({ error: "User has not submitted for verification" });
      }

      const updatedStatus = await storage.approveUser(userId, adminUserId);

      // Send approval email to user
      try {
        const user = await storage.getUser(userId);

        if (user) {
          const { sendSystemEmailAsync } = await import('./services/adminEmailService');
          const { getUserVerificationApprovedEmailHTML, getUserVerificationApprovedEmailText } = await import('./services/emailTemplates/verificationEmails');

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

          await sendSystemEmailAsync(storage, {
            to: user.email,
            subject: '🎉 Your Account is Verified!',
            html: getUserVerificationApprovedEmailHTML({
              firstName: user.firstName,
              dashboardUrl: `${frontendUrl}/dashboard`,
            }),
            text: getUserVerificationApprovedEmailText({
              firstName: user.firstName,
              dashboardUrl: `${frontendUrl}/dashboard`,
            }),
            emailType: 'verification_approved',
            relatedEntityId: userId,
          });

          console.log(`[Verification] Approval email sent to user ${userId}`);
        }
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error('[Verification] Failed to send approval email:', emailError);
      }

      res.json(updatedStatus);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ error: "Failed to approve user" });
    }
  });
  
  // Reject user (admin+) - requires mandatory remarks
  app.post("/api/admin/users/:userId/reject", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminUserId = req.userId;

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: "Rejection reason must be at least 10 characters" });
      }

      const status = await storage.getOnboardingStatus(userId);
      if (!status) {
        return res.status(400).json({ error: "User has no onboarding record" });
      }

      const updatedStatus = await storage.rejectUser(userId, adminUserId, reason.trim());

      // Send rejection email to user
      try {
        const user = await storage.getUser(userId);

        if (user) {
          const { sendSystemEmailAsync } = await import('./services/adminEmailService');
          const { getUserVerificationRejectedEmailHTML, getUserVerificationRejectedEmailText } = await import('./services/emailTemplates/verificationEmails');

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

          await sendSystemEmailAsync(storage, {
            to: user.email,
            subject: '⚠️ Verification Needs Changes',
            html: getUserVerificationRejectedEmailHTML({
              firstName: user.firstName,
              rejectionReason: reason.trim(),
              setupUrl: `${frontendUrl}/onboarding`,
            }),
            text: getUserVerificationRejectedEmailText({
              firstName: user.firstName,
              rejectionReason: reason.trim(),
              setupUrl: `${frontendUrl}/onboarding`,
            }),
            emailType: 'verification_rejected',
            relatedEntityId: userId,
          });

          console.log(`[Verification] Rejection email sent to user ${userId}`);
        }
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error('[Verification] Failed to send rejection email:', emailError);
      }

      res.json(updatedStatus);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ error: "Failed to reject user" });
    }
  });

  // ========== ONBOARDING REMINDER CRON JOB ==========
  // This endpoint should be called by a cron service (e.g., GitHub Actions, Vercel Cron, or external service)
  // Suggested schedule: Every 6 hours
  app.post("/api/cron/onboarding-reminders", async (req: any, res) => {
    try {
      // Optional: Add cron secret verification for security
      const cronSecret = req.headers['x-cron-secret'] || req.body.secret;
      const expectedSecret = process.env.CRON_SECRET;

      if (expectedSecret && cronSecret !== expectedSecret) {
        console.error('[Cron] Unauthorized onboarding reminder request');
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('[Cron] Starting onboarding reminder job...');

      const { processOnboardingReminders } = await import('./services/onboardingReminderService');
      const result = await processOnboardingReminders(storage);

      console.log(`[Cron] Onboarding reminder job complete:`, result);

      res.json({
        success: true,
        message: 'Onboarding reminder job completed',
        ...result,
      });
    } catch (error: any) {
      console.error('[Cron] Onboarding reminder job failed:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to run onboarding reminder job',
      });
    }
  });

  // Update user role (super_admin only)
  app.patch("/api/admin/users/:userId/role", combinedAuth, requireSuperAdminAuth, requireWhitelistedIP, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminUserId = req.userId;
      
      const validRoles = ['user', 'support_agent', 'support_manager', 'admin', 'super_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Cannot change own role
      if (userId === adminUserId) {
        return res.status(400).json({ error: "Cannot change your own role" });
      }
      
      const updatedUser = await storage.updateUser(userId, { role });
      
      // Log the action
      await storage.createAdminAction({
        adminUserId,
        targetUserId: userId,
        action: 'role_change',
        remarks: `Role changed to ${role}`
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });
  
  // Get admin action history
  app.get("/api/admin/actions", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { userId } = req.query;
      const actions = await storage.getAdminActions(userId as string | undefined);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching admin actions:", error);
      res.status(500).json({ error: "Failed to fetch admin actions" });
    }
  });

  // ==================== ADMIN SUPPORT TICKETS ====================
  
  // Get all support tickets for admin panel
  app.get("/api/admin/support/tickets", combinedAuth, requireAdminAuth, async (req: any, res) => {
    try {
      const { page = '1', limit = '10', status, priority } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      
      let allTickets = await storage.getSupportTickets();
      
      // Apply status filter
      if (status && status !== 'all') {
        allTickets = allTickets.filter(t => t.status === status);
      }
      
      // Apply priority filter
      if (priority && priority !== 'all') {
        allTickets = allTickets.filter(t => t.priority === priority);
      }
      
      // Calculate stats
      const stats = {
        open: allTickets.filter(t => t.status === 'open').length,
        inProgress: allTickets.filter(t => t.status === 'in-progress').length,
        breached: 0, // TODO: Calculate SLA breached tickets
        resolvedToday: allTickets.filter(t => {
          if (t.status !== 'resolved' || !t.updatedAt) return false;
          const today = new Date();
          const updated = new Date(t.updatedAt);
          return updated.toDateString() === today.toDateString();
        }).length,
      };
      
      const total = allTickets.length;
      
      // Apply pagination
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedTickets = allTickets.slice(startIndex, startIndex + limitNum);
      
      // Enrich with user and assignee details
      const enrichedTickets = await Promise.all(paginatedTickets.map(async (ticket) => {
        const user = await storage.getUser(ticket.userId);
        const assignee = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;
        // Calculate SLA deadline (e.g., 24h for medium, 8h for high, 2h for urgent)
        const slaHours: Record<string, number> = { low: 48, medium: 24, high: 8, urgent: 2 };
        const hours = slaHours[ticket.priority || 'medium'] || 24;
        const slaDeadline = new Date(ticket.createdAt!);
        slaDeadline.setHours(slaDeadline.getHours() + hours);
        
        return { 
          ...ticket, 
          user: user ? { id: user.id, email: user.email, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email } : null,
          assignee: assignee ? { id: assignee.id, email: assignee.email, name: `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email } : null,
          slaDeadline: slaDeadline.toISOString(),
        };
      }));
      
      res.json({ tickets: enrichedTickets, total, page: pageNum, limit: limitNum, stats });
    } catch (error) {
      console.error("Error fetching admin support tickets:", error);
      res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });
  
  // ==================== SUPPORT TICKET ROUTES ====================
  
  // Create support ticket (authenticated user)
  app.post("/api/support/tickets", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { subject, description, category, priority } = req.body;
      
      if (!subject || subject.trim().length < 5) {
        return res.status(400).json({ error: "Subject must be at least 5 characters" });
      }
      
      const ticket = await storage.createSupportTicket({
        userId,
        subject: subject.trim(),
        description: description?.trim() || null,
        category: category || 'general',
        priority: priority || 'medium'
      });
      
      res.json(ticket);
    } catch (error) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });
  
  // Get user's tickets
  app.get("/api/support/tickets/mine", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tickets = await storage.getSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });
  
  // Get all tickets (support_agent+)
  app.get("/api/support/tickets", combinedAuth, requireSupportAgent, async (req: any, res) => {
    try {
      const { status } = req.query;
      const tickets = await storage.getSupportTickets(undefined, status as string | undefined);
      
      // Enrich with user details
      const enrichedTickets = await Promise.all(tickets.map(async (ticket) => {
        const user = await storage.getUser(ticket.userId);
        const assignee = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;
        return { ...ticket, user, assignee };
      }));
      
      res.json(enrichedTickets);
    } catch (error) {
      console.error("Error fetching all tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });
  
  // Get single ticket
  app.get("/api/support/tickets/:ticketId", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { ticketId } = req.params;
      
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      // Only ticket owner or support staff can view
      const isSupportStaff = hasRoleLevel(req.user?.role, 'support_agent');
      if (ticket.userId !== userId && !isSupportStaff) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get messages - internal messages only for support staff
      const messages = await storage.getSupportMessages(ticketId, isSupportStaff);
      const user = await storage.getUser(ticket.userId);
      const assignee = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;
      
      res.json({ ...ticket, messages, user, assignee });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });
  
  // Add message to ticket
  app.post("/api/support/tickets/:ticketId/messages", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { ticketId } = req.params;
      const { message, isInternal } = req.body;
      
      if (!message || message.trim().length < 1) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }
      
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      const isSupportStaff = hasRoleLevel(req.user?.role, 'support_agent');
      
      // Only ticket owner or support staff can add messages
      if (ticket.userId !== userId && !isSupportStaff) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Internal messages only allowed for support staff
      if (isInternal && !isSupportStaff) {
        return res.status(403).json({ error: "Internal messages are for support staff only" });
      }
      
      const newMessage = await storage.createSupportMessage({
        ticketId,
        senderId: userId,
        senderType: isSupportStaff ? 'support' : 'user',
        message: message.trim(),
        isInternal: isInternal || false
      });
      
      res.json(newMessage);
    } catch (error) {
      console.error("Error adding message:", error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });
  
  // Assign ticket to agent (support_agent+)
  app.post("/api/support/tickets/:ticketId/assign", combinedAuth, requireSupportAgent, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { assignedTo } = req.body;
      const agentId = assignedTo || req.userId; // Default to self-assignment
      
      const ticket = await storage.assignSupportTicket(ticketId, agentId);
      res.json(ticket);
    } catch (error) {
      console.error("Error assigning ticket:", error);
      res.status(500).json({ error: "Failed to assign ticket" });
    }
  });
  
  // Close ticket (support_agent+)
  app.post("/api/support/tickets/:ticketId/close", combinedAuth, requireSupportAgent, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { resolutionNote } = req.body;
      const closedBy = req.userId;
      
      if (!resolutionNote || resolutionNote.trim().length < 5) {
        return res.status(400).json({ error: "Resolution note must be at least 5 characters" });
      }
      
      const ticket = await storage.closeSupportTicket(ticketId, closedBy, resolutionNote.trim());
      res.json(ticket);
    } catch (error) {
      console.error("Error closing ticket:", error);
      res.status(500).json({ error: "Failed to close ticket" });
    }
  });
  
  // Escalate ticket (support_manager+)
  app.post("/api/support/tickets/:ticketId/escalate", combinedAuth, requireSupportManager, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { escalatedTo } = req.body;
      
      if (!escalatedTo) {
        return res.status(400).json({ error: "Must specify who to escalate to" });
      }
      
      const ticket = await storage.escalateSupportTicket(ticketId, escalatedTo);
      res.json(ticket);
    } catch (error) {
      console.error("Error escalating ticket:", error);
      res.status(500).json({ error: "Failed to escalate ticket" });
    }
  });

  // ============================================
  // QUOTE TEMPLATES ROUTES
  // ============================================
  
  // Get all templates (system + user's custom)
  app.get("/api/quote-templates", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const channel = req.query.channel as string | undefined;
      const templates = await storage.getQuoteTemplates(userId, channel);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });
  
  // Get single template
  app.get("/api/quote-templates/:id", combinedAuth, async (req: any, res) => {
    try {
      const template = await storage.getQuoteTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });
  
  // Create custom template
  app.post("/api/quote-templates", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { name, channel, content, description } = req.body;
      
      if (!name || !channel || !content) {
        return res.status(400).json({ error: "Name, channel, and content are required" });
      }
      
      const template = await storage.createQuoteTemplate({
        userId,
        name,
        channel,
        templateType: 'custom',
        content,
        description,
        isDefault: false,
        isActive: true
      });
      
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });
  
  // Update template (only custom templates)
  app.patch("/api/quote-templates/:id", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const template = await storage.getQuoteTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Can't edit system templates directly (but can duplicate)
      if (template.templateType === 'system') {
        return res.status(403).json({ error: "Cannot edit system templates. Duplicate to customize." });
      }
      
      // Can only edit own templates
      if (template.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // If content is being changed, save current content as new version
      if (req.body.content && req.body.content !== template.content) {
        await storage.saveTemplateVersion(req.params.id, template.content, userId);
      }
      
      const updated = await storage.updateQuoteTemplate(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });
  
  // Duplicate template (works for system templates too)
  app.post("/api/quote-templates/:id/duplicate", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const original = await storage.getQuoteTemplate(req.params.id);
      
      if (!original) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const newTemplate = await storage.createQuoteTemplate({
        userId,
        name: `${original.name} (Copy)`,
        channel: original.channel,
        templateType: 'custom',
        content: original.content,
        description: original.description,
        isDefault: false,
        isActive: true
      });
      
      res.json(newTemplate);
    } catch (error) {
      res.status(500).json({ error: "Failed to duplicate template" });
    }
  });
  
  // Delete template (only custom)
  app.delete("/api/quote-templates/:id", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const template = await storage.getQuoteTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (template.templateType === 'system') {
        return res.status(403).json({ error: "Cannot delete system templates" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteQuoteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });
  
  // Set default template for channel
  app.post("/api/quote-templates/:id/set-default", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const template = await storage.getQuoteTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      await storage.setDefaultTemplate(userId, req.params.id, template.channel);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set default template" });
    }
  });
  
  // Get show columns config
  app.get("/api/show-columns", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const defaults = await storage.getBusinessDefaults(userId);
      
      const showColumns = {
        boxSize: defaults?.showColumnBoxSize ?? true,
        board: defaults?.showColumnBoard ?? true,
        flute: defaults?.showColumnFlute ?? true,
        paper: defaults?.showColumnPaper ?? true,
        printing: defaults?.showColumnPrinting ?? false,
        lamination: defaults?.showColumnLamination ?? false,
        varnish: defaults?.showColumnVarnish ?? true,
        weight: defaults?.showColumnWeight ?? true
      };
      
      res.json(showColumns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch show columns config" });
    }
  });
  
  // Update show columns config
  app.post("/api/show-columns", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { boxSize, board, flute, paper, printing, lamination, varnish, weight } = req.body;
      
      const updates: any = {};
      if (boxSize !== undefined) updates.showColumnBoxSize = boxSize;
      if (board !== undefined) updates.showColumnBoard = board;
      if (flute !== undefined) updates.showColumnFlute = flute;
      if (paper !== undefined) updates.showColumnPaper = paper;
      if (printing !== undefined) updates.showColumnPrinting = printing;
      if (lamination !== undefined) updates.showColumnLamination = lamination;
      if (varnish !== undefined) updates.showColumnVarnish = varnish;
      if (weight !== undefined) updates.showColumnWeight = weight;
      
      const defaults = await storage.saveBusinessDefaults({
        userId,
        defaultGstPercent: 5,
        ...updates
      });
      
      res.json({
        boxSize: defaults.showColumnBoxSize,
        board: defaults.showColumnBoard,
        flute: defaults.showColumnFlute,
        paper: defaults.showColumnPaper,
        printing: defaults.showColumnPrinting,
        lamination: defaults.showColumnLamination,
        varnish: defaults.showColumnVarnish,
        weight: defaults.showColumnWeight
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update show columns config" });
    }
  });
  
  // Preview template with quote data
  app.post("/api/quote-templates/:id/preview", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { quoteId } = req.body;
      
      const template = await storage.getQuoteTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Get quote data
      const quoteData = await storage.getQuoteWithActiveVersion(quoteId);
      if (!quoteData || !quoteData.version) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Get company profile
      const companyProfile = await storage.getDefaultCompanyProfile(userId);
      
      // Get party info
      const party = quoteData.quote.partyId ? await storage.getPartyProfile(quoteData.quote.partyId) : null;
      
      // Get show columns config
      const defaults = await storage.getBusinessDefaults(userId);
      const showColumns = {
        boxSize: defaults?.showColumnBoxSize ?? true,
        board: defaults?.showColumnBoard ?? true,
        flute: defaults?.showColumnFlute ?? true,
        paper: defaults?.showColumnPaper ?? true,
        printing: defaults?.showColumnPrinting ?? false,
        lamination: defaults?.showColumnLamination ?? false,
        varnish: defaults?.showColumnVarnish ?? true,
        weight: defaults?.showColumnWeight ?? true
      };
      
      // Render template
      const rendered = renderQuoteTemplate(template.content, {
        quote: quoteData.quote,
        version: quoteData.version,
        items: quoteData.items,
        companyProfile,
        party,
        showColumns,
        channel: template.channel
      });
      
      res.json({ rendered, template });
    } catch (error) {
      console.error("Error previewing template:", error);
      res.status(500).json({ error: "Failed to preview template" });
    }
  });
  
  // Send quote via WhatsApp/Email
  app.post("/api/quotes/:id/send", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;
      const { channel, templateId, recipientInfo } = req.body;
      
      if (!channel || !['whatsapp', 'email'].includes(channel)) {
        return res.status(400).json({ error: "Invalid channel. Use 'whatsapp' or 'email'" });
      }
      
      // Validate business profile completeness
      const companyProfile = await storage.getDefaultCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(400).json({ 
          error: "Business profile not found",
          validation: { businessProfile: false }
        });
      }
      
      const missingFields: string[] = [];
      if (!companyProfile.companyName) missingFields.push('Company Name');
      if (!companyProfile.ownerName) missingFields.push('Owner Name');
      if (!companyProfile.phone) missingFields.push('Phone');
      if (!companyProfile.email) missingFields.push('Email');
      if (!companyProfile.gstNo) missingFields.push('GST Number');
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Business profile incomplete. Missing: ${missingFields.join(', ')}`,
          validation: { businessProfile: false, missingFields }
        });
      }
      
      // Get quote with items
      const quoteData = await storage.getQuoteWithActiveVersion(quoteId);
      if (!quoteData || !quoteData.version) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      if (!quoteData.items || quoteData.items.length === 0) {
        return res.status(400).json({ 
          error: "Quote has no items",
          validation: { hasItems: false }
        });
      }
      
      // Get template
      let template;
      if (templateId) {
        template = await storage.getQuoteTemplate(templateId);
      } else {
        template = await storage.getDefaultTemplate(userId, channel);
      }
      
      if (!template) {
        return res.status(400).json({ error: "No template found for this channel" });
      }
      
      // Get show columns and party
      const defaults = await storage.getBusinessDefaults(userId);
      const showColumns = {
        boxSize: defaults?.showColumnBoxSize ?? true,
        board: defaults?.showColumnBoard ?? true,
        flute: defaults?.showColumnFlute ?? true,
        paper: defaults?.showColumnPaper ?? true,
        printing: defaults?.showColumnPrinting ?? false,
        lamination: defaults?.showColumnLamination ?? false,
        varnish: defaults?.showColumnVarnish ?? true,
        weight: defaults?.showColumnWeight ?? true
      };
      
      const party = quoteData.quote.partyId ? await storage.getPartyProfile(quoteData.quote.partyId) : null;
      
      // Render template
      const renderedContent = renderQuoteTemplate(template.content, {
        quote: quoteData.quote,
        version: quoteData.version,
        items: quoteData.items,
        companyProfile,
        party,
        showColumns,
        channel
      });
      
      // Log the send
      const sendLog = await storage.createQuoteSendLog({
        quoteId,
        quoteVersionId: quoteData.version.id,
        userId,
        channel,
        templateId: template.id,
        recipientInfo: recipientInfo || party?.mobileNo || party?.email,
        renderedContent,
        status: 'sent'
      });

      // LOCK COMPANY PROFILE after first quote send (Invoice-Safe Locking)
      if (companyProfile && !companyProfile.hasFinancialDocs) {
        const tenantId = req.tenantId;
        await storage.updateCompanyProfile(
          companyProfile.id,
          {
            hasFinancialDocs: true,
            lockedAt: new Date(),
            lockedReason: `First quote sent: ${quoteData.quote.quoteNo} on ${new Date().toISOString().split('T')[0]}`,
          },
          tenantId
        );
        console.log(`[Invoice Lock] Company profile locked: ${companyProfile.id}`);
      }

      // For WhatsApp, return URL to open WhatsApp with message
      if (channel === 'whatsapp') {
        const phoneNumber = recipientInfo || party?.mobileNo || '';
        const encodedMessage = encodeURIComponent(renderedContent);
        const whatsappUrl = phoneNumber 
          ? `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodedMessage}`
          : `https://wa.me/?text=${encodedMessage}`;
        
        res.json({ 
          success: true, 
          sendLog,
          whatsappUrl,
          renderedContent 
        });
      } else {
        // For email, return rendered content (email sending handled client-side or via email service)
        res.json({ 
          success: true, 
          sendLog,
          renderedContent,
          subject: `Quote ${quoteData.quote.quoteNo} from ${companyProfile.companyName}`
        });
      }
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  });
  
  // Get send history for a quote
  app.get("/api/quotes/:id/send-history", combinedAuth, async (req: any, res) => {
    try {
      const logs = await storage.getQuoteSendLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch send history" });
    }
  });
  
  // ========== TEMPLATE VERSION MANAGEMENT ==========
  
  // Get version history for a template
  app.get("/api/quote-templates/:id/versions", combinedAuth, async (req: any, res) => {
    try {
      const versions = await storage.getTemplateVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching template versions:", error);
      res.status(500).json({ error: "Failed to fetch template versions" });
    }
  });
  
  // Get specific version of a template
  app.get("/api/quote-templates/:id/versions/:versionNo", combinedAuth, async (req: any, res) => {
    try {
      const version = await storage.getTemplateVersion(req.params.id, parseInt(req.params.versionNo));
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error fetching template version:", error);
      res.status(500).json({ error: "Failed to fetch template version" });
    }
  });
  
  // Rollback template to a specific version
  app.post("/api/quote-templates/:id/rollback/:versionNo", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const templateId = req.params.id;
      const versionNo = parseInt(req.params.versionNo);
      
      // Check template exists and user owns it
      const template = await storage.getQuoteTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (template.templateType === 'system') {
        return res.status(403).json({ error: "Cannot modify system templates" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to modify this template" });
      }
      
      // Save current content as new version before rollback
      await storage.saveTemplateVersion(templateId, template.content, userId);
      
      // Rollback to specified version
      const updated = await storage.rollbackTemplate(templateId, versionNo);
      if (!updated) {
        return res.status(400).json({ error: "Failed to rollback. Version may not exist." });
      }
      
      res.json({ success: true, template: updated });
    } catch (error) {
      console.error("Error rolling back template:", error);
      res.status(500).json({ error: "Failed to rollback template" });
    }
  });
  
  // ========== USER EMAIL SETTINGS ==========
  
  // Get all email provider presets
  app.get("/api/email-providers", combinedAuth, async (req: any, res) => {
    try {
      const { getAllProviders } = await import('./config/emailProviderPresets');
      res.json(getAllProviders());
    } catch (error) {
      console.error("Error fetching email providers:", error);
      res.status(500).json({ error: "Failed to fetch email providers" });
    }
  });
  
  // Get current user's email settings
  app.get("/api/email-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getUserEmailSettings(userId);
      
      if (!settings) {
        return res.json({ configured: false });
      }
      
      // Return settings without decrypted sensitive data
      res.json({
        configured: true,
        provider: settings.provider,
        emailAddress: settings.emailAddress,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUsername: settings.smtpUsername,
        hasSmtpPassword: !!settings.smtpPasswordEncrypted,
        oauthProvider: settings.oauthProvider,
        hasOAuthTokens: !!(settings.oauthAccessTokenEncrypted && settings.oauthRefreshTokenEncrypted),
        isVerified: settings.isVerified,
        isActive: settings.isActive,
        lastVerifiedAt: settings.lastVerifiedAt
      });
    } catch (error) {
      console.error("Error fetching email settings:", error);
      res.status(500).json({ error: "Failed to fetch email settings" });
    }
  });
  
  // Save SMTP email settings (with mandatory test-before-save)
  app.post("/api/email-settings/smtp", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { provider, emailAddress, smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword } = req.body;

      console.log(`[Email Settings] User ${userId} saving SMTP config for provider: ${provider}`);

      if (!provider || !emailAddress) {
        return res.status(400).json({
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Provider and email address are required',
        });
      }

      if (!smtpPassword) {
        return res.status(400).json({
          code: 'MISSING_PASSWORD',
          message: 'SMTP password is required',
        });
      }

      const { encrypt } = await import('./utils/encryption');
      const { getProviderPreset } = await import('./config/emailProviderPresets');
      const { testSMTPConfiguration } = await import('./services/smtpService');

      // Get preset values for known providers
      const preset = getProviderPreset(provider);

      if (!preset) {
        return res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: `Unknown email provider: ${provider}`,
        });
      }

      const finalHost = smtpHost || preset.smtpHost;
      const finalPort = smtpPort || preset.smtpPort || 587;
      const finalSecure = smtpSecure !== undefined ? smtpSecure : (preset.smtpSecure || false);
      const finalUsername = smtpUsername || emailAddress;

      // CRITICAL: Test configuration BEFORE saving
      console.log(`[Email Settings] Testing SMTP configuration before saving...`);

      const testResult = await testSMTPConfiguration({
        provider,
        emailAddress,
        smtpHost: finalHost,
        smtpPort: finalPort,
        smtpSecure: finalSecure,
        smtpUsername: finalUsername,
        smtpPassword,
      });

      if (!testResult.success) {
        console.error(`[Email Settings] ✗ Test failed for ${provider}:`, testResult.code);
        // Return HTTP 400 with structured error (NOT 500)
        return res.status(400).json({
          code: testResult.code,
          provider,
          message: testResult.message,
          details: testResult.details,
        });
      }

      console.log(`[Email Settings] ✓ Test successful, saving configuration...`);

      // Test passed - now save the configuration
      const existing = await storage.getUserEmailSettings(userId);

      const settingsData = {
        userId,
        provider,
        emailAddress,
        smtpHost: finalHost,
        smtpPort: finalPort,
        smtpSecure: finalSecure,
        smtpUsername: finalUsername,
        smtpPasswordEncrypted: encrypt(smtpPassword), // Always encrypt fresh password
        oauthProvider: null,
        oauthAccessTokenEncrypted: null,
        oauthRefreshTokenEncrypted: null,
        oauthTokenExpiresAt: null,
        isVerified: true, // Mark as verified since test passed
        lastVerifiedAt: new Date(),
        isActive: true
      };

      let settings;
      if (existing) {
        settings = await storage.updateUserEmailSettings(userId, settingsData);
      } else {
        settings = await storage.createUserEmailSettings(settingsData);
      }

      console.log(`[Email Settings] ✓ Configuration saved successfully for user ${userId}`);

      res.json({
        success: true,
        message: testResult.message,
        isVerified: true,
      });
    } catch (error: any) {
      console.error("[Email Settings] ✗ Unexpected error:", error);
      console.error("[Email Settings] ✗ Error stack:", error.stack);
      console.error("[Email Settings] ✗ Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
        isSmtpError: error.isSmtpError,
      });

      // NEVER return HTTP 500 for SMTP errors
      // Check if this is a validation error from our SMTP service
      if (error.isSmtpError) {
        return res.status(400).json({
          code: error.code,
          provider: req.body.provider,
          message: error.message,
        });
      }

      // Handle encryption errors
      if (error.message?.includes('ENCRYPTION_KEY') || error.message?.includes('SESSION_SECRET')) {
        return res.status(500).json({
          code: 'ENCRYPTION_NOT_CONFIGURED',
          message: 'Server configuration error: Encryption key not set. Please contact support.',
        });
      }

      // Generic fallback (should rarely happen)
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while saving email settings',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
  
  // Verify email configuration by sending a test email
  app.post("/api/email-settings/verify", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getUserEmailSettings(userId);
      
      if (!settings) {
        return res.status(400).json({ error: "No email settings configured" });
      }
      
      const { decrypt } = await import('./utils/encryption');
      const nodemailer = await import('nodemailer');
      
      // Build transport based on configuration
      let transportConfig: any;
      
      if (settings.oauthProvider === 'google' && settings.oauthAccessTokenEncrypted) {
        // OAuth configuration for Gmail
        transportConfig = {
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: settings.emailAddress,
            accessToken: decrypt(settings.oauthAccessTokenEncrypted),
            refreshToken: settings.oauthRefreshTokenEncrypted ? decrypt(settings.oauthRefreshTokenEncrypted) : undefined
          }
        };
      } else if (settings.smtpPasswordEncrypted) {
        // SMTP configuration
        transportConfig = {
          host: settings.smtpHost,
          port: settings.smtpPort || 587,
          secure: settings.smtpSecure || false,
          auth: {
            user: settings.smtpUsername || settings.emailAddress,
            pass: decrypt(settings.smtpPasswordEncrypted)
          }
        };
      } else {
        return res.status(400).json({ error: "No valid credentials configured" });
      }
      
      const transporter = nodemailer.createTransport(transportConfig);
      
      // Verify connection
      await transporter.verify();
      
      // Mark as verified
      await storage.updateUserEmailSettings(userId, {
        isVerified: true,
        lastVerifiedAt: new Date()
      });
      
      // Send confirmation email asynchronously (non-blocking)
      const { sendEmailConfigurationConfirmation } = await import('./services/emailService');
      const companyProfile = await storage.getDefaultCompanyProfile(userId);
      const providerName = settings.oauthProvider === 'google' ? 'Google OAuth' : (settings.provider || 'SMTP');
      
      sendEmailConfigurationConfirmation(
        userId, 
        settings.emailAddress, 
        companyProfile?.ownerName || '', 
        providerName
      ).catch(err => console.error('CONFIRMATION_EMAIL_FAILED:', err));
      
      res.json({ success: true, message: "Email configuration verified successfully!" });
    } catch (error: any) {
      console.error("Email verification failed:", error);
      res.status(400).json({ 
        error: "Email verification failed",
        details: error.message || "Please check your credentials and try again"
      });
    }
  });
  
  // Delete email settings
  app.delete("/api/email-settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.deleteUserEmailSettings(userId);
      res.json({ success: true, message: "Email settings removed" });
    } catch (error) {
      console.error("Error deleting email settings:", error);
      res.status(500).json({ error: "Failed to delete email settings" });
    }
  });
  
  // Check if Google OAuth is available (for frontend to conditionally show option)
  app.get("/api/email-settings/google/status", (req, res) => {
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_OAUTH_REDIRECT_URL
    );
    res.json({ available: isConfigured });
  });
  
  // Google OAuth initiation
  app.get("/api/email-settings/google/connect", combinedAuth, async (req: any, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL;
      
      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({ error: "Google OAuth is not configured. Please contact support." });
      }
      
      const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send email profile');
      const state = req.userId; // Use userId as state for security
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Error initiating Google OAuth:", error);
      res.status(500).json({ error: "Failed to initiate Google connection" });
    }
  });
  
  // Google OAuth callback
  app.get("/api/email-settings/google/callback", async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code || !userId) {
        return res.redirect('/settings?tab=email&error=missing_params');
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URL;
      
      if (!clientId || !clientSecret || !redirectUri) {
        return res.redirect('/settings?tab=email&error=oauth_not_configured');
      }
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error("Token exchange failed:", tokens);
        return res.redirect('/settings?tab=email&error=token_exchange_failed');
      }
      
      // Get user's email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      const userInfo = await userInfoResponse.json();
      
      const { encrypt } = await import('./utils/encryption');
      
      const existing = await storage.getUserEmailSettings(userId as string);
      
      const settingsData = {
        userId: userId as string,
        provider: 'google_oauth',
        emailAddress: userInfo.email,
        oauthProvider: 'google',
        oauthAccessTokenEncrypted: encrypt(tokens.access_token),
        oauthRefreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        oauthTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUsername: null,
        smtpPasswordEncrypted: null,
        isVerified: true,
        isActive: true,
        lastVerifiedAt: new Date()
      };
      
      if (existing) {
        await storage.updateUserEmailSettings(userId as string, settingsData);
      } else {
        await storage.createUserEmailSettings(settingsData);
      }
      
      res.redirect('/settings?tab=email&success=google_connected');
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect('/settings?tab=email&error=oauth_failed');
    }
  });
  
  // Disconnect Google OAuth
  app.post("/api/email-settings/google/disconnect", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.deleteUserEmailSettings(userId);
      res.json({ success: true, message: "Google account disconnected" });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      res.status(500).json({ error: "Failed to disconnect Google account" });
    }
  });

  // ========== USER EMAIL PROVIDERS (Multi-Provider System) ==========
  
  /**
   * GET /api/user/email-providers
   * List user's own email providers (requires maxEmailProviders feature)
   */
  app.get("/api/user/email-providers", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      
      // Get user's providers (filtered by userId)
      const providers = await storage.getUserEmailProviders(userId);
      
      res.json({ providers });
    } catch (error: any) {
      console.error("[routes] GET /api/user/email-providers error:", error);
      res.status(500).json({ message: "Failed to fetch email providers", error: error.message });
    }
  });

  /**
   * POST /api/user/email-providers
   * Create new email provider for user (validates feature limits)
   */
  app.post("/api/user/email-providers", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { validateFeatureUsage, incrementFeatureUsage } = await import('./featureFlags.js');
      
      // Validate feature limit
      try {
        await validateFeatureUsage(userId, 'maxEmailProviders');
      } catch (featureError: any) {
        return res.status(403).json({
          message: featureError.message,
          code: featureError.code,
          limit: featureError.limit,
          currentUsage: featureError.currentUsage,
          upgradeRequired: featureError.upgradeRequired,
        });
      }

      // Create provider with userId set
      const providerData = {
        ...req.body,
        userId, // Set user ownership
        createdBy: userId,
        updatedBy: userId,
      };

      const provider = await storage.createEmailProvider(providerData);
      
      // Increment usage counter
      await incrementFeatureUsage(userId, 'emailProviders');

      res.status(201).json({ provider });
    } catch (error: any) {
      console.error("[routes] POST /api/user/email-providers error:", error);
      res.status(500).json({ message: "Failed to create email provider", error: error.message });
    }
  });

  /**
   * PATCH /api/user/email-providers/:id
   * Update user's email provider (ownership check)
   */
  app.patch("/api/user/email-providers/:id", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      // Check ownership
      const existing = await storage.getEmailProvider(id);
      if (!existing) {
        return res.status(404).json({ message: "Email provider not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to edit this provider" });
      }

      // Update provider
      const updates = {
        ...req.body,
        updatedBy: userId,
      };

      const updated = await storage.updateEmailProvider(id, updates);

      if (!updated) {
        return res.status(404).json({ message: "Email provider not found" });
      }

      res.json({ provider: updated });
    } catch (error: any) {
      console.error("[routes] PATCH /api/user/email-providers/:id error:", error);
      res.status(500).json({ message: "Failed to update email provider", error: error.message });
    }
  });

  /**
   * DELETE /api/user/email-providers/:id
   * Delete user's email provider (ownership check, decrements usage)
   */
  app.delete("/api/user/email-providers/:id", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const { decrementFeatureUsage } = await import('./featureFlags.js');

      // Check ownership
      const existing = await storage.getEmailProvider(id);
      if (!existing) {
        return res.status(404).json({ message: "Email provider not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this provider" });
      }

      // Delete provider
      const deleted = await storage.deleteEmailProvider(id);

      if (deleted) {
        // Decrement usage counter
        await decrementFeatureUsage(userId, 'emailProviders');
        res.json({ success: true, message: "Email provider deleted successfully" });
      } else {
        res.status(404).json({ message: "Email provider not found" });
      }
    } catch (error: any) {
      console.error("[routes] DELETE /api/user/email-providers/:id error:", error);
      res.status(500).json({ message: "Failed to delete email provider", error: error.message });
    }
  });

  /**
   * POST /api/user/email-providers/:id/test
   * Test user's email provider connection
   */
  app.post("/api/user/email-providers/:id/test", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { id } = req.params;

      // Check ownership
      const provider = await storage.getEmailProvider(id);
      if (!provider) {
        return res.status(404).json({ message: "Email provider not found" });
      }

      if (provider.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to test this provider" });
      }

      // Test connection using email tester
      const { testEmailProvider } = await import('./email/emailTester.js');
      const testResult = await testEmailProvider(provider);

      res.json(testResult);
    } catch (error: any) {
      console.error("[routes] POST /api/user/email-providers/:id/test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Test failed", 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/user/feature-limits
   * Get user's current feature limits and usage
   */
  app.get("/api/user/feature-limits", combinedAuth, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { getUserFeatures } = await import('./featureFlags.js');
      
      const features = await getUserFeatures(userId);
      const usage = await storage.getUserFeatureUsage(userId);

      res.json({
        limits: features,
        usage: usage || {
          emailProvidersCount: 0,
          customTemplatesCount: 0,
          quotesThisMonth: 0,
          partyProfilesCount: 0,
          apiCallsThisMonth: 0,
        },
      });
    } catch (error: any) {
      console.error("[routes] GET /api/user/feature-limits error:", error);
      res.status(500).json({ message: "Failed to fetch feature limits", error: error.message });
    }
  });

  // ========== EMAIL ANALYTICS ENDPOINTS ==========
  
  // Get email delivery stats
  app.get("/api/email-analytics/stats", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;
      
      const stats = await storage.getEmailStats(
        userId, 
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching email stats:", error);
      res.status(500).json({ error: "Failed to fetch email statistics" });
    }
  });
  
  // Get email logs with filters
  app.get("/api/email-analytics/logs", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { status, channel, startDate, endDate } = req.query;
      
      const logs = await storage.getEmailLogs(userId, {
        status: status as string | undefined,
        channel: channel as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      res.status(500).json({ error: "Failed to fetch email logs" });
    }
  });
  
  // Get email bounces
  app.get("/api/email-analytics/bounces", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const bounces = await storage.getEmailBounces(userId);
      res.json(bounces);
    } catch (error) {
      console.error("Error fetching bounces:", error);
      res.status(500).json({ error: "Failed to fetch bounce data" });
    }
  });
  
  // Get bounced recipients (unique list of hard-bounced email addresses)
  app.get("/api/email-analytics/bounced-recipients", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const recipients = await storage.getBouncedRecipients(userId);
      res.json(recipients);
    } catch (error) {
      console.error("Error fetching bounced recipients:", error);
      res.status(500).json({ error: "Failed to fetch bounced recipients" });
    }
  });

  // ========== EMAIL SYSTEM HEALTH CHECK (Public, Read-Only) ==========
  app.get('/api/system/health/email', async (_req, res) => {
    const { logEmailHealthCheck } = await import('./utils/emailLogger');
    const { validateProviderConfig, isProviderSupported, canCreateTransporter } = await import('./utils/providerValidation');
    
    try {
      // Check 1: Encryption key exists and is valid length
      const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
      if (!encryptionKey) {
        logEmailHealthCheck('unhealthy', 'EMAIL_SECRET_KEY missing in runtime');
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          reason: 'EMAIL_SECRET_KEY missing in runtime'
        });
      }

      if (encryptionKey.length < 32) {
        logEmailHealthCheck('unhealthy', 'EMAIL_SECRET_KEY too short (minimum 32 characters required)');
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          reason: 'EMAIL_SECRET_KEY too short (minimum 32 characters required)'
        });
      }

      // Check 2: Active admin email settings exist
      const emailSettings = await storage.getActiveAdminEmailSettings();
      if (!emailSettings) {
        logEmailHealthCheck('unhealthy', 'No active email settings configured');
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          reason: 'No active email settings configured'
        });
      }

      // Check 3: SMTP provider configured and supported
      if (!emailSettings.smtpProvider) {
        logEmailHealthCheck('unhealthy', 'SMTP provider not configured');
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          reason: 'SMTP provider not configured'
        });
      }

      if (!isProviderSupported(emailSettings.smtpProvider)) {
        logEmailHealthCheck('unhealthy', `Unsupported provider: ${emailSettings.smtpProvider}`, emailSettings.smtpProvider);
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          reason: `Unsupported email provider: ${emailSettings.smtpProvider}`
        });
      }

      // Check 4: Provider-specific SMTP settings validation
      const validation = validateProviderConfig(
        emailSettings.smtpProvider,
        emailSettings.smtpHost,
        emailSettings.smtpPort,
        emailSettings.encryption
      );

      if (!validation.valid) {
        const reason = validation.errors.join('; ');
        logEmailHealthCheck('unhealthy', reason, emailSettings.smtpProvider);
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          provider: emailSettings.smtpProvider,
          reason,
          details: validation.errors
        });
      }

      // Check 5: SMTP credentials can decrypt correctly
      let decryptedPassword: string;
      if (emailSettings.smtpPasswordEncrypted) {
        try {
          const { decrypt } = await import('./utils/encryption');
          decryptedPassword = decrypt(emailSettings.smtpPasswordEncrypted);
          
          if (!decryptedPassword || decryptedPassword.length === 0) {
            logEmailHealthCheck('unhealthy', 'SMTP password decryption failed - invalid or empty password', emailSettings.smtpProvider);
            return res.status(503).json({
              status: 'unhealthy',
              configured: false,
              provider: emailSettings.smtpProvider,
              reason: 'SMTP password decryption failed - invalid or empty password'
            });
          }
        } catch (decryptError: any) {
          logEmailHealthCheck('unhealthy', `SMTP password decryption failed: ${decryptError.message}`, emailSettings.smtpProvider);
          return res.status(503).json({
            status: 'unhealthy',
            configured: false,
            provider: emailSettings.smtpProvider,
            reason: `SMTP credentials cannot be decrypted: ${decryptError.message}`,
          });
        }
      } else {
        logEmailHealthCheck('unhealthy', 'No encrypted password stored', emailSettings.smtpProvider);
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          provider: emailSettings.smtpProvider,
          reason: 'No encrypted password stored'
        });
      }

      // Check 6: Transporter can be created (no actual send)
      const transporterCheck = canCreateTransporter(
        emailSettings.smtpHost,
        emailSettings.smtpPort,
        emailSettings.encryption,
        emailSettings.smtpUsername,
        decryptedPassword
      );

      if (!transporterCheck.valid) {
        logEmailHealthCheck('unhealthy', `Transporter validation failed: ${transporterCheck.error}`, emailSettings.smtpProvider);
        return res.status(503).json({
          status: 'unhealthy',
          configured: false,
          provider: emailSettings.smtpProvider,
          reason: transporterCheck.error || 'Failed to validate transporter configuration'
        });
      }

      // All checks passed
      logEmailHealthCheck('healthy', undefined, emailSettings.smtpProvider);
      res.status(200).json({
        status: 'healthy',
        configured: true,
        provider: emailSettings.smtpProvider.toUpperCase(),
        smtp: {
          host: emailSettings.smtpHost,
          port: emailSettings.smtpPort,
          encryption: emailSettings.encryption
        },
        env: {
          EMAIL_SECRET_KEY: true
        }
      });
    } catch (error: any) {
      console.error('[Email Health Check] Error:', error);
      logEmailHealthCheck('unhealthy', `Health check failed: ${error.message}`);
      res.status(503).json({
        status: 'unhealthy',
        configured: false,
        reason: `Health check failed: ${error.message}`
      });
    }
  });

  // ========== ADMIN PANEL ROUTES (Enterprise Admin System) ==========
  registerAdminRoutes(app);

  // ========== ENTERPRISE SYSTEM ROUTES ==========
  // Template management (invoice, email, WhatsApp templates)
  registerTemplateRoutes(app, combinedAuth, requireAdminAuth);
  
  // Support ticket system
  registerSupportRoutes(app, combinedAuth, requireAdminAuth);
  
  // Audit logging and exports
  registerAuditRoutes(app, combinedAuth, requireAdminAuth);

  // ========== SUBSCRIPTION MANAGEMENT ROUTES (Enterprise) ==========
  app.use("/api/subscription", subscriptionRoutes);

  // Register Admin User Management routes
  const { registerAdminUserManagement } = await import('./adminUserManagement');
  registerAdminUserManagement(app, combinedAuth, requireAdminAuth);

  // ========== INVOICE TEMPLATE ROUTES ==========

  // Get all invoice templates
  app.get("/api/invoice-templates", combinedAuth, async (req: any, res) => {
    try {
      const templates = await storage.getActiveInvoiceTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching invoice templates:", error);
      res.status(500).json({ error: "Failed to fetch invoice templates" });
    }
  });

  // Get invoice template by ID
  app.get("/api/invoice-templates/:id", combinedAuth, async (req: any, res) => {
    try {
      const template = await storage.getInvoiceTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching invoice template:", error);
      res.status(500).json({ error: "Failed to fetch invoice template" });
    }
  });

  // Generate PDF invoice for a quote
  app.post("/api/quotes/:id/generate-invoice-pdf", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;
      const { templateKey } = req.body;

      console.log(`[Invoice PDF] Generating PDF for quote ${quoteId}, template: ${templateKey || 'default'}`);

      // Get the quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Verify quote belongs to user
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if PDF already generated (immutability)
      if (quote.isPdfGenerated && quote.pdfPath) {
        console.log(`[Invoice PDF] PDF already exists: ${quote.pdfPath}`);
        return res.json({
          success: true,
          message: "PDF already generated",
          pdfPath: quote.pdfPath,
          alreadyGenerated: true,
        });
      }

      // Get template
      let template;
      if (templateKey) {
        template = await storage.getInvoiceTemplateByKey(templateKey);
      } else {
        template = await storage.getDefaultInvoiceTemplate();
      }

      if (!template) {
        return res.status(404).json({ error: "Invoice template not found" });
      }

      // Get quote with version and items
      const quoteData = await storage.getQuoteWithActiveVersion(quoteId);
      if (!quoteData || !quoteData.version) {
        return res.status(400).json({ error: "Quote must have an active version to generate invoice" });
      }

      // Get company profile (seller details)
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(400).json({
          error: "Company profile not found",
          message: "Please set up your company profile in Settings before generating invoices",
        });
      }

      // Get party profile (buyer details) - optional
      let partyProfile = null;
      if (quote.partyId) {
        partyProfile = await storage.getPartyProfile(quote.partyId);
      }

      // Validate data before generation
      const { mapQuoteToInvoiceData, validateQuoteForInvoice } = await import('./utils/quoteToInvoiceMapper');
      const validation = validateQuoteForInvoice(
        quoteData.quote,
        quoteData.version,
        quoteData.items,
        companyProfile,
        partyProfile
      );

      if (!validation.valid) {
        return res.status(400).json({
          error: "Invalid quote data for invoice generation",
          details: validation.errors,
        });
      }

      // Map quote to invoice data
      console.log(`[Invoice PDF] Mapping quote data to invoice format`);
      const invoiceData = await mapQuoteToInvoiceData(
        quoteData.quote,
        quoteData.version,
        quoteData.items,
        companyProfile,
        partyProfile
      );

      // Generate PDF
      console.log(`[Invoice PDF] Generating PDF with template: ${template.templateKey}`);
      const { pdfPath, pdfBuffer } = await generateInvoicePDF(
        invoiceData,
        template.templateKey,
        userId,
        quoteId
      );

      // Save PDF path to quote
      await storage.updateQuoteWithPDF(quoteId, template.id, pdfPath);

      console.log(`[Invoice PDF] ✓ PDF generated and saved: ${pdfPath}`);

      return res.json({
        success: true,
        pdfPath,
        templateUsed: template.name,
        invoiceNumber: invoiceData.invoice.number,
      });

    } catch (error: any) {
      console.error("[Invoice PDF] Generation failed:", error);
      res.status(500).json({ error: "Failed to generate invoice PDF", details: error.message });
    }
  });

  // Download invoice PDF for a quote
  app.get("/api/quotes/:id/invoice-pdf", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const quoteId = req.params.id;

      // Get the quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Verify quote belongs to user
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if PDF was generated
      if (!quote.isPdfGenerated || !quote.pdfPath) {
        return res.status(404).json({ error: "Invoice PDF not generated yet" });
      }

      // Read and send PDF file
      const { readPDFFile } = await import('./services/pdfInvoiceService');
      const pdfBuffer = await readPDFFile(quote.pdfPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice_${quote.quoteNo}.pdf`);
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error("[Invoice PDF] Download failed:", error);
      res.status(500).json({ error: "Failed to download invoice PDF", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to render quote templates
function renderQuoteTemplate(
  template: string,
  data: {
    quote: any;
    version: any;
    items: any[];
    companyProfile: any;
    party: any;
    showColumns: Record<string, boolean>;
    channel: string;
  }
): string {
  const { quote, version, items, companyProfile, party, showColumns, channel } = data;
  
  // Build filtered items list based on showColumns
  const itemLines = items.map((item: any, idx: number) => {
    const snapshot = item.itemDataSnapshot || item;
    const lines: string[] = [];
    
    const itemName = snapshot.boxName || `Item ${idx + 1}`;
    const qty = snapshot.quantity || item.quantity || 0;
    const rate = item.finalCostPerBox || snapshot.totalCostPerBox || 0;
    const total = item.finalTotalCost || (rate * qty);
    
    if (channel === 'whatsapp') {
      lines.push(`*${idx + 1}. ${itemName}*`);
      if (showColumns.boxSize && snapshot.length && snapshot.width) {
        const size = snapshot.height 
          ? `${snapshot.length} x ${snapshot.width} x ${snapshot.height} mm`
          : `${snapshot.length} x ${snapshot.width} mm`;
        lines.push(`   Size: ${size}`);
      }
      if (showColumns.board && snapshot.ply) {
        lines.push(`   Board: ${snapshot.ply} Ply`);
      }
      if (showColumns.flute && snapshot.fluteType) {
        lines.push(`   Flute: ${snapshot.fluteType}`);
      }
      if (showColumns.weight && snapshot.sheetWeight) {
        lines.push(`   Weight: ${snapshot.sheetWeight.toFixed(2)} kg`);
      }
      lines.push(`   Qty: ${qty} | Rate: ₹${rate.toFixed(2)} | Total: ₹${total.toFixed(2)}`);
    } else {
      // For email, build table row data structure
      lines.push(`<tr>
        <td>${itemName}</td>
        ${showColumns.boxSize ? `<td>${snapshot.length || ''} x ${snapshot.width || ''}${snapshot.height ? ' x ' + snapshot.height : ''} mm</td>` : ''}
        ${showColumns.board ? `<td>${snapshot.ply || ''} Ply</td>` : ''}
        ${showColumns.flute ? `<td>${snapshot.fluteType || ''}</td>` : ''}
        ${showColumns.weight ? `<td>${snapshot.sheetWeight ? snapshot.sheetWeight.toFixed(2) + ' kg' : ''}</td>` : ''}
        <td>${qty}</td>
        <td>₹${rate.toFixed(2)}</td>
        <td>₹${total.toFixed(2)}</td>
      </tr>`);
    }
    
    return lines.join('\n');
  }).join(channel === 'whatsapp' ? '\n\n' : '');
  
  // Build dynamic headers for email
  const dynamicHeaders = channel === 'email' ? [
    showColumns.boxSize ? '<th>Size</th>' : '',
    showColumns.board ? '<th>Board</th>' : '',
    showColumns.flute ? '<th>Flute</th>' : '',
    showColumns.weight ? '<th>Weight</th>' : ''
  ].filter(Boolean).join('') : '';
  
  // Format date
  const quoteDate = version.createdAt 
    ? new Date(version.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN');
  
  // Replace placeholders
  let rendered = template
    // Business placeholders
    .replace(/\{\{BusinessName\}\}/g, companyProfile?.companyName || '')
    .replace(/\{\{OwnerName\}\}/g, companyProfile?.ownerName || companyProfile?.companyName || '')
    .replace(/\{\{BusinessPhone\}\}/g, companyProfile?.phone || '')
    .replace(/\{\{BusinessEmail\}\}/g, companyProfile?.email || '')
    .replace(/\{\{GSTNo\}\}/g, companyProfile?.gstNo || '')
    .replace(/\{\{Website\}\}/g, companyProfile?.website || '')
    .replace(/\{\{MapLink\}\}/g, companyProfile?.mapLink || companyProfile?.googleLocation || '')
    .replace(/\{\{LogoUrl\}\}/g, companyProfile?.logoUrl || '')
    // Party placeholders
    .replace(/\{\{PartyName\}\}/g, party?.personName || party?.companyName || 'Customer')
    // Quote placeholders
    .replace(/\{\{QuoteNo\}\}/g, quote.quoteNo || '')
    .replace(/\{\{QuoteDate\}\}/g, quoteDate)
    .replace(/\{\{Subtotal\}\}/g, (version.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
    .replace(/\{\{GST\}\}/g, String(version.gstPercent || 5))
    .replace(/\{\{GSTAmount\}\}/g, (version.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
    .replace(/\{\{GrandTotal\}\}/g, (version.finalTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
    .replace(/\{\{PaymentTerms\}\}/g, version.paymentTerms || companyProfile?.paymentTerms || '100% Advance')
    .replace(/\{\{DeliveryTimeline\}\}/g, version.deliveryDays ? `${version.deliveryDays} days` : companyProfile?.deliveryTime || '10 days')
    // Items placeholders
    .replace(/\{\{ItemsList\}\}/g, itemLines)
    .replace(/\{\{ItemRows\}\}/g, itemLines)
    .replace(/\{\{DynamicHeaders\}\}/g, dynamicHeaders);
  
  // Handle conditional blocks like {{#if Website}}...{{/if}}
  rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
    const fieldMap: Record<string, any> = {
      'Website': companyProfile?.website,
      'MapLink': companyProfile?.mapLink || companyProfile?.googleLocation,
      'LogoUrl': companyProfile?.logoUrl
    };
    return fieldMap[field] ? content : '';
  });
  
  // Clean up any remaining empty lines (for WhatsApp)
  if (channel === 'whatsapp') {
    rendered = rendered.replace(/\n{3,}/g, '\n\n');
  }
  
  return rendered;
}

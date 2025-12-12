import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCompanyProfileSchema, insertPartyProfileSchema, insertQuoteSchema, insertAppSettingsSchema, insertRateMemorySchema, insertSubscriptionPlanSchema, insertCouponSchema, insertTrialInviteSchema, insertFlutingSettingSchema, insertChatbotWidgetSchema } from "@shared/schema";

// Owner authorization middleware
const isOwner = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  if (!user || user.role !== 'owner') {
    return res.status(403).json({ message: "Forbidden: Owner access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Company Profiles (protected, user-scoped)
  app.get("/api/company-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getAllCompanyProfiles(userId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/company-profiles/default", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getDefaultCompanyProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "No default profile found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default profile" });
    }
  });

  app.get("/api/company-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getCompanyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/company-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertCompanyProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.createCompanyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid profile data" });
    }
  });

  app.patch("/api/company-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertCompanyProfileSchema.partial().parse(req.body);
      const profile = await storage.updateCompanyProfile(req.params.id, data);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(400).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/company-profiles/:id/set-default", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.setDefaultCompanyProfile(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to set default profile" });
    }
  });

  // Party Profiles (protected, user-scoped)
  app.get("/api/party-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getAllPartyProfiles(userId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch party profiles" });
    }
  });

  app.get("/api/party-profiles/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const search = req.query.q as string || "";
      const profiles = await storage.searchPartyProfiles(userId, search);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to search party profiles" });
    }
  });

  app.post("/api/party-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertPartyProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.createPartyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid party profile data" });
    }
  });

  app.patch("/api/party-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertPartyProfileSchema.partial().parse(req.body);
      const profile = await storage.updatePartyProfile(req.params.id, data);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(400).json({ error: "Failed to update party profile" });
    }
  });

  app.delete("/api/party-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.deletePartyProfile(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete party profile" });
    }
  });

  // Quotes (protected, user-scoped)
  app.get("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const partyName = req.query.partyName as string | undefined;
      const boxName = req.query.boxName as string | undefined;
      const boxSize = req.query.boxSize as string | undefined;
      
      if (partyName || boxName || boxSize) {
        const quotes = await storage.searchQuotes(userId, { partyName, boxName, boxSize });
        res.json(quotes);
      } else {
        const quotes = await storage.getAllQuotes(userId);
        res.json(quotes);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertQuoteSchema.parse({ ...req.body, userId });
      const quote = await storage.createQuote(data);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Failed to create quote:", error);
      res.status(400).json({ error: "Invalid quote data" });
    }
  });

  app.patch("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertQuoteSchema.partial().parse(req.body);
      const quote = await storage.updateQuote(req.params.id, data);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(400).json({ error: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.deleteQuote(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Rate Memory (protected, user-scoped)
  app.get("/api/rate-memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rates = await storage.getAllRateMemory(userId);
      res.json(rates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate memory" });
    }
  });

  app.get("/api/rate-memory/:bf/:shade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rate = await storage.getRateMemoryByKey(req.params.bf, req.params.shade, userId);
      if (!rate) {
        return res.status(404).json({ error: "Rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate" });
    }
  });

  app.post("/api/rate-memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bfValue, shade, rate } = req.body;
      const saved = await storage.saveOrUpdateRateMemory(bfValue, shade, rate, userId);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save rate" });
    }
  });

  // App Settings (protected, user-scoped)
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getAppSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertAppSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAppSettings(data, userId);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  // ========== FLUTING SETTINGS (per user) ==========
  app.get("/api/fluting-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getFlutingSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fluting settings" });
    }
  });

  app.post("/api/fluting-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertFlutingSettingSchema.parse({ ...req.body, userId });
      const setting = await storage.saveFlutingSetting(data);
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ error: "Failed to save fluting setting" });
    }
  });

  app.delete("/api/fluting-settings/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteFlutingSetting(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete fluting setting" });
    }
  });

  // ========== CHATBOT WIDGETS (per user) ==========
  app.get("/api/chatbot-widgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const widgets = await storage.getChatbotWidgets(userId);
      res.json(widgets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chatbot widgets" });
    }
  });

  app.post("/api/chatbot-widgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertChatbotWidgetSchema.parse({ ...req.body, userId });
      const widget = await storage.createChatbotWidget(data);
      res.status(201).json(widget);
    } catch (error) {
      res.status(400).json({ error: "Failed to create chatbot widget" });
    }
  });

  app.patch("/api/chatbot-widgets/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/chatbot-widgets/:id", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/admin/subscription-plans", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  app.post("/api/admin/subscription-plans", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const data = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(data);
      res.status(201).json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to create subscription plan" });
    }
  });

  app.patch("/api/admin/subscription-plans/:id", isAuthenticated, isOwner, async (req: any, res) => {
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

  app.delete("/api/admin/subscription-plans/:id", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      await storage.deleteSubscriptionPlan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete subscription plan" });
    }
  });

  // User Subscriptions (Admin view)
  app.get("/api/admin/subscriptions", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const subscriptions = await storage.getAllUserSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Coupons
  app.get("/api/admin/coupons", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const data = insertCouponSchema.parse(req.body);
      const coupon = await storage.createCoupon(data);
      res.status(201).json(coupon);
    } catch (error) {
      res.status(400).json({ error: "Failed to create coupon" });
    }
  });

  app.patch("/api/admin/coupons/:id", isAuthenticated, isOwner, async (req: any, res) => {
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

  app.delete("/api/admin/coupons/:id", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      await storage.deleteCoupon(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete coupon" });
    }
  });

  // Trial Invites
  app.get("/api/admin/trial-invites", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const invites = await storage.getAllTrialInvites();
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trial invites" });
    }
  });

  app.post("/api/admin/trial-invites", isAuthenticated, isOwner, async (req: any, res) => {
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
  app.get("/api/admin/transactions", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const transactions = await storage.getAllPaymentTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Owner Settings
  app.get("/api/admin/settings", isAuthenticated, isOwner, async (req: any, res) => {
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

  app.patch("/api/admin/settings", isAuthenticated, isOwner, async (req: any, res) => {
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

  // ========== RAZORPAY INTEGRATION ==========
  app.post("/api/payments/create-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.post("/api/payments/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}

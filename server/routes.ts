import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { supabaseAuthMiddleware, requireSupabaseAuth, requireOwner as requireSupabaseOwner } from "./supabaseAuth";
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
  insertBoxSpecVersionSchema
} from "@shared/schema";

// Combined auth middleware - checks both Supabase JWT and session-based auth
const combinedAuth = async (req: any, res: Response, next: NextFunction) => {
  // First check Supabase auth
  if (req.supabaseUser) {
    req.userId = req.supabaseUser.id;
    return next();
  }
  
  // Fall back to session-based auth
  if (req.user?.claims?.sub) {
    req.userId = req.user.claims.sub;
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};

// Owner authorization middleware
const isOwner = async (req: any, res: Response, next: NextFunction) => {
  const userId = req.userId || req.supabaseUser?.id || req.user?.claims?.sub;
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
  // Setup session-based authentication (for backward compatibility)
  await setupAuth(app);
  
  // Add Supabase JWT auth middleware globally
  app.use(supabaseAuthMiddleware);

  // Auth routes - unified for both Supabase JWT and session auth
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

  // Logout route
  app.post('/api/auth/logout', (req: any, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
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

  // Company Profiles (protected, user-scoped)
  app.get("/api/company-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const profiles = await storage.getAllCompanyProfiles(userId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/company-profiles/default", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const profile = await storage.getDefaultCompanyProfile(userId);
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
      const profile = await storage.getCompanyProfile(req.params.id);
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
      const data = insertCompanyProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.createCompanyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid profile data" });
    }
  });

  app.patch("/api/company-profiles/:id", combinedAuth, async (req: any, res) => {
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

  app.post("/api/company-profiles/:id/set-default", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.setDefaultCompanyProfile(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to set default profile" });
    }
  });

  // Party Profiles (protected, user-scoped)
  app.get("/api/party-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const profiles = await storage.getAllPartyProfiles(userId);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch party profiles" });
    }
  });

  app.get("/api/party-profiles/search", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const search = req.query.q as string || "";
      const profiles = await storage.searchPartyProfiles(userId, search);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to search party profiles" });
    }
  });

  app.post("/api/party-profiles", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertPartyProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.createPartyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid party profile data" });
    }
  });

  app.patch("/api/party-profiles/:id", combinedAuth, async (req: any, res) => {
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

  app.delete("/api/party-profiles/:id", combinedAuth, async (req: any, res) => {
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
  app.get("/api/quotes", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
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

  app.get("/api/quotes/:id", combinedAuth, async (req: any, res) => {
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

  app.post("/api/quotes", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertQuoteSchema.parse({ ...req.body, userId });
      const quote = await storage.createQuote(data);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Failed to create quote:", error);
      res.status(400).json({ error: "Invalid quote data" });
    }
  });

  app.patch("/api/quotes/:id", combinedAuth, async (req: any, res) => {
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

  app.delete("/api/quotes/:id", combinedAuth, async (req: any, res) => {
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
  app.get("/api/rate-memory", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const rates = await storage.getAllRateMemory(userId);
      res.json(rates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate memory" });
    }
  });

  app.get("/api/rate-memory/:bf/:shade", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const rate = await storage.getRateMemoryByKey(req.params.bf, req.params.shade, userId);
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
      const userId = req.userId;
      const { bfValue, shade, rate } = req.body;
      const saved = await storage.saveOrUpdateRateMemory(bfValue, shade, rate, userId);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save rate" });
    }
  });

  // App Settings (protected, user-scoped)
  app.get("/api/settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const settings = await storage.getAppSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", combinedAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const data = insertAppSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAppSettings(data, userId);
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

  const httpServer = createServer(app);
  return httpServer;
}

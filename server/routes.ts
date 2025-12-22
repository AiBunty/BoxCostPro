import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { supabaseAuthMiddleware, requireSupabaseAuth, requireOwner as requireSupabaseOwner, requireAdmin, requireSupportAgent, requireSupportManager, requireSuperAdmin, hasRoleLevel } from "./supabaseAuth";
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
    } catch (error: any) {
      if (error.message === "PARTY_HAS_QUOTES") {
        return res.status(409).json({ 
          error: "Cannot delete party with existing quotes. Please delete all related quotes first." 
        });
      }
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
      const includeItems = req.query.include === 'items';
      
      if (includeItems) {
        // Return quotes with their active version items (for reports)
        const quotes = await storage.getAllQuotesWithItems(userId);
        return res.json(quotes);
      }
      
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
    // ==================== TRACE LOG 1: ENTRY ====================
    console.log("QUOTE SAVE HIT", JSON.stringify(req.body, null, 2));
    
    try {
      const userId = req.userId;
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
        // Get all existing quotes for this party
        const existingQuotes = await storage.getQuotesByPartyId(partyId, userId);
        
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
        // Generate new quote number and create new quote
        quoteNo = await storage.generateQuoteNumber(userId);
        console.log("GENERATED QUOTE NO:", quoteNo);
        
        // Create the quote record
        quote = await storage.createQuote({
          ...quoteData,
          partyId,
          userId,
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
      });
      
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
      
      // Update quote with new active version ID AND totalValue (CRITICAL FIX)
      await storage.updateQuote(quoteId, { 
        activeVersionId: version.id,
        totalValue: finalTotal
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
      await storage.updateQuote(quoteId, { 
        activeVersionId: newVersion.id,
        totalValue: newVersion.finalTotal
      });
      
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

  // ==================== ONBOARDING STATUS ROUTES ====================
  
  // Get current user's onboarding status
  app.get("/api/onboarding/status", combinedAuth, async (req: any, res) => {
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
      res.json(updatedStatus);
    } catch (error) {
      console.error("Error submitting for verification:", error);
      res.status(500).json({ error: "Failed to submit for verification" });
    }
  });
  
  // ==================== ADMIN VERIFICATION ROUTES ====================
  
  // Get admin stats (admin+)
  app.get("/api/admin/stats", combinedAuth, requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });
  
  // Get all pending verifications (admin+)
  app.get("/api/admin/verifications/pending", combinedAuth, requireAdmin, async (req: any, res) => {
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
  app.get("/api/admin/onboarding", combinedAuth, requireAdmin, async (req: any, res) => {
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
  app.get("/api/admin/users", combinedAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Get onboarding status for each user
      const enrichedUsers = await Promise.all(users.map(async (user) => {
        const onboardingStatus = await storage.getOnboardingStatus(user.id);
        const company = await storage.getDefaultCompanyProfile(user.id);
        return { ...user, onboardingStatus, company };
      }));
      
      res.json(enrichedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Get user details (admin+)
  app.get("/api/admin/users/:userId", combinedAuth, requireAdmin, async (req: any, res) => {
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
  app.post("/api/admin/users/:userId/approve", combinedAuth, requireAdmin, async (req: any, res) => {
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
      res.json(updatedStatus);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ error: "Failed to approve user" });
    }
  });
  
  // Reject user (admin+) - requires mandatory remarks
  app.post("/api/admin/users/:userId/reject", combinedAuth, requireAdmin, async (req: any, res) => {
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
      res.json(updatedStatus);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ error: "Failed to reject user" });
    }
  });
  
  // Update user role (super_admin only)
  app.patch("/api/admin/users/:userId/role", combinedAuth, requireSuperAdmin, async (req: any, res) => {
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
  app.get("/api/admin/actions", combinedAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.query;
      const actions = await storage.getAdminActions(userId as string | undefined);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching admin actions:", error);
      res.status(500).json({ error: "Failed to fetch admin actions" });
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
      const isSupportStaff = hasRoleLevel(req.supabaseUser?.role, 'support_agent');
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
      
      const isSupportStaff = hasRoleLevel(req.supabaseUser?.role, 'support_agent');
      
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

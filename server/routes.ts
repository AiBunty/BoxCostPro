import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCompanyProfileSchema, insertPartyProfileSchema, insertQuoteSchema, insertAppSettingsSchema, insertRateMemorySchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}

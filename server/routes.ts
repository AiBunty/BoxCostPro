import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCompanyProfileSchema, insertPartyProfileSchema, insertQuoteSchema, insertAppSettingsSchema, insertRateMemorySchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Company Profiles
  app.get("/api/company-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/company-profiles/default", async (req, res) => {
    try {
      const profile = await storage.getDefaultCompanyProfile();
      if (!profile) {
        return res.status(404).json({ error: "No default profile found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default profile" });
    }
  });

  app.get("/api/company-profiles/:id", async (req, res) => {
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

  app.post("/api/company-profiles", async (req, res) => {
    try {
      const data = insertCompanyProfileSchema.parse(req.body);
      const profile = await storage.createCompanyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid profile data" });
    }
  });

  app.patch("/api/company-profiles/:id", async (req, res) => {
    try {
      // Validate the update data (partial schema)
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

  app.post("/api/company-profiles/:id/set-default", async (req, res) => {
    try {
      await storage.setDefaultCompanyProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to set default profile" });
    }
  });

  // Party Profiles
  app.get("/api/party-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllPartyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch party profiles" });
    }
  });

  app.post("/api/party-profiles", async (req, res) => {
    try {
      const data = insertPartyProfileSchema.parse(req.body);
      const profile = await storage.createPartyProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: "Invalid party profile data" });
    }
  });

  app.patch("/api/party-profiles/:id", async (req, res) => {
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

  app.delete("/api/party-profiles/:id", async (req, res) => {
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

  // Quotes
  app.get("/api/quotes", async (req, res) => {
    try {
      const partyName = req.query.partyName as string | undefined;
      const customerCompany = req.query.customerCompany as string | undefined;
      
      if (partyName || customerCompany) {
        const quotes = await storage.searchQuotes(partyName, customerCompany);
        res.json(quotes);
      } else {
        const quotes = await storage.getAllQuotes();
        res.json(quotes);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
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

  app.post("/api/quotes", async (req, res) => {
    try {
      const data = insertQuoteSchema.parse(req.body);
      const quote = await storage.createQuote(data);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Failed to create quote:", error);
      res.status(400).json({ error: "Invalid quote data" });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      // Validate the update data (partial schema)
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

  app.delete("/api/quotes/:id", async (req, res) => {
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

  // Rate Memory
  app.get("/api/rate-memory", async (req, res) => {
    try {
      const rates = await storage.getAllRateMemory();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate memory" });
    }
  });

  app.get("/api/rate-memory/:bf/:shade", async (req, res) => {
    try {
      const rate = await storage.getRateMemoryByKey(req.params.bf, req.params.shade);
      if (!rate) {
        return res.status(404).json({ error: "Rate not found" });
      }
      res.json(rate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate" });
    }
  });

  app.post("/api/rate-memory", async (req, res) => {
    try {
      const { bfValue, shade, rate } = req.body;
      const saved = await storage.saveOrUpdateRateMemory(bfValue, shade, rate);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: "Failed to save rate" });
    }
  });

  // App Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const data = insertAppSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAppSettings(data);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

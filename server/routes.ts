import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCompanyProfileSchema, insertQuoteSchema } from "@shared/schema";

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
      const profile = await storage.updateCompanyProfile(req.params.id, req.body);
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
      const quote = await storage.updateQuote(req.params.id, req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}

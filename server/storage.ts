import { 
  type CompanyProfile, 
  type InsertCompanyProfile,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type AppSettings,
  type InsertAppSettings
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Company Profiles
  getCompanyProfile(id: string): Promise<CompanyProfile | undefined>;
  getAllCompanyProfiles(): Promise<CompanyProfile[]>;
  getDefaultCompanyProfile(): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: string, profile: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  setDefaultCompanyProfile(id: string): Promise<void>;
  
  // Quotes
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<Quote[]>;
  searchQuotes(partyName?: string, customerCompany?: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  
  // App Settings
  getAppSettings(): Promise<AppSettings>;
  updateAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings>;
}

export class MemStorage implements IStorage {
  private companyProfiles: Map<string, CompanyProfile>;
  private quotes: Map<string, Quote>;
  private appSettings: AppSettings;

  constructor() {
    this.companyProfiles = new Map();
    this.quotes = new Map();
    
    // Add default company profile
    const defaultProfile: CompanyProfile = {
      id: randomUUID(),
      companyName: "Ventura Packagers Private Limited",
      gstNo: "27AAACV3461F1ZG",
      address: "W43H MIDC AMBAD",
      phone: "0253-4035062",
      email: "venturapackagers@gmail.com",
      website: "http://www.venturapackagers.com/",
      socialMedia: "https://www.instagram.com/venturapackagers/",
      googleLocation: "https://maps.app.goo.gl/vYbDHFm3ktAvhszR8",
      paymentTerms: "100% Advance",
      deliveryTime: "Delivery 10 days after receipt of Purchase order",
      isDefault: true,
    };
    this.companyProfiles.set(defaultProfile.id, defaultProfile);
    
    // Initialize app settings
    this.appSettings = {
      id: randomUUID(),
      appTitle: "Box Costing Calculator",
      plyThicknessMap: {
        '1': 0.45,
        '3': 2.5,
        '5': 3.5,
        '7': 5.5,
        '9': 6.5,
      },
    };
  }

  // Company Profiles
  async getCompanyProfile(id: string): Promise<CompanyProfile | undefined> {
    return this.companyProfiles.get(id);
  }

  async getAllCompanyProfiles(): Promise<CompanyProfile[]> {
    const values: CompanyProfile[] = [];
    this.companyProfiles.forEach(profile => values.push(profile));
    return values;
  }

  async getDefaultCompanyProfile(): Promise<CompanyProfile | undefined> {
    return Array.from(this.companyProfiles.values()).find(p => p.isDefault);
  }

  async createCompanyProfile(insertProfile: InsertCompanyProfile): Promise<CompanyProfile> {
    const id = randomUUID();
    const profile: CompanyProfile = { 
      ...insertProfile, 
      id, 
      isDefault: false,
      address: insertProfile.address || null,
      gstNo: insertProfile.gstNo || null,
      phone: insertProfile.phone || null,
      email: insertProfile.email || null,
      website: insertProfile.website || null,
      socialMedia: insertProfile.socialMedia || null,
      googleLocation: insertProfile.googleLocation || null,
      paymentTerms: insertProfile.paymentTerms || null,
      deliveryTime: insertProfile.deliveryTime || null,
    };
    this.companyProfiles.set(id, profile);
    return profile;
  }

  async updateCompanyProfile(id: string, updates: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined> {
    const existing = this.companyProfiles.get(id);
    if (!existing) return undefined;
    
    const updated: CompanyProfile = { ...existing, ...updates };
    this.companyProfiles.set(id, updated);
    return updated;
  }

  async setDefaultCompanyProfile(id: string): Promise<void> {
    // Remove default from all profiles
    this.companyProfiles.forEach(profile => {
      profile.isDefault = false;
    });
    
    // Set new default
    const profile = this.companyProfiles.get(id);
    if (profile) {
      profile.isDefault = true;
    }
  }

  // Quotes
  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async getAllQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Newest first
      });
  }

  async searchQuotes(partyName?: string, customerCompany?: string): Promise<Quote[]> {
    let results = Array.from(this.quotes.values());
    
    if (partyName) {
      const search = partyName.toLowerCase();
      results = results.filter(q => 
        q.partyName.toLowerCase().includes(search)
      );
    }
    
    if (customerCompany) {
      const search = customerCompany.toLowerCase();
      results = results.filter(q => 
        q.customerCompany?.toLowerCase().includes(search)
      );
    }
    
    return results.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const quote: Quote = { 
      ...insertQuote, 
      id,
      createdAt: now,
      customerCompany: insertQuote.customerCompany || null,
      customerEmail: insertQuote.customerEmail || null,
      customerMobile: insertQuote.customerMobile || null,
      companyProfileId: insertQuote.companyProfileId || null,
    };
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const existing = this.quotes.get(id);
    if (!existing) return undefined;
    
    const updated: Quote = { ...existing, ...updates };
    this.quotes.set(id, updated);
    return updated;
  }

  async deleteQuote(id: string): Promise<boolean> {
    return this.quotes.delete(id);
  }
  
  // App Settings
  async getAppSettings(): Promise<AppSettings> {
    return this.appSettings;
  }
  
  async updateAppSettings(updates: Partial<InsertAppSettings>): Promise<AppSettings> {
    this.appSettings = { ...this.appSettings, ...updates };
    return this.appSettings;
  }
}

export const storage = new MemStorage();

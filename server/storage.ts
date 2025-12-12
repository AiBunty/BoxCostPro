import { 
  type CompanyProfile, 
  type InsertCompanyProfile,
  type PartyProfile,
  type InsertPartyProfile,
  type Quote,
  type InsertQuote,
  type AppSettings,
  type InsertAppSettings,
  type RateMemoryEntry,
  type InsertRateMemory,
  type User,
  type UpsertUser,
  companyProfiles,
  partyProfiles,
  quotes,
  appSettings,
  rateMemory,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Company Profiles
  getCompanyProfile(id: string): Promise<CompanyProfile | undefined>;
  getAllCompanyProfiles(userId?: string): Promise<CompanyProfile[]>;
  getDefaultCompanyProfile(userId?: string): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: string, profile: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  setDefaultCompanyProfile(id: string, userId?: string): Promise<void>;
  
  // Party Profiles
  getPartyProfile(id: string): Promise<PartyProfile | undefined>;
  getAllPartyProfiles(userId?: string): Promise<PartyProfile[]>;
  createPartyProfile(profile: InsertPartyProfile): Promise<PartyProfile>;
  updatePartyProfile(id: string, profile: Partial<InsertPartyProfile>): Promise<PartyProfile | undefined>;
  deletePartyProfile(id: string): Promise<boolean>;
  searchPartyProfiles(userId: string, search: string): Promise<PartyProfile[]>;
  
  // Quotes
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(userId?: string): Promise<Quote[]>;
  searchQuotes(userId: string, options: { partyName?: string; boxName?: string; boxSize?: string }): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  
  // Rate Memory (BF + Shade combinations)
  getAllRateMemory(userId?: string): Promise<RateMemoryEntry[]>;
  getRateMemoryByKey(bfValue: string, shade: string, userId?: string): Promise<RateMemoryEntry | undefined>;
  saveOrUpdateRateMemory(bfValue: string, shade: string, rate: number, userId?: string): Promise<RateMemoryEntry>;
  
  // App Settings
  getAppSettings(userId?: string): Promise<AppSettings>;
  updateAppSettings(settings: Partial<InsertAppSettings>, userId?: string): Promise<AppSettings>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Company Profiles
  async getCompanyProfile(id: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
    return profile;
  }

  async getAllCompanyProfiles(userId?: string): Promise<CompanyProfile[]> {
    if (userId) {
      return await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
    }
    return await db.select().from(companyProfiles);
  }

  async getDefaultCompanyProfile(userId?: string): Promise<CompanyProfile | undefined> {
    if (userId) {
      const [profile] = await db.select().from(companyProfiles)
        .where(and(eq(companyProfiles.userId, userId), eq(companyProfiles.isDefault, true)));
      return profile;
    }
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.isDefault, true));
    return profile;
  }

  async createCompanyProfile(insertProfile: InsertCompanyProfile): Promise<CompanyProfile> {
    const [profile] = await db.insert(companyProfiles).values(insertProfile).returning();
    return profile;
  }

  async updateCompanyProfile(id: string, updates: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined> {
    const [updated] = await db.update(companyProfiles)
      .set(updates)
      .where(eq(companyProfiles.id, id))
      .returning();
    return updated;
  }

  async setDefaultCompanyProfile(id: string, userId?: string): Promise<void> {
    // Remove default from all user's profiles
    if (userId) {
      await db.update(companyProfiles)
        .set({ isDefault: false })
        .where(eq(companyProfiles.userId, userId));
    } else {
      await db.update(companyProfiles).set({ isDefault: false });
    }
    // Set new default
    await db.update(companyProfiles)
      .set({ isDefault: true })
      .where(eq(companyProfiles.id, id));
  }

  // Party Profiles
  async getPartyProfile(id: string): Promise<PartyProfile | undefined> {
    const [profile] = await db.select().from(partyProfiles).where(eq(partyProfiles.id, id));
    return profile;
  }

  async getAllPartyProfiles(userId?: string): Promise<PartyProfile[]> {
    if (userId) {
      return await db.select().from(partyProfiles).where(eq(partyProfiles.userId, userId));
    }
    return await db.select().from(partyProfiles);
  }

  async createPartyProfile(insertProfile: InsertPartyProfile): Promise<PartyProfile> {
    const [profile] = await db.insert(partyProfiles).values(insertProfile).returning();
    return profile;
  }

  async updatePartyProfile(id: string, updates: Partial<InsertPartyProfile>): Promise<PartyProfile | undefined> {
    const [updated] = await db.update(partyProfiles)
      .set(updates)
      .where(eq(partyProfiles.id, id))
      .returning();
    return updated;
  }

  async deletePartyProfile(id: string): Promise<boolean> {
    const result = await db.delete(partyProfiles).where(eq(partyProfiles.id, id));
    return true;
  }

  async searchPartyProfiles(userId: string, search: string): Promise<PartyProfile[]> {
    const searchTerm = `%${search}%`;
    return await db.select().from(partyProfiles)
      .where(and(
        eq(partyProfiles.userId, userId),
        or(
          ilike(partyProfiles.personName, searchTerm),
          ilike(partyProfiles.companyName, searchTerm)
        )
      ));
  }

  // Quotes
  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getAllQuotes(userId?: string): Promise<Quote[]> {
    if (userId) {
      return await db.select().from(quotes).where(eq(quotes.userId, userId));
    }
    return await db.select().from(quotes);
  }

  async searchQuotes(userId: string, options: { partyName?: string; boxName?: string; boxSize?: string }): Promise<Quote[]> {
    let results = await db.select().from(quotes).where(eq(quotes.userId, userId));
    
    if (options.partyName) {
      const search = options.partyName.toLowerCase();
      results = results.filter(q => q.partyName.toLowerCase().includes(search));
    }
    
    if (options.boxName) {
      const search = options.boxName.toLowerCase();
      results = results.filter(q => {
        const items = q.items as any[];
        return items.some(item => item.boxName?.toLowerCase().includes(search));
      });
    }
    
    if (options.boxSize) {
      const search = options.boxSize.toLowerCase();
      results = results.filter(q => {
        const items = q.items as any[];
        return items.some(item => {
          const sizeStr = `${item.length}x${item.width}${item.height ? `x${item.height}` : ''}`;
          return sizeStr.includes(search);
        });
      });
    }
    
    return results;
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(insertQuote).returning();
    return quote;
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set(updates)
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async deleteQuote(id: string): Promise<boolean> {
    await db.delete(quotes).where(eq(quotes.id, id));
    return true;
  }
  
  // Rate Memory
  async getAllRateMemory(userId?: string): Promise<RateMemoryEntry[]> {
    if (userId) {
      return await db.select().from(rateMemory).where(eq(rateMemory.userId, userId));
    }
    return await db.select().from(rateMemory);
  }

  async getRateMemoryByKey(bfValue: string, shade: string, userId?: string): Promise<RateMemoryEntry | undefined> {
    if (userId) {
      const [entry] = await db.select().from(rateMemory)
        .where(and(
          eq(rateMemory.userId, userId),
          eq(rateMemory.bfValue, bfValue),
          eq(rateMemory.shade, shade)
        ));
      return entry;
    }
    const [entry] = await db.select().from(rateMemory)
      .where(and(eq(rateMemory.bfValue, bfValue), eq(rateMemory.shade, shade)));
    return entry;
  }

  async saveOrUpdateRateMemory(bfValue: string, shade: string, rate: number, userId?: string): Promise<RateMemoryEntry> {
    const existing = await this.getRateMemoryByKey(bfValue, shade, userId);
    
    if (existing) {
      const [updated] = await db.update(rateMemory)
        .set({ rate, updatedAt: new Date().toISOString() })
        .where(eq(rateMemory.id, existing.id))
        .returning();
      return updated;
    }
    
    const [entry] = await db.insert(rateMemory)
      .values({ bfValue, shade, rate, userId })
      .returning();
    return entry;
  }
  
  // App Settings
  async getAppSettings(userId?: string): Promise<AppSettings> {
    if (userId) {
      const [settings] = await db.select().from(appSettings).where(eq(appSettings.userId, userId));
      if (settings) return settings;
    }
    
    const [settings] = await db.select().from(appSettings);
    if (settings) return settings;
    
    // Create default settings
    const [newSettings] = await db.insert(appSettings).values({
      userId,
      appTitle: "Box Costing Calculator",
      plyThicknessMap: { '1': 0.45, '3': 2.5, '5': 3.5, '7': 5.5, '9': 6.5 },
    }).returning();
    return newSettings;
  }
  
  async updateAppSettings(updates: Partial<InsertAppSettings>, userId?: string): Promise<AppSettings> {
    const existing = await this.getAppSettings(userId);
    const [updated] = await db.update(appSettings)
      .set(updates)
      .where(eq(appSettings.id, existing.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();

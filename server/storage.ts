import { 
  type CompanyProfile, 
  type InsertCompanyProfile,
  type PartyProfile,
  type InsertPartyProfile,
  type Quote,
  type InsertQuote,
  type QuoteVersion,
  type InsertQuoteVersion,
  type QuoteItemVersion,
  type InsertQuoteItemVersion,
  type AppSettings,
  type InsertAppSettings,
  type RateMemoryEntry,
  type InsertRateMemory,
  type User,
  type UpsertUser,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type UserSubscription,
  type InsertUserSubscription,
  type Coupon,
  type InsertCoupon,
  type TrialInvite,
  type InsertTrialInvite,
  type PaymentTransaction,
  type InsertPaymentTransaction,
  type FlutingSetting,
  type InsertFlutingSetting,
  type FluteSetting,
  type InsertFluteSetting,
  type ChatbotWidget,
  type InsertChatbotWidget,
  type PaperPrice,
  type InsertPaperPrice,
  type PaperBfPrice,
  type InsertPaperBfPrice,
  type ShadePremium,
  type InsertShadePremium,
  type PaperPricingRules,
  type InsertPaperPricingRules,
  type UserQuoteTerms,
  type InsertUserQuoteTerms,
  type BoxSpecification,
  type InsertBoxSpecification,
  type BoxSpecVersion,
  type InsertBoxSpecVersion,
  type UserProfile,
  type InsertUserProfile,
  type BusinessDefaults,
  type InsertBusinessDefaults,
  companyProfiles,
  partyProfiles,
  quotes,
  quoteVersions,
  quoteItemVersions,
  appSettings,
  rateMemory,
  users,
  subscriptionPlans,
  userSubscriptions,
  coupons,
  trialInvites,
  paymentTransactions,
  flutingSettings,
  fluteSettings,
  chatbotWidgets,
  ownerSettings,
  paperPrices,
  paperBfPrices,
  shadePremiums,
  paperPricingRules,
  userQuoteTerms,
  boxSpecifications,
  boxSpecVersions,
  userProfiles,
  businessDefaults
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  // User operations (for Supabase Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySupabaseId(supabaseUserId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  
  // User Profiles (onboarding/setup tracking)
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;
  
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
  getAllQuotesWithItems(userId?: string): Promise<(Quote & { items: any[]; activeVersion: QuoteVersion | null })[]>;
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
  
  // Subscription Plans (Admin)
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: string): Promise<boolean>;
  
  // User Subscriptions
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(id: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  getAllUserSubscriptions(): Promise<UserSubscription[]>;
  
  // Coupons (Admin)
  getAllCoupons(): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, updates: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUsage(id: string): Promise<void>;
  
  // Trial Invites (Admin)
  getAllTrialInvites(): Promise<TrialInvite[]>;
  getTrialInviteByToken(token: string): Promise<TrialInvite | undefined>;
  createTrialInvite(invite: InsertTrialInvite): Promise<TrialInvite>;
  updateTrialInvite(id: string, updates: Partial<TrialInvite>): Promise<TrialInvite | undefined>;
  
  // Payment Transactions
  createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction>;
  updatePaymentTransaction(id: string, updates: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction | undefined>;
  getPaymentTransactionByOrderId(orderId: string): Promise<PaymentTransaction | undefined>;
  getAllPaymentTransactions(): Promise<PaymentTransaction[]>;
  
  // Fluting Settings (per user)
  getFlutingSettings(userId: string): Promise<FlutingSetting[]>;
  saveFlutingSetting(setting: InsertFlutingSetting): Promise<FlutingSetting>;
  updateFlutingSetting(id: string, updates: Partial<InsertFlutingSetting>): Promise<FlutingSetting | undefined>;
  deleteFlutingSetting(id: string): Promise<boolean>;
  
  // Flute Settings - NEW (per user, technical constants)
  getFluteSettings(userId: string): Promise<FluteSetting[]>;
  saveFluteSettings(settings: InsertFluteSetting[]): Promise<FluteSetting[]>;
  updateFluteSetting(id: string, updates: Partial<InsertFluteSetting>): Promise<FluteSetting | undefined>;
  
  // Business Defaults (per user)
  getBusinessDefaults(userId: string): Promise<BusinessDefaults | undefined>;
  saveBusinessDefaults(defaults: InsertBusinessDefaults): Promise<BusinessDefaults>;
  
  // Chatbot Widgets (per user)
  getChatbotWidgets(userId: string): Promise<ChatbotWidget[]>;
  getChatbotWidgetByToken(token: string): Promise<ChatbotWidget | undefined>;
  createChatbotWidget(widget: InsertChatbotWidget): Promise<ChatbotWidget>;
  updateChatbotWidget(id: string, updates: Partial<InsertChatbotWidget>): Promise<ChatbotWidget | undefined>;
  deleteChatbotWidget(id: string): Promise<boolean>;
  
  // Owner Settings
  getOwnerSettings(): Promise<any>;
  updateOwnerSettings(updates: any): Promise<any>;
  
  // Paper Prices (legacy - per user)
  getPaperPrices(userId: string): Promise<PaperPrice[]>;
  getPaperPrice(id: string): Promise<PaperPrice | undefined>;
  getPaperPriceBySpec(userId: string, gsm: number, bf: number, shade: string): Promise<PaperPrice | undefined>;
  createPaperPrice(price: InsertPaperPrice): Promise<PaperPrice>;
  updatePaperPrice(id: string, updates: Partial<InsertPaperPrice>): Promise<PaperPrice | undefined>;
  deletePaperPrice(id: string): Promise<boolean>;
  
  // BF-Based Paper Prices (per user)
  getPaperBfPrices(userId: string): Promise<PaperBfPrice[]>;
  getPaperBfPrice(id: string): Promise<PaperBfPrice | undefined>;
  getPaperBfPriceByBf(userId: string, bf: number): Promise<PaperBfPrice | undefined>;
  createPaperBfPrice(price: InsertPaperBfPrice): Promise<PaperBfPrice>;
  updatePaperBfPrice(id: string, updates: Partial<InsertPaperBfPrice>): Promise<PaperBfPrice | undefined>;
  deletePaperBfPrice(id: string): Promise<boolean>;
  
  // Shade Premiums (per user)
  getShadePremiums(userId: string): Promise<ShadePremium[]>;
  getShadePremium(id: string): Promise<ShadePremium | undefined>;
  getShadePremiumByShade(userId: string, shade: string): Promise<ShadePremium | undefined>;
  createShadePremium(premium: InsertShadePremium): Promise<ShadePremium>;
  updateShadePremium(id: string, updates: Partial<InsertShadePremium>): Promise<ShadePremium | undefined>;
  deleteShadePremium(id: string): Promise<boolean>;
  
  // Paper Pricing Rules (per user)
  getPaperPricingRules(userId: string): Promise<PaperPricingRules | undefined>;
  createOrUpdatePaperPricingRules(rules: InsertPaperPricingRules): Promise<PaperPricingRules>;
  getPaperSetupStatus(userId: string): Promise<{ completed: boolean; rules: PaperPricingRules | null; pricesCount: number }>;
  
  // User Quote Terms (per user)
  getUserQuoteTerms(userId: string): Promise<UserQuoteTerms | undefined>;
  createOrUpdateUserQuoteTerms(terms: InsertUserQuoteTerms): Promise<UserQuoteTerms>;
  
  // Box Specifications (per user with versioning)
  getBoxSpecification(id: string): Promise<BoxSpecification | undefined>;
  getBoxSpecifications(userId: string, customerId?: string): Promise<BoxSpecification[]>;
  findExistingBoxSpec(userId: string, customerId: string | null, boxType: string, length: number, breadth: number, height: number | null, ply: string): Promise<BoxSpecification | undefined>;
  createBoxSpecification(spec: InsertBoxSpecification): Promise<BoxSpecification>;
  updateBoxSpecification(id: string, updates: Partial<InsertBoxSpecification>): Promise<BoxSpecification | undefined>;
  
  // Box Spec Versions
  getBoxSpecVersions(specId: string): Promise<BoxSpecVersion[]>;
  getBoxSpecVersion(specId: string, versionNumber: number): Promise<BoxSpecVersion | undefined>;
  createBoxSpecVersion(version: InsertBoxSpecVersion): Promise<BoxSpecVersion>;
}

export class DatabaseStorage implements IStorage {
  // User operations (for Supabase Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserBySupabaseId(supabaseUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // For Supabase Auth - check by supabaseUserId first, then by email
    let existingUser: User | undefined;
    
    if (userData.supabaseUserId) {
      existingUser = await this.getUserBySupabaseId(userData.supabaseUserId);
    }
    if (!existingUser && userData.email) {
      existingUser = await this.getUserByEmail(userData.email);
    }
    if (!existingUser && userData.id) {
      existingUser = await this.getUser(userData.id);
    }
    
    if (existingUser) {
      // User exists, update non-role fields (preserve existing role)
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          supabaseUserId: userData.supabaseUserId || existingUser.supabaseUserId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return user;
    }
    
    // New user - insert with role='user', then atomically promote to owner if none exists
    const now = new Date();
    
    try {
      const [insertedUser] = await db
        .insert(users)
        .values({
          id: userData.id || undefined,
          supabaseUserId: userData.supabaseUserId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: 'user',
          authProvider: userData.authProvider || 'supabase',
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      // Atomically promote to owner if no owner exists yet
      try {
        await db.execute(sql`
          UPDATE users 
          SET role = 'owner', updated_at = NOW()
          WHERE id = ${insertedUser.id}
          AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
        `);
      } catch (promoteError: any) {
        if (!promoteError.message?.includes('unique')) {
          console.log('Owner promotion note:', promoteError.message);
        }
      }
      
      // Create user profile for onboarding tracking
      await this.createUserProfile({ userId: insertedUser.id });
      
      // Return the final user state
      const finalUser = await this.getUser(insertedUser.id);
      return finalUser || insertedUser;
    } catch (error: any) {
      if (userData.supabaseUserId) {
        const existingAfterRace = await this.getUserBySupabaseId(userData.supabaseUserId);
        if (existingAfterRace) return existingAfterRace;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // User Profiles (onboarding/setup tracking)
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [created] = await db.insert(userProfiles).values(profile).returning();
    return created;
  }

  async updateUserProfile(userId: string, updates: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const [updated] = await db
      .update(userProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
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
    // Check if any quotes exist for this party
    const partyQuotes = await db.select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.partyId, id))
      .limit(1);
    
    if (partyQuotes.length > 0) {
      throw new Error("PARTY_HAS_QUOTES");
    }
    
    const result = await db.delete(partyProfiles).where(eq(partyProfiles.id, id));
    return true;
  }
  
  async getQuotesByPartyId(partyId: string, userId?: string): Promise<Quote[]> {
    if (userId) {
      return await db.select().from(quotes).where(and(
        eq(quotes.partyId, partyId),
        eq(quotes.userId, userId)
      ));
    }
    return await db.select().from(quotes).where(eq(quotes.partyId, partyId));
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

  async getAllQuotesWithItems(userId?: string): Promise<(Quote & { items: any[]; activeVersion: QuoteVersion | null })[]> {
    // Get all quotes for user
    const quotesData = userId 
      ? await db.select().from(quotes).where(eq(quotes.userId, userId))
      : await db.select().from(quotes);
    
    // For each quote, get its active version and items
    const result = await Promise.all(
      quotesData.map(async (quote) => {
        let activeVersion: QuoteVersion | null = null;
        let items: any[] = [];
        
        if (quote.activeVersionId) {
          // Get the active version
          const [version] = await db.select().from(quoteVersions)
            .where(eq(quoteVersions.id, quote.activeVersionId));
          activeVersion = version || null;
          
          // Get items for the active version
          if (version) {
            const itemVersions = await db.select().from(quoteItemVersions)
              .where(eq(quoteItemVersions.quoteVersionId, version.id));
            
            // Extract item data from snapshots
            items = itemVersions.map(iv => ({
              ...(iv.itemDataSnapshot as any || {}),
              boxName: iv.boxName,
              ply: iv.ply,
              length: iv.length,
              width: iv.width,
              height: iv.height,
              quantity: iv.quantity,
              sheetLength: iv.sheetLength,
              sheetWidth: iv.sheetWidth,
              sheetWeight: iv.sheetWeight,
              originalCostPerBox: iv.originalCostPerBox,
              negotiatedCostPerBox: iv.negotiatedCostPerBox,
              finalCostPerBox: iv.finalCostPerBox,
              totalCostPerBox: iv.finalCostPerBox,
              negotiatedPrice: iv.negotiatedCostPerBox,
            }));
          }
        }
        
        return {
          ...quote,
          items,
          activeVersion,
        };
      })
    );
    
    return result;
  }

  async searchQuotes(userId: string, options: { partyName?: string; boxName?: string; boxSize?: string }): Promise<Quote[]> {
    let results = await db.select().from(quotes).where(eq(quotes.userId, userId));
    
    if (options.partyName) {
      const search = options.partyName.toLowerCase();
      results = results.filter(q => q.partyName.toLowerCase().includes(search));
    }
    
    // Note: boxName and boxSize search requires joining with quote_item_versions
    // This will be implemented with the full versioning system
    // For now, filtering by partyName only
    
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

  // Generate unique quote number (format: QT-YYYYMMDD-XXX)
  async generateQuoteNumber(userId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Count quotes created today by this user
    const existingQuotes = await db.select().from(quotes)
      .where(eq(quotes.userId, userId));
    
    const todayQuotes = existingQuotes.filter(q => {
      if (!q.createdAt) return false;
      const quoteDate = new Date(q.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
      return quoteDate === dateStr;
    });
    
    const sequence = (todayQuotes.length + 1).toString().padStart(3, '0');
    return `QT-${dateStr}-${sequence}`;
  }

  // Quote Versions
  async createQuoteVersion(insertVersion: InsertQuoteVersion): Promise<QuoteVersion> {
    const [version] = await db.insert(quoteVersions).values(insertVersion).returning();
    return version;
  }

  async getQuoteVersion(id: string): Promise<QuoteVersion | undefined> {
    const [version] = await db.select().from(quoteVersions).where(eq(quoteVersions.id, id));
    return version;
  }

  async getQuoteVersionsByQuoteId(quoteId: string): Promise<QuoteVersion[]> {
    return await db.select().from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
      .orderBy(quoteVersions.versionNo);
  }

  async getLatestQuoteVersion(quoteId: string): Promise<QuoteVersion | undefined> {
    const versions = await this.getQuoteVersionsByQuoteId(quoteId);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  async getNextVersionNumber(quoteId: string): Promise<number> {
    const versions = await this.getQuoteVersionsByQuoteId(quoteId);
    return versions.length > 0 ? Math.max(...versions.map(v => v.versionNo)) + 1 : 1;
  }

  // Quote Item Versions
  async createQuoteItemVersions(items: InsertQuoteItemVersion[]): Promise<QuoteItemVersion[]> {
    if (items.length === 0) return [];
    const inserted = await db.insert(quoteItemVersions).values(items).returning();
    return inserted;
  }

  async getQuoteItemVersionsByVersionId(versionId: string): Promise<QuoteItemVersion[]> {
    return await db.select().from(quoteItemVersions)
      .where(eq(quoteItemVersions.quoteVersionId, versionId))
      .orderBy(quoteItemVersions.itemIndex);
  }

  // Get quote with active version and items (for display)
  async getQuoteWithActiveVersion(quoteId: string): Promise<{
    quote: Quote;
    version: QuoteVersion | null;
    items: QuoteItemVersion[];
  } | null> {
    const quote = await this.getQuote(quoteId);
    if (!quote) return null;

    let version: QuoteVersion | null = null;
    let items: QuoteItemVersion[] = [];

    if (quote.activeVersionId) {
      const v = await this.getQuoteVersion(quote.activeVersionId);
      if (v) {
        version = v;
        items = await this.getQuoteItemVersionsByVersionId(v.id);
      }
    }

    return { quote, version, items };
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
  
  // Subscription Plans
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans);
  }
  
  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }
  
  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan).returning();
    return created;
  }
  
  async updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id)).returning();
    return updated;
  }
  
  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return true;
  }
  
  // User Subscriptions
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [sub] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId));
    return sub;
  }
  
  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const [created] = await db.insert(userSubscriptions).values(subscription).returning();
    return created;
  }
  
  async updateUserSubscription(id: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    const [updated] = await db.update(userSubscriptions).set({ ...updates, updatedAt: new Date() }).where(eq(userSubscriptions.id, id)).returning();
    return updated;
  }
  
  async getAllUserSubscriptions(): Promise<UserSubscription[]> {
    return await db.select().from(userSubscriptions);
  }
  
  // Coupons
  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }
  
  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }
  
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }
  
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values(coupon).returning();
    return created;
  }
  
  async updateCoupon(id: string, updates: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return updated;
  }
  
  async deleteCoupon(id: string): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }
  
  async incrementCouponUsage(id: string): Promise<void> {
    const coupon = await this.getCoupon(id);
    if (coupon) {
      await db.update(coupons).set({ usedCount: (coupon.usedCount || 0) + 1 }).where(eq(coupons.id, id));
    }
  }
  
  // Trial Invites
  async getAllTrialInvites(): Promise<TrialInvite[]> {
    return await db.select().from(trialInvites);
  }
  
  async getTrialInviteByToken(token: string): Promise<TrialInvite | undefined> {
    const [invite] = await db.select().from(trialInvites).where(eq(trialInvites.inviteToken, token));
    return invite;
  }
  
  async createTrialInvite(invite: InsertTrialInvite): Promise<TrialInvite> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (invite.trialDays || 14));
    
    const [created] = await db.insert(trialInvites).values({
      ...invite,
      inviteToken: token,
      expiresAt,
    }).returning();
    return created;
  }
  
  async updateTrialInvite(id: string, updates: Partial<TrialInvite>): Promise<TrialInvite | undefined> {
    const [updated] = await db.update(trialInvites).set(updates).where(eq(trialInvites.id, id)).returning();
    return updated;
  }
  
  // Payment Transactions
  async createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const [created] = await db.insert(paymentTransactions).values(transaction).returning();
    return created;
  }
  
  async updatePaymentTransaction(id: string, updates: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction | undefined> {
    const [updated] = await db.update(paymentTransactions).set(updates).where(eq(paymentTransactions.id, id)).returning();
    return updated;
  }
  
  async getPaymentTransactionByOrderId(orderId: string): Promise<PaymentTransaction | undefined> {
    const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.razorpayOrderId, orderId));
    return tx;
  }
  
  async getAllPaymentTransactions(): Promise<PaymentTransaction[]> {
    return await db.select().from(paymentTransactions);
  }
  
  // Fluting Settings
  async getFlutingSettings(userId: string): Promise<FlutingSetting[]> {
    return await db.select().from(flutingSettings).where(eq(flutingSettings.userId, userId));
  }
  
  async saveFlutingSetting(setting: InsertFlutingSetting): Promise<FlutingSetting> {
    // Check if setting exists for this user and flute type
    const existing = await db.select().from(flutingSettings)
      .where(and(
        eq(flutingSettings.userId, setting.userId!),
        eq(flutingSettings.fluteType, setting.fluteType)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(flutingSettings)
        .set({ flutingFactor: setting.flutingFactor, fluteHeight: setting.fluteHeight })
        .where(eq(flutingSettings.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(flutingSettings).values(setting).returning();
    return created;
  }
  
  async updateFlutingSetting(id: string, updates: Partial<InsertFlutingSetting>): Promise<FlutingSetting | undefined> {
    const [updated] = await db.update(flutingSettings).set(updates).where(eq(flutingSettings.id, id)).returning();
    return updated;
  }
  
  async deleteFlutingSetting(id: string): Promise<boolean> {
    await db.delete(flutingSettings).where(eq(flutingSettings.id, id));
    return true;
  }
  
  // Flute Settings - NEW (technical constants for board costing)
  async getFluteSettings(userId: string): Promise<FluteSetting[]> {
    return await db.select().from(fluteSettings).where(eq(fluteSettings.userId, userId));
  }
  
  async saveFluteSettings(settings: InsertFluteSetting[]): Promise<FluteSetting[]> {
    if (settings.length === 0) return [];
    
    const results: FluteSetting[] = [];
    for (const setting of settings) {
      // Check if setting exists for this user and flute type
      const existing = await db.select().from(fluteSettings)
        .where(and(
          eq(fluteSettings.userId, setting.userId),
          eq(fluteSettings.fluteType, setting.fluteType)
        ));
      
      if (existing.length > 0) {
        const [updated] = await db.update(fluteSettings)
          .set({ 
            flutingFactor: setting.flutingFactor, 
            fluteHeightMm: setting.fluteHeightMm,
            updatedAt: new Date()
          })
          .where(eq(fluteSettings.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(fluteSettings).values(setting).returning();
        results.push(created);
      }
    }
    return results;
  }
  
  async updateFluteSetting(id: string, updates: Partial<InsertFluteSetting>): Promise<FluteSetting | undefined> {
    const [updated] = await db.update(fluteSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fluteSettings.id, id))
      .returning();
    return updated;
  }
  
  // Business Defaults
  async getBusinessDefaults(userId: string): Promise<BusinessDefaults | undefined> {
    const [defaults] = await db.select().from(businessDefaults).where(eq(businessDefaults.userId, userId));
    return defaults;
  }
  
  async saveBusinessDefaults(defaults: InsertBusinessDefaults): Promise<BusinessDefaults> {
    const existing = await this.getBusinessDefaults(defaults.userId);
    
    if (existing) {
      const [updated] = await db.update(businessDefaults)
        .set({ ...defaults, updatedAt: new Date() })
        .where(eq(businessDefaults.userId, defaults.userId))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(businessDefaults).values(defaults).returning();
    return created;
  }
  
  // Chatbot Widgets
  async getChatbotWidgets(userId: string): Promise<ChatbotWidget[]> {
    return await db.select().from(chatbotWidgets).where(eq(chatbotWidgets.userId, userId));
  }
  
  async getChatbotWidgetByToken(token: string): Promise<ChatbotWidget | undefined> {
    const [widget] = await db.select().from(chatbotWidgets).where(eq(chatbotWidgets.apiToken, token));
    return widget;
  }
  
  async createChatbotWidget(widget: InsertChatbotWidget): Promise<ChatbotWidget> {
    const apiToken = crypto.randomBytes(32).toString('hex');
    const [created] = await db.insert(chatbotWidgets).values({ ...widget, apiToken }).returning();
    return created;
  }
  
  async updateChatbotWidget(id: string, updates: Partial<InsertChatbotWidget>): Promise<ChatbotWidget | undefined> {
    const [updated] = await db.update(chatbotWidgets).set(updates).where(eq(chatbotWidgets.id, id)).returning();
    return updated;
  }
  
  async deleteChatbotWidget(id: string): Promise<boolean> {
    await db.delete(chatbotWidgets).where(eq(chatbotWidgets.id, id));
    return true;
  }
  
  // Owner Settings
  async getOwnerSettings(): Promise<any> {
    const [settings] = await db.select().from(ownerSettings);
    if (settings) return settings;
    
    // Create default settings
    const [created] = await db.insert(ownerSettings).values({}).returning();
    return created;
  }
  
  async updateOwnerSettings(updates: any): Promise<any> {
    const existing = await this.getOwnerSettings();
    const [updated] = await db.update(ownerSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ownerSettings.id, existing.id))
      .returning();
    return updated;
  }
  
  // ========== PAPER PRICES ==========
  async getPaperPrices(userId: string): Promise<PaperPrice[]> {
    return await db.select().from(paperPrices).where(eq(paperPrices.userId, userId));
  }
  
  async getPaperPrice(id: string): Promise<PaperPrice | undefined> {
    const [price] = await db.select().from(paperPrices).where(eq(paperPrices.id, id));
    return price;
  }
  
  async getPaperPriceBySpec(userId: string, gsm: number, bf: number, shade: string): Promise<PaperPrice | undefined> {
    const [price] = await db.select().from(paperPrices).where(
      and(
        eq(paperPrices.userId, userId),
        eq(paperPrices.gsm, gsm),
        eq(paperPrices.bf, bf),
        eq(paperPrices.shade, shade)
      )
    );
    return price;
  }
  
  async createPaperPrice(price: InsertPaperPrice): Promise<PaperPrice> {
    const [created] = await db.insert(paperPrices).values(price).returning();
    return created;
  }
  
  async updatePaperPrice(id: string, updates: Partial<InsertPaperPrice>): Promise<PaperPrice | undefined> {
    const [updated] = await db.update(paperPrices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paperPrices.id, id))
      .returning();
    return updated;
  }
  
  async deletePaperPrice(id: string): Promise<boolean> {
    await db.delete(paperPrices).where(eq(paperPrices.id, id));
    return true;
  }
  
  // ========== BF-BASED PAPER PRICES ==========
  async getPaperBfPrices(userId: string): Promise<PaperBfPrice[]> {
    return await db.select().from(paperBfPrices).where(eq(paperBfPrices.userId, userId));
  }
  
  async getPaperBfPrice(id: string): Promise<PaperBfPrice | undefined> {
    const [price] = await db.select().from(paperBfPrices).where(eq(paperBfPrices.id, id));
    return price;
  }
  
  async getPaperBfPriceByBf(userId: string, bf: number): Promise<PaperBfPrice | undefined> {
    const [price] = await db.select().from(paperBfPrices).where(
      and(eq(paperBfPrices.userId, userId), eq(paperBfPrices.bf, bf))
    );
    return price;
  }
  
  async createPaperBfPrice(price: InsertPaperBfPrice): Promise<PaperBfPrice> {
    const [created] = await db.insert(paperBfPrices).values(price).returning();
    return created;
  }
  
  async updatePaperBfPrice(id: string, updates: Partial<InsertPaperBfPrice>): Promise<PaperBfPrice | undefined> {
    const [updated] = await db.update(paperBfPrices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paperBfPrices.id, id))
      .returning();
    return updated;
  }
  
  async deletePaperBfPrice(id: string): Promise<boolean> {
    await db.delete(paperBfPrices).where(eq(paperBfPrices.id, id));
    return true;
  }
  
  // ========== SHADE PREMIUMS ==========
  async getShadePremiums(userId: string): Promise<ShadePremium[]> {
    return await db.select().from(shadePremiums).where(eq(shadePremiums.userId, userId));
  }
  
  async getShadePremium(id: string): Promise<ShadePremium | undefined> {
    const [premium] = await db.select().from(shadePremiums).where(eq(shadePremiums.id, id));
    return premium;
  }
  
  async getShadePremiumByShade(userId: string, shade: string): Promise<ShadePremium | undefined> {
    const [premium] = await db.select().from(shadePremiums).where(
      and(eq(shadePremiums.userId, userId), eq(shadePremiums.shade, shade))
    );
    return premium;
  }
  
  async createShadePremium(premium: InsertShadePremium): Promise<ShadePremium> {
    const [created] = await db.insert(shadePremiums).values(premium).returning();
    return created;
  }
  
  async updateShadePremium(id: string, updates: Partial<InsertShadePremium>): Promise<ShadePremium | undefined> {
    const [updated] = await db.update(shadePremiums)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shadePremiums.id, id))
      .returning();
    return updated;
  }
  
  async deleteShadePremium(id: string): Promise<boolean> {
    await db.delete(shadePremiums).where(eq(shadePremiums.id, id));
    return true;
  }
  
  // ========== PAPER PRICING RULES ==========
  async getPaperPricingRules(userId: string): Promise<PaperPricingRules | undefined> {
    const [rules] = await db.select().from(paperPricingRules).where(eq(paperPricingRules.userId, userId));
    return rules;
  }
  
  async createOrUpdatePaperPricingRules(rules: InsertPaperPricingRules): Promise<PaperPricingRules> {
    const existing = await this.getPaperPricingRules(rules.userId);
    
    if (existing) {
      const [updated] = await db.update(paperPricingRules)
        .set({ ...rules, updatedAt: new Date() })
        .where(eq(paperPricingRules.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(paperPricingRules).values(rules).returning();
    return created;
  }
  
  async getPaperSetupStatus(userId: string): Promise<{ completed: boolean; rules: PaperPricingRules | null; pricesCount: number; bfPricesCount: number }> {
    const rules = await this.getPaperPricingRules(userId);
    const prices = await this.getPaperPrices(userId);
    const bfPrices = await this.getPaperBfPrices(userId);
    
    return {
      completed: rules?.paperSetupCompleted || false,
      rules: rules || null,
      pricesCount: prices.length,
      bfPricesCount: bfPrices.length
    };
  }
  
  // ========== USER QUOTE TERMS ==========
  async getUserQuoteTerms(userId: string): Promise<UserQuoteTerms | undefined> {
    const [terms] = await db.select().from(userQuoteTerms).where(eq(userQuoteTerms.userId, userId));
    return terms;
  }
  
  async createOrUpdateUserQuoteTerms(terms: InsertUserQuoteTerms): Promise<UserQuoteTerms> {
    const existing = await this.getUserQuoteTerms(terms.userId);
    
    if (existing) {
      const [updated] = await db.update(userQuoteTerms)
        .set({ ...terms, updatedAt: new Date() })
        .where(eq(userQuoteTerms.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(userQuoteTerms).values(terms).returning();
    return created;
  }
  
  // ========== BOX SPECIFICATIONS ==========
  async getBoxSpecification(id: string): Promise<BoxSpecification | undefined> {
    const [spec] = await db.select().from(boxSpecifications).where(eq(boxSpecifications.id, id));
    return spec;
  }
  
  async getBoxSpecifications(userId: string, customerId?: string): Promise<BoxSpecification[]> {
    if (customerId) {
      return await db.select().from(boxSpecifications).where(
        and(eq(boxSpecifications.userId, userId), eq(boxSpecifications.customerId, customerId))
      );
    }
    return await db.select().from(boxSpecifications).where(eq(boxSpecifications.userId, userId));
  }
  
  async findExistingBoxSpec(
    userId: string, 
    customerId: string | null, 
    boxType: string, 
    length: number, 
    breadth: number, 
    height: number | null, 
    ply: string
  ): Promise<BoxSpecification | undefined> {
    // Build conditions for exact match
    const conditions = [
      eq(boxSpecifications.userId, userId),
      eq(boxSpecifications.boxType, boxType),
      eq(boxSpecifications.length, length),
      eq(boxSpecifications.breadth, breadth),
      eq(boxSpecifications.ply, ply),
      eq(boxSpecifications.isActive, true)
    ];
    
    const results = await db.select().from(boxSpecifications).where(and(...conditions));
    
    // Filter for customerId and height match (handle nulls)
    return results.find(spec => {
      const customerMatch = customerId ? spec.customerId === customerId : spec.customerId === null;
      const heightMatch = height !== null ? spec.height === height : spec.height === null;
      return customerMatch && heightMatch;
    });
  }
  
  async createBoxSpecification(spec: InsertBoxSpecification): Promise<BoxSpecification> {
    const [created] = await db.insert(boxSpecifications).values(spec).returning();
    return created;
  }
  
  async updateBoxSpecification(id: string, updates: Partial<InsertBoxSpecification>): Promise<BoxSpecification | undefined> {
    const [updated] = await db.update(boxSpecifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(boxSpecifications.id, id))
      .returning();
    return updated;
  }
  
  // ========== BOX SPEC VERSIONS ==========
  async getBoxSpecVersions(specId: string): Promise<BoxSpecVersion[]> {
    return await db.select().from(boxSpecVersions)
      .where(eq(boxSpecVersions.specId, specId))
      .orderBy(boxSpecVersions.versionNumber);
  }
  
  async getBoxSpecVersion(specId: string, versionNumber: number): Promise<BoxSpecVersion | undefined> {
    const [version] = await db.select().from(boxSpecVersions).where(
      and(eq(boxSpecVersions.specId, specId), eq(boxSpecVersions.versionNumber, versionNumber))
    );
    return version;
  }
  
  async createBoxSpecVersion(version: InsertBoxSpecVersion): Promise<BoxSpecVersion> {
    const [created] = await db.insert(boxSpecVersions).values(version).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();

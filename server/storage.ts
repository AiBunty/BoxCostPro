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
  type ChatbotWidget,
  type InsertChatbotWidget,
  companyProfiles,
  partyProfiles,
  quotes,
  appSettings,
  rateMemory,
  users,
  subscriptionPlans,
  userSubscriptions,
  coupons,
  trialInvites,
  paymentTransactions,
  flutingSettings,
  chatbotWidgets,
  ownerSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import crypto from "crypto";

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
  
  // Chatbot Widgets (per user)
  getChatbotWidgets(userId: string): Promise<ChatbotWidget[]>;
  getChatbotWidgetByToken(token: string): Promise<ChatbotWidget | undefined>;
  createChatbotWidget(widget: InsertChatbotWidget): Promise<ChatbotWidget>;
  updateChatbotWidget(id: string, updates: Partial<InsertChatbotWidget>): Promise<ChatbotWidget | undefined>;
  deleteChatbotWidget(id: string): Promise<boolean>;
  
  // Owner Settings
  getOwnerSettings(): Promise<any>;
  updateOwnerSettings(updates: any): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userData.id) {
      throw new Error("User ID is required");
    }
    
    // Check if user already exists
    const existingUser = await this.getUser(userData.id);
    if (existingUser) {
      // User exists, just update non-role fields (preserve existing role)
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    }
    
    // New user - insert first with role='user', then atomically promote to owner if no owners exist
    const now = new Date();
    
    try {
      // Insert new user with default role='user'
      const [insertedUser] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: 'user',
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      // Atomically promote to owner if no owner exists yet
      // A partial unique index (users_single_owner_idx) ensures only one user can have role='owner'
      // This makes the promotion race-condition safe at the database level
      try {
        await db.execute(sql`
          UPDATE users 
          SET role = 'owner', updated_at = NOW()
          WHERE id = ${userData.id}
          AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
        `);
      } catch (promoteError: any) {
        // Unique constraint violation means another user already became owner - that's fine
        if (!promoteError.message?.includes('unique')) {
          console.log('Owner promotion note:', promoteError.message);
        }
      }
      
      // Return the final user state (may have been promoted to owner)
      const finalUser = await this.getUser(userData.id);
      return finalUser || insertedUser;
    } catch (error: any) {
      // Handle potential race condition - if insert fails due to duplicate key
      const existingAfterRace = await this.getUser(userData.id);
      if (existingAfterRace) {
        return existingAfterRace;
      }
      throw error;
    }
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
}

export const storage = new DatabaseStorage();

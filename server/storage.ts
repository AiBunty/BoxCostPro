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
  type OnboardingStatus,
  type InsertOnboardingStatus,
  type AdminAction,
  type InsertAdminAction,
  type SupportTicket,
  type InsertSupportTicket,
  type SupportMessage,
  type InsertSupportMessage,
  type QuoteTemplate,
  type InsertQuoteTemplate,
  type QuoteSendLog,
  type InsertQuoteSendLog,
  type UserEmailSettings,
  type InsertUserEmailSettings,
  type EmailLog,
  type InsertEmailLog,
  type EmailBounce,
  type InsertEmailBounce,
  type AuthAuditLog,
  type InsertAuthAuditLog,
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
  businessDefaults,
  onboardingStatus,
  adminActions,
  supportTickets,
  supportMessages,
  quoteTemplates,
  templateVersions,
  quoteSendLogs,
  userEmailSettings,
  emailLogs,
  emailBounces,
  authAuditLogs,
  InsertTemplateVersion,
  TemplateVersion
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
  
  // Onboarding Status (admin verification)
  getOnboardingStatus(userId: string): Promise<OnboardingStatus | undefined>;
  createOnboardingStatus(status: InsertOnboardingStatus): Promise<OnboardingStatus>;
  updateOnboardingStatus(userId: string, updates: Partial<InsertOnboardingStatus>): Promise<OnboardingStatus | undefined>;
  submitForVerification(userId: string): Promise<OnboardingStatus | undefined>;
  approveUser(userId: string, adminUserId: string): Promise<OnboardingStatus | undefined>;
  rejectUser(userId: string, adminUserId: string, reason: string): Promise<OnboardingStatus | undefined>;
  getPendingVerifications(): Promise<OnboardingStatus[]>;
  getAllOnboardingStatuses(): Promise<OnboardingStatus[]>;
  
  // Admin Actions (audit log)
  createAdminAction(action: InsertAdminAction): Promise<AdminAction>;
  getAdminActions(targetUserId?: string): Promise<AdminAction[]>;
  
  // Support Tickets
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  getSupportTickets(userId?: string, status?: string): Promise<SupportTicket[]>;
  updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket | undefined>;
  assignSupportTicket(ticketId: string, assignedTo: string): Promise<SupportTicket | undefined>;
  closeSupportTicket(ticketId: string, closedBy: string, resolutionNote: string): Promise<SupportTicket | undefined>;
  escalateSupportTicket(ticketId: string, escalatedTo: string): Promise<SupportTicket | undefined>;
  generateTicketNumber(): Promise<string>;
  
  // Support Messages
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessages(ticketId: string, includeInternal?: boolean): Promise<SupportMessage[]>;
  
  // Admin Stats
  getAdminStats(): Promise<{
    totalUsers: number;
    pendingVerifications: number;
    approvedUsers: number;
    rejectedUsers: number;
    newSignupsLast7Days: number;
  }>;
  
  // All Users (for admin)
  getAllUsers(): Promise<User[]>;
  
  // Quote Templates
  getQuoteTemplates(userId: string, channel?: string): Promise<QuoteTemplate[]>;
  getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined>;
  createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate>;
  updateQuoteTemplate(id: string, updates: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined>;
  deleteQuoteTemplate(id: string): Promise<boolean>;
  getDefaultTemplate(userId: string, channel: string): Promise<QuoteTemplate | undefined>;
  setDefaultTemplate(userId: string, templateId: string, channel: string): Promise<void>;
  
  // Quote Send Logs
  createQuoteSendLog(log: InsertQuoteSendLog): Promise<QuoteSendLog>;
  getQuoteSendLogs(quoteId?: string, userId?: string): Promise<QuoteSendLog[]>;
  
  // User Email Settings
  getUserEmailSettings(userId: string): Promise<UserEmailSettings | undefined>;
  createUserEmailSettings(settings: InsertUserEmailSettings): Promise<UserEmailSettings>;
  updateUserEmailSettings(userId: string, updates: Partial<InsertUserEmailSettings>): Promise<UserEmailSettings | undefined>;
  deleteUserEmailSettings(userId: string): Promise<boolean>;
  
  // Email Logs & Analytics
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  updateEmailLog(id: string, updates: Partial<InsertEmailLog>): Promise<EmailLog | undefined>;
  getEmailLogs(userId: string, filters?: { status?: string; channel?: string; startDate?: Date; endDate?: Date }): Promise<EmailLog[]>;
  getEmailStats(userId: string, startDate?: Date, endDate?: Date): Promise<{ 
    total: number; 
    sent: number; 
    delivered: number; 
    bounced: number; 
    failed: number;
    byProvider: Record<string, number>;
    byChannel: Record<string, number>;
  }>;
  
  // Email Bounces
  createEmailBounce(bounce: InsertEmailBounce): Promise<EmailBounce>;
  getEmailBounces(userId: string): Promise<EmailBounce[]>;
  getBouncedRecipients(userId: string): Promise<string[]>;
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
  
  // ========== ONBOARDING STATUS (Admin Verification) ==========
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | undefined> {
    const [status] = await db.select().from(onboardingStatus).where(eq(onboardingStatus.userId, userId));
    return status;
  }
  
  async createOnboardingStatus(status: InsertOnboardingStatus): Promise<OnboardingStatus> {
    const [created] = await db.insert(onboardingStatus).values(status).returning();
    return created;
  }
  
  async updateOnboardingStatus(userId: string, updates: Partial<InsertOnboardingStatus>): Promise<OnboardingStatus | undefined> {
    const [updated] = await db.update(onboardingStatus)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(onboardingStatus.userId, userId))
      .returning();
    return updated;
  }
  
  async submitForVerification(userId: string): Promise<OnboardingStatus | undefined> {
    const [updated] = await db.update(onboardingStatus)
      .set({ 
        submittedForVerification: true,
        verificationStatus: 'pending',
        submittedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(onboardingStatus.userId, userId))
      .returning();
    return updated;
  }
  
  async approveUser(userId: string, adminUserId: string): Promise<OnboardingStatus | undefined> {
    const [updated] = await db.update(onboardingStatus)
      .set({
        verificationStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: adminUserId,
        rejectionReason: null,
        rejectedAt: null,
        updatedAt: new Date()
      })
      .where(eq(onboardingStatus.userId, userId))
      .returning();
    
    // Log the admin action
    await this.createAdminAction({
      adminUserId,
      targetUserId: userId,
      action: 'approved',
      remarks: 'User approved'
    });
    
    return updated;
  }
  
  async rejectUser(userId: string, adminUserId: string, reason: string): Promise<OnboardingStatus | undefined> {
    const [updated] = await db.update(onboardingStatus)
      .set({
        verificationStatus: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedAt: null,
        approvedBy: null,
        updatedAt: new Date()
      })
      .where(eq(onboardingStatus.userId, userId))
      .returning();
    
    // Log the admin action
    await this.createAdminAction({
      adminUserId,
      targetUserId: userId,
      action: 'rejected',
      remarks: reason
    });
    
    return updated;
  }
  
  async getPendingVerifications(): Promise<OnboardingStatus[]> {
    return await db.select().from(onboardingStatus)
      .where(
        and(
          eq(onboardingStatus.submittedForVerification, true),
          eq(onboardingStatus.verificationStatus, 'pending')
        )
      );
  }
  
  async getAllOnboardingStatuses(): Promise<OnboardingStatus[]> {
    return await db.select().from(onboardingStatus);
  }
  
  // ========== ADMIN ACTIONS (Audit Log) ==========
  async createAdminAction(action: InsertAdminAction): Promise<AdminAction> {
    const [created] = await db.insert(adminActions).values(action).returning();
    return created;
  }
  
  async getAdminActions(targetUserId?: string): Promise<AdminAction[]> {
    if (targetUserId) {
      return await db.select().from(adminActions)
        .where(eq(adminActions.targetUserId, targetUserId))
        .orderBy(adminActions.createdAt);
    }
    return await db.select().from(adminActions).orderBy(adminActions.createdAt);
  }
  
  // ========== SUPPORT TICKETS ==========
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketNo = await this.generateTicketNumber();
    const [created] = await db.insert(supportTickets).values({ ...ticket, ticketNo }).returning();
    return created;
  }
  
  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }
  
  async getSupportTickets(userId?: string, status?: string): Promise<SupportTicket[]> {
    const conditions = [];
    if (userId) conditions.push(eq(supportTickets.userId, userId));
    if (status) conditions.push(eq(supportTickets.status, status));
    
    if (conditions.length > 0) {
      return await db.select().from(supportTickets).where(and(...conditions));
    }
    return await db.select().from(supportTickets);
  }
  
  async updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket | undefined> {
    const [updated] = await db.update(supportTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }
  
  async assignSupportTicket(ticketId: string, assignedTo: string): Promise<SupportTicket | undefined> {
    const [updated] = await db.update(supportTickets)
      .set({ 
        assignedTo, 
        status: 'in_progress',
        updatedAt: new Date() 
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return updated;
  }
  
  async closeSupportTicket(ticketId: string, closedBy: string, resolutionNote: string): Promise<SupportTicket | undefined> {
    const [updated] = await db.update(supportTickets)
      .set({
        status: 'closed',
        closedBy,
        closedAt: new Date(),
        resolutionNote,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return updated;
  }
  
  async escalateSupportTicket(ticketId: string, escalatedTo: string): Promise<SupportTicket | undefined> {
    const [updated] = await db.update(supportTickets)
      .set({
        isEscalated: true,
        escalatedTo,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return updated;
  }
  
  async generateTicketNumber(): Promise<string> {
    const result = await db.select({ count: sql`count(*)` }).from(supportTickets);
    const count = Number(result[0]?.count || 0);
    const ticketNo = `TKT-${String(count + 1).padStart(6, '0')}`;
    return ticketNo;
  }
  
  // ========== SUPPORT MESSAGES ==========
  async createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const [created] = await db.insert(supportMessages).values(message).returning();
    return created;
  }
  
  async getSupportMessages(ticketId: string, includeInternal: boolean = false): Promise<SupportMessage[]> {
    if (includeInternal) {
      return await db.select().from(supportMessages)
        .where(eq(supportMessages.ticketId, ticketId))
        .orderBy(supportMessages.createdAt);
    }
    return await db.select().from(supportMessages)
      .where(
        and(
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.isInternal, false)
        )
      )
      .orderBy(supportMessages.createdAt);
  }
  
  // ========== ADMIN STATS ==========
  async getAdminStats(): Promise<{
    totalUsers: number;
    pendingVerifications: number;
    approvedUsers: number;
    rejectedUsers: number;
    newSignupsLast7Days: number;
  }> {
    const allUsers = await db.select({ count: sql`count(*)` }).from(users);
    const pendingResult = await db.select({ count: sql`count(*)` }).from(onboardingStatus)
      .where(and(
        eq(onboardingStatus.submittedForVerification, true),
        eq(onboardingStatus.verificationStatus, 'pending')
      ));
    const approvedResult = await db.select({ count: sql`count(*)` }).from(onboardingStatus)
      .where(eq(onboardingStatus.verificationStatus, 'approved'));
    const rejectedResult = await db.select({ count: sql`count(*)` }).from(onboardingStatus)
      .where(eq(onboardingStatus.verificationStatus, 'rejected'));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newSignupsResult = await db.select({ count: sql`count(*)` }).from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);
    
    return {
      totalUsers: Number(allUsers[0]?.count || 0),
      pendingVerifications: Number(pendingResult[0]?.count || 0),
      approvedUsers: Number(approvedResult[0]?.count || 0),
      rejectedUsers: Number(rejectedResult[0]?.count || 0),
      newSignupsLast7Days: Number(newSignupsResult[0]?.count || 0)
    };
  }
  
  // ========== ALL USERS (Admin) ==========
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }
  
  // ========== QUOTE TEMPLATES ==========
  async getQuoteTemplates(userId: string, channel?: string): Promise<QuoteTemplate[]> {
    // Get system templates (userId is null) and user's custom templates
    const conditions = [
      or(
        sql`${quoteTemplates.userId} IS NULL`,
        eq(quoteTemplates.userId, userId)
      )
    ];
    
    if (channel) {
      conditions.push(eq(quoteTemplates.channel, channel));
    }
    
    return await db.select().from(quoteTemplates)
      .where(and(...conditions))
      .orderBy(quoteTemplates.templateType, quoteTemplates.name);
  }
  
  async getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined> {
    const [template] = await db.select().from(quoteTemplates)
      .where(eq(quoteTemplates.id, id));
    return template;
  }
  
  async createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate> {
    const [created] = await db.insert(quoteTemplates).values(template).returning();
    return created;
  }
  
  async updateQuoteTemplate(id: string, updates: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined> {
    const [updated] = await db.update(quoteTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quoteTemplates.id, id))
      .returning();
    return updated;
  }
  
  async deleteQuoteTemplate(id: string): Promise<boolean> {
    const result = await db.delete(quoteTemplates)
      .where(and(
        eq(quoteTemplates.id, id),
        eq(quoteTemplates.templateType, 'custom') // Can only delete custom templates
      ))
      .returning();
    return result.length > 0;
  }
  
  async getDefaultTemplate(userId: string, channel: string): Promise<QuoteTemplate | undefined> {
    // First try to find user's default for this channel
    const [userDefault] = await db.select().from(quoteTemplates)
      .where(and(
        eq(quoteTemplates.userId, userId),
        eq(quoteTemplates.channel, channel),
        eq(quoteTemplates.isDefault, true)
      ));
    
    if (userDefault) return userDefault;
    
    // Fall back to system default for this channel
    const [systemDefault] = await db.select().from(quoteTemplates)
      .where(and(
        sql`${quoteTemplates.userId} IS NULL`,
        eq(quoteTemplates.channel, channel),
        eq(quoteTemplates.isDefault, true)
      ));
    
    return systemDefault;
  }
  
  async setDefaultTemplate(userId: string, templateId: string, channel: string): Promise<void> {
    // Clear existing default for this user and channel
    await db.update(quoteTemplates)
      .set({ isDefault: false })
      .where(and(
        eq(quoteTemplates.userId, userId),
        eq(quoteTemplates.channel, channel)
      ));
    
    // Set new default
    await db.update(quoteTemplates)
      .set({ isDefault: true })
      .where(eq(quoteTemplates.id, templateId));
  }
  
  // ========== TEMPLATE VERSIONS ==========
  async getLatestTemplateVersion(templateId: string): Promise<TemplateVersion | undefined> {
    const [version] = await db.select().from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(sql`${templateVersions.versionNo} DESC`)
      .limit(1);
    return version;
  }
  
  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return await db.select().from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(sql`${templateVersions.versionNo} DESC`);
  }
  
  async getTemplateVersion(templateId: string, versionNo: number): Promise<TemplateVersion | undefined> {
    const [version] = await db.select().from(templateVersions)
      .where(and(
        eq(templateVersions.templateId, templateId),
        eq(templateVersions.versionNo, versionNo)
      ));
    return version;
  }
  
  async saveTemplateVersion(templateId: string, content: string, userId: string): Promise<TemplateVersion> {
    const latest = await this.getLatestTemplateVersion(templateId);
    const nextVersionNo = (latest?.versionNo || 0) + 1;
    
    const [created] = await db.insert(templateVersions).values({
      templateId,
      versionNo: nextVersionNo,
      content,
      createdBy: userId
    }).returning();
    
    return created;
  }
  
  async rollbackTemplate(templateId: string, versionNo: number): Promise<QuoteTemplate | undefined> {
    const version = await this.getTemplateVersion(templateId, versionNo);
    if (!version) return undefined;
    
    const [updated] = await db.update(quoteTemplates)
      .set({ content: version.content, updatedAt: new Date() })
      .where(eq(quoteTemplates.id, templateId))
      .returning();
    
    return updated;
  }
  
  // ========== QUOTE SEND LOGS ==========
  async createQuoteSendLog(log: InsertQuoteSendLog): Promise<QuoteSendLog> {
    const [created] = await db.insert(quoteSendLogs).values(log).returning();
    return created;
  }
  
  async getQuoteSendLogs(quoteId?: string, userId?: string): Promise<QuoteSendLog[]> {
    const conditions = [];
    if (quoteId) conditions.push(eq(quoteSendLogs.quoteId, quoteId));
    if (userId) conditions.push(eq(quoteSendLogs.userId, userId));
    
    if (conditions.length === 0) {
      return await db.select().from(quoteSendLogs).orderBy(sql`${quoteSendLogs.createdAt} DESC`);
    }
    
    return await db.select().from(quoteSendLogs)
      .where(and(...conditions))
      .orderBy(sql`${quoteSendLogs.createdAt} DESC`);
  }
  
  // ========== USER EMAIL SETTINGS ==========
  async getUserEmailSettings(userId: string): Promise<UserEmailSettings | undefined> {
    const [settings] = await db.select().from(userEmailSettings)
      .where(eq(userEmailSettings.userId, userId));
    return settings;
  }
  
  async createUserEmailSettings(settings: InsertUserEmailSettings): Promise<UserEmailSettings> {
    const [created] = await db.insert(userEmailSettings).values(settings).returning();
    return created;
  }
  
  async updateUserEmailSettings(userId: string, updates: Partial<InsertUserEmailSettings>): Promise<UserEmailSettings | undefined> {
    const [updated] = await db.update(userEmailSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userEmailSettings.userId, userId))
      .returning();
    return updated;
  }
  
  async deleteUserEmailSettings(userId: string): Promise<boolean> {
    const result = await db.delete(userEmailSettings)
      .where(eq(userEmailSettings.userId, userId));
    return true;
  }
  
  // ========== EMAIL LOGS & ANALYTICS ==========
  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [created] = await db.insert(emailLogs).values(log).returning();
    return created;
  }
  
  async updateEmailLog(id: string, updates: Partial<InsertEmailLog>): Promise<EmailLog | undefined> {
    const [updated] = await db.update(emailLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailLogs.id, id))
      .returning();
    return updated;
  }
  
  async getEmailLogs(userId: string, filters?: { status?: string; channel?: string; startDate?: Date; endDate?: Date }): Promise<EmailLog[]> {
    const conditions = [eq(emailLogs.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(emailLogs.status, filters.status));
    }
    if (filters?.channel) {
      conditions.push(eq(emailLogs.channel, filters.channel));
    }
    if (filters?.startDate) {
      conditions.push(sql`${emailLogs.sentAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${emailLogs.sentAt} <= ${filters.endDate}`);
    }
    
    return await db.select().from(emailLogs)
      .where(and(...conditions))
      .orderBy(sql`${emailLogs.sentAt} DESC`)
      .limit(500);
  }
  
  async getEmailStats(userId: string, startDate?: Date, endDate?: Date): Promise<{ 
    total: number; 
    sent: number; 
    delivered: number; 
    bounced: number; 
    failed: number;
    byProvider: Record<string, number>;
    byChannel: Record<string, number>;
  }> {
    const conditions = [eq(emailLogs.userId, userId)];
    if (startDate) conditions.push(sql`${emailLogs.sentAt} >= ${startDate}`);
    if (endDate) conditions.push(sql`${emailLogs.sentAt} <= ${endDate}`);
    
    const logs = await db.select().from(emailLogs).where(and(...conditions));
    
    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === 'sent').length,
      delivered: logs.filter(l => l.status === 'delivered').length,
      bounced: logs.filter(l => l.status === 'bounced').length,
      failed: logs.filter(l => l.status === 'failed').length,
      byProvider: {} as Record<string, number>,
      byChannel: {} as Record<string, number>,
    };
    
    for (const log of logs) {
      stats.byProvider[log.provider] = (stats.byProvider[log.provider] || 0) + 1;
      stats.byChannel[log.channel] = (stats.byChannel[log.channel] || 0) + 1;
    }
    
    return stats;
  }
  
  // ========== EMAIL BOUNCES ==========
  async createEmailBounce(bounce: InsertEmailBounce): Promise<EmailBounce> {
    const [created] = await db.insert(emailBounces).values(bounce).returning();
    return created;
  }
  
  async getEmailBounces(userId: string): Promise<EmailBounce[]> {
    const userLogs = await db.select({ id: emailLogs.id }).from(emailLogs)
      .where(eq(emailLogs.userId, userId));
    
    if (userLogs.length === 0) return [];
    
    const logIds = userLogs.map(l => l.id);
    return await db.select().from(emailBounces)
      .where(sql`${emailBounces.emailLogId} IN (${sql.join(logIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(sql`${emailBounces.occurredAt} DESC`);
  }
  
  async getBouncedRecipients(userId: string): Promise<string[]> {
    const bounces = await this.getEmailBounces(userId);
    const hardBounces = bounces.filter(b => b.bounceType === 'hard');
    return Array.from(new Set(hardBounces.map(b => b.recipientEmail)));
  }
  
  // ========== AUTH AUDIT LOGS ==========
  async createAuthAuditLog(log: InsertAuthAuditLog): Promise<AuthAuditLog> {
    const [created] = await db.insert(authAuditLogs).values(log).returning();
    return created;
  }
  
  async getAuthAuditLogs(userId: string, limit = 100): Promise<AuthAuditLog[]> {
    return await db.select().from(authAuditLogs)
      .where(eq(authAuditLogs.userId, userId))
      .orderBy(sql`${authAuditLogs.createdAt} DESC`)
      .limit(limit);
  }
  
  async getRecentAuthLogs(filters?: { 
    action?: string; 
    status?: string; 
    startDate?: Date; 
    endDate?: Date;
    limit?: number;
  }): Promise<AuthAuditLog[]> {
    const conditions = [];
    
    if (filters?.action) {
      conditions.push(eq(authAuditLogs.action, filters.action));
    }
    if (filters?.status) {
      conditions.push(eq(authAuditLogs.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(sql`${authAuditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${authAuditLogs.createdAt} <= ${filters.endDate}`);
    }
    
    const query = db.select().from(authAuditLogs);
    
    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(sql`${authAuditLogs.createdAt} DESC`)
        .limit(filters?.limit || 100);
    }
    
    return await query
      .orderBy(sql`${authAuditLogs.createdAt} DESC`)
      .limit(filters?.limit || 100);
  }
  
  // Update user account fields
  async updateUserAccountStatus(userId: string, updates: {
    accountStatus?: string;
    emailVerified?: boolean;
    mobileVerified?: boolean;
    lastLoginAt?: Date;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
    passwordResetRequired?: boolean;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  // Check if user account is locked
  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || !user.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  }
  
  // Increment failed login attempts
  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    const newCount = (user?.failedLoginAttempts || 0) + 1;
    
    const updates: any = { 
      failedLoginAttempts: newCount,
      updatedAt: new Date()
    };
    
    // Lock account after 5 failed attempts for 15 minutes
    if (newCount >= 5) {
      updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    
    await db.update(users)
      .set(updates)
      .where(eq(users.id, userId));
    
    return newCount;
  }
  
  // Reset failed login attempts on successful login
  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await db.update(users)
      .set({ 
        failedLoginAttempts: 0, 
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();

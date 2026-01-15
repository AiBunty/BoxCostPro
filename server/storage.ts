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
  type PaperShade,
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
  type UserSetup,
  type InsertUserSetup,
  type AdminAction,
  type InsertAdminAction,
  type SupportTicket,
  type InsertSupportTicket,
  type SupportMessage,
  type InsertSupportMessage,
  type PaymentGateway,
  type InsertPaymentGateway,
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
  type Staff,
  type InsertStaff,
  type TicketNote,
  type InsertTicketNote,
  type StaffMetrics,
  type InsertStaffMetrics,
  type AdminAuditLog,
  type InsertAdminAuditLog,
  type AdminEmailSettings,
  type InsertAdminEmailSettings,
  type Admin,
  type InsertAdmin,
  type EmailProvider,
  type InsertEmailProvider,
  type EmailTaskRouting,
  type InsertEmailTaskRouting,
  type EmailSendLog,
  type InsertEmailSendLog,
  type EmailProviderHealth,
  type InsertEmailProviderHealth,
  type UserEmailPreferences,
  type InsertUserEmailPreferences,
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
  paperShades,
  paperPricingRules,
  userQuoteTerms,
  boxSpecifications,
  boxSpecVersions,
  userProfiles,
  userSetup,
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
  staff,
  ticketNotes,
  staffMetrics,
  adminAuditLogs,
  adminEmailSettings,
  admins,
  emailProviders,
  emailTaskRouting,
  emailSendLogs,
  emailProviderHealth,
  userEmailPreferences,
  paymentGateways,
  InsertTemplateVersion,
  TemplateVersion,
  type TemporaryBusinessProfile,
  type InsertTemporaryBusinessProfile,
  type Invoice,
  type InsertInvoice,
  type InvoiceTemplate,
  type InsertInvoiceTemplate,
  type SellerProfile,
  type InsertSellerProfile,
  type UserFeatureUsage,
  type InsertUserFeatureUsage,
  type UserFeatureOverride,
  type InsertUserFeatureOverride,
  temporaryBusinessProfiles,
  invoices,
  invoiceTemplates,
  sellerProfile,
  userFeatureUsage,
  userFeatureOverrides,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql, desc, inArray } from "drizzle-orm";
import crypto from "crypto";

export type VerificationStatusCode = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SetupStatus {
  userId: string;
  tenantId?: string | null;
  steps: {
    businessProfile: boolean;
    paperPricing: boolean;
    fluteSettings: boolean;
    taxDefaults: boolean;
    quoteTerms: boolean;
  };
  setupProgress: number;
  isSetupComplete: boolean;
  verificationStatus: VerificationStatusCode;
  submittedForVerification: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
}

export interface IStorage {
  // User operations (for Clerk Auth only)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByClerkId(clerkUserId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  
  // Admin operations (separate identity store)
  getAdmin(id: string): Promise<Admin | undefined>;
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // User Profiles (onboarding/setup tracking)
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;

  // Setup + verification (new system)
  getUserSetupStatus(userId: string, tenantId?: string): Promise<SetupStatus>;
  completeSetupStep(userId: string, stepKey: keyof SetupStatus['steps'], tenantId?: string): Promise<SetupStatus>;
  submitSetupForVerification(userId: string, tenantId?: string): Promise<SetupStatus>;
  approveUser(userId: string, adminUserId: string): Promise<OnboardingStatus | undefined>;
  rejectUser(userId: string, adminUserId: string, reason: string): Promise<OnboardingStatus | undefined>;
  bulkApproveUsers(userIds: string[], adminUserId: string): Promise<number>;
  
  // Company Profiles (tenant-aware)
  getCompanyProfile(id: string, tenantId?: string): Promise<CompanyProfile | undefined>;
  getAllCompanyProfiles(userId?: string, tenantId?: string): Promise<CompanyProfile[]>;
  getDefaultCompanyProfile(userId?: string, tenantId?: string): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: string, profile: Partial<InsertCompanyProfile>, tenantId?: string): Promise<CompanyProfile | undefined>;
  setDefaultCompanyProfile(id: string, userId?: string, tenantId?: string): Promise<void>;
  
  // Party Profiles (tenant-aware)
  getPartyProfile(id: string, tenantId?: string): Promise<PartyProfile | undefined>;
  getAllPartyProfiles(userId?: string, tenantId?: string): Promise<PartyProfile[]>;
  createPartyProfile(profile: InsertPartyProfile): Promise<PartyProfile>;
  updatePartyProfile(id: string, profile: Partial<InsertPartyProfile>, tenantId?: string): Promise<PartyProfile | undefined>;
  deletePartyProfile(id: string, tenantId?: string): Promise<boolean>;
  searchPartyProfiles(userId: string, search: string, tenantId?: string): Promise<PartyProfile[]>;
  
  // Quotes (tenant-aware)
  getQuote(id: string, tenantId?: string): Promise<Quote | undefined>;
  getAllQuotes(userId?: string, tenantId?: string): Promise<Quote[]>;
  getAllQuotesWithItems(userId?: string, tenantId?: string): Promise<(Quote & { items: any[]; activeVersion: QuoteVersion | null })[]>;
  searchQuotes(userId: string, options: { partyName?: string; boxName?: string; boxSize?: string }, tenantId?: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>, tenantId?: string): Promise<Quote | undefined>;
  deleteQuote(id: string, tenantId?: string): Promise<boolean>;
  
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
  
  // Paper Shades Master Table (global - single source of truth)
  getPaperShades(): Promise<PaperShade[]>;
  getPaperShadeByName(shadeName: string): Promise<PaperShade | undefined>;
  
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
    activeSubscriptions: number;
    monthlyRevenue: number;
    gstCollected: number;
    userChange: number;
    subscriptionChange: number;
    revenueChange: number;
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

  // Admin Email Settings (System-wide SMTP configuration)
  getActiveAdminEmailSettings(): Promise<AdminEmailSettings | undefined>;
  createAdminEmailSettings(settings: InsertAdminEmailSettings): Promise<AdminEmailSettings>;
  updateAdminEmailSettings(id: string, updates: Partial<InsertAdminEmailSettings>): Promise<AdminEmailSettings | undefined>;
  deactivateOtherEmailSettings(exceptId?: string): Promise<void>;
  testEmailSettings(id: string, status: 'success' | 'failed'): Promise<void>;
  
  // Multi-Provider Email System
  // Email Providers
  getEmailProvider(id: string): Promise<EmailProvider | undefined>;
  getAllEmailProviders(): Promise<EmailProvider[]>;
  getActiveEmailProviders(): Promise<EmailProvider[]>;
  getEmailProvidersByType(providerType: string): Promise<EmailProvider[]>;
  createEmailProvider(provider: InsertEmailProvider): Promise<EmailProvider>;
  updateEmailProvider(id: string, updates: Partial<InsertEmailProvider>): Promise<EmailProvider | undefined>;
  deleteEmailProvider(id: string): Promise<boolean>;
  setPrimaryEmailProvider(id: string): Promise<boolean>;
  updateProviderHealth(id: string, success: boolean, errorMessage?: string): Promise<void>;
  
  // Email Task Routing
  getTaskRouting(taskType: string): Promise<EmailTaskRouting | undefined>;
  getAllTaskRouting(): Promise<EmailTaskRouting[]>;
  createTaskRouting(routing: InsertEmailTaskRouting): Promise<EmailTaskRouting>;
  updateTaskRouting(id: string, updates: Partial<InsertEmailTaskRouting>): Promise<EmailTaskRouting | undefined>;
  deleteTaskRouting(id: string): Promise<boolean>;
  
  // Email Send Logs
  createEmailSendLog(log: InsertEmailSendLog): Promise<EmailSendLog>;
  getEmailSendLogs(filters?: { userId?: string; taskType?: string; status?: string; limit?: number }): Promise<EmailSendLog[]>;
  
  // User Email Preferences
  getUserEmailPreferences(userId: string): Promise<UserEmailPreferences | undefined>;
  createUserEmailPreferences(prefs: InsertUserEmailPreferences): Promise<UserEmailPreferences>;
  updateUserEmailPreferences(userId: string, updates: Partial<InsertUserEmailPreferences>): Promise<UserEmailPreferences | undefined>;
  
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

  // Temporary Business Profiles (Signup Flow)
  getTempProfileByEmail(email: string): Promise<TemporaryBusinessProfile | undefined>;
  getTempProfileBySession(sessionToken: string): Promise<TemporaryBusinessProfile | undefined>;
  createTempBusinessProfile(profile: InsertTemporaryBusinessProfile): Promise<TemporaryBusinessProfile>;
  deleteTempProfile(id: string): Promise<void>;

  // Invoices
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByUser(userId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getLastInvoiceForFY(financialYear: string): Promise<Invoice | undefined>;

  // Invoice Templates
  getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined>;
  getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | undefined>;
  createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate>;
  getAllInvoiceTemplates(): Promise<InvoiceTemplate[]>;

  // Seller Profile
  getSellerProfile(): Promise<SellerProfile | undefined>;
  createSellerProfile(profile: InsertSellerProfile): Promise<SellerProfile>;
  updateSellerProfile(id: string, updates: Partial<InsertSellerProfile>): Promise<SellerProfile | undefined>;

  // ========== ENTERPRISE ADMIN SYSTEM ==========
  
  // Staff Management
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByUserId(userId: string): Promise<Staff | undefined>;
  getAllStaff(status?: string): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | undefined>;
  disableStaff(id: string, disabledBy: string): Promise<Staff | undefined>;

  // Ticket Notes
  createTicketNote(note: InsertTicketNote): Promise<TicketNote>;
  getTicketNotes(ticketId: string): Promise<TicketNote[]>;

  // Support Ticket Enhancements
  getSupportTicketsForStaff(staffId: string, statuses?: string[]): Promise<SupportTicket[]>;

  // Staff Metrics
  getStaffMetrics(staffId: string): Promise<StaffMetrics | undefined>;
  getAllStaffMetrics(): Promise<StaffMetrics[]>;
  createStaffMetrics(metrics: InsertStaffMetrics): Promise<StaffMetrics>;
  updateStaffMetrics(staffId: string, updates: Partial<InsertStaffMetrics>): Promise<StaffMetrics | undefined>;

  // Admin Audit Logs
  createAdminAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAdminAuditLogs(filters: {
    staffId?: string;
    role?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number }>;
  
  // Analytics
  getTicketAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
    priority?: string;
  }): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResolutionTime: number;
    slaBreaches: number;
    byPriority: Record<string, number>;
  }>;

  getCouponAnalytics(): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    expiredCoupons: number;
    totalRedemptions: number;
    redemptionRate: number;
    topCoupons: any[];
  }>;

  getRevenueAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalRevenue: number;
    activeSubscriptions: number;
    pendingPayments: number;
    mrr: number;
    mrg: number;
  }>;

  // User Feature Usage & Overrides
  getUserFeatureUsage(userId: string): Promise<any | undefined>;
  createUserFeatureUsage(usage: any): Promise<any>;
  getUserFeatureOverride(userId: string): Promise<any | undefined>;
  createUserFeatureOverride(override: any): Promise<any>;
  updateUserFeatureOverride(userId: string, updates: any): Promise<any | undefined>;
  incrementUserFeatureUsage(userId: string, feature: string, amount: number): Promise<void>;
  decrementUserFeatureUsage(userId: string, feature: string, amount: number): Promise<void>;
  getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined>;
  getUserSubscriptions(userId: string): Promise<UserSubscription[]>;
  getSubscriptionPlanById(planId: string): Promise<SubscriptionPlan | undefined>;
  
  // User Email Providers (filtered by userId)
  getUserEmailProviders(userId: string): Promise<EmailProvider[]>;
  getUserEmailProviderCount(userId: string): Promise<number>;

  // Payment Gateway Management
  getActivePaymentGateways(): Promise<PaymentGateway[]>;
  getPaymentGateway(id: string): Promise<PaymentGateway | undefined>;
  getPaymentGatewayByType(gatewayType: string): Promise<PaymentGateway | undefined>;
  updatePaymentGatewayHealth(
    id: string, 
    success: boolean, 
    errorMessage?: string
  ): Promise<void>;
  updatePaymentGatewayCredentials(
    id: string,
    credentials: any,
    webhookSecret?: string
  ): Promise<PaymentGateway | undefined>;

  // Invoice Template operations
  getInvoiceTemplates(): Promise<InvoiceTemplate[]>;
  getActiveInvoiceTemplates(): Promise<InvoiceTemplate[]>;
  getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined>;
  getInvoiceTemplateByKey(templateKey: string): Promise<InvoiceTemplate | undefined>;
  getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | undefined>;
  createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate>;
  updateInvoiceTemplate(id: string, updates: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined>;
  updateQuoteWithPDF(
    quoteId: string,
    templateId: string,
    pdfPath: string
  ): Promise<Quote | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations (Clerk Auth only)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Admin identities (separate table)
  async getAdmin(id: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin;
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin;
  }

  async createAdmin(adminData: InsertAdmin): Promise<Admin> {
    const [created] = await db.insert(admins).values(adminData).returning();
    return created;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check by Clerk ID first, then by email, then by id
    let existingUser: User | undefined;

    if (userData.clerkUserId) {
      existingUser = await this.getUserByClerkId(userData.clerkUserId);
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
          neonAuthUserId: userData.neonAuthUserId || existingUser.neonAuthUserId,
          clerkUserId: userData.clerkUserId || existingUser.clerkUserId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return user;
    }
    
    // New user - do NOT manually assign role, use database default
    const now = new Date();

    try {
      const [insertedUser] = await db
        .insert(users)
        .values({
          id: userData.id || undefined,
          supabaseUserId: userData.supabaseUserId,
          neonAuthUserId: userData.neonAuthUserId,
          clerkUserId: userData.clerkUserId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          // role: default will be used from schema definition
          authProvider: userData.authProvider || 'native',
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      // Create user profile for onboarding tracking
      await this.createUserProfile({ userId: insertedUser.id });
      
      // Return the final user state
      const finalUser = await this.getUser(insertedUser.id);
      return finalUser || insertedUser;
    } catch (error: any) {
      // Handle race condition - another request might have created the user
      if (userData.clerkUserId) {
        const existingAfterRace = await this.getUserByClerkId(userData.clerkUserId);
        if (existingAfterRace) return existingAfterRace;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByClerkId(clerkUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
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
  async getCompanyProfile(id: string, tenantId?: string): Promise<CompanyProfile | undefined> {
    const conditions = [eq(companyProfiles.id, id)];
    if (tenantId) {
      conditions.push(eq(companyProfiles.tenantId, tenantId));
    }
    const [profile] = await db.select().from(companyProfiles).where(and(...conditions));
    return profile;
  }

  async getAllCompanyProfiles(userId?: string, tenantId?: string): Promise<CompanyProfile[]> {
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      return await db.select().from(companyProfiles).where(eq(companyProfiles.tenantId, tenantId));
    }
    if (userId) {
      return await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
    }
    return await db.select().from(companyProfiles);
  }

  async getDefaultCompanyProfile(userId?: string, tenantId?: string): Promise<CompanyProfile | undefined> {
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      const [profile] = await db.select().from(companyProfiles)
        .where(and(eq(companyProfiles.tenantId, tenantId), eq(companyProfiles.isDefault, true)));
      return profile;
    }
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

  async updateCompanyProfile(id: string, updates: Partial<InsertCompanyProfile>, tenantId?: string): Promise<CompanyProfile | undefined> {
    const conditions: any[] = [eq(companyProfiles.id, id)];
    if (tenantId) {
      conditions.push(eq(companyProfiles.tenantId, tenantId));
    }
    const [updated] = await db.update(companyProfiles)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async setDefaultCompanyProfile(id: string, userId?: string, tenantId?: string): Promise<void> {
    // Remove default from all tenant's/user's profiles
    if (tenantId) {
      await db.update(companyProfiles)
        .set({ isDefault: false })
        .where(eq(companyProfiles.tenantId, tenantId));
    } else if (userId) {
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
  async getPartyProfile(id: string, tenantId?: string): Promise<PartyProfile | undefined> {
    const conditions = [eq(partyProfiles.id, id)];
    if (tenantId) {
      conditions.push(eq(partyProfiles.tenantId, tenantId));
    }
    const [profile] = await db.select().from(partyProfiles).where(and(...conditions));
    return profile;
  }

  async getAllPartyProfiles(userId?: string, tenantId?: string): Promise<PartyProfile[]> {
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      return await db.select().from(partyProfiles).where(eq(partyProfiles.tenantId, tenantId));
    }
    if (userId) {
      return await db.select().from(partyProfiles).where(eq(partyProfiles.userId, userId));
    }
    return await db.select().from(partyProfiles);
  }

  async createPartyProfile(insertProfile: InsertPartyProfile): Promise<PartyProfile> {
    const [profile] = await db.insert(partyProfiles).values(insertProfile).returning();
    return profile;
  }

  async updatePartyProfile(id: string, updates: Partial<InsertPartyProfile>, tenantId?: string): Promise<PartyProfile | undefined> {
    const conditions: any[] = [eq(partyProfiles.id, id)];
    if (tenantId) {
      conditions.push(eq(partyProfiles.tenantId, tenantId));
    }
    const [updated] = await db.update(partyProfiles)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async deletePartyProfile(id: string, tenantId?: string): Promise<boolean> {
    // Check if any quotes exist for this party
    const conditions = [eq(quotes.partyId, id)];
    if (tenantId) {
      conditions.push(eq(quotes.tenantId, tenantId));
    }
    const partyQuotes = await db.select({ id: quotes.id })
      .from(quotes)
      .where(and(...conditions))
      .limit(1);
    
    if (partyQuotes.length > 0) {
      throw new Error("PARTY_HAS_QUOTES");
    }
    
    const deleteConditions = [eq(partyProfiles.id, id)];
    if (tenantId) {
      deleteConditions.push(eq(partyProfiles.tenantId, tenantId));
    }
    await db.delete(partyProfiles).where(and(...deleteConditions));
    return true;
  }
  
  async getQuotesByPartyId(partyId: string, userId?: string, tenantId?: string): Promise<Quote[]> {
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      return await db.select().from(quotes).where(and(
        eq(quotes.partyId, partyId),
        eq(quotes.tenantId, tenantId)
      ));
    }
    if (userId) {
      return await db.select().from(quotes).where(and(
        eq(quotes.partyId, partyId),
        eq(quotes.userId, userId)
      ));
    }
    return await db.select().from(quotes).where(eq(quotes.partyId, partyId));
  }

  async searchPartyProfiles(userId: string, search: string, tenantId?: string): Promise<PartyProfile[]> {
    const searchTerm = `%${search}%`;
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      return await db.select().from(partyProfiles)
        .where(and(
          eq(partyProfiles.tenantId, tenantId),
          or(
            ilike(partyProfiles.personName, searchTerm),
            ilike(partyProfiles.companyName, searchTerm)
          )
        ));
    }
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
  async getQuote(id: string, tenantId?: string): Promise<Quote | undefined> {
    const conditions = [eq(quotes.id, id)];
    if (tenantId) {
      conditions.push(eq(quotes.tenantId, tenantId));
    }
    const [quote] = await db.select().from(quotes).where(and(...conditions));
    return quote;
  }

  async getAllQuotes(userId?: string, tenantId?: string): Promise<Quote[]> {
    // Prefer tenantId for multi-tenant isolation
    if (tenantId) {
      return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
    }
    if (userId) {
      return await db.select().from(quotes).where(eq(quotes.userId, userId));
    }
    return await db.select().from(quotes);
  }

  // Get quotes scoped by tenant (alias for getAllQuotes with tenant isolation)
  async getQuotesByTenant(tenantId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
  }

  // Fetch company profile by GST within tenant (used to handle unique constraint conflicts)
  async getCompanyProfileByGst(gstNo: string, tenantId: string): Promise<CompanyProfile | undefined> {
    // Match tenant or fallback to user_id (for null tenant legacy rows)
    const [profile] = await db.select().from(companyProfiles).where(
      and(
        eq(companyProfiles.gstNo, gstNo),
        or(
          eq(companyProfiles.tenantId, tenantId),
          and(
            sql`${companyProfiles.tenantId} IS NULL`,
            eq(companyProfiles.userId, tenantId)
          )
        )
      )
    );
    return profile;
  }

  // Fetch any company profile by GST (ignores tenant) for conflict recovery
  async getAnyCompanyProfileByGst(gstNo: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.gstNo, gstNo));
    return profile;
  }

  async getAllQuotesWithItems(userId?: string, tenantId?: string): Promise<(Quote & { items: any[]; activeVersion: QuoteVersion | null })[]> {
    // Get all quotes for tenant/user (prefer tenantId for multi-tenant isolation)
    let quotesData: Quote[];
    if (tenantId) {
      quotesData = await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
    } else if (userId) {
      quotesData = await db.select().from(quotes).where(eq(quotes.userId, userId));
    } else {
      quotesData = await db.select().from(quotes);
    }
    
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

  async searchQuotes(userId: string, options: { partyName?: string; boxName?: string; boxSize?: string }, tenantId?: string): Promise<Quote[]> {
    // Prefer tenantId for multi-tenant isolation
    let results: Quote[];
    if (tenantId) {
      results = await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
    } else {
      results = await db.select().from(quotes).where(eq(quotes.userId, userId));
    }
    
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

  async updateQuote(id: string, updates: Partial<InsertQuote>, tenantId?: string): Promise<Quote | undefined> {
    const conditions = [eq(quotes.id, id)];
    if (tenantId) {
      conditions.push(eq(quotes.tenantId, tenantId));
    }
    const [updated] = await db.update(quotes)
      .set(updates)
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async deleteQuote(id: string, tenantId?: string): Promise<boolean> {
    const conditions = [eq(quotes.id, id)];
    if (tenantId) {
      conditions.push(eq(quotes.tenantId, tenantId));
    }
    await db.delete(quotes).where(and(...conditions));
    return true;
  }

  // Generate unique quote number (format: QT-YYYYMMDD-XXX)
  async generateQuoteNumber(userId: string, tenantId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Count quotes created today by tenant/user (prefer tenantId for multi-tenant)
    let existingQuotes: Quote[];
    if (tenantId) {
      existingQuotes = await db.select().from(quotes)
        .where(eq(quotes.tenantId, tenantId));
    } else {
      existingQuotes = await db.select().from(quotes)
        .where(eq(quotes.userId, userId));
    }
    
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

  // Archive a quote version (mark as archived when superseded by newer version)
  async archiveQuoteVersion(versionId: string): Promise<QuoteVersion | undefined> {
    const [updated] = await db.update(quoteVersions)
      .set({ isArchived: true })
      .where(eq(quoteVersions.id, versionId))
      .returning();
    return updated;
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
  
  // Rate Memory - tenant-scoped
  async getAllRateMemory(tenantId?: string, userId?: string): Promise<RateMemoryEntry[]> {
    // Prefer tenantId for isolation, fall back to userId for backward compatibility
    if (tenantId) {
      return await db.select().from(rateMemory).where(eq(rateMemory.tenantId, tenantId));
    }
    if (userId) {
      return await db.select().from(rateMemory).where(eq(rateMemory.userId, userId));
    }
    return [];
  }

  async getRateMemoryByKey(bfValue: string, shade: string, tenantId?: string, userId?: string): Promise<RateMemoryEntry | undefined> {
    // Prefer tenantId for isolation, fall back to userId for backward compatibility
    if (tenantId) {
      const [entry] = await db.select().from(rateMemory)
        .where(and(
          eq(rateMemory.tenantId, tenantId),
          eq(rateMemory.bfValue, bfValue),
          eq(rateMemory.shade, shade)
        ));
      return entry;
    }
    if (userId) {
      const [entry] = await db.select().from(rateMemory)
        .where(and(
          eq(rateMemory.userId, userId),
          eq(rateMemory.bfValue, bfValue),
          eq(rateMemory.shade, shade)
        ));
      return entry;
    }
    return undefined;
  }

  async saveOrUpdateRateMemory(bfValue: string, shade: string, rate: number, tenantId?: string, userId?: string): Promise<RateMemoryEntry> {
    const existing = await this.getRateMemoryByKey(bfValue, shade, tenantId, userId);
    
    if (existing) {
      const [updated] = await db.update(rateMemory)
        .set({ rate, updatedAt: new Date().toISOString() })
        .where(eq(rateMemory.id, existing.id))
        .returning();
      return updated;
    }
    
    // Include tenantId in inserts for proper tenant isolation
    const [entry] = await db.insert(rateMemory)
      .values({ bfValue, shade, rate, tenantId, userId })
      .returning();
    return entry;
  }
  
  // App Settings - tenant-scoped
  async getAppSettings(tenantId?: string, userId?: string): Promise<AppSettings> {
    // Prefer tenantId for isolation, fall back to userId for backward compatibility
    if (tenantId) {
      const [settings] = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId));
      if (settings) return settings;
      
      // Create default settings for this tenant
      const [newSettings] = await db.insert(appSettings).values({
        tenantId,
        userId,
        appTitle: "Box Costing Calculator",
        plyThicknessMap: { '1': 0.45, '3': 2.5, '5': 3.5, '7': 5.5, '9': 6.5 },
      }).returning();
      return newSettings;
    }
    
    if (userId) {
      const [settings] = await db.select().from(appSettings).where(eq(appSettings.userId, userId));
      if (settings) return settings;
    }
    
    // Create default settings (legacy fallback)
    const [newSettings] = await db.insert(appSettings).values({
      tenantId,
      userId,
      appTitle: "Box Costing Calculator",
      plyThicknessMap: { '1': 0.45, '3': 2.5, '5': 3.5, '7': 5.5, '9': 6.5 },
    }).returning();
    return newSettings;
  }
  
  async updateAppSettings(updates: Partial<InsertAppSettings>, tenantId?: string, userId?: string): Promise<AppSettings> {
    const existing = await this.getAppSettings(tenantId, userId);
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
  
  // ========== PAPER SHADES MASTER TABLE ==========
  async getPaperShades(): Promise<PaperShade[]> {
    return await db.select().from(paperShades).where(eq(paperShades.isActive, true)).orderBy(paperShades.sortOrder);
  }
  
  async getPaperShadeByName(shadeName: string): Promise<PaperShade | undefined> {
    const [shade] = await db.select().from(paperShades).where(
      and(eq(paperShades.shadeName, shadeName), eq(paperShades.isActive, true))
    );
    return shade;
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
  
  // ========== SETUP + VERIFICATION (NEW SYSTEM) ==========

  private normalizeVerificationStatus(status?: string | null): VerificationStatusCode {
    const normalized = (status || '').toUpperCase() as VerificationStatusCode;
    if (normalized === 'APPROVED' || normalized === 'PENDING' || normalized === 'REJECTED' || normalized === 'NOT_SUBMITTED') {
      return normalized;
    }
    return 'NOT_SUBMITTED';
  }

  private computeSetupProgress(setup: UserSetup): number {
    const stepsCompleted = [
      setup.businessProfile,
      setup.paperPricing,
      setup.fluteSettings,
    ].filter(Boolean).length;
    return Math.round((stepsCompleted / 3) * 100); // 3 steps
  }

  private async ensureUserSetup(userId: string, tenantId?: string): Promise<UserSetup> {
    const conditions = [eq(userSetup.userId, userId)];
    if (tenantId) {
      conditions.push(eq(userSetup.tenantId, tenantId));
    }

    const existing = await db.select().from(userSetup)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(userSetup.updatedAt))
      .limit(1);

    if (existing[0]) return existing[0];

    const [created] = await db.insert(userSetup)
      .values({ userId, tenantId: tenantId ?? null })
      .returning();
    return created;
  }

  private async syncOnboardingStatusFromSetup(
    tx: typeof db,
    userId: string,
    setupRow: UserSetup,
    options?: {
      tenantId?: string | null;
      verificationStatus?: VerificationStatusCode;
      submittedForVerification?: boolean;
      approvedAt?: Date | null;
      approvedBy?: string | null;
      rejectionReason?: string | null;
    }
  ): Promise<void> {
    const now = new Date();
    const targetTenantId = options?.tenantId ?? setupRow.tenantId ?? null;

    const existing = await tx.select().from(onboardingStatus)
      .where(
        targetTenantId
          ? and(eq(onboardingStatus.userId, userId), eq(onboardingStatus.tenantId, targetTenantId))
          : eq(onboardingStatus.userId, userId)
      )
      .limit(1);

    const basePayload = {
      userId,
      tenantId: targetTenantId,
      businessProfileDone: setupRow.businessProfile,
      paperSetupDone: setupRow.paperPricing,
      fluteSetupDone: setupRow.fluteSettings,
      taxSetupDone: setupRow.taxDefaults,
      termsSetupDone: setupRow.quoteTerms,
      updatedAt: now,
    } as Partial<typeof onboardingStatus.$inferInsert>;

    if (options?.verificationStatus) {
      basePayload.verificationStatus = options.verificationStatus.toLowerCase();
    }
    if (typeof options?.submittedForVerification === 'boolean') {
      basePayload.submittedForVerification = options.submittedForVerification;
      basePayload.submittedAt = options.submittedForVerification ? now : null;
    }
    if (options?.approvedAt !== undefined) basePayload.approvedAt = options.approvedAt;
    if (options?.approvedBy !== undefined) basePayload.approvedBy = options.approvedBy;
    if (options?.rejectionReason !== undefined) basePayload.rejectionReason = options.rejectionReason;

    if (existing[0]) {
      await tx.update(onboardingStatus)
        .set(basePayload)
        .where(eq(onboardingStatus.id, existing[0].id));
    } else {
      await tx.insert(onboardingStatus)
        .values({
          ...basePayload,
          verificationStatus: basePayload.verificationStatus || 'pending',
          createdAt: now,
          updatedAt: now,
        });
    }
  }

  async getUserSetupStatus(userId: string, tenantId?: string): Promise<SetupStatus> {
    const setupRow = await this.ensureUserSetup(userId, tenantId);
    const user = await this.getUser(userId);

    const onboardingRows = await db.select().from(onboardingStatus)
      .where(eq(onboardingStatus.userId, userId))
      .limit(1);
    const onboardingRow = onboardingRows[0];

    const progress = this.computeSetupProgress(setupRow);
    const isSetupComplete = progress === 100;

    const verificationStatus = onboardingRow?.verificationStatus
      ? onboardingRow.verificationStatus.toUpperCase() as VerificationStatusCode
      : this.normalizeVerificationStatus(user?.verificationStatus);

    // Keep users table in sync
    if (user && (
      user.setupProgress !== progress ||
      user.isSetupComplete !== isSetupComplete ||
      this.normalizeVerificationStatus(user.verificationStatus) !== verificationStatus
    )) {
      await db.update(users)
        .set({
          setupProgress: progress,
          isSetupComplete,
          verificationStatus,
        })
        .where(eq(users.id, userId));
    }

    return {
      userId,
      tenantId: setupRow.tenantId,
      steps: {
        businessProfile: setupRow.businessProfile,
        paperPricing: setupRow.paperPricing,
        fluteSettings: setupRow.fluteSettings,
        taxDefaults: setupRow.taxDefaults,
        quoteTerms: setupRow.quoteTerms,
      },
      setupProgress: progress,
      isSetupComplete,
      verificationStatus,
      submittedForVerification: onboardingRow?.submittedForVerification || false,
      approvedAt: onboardingRow?.approvedAt || user?.approvedAt || null,
      approvedBy: onboardingRow?.approvedBy || user?.approvedBy || null,
      rejectionReason: onboardingRow?.rejectionReason || null,
      submittedAt: onboardingRow?.submittedAt || null,
    };
  }

  async completeSetupStep(userId: string, stepKey: keyof SetupStatus['steps'], tenantId?: string): Promise<SetupStatus> {
    console.log("\n🔧 completeSetupStep CALLED");
    console.log("  👤 userId:", userId);
    console.log("  🔑 stepKey:", stepKey);
    console.log("  🏢 tenantId:", tenantId);
    
    const setupRow = await this.ensureUserSetup(userId, tenantId);
    console.log("  📄 Setup row retrieved:", { id: setupRow.id, userId: setupRow.userId });
    
    const now = new Date();

    await db.transaction(async (tx) => {
      console.log("  🔄 Starting transaction...");
      
      const [updated] = await tx.update(userSetup)
        .set({ [stepKey]: true, updatedAt: now })
        .where(eq(userSetup.id, setupRow.id))
        .returning();
      
      console.log("  ✅ Step marked as complete in user_setup table");
      console.log("  📊 Updated setup row:", JSON.stringify(updated));

      const progress = this.computeSetupProgress(updated);
      console.log("  📈 Computed progress:", progress, "%");
      
      const isSetupComplete = progress === 100;
      const completedAt = isSetupComplete ? (updated.completedAt || now) : null;

      await tx.update(userSetup)
        .set({ completedAt, updatedAt: now })
        .where(eq(userSetup.id, updated.id));
      
      console.log("  ✅ Updated completedAt in user_setup");

      await tx.update(users)
        .set({ setupProgress: progress, isSetupComplete })
        .where(eq(users.id, userId));
      
      console.log("  ✅ Updated users table with progress:", progress);

      await this.syncOnboardingStatusFromSetup(tx, userId, { ...updated, completedAt } as UserSetup, {});
      console.log("  ✅ Synced onboarding_status table");
    });

    console.log("  🎉 Transaction completed successfully!");
    const finalStatus = await this.getUserSetupStatus(userId, tenantId);
    console.log("  📊 Final status:", JSON.stringify(finalStatus));
    return finalStatus;
  }

  async submitSetupForVerification(userId: string, tenantId?: string): Promise<SetupStatus> {
    const status = await this.getUserSetupStatus(userId, tenantId);

    if (!status.isSetupComplete) {
      throw new Error('Please complete all setup steps before submitting for verification');
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          accountStatus: 'verification_pending',
          verificationStatus: 'PENDING',
          submittedForVerificationAt: now,
          approvedAt: null,
          approvedBy: null,
          approvalNote: null,
        })
        .where(eq(users.id, userId));

      const setupRow = await this.ensureUserSetup(userId, tenantId);
      await tx.update(userSetup)
        .set({ completedAt: setupRow.completedAt || now, updatedAt: now })
        .where(eq(userSetup.id, setupRow.id));

      await this.syncOnboardingStatusFromSetup(tx, userId, { ...setupRow, completedAt: setupRow.completedAt || now } as UserSetup, {
        submittedForVerification: true,
        verificationStatus: 'PENDING',
        approvedAt: null,
        approvedBy: null,
      });
    });

    return this.getUserSetupStatus(userId, tenantId);
  }

  // ========== ONBOARDING STATUS (Admin Verification) ==========
  async getOnboardingStatus(userId: string, tenantId?: string): Promise<OnboardingStatus | undefined> {
    const setupStatus = await this.getUserSetupStatus(userId, tenantId);
    const [legacy] = await db.select().from(onboardingStatus)
      .where(tenantId ? and(eq(onboardingStatus.userId, userId), eq(onboardingStatus.tenantId, tenantId)) : eq(onboardingStatus.userId, userId))
      .limit(1);

    const verification = setupStatus.verificationStatus === 'NOT_SUBMITTED'
      ? 'in_progress'
      : setupStatus.verificationStatus.toLowerCase();

    const now = new Date();

    return {
      id: legacy?.id || crypto.randomUUID(),
      tenantId: legacy?.tenantId || setupStatus.tenantId || null,
      userId,
      businessProfileDone: setupStatus.steps.businessProfile,
      paperSetupDone: setupStatus.steps.paperPricing,
      fluteSetupDone: setupStatus.steps.fluteSettings,
      taxSetupDone: setupStatus.steps.taxDefaults,
      termsSetupDone: setupStatus.steps.quoteTerms,
      submittedForVerification: setupStatus.submittedForVerification,
      verificationStatus: verification,
      rejectionReason: legacy?.rejectionReason || null,
      submittedAt: legacy?.submittedAt || null,
      approvedAt: setupStatus.approvedAt || legacy?.approvedAt || null,
      rejectedAt: legacy?.rejectedAt || null,
      approvedBy: setupStatus.approvedBy || legacy?.approvedBy || null,
      lastReminderSentAt: legacy?.lastReminderSentAt || null,
      createdAt: legacy?.createdAt || now,
      updatedAt: now,
    } as OnboardingStatus;
  }
  
  async createOnboardingStatus(status: InsertOnboardingStatus): Promise<OnboardingStatus> {
    const [created] = await db.insert(onboardingStatus).values(status).returning();
    return created;
  }
  
  async updateOnboardingStatus(userId: string, updates: Partial<InsertOnboardingStatus>): Promise<OnboardingStatus | undefined> {
    const setupRow = await this.ensureUserSetup(userId, updates.tenantId);
    const stepUpdates: Partial<UserSetup> = {};
    if (updates.businessProfileDone !== undefined) stepUpdates.businessProfile = updates.businessProfileDone;
    if (updates.paperSetupDone !== undefined) stepUpdates.paperPricing = updates.paperSetupDone;
    if (updates.fluteSetupDone !== undefined) stepUpdates.fluteSettings = updates.fluteSetupDone;
    if (updates.taxSetupDone !== undefined) stepUpdates.taxDefaults = updates.taxSetupDone;
    if (updates.termsSetupDone !== undefined) stepUpdates.quoteTerms = updates.termsSetupDone;

    if (Object.keys(stepUpdates).length > 0) {
      await db.update(userSetup)
        .set({ ...stepUpdates, updatedAt: new Date() })
        .where(eq(userSetup.id, setupRow.id));
    }

    if (updates.submittedForVerification || updates.verificationStatus === 'pending') {
      await this.submitSetupForVerification(userId, updates.tenantId);
    }

    return this.getOnboardingStatus(userId, updates.tenantId);
  }
  
  async submitForVerification(userId: string): Promise<OnboardingStatus | undefined> {
    await this.submitSetupForVerification(userId);
    return this.getOnboardingStatus(userId);
  }
  
  async approveUser(userId: string, adminUserId: string): Promise<OnboardingStatus | undefined> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          accountStatus: 'approved',
          verificationStatus: 'APPROVED',
          approvedAt: now,
          approvedBy: adminUserId,
          approvalNote: null,
        })
        .where(eq(users.id, userId));

      const setupRow = await this.ensureUserSetup(userId);
      await this.syncOnboardingStatusFromSetup(tx, userId, setupRow, {
        verificationStatus: 'APPROVED',
        submittedForVerification: true,
        approvedAt: now,
        approvedBy: adminUserId,
        rejectionReason: null,
      });
    });

    await this.createAdminAction({
      adminUserId,
      targetUserId: userId,
      action: 'approved',
      remarks: 'User approved'
    });

    return this.getOnboardingStatus(userId);
  }
  
  async rejectUser(userId: string, adminUserId: string, reason: string): Promise<OnboardingStatus | undefined> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          accountStatus: 'rejected',
          verificationStatus: 'REJECTED',
          approvedAt: null,
          approvedBy: null,
          approvalNote: reason,
        })
        .where(eq(users.id, userId));

      const setupRow = await this.ensureUserSetup(userId);
      await this.syncOnboardingStatusFromSetup(tx, userId, setupRow, {
        verificationStatus: 'REJECTED',
        submittedForVerification: true,
        approvedAt: null,
        approvedBy: null,
        rejectionReason: reason,
      });
    });

    await this.createAdminAction({
      adminUserId,
      targetUserId: userId,
      action: 'rejected',
      remarks: reason
    });
    
    return this.getOnboardingStatus(userId);
  }

  async bulkApproveUsers(userIds: string[], adminUserId: string): Promise<number> {
    const now = new Date();
    
    await db.transaction(async (tx) => {
      // Update all users to approved status
      await tx.update(users)
        .set({
          accountStatus: 'approved',
          verificationStatus: 'APPROVED',
          approvedAt: now,
          approvedBy: adminUserId,
          approvalNote: null,
        })
        .where(inArray(users.id, userIds));

      // Update onboarding status for all users
      await tx.update(onboardingStatus)
        .set({
          verificationStatus: 'approved',
          submittedForVerification: true,
          approvedAt: now,
          approvedBy: adminUserId,
          rejectionReason: null,
          updatedAt: now,
        })
        .where(inArray(onboardingStatus.userId, userIds));
    });

    // Log audit trail for each user
    for (const userId of userIds) {
      await this.createAdminAction({
        adminUserId,
        targetUserId: userId,
        action: 'bulk_approved',
        remarks: `Bulk approved with ${userIds.length} other users`
      });
    }

    return userIds.length;
  }

  async getPendingVerifications(): Promise<OnboardingStatus[]> {
    const pendingUsers = await db.select()
      .from(users)
      .where(eq(users.accountStatus, 'verification_pending'))
      .orderBy(users.submittedForVerificationAt);
    
    const results: OnboardingStatus[] = [];
    for (const u of pendingUsers) {
      const status = await this.getOnboardingStatus(u.id);
      if (status) results.push(status);
    }
    return results;
  }
  
  async updateOnboardingReminderSent(userId: string): Promise<void> {
    await db.update(onboardingStatus)
      .set({
        lastReminderSentAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(onboardingStatus.userId, userId));
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
    activeSubscriptions: number;
    monthlyRevenue: number;
    gstCollected: number;
    userChange: number;
    subscriptionChange: number;
    revenueChange: number;
  }> {
    const allUsers = await db.select({ count: sql`count(*)` }).from(users);
    const pendingResult = await db.select({ count: sql`count(*)` }).from(users)
      .where(eq(users.accountStatus, 'verification_pending'));
    const approvedResult = await db.select({ count: sql`count(*)` }).from(users)
      .where(eq(users.accountStatus, 'approved'));
    const rejectedResult = await db.select({ count: sql`count(*)` }).from(users)
      .where(eq(users.accountStatus, 'rejected'));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newSignupsResult = await db.select({ count: sql`count(*)` }).from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);
    
    // Get active subscriptions
    const activeSubsResult = await db.select({ count: sql`count(*)` }).from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'active'));
    
    // Get monthly revenue (sum of payments this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyRevenueResult = await db.select({ sum: sql<number>`COALESCE(SUM(amount), 0)` }).from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.status, 'success'),
        sql`${paymentTransactions.createdAt} >= ${startOfMonth}`
      ));
    
    const monthlyRevenue = Number(monthlyRevenueResult[0]?.sum || 0);
    
    // Estimate GST as 18% of monthly revenue
    const gstCollected = Math.round(monthlyRevenue * 0.18 / 1.18); // Extract GST from inclusive amount
    
    return {
      totalUsers: Number(allUsers[0]?.count || 0),
      pendingVerifications: Number(pendingResult[0]?.count || 0),
      approvedUsers: Number(approvedResult[0]?.count || 0),
      rejectedUsers: Number(rejectedResult[0]?.count || 0),
      newSignupsLast7Days: Number(newSignupsResult[0]?.count || 0),
      activeSubscriptions: Number(activeSubsResult[0]?.count || 0),
      monthlyRevenue,
      gstCollected,
      userChange: Number(newSignupsResult[0]?.count || 0), // Change = new signups this week
      subscriptionChange: 0, // TODO: Calculate actual change
      revenueChange: 0, // TODO: Calculate month-over-month change
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

  // ========== ADMIN EMAIL SETTINGS (System-wide SMTP Configuration) ==========
  async getActiveAdminEmailSettings(): Promise<AdminEmailSettings | undefined> {
    const [settings] = await db.select()
      .from(adminEmailSettings)
      .where(eq(adminEmailSettings.isActive, true))
      .limit(1);
    return settings;
  }

  async createAdminEmailSettings(settings: InsertAdminEmailSettings): Promise<AdminEmailSettings> {
    const [created] = await db.insert(adminEmailSettings).values(settings).returning();
    return created;
  }

  async updateAdminEmailSettings(id: string, updates: Partial<InsertAdminEmailSettings>): Promise<AdminEmailSettings | undefined> {
    const [updated] = await db.update(adminEmailSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminEmailSettings.id, id))
      .returning();
    return updated;
  }

  async deactivateOtherEmailSettings(exceptId?: string): Promise<void> {
    if (exceptId) {
      await db.update(adminEmailSettings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(adminEmailSettings.isActive, true),
          sql`${adminEmailSettings.id} != ${exceptId}`
        ));
    } else {
      await db.update(adminEmailSettings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(adminEmailSettings.isActive, true));
    }
  }

  async testEmailSettings(id: string, status: 'success' | 'failed'): Promise<void> {
    await db.update(adminEmailSettings)
      .set({
        lastTestedAt: new Date(),
        testStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(adminEmailSettings.id, id));
  }

  // ========== MULTI-PROVIDER EMAIL SYSTEM ==========
  
  // Email Providers
  async getEmailProvider(id: string): Promise<EmailProvider | undefined> {
    const [provider] = await db.select()
      .from(emailProviders)
      .where(eq(emailProviders.id, id));
    return provider;
  }

  async getAllEmailProviders(): Promise<EmailProvider[]> {
    return await db.select()
      .from(emailProviders)
      .orderBy(emailProviders.priorityOrder);
  }

  async getActiveEmailProviders(): Promise<EmailProvider[]> {
    return await db.select()
      .from(emailProviders)
      .where(eq(emailProviders.isActive, true))
      .orderBy(emailProviders.priorityOrder);
  }

  async getEmailProvidersByType(providerType: string): Promise<EmailProvider[]> {
    return await db.select()
      .from(emailProviders)
      .where(and(
        eq(emailProviders.providerType, providerType),
        eq(emailProviders.isActive, true)
      ))
      .orderBy(emailProviders.priorityOrder);
  }

  async createEmailProvider(provider: InsertEmailProvider): Promise<EmailProvider> {
    const [created] = await db.insert(emailProviders).values(provider).returning();
    return created;
  }

  async updateEmailProvider(id: string, updates: Partial<InsertEmailProvider>): Promise<EmailProvider | undefined> {
    const [updated] = await db.update(emailProviders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailProviders.id, id))
      .returning();
    return updated;
  }

  async deleteEmailProvider(id: string): Promise<boolean> {
    const result = await db.delete(emailProviders)
      .where(eq(emailProviders.id, id))
      .returning();
    return result.length > 0;
  }

  async setPrimaryEmailProvider(id: string): Promise<boolean> {
    const providers = await this.getAllEmailProviders();
    if (!providers || providers.length === 0) return false;

    const target = providers.find(p => p.id === id);
    if (!target) return false;

    // Build new priority order: target -> 1, others follow in existing order
    const others = providers.filter(p => p.id !== id);
    let order = 2;
    await db.update(emailProviders)
      .set({ priorityOrder: 1, updatedAt: new Date() })
      .where(eq(emailProviders.id, id));

    for (const p of others) {
      await db.update(emailProviders)
        .set({ priorityOrder: order, updatedAt: new Date() })
        .where(eq(emailProviders.id, p.id));
      order += 1;
    }

    return true;
  }

  async updateProviderHealth(id: string, success: boolean, errorMessage?: string): Promise<void> {
    const provider = await this.getEmailProvider(id);
    if (!provider) return;

    const updates: Partial<InsertEmailProvider> = {
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };

    if (success) {
      updates.consecutiveFailures = 0;
      updates.totalSent = (provider.totalSent || 0) + 1;
      updates.lastErrorMessage = null;
    } else {
      updates.consecutiveFailures = (provider.consecutiveFailures || 0) + 1;
      updates.totalFailed = (provider.totalFailed || 0) + 1;
      updates.lastErrorAt = new Date();
      updates.lastErrorMessage = errorMessage || null;
    }

    await db.update(emailProviders)
      .set(updates)
      .where(eq(emailProviders.id, id));
  }

  // Email Task Routing
  async getTaskRouting(taskType: string): Promise<EmailTaskRouting | undefined> {
    const [routing] = await db.select()
      .from(emailTaskRouting)
      .where(eq(emailTaskRouting.taskType, taskType));
    return routing;
  }

  async getAllTaskRouting(): Promise<EmailTaskRouting[]> {
    return await db.select()
      .from(emailTaskRouting)
      .orderBy(emailTaskRouting.taskType);
  }

  async createTaskRouting(routing: InsertEmailTaskRouting): Promise<EmailTaskRouting> {
    const [created] = await db.insert(emailTaskRouting).values(routing).returning();
    return created;
  }

  async updateTaskRouting(id: string, updates: Partial<InsertEmailTaskRouting>): Promise<EmailTaskRouting | undefined> {
    const [updated] = await db.update(emailTaskRouting)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailTaskRouting.id, id))
      .returning();
    return updated;
  }

  async deleteTaskRouting(id: string): Promise<boolean> {
    const result = await db.delete(emailTaskRouting)
      .where(eq(emailTaskRouting.id, id))
      .returning();
    return result.length > 0;
  }

  // Email Send Logs
  async createEmailSendLog(log: InsertEmailSendLog): Promise<EmailSendLog> {
    const [created] = await db.insert(emailSendLogs).values(log).returning();
    return created;
  }

  async getEmailSendLogs(filters?: { 
    userId?: string; 
    taskType?: string; 
    status?: string; 
    limit?: number 
  }): Promise<EmailSendLog[]> {
    let query = db.select().from(emailSendLogs);

    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(emailSendLogs.userId, filters.userId));
    }
    if (filters?.taskType) {
      conditions.push(eq(emailSendLogs.taskType, filters.taskType));
    }
    if (filters?.status) {
      conditions.push(eq(emailSendLogs.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(sql`${emailSendLogs.sentAt} DESC`) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  // User Email Preferences
  async getUserEmailPreferences(userId: string): Promise<UserEmailPreferences | undefined> {
    const [prefs] = await db.select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId));
    return prefs;
  }

  async createUserEmailPreferences(prefs: InsertUserEmailPreferences): Promise<UserEmailPreferences> {
    const [created] = await db.insert(userEmailPreferences).values(prefs).returning();
    return created;
  }

  async updateUserEmailPreferences(userId: string, updates: Partial<InsertUserEmailPreferences>): Promise<UserEmailPreferences | undefined> {
    const [updated] = await db.update(userEmailPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userEmailPreferences.userId, userId))
      .returning();
    return updated;
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

  // ========== TEMPORARY BUSINESS PROFILES ==========

  async getTempProfileByEmail(email: string): Promise<TemporaryBusinessProfile | undefined> {
    const [profile] = await db.select()
      .from(temporaryBusinessProfiles)
      .where(eq(temporaryBusinessProfiles.businessEmail, email.toLowerCase()))
      .limit(1);
    return profile;
  }

  async getTempProfileBySession(sessionToken: string): Promise<TemporaryBusinessProfile | undefined> {
    const [profile] = await db.select()
      .from(temporaryBusinessProfiles)
      .where(eq(temporaryBusinessProfiles.sessionToken, sessionToken))
      .limit(1);
    return profile;
  }

  async createTempBusinessProfile(profile: InsertTemporaryBusinessProfile): Promise<TemporaryBusinessProfile> {
    const [newProfile] = await db.insert(temporaryBusinessProfiles)
      .values({
        ...profile,
        businessEmail: profile.businessEmail.toLowerCase(),
      })
      .returning();
    return newProfile;
  }

  async deleteTempProfile(id: string): Promise<void> {
    await db.delete(temporaryBusinessProfiles)
      .where(eq(temporaryBusinessProfiles.id, id));
  }

  // ========== INVOICES ==========

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices)
      .values(invoice)
      .returning();
    return newInvoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    return invoice;
  }

  async getInvoicesByUser(userId: string): Promise<Invoice[]> {
    return await db.select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(sql`${invoices.invoiceDate} DESC`);
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select()
      .from(invoices)
      .orderBy(sql`${invoices.invoiceDate} DESC`);
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getLastInvoiceForFY(financialYear: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select()
      .from(invoices)
      .where(eq(invoices.financialYear, financialYear))
      .orderBy(sql`${invoices.invoiceNumber} DESC`)
      .limit(1);
    return invoice;
  }

  // ========== INVOICE TEMPLATES ==========

  async getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .limit(1);
    return template;
  }

  async getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select()
      .from(invoiceTemplates)
      .where(and(
        eq(invoiceTemplates.isDefault, true),
        eq(invoiceTemplates.isActive, true)
      ))
      .limit(1);
    return template;
  }

  async createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate> {
    const [newTemplate] = await db.insert(invoiceTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getAllInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.isActive, true))
      .orderBy(invoiceTemplates.name);
  }

  // ========== SELLER PROFILE ==========

  async getSellerProfile(): Promise<SellerProfile | undefined> {
    const [profile] = await db.select()
      .from(sellerProfile)
      .limit(1);
    return profile;
  }

  async createSellerProfile(profile: InsertSellerProfile): Promise<SellerProfile> {
    const [newProfile] = await db.insert(sellerProfile)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateSellerProfile(id: string, updates: Partial<InsertSellerProfile>): Promise<SellerProfile | undefined> {
    const [updated] = await db.update(sellerProfile)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.id, id))
      .returning();
    return updated;
  }

  // ========== ENTERPRISE ADMIN SYSTEM ==========

  async getStaff(id: string): Promise<Staff | undefined> {
    const [result] = await db.select()
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);
    return result;
  }

  async getStaffByUserId(userId: string): Promise<Staff | undefined> {
    const [result] = await db.select()
      .from(staff)
      .where(eq(staff.userId, userId))
      .limit(1);
    return result;
  }

  async getAllStaff(status?: string): Promise<Staff[]> {
    if (status) {
      return db.select()
        .from(staff)
        .where(eq(staff.status, status));
    }
    return db.select().from(staff);
  }

  async createStaff(staffData: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff)
      .values(staffData)
      .returning();
    return newStaff;
  }

  async updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | undefined> {
    const [updated] = await db.update(staff)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, id))
      .returning();
    return updated;
  }

  async disableStaff(id: string, disabledBy: string): Promise<Staff | undefined> {
    const [updated] = await db.update(staff)
      .set({
        status: 'disabled',
        disabledAt: new Date(),
        disabledBy,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, id))
      .returning();
    return updated;
  }

  async createTicketNote(note: InsertTicketNote): Promise<TicketNote> {
    const [newNote] = await db.insert(ticketNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async getTicketNotes(ticketId: string): Promise<TicketNote[]> {
    return db.select()
      .from(ticketNotes)
      .where(eq(ticketNotes.ticketId, ticketId))
      .orderBy(ticketNotes.createdAt);
  }

  async getSupportTicketsForStaff(staffId: string, statuses?: string[]): Promise<SupportTicket[]> {
    if (!statuses || statuses.length === 0) {
      return db.select()
        .from(supportTickets)
        .where(eq(supportTickets.assignedTo, staffId));
    }

    return db.select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.assignedTo, staffId),
          sql`${supportTickets.status} = ANY(${statuses})`
        )
      );
  }

  async getStaffMetrics(staffId: string): Promise<StaffMetrics | undefined> {
    const [result] = await db.select()
      .from(staffMetrics)
      .where(eq(staffMetrics.staffId, staffId))
      .limit(1);
    return result;
  }

  async getAllStaffMetrics(): Promise<StaffMetrics[]> {
    return db.select().from(staffMetrics);
  }

  async createStaffMetrics(metrics: InsertStaffMetrics): Promise<StaffMetrics> {
    const [newMetrics] = await db.insert(staffMetrics)
      .values(metrics)
      .returning();
    return newMetrics;
  }

  async updateStaffMetrics(staffId: string, updates: Partial<InsertStaffMetrics>): Promise<StaffMetrics | undefined> {
    const [updated] = await db.update(staffMetrics)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(staffMetrics.staffId, staffId))
      .returning();
    return updated;
  }

  async createAdminAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [newLog] = await db.insert(adminAuditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAdminAuditLogs(filters: {
    staffId?: string;
    role?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number }> {
    let query = db.select().from(adminAuditLogs);

    if (filters.staffId) {
      query = query.where(eq(adminAuditLogs.actorStaffId, filters.staffId));
    }

    if (filters.role) {
      query = query.where(eq(adminAuditLogs.actorRole, filters.role));
    }

    if (filters.action) {
      query = query.where(eq(adminAuditLogs.action, filters.action));
    }

    if (filters.entityType) {
      query = query.where(eq(adminAuditLogs.entityType, filters.entityType));
    }

    if (filters.startDate) {
      // query = query.where(gte(adminAuditLogs.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      // query = query.where(lte(adminAuditLogs.createdAt, filters.endDate));
    }

    const logs = await query
      .orderBy(sql`${adminAuditLogs.createdAt} DESC`)
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return {
      logs,
      total: logs.length,
    };
  }

  async getTicketAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
    priority?: string;
  }): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResolutionTime: number;
    slaBreaches: number;
    byPriority: Record<string, number>;
  }> {
    const allTickets = await db.select().from(supportTickets);

    const openTickets = allTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const resolvedTickets = allTickets.filter(t => t.status === 'RESOLVED').length;

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    allTickets.forEach(ticket => {
      if (ticket.resolvedAt && ticket.createdAt) {
        const hours = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
        totalResolutionTime += hours;
        resolvedCount++;
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

    return {
      totalTickets: allTickets.length,
      openTickets,
      resolvedTickets,
      avgResolutionTime,
      slaBreaches: 0, // Would need SLA logic
      byPriority: {
        LOW: allTickets.filter(t => t.priority === 'LOW').length,
        MEDIUM: allTickets.filter(t => t.priority === 'MEDIUM').length,
        HIGH: allTickets.filter(t => t.priority === 'HIGH').length,
        URGENT: allTickets.filter(t => t.priority === 'URGENT').length,
      },
    };
  }

  async getCouponAnalytics(): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    expiredCoupons: number;
    totalRedemptions: number;
    redemptionRate: number;
    topCoupons: any[];
  }> {
    const allCoupons = await db.select().from(coupons);
    const now = new Date();

    const activeCoupons = allCoupons.filter(c => c.expiryDate > now).length;
    const expiredCoupons = allCoupons.filter(c => c.expiryDate <= now).length;

    const totalRedemptions = allCoupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
    const redemptionRate = allCoupons.length > 0
      ? (totalRedemptions / (allCoupons.length * 100)) * 100
      : 0;

    return {
      totalCoupons: allCoupons.length,
      activeCoupons,
      expiredCoupons,
      totalRedemptions,
      redemptionRate,
      topCoupons: allCoupons.slice(0, 5),
    };
  }

  async getRevenueAnalytics(filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalRevenue: number;
    activeSubscriptions: number;
    pendingPayments: number;
    mrr: number;
    mrg: number;
  }> {
    const allSubscriptions = await db.select().from(userSubscriptions);
    const allInvoices = await db.select().from(invoices);

    const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active').length;

    const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    return {
      totalRevenue,
      activeSubscriptions,
      pendingPayments: 0, // Would need payment status logic
      mrr: totalRevenue / 12, // Rough estimate
      mrg: 0, // Would need GST calculation
    };
  }

  // User Feature Usage & Overrides Implementation
  async getUserFeatureUsage(userId: string): Promise<any | undefined> {
    const { userFeatureUsage } = await import("@shared/schema");
    const [usage] = await db.select().from(userFeatureUsage).where(eq(userFeatureUsage.userId, userId));
    return usage;
  }

  async createUserFeatureUsage(usageData: any): Promise<any> {
    const { userFeatureUsage } = await import("@shared/schema");
    const [created] = await db.insert(userFeatureUsage).values(usageData).returning();
    return created;
  }

  async getUserFeatureOverride(userId: string): Promise<any | undefined> {
    const { userFeatureOverrides } = await import("@shared/schema");
    const [override] = await db.select().from(userFeatureOverrides).where(eq(userFeatureOverrides.userId, userId));
    return override;
  }

  async createUserFeatureOverride(overrideData: any): Promise<any> {
    const { userFeatureOverrides } = await import("@shared/schema");
    const [created] = await db.insert(userFeatureOverrides).values(overrideData).returning();
    return created;
  }

  async updateUserFeatureOverride(userId: string, updates: any): Promise<any | undefined> {
    const { userFeatureOverrides } = await import("@shared/schema");
    const [updated] = await db.update(userFeatureOverrides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userFeatureOverrides.userId, userId))
      .returning();
    return updated;
  }

  async incrementUserFeatureUsage(userId: string, feature: string, amount: number = 1): Promise<void> {
    const { userFeatureUsage } = await import("@shared/schema");
    
    // Get or create usage record
    let usage = await this.getUserFeatureUsage(userId);
    
    if (!usage) {
      usage = await this.createUserFeatureUsage({
        userId,
        emailProvidersCount: 0,
        customTemplatesCount: 0,
        quotesThisMonth: 0,
        partyProfilesCount: 0,
        apiCallsThisMonth: 0,
      });
    }

    // Increment the appropriate counter
    const updates: any = { updatedAt: new Date() };
    
    if (feature === 'emailProviders') {
      updates.emailProvidersCount = (usage.emailProvidersCount || 0) + amount;
    } else if (feature === 'customTemplates') {
      updates.customTemplatesCount = (usage.customTemplatesCount || 0) + amount;
    } else if (feature === 'quotes') {
      updates.quotesThisMonth = (usage.quotesThisMonth || 0) + amount;
    } else if (feature === 'partyProfiles') {
      updates.partyProfilesCount = (usage.partyProfilesCount || 0) + amount;
    } else if (feature === 'apiCalls') {
      updates.apiCallsThisMonth = (usage.apiCallsThisMonth || 0) + amount;
    }

    await db.update(userFeatureUsage)
      .set(updates)
      .where(eq(userFeatureUsage.userId, userId));
  }

  async decrementUserFeatureUsage(userId: string, feature: string, amount: number = 1): Promise<void> {
    const { userFeatureUsage } = await import("@shared/schema");
    
    const usage = await this.getUserFeatureUsage(userId);
    if (!usage) return;

    const updates: any = { updatedAt: new Date() };
    
    if (feature === 'emailProviders') {
      updates.emailProvidersCount = Math.max(0, (usage.emailProvidersCount || 0) - amount);
    } else if (feature === 'customTemplates') {
      updates.customTemplatesCount = Math.max(0, (usage.customTemplatesCount || 0) - amount);
    } else if (feature === 'quotes') {
      updates.quotesThisMonth = Math.max(0, (usage.quotesThisMonth || 0) - amount);
    } else if (feature === 'partyProfiles') {
      updates.partyProfilesCount = Math.max(0, (usage.partyProfilesCount || 0) - amount);
    } else if (feature === 'apiCalls') {
      updates.apiCallsThisMonth = Math.max(0, (usage.apiCallsThisMonth || 0) - amount);
    }

    await db.update(userFeatureUsage)
      .set(updates)
      .where(eq(userFeatureUsage.userId, userId));
  }

  async getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db.select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    return subscription;
  }

  async getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
    return await db.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt));
  }

  async getSubscriptionPlanById(planId: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId));
    return plan;
  }

  async getUserEmailProviders(userId: string): Promise<EmailProvider[]> {
    return await db.select()
      .from(emailProviders)
      .where(eq(emailProviders.userId, userId));
  }

  async getUserEmailProviderCount(userId: string): Promise<number> {
    const providers = await this.getUserEmailProviders(userId);
    return providers.length;
  }

  // Payment Gateway Management
  async getActivePaymentGateways(): Promise<PaymentGateway[]> {
    return await db.select()
      .from(paymentGateways)
      .where(eq(paymentGateways.isActive, true))
      .orderBy(paymentGateways.priority);
  }

  async getPaymentGateway(id: string): Promise<PaymentGateway | undefined> {
    const [gateway] = await db.select()
      .from(paymentGateways)
      .where(eq(paymentGateways.id, id));
    return gateway;
  }

  async getPaymentGatewayByType(gatewayType: string): Promise<PaymentGateway | undefined> {
    const [gateway] = await db.select()
      .from(paymentGateways)
      .where(eq(paymentGateways.gatewayType, gatewayType));
    return gateway;
  }

  async updatePaymentGatewayHealth(
    id: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const gateway = await this.getPaymentGateway(id);
    if (!gateway) return;

    const updates: any = {
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    };

    if (success) {
      updates.consecutiveFailures = 0;
      updates.totalTransactions = (gateway.totalTransactions || 0) + 1;
      updates.totalSuccessful = (gateway.totalSuccessful || 0) + 1;
    } else {
      updates.consecutiveFailures = (gateway.consecutiveFailures || 0) + 1;
      updates.lastFailureAt = new Date();
      updates.lastFailureReason = errorMessage || 'Unknown error';
      updates.totalTransactions = (gateway.totalTransactions || 0) + 1;
      updates.totalFailed = (gateway.totalFailed || 0) + 1;
    }

    await db.update(paymentGateways)
      .set(updates)
      .where(eq(paymentGateways.id, id));
  }

  async updatePaymentGatewayCredentials(
    id: string,
    credentials: any,
    webhookSecret?: string
  ): Promise<PaymentGateway | undefined> {
    const updates: any = {
      credentials,
      updatedAt: new Date(),
    };

    if (webhookSecret !== undefined) {
      updates.webhookSecret = webhookSecret;
    }

    const [updatedGateway] = await db.update(paymentGateways)
      .set(updates)
      .where(eq(paymentGateways.id, id))
      .returning();

    return updatedGateway;
  }

  // ========== INVOICE TEMPLATE OPERATIONS ==========

  async getInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return await db.select().from(invoiceTemplates).orderBy(desc(invoiceTemplates.isDefault), invoiceTemplates.name);
  }

  async getActiveInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.status, 'active'))
      .orderBy(desc(invoiceTemplates.isDefault), invoiceTemplates.name);
  }

  async getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .limit(1);
    return template;
  }

  async getInvoiceTemplateByKey(templateKey: string): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.templateKey, templateKey))
      .limit(1);
    return template;
  }

  async getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select()
      .from(invoiceTemplates)
      .where(and(
        eq(invoiceTemplates.isDefault, true),
        eq(invoiceTemplates.status, 'active')
      ))
      .limit(1);
    return template;
  }

  async createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate> {
    // Generate a template key from the name if not provided
    const templateKey = template.templateKey || template.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const [created] = await db.insert(invoiceTemplates)
      .values({
        ...template,
        templateKey,
        status: template.status || 'active',
        isDefault: template.isDefault || false,
      })
      .returning();
    return created;
  }

  async updateInvoiceTemplate(id: string, updates: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined> {
    const [updated] = await db.update(invoiceTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(invoiceTemplates.id, id))
      .returning();
    return updated;
  }

  async updateQuoteWithPDF(
    quoteId: string,
    templateId: string,
    pdfPath: string
  ): Promise<Quote | undefined> {
    const [updatedQuote] = await db.update(quotes)
      .set({
        invoiceTemplateId: templateId,
        pdfPath: pdfPath,
        pdfGeneratedAt: new Date(),
        isPdfGenerated: true,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId))
      .returning();
    return updatedQuote;
  }
}

// In-memory storage for local development without database
class InMemoryStorage implements Partial<IStorage> {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email.toLowerCase());
  }

  async getUserByClerkId(clerkUserId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.clerkUserId === clerkUserId);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = userData.email ? await this.getUserByEmail(userData.email) : undefined;

    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existingUser.id, updatedUser);
      if (updatedUser.email) {
        this.usersByEmail.set(updatedUser.email.toLowerCase(), updatedUser);
      }
      return updatedUser;
    }

    // Create new user
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: userData.email || '',
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      role: userData.role || 'user',
      companyName: userData.companyName || null,
      gstNumber: userData.gstNumber || null,
      address: userData.address || null,
      phone: userData.phone || null,
      logoUrl: userData.logoUrl || null,
      profileImageUrl: userData.profileImageUrl || null,
      emailVerified: userData.emailVerified || false,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      isSuspended: userData.isSuspended || false,
      suspensionReason: userData.suspensionReason || null,
      failedLoginAttempts: userData.failedLoginAttempts || 0,
      lockedUntil: userData.lockedUntil || null,
      lastLoginAt: userData.lastLoginAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(newUser.id, newUser);
    if (newUser.email) {
      this.usersByEmail.set(newUser.email.toLowerCase(), newUser);
    }

    console.log(`[InMemoryStorage] Created user: ${newUser.email} (${newUser.id})`);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    if (updatedUser.email) {
      this.usersByEmail.set(updatedUser.email.toLowerCase(), updatedUser);
    }

    return updatedUser;
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: profile.userId,
      onboardingCompleted: profile.onboardingCompleted || false,
      onboardingStep: profile.onboardingStep || null,
      onboardingData: profile.onboardingData || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.userProfiles.set(profile.userId, newProfile);
    console.log(`[InMemoryStorage] Created user profile for: ${profile.userId}`);
    return newProfile;
  }

  async updateUserProfile(userId: string, updates: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const profile = this.userProfiles.get(userId);
    if (!profile) return undefined;

    const updatedProfile: UserProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date(),
    };

    this.userProfiles.set(userId, updatedProfile);
    return updatedProfile;
  }

  // Payment Gateway Management - In-memory stub
  async getActivePaymentGateways(): Promise<PaymentGateway[]> {
    return [];
  }

  async getPaymentGateway(id: string): Promise<PaymentGateway | undefined> {
    return undefined;
  }

  async getPaymentGatewayByType(gatewayType: string): Promise<PaymentGateway | undefined> {
    return undefined;
  }

  async updatePaymentGatewayHealth(
    id: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // No-op for in-memory storage
  }

  async updatePaymentGatewayCredentials(
    id: string,
    credentials: any,
    webhookSecret?: string
  ): Promise<PaymentGateway | undefined> {
    return undefined;
  }

  // Invoice Template operations (stubs for in-memory mode)
  async getInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return [];
  }

  async getActiveInvoiceTemplates(): Promise<InvoiceTemplate[]> {
    return [];
  }

  async getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined> {
    return undefined;
  }

  async getInvoiceTemplateByKey(templateKey: string): Promise<InvoiceTemplate | undefined> {
    return undefined;
  }

  async getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | undefined> {
    return undefined;
  }

  async updateQuoteWithPDF(
    quoteId: string,
    templateId: string,
    pdfPath: string
  ): Promise<Quote | undefined> {
    return undefined;
  }
}

// Export the appropriate storage based on database availability
import { isDbAvailable } from './db';
export const storage: IStorage = isDbAvailable
  ? new DatabaseStorage()
  : new InMemoryStorage() as IStorage;

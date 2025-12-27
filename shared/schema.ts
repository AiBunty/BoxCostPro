import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, boolean, jsonb, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========== MULTI-TENANT INFRASTRUCTURE ==========

// Tenants (Companies) - Each organization is a tenant
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull(),
  ownerUserId: varchar("owner_user_id"), // FK added after users table defined
  slug: varchar("slug").unique(), // URL-friendly identifier
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Tenant user roles
export const tenantUserRole = z.enum(['owner', 'admin', 'staff', 'viewer']);
export type TenantUserRole = z.infer<typeof tenantUserRole>;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User account status enum
export const userAccountStatus = z.enum(['new_user', 'email_verified', 'mobile_verified', 'fully_verified', 'suspended', 'deleted']);
export type UserAccountStatus = z.infer<typeof userAccountStatus>;

// User storage table for Supabase Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supabaseUserId: varchar("supabase_user_id").unique(), // Optional: external provider user ID (kept for legacy compatibility)
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // 'user', 'support_agent', 'support_manager', 'admin', 'super_admin'
  subscriptionStatus: varchar("subscription_status").default("trial"), // 'trial', 'active', 'expired', 'cancelled'
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  mobileNo: varchar("mobile_no"), // User's mobile number
  countryCode: varchar("country_code").default("+91"), // Country code for mobile
  companyName: varchar("company_name"), // User's company name
  authProvider: varchar("auth_provider").default("google_direct"), // 'google_direct', 'supabase'(legacy), 'email_password', 'magic_link'
  signupMethod: varchar("signup_method"), // 'email_otp', 'email_password', 'magic_link', 'google', 'microsoft', 'linkedin', 'apple'
  emailVerified: boolean("email_verified").default(false), // Email verification status
  mobileVerified: boolean("mobile_verified").default(false), // Mobile verification status
  accountStatus: varchar("account_status").default("new_user"), // 'new_user', 'email_verified', 'mobile_verified', 'fully_verified', 'suspended', 'deleted'
  lastLoginAt: timestamp("last_login_at"), // Last successful login
  passwordResetRequired: boolean("password_reset_required").default(false), // Force password reset
  failedLoginAttempts: integer("failed_login_attempts").default(0), // Track failed logins for rate limiting
  lockedUntil: timestamp("locked_until"), // Account lock time after too many failures
});

// User Profile for tracking onboarding/setup progress
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  paperSetupDone: boolean("paper_setup_done").default(false), // Paper pricing setup completed
  termsSetupDone: boolean("terms_setup_done").default(false), // Quote terms setup completed
  onboardingCompleted: boolean("onboarding_completed").default(false), // Full onboarding finished
  preferredCurrency: varchar("preferred_currency").default("INR"),
  timezone: varchar("timezone").default("Asia/Kolkata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// Email Provider enum for user email settings
export const emailProviderEnum = z.enum(['gmail', 'google_oauth', 'outlook', 'yahoo', 'zoho', 'titan', 'custom']);
export type EmailProvider = z.infer<typeof emailProviderEnum>;

// User Email Settings - allows users to send emails from their own email address
export const userEmailSettings = pgTable("user_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  provider: varchar("provider").notNull(), // 'gmail', 'google_oauth', 'outlook', 'yahoo', 'zoho', 'titan', 'custom'
  emailAddress: varchar("email_address").notNull(),
  // SMTP Configuration
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").default(false), // TLS/SSL
  smtpUsername: varchar("smtp_username"),
  smtpPasswordEncrypted: text("smtp_password_encrypted"), // Encrypted password
  // OAuth Configuration (Google)
  oauthProvider: varchar("oauth_provider"), // 'google' | null
  oauthAccessTokenEncrypted: text("oauth_access_token_encrypted"),
  oauthRefreshTokenEncrypted: text("oauth_refresh_token_encrypted"),
  oauthTokenExpiresAt: timestamp("oauth_token_expires_at"),
  // Status
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserEmailSettingsSchema = createInsertSchema(userEmailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserEmailSettings = z.infer<typeof insertUserEmailSettingsSchema>;
export type UserEmailSettings = typeof userEmailSettings.$inferSelect;

// Email Logs - Track every email attempt for analytics (per tenant)
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  senderEmail: varchar("sender_email").notNull(),
  provider: varchar("provider").notNull(), // 'smtp', 'google-oauth', 'ses'
  subject: varchar("subject").notNull(),
  channel: varchar("channel").notNull(), // 'quote', 'followup', 'system', 'confirmation'
  status: varchar("status").notNull().default("sent"), // 'sent', 'delivered', 'bounced', 'failed'
  failureReason: text("failure_reason"),
  messageId: varchar("message_id"), // Provider reference
  quoteId: varchar("quote_id"), // Optional reference to quote
  sentAt: timestamp("sent_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_logs_user").on(table.userId),
  index("idx_email_logs_status").on(table.status),
  index("idx_email_logs_sent_at").on(table.sentAt),
]);

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, sentAt: true, updatedAt: true });
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

// Email Bounces - Track hard and soft bounces
export const emailBounces = pgTable("email_bounces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailLogId: varchar("email_log_id").references(() => emailLogs.id).notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  bounceType: varchar("bounce_type").notNull(), // 'hard', 'soft'
  bounceReason: text("bounce_reason"),
  provider: varchar("provider").notNull(),
  occurredAt: timestamp("occurred_at").defaultNow(),
}, (table) => [
  index("idx_email_bounces_recipient").on(table.recipientEmail),
  index("idx_email_bounces_type").on(table.bounceType),
]);

export const insertEmailBounceSchema = createInsertSchema(emailBounces).omit({ id: true, occurredAt: true });
export type InsertEmailBounce = z.infer<typeof insertEmailBounceSchema>;
export type EmailBounce = typeof emailBounces.$inferSelect;

// Auth Audit Logs - Track all authentication events
export const authAuditLogs = pgTable("auth_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Can be null for failed login attempts
  email: varchar("email"), // Email used in the attempt
  action: varchar("action").notNull(), // 'LOGIN', 'SIGNUP', 'LOGOUT', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'VERIFY_EMAIL', 'VERIFY_MOBILE', 'ACCOUNT_LOCKED', 'FAILED_LOGIN'
  status: varchar("status").notNull().default("success"), // 'success', 'failed'
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default('{}'), // Additional context (provider, device info, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_user").on(table.userId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_created").on(table.createdAt),
]);

export const insertAuthAuditLogSchema = createInsertSchema(authAuditLogs).omit({ id: true, createdAt: true });
export type InsertAuthAuditLog = z.infer<typeof insertAuthAuditLogSchema>;
export type AuthAuditLog = typeof authAuditLogs.$inferSelect;

// Subscription Plans (managed by owner)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: real("price_monthly").notNull(),
  priceYearly: real("price_yearly"),
  features: jsonb("features").default('[]'),
  isActive: boolean("is_active").default(true),
  trialDays: integer("trial_days").default(14),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// User Subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  planId: varchar("plan_id").references(() => subscriptionPlans.id),
  status: varchar("status").default("active"), // 'active', 'cancelled', 'expired', 'paused'
  billingCycle: varchar("billing_cycle").default("monthly"), // 'monthly', 'yearly'
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  razorpaySubscriptionId: varchar("razorpay_subscription_id"),
  razorpayCustomerId: varchar("razorpay_customer_id"),
  couponApplied: varchar("coupon_applied"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Coupons
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique().notNull(),
  discountType: varchar("discount_type").default("percentage"), // 'percentage', 'fixed'
  discountValue: real("discount_value").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usedCount: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

// Trial Invites
export const trialInvites = pgTable("trial_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyName: text("company_name"),
  inviteToken: varchar("invite_token").unique().notNull(),
  trialDays: integer("trial_days").default(14),
  status: varchar("status").default("pending"), // 'pending', 'accepted', 'expired'
  sentAt: timestamp("sent_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
});

export const insertTrialInviteSchema = createInsertSchema(trialInvites).omit({ id: true, sentAt: true, inviteToken: true });
export type InsertTrialInvite = z.infer<typeof insertTrialInviteSchema>;
export type TrialInvite = typeof trialInvites.$inferSelect;

// Payment Transactions (Razorpay)
export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  subscriptionId: varchar("subscription_id").references(() => userSubscriptions.id),
  razorpayOrderId: varchar("razorpay_order_id"),
  razorpayPaymentId: varchar("razorpay_payment_id"),
  razorpaySignature: varchar("razorpay_signature"),
  amount: real("amount").notNull(),
  currency: varchar("currency").default("INR"),
  status: varchar("status").default("pending"), // 'pending', 'success', 'failed', 'refunded'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true });
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

// Flute Settings (per tenant - technical constants for board costing)
// Each flute type has a fluting factor (paper weight multiplier) and height (for board thickness)
export const fluteSettings = pgTable("flute_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Optional during migration
  userId: varchar("user_id").references(() => users.id), // Creator
  fluteType: varchar("flute_type").notNull(), // 'A', 'B', 'C', 'E', 'F'
  flutingFactor: real("fluting_factor").notNull(), // Multiplier for paper weight calculation
  fluteHeightMm: real("flute_height_mm").notNull(), // Flute height in mm for board thickness
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFluteSettingSchema = createInsertSchema(fluteSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFluteSetting = z.infer<typeof insertFluteSettingSchema>;
export type FluteSetting = typeof fluteSettings.$inferSelect;

// Legacy flutingSettings table (deprecated - use fluteSettings instead)
export const flutingSettings = pgTable("fluting_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  fluteType: varchar("flute_type").notNull(),
  flutingFactor: real("fluting_factor").notNull(),
  fluteHeight: real("flute_height"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlutingSettingSchema = createInsertSchema(flutingSettings).omit({ id: true, createdAt: true });
export type InsertFlutingSetting = z.infer<typeof insertFlutingSettingSchema>;
export type FlutingSetting = typeof flutingSettings.$inferSelect;

// Chatbot Widgets (for embedding on customer websites - per tenant)
export const chatbotWidgets = pgTable("chatbot_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  widgetName: text("widget_name").notNull(),
  apiToken: varchar("api_token").unique().notNull(),
  allowedDomains: jsonb("allowed_domains").default('[]'), // domains where widget can be embedded
  customStyles: jsonb("custom_styles").default('{}'),
  welcomeMessage: text("welcome_message").default("Hello! How can I help you with box costing today?"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatbotWidgetSchema = createInsertSchema(chatbotWidgets).omit({ id: true, createdAt: true, apiToken: true });
export type InsertChatbotWidget = z.infer<typeof insertChatbotWidgetSchema>;
export type ChatbotWidget = typeof chatbotWidgets.$inferSelect;

// Owner Settings (global app configuration)
export const ownerSettings = pgTable("owner_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  razorpayKeyId: text("razorpay_key_id"),
  razorpayKeySecret: text("razorpay_key_secret"),
  defaultTrialDays: integer("default_trial_days").default(14),
  emailFromAddress: text("email_from_address"),
  emailFromName: text("email_from_name"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ========== TENANT USER MAPPING ==========

// Tenant Users - maps users to tenants with roles
export const tenantUsers = pgTable("tenant_users", {
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").notNull().default("staff"), // 'owner', 'admin', 'staff', 'viewer'
  isActive: boolean("is_active").default(true),
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.userId] }),
  index("idx_tenant_users_tenant").on(table.tenantId),
  index("idx_tenant_users_user").on(table.userId),
]);

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({ createdAt: true, joinedAt: true });
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

// Company Profiles (per tenant) - SINGLE SOURCE OF TRUTH for business identity & branding
// Calculator and other modules MUST read from here and NEVER edit directly
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  // Core identity fields (locked after registration, require verification to edit)
  companyName: text("company_name").notNull(),
  ownerName: text("owner_name"), // Owner/Contact person name for templates
  email: text("email"),
  phone: text("phone"),
  verified: boolean("verified").default(false), // Email verified for profile edits
  // Editable business details
  gstNo: text("gst_no"),
  address: text("address"),
  website: text("website"),
  mapLink: text("map_link"), // Google Maps link for templates
  socialMedia: text("social_media"),
  googleLocation: text("google_location"),
  // Quote defaults
  paymentTerms: text("payment_terms").default("100% Advance"),
  deliveryTime: text("delivery_time").default("10 days after receipt of PO"),
  isDefault: boolean("is_default").default(false),
  // Branding
  logoUrl: text("logo_url"), // Company logo for quote signatures
  logoSizeKb: integer("logo_size_kb"), // Track logo file size (max 100KB enforced)
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyProfile = typeof companyProfiles.$inferSelect;

// Party/Customer Profiles (per tenant)
export const partyProfiles = pgTable("party_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  personName: text("person_name").notNull(),
  designation: text("designation"),
  companyName: text("company_name"),
  mobileNo: text("mobile_no"),
  email: text("email"),
  gstNo: text("gst_no"),
  address: text("address"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertPartyProfileSchema = createInsertSchema(partyProfiles).omit({ id: true, createdAt: true });
export type InsertPartyProfile = z.infer<typeof insertPartyProfileSchema>;
export type PartyProfile = typeof partyProfiles.$inferSelect;

// Quotes master table - stores quote header, points to active version (per tenant)
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  quoteNo: varchar("quote_no").notNull(), // User-visible quote number (stays constant across versions)
  partyId: varchar("party_id").references(() => partyProfiles.id),
  partyName: text("party_name").notNull(),
  customerCompany: text("customer_company"),
  customerEmail: text("customer_email"),
  customerMobile: text("customer_mobile"),
  companyProfileId: varchar("company_profile_id"),
  activeVersionId: varchar("active_version_id"), // Points to current quote_versions record
  totalValue: real("total_value").default(0), // Cached total from active version for quick reporting
  status: varchar("status").default("draft"), // 'draft', 'sent', 'accepted', 'rejected', 'expired'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// Quote versions - every edit creates a new version, negotiation locks a version
export const quoteVersions = pgTable("quote_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  versionNo: integer("version_no").notNull().default(1),
  
  // Quote details
  paymentTerms: text("payment_terms"),
  deliveryDays: text("delivery_days"),
  transportCharge: real("transport_charge"),
  transportRemark: text("transport_remark"),
  moqEnabled: boolean("moq_enabled").default(false),
  moqValue: real("moq_value"),
  paymentType: varchar("payment_type").default("advance"),
  advancePercent: integer("advance_percent"),
  creditDays: integer("credit_days"),
  customDeliveryText: text("custom_delivery_text"),
  validUntil: timestamp("valid_until"),
  
  // Pricing
  subtotal: real("subtotal").notNull(),
  gstPercent: real("gst_percent").notNull(),
  gstAmount: real("gst_amount").notNull(),
  roundOffEnabled: boolean("round_off_enabled").default(false), // Snapshot of setting at quote creation
  roundOffValue: real("round_off_value").default(0), // Difference from rounding (can be +/-)
  finalTotal: real("final_total").notNull(),
  
  // Negotiation fields
  isNegotiated: boolean("is_negotiated").default(false),
  negotiationType: varchar("negotiation_type"), // 'flat', 'percentage', null
  negotiationValue: real("negotiation_value"),
  isLocked: boolean("is_locked").default(false), // Once negotiated, version is locked
  isArchived: boolean("is_archived").default(false), // True when a newer version exists
  
  // Snapshotted master data (captured at quote creation - CRITICAL)
  partySnapshot: jsonb("party_snapshot"), // Party details snapshot at quote creation time
  thicknessSource: varchar("thickness_source").default("auto"), // 'auto' or 'manual' - tracks if user overrode calculated thickness
  boardThicknessMm: real("board_thickness_mm"),
  fluteFactorA: real("flute_factor_a"),
  fluteFactorB: real("flute_factor_b"),
  fluteFactorC: real("flute_factor_c"),
  fluteFactorE: real("flute_factor_e"),
  fluteFactorF: real("flute_factor_f"),
  fluteHeightA: real("flute_height_a"),
  fluteHeightB: real("flute_height_b"),
  fluteHeightC: real("flute_height_c"),
  fluteHeightE: real("flute_height_e"),
  fluteHeightF: real("flute_height_f"),
  
  // Legacy snapshot fields (for backward compatibility)
  termsSnapshot: jsonb("terms_snapshot"),
  paperPricesSnapshot: jsonb("paper_prices_snapshot"),
  transportSnapshot: jsonb("transport_snapshot"),
  
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertQuoteVersionSchema = createInsertSchema(quoteVersions).omit({ id: true, createdAt: true });
export type InsertQuoteVersion = z.infer<typeof insertQuoteVersionSchema>;
export type QuoteVersion = typeof quoteVersions.$inferSelect;

// Quote item versions - stores items for each quote version
export const quoteItemVersions = pgTable("quote_item_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").references(() => quoteVersions.id).notNull(),
  itemIndex: integer("item_index").notNull(), // Order of item in quote
  
  // Item details
  itemType: varchar("item_type").notNull(), // 'rsc', 'sheet'
  boxName: text("box_name").notNull(),
  boxDescription: text("box_description"),
  ply: varchar("ply").notNull(),
  length: real("length").notNull(),
  width: real("width").notNull(),
  height: real("height"),
  quantity: integer("quantity").notNull(),
  
  // Calculated dimensions
  sheetLength: real("sheet_length"),
  sheetWidth: real("sheet_width"),
  sheetWeight: real("sheet_weight"),
  
  // Pricing (per box)
  originalCostPerBox: real("original_cost_per_box").notNull(), // Calculated cost before negotiation
  negotiatedCostPerBox: real("negotiated_cost_per_box"), // Negotiated price (null if not negotiated)
  finalCostPerBox: real("final_cost_per_box").notNull(), // Final price (negotiated if exists, else original)
  
  // Total pricing
  originalTotalCost: real("original_total_cost").notNull(),
  negotiatedTotalCost: real("negotiated_total_cost"),
  finalTotalCost: real("final_total_cost").notNull(),
  
  // Full item data snapshot (for detailed breakdowns)
  itemDataSnapshot: jsonb("item_data_snapshot").notNull(), // Complete QuoteItem data
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteItemVersionSchema = createInsertSchema(quoteItemVersions).omit({ id: true, createdAt: true });
export type InsertQuoteItemVersion = z.infer<typeof insertQuoteItemVersionSchema>;
export type QuoteItemVersion = typeof quoteItemVersions.$inferSelect;

// Business Defaults - stores tenant's default GST% and tax settings
export const businessDefaults = pgTable("business_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).unique(),
  userId: varchar("user_id").references(() => users.id), // Creator
  defaultGstPercent: real("default_gst_percent").notNull().default(5), // India GST for Corrugated Boxes
  gstRegistered: boolean("gst_registered").default(true),
  gstNumber: varchar("gst_number"),
  igstApplicable: boolean("igst_applicable").default(false),
  roundOffEnabled: boolean("round_off_enabled").default(true), // Round grand total to nearest rupee
  // Show Columns configuration for WhatsApp/Email templates (single source of truth)
  showColumnBoxSize: boolean("show_column_box_size").default(true),
  showColumnBoard: boolean("show_column_board").default(true),
  showColumnFlute: boolean("show_column_flute").default(true),
  showColumnPaper: boolean("show_column_paper").default(true),
  showColumnPrinting: boolean("show_column_printing").default(false),
  showColumnLamination: boolean("show_column_lamination").default(false),
  showColumnVarnish: boolean("show_column_varnish").default(true),
  showColumnWeight: boolean("show_column_weight").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessDefaultsSchema = createInsertSchema(businessDefaults).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessDefaults = z.infer<typeof insertBusinessDefaultsSchema>;
export type BusinessDefaults = typeof businessDefaults.$inferSelect;

// App Settings (per tenant)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  appTitle: text("app_title").default("Box Costing Calculator"),
  plyThicknessMap: jsonb("ply_thickness_map").default(JSON.stringify({
    '1': 0.45,
    '3': 2.5,
    '5': 3.5,
    '7': 5.5,
    '9': 6.5,
  })),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({ id: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

// Rate Memory for Paper (BF + Shade combinations) - per tenant
export const rateMemory = pgTable("rate_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  bfValue: text("bf_value").notNull(),
  shade: text("shade").notNull(),
  rate: real("rate").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertRateMemorySchema = createInsertSchema(rateMemory).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRateMemory = z.infer<typeof insertRateMemorySchema>;
export type RateMemoryEntry = typeof rateMemory.$inferSelect;

// Zod schemas for nested data structures
export const layerSpecSchema = z.object({
  layerIndex: z.number(),
  layerType: z.enum(['liner', 'flute']),
  gsm: z.number(),
  bf: z.number().optional(),
  flutingFactor: z.number().optional(),
  rctValue: z.number().optional(),
  shade: z.string(),
  rate: z.number(), // The actual rate used in calculations (either calculated or manual)
  
  // Paper pricing linkage fields
  calculatedRate: z.number().optional(), // Auto-calculated rate from Paper Price Settings
  priceOverride: z.boolean().default(false), // If true, manual rate is used instead of calculated
  manualRate: z.number().optional(), // User-entered manual rate (only used when priceOverride=true)
  
  // Price breakdown for transparency (snapshot from calculation)
  priceBreakdown: z.object({
    bfBasePrice: z.number(),
    gsmAdjustment: z.number(),
    shadePremium: z.number(),
    marketAdjustment: z.number(),
  }).optional(),
});

export const quoteItemSchema = z.object({
  type: z.enum(['rsc', 'sheet']),
  boxName: z.string(),
  boxDescription: z.string().optional(),
  ply: z.enum(['1', '3', '5', '7', '9']),
  
  inputUnit: z.enum(['mm', 'inches']).default('mm'),
  measuredOn: z.enum(['ID', 'OD']).default('ID'),
  plyThicknessUsed: z.number().optional(),
  
  length: z.number(),
  width: z.number(),
  height: z.number().optional(),
  
  glueFlap: z.number().optional(),
  deckleAllowance: z.number().optional(),
  sheetAllowance: z.number().optional(),
  maxLengthThreshold: z.number().optional(),
  additionalFlapApplied: z.boolean().default(false),
  
  sheetLength: z.number(),
  sheetWidth: z.number(),
  sheetLengthInches: z.number(),
  sheetWidthInches: z.number(),
  sheetWeight: z.number(),
  
  boardThickness: z.number(),
  thicknessSource: z.enum(['calculated', 'manual']).optional().default('calculated'),
  boxPerimeter: z.number(),
  ect: z.number(),
  bct: z.number(),
  bs: z.number(),
  
  layerSpecs: z.array(layerSpecSchema),
  
  paperCost: z.number(),
  printingCost: z.number().default(0),
  laminationCost: z.number().default(0),
  varnishCost: z.number().default(0),
  dieCost: z.number().default(0),
  punchingCost: z.number().default(0),
  totalCostPerBox: z.number(),
  quantity: z.number(),
  totalValue: z.number(),
  
  // Printing details (for quote display and messages)
  printingEnabled: z.boolean().optional().default(false),
  printType: z.string().optional(), // 'Flexo', 'Offset', 'Screen', etc.
  printColours: z.number().optional(), // Number of colours
  
  // Negotiation fields
  negotiationMode: z.enum(['none', 'percentage', 'fixed']).optional().default('none'),
  negotiationValue: z.number().optional(), // Discount percentage or fixed price
  originalPrice: z.number().optional(), // Original calculated price before negotiation
  negotiatedPrice: z.number().optional(), // Final negotiated price per box
  negotiationNote: z.string().optional(), // Optional note about negotiation
  
  // Box specification versioning
  boxSpecId: z.string().optional(), // Link to box_specifications table
  boxSpecVersionNumber: z.number().optional(), // Version at time of quote
  
  // Selection for sending via WhatsApp/Email
  selected: z.boolean().default(true),
  
  // Visibility controls for quote generation (what details to show)
  showPaperSpec: z.boolean().default(true), // Show paper specifications in quote
  showPrinting: z.boolean().default(true), // Show printing details in quote
  showBS: z.boolean().default(true), // Show Burst Strength in quote
  showCS: z.boolean().default(true), // Show Compression Strength (BCT) in quote
  showWeight: z.boolean().default(true), // Show box weight in quote
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type LayerSpec = z.infer<typeof layerSpecSchema>;

// ========== PAPER SHADES MASTER TABLE (SINGLE SOURCE OF TRUTH) ==========
// This is the canonical reference for all shade names and abbreviations
// Abbreviations are used in paper spec generation: e.g., "Kra120/32"

export const paperShades = pgTable("paper_shades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shadeName: varchar("shade_name", { length: 100 }).notNull().unique(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
  description: text("description"),
  isFluting: boolean("is_fluting").default(false),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaperShadeSchema = createInsertSchema(paperShades).omit({ id: true, createdAt: true });
export type InsertPaperShade = z.infer<typeof insertPaperShadeSchema>;
export type PaperShade = typeof paperShades.$inferSelect;

// Default shades with canonical abbreviations (seeded on first run)
export const DEFAULT_PAPER_SHADES = [
  { shadeName: "Kraft/Natural", abbreviation: "Kra", description: "Standard kraft paper", isFluting: false, sortOrder: 1 },
  { shadeName: "Testliner", abbreviation: "TL", description: "Recycled testliner", isFluting: false, sortOrder: 2 },
  { shadeName: "Virgin Kraft Liner", abbreviation: "VKL", description: "Premium virgin kraft liner", isFluting: false, sortOrder: 3 },
  { shadeName: "White Kraft Liner", abbreviation: "WKL", description: "White coated kraft liner", isFluting: false, sortOrder: 4 },
  { shadeName: "White Top Testliner", abbreviation: "WTT", description: "White top coated testliner", isFluting: false, sortOrder: 5 },
  { shadeName: "Duplex Grey Back (LWC)", abbreviation: "LWC", description: "Light weight coated duplex", isFluting: false, sortOrder: 6 },
  { shadeName: "Duplex Grey Back (HWC)", abbreviation: "HWC", description: "Heavy weight coated duplex", isFluting: false, sortOrder: 7 },
  { shadeName: "Semi Chemical Fluting", abbreviation: "SCF", description: "Semi chemical fluting medium", isFluting: true, sortOrder: 8 },
  { shadeName: "Recycled Fluting", abbreviation: "RF", description: "Recycled fluting medium", isFluting: true, sortOrder: 9 },
  { shadeName: "Bagasse (Agro based)", abbreviation: "BAG", description: "Agricultural waste based paper", isFluting: false, sortOrder: 10 },
  { shadeName: "Golden Kraft", abbreviation: "GOL", description: "Premium golden kraft paper", isFluting: false, sortOrder: 11 },
] as const;

// ========== PAPER PRICE SETUP (per user) ==========

// Legacy Paper Prices table (deprecated - use paper_bf_prices instead)
export const paperPrices = pgTable("paper_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  gsm: integer("gsm").notNull(),
  bf: integer("bf").notNull(),
  shade: varchar("shade").notNull(),
  basePrice: real("base_price").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaperPriceSchema = createInsertSchema(paperPrices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaperPrice = z.infer<typeof insertPaperPriceSchema>;
export type PaperPrice = typeof paperPrices.$inferSelect;

// BF-Based Paper Prices - Base price defined ONLY by BF (Bursting Factor) - per tenant
export const paperBfPrices = pgTable("paper_bf_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  bf: integer("bf").notNull(), // Bursting Factor (e.g., 18, 20, 22, 25)
  basePrice: real("base_price").notNull(), // Base price per Kg for this BF
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaperBfPriceSchema = createInsertSchema(paperBfPrices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaperBfPrice = z.infer<typeof insertPaperBfPriceSchema>;
export type PaperBfPrice = typeof paperBfPrices.$inferSelect;

// Shade Premiums - Tenant-defined premium for paper shades (e.g., Golden)
export const shadePremiums = pgTable("shade_premiums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  shade: varchar("shade").notNull(), // 'Golden', 'White', 'Kraft', etc.
  premium: real("premium").notNull().default(0), // Premium amount to add per Kg
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShadePremiumSchema = createInsertSchema(shadePremiums).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShadePremium = z.infer<typeof insertShadePremiumSchema>;
export type ShadePremium = typeof shadePremiums.$inferSelect;

// Paper Pricing Rules table - stores tenant's GSM adjustment rules and market adjustment
export const paperPricingRules = pgTable("paper_pricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).unique(),
  userId: varchar("user_id").references(() => users.id), // Creator // One rule set per user
  lowGsmLimit: integer("low_gsm_limit").default(101), // GSM <= this gets low adjustment
  lowGsmAdjustment: real("low_gsm_adjustment").default(1), // Amount to add for low GSM
  highGsmLimit: integer("high_gsm_limit").default(201), // GSM >= this gets high adjustment
  highGsmAdjustment: real("high_gsm_adjustment").default(1), // Amount to add for high GSM
  marketAdjustment: real("market_adjustment").default(0), // Global adjustment for all prices
  paperSetupCompleted: boolean("paper_setup_completed").default(false), // Flag for setup completion
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaperPricingRulesSchema = createInsertSchema(paperPricingRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaperPricingRules = z.infer<typeof insertPaperPricingRulesSchema>;
export type PaperPricingRules = typeof paperPricingRules.$inferSelect;

// ========== USER QUOTE TERMS (per user defaults) ==========

export const userQuoteTerms = pgTable("user_quote_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).unique(),
  userId: varchar("user_id").references(() => users.id), // Creator
  validityDays: integer("validity_days").default(7),
  defaultDeliveryText: text("default_delivery_text").default("10-15 working days after order confirmation and advance payment"),
  defaultPaymentType: varchar("default_payment_type").default("advance"), // 'advance', 'credit'
  defaultCreditDays: integer("default_credit_days"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserQuoteTermsSchema = createInsertSchema(userQuoteTerms).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserQuoteTerms = z.infer<typeof insertUserQuoteTermsSchema>;
export type UserQuoteTerms = typeof userQuoteTerms.$inferSelect;

// ========== BOX SPECIFICATIONS (Master + Versioning) ==========

// Master table for unique box specifications (per tenant)
export const boxSpecifications = pgTable("box_specifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // Creator
  customerId: varchar("customer_id").references(() => partyProfiles.id),
  boxType: varchar("box_type").notNull(), // 'rsc', 'sheet'
  length: real("length").notNull(),
  breadth: real("breadth").notNull(),
  height: real("height"),
  ply: varchar("ply").notNull(), // '3', '5', '7', '9'
  currentVersion: integer("current_version").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBoxSpecificationSchema = createInsertSchema(boxSpecifications).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoxSpecification = z.infer<typeof insertBoxSpecificationSchema>;
export type BoxSpecification = typeof boxSpecifications.$inferSelect;

// Version history table for box specifications
export const boxSpecVersions = pgTable("box_spec_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  specId: varchar("spec_id").references(() => boxSpecifications.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  dataSnapshot: jsonb("data_snapshot").notNull(), // Full snapshot of all spec data
  editedBy: varchar("edited_by").references(() => users.id),
  editedAt: timestamp("edited_at").defaultNow(),
  changeNote: text("change_note"),
});

export const insertBoxSpecVersionSchema = createInsertSchema(boxSpecVersions).omit({ id: true, editedAt: true });
export type InsertBoxSpecVersion = z.infer<typeof insertBoxSpecVersionSchema>;
export type BoxSpecVersion = typeof boxSpecVersions.$inferSelect;

// ========== EXTENDED QUOTE ITEM SCHEMA (with negotiation & snapshots) ==========

export const extendedQuoteItemSchema = quoteItemSchema.extend({
  // Box specification reference
  specId: z.string().optional(),
  specVersion: z.number().optional(),
  
  // Negotiation fields (overrides base schema for extended use)
  negotiationMode: z.enum(['none', 'percentage', 'fixed']).default('none'),
  negotiationValue: z.number().optional(), // Discount percentage or fixed price
  originalUnitPrice: z.number().optional(), // Original calculated price
  negotiatedUnitPrice: z.number().optional(), // Final negotiated price
  originalTotalPrice: z.number().optional(),
  negotiatedTotalPrice: z.number().optional(),
  
  // Paper pricing snapshot (frozen at quote creation)
  paperPricingSnapshot: z.object({
    gsm: z.number(),
    bf: z.number(),
    shade: z.string(),
    basePrice: z.number(),
    gsmAdjustment: z.number(),
    marketAdjustment: z.number(),
    finalRate: z.number(),
  }).optional(),
});

export type ExtendedQuoteItem = z.infer<typeof extendedQuoteItemSchema>;

// Quote terms snapshot schema
export const quoteTermsSnapshotSchema = z.object({
  includeMoq: z.boolean().default(false),
  moqQuantity: z.number().optional(),
  validityDays: z.number().default(7),
  deliveryText: z.string(),
  paymentType: z.enum(['advance', 'credit']).default('advance'),
  creditDays: z.number().optional(),
});

export type QuoteTermsSnapshot = z.infer<typeof quoteTermsSnapshotSchema>;

// Transport snapshot schema
export const transportSnapshotSchema = z.object({
  mode: z.enum(['included', 'fixed', 'actuals']).default('included'),
  amount: z.number().optional(),
  remark: z.string().optional(),
});

export type TransportSnapshot = z.infer<typeof transportSnapshotSchema>;

// ========== ADMIN VERIFICATION & ONBOARDING SYSTEM ==========

// Onboarding Status - tracks tenant's onboarding steps and verification
export const onboardingStatus = pgTable("onboarding_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).unique(),
  userId: varchar("user_id").references(() => users.id), // Creator
  
  // Onboarding step completion flags
  businessProfileDone: boolean("business_profile_done").default(false),
  paperSetupDone: boolean("paper_setup_done").default(false),
  fluteSetupDone: boolean("flute_setup_done").default(false),
  taxSetupDone: boolean("tax_setup_done").default(false),
  termsSetupDone: boolean("terms_setup_done").default(false),
  
  // Verification status
  submittedForVerification: boolean("submitted_for_verification").default(false),
  verificationStatus: varchar("verification_status").default("pending"), // 'pending', 'approved', 'rejected'
  rejectionReason: text("rejection_reason"),
  
  // Timestamps
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOnboardingStatusSchema = createInsertSchema(onboardingStatus).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingStatus = z.infer<typeof insertOnboardingStatusSchema>;
export type OnboardingStatus = typeof onboardingStatus.$inferSelect;

// Admin Actions - audit log for admin decisions
export const adminActions = pgTable("admin_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => users.id).notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(), // 'approved', 'rejected', 'request_changes'
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminActionSchema = createInsertSchema(adminActions).omit({ id: true, createdAt: true });
export type InsertAdminAction = z.infer<typeof insertAdminActionSchema>;
export type AdminAction = typeof adminActions.$inferSelect;

// ========== SUPPORT TICKET SYSTEM ==========

// Support Tickets - customer support request tracking (per tenant)
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  ticketNo: varchar("ticket_no").notNull().unique(), // Auto-generated ticket number
  userId: varchar("user_id").references(() => users.id).notNull(), // Customer who created ticket
  subject: text("subject").notNull(),
  description: text("description"),
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: varchar("status").default("open"), // 'open', 'in_progress', 'waiting', 'closed'
  category: varchar("category"), // 'billing', 'technical', 'feature_request', 'other'
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => users.id), // Support agent
  escalatedTo: varchar("escalated_to").references(() => users.id), // Admin (if escalated)
  isEscalated: boolean("is_escalated").default(false),
  
  // Resolution
  resolutionNote: text("resolution_note"),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, ticketNo: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

// Support Messages - conversation within a ticket
export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderType: varchar("sender_type").notNull(), // 'user', 'support', 'admin'
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal notes (not visible to user)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;

// ========== QUOTE TEMPLATES SYSTEM ==========

// Quote Templates - WhatsApp and Email templates for sending quotes (per tenant)
export const quoteTemplates = pgTable("quote_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null for system templates
  userId: varchar("user_id").references(() => users.id), // Creator (null for system templates)
  name: text("name").notNull(),
  channel: varchar("channel").notNull(), // 'whatsapp' or 'email'
  templateType: varchar("template_type").notNull().default("custom"), // 'system' or 'custom'
  content: text("content").notNull(), // Template content with placeholders
  description: text("description"), // Description of what this template is for
  isDefault: boolean("is_default").default(false), // Default template for this channel
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuoteTemplateSchema = createInsertSchema(quoteTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteTemplate = z.infer<typeof insertQuoteTemplateSchema>;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;

// Template Versions - version history for template rollback
export const templateVersions = pgTable("template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => quoteTemplates.id).notNull(),
  versionNo: integer("version_no").notNull(),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTemplateVersionSchema = createInsertSchema(templateVersions).omit({ id: true, createdAt: true });
export type InsertTemplateVersion = z.infer<typeof insertTemplateVersionSchema>;
export type TemplateVersion = typeof templateVersions.$inferSelect;

// Quote Send Log - audit trail for quote sends (per tenant)
export const quoteSendLogs = pgTable("quote_send_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  quoteVersionId: varchar("quote_version_id").references(() => quoteVersions.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  channel: varchar("channel").notNull(), // 'whatsapp' or 'email'
  templateId: varchar("template_id").references(() => quoteTemplates.id),
  recipientInfo: text("recipient_info"), // Phone number or email
  renderedContent: text("rendered_content"), // The actual sent content (for audit)
  status: varchar("status").default("sent"), // 'sent', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteSendLogSchema = createInsertSchema(quoteSendLogs).omit({ id: true, createdAt: true });
export type InsertQuoteSendLog = z.infer<typeof insertQuoteSendLogSchema>;
export type QuoteSendLog = typeof quoteSendLogs.$inferSelect;

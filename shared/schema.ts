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

// User storage table (Clerk Authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supabaseUserId: varchar("supabase_user_id").unique(), // DEPRECATED: Legacy column, not used
  neonAuthUserId: varchar("neon_auth_user_id").unique(), // DEPRECATED: Legacy column, not used
  clerkUserId: varchar("clerk_user_id").unique(), // Clerk user ID (PRIMARY authentication identifier)
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // DEPRECATED: Clerk handles password management
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
  authProvider: varchar("auth_provider").default("clerk"), // 'clerk' (ONLY supported value)
  signupMethod: varchar("signup_method"), // 'email_otp', 'email_password', 'magic_link', 'google', 'microsoft', 'linkedin', 'apple' (via Clerk)
  emailVerified: boolean("email_verified").default(false), // Email verification status (synced from Clerk)
  mobileVerified: boolean("mobile_verified").default(false), // Mobile verification status
  accountStatus: varchar("account_status").default("new_user"), // 'new_user', 'email_verified', 'mobile_verified', 'fully_verified', 'suspended', 'deleted'
  lastLoginAt: timestamp("last_login_at"), // Last successful login
  passwordResetRequired: boolean("password_reset_required").default(false), // DEPRECATED: Clerk handles password reset
  failedLoginAttempts: integer("failed_login_attempts").default(0), // DEPRECATED: Clerk handles rate limiting
  lockedUntil: timestamp("locked_until"), // DEPRECATED: Clerk handles account locking
  // Payment & Signup Flow
  paymentCompleted: boolean("payment_completed").default(false), // True if user completed payment during signup
  temporaryProfileId: varchar("temporary_profile_id"), // Reference to temporary_business_profiles (audit trail)
  // Two-Factor Authentication
  twoFactorEnabled: boolean("two_factor_enabled").default(false), // DEPRECATED: Clerk handles 2FA
  twoFactorMethod: varchar("two_factor_method"), // DEPRECATED: Clerk handles 2FA methods
  twoFactorVerifiedAt: timestamp("two_factor_verified_at"), // When 2FA was last verified
  // Setup & Verification
  isSetupComplete: boolean("is_setup_complete").default(false), // True when all setup steps completed
  setupProgress: integer("setup_progress").default(0), // Percentage 0-100 driven by user_setup table
  verificationStatus: varchar("verification_status").default("NOT_SUBMITTED"), // NOT_SUBMITTED | PENDING | APPROVED | REJECTED
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
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

// Admin IP Whitelist - Restrict admin access by IP address
export const allowedAdminIps = pgTable("allowed_admin_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // null = applies to all admins
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // Supports IPv4 and IPv6
  description: text("description"), // e.g., "Office WiFi", "VPN Server"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // Admin who added this IP
  lastUsedAt: timestamp("last_used_at"), // Track when this IP was last used
}, (table) => [
  index("idx_allowed_ips_user").on(table.userId),
  index("idx_allowed_ips_address").on(table.ipAddress),
]);

export const insertAllowedAdminIpSchema = createInsertSchema(allowedAdminIps).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertAllowedAdminIp = z.infer<typeof insertAllowedAdminIpSchema>;
export type AllowedAdminIp = typeof allowedAdminIps.$inferSelect;

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
  features: jsonb("features").default('{"maxEmailProviders":1,"maxQuotes":50,"maxPartyProfiles":20,"apiAccess":false,"whatsappIntegration":false,"prioritySupport":false,"customBranding":false}'),
  isActive: boolean("is_active").default(true),
  trialDays: integer("trial_days").default(14),
  planTier: varchar("plan_tier", { length: 20 }).default('basic'), // 'basic', 'professional', 'enterprise'
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  // Enterprise subscription management columns
  code: text("code").unique(),
  billingCycle: varchar("billing_cycle", { length: 20 }).default('MONTHLY'),
  currency: varchar("currency", { length: 10 }).default('INR'),
  basePrice: real("base_price"),
  gstApplicable: boolean("gst_applicable").default(true),
  gstRate: real("gst_rate").default(18.00),
  isPublic: boolean("is_public").default(true),
  status: varchar("plan_status", { length: 20 }).default('ACTIVE'),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by"),
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
  // Enterprise subscription management columns
  tenantId: varchar("tenant_id"),
  planVersionId: varchar("plan_version_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  autoRenew: boolean("auto_renew").default(true),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  gatewaySubscriptionId: text("gateway_subscription_id"),
  gatewayCustomerId: text("gateway_customer_id"),
  lastPaymentId: varchar("last_payment_id"),
  nextBillingDate: timestamp("next_billing_date"),
  paymentFailures: integer("payment_failures").default(0),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// User Feature Usage Tracking
export const userFeatureUsage = pgTable("user_feature_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  emailProvidersCount: integer("email_providers_count").default(0),
  customTemplatesCount: integer("custom_templates_count").default(0),
  quotesThisMonth: integer("quotes_this_month").default(0),
  partyProfilesCount: integer("party_profiles_count").default(0),
  apiCallsThisMonth: integer("api_calls_this_month").default(0),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserFeatureUsageSchema = createInsertSchema(userFeatureUsage).omit({ id: true, updatedAt: true });
export type InsertUserFeatureUsage = z.infer<typeof insertUserFeatureUsageSchema>;
export type UserFeatureUsage = typeof userFeatureUsage.$inferSelect;

// User Feature Overrides (Admin can override plan limits for specific users)
export const userFeatureOverrides = pgTable("user_feature_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  maxEmailProviders: integer("max_email_providers"), // null = use plan limit
  maxQuotes: integer("max_quotes"),
  maxPartyProfiles: integer("max_party_profiles"),
  apiAccess: boolean("api_access"),
  whatsappIntegration: boolean("whatsapp_integration"),
  notes: text("notes"), // Admin notes for why override was applied
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserFeatureOverrideSchema = createInsertSchema(userFeatureOverrides).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserFeatureOverride = z.infer<typeof insertUserFeatureOverrideSchema>;
export type UserFeatureOverride = typeof userFeatureOverrides.$inferSelect;

// Payment Gateways Configuration
export const paymentGateways = pgTable("payment_gateways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gatewayType: varchar("gateway_type", { length: 50 }).notNull().unique(), // 'razorpay', 'phonepe', 'payu', 'cashfree', 'ccavenue'
  gatewayName: varchar("gateway_name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").notNull().default(100), // Lower = higher priority, 1 = highest
  credentials: jsonb("credentials").notNull(), // Encrypted gateway credentials
  webhookSecret: varchar("webhook_secret", { length: 500 }),
  environment: varchar("environment", { length: 20 }).default('test'), // 'test', 'production'
  
  // Health monitoring
  consecutiveFailures: integer("consecutive_failures").default(0),
  lastHealthCheck: timestamp("last_health_check"),
  lastFailureAt: timestamp("last_failure_at"),
  lastFailureReason: text("last_failure_reason"),
  totalTransactions: integer("total_transactions").default(0),
  totalSuccessful: integer("total_successful").default(0),
  totalFailed: integer("total_failed").default(0),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
}, (table) => [
  index("idx_payment_gateways_active").on(table.isActive),
  index("idx_payment_gateways_priority").on(table.priority),
]);

export const insertPaymentGatewaySchema = createInsertSchema(paymentGateways).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentGateway = z.infer<typeof insertPaymentGatewaySchema>;
export type PaymentGateway = typeof paymentGateways.$inferSelect;

// Template Ratings - User feedback for community templates
export const templateRatings = pgTable("template_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  templateType: varchar("template_type", { length: 20 }).notNull(), // 'quote' or 'invoice'
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_template_ratings_template").on(table.templateId, table.templateType),
  index("idx_template_ratings_user").on(table.userId),
  // Unique constraint: one rating per user per template
  sql`UNIQUE(template_id, template_type, user_id)`,
]);

export const insertTemplateRatingSchema = createInsertSchema(templateRatings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplateRating = z.infer<typeof insertTemplateRatingSchema>;
export type TemplateRating = typeof templateRatings.$inferSelect;

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
  panNo: text("pan_no"), // Auto-derived from GSTIN (positions 3-12)
  stateCode: varchar("state_code", { length: 2 }), // Auto-derived from GSTIN (positions 1-2)
  stateName: text("state_name"), // Auto-derived from state code lookup
  address: text("address"),
  website: text("website"),
  mapLink: text("map_link"), // Google Maps link for templates
  socialMedia: text("social_media"),
  googleLocation: text("google_location"),
  // GST Verification Metadata (future-ready for paid APIs)
  gstVerified: boolean("gst_verified").default(false),
  gstVerifiedAt: timestamp("gst_verified_at"),
  gstVerificationProvider: text("gst_verification_provider"), // e.g., "Clear Tax API", "Masters India"
  gstVerificationResponse: text("gst_verification_response"), // Store JSON response
  // Invoice-Safe Locking (lock legal fields after first financial document)
  hasFinancialDocs: boolean("has_financial_docs").default(false),
  lockedAt: timestamp("locked_at"),
  lockedReason: text("locked_reason"), // e.g., "First invoice generated on 2025-01-15"
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
  // Invoice PDF tracking (added in migration 008)
  invoiceTemplateId: varchar("invoice_template_id").references(() => invoiceTemplates.id),
  pdfPath: text("pdf_path"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  isPdfGenerated: boolean("is_pdf_generated").default(false),
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
// Abbreviations are used in paper spec generation: e.g., "KRA120/32"
// Categories: kraft, liner, duplex, flute

export const paperShades = pgTable("paper_shades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shadeName: varchar("shade_name", { length: 100 }).notNull().unique(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
  category: varchar("category", { length: 20 }).default("kraft"), // kraft, liner, duplex, flute
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
// CANONICAL ABBREVIATIONS - used everywhere: Calculator, Reports, Paper Specs
export const DEFAULT_PAPER_SHADES = [
  { shadeName: "Kraft/Natural", abbreviation: "KRA", category: "kraft", description: "Standard kraft paper", isFluting: false, sortOrder: 1 },
  { shadeName: "Testliner", abbreviation: "TST", category: "liner", description: "Recycled testliner", isFluting: false, sortOrder: 2 },
  { shadeName: "Virgin Kraft Liner", abbreviation: "VKL", category: "liner", description: "Premium virgin kraft liner", isFluting: false, sortOrder: 3 },
  { shadeName: "White Kraft Liner", abbreviation: "WKL", category: "liner", description: "White coated kraft liner", isFluting: false, sortOrder: 4 },
  { shadeName: "White Top Testliner", abbreviation: "WTT", category: "liner", description: "White top coated testliner", isFluting: false, sortOrder: 5 },
  { shadeName: "Duplex Grey Back (LWC)", abbreviation: "LWC", category: "duplex", description: "Light Weight Coating duplex", isFluting: false, sortOrder: 6 },
  { shadeName: "Duplex Grey Back (HWC)", abbreviation: "HWC", category: "duplex", description: "Heavy Weight Coating duplex", isFluting: false, sortOrder: 7 },
  { shadeName: "Semi Chemical Fluting", abbreviation: "SCF", category: "flute", description: "Semi chemical fluting medium", isFluting: true, sortOrder: 8 },
  { shadeName: "Recycled Fluting", abbreviation: "RCF", category: "flute", description: "Recycled fluting medium", isFluting: true, sortOrder: 9 },
  { shadeName: "Bagasse (Agro based)", abbreviation: "BAG", category: "kraft", description: "Agricultural waste based paper", isFluting: false, sortOrder: 10 },
  { shadeName: "Golden Kraft", abbreviation: "GOL", category: "kraft", description: "Premium golden kraft paper", isFluting: false, sortOrder: 11 },
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

// User Setup - per-tenant setup checklist powering progress + gating
export const userSetup = pgTable("user_setup", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  businessProfile: boolean("business_profile").default(false),
  paperPricing: boolean("paper_pricing").default(false),
  fluteSettings: boolean("flute_settings").default(false),
  taxDefaults: boolean("tax_defaults").default(false),
  quoteTerms: boolean("quote_terms").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_setup_user").on(table.userId),
  index("idx_user_setup_tenant").on(table.tenantId),
  index("idx_user_setup_user_tenant").on(table.userId, table.tenantId),
]);

export const insertUserSetupSchema = createInsertSchema(userSetup).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserSetup = z.infer<typeof insertUserSetupSchema>;
export type UserSetup = typeof userSetup.$inferSelect;

// Onboarding Status - legacy table kept for compatibility; kept in sync with user_setup + users
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
  lastReminderSentAt: timestamp("last_reminder_sent_at"),

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
  
  // Community Marketplace Fields
  isSystemTemplate: boolean("is_system_template").default(false), // true = default editable templates
  isCommunityTemplate: boolean("is_community_template").default(false), // User shared template
  isPublic: boolean("is_public").default(false), // Visible in community gallery
  useCount: integer("use_count").default(0), // How many times template used
  rating: integer("rating").default(0), // Average rating (0-5)
  ratingCount: integer("rating_count").default(0), // Number of ratings
  tags: jsonb("tags").default('[]'), // ['professional', 'formal', 'quote']
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quote_templates_public").on(table.isPublic),
  index("idx_quote_templates_community").on(table.isCommunityTemplate),
  index("idx_quote_templates_system").on(table.isSystemTemplate),
]);

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

// ========== PAYMENT & INVOICE SYSTEM ==========

// Temporary Business Profiles - stores signup data BEFORE payment
export const temporaryBusinessProfiles = pgTable("temporary_business_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorizedPersonName: text("authorized_person_name").notNull(),
  businessName: text("business_name").notNull(),
  businessEmail: text("business_email").notNull().unique(),
  mobileNumber: text("mobile_number").notNull(),
  gstin: text("gstin"),
  panNo: text("pan_no"),
  stateCode: varchar("state_code", { length: 2 }),
  stateName: text("state_name"),
  fullBusinessAddress: text("full_business_address").notNull(),
  website: text("website"),
  sessionToken: varchar("session_token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  gstinValidated: boolean("gstin_validated").default(false),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_temp_profiles_session").on(table.sessionToken),
  index("idx_temp_profiles_email").on(table.businessEmail),
  index("idx_temp_profiles_expires").on(table.expiresAt),
]);

export const insertTemporaryBusinessProfileSchema = createInsertSchema(temporaryBusinessProfiles).omit({ id: true, createdAt: true });
export type InsertTemporaryBusinessProfile = z.infer<typeof insertTemporaryBusinessProfileSchema>;
export type TemporaryBusinessProfile = typeof temporaryBusinessProfiles.$inferSelect;

// Invoice Templates - HTML templates for PDF generation
// Invoice Templates - GST-compliant invoice HTML templates
export const invoiceTemplates = pgTable("invoice_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  templateKey: varchar("template_key", { length: 100 }).unique().notNull(),
  description: text("description"),
  htmlContent: text("html_content").notNull(),
  isDefault: boolean("is_default").default(false),
  status: varchar("status", { length: 50 }).default('active'), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoice_templates_template_key").on(table.templateKey),
  index("idx_invoice_templates_is_default").on(table.isDefault),
  index("idx_invoice_templates_status").on(table.status),
]);

export const insertInvoiceTemplateSchema = createInsertSchema(invoiceTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoiceTemplate = z.infer<typeof insertInvoiceTemplateSchema>;
export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;

// Invoices - GST-compliant tax invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
  financialYear: varchar("financial_year", { length: 9 }).notNull(),
  // Seller details
  sellerCompanyName: text("seller_company_name").notNull(),
  sellerGstin: text("seller_gstin").notNull(),
  sellerAddress: text("seller_address").notNull(),
  sellerStateCode: varchar("seller_state_code", { length: 2 }).notNull(),
  sellerStateName: text("seller_state_name").notNull(),
  // Buyer details
  buyerCompanyName: text("buyer_company_name").notNull(),
  buyerGstin: text("buyer_gstin"),
  buyerAddress: text("buyer_address").notNull(),
  buyerStateCode: varchar("buyer_state_code", { length: 2 }),
  buyerStateName: text("buyer_state_name"),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  // Subscription
  userId: varchar("user_id").references(() => users.id),
  subscriptionId: varchar("subscription_id"), // FK to userSubscriptions (added after table defined)
  planName: text("plan_name").notNull(),
  billingCycle: varchar("billing_cycle").notNull(),
  // Line items
  lineItems: jsonb("line_items").notNull().default('[]'),
  // Pricing
  subtotal: real("subtotal").notNull(),
  discountAmount: real("discount_amount").default(0),
  taxableValue: real("taxable_value").notNull(),
  // GST breakdown
  cgstRate: real("cgst_rate").default(0),
  cgstAmount: real("cgst_amount").default(0),
  sgstRate: real("sgst_rate").default(0),
  sgstAmount: real("sgst_amount").default(0),
  igstRate: real("igst_rate").default(0),
  igstAmount: real("igst_amount").default(0),
  totalTax: real("total_tax").notNull(),
  grandTotal: real("grand_total").notNull(),
  // Payment
  paymentTransactionId: varchar("payment_transaction_id"), // FK to paymentTransactions
  razorpayPaymentId: varchar("razorpay_payment_id"),
  razorpayOrderId: varchar("razorpay_order_id"),
  couponCode: varchar("coupon_code"),
  couponDiscount: real("coupon_discount").default(0),
  // Invoice metadata
  invoiceTemplateId: varchar("invoice_template_id").references(() => invoiceTemplates.id),
  pdfUrl: text("pdf_url"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  status: varchar("status").default("generated"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_user").on(table.userId),
  index("idx_invoices_number").on(table.invoiceNumber),
  index("idx_invoices_subscription").on(table.subscriptionId),
  index("idx_invoices_date").on(table.invoiceDate),
  index("idx_invoices_financial_year").on(table.financialYear),
  index("idx_invoices_status").on(table.status),
]);

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Seller Profile - YOUR company details (appears as seller on all invoices)
export const sellerProfile = pgTable("seller_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  gstin: text("gstin").notNull(),
  panNo: text("pan_no").notNull(),
  stateCode: varchar("state_code", { length: 2 }).notNull(),
  stateName: text("state_name").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSellerProfileSchema = createInsertSchema(sellerProfile).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSellerProfile = z.infer<typeof insertSellerProfileSchema>;
export type SellerProfile = typeof sellerProfile.$inferSelect;

// ========== ENTERPRISE ADMIN PANEL SYSTEM ==========

// Admin roles enum for the enterprise admin panel
export const adminRoleEnum = z.enum(['SUPER_ADMIN', 'SUPPORT_STAFF', 'SUPPORT_VIEWER', 'MARKETING_STAFF', 'FINANCE_ADMIN']);
export type AdminRole = z.infer<typeof adminRoleEnum>;

// Staff - Enterprise admin team members (separate from regular users)
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(), // FK to the system user account
  role: varchar("role").notNull().default('SUPPORT_STAFF'), // SUPER_ADMIN, SUPPORT_STAFF, MARKETING_STAFF, FINANCE_ADMIN
  status: varchar("status").notNull().default('active'), // 'active', 'disabled'
  joinedAt: timestamp("joined_at").defaultNow(),
  disabledAt: timestamp("disabled_at"),
  disabledBy: varchar("disabled_by").references(() => staff.id), // Who disabled this staff
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_staff_user").on(table.userId),
  index("idx_staff_role").on(table.role),
  index("idx_staff_status").on(table.status),
]);

export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, joinedAt: true, createdAt: true, updatedAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// Ticket notes - Internal notes within a support ticket (staff-only)
export const ticketNotes = pgTable("ticket_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  staffId: varchar("staff_id").references(() => staff.id).notNull(), // Only staff can create notes
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ticket_notes_ticket").on(table.ticketId),
  index("idx_ticket_notes_staff").on(table.staffId),
]);

export const insertTicketNoteSchema = createInsertSchema(ticketNotes).omit({ id: true, createdAt: true });
export type InsertTicketNote = z.infer<typeof insertTicketNoteSchema>;
export type TicketNote = typeof ticketNotes.$inferSelect;

// Staff metrics - Performance analytics per staff member
export const staffMetrics = pgTable("staff_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => staff.id).notNull().unique(),
  ticketsAssigned: integer("tickets_assigned").default(0),
  ticketsResolved: integer("tickets_resolved").default(0),
  avgResolutionTime: real("avg_resolution_time").default(0), // in hours
  totalActionCount: integer("total_action_count").default(0), // Coupons, approvals, etc
  couponsCreated: integer("coupons_created").default(0),
  couponRedemptionRate: real("coupon_redemption_rate").default(0), // percentage
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_staff_metrics_staff").on(table.staffId),
]);

export const insertStaffMetricsSchema = createInsertSchema(staffMetrics).omit({ id: true, createdAt: true, lastUpdated: true });
export type InsertStaffMetrics = z.infer<typeof insertStaffMetricsSchema>;
export type StaffMetrics = typeof staffMetrics.$inferSelect;

// Enhanced audit logs for admin actions with JSONB before/after state
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorStaffId: varchar("actor_staff_id").references(() => staff.id).notNull(), // Which staff member performed action
  actorRole: varchar("actor_role").notNull(), // Snapshot of their role at time of action
  action: varchar("action").notNull(), // 'create_staff', 'disable_staff', 'create_ticket', 'resolve_ticket', 'create_coupon', 'approve_coupon', 'create_invoice', etc
  entityType: varchar("entity_type").notNull(), // 'staff', 'ticket', 'coupon', 'invoice', 'payment', etc
  entityId: varchar("entity_id"), // ID of the entity being modified
  beforeState: jsonb("before_state"), // Snapshot of entity before change
  afterState: jsonb("after_state"), // Snapshot of entity after change
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  status: varchar("status").default('success'), // 'success', 'failed'
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_admin_audit_logs_staff").on(table.actorStaffId),
  index("idx_admin_audit_logs_action").on(table.action),
  index("idx_admin_audit_logs_entity").on(table.entityType),
  index("idx_admin_audit_logs_created").on(table.createdAt),
  index("idx_admin_audit_logs_role").on(table.actorRole),
]);

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({ id: true, createdAt: true });
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// ========== ADMIN EMAIL SETTINGS ==========

// Email Provider enum
export const emailProviderEnumAdmin = z.enum(['gmail', 'zoho', 'outlook', 'yahoo', 'ses', 'custom']);
export type EmailProviderAdmin = z.infer<typeof emailProviderEnumAdmin>;

// Admin Email Settings - System-wide email configuration for notifications
export const adminEmailSettings = pgTable("admin_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").notNull(), // 'gmail', 'zoho', 'outlook', 'yahoo', 'ses', 'custom'
  fromName: text("from_name").notNull(), // Display name for sender
  fromEmail: text("from_email").notNull(), // Sender email address
  smtpHost: text("smtp_host").notNull(), // SMTP server host
  smtpPort: integer("smtp_port").notNull(), // SMTP server port
  encryption: varchar("encryption").notNull(), // 'TLS', 'SSL', 'NONE'
  smtpUsername: text("smtp_username").notNull(), // SMTP auth username
  smtpPasswordEncrypted: text("smtp_password_encrypted").notNull(), // Encrypted password
  isActive: boolean("is_active").default(true), // Only one can be active
  lastTestedAt: timestamp("last_tested_at"), // When test email was last sent
  testStatus: varchar("test_status"), // 'success', 'failed'
  createdBy: varchar("created_by").references(() => staff.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_admin_email_settings_active").on(table.isActive),
]);

export const insertAdminEmailSettingsSchema = createInsertSchema(adminEmailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdminEmailSettings = z.infer<typeof insertAdminEmailSettingsSchema>;
export type AdminEmailSettings = typeof adminEmailSettings.$inferSelect;

// Note: emailLogs table already exists at line 126 for user email tracking
// The admin email service will use the existing emailLogs table
// ============================================================
// MULTI-PROVIDER EMAIL SYSTEM SCHEMA
// ============================================================

// Email Providers - Multiple provider configurations
export const emailProviders = pgTable("email_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // null = admin-owned, set = user-owned
  providerType: varchar("provider_type", { length: 50 }).notNull(), // 'gmail', 'ses', 'zoho', etc.
  providerName: varchar("provider_name", { length: 100 }).notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  replyToEmail: varchar("reply_to_email", { length: 255 }),
  connectionType: varchar("connection_type", { length: 20 }).notNull().default('smtp'), // 'smtp', 'api', 'webhook'
  
  // SMTP configuration
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpUsername: varchar("smtp_username", { length: 255 }),
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  smtpEncryption: varchar("smtp_encryption", { length: 10 }),
  
  // API configuration
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiSecretEncrypted: text("api_secret_encrypted"),
  apiRegion: varchar("api_region", { length: 50 }),
  
  // Configuration JSON
  configJson: jsonb("config_json").default('{}'),
  
  // Provider status
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  priorityOrder: integer("priority_order").notNull().default(100),
  role: varchar("role", { length: 20 }).default('secondary'), // 'primary', 'secondary', 'fallback'
  
  // Rate limiting
  maxEmailsPerHour: integer("max_emails_per_hour"),
  maxEmailsPerDay: integer("max_emails_per_day"),
  currentHourlyCount: integer("current_hourly_count").default(0),
  currentDailyCount: integer("current_daily_count").default(0),
  rateLimitResetAt: timestamp("rate_limit_reset_at"),
  
  // Health monitoring
  lastUsedAt: timestamp("last_used_at"),
  lastTestAt: timestamp("last_test_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  totalSent: integer("total_sent").default(0),
  totalFailed: integer("total_failed").default(0),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
  updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
  index("idx_email_providers_active").on(table.isActive),
  index("idx_email_providers_priority").on(table.priorityOrder),
  index("idx_email_providers_type").on(table.providerType),
  index("idx_email_providers_user").on(table.userId),
]);

export const insertEmailProviderSchema = createInsertSchema(emailProviders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailProvider = z.infer<typeof insertEmailProviderSchema>;
export type EmailProvider = typeof emailProviders.$inferSelect;

// Email Task Routing - Maps task types to providers
export const emailTaskRouting = pgTable("email_task_routing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: varchar("task_type", { length: 50 }).notNull().unique(), // 'SYSTEM_EMAILS', 'AUTH_EMAILS', etc.
  taskDescription: text("task_description"),
  primaryProviderId: varchar("primary_provider_id").references(() => emailProviders.id),
  fallbackProviderIds: jsonb("fallback_provider_ids").default('[]'), // Array of provider IDs
  forceProviderId: varchar("force_provider_id").references(() => emailProviders.id),
  retryAttempts: integer("retry_attempts").default(2),
  retryDelaySeconds: integer("retry_delay_seconds").default(5),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
  index("idx_email_task_routing_type").on(table.taskType),
  index("idx_email_task_routing_enabled").on(table.isEnabled),
]);

export const insertEmailTaskRoutingSchema = createInsertSchema(emailTaskRouting).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTaskRouting = z.infer<typeof insertEmailTaskRoutingSchema>;
export type EmailTaskRouting = typeof emailTaskRouting.$inferSelect;

// Email Send Logs - Comprehensive logging
export const emailSendLogs = pgTable("email_send_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailProviderId: varchar("email_provider_id").references(() => emailProviders.id),
  emailTaskRoutingId: varchar("email_task_routing_id").references(() => emailTaskRouting.id),
  userId: varchar("user_id", { length: 255 }),
  taskType: varchar("task_type", { length: 50 }),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  subject: text("subject"),
  status: varchar("status", { length: 20 }).notNull(), // 'sent', 'failed', 'bounced', 'rate_limited'
  attemptNumber: integer("attempt_number").default(1),
  totalAttempts: integer("total_attempts"),
  errorMessage: text("error_message"),
  failoverOccurred: boolean("failover_occurred").default(false),
  failoverFromProviderId: varchar("failover_from_provider_id").references(() => emailProviders.id),
  failoverReason: text("failover_reason"),
  metadata: jsonb("metadata").default('{}'),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => [
  index("idx_email_send_logs_provider").on(table.emailProviderId),
  index("idx_email_send_logs_user").on(table.userId),
  index("idx_email_send_logs_status").on(table.status),
  index("idx_email_send_logs_task_type").on(table.taskType),
  index("idx_email_send_logs_sent_at").on(table.sentAt),
]);

export const insertEmailSendLogSchema = createInsertSchema(emailSendLogs).omit({ id: true, sentAt: true });
export type InsertEmailSendLog = z.infer<typeof insertEmailSendLogSchema>;
export type EmailSendLog = typeof emailSendLogs.$inferSelect;

// Email Provider Health - Aggregated health metrics
export const emailProviderHealth = pgTable("email_provider_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailProviderId: varchar("email_provider_id").references(() => emailProviders.id).notNull(),
  checkTime: timestamp("check_time").notNull().defaultNow(),
  isHealthy: boolean("is_healthy").notNull(),
  successRate: real("success_rate"),
  avgResponseTimeMs: integer("avg_response_time_ms"),
  errorCount: integer("error_count").default(0),
  healthCheckDetails: jsonb("health_check_details").default('{}'),
}, (table) => [
  index("idx_email_provider_health_provider").on(table.emailProviderId),
  index("idx_email_provider_health_time").on(table.checkTime),
]);

export const insertEmailProviderHealthSchema = createInsertSchema(emailProviderHealth).omit({ id: true, checkTime: true });
export type InsertEmailProviderHealth = z.infer<typeof insertEmailProviderHealthSchema>;
export type EmailProviderHealth = typeof emailProviderHealth.$inferSelect;

// User Email Preferences - Consent management (GDPR)
export const userEmailPreferences = pgTable("user_email_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  allowSystemEmails: boolean("allow_system_emails").default(true),
  allowAuthEmails: boolean("allow_auth_emails").default(true),
  allowTransactionalEmails: boolean("allow_transactional_emails").default(true),
  allowOnboardingEmails: boolean("allow_onboarding_emails").default(true),
  allowNotificationEmails: boolean("allow_notification_emails").default(true),
  allowMarketingEmails: boolean("allow_marketing_emails").default(false),
  allowSupportEmails: boolean("allow_support_emails").default(true),
  allowBillingEmails: boolean("allow_billing_emails").default(true),
  allowReportEmails: boolean("allow_report_emails").default(true),
  emailFrequency: varchar("email_frequency", { length: 20 }).default('immediate'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_email_preferences_user").on(table.userId),
]);

export const insertUserEmailPreferencesSchema = createInsertSchema(userEmailPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserEmailPreferences = z.infer<typeof insertUserEmailPreferencesSchema>;
export type UserEmailPreferences = typeof userEmailPreferences.$inferSelect;

// ========== SUBSCRIPTION MANAGEMENT SYSTEM (ENTERPRISE) ==========

// Plan Versions - Immutable snapshots of plan pricing
export const planVersions = pgTable("plan_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => subscriptionPlans.id).notNull(),
  version: integer("version").notNull(),
  price: real("price").notNull(),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default('MONTHLY'),
  gstRate: real("gst_rate").default(18.00),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until"),
  isCurrent: boolean("is_current").default(true),
  changeNotes: text("change_notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_plan_versions_plan").on(table.planId),
  index("idx_plan_versions_current").on(table.isCurrent),
]);

export const insertPlanVersionSchema = createInsertSchema(planVersions).omit({ id: true, createdAt: true });
export type InsertPlanVersion = z.infer<typeof insertPlanVersionSchema>;
export type PlanVersion = typeof planVersions.$inferSelect;

// Subscription Features - System-wide feature definitions
export const subscriptionFeatures = pgTable("subscription_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  valueType: varchar("value_type", { length: 20 }).notNull(), // 'BOOLEAN', 'NUMBER', 'TEXT'
  defaultValue: text("default_value"),
  category: varchar("category", { length: 50 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscription_features_code").on(table.code),
  index("idx_subscription_features_category").on(table.category),
]);

export const insertSubscriptionFeatureSchema = createInsertSchema(subscriptionFeatures).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionFeature = z.infer<typeof insertSubscriptionFeatureSchema>;
export type SubscriptionFeature = typeof subscriptionFeatures.$inferSelect;

// Plan Features - Feature values per plan version
export const planFeatures = pgTable("plan_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planVersionId: varchar("plan_version_id").notNull(),
  featureId: varchar("feature_id").notNull(),
  value: text("value").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_plan_features_version").on(table.planVersionId),
  index("idx_plan_features_feature").on(table.featureId),
]);

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({ id: true, createdAt: true });
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;
export type PlanFeature = typeof planFeatures.$inferSelect;

// Subscription Audit Logs - Immutable audit trail
export const subscriptionAuditLogs = pgTable("subscription_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(),
  action: text("action").notNull(),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot").notNull(),
  changeDetails: jsonb("change_details"),
  actorId: varchar("actor_id"),
  actorType: varchar("actor_type", { length: 20 }),
  actorEmail: text("actor_email"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subscription_audit_subscription").on(table.subscriptionId),
  index("idx_subscription_audit_action").on(table.action),
  index("idx_subscription_audit_actor").on(table.actorId),
  index("idx_subscription_audit_created").on(table.createdAt),
]);

export type SubscriptionAuditLog = typeof subscriptionAuditLogs.$inferSelect;

// Subscription Payments - Payment history
export const subscriptionPayments = pgTable("subscription_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  amount: real("amount").notNull(),
  baseAmount: real("base_amount").notNull(),
  gstAmount: real("gst_amount").default(0),
  gstRate: real("gst_rate"),
  currency: varchar("currency", { length: 10 }).notNull().default('INR'),
  status: varchar("status", { length: 20 }).notNull().default('PENDING'),
  paymentType: varchar("payment_type", { length: 20 }),
  gateway: varchar("gateway", { length: 50 }).notNull(),
  gatewayPaymentId: text("gateway_payment_id"),
  gatewayOrderId: text("gateway_order_id"),
  gatewaySignature: text("gateway_signature"),
  gatewayResponse: jsonb("gateway_response"),
  invoiceId: varchar("invoice_id"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscription_payments_subscription").on(table.subscriptionId),
  index("idx_subscription_payments_user").on(table.userId),
  index("idx_subscription_payments_status").on(table.status),
  index("idx_subscription_payments_gateway").on(table.gateway, table.gatewayPaymentId),
]);

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;

// Subscription Invoices - GST-compliant invoices
export const subscriptionInvoices = pgTable("subscription_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").unique().notNull(),
  subscriptionId: varchar("subscription_id").notNull(),
  paymentId: varchar("payment_id"),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  
  // Billing details
  billingName: text("billing_name").notNull(),
  billingEmail: text("billing_email").notNull(),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingCountry: text("billing_country").default('India'),
  billingPincode: text("billing_pincode"),
  billingGstin: text("billing_gstin"),
  
  // Company details
  companyName: text("company_name").notNull(),
  companyGstin: text("company_gstin").notNull(),
  companyAddress: text("company_address"),
  companyState: text("company_state"),
  
  // Plan details
  planName: text("plan_name").notNull(),
  planCode: text("plan_code").notNull(),
  planVersion: integer("plan_version").notNull(),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Amounts
  baseAmount: real("base_amount").notNull(),
  discountAmount: real("discount_amount").default(0),
  discountDescription: text("discount_description"),
  couponCode: text("coupon_code"),
  taxableAmount: real("taxable_amount").notNull(),
  
  // GST breakdown
  isIgst: boolean("is_igst").default(false),
  cgstRate: real("cgst_rate"),
  cgstAmount: real("cgst_amount"),
  sgstRate: real("sgst_rate"),
  sgstAmount: real("sgst_amount"),
  igstRate: real("igst_rate"),
  igstAmount: real("igst_amount"),
  totalGst: real("total_gst").notNull(),
  
  totalAmount: real("total_amount").notNull(),
  amountInWords: text("amount_in_words"),
  currency: varchar("currency", { length: 10 }).notNull().default('INR'),
  
  status: varchar("status", { length: 20 }).notNull().default('DRAFT'),
  issuedAt: timestamp("issued_at"),
  paidAt: timestamp("paid_at"),
  voidReason: text("void_reason"),
  
  originalInvoiceId: varchar("original_invoice_id"),
  creditNoteReason: text("credit_note_reason"),
  
  // E-invoice fields
  irn: text("irn"),
  ackNumber: text("ack_number"),
  ackDate: timestamp("ack_date"),
  signedInvoice: text("signed_invoice"),
  signedQrCode: text("signed_qr_code"),
  
  notes: text("notes"),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscription_invoices_number").on(table.invoiceNumber),
  index("idx_subscription_invoices_subscription").on(table.subscriptionId),
  index("idx_subscription_invoices_user").on(table.userId),
  index("idx_subscription_invoices_status").on(table.status),
]);

export const insertSubscriptionInvoiceSchema = createInsertSchema(subscriptionInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionInvoice = z.infer<typeof insertSubscriptionInvoiceSchema>;
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;

// Subscription Coupons - Discount codes
export const subscriptionCoupons = pgTable("subscription_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // 'PERCENTAGE', 'FIXED_AMOUNT'
  discountValue: real("discount_value").notNull(),
  maxDiscountAmount: real("max_discount_amount"),
  currency: varchar("currency", { length: 10 }).default('INR'),
  maxUses: integer("max_uses"),
  maxUsesPerUser: integer("max_uses_per_user").default(1),
  currentUses: integer("current_uses").default(0),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  applicablePlans: jsonb("applicable_plans"),
  minAmount: real("min_amount"),
  firstSubscriptionOnly: boolean("first_subscription_only").default(false),
  status: varchar("status", { length: 20 }).notNull().default('ACTIVE'),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_subscription_coupons_code").on(table.code),
  index("idx_subscription_coupons_status").on(table.status),
]);

export const insertSubscriptionCouponSchema = createInsertSchema(subscriptionCoupons).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionCoupon = z.infer<typeof insertSubscriptionCouponSchema>;
export type SubscriptionCoupon = typeof subscriptionCoupons.$inferSelect;

// Coupon Usages - Track coupon redemptions
export const couponUsages = pgTable("coupon_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull(),
  userId: varchar("user_id").notNull(),
  subscriptionId: varchar("subscription_id").notNull(),
  paymentId: varchar("payment_id"),
  discountApplied: real("discount_applied").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_coupon_usages_coupon").on(table.couponId),
  index("idx_coupon_usages_user").on(table.userId),
]);

export type CouponUsage = typeof couponUsages.$inferSelect;

// Plan Audit Logs - Track plan changes
export const planAuditLogs = pgTable("plan_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  planVersionId: varchar("plan_version_id"),
  action: text("action").notNull(),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot").notNull(),
  actorId: varchar("actor_id"),
  actorEmail: text("actor_email"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_plan_audit_logs_plan").on(table.planId),
  index("idx_plan_audit_logs_action").on(table.action),
]);

export type PlanAuditLog = typeof planAuditLogs.$inferSelect;

// ========== ENTERPRISE SUPPORT + SLA + AI SYSTEM ==========

// Support Ticket Category Enum
export const supportTicketCategoryEnum = z.enum([
  'SOFTWARE_ISSUE',
  'SOFTWARE_BUG',
  'BILLING',
  'TRAINING',
  'FEATURE_REQUEST',
  'CALLBACK_REQUEST',
  'GENERAL_QUERY'
]);
export type SupportTicketCategory = z.infer<typeof supportTicketCategoryEnum>;

// Support Ticket Priority Enum
export const supportTicketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type SupportTicketPriority = z.infer<typeof supportTicketPriorityEnum>;

// Support Ticket Status Enum
export const supportTicketStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'AWAITING_USER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED'
]);
export type SupportTicketStatus = z.infer<typeof supportTicketStatusEnum>;

// Support Message Sender Role Enum
export const supportMessageSenderRoleEnum = z.enum(['USER', 'ADMIN', 'SYSTEM', 'WHATSAPP', 'AI']);
export type SupportMessageSenderRole = z.infer<typeof supportMessageSenderRoleEnum>;

// Extended Support Tickets - Enterprise-grade support with SLA
export const supportTicketsExtended = pgTable("support_tickets_extended", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  ticketNumber: varchar("ticket_number").notNull().unique(), // e.g. SUP-2025-000123
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Ticket Details
  category: varchar("category").notNull(), // SOFTWARE_ISSUE, SOFTWARE_BUG, BILLING, etc.
  subject: text("subject").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, URGENT
  status: varchar("status").notNull().default('OPEN'), // OPEN, IN_PROGRESS, AWAITING_USER, ESCALATED, RESOLVED, CLOSED
  
  // SLA Tracking
  slaDueAt: timestamp("sla_due_at"), // When SLA breaches
  firstResponseAt: timestamp("first_response_at"), // When first response was sent
  firstResponseDueAt: timestamp("first_response_due_at"), // When first response SLA breaches
  
  // Escalation
  isEscalated: boolean("is_escalated").default(false),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  escalationReason: text("escalation_reason"),
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  
  // Resolution
  resolutionNote: text("resolution_note"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by").references(() => users.id),
  
  // Metadata
  tags: jsonb("tags").default('[]'),
  metadata: jsonb("metadata").default('{}'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_support_tickets_ext_user").on(table.userId),
  index("idx_support_tickets_ext_status").on(table.status),
  index("idx_support_tickets_ext_priority").on(table.priority),
  index("idx_support_tickets_ext_category").on(table.category),
  index("idx_support_tickets_ext_assigned").on(table.assignedTo),
  index("idx_support_tickets_ext_sla").on(table.slaDueAt),
]);

export const insertSupportTicketExtendedSchema = createInsertSchema(supportTicketsExtended).omit({ id: true, ticketNumber: true, createdAt: true, updatedAt: true });
export type InsertSupportTicketExtended = z.infer<typeof insertSupportTicketExtendedSchema>;
export type SupportTicketExtended = typeof supportTicketsExtended.$inferSelect;

// Extended Support Messages - with sender role and attachments
export const supportMessagesExtended = pgTable("support_messages_extended", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTicketsExtended.id).notNull(),
  
  // Sender Information
  senderRole: varchar("sender_role").notNull(), // USER, ADMIN, SYSTEM, WHATSAPP, AI
  senderId: varchar("sender_id").references(() => users.id),
  senderName: varchar("sender_name"), // Cached for display
  
  // Message Content
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // Admin internal notes - never visible to user
  
  // Attachments
  attachments: jsonb("attachments").default('[]'), // [{filename, url, size, mimeType}]
  
  // AI-specific fields
  aiConfidenceScore: real("ai_confidence_score"), // 0-100 for AI-generated messages
  aiDraftApproved: boolean("ai_draft_approved"), // Whether admin approved AI draft
  aiDraftApprovedBy: varchar("ai_draft_approved_by").references(() => users.id),
  
  // Channel tracking
  sourceChannel: varchar("source_channel").default('WEB'), // WEB, EMAIL, WHATSAPP, API
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_support_messages_ext_ticket").on(table.ticketId),
  index("idx_support_messages_ext_sender").on(table.senderId),
  index("idx_support_messages_ext_internal").on(table.isInternal),
]);

export const insertSupportMessageExtendedSchema = createInsertSchema(supportMessagesExtended).omit({ id: true, createdAt: true });
export type InsertSupportMessageExtended = z.infer<typeof insertSupportMessageExtendedSchema>;
export type SupportMessageExtended = typeof supportMessagesExtended.$inferSelect;

// Support SLA Rules - Priority-based SLA configuration
export const supportSlaRules = pgTable("support_sla_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null = global default
  
  priority: varchar("priority").notNull(), // LOW, MEDIUM, HIGH, URGENT
  firstResponseMinutes: integer("first_response_minutes").notNull(), // e.g. 60, 30, 15, 5
  resolutionMinutes: integer("resolution_minutes").notNull(), // e.g. 2880, 1440, 720, 240
  autoEscalate: boolean("auto_escalate").default(true),
  escalateAfterMinutes: integer("escalate_after_minutes"), // When to auto-escalate
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_support_sla_rules_priority").on(table.priority),
  index("idx_support_sla_rules_tenant").on(table.tenantId),
]);

export const insertSupportSlaRuleSchema = createInsertSchema(supportSlaRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportSlaRule = z.infer<typeof insertSupportSlaRuleSchema>;
export type SupportSlaRule = typeof supportSlaRules.$inferSelect;

// Support Ticket Audit Logs - Immutable, append-only audit trail
export const supportTicketAuditLogs = pgTable("support_ticket_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTicketsExtended.id).notNull(),
  
  action: varchar("action").notNull(), // CREATED, USER_REPLY, ADMIN_REPLY, STATUS_CHANGED, ASSIGNED, ESCALATED, RESOLVED, CLOSED
  
  // Snapshots for compliance
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  
  // Actor information
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role"), // USER, ADMIN, SYSTEM
  actorEmail: varchar("actor_email"),
  
  // Request metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_support_audit_ticket").on(table.ticketId),
  index("idx_support_audit_action").on(table.action),
  index("idx_support_audit_actor").on(table.actorId),
  index("idx_support_audit_created").on(table.createdAt),
]);

export const insertSupportTicketAuditLogSchema = createInsertSchema(supportTicketAuditLogs).omit({ id: true, createdAt: true });
export type InsertSupportTicketAuditLog = z.infer<typeof insertSupportTicketAuditLogSchema>;
export type SupportTicketAuditLog = typeof supportTicketAuditLogs.$inferSelect;

// WhatsApp Ticket Links - Map phone numbers to tickets
export const whatsappTicketLinks = pgTable("whatsapp_ticket_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTicketsExtended.id).notNull(),
  phoneNumber: varchar("phone_number").notNull(), // E.164 format
  countryCode: varchar("country_code").default('+91'),
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_whatsapp_links_ticket").on(table.ticketId),
  index("idx_whatsapp_links_phone").on(table.phoneNumber),
]);

export const insertWhatsappTicketLinkSchema = createInsertSchema(whatsappTicketLinks).omit({ id: true, createdAt: true });
export type InsertWhatsappTicketLink = z.infer<typeof insertWhatsappTicketLinkSchema>;
export type WhatsappTicketLink = typeof whatsappTicketLinks.$inferSelect;

// Support Agents - Agent profiles with expertise and workload
export const supportAgents = pgTable("support_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  role: varchar("role").notNull().default('AGENT'), // AGENT, MANAGER
  isActive: boolean("is_active").default(true),
  isAvailable: boolean("is_available").default(true), // Currently accepting tickets
  
  // Workload
  currentTicketCount: integer("current_ticket_count").default(0),
  maxTicketCapacity: integer("max_ticket_capacity").default(20),
  
  // Expertise areas
  expertise: jsonb("expertise").default('[]'), // ['BILLING', 'SOFTWARE_ISSUE', 'TRAINING']
  
  // Performance metrics
  totalTicketsResolved: integer("total_tickets_resolved").default(0),
  avgResolutionTimeMinutes: real("avg_resolution_time_minutes"),
  avgFirstResponseTimeMinutes: real("avg_first_response_time_minutes"),
  customerSatisfactionScore: real("customer_satisfaction_score"), // 1-5 scale
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_support_agents_user").on(table.userId),
  index("idx_support_agents_active").on(table.isActive),
  index("idx_support_agents_available").on(table.isAvailable),
  index("idx_support_agents_workload").on(table.currentTicketCount),
]);

export const insertSupportAgentSchema = createInsertSchema(supportAgents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportAgent = z.infer<typeof insertSupportAgentSchema>;
export type SupportAgent = typeof supportAgents.$inferSelect;

// Ticket Assignments - Track assignment history
export const ticketAssignments = pgTable("ticket_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTicketsExtended.id).notNull(),
  agentId: varchar("agent_id").references(() => supportAgents.id).notNull(),
  
  assignedBy: varchar("assigned_by").notNull(), // SYSTEM, ADMIN
  assignedByUserId: varchar("assigned_by_user_id").references(() => users.id), // If assigned by admin
  
  // Assignment reason
  reason: varchar("reason"), // INITIAL, REASSIGNMENT, ESCALATION, EXPERTISE_MATCH
  
  // Was this a reassignment?
  previousAgentId: varchar("previous_agent_id").references(() => supportAgents.id),
  
  assignedAt: timestamp("assigned_at").defaultNow(),
  unassignedAt: timestamp("unassigned_at"),
}, (table) => [
  index("idx_ticket_assignments_ticket").on(table.ticketId),
  index("idx_ticket_assignments_agent").on(table.agentId),
  index("idx_ticket_assignments_assigned_at").on(table.assignedAt),
]);

export const insertTicketAssignmentSchema = createInsertSchema(ticketAssignments).omit({ id: true, assignedAt: true });
export type InsertTicketAssignment = z.infer<typeof insertTicketAssignmentSchema>;
export type TicketAssignment = typeof ticketAssignments.$inferSelect;

// ========== AI BRAIN & KNOWLEDGE SYSTEM ==========

// AI Knowledge Base - Structured knowledge for AI responses
export const aiKnowledgeBase = pgTable("ai_knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null = global knowledge
  
  // Categorization
  module: varchar("module").notNull(), // Billing, GST, Support, Quotes, Invoices, etc.
  feature: varchar("feature").notNull(), // Specific feature name
  intent: varchar("intent").notNull(), // What user wants to accomplish
  
  // Content
  title: varchar("title").notNull(),
  content: text("content").notNull(), // Approved explanation / steps
  keywords: jsonb("keywords").default('[]'), // Search keywords
  
  // Status
  isActive: boolean("is_active").default(true),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by").references(() => users.id),
  
  // Versioning
  version: integer("version").default(1),
  previousVersionId: varchar("previous_version_id"),
  
  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_knowledge_module").on(table.module),
  index("idx_ai_knowledge_feature").on(table.feature),
  index("idx_ai_knowledge_intent").on(table.intent),
  index("idx_ai_knowledge_active").on(table.isActive),
]);

export const insertAiKnowledgeBaseSchema = createInsertSchema(aiKnowledgeBase).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiKnowledgeBase = z.infer<typeof insertAiKnowledgeBaseSchema>;
export type AiKnowledgeBase = typeof aiKnowledgeBase.$inferSelect;

// AI Knowledge Audit - Track all changes to AI knowledge
export const aiKnowledgeAudit = pgTable("ai_knowledge_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  knowledgeEntryId: varchar("knowledge_entry_id").references(() => aiKnowledgeBase.id).notNull(),
  
  action: varchar("action").notNull(), // CREATED, UPDATED, PUBLISHED, UNPUBLISHED, DELETED, ROLLBACK
  
  beforeContent: text("before_content"),
  afterContent: text("after_content"),
  changeDetails: jsonb("change_details"), // What specifically changed
  
  actorId: varchar("actor_id").references(() => users.id),
  actorEmail: varchar("actor_email"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_knowledge_audit_entry").on(table.knowledgeEntryId),
  index("idx_ai_knowledge_audit_action").on(table.action),
]);

export const insertAiKnowledgeAuditSchema = createInsertSchema(aiKnowledgeAudit).omit({ id: true, createdAt: true });
export type InsertAiKnowledgeAudit = z.infer<typeof insertAiKnowledgeAuditSchema>;
export type AiKnowledgeAudit = typeof aiKnowledgeAudit.$inferSelect;

// AI Intent Logs - Track user intents for training
export const aiIntentLogs = pgTable("ai_intent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  
  intent: varchar("intent").notNull(),
  source: varchar("source").notNull(), // CHATBOT, SUPPORT, WHATSAPP, SEARCH
  userQuery: text("user_query"), // Original user question
  
  // Resolution
  wasResolved: boolean("was_resolved").default(false),
  knowledgeEntryUsed: varchar("knowledge_entry_used").references(() => aiKnowledgeBase.id),
  
  // Feedback
  userFeedback: varchar("user_feedback"), // HELPFUL, NOT_HELPFUL, null
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_intent_logs_intent").on(table.intent),
  index("idx_ai_intent_logs_source").on(table.source),
  index("idx_ai_intent_logs_resolved").on(table.wasResolved),
  index("idx_ai_intent_logs_created").on(table.createdAt),
]);

export const insertAiIntentLogSchema = createInsertSchema(aiIntentLogs).omit({ id: true, createdAt: true });
export type InsertAiIntentLog = z.infer<typeof insertAiIntentLogSchema>;
export type AiIntentLog = typeof aiIntentLogs.$inferSelect;

// AI Response Confidence - Track AI confidence and decisions
export const aiResponseConfidence = pgTable("ai_response_confidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context
  ticketId: varchar("ticket_id").references(() => supportTicketsExtended.id),
  messageId: varchar("message_id").references(() => supportMessagesExtended.id),
  
  // AI Analysis
  aiIntent: varchar("ai_intent"),
  confidenceScore: real("confidence_score").notNull(), // 0.00 to 100.00
  confidenceLevel: varchar("confidence_level").notNull(), // HIGH, MEDIUM, LOW
  
  // Decision
  actionTaken: varchar("action_taken").notNull(), // AUTO_REPLY, SUGGEST_TICKET, ESCALATE_TO_HUMAN, DRAFT_CREATED
  
  // Response details
  aiDraftResponse: text("ai_draft_response"),
  knowledgeEntriesUsed: jsonb("knowledge_entries_used").default('[]'), // IDs of knowledge entries used
  
  // Human review
  humanReviewed: boolean("human_reviewed").default(false),
  humanReviewedBy: varchar("human_reviewed_by").references(() => users.id),
  humanReviewedAt: timestamp("human_reviewed_at"),
  humanApproved: boolean("human_approved"),
  humanModifiedResponse: text("human_modified_response"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_confidence_ticket").on(table.ticketId),
  index("idx_ai_confidence_level").on(table.confidenceLevel),
  index("idx_ai_confidence_action").on(table.actionTaken),
  index("idx_ai_confidence_reviewed").on(table.humanReviewed),
]);

export const insertAiResponseConfidenceSchema = createInsertSchema(aiResponseConfidence).omit({ id: true, createdAt: true });
export type InsertAiResponseConfidence = z.infer<typeof insertAiResponseConfidenceSchema>;
export type AiResponseConfidence = typeof aiResponseConfidence.$inferSelect;

// AI System Prompts - Version-controlled system prompts
export const aiSystemPrompts = pgTable("ai_system_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  name: varchar("name").notNull(), // SUPPORT_DRAFT_REPLY, CHATBOT_QUERY, SLA_ANALYSIS
  description: text("description"),
  
  // Prompt content
  systemPrompt: text("system_prompt").notNull(),
  
  // Version control
  version: integer("version").default(1),
  isActive: boolean("is_active").default(false), // Only one active per name
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_prompts_name").on(table.name),
  index("idx_ai_prompts_active").on(table.isActive),
]);

export const insertAiSystemPromptSchema = createInsertSchema(aiSystemPrompts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiSystemPrompt = z.infer<typeof insertAiSystemPromptSchema>;
export type AiSystemPrompt = typeof aiSystemPrompts.$inferSelect;

// AI Audit Logs - Comprehensive AI action logging
export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Request info
  requestType: varchar("request_type").notNull(), // DRAFT_REPLY, CHAT, KNOWLEDGE_SEARCH, SLA_ANALYSIS
  requestSource: varchar("request_source").notNull(), // SUPPORT, CHATBOT, ADMIN_PANEL
  requestedBy: varchar("requested_by").references(() => users.id),
  
  // Context provided to AI
  contextProvided: jsonb("context_provided").notNull(), // What data was sent to LLM
  contextHash: varchar("context_hash"), // SHA256 of context for audit
  
  // LLM details
  provider: varchar("provider").notNull(), // claude, openai, gemini
  model: varchar("model").notNull(), // claude-3-opus, gpt-4, etc.
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  
  // Response
  responsePayload: jsonb("response_payload"), // Full LLM response
  confidenceScore: real("confidence_score"),
  
  // Outcome
  status: varchar("status").notNull(), // SUCCESS, FAILED, TIMEOUT, RATE_LIMITED
  errorMessage: text("error_message"),
  latencyMs: integer("latency_ms"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_audit_type").on(table.requestType),
  index("idx_ai_audit_provider").on(table.provider),
  index("idx_ai_audit_status").on(table.status),
  index("idx_ai_audit_created").on(table.createdAt),
]);

export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogs).omit({ id: true, createdAt: true });
export type InsertAiAuditLog = z.infer<typeof insertAiAuditLogSchema>;
export type AiAuditLog = typeof aiAuditLogs.$inferSelect;

// ========== ENTERPRISE INTEGRATION HUB ==========

// Integration Provider Type Enum
export const integrationProviderTypeEnum = z.enum(['LLM', 'WHATSAPP', 'AUTOMATION']);
export type IntegrationProviderType = z.infer<typeof integrationProviderTypeEnum>;

// Integration Providers - LLM, WhatsApp, Automation platforms
export const integrationProviders = pgTable("integration_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  type: varchar("type").notNull(), // LLM, WHATSAPP, AUTOMATION
  name: varchar("name").notNull(), // Claude, OpenAI, Gemini, WABA, WATI, n8n
  code: varchar("code").notNull().unique(), // claude, openai, gemini, waba, wati, n8n
  
  // Status
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // Primary provider for this type
  
  // Regional routing
  region: varchar("region").default('GLOBAL'), // IN, US, EU, GLOBAL
  
  // Configuration
  baseUrl: varchar("base_url"), // API endpoint
  apiVersion: varchar("api_version"),
  
  // Health monitoring
  isHealthy: boolean("is_healthy").default(true),
  lastHealthCheckAt: timestamp("last_health_check_at"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Rate limits
  requestsPerMinute: integer("requests_per_minute"),
  requestsPerDay: integer("requests_per_day"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_providers_type").on(table.type),
  index("idx_integration_providers_code").on(table.code),
  index("idx_integration_providers_active").on(table.isActive),
  index("idx_integration_providers_primary").on(table.isPrimary),
]);

export const insertIntegrationProviderSchema = createInsertSchema(integrationProviders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationProvider = z.infer<typeof insertIntegrationProviderSchema>;
export type IntegrationProvider = typeof integrationProviders.$inferSelect;

// Integration Credentials - Encrypted API keys and secrets
export const integrationCredentials = pgTable("integration_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => integrationProviders.id).notNull(),
  
  keyName: varchar("key_name").notNull(), // api_key, token, webhook_secret, account_sid, etc.
  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM encrypted
  
  // Metadata
  lastRotatedAt: timestamp("last_rotated_at"),
  expiresAt: timestamp("expires_at"),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_creds_provider").on(table.providerId),
  index("idx_integration_creds_key").on(table.keyName),
]);

export const insertIntegrationCredentialSchema = createInsertSchema(integrationCredentials).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationCredential = z.infer<typeof insertIntegrationCredentialSchema>;
export type IntegrationCredential = typeof integrationCredentials.$inferSelect;

// Integration Routes - Primary/Secondary provider routing with failover
export const integrationRoutes = pgTable("integration_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // null = global
  
  integrationType: varchar("integration_type").notNull(), // LLM, WHATSAPP, AUTOMATION
  taskType: varchar("task_type"), // For LLM: CHAT, DRAFT_REPLY, ANALYSIS; For WHATSAPP: SUPPORT, NOTIFICATION
  
  primaryProviderId: varchar("primary_provider_id").references(() => integrationProviders.id).notNull(),
  secondaryProviderId: varchar("secondary_provider_id").references(() => integrationProviders.id),
  
  failoverEnabled: boolean("failover_enabled").default(true),
  failoverThreshold: integer("failover_threshold").default(3), // Failures before failover
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_routes_type").on(table.integrationType),
  index("idx_integration_routes_tenant").on(table.tenantId),
  index("idx_integration_routes_active").on(table.isActive),
]);

export const insertIntegrationRouteSchema = createInsertSchema(integrationRoutes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationRoute = z.infer<typeof insertIntegrationRouteSchema>;
export type IntegrationRoute = typeof integrationRoutes.$inferSelect;

// Integration Audit Logs - Track all external API calls
export const integrationAuditLogs = pgTable("integration_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => integrationProviders.id).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  
  // Request details
  action: varchar("action").notNull(), // SEND_MESSAGE, GENERATE_RESPONSE, TRIGGER_WEBHOOK, etc.
  requestPayload: jsonb("request_payload"), // Sanitized request data
  
  // Response details
  responsePayload: jsonb("response_payload"), // Sanitized response data
  status: varchar("status").notNull(), // SUCCESS, FAILED, TIMEOUT, RATE_LIMITED
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  
  // Performance
  latencyMs: integer("latency_ms"),
  
  // Failover tracking
  wasFailover: boolean("was_failover").default(false),
  failoverFromProviderId: varchar("failover_from_provider_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_integration_audit_provider").on(table.providerId),
  index("idx_integration_audit_status").on(table.status),
  index("idx_integration_audit_action").on(table.action),
  index("idx_integration_audit_created").on(table.createdAt),
]);

export const insertIntegrationAuditLogSchema = createInsertSchema(integrationAuditLogs).omit({ id: true, createdAt: true });
export type InsertIntegrationAuditLog = z.infer<typeof insertIntegrationAuditLogSchema>;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;

// Integration Webhooks - Outbound webhook subscriptions (for n8n, etc.)
export const integrationWebhooks = pgTable("integration_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  
  // Webhook config
  name: varchar("name").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  secretKey: text("secret_key"), // For HMAC signing
  
  // Events to trigger
  eventTypes: jsonb("event_types").notNull(), // ['ticket.created', 'ticket.updated', 'payment.completed']
  
  // Filtering
  filters: jsonb("filters").default('{}'), // e.g., {category: 'BILLING'}
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Retry config
  maxRetries: integer("max_retries").default(3),
  retryDelayMs: integer("retry_delay_ms").default(1000),
  
  // Health
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastSuccessAt: timestamp("last_success_at"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_webhooks_tenant").on(table.tenantId),
  index("idx_integration_webhooks_active").on(table.isActive),
]);

export const insertIntegrationWebhookSchema = createInsertSchema(integrationWebhooks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationWebhook = z.infer<typeof insertIntegrationWebhookSchema>;
export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;

// Integration Webhook Deliveries - Track webhook delivery attempts
export const integrationWebhookDeliveries = pgTable("integration_webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").references(() => integrationWebhooks.id).notNull(),
  
  // Event details
  eventType: varchar("event_type").notNull(),
  eventPayload: jsonb("event_payload").notNull(),
  
  // Delivery status
  status: varchar("status").notNull(), // PENDING, SUCCESS, FAILED, RETRYING
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  
  // Retry tracking
  attemptNumber: integer("attempt_number").default(1),
  nextRetryAt: timestamp("next_retry_at"),
  
  latencyMs: integer("latency_ms"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webhook_deliveries_webhook").on(table.webhookId),
  index("idx_webhook_deliveries_status").on(table.status),
  index("idx_webhook_deliveries_event").on(table.eventType),
  index("idx_webhook_deliveries_created").on(table.createdAt),
]);

export const insertIntegrationWebhookDeliverySchema = createInsertSchema(integrationWebhookDeliveries).omit({ id: true, createdAt: true });
export type InsertIntegrationWebhookDelivery = z.infer<typeof insertIntegrationWebhookDeliverySchema>;
export type IntegrationWebhookDelivery = typeof integrationWebhookDeliveries.$inferSelect;

// Integration Usage Quotas - Track usage per tenant
export const integrationUsageQuotas = pgTable("integration_usage_quotas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  
  integrationType: varchar("integration_type").notNull(), // LLM, WHATSAPP, AUTOMATION
  
  // Quota limits
  dailyLimit: integer("daily_limit"),
  monthlyLimit: integer("monthly_limit"),
  
  // Current usage
  dailyUsed: integer("daily_used").default(0),
  monthlyUsed: integer("monthly_used").default(0),
  
  // Reset tracking
  dailyResetAt: timestamp("daily_reset_at"),
  monthlyResetAt: timestamp("monthly_reset_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_quotas_tenant").on(table.tenantId),
  index("idx_integration_quotas_type").on(table.integrationType),
]);
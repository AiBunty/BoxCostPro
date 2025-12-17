import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // 'owner', 'admin', 'user'
  subscriptionStatus: varchar("subscription_status").default("trial"), // 'trial', 'active', 'expired', 'cancelled'
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Fluting Settings (per user - machine configuration)
export const flutingSettings = pgTable("fluting_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fluteType: varchar("flute_type").notNull(), // 'A', 'B', 'C', 'E', 'F'
  flutingFactor: real("fluting_factor").notNull(),
  fluteHeight: real("flute_height"), // optional flute height in mm
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlutingSettingSchema = createInsertSchema(flutingSettings).omit({ id: true, createdAt: true });
export type InsertFlutingSetting = z.infer<typeof insertFlutingSettingSchema>;
export type FlutingSetting = typeof flutingSettings.$inferSelect;

// Chatbot Widgets (for embedding on customer websites)
export const chatbotWidgets = pgTable("chatbot_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
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

// Company Profiles (per user)
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  companyName: text("company_name").notNull(),
  gstNo: text("gst_no"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  socialMedia: text("social_media"),
  googleLocation: text("google_location"),
  paymentTerms: text("payment_terms").default("100% Advance"),
  deliveryTime: text("delivery_time").default("10 days after receipt of PO"),
  isDefault: boolean("is_default").default(false),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({ id: true });
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyProfile = typeof companyProfiles.$inferSelect;

// Party/Customer Profiles (per user)
export const partyProfiles = pgTable("party_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  personName: text("person_name").notNull(),
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

// Quotes with embedded items (per user)
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  partyName: text("party_name").notNull(),
  customerCompany: text("customer_company"),
  customerEmail: text("customer_email"),
  customerMobile: text("customer_mobile"),
  paymentTerms: text("payment_terms"),
  deliveryDays: text("delivery_days"),
  transportCharge: real("transport_charge"),
  transportRemark: text("transport_remark"),
  totalValue: real("total_value").notNull(),
  items: jsonb("items").notNull(),
  companyProfileId: varchar("company_profile_id"),
  termsSnapshot: jsonb("terms_snapshot"), // Immutable snapshot of quote terms at creation
  paperPricesSnapshot: jsonb("paper_prices_snapshot"), // Snapshot of paper prices used for calculations
  transportSnapshot: jsonb("transport_snapshot"), // Snapshot of transport settings
  moqEnabled: boolean("moq_enabled").default(false), // Minimum order quantity enabled
  moqValue: real("moq_value"), // MOQ amount if enabled
  paymentType: varchar("payment_type").default("advance"), // 'advance', 'credit', 'partial'
  advancePercent: integer("advance_percent"),
  creditDays: integer("credit_days"),
  customDeliveryText: text("custom_delivery_text"),
  quoteNumber: varchar("quote_number"), // Optional user-readable quote number
  validUntil: timestamp("valid_until"), // Quote validity date
  status: varchar("status").default("draft"), // 'draft', 'sent', 'accepted', 'rejected', 'expired'
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// App Settings (per user)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
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

// Rate Memory for Paper (BF + Shade combinations) - per user
export const rateMemory = pgTable("rate_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
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

// ========== PAPER PRICE SETUP (per user) ==========

// Legacy Paper Prices table (deprecated - use paper_bf_prices instead)
export const paperPrices = pgTable("paper_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
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

// BF-Based Paper Prices - Base price defined ONLY by BF (Bursting Factor)
export const paperBfPrices = pgTable("paper_bf_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bf: integer("bf").notNull(), // Bursting Factor (e.g., 18, 20, 22, 25)
  basePrice: real("base_price").notNull(), // Base price per Kg for this BF
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaperBfPriceSchema = createInsertSchema(paperBfPrices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaperBfPrice = z.infer<typeof insertPaperBfPriceSchema>;
export type PaperBfPrice = typeof paperBfPrices.$inferSelect;

// Shade Premiums - User-defined premium for paper shades (e.g., Golden)
export const shadePremiums = pgTable("shade_premiums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  shade: varchar("shade").notNull(), // 'Golden', 'White', 'Kraft', etc.
  premium: real("premium").notNull().default(0), // Premium amount to add per Kg
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShadePremiumSchema = createInsertSchema(shadePremiums).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShadePremium = z.infer<typeof insertShadePremiumSchema>;
export type ShadePremium = typeof shadePremiums.$inferSelect;

// Paper Pricing Rules table - stores user's GSM adjustment rules and market adjustment
export const paperPricingRules = pgTable("paper_pricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(), // One rule set per user
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
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
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

// Master table for unique box specifications
export const boxSpecifications = pgTable("box_specifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
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

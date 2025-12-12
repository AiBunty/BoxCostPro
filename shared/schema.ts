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
  createdAt: timestamp("created_at").defaultNow(),
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
  rate: z.number(),
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
  
  // Selection for sending via WhatsApp/Email
  selected: z.boolean().default(true),
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type LayerSpec = z.infer<typeof layerSpecSchema>;

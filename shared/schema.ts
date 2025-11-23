import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Company Profiles
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Party/Customer Profiles
export const partyProfiles = pgTable("party_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Quotes with embedded items
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyName: text("party_name").notNull(),
  customerCompany: text("customer_company"),
  customerEmail: text("customer_email"),
  customerMobile: text("customer_mobile"),
  totalValue: real("total_value").notNull(),
  items: jsonb("items").notNull(), // Array of quote items
  companyProfileId: varchar("company_profile_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// App Settings
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Zod schemas for nested data structures
export const layerSpecSchema = z.object({
  layerIndex: z.number(), // 0-indexed layer number
  layerType: z.enum(['liner', 'flute']),
  gsm: z.number(),
  bf: z.number().optional(),
  flutingFactor: z.number().optional(), // Manual fluting factor
  rctValue: z.number().optional(), // RCT value for the layer
  shade: z.string(),
  rate: z.number(),
});

export const quoteItemSchema = z.object({
  type: z.enum(['rsc', 'sheet']),
  boxName: z.string(),
  boxDescription: z.string().optional(),
  ply: z.enum(['1', '3', '5', '7', '9']),
  
  // Dimensional metadata
  inputUnit: z.enum(['mm', 'inches']).default('mm'),
  measuredOn: z.enum(['ID', 'OD']).default('ID'),
  plyThicknessUsed: z.number().optional(),
  
  // Dimensions (stored in mm)
  length: z.number(),
  width: z.number(),
  height: z.number().optional(), // Only for RSC
  
  // Allowances and thresholds
  glueFlap: z.number().optional(),
  deckleAllowance: z.number().optional(),
  sheetAllowance: z.number().optional(),
  maxLengthThreshold: z.number().optional(),
  additionalFlapApplied: z.boolean().default(false),
  
  // Calculated sheet sizes
  sheetLength: z.number(),
  sheetWidth: z.number(),
  sheetLengthInches: z.number(),
  sheetWidthInches: z.number(),
  sheetWeight: z.number(), // Kg
  
  // Strength analysis
  boardThickness: z.number(),
  boxPerimeter: z.number(),
  ect: z.number(), // Edge Crush Test (kN/m)
  bct: z.number(), // Box Compression Test (Kg)
  bs: z.number(), // Burst Strength (kg/cm)
  
  // Paper specifications (layer by layer)
  layerSpecs: z.array(layerSpecSchema),
  
  // Costs
  paperCost: z.number(),
  printingCost: z.number().default(0),
  laminationCost: z.number().default(0),
  varnishCost: z.number().default(0),
  dieCost: z.number().default(0),
  punchingCost: z.number().default(0),
  totalCostPerBox: z.number(),
  quantity: z.number(),
  totalValue: z.number(),
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type LayerSpec = z.infer<typeof layerSpecSchema>;

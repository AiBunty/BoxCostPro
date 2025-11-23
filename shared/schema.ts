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

// Zod schemas for nested data structures
export const quoteItemSchema = z.object({
  type: z.enum(['rsc', 'sheet']),
  boxName: z.string(),
  ply: z.enum(['1', '3', '5', '7', '9']),
  
  // Dimensions (mm)
  length: z.number(),
  width: z.number(),
  height: z.number().optional(), // Only for RSC
  
  // Calculated values
  sheetLength: z.number(),
  sheetWidth: z.number(),
  sheetWeight: z.number(),
  bs: z.number(), // Burst Strength
  
  // Paper specifications (simplified)
  paperSpecs: z.record(z.object({
    gsm: z.number(),
    bf: z.number().optional(),
    shade: z.string(),
    rate: z.number(),
  })),
  
  // Costs
  paperCost: z.number(),
  additionalCosts: z.record(z.number()),
  totalCostPerBox: z.number(),
  quantity: z.number(),
  totalValue: z.number(),
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, boolean, jsonb, timestamp, index, primaryKey, check, uuid, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * ========================================================================
 * PLATFORM ENTITLEMENT & SUBSCRIPTION ARCHITECTURE
 * ========================================================================
 * 
 * CORE PRINCIPLES:
 * 1. EntitlementService is the ONLY authority for access decisions
 * 2. Admin APIs can mutate state; User APIs can only consume decisions
 * 3. Subscriptions are platform-owned, user-read-only
 * 4. Overrides are explicit, temporary, and audited
 * 5. All admin actions emit platform events
 * 6. No business logic in frontend
 * 
 * BOUNDARIES:
 * - /api/admin/* : Platform administration (mutation allowed)
 * - /api/user/*  : User application (read-only entitlements)
 * - EntitlementService: Pure function, no side effects
 */

// ========== SUBSCRIPTION OVERRIDES ==========
// Admin-controlled temporary entitlement overrides

export const subscriptionOverrides = pgTable("subscription_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // FK to users (enforced at app level)
  subscriptionId: varchar("subscription_id"), // Optional FK to user_subscriptions
  
  // Override type and scope
  overrideType: varchar("override_type", { length: 32 }).notNull(), // 'FEATURE_UNLOCK', 'QUOTA_INCREASE', 'TRIAL_EXTENSION', 'EMERGENCY_ACCESS'
  featureKey: varchar("feature_key", { length: 64 }), // e.g., 'apiAccess', 'maxQuotes'
  
  // Override values
  booleanValue: boolean("boolean_value"), // For feature flags
  integerValue: integer("integer_value"), // For quota increases
  jsonValue: jsonb("json_value"), // For complex overrides
  
  // Temporal constraints (REQUIRED - no perpetual overrides)
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // MUST have expiry
  
  // Audit and governance
  reason: text("reason").notNull(), // Why this override was granted
  adminId: varchar("admin_id").notNull(), // Admin who created override
  approvalTicketId: varchar("approval_ticket_id"), // Optional reference to support ticket
  
  // State
  isActive: boolean("is_active").default(true),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: varchar("deactivated_by"),
  deactivationReason: text("deactivation_reason"),
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for performance
  index("idx_sub_overrides_user").on(table.userId),
  index("idx_sub_overrides_active").on(table.isActive, table.expiresAt),
  index("idx_sub_overrides_feature").on(table.featureKey),
  
  // Constraints for data integrity
  check("expiry_required", sql`${table.expiresAt} > ${table.startsAt}`),
  check("override_value_required", sql`${table.booleanValue} IS NOT NULL OR ${table.integerValue} IS NOT NULL OR ${table.jsonValue} IS NOT NULL`),
]);

export const insertSubscriptionOverrideSchema = createInsertSchema(subscriptionOverrides).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSubscriptionOverride = z.infer<typeof insertSubscriptionOverrideSchema>;
export type SubscriptionOverride = typeof subscriptionOverrides.$inferSelect;

// ========== PLATFORM EVENTS ==========
// Immutable event log for all platform state changes

export const platformEvents = pgTable("platform_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event classification
  eventType: varchar("event_type", { length: 64 }).notNull(), // 'SUBSCRIPTION_CREATED', 'OVERRIDE_GRANTED', 'FEATURE_TOGGLED'
  eventCategory: varchar("event_category", { length: 32 }).notNull(), // 'SUBSCRIPTION', 'ENTITLEMENT', 'ADMIN_ACTION', 'PAYMENT'
  
  // Event subjects (who/what was affected)
  userId: varchar("user_id"), // Affected user
  tenantId: varchar("tenant_id"), // Affected tenant
  subscriptionId: varchar("subscription_id"), // Affected subscription
  
  // Event source (who/what triggered it)
  actorType: varchar("actor_type", { length: 16 }).notNull(), // 'ADMIN', 'USER', 'SYSTEM', 'CRON'
  actorId: varchar("actor_id"), // Admin ID, User ID, or system identifier
  
  // Event payload
  eventData: jsonb("event_data").notNull().default('{}'), // Structured event data
  previousState: jsonb("previous_state"), // State before change (for reversibility)
  newState: jsonb("new_state"), // State after change
  
  // Context and metadata
  correlationId: varchar("correlation_id"), // Group related events
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  
  // Processing state (for async event handlers)
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  
  // Immutable timestamp
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (table) => [
  // Indexes for querying and auditing
  index("idx_platform_events_type").on(table.eventType),
  index("idx_platform_events_category").on(table.eventCategory),
  index("idx_platform_events_user").on(table.userId),
  index("idx_platform_events_tenant").on(table.tenantId),
  index("idx_platform_events_actor").on(table.actorType, table.actorId),
  index("idx_platform_events_occurred").on(table.occurredAt),
  index("idx_platform_events_unprocessed").on(table.processed, table.occurredAt),
  index("idx_platform_events_correlation").on(table.correlationId),
]);

export const insertPlatformEventSchema = createInsertSchema(platformEvents).omit({ 
  id: true, 
  occurredAt: true,
  processed: true,
  processedAt: true 
});
export type InsertPlatformEvent = z.infer<typeof insertPlatformEventSchema>;
export type PlatformEvent = typeof platformEvents.$inferSelect;

// ========== ENTITLEMENT CACHE ==========
// Denormalized cache for fast entitlement lookups

export const entitlementCache = pgTable("entitlement_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  tenantId: varchar("tenant_id"),
  
  // Cached entitlement decisions (computed by EntitlementService)
  features: jsonb("features").notNull().default('{}'), // { apiAccess: true, whatsappIntegration: false, ... }
  quotas: jsonb("quotas").notNull().default('{}'), // { maxQuotes: 100, maxEmailProviders: 3, ... }
  usage: jsonb("usage").notNull().default('{}'), // { quotesUsed: 45, emailProvidersUsed: 2, ... }
  
  // Source subscription data (for debugging)
  subscriptionStatus: varchar("subscription_status", { length: 32 }).notNull(),
  planId: varchar("plan_id"),
  activeOverridesCount: integer("active_overrides_count").default(0),
  
  // Cache metadata
  computedAt: timestamp("computed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Cache TTL
  computationVersion: integer("computation_version").default(1), // For cache invalidation
  
  // Audit
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0),
}, (table) => [
  index("idx_entitlement_cache_user").on(table.userId),
  index("idx_entitlement_cache_expires").on(table.expiresAt),
]);

export const insertEntitlementCacheSchema = createInsertSchema(entitlementCache).omit({ 
  id: true, 
  computedAt: true 
});
export type InsertEntitlementCache = z.infer<typeof insertEntitlementCacheSchema>;
export type EntitlementCache = typeof entitlementCache.$inferSelect;

// ========== CONSISTENCY CHECK LOGS ==========
// Track nightly consistency validation jobs

export const consistencyCheckLogs = pgTable("consistency_check_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Check identification
  checkType: varchar("check_type", { length: 64 }).notNull(), // 'EXPIRED_OVERRIDES', 'INVALID_SUBSCRIPTIONS', 'ORPHANED_CACHES'
  checkCategory: varchar("check_category", { length: 32 }).notNull(), // 'ENTITLEMENT', 'SUBSCRIPTION', 'DATA_INTEGRITY'
  
  // Results
  status: varchar("status", { length: 16 }).notNull(), // 'PASSED', 'FAILED', 'WARNINGS'
  recordsChecked: integer("records_checked").default(0),
  issuesFound: integer("issues_found").default(0),
  issuesResolved: integer("issues_resolved").default(0),
  
  // Details
  checkResults: jsonb("check_results").default('{}'), // Detailed findings
  errors: jsonb("errors"), // Any errors during check
  
  // Timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
}, (table) => [
  index("idx_consistency_checks_type").on(table.checkType),
  index("idx_consistency_checks_started").on(table.startedAt),
]);

export const insertConsistencyCheckLogSchema = createInsertSchema(consistencyCheckLogs).omit({ 
  id: true, 
  startedAt: true 
});
export type InsertConsistencyCheckLog = z.infer<typeof insertConsistencyCheckLogSchema>;
export type ConsistencyCheckLog = typeof consistencyCheckLogs.$inferSelect;

// ========== WEBHOOK SUBSCRIPTIONS TABLE ==========

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().notNull(),
  url: text("url").notNull(),
  eventFilter: jsonb("event_filter").default({}).notNull(),
  secret: text("secret").notNull(), // HMAC key
  maxRetries: integer("max_retries").default(5).notNull(),
  retryDelaySeconds: integer("retry_delay_seconds").default(60).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
}, (table) => [
  index("idx_webhook_subs_active").on(table.isActive),
  index("idx_webhook_subs_created").on(table.createdAt),
]);

export const insertWebhookSubscriptionSchema = createInsertSchema(webhookSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWebhookSubscription = z.infer<typeof insertWebhookSubscriptionSchema>;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;

// ========== WEBHOOK DELIVERIES TABLE (Delivery Log) ==========

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().notNull(),
  webhookId: uuid("webhook_id").notNull(),
  eventId: uuid("event_id"),
  eventType: text("event_type").notNull(),
  eventCategory: text("event_category"),
  status: text("status").default('PENDING').notNull(), // PENDING | DELIVERED | FAILED | DEAD_LETTERED
  payload: jsonb("payload").notNull(),
  response: jsonb("response"),
  attemptNumber: integer("attempt_number").default(0).notNull(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  lastError: text("last_error"),
  maxRetries: integer("max_retries").default(5),
  retryDelaySeconds: integer("retry_delay_seconds").default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
  isArchived: boolean("is_archived").default(false),
}, (table) => [
  index("idx_webhook_deliveries_webhook").on(table.webhookId),
  index("idx_webhook_deliveries_status").on(table.status),
  index("idx_webhook_deliveries_created").on(table.createdAt),
  index("idx_webhook_deliveries_archived").on(table.isArchived),
]);

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({
  id: true,
  createdAt: true,
});
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ========== INTEGRATIONS TABLE ==========

export const integrations = pgTable("integrations", {
  id: text("id").primaryKey().notNull(),
  category: text("category").notNull(), // EMAIL | MESSAGING | ANALYTICS | IDENTITY | DATABASE | STORAGE
  provider: text("provider").notNull(),
  status: text("status").default('UNCONFIGURED').notNull(),
  isEnabled: boolean("is_enabled").default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  connectedBy: uuid("connected_by"),
  lastHealthStatus: text("last_health_status"), // HEALTHY | UNHEALTHY
  lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
  lastHealthMessage: text("last_health_message"),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_integrations_enabled").on(table.isEnabled),
  index("idx_integrations_category").on(table.category),
  index("idx_integrations_status").on(table.status),
]);

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// ========== INTEGRATION CREDENTIALS TABLE (Encrypted) ==========

export const integrationCredentials = pgTable("integration_credentials", {
  id: uuid("id").primaryKey().notNull(),
  integrationId: text("integration_id").notNull(),
  credentialKey: text("credential_key").notNull(),
  credentialValue: text("credential_value").notNull(), // Encrypted
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
}, (table) => [
  index("idx_creds_integration").on(table.integrationId),
  index("idx_creds_key").on(table.credentialKey),
  unique("uq_creds_integration_key").on(table.integrationId, table.credentialKey),
]);

export const insertIntegrationCredentialSchema = createInsertSchema(integrationCredentials).omit({
  id: true,
  createdAt: true,
});
export type InsertIntegrationCredential = z.infer<typeof insertIntegrationCredentialSchema>;
export type IntegrationCredential = typeof integrationCredentials.$inferSelect;


export const actorTypeEnum = z.enum(['ADMIN', 'USER', 'SYSTEM', 'CRON']);
export type ActorType = z.infer<typeof actorTypeEnum>;

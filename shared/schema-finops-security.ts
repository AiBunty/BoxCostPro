/**
 * FinOps & Security Hardening Schema Extensions
 * 
 * This file extends the main schema with:
 * 1. FinOps: Cost governance, usage limits, budgets
 * 2. Security: Tenant isolation, violation logging, immutability
 * 3. Compliance: Data retention, purge policies, audit exports
 * 4. Governance: Kill-switches, incident mode, provider health
 */

import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  boolean, 
  jsonb, 
  timestamp, 
  index,
  decimal,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Forward references to main schema tables
// These will be imported from ./schema in actual usage
const users = { id: varchar("id") } as any;
const tenants = { id: varchar("id") } as any;

// ============================================================================
// 💰 FINOPS: AI USAGE LIMITS & COST GOVERNANCE
// ============================================================================

/**
 * AI Usage Limits - Tenant-level budget controls for AI services
 */
export const aiUsageLimits = pgTable("ai_usage_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Token limits
  monthlyTokenLimit: integer("monthly_token_limit").default(1000000), // 1M tokens default
  dailyRequestLimit: integer("daily_request_limit").default(500),
  
  // Cost limits (in USD cents for precision)
  monthlyBudgetCents: integer("monthly_budget_cents").default(5000), // $50 default
  dailyBudgetCents: integer("daily_budget_cents").default(500), // $5 default
  
  // Hard stop vs soft warning
  hardStop: boolean("hard_stop").default(false), // true = block AI if exceeded
  warningThresholdPercent: integer("warning_threshold_percent").default(80),
  
  // Current usage tracking
  tokensUsedThisMonth: integer("tokens_used_this_month").default(0),
  requestsToday: integer("requests_today").default(0),
  costThisMonthCents: integer("cost_this_month_cents").default(0),
  costTodayCents: integer("cost_today_cents").default(0),
  
  // Reset tracking
  dailyResetAt: timestamp("daily_reset_at"),
  monthlyResetAt: timestamp("monthly_reset_at"),
  
  // Notifications
  lastWarningNotifiedAt: timestamp("last_warning_notified_at"),
  lastLimitNotifiedAt: timestamp("last_limit_notified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_ai_usage_limits_tenant").on(table.tenantId),
]);

export const insertAiUsageLimitSchema = createInsertSchema(aiUsageLimits).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiUsageLimit = z.infer<typeof insertAiUsageLimitSchema>;
export type AiUsageLimit = typeof aiUsageLimits.$inferSelect;

// AI Usage Source enum
export const aiUsageSourceEnum = z.enum([
  'CHATBOT',
  'SUPPORT_DRAFT',
  'ADMIN_DRAFT',
  'KNOWLEDGE_SEARCH',
  'AUTO_CATEGORIZATION',
  'SENTIMENT_ANALYSIS',
  'OTHER',
]);
export type AiUsageSource = z.infer<typeof aiUsageSourceEnum>;

/**
 * AI Usage Logs - Detailed per-request tracking for cost attribution
 */
export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id"),
  
  // Provider & model
  provider: varchar("provider").notNull(), // OPENAI, CLAUDE, GEMINI
  model: varchar("model").notNull(), // gpt-4o, claude-3-sonnet, etc.
  
  // Token usage
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  
  // Cost calculation (in USD cents for precision)
  costCents: integer("cost_cents").notNull(),
  
  // Usage context
  source: varchar("source").notNull(), // CHATBOT, SUPPORT_DRAFT, ADMIN_DRAFT, etc.
  relatedEntityType: varchar("related_entity_type"), // ticket, chat_session, etc.
  relatedEntityId: varchar("related_entity_id"),
  
  // Performance
  latencyMs: integer("latency_ms"),
  wasFailover: boolean("was_failover").default(false),
  
  // Status
  status: varchar("status").notNull(), // SUCCESS, FAILED, BLOCKED, RATE_LIMITED
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_usage_logs_tenant").on(table.tenantId),
  index("idx_ai_usage_logs_provider").on(table.provider),
  index("idx_ai_usage_logs_source").on(table.source),
  index("idx_ai_usage_logs_created").on(table.createdAt),
  index("idx_ai_usage_logs_tenant_month").on(table.tenantId, table.createdAt),
]);

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({ id: true, createdAt: true });
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;

/**
 * AI Cost Rates - Configurable pricing per provider/model
 */
export const aiCostRates = pgTable("ai_cost_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  provider: varchar("provider").notNull(), // OPENAI, CLAUDE, GEMINI
  model: varchar("model").notNull(),
  
  // Cost per 1K tokens in USD cents (for precision)
  promptCostPer1kCents: integer("prompt_cost_per_1k_cents").notNull(),
  completionCostPer1kCents: integer("completion_cost_per_1k_cents").notNull(),
  
  // Effective dates
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_cost_rates_provider_model").on(table.provider, table.model),
  index("idx_ai_cost_rates_active").on(table.isActive),
]);

export const insertAiCostRateSchema = createInsertSchema(aiCostRates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiCostRate = z.infer<typeof insertAiCostRateSchema>;
export type AiCostRate = typeof aiCostRates.$inferSelect;

// ============================================================================
// 📲 FINOPS: MESSAGING USAGE LIMITS
// ============================================================================

// Messaging channel enum
export const messagingChannelEnum = z.enum(['WHATSAPP', 'EMAIL', 'SMS']);
export type MessagingChannel = z.infer<typeof messagingChannelEnum>;

/**
 * Messaging Usage Limits - Per-tenant rate limiting for messaging channels
 */
export const messagingUsageLimits = pgTable("messaging_usage_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  channel: varchar("channel").notNull(), // WHATSAPP, EMAIL, SMS
  
  // Limits
  dailyLimit: integer("daily_limit").default(100),
  monthlyLimit: integer("monthly_limit").default(2000),
  
  // Current usage
  dailyUsed: integer("daily_used").default(0),
  monthlyUsed: integer("monthly_used").default(0),
  
  // Cost tracking (for paid channels like SMS/WhatsApp)
  costThisMonthCents: integer("cost_this_month_cents").default(0),
  
  // Reset tracking
  dailyResetAt: timestamp("daily_reset_at"),
  monthlyResetAt: timestamp("monthly_reset_at"),
  
  // Queue behavior
  queueOnLimit: boolean("queue_on_limit").default(false), // Queue messages when limit exceeded
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_messaging_limits_tenant_channel").on(table.tenantId, table.channel),
]);

export const insertMessagingUsageLimitSchema = createInsertSchema(messagingUsageLimits).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessagingUsageLimit = z.infer<typeof insertMessagingUsageLimitSchema>;
export type MessagingUsageLimit = typeof messagingUsageLimits.$inferSelect;

/**
 * Messaging Usage Logs - Track all outbound messages
 */
export const messagingUsageLogs = pgTable("messaging_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id"),
  
  channel: varchar("channel").notNull(), // WHATSAPP, EMAIL, SMS
  provider: varchar("provider").notNull(), // WABA, WATI, TWILIO, SENDGRID, etc.
  
  // Message details
  messageType: varchar("message_type").notNull(), // TEXT, TEMPLATE, DOCUMENT, IMAGE
  recipientHash: varchar("recipient_hash").notNull(), // Hashed phone/email for privacy
  
  // Cost
  costCents: integer("cost_cents").default(0),
  
  // Status
  status: varchar("status").notNull(), // SENT, DELIVERED, READ, FAILED, BLOCKED, QUEUED
  errorMessage: text("error_message"),
  
  // Related entity
  relatedEntityType: varchar("related_entity_type"), // ticket, invoice, quote
  relatedEntityId: varchar("related_entity_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messaging_logs_tenant").on(table.tenantId),
  index("idx_messaging_logs_channel").on(table.channel),
  index("idx_messaging_logs_status").on(table.status),
  index("idx_messaging_logs_created").on(table.createdAt),
]);

export const insertMessagingUsageLogSchema = createInsertSchema(messagingUsageLogs).omit({ id: true, createdAt: true });
export type InsertMessagingUsageLog = z.infer<typeof insertMessagingUsageLogSchema>;
export type MessagingUsageLog = typeof messagingUsageLogs.$inferSelect;

// ============================================================================
// 🧭 FINOPS: PROVIDER HEALTH METRICS
// ============================================================================

/**
 * Provider Health Metrics - Track reliability for auto-failover decisions
 */
export const providerHealthMetrics = pgTable("provider_health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  providerCode: varchar("provider_code").notNull(), // OPENAI, CLAUDE, WABA, etc.
  providerType: varchar("provider_type").notNull(), // LLM, MESSAGING, AUTOMATION
  
  // Health metrics (rolling 24h)
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // 0.00 to 100.00
  avgLatencyMs: integer("avg_latency_ms"),
  p95LatencyMs: integer("p95_latency_ms"),
  
  // Request counts
  totalRequests24h: integer("total_requests_24h").default(0),
  failedRequests24h: integer("failed_requests_24h").default(0),
  
  // Circuit breaker state
  circuitState: varchar("circuit_state").default('CLOSED'), // CLOSED, OPEN, HALF_OPEN
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Last events
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  lastFailureReason: text("last_failure_reason"),
  
  // Priority (for failover ordering)
  priority: integer("priority").default(1),
  isActive: boolean("is_active").default(true),
  isDemoted: boolean("is_demoted").default(false), // Auto-demoted due to health
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_health_metrics_provider").on(table.providerCode),
  index("idx_health_metrics_type").on(table.providerType),
  index("idx_health_metrics_active").on(table.isActive),
]);

export const insertProviderHealthMetricSchema = createInsertSchema(providerHealthMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProviderHealthMetric = z.infer<typeof insertProviderHealthMetricSchema>;
export type ProviderHealthMetric = typeof providerHealthMetrics.$inferSelect;

// ============================================================================
// 🔐 SECURITY: VIOLATION LOGGING & TENANT ISOLATION
// ============================================================================

// Violation type enum
export const violationTypeEnum = z.enum([
  'CROSS_TENANT_ACCESS',
  'PRIVILEGE_ESCALATION',
  'UNAUTHORIZED_RESOURCE',
  'RATE_LIMIT_EXCEEDED',
  'INVALID_TOKEN',
  'FORBIDDEN_ACTION',
  'DATA_EXFILTRATION_ATTEMPT',
  'SUSPICIOUS_PATTERN',
]);
export type ViolationType = z.infer<typeof violationTypeEnum>;

/**
 * Security Violation Logs - Track attempted unauthorized access
 */
export const securityViolationLogs = pgTable("security_violation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id"),
  tenantId: varchar("tenant_id"),
  
  // Violation details
  violationType: varchar("violation_type").notNull(),
  attemptedAction: text("attempted_action").notNull(),
  targetResource: varchar("target_resource"), // Table/endpoint accessed
  targetResourceId: varchar("target_resource_id"),
  targetTenantId: varchar("target_tenant_id"), // For cross-tenant attempts
  
  // Context
  reason: text("reason").notNull(), // Why it was blocked
  requestPath: varchar("request_path"),
  requestMethod: varchar("request_method"),
  requestPayload: jsonb("request_payload"), // Sanitized
  
  // Client info
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Severity
  severity: varchar("severity").default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  
  // Follow-up
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_security_violations_user").on(table.userId),
  index("idx_security_violations_tenant").on(table.tenantId),
  index("idx_security_violations_type").on(table.violationType),
  index("idx_security_violations_severity").on(table.severity),
  index("idx_security_violations_created").on(table.createdAt),
]);

export const insertSecurityViolationLogSchema = createInsertSchema(securityViolationLogs).omit({ id: true, createdAt: true });
export type InsertSecurityViolationLog = z.infer<typeof insertSecurityViolationLogSchema>;
export type SecurityViolationLog = typeof securityViolationLogs.$inferSelect;

// AI Security incident types
export const aiSecurityIncidentTypeEnum = z.enum([
  'PROMPT_INJECTION',
  'JAILBREAK_ATTEMPT',
  'PII_DETECTED',
  'HARMFUL_CONTENT',
  'CONTEXT_LIMIT_EXCEEDED',
  'OUTPUT_VALIDATION_FAILED',
  'RATE_ABUSE',
  'SUSPICIOUS_PATTERN',
]);
export type AiSecurityIncidentType = z.infer<typeof aiSecurityIncidentTypeEnum>;

/**
 * AI Security Logs - Track AI-specific security events
 */
export const aiSecurityLogs = pgTable("ai_security_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id"),
  
  // Incident details
  incidentType: varchar("incident_type").notNull(),
  
  // Input that triggered the incident
  inputExcerpt: text("input_excerpt"), // Sanitized/truncated
  inputHash: varchar("input_hash"), // For deduplication
  
  // Detection details
  detectionMethod: varchar("detection_method"), // PATTERN_MATCH, ML_DETECTION, HEURISTIC
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  matchedPatterns: jsonb("matched_patterns"),
  
  // Action taken
  actionTaken: varchar("action_taken").notNull(), // BLOCKED, SANITIZED, FLAGGED, ESCALATED
  actionDetails: text("action_details"),
  
  // Related request
  relatedRequestId: varchar("related_request_id"),
  provider: varchar("provider"),
  model: varchar("model"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_security_tenant").on(table.tenantId),
  index("idx_ai_security_type").on(table.incidentType),
  index("idx_ai_security_action").on(table.actionTaken),
  index("idx_ai_security_created").on(table.createdAt),
]);

export const insertAiSecurityLogSchema = createInsertSchema(aiSecurityLogs).omit({ id: true, createdAt: true });
export type InsertAiSecurityLog = z.infer<typeof insertAiSecurityLogSchema>;
export type AiSecurityLog = typeof aiSecurityLogs.$inferSelect;

// ============================================================================
// 🔐 SECURITY: GOVERNANCE & KILL SWITCHES
// ============================================================================

// Governance toggle types
export const governanceToggleTypeEnum = z.enum([
  'AI_ENABLED',
  'WHATSAPP_ENABLED',
  'EMAIL_ENABLED',
  'SMS_ENABLED',
  'OUTBOUND_MESSAGING',
  'READ_ONLY_MODE',
  'NEW_SIGNUPS',
  'API_ACCESS',
  'WEBHOOKS_ENABLED',
  'PROVIDER_SPECIFIC', // Used with providerId
]);
export type GovernanceToggleType = z.infer<typeof governanceToggleTypeEnum>;

// Governance scope
export const governanceScopeEnum = z.enum(['GLOBAL', 'TENANT', 'PROVIDER']);
export type GovernanceScope = z.infer<typeof governanceScopeEnum>;

/**
 * Governance Toggles - Global and tenant-level feature switches
 */
export const governanceToggles = pgTable("governance_toggles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Scope
  scope: varchar("scope").notNull(), // GLOBAL, TENANT, PROVIDER
  tenantId: varchar("tenant_id"), // null for GLOBAL
  providerId: varchar("provider_id"), // for PROVIDER scope
  
  // Toggle
  toggleType: varchar("toggle_type").notNull(),
  isEnabled: boolean("is_enabled").notNull(),
  
  // Context
  reason: text("reason"),
  expiresAt: timestamp("expires_at"), // Auto-revert time
  
  // Audit
  changedBy: varchar("changed_by").notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  previousValue: boolean("previous_value"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_governance_scope").on(table.scope),
  index("idx_governance_tenant").on(table.tenantId),
  index("idx_governance_type").on(table.toggleType),
  index("idx_governance_enabled").on(table.isEnabled),
]);

export const insertGovernanceToggleSchema = createInsertSchema(governanceToggles).omit({ id: true, createdAt: true, updatedAt: true, changedAt: true });
export type InsertGovernanceToggle = z.infer<typeof insertGovernanceToggleSchema>;
export type GovernanceToggle = typeof governanceToggles.$inferSelect;

// Incident mode types
export const incidentModeTypeEnum = z.enum([
  'INCIDENT_MODE',
  'READ_ONLY_MODE',
  'MAINTENANCE_MODE',
  'EMERGENCY_LOCKDOWN',
]);
export type IncidentModeType = z.infer<typeof incidentModeTypeEnum>;

/**
 * Incident Mode State - Platform-wide emergency controls
 */
export const incidentModeState = pgTable("incident_mode_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Mode
  modeType: varchar("mode_type").notNull(),
  isActive: boolean("is_active").notNull(),
  
  // Affected scope
  affectedTenants: jsonb("affected_tenants"), // null = all tenants
  affectedFeatures: jsonb("affected_features"), // What's disabled
  
  // Incident details
  incidentId: varchar("incident_id"),
  incidentDescription: text("incident_description"),
  
  // Timeline
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by"),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: varchar("deactivated_by"),
  
  // Auto-revert
  autoDeactivateAt: timestamp("auto_deactivate_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_incident_mode_type").on(table.modeType),
  index("idx_incident_mode_active").on(table.isActive),
]);

export const insertIncidentModeStateSchema = createInsertSchema(incidentModeState).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIncidentModeState = z.infer<typeof insertIncidentModeStateSchema>;
export type IncidentModeState = typeof incidentModeState.$inferSelect;

// ============================================================================
// 📜 COMPLIANCE: DATA RETENTION & PURGE POLICIES
// ============================================================================

/**
 * Data Retention Policies - Configurable retention rules
 */
export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target
  entityType: varchar("entity_type").notNull(), // AUDIT_LOG, INVOICE, SUPPORT_TICKET, AI_USAGE_LOG, etc.
  
  // Retention
  retentionDays: integer("retention_days").notNull(), // -1 = permanent
  archiveBeforePurge: boolean("archive_before_purge").default(true),
  
  // Policy details
  description: text("description"),
  legalBasis: text("legal_basis"), // Compliance reason
  
  // Status
  isActive: boolean("is_active").default(true),
  lastExecutedAt: timestamp("last_executed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_retention_entity").on(table.entityType),
  index("idx_retention_active").on(table.isActive),
]);

export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDataRetentionPolicy = z.infer<typeof insertDataRetentionPolicySchema>;
export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;

/**
 * Purge Audit Logs - Track every data deletion for compliance
 */
export const purgeAuditLogs = pgTable("purge_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // What was purged
  entityType: varchar("entity_type").notNull(),
  recordCount: integer("record_count").notNull(),
  oldestRecordDate: timestamp("oldest_record_date"),
  newestRecordDate: timestamp("newest_record_date"),
  
  // Archive reference
  archiveLocation: varchar("archive_location"), // S3 path, etc.
  archiveChecksum: varchar("archive_checksum"),
  
  // Policy reference
  policyId: varchar("policy_id"),
  retentionDaysApplied: integer("retention_days_applied"),
  
  // Execution
  executedBy: varchar("executed_by"), // SYSTEM or userId
  executionMethod: varchar("execution_method"), // SCHEDULED, MANUAL
  
  // Status
  status: varchar("status").notNull(), // COMPLETED, PARTIAL, FAILED
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_purge_audit_entity").on(table.entityType),
  index("idx_purge_audit_status").on(table.status),
  index("idx_purge_audit_created").on(table.createdAt),
]);

export const insertPurgeAuditLogSchema = createInsertSchema(purgeAuditLogs).omit({ id: true, createdAt: true });
export type InsertPurgeAuditLog = z.infer<typeof insertPurgeAuditLogSchema>;
export type PurgeAuditLog = typeof purgeAuditLogs.$inferSelect;

// ============================================================================
// 📜 COMPLIANCE: IMMUTABILITY PROTECTION
// ============================================================================

/**
 * Immutable Record Locks - Mark records that cannot be modified
 */
export const immutableRecordLocks = pgTable("immutable_record_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target record
  entityType: varchar("entity_type").notNull(), // INVOICE, CREDIT_NOTE, AUDIT_LOG, SLA_BREACH
  entityId: varchar("entity_id").notNull(),
  
  // Lock details
  reason: varchar("reason").notNull(), // LEGAL_REQUIREMENT, FINANCIAL_RECORD, COMPLIANCE
  lockedAt: timestamp("locked_at").defaultNow(),
  lockedBy: varchar("locked_by"), // SYSTEM or userId
  
  // Checksum for tamper detection
  contentChecksum: varchar("content_checksum"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_immutable_entity").on(table.entityType, table.entityId),
  index("idx_immutable_type").on(table.entityType),
]);

export const insertImmutableRecordLockSchema = createInsertSchema(immutableRecordLocks).omit({ id: true, createdAt: true });
export type InsertImmutableRecordLock = z.infer<typeof insertImmutableRecordLockSchema>;
export type ImmutableRecordLock = typeof immutableRecordLocks.$inferSelect;

/**
 * Tamper Attempt Logs - Track attempts to modify immutable records
 */
export const tamperAttemptLogs = pgTable("tamper_attempt_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  
  // Attempt details
  attemptedAction: varchar("attempted_action").notNull(), // UPDATE, DELETE
  attemptedChanges: jsonb("attempted_changes"), // What they tried to change
  
  // Who
  userId: varchar("user_id"),
  tenantId: varchar("tenant_id"),
  
  // Context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tamper_entity").on(table.entityType, table.entityId),
  index("idx_tamper_user").on(table.userId),
  index("idx_tamper_created").on(table.createdAt),
]);

export const insertTamperAttemptLogSchema = createInsertSchema(tamperAttemptLogs).omit({ id: true, createdAt: true });
export type InsertTamperAttemptLog = z.infer<typeof insertTamperAttemptLogSchema>;
export type TamperAttemptLog = typeof tamperAttemptLogs.$inferSelect;

// ============================================================================
// 📦 COMPLIANCE: EXPORT & REPORTING
// ============================================================================

// Report types
export const complianceReportTypeEnum = z.enum([
  'AI_USAGE',
  'SUPPORT_CONVERSATIONS',
  'SLA_REPORT',
  'MESSAGING_HISTORY',
  'AUDIT_LOGS',
  'ACCESS_MATRIX',
  'SECURITY_INCIDENTS',
  'BILLING_HISTORY',
]);
export type ComplianceReportType = z.infer<typeof complianceReportTypeEnum>;

// Export formats
export const exportFormatEnum = z.enum(['CSV', 'JSON', 'PDF']);
export type ExportFormat = z.infer<typeof exportFormatEnum>;

/**
 * Compliance Report Jobs - Track scheduled/requested compliance exports
 */
export const complianceReportJobs = pgTable("compliance_report_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  
  // Report type
  reportType: varchar("report_type").notNull(),
  format: varchar("format").notNull(), // CSV, JSON, PDF
  
  // Date range
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  
  // Filters
  filters: jsonb("filters"), // Additional filtering criteria
  
  // Status
  status: varchar("status").notNull(), // PENDING, PROCESSING, COMPLETED, FAILED
  progressPercent: integer("progress_percent").default(0),
  
  // Output
  outputUrl: text("output_url"), // Download URL
  outputSizeBytes: integer("output_size_bytes"),
  outputChecksum: varchar("output_checksum"),
  expiresAt: timestamp("expires_at"), // When download link expires
  
  // Audit
  requestedBy: varchar("requested_by").notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_compliance_report_tenant").on(table.tenantId),
  index("idx_compliance_report_type").on(table.reportType),
  index("idx_compliance_report_status").on(table.status),
  index("idx_compliance_report_created").on(table.createdAt),
]);

export const insertComplianceReportJobSchema = createInsertSchema(complianceReportJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplianceReportJob = z.infer<typeof insertComplianceReportJobSchema>;
export type ComplianceReportJob = typeof complianceReportJobs.$inferSelect;

// ============================================================================
// 🔐 SECURITY: ROLE PERMISSION MATRIX
// ============================================================================

/**
 * Role Permission Overrides - Custom permission rules beyond default RBAC
 */
export const rolePermissionOverrides = pgTable("role_permission_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target role
  role: varchar("role").notNull(), // admin, support_agent, support_manager, etc.
  
  // Permission
  resource: varchar("resource").notNull(), // billing, ai_config, user_management, etc.
  action: varchar("action").notNull(), // read, write, delete, admin
  
  // Override
  effect: varchar("effect").notNull(), // ALLOW, DENY
  
  // Conditions
  conditions: jsonb("conditions"), // Additional conditions
  
  // Audit
  reason: text("reason"),
  createdBy: varchar("created_by"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_role_override_role").on(table.role),
  index("idx_role_override_resource").on(table.resource),
  index("idx_role_override_effect").on(table.effect),
  index("idx_role_override_active").on(table.isActive),
]);

export const insertRolePermissionOverrideSchema = createInsertSchema(rolePermissionOverrides).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRolePermissionOverride = z.infer<typeof insertRolePermissionOverrideSchema>;
export type RolePermissionOverride = typeof rolePermissionOverrides.$inferSelect;

// ============================================================================
// DEFAULT DATA SEEDS
// ============================================================================

// Default AI cost rates (as of Jan 2026)
export const DEFAULT_AI_COST_RATES = [
  { provider: 'OPENAI', model: 'gpt-4o', promptCostPer1kCents: 250, completionCostPer1kCents: 1000 },
  { provider: 'OPENAI', model: 'gpt-4-turbo', promptCostPer1kCents: 1000, completionCostPer1kCents: 3000 },
  { provider: 'OPENAI', model: 'gpt-3.5-turbo', promptCostPer1kCents: 50, completionCostPer1kCents: 150 },
  { provider: 'CLAUDE', model: 'claude-3-5-sonnet', promptCostPer1kCents: 300, completionCostPer1kCents: 1500 },
  { provider: 'CLAUDE', model: 'claude-3-opus', promptCostPer1kCents: 1500, completionCostPer1kCents: 7500 },
  { provider: 'CLAUDE', model: 'claude-3-haiku', promptCostPer1kCents: 25, completionCostPer1kCents: 125 },
  { provider: 'GEMINI', model: 'gemini-1.5-pro', promptCostPer1kCents: 125, completionCostPer1kCents: 500 },
  { provider: 'GEMINI', model: 'gemini-1.5-flash', promptCostPer1kCents: 35, completionCostPer1kCents: 105 },
];

// Default retention policies
export const DEFAULT_RETENTION_POLICIES = [
  { entityType: 'AUDIT_LOG', retentionDays: -1, legalBasis: 'SOC 2 / ISO 27001 requires 7+ years, keeping permanently' },
  { entityType: 'INVOICE', retentionDays: -1, legalBasis: 'Financial records must be retained permanently' },
  { entityType: 'CREDIT_NOTE', retentionDays: -1, legalBasis: 'Financial records must be retained permanently' },
  { entityType: 'SUPPORT_TICKET', retentionDays: 1095, legalBasis: '3 year retention for support history' },
  { entityType: 'AI_USAGE_LOG', retentionDays: 365, legalBasis: '1 year retention for cost tracking' },
  { entityType: 'CHATBOT_CONVERSATION', retentionDays: 180, legalBasis: '180 days per user data minimization' },
  { entityType: 'MESSAGING_LOG', retentionDays: 365, legalBasis: '1 year for delivery tracking' },
  { entityType: 'SECURITY_VIOLATION', retentionDays: -1, legalBasis: 'Security incidents retained permanently' },
];

// Default governance toggles
export const DEFAULT_GOVERNANCE_TOGGLES = [
  { toggleType: 'AI_ENABLED', scope: 'GLOBAL', isEnabled: true },
  { toggleType: 'WHATSAPP_ENABLED', scope: 'GLOBAL', isEnabled: true },
  { toggleType: 'EMAIL_ENABLED', scope: 'GLOBAL', isEnabled: true },
  { toggleType: 'SMS_ENABLED', scope: 'GLOBAL', isEnabled: true },
  { toggleType: 'OUTBOUND_MESSAGING', scope: 'GLOBAL', isEnabled: true },
  { toggleType: 'READ_ONLY_MODE', scope: 'GLOBAL', isEnabled: false },
  { toggleType: 'NEW_SIGNUPS', scope: 'GLOBAL', isEnabled: true },
];

// Hard-coded deny rules for role escalation prevention
export const ROLE_DENY_RULES = [
  { role: 'support_agent', resource: 'billing', actions: ['read', 'write', 'delete', 'admin'] },
  { role: 'support_agent', resource: 'ai_config', actions: ['write', 'delete', 'admin'] },
  { role: 'support_agent', resource: 'plan_changes', actions: ['read', 'write', 'delete', 'admin'] },
  { role: 'support_agent', resource: 'user_management', actions: ['write', 'delete', 'admin'] },
  { role: 'support_agent', resource: 'governance', actions: ['read', 'write', 'delete', 'admin'] },
  { role: 'viewer', resource: '*', actions: ['write', 'delete', 'admin'] },
  { role: 'coupon_manager', resource: 'billing', actions: ['write', 'delete', 'admin'] },
  { role: 'coupon_manager', resource: 'user_management', actions: ['write', 'delete', 'admin'] },
];

// Immutable entity types - these cannot be modified after creation
export const IMMUTABLE_ENTITY_TYPES = [
  'INVOICE',
  'CREDIT_NOTE',
  'AUDIT_LOG',
  'SLA_BREACH',
  'SECURITY_VIOLATION',
  'PURGE_AUDIT_LOG',
];

/**
 * ========================================================================
 * ENTITLEMENT SERVICE - PURE FUNCTION
 * ========================================================================
 * 
 * THE ONLY AUTHORITY FOR ACCESS DECISIONS
 * 
 * STRICT RULES:
 * 1. Pure function - no side effects, no I/O
 * 2. All inputs explicitly passed (no hidden dependencies)
 * 3. Deterministic output for same inputs
 * 4. No database calls (operates on pre-loaded data)
 * 5. No mutations of input objects
 * 6. Returns complete entitlement decision with reasoning
 * 
 * ARCHITECTURE:
 * - Called by middleware with pre-loaded context
 * - Returns granular feature/quota decisions
 * - Includes audit trail in response
 * - Applies overrides in explicit order
 * - Never throws (returns error states)
 */

import { z } from "zod";

// ========== INPUT TYPES ==========

export const subscriptionStatusSchema = z.enum([
  'active',
  'trial',
  'cancelled',
  'expired',
  'paused',
  'suspended',
  'none'
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const featureKeySchema = z.enum([
  'apiAccess',
  'whatsappIntegration',
  'prioritySupport',
  'customBranding',
  'advancedReports',
  'multiUser',
  'emailAutomation',
  'dataExport',
]);
export type FeatureKey = z.infer<typeof featureKeySchema>;

export const quotaKeySchema = z.enum([
  'maxQuotes',
  'maxEmailProviders',
  'maxPartyProfiles',
  'maxTeamMembers',
  'maxApiCalls',
  'maxStorageMb',
]);
export type QuotaKey = z.infer<typeof quotaKeySchema>;

// Plan features (from database)
export interface PlanFeatures {
  apiAccess: boolean;
  whatsappIntegration: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  advancedReports: boolean;
  multiUser: boolean;
  emailAutomation: boolean;
  dataExport: boolean;
  maxQuotes: number;
  maxEmailProviders: number;
  maxPartyProfiles: number;
  maxTeamMembers: number;
  maxApiCalls: number;
  maxStorageMb: number;
}

// Subscription context (from database)
export interface SubscriptionContext {
  status: SubscriptionStatus;
  planId: string | null;
  planFeatures: PlanFeatures | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  paymentFailures: number;
}

// Override (from database)
export interface EntitlementOverride {
  id: string;
  overrideType: 'FEATURE_UNLOCK' | 'QUOTA_INCREASE' | 'TRIAL_EXTENSION' | 'EMERGENCY_ACCESS';
  featureKey: string | null;
  booleanValue: boolean | null;
  integerValue: number | null;
  jsonValue: any;
  startsAt: Date;
  expiresAt: Date;
  reason: string;
  adminId: string;
}

// Current usage (from database)
export interface CurrentUsage {
  quotesUsed: number;
  emailProvidersUsed: number;
  partyProfilesUsed: number;
  teamMembersUsed: number;
  apiCallsUsed: number;
  storageMbUsed: number;
}

// Complete input context
export interface EntitlementInput {
  userId: string;
  tenantId: string | null;
  subscription: SubscriptionContext;
  overrides: EntitlementOverride[];
  usage: CurrentUsage;
  currentTime: Date; // Explicit time for determinism
}

// ========== OUTPUT TYPES ==========

export interface FeatureDecision {
  enabled: boolean;
  reason: string; // Human-readable explanation
  source: 'PLAN' | 'OVERRIDE' | 'DEFAULT' | 'SUSPENDED';
  overrideId?: string; // If decision came from override
}

export interface QuotaDecision {
  limit: number;
  used: number;
  remaining: number;
  exceeded: boolean;
  reason: string;
  source: 'PLAN' | 'OVERRIDE' | 'DEFAULT' | 'SUSPENDED';
  overrideId?: string;
}

export interface EntitlementDecision {
  userId: string;
  tenantId: string | null;
  
  // Subscription state
  subscriptionStatus: SubscriptionStatus;
  isActive: boolean; // Can use any features
  
  // Feature entitlements
  features: Record<FeatureKey, FeatureDecision>;
  
  // Quota entitlements
  quotas: Record<QuotaKey, QuotaDecision>;
  
  // Metadata
  appliedOverrides: string[]; // List of override IDs that affected decision
  computedAt: Date;
  expiresAt: Date; // Cache expiry
  warnings: string[]; // Any issues (e.g., payment failures)
}

// ========== DEFAULT VALUES ==========

const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  apiAccess: false,
  whatsappIntegration: false,
  prioritySupport: false,
  customBranding: false,
  advancedReports: false,
  multiUser: false,
  emailAutomation: false,
  dataExport: false,
  maxQuotes: 10, // Free tier limits
  maxEmailProviders: 1,
  maxPartyProfiles: 5,
  maxTeamMembers: 1,
  maxApiCalls: 0,
  maxStorageMb: 100,
};

const SUSPENDED_FEATURES: PlanFeatures = {
  ...DEFAULT_PLAN_FEATURES,
  maxQuotes: 0,
  maxEmailProviders: 0,
  maxPartyProfiles: 0,
  maxTeamMembers: 0,
  maxApiCalls: 0,
  maxStorageMb: 0,
};

// ========== ENTITLEMENT SERVICE (PURE FUNCTION) ==========

/**
 * Compute complete entitlement decision for a user.
 * 
 * PURE FUNCTION - No side effects, no I/O, deterministic.
 */
export function computeEntitlements(input: EntitlementInput): EntitlementDecision {
  const { userId, tenantId, subscription, overrides, usage, currentTime } = input;
  
  const warnings: string[] = [];
  const appliedOverrides: string[] = [];
  
  // Step 1: Determine subscription status and base features
  const isActive = isSubscriptionActive(subscription, currentTime);
  const isSuspended = subscription.status === 'suspended' || subscription.paymentFailures >= 3;
  
  if (subscription.paymentFailures > 0) {
    warnings.push(`${subscription.paymentFailures} payment failure(s) detected`);
  }
  
  // Step 2: Get base plan features
  let basePlanFeatures = subscription.planFeatures || DEFAULT_PLAN_FEATURES;
  if (isSuspended) {
    basePlanFeatures = SUSPENDED_FEATURES;
    warnings.push('Account suspended due to payment failures');
  }
  
  // Step 3: Apply active overrides
  const activeOverrides = getActiveOverrides(overrides, currentTime);
  const { features: overriddenFeatures, quotas: overriddenQuotas } = applyOverrides(
    basePlanFeatures,
    activeOverrides
  );
  
  // Track which overrides were applied
  activeOverrides.forEach(o => appliedOverrides.push(o.id));
  
  // Step 4: Compute feature decisions
  const features = computeFeatureDecisions(
    basePlanFeatures,
    overriddenFeatures,
    activeOverrides,
    isActive,
    isSuspended
  );
  
  // Step 5: Compute quota decisions
  const quotas = computeQuotaDecisions(
    basePlanFeatures,
    overriddenQuotas,
    usage,
    activeOverrides,
    isActive,
    isSuspended
  );
  
  // Step 6: Compute cache expiry (shortest override expiry or 1 hour)
  const expiresAt = computeCacheExpiry(activeOverrides, currentTime);
  
  return {
    userId,
    tenantId,
    subscriptionStatus: subscription.status,
    isActive,
    features,
    quotas,
    appliedOverrides,
    computedAt: currentTime,
    expiresAt,
    warnings,
  };
}

// ========== HELPER FUNCTIONS (PURE) ==========

function isSubscriptionActive(sub: SubscriptionContext, now: Date): boolean {
  // Suspended accounts are never active
  if (sub.status === 'suspended') return false;
  
  // Active or trial subscriptions are active
  if (sub.status === 'active' || sub.status === 'trial') {
    // Check if trial expired
    if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt < now) {
      return false;
    }
    // Check if period expired
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
      return false;
    }
    return true;
  }
  
  return false;
}

function getActiveOverrides(
  overrides: EntitlementOverride[],
  now: Date
): EntitlementOverride[] {
  return overrides.filter(o => 
    o.startsAt <= now && o.expiresAt > now
  );
}

function applyOverrides(
  basePlan: PlanFeatures,
  overrides: EntitlementOverride[]
): { features: Partial<PlanFeatures>, quotas: Partial<PlanFeatures> } {
  const features: Partial<PlanFeatures> = {};
  const quotas: Partial<PlanFeatures> = {};
  
  // Apply overrides in order (later overrides win)
  for (const override of overrides) {
    if (!override.featureKey) continue;
    
    const key = override.featureKey as keyof PlanFeatures;
    
    if (override.booleanValue !== null) {
      features[key] = override.booleanValue as any;
    } else if (override.integerValue !== null) {
      quotas[key] = override.integerValue as any;
    }
  }
  
  return { features, quotas };
}

function computeFeatureDecisions(
  basePlan: PlanFeatures,
  overrides: Partial<PlanFeatures>,
  activeOverrides: EntitlementOverride[],
  isActive: boolean,
  isSuspended: boolean
): Record<FeatureKey, FeatureDecision> {
  const featureKeys: FeatureKey[] = [
    'apiAccess',
    'whatsappIntegration',
    'prioritySupport',
    'customBranding',
    'advancedReports',
    'multiUser',
    'emailAutomation',
    'dataExport',
  ];
  
  const decisions: Record<string, FeatureDecision> = {};
  
  for (const key of featureKeys) {
    if (isSuspended) {
      decisions[key] = {
        enabled: false,
        reason: 'Account suspended',
        source: 'SUSPENDED',
      };
      continue;
    }
    
    // Check for override
    if (key in overrides) {
      const override = activeOverrides.find(o => o.featureKey === key);
      decisions[key] = {
        enabled: overrides[key] as boolean,
        reason: override?.reason || 'Admin override',
        source: 'OVERRIDE',
        overrideId: override?.id,
      };
      continue;
    }
    
    // Check plan
    if (isActive && basePlan[key]) {
      decisions[key] = {
        enabled: true,
        reason: 'Included in plan',
        source: 'PLAN',
      };
    } else {
      decisions[key] = {
        enabled: false,
        reason: isActive ? 'Not included in plan' : 'Subscription inactive',
        source: 'DEFAULT',
      };
    }
  }
  
  return decisions as Record<FeatureKey, FeatureDecision>;
}

function computeQuotaDecisions(
  basePlan: PlanFeatures,
  overrides: Partial<PlanFeatures>,
  usage: CurrentUsage,
  activeOverrides: EntitlementOverride[],
  isActive: boolean,
  isSuspended: boolean
): Record<QuotaKey, QuotaDecision> {
  const quotaKeys: Array<{ key: QuotaKey, usageKey: keyof CurrentUsage }> = [
    { key: 'maxQuotes', usageKey: 'quotesUsed' },
    { key: 'maxEmailProviders', usageKey: 'emailProvidersUsed' },
    { key: 'maxPartyProfiles', usageKey: 'partyProfilesUsed' },
    { key: 'maxTeamMembers', usageKey: 'teamMembersUsed' },
    { key: 'maxApiCalls', usageKey: 'apiCallsUsed' },
    { key: 'maxStorageMb', usageKey: 'storageMbUsed' },
  ];
  
  const decisions: Record<string, QuotaDecision> = {};
  
  for (const { key, usageKey } of quotaKeys) {
    const used = usage[usageKey] || 0;
    
    if (isSuspended) {
      decisions[key] = {
        limit: 0,
        used,
        remaining: 0,
        exceeded: used > 0,
        reason: 'Account suspended',
        source: 'SUSPENDED',
      };
      continue;
    }
    
    // Check for override
    let limit: number;
    let source: 'PLAN' | 'OVERRIDE' | 'DEFAULT';
    let overrideId: string | undefined;
    let reason: string;
    
    if (key in overrides) {
      const override = activeOverrides.find(o => o.featureKey === key);
      limit = overrides[key] as number;
      source = 'OVERRIDE';
      overrideId = override?.id;
      reason = override?.reason || 'Admin quota override';
    } else if (isActive) {
      limit = basePlan[key];
      source = 'PLAN';
      reason = 'Plan quota';
    } else {
      limit = DEFAULT_PLAN_FEATURES[key];
      source = 'DEFAULT';
      reason = 'Subscription inactive - using default limits';
    }
    
    const remaining = Math.max(0, limit - used);
    const exceeded = used > limit;
    
    decisions[key] = {
      limit,
      used,
      remaining,
      exceeded,
      reason,
      source,
      overrideId,
    };
  }
  
  return decisions as Record<QuotaKey, QuotaDecision>;
}

function computeCacheExpiry(overrides: EntitlementOverride[], now: Date): Date {
  if (overrides.length === 0) {
    // No overrides: cache for 1 hour
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
  
  // Find shortest expiry among active overrides
  const shortestExpiry = overrides.reduce((min, o) => 
    o.expiresAt < min ? o.expiresAt : min
  , overrides[0].expiresAt);
  
  // Cache until override expires (with 5-minute buffer)
  return new Date(shortestExpiry.getTime() - 5 * 60 * 1000);
}

// ========== EXPORTS ==========

export type { 
  EntitlementInput, 
  EntitlementDecision, 
  FeatureDecision, 
  QuotaDecision,
  SubscriptionContext,
  EntitlementOverride,
  CurrentUsage,
  PlanFeatures
};

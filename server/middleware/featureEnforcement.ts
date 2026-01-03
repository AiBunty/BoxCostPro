import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { 
  userSubscriptions, 
  planVersions, 
  planFeatures, 
  subscriptionFeatures,
  subscriptionPlans 
} from "@shared/schema";
import { eq, and, isNull, gt, or } from "drizzle-orm";

/**
 * ENTERPRISE FEATURE ENFORCEMENT MIDDLEWARE
 * 
 * Enforces subscription-based feature limits at runtime.
 * Zero hard-coded logic - all limits come from database.
 * 
 * Features supported:
 * - BOOLEAN: true/false access control
 * - NUMBER: Numeric limits (e.g., users_limit = 5)
 * - TEXT: Specific values allowed
 * 
 * Usage:
 * - requireFeature('whatsapp') - Boolean feature gate
 * - requireFeatureLimit('users_limit', getCurrentUserCount) - Numeric limit
 * - getFeatureValue('custom_branding') - Get feature value for conditional logic
 */

// ========== TYPES ==========

export interface FeatureContext {
  userId: string;
  tenantId: string;
  subscriptionId: string | null;
  planId: string | null;
  planCode: string | null;
  planVersionId: string | null;
  features: Map<string, FeatureValue>;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
}

export interface FeatureValue {
  code: string;
  name: string;
  valueType: 'BOOLEAN' | 'NUMBER' | 'TEXT';
  value: string;
  isEnabled: boolean;
}

// Cache for feature context to avoid repeated DB queries
const featureContextCache = new Map<string, { context: FeatureContext; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// ========== CORE FUNCTIONS ==========

/**
 * Get the feature context for a user/tenant
 * Includes subscription status and all enabled features
 */
export async function getFeatureContext(userId: string, tenantId: string): Promise<FeatureContext> {
  const cacheKey = `${tenantId}:${userId}`;
  const now = Date.now();
  
  // Check cache first
  const cached = featureContextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.context;
  }
  
  try {
    // Get active subscription for user/tenant
    const [subscription] = await db
      .select({
        id: userSubscriptions.id,
        status: userSubscriptions.status,
        planVersionId: userSubscriptions.planVersionId,
        startDate: userSubscriptions.startDate,
        endDate: userSubscriptions.endDate,
        trialEndsAt: userSubscriptions.trialEndsAt,
      })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.tenantId, tenantId),
          eq(userSubscriptions.userId, userId),
          or(
            eq(userSubscriptions.status, 'ACTIVE'),
            eq(userSubscriptions.status, 'TRIAL')
          )
        )
      )
      .limit(1);

    if (!subscription) {
      // No active subscription - return empty context
      const emptyContext: FeatureContext = {
        userId,
        tenantId,
        subscriptionId: null,
        planId: null,
        planCode: null,
        planVersionId: null,
        features: new Map(),
        isActive: false,
        isTrial: false,
        trialEndsAt: null,
        subscriptionEndsAt: null,
      };
      featureContextCache.set(cacheKey, { context: emptyContext, expiresAt: now + CACHE_TTL_MS });
      return emptyContext;
    }

    // Get plan version details
    const [planVersion] = await db
      .select({
        id: planVersions.id,
        planId: planVersions.planId,
      })
      .from(planVersions)
      .where(eq(planVersions.id, subscription.planVersionId ?? ''))
      .limit(1);

    let planId: string | null = null;
    let planCode: string | null = null;

    if (planVersion) {
      planId = planVersion.planId;
      
      // Get plan code
      const [plan] = await db
        .select({ code: subscriptionPlans.code })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);
      
      if (plan) {
        planCode = plan.code;
      }
    }

    // Get features for this plan version
    const features = new Map<string, FeatureValue>();
    
    if (subscription.planVersionId) {
      const planFeatureRows = await db
        .select({
          featureId: planFeatures.featureId,
          value: planFeatures.value,
          isEnabled: planFeatures.isEnabled,
          code: subscriptionFeatures.code,
          name: subscriptionFeatures.name,
          valueType: subscriptionFeatures.valueType,
        })
        .from(planFeatures)
        .leftJoin(subscriptionFeatures, eq(planFeatures.featureId, subscriptionFeatures.id))
        .where(
          and(
            eq(planFeatures.planVersionId, subscription.planVersionId),
            eq(planFeatures.isEnabled, true)
          )
        );

      for (const row of planFeatureRows) {
        if (row.code) {
          features.set(row.code, {
            code: row.code,
            name: row.name ?? row.code,
            valueType: row.valueType as 'BOOLEAN' | 'NUMBER' | 'TEXT',
            value: row.value,
            isEnabled: row.isEnabled ?? true,
          });
        }
      }
    }

    const context: FeatureContext = {
      userId,
      tenantId,
      subscriptionId: subscription.id,
      planId,
      planCode,
      planVersionId: subscription.planVersionId,
      features,
      isActive: subscription.status === 'ACTIVE' || subscription.status === 'TRIAL',
      isTrial: subscription.status === 'TRIAL',
      trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
      subscriptionEndsAt: subscription.endDate ? new Date(subscription.endDate) : null,
    };

    // Cache the context
    featureContextCache.set(cacheKey, { context, expiresAt: now + CACHE_TTL_MS });
    
    return context;
  } catch (error) {
    console.error('[FeatureEnforcement] Error loading context:', error);
    // Return empty context on error
    return {
      userId,
      tenantId,
      subscriptionId: null,
      planId: null,
      planCode: null,
      planVersionId: null,
      features: new Map(),
      isActive: false,
      isTrial: false,
      trialEndsAt: null,
      subscriptionEndsAt: null,
    };
  }
}

/**
 * Check if a boolean feature is enabled
 */
export async function hasFeature(
  userId: string, 
  tenantId: string, 
  featureCode: string
): Promise<boolean> {
  const context = await getFeatureContext(userId, tenantId);
  
  if (!context.isActive) {
    return false;
  }
  
  const feature = context.features.get(featureCode);
  if (!feature) {
    return false;
  }
  
  if (feature.valueType === 'BOOLEAN') {
    return feature.value.toLowerCase() === 'true' && feature.isEnabled;
  }
  
  // For non-boolean features, check if enabled
  return feature.isEnabled;
}

/**
 * Get a numeric feature limit
 */
export async function getFeatureLimit(
  userId: string, 
  tenantId: string, 
  featureCode: string
): Promise<number | null> {
  const context = await getFeatureContext(userId, tenantId);
  
  if (!context.isActive) {
    return 0;
  }
  
  const feature = context.features.get(featureCode);
  if (!feature || !feature.isEnabled) {
    return 0;
  }
  
  if (feature.valueType !== 'NUMBER') {
    console.warn(`[FeatureEnforcement] Feature ${featureCode} is not a NUMBER type`);
    return null;
  }
  
  // Handle special values
  if (feature.value === '-1' || feature.value.toLowerCase() === 'unlimited') {
    return Infinity;
  }
  
  const limit = parseInt(feature.value, 10);
  return isNaN(limit) ? 0 : limit;
}

/**
 * Get a text feature value
 */
export async function getFeatureValue(
  userId: string, 
  tenantId: string, 
  featureCode: string
): Promise<string | null> {
  const context = await getFeatureContext(userId, tenantId);
  
  if (!context.isActive) {
    return null;
  }
  
  const feature = context.features.get(featureCode);
  if (!feature || !feature.isEnabled) {
    return null;
  }
  
  return feature.value;
}

/**
 * Check if current usage is within the feature limit
 */
export async function checkFeatureLimit(
  userId: string,
  tenantId: string,
  featureCode: string,
  currentUsage: number
): Promise<{ allowed: boolean; limit: number | null; remaining: number | null }> {
  const limit = await getFeatureLimit(userId, tenantId, featureCode);
  
  if (limit === null) {
    return { allowed: false, limit: null, remaining: null };
  }
  
  if (limit === Infinity) {
    return { allowed: true, limit: Infinity, remaining: Infinity };
  }
  
  const remaining = limit - currentUsage;
  return {
    allowed: currentUsage < limit,
    limit,
    remaining: remaining > 0 ? remaining : 0,
  };
}

/**
 * Invalidate the cache for a user/tenant
 * Call this after subscription changes
 */
export function invalidateFeatureCache(tenantId: string, userId?: string): void {
  if (userId) {
    featureContextCache.delete(`${tenantId}:${userId}`);
  } else {
    // Invalidate all entries for this tenant
    for (const key of featureContextCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        featureContextCache.delete(key);
      }
    }
  }
}

// ========== EXPRESS MIDDLEWARE ==========

/**
 * Middleware to attach feature context to request
 * Should be used on routes that need feature checks
 */
export function attachFeatureContext() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user info from request (assuming Clerk auth middleware ran first)
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        // Skip if not authenticated
        return next();
      }
      
      const context = await getFeatureContext(userId, tenantId);
      (req as any).featureContext = context;
      
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Error attaching context:', error);
      next(); // Continue even on error
    }
  };
}

/**
 * Middleware to require an active subscription
 * Blocks request if no active subscription
 */
export function requireActiveSubscription() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const context = await getFeatureContext(userId, tenantId);
      
      if (!context.isActive) {
        return res.status(403).json({
          success: false,
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to access this feature',
          data: {
            hasSubscription: !!context.subscriptionId,
            isExpired: context.subscriptionEndsAt ? new Date() > context.subscriptionEndsAt : false,
          },
        });
      }
      
      (req as any).featureContext = context;
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Subscription check error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify subscription status',
      });
    }
  };
}

/**
 * Middleware to require a specific boolean feature
 * Usage: router.post('/whatsapp/send', requireFeature('whatsapp'), handler)
 */
export function requireFeature(featureCode: string, customMessage?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const context = await getFeatureContext(userId, tenantId);
      
      if (!context.isActive) {
        return res.status(403).json({
          success: false,
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required',
        });
      }
      
      const feature = context.features.get(featureCode);
      const hasAccess = feature && 
                        feature.isEnabled && 
                        (feature.valueType !== 'BOOLEAN' || feature.value.toLowerCase() === 'true');
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'FEATURE_NOT_AVAILABLE',
          message: customMessage || `Your plan does not include access to the "${featureCode}" feature`,
          data: {
            featureCode,
            currentPlan: context.planCode,
            requiresUpgrade: true,
          },
        });
      }
      
      (req as any).featureContext = context;
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Feature check error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify feature access',
      });
    }
  };
}

/**
 * Middleware to enforce a numeric feature limit
 * Usage: router.post('/users', requireFeatureLimit('users_limit', async (req) => getCurrentUserCount(req.tenantId)), handler)
 */
export function requireFeatureLimit(
  featureCode: string, 
  getCurrentUsage: (req: Request) => Promise<number>,
  customMessage?: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const context = await getFeatureContext(userId, tenantId);
      
      if (!context.isActive) {
        return res.status(403).json({
          success: false,
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required',
        });
      }
      
      const currentUsage = await getCurrentUsage(req);
      const limitCheck = await checkFeatureLimit(userId, tenantId, featureCode, currentUsage);
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: 'LIMIT_EXCEEDED',
          message: customMessage || `You have reached your plan's limit for "${featureCode}"`,
          data: {
            featureCode,
            currentUsage,
            limit: limitCheck.limit,
            remaining: limitCheck.remaining,
            currentPlan: context.planCode,
            requiresUpgrade: true,
          },
        });
      }
      
      (req as any).featureContext = context;
      (req as any).featureLimitCheck = limitCheck;
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Limit check error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify feature limit',
      });
    }
  };
}

/**
 * Middleware to require a specific plan or higher tier
 * Usage: router.get('/enterprise-report', requirePlan(['ENTERPRISE', 'PREMIUM']), handler)
 */
export function requirePlan(allowedPlanCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const context = await getFeatureContext(userId, tenantId);
      
      if (!context.isActive) {
        return res.status(403).json({
          success: false,
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required',
        });
      }
      
      const normalizedAllowed = allowedPlanCodes.map(c => c.toUpperCase());
      const userPlanCode = context.planCode?.toUpperCase();
      
      if (!userPlanCode || !normalizedAllowed.includes(userPlanCode)) {
        return res.status(403).json({
          success: false,
          error: 'PLAN_NOT_ALLOWED',
          message: `This feature requires one of the following plans: ${allowedPlanCodes.join(', ')}`,
          data: {
            currentPlan: context.planCode,
            allowedPlans: allowedPlanCodes,
            requiresUpgrade: true,
          },
        });
      }
      
      (req as any).featureContext = context;
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Plan check error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify plan access',
      });
    }
  };
}

/**
 * Middleware to check if trial has expired
 * Blocks access if trial is over and no active paid subscription
 */
export function blockExpiredTrial() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      const tenantId = (req as any).user?.tenantId || (req as any).tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const context = await getFeatureContext(userId, tenantId);
      
      // Check if trial has expired
      if (context.isTrial && context.trialEndsAt && new Date() > context.trialEndsAt) {
        return res.status(403).json({
          success: false,
          error: 'TRIAL_EXPIRED',
          message: 'Your trial period has expired. Please subscribe to continue using this feature.',
          data: {
            trialEndsAt: context.trialEndsAt,
            planCode: context.planCode,
            requiresSubscription: true,
          },
        });
      }
      
      (req as any).featureContext = context;
      next();
    } catch (error) {
      console.error('[FeatureEnforcement] Trial check error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify trial status',
      });
    }
  };
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get all features for a plan (for frontend display)
 */
export async function getAllFeaturesForPlan(planId: string): Promise<FeatureValue[]> {
  try {
    // Get current version
    const [currentVersion] = await db
      .select({ id: planVersions.id })
      .from(planVersions)
      .where(
        and(
          eq(planVersions.planId, planId),
          eq(planVersions.isCurrent, true)
        )
      )
      .limit(1);

    if (!currentVersion) {
      return [];
    }

    const rows = await db
      .select({
        featureId: planFeatures.featureId,
        value: planFeatures.value,
        isEnabled: planFeatures.isEnabled,
        code: subscriptionFeatures.code,
        name: subscriptionFeatures.name,
        valueType: subscriptionFeatures.valueType,
      })
      .from(planFeatures)
      .leftJoin(subscriptionFeatures, eq(planFeatures.featureId, subscriptionFeatures.id))
      .where(eq(planFeatures.planVersionId, currentVersion.id));

    return rows
      .filter(row => row.code)
      .map(row => ({
        code: row.code!,
        name: row.name ?? row.code!,
        valueType: row.valueType as 'BOOLEAN' | 'NUMBER' | 'TEXT',
        value: row.value,
        isEnabled: row.isEnabled ?? true,
      }));
  } catch (error) {
    console.error('[FeatureEnforcement] Error fetching plan features:', error);
    return [];
  }
}

/**
 * Compare features between two plans (for upgrade prompts)
 */
export async function comparePlanFeatures(
  currentPlanId: string, 
  targetPlanId: string
): Promise<{
  gained: FeatureValue[];
  improved: Array<{ feature: FeatureValue; currentValue: string; newValue: string }>;
  lost: FeatureValue[];
}> {
  const currentFeatures = await getAllFeaturesForPlan(currentPlanId);
  const targetFeatures = await getAllFeaturesForPlan(targetPlanId);
  
  const currentMap = new Map(currentFeatures.map(f => [f.code, f]));
  const targetMap = new Map(targetFeatures.map(f => [f.code, f]));
  
  const gained: FeatureValue[] = [];
  const improved: Array<{ feature: FeatureValue; currentValue: string; newValue: string }> = [];
  const lost: FeatureValue[] = [];
  
  // Find gained and improved
  for (const [code, targetFeature] of targetMap) {
    const currentFeature = currentMap.get(code);
    
    if (!currentFeature || !currentFeature.isEnabled) {
      gained.push(targetFeature);
    } else if (targetFeature.valueType === 'NUMBER') {
      const currentNum = parseInt(currentFeature.value, 10);
      const targetNum = parseInt(targetFeature.value, 10);
      if (targetNum > currentNum) {
        improved.push({
          feature: targetFeature,
          currentValue: currentFeature.value,
          newValue: targetFeature.value,
        });
      }
    }
  }
  
  // Find lost
  for (const [code, currentFeature] of currentMap) {
    const targetFeature = targetMap.get(code);
    if (!targetFeature || !targetFeature.isEnabled) {
      lost.push(currentFeature);
    }
  }
  
  return { gained, improved, lost };
}

/**
 * Get usage summary for a tenant (for admin dashboard)
 */
export async function getTenantUsageSummary(
  tenantId: string
): Promise<{
  planCode: string | null;
  isActive: boolean;
  isTrial: boolean;
  features: Array<{
    code: string;
    name: string;
    limit: number | null;
    usage: number;
    percentage: number;
  }>;
}> {
  // This would need to be extended based on actual usage tracking
  // For now, return basic subscription info
  const [subscription] = await db
    .select({
      status: userSubscriptions.status,
      planVersionId: userSubscriptions.planVersionId,
    })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.tenantId, tenantId),
        or(
          eq(userSubscriptions.status, 'ACTIVE'),
          eq(userSubscriptions.status, 'TRIAL')
        )
      )
    )
    .limit(1);

  if (!subscription) {
    return {
      planCode: null,
      isActive: false,
      isTrial: false,
      features: [],
    };
  }

  // Get plan code
  let planCode: string | null = null;
  if (subscription.planVersionId) {
    const [version] = await db
      .select({ planId: planVersions.planId })
      .from(planVersions)
      .where(eq(planVersions.id, subscription.planVersionId))
      .limit(1);
    
    if (version) {
      const [plan] = await db
        .select({ code: subscriptionPlans.code })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, version.planId))
        .limit(1);
      
      if (plan) {
        planCode = plan.code;
      }
    }
  }

  return {
    planCode,
    isActive: subscription.status === 'ACTIVE' || subscription.status === 'TRIAL',
    isTrial: subscription.status === 'TRIAL',
    features: [], // Would be populated with actual usage data
  };
}

// Export types
export type { FeatureContext, FeatureValue };

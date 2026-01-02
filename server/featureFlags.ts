/**
 * Feature Flag System
 * Manages plan-based feature limits and user-specific overrides
 */

import { storage } from './storage';

export interface PlanFeatures {
  maxEmailProviders: number;
  maxQuotes: number;
  maxPartyProfiles: number;
  apiAccess: boolean;
  whatsappIntegration: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
}

export interface FeatureCheckResult {
  allowed: boolean;
  limit: number | boolean;
  currentUsage?: number;
  upgradeRequired?: string; // Plan tier needed
  reason?: string;
}

/**
 * Get user's effective feature limits (considering plan + overrides)
 */
export async function getUserFeatures(userId: string): Promise<PlanFeatures | null> {
  try {
    // Get user's active subscription
    const subscription = await storage.getUserActiveSubscription(userId);
    
    if (!subscription || !subscription.planId) {
      // No subscription - return trial/basic limits
      return {
        maxEmailProviders: 1,
        maxQuotes: 10,
        maxPartyProfiles: 5,
        apiAccess: false,
        whatsappIntegration: false,
        prioritySupport: false,
        customBranding: false,
      };
    }

    // Get plan features
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (!plan) {
      return null;
    }

    // Parse plan features (stored as JSONB)
    let planFeatures: PlanFeatures = typeof plan.features === 'string' 
      ? JSON.parse(plan.features)
      : (plan.features as any) || {};

    // Check for user-specific overrides (admin can grant extra limits)
    const overrides = await storage.getUserFeatureOverride(userId);
    
    if (overrides) {
      // Apply overrides (null values mean use plan default)
      if (overrides.maxEmailProviders !== null) {
        planFeatures.maxEmailProviders = overrides.maxEmailProviders;
      }
      if (overrides.maxQuotes !== null) {
        planFeatures.maxQuotes = overrides.maxQuotes;
      }
      if (overrides.maxPartyProfiles !== null) {
        planFeatures.maxPartyProfiles = overrides.maxPartyProfiles;
      }
      if (overrides.apiAccess !== null) {
        planFeatures.apiAccess = overrides.apiAccess;
      }
      if (overrides.whatsappIntegration !== null) {
        planFeatures.whatsappIntegration = overrides.whatsappIntegration;
      }
    }

    return planFeatures;
  } catch (error) {
    console.error('[featureFlags] Error getting user features:', error);
    return null;
  }
}

/**
 * Check if user can use a specific feature
 */
export async function checkFeature(
  userId: string, 
  featureName: keyof PlanFeatures
): Promise<FeatureCheckResult> {
  const features = await getUserFeatures(userId);
  
  if (!features) {
    return {
      allowed: false,
      limit: 0,
      reason: 'Unable to determine plan features',
    };
  }

  const limit = features[featureName];
  
  if (typeof limit === 'boolean') {
    return {
      allowed: limit,
      limit: limit,
      reason: limit ? undefined : 'Feature not included in your plan',
    };
  }

  // For numeric limits, check current usage
  const usage = await storage.getUserFeatureUsage(userId);
  
  let currentUsage = 0;
  if (featureName === 'maxEmailProviders') {
    currentUsage = usage?.emailProvidersCount || 0;
  } else if (featureName === 'maxQuotes') {
    currentUsage = usage?.quotesThisMonth || 0;
  } else if (featureName === 'maxPartyProfiles') {
    currentUsage = usage?.partyProfilesCount || 0;
  }

  const allowed = currentUsage < limit;

  return {
    allowed,
    limit,
    currentUsage,
    upgradeRequired: allowed ? undefined : getUpgradePlanTier(featureName, currentUsage + 1),
    reason: allowed ? undefined : `Limit reached (${currentUsage}/${limit})`,
  };
}

/**
 * Validate if user can perform an action (e.g., add another email provider)
 * Throws error if not allowed
 */
export async function validateFeatureUsage(
  userId: string,
  featureName: keyof PlanFeatures,
  increment: number = 1
): Promise<void> {
  const check = await checkFeature(userId, featureName);
  
  if (!check.allowed) {
    const error: any = new Error(check.reason || 'Feature limit reached');
    error.code = 'FEATURE_LIMIT_REACHED';
    error.featureName = featureName;
    error.limit = check.limit;
    error.currentUsage = check.currentUsage;
    error.upgradeRequired = check.upgradeRequired;
    throw error;
  }

  // Check if increment would exceed limit
  if (typeof check.limit === 'number' && check.currentUsage !== undefined) {
    if (check.currentUsage + increment > check.limit) {
      const error: any = new Error(`Cannot add ${increment}. Would exceed limit of ${check.limit}`);
      error.code = 'FEATURE_LIMIT_EXCEEDED';
      error.featureName = featureName;
      error.limit = check.limit;
      error.currentUsage = check.currentUsage;
      error.upgradeRequired = getUpgradePlanTier(featureName, check.currentUsage + increment);
      throw error;
    }
  }
}

/**
 * Increment usage counter for a feature
 */
export async function incrementFeatureUsage(
  userId: string,
  featureName: 'emailProviders' | 'customTemplates' | 'quotes' | 'partyProfiles' | 'apiCalls',
  amount: number = 1
): Promise<void> {
  try {
    await storage.incrementUserFeatureUsage(userId, featureName, amount);
  } catch (error) {
    console.error('[featureFlags] Error incrementing feature usage:', error);
    throw error;
  }
}

/**
 * Decrement usage counter for a feature
 */
export async function decrementFeatureUsage(
  userId: string,
  featureName: 'emailProviders' | 'customTemplates' | 'quotes' | 'partyProfiles' | 'apiCalls',
  amount: number = 1
): Promise<void> {
  try {
    await storage.decrementUserFeatureUsage(userId, featureName, amount);
  } catch (error) {
    console.error('[featureFlags] Error decrementing feature usage:', error);
    throw error;
  }
}

/**
 * Get recommended plan tier for required feature limit
 */
function getUpgradePlanTier(featureName: keyof PlanFeatures, requiredAmount: number): string {
  // Professional plan limits
  const professionalLimits: PlanFeatures = {
    maxEmailProviders: 3,
    maxQuotes: 200,
    maxPartyProfiles: 100,
    apiAccess: true,
    whatsappIntegration: false,
    prioritySupport: true,
    customBranding: true,
  };

  // Enterprise plan limits
  const enterpriseLimits: PlanFeatures = {
    maxEmailProviders: 999, // unlimited
    maxQuotes: 9999,
    maxPartyProfiles: 9999,
    apiAccess: true,
    whatsappIntegration: true,
    prioritySupport: true,
    customBranding: true,
  };

  if (typeof requiredAmount === 'number') {
    const professionalLimit = professionalLimits[featureName];
    const enterpriseLimit = enterpriseLimits[featureName];

    if (typeof professionalLimit === 'number' && requiredAmount <= professionalLimit) {
      return 'Professional';
    }
    
    if (typeof enterpriseLimit === 'number' && requiredAmount <= enterpriseLimit) {
      return 'Enterprise';
    }
  }

  // For boolean features or very high limits
  if (featureName === 'apiAccess' || featureName === 'customBranding' || featureName === 'prioritySupport') {
    return 'Professional';
  }

  if (featureName === 'whatsappIntegration') {
    return 'Enterprise';
  }

  return 'Enterprise';
}

/**
 * Check if user can downgrade to a plan without exceeding limits
 */
export async function canDowngradeToPlan(
  userId: string,
  newPlanFeatures: PlanFeatures
): Promise<{ canDowngrade: boolean; violations: string[] }> {
  const usage = await storage.getUserFeatureUsage(userId);
  
  if (!usage) {
    return { canDowngrade: true, violations: [] };
  }

  const violations: string[] = [];

  if (usage.emailProvidersCount > newPlanFeatures.maxEmailProviders) {
    violations.push(
      `You have ${usage.emailProvidersCount} email providers but new plan allows only ${newPlanFeatures.maxEmailProviders}. ` +
      `Please remove ${usage.emailProvidersCount - newPlanFeatures.maxEmailProviders} provider(s) first.`
    );
  }

  if (usage.partyProfilesCount > newPlanFeatures.maxPartyProfiles) {
    violations.push(
      `You have ${usage.partyProfilesCount} party profiles but new plan allows only ${newPlanFeatures.maxPartyProfiles}. ` +
      `Please delete ${usage.partyProfilesCount - newPlanFeatures.maxPartyProfiles} profile(s) first.`
    );
  }

  return {
    canDowngrade: violations.length === 0,
    violations,
  };
}

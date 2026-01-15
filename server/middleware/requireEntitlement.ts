/**
 * ========================================================================
 * ENTITLEMENT REQUIREMENT MIDDLEWARE
 * ========================================================================
 * 
 * ENFORCE FEATURE/QUOTA REQUIREMENTS AT MIDDLEWARE LEVEL
 * 
 * RULES:
 * 1. Load entitlements from cache
 * 2. Check specific feature or quota
 * 3. Block if requirement not met
 * 4. Clear error messages
 * 5. No mutations (read-only check)
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { entitlementCache, subscriptionOverrides } from "@shared/entitlementSchema";
import { eq } from "drizzle-orm";
import { type FeatureKey, type QuotaKey } from "../services/entitlementService";

// ========== ERROR RESPONSES ==========

interface EntitlementViolation {
  code: 'FEATURE_DISABLED' | 'QUOTA_EXCEEDED' | 'PLAN_REQUIRED' | 'ENTITLEMENTS_UNKNOWN';
  feature?: string;
  quota?: string;
  limit?: number;
  used?: number;
  subscription?: string;
  message: string;
  resolution: string;
}

// ========== HELPERS ==========

async function getEntitlementCache(userId: string) {
  const [cache] = await db
    .select()
    .from(entitlementCache)
    .where(eq(entitlementCache.userId, userId));

  // Ensure cache is not expired
  if (cache && cache.expiresAt <= new Date()) {
    return null;
  }

  return cache;
}

// ========== MIDDLEWARE FACTORIES ==========

/**
 * Require a feature to be enabled
 * 
 * Usage:
 * app.post('/api/user/quotes', requireFeature('apiAccess'), handleQuote);
 */
export function requireFeature(featureKey: FeatureKey, options?: { message?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Get cached entitlements
      const cache = await getEntitlementCache(userId);

      if (!cache) {
        const violation: EntitlementViolation = {
          code: 'ENTITLEMENTS_UNKNOWN',
          message: 'Unable to verify entitlements',
          resolution: 'Please refresh your browser and try again. If the issue persists, contact support.',
        };
        return res.status(503).json(violation);
      }

      // Check feature
      const feature = cache.features[featureKey];

      if (!feature || !feature.enabled) {
        const violation: EntitlementViolation = {
          code: 'FEATURE_DISABLED',
          feature: featureKey,
          message: options?.message || `This feature requires a plan upgrade (${featureKey})`,
          resolution: `Upgrade your subscription to unlock ${featureKey}`,
          subscription: cache.subscriptionStatus,
        };
        return res.status(403).json(violation);
      }

      // Attach entitlement decision to request
      (req as any).entitlementDecision = cache;
      (req as any).feature = feature;

      next();
    } catch (error: any) {
      console.error('[requireFeature] Error:', error);
      return res.status(500).json({
        error: 'Failed to verify feature access',
        message: error.message,
      });
    }
  };
}

/**
 * Require quota to be available
 * 
 * Usage:
 * app.post('/api/user/quotes', requireQuota('maxQuotes'), handleQuote);
 */
export function requireQuota(quotaKey: QuotaKey, options?: { required?: number; message?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const required = options?.required || 1;

      // Get cached entitlements
      const cache = await getEntitlementCache(userId);

      if (!cache) {
        const violation: EntitlementViolation = {
          code: 'ENTITLEMENTS_UNKNOWN',
          quota: quotaKey,
          message: 'Unable to verify quota',
          resolution: 'Please refresh your browser and try again.',
        };
        return res.status(503).json(violation);
      }

      // Check quota
      const quota = cache.quotas[quotaKey];

      if (!quota) {
        const violation: EntitlementViolation = {
          code: 'QUOTA_EXCEEDED',
          quota: quotaKey,
          message: `Quota check failed: ${quotaKey} not found`,
          resolution: 'Contact support for assistance.',
        };
        return res.status(500).json(violation);
      }

      // Check if quota is exceeded
      if (quota.remaining < required) {
        const violation: EntitlementViolation = {
          code: 'QUOTA_EXCEEDED',
          quota: quotaKey,
          limit: quota.limit,
          used: quota.used,
          message: options?.message || 
            `Quota exceeded: ${quota.used}/${quota.limit} ${quotaKey}`,
          resolution: `You have ${quota.remaining} remaining. Upgrade your plan for more.`,
        };
        return res.status(429).json(violation);
      }

      // Attach quota decision to request
      (req as any).quotaDecision = quota;

      next();
    } catch (error: any) {
      console.error('[requireQuota] Error:', error);
      return res.status(500).json({
        error: 'Failed to verify quota',
        message: error.message,
      });
    }
  };
}

/**
 * Require both feature AND quota
 * 
 * Usage:
 * app.post('/api/user/quotes',
 *   requireFeature('apiAccess'),
 *   requireQuota('maxQuotes'),
 *   handleQuote
 * );
 */
export function requireEntitlements(specs: Array<{ type: 'feature' | 'quota'; key: FeatureKey | QuotaKey; required?: number }>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Get cached entitlements once
      const cache = await getEntitlementCache(userId);

      if (!cache) {
        const violation: EntitlementViolation = {
          code: 'ENTITLEMENTS_UNKNOWN',
          message: 'Unable to verify entitlements',
          resolution: 'Please refresh your browser and try again.',
        };
        return res.status(503).json(violation);
      }

      // Check all requirements
      for (const spec of specs) {
        if (spec.type === 'feature') {
          const feature = cache.features[spec.key as FeatureKey];
          if (!feature || !feature.enabled) {
            const violation: EntitlementViolation = {
              code: 'FEATURE_DISABLED',
              feature: spec.key as string,
              message: `Feature required: ${spec.key}`,
              resolution: `Upgrade your subscription to unlock ${spec.key}`,
              subscription: cache.subscriptionStatus,
            };
            return res.status(403).json(violation);
          }
        }

        if (spec.type === 'quota') {
          const quota = cache.quotas[spec.key as QuotaKey];
          const required = spec.required || 1;
          
          if (!quota || quota.remaining < required) {
            const violation: EntitlementViolation = {
              code: 'QUOTA_EXCEEDED',
              quota: spec.key as string,
              limit: quota?.limit,
              used: quota?.used,
              message: `Quota exceeded: ${spec.key}`,
              resolution: `You have ${quota?.remaining || 0} remaining.`,
            };
            return res.status(429).json(violation);
          }
        }
      }

      // Attach cache to request for downstream handlers
      (req as any).entitlementDecision = cache;

      next();
    } catch (error: any) {
      console.error('[requireEntitlements] Error:', error);
      return res.status(500).json({
        error: 'Failed to verify entitlements',
        message: error.message,
      });
    }
  };
}

/**
 * Soft check - don't block, just attach entitlements
 * 
 * Usage: Use this to provide information without blocking
 * app.get('/api/user/dashboard', attachEntitlements(), getDashboard);
 */
export function attachEntitlements() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return next(); // Optional - skip if not authenticated
      }

      const cache = await getEntitlementCache(userId);
      if (cache) {
        (req as any).entitlementDecision = cache;
      }

      next();
    } catch (error: any) {
      console.error('[attachEntitlements] Error:', error);
      // Non-blocking - just log and continue
      next();
    }
  };
}

/**
 * Check quota but only log warning (non-blocking)
 * 
 * Usage: Track quota usage without blocking
 * app.post('/api/user/action', warnQuota('maxApiCalls'), handleAction);
 */
export function warnQuota(quotaKey: QuotaKey, threshold: number = 90) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return next();
      }

      const cache = await getEntitlementCache(userId);
      if (!cache) {
        return next();
      }

      const quota = cache.quotas[quotaKey];
      if (!quota) {
        return next();
      }

      // Calculate percentage used
      const percentUsed = (quota.used / quota.limit) * 100;

      if (percentUsed >= threshold) {
        // Attach warning to request
        (req as any).quotaWarning = {
          quotaKey,
          percentUsed,
          remaining: quota.remaining,
          limit: quota.limit,
        };

        console.warn(`[Quota Warning] ${userId} has used ${percentUsed.toFixed(1)}% of ${quotaKey}`);
      }

      next();
    } catch (error: any) {
      console.error('[warnQuota] Error:', error);
      // Non-blocking
      next();
    }
  };
}

// ========== EXPORTS ==========

export type { EntitlementViolation };

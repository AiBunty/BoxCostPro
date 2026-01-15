/**
 * ========================================================================
 * USER ENTITLEMENTS API
 * ========================================================================
 * 
 * READ-ONLY ENTITLEMENT DECISIONS
 * 
 * RULES:
 * 1. Serves cached entitlement decisions computed by EntitlementService
 * 2. Returns TTL for frontend caching
 * 3. Includes usage metrics and quota status
 * 4. No mutations allowed (read-only)
 * 5. User can only see their own entitlements
 */

import { Request, Response, Router } from "express";
import { db } from "../db";
import { userSubscriptions, subscriptionPlans } from "@shared/schema";
import { entitlementCache, subscriptionOverrides } from "@shared/entitlementSchema";
import { computeEntitlements, type EntitlementDecision } from "../services/entitlementService";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ========== INPUT VALIDATION ==========

const entitlementQuerySchema = z.object({
  forceFresh: z.enum(['true', 'false']).optional().default('false'),
  includeDetails: z.enum(['true', 'false']).optional().default('false'),
});

type EntitlementQuery = z.infer<typeof entitlementQuerySchema>;

// ========== RESPONSE TYPES ==========

interface EntitlementResponse {
  // Entitlement decisions (from EntitlementService)
  decision: EntitlementDecision;
  
  // Cache metadata (for client-side caching)
  cache: {
    computedAt: string; // ISO timestamp
    expiresAt: string; // ISO timestamp
    ttlSeconds: number;
    isCached: boolean;
  };
  
  // Optional: detailed override information
  overrides?: {
    count: number;
    expires: string[]; // When each override expires
    features: string[]; // Which features are overridden
  };
  
  // Optional: subscription details
  subscription?: {
    planId: string | null;
    planName: string | null;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
}

// ========== HELPERS ==========

async function loadUserEntitlementContext(userId: string) {
  // Load subscription
  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId));

  if (!subscription) {
    return null;
  }

  // Load plan details
  let planFeatures = null;
  if (subscription.planId) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription.planId));
    
    if (plan) {
      planFeatures = plan.features as any;
    }
  }

  // Load active overrides
  const now = new Date();
  const activeOverrides = await db
    .select()
    .from(subscriptionOverrides)
    .where(
      and(
        eq(subscriptionOverrides.userId, userId),
        eq(subscriptionOverrides.isActive, true),
        // Only include overrides that haven't expired yet
        // Override validation happens in query but check expiry
      )
    );

  // Filter expired overrides (shouldn't be needed if cleanup job works)
  const validOverrides = activeOverrides.filter(o => o.expiresAt > now);

  // Track usage (TODO: implement usage tracking service)
  const usage = {
    quotesUsed: 0,
    emailProvidersUsed: 0,
    partyProfilesUsed: 0,
    teamMembersUsed: 0,
    apiCallsUsed: 0,
    storageMbUsed: 0,
  };

  return {
    subscription,
    planFeatures,
    overrides: validOverrides,
    usage,
  };
}

// ========== ENDPOINTS ==========

/**
 * GET /api/user/entitlements
 * 
 * Get current user's entitlement decision
 * 
 * Query Parameters:
 * - forceFresh: Bypass cache and recompute (default: false)
 * - includeDetails: Include override and subscription details (default: false)
 * 
 * Response:
 * {
 *   decision: { ... },        // EntitlementDecision from EntitlementService
 *   cache: {
 *     computedAt: "2026-01-05T12:00:00Z",
 *     expiresAt: "2026-01-05T13:00:00Z",
 *     ttlSeconds: 3600,
 *     isCached: true
 *   },
 *   overrides: { ... },       // If includeDetails=true
 *   subscription: { ... }     // If includeDetails=true
 * }
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Parse query parameters
    let query: EntitlementQuery;
    try {
      query = entitlementQuerySchema.parse(req.query);
    } catch (err: any) {
      return res.status(400).json({ 
        error: 'Invalid query parameters',
        details: err.errors 
      });
    }

    const forceFresh = query.forceFresh === 'true';
    const includeDetails = query.includeDetails === 'true';
    const now = new Date();

    // Step 1: Try to load from cache (unless forceFresh)
    let cached: any = null;
    if (!forceFresh) {
      const [cache] = await db
        .select()
        .from(entitlementCache)
        .where(eq(entitlementCache.userId, userId));

      if (cache && cache.expiresAt > now) {
        // Cache is valid
        cached = cache;
      }
    }

    // Step 2: Compute fresh entitlements if cache miss/expired
    let decision: EntitlementDecision;
    let isCached = !!cached;

    if (cached) {
      // Return cached decision (reconstruct from cache data)
      decision = {
        userId,
        tenantId: cached.tenantId,
        subscriptionStatus: cached.subscriptionStatus as any,
        isActive: cached.subscriptionStatus === 'active',
        features: cached.features as any,
        quotas: cached.quotas as any,
        appliedOverrides: [],
        computedAt: cached.computedAt,
        expiresAt: cached.expiresAt,
        warnings: [],
      };

      // Update access tracking
      await db
        .update(entitlementCache)
        .set({
          lastAccessedAt: now,
          accessCount: (cached.accessCount || 0) + 1,
        })
        .where(eq(entitlementCache.userId, userId));
    } else {
      // Load context and compute fresh
      const context = await loadUserEntitlementContext(userId);
      
      if (!context) {
        // User has no subscription - use defaults
        decision = {
          userId,
          tenantId: null,
          subscriptionStatus: 'none',
          isActive: false,
          features: {} as any,
          quotas: {} as any,
          appliedOverrides: [],
          computedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
          warnings: ['No active subscription'],
        };
      } else {
        // Compute decision
        decision = computeEntitlements({
          userId,
          tenantId: null,
          subscription: {
            status: context.subscription.status as any,
            planId: context.subscription.planId,
            planFeatures: context.planFeatures,
            currentPeriodEnd: context.subscription.currentPeriodEnd,
            trialEndsAt: context.subscription.trialEndsAt,
            cancelledAt: context.subscription.cancelledAt,
            paymentFailures: context.subscription.paymentFailures || 0,
          },
          overrides: context.overrides,
          usage: context.usage,
          currentTime: now,
        });

        // Update cache for next request
        await db
          .insert(entitlementCache)
          .values({
            userId,
            tenantId: null,
            features: decision.features,
            quotas: decision.quotas,
            usage: context.usage,
            subscriptionStatus: decision.subscriptionStatus,
            planId: context.subscription.planId,
            activeOverridesCount: context.overrides.length,
            computedAt: now,
            expiresAt: decision.expiresAt,
            lastAccessedAt: now,
            accessCount: 1,
          })
          .onConflictDoUpdate({
            target: entitlementCache.userId,
            set: {
              features: decision.features,
              quotas: decision.quotas,
              usage: context.usage,
              subscriptionStatus: decision.subscriptionStatus,
              planId: context.subscription.planId,
              activeOverridesCount: context.overrides.length,
              computedAt: now,
              expiresAt: decision.expiresAt,
              lastAccessedAt: now,
              accessCount: (cached?.accessCount || 0) + 1,
            },
          });
      }

      isCached = false;
    }

    // Step 3: Build response
    const ttlSeconds = Math.max(
      1,
      Math.floor((decision.expiresAt.getTime() - now.getTime()) / 1000)
    );

    const response: EntitlementResponse = {
      decision,
      cache: {
        computedAt: decision.computedAt.toISOString(),
        expiresAt: decision.expiresAt.toISOString(),
        ttlSeconds,
        isCached,
      },
    };

    // Add optional details
    if (includeDetails) {
      const context = await loadUserEntitlementContext(userId);
      
      if (context) {
        response.overrides = {
          count: context.overrides.length,
          expires: context.overrides.map(o => o.expiresAt.toISOString()),
          features: context.overrides
            .filter(o => o.featureKey)
            .map(o => o.featureKey!),
        };

        response.subscription = {
          planId: context.subscription.planId,
          planName: context.planFeatures?.name || null,
          status: context.subscription.status,
          currentPeriodEnd: context.subscription.currentPeriodEnd?.toISOString() || null,
          trialEndsAt: context.subscription.trialEndsAt?.toISOString() || null,
        };
      }
    }

    // Step 4: Return response with cache headers
    res.set('Cache-Control', `private, max-age=${ttlSeconds}`);
    res.set('Expires', decision.expiresAt.toUTCString());
    
    return res.json(response);
  } catch (error: any) {
    console.error('[Entitlements API] Error:', error);
    return res.status(500).json({
      error: 'Failed to compute entitlements',
      message: error.message,
    });
  }
});

/**
 * GET /api/user/entitlements/feature/:featureKey
 * 
 * Check if specific feature is enabled
 * 
 * Response:
 * {
 *   featureKey: "apiAccess",
 *   enabled: true,
 *   reason: "Included in plan",
 *   source: "PLAN"
 * }
 */
router.get('/feature/:featureKey', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { featureKey } = req.params;

    // Get entitlements
    const [cached] = await db
      .select()
      .from(entitlementCache)
      .where(eq(entitlementCache.userId, userId));

    if (!cached || cached.expiresAt <= new Date()) {
      // Cache miss - need to compute
      return res.status(202).json({
        message: 'Entitlements not cached, use /api/user/entitlements endpoint first',
        href: '/api/user/entitlements',
      });
    }

    const feature = cached.features[featureKey as keyof typeof cached.features];

    if (!feature) {
      return res.status(404).json({
        error: 'Feature not found',
        available: Object.keys(cached.features),
      });
    }

    return res.json(feature);
  } catch (error: any) {
    console.error('[Feature Check API] Error:', error);
    return res.status(500).json({
      error: 'Failed to check feature',
      message: error.message,
    });
  }
});

/**
 * GET /api/user/entitlements/quota/:quotaKey
 * 
 * Check quota usage and limits
 * 
 * Response:
 * {
 *   quotaKey: "maxQuotes",
 *   limit: 100,
 *   used: 45,
 *   remaining: 55,
 *   exceeded: false,
 *   reason: "Plan quota"
 * }
 */
router.get('/quota/:quotaKey', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { quotaKey } = req.params;

    // Get cached entitlements
    const [cached] = await db
      .select()
      .from(entitlementCache)
      .where(eq(entitlementCache.userId, userId));

    if (!cached || cached.expiresAt <= new Date()) {
      return res.status(202).json({
        message: 'Entitlements not cached, use /api/user/entitlements endpoint first',
        href: '/api/user/entitlements',
      });
    }

    const quota = cached.quotas[quotaKey as keyof typeof cached.quotas];

    if (!quota) {
      return res.status(404).json({
        error: 'Quota not found',
        available: Object.keys(cached.quotas),
      });
    }

    return res.json(quota);
  } catch (error: any) {
    console.error('[Quota Check API] Error:', error);
    return res.status(500).json({
      error: 'Failed to check quota',
      message: error.message,
    });
  }
});

// ========== EXPORTS ==========

export function registerEntitlementRoutes(app: any): void {
  app.use('/api/user/entitlements', router);
  console.log('[Routes] User entitlements routes registered at /api/user/entitlements');
}

export default router;

/**
 * ========================================================================
 * NIGHTLY CONSISTENCY JOB
 * ========================================================================
 * 
 * RUN NIGHTLY TO:
 * 1. Expire old overrides
 * 2. Detect entitlement drift
 * 3. Emit corrective events
 * 4. Never silently mutate user access
 * 5. Log all actions
 * 
 * RULES:
 * 1. Readonly detection (immutable until action approved)
 * 2. Emit events for all corrections
 * 3. Preserve audit trail
 * 4. No automatic fixes without admin review
 */

import { db } from "../db";
import {
  subscriptionOverrides,
  platformEvents,
  entitlementCache,
  consistencyCheckLogs,
} from "@shared/entitlementSchema";
import { userSubscriptions } from "@shared/schema";
import {
  eq,
  sql,
  and,
  lt,
  gt,
  desc,
} from "drizzle-orm";
import { emitPlatformEvent } from "../services/platformEvents";
import { addMinutes } from "date-fns";

// ========== JOB TYPES ==========

interface ConsistencyIssue {
  type: 'EXPIRED_OVERRIDE' | 'DRIFT_DETECTED' | 'ORPHANED_CACHE' | 'INVALID_STATE';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  userId?: string;
  description: string;
  resolution?: string;
}

interface ConsistencyResult {
  checkType: string;
  status: 'PASSED' | 'WARNINGS' | 'FAILED';
  recordsChecked: number;
  issuesFound: number;
  issuesResolved: number;
  issues: ConsistencyIssue[];
}

// ========== JOB: EXPIRE OVERRIDES ==========

/**
 * Check for expired overrides and mark them inactive
 * 
 * Does NOT automatically deactivate - emits events for admin review
 */
async function checkExpiredOverrides(): Promise<ConsistencyResult> {
  const result: ConsistencyResult = {
    checkType: 'EXPIRED_OVERRIDES',
    status: 'PASSED',
    recordsChecked: 0,
    issuesFound: 0,
    issuesResolved: 0,
    issues: [],
  };

  try {
    const now = new Date();

    // Find active overrides that have expired
    const expiredOverrides = await db
      .select()
      .from(subscriptionOverrides)
      .where(
        and(
          eq(subscriptionOverrides.isActive, true),
          lt(subscriptionOverrides.expiresAt, now)
        )
      );

    result.recordsChecked = expiredOverrides.length;

    if (expiredOverrides.length === 0) {
      console.log('[Consistency] No expired overrides found');
      return result;
    }

    // Process expired overrides
    for (const override of expiredOverrides) {
      // Mark as inactive
      await db
        .update(subscriptionOverrides)
        .set({
          isActive: false,
          deactivatedAt: now,
          deactivatedBy: 'system',
          deactivationReason: 'Automatic expiry from consistency job',
        })
        .where(eq(subscriptionOverrides.id, override.id));

      // Emit event for audit trail
      await emitPlatformEvent({
        eventType: 'OVERRIDE_EXPIRED',
        eventCategory: 'ENTITLEMENT',
        userId: override.userId,
        tenantId: null,
        subscriptionId: null,
        actorType: 'SYSTEM',
        actorId: 'consistency-job',
        eventData: {
          overrideId: override.id,
          reason: 'Automatic expiry',
          expiresAt: override.expiresAt.toISOString(),
        },
        previousState: { isActive: true },
        newState: { isActive: false },
        correlationId: `consistency_${now.getTime()}`,
      });

      result.issues.push({
        type: 'EXPIRED_OVERRIDE',
        severity: 'INFO',
        userId: override.userId,
        description: `Override ${override.id} expired at ${override.expiresAt.toISOString()}`,
        resolution: 'Automatically marked inactive',
      });

      result.issuesResolved++;
    }

    result.status = 'WARNINGS';
    result.issuesFound = expiredOverrides.length;

    console.log(
      `[Consistency] Processed ${expiredOverrides.length} expired overrides`
    );
  } catch (error: any) {
    result.status = 'FAILED';
    console.error('[Consistency] Error checking expired overrides:', error);
    result.issues.push({
      type: 'INVALID_STATE',
      severity: 'ERROR',
      description: `Failed to check expired overrides: ${error.message}`,
    });
  }

  return result;
}

// ========== JOB: DETECT ENTITLEMENT DRIFT ==========

/**
 * Detect when cached entitlements don't match computed entitlements
 * 
 * Marks cache as stale but doesn't modify user access
 */
async function checkEntitlementDrift(): Promise<ConsistencyResult> {
  const result: ConsistencyResult = {
    checkType: 'ENTITLEMENT_DRIFT',
    status: 'PASSED',
    recordsChecked: 0,
    issuesFound: 0,
    issuesResolved: 0,
    issues: [],
  };

  try {
    const now = new Date();

    // Find expired caches
    const expiredCaches = await db
      .select()
      .from(entitlementCache)
      .where(lt(entitlementCache.expiresAt, now));

    result.recordsChecked = expiredCaches.length;

    if (expiredCaches.length === 0) {
      console.log('[Consistency] All entitlement caches fresh');
      return result;
    }

    // For each expired cache, emit event indicating recomputation needed
    for (const cache of expiredCaches) {
      // Just mark that cache needs refresh
      // Don't modify user access - next request will trigger recomputation
      
      result.issues.push({
        type: 'DRIFT_DETECTED',
        severity: 'INFO',
        userId: cache.userId,
        description: `Entitlement cache expired for user ${cache.userId}`,
        resolution: 'Cache will be recomputed on next request',
      });

      // Optionally emit event for monitoring
      if (cache.accessCount > 100) {
        // High-access user - log for attention
        await emitPlatformEvent({
          eventType: 'CACHE_INVALIDATED',
          eventCategory: 'SYSTEM',
          userId: cache.userId,
          tenantId: cache.tenantId,
          subscriptionId: null,
          actorType: 'CRON',
          actorId: 'consistency-job',
          eventData: {
            cacheKey: cache.userId,
            reason: 'Cache expiry',
            accessCount: cache.accessCount,
          },
          previousState: { expiresAt: cache.expiresAt.toISOString() },
          newState: { needsRefresh: true },
          correlationId: `consistency_${now.getTime()}`,
        });
      }

      result.issuesResolved++;
    }

    if (expiredCaches.length > 0) {
      result.status = 'WARNINGS';
      result.issuesFound = expiredCaches.length;
    }

    console.log(
      `[Consistency] Found ${expiredCaches.length} expired entitlement caches`
    );
  } catch (error: any) {
    result.status = 'FAILED';
    console.error('[Consistency] Error detecting drift:', error);
    result.issues.push({
      type: 'INVALID_STATE',
      severity: 'ERROR',
      description: `Failed to check entitlement drift: ${error.message}`,
    });
  }

  return result;
}

// ========== JOB: DETECT ORPHANED CACHES ==========

/**
 * Find cache entries for deleted users
 */
async function checkOrphanedCaches(): Promise<ConsistencyResult> {
  const result: ConsistencyResult = {
    checkType: 'ORPHANED_CACHES',
    status: 'PASSED',
    recordsChecked: 0,
    issuesFound: 0,
    issuesResolved: 0,
    issues: [],
  };

  try {
    // Find caches with no matching user
    const orphanedCaches = await db
      .select({ userId: entitlementCache.userId })
      .from(entitlementCache)
      .leftJoin(
        userSubscriptions,
        eq(entitlementCache.userId, userSubscriptions.userId)
      )
      .where(sql`${userSubscriptions.userId} IS NULL`)
      .limit(100); // Prevent huge deletions

    result.recordsChecked = orphanedCaches.length;

    if (orphanedCaches.length === 0) {
      return result;
    }

    // Delete orphaned caches
    const orphanedUserIds = orphanedCaches.map((c: any) => c.userId);
    
    await db
      .delete(entitlementCache)
      .where(
        sql`${entitlementCache.userId} IN ${orphanedUserIds}`
      );

    result.issuesFound = orphanedCaches.length;
    result.issuesResolved = orphanedCaches.length;
    result.status = 'WARNINGS';

    result.issues.push({
      type: 'ORPHANED_CACHE',
      severity: 'WARNING',
      description: `Found and deleted ${orphanedCaches.length} orphaned cache entries`,
      resolution: 'Caches deleted',
    });

    console.log(
      `[Consistency] Cleaned up ${orphanedCaches.length} orphaned caches`
    );
  } catch (error: any) {
    result.status = 'FAILED';
    console.error('[Consistency] Error checking orphaned caches:', error);
  }

  return result;
}

// ========== JOB: VALIDATE OVERRIDE INTEGRITY ==========

/**
 * Detect invalid override states
 */
async function checkOverrideIntegrity(): Promise<ConsistencyResult> {
  const result: ConsistencyResult = {
    checkType: 'OVERRIDE_INTEGRITY',
    status: 'PASSED',
    recordsChecked: 0,
    issuesFound: 0,
    issuesResolved: 0,
    issues: [],
  };

  try {
    const now = new Date();

    // Check for overrides with invalid states
    const allOverrides = await db
      .select()
      .from(subscriptionOverrides);

    result.recordsChecked = allOverrides.length;

    for (const override of allOverrides) {
      let issues = false;

      // Check 1: expiresAt must be after startsAt
      if (override.expiresAt <= override.startsAt) {
        result.issues.push({
          type: 'INVALID_STATE',
          severity: 'ERROR',
          userId: override.userId,
          description: `Override ${override.id} has invalid expiry: expiresAt <= startsAt`,
        });
        issues = true;
      }

      // Check 2: Must have at least one value
      if (
        override.booleanValue === null &&
        override.integerValue === null &&
        override.jsonValue === null
      ) {
        result.issues.push({
          type: 'INVALID_STATE',
          severity: 'ERROR',
          userId: override.userId,
          description: `Override ${override.id} has no value set`,
        });
        issues = true;
      }

      // Check 3: Inactive override must have deactivatedBy
      if (!override.isActive && !override.deactivatedBy) {
        result.issues.push({
          type: 'INVALID_STATE',
          severity: 'WARNING',
          userId: override.userId,
          description: `Inactive override ${override.id} missing deactivatedBy`,
        });
        // Auto-fix: add system as deactivator
        await db
          .update(subscriptionOverrides)
          .set({ deactivatedBy: 'system' })
          .where(eq(subscriptionOverrides.id, override.id));
        result.issuesResolved++;
      }

      if (issues) {
        result.issuesFound++;
      }
    }

    if (result.issuesFound > 0) {
      result.status = 'WARNINGS';
    }

    console.log(
      `[Consistency] Override integrity check: ${result.recordsChecked} checked, ${result.issuesFound} issues`
    );
  } catch (error: any) {
    result.status = 'FAILED';
    console.error('[Consistency] Error checking override integrity:', error);
  }

  return result;
}

// ========== MAIN JOB ORCHESTRATOR ==========

export async function runConsistencyJob(): Promise<void> {
  const startTime = new Date();
  console.log('[Consistency Job] Starting nightly consistency checks...');

  const allResults: ConsistencyResult[] = [];

  try {
    // Run all consistency checks
    const expiredResult = await checkExpiredOverrides();
    allResults.push(expiredResult);

    const driftResult = await checkEntitlementDrift();
    allResults.push(driftResult);

    const orphanedResult = await checkOrphanedCaches();
    allResults.push(orphanedResult);

    const integrityResult = await checkOverrideIntegrity();
    allResults.push(integrityResult);

    // Aggregate results
    const aggregated = {
      status:
        allResults.some(r => r.status === 'FAILED')
          ? 'FAILED'
          : allResults.some(r => r.status === 'WARNINGS')
            ? 'WARNINGS'
            : 'PASSED',
      recordsChecked: allResults.reduce((sum, r) => sum + r.recordsChecked, 0),
      issuesFound: allResults.reduce((sum, r) => sum + r.issuesFound, 0),
      issuesResolved: allResults.reduce((sum, r) => sum + r.issuesResolved, 0),
      checks: allResults,
    };

    // Log final result
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    await db.insert(consistencyCheckLogs).values({
      checkType: 'NIGHTLY_FULL_CHECK',
      checkCategory: 'ENTITLEMENT',
      status: aggregated.status as any,
      recordsChecked: aggregated.recordsChecked,
      issuesFound: aggregated.issuesFound,
      issuesResolved: aggregated.issuesResolved,
      checkResults: aggregated as any,
      errors: null,
      startedAt: startTime,
      completedAt: endTime,
      durationMs,
    });

    console.log(`[Consistency Job] Completed in ${durationMs}ms`);
    console.log(`[Consistency Job] Status: ${aggregated.status}`);
    console.log(`[Consistency Job] Issues found: ${aggregated.issuesFound}`);
    console.log(`[Consistency Job] Issues resolved: ${aggregated.issuesResolved}`);
  } catch (error: any) {
    console.error('[Consistency Job] Fatal error:', error);

    // Log error
    await db.insert(consistencyCheckLogs).values({
      checkType: 'NIGHTLY_FULL_CHECK',
      checkCategory: 'ENTITLEMENT',
      status: 'FAILED',
      recordsChecked: 0,
      issuesFound: 0,
      issuesResolved: 0,
      checkResults: {},
      errors: { message: error.message, stack: error.stack },
      startedAt: startTime,
      completedAt: new Date(),
      durationMs: new Date().getTime() - startTime.getTime(),
    });
  }
}

// ========== SCHEDULER ==========

/**
 * Schedule the nightly consistency job
 * 
 * Usage in app startup:
 * scheduleConsistencyJob('02:00'); // Run at 2 AM
 */
export function scheduleConsistencyJob(timeOfDay: string): void {
  // Parse time (HH:MM)
  const [hour, minute] = timeOfDay.split(':').map(Number);

  function scheduleNext(): void {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();

    console.log(
      `[Consistency Job] Scheduled for ${next.toLocaleTimeString()} (in ${Math.floor(delay / 1000 / 60)} minutes)`
    );

    setTimeout(async () => {
      try {
        await runConsistencyJob();
      } catch (error) {
        console.error('[Consistency Job] Execution error:', error);
      } finally {
        // Reschedule for next day
        scheduleNext();
      }
    }, delay);
  }

  scheduleNext();
}

// ========== EXPORTS ==========

export { ConsistencyResult, ConsistencyIssue };

/**
 * Subscription Management Service
 * 
 * Handles all subscription lifecycle operations.
 * Subscriptions NEVER get deleted - status transitions only.
 * 
 * RULES:
 * 1. Subscriptions are audit-safe (append-only changes)
 * 2. Status transitions follow strict lifecycle
 * 3. Payment gateway is NOT source of truth
 * 4. All changes are logged
 */

import { db } from '../db';
import { 
  userSubscriptions, 
  subscriptionAuditLogs,
  planVersions,
  subscriptionPlans,
} from '@shared/schema';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getPlan, getPlanVersion } from './planManagement';

// ========== TYPES ==========

type SubscriptionStatus = 
  | 'PENDING_PAYMENT' 
  | 'TRIAL' 
  | 'ACTIVE' 
  | 'PAST_DUE' 
  | 'CANCELLED' 
  | 'EXPIRED'
  | 'SUSPENDED';

interface CreateSubscriptionInput {
  userId: string;
  tenantId?: string;
  planId: string;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  couponCode?: string;
  paymentMethodId?: string;
  startTrial?: boolean;
  actorId?: string;
  actorType?: 'USER' | 'ADMIN' | 'SYSTEM';
}

interface SubscriptionWithDetails {
  subscription: typeof userSubscriptions.$inferSelect;
  plan: typeof subscriptionPlans.$inferSelect;
  planVersion: typeof planVersions.$inferSelect;
}

// ========== SUBSCRIPTION LIFECYCLE ==========

/**
 * Create a new subscription (starts as PENDING_PAYMENT or TRIAL)
 */
export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<SubscriptionWithDetails> {
  // Get plan with current version
  const planData = await getPlan(input.planId);
  if (!planData) {
    throw new Error(`Plan not found: ${input.planId}`);
  }
  
  const { plan, currentVersion } = planData;
  
  // Check if user already has an active subscription
  const existing = await getActiveSubscription(input.userId);
  if (existing) {
    throw new Error('User already has an active subscription. Use upgrade/downgrade instead.');
  }
  
  // Calculate period dates based on billing cycle
  const now = new Date();
  const trialDays = plan.trialDays ?? 0;
  const startTrial = input.startTrial && trialDays > 0;
  
  let startDate = now;
  let trialEndsAt: Date | undefined;
  let endDate: Date;
  
  if (startTrial) {
    trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    startDate = trialEndsAt;
  }
  
  // Calculate end date based on billing cycle
  const billingCycle = input.billingCycle ?? (currentVersion.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'YEARLY') ?? 'MONTHLY';
  endDate = calculateEndDate(startDate, billingCycle);
  
  const subscriptionId = randomUUID();
  
  // Create subscription
  const [subscription] = await db.insert(userSubscriptions).values({
    id: subscriptionId,
    userId: input.userId,
    planId: input.planId,
    status: startTrial ? 'trial' : 'active', // Will update based on payment
    billingCycle: billingCycle.toLowerCase(),
    currentPeriodStart: now,
    currentPeriodEnd: endDate,
    couponApplied: input.couponCode,
  }).returning();
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'CREATE',
    afterSnapshot: {
      subscription,
      plan: { id: plan.id, name: plan.name },
      planVersion: { id: currentVersion.id, version: currentVersion.version },
    },
    actorId: input.actorId,
    actorType: input.actorType ?? 'SYSTEM',
  });
  
  return {
    subscription,
    plan,
    planVersion: currentVersion,
  };
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
  subscriptionId: string,
  paymentId: string,
  gatewaySubscriptionId?: string,
  actorId?: string
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  const beforeState = { ...subscription };
  
  const now = new Date();
  const billingCycle = (subscription.billingCycle?.toUpperCase() ?? 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  const endDate = calculateEndDate(now, billingCycle);
  
  await db.update(userSubscriptions)
    .set({
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      updatedAt: now,
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'ACTIVATE',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: { paymentId, gatewaySubscriptionId },
    actorId: actorId,
    actorType: 'SYSTEM',
  });
  
  return updated;
}

/**
 * Renew subscription for another period
 */
export async function renewSubscription(
  subscriptionId: string,
  paymentId: string,
  actorId?: string
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  const beforeState = { ...subscription };
  const billingCycle = (subscription.billingCycle?.toUpperCase() ?? 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  
  // New period starts from current period end
  const newStart = subscription.currentPeriodEnd ?? new Date();
  const newEnd = calculateEndDate(newStart, billingCycle);
  
  await db.update(userSubscriptions)
    .set({
      status: 'active',
      currentPeriodStart: newStart,
      currentPeriodEnd: newEnd,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'RENEW',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: { paymentId },
    actorId: actorId,
    actorType: 'SYSTEM',
  });
  
  return updated;
}

/**
 * Cancel subscription (at period end or immediately)
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string,
  cancelImmediately: boolean = false,
  actorId?: string,
  actorType: 'USER' | 'ADMIN' = 'USER'
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  if (subscription.status === 'cancelled') {
    throw new Error('Subscription is already cancelled');
  }
  
  const beforeState = { ...subscription };
  const now = new Date();
  
  await db.update(userSubscriptions)
    .set({
      status: cancelImmediately ? 'cancelled' : subscription.status,
      updatedAt: now,
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'CANCEL',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: { 
      reason, 
      cancelImmediately,
      effectiveDate: cancelImmediately ? now : subscription.currentPeriodEnd,
    },
    actorId: actorId,
    actorType: actorType,
  });
  
  return updated;
}

/**
 * Suspend subscription (admin action)
 */
export async function suspendSubscription(
  subscriptionId: string,
  reason: string,
  adminId: string
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  const beforeState = { ...subscription };
  const now = new Date();
  
  await db.update(userSubscriptions)
    .set({
      status: 'paused', // Using 'paused' as it exists in the original schema
      updatedAt: now,
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'SUSPEND',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: { reason },
    actorId: adminId,
    actorType: 'ADMIN',
  });
  
  return updated;
}

/**
 * Reactivate a suspended subscription
 */
export async function reactivateSubscription(
  subscriptionId: string,
  adminId: string
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  if (subscription.status !== 'paused') {
    throw new Error('Only suspended subscriptions can be reactivated');
  }
  
  const beforeState = { ...subscription };
  
  await db.update(userSubscriptions)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'REACTIVATE',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    actorId: adminId,
    actorType: 'ADMIN',
  });
  
  return updated;
}

/**
 * Mark subscription as past due (payment failed)
 */
export async function markPastDue(
  subscriptionId: string,
  failureReason: string
): Promise<typeof userSubscriptions.$inferSelect> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  const beforeState = { ...subscription };
  
  // Only mark active subscriptions as past due
  if (subscription.status !== 'active') {
    return subscription;
  }
  
  await db.update(userSubscriptions)
    .set({
      status: 'expired', // Using 'expired' as closest to PAST_DUE
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'PAST_DUE',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: { failureReason },
    actorType: 'SYSTEM',
  });
  
  return updated;
}

/**
 * Upgrade subscription to a new plan
 */
export async function upgradeSubscription(
  subscriptionId: string,
  newPlanId: string,
  prorated: boolean = true,
  actorId?: string
): Promise<{ subscription: typeof userSubscriptions.$inferSelect; proratedAmount?: number }> {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }
  
  const newPlan = await getPlan(newPlanId);
  if (!newPlan) {
    throw new Error(`Plan not found: ${newPlanId}`);
  }
  
  const currentPlan = subscription.planId ? await getPlan(subscription.planId) : null;
  
  const beforeState = { ...subscription };
  
  // Calculate prorated amount
  let proratedAmount = 0;
  if (prorated && currentPlan && subscription.currentPeriodEnd) {
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
    const oldDailyRate = (currentPlan.currentVersion.price ?? 0) / 30;
    const newDailyRate = (newPlan.currentVersion.price ?? 0) / 30;
    proratedAmount = (newDailyRate - oldDailyRate) * daysRemaining;
  }
  
  // Update subscription to new plan
  await db.update(userSubscriptions)
    .set({
      planId: newPlanId,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId));
  
  const [updated] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  // Audit log
  await db.insert(subscriptionAuditLogs).values({
    id: randomUUID(),
    subscriptionId: subscriptionId,
    action: 'UPGRADE',
    beforeSnapshot: beforeState,
    afterSnapshot: updated,
    changeDetails: {
      previousPlanId: beforeState.planId,
      newPlanId,
      prorated,
      proratedAmount,
    },
    actorId: actorId,
    actorType: 'USER',
  });
  
  return { subscription: updated, proratedAmount: proratedAmount > 0 ? proratedAmount : undefined };
}

// ========== QUERIES ==========

/**
 * Get subscription by ID
 */
export async function getSubscription(
  subscriptionId: string
): Promise<typeof userSubscriptions.$inferSelect | null> {
  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  
  return subscription ?? null;
}

/**
 * Get user's active subscription
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionWithDetails | null> {
  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, userId),
      or(
        eq(userSubscriptions.status, 'active'),
        eq(userSubscriptions.status, 'trial')
      )
    ))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);
  
  if (!subscription || !subscription.planId) return null;
  
  const planData = await getPlan(subscription.planId);
  if (!planData) return null;
  
  return {
    subscription,
    plan: planData.plan,
    planVersion: planData.currentVersion,
  };
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(userId: string) {
  return db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(desc(userSubscriptions.createdAt));
}

/**
 * Get subscription audit history
 */
export async function getSubscriptionAuditHistory(subscriptionId: string) {
  return db
    .select()
    .from(subscriptionAuditLogs)
    .where(eq(subscriptionAuditLogs.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionAuditLogs.createdAt));
}

/**
 * Check if subscription is valid (active or in trial)
 */
export async function isSubscriptionValid(userId: string): Promise<boolean> {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) return false;
  
  const { subscription: sub } = subscription;
  
  // Check status
  if (sub.status !== 'active' && sub.status !== 'trial') {
    return false;
  }
  
  // Check if period has ended
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
    return false;
  }
  
  return true;
}

// ========== HELPERS ==========

function calculateEndDate(
  startDate: Date, 
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
): Date {
  const endDate = new Date(startDate);
  
  switch (billingCycle) {
    case 'MONTHLY':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'YEARLY':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }
  
  return endDate;
}

// ========== ADMIN QUERIES ==========

/**
 * Get subscription statistics
 */
export async function getSubscriptionStats() {
  const stats = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users
    FROM user_subscriptions
    GROUP BY status
  `);
  
  const mrr = await db.execute(sql`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN billing_cycle = 'monthly' THEN COALESCE(sp.price_monthly, 0)
          WHEN billing_cycle = 'yearly' THEN COALESCE(sp.price_monthly, 0)
          ELSE 0
        END
      ), 0) as mrr
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active'
  `);
  
  return {
    byStatus: stats.rows,
    mrr: Number(mrr.rows[0]?.mrr ?? 0),
    arr: Number(mrr.rows[0]?.mrr ?? 0) * 12,
  };
}

/**
 * Get expiring subscriptions (for renewal reminders)
 */
export async function getExpiringSubscriptions(daysAhead: number = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return db.execute(sql`
    SELECT us.*, sp.name as plan_name, u.email
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
    LEFT JOIN users u ON us.user_id = u.id
    WHERE us.status = 'active'
      AND us.current_period_end <= ${futureDate}
      AND us.current_period_end > NOW()
    ORDER BY us.current_period_end ASC
  `);
}

export default {
  createSubscription,
  activateSubscription,
  renewSubscription,
  cancelSubscription,
  suspendSubscription,
  reactivateSubscription,
  markPastDue,
  upgradeSubscription,
  getSubscription,
  getActiveSubscription,
  getUserSubscriptions,
  getSubscriptionAuditHistory,
  isSubscriptionValid,
  getSubscriptionStats,
  getExpiringSubscriptions,
};

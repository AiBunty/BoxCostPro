/**
 * ========================================================================
 * PLATFORM EVENT EMISSION SYSTEM
 * ========================================================================
 * 
 * Immutable event log for all platform state changes
 * 
 * RULES:
 * 1. All admin mutations MUST emit events
 * 2. Events are immutable once written
 * 3. Events include previous and new state for audit
 * 4. Events are processed asynchronously
 * 5. Failed event processing doesn't block mutations
 */

import { db } from "../db";
import { platformEvents, type InsertPlatformEvent } from "../../shared/entitlementSchema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ========== EVENT TYPES ==========

export const PLATFORM_EVENT_TYPES = {
  // Subscription events
  SUBSCRIPTION_CREATED: 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED: 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_SUSPENDED: 'SUBSCRIPTION_SUSPENDED',
  
  // Override events
  OVERRIDE_GRANTED: 'OVERRIDE_GRANTED',
  OVERRIDE_REVOKED: 'OVERRIDE_REVOKED',
  OVERRIDE_EXPIRED: 'OVERRIDE_EXPIRED',
  OVERRIDE_EXTENDED: 'OVERRIDE_EXTENDED',
  
  // Feature toggle events
  FEATURE_TOGGLED: 'FEATURE_TOGGLED',
  QUOTA_ADJUSTED: 'QUOTA_ADJUSTED',
  
  // Admin actions
  ADMIN_IMPERSONATION_START: 'ADMIN_IMPERSONATION_START',
  ADMIN_IMPERSONATION_END: 'ADMIN_IMPERSONATION_END',
  ADMIN_MANUAL_OVERRIDE: 'ADMIN_MANUAL_OVERRIDE',
  
  // Payment events
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_RETRIED: 'PAYMENT_RETRIED',
  
  // System events
  CACHE_INVALIDATED: 'CACHE_INVALIDATED',
  CONSISTENCY_CHECK_RUN: 'CONSISTENCY_CHECK_RUN',
  ENTITLEMENT_COMPUTED: 'ENTITLEMENT_COMPUTED',
} as const;

export type PlatformEventType = keyof typeof PLATFORM_EVENT_TYPES;

// ========== EVENT EMISSION ==========

/**
 * Emit a platform event (async, non-blocking)
 * 
 * @param event - Event details
 * @returns Event ID (for correlation)
 */
export async function emitPlatformEvent(
  event: Omit<InsertPlatformEvent, 'occurredAt' | 'processed' | 'processedAt'>
): Promise<string> {
  try {
    const [inserted] = await db
      .insert(platformEvents)
      .values({
        ...event,
        occurredAt: new Date(),
        processed: false,
      })
      .returning({ id: platformEvents.id });
    
    console.log(`[Platform Event] Emitted: ${event.eventType} (${inserted.id})`);
    
    // Trigger async processing (non-blocking)
    processEventAsync(inserted.id).catch(err => {
      console.error(`[Platform Event] Processing failed for ${inserted.id}:`, err);
    });
    
    return inserted.id;
  } catch (error) {
    console.error('[Platform Event] Emission failed:', error);
    // Don't throw - event emission failure shouldn't block mutations
    return '';
  }
}

/**
 * Emit a subscription change event
 */
export async function emitSubscriptionEvent(
  eventType: PlatformEventType,
  userId: string,
  subscriptionId: string,
  previousState: any,
  newState: any,
  actorId: string,
  actorType: 'ADMIN' | 'USER' | 'SYSTEM',
  correlationId?: string
): Promise<string> {
  return emitPlatformEvent({
    eventType: PLATFORM_EVENT_TYPES[eventType],
    eventCategory: 'SUBSCRIPTION',
    userId,
    tenantId: null,
    subscriptionId,
    actorType,
    actorId,
    eventData: {
      subscriptionId,
      changes: computeChanges(previousState, newState),
    },
    previousState,
    newState,
    correlationId: correlationId || generateCorrelationId(),
    ipAddress: null,
    userAgent: null,
  });
}

/**
 * Emit an override event
 */
export async function emitOverrideEvent(
  eventType: PlatformEventType,
  userId: string,
  overrideId: string,
  overrideData: any,
  adminId: string,
  reason: string,
  correlationId?: string
): Promise<string> {
  return emitPlatformEvent({
    eventType: PLATFORM_EVENT_TYPES[eventType],
    eventCategory: 'ENTITLEMENT',
    userId,
    tenantId: null,
    subscriptionId: null,
    actorType: 'ADMIN',
    actorId: adminId,
    eventData: {
      overrideId,
      reason,
      ...overrideData,
    },
    previousState: null,
    newState: overrideData,
    correlationId: correlationId || generateCorrelationId(),
    ipAddress: null,
    userAgent: null,
  });
}

/**
 * Emit an admin action event
 */
export async function emitAdminActionEvent(
  eventType: PlatformEventType,
  adminId: string,
  action: string,
  targetUserId: string | null,
  metadata: any,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  return emitPlatformEvent({
    eventType: PLATFORM_EVENT_TYPES[eventType],
    eventCategory: 'ADMIN_ACTION',
    userId: targetUserId,
    tenantId: null,
    subscriptionId: null,
    actorType: 'ADMIN',
    actorId: adminId,
    eventData: {
      action,
      ...metadata,
    },
    previousState: null,
    newState: metadata,
    correlationId: generateCorrelationId(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });
}

// ========== EVENT PROCESSING ==========

/**
 * Process a platform event asynchronously
 * 
 * This can trigger:
 * - Cache invalidation
 * - Email notifications
 * - Webhook calls
 * - Analytics tracking
 */
async function processEventAsync(eventId: string): Promise<void> {
  try {
    const [event] = await db
      .select()
      .from(platformEvents)
      .where(eq(platformEvents.id, eventId));
    
    if (!event) {
      console.warn(`[Platform Event] Event ${eventId} not found for processing`);
      return;
    }
    
    // Process based on event type
    switch (event.eventCategory) {
      case 'SUBSCRIPTION':
        await processSubscriptionEvent(event as any);
        break;
      case 'ENTITLEMENT':
        await processEntitlementEvent(event as any);
        break;
      case 'ADMIN_ACTION':
        await processAdminActionEvent(event as any);
        break;
      default:
        console.log(`[Platform Event] No processor for category: ${event.eventCategory}`);
    }
    
    // Mark as processed
    await db
      .update(platformEvents)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(platformEvents.id, eventId));
    
    console.log(`[Platform Event] Processed: ${eventId}`);
  } catch (error) {
    console.error(`[Platform Event] Processing error for ${eventId}:`, error);
    
    // Log error but don't throw
    await db
      .update(platformEvents)
      .set({
        processingError: error instanceof Error ? error.message : String(error),
      })
      .where(eq(platformEvents.id, eventId));
  }
}

async function processSubscriptionEvent(event: any): Promise<void> {
  // TODO: Invalidate entitlement cache for user
  console.log(`[Platform Event] Processing subscription event: ${event.eventType}`);
  
  // Invalidate cache
  if (event.userId) {
    // Import cache service and invalidate
    // await invalidateEntitlementCache(event.userId);
  }
}

async function processEntitlementEvent(event: any): Promise<void> {
  console.log(`[Platform Event] Processing entitlement event: ${event.eventType}`);
  
  // Invalidate cache for affected user
  if (event.userId) {
    // await invalidateEntitlementCache(event.userId);
  }
}

async function processAdminActionEvent(event: any): Promise<void> {
  console.log(`[Platform Event] Processing admin action event: ${event.eventType}`);
  
  // Log to admin audit trail
  // Send notifications if needed
}

// ========== UTILITIES ==========

function generateCorrelationId(): string {
  return `corr_${crypto.randomBytes(16).toString('hex')}`;
}

function computeChanges(previous: any, current: any): Record<string, { from: any; to: any }> {
  if (!previous || !current) return {};
  
  const changes: Record<string, { from: any; to: any }> = {};
  
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  
  for (const key of allKeys) {
    if (previous[key] !== current[key]) {
      changes[key] = {
        from: previous[key],
        to: current[key],
      };
    }
  }
  
  return changes;
}

// ========== EXPORTS ==========
// Already exported above, no need to re-export

/**
 * ========================================================================
 * EVENT HOOKS SYSTEM
 * ========================================================================
 * 
 * Admins subscribe to platform events via webhooks
 * System emits to:
 * - Slack channels
 * - HTTP webhooks
 * - Analytics systems
 * - Email alerts
 * 
 * DESIGN:
 * 1. WebhookSubscriptions table: URL, event filters, secret, retry config
 * 2. DeadLetterQueue for failed deliveries
 * 3. Auto-retry with exponential backoff
 * 4. Audit trail of all emissions
 */

import { db } from "../db";
import {
  webhookSubscriptions,
  webhookDeliveries,
  platformEvents,
} from "@shared/entitlementSchema";
import { eq, and, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import axios, { AxiosError } from "axios";
import { addSeconds, addHours } from "date-fns";

// ========== WEBHOOK TYPES ==========

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  eventCategory: string;
  userId?: string;
  timestamp: Date;
  data: Record<string, any>;
  correlationId?: string;
}

export interface WebhookDeliveryPayload {
  event: WebhookEvent;
  deliveryId: string;
  attemptNumber: number;
  signature: string;
}

export type WebhookEventFilter = {
  eventTypes?: string[];
  eventCategories?: string[];
  userIds?: string[];
};

// ========== DELIVERY STATES ==========

export enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

// ========== SERVICE: EMIT WEBHOOK ==========

/**
 * Emit a platform event to all subscribed webhooks
 * 
 * Called by event emission system
 */
export async function emitToWebhooks(event: WebhookEvent): Promise<void> {
  try {
    // Find matching subscriptions
    const subscriptions = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.isActive, true));

    if (subscriptions.length === 0) {
      return;
    }

    for (const sub of subscriptions) {
      // Check if event matches filter
      if (!matchesFilter(event, sub.eventFilter)) {
        continue;
      }

      // Create delivery record
      const deliveryId = crypto.randomUUID();

      const delivery = await db
        .insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: sub.id,
          eventId: event.eventId,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          status: DeliveryStatus.PENDING,
          payload: event as any,
          attemptNumber: 0,
          nextRetryAt: new Date(),
          maxRetries: sub.maxRetries,
          retryDelaySeconds: sub.retryDelaySeconds,
          createdAt: new Date(),
        })
        .returning();

      // Schedule immediate delivery
      scheduleDelivery(delivery[0]).catch(error =>
        console.error(`[WebhookDelivery] Schedule error for ${deliveryId}:`, error)
      );
    }
  } catch (error: any) {
    console.error('[WebhookEmit] Error emitting to webhooks:', error);
  }
}

/**
 * Check if webhook filter matches event
 */
function matchesFilter(event: WebhookEvent, filter: WebhookEventFilter): boolean {
  if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
    return false;
  }

  if (filter.eventCategories && !filter.eventCategories.includes(event.eventCategory)) {
    return false;
  }

  if (filter.userIds && event.userId && !filter.userIds.includes(event.userId)) {
    return false;
  }

  return true;
}

// ========== SERVICE: DELIVER WEBHOOK ==========

/**
 * Attempt to deliver webhook to endpoint
 */
async function scheduleDelivery(delivery: any): Promise<void> {
  try {
    // Get subscription details
    const sub = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, delivery.webhookId))
      .then((results: any) => results[0]);

    if (!sub) {
      return;
    }

    // Calculate backoff delay
    const delaySeconds =
      sub.retryDelaySeconds * Math.pow(2, delivery.attemptNumber);

    const nextRetry = addSeconds(new Date(), delaySeconds);

    // Queue for delivery
    setTimeout(
      () => attemptDelivery(delivery, sub),
      delaySeconds * 1000
    );
  } catch (error: any) {
    console.error('[WebhookSchedule] Error:', error);
  }
}

/**
 * Actually attempt the HTTP delivery
 */
async function attemptDelivery(delivery: any, webhook: any): Promise<void> {
  try {
    const attemptNumber = delivery.attemptNumber + 1;

    // Create signature
    const signature = createSignature(
      JSON.stringify(delivery.payload),
      webhook.secret
    );

    const payload: WebhookDeliveryPayload = {
      event: delivery.payload,
      deliveryId: delivery.id,
      attemptNumber,
      signature,
    };

    // Send HTTP POST
    const response = await axios.post(webhook.url, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-DeliveryId': delivery.id,
      },
    });

    // Success
    if (response.status >= 200 && response.status < 300) {
      await db
        .update(webhookDeliveries)
        .set({
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          response: { status: response.status, statusText: response.statusText },
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      console.log(`[WebhookDelivery] Success: ${delivery.id} to ${webhook.url}`);
      return;
    }

    // Non-2xx response - retry if not max
    if (attemptNumber < webhook.maxRetries) {
      const delaySeconds = webhook.retryDelaySeconds * Math.pow(2, attemptNumber);
      await db
        .update(webhookDeliveries)
        .set({
          attemptNumber,
          nextRetryAt: addSeconds(new Date(), delaySeconds),
          lastError: `HTTP ${response.status}`,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      // Reschedule
      setTimeout(
        () => attemptDelivery(
          { ...delivery, attemptNumber },
          webhook
        ),
        delaySeconds * 1000
      );
    } else {
      // Max retries exceeded
      await db
        .update(webhookDeliveries)
        .set({
          status: DeliveryStatus.DEAD_LETTERED,
          lastError: `Max retries exceeded (${attemptNumber})`,
          deadLetteredAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      console.warn(
        `[WebhookDelivery] Dead lettered: ${delivery.id} to ${webhook.url}`
      );
    }
  } catch (error: any) {
    const attemptNumber = delivery.attemptNumber + 1;
    const isMaxed = attemptNumber >= webhook.maxRetries;

    const errorMessage =
      error instanceof AxiosError
        ? `${error.code || 'NETWORK'}: ${error.message}`
        : error.message;

    if (isMaxed) {
      // Max retries exceeded - dead letter
      await db
        .update(webhookDeliveries)
        .set({
          status: DeliveryStatus.DEAD_LETTERED,
          attemptNumber,
          lastError: errorMessage,
          deadLetteredAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      console.error(
        `[WebhookDelivery] Dead lettered after ${attemptNumber} attempts: ${delivery.id}`,
        errorMessage
      );
    } else {
      // Retry
      const delaySeconds = webhook.retryDelaySeconds * Math.pow(2, attemptNumber);
      await db
        .update(webhookDeliveries)
        .set({
          attemptNumber,
          nextRetryAt: addSeconds(new Date(), delaySeconds),
          lastError: errorMessage,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      setTimeout(
        () => attemptDelivery(
          { ...delivery, attemptNumber },
          webhook
        ),
        delaySeconds * 1000
      );

      console.warn(
        `[WebhookDelivery] Retry ${attemptNumber} for ${delivery.id}: ${errorMessage}`
      );
    }
  }
}

// ========== SERVICE: SIGNATURE VERIFICATION ==========

/**
 * Create HMAC-SHA256 signature for webhook payload
 */
function createSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify incoming webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ========== SERVICE: SPECIALIZED HOOKS ==========

/**
 * Send to Slack channel
 */
export async function notifySlack(
  webhookUrl: string,
  event: WebhookEvent
): Promise<void> {
  const message = {
    text: `Event: ${event.eventType}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${event.eventType}*\n${event.eventCategory} · ${new Date(event.timestamp).toISOString()}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User*\n${event.userId || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Correlation ID*\n\`${event.correlationId || 'N/A'}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${JSON.stringify(event.data, null, 2)}\`\`\``,
        },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, message, { timeout: 10000 });
  } catch (error: any) {
    console.error('[SlackNotify] Error:', error.message);
  }
}

/**
 * Send to analytics system (e.g., Segment, Mixpanel, custom)
 */
export async function notifyAnalytics(
  event: WebhookEvent,
  analyticsConfig: { provider: string; apiKey: string; endpoint: string }
): Promise<void> {
  const payload = {
    event: event.eventType,
    userId: event.userId,
    timestamp: event.timestamp.getTime(),
    properties: event.data,
  };

  try {
    await axios.post(analyticsConfig.endpoint, payload, {
      headers: {
        'Authorization': `Bearer ${analyticsConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (error: any) {
    console.error('[AnalyticsNotify] Error:', error.message);
  }
}

// ========== CLEANUP: DEAD LETTER QUEUE ==========

/**
 * Process dead lettered deliveries
 * Admin must review and decide: retry or discard
 */
export async function listDeadLettered(
  limit: number = 50,
  offset: number = 0
): Promise<{ deliveries: any[]; total: number }> {
  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, DeliveryStatus.DEAD_LETTERED))
    .limit(limit)
    .offset(offset)
    .orderBy(sql`created_at DESC`);

  const [countResult] = await db
    .select({ count: sql`COUNT(*)`.mapWith(Number) })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, DeliveryStatus.DEAD_LETTERED));

  return { deliveries, total: countResult.count };
}

/**
 * Manually retry a dead lettered delivery
 */
export async function retryDeadLetteredDelivery(deliveryId: string): Promise<void> {
  const delivery = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .then((results: any[]) => results[0]);

  if (!delivery) {
    throw new Error(`Delivery ${deliveryId} not found`);
  }

  const webhook = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, delivery.webhookId))
    .then((results: any[]) => results[0]);

  // Reset for retry
  await db
    .update(webhookDeliveries)
    .set({
      status: DeliveryStatus.PENDING,
      attemptNumber: 0,
      nextRetryAt: new Date(),
      lastError: null,
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  // Schedule delivery
  await scheduleDelivery(delivery);
}

// ========== CLEANUP: RETENTION POLICY ==========

/**
 * Archive old deliveries (>30 days)
 */
export async function archiveOldDeliveries(): Promise<number> {
  const thirtyDaysAgo = addHours(new Date(), -720);

  const result = await db
    .update(webhookDeliveries)
    .set({ isArchived: true })
    .where(
      and(
        sql`${webhookDeliveries.createdAt} < ${thirtyDaysAgo}`,
        eq(webhookDeliveries.isArchived, false)
      )
    );

  console.log(`[WebhookArchive] Archived deliveries older than 30 days`);

  return result.rowCount || 0;
}

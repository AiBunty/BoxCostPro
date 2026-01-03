/**
 * Event Publisher Service
 * 
 * Central service for publishing events to all registered automation providers.
 * Handles webhook delivery with retry, logging, and dead-letter queue.
 * 
 * Fire-and-forget pattern: Events are queued and processed asynchronously
 * to avoid blocking main application flow.
 */

import { db } from '../../db';
import { eq, and, inArray } from 'drizzle-orm';
import {
  AutomationEventType,
  WebhookDeliveryRequest,
  WebhookDeliveryResult,
} from './IAutomationProvider';
import { N8nAdapter } from './adapters/N8nAdapter';

interface EventPayload {
  event: AutomationEventType;
  data: Record<string, any>;
  metadata?: {
    tenantId?: number;
    userId?: number;
    correlationId?: string;
    timestamp?: string;
  };
}

interface WebhookSubscription {
  id: number;
  webhookUrl: string;
  events: AutomationEventType[];
  headers?: Record<string, string>;
  isActive: boolean;
  tenantId?: number;
}

// In-memory queue for event processing (use Redis in production)
const eventQueue: EventPayload[] = [];
let isProcessing = false;

// Webhook subscriptions cache
let subscriptionsCache: WebhookSubscription[] = [];
let subscriptionsCacheExpiry = 0;
const CACHE_TTL_MS = 300000; // 5 minutes

// Dead letter queue for failed deliveries
const deadLetterQueue: Array<{
  payload: EventPayload;
  webhookUrl: string;
  attempts: number;
  lastError: string;
  failedAt: Date;
}> = [];

/**
 * Load webhook subscriptions from database or env
 */
async function loadSubscriptions(): Promise<WebhookSubscription[]> {
  if (Date.now() < subscriptionsCacheExpiry && subscriptionsCache.length > 0) {
    return subscriptionsCache;
  }
  
  try {
    // In production, load from integration_webhooks table
    // For now, use environment variable configuration
    const subscriptions: WebhookSubscription[] = [];
    
    // n8n webhook
    if (process.env.N8N_WEBHOOK_URL) {
      subscriptions.push({
        id: 1,
        webhookUrl: process.env.N8N_WEBHOOK_URL,
        events: [
          'ticket.created',
          'ticket.updated',
          'ticket.escalated',
          'ticket.resolved',
          'ticket.sla_breached',
        ],
        isActive: true,
      });
    }
    
    // Generic webhook
    if (process.env.WEBHOOK_URL) {
      subscriptions.push({
        id: 2,
        webhookUrl: process.env.WEBHOOK_URL,
        events: [
          'ticket.created',
          'ticket.updated',
          'payment.completed',
          'invoice.created',
        ],
        isActive: true,
      });
    }
    
    subscriptionsCache = subscriptions;
    subscriptionsCacheExpiry = Date.now() + CACHE_TTL_MS;
    
    return subscriptions;
    
  } catch (error) {
    console.error('[EventPublisher] Failed to load subscriptions:', error);
    return subscriptionsCache;
  }
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  request: WebhookDeliveryRequest
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const maxRetries = request.retryCount || 3;
  const timeout = request.timeout || 30000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BoxCostPro/1.0',
        'X-Webhook-Event': request.event,
        'X-Webhook-Timestamp': new Date().toISOString(),
        'X-Webhook-Attempt': (attempt + 1).toString(),
        ...(request.headers || {}),
      };
      
      // Add HMAC signature if secret available
      if (process.env.WEBHOOK_SECRET) {
        const crypto = await import('crypto');
        const signature = crypto
          .createHmac('sha256', process.env.WEBHOOK_SECRET)
          .update(JSON.stringify(request.payload))
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }
      
      const response = await fetch(request.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request.payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      let responseBody: any = null;
      
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text().catch(() => null);
      }
      
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody,
          duration,
        };
      }
      
      // Non-retryable errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return {
          success: false,
          statusCode: response.status,
          responseBody,
          duration,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText,
            retryable: false,
          },
        };
      }
      
      // Retryable error - exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: {
            code: 'DELIVERY_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            retryable: true,
          },
        };
      }
    }
  }
  
  return {
    success: false,
    duration: Date.now() - startTime,
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: 'Failed after maximum retry attempts',
      retryable: false,
    },
  };
}

/**
 * Process queued events
 */
async function processEventQueue(): Promise<void> {
  if (isProcessing || eventQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  try {
    while (eventQueue.length > 0) {
      const payload = eventQueue.shift();
      if (!payload) continue;
      
      const subscriptions = await loadSubscriptions();
      const relevantSubs = subscriptions.filter(
        sub => sub.isActive && sub.events.includes(payload.event)
      );
      
      // Deliver to all relevant webhooks in parallel
      const deliveryPromises = relevantSubs.map(async sub => {
        const result = await deliverWebhook({
          webhookUrl: sub.webhookUrl,
          event: payload.event,
          payload: {
            event: payload.event,
            data: payload.data,
            metadata: {
              ...payload.metadata,
              timestamp: payload.metadata?.timestamp || new Date().toISOString(),
            },
          },
          headers: sub.headers,
        });
        
        // Log delivery
        console.log(
          `[EventPublisher] ${result.success ? '✓' : '✗'} ${payload.event} → ${sub.webhookUrl} (${result.duration}ms)`
        );
        
        // Add to dead letter queue if failed
        if (!result.success && !result.error?.retryable) {
          deadLetterQueue.push({
            payload,
            webhookUrl: sub.webhookUrl,
            attempts: 3,
            lastError: result.error?.message || 'Unknown error',
            failedAt: new Date(),
          });
        }
        
        return result;
      });
      
      await Promise.allSettled(deliveryPromises);
    }
    
  } finally {
    isProcessing = false;
  }
}

/**
 * Publish an event (fire-and-forget)
 * 
 * @param event The event type
 * @param data The event data
 * @param metadata Optional metadata
 */
export function publishEvent(
  event: AutomationEventType,
  data: Record<string, any>,
  metadata?: EventPayload['metadata']
): void {
  // Add to queue
  eventQueue.push({
    event,
    data,
    metadata: {
      ...metadata,
      correlationId: metadata?.correlationId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
  
  // Process queue asynchronously
  setImmediate(() => {
    processEventQueue().catch(error => {
      console.error('[EventPublisher] Queue processing error:', error);
    });
  });
}

/**
 * Publish event and wait for all deliveries (use sparingly)
 */
export async function publishEventSync(
  event: AutomationEventType,
  data: Record<string, any>,
  metadata?: EventPayload['metadata']
): Promise<WebhookDeliveryResult[]> {
  const subscriptions = await loadSubscriptions();
  const relevantSubs = subscriptions.filter(
    sub => sub.isActive && sub.events.includes(event)
  );
  
  const results = await Promise.all(
    relevantSubs.map(sub =>
      deliverWebhook({
        webhookUrl: sub.webhookUrl,
        event,
        payload: {
          event,
          data,
          metadata: {
            ...metadata,
            correlationId: metadata?.correlationId || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        headers: sub.headers,
      })
    )
  );
  
  return results;
}

/**
 * Get dead letter queue contents
 */
export function getDeadLetterQueue(): typeof deadLetterQueue {
  return [...deadLetterQueue];
}

/**
 * Retry a dead letter
 */
export async function retryDeadLetter(index: number): Promise<WebhookDeliveryResult | null> {
  const item = deadLetterQueue[index];
  if (!item) return null;
  
  const result = await deliverWebhook({
    webhookUrl: item.webhookUrl,
    event: item.payload.event,
    payload: {
      event: item.payload.event,
      data: item.payload.data,
      metadata: item.payload.metadata,
    },
  });
  
  if (result.success) {
    deadLetterQueue.splice(index, 1);
  } else {
    item.attempts++;
    item.lastError = result.error?.message || 'Unknown error';
    item.failedAt = new Date();
  }
  
  return result;
}

/**
 * Clear dead letter queue
 */
export function clearDeadLetterQueue(): void {
  deadLetterQueue.length = 0;
}

/**
 * Clear subscription cache (force reload)
 */
export function clearSubscriptionCache(): void {
  subscriptionsCacheExpiry = 0;
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  pending: number;
  deadLetters: number;
  isProcessing: boolean;
} {
  return {
    pending: eventQueue.length,
    deadLetters: deadLetterQueue.length,
    isProcessing,
  };
}

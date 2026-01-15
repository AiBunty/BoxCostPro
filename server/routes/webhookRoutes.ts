/**
 * ========================================================================
 * WEBHOOK SUBSCRIPTION ROUTES
 * ========================================================================
 * 
 * Admin API to manage webhook subscriptions
 * POST /api/admin/webhooks - Create subscription
 * PUT /api/admin/webhooks/:id - Update
 * DELETE /api/admin/webhooks/:id - Deactivate
 * GET /api/admin/webhooks - List
 * GET /api/admin/webhooks/:id - Get details
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { webhookSubscriptions, webhookDeliveries } from '@shared/entitlementSchema';
import {
  emitToWebhooks,
  notifySlack,
  listDeadLettered,
  retryDeadLetteredDelivery,
} from '../services/webhookService';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

// ========== VALIDATION SCHEMAS ==========

const createWebhookSchema = z.object({
  url: z.string().url('Must be valid URL'),
  eventFilter: z.object({
    eventTypes: z.array(z.string()).optional(),
    eventCategories: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
  }).optional(),
  maxRetries: z.number().int().min(1).max(10).default(5),
  retryDelaySeconds: z.number().int().min(1).max(3600).default(60),
  isActive: z.boolean().default(true),
  testPayload: z.boolean().default(false), // Send test event immediately
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  eventFilter: z.object({
    eventTypes: z.array(z.string()).optional(),
    eventCategories: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
  }).optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),
  retryDelaySeconds: z.number().int().min(1).max(3600).optional(),
  isActive: z.boolean().optional(),
});

const listWebhooksSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

// ========== POST: CREATE WEBHOOK ==========

router.post('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;

    const body = createWebhookSchema.parse(req.body);

    // Generate secret
    const secret = crypto.randomBytes(32).toString('hex');

    const created = await db
      .insert(webhookSubscriptions)
      .values({
        id: crypto.randomUUID(),
        url: body.url,
        eventFilter: body.eventFilter || {},
        secret,
        maxRetries: body.maxRetries,
        retryDelaySeconds: body.retryDelaySeconds,
        isActive: body.isActive,
        createdBy: admin.id,
        createdAt: new Date(),
      })
      .returning();

    const webhook = created[0];

    // Send test payload if requested
    if (body.testPayload) {
      const testEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'WEBHOOK_TEST',
        eventCategory: 'SYSTEM',
        timestamp: new Date(),
        data: {
          message: 'This is a test webhook delivery',
          webhookId: webhook.id,
        },
      };

      // Schedule delivery (fire and forget)
      await emitToWebhooks(testEvent).catch(err =>
        console.error('[WebhookTest] Error:', err)
      );
    }

    res.status(201).json({
      webhook,
      secret, // Only shown at creation time
      message: 'Webhook subscription created',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('[WebhookCreate] Error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// ========== GET: LIST WEBHOOKS ==========

router.get('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const query = listWebhooksSchema.parse(req.query);

    let dbQuery = db
      .select()
      .from(webhookSubscriptions);

    if (query.isActive !== undefined) {
      dbQuery = dbQuery.where(eq(webhookSubscriptions.isActive, query.isActive as any));
    }

    const webhooks = await dbQuery
      .limit(query.limit)
      .offset(query.offset);

    // Count total
    let countQuery = db
      .select({ count: crypto.randomUUID() }) // Placeholder for count
      .from(webhookSubscriptions);

    if (query.isActive !== undefined) {
      countQuery = countQuery.where(eq(webhookSubscriptions.isActive, query.isActive as any));
    }

    // Manual count fallback
    const allWebhooks = await countQuery;
    const total = allWebhooks.length;

    res.json({
      webhooks,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('[WebhookList] Error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// ========== GET: WEBHOOK DETAILS ==========

router.get('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .then((results: any) => results[0]);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Get recent deliveries
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .limit(10)
      .then((results: any) => results.reverse());

    res.json({
      webhook,
      recentDeliveries: deliveries,
      statistics: {
        totalAttempts: deliveries.length,
        successCount: deliveries.filter((d: any) => d.status === 'DELIVERED').length,
        failedCount: deliveries.filter((d: any) => d.status === 'FAILED').length,
        deadLetteredCount: deliveries.filter((d: any) => d.status === 'DEAD_LETTERED').length,
      },
    });
  } catch (error: any) {
    console.error('[WebhookDetail] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== PUT: UPDATE WEBHOOK ==========

router.put('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = updateWebhookSchema.parse(req.body);

    const webhook = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .then((results: any) => results[0]);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updated = await db
      .update(webhookSubscriptions)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, id))
      .returning();

    res.json({
      webhook: updated[0],
      message: 'Webhook updated',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('[WebhookUpdate] Error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// ========== DELETE: DEACTIVATE WEBHOOK ==========

router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .then((results: any) => results[0]);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updated = await db
      .update(webhookSubscriptions)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, id))
      .returning();

    res.json({
      message: 'Webhook deactivated',
      webhook: updated[0],
    });
  } catch (error: any) {
    console.error('[WebhookDelete] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== GET: DEAD LETTER QUEUE ==========

router.get('/dlq/list', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { deliveries, total } = await listDeadLettered(limit, offset);

    res.json({
      deliveries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('[DLQList] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== POST: RETRY DEAD LETTERED DELIVERY ==========

router.post('/dlq/retry/:deliveryId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;

    await retryDeadLetteredDelivery(deliveryId);

    res.json({ message: 'Delivery queued for retry' });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      console.error('[DLQRetry] Error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// ========== POST: TEST WEBHOOK ==========

router.post('/:id/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .then((results: any) => results[0]);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test event
    const testEvent = {
      eventId: crypto.randomUUID(),
      eventType: 'WEBHOOK_TEST',
      eventCategory: 'SYSTEM',
      timestamp: new Date(),
      data: {
        message: 'Test webhook delivery',
        webhookId: id,
        adminTrigger: true,
      },
    };

    await emitToWebhooks(testEvent);

    res.json({
      message: 'Test event sent',
      eventId: testEvent.eventId,
    });
  } catch (error: any) {
    console.error('[WebhookTest] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== EXPORTS ==========

export function registerWebhookRoutes(app: any): void {
  app.use('/api/admin/webhooks', router);
}

export default router;

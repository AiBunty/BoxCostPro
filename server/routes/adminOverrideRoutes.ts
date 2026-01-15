/**
 * ========================================================================
 * ADMIN OVERRIDE MANAGEMENT API
 * ========================================================================
 * 
 * CREATE, REVOKE, AND LIST SUBSCRIPTION OVERRIDES
 * 
 * RULES:
 * 1. Admin-only (requireSuperAdmin)
 * 2. Overrides must have expiry
 * 3. Reason required
 * 4. Immutable audit trail
 * 5. Events emitted for all mutations
 */

import { Request, Response, Router } from "express";
import { db } from "../db";
import { subscriptionOverrides } from "@shared/entitlementSchema";
import { users } from "@shared/schema";
import { eq, and, desc, sql, lt, gt } from "drizzle-orm";
import { emitOverrideEvent } from "../services/platformEvents";
import { z } from "zod";
import { addDays, addHours, isAfter as dateIsAfter } from "date-fns";

const router = Router();

// ========== VALIDATION SCHEMAS ==========

const createOverrideSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  overrideType: z.enum(['FEATURE_UNLOCK', 'QUOTA_INCREASE', 'TRIAL_EXTENSION', 'EMERGENCY_ACCESS']),
  featureKey: z.string().optional().nullable(),
  booleanValue: z.boolean().optional().nullable(),
  integerValue: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime('Invalid datetime'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  approvalTicketId: z.string().optional().nullable(),
});

type CreateOverrideRequest = z.infer<typeof createOverrideSchema>;

const listOverridesSchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(['active', 'expired', 'all']).optional().default('active'),
  sortBy: z.enum(['createdAt', 'expiresAt', 'userId']).optional().default('expiresAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

type ListOverridesQuery = z.infer<typeof listOverridesSchema>;

// ========== ENDPOINTS ==========

/**
 * POST /api/admin/overrides
 * 
 * Create a new subscription override
 * 
 * Request:
 * {
 *   userId: "user-123",
 *   overrideType: "FEATURE_UNLOCK",
 *   featureKey: "apiAccess",
 *   booleanValue: true,
 *   expiresAt: "2026-02-05T00:00:00Z",
 *   reason: "Customer requested API access for integration project",
 *   approvalTicketId: "ticket-456"
 * }
 * 
 * Response:
 * {
 *   override: { id, userId, ... },
 *   eventId: "event-123",
 *   message: "Override created successfully"
 * }
 */
router.post('/', async (req: any, res: Response) => {
  try {
    // Validate admin
    if (!req.admin || req.admin.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Super admin access required',
        role: req.admin?.role || 'none',
      });
    }

    // Validate input
    let input: CreateOverrideRequest;
    try {
      input = createOverrideSchema.parse(req.body);
    } catch (err: any) {
      return res.status(400).json({
        error: 'Invalid request',
        details: err.errors,
      });
    }

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, input.userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate expiry is in the future
    const expiresAt = new Date(input.expiresAt);
    const now = new Date();
    if (!dateIsAfter(expiresAt, now)) {
      return res.status(400).json({
        error: 'Invalid expiry',
        message: 'expiresAt must be in the future',
        now: now.toISOString(),
        provided: expiresAt.toISOString(),
      });
    }

    // Validate expiry is reasonable (max 1 year)
    const maxExpiry = addDays(now, 365);
    if (dateIsAfter(expiresAt, maxExpiry)) {
      return res.status(400).json({
        error: 'Invalid expiry',
        message: 'Overrides cannot extend beyond 1 year',
        maximum: maxExpiry.toISOString(),
      });
    }

    // Validate at least one value is provided
    if (
      input.booleanValue === null &&
      input.integerValue === null &&
      !input.featureKey
    ) {
      return res.status(400).json({
        error: 'Invalid override',
        message: 'Must provide featureKey and booleanValue, or integerValue',
      });
    }

    // Create override
    const [inserted] = await db
      .insert(subscriptionOverrides)
      .values({
        userId: input.userId,
        subscriptionId: null,
        overrideType: input.overrideType,
        featureKey: input.featureKey || null,
        booleanValue: input.booleanValue,
        integerValue: input.integerValue,
        jsonValue: null,
        startsAt: now,
        expiresAt,
        reason: input.reason,
        adminId: req.admin.id,
        approvalTicketId: input.approvalTicketId || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Emit event
    const eventId = await emitOverrideEvent(
      'OVERRIDE_GRANTED',
      input.userId,
      inserted.id,
      {
        overrideType: input.overrideType,
        featureKey: input.featureKey,
        booleanValue: input.booleanValue,
        integerValue: input.integerValue,
        expiresAt: expiresAt.toISOString(),
      },
      req.admin.id,
      input.reason,
      `override_${inserted.id}`
    );

    console.log(`[Override] Created override ${inserted.id} for user ${input.userId}`);

    return res.status(201).json({
      success: true,
      override: {
        id: inserted.id,
        userId: inserted.userId,
        overrideType: inserted.overrideType,
        featureKey: inserted.featureKey,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        admin: req.admin.email,
      },
      eventId,
      message: 'Override created successfully',
    });
  } catch (error: any) {
    console.error('[Create Override] Error:', error);
    return res.status(500).json({
      error: 'Failed to create override',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/overrides/:overrideId
 * 
 * Revoke (deactivate) an override
 * 
 * Response:
 * {
 *   success: true,
 *   override: { id, userId, ... },
 *   eventId: "event-123",
 *   message: "Override revoked"
 * }
 */
router.delete('/:overrideId', async (req: any, res: Response) => {
  try {
    // Validate admin
    if (!req.admin || req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { overrideId } = req.params;

    // Find override
    const [override] = await db
      .select()
      .from(subscriptionOverrides)
      .where(eq(subscriptionOverrides.id, overrideId));

    if (!override) {
      return res.status(404).json({ error: 'Override not found' });
    }

    const now = new Date();

    // Revoke override
    const [updated] = await db
      .update(subscriptionOverrides)
      .set({
        isActive: false,
        deactivatedAt: now,
        deactivatedBy: req.admin.id,
        deactivationReason: 'Admin revocation',
        updatedAt: now,
      })
      .where(eq(subscriptionOverrides.id, overrideId))
      .returning();

    // Emit event
    const eventId = await emitOverrideEvent(
      'OVERRIDE_REVOKED',
      override.userId,
      overrideId,
      {
        revokedAt: now.toISOString(),
        reason: 'Admin revocation',
      },
      req.admin.id,
      'Override revoked by admin',
      `override_${overrideId}`
    );

    console.log(`[Override] Revoked override ${overrideId} for user ${override.userId}`);

    return res.json({
      success: true,
      override: {
        id: updated.id,
        userId: updated.userId,
        revokedAt: now.toISOString(),
        wasPendingExpiry: override.expiresAt > now,
      },
      eventId,
      message: 'Override revoked',
    });
  } catch (error: any) {
    console.error('[Revoke Override] Error:', error);
    return res.status(500).json({
      error: 'Failed to revoke override',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/overrides
 * 
 * List active and expired overrides
 * 
 * Query Parameters:
 * - userId: Filter by user ID (optional)
 * - status: 'active', 'expired', or 'all' (default: active)
 * - sortBy: 'createdAt', 'expiresAt', or 'userId' (default: expiresAt)
 * - sortOrder: 'asc' or 'desc' (default: desc)
 * - limit: Max 100 (default: 50)
 * - offset: Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   overrides: [ ... ],
 *   total: 125,
 *   limit: 50,
 *   offset: 0,
 *   hasMore: true
 * }
 */
router.get('/', async (req: any, res: Response) => {
  try {
    // Validate admin
    if (!req.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Validate query
    let query: ListOverridesQuery;
    try {
      query = listOverridesSchema.parse(req.query);
    } catch (err: any) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: err.errors,
      });
    }

    const now = new Date();

    // Build where clause
    const conditions = [];

    if (query.userId) {
      conditions.push(eq(subscriptionOverrides.userId, query.userId));
    }

    if (query.status === 'active') {
      conditions.push(
        and(
          eq(subscriptionOverrides.isActive, true),
          isBefore(now, subscriptionOverrides.expiresAt)
        )
      );
    } else if (query.status === 'expired') {
      conditions.push(
        isBefore(subscriptionOverrides.expiresAt, sql`now()`)
      );
    }
    // 'all' has no additional condition

    // Build order
    let orderBy: any;
    if (query.sortBy === 'createdAt') {
      orderBy = query.sortOrder === 'desc'
        ? desc(subscriptionOverrides.createdAt)
        : subscriptionOverrides.createdAt;
    } else if (query.sortBy === 'expiresAt') {
      orderBy = query.sortOrder === 'desc'
        ? desc(subscriptionOverrides.expiresAt)
        : subscriptionOverrides.expiresAt;
    } else {
      orderBy = query.sortOrder === 'desc'
        ? desc(subscriptionOverrides.userId)
        : subscriptionOverrides.userId;
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptionOverrides)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Get paginated results
    const overrides = await db
      .select()
      .from(subscriptionOverrides)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(query.offset);

    return res.json({
      success: true,
      overrides: overrides.map(o => ({
        id: o.id,
        userId: o.userId,
        overrideType: o.overrideType,
        featureKey: o.featureKey,
        status: o.isActive && o.expiresAt > now ? 'active' : 'inactive',
        expiresAt: o.expiresAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        createdBy: o.adminId,
        reason: o.reason,
        approvalTicketId: o.approvalTicketId,
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    });
  } catch (error: any) {
    console.error('[List Overrides] Error:', error);
    return res.status(500).json({
      error: 'Failed to list overrides',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/overrides/user/:userId
 * 
 * Get all overrides for a specific user
 */
router.get('/user/:userId', async (req: any, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const now = new Date();

    const overrides = await db
      .select()
      .from(subscriptionOverrides)
      .where(eq(subscriptionOverrides.userId, userId))
      .orderBy(desc(subscriptionOverrides.expiresAt));

    return res.json({
      success: true,
      userId,
      total: overrides.length,
      active: overrides.filter(o => o.isActive && o.expiresAt > now).length,
      overrides: overrides.map(o => ({
        id: o.id,
        overrideType: o.overrideType,
        featureKey: o.featureKey,
        status: o.isActive && o.expiresAt > now ? 'active' : 'inactive',
        expiresAt: o.expiresAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        reason: o.reason,
      })),
    });
  } catch (error: any) {
    console.error('[Get User Overrides] Error:', error);
    return res.status(500).json({
      error: 'Failed to get user overrides',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/overrides/:overrideId
 * 
 * Get detailed information about an override
 */
router.get('/:overrideId', async (req: any, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { overrideId } = req.params;

    const [override] = await db
      .select()
      .from(subscriptionOverrides)
      .where(eq(subscriptionOverrides.id, overrideId));

    if (!override) {
      return res.status(404).json({ error: 'Override not found' });
    }

    const now = new Date();

    return res.json({
      success: true,
      override: {
        id: override.id,
        userId: override.userId,
        subscriptionId: override.subscriptionId,
        overrideType: override.overrideType,
        featureKey: override.featureKey,
        booleanValue: override.booleanValue,
        integerValue: override.integerValue,
        jsonValue: override.jsonValue,
        status: override.isActive && override.expiresAt > now ? 'active' : 'inactive',
        startsAt: override.startsAt.toISOString(),
        expiresAt: override.expiresAt.toISOString(),
        reason: override.reason,
        approvalTicketId: override.approvalTicketId,
        createdBy: override.adminId,
        createdAt: override.createdAt.toISOString(),
        deactivatedBy: override.deactivatedBy,
        deactivatedAt: override.deactivatedAt?.toISOString() || null,
        deactivationReason: override.deactivationReason,
      },
    });
  } catch (error: any) {
    console.error('[Get Override] Error:', error);
    return res.status(500).json({
      error: 'Failed to get override',
      message: error.message,
    });
  }
});

// ========== EXPORTS ==========

export function registerAdminOverrideRoutes(app: any): void {
  app.use('/api/admin/overrides', router);
  console.log('[Routes] Admin override routes registered at /api/admin/overrides');
}

export default router;

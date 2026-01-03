/**
 * Governance API Routes - Admin controls for FinOps, Security, and Compliance
 * 
 * Endpoints:
 * - /api/admin/governance/toggles - Feature toggles (kill switches)
 * - /api/admin/governance/incident - Incident mode controls
 * - /api/admin/governance/budgets - AI/messaging budget management
 * - /api/admin/governance/health - Provider health monitoring
 * - /api/admin/governance/security - Security violation logs
 * - /api/admin/governance/compliance - Data retention & exports
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

// Import FinOps services
import { budgetGuardService } from '../services/finops/budgetGuardService';
import { messagingRateLimiter } from '../services/finops/messagingRateLimiter';
import { providerHealthMonitor } from '../services/finops/providerHealthMonitor';

// Import Security services
import { aiSafetyGuard } from '../services/security/aiSafetyGuard';
import { immutabilityGuard } from '../services/security/immutabilityGuard';

// Import Compliance services
import { retentionComplianceService } from '../services/compliance/retentionComplianceService';

// Import schemas
import {
  governanceToggles,
  incidentModeState,
  securityViolationLogs,
  aiUsageLimits,
  aiSecurityLogs,
} from '../../shared/schema-finops-security';

// Import middleware
import { adminEndpoint, superAdminEndpoint } from '../middleware/zeroTrustPipeline';
import { logIntegrationAudit } from '../integrations/helpers/auditLogger';

const router = Router();

// ============================================================================
// FEATURE TOGGLES (KILL SWITCHES)
// ============================================================================

/**
 * GET /api/admin/governance/toggles
 * List all governance toggles
 */
router.get('/toggles', async (req: Request, res: Response) => {
  try {
    const toggles = await db.select()
      .from(governanceToggles)
      .orderBy(desc(governanceToggles.changedAt));
    
    res.json({ toggles });
  } catch (error) {
    console.error('[Governance] Error fetching toggles:', error);
    res.status(500).json({ error: 'Failed to fetch toggles' });
  }
});

/**
 * POST /api/admin/governance/toggles
 * Create or update a toggle
 */
router.post('/toggles', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      scope: z.enum(['GLOBAL', 'TENANT', 'PROVIDER']),
      tenantId: z.string().optional(),
      providerId: z.string().optional(),
      toggleType: z.string(),
      isEnabled: z.boolean(),
      reason: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId || 'system';
    
    // Check for existing toggle
    let query: any = eq(governanceToggles.toggleType, body.toggleType);
    if (body.scope === 'GLOBAL') {
      query = and(query, eq(governanceToggles.scope, 'GLOBAL'));
    } else if (body.scope === 'TENANT' && body.tenantId) {
      query = and(query, eq(governanceToggles.tenantId, body.tenantId));
    } else if (body.scope === 'PROVIDER' && body.providerId) {
      query = and(query, eq(governanceToggles.providerId, body.providerId));
    }
    
    const [existing] = await db.select().from(governanceToggles).where(query);
    
    if (existing) {
      // Update existing
      const [updated] = await db.update(governanceToggles)
        .set({
          isEnabled: body.isEnabled,
          reason: body.reason,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          changedBy: userId,
          changedAt: new Date(),
          previousValue: existing.isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(governanceToggles.id, existing.id))
        .returning();
      
      res.json({ toggle: updated, action: 'updated' });
    } else {
      // Create new
      const [created] = await db.insert(governanceToggles)
        .values({
          scope: body.scope,
          tenantId: body.tenantId,
          providerId: body.providerId,
          toggleType: body.toggleType,
          isEnabled: body.isEnabled,
          reason: body.reason,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          changedBy: userId,
        })
        .returning();
      
      res.json({ toggle: created, action: 'created' });
    }
    
    // Audit log
    logIntegrationAudit({
      integrationCode: 'GOVERNANCE',
      action: 'TOGGLE_CHANGED',
      details: {
        toggleType: body.toggleType,
        scope: body.scope,
        isEnabled: body.isEnabled,
        changedBy: userId,
      },
    }).catch(() => {});
    
  } catch (error) {
    console.error('[Governance] Error updating toggle:', error);
    res.status(500).json({ error: 'Failed to update toggle' });
  }
});

/**
 * DELETE /api/admin/governance/toggles/:id
 * Delete a toggle
 */
router.delete('/toggles/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(governanceToggles)
      .where(eq(governanceToggles.id, req.params.id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Governance] Error deleting toggle:', error);
    res.status(500).json({ error: 'Failed to delete toggle' });
  }
});

// ============================================================================
// INCIDENT MODE
// ============================================================================

/**
 * GET /api/admin/governance/incident
 * Get current incident mode state
 */
router.get('/incident', async (req: Request, res: Response) => {
  try {
    const [active] = await db.select()
      .from(incidentModeState)
      .where(eq(incidentModeState.isActive, true));
    
    const history = await db.select()
      .from(incidentModeState)
      .orderBy(desc(incidentModeState.createdAt))
      .limit(10);
    
    res.json({ active, history });
  } catch (error) {
    console.error('[Governance] Error fetching incident mode:', error);
    res.status(500).json({ error: 'Failed to fetch incident mode' });
  }
});

/**
 * POST /api/admin/governance/incident/activate
 * Activate incident mode
 */
router.post('/incident/activate', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      modeType: z.enum(['INCIDENT_MODE', 'READ_ONLY_MODE', 'MAINTENANCE_MODE', 'EMERGENCY_LOCKDOWN']),
      incidentId: z.string().optional(),
      incidentDescription: z.string().optional(),
      affectedTenants: z.array(z.string()).optional(),
      affectedFeatures: z.array(z.string()).optional(),
      autoDeactivateMinutes: z.number().optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId || 'system';
    
    // Deactivate any existing active mode
    await db.update(incidentModeState)
      .set({ 
        isActive: false, 
        deactivatedAt: new Date(),
        deactivatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(incidentModeState.isActive, true));
    
    // Create new incident mode
    const autoDeactivateAt = body.autoDeactivateMinutes 
      ? new Date(Date.now() + body.autoDeactivateMinutes * 60 * 1000)
      : null;
    
    const [created] = await db.insert(incidentModeState)
      .values({
        modeType: body.modeType,
        isActive: true,
        incidentId: body.incidentId,
        incidentDescription: body.incidentDescription,
        affectedTenants: body.affectedTenants as any,
        affectedFeatures: body.affectedFeatures as any,
        activatedAt: new Date(),
        activatedBy: userId,
        autoDeactivateAt,
      })
      .returning();
    
    // Audit log
    logIntegrationAudit({
      integrationCode: 'GOVERNANCE',
      action: 'INCIDENT_MODE_ACTIVATED',
      details: {
        modeType: body.modeType,
        activatedBy: userId,
        incidentId: body.incidentId,
      },
    }).catch(() => {});
    
    res.json({ success: true, incidentMode: created });
  } catch (error) {
    console.error('[Governance] Error activating incident mode:', error);
    res.status(500).json({ error: 'Failed to activate incident mode' });
  }
});

/**
 * POST /api/admin/governance/incident/deactivate
 * Deactivate incident mode
 */
router.post('/incident/deactivate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId || 'system';
    
    const [updated] = await db.update(incidentModeState)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(incidentModeState.isActive, true))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'No active incident mode found' });
    }
    
    logIntegrationAudit({
      integrationCode: 'GOVERNANCE',
      action: 'INCIDENT_MODE_DEACTIVATED',
      details: { deactivatedBy: userId },
    }).catch(() => {});
    
    res.json({ success: true, incidentMode: updated });
  } catch (error) {
    console.error('[Governance] Error deactivating incident mode:', error);
    res.status(500).json({ error: 'Failed to deactivate incident mode' });
  }
});

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/governance/budgets
 * List all tenant AI budgets
 */
router.get('/budgets', async (req: Request, res: Response) => {
  try {
    const budgets = await db.select()
      .from(aiUsageLimits)
      .orderBy(desc(aiUsageLimits.updatedAt));
    
    res.json({ budgets });
  } catch (error) {
    console.error('[Governance] Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

/**
 * GET /api/admin/governance/budgets/:tenantId
 * Get specific tenant budget with usage stats
 */
router.get('/budgets/:tenantId', async (req: Request, res: Response) => {
  try {
    const stats = await budgetGuardService.getTenantUsageStats(req.params.tenantId);
    
    // Get usage breakdown
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const breakdown = await budgetGuardService.getUsageBreakdown(
      req.params.tenantId,
      startOfMonth,
      now
    );
    
    res.json({ ...stats, breakdown });
  } catch (error) {
    console.error('[Governance] Error fetching tenant budget:', error);
    res.status(500).json({ error: 'Failed to fetch tenant budget' });
  }
});

/**
 * PUT /api/admin/governance/budgets/:tenantId
 * Update tenant budget limits
 */
router.put('/budgets/:tenantId', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      monthlyTokenLimit: z.number().optional(),
      dailyRequestLimit: z.number().optional(),
      monthlyBudgetCents: z.number().optional(),
      dailyBudgetCents: z.number().optional(),
      hardStop: z.boolean().optional(),
      warningThresholdPercent: z.number().min(0).max(100).optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId;
    
    const updated = await budgetGuardService.updateTenantLimits(
      req.params.tenantId,
      body,
      userId
    );
    
    res.json({ budget: updated });
  } catch (error) {
    console.error('[Governance] Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

/**
 * GET /api/admin/governance/messaging/:tenantId
 * Get tenant messaging limits
 */
router.get('/messaging/:tenantId', async (req: Request, res: Response) => {
  try {
    const stats = await messagingRateLimiter.getAllChannelStats(req.params.tenantId);
    res.json({ channels: stats });
  } catch (error) {
    console.error('[Governance] Error fetching messaging stats:', error);
    res.status(500).json({ error: 'Failed to fetch messaging stats' });
  }
});

/**
 * PUT /api/admin/governance/messaging/:tenantId/:channel
 * Update tenant messaging limits
 */
router.put('/messaging/:tenantId/:channel', async (req: Request, res: Response) => {
  try {
    const channel = req.params.channel.toUpperCase() as 'WHATSAPP' | 'EMAIL' | 'SMS';
    
    const schema = z.object({
      dailyLimit: z.number().optional(),
      monthlyLimit: z.number().optional(),
      queueOnLimit: z.boolean().optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId;
    
    const updated = await messagingRateLimiter.updateChannelLimits(
      req.params.tenantId,
      channel,
      body,
      userId
    );
    
    res.json({ limits: updated });
  } catch (error) {
    console.error('[Governance] Error updating messaging limits:', error);
    res.status(500).json({ error: 'Failed to update messaging limits' });
  }
});

// ============================================================================
// PROVIDER HEALTH
// ============================================================================

/**
 * GET /api/admin/governance/health
 * Get all provider health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const providers = await providerHealthMonitor.getAllHealthStatus();
    const dashboard = await providerHealthMonitor.getHealthDashboardStats();
    
    res.json({ providers, dashboard });
  } catch (error) {
    console.error('[Governance] Error fetching health:', error);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

/**
 * POST /api/admin/governance/health/:providerCode/toggle
 * Enable/disable a provider
 */
router.post('/health/:providerCode/toggle', async (req: Request, res: Response) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const userId = (req as any).auth?.userId;
    
    await providerHealthMonitor.setProviderActive(
      req.params.providerCode,
      isActive,
      userId
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Governance] Error toggling provider:', error);
    res.status(500).json({ error: 'Failed to toggle provider' });
  }
});

/**
 * POST /api/admin/governance/health/:providerCode/reset-circuit
 * Reset circuit breaker for a provider
 */
router.post('/health/:providerCode/reset-circuit', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    
    await providerHealthMonitor.resetCircuit(req.params.providerCode, userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Governance] Error resetting circuit:', error);
    res.status(500).json({ error: 'Failed to reset circuit' });
  }
});

/**
 * PUT /api/admin/governance/health/:providerCode/priority
 * Set provider priority
 */
router.put('/health/:providerCode/priority', async (req: Request, res: Response) => {
  try {
    const { priority } = z.object({ priority: z.number().min(1).max(10) }).parse(req.body);
    const userId = (req as any).auth?.userId;
    
    await providerHealthMonitor.setProviderPriority(
      req.params.providerCode,
      priority,
      userId
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Governance] Error setting priority:', error);
    res.status(500).json({ error: 'Failed to set priority' });
  }
});

// ============================================================================
// SECURITY
// ============================================================================

/**
 * GET /api/admin/governance/security/violations
 * List security violations
 */
router.get('/security/violations', async (req: Request, res: Response) => {
  try {
    const { severity, type, startDate, endDate, limit = 100 } = req.query;
    
    let query = db.select().from(securityViolationLogs);
    
    // Apply filters
    const conditions: any[] = [];
    if (severity) conditions.push(eq(securityViolationLogs.severity, severity as string));
    if (type) conditions.push(eq(securityViolationLogs.violationType, type as string));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const violations = await query
      .orderBy(desc(securityViolationLogs.createdAt))
      .limit(Number(limit));
    
    res.json({ violations });
  } catch (error) {
    console.error('[Governance] Error fetching violations:', error);
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

/**
 * GET /api/admin/governance/security/ai
 * List AI security incidents
 */
router.get('/security/ai', async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, limit = 100 } = req.query;
    
    let query = db.select().from(aiSecurityLogs);
    
    if (type) {
      query = query.where(eq(aiSecurityLogs.incidentType, type as string)) as any;
    }
    
    const incidents = await query
      .orderBy(desc(aiSecurityLogs.createdAt))
      .limit(Number(limit));
    
    res.json({ incidents });
  } catch (error) {
    console.error('[Governance] Error fetching AI incidents:', error);
    res.status(500).json({ error: 'Failed to fetch AI security incidents' });
  }
});

/**
 * GET /api/admin/governance/security/stats
 * Get security statistics
 */
router.get('/security/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const aiStats = await aiSafetyGuard.getSecurityStats(start, end);
    
    res.json({ aiStats });
  } catch (error) {
    console.error('[Governance] Error fetching security stats:', error);
    res.status(500).json({ error: 'Failed to fetch security stats' });
  }
});

/**
 * POST /api/admin/governance/security/violations/:id/review
 * Mark a violation as reviewed
 */
router.post('/security/violations/:id/review', async (req: Request, res: Response) => {
  try {
    const { notes } = z.object({ notes: z.string().optional() }).parse(req.body);
    const userId = (req as any).auth?.userId;
    
    const [updated] = await db.update(securityViolationLogs)
      .set({
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(securityViolationLogs.id, req.params.id))
      .returning();
    
    res.json({ violation: updated });
  } catch (error) {
    console.error('[Governance] Error reviewing violation:', error);
    res.status(500).json({ error: 'Failed to review violation' });
  }
});

// ============================================================================
// COMPLIANCE
// ============================================================================

/**
 * GET /api/admin/governance/compliance/policies
 * List retention policies
 */
router.get('/compliance/policies', async (req: Request, res: Response) => {
  try {
    const policies = await retentionComplianceService.getRetentionPolicies();
    res.json({ policies });
  } catch (error) {
    console.error('[Governance] Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch retention policies' });
  }
});

/**
 * PUT /api/admin/governance/compliance/policies/:entityType
 * Update a retention policy
 */
router.put('/compliance/policies/:entityType', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      retentionDays: z.number().optional(),
      archiveBeforePurge: z.boolean().optional(),
      description: z.string().optional(),
      legalBasis: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId;
    
    const updated = await retentionComplianceService.updateRetentionPolicy(
      req.params.entityType,
      body,
      userId
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    res.json({ policy: updated });
  } catch (error) {
    console.error('[Governance] Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

/**
 * POST /api/admin/governance/compliance/purge
 * Execute a purge
 */
router.post('/compliance/purge', async (req: Request, res: Response) => {
  try {
    const { entityType, dryRun } = z.object({
      entityType: z.string(),
      dryRun: z.boolean().default(false),
    }).parse(req.body);
    
    const userId = (req as any).auth?.userId;
    
    const result = await retentionComplianceService.executePurge(entityType, {
      dryRun,
      executedBy: userId,
    });
    
    res.json({ result });
  } catch (error) {
    console.error('[Governance] Error executing purge:', error);
    res.status(500).json({ error: 'Failed to execute purge' });
  }
});

/**
 * GET /api/admin/governance/compliance/purge-history
 * Get purge history
 */
router.get('/compliance/purge-history', async (req: Request, res: Response) => {
  try {
    const history = await retentionComplianceService.getPurgeHistory();
    res.json({ history });
  } catch (error) {
    console.error('[Governance] Error fetching purge history:', error);
    res.status(500).json({ error: 'Failed to fetch purge history' });
  }
});

/**
 * POST /api/admin/governance/compliance/reports
 * Request a compliance report
 */
router.post('/compliance/reports', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      reportType: z.enum(['AI_USAGE', 'SUPPORT_CONVERSATIONS', 'SLA_REPORT', 'MESSAGING_HISTORY', 'AUDIT_LOGS', 'ACCESS_MATRIX', 'SECURITY_INCIDENTS', 'BILLING_HISTORY']),
      format: z.enum(['CSV', 'JSON', 'PDF']),
      tenantId: z.string().optional(),
      dateRangeStart: z.string().datetime(),
      dateRangeEnd: z.string().datetime(),
      filters: z.record(z.any()).optional(),
    });
    
    const body = schema.parse(req.body);
    const userId = (req as any).auth?.userId;
    
    const job = await retentionComplianceService.generateReport({
      ...body,
      dateRangeStart: new Date(body.dateRangeStart),
      dateRangeEnd: new Date(body.dateRangeEnd),
      requestedBy: userId,
    });
    
    res.json({ job });
  } catch (error) {
    console.error('[Governance] Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

/**
 * GET /api/admin/governance/compliance/reports/:id
 * Get report status
 */
router.get('/compliance/reports/:id', async (req: Request, res: Response) => {
  try {
    const job = await retentionComplianceService.getReportStatus(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ job });
  } catch (error) {
    console.error('[Governance] Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

/**
 * GET /api/admin/governance/compliance/dashboard
 * Get compliance dashboard stats
 */
router.get('/compliance/dashboard', async (req: Request, res: Response) => {
  try {
    const stats = await retentionComplianceService.getComplianceDashboard();
    const integrity = await immutabilityGuard.getIntegrityReport();
    
    res.json({ ...stats, integrity });
  } catch (error) {
    console.error('[Governance] Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

/**
 * GET /api/admin/governance/compliance/immutable
 * Get immutable records report
 */
router.get('/compliance/immutable', async (req: Request, res: Response) => {
  try {
    const integrity = await immutabilityGuard.getIntegrityReport();
    const tamperAttempts = await immutabilityGuard.getTamperAttempts(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );
    
    res.json({ integrity, tamperAttempts });
  } catch (error) {
    console.error('[Governance] Error fetching immutable report:', error);
    res.status(500).json({ error: 'Failed to fetch immutable report' });
  }
});

export default router;

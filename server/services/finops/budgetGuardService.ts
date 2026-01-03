/**
 * Budget Guard Service - AI Cost Governance & Usage Tracking
 * 
 * Provides:
 * 1. Pre-request budget checks (hard stop or warning)
 * 2. Real-time cost estimation
 * 3. Usage recording with cost calculation
 * 4. Automatic daily/monthly reset
 * 5. Warning/limit notifications
 */

import { db } from "../../db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { 
  aiUsageLimits, 
  aiUsageLogs, 
  aiCostRates,
  AiUsageLimit,
  AiCostRate,
  InsertAiUsageLog,
  DEFAULT_AI_COST_RATES,
} from "../../../shared/schema-finops-security";
import { logIntegrationAudit } from "../../integrations/helpers/auditLogger";

// Budget check result
export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  warning?: string;
  budgetUtilization: {
    dailyPercent: number;
    monthlyPercent: number;
  };
  estimatedCostCents: number;
}

// Cost calculation result
export interface CostCalculation {
  promptCostCents: number;
  completionCostCents: number;
  totalCostCents: number;
  rateApplied: {
    promptPer1k: number;
    completionPer1k: number;
  };
}

// Usage recording input
export interface UsageRecordInput {
  tenantId: string;
  userId?: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  source: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  latencyMs?: number;
  wasFailover?: boolean;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'RATE_LIMITED';
  errorMessage?: string;
}

class BudgetGuardService {
  private costRatesCache: Map<string, AiCostRate> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if AI request is allowed under budget constraints
   */
  async checkBudget(
    tenantId: string,
    estimatedTokens: number = 2000 // Default estimate for pre-check
  ): Promise<BudgetCheckResult> {
    try {
      // Get or create tenant limits
      const limits = await this.getOrCreateTenantLimits(tenantId);
      
      // Check if daily/monthly resets are needed
      await this.checkAndResetCounters(limits);
      
      // Estimate cost (use average rate if model unknown)
      const estimatedCost = await this.estimateCost(estimatedTokens);
      
      // Calculate utilization percentages
      const dailyPercent = limits.dailyBudgetCents > 0 
        ? ((limits.costTodayCents || 0) / limits.dailyBudgetCents) * 100 
        : 0;
      const monthlyPercent = limits.monthlyBudgetCents > 0 
        ? ((limits.costThisMonthCents || 0) / limits.monthlyBudgetCents) * 100 
        : 0;
      
      const budgetUtilization = {
        dailyPercent: Math.round(dailyPercent * 100) / 100,
        monthlyPercent: Math.round(monthlyPercent * 100) / 100,
      };
      
      // Check if hard stopped
      if (limits.hardStop) {
        // Check daily limit
        if (limits.dailyBudgetCents > 0 && 
            (limits.costTodayCents || 0) >= limits.dailyBudgetCents) {
          await this.notifyLimitExceeded(tenantId, 'daily', limits);
          return {
            allowed: false,
            reason: 'Daily AI budget exceeded. Requests blocked until tomorrow.',
            budgetUtilization,
            estimatedCostCents: estimatedCost,
          };
        }
        
        // Check monthly limit
        if (limits.monthlyBudgetCents > 0 && 
            (limits.costThisMonthCents || 0) >= limits.monthlyBudgetCents) {
          await this.notifyLimitExceeded(tenantId, 'monthly', limits);
          return {
            allowed: false,
            reason: 'Monthly AI budget exceeded. Requests blocked until next month.',
            budgetUtilization,
            estimatedCostCents: estimatedCost,
          };
        }
        
        // Check daily request limit
        if (limits.dailyRequestLimit && 
            (limits.requestsToday || 0) >= limits.dailyRequestLimit) {
          return {
            allowed: false,
            reason: 'Daily AI request limit exceeded.',
            budgetUtilization,
            estimatedCostCents: estimatedCost,
          };
        }
      }
      
      // Generate warnings (even if not hard stopped)
      let warning: string | undefined;
      const warningThreshold = limits.warningThresholdPercent || 80;
      
      if (dailyPercent >= warningThreshold || monthlyPercent >= warningThreshold) {
        const highestUsage = dailyPercent > monthlyPercent ? 'daily' : 'monthly';
        const highestPercent = Math.max(dailyPercent, monthlyPercent);
        warning = `AI budget warning: ${Math.round(highestPercent)}% of ${highestUsage} limit used.`;
        await this.notifyWarningThreshold(tenantId, highestUsage, highestPercent, limits);
      }
      
      return {
        allowed: true,
        warning,
        budgetUtilization,
        estimatedCostCents: estimatedCost,
      };
    } catch (error) {
      console.error('[BudgetGuard] Error checking budget:', error);
      // Fail open - allow request but log the error
      return {
        allowed: true,
        warning: 'Budget check failed - allowing request but logging error.',
        budgetUtilization: { dailyPercent: 0, monthlyPercent: 0 },
        estimatedCostCents: 0,
      };
    }
  }

  /**
   * Record AI usage after a request completes
   */
  async recordUsage(input: UsageRecordInput): Promise<void> {
    try {
      // Calculate actual cost
      const costResult = await this.calculateCost(
        input.provider,
        input.model,
        input.promptTokens,
        input.completionTokens
      );
      
      const totalTokens = input.promptTokens + input.completionTokens;
      
      // Insert usage log
      await db.insert(aiUsageLogs).values({
        tenantId: input.tenantId,
        userId: input.userId,
        provider: input.provider,
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens,
        costCents: costResult.totalCostCents,
        source: input.source,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        latencyMs: input.latencyMs,
        wasFailover: input.wasFailover,
        status: input.status,
        errorMessage: input.errorMessage,
      });
      
      // Update tenant counters (only if successful)
      if (input.status === 'SUCCESS') {
        await db.update(aiUsageLimits)
          .set({
            tokensUsedThisMonth: sql`${aiUsageLimits.tokensUsedThisMonth} + ${totalTokens}`,
            requestsToday: sql`${aiUsageLimits.requestsToday} + 1`,
            costThisMonthCents: sql`${aiUsageLimits.costThisMonthCents} + ${costResult.totalCostCents}`,
            costTodayCents: sql`${aiUsageLimits.costTodayCents} + ${costResult.totalCostCents}`,
            updatedAt: new Date(),
          })
          .where(eq(aiUsageLimits.tenantId, input.tenantId));
      }
      
      // Fire-and-forget audit log
      logIntegrationAudit({
        integrationCode: `AI_${input.provider}`,
        action: 'USAGE_RECORDED',
        tenantId: input.tenantId,
        details: {
          model: input.model,
          tokens: totalTokens,
          costCents: costResult.totalCostCents,
          source: input.source,
        },
      }).catch(() => {});
      
    } catch (error) {
      console.error('[BudgetGuard] Error recording usage:', error);
      // Don't throw - usage recording shouldn't break the main flow
    }
  }

  /**
   * Calculate cost for a specific request
   */
  async calculateCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<CostCalculation> {
    const rate = await this.getCostRate(provider, model);
    
    const promptCostCents = Math.ceil((promptTokens / 1000) * rate.promptCostPer1kCents);
    const completionCostCents = Math.ceil((completionTokens / 1000) * rate.completionCostPer1kCents);
    
    return {
      promptCostCents,
      completionCostCents,
      totalCostCents: promptCostCents + completionCostCents,
      rateApplied: {
        promptPer1k: rate.promptCostPer1kCents,
        completionPer1k: rate.completionCostPer1kCents,
      },
    };
  }

  /**
   * Estimate cost for budget pre-check (using average rate)
   */
  async estimateCost(totalTokens: number): Promise<number> {
    // Use an average of common model costs for estimation
    const avgCostPer1k = 200; // ~$0.002 per 1k tokens (middle ground)
    return Math.ceil((totalTokens / 1000) * avgCostPer1k);
  }

  /**
   * Get current usage stats for a tenant
   */
  async getTenantUsageStats(tenantId: string): Promise<{
    limits: AiUsageLimit;
    todayUsage: { requests: number; tokens: number; costCents: number };
    monthUsage: { requests: number; tokens: number; costCents: number };
    utilizationPercent: { daily: number; monthly: number };
  }> {
    const limits = await this.getOrCreateTenantLimits(tenantId);
    await this.checkAndResetCounters(limits);
    
    // Re-fetch after potential reset
    const [updatedLimits] = await db.select()
      .from(aiUsageLimits)
      .where(eq(aiUsageLimits.tenantId, tenantId));
    
    const today = {
      requests: updatedLimits.requestsToday || 0,
      tokens: 0, // Calculated from logs if needed
      costCents: updatedLimits.costTodayCents || 0,
    };
    
    const month = {
      requests: 0, // Calculated from logs if needed
      tokens: updatedLimits.tokensUsedThisMonth || 0,
      costCents: updatedLimits.costThisMonthCents || 0,
    };
    
    const dailyPercent = updatedLimits.dailyBudgetCents > 0
      ? (today.costCents / updatedLimits.dailyBudgetCents) * 100
      : 0;
    const monthlyPercent = updatedLimits.monthlyBudgetCents > 0
      ? (month.costCents / updatedLimits.monthlyBudgetCents) * 100
      : 0;
    
    return {
      limits: updatedLimits,
      todayUsage: today,
      monthUsage: month,
      utilizationPercent: {
        daily: Math.round(dailyPercent * 100) / 100,
        monthly: Math.round(monthlyPercent * 100) / 100,
      },
    };
  }

  /**
   * Update tenant budget limits
   */
  async updateTenantLimits(
    tenantId: string,
    updates: Partial<{
      monthlyTokenLimit: number;
      dailyRequestLimit: number;
      monthlyBudgetCents: number;
      dailyBudgetCents: number;
      hardStop: boolean;
      warningThresholdPercent: number;
    }>,
    updatedBy?: string
  ): Promise<AiUsageLimit> {
    const [updated] = await db.update(aiUsageLimits)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(aiUsageLimits.tenantId, tenantId))
      .returning();
    
    // Audit log
    logIntegrationAudit({
      integrationCode: 'FINOPS',
      action: 'BUDGET_LIMITS_UPDATED',
      tenantId,
      details: { updates, updatedBy },
    }).catch(() => {});
    
    return updated;
  }

  /**
   * Get usage breakdown by provider/model for analytics
   */
  async getUsageBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    byProvider: { provider: string; requests: number; tokens: number; costCents: number }[];
    bySource: { source: string; requests: number; tokens: number; costCents: number }[];
    byModel: { model: string; requests: number; tokens: number; costCents: number }[];
    dailyTrend: { date: string; requests: number; tokens: number; costCents: number }[];
  }> {
    const logs = await db.select()
      .from(aiUsageLogs)
      .where(and(
        eq(aiUsageLogs.tenantId, tenantId),
        gte(aiUsageLogs.createdAt, startDate),
        lte(aiUsageLogs.createdAt, endDate),
        eq(aiUsageLogs.status, 'SUCCESS')
      ));
    
    // Aggregate by provider
    const byProvider = this.aggregateBy(logs, 'provider');
    
    // Aggregate by source
    const bySource = this.aggregateBy(logs, 'source');
    
    // Aggregate by model
    const byModel = this.aggregateBy(logs, 'model');
    
    // Daily trend
    const dailyMap = new Map<string, { requests: number; tokens: number; costCents: number }>();
    for (const log of logs) {
      const date = (log.createdAt as Date).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { requests: 0, tokens: 0, costCents: 0 };
      dailyMap.set(date, {
        requests: existing.requests + 1,
        tokens: existing.tokens + log.totalTokens,
        costCents: existing.costCents + log.costCents,
      });
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return { byProvider, bySource, byModel, dailyTrend };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private aggregateBy(
    logs: any[],
    field: 'provider' | 'source' | 'model'
  ): { [key: string]: string; requests: number; tokens: number; costCents: number }[] {
    const map = new Map<string, { requests: number; tokens: number; costCents: number }>();
    for (const log of logs) {
      const key = log[field] || 'unknown';
      const existing = map.get(key) || { requests: 0, tokens: 0, costCents: 0 };
      map.set(key, {
        requests: existing.requests + 1,
        tokens: existing.tokens + log.totalTokens,
        costCents: existing.costCents + log.costCents,
      });
    }
    return Array.from(map.entries())
      .map(([key, stats]) => ({ [field]: key, ...stats } as any));
  }

  private async getOrCreateTenantLimits(tenantId: string): Promise<AiUsageLimit> {
    const [existing] = await db.select()
      .from(aiUsageLimits)
      .where(eq(aiUsageLimits.tenantId, tenantId));
    
    if (existing) return existing;
    
    // Create default limits
    const now = new Date();
    const [created] = await db.insert(aiUsageLimits)
      .values({
        tenantId,
        dailyResetAt: now,
        monthlyResetAt: now,
      })
      .returning();
    
    return created;
  }

  private async checkAndResetCounters(limits: AiUsageLimit): Promise<void> {
    const now = new Date();
    const updates: any = {};
    
    // Check daily reset
    if (limits.dailyResetAt) {
      const resetDate = new Date(limits.dailyResetAt);
      if (now.getUTCDate() !== resetDate.getUTCDate() || 
          now.getTime() - resetDate.getTime() > 24 * 60 * 60 * 1000) {
        updates.requestsToday = 0;
        updates.costTodayCents = 0;
        updates.dailyResetAt = now;
      }
    }
    
    // Check monthly reset
    if (limits.monthlyResetAt) {
      const resetDate = new Date(limits.monthlyResetAt);
      if (now.getUTCMonth() !== resetDate.getUTCMonth() ||
          now.getUTCFullYear() !== resetDate.getUTCFullYear()) {
        updates.tokensUsedThisMonth = 0;
        updates.costThisMonthCents = 0;
        updates.monthlyResetAt = now;
        updates.lastWarningNotifiedAt = null;
        updates.lastLimitNotifiedAt = null;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now;
      await db.update(aiUsageLimits)
        .set(updates)
        .where(eq(aiUsageLimits.id, limits.id));
    }
  }

  private async getCostRate(provider: string, model: string): Promise<AiCostRate> {
    const cacheKey = `${provider}:${model}`;
    
    // Check cache
    if (Date.now() < this.cacheExpiry && this.costRatesCache.has(cacheKey)) {
      return this.costRatesCache.get(cacheKey)!;
    }
    
    // Refresh cache
    const rates = await db.select()
      .from(aiCostRates)
      .where(eq(aiCostRates.isActive, true));
    
    this.costRatesCache.clear();
    for (const rate of rates) {
      this.costRatesCache.set(`${rate.provider}:${rate.model}`, rate);
    }
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    
    // Return specific rate or fallback to defaults
    if (this.costRatesCache.has(cacheKey)) {
      return this.costRatesCache.get(cacheKey)!;
    }
    
    // Fallback to default rates
    const defaultRate = DEFAULT_AI_COST_RATES.find(
      r => r.provider === provider && r.model === model
    ) || DEFAULT_AI_COST_RATES[0]; // Use first as absolute fallback
    
    return {
      id: 'default',
      provider,
      model,
      promptCostPer1kCents: defaultRate.promptCostPer1kCents,
      completionCostPer1kCents: defaultRate.completionCostPer1kCents,
      effectiveFrom: new Date(),
      effectiveTo: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async notifyWarningThreshold(
    tenantId: string,
    period: 'daily' | 'monthly',
    percent: number,
    limits: AiUsageLimit
  ): Promise<void> {
    // Check if we've already notified recently (within 1 hour)
    const lastNotified = limits.lastWarningNotifiedAt;
    if (lastNotified && Date.now() - new Date(lastNotified).getTime() < 60 * 60 * 1000) {
      return;
    }
    
    // Update notification timestamp
    await db.update(aiUsageLimits)
      .set({ lastWarningNotifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiUsageLimits.id, limits.id));
    
    // TODO: Integrate with notification system
    console.log(`[BudgetGuard] Warning notification: Tenant ${tenantId} at ${percent}% of ${period} budget`);
  }

  private async notifyLimitExceeded(
    tenantId: string,
    period: 'daily' | 'monthly',
    limits: AiUsageLimit
  ): Promise<void> {
    // Check if we've already notified recently (within 1 hour)
    const lastNotified = limits.lastLimitNotifiedAt;
    if (lastNotified && Date.now() - new Date(lastNotified).getTime() < 60 * 60 * 1000) {
      return;
    }
    
    // Update notification timestamp
    await db.update(aiUsageLimits)
      .set({ lastLimitNotifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiUsageLimits.id, limits.id));
    
    // TODO: Integrate with notification system
    console.log(`[BudgetGuard] LIMIT EXCEEDED: Tenant ${tenantId} exceeded ${period} budget`);
  }
}

// Export singleton instance
export const budgetGuardService = new BudgetGuardService();

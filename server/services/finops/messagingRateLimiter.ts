/**
 * Messaging Rate Limiter Service - Per-tenant rate limiting for all messaging channels
 * 
 * Provides:
 * 1. Pre-send quota checks (WhatsApp, SMS, Email)
 * 2. Usage recording and cost tracking
 * 3. Automatic daily/monthly resets
 * 4. Optional message queuing when limits exceeded
 */

import { db } from "../../db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import {
  messagingUsageLimits,
  messagingUsageLogs,
  MessagingUsageLimit,
  InsertMessagingUsageLog,
} from "../../../shared/schema-finops-security";
import { logIntegrationAudit } from "../../integrations/helpers/auditLogger";
import crypto from "crypto";

// Messaging channels
export type MessagingChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';

// Rate limit check result
export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  warning?: string;
  currentUsage: {
    daily: number;
    monthly: number;
  };
  limits: {
    daily: number;
    monthly: number;
  };
  canQueue: boolean;
}

// Message recording input
export interface MessageRecordInput {
  tenantId: string;
  userId?: string;
  channel: MessagingChannel;
  provider: string;
  messageType: string;
  recipient: string; // Will be hashed
  costCents?: number;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'BLOCKED' | 'QUEUED';
  errorMessage?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// Default limits per channel
const DEFAULT_LIMITS: Record<MessagingChannel, { daily: number; monthly: number }> = {
  WHATSAPP: { daily: 100, monthly: 2000 },
  EMAIL: { daily: 500, monthly: 10000 },
  SMS: { daily: 50, monthly: 500 },
};

// Cost per message (in cents) - default estimates
const MESSAGE_COSTS: Record<MessagingChannel, number> = {
  WHATSAPP: 5, // $0.05 per message
  EMAIL: 0, // Usually free
  SMS: 10, // $0.10 per SMS segment
};

class MessagingRateLimiterService {
  /**
   * Check if sending a message is allowed under rate limits
   */
  async checkQuota(
    tenantId: string,
    channel: MessagingChannel,
    messageCount: number = 1
  ): Promise<RateLimitCheckResult> {
    try {
      // Get or create channel limits
      const limits = await this.getOrCreateChannelLimits(tenantId, channel);
      
      // Check and reset counters if needed
      await this.checkAndResetCounters(limits);
      
      // Re-fetch after potential reset
      const [currentLimits] = await db.select()
        .from(messagingUsageLimits)
        .where(and(
          eq(messagingUsageLimits.tenantId, tenantId),
          eq(messagingUsageLimits.channel, channel)
        ));
      
      const currentUsage = {
        daily: currentLimits.dailyUsed || 0,
        monthly: currentLimits.monthlyUsed || 0,
      };
      
      const limitsConfig = {
        daily: currentLimits.dailyLimit || DEFAULT_LIMITS[channel].daily,
        monthly: currentLimits.monthlyLimit || DEFAULT_LIMITS[channel].monthly,
      };
      
      // Check daily limit
      if (currentUsage.daily + messageCount > limitsConfig.daily) {
        return {
          allowed: false,
          reason: `Daily ${channel} limit exceeded (${currentUsage.daily}/${limitsConfig.daily})`,
          currentUsage,
          limits: limitsConfig,
          canQueue: currentLimits.queueOnLimit || false,
        };
      }
      
      // Check monthly limit
      if (currentUsage.monthly + messageCount > limitsConfig.monthly) {
        return {
          allowed: false,
          reason: `Monthly ${channel} limit exceeded (${currentUsage.monthly}/${limitsConfig.monthly})`,
          currentUsage,
          limits: limitsConfig,
          canQueue: currentLimits.queueOnLimit || false,
        };
      }
      
      // Check for warnings (>80% usage)
      let warning: string | undefined;
      const dailyPercent = (currentUsage.daily / limitsConfig.daily) * 100;
      const monthlyPercent = (currentUsage.monthly / limitsConfig.monthly) * 100;
      
      if (dailyPercent >= 80 || monthlyPercent >= 80) {
        const highestPeriod = dailyPercent > monthlyPercent ? 'daily' : 'monthly';
        const highestPercent = Math.max(dailyPercent, monthlyPercent);
        warning = `${channel} quota warning: ${Math.round(highestPercent)}% of ${highestPeriod} limit used`;
      }
      
      return {
        allowed: true,
        warning,
        currentUsage,
        limits: limitsConfig,
        canQueue: false,
      };
    } catch (error) {
      console.error('[MessagingRateLimiter] Error checking quota:', error);
      // Fail open for messaging
      return {
        allowed: true,
        warning: 'Quota check failed - allowing message',
        currentUsage: { daily: 0, monthly: 0 },
        limits: DEFAULT_LIMITS[channel],
        canQueue: false,
      };
    }
  }

  /**
   * Record a sent/attempted message
   */
  async recordMessage(input: MessageRecordInput): Promise<void> {
    try {
      // Hash recipient for privacy
      const recipientHash = this.hashRecipient(input.recipient);
      
      // Determine cost
      const costCents = input.costCents ?? MESSAGE_COSTS[input.channel];
      
      // Insert message log
      await db.insert(messagingUsageLogs).values({
        tenantId: input.tenantId,
        userId: input.userId,
        channel: input.channel,
        provider: input.provider,
        messageType: input.messageType,
        recipientHash,
        costCents,
        status: input.status,
        errorMessage: input.errorMessage,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      });
      
      // Update counters only for successful sends
      if (input.status === 'SENT' || input.status === 'DELIVERED' || input.status === 'READ') {
        await db.update(messagingUsageLimits)
          .set({
            dailyUsed: sql`${messagingUsageLimits.dailyUsed} + 1`,
            monthlyUsed: sql`${messagingUsageLimits.monthlyUsed} + 1`,
            costThisMonthCents: sql`${messagingUsageLimits.costThisMonthCents} + ${costCents}`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(messagingUsageLimits.tenantId, input.tenantId),
            eq(messagingUsageLimits.channel, input.channel)
          ));
      }
      
      // Audit log
      logIntegrationAudit({
        integrationCode: `MESSAGING_${input.channel}`,
        action: 'MESSAGE_RECORDED',
        tenantId: input.tenantId,
        details: {
          provider: input.provider,
          status: input.status,
          costCents,
        },
      }).catch(() => {});
      
    } catch (error) {
      console.error('[MessagingRateLimiter] Error recording message:', error);
    }
  }

  /**
   * Get current usage stats for a tenant channel
   */
  async getChannelStats(
    tenantId: string,
    channel: MessagingChannel
  ): Promise<{
    limits: MessagingUsageLimit;
    utilizationPercent: { daily: number; monthly: number };
    costThisMonth: number;
  }> {
    const limits = await this.getOrCreateChannelLimits(tenantId, channel);
    await this.checkAndResetCounters(limits);
    
    // Re-fetch after potential reset
    const [current] = await db.select()
      .from(messagingUsageLimits)
      .where(and(
        eq(messagingUsageLimits.tenantId, tenantId),
        eq(messagingUsageLimits.channel, channel)
      ));
    
    const dailyLimit = current.dailyLimit || DEFAULT_LIMITS[channel].daily;
    const monthlyLimit = current.monthlyLimit || DEFAULT_LIMITS[channel].monthly;
    
    return {
      limits: current,
      utilizationPercent: {
        daily: dailyLimit > 0 
          ? Math.round(((current.dailyUsed || 0) / dailyLimit) * 10000) / 100 
          : 0,
        monthly: monthlyLimit > 0 
          ? Math.round(((current.monthlyUsed || 0) / monthlyLimit) * 10000) / 100 
          : 0,
      },
      costThisMonth: current.costThisMonthCents || 0,
    };
  }

  /**
   * Get all channel stats for a tenant
   */
  async getAllChannelStats(tenantId: string): Promise<Record<MessagingChannel, {
    usage: { daily: number; monthly: number };
    limits: { daily: number; monthly: number };
    costThisMonth: number;
    utilizationPercent: { daily: number; monthly: number };
  }>> {
    const channels: MessagingChannel[] = ['WHATSAPP', 'EMAIL', 'SMS'];
    const result: any = {};
    
    for (const channel of channels) {
      const stats = await this.getChannelStats(tenantId, channel);
      result[channel] = {
        usage: {
          daily: stats.limits.dailyUsed || 0,
          monthly: stats.limits.monthlyUsed || 0,
        },
        limits: {
          daily: stats.limits.dailyLimit || DEFAULT_LIMITS[channel].daily,
          monthly: stats.limits.monthlyLimit || DEFAULT_LIMITS[channel].monthly,
        },
        costThisMonth: stats.costThisMonth,
        utilizationPercent: stats.utilizationPercent,
      };
    }
    
    return result;
  }

  /**
   * Update channel limits for a tenant
   */
  async updateChannelLimits(
    tenantId: string,
    channel: MessagingChannel,
    updates: Partial<{
      dailyLimit: number;
      monthlyLimit: number;
      queueOnLimit: boolean;
    }>,
    updatedBy?: string
  ): Promise<MessagingUsageLimit> {
    // Ensure limits exist
    await this.getOrCreateChannelLimits(tenantId, channel);
    
    const [updated] = await db.update(messagingUsageLimits)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(messagingUsageLimits.tenantId, tenantId),
        eq(messagingUsageLimits.channel, channel)
      ))
      .returning();
    
    // Audit log
    logIntegrationAudit({
      integrationCode: 'FINOPS',
      action: 'MESSAGING_LIMITS_UPDATED',
      tenantId,
      details: { channel, updates, updatedBy },
    }).catch(() => {});
    
    return updated;
  }

  /**
   * Get messaging breakdown for analytics
   */
  async getMessagingBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    byChannel: { channel: string; sent: number; failed: number; costCents: number }[];
    byProvider: { provider: string; sent: number; failed: number }[];
    byStatus: { status: string; count: number }[];
    dailyTrend: { date: string; sent: number; failed: number; costCents: number }[];
  }> {
    const logs = await db.select()
      .from(messagingUsageLogs)
      .where(and(
        eq(messagingUsageLogs.tenantId, tenantId),
        gte(messagingUsageLogs.createdAt, startDate),
        lte(messagingUsageLogs.createdAt, endDate)
      ));
    
    // By channel
    const channelMap = new Map<string, { sent: number; failed: number; costCents: number }>();
    for (const log of logs) {
      const existing = channelMap.get(log.channel) || { sent: 0, failed: 0, costCents: 0 };
      if (['SENT', 'DELIVERED', 'READ'].includes(log.status)) {
        existing.sent++;
        existing.costCents += log.costCents || 0;
      } else if (log.status === 'FAILED') {
        existing.failed++;
      }
      channelMap.set(log.channel, existing);
    }
    const byChannel = Array.from(channelMap.entries())
      .map(([channel, stats]) => ({ channel, ...stats }));
    
    // By provider
    const providerMap = new Map<string, { sent: number; failed: number }>();
    for (const log of logs) {
      const existing = providerMap.get(log.provider) || { sent: 0, failed: 0 };
      if (['SENT', 'DELIVERED', 'READ'].includes(log.status)) {
        existing.sent++;
      } else if (log.status === 'FAILED') {
        existing.failed++;
      }
      providerMap.set(log.provider, existing);
    }
    const byProvider = Array.from(providerMap.entries())
      .map(([provider, stats]) => ({ provider, ...stats }));
    
    // By status
    const statusMap = new Map<string, number>();
    for (const log of logs) {
      statusMap.set(log.status, (statusMap.get(log.status) || 0) + 1);
    }
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));
    
    // Daily trend
    const dailyMap = new Map<string, { sent: number; failed: number; costCents: number }>();
    for (const log of logs) {
      const date = (log.createdAt as Date).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { sent: 0, failed: 0, costCents: 0 };
      if (['SENT', 'DELIVERED', 'READ'].includes(log.status)) {
        existing.sent++;
        existing.costCents += log.costCents || 0;
      } else if (log.status === 'FAILED') {
        existing.failed++;
      }
      dailyMap.set(date, existing);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return { byChannel, byProvider, byStatus, dailyTrend };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getOrCreateChannelLimits(
    tenantId: string,
    channel: MessagingChannel
  ): Promise<MessagingUsageLimit> {
    const [existing] = await db.select()
      .from(messagingUsageLimits)
      .where(and(
        eq(messagingUsageLimits.tenantId, tenantId),
        eq(messagingUsageLimits.channel, channel)
      ));
    
    if (existing) return existing;
    
    // Create default limits
    const now = new Date();
    const defaults = DEFAULT_LIMITS[channel];
    const [created] = await db.insert(messagingUsageLimits)
      .values({
        tenantId,
        channel,
        dailyLimit: defaults.daily,
        monthlyLimit: defaults.monthly,
        dailyResetAt: now,
        monthlyResetAt: now,
      })
      .returning();
    
    return created;
  }

  private async checkAndResetCounters(limits: MessagingUsageLimit): Promise<void> {
    const now = new Date();
    const updates: any = {};
    
    // Check daily reset
    if (limits.dailyResetAt) {
      const resetDate = new Date(limits.dailyResetAt);
      if (now.getUTCDate() !== resetDate.getUTCDate() ||
          now.getTime() - resetDate.getTime() > 24 * 60 * 60 * 1000) {
        updates.dailyUsed = 0;
        updates.dailyResetAt = now;
      }
    }
    
    // Check monthly reset
    if (limits.monthlyResetAt) {
      const resetDate = new Date(limits.monthlyResetAt);
      if (now.getUTCMonth() !== resetDate.getUTCMonth() ||
          now.getUTCFullYear() !== resetDate.getUTCFullYear()) {
        updates.monthlyUsed = 0;
        updates.costThisMonthCents = 0;
        updates.monthlyResetAt = now;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now;
      await db.update(messagingUsageLimits)
        .set(updates)
        .where(eq(messagingUsageLimits.id, limits.id));
    }
  }

  private hashRecipient(recipient: string): string {
    return crypto.createHash('sha256')
      .update(recipient.toLowerCase().trim())
      .digest('hex')
      .substring(0, 32);
  }
}

// Export singleton
export const messagingRateLimiter = new MessagingRateLimiterService();

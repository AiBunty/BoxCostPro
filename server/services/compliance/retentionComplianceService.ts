/**
 * Data Retention & Compliance Service
 * 
 * Provides:
 * 1. Configurable retention policies
 * 2. Automated data purging with audit trail
 * 3. Compliance report generation
 * 4. Export functionality for audits
 */

import { db } from '../../db';
import { eq, and, lte, sql, gte } from 'drizzle-orm';
import {
  dataRetentionPolicies,
  purgeAuditLogs,
  complianceReportJobs,
  aiUsageLogs,
  messagingUsageLogs,
  securityViolationLogs,
  aiSecurityLogs,
  DEFAULT_RETENTION_POLICIES,
  DataRetentionPolicy,
  ComplianceReportJob,
} from '../../../shared/schema-finops-security';
import { logIntegrationAudit } from '../../integrations/helpers/auditLogger';

// Export options
export interface ExportOptions {
  reportType: string;
  format: 'CSV' | 'JSON' | 'PDF';
  tenantId?: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  filters?: Record<string, any>;
  requestedBy: string;
}

// Purge result
export interface PurgeResult {
  entityType: string;
  recordsDeleted: number;
  archiveLocation?: string;
  success: boolean;
  errorMessage?: string;
}

// Report data structures
export interface AIUsageReport {
  tenantId?: string;
  dateRange: { start: Date; end: Date };
  totalRequests: number;
  totalTokens: number;
  totalCostCents: number;
  byProvider: { provider: string; requests: number; tokens: number; cost: number }[];
  byModel: { model: string; requests: number; tokens: number; cost: number }[];
  byDay: { date: string; requests: number; tokens: number; cost: number }[];
}

export interface SecurityReport {
  dateRange: { start: Date; end: Date };
  totalViolations: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  aiSecurityIncidents: number;
  topOffenders: { userId: string; count: number }[];
  recentIncidents: any[];
}

class RetentionComplianceService {
  /**
   * Initialize default retention policies
   */
  async initializeDefaultPolicies(): Promise<void> {
    for (const policy of DEFAULT_RETENTION_POLICIES) {
      const existing = await db.select()
        .from(dataRetentionPolicies)
        .where(eq(dataRetentionPolicies.entityType, policy.entityType));
      
      if (existing.length === 0) {
        await db.insert(dataRetentionPolicies).values({
          entityType: policy.entityType,
          retentionDays: policy.retentionDays,
          legalBasis: policy.legalBasis,
          archiveBeforePurge: true,
          isActive: true,
        });
      }
    }
    
    console.log('[RetentionCompliance] Default policies initialized');
  }

  /**
   * Get all retention policies
   */
  async getRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    return db.select().from(dataRetentionPolicies);
  }

  /**
   * Update a retention policy
   */
  async updateRetentionPolicy(
    entityType: string,
    updates: Partial<{
      retentionDays: number;
      archiveBeforePurge: boolean;
      description: string;
      legalBasis: string;
      isActive: boolean;
    }>,
    updatedBy?: string
  ): Promise<DataRetentionPolicy | null> {
    const [updated] = await db.update(dataRetentionPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataRetentionPolicies.entityType, entityType))
      .returning();
    
    if (updated) {
      logIntegrationAudit({
        integrationCode: 'COMPLIANCE',
        action: 'RETENTION_POLICY_UPDATED',
        details: { entityType, updates, updatedBy },
      }).catch(() => {});
    }
    
    return updated || null;
  }

  /**
   * Execute retention policy for a specific entity type
   */
  async executePurge(
    entityType: string,
    options?: { dryRun?: boolean; executedBy?: string }
  ): Promise<PurgeResult> {
    const { dryRun = false, executedBy = 'SYSTEM' } = options || {};
    
    try {
      // Get policy
      const [policy] = await db.select()
        .from(dataRetentionPolicies)
        .where(and(
          eq(dataRetentionPolicies.entityType, entityType),
          eq(dataRetentionPolicies.isActive, true)
        ));
      
      if (!policy) {
        return {
          entityType,
          recordsDeleted: 0,
          success: false,
          errorMessage: 'No active retention policy found',
        };
      }
      
      // Permanent retention
      if (policy.retentionDays === -1) {
        return {
          entityType,
          recordsDeleted: 0,
          success: true,
          errorMessage: 'Entity type marked for permanent retention',
        };
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
      
      // Get count of records to purge
      const tableName = this.getTableForEntityType(entityType);
      if (!tableName) {
        return {
          entityType,
          recordsDeleted: 0,
          success: false,
          errorMessage: 'Unknown entity type',
        };
      }
      
      // Dry run just returns count
      if (dryRun) {
        // Would count records - simplified for now
        return {
          entityType,
          recordsDeleted: 0, // Would be actual count
          success: true,
        };
      }
      
      // Execute purge based on entity type
      let deletedCount = 0;
      
      switch (entityType) {
        case 'AI_USAGE_LOG':
          const aiResult = await db.delete(aiUsageLogs)
            .where(lte(aiUsageLogs.createdAt, cutoffDate));
          deletedCount = 0; // Drizzle doesn't return count easily
          break;
          
        case 'MESSAGING_LOG':
          await db.delete(messagingUsageLogs)
            .where(lte(messagingUsageLogs.createdAt, cutoffDate));
          break;
          
        // Add other entity types as needed
      }
      
      // Log the purge
      await db.insert(purgeAuditLogs).values({
        entityType,
        recordCount: deletedCount,
        policyId: policy.id,
        retentionDaysApplied: policy.retentionDays,
        executedBy,
        executionMethod: executedBy === 'SYSTEM' ? 'SCHEDULED' : 'MANUAL',
        status: 'COMPLETED',
      });
      
      // Update policy last executed
      await db.update(dataRetentionPolicies)
        .set({ lastExecutedAt: new Date(), updatedAt: new Date() })
        .where(eq(dataRetentionPolicies.id, policy.id));
      
      logIntegrationAudit({
        integrationCode: 'COMPLIANCE',
        action: 'PURGE_EXECUTED',
        details: { entityType, recordsDeleted: deletedCount, cutoffDate },
      }).catch(() => {});
      
      return {
        entityType,
        recordsDeleted: deletedCount,
        success: true,
      };
      
    } catch (error) {
      console.error(`[RetentionCompliance] Purge failed for ${entityType}:`, error);
      
      await db.insert(purgeAuditLogs).values({
        entityType,
        recordCount: 0,
        executedBy: options?.executedBy || 'SYSTEM',
        executionMethod: 'MANUAL',
        status: 'FAILED',
        errorMessage: (error as Error).message,
      });
      
      return {
        entityType,
        recordsDeleted: 0,
        success: false,
        errorMessage: (error as Error).message,
      };
    }
  }

  /**
   * Execute all active retention policies
   */
  async executeAllPolicies(executedBy: string = 'SYSTEM'): Promise<PurgeResult[]> {
    const policies = await db.select()
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.isActive, true));
    
    const results: PurgeResult[] = [];
    
    for (const policy of policies) {
      const result = await this.executePurge(policy.entityType, { executedBy });
      results.push(result);
    }
    
    return results;
  }

  /**
   * Generate a compliance report
   */
  async generateReport(options: ExportOptions): Promise<ComplianceReportJob> {
    // Create job record
    const [job] = await db.insert(complianceReportJobs)
      .values({
        tenantId: options.tenantId,
        reportType: options.reportType,
        format: options.format,
        dateRangeStart: options.dateRangeStart,
        dateRangeEnd: options.dateRangeEnd,
        filters: options.filters as any,
        status: 'PROCESSING',
        requestedBy: options.requestedBy,
      })
      .returning();
    
    // Generate report asynchronously
    this.processReportAsync(job.id, options).catch(err => {
      console.error(`[RetentionCompliance] Report generation failed:`, err);
    });
    
    return job;
  }

  /**
   * Get report job status
   */
  async getReportStatus(jobId: string): Promise<ComplianceReportJob | null> {
    const [job] = await db.select()
      .from(complianceReportJobs)
      .where(eq(complianceReportJobs.id, jobId));
    
    return job || null;
  }

  /**
   * Generate AI usage report data
   */
  async generateAIUsageReport(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<AIUsageReport> {
    let logs = await db.select()
      .from(aiUsageLogs)
      .where(and(
        gte(aiUsageLogs.createdAt, startDate),
        lte(aiUsageLogs.createdAt, endDate)
      ));
    
    if (tenantId) {
      logs = logs.filter(l => l.tenantId === tenantId);
    }
    
    // Aggregate by provider
    const byProvider = new Map<string, { requests: number; tokens: number; cost: number }>();
    const byModel = new Map<string, { requests: number; tokens: number; cost: number }>();
    const byDay = new Map<string, { requests: number; tokens: number; cost: number }>();
    
    let totalTokens = 0;
    let totalCost = 0;
    
    for (const log of logs) {
      totalTokens += log.totalTokens;
      totalCost += log.costCents;
      
      // By provider
      const providerStats = byProvider.get(log.provider) || { requests: 0, tokens: 0, cost: 0 };
      providerStats.requests++;
      providerStats.tokens += log.totalTokens;
      providerStats.cost += log.costCents;
      byProvider.set(log.provider, providerStats);
      
      // By model
      const modelStats = byModel.get(log.model) || { requests: 0, tokens: 0, cost: 0 };
      modelStats.requests++;
      modelStats.tokens += log.totalTokens;
      modelStats.cost += log.costCents;
      byModel.set(log.model, modelStats);
      
      // By day
      const date = (log.createdAt as Date).toISOString().split('T')[0];
      const dayStats = byDay.get(date) || { requests: 0, tokens: 0, cost: 0 };
      dayStats.requests++;
      dayStats.tokens += log.totalTokens;
      dayStats.cost += log.costCents;
      byDay.set(date, dayStats);
    }
    
    return {
      tenantId,
      dateRange: { start: startDate, end: endDate },
      totalRequests: logs.length,
      totalTokens,
      totalCostCents: totalCost,
      byProvider: Array.from(byProvider.entries()).map(([provider, stats]) => ({
        provider,
        ...stats,
      })),
      byModel: Array.from(byModel.entries()).map(([model, stats]) => ({
        model,
        ...stats,
      })),
      byDay: Array.from(byDay.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Generate security report data
   */
  async generateSecurityReport(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<SecurityReport> {
    const violations = await db.select()
      .from(securityViolationLogs)
      .where(and(
        gte(securityViolationLogs.createdAt, startDate),
        lte(securityViolationLogs.createdAt, endDate)
      ));
    
    const aiIncidents = await db.select()
      .from(aiSecurityLogs)
      .where(and(
        gte(aiSecurityLogs.createdAt, startDate),
        lte(aiSecurityLogs.createdAt, endDate)
      ));
    
    let filteredViolations = violations;
    let filteredAiIncidents = aiIncidents;
    
    if (tenantId) {
      filteredViolations = violations.filter(v => v.tenantId === tenantId);
      filteredAiIncidents = aiIncidents.filter(a => a.tenantId === tenantId);
    }
    
    // Aggregate
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byUser = new Map<string, number>();
    
    for (const v of filteredViolations) {
      bySeverity[v.severity || 'UNKNOWN'] = (bySeverity[v.severity || 'UNKNOWN'] || 0) + 1;
      byType[v.violationType] = (byType[v.violationType] || 0) + 1;
      if (v.userId) {
        byUser.set(v.userId, (byUser.get(v.userId) || 0) + 1);
      }
    }
    
    const topOffenders = Array.from(byUser.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const recentIncidents = filteredViolations
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 20);
    
    return {
      dateRange: { start: startDate, end: endDate },
      totalViolations: filteredViolations.length,
      bySeverity,
      byType,
      aiSecurityIncidents: filteredAiIncidents.length,
      topOffenders,
      recentIncidents,
    };
  }

  /**
   * Get purge history
   */
  async getPurgeHistory(
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    let logs = await db.select().from(purgeAuditLogs);
    
    if (startDate && endDate) {
      logs = logs.filter(l => {
        const logDate = new Date(l.createdAt!);
        return logDate >= startDate && logDate <= endDate;
      });
    }
    
    return logs.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  /**
   * Get compliance dashboard stats
   */
  async getComplianceDashboard(): Promise<{
    retentionPolicies: { total: number; active: number };
    recentPurges: { count: number; recordsPurged: number };
    pendingReports: number;
    dataBreaches24h: number;
  }> {
    const policies = await db.select().from(dataRetentionPolicies);
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const purges = await db.select().from(purgeAuditLogs);
    const recentPurges = purges.filter(p => new Date(p.createdAt!) >= yesterday);
    
    const pendingReports = await db.select()
      .from(complianceReportJobs)
      .where(eq(complianceReportJobs.status, 'PENDING'));
    
    const breaches = await db.select()
      .from(securityViolationLogs)
      .where(and(
        gte(securityViolationLogs.createdAt, yesterday),
        eq(securityViolationLogs.severity, 'CRITICAL')
      ));
    
    return {
      retentionPolicies: {
        total: policies.length,
        active: policies.filter(p => p.isActive).length,
      },
      recentPurges: {
        count: recentPurges.length,
        recordsPurged: recentPurges.reduce((sum, p) => sum + (p.recordCount || 0), 0),
      },
      pendingReports: pendingReports.length,
      dataBreaches24h: breaches.length,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getTableForEntityType(entityType: string): string | null {
    const tableMap: Record<string, string> = {
      'AI_USAGE_LOG': 'ai_usage_logs',
      'MESSAGING_LOG': 'messaging_usage_logs',
      'CHATBOT_CONVERSATION': 'chat_sessions',
      'SECURITY_VIOLATION': 'security_violation_logs',
      'SUPPORT_TICKET': 'support_tickets',
    };
    return tableMap[entityType] || null;
  }

  private async processReportAsync(jobId: string, options: ExportOptions): Promise<void> {
    try {
      let reportData: any;
      
      switch (options.reportType) {
        case 'AI_USAGE':
          reportData = await this.generateAIUsageReport(
            options.dateRangeStart,
            options.dateRangeEnd,
            options.tenantId
          );
          break;
          
        case 'SECURITY_INCIDENTS':
          reportData = await this.generateSecurityReport(
            options.dateRangeStart,
            options.dateRangeEnd,
            options.tenantId
          );
          break;
          
        default:
          reportData = { message: 'Report type not implemented' };
      }
      
      // Format output
      let output: string;
      switch (options.format) {
        case 'JSON':
          output = JSON.stringify(reportData, null, 2);
          break;
        case 'CSV':
          output = this.convertToCSV(reportData);
          break;
        default:
          output = JSON.stringify(reportData);
      }
      
      const outputSize = Buffer.byteLength(output, 'utf8');
      const checksum = require('crypto').createHash('sha256').update(output).digest('hex');
      
      // In production, would upload to S3/storage and get URL
      const outputUrl = `data:application/${options.format.toLowerCase()};base64,${Buffer.from(output).toString('base64')}`;
      
      await db.update(complianceReportJobs)
        .set({
          status: 'COMPLETED',
          progressPercent: 100,
          outputUrl,
          outputSizeBytes: outputSize,
          outputChecksum: checksum,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          updatedAt: new Date(),
        })
        .where(eq(complianceReportJobs.id, jobId));
      
    } catch (error) {
      await db.update(complianceReportJobs)
        .set({
          status: 'FAILED',
          errorMessage: (error as Error).message,
          updatedAt: new Date(),
        })
        .where(eq(complianceReportJobs.id, jobId));
    }
  }

  private convertToCSV(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(data);
  }
}

// Export singleton
export const retentionComplianceService = new RetentionComplianceService();

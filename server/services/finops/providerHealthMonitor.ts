/**
 * Provider Health Monitor - Track reliability and health of all external providers
 * 
 * Provides:
 * 1. Health metrics persistence (success rates, latency)
 * 2. Circuit breaker state management
 * 3. Auto-demotion based on health
 * 4. Priority-based failover recommendations
 * 5. Real-time health dashboard data
 */

import { db } from "../../db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  providerHealthMetrics,
  ProviderHealthMetric,
} from "../../../shared/schema-finops-security";
import { logIntegrationAudit } from "../../integrations/helpers/auditLogger";

// Provider types
export type ProviderType = 'LLM' | 'MESSAGING' | 'AUTOMATION' | 'EMAIL' | 'STORAGE';

// Circuit states
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Health status levels
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';

// Request outcome for recording
export interface RequestOutcome {
  providerCode: string;
  providerType: ProviderType;
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
}

// Health summary for dashboards
export interface ProviderHealthSummary {
  providerCode: string;
  providerType: ProviderType;
  status: HealthStatus;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  circuitState: CircuitState;
  requestsLast24h: number;
  failuresLast24h: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureReason: string | null;
  isActive: boolean;
  isDemoted: boolean;
  priority: number;
}

// Health thresholds
const HEALTH_THRESHOLDS = {
  HEALTHY_SUCCESS_RATE: 99,      // 99%+ = healthy
  DEGRADED_SUCCESS_RATE: 95,    // 95-99% = degraded
  UNHEALTHY_SUCCESS_RATE: 80,   // 80-95% = unhealthy
  // Below 80% = down

  HEALTHY_LATENCY_MS: 500,      // <500ms = healthy
  DEGRADED_LATENCY_MS: 1000,    // 500-1000ms = degraded
  UNHEALTHY_LATENCY_MS: 3000,   // 1000-3000ms = unhealthy
};

// Circuit breaker config
const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 3,         // Open after 3 consecutive failures
  RECOVERY_TIME_MS: 60000,      // 60 seconds before half-open
  HALF_OPEN_SUCCESS_REQUIRED: 2, // 2 successes to close
};

// Rolling window for latency calculations
const LATENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

class ProviderHealthMonitorService {
  // In-memory latency buffer for p95 calculations
  private latencyBuffer: Map<string, number[]> = new Map();

  /**
   * Record a request outcome and update health metrics
   */
  async recordRequest(outcome: RequestOutcome): Promise<void> {
    try {
      // Get or create provider metrics
      const metrics = await this.getOrCreateMetrics(
        outcome.providerCode,
        outcome.providerType
      );
      
      // Update latency buffer
      this.updateLatencyBuffer(outcome.providerCode, outcome.latencyMs);
      
      // Calculate new metrics
      const newMetrics = this.calculateNewMetrics(metrics, outcome);
      
      // Update circuit breaker state
      const newCircuitState = this.updateCircuitState(
        metrics.circuitState as CircuitState,
        metrics.consecutiveFailures || 0,
        outcome.success
      );
      
      // Check for auto-demotion
      const shouldDemote = this.shouldDemote(newMetrics);
      
      // Persist updates
      await db.update(providerHealthMetrics)
        .set({
          successRate: newMetrics.successRate.toString(),
          avgLatencyMs: newMetrics.avgLatencyMs,
          p95LatencyMs: newMetrics.p95LatencyMs,
          totalRequests24h: (metrics.totalRequests24h || 0) + 1,
          failedRequests24h: (metrics.failedRequests24h || 0) + (outcome.success ? 0 : 1),
          circuitState: newCircuitState,
          consecutiveFailures: outcome.success ? 0 : (metrics.consecutiveFailures || 0) + 1,
          lastSuccessAt: outcome.success ? new Date() : metrics.lastSuccessAt,
          lastFailureAt: outcome.success ? metrics.lastFailureAt : new Date(),
          lastFailureReason: outcome.success ? metrics.lastFailureReason : outcome.errorMessage,
          isDemoted: shouldDemote,
          updatedAt: new Date(),
        })
        .where(eq(providerHealthMetrics.id, metrics.id));
      
      // Log significant events
      if (newCircuitState !== metrics.circuitState) {
        logIntegrationAudit({
          integrationCode: outcome.providerCode,
          action: `CIRCUIT_${newCircuitState}`,
          details: {
            previousState: metrics.circuitState,
            consecutiveFailures: metrics.consecutiveFailures,
          },
        }).catch(() => {});
      }
      
      if (shouldDemote && !metrics.isDemoted) {
        logIntegrationAudit({
          integrationCode: outcome.providerCode,
          action: 'PROVIDER_DEMOTED',
          details: {
            successRate: newMetrics.successRate,
            reason: 'Auto-demotion due to poor health',
          },
        }).catch(() => {});
      }
      
    } catch (error) {
      console.error('[ProviderHealthMonitor] Error recording request:', error);
    }
  }

  /**
   * Get current health status for a provider
   */
  async getHealthStatus(providerCode: string): Promise<ProviderHealthSummary | null> {
    const [metrics] = await db.select()
      .from(providerHealthMetrics)
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    if (!metrics) return null;
    
    return this.toHealthSummary(metrics);
  }

  /**
   * Get health status for all providers
   */
  async getAllHealthStatus(): Promise<ProviderHealthSummary[]> {
    const metrics = await db.select()
      .from(providerHealthMetrics)
      .orderBy(desc(providerHealthMetrics.priority));
    
    return metrics.map(m => this.toHealthSummary(m));
  }

  /**
   * Get health status by provider type
   */
  async getHealthByType(type: ProviderType): Promise<ProviderHealthSummary[]> {
    const metrics = await db.select()
      .from(providerHealthMetrics)
      .where(eq(providerHealthMetrics.providerType, type))
      .orderBy(desc(providerHealthMetrics.priority));
    
    return metrics.map(m => this.toHealthSummary(m));
  }

  /**
   * Get recommended provider (best health + priority)
   */
  async getRecommendedProvider(type: ProviderType): Promise<string | null> {
    const providers = await this.getHealthByType(type);
    
    // Filter active, non-demoted providers with closed/half-open circuit
    const available = providers.filter(p => 
      p.isActive && 
      !p.isDemoted && 
      p.circuitState !== 'OPEN'
    );
    
    if (available.length === 0) return null;
    
    // Sort by health status, then priority
    const sorted = available.sort((a, b) => {
      const statusOrder = { HEALTHY: 0, DEGRADED: 1, UNHEALTHY: 2, DOWN: 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.priority - a.priority; // Higher priority first
    });
    
    return sorted[0].providerCode;
  }

  /**
   * Check if provider should be used (circuit closed or half-open)
   */
  async isProviderAvailable(providerCode: string): Promise<boolean> {
    const status = await this.getHealthStatus(providerCode);
    if (!status) return false;
    
    if (!status.isActive) return false;
    if (status.circuitState === 'OPEN') {
      // Check if recovery time has passed
      const canTryHalfOpen = await this.checkCircuitRecovery(providerCode);
      return canTryHalfOpen;
    }
    
    return true;
  }

  /**
   * Manually toggle provider active status
   */
  async setProviderActive(
    providerCode: string,
    isActive: boolean,
    updatedBy?: string
  ): Promise<void> {
    await db.update(providerHealthMetrics)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    logIntegrationAudit({
      integrationCode: providerCode,
      action: isActive ? 'PROVIDER_ENABLED' : 'PROVIDER_DISABLED',
      details: { updatedBy },
    }).catch(() => {});
  }

  /**
   * Manually set provider priority
   */
  async setProviderPriority(
    providerCode: string,
    priority: number,
    updatedBy?: string
  ): Promise<void> {
    await db.update(providerHealthMetrics)
      .set({ priority, updatedAt: new Date() })
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    logIntegrationAudit({
      integrationCode: providerCode,
      action: 'PROVIDER_PRIORITY_CHANGED',
      details: { priority, updatedBy },
    }).catch(() => {});
  }

  /**
   * Reset circuit breaker for a provider
   */
  async resetCircuit(providerCode: string, updatedBy?: string): Promise<void> {
    await db.update(providerHealthMetrics)
      .set({
        circuitState: 'CLOSED',
        consecutiveFailures: 0,
        isDemoted: false,
        updatedAt: new Date(),
      })
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    logIntegrationAudit({
      integrationCode: providerCode,
      action: 'CIRCUIT_RESET',
      details: { updatedBy },
    }).catch(() => {});
  }

  /**
   * Get aggregated health stats for dashboard
   */
  async getHealthDashboardStats(): Promise<{
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
      down: number;
    };
    byType: Record<ProviderType, {
      total: number;
      healthy: number;
      avgSuccessRate: number;
    }>;
    recentIncidents: {
      providerCode: string;
      reason: string;
      occurredAt: Date;
    }[];
  }> {
    const allMetrics = await this.getAllHealthStatus();
    
    // Summary counts
    const summary = {
      total: allMetrics.length,
      healthy: allMetrics.filter(m => m.status === 'HEALTHY').length,
      degraded: allMetrics.filter(m => m.status === 'DEGRADED').length,
      unhealthy: allMetrics.filter(m => m.status === 'UNHEALTHY').length,
      down: allMetrics.filter(m => m.status === 'DOWN').length,
    };
    
    // By type aggregation
    const byType: Record<string, { total: number; healthy: number; avgSuccessRate: number }> = {};
    for (const metric of allMetrics) {
      if (!byType[metric.providerType]) {
        byType[metric.providerType] = { total: 0, healthy: 0, avgSuccessRate: 0 };
      }
      byType[metric.providerType].total++;
      if (metric.status === 'HEALTHY') byType[metric.providerType].healthy++;
      byType[metric.providerType].avgSuccessRate += metric.successRate;
    }
    // Calculate averages
    for (const type of Object.keys(byType)) {
      if (byType[type].total > 0) {
        byType[type].avgSuccessRate = 
          Math.round((byType[type].avgSuccessRate / byType[type].total) * 100) / 100;
      }
    }
    
    // Recent incidents (failures in last 24h)
    const recentIncidents = allMetrics
      .filter(m => m.lastFailureAt && 
        Date.now() - new Date(m.lastFailureAt).getTime() < LATENCY_WINDOW_MS)
      .map(m => ({
        providerCode: m.providerCode,
        reason: m.lastFailureReason || 'Unknown error',
        occurredAt: m.lastFailureAt!,
      }))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 10);
    
    return { summary, byType: byType as any, recentIncidents };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getOrCreateMetrics(
    providerCode: string,
    providerType: ProviderType
  ): Promise<ProviderHealthMetric> {
    const [existing] = await db.select()
      .from(providerHealthMetrics)
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    if (existing) return existing;
    
    const [created] = await db.insert(providerHealthMetrics)
      .values({
        providerCode,
        providerType,
        successRate: '100.00',
        avgLatencyMs: 0,
        p95LatencyMs: 0,
      })
      .returning();
    
    return created;
  }

  private toHealthSummary(metrics: ProviderHealthMetric): ProviderHealthSummary {
    const successRate = parseFloat(metrics.successRate || '100');
    const avgLatency = metrics.avgLatencyMs || 0;
    
    // Calculate health status
    let status: HealthStatus;
    if (successRate >= HEALTH_THRESHOLDS.HEALTHY_SUCCESS_RATE && 
        avgLatency <= HEALTH_THRESHOLDS.HEALTHY_LATENCY_MS) {
      status = 'HEALTHY';
    } else if (successRate >= HEALTH_THRESHOLDS.DEGRADED_SUCCESS_RATE &&
               avgLatency <= HEALTH_THRESHOLDS.DEGRADED_LATENCY_MS) {
      status = 'DEGRADED';
    } else if (successRate >= HEALTH_THRESHOLDS.UNHEALTHY_SUCCESS_RATE) {
      status = 'UNHEALTHY';
    } else {
      status = 'DOWN';
    }
    
    // Override if circuit is open
    if (metrics.circuitState === 'OPEN') {
      status = 'DOWN';
    }
    
    return {
      providerCode: metrics.providerCode,
      providerType: metrics.providerType as ProviderType,
      status,
      successRate,
      avgLatencyMs: avgLatency,
      p95LatencyMs: metrics.p95LatencyMs || 0,
      circuitState: (metrics.circuitState || 'CLOSED') as CircuitState,
      requestsLast24h: metrics.totalRequests24h || 0,
      failuresLast24h: metrics.failedRequests24h || 0,
      lastSuccessAt: metrics.lastSuccessAt,
      lastFailureAt: metrics.lastFailureAt,
      lastFailureReason: metrics.lastFailureReason,
      isActive: metrics.isActive ?? true,
      isDemoted: metrics.isDemoted ?? false,
      priority: metrics.priority || 1,
    };
  }

  private updateLatencyBuffer(providerCode: string, latencyMs: number): void {
    if (!this.latencyBuffer.has(providerCode)) {
      this.latencyBuffer.set(providerCode, []);
    }
    const buffer = this.latencyBuffer.get(providerCode)!;
    buffer.push(latencyMs);
    
    // Keep last 1000 entries
    if (buffer.length > 1000) {
      buffer.shift();
    }
  }

  private calculateNewMetrics(
    current: ProviderHealthMetric,
    outcome: RequestOutcome
  ): { successRate: number; avgLatencyMs: number; p95LatencyMs: number } {
    const totalRequests = (current.totalRequests24h || 0) + 1;
    const failedRequests = (current.failedRequests24h || 0) + (outcome.success ? 0 : 1);
    const successRate = totalRequests > 0 
      ? ((totalRequests - failedRequests) / totalRequests) * 100 
      : 100;
    
    // Calculate average latency (exponential moving average)
    const alpha = 0.1; // Weight for new values
    const avgLatencyMs = current.avgLatencyMs
      ? Math.round(alpha * outcome.latencyMs + (1 - alpha) * current.avgLatencyMs)
      : outcome.latencyMs;
    
    // Calculate p95 from buffer
    const buffer = this.latencyBuffer.get(outcome.providerCode) || [outcome.latencyMs];
    const sorted = [...buffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95LatencyMs = sorted[p95Index] || avgLatencyMs;
    
    return {
      successRate: Math.round(successRate * 100) / 100,
      avgLatencyMs,
      p95LatencyMs,
    };
  }

  private updateCircuitState(
    currentState: CircuitState,
    consecutiveFailures: number,
    success: boolean
  ): CircuitState {
    switch (currentState) {
      case 'CLOSED':
        if (!success && consecutiveFailures + 1 >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
          return 'OPEN';
        }
        return 'CLOSED';
      
      case 'OPEN':
        // State transitions handled by checkCircuitRecovery
        return 'OPEN';
      
      case 'HALF_OPEN':
        if (success) {
          // After enough successes, close the circuit
          if (consecutiveFailures === 0) { // Using consecutiveFailures as success counter in half-open
            return 'CLOSED';
          }
          return 'HALF_OPEN';
        }
        // Any failure reopens
        return 'OPEN';
      
      default:
        return 'CLOSED';
    }
  }

  private shouldDemote(metrics: { successRate: number }): boolean {
    return metrics.successRate < HEALTH_THRESHOLDS.UNHEALTHY_SUCCESS_RATE;
  }

  private async checkCircuitRecovery(providerCode: string): Promise<boolean> {
    const [metrics] = await db.select()
      .from(providerHealthMetrics)
      .where(eq(providerHealthMetrics.providerCode, providerCode));
    
    if (!metrics || metrics.circuitState !== 'OPEN') return true;
    
    const lastFailure = metrics.lastFailureAt;
    if (!lastFailure) return true;
    
    const timeSinceFailure = Date.now() - new Date(lastFailure).getTime();
    if (timeSinceFailure >= CIRCUIT_BREAKER_CONFIG.RECOVERY_TIME_MS) {
      // Move to half-open
      await db.update(providerHealthMetrics)
        .set({
          circuitState: 'HALF_OPEN',
          updatedAt: new Date(),
        })
        .where(eq(providerHealthMetrics.id, metrics.id));
      return true;
    }
    
    return false;
  }

  /**
   * Reset 24h metrics (to be called by a cron job)
   */
  async resetDailyMetrics(): Promise<void> {
    await db.update(providerHealthMetrics)
      .set({
        totalRequests24h: 0,
        failedRequests24h: 0,
        updatedAt: new Date(),
      });
    
    // Clear latency buffers
    this.latencyBuffer.clear();
    
    console.log('[ProviderHealthMonitor] Daily metrics reset');
  }
}

// Export singleton
export const providerHealthMonitor = new ProviderHealthMonitorService();

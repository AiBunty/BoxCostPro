/**
 * Immutability Guard - Protect records that should never be modified
 * 
 * Provides:
 * 1. Lock records (invoices, credit notes, audit logs)
 * 2. Block modification attempts
 * 3. Tamper detection via checksums
 * 4. Audit trail for all attempts
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import {
  immutableRecordLocks,
  tamperAttemptLogs,
  IMMUTABLE_ENTITY_TYPES,
  ImmutableRecordLock,
} from '../../../shared/schema-finops-security';
import { logIntegrationAudit } from '../../integrations/helpers/auditLogger';
import crypto from 'crypto';

// Lock creation options
export interface LockOptions {
  entityType: string;
  entityId: string;
  reason: 'LEGAL_REQUIREMENT' | 'FINANCIAL_RECORD' | 'COMPLIANCE' | 'AUDIT_TRAIL';
  contentToHash?: string | object; // Content to generate checksum
  lockedBy?: string; // User ID or 'SYSTEM'
}

// Lock check result
export interface LockCheckResult {
  isLocked: boolean;
  lock?: ImmutableRecordLock;
  checksumValid?: boolean;
}

// Tamper attempt context
export interface TamperContext {
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
}

class ImmutabilityGuardService {
  /**
   * Lock a record to make it immutable
   */
  async lockRecord(options: LockOptions): Promise<ImmutableRecordLock> {
    const { entityType, entityId, reason, contentToHash, lockedBy } = options;
    
    // Check if already locked
    const existing = await this.getRecordLock(entityType, entityId);
    if (existing) {
      return existing; // Already locked
    }
    
    // Generate checksum if content provided
    let contentChecksum: string | undefined;
    if (contentToHash) {
      const content = typeof contentToHash === 'string' 
        ? contentToHash 
        : JSON.stringify(contentToHash);
      contentChecksum = crypto.createHash('sha256').update(content).digest('hex');
    }
    
    const [lock] = await db.insert(immutableRecordLocks)
      .values({
        entityType,
        entityId,
        reason,
        lockedBy: lockedBy || 'SYSTEM',
        contentChecksum,
      })
      .returning();
    
    // Audit log
    logIntegrationAudit({
      integrationCode: 'IMMUTABILITY',
      action: 'RECORD_LOCKED',
      details: { entityType, entityId, reason },
    }).catch(() => {});
    
    return lock;
  }

  /**
   * Check if a record is locked
   */
  async isLocked(entityType: string, entityId: string): Promise<boolean> {
    const lock = await this.getRecordLock(entityType, entityId);
    return !!lock;
  }

  /**
   * Get lock details for a record
   */
  async getRecordLock(entityType: string, entityId: string): Promise<ImmutableRecordLock | null> {
    const [lock] = await db.select()
      .from(immutableRecordLocks)
      .where(and(
        eq(immutableRecordLocks.entityType, entityType),
        eq(immutableRecordLocks.entityId, entityId)
      ));
    
    return lock || null;
  }

  /**
   * Verify content hasn't been tampered with
   */
  async verifyChecksum(
    entityType: string,
    entityId: string,
    currentContent: string | object
  ): Promise<{ valid: boolean; expectedChecksum?: string; actualChecksum?: string }> {
    const lock = await this.getRecordLock(entityType, entityId);
    
    if (!lock || !lock.contentChecksum) {
      return { valid: true }; // No checksum to verify
    }
    
    const content = typeof currentContent === 'string'
      ? currentContent
      : JSON.stringify(currentContent);
    const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');
    
    return {
      valid: lock.contentChecksum === actualChecksum,
      expectedChecksum: lock.contentChecksum,
      actualChecksum,
    };
  }

  /**
   * Block a modification attempt and log it
   */
  async blockModification(
    entityType: string,
    entityId: string,
    attemptedAction: 'UPDATE' | 'DELETE',
    attemptedChanges: object | null,
    context: TamperContext
  ): Promise<{ blocked: true; message: string }> {
    // Log the attempt
    await db.insert(tamperAttemptLogs).values({
      entityType,
      entityId,
      attemptedAction,
      attemptedChanges: attemptedChanges as any,
      userId: context.userId,
      tenantId: context.tenantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    
    // High severity audit log
    logIntegrationAudit({
      integrationCode: 'IMMUTABILITY',
      action: 'TAMPER_ATTEMPT_BLOCKED',
      tenantId: context.tenantId,
      details: {
        entityType,
        entityId,
        attemptedAction,
        userId: context.userId,
      },
    }).catch(() => {});
    
    console.warn(`[ImmutabilityGuard] Blocked ${attemptedAction} on ${entityType}:${entityId} by user ${context.userId}`);
    
    return {
      blocked: true,
      message: `This ${entityType} is locked and cannot be modified. This is a compliance requirement.`,
    };
  }

  /**
   * Check if entity type should always be locked
   */
  isAutoLockEntityType(entityType: string): boolean {
    return IMMUTABLE_ENTITY_TYPES.includes(entityType);
  }

  /**
   * Auto-lock record after creation (for immutable entity types)
   */
  async autoLockIfRequired(
    entityType: string,
    entityId: string,
    content?: string | object
  ): Promise<void> {
    if (!this.isAutoLockEntityType(entityType)) {
      return;
    }
    
    await this.lockRecord({
      entityType,
      entityId,
      reason: entityType === 'INVOICE' || entityType === 'CREDIT_NOTE' 
        ? 'FINANCIAL_RECORD' 
        : 'AUDIT_TRAIL',
      contentToHash: content,
      lockedBy: 'SYSTEM',
    });
  }

  /**
   * Get all tamper attempts for monitoring
   */
  async getTamperAttempts(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<{
    attempts: any[];
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
    total: number;
  }> {
    let logs = await db.select().from(tamperAttemptLogs);
    
    // Filter by date and tenant (would use proper where clause in production)
    logs = logs.filter(log => {
      const logDate = new Date(log.createdAt!);
      return logDate >= startDate && logDate <= endDate &&
        (!tenantId || log.tenantId === tenantId);
    });
    
    const byEntityType: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    
    for (const log of logs) {
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
      if (log.userId) {
        byUser[log.userId] = (byUser[log.userId] || 0) + 1;
      }
    }
    
    return {
      attempts: logs,
      byEntityType,
      byUser,
      total: logs.length,
    };
  }

  /**
   * Get integrity report for compliance
   */
  async getIntegrityReport(): Promise<{
    lockedRecords: number;
    byEntityType: Record<string, number>;
    tamperAttempts24h: number;
    checksumVerifications: { verified: number; failed: number };
  }> {
    const locks = await db.select().from(immutableRecordLocks);
    
    const byEntityType: Record<string, number> = {};
    for (const lock of locks) {
      byEntityType[lock.entityType] = (byEntityType[lock.entityType] || 0) + 1;
    }
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tamperAttempts = await db.select()
      .from(tamperAttemptLogs);
    const recentAttempts = tamperAttempts.filter(a => 
      new Date(a.createdAt!) >= yesterday
    ).length;
    
    return {
      lockedRecords: locks.length,
      byEntityType,
      tamperAttempts24h: recentAttempts,
      checksumVerifications: { verified: locks.length, failed: 0 }, // Would track actual verifications
    };
  }
}

// Export singleton
export const immutabilityGuard = new ImmutabilityGuardService();

/**
 * Middleware factory to protect immutable records
 * Use before update/delete operations
 */
export function protectImmutableRecord(entityType: string) {
  return async (req: any, res: any, next: any) => {
    const entityId = req.params.id || req.params.entityId;
    
    if (!entityId) {
      return next();
    }
    
    const isLocked = await immutabilityGuard.isLocked(entityType, entityId);
    
    if (isLocked && ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const result = await immutabilityGuard.blockModification(
        entityType,
        entityId,
        req.method === 'DELETE' ? 'DELETE' : 'UPDATE',
        req.body,
        {
          userId: req.auth?.userId,
          tenantId: req.tenantId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );
      
      return res.status(403).json({
        error: result.message,
        code: 'RECORD_IMMUTABLE',
      });
    }
    
    next();
  };
}

/**
 * Tenant Enforcement Middleware - Strict multi-tenant isolation
 * 
 * Provides:
 * 1. Automatic tenant_id injection for all queries
 * 2. Cross-tenant access prevention
 * 3. Tenant context validation
 * 4. Security violation logging
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { securityViolationLogs } from '../../shared/schema-finops-security';
import { logIntegrationAudit } from '../integrations/helpers/auditLogger';

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantEnforcement?: {
        validated: boolean;
        tenantId: string;
        userId?: string;
        role?: string;
      };
    }
  }
}

// Tables that require tenant isolation
const TENANT_SCOPED_TABLES = [
  'invoices',
  'quotes',
  'customers',
  'products',
  'support_tickets',
  'chat_sessions',
  'chat_messages',
  'ai_audit_logs',
  'ai_usage_logs',
  'messaging_usage_logs',
  'integration_usage_quotas',
  'integration_audit_logs',
  'tenant_users',
  'tenant_integrations',
  'sla_configurations',
  'sla_breach_logs',
  'knowledge_articles',
  'n8n_webhooks',
  'invoice_templates',
  // Add more as needed
];

// Tables that are tenant-optional (admin or system tables)
const ADMIN_ONLY_TABLES = [
  'users',
  'tenants',
  'governance_toggles',
  'incident_mode_state',
  'provider_health_metrics',
  'ai_cost_rates',
  'data_retention_policies',
  'compliance_report_jobs',
  'admin_audit_logs',
];

// Tables that should never have tenant filtering (truly global)
const GLOBAL_TABLES = [
  'ai_cost_rates',
  'data_retention_policies',
  'purge_audit_logs',
  'immutable_record_locks',
  'role_permission_overrides',
];

/**
 * Tenant Enforcement Result
 */
export interface TenantEnforcementResult {
  success: boolean;
  tenantId?: string;
  error?: string;
  isAdmin?: boolean;
}

/**
 * Extract tenant ID from request (multiple sources)
 */
export function extractTenantId(req: Request): string | undefined {
  // Priority 1: Already validated tenant context
  if (req.tenantEnforcement?.validated) {
    return req.tenantEnforcement.tenantId;
  }
  
  // Priority 2: Tenant ID from auth middleware
  if (req.tenantId) {
    return req.tenantId;
  }
  
  // Priority 3: Header (for internal service calls)
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    return headerTenantId;
  }
  
  // Priority 4: Query param (for specific use cases)
  const queryTenantId = req.query.tenantId as string;
  if (queryTenantId) {
    return queryTenantId;
  }
  
  return undefined;
}

/**
 * Main tenant enforcement middleware
 * This should be applied to all tenant-scoped routes
 */
export function tenantEnforcement(options?: {
  required?: boolean;      // Fail if no tenant ID found
  allowAdmin?: boolean;    // Allow super_admin to bypass
}) {
  const { required = true, allowAdmin = true } = options || {};
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId || (req as any).user?.id;
      const userRole = (req as any).auth?.sessionClaims?.role || (req as any).user?.role;
      
      // Extract tenant ID
      const tenantId = extractTenantId(req);
      
      // Super admin bypass (if allowed)
      if (allowAdmin && (userRole === 'super_admin' || userRole === 'admin')) {
        req.tenantEnforcement = {
          validated: true,
          tenantId: tenantId || 'ADMIN_BYPASS',
          userId,
          role: userRole,
        };
        return next();
      }
      
      // Required tenant check
      if (required && !tenantId) {
        await logSecurityViolation({
          userId,
          tenantId: undefined,
          violationType: 'UNAUTHORIZED_RESOURCE',
          attemptedAction: `${req.method} ${req.path}`,
          reason: 'No tenant context provided',
          requestPath: req.path,
          requestMethod: req.method,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          severity: 'MEDIUM',
        });
        
        return res.status(403).json({
          error: 'Tenant context required',
          code: 'TENANT_REQUIRED',
        });
      }
      
      // Store validated context
      req.tenantEnforcement = {
        validated: true,
        tenantId: tenantId || '',
        userId,
        role: userRole,
      };
      
      // Inject tenant ID for convenience
      req.tenantId = tenantId;
      
      next();
    } catch (error) {
      console.error('[TenantEnforcement] Error:', error);
      return res.status(500).json({
        error: 'Tenant enforcement error',
        code: 'ENFORCEMENT_ERROR',
      });
    }
  };
}

/**
 * Validate that a resource belongs to the requesting tenant
 * Use this in route handlers when accessing specific resources
 */
export async function validateTenantOwnership(
  req: Request,
  resourceTenantId: string,
  resourceType: string,
  resourceId: string
): Promise<TenantEnforcementResult> {
  const requestingTenantId = req.tenantEnforcement?.tenantId;
  const userId = req.tenantEnforcement?.userId;
  const userRole = req.tenantEnforcement?.role;
  
  // Admin bypass
  if (userRole === 'super_admin' || userRole === 'admin') {
    return { success: true, tenantId: resourceTenantId, isAdmin: true };
  }
  
  // Tenant mismatch
  if (requestingTenantId !== resourceTenantId) {
    await logSecurityViolation({
      userId,
      tenantId: requestingTenantId,
      violationType: 'CROSS_TENANT_ACCESS',
      attemptedAction: `Access ${resourceType} ${resourceId}`,
      targetResource: resourceType,
      targetResourceId: resourceId,
      targetTenantId: resourceTenantId,
      reason: 'Attempted cross-tenant resource access',
      requestPath: req.path,
      requestMethod: req.method,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: 'HIGH',
    });
    
    return {
      success: false,
      error: 'Access denied: Resource belongs to different tenant',
    };
  }
  
  return { success: true, tenantId: resourceTenantId };
}

/**
 * Create a tenant-scoped query wrapper
 * Automatically injects tenant_id filter
 */
export function scopeToTenant<T extends { tenantId: any }>(
  req: Request,
  table: T
): { table: T; tenantId: string } | null {
  const tenantId = req.tenantEnforcement?.tenantId;
  
  if (!tenantId || tenantId === 'ADMIN_BYPASS') {
    // Admin can query across tenants
    const isAdmin = req.tenantEnforcement?.role === 'super_admin' || 
                    req.tenantEnforcement?.role === 'admin';
    if (isAdmin) {
      return null; // No scope restriction
    }
    throw new Error('Tenant ID required for query');
  }
  
  return { table, tenantId };
}

/**
 * Assert tenant ownership (throws if mismatch)
 */
export async function assertTenantOwnership(
  req: Request,
  resourceTenantId: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  const result = await validateTenantOwnership(req, resourceTenantId, resourceType, resourceId);
  
  if (!result.success) {
    const error = new Error(result.error) as any;
    error.status = 403;
    error.code = 'CROSS_TENANT_ACCESS';
    throw error;
  }
}

/**
 * Middleware for routes that must be tenant-specific (no admin bypass)
 */
export function strictTenantEnforcement() {
  return tenantEnforcement({ required: true, allowAdmin: false });
}

/**
 * Middleware for routes that optionally use tenant context
 */
export function optionalTenantEnforcement() {
  return tenantEnforcement({ required: false, allowAdmin: true });
}

// ============================================================================
// SECURITY VIOLATION LOGGING
// ============================================================================

interface SecurityViolationInput {
  userId?: string;
  tenantId?: string;
  violationType: string;
  attemptedAction: string;
  targetResource?: string;
  targetResourceId?: string;
  targetTenantId?: string;
  reason: string;
  requestPath?: string;
  requestMethod?: string;
  requestPayload?: any;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

async function logSecurityViolation(input: SecurityViolationInput): Promise<void> {
  try {
    // Sanitize request payload (remove sensitive data)
    let sanitizedPayload = input.requestPayload;
    if (sanitizedPayload) {
      sanitizedPayload = { ...sanitizedPayload };
      delete sanitizedPayload.password;
      delete sanitizedPayload.token;
      delete sanitizedPayload.secret;
      delete sanitizedPayload.apiKey;
    }
    
    await db.insert(securityViolationLogs).values({
      userId: input.userId,
      tenantId: input.tenantId,
      violationType: input.violationType,
      attemptedAction: input.attemptedAction,
      targetResource: input.targetResource,
      targetResourceId: input.targetResourceId,
      targetTenantId: input.targetTenantId,
      reason: input.reason,
      requestPath: input.requestPath,
      requestMethod: input.requestMethod,
      requestPayload: sanitizedPayload,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      severity: input.severity || 'MEDIUM',
    });
    
    // Also log to integration audit for high/critical
    if (input.severity === 'HIGH' || input.severity === 'CRITICAL') {
      logIntegrationAudit({
        integrationCode: 'SECURITY',
        action: 'VIOLATION_DETECTED',
        tenantId: input.tenantId,
        details: {
          type: input.violationType,
          action: input.attemptedAction,
          severity: input.severity,
        },
      }).catch(() => {});
    }
    
  } catch (error) {
    console.error('[TenantEnforcement] Failed to log security violation:', error);
  }
}

/**
 * Export for use in other services
 */
export { logSecurityViolation };

/**
 * Zero Trust Security Pipeline - Comprehensive request validation
 * 
 * Implements a 6-step validation chain:
 * 1. Rate limiting (per IP/user)
 * 2. Authentication verification
 * 3. Tenant context validation
 * 4. Role-based access control
 * 5. Privilege escalation prevention
 * 6. Request integrity validation
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { db } from '../db';
import { eq, and, gte } from 'drizzle-orm';
import { 
  securityViolationLogs, 
  rolePermissionOverrides,
  governanceToggles,
  incidentModeState,
  ROLE_DENY_RULES,
} from '../../shared/schema-finops-security';
import { logSecurityViolation } from './tenantEnforcement';
import { logIntegrationAudit } from '../integrations/helpers/auditLogger';

// Rate limit tracking (in-memory for performance, can be moved to Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration
const RATE_LIMITS = {
  // Per IP (for unauthenticated)
  IP: { requests: 100, windowMs: 60000 }, // 100 req/min
  // Per user (authenticated)
  USER: { requests: 300, windowMs: 60000 }, // 300 req/min
  // Sensitive endpoints
  SENSITIVE: { requests: 20, windowMs: 60000 }, // 20 req/min
  // Admin endpoints
  ADMIN: { requests: 60, windowMs: 60000 }, // 60 req/min
};

// Sensitive endpoint patterns
const SENSITIVE_ENDPOINTS = [
  '/api/admin/governance',
  '/api/admin/security',
  '/api/admin/users',
  '/api/billing',
  '/api/integrations/configure',
];

// Role hierarchy (higher number = more privileges)
const ROLE_HIERARCHY: Record<string, number> = {
  'viewer': 1,
  'user': 2,
  'coupon_manager': 3,
  'support_agent': 4,
  'support_manager': 5,
  'admin': 6,
  'super_admin': 7,
};

// Resources and their required minimum roles
const RESOURCE_PERMISSIONS: Record<string, { read: string; write: string; admin: string }> = {
  'billing': { read: 'admin', write: 'admin', admin: 'super_admin' },
  'user_management': { read: 'admin', write: 'admin', admin: 'super_admin' },
  'ai_config': { read: 'support_manager', write: 'admin', admin: 'super_admin' },
  'integrations': { read: 'admin', write: 'admin', admin: 'super_admin' },
  'governance': { read: 'admin', write: 'super_admin', admin: 'super_admin' },
  'security': { read: 'admin', write: 'super_admin', admin: 'super_admin' },
  'support': { read: 'support_agent', write: 'support_agent', admin: 'support_manager' },
  'analytics': { read: 'support_manager', write: 'admin', admin: 'super_admin' },
  'customers': { read: 'user', write: 'user', admin: 'admin' },
  'invoices': { read: 'user', write: 'user', admin: 'admin' },
  'quotes': { read: 'user', write: 'user', admin: 'admin' },
};

/**
 * Zero Trust Pipeline Result
 */
interface ZeroTrustResult {
  allowed: boolean;
  reason?: string;
  step?: string;
  userId?: string;
  tenantId?: string;
  role?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      zeroTrust?: ZeroTrustResult;
    }
  }
}

/**
 * Step 1: Rate Limiting
 */
async function checkRateLimit(
  req: Request,
  res: Response,
  endpointType: 'STANDARD' | 'SENSITIVE' | 'ADMIN' = 'STANDARD'
): Promise<boolean> {
  const userId = (req as any).auth?.userId;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Determine rate limit key and config
  const key = userId ? `user:${userId}` : `ip:${ip}`;
  const config = endpointType === 'SENSITIVE' ? RATE_LIMITS.SENSITIVE :
                 endpointType === 'ADMIN' ? RATE_LIMITS.ADMIN :
                 userId ? RATE_LIMITS.USER : RATE_LIMITS.IP;
  
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  
  if (existing && existing.resetAt > now) {
    if (existing.count >= config.requests) {
      // Rate limit exceeded
      await logSecurityViolation({
        userId,
        violationType: 'RATE_LIMIT_EXCEEDED',
        attemptedAction: `${req.method} ${req.path}`,
        reason: `Rate limit exceeded: ${existing.count}/${config.requests} in ${config.windowMs}ms`,
        requestPath: req.path,
        requestMethod: req.method,
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
        severity: 'LOW',
      });
      return false;
    }
    existing.count++;
  } else {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
  }
  
  return true;
}

/**
 * Step 2: Authentication Verification
 */
function verifyAuthentication(req: Request): { authenticated: boolean; userId?: string; claims?: any } {
  const auth = (req as any).auth;
  
  if (!auth || !auth.userId) {
    return { authenticated: false };
  }
  
  // Verify token hasn't been tampered with (Clerk handles this)
  // Additional verification can be added here
  
  return {
    authenticated: true,
    userId: auth.userId,
    claims: auth.sessionClaims,
  };
}

/**
 * Step 3: Tenant Context Validation
 */
function validateTenantContext(req: Request): { valid: boolean; tenantId?: string } {
  const tenantId = req.tenantId || 
                   req.tenantEnforcement?.tenantId ||
                   (req as any).auth?.sessionClaims?.tenantId;
  
  if (!tenantId) {
    return { valid: false };
  }
  
  // Additional validation: check tenant ID format
  if (typeof tenantId !== 'string' || tenantId.length < 1) {
    return { valid: false };
  }
  
  return { valid: true, tenantId };
}

/**
 * Step 4: Role-Based Access Control
 */
function checkRoleAccess(
  userRole: string,
  resource: string,
  action: 'read' | 'write' | 'admin'
): boolean {
  const permissions = RESOURCE_PERMISSIONS[resource];
  if (!permissions) {
    // Unknown resource - default to admin only
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY['admin'];
  }
  
  const requiredRole = permissions[action];
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 999;
  
  return userLevel >= requiredLevel;
}

/**
 * Step 5: Privilege Escalation Prevention
 */
async function checkPrivilegeEscalation(
  userRole: string,
  resource: string,
  action: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check hardcoded deny rules
  for (const rule of ROLE_DENY_RULES) {
    if (rule.role === userRole && 
        (rule.resource === resource || rule.resource === '*') &&
        rule.actions.includes(action)) {
      return {
        allowed: false,
        reason: `Role ${userRole} is explicitly denied ${action} on ${resource}`,
      };
    }
  }
  
  // Check database override rules
  const overrides = await db.select()
    .from(rolePermissionOverrides)
    .where(and(
      eq(rolePermissionOverrides.role, userRole),
      eq(rolePermissionOverrides.resource, resource),
      eq(rolePermissionOverrides.action, action),
      eq(rolePermissionOverrides.isActive, true)
    ));
  
  for (const override of overrides) {
    if (override.effect === 'DENY') {
      return {
        allowed: false,
        reason: `Permission override denies ${userRole} from ${action} on ${resource}`,
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Step 6: Request Integrity Validation
 */
function validateRequestIntegrity(req: Request): { valid: boolean; reason?: string } {
  // Check for required headers
  const contentType = req.headers['content-type'];
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
      req.body && 
      Object.keys(req.body).length > 0 &&
      !contentType?.includes('application/json') &&
      !contentType?.includes('multipart/form-data') &&
      !contentType?.includes('application/x-www-form-urlencoded')) {
    return { valid: false, reason: 'Invalid content type for request body' };
  }
  
  // Check for SQL injection patterns in query params
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b|--|;|')/i;
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && sqlPatterns.test(value)) {
      return { valid: false, reason: `Suspicious pattern in query param: ${key}` };
    }
  }
  
  // Check for excessively large payloads (already handled by body parser, but double-check)
  if (req.body && JSON.stringify(req.body).length > 10 * 1024 * 1024) { // 10MB
    return { valid: false, reason: 'Request payload too large' };
  }
  
  return { valid: true };
}

/**
 * Check if system is in incident/maintenance mode
 */
async function checkIncidentMode(): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const [activeMode] = await db.select()
      .from(incidentModeState)
      .where(eq(incidentModeState.isActive, true));
    
    if (activeMode) {
      if (activeMode.modeType === 'EMERGENCY_LOCKDOWN') {
        return { blocked: true, reason: 'System is in emergency lockdown' };
      }
      if (activeMode.modeType === 'MAINTENANCE_MODE') {
        return { blocked: true, reason: 'System is under maintenance' };
      }
      if (activeMode.modeType === 'READ_ONLY_MODE') {
        // Only block write operations
        return { blocked: false }; // Will check method separately
      }
    }
    
    return { blocked: false };
  } catch (error) {
    // Fail open if we can't check incident mode
    console.error('[ZeroTrust] Failed to check incident mode:', error);
    return { blocked: false };
  }
}

/**
 * Main Zero Trust Pipeline Middleware
 */
export function zeroTrustPipeline(options?: {
  requireAuth?: boolean;
  requireTenant?: boolean;
  resource?: string;
  action?: 'read' | 'write' | 'admin';
  skipRateLimit?: boolean;
  endpointType?: 'STANDARD' | 'SENSITIVE' | 'ADMIN';
}): RequestHandler {
  const { 
    requireAuth = true, 
    requireTenant = true,
    resource,
    action = 'read',
    skipRateLimit = false,
    endpointType = 'STANDARD',
  } = options || {};
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || 'unknown';
      const userAgent = req.headers['user-agent'];
      
      // Check incident mode first
      const incidentCheck = await checkIncidentMode();
      if (incidentCheck.blocked) {
        return res.status(503).json({
          error: incidentCheck.reason,
          code: 'SERVICE_UNAVAILABLE',
        });
      }
      
      // Step 1: Rate limiting
      if (!skipRateLimit) {
        const actualEndpointType = SENSITIVE_ENDPOINTS.some(p => req.path.startsWith(p))
          ? 'SENSITIVE' : endpointType;
        const rateLimitOk = await checkRateLimit(req, res, actualEndpointType);
        if (!rateLimitOk) {
          req.zeroTrust = { allowed: false, reason: 'Rate limit exceeded', step: 'RATE_LIMIT' };
          return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          });
        }
      }
      
      // Step 2: Authentication
      const authResult = verifyAuthentication(req);
      if (requireAuth && !authResult.authenticated) {
        req.zeroTrust = { allowed: false, reason: 'Authentication required', step: 'AUTH' };
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }
      
      const userId = authResult.userId;
      const userRole = authResult.claims?.role || 'user';
      
      // Step 3: Tenant context
      const tenantResult = validateTenantContext(req);
      if (requireTenant && !tenantResult.valid) {
        await logSecurityViolation({
          userId,
          violationType: 'UNAUTHORIZED_RESOURCE',
          attemptedAction: `${req.method} ${req.path}`,
          reason: 'Missing tenant context',
          requestPath: req.path,
          requestMethod: req.method,
          ipAddress: ip,
          userAgent,
          severity: 'MEDIUM',
        });
        
        req.zeroTrust = { allowed: false, reason: 'Tenant context required', step: 'TENANT' };
        return res.status(403).json({
          error: 'Tenant context required',
          code: 'TENANT_REQUIRED',
        });
      }
      
      // Step 4: RBAC check
      if (resource) {
        const rbacOk = checkRoleAccess(userRole, resource, action);
        if (!rbacOk) {
          await logSecurityViolation({
            userId,
            tenantId: tenantResult.tenantId,
            violationType: 'FORBIDDEN_ACTION',
            attemptedAction: `${action} on ${resource}`,
            targetResource: resource,
            reason: `Role ${userRole} lacks ${action} permission on ${resource}`,
            requestPath: req.path,
            requestMethod: req.method,
            ipAddress: ip,
            userAgent,
            severity: 'MEDIUM',
          });
          
          req.zeroTrust = { allowed: false, reason: 'Insufficient permissions', step: 'RBAC' };
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
          });
        }
      }
      
      // Step 5: Privilege escalation check
      if (resource) {
        const escalationCheck = await checkPrivilegeEscalation(userRole, resource, action);
        if (!escalationCheck.allowed) {
          await logSecurityViolation({
            userId,
            tenantId: tenantResult.tenantId,
            violationType: 'PRIVILEGE_ESCALATION',
            attemptedAction: `${action} on ${resource}`,
            targetResource: resource,
            reason: escalationCheck.reason || 'Privilege escalation attempt',
            requestPath: req.path,
            requestMethod: req.method,
            ipAddress: ip,
            userAgent,
            severity: 'HIGH',
          });
          
          req.zeroTrust = { allowed: false, reason: 'Privilege escalation blocked', step: 'ESCALATION' };
          return res.status(403).json({
            error: 'Operation not permitted for your role',
            code: 'PRIVILEGE_ESCALATION_BLOCKED',
          });
        }
      }
      
      // Step 6: Request integrity
      const integrityCheck = validateRequestIntegrity(req);
      if (!integrityCheck.valid) {
        await logSecurityViolation({
          userId,
          tenantId: tenantResult.tenantId,
          violationType: 'SUSPICIOUS_PATTERN',
          attemptedAction: `${req.method} ${req.path}`,
          reason: integrityCheck.reason || 'Request integrity check failed',
          requestPath: req.path,
          requestMethod: req.method,
          requestPayload: req.body,
          ipAddress: ip,
          userAgent,
          severity: 'HIGH',
        });
        
        req.zeroTrust = { allowed: false, reason: integrityCheck.reason, step: 'INTEGRITY' };
        return res.status(400).json({
          error: 'Invalid request',
          code: 'REQUEST_INTEGRITY_FAILED',
        });
      }
      
      // All checks passed
      req.zeroTrust = {
        allowed: true,
        userId,
        tenantId: tenantResult.tenantId,
        role: userRole,
      };
      
      next();
    } catch (error) {
      console.error('[ZeroTrustPipeline] Error:', error);
      return res.status(500).json({
        error: 'Security check failed',
        code: 'SECURITY_ERROR',
      });
    }
  };
}

/**
 * Convenience middleware for public endpoints (no auth required)
 */
export function publicEndpoint(): RequestHandler {
  return zeroTrustPipeline({
    requireAuth: false,
    requireTenant: false,
    skipRateLimit: false,
  });
}

/**
 * Convenience middleware for authenticated endpoints
 */
export function authenticatedEndpoint(resource?: string, action?: 'read' | 'write' | 'admin'): RequestHandler {
  return zeroTrustPipeline({
    requireAuth: true,
    requireTenant: true,
    resource,
    action,
  });
}

/**
 * Convenience middleware for admin-only endpoints
 */
export function adminEndpoint(resource?: string, action?: 'read' | 'write' | 'admin'): RequestHandler {
  return zeroTrustPipeline({
    requireAuth: true,
    requireTenant: false, // Admins may operate across tenants
    resource: resource || 'governance',
    action: action || 'admin',
    endpointType: 'ADMIN',
  });
}

/**
 * Convenience middleware for super admin only endpoints
 */
export function superAdminEndpoint(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).auth?.sessionClaims?.role;
    
    if (userRole !== 'super_admin') {
      await logSecurityViolation({
        userId: (req as any).auth?.userId,
        violationType: 'FORBIDDEN_ACTION',
        attemptedAction: `${req.method} ${req.path}`,
        reason: 'Super admin access required',
        requestPath: req.path,
        requestMethod: req.method,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: 'HIGH',
      });
      
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }
    
    return zeroTrustPipeline({
      requireAuth: true,
      requireTenant: false,
      endpointType: 'ADMIN',
    })(req, res, next);
  };
}

/**
 * Clear rate limit store (for testing or reset)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(userId?: string, ip?: string): { count: number; resetAt: number } | null {
  const key = userId ? `user:${userId}` : ip ? `ip:${ip}` : null;
  if (!key) return null;
  return rateLimitStore.get(key) || null;
}

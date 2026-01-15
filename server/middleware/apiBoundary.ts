/**
 * ========================================================================
 * API BOUNDARY ENFORCEMENT MIDDLEWARE
 * ========================================================================
 * 
 * Enforces strict separation between admin and user APIs
 * 
 * RULES:
 * 1. /api/admin/* - Platform administration only (admin auth required)
 * 2. /api/user/* - User application only (user auth required)
 * 3. /api/public/* - Public endpoints (no auth)
 * 4. No cross-boundary calls allowed
 * 5. Clear error messages for violations
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// ========== TYPE DEFINITIONS ==========

export interface BoundaryContext {
  boundary: 'admin' | 'user' | 'public' | 'unknown';
  path: string;
  method: string;
  authenticationType: 'admin' | 'user' | 'none';
}

// ========== BOUNDARY DETECTION ==========

/**
 * Detect which API boundary a request belongs to
 */
export function detectBoundary(path: string): 'admin' | 'user' | 'public' | 'unknown' {
  if (path.startsWith('/api/admin/')) return 'admin';
  if (path.startsWith('/api/user/')) return 'user';
  if (path.startsWith('/api/public/')) return 'public';
  if (path.startsWith('/health') || path === '/api/health') return 'public';
  
  // Legacy paths (need migration)
  if (path.startsWith('/api/auth/')) return 'user';
  if (path.startsWith('/api/quotes/')) return 'user';
  if (path.startsWith('/api/subscription/')) return 'user';
  
  return 'unknown';
}

/**
 * Check if authentication type matches required boundary
 */
export function validateBoundaryAuth(
  boundary: 'admin' | 'user' | 'public',
  req: any
): { valid: boolean; reason?: string } {
  // Public endpoints don't require auth
  if (boundary === 'public') {
    return { valid: true };
  }
  
  // Admin endpoints require admin auth
  if (boundary === 'admin') {
    if (!req.admin) {
      return { 
        valid: false, 
        reason: 'Admin authentication required for platform administration endpoints' 
      };
    }
    if (req.user || req.userId) {
      return { 
        valid: false, 
        reason: 'Cannot access admin endpoints with user credentials' 
      };
    }
    return { valid: true };
  }
  
  // User endpoints require user auth
  if (boundary === 'user') {
    if (!req.user && !req.userId) {
      return { 
        valid: false, 
        reason: 'User authentication required' 
      };
    }
    if (req.admin) {
      return { 
        valid: false, 
        reason: 'Cannot access user endpoints with admin credentials. Use impersonation for user context.' 
      };
    }
    return { valid: true };
  }
  
  return { valid: true };
}

// ========== MIDDLEWARE ==========

/**
 * Enforce API boundary separation
 * 
 * Place this AFTER authentication middleware but BEFORE route handlers
 */
export function enforceBoundaries(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  const method = req.method;
  
  // Detect boundary
  const boundary = detectBoundary(path);
  
  // Log boundary violations for migration tracking
  if (boundary === 'unknown' && !path.startsWith('/api/')) {
    // Non-API routes (likely frontend) - skip
    return next();
  }
  
  if (boundary === 'unknown') {
    console.warn(`[API Boundary] Unknown boundary for path: ${method} ${path}`);
    // Allow for now but log for migration
    return next();
  }
  
  // Validate authentication matches boundary
  const validation = validateBoundaryAuth(boundary as any, req);
  
  if (!validation.valid) {
    console.error(`[API Boundary] Violation: ${validation.reason} | ${method} ${path}`);
    return res.status(403).json({
      error: 'API Boundary Violation',
      message: validation.reason,
      path,
      boundary,
      hint: boundary === 'admin' 
        ? 'Use admin authentication for platform administration'
        : 'Use user authentication for application features',
    });
  }
  
  // Attach boundary context to request
  (req as any).boundaryContext = {
    boundary,
    path,
    method,
    authenticationType: req.admin ? 'admin' : req.user ? 'user' : 'none',
  } as BoundaryContext;
  
  next();
}

/**
 * Middleware to ensure mutation operations are admin-only
 * 
 * Use on routes that modify platform state (subscriptions, overrides, etc.)
 */
export function adminMutationOnly(req: Request, res: Response, next: NextFunction): void {
  const admin = (req as any).admin;
  
  if (!admin) {
    return res.status(403).json({
      error: 'Admin Authorization Required',
      message: 'Only platform administrators can perform this operation',
      hint: 'Users can view their entitlements but cannot modify subscription state',
    });
  }
  
  // Check if this is a mutation operation
  const method = req.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: `${method} is not a mutation operation`,
    });
  }
  
  next();
}

/**
 * Middleware to ensure read operations can be performed by both users and admins
 */
export function readOnlyEntitlement(req: Request, res: Response, next: NextFunction): void {
  const admin = (req as any).admin;
  const user = (req as any).user || (req as any).userId;
  
  if (!admin && !user) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'Must be authenticated to view entitlements',
    });
  }
  
  // Ensure GET only
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests allowed for entitlement reads',
    });
  }
  
  next();
}

// ========== LOGGING ==========

/**
 * Log API boundary usage for analytics
 */
export function logBoundaryAccess(req: Request, res: Response): void {
  const context = (req as any).boundaryContext as BoundaryContext | undefined;
  
  if (!context) return;
  
  // Track metrics (can be sent to analytics service)
  const metrics = {
    boundary: context.boundary,
    path: context.path,
    method: context.method,
    authType: context.authenticationType,
    userId: (req as any).userId || (req as any).admin?.id,
    statusCode: res.statusCode,
    timestamp: new Date().toISOString(),
  };
  
  // TODO: Send to metrics collection service
  // For now, just log violations and admin actions
  if (context.boundary === 'admin' || res.statusCode >= 400) {
    console.log('[API Boundary]', JSON.stringify(metrics));
  }
}

// ========== EXPORTS ==========

export { BoundaryContext };

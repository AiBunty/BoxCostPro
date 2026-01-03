/**
 * Onboarding Guard Middleware
 *
 * CRITICAL SECURITY: Server-side enforcement of onboarding completion
 *
 * BLOCKS access to all protected routes until:
 * - User has completed onboarding setup (all 5 steps)
 * - User has submitted for verification
 * - Admin has VERIFIED and APPROVED the business
 * - verificationStatus === 'approved'
 *
 * This is a BACKEND GUARD - frontend redirects are UX only.
 * Users CANNOT bypass this by calling APIs directly.
 */

import type { Request, Response, NextFunction } from 'express';
import type { Storage } from '../storage';

// ========== RATE LIMITER FOR ONBOARDING STATUS CHECKS ==========
// Prevents brute-force attacks on approval status API
// Limit: 10 requests per minute per user

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 10; // 10 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // per minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware for onboarding status endpoint
 */
export function onboardingRateLimiter(req: any, res: Response, next: NextFunction) {
  const userId = req.userId || req.ip || 'anonymous';
  const key = `onboarding:${userId}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
    return next();
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please wait before checking status again.',
      retryAfter,
    });
  }

  return next();
}

/**
 * Create onboarding guard middleware
 */
export function createOnboardingGuard(storage: Storage) {
  return async function onboardingGuard(req: any, res: Response, next: NextFunction) {
    // ========== PUBLIC ROUTES (ALWAYS ALLOWED) ==========
    const publicPaths = [
      '/api/auth',           // Authentication endpoints
      '/api/onboarding',     // Onboarding itself (status + submit)
      '/api/admin',          // Admin panel (has own auth)
      '/api/webhooks',       // Payment webhooks
      '/api/health',         // Health checks
      '/api/cron',           // Cron jobs
    ];

    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // ========== NON-PROTECTED ROUTES (ALLOWED DURING ONBOARDING) ==========
    const nonProtectedPaths = [
      '/api/user',                // User profile endpoints
      '/api/account',             // Account settings
      '/api/company-profiles',    // Business profile (needed during onboarding)
      '/api/business-defaults',   // Tax & GST settings (needed during onboarding)
      '/api/paper-prices',        // Paper pricing (needed during onboarding)
      '/api/paper-bf-prices',     // BF pricing (needed during onboarding)
      '/api/paper-shades',        // Paper shades (needed during onboarding)
      '/api/flute-settings',      // Flute settings (needed during onboarding)
      '/api/paper-setup-status',  // Paper setup check (needed during onboarding)
      '/api/user-profile',        // User profile updates
    ];

    if (nonProtectedPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // ========== PROTECTED ROUTES (REQUIRE APPROVAL) ==========
    const protectedPaths = [
      '/api/dashboard',
      '/api/calculator',
      '/api/quotes',
      '/api/reports',
      '/api/masters',
      '/api/party-profiles',
      '/api/box-specifications',
      '/api/settings',
      '/api/rate-memory',
      '/api/invoices',
      '/api/email-templates',
      '/api/sellers',
    ];

    const isProtectedPath = protectedPaths.some(path => req.path.startsWith(path));

    // If not a protected path, allow
    if (!isProtectedPath) {
      return next();
    }

    // ========== AUTHENTICATION REQUIRED ==========
    if (!req.userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        redirect: '/auth',
      });
    }

    // ========== CHECK ONBOARDING STATUS ==========
    try {
      const setupStatus = await storage.getUserSetupStatus(req.userId, req.tenantId);

      if (!setupStatus || !setupStatus.isSetupComplete) {
        return res.status(403).json({
          code: 'ONBOARDING_INCOMPLETE',
          redirect: '/onboarding',
          message: 'Complete all setup steps and submit for verification',
          verificationStatus: setupStatus?.verificationStatus || 'NOT_SUBMITTED',
          submittedForVerification: setupStatus?.submittedForVerification || false,
        });
      }

      const verificationStatus = setupStatus.verificationStatus;

      if (verificationStatus !== 'APPROVED') {
        let message = 'Complete onboarding to access the application';
        let code = 'ONBOARDING_INCOMPLETE';

        if (verificationStatus === 'PENDING') {
          message = 'Your account is under review. You will be notified once approved.';
          code = 'VERIFICATION_PENDING';
        } else if (verificationStatus === 'REJECTED') {
          message = 'Your verification was rejected. Please update your profile and resubmit.';
          code = 'VERIFICATION_REJECTED';
        }

        return res.status(403).json({
          code,
          redirect: '/onboarding',
          message,
          verificationStatus,
          submittedForVerification: setupStatus.submittedForVerification,
        });
      }

      next();
    } catch (error) {
      console.error('Onboarding guard error:', error);
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify onboarding status',
      });
    }
  };
}

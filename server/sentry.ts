/**
 * Sentry Error Tracking Configuration
 * Initializes Sentry for error monitoring and performance tracking
 */
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn("[Sentry] SENTRY_DSN not configured. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],
    
    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query params
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = event.request.query_string
          .replace(/key=[^&]*/g, 'key=[REDACTED]')
          .replace(/secret=[^&]*/g, 'secret=[REDACTED]')
          .replace(/token=[^&]*/g, 'token=[REDACTED]');
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      'Network request failed',
      'Non-Error promise rejection captured',
      'cancelled', // User cancelled requests
    ],
  });

  console.log(`[Sentry] ✓ Initialized (${process.env.NODE_ENV})`);
}

/**
 * Capture exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

export { Sentry };

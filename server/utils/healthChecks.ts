import { db, isDbAvailable } from "../db";
import { sql } from "drizzle-orm";

/**
 * Health check utilities for monitoring system status
 */

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: any;
}

/**
 * Check database connectivity and health
 */
export async function checkDatabaseHealth(): Promise<HealthStatus> {
  try {
    if (!isDbAvailable) {
      return {
        status: 'error',
        message: 'Database not configured (DB-less mode)',
      };
    }

    // Simple query to test connection
    const result = await db.execute(sql`SELECT 1 as health_check`);
    
    if (result) {
      return {
        status: 'ok',
        message: 'Database connection healthy',
      };
    }

    return {
      status: 'degraded',
      message: 'Database query returned unexpected result',
    };
  } catch (error: any) {
    console.error('[Health Check] Database error:', error);
    return {
      status: 'error',
      message: 'Database connection failed',
      details: error.message,
    };
  }
}

/**
 * Check Clerk authentication service
 */
export async function checkClerkHealth(): Promise<HealthStatus> {
  try {
    const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      return {
        status: 'error',
        message: 'Clerk credentials not configured',
      };
    }

    // Basic check - ensure keys are present and formatted correctly
    const isPublishableValid = publishableKey.startsWith('pk_test_') || publishableKey.startsWith('pk_live_');
    const isSecretValid = secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_');

    if (!isPublishableValid || !isSecretValid) {
      return {
        status: 'degraded',
        message: 'Clerk credentials format invalid',
      };
    }

    return {
      status: 'ok',
      message: 'Clerk authentication configured',
      details: {
        environment: publishableKey.startsWith('pk_test_') ? 'test' : 'production',
      },
    };
  } catch (error: any) {
    console.error('[Health Check] Clerk error:', error);
    return {
      status: 'error',
      message: 'Clerk health check failed',
      details: error.message,
    };
  }
}

/**
 * Check email service configuration
 */
export async function checkEmailHealth(): Promise<HealthStatus> {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const emailConfigured = process.env.SMTP_HOST || process.env.RESEND_API_KEY;

    if (!encryptionKey) {
      return {
        status: 'error',
        message: 'Email encryption key not configured',
      };
    }

    if (!emailConfigured) {
      return {
        status: 'degraded',
        message: 'No email provider configured (SMTP or Resend)',
      };
    }

    return {
      status: 'ok',
      message: 'Email service configured',
      details: {
        provider: process.env.SMTP_HOST ? 'SMTP' : 'Resend',
      },
    };
  } catch (error: any) {
    console.error('[Health Check] Email error:', error);
    return {
      status: 'error',
      message: 'Email health check failed',
      details: error.message,
    };
  }
}

/**
 * Aggregate health status from all services
 */
export async function getSystemHealth() {
  const [database, clerk, email] = await Promise.all([
    checkDatabaseHealth(),
    checkClerkHealth(),
    checkEmailHealth(),
  ]);

  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
  
  if (database.status === 'error' || clerk.status === 'error') {
    overallStatus = 'error';
  } else if (
    database.status === 'degraded' ||
    clerk.status === 'degraded' ||
    email.status === 'degraded'
  ) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database,
      clerk,
      email,
    },
  };
}

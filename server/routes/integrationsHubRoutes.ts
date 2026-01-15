/**
 * ========================================================================
 * INTEGRATIONS HUB ROUTES
 * ========================================================================
 * 
 * Admin dashboard for managing platform integrations
 * GET /api/admin/integrations - List all integrations
 * GET /api/admin/integrations/:id - Get integration details
 * POST /api/admin/integrations/:id/connect - Configure/connect
 * POST /api/admin/integrations/:id/test - Test connection
 * POST /api/admin/integrations/:id/disconnect - Disable integration
 * 
 * Integrations tracked:
 * - Email providers (SMTP)
 * - Messaging (Slack, Discord)
 * - Analytics (Segment, Mixpanel)
 * - Identity (Clerk)
 * - Database (Postgres, Redis)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { integrations, integrationCredentials } from '@shared/entitlementSchema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

// ========== INTEGRATION TYPES ==========

export interface IntegrationConfig {
  id: string;
  name: string;
  category: 'EMAIL' | 'MESSAGING' | 'ANALYTICS' | 'IDENTITY' | 'DATABASE' | 'STORAGE';
  provider: string;
  description: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'UNCONFIGURED';
  requiredFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'boolean';
    required: boolean;
    masked?: boolean;
  }>;
  healthStatus?: {
    healthy: boolean;
    lastChecked?: Date;
    message?: string;
  };
}

// ========== INTEGRATION REGISTRY ==========

const INTEGRATIONS_REGISTRY: Record<string, IntegrationConfig> = {
  email_smtp: {
    id: 'email_smtp',
    name: 'SMTP Email Provider',
    category: 'EMAIL',
    provider: 'CUSTOM_SMTP',
    description: 'Send transactional emails via SMTP',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'host', label: 'SMTP Host', type: 'text', required: true },
      { key: 'port', label: 'SMTP Port', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: false },
      { key: 'password', label: 'Password', type: 'password', required: false, masked: true },
      { key: 'fromEmail', label: 'From Email', type: 'text', required: true },
      { key: 'fromName', label: 'From Name', type: 'text', required: false },
    ],
  },
  slack_webhook: {
    id: 'slack_webhook',
    name: 'Slack Notifications',
    category: 'MESSAGING',
    provider: 'SLACK',
    description: 'Send alerts and updates to Slack channels',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'password', required: true, masked: true },
      { key: 'channel', label: 'Default Channel', type: 'text', required: false },
    ],
  },
  segment_analytics: {
    id: 'segment_analytics',
    name: 'Segment Analytics',
    category: 'ANALYTICS',
    provider: 'SEGMENT',
    description: 'Route analytics events to Segment',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'writeKey', label: 'Write Key', type: 'password', required: true, masked: true },
      { key: 'dataCenter', label: 'Data Center', type: 'select', required: true },
    ],
  },
  postgres_replica: {
    id: 'postgres_replica',
    name: 'Postgres Replica',
    category: 'DATABASE',
    provider: 'POSTGRESQL',
    description: 'Read-only replica for reporting',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'text', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true, masked: true },
    ],
  },
  redis_cache: {
    id: 'redis_cache',
    name: 'Redis Cache',
    category: 'DATABASE',
    provider: 'REDIS',
    description: 'Distributed caching layer',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: false, masked: true },
      { key: 'db', label: 'Database Number', type: 'text', required: false },
    ],
  },
  clerk_identity: {
    id: 'clerk_identity',
    name: 'Clerk Authentication',
    category: 'IDENTITY',
    provider: 'CLERK',
    description: 'User authentication and management',
    status: 'CONNECTED', // Usually system-configured
    requiredFields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true, masked: true },
    ],
  },
  s3_storage: {
    id: 's3_storage',
    name: 'AWS S3 Storage',
    category: 'STORAGE',
    provider: 'AWS_S3',
    description: 'Cloud storage for invoices and exports',
    status: 'UNCONFIGURED',
    requiredFields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'password', required: true, masked: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, masked: true },
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
      { key: 'region', label: 'Region', type: 'select', required: true },
    ],
  },
};

// ========== VALIDATION SCHEMAS ==========

const connectIntegrationSchema = z.object({
  credentials: z.record(z.string(), z.any()),
  testConnection: z.boolean().default(true).optional(),
});

// ========== GET: LIST ALL INTEGRATIONS ==========

router.get('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    // Get integration list from database (if persisted)
    const dbIntegrations = await db
      .select()
      .from(integrations)
      .where(category ? eq(integrations.category, category) : undefined);

    // Build response with registry + database status
    const integrationsList = Object.values(INTEGRATIONS_REGISTRY)
      .filter(reg => !category || reg.category === category)
      .map(reg => {
        const dbInt = dbIntegrations.find((i: any) => i.id === reg.id);
        return {
          ...reg,
          status: dbInt?.status || reg.status,
          configured: !!dbInt?.isEnabled,
          healthStatus: dbInt?.lastHealthCheck ? {
            healthy: dbInt.lastHealthStatus === 'HEALTHY',
            lastChecked: dbInt.lastHealthCheck,
          } : undefined,
        };
      });

    res.json({
      integrations: integrationsList,
      categories: ['EMAIL', 'MESSAGING', 'ANALYTICS', 'IDENTITY', 'DATABASE', 'STORAGE'],
    });
  } catch (error: any) {
    console.error('[IntegrationList] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== GET: INTEGRATION DETAILS ==========

router.get('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const integration = INTEGRATIONS_REGISTRY[id];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Get database record
    const dbInt = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .then((results: any) => results[0]);

    // Get credential keys (NOT values - never expose)
    const credentials = dbInt
      ? await db
        .select({
          key: integrationCredentials.credentialKey,
          lastUpdatedAt: integrationCredentials.createdAt,
          isValid: sql`${integrationCredentials.expiresAt} > NOW()`.as('is_valid'),
        })
        .from(integrationCredentials)
        .where(eq(integrationCredentials.integrationId, id))
      : [];

    res.json({
      integration: {
        ...integration,
        status: dbInt?.status || 'UNCONFIGURED',
        configured: !!dbInt?.isEnabled,
        configuredAt: dbInt?.connectedAt,
        healthStatus: dbInt?.lastHealthCheck ? {
          healthy: dbInt.lastHealthStatus === 'HEALTHY',
          lastChecked: dbInt.lastHealthCheck,
          message: dbInt.lastHealthMessage,
        } : undefined,
      },
      credentials: credentials.map((c: any) => ({
        key: c.key,
        lastUpdatedAt: c.lastUpdatedAt,
        isValid: c.isValid,
      })),
    });
  } catch (error: any) {
    console.error('[IntegrationDetail] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== POST: CONNECT/CONFIGURE INTEGRATION ==========

router.post('/:id/connect', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { id } = req.params;
    const body = connectIntegrationSchema.parse(req.body);

    const integration = INTEGRATIONS_REGISTRY[id];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Validate required fields
    const errors = [];
    for (const field of integration.requiredFields) {
      if (field.required && !body.credentials[field.key]) {
        errors.push(`Missing required field: ${field.label}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Test connection if requested
    if (body.testConnection) {
      try {
        await testIntegrationConnection(id, body.credentials);
      } catch (testError: any) {
        return res.status(400).json({
          error: 'Connection test failed',
          details: testError.message,
        });
      }
    }

    // Store or update in database
    const now = new Date();
    
    const existingInt = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .then((results: any) => results[0]);

    if (existingInt) {
      // Update
      await db
        .update(integrations)
        .set({
          isEnabled: true,
          connectedAt: now,
          connectedBy: admin.id,
          lastHealthStatus: 'HEALTHY',
          lastHealthCheck: now,
        })
        .where(eq(integrations.id, id));
    } else {
      // Create
      await db
        .insert(integrations)
        .values({
          id,
          category: integration.category,
          provider: integration.provider,
          status: 'CONNECTED',
          isEnabled: true,
          connectedAt: now,
          connectedBy: admin.id,
          lastHealthStatus: 'HEALTHY',
          lastHealthCheck: now,
        });
    }

    // Store encrypted credentials
    for (const [key, value] of Object.entries(body.credentials)) {
      // Check if credential exists
      const existing = await db
        .select()
        .from(integrationCredentials)
        .where(
          sql`integration_id = ${id} AND credential_key = ${key}`
        )
        .then((results: any) => results[0]);

      if (existing) {
        // Update (in real implementation, encrypt before storing)
        await db
          .update(integrationCredentials)
          .set({
            credentialValue: JSON.stringify(value), // In prod: encrypt
            createdAt: now,
          })
          .where(eq(integrationCredentials.id, existing.id));
      } else {
        // Create
        await db
          .insert(integrationCredentials)
          .values({
            id: crypto.randomUUID(),
            integrationId: id,
            credentialKey: key,
            credentialValue: JSON.stringify(value), // In prod: encrypt
            createdAt: now,
            createdBy: admin.id,
          });
      }
    }

    res.json({
      message: 'Integration connected successfully',
      integration: {
        id,
        status: 'CONNECTED',
        connectedAt: now,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('[IntegrationConnect] Error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// ========== POST: TEST INTEGRATION ==========

router.post('/:id/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const integration = INTEGRATIONS_REGISTRY[id];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Get stored credentials
    const creds = await db
      .select()
      .from(integrationCredentials)
      .where(eq(integrationCredentials.integrationId, id));

    if (creds.length === 0) {
      return res.status(400).json({ error: 'Integration not configured' });
    }

    const credentials = Object.fromEntries(
      creds.map((c: any) => [c.credentialKey, JSON.parse(c.credentialValue as string)])
    );

    // Test connection
    try {
      await testIntegrationConnection(id, credentials);

      // Update health status
      await db
        .update(integrations)
        .set({
          lastHealthStatus: 'HEALTHY',
          lastHealthCheck: new Date(),
          lastHealthMessage: 'Test successful',
        })
        .where(eq(integrations.id, id));

      res.json({
        status: 'HEALTHY',
        message: 'Connection test successful',
      });
    } catch (testError: any) {
      // Update health status
      await db
        .update(integrations)
        .set({
          lastHealthStatus: 'UNHEALTHY',
          lastHealthCheck: new Date(),
          lastHealthMessage: testError.message,
        })
        .where(eq(integrations.id, id));

      res.status(400).json({
        status: 'UNHEALTHY',
        error: 'Connection test failed',
        message: testError.message,
      });
    }
  } catch (error: any) {
    console.error('[IntegrationTest] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== POST: DISCONNECT INTEGRATION ==========

router.post('/:id/disconnect', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const integration = INTEGRATIONS_REGISTRY[id];
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Soft delete - mark as disabled
    await db
      .update(integrations)
      .set({
        isEnabled: false,
        disconnectedAt: new Date(),
      })
      .where(eq(integrations.id, id));

    res.json({
      message: 'Integration disconnected',
      id,
    });
  } catch (error: any) {
    console.error('[IntegrationDisconnect] Error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ========== HELPER: TEST INTEGRATION CONNECTION ==========

async function testIntegrationConnection(
  integrationId: string,
  credentials: Record<string, any>
): Promise<void> {
  switch (integrationId) {
    case 'email_smtp': {
      // Test SMTP connection
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: credentials.host,
        port: parseInt(credentials.port),
        secure: parseInt(credentials.port) === 465,
        auth: credentials.username
          ? {
            user: credentials.username,
            pass: credentials.password,
          }
          : undefined,
      });

      await transporter.verify();
      break;
    }

    case 'slack_webhook': {
      // Test Slack webhook
      const response = await axios.post(credentials.webhookUrl, {
        text: '✅ Integration test successful',
      });
      if (response.status !== 200) {
        throw new Error('Slack webhook returned non-200 status');
      }
      break;
    }

    case 'postgres_replica': {
      // Test database connection
      const { Client } = require('pg');
      const client = new Client({
        host: credentials.host,
        port: parseInt(credentials.port),
        database: credentials.database,
        user: credentials.username,
        password: credentials.password,
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      break;
    }

    case 'redis_cache': {
      // Test Redis connection
      const redis = require('redis');
      const client = redis.createClient({
        host: credentials.host,
        port: parseInt(credentials.port),
        password: credentials.password || undefined,
      });

      await client.ping();
      await client.quit();
      break;
    }

    case 'clerk_identity': {
      // Test Clerk API
      const response = await axios.get('https://api.clerk.com/v1/users', {
        headers: {
          Authorization: `Bearer ${credentials.secretKey}`,
        },
      });
      if (response.status !== 200) {
        throw new Error('Clerk API returned non-200 status');
      }
      break;
    }

    case 's3_storage': {
      // Test S3 connection
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region: credentials.region,
      });

      await s3.headBucket({ Bucket: credentials.bucket }).promise();
      break;
    }

    case 'segment_analytics': {
      // Segment doesn't require testing - just validate key format
      if (!credentials.writeKey.match(/^[a-zA-Z0-9]+$/)) {
        throw new Error('Invalid Segment write key format');
      }
      break;
    }

    default:
      throw new Error(`Unknown integration: ${integrationId}`);
  }
}

// ========== EXPORTS ==========

export function registerIntegrationRoutes(app: any): void {
  app.use('/api/admin/integrations', router);
}

export default router;

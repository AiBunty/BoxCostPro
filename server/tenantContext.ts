/**
 * Tenant Context Management
 * 
 * This module provides utilities for multi-tenant data isolation.
 * All business data is scoped by tenant_id, which is resolved from
 * the authenticated user's tenant membership.
 * 
 * Key principles:
 * - Never accept tenant_id from frontend requests
 * - Always resolve tenant_id from the authenticated user
 * - Users can only access data for tenants they belong to
 */

import { db, isDbAvailable } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'staff';
}

/**
 * Get the tenant context for a user.
 * Each user belongs to exactly one tenant (for now - future: multi-tenant membership)
 */
export async function getTenantContextForUser(userId: string): Promise<TenantContext | null> {
  // Skip tenant context in DB-less mode
  if (!isDbAvailable) {
    return {
      tenantId: `tenant_${userId}`,
      userId: userId,
      role: 'owner',
    };
  }

  try {
    const result = await db.execute(sql`
      SELECT tu.tenant_id, tu.user_id, tu.role
      FROM tenant_users tu
      WHERE tu.user_id = ${userId}
        AND tu.is_active = true
      LIMIT 1
    `);

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return {
        tenantId: row.tenant_id,
        userId: row.user_id,
        role: row.role as 'owner' | 'admin' | 'staff',
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return null;
  }
}

/**
 * Get tenant_id for a user (simpler version for storage layer)
 */
export async function getTenantIdForUser(userId: string): Promise<string | null> {
  const context = await getTenantContextForUser(userId);
  return context?.tenantId || null;
}

/**
 * Check if a user has access to a specific tenant
 */
export async function userHasTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  // In DB-less mode, assume user has access to their own tenant
  if (!isDbAvailable) {
    return tenantId === `tenant_${userId}`;
  }

  try {
    const result = await db.execute(sql`
      SELECT 1 FROM tenant_users
      WHERE user_id = ${userId}
        AND tenant_id = ${tenantId}
        AND is_active = true
      LIMIT 1
    `);

    return result.rows && result.rows.length > 0;
  } catch (error) {
    console.error('Error checking tenant access:', error);
    return false;
  }
}

/**
 * Create a new tenant for a user (used during signup if no trigger)
 */
export async function createTenantForUser(
  userId: string,
  businessName?: string
): Promise<TenantContext | null> {
  // In DB-less mode, just return a mock tenant context
  if (!isDbAvailable) {
    return {
      tenantId: `tenant_${userId}`,
      userId: userId,
      role: 'owner',
    };
  }

  try {
    // Check if user already has a tenant
    const existing = await getTenantContextForUser(userId);
    if (existing) {
      return existing;
    }

    // Create new tenant
    const tenantResult = await db.execute(sql`
      INSERT INTO tenants (id, business_name, owner_user_id, is_active, created_at, updated_at)
      VALUES (gen_random_uuid()::VARCHAR, ${businessName || 'My Business'}, ${userId}, true, NOW(), NOW())
      RETURNING id
    `);

    if (!tenantResult.rows || tenantResult.rows.length === 0) {
      throw new Error('Failed to create tenant');
    }

    const tenantId = (tenantResult.rows[0] as any).id;

    // Add user as owner of the tenant
    await db.execute(sql`
      INSERT INTO tenant_users (tenant_id, user_id, role, is_active, joined_at, created_at)
      VALUES (${tenantId}, ${userId}, 'owner', true, NOW(), NOW())
    `);
    
    // Create a complete default company profile for the tenant
    // This prevents the "stuck at settings" bug by ensuring phone/email are set
    try {
      const user = await storage.getUser(userId);

      await storage.createCompanyProfile({
        tenantId,
        userId,
        companyName: businessName || user?.fullName || 'My Business',
        ownerName: user?.fullName || null,
        email: user?.email || null,  // Use user's email to satisfy guard check
        phone: user?.mobileNo || null,  // Use mobile if available
        isDefault: true,
      } as any);

      console.log('[TenantContext] Created default company profile with email:', user?.email);
    } catch (profileErr) {
      // Non-fatal: if profile creation races or fails, continue and return tenant context
      console.warn('Failed to create default company profile for tenant', profileErr);
    }

    return {
      tenantId,
      userId,
      role: 'owner',
    };
  } catch (error: any) {
    // Handle race condition - check if tenant was created by trigger
    const existing = await getTenantContextForUser(userId);
    if (existing) {
      return existing;
    }
    console.error('Error creating tenant for user:', error);
    throw error;
  }
}

/**
 * Get or create tenant context for a user
 * This ensures every user has a tenant
 */
export async function ensureTenantContext(userId: string): Promise<TenantContext> {
  let context = await getTenantContextForUser(userId);
  
  if (!context) {
    // User doesn't have a tenant - create one
    context = await createTenantForUser(userId);
    if (!context) {
      throw new Error('Failed to establish tenant context');
    }
  }
  
  return context;
}

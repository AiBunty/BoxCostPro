/**
 * Plan Management Service
 * 
 * Handles all subscription plan operations with versioning.
 * Plans are ADMIN-DEFINED and SYSTEM-CONTROLLED.
 * 
 * RULES:
 * 1. Plans are identified by immutable CODE (not name)
 * 2. Editing a plan creates a NEW VERSION
 * 3. Old versions are NEVER modified
 * 4. Existing subscriptions remain on their original version
 */

import { db } from '../db';
import { 
  subscriptionPlans, 
  planVersions, 
  subscriptionFeatures, 
  planFeatures,
  planAuditLogs 
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ========== TYPES ==========

interface CreatePlanInput {
  code: string;
  name: string;
  description?: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  basePrice: number;
  currency?: string;
  gstApplicable?: boolean;
  gstRate?: number;
  isPublic?: boolean;
  trialDays?: number;
  sortOrder?: number;
  features?: Record<string, string | number | boolean>;
  createdBy?: string;
}

interface UpdatePlanInput {
  name?: string;
  description?: string;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  basePrice?: number;
  gstApplicable?: boolean;
  gstRate?: number;
  isPublic?: boolean;
  trialDays?: number;
  sortOrder?: number;
  features?: Record<string, string | number | boolean>;
  changeNotes?: string;
  updatedBy?: string;
}

interface PlanWithVersion {
  plan: typeof subscriptionPlans.$inferSelect;
  currentVersion: typeof planVersions.$inferSelect;
  features: Array<{
    feature: typeof subscriptionFeatures.$inferSelect;
    value: string;
    isEnabled: boolean;
  }>;
}

// ========== PLAN CRUD ==========

/**
 * Create a new subscription plan with initial version
 */
export async function createPlan(input: CreatePlanInput): Promise<PlanWithVersion> {
  const planId = randomUUID();
  const versionId = randomUUID();
  
  // Validate code uniqueness
  const existing = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, input.code)) // Using name as code was added via migration
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error(`Plan with code '${input.code}' already exists`);
  }
  
  // Create plan
  const [plan] = await db.insert(subscriptionPlans).values({
    id: planId,
    name: input.name,
    description: input.description,
    priceMonthly: input.basePrice,
    priceYearly: input.billingCycle === 'YEARLY' ? input.basePrice : input.basePrice * 12 * 0.8, // 20% yearly discount
    isActive: true,
    trialDays: input.trialDays ?? 0,
    displayOrder: input.sortOrder ?? 0,
  }).returning();
  
  // Create initial version
  const [version] = await db.insert(planVersions).values({
    id: versionId,
    planId: planId,
    version: 1,
    price: input.basePrice,
    billingCycle: input.billingCycle,
    gstRate: input.gstRate ?? 18.00,
    effectiveFrom: new Date(),
    isCurrent: true,
    changeNotes: 'Initial version',
    createdBy: input.createdBy,
  }).returning();
  
  // Create plan features if provided
  const featuresList: Array<{
    feature: typeof subscriptionFeatures.$inferSelect;
    value: string;
    isEnabled: boolean;
  }> = [];
  
  if (input.features) {
    await createPlanFeatures(versionId, input.features);
    
    // Load created features
    const loadedFeatures = await getPlanFeatures(versionId);
    featuresList.push(...loadedFeatures);
  }
  
  // Audit log
  await db.insert(planAuditLogs).values({
    id: randomUUID(),
    planId: planId,
    planVersionId: versionId,
    action: 'CREATE',
    afterSnapshot: {
      plan,
      version,
      features: featuresList,
    },
    actorId: input.createdBy,
  });
  
  return {
    plan,
    currentVersion: version,
    features: featuresList,
  };
}

/**
 * Update a plan - Creates a NEW VERSION (never modifies existing)
 */
export async function updatePlan(
  planId: string, 
  input: UpdatePlanInput
): Promise<PlanWithVersion> {
  // Get current plan
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  
  // Get current version
  const [currentVersion] = await db
    .select()
    .from(planVersions)
    .where(and(
      eq(planVersions.planId, planId),
      eq(planVersions.isCurrent, true)
    ))
    .limit(1);
  
  if (!currentVersion) {
    throw new Error(`No current version found for plan: ${planId}`);
  }
  
  // Check if pricing or features changed (requires new version)
  const priceChanged = input.basePrice !== undefined && input.basePrice !== currentVersion.price;
  const cycleChanged = input.billingCycle !== undefined && input.billingCycle !== currentVersion.billingCycle;
  const featuresChanged = input.features !== undefined;
  
  const requiresNewVersion = priceChanged || cycleChanged || featuresChanged;
  
  // Get before state for audit
  const beforeFeatures = await getPlanFeatures(currentVersion.id);
  const beforeState = {
    plan,
    version: currentVersion,
    features: beforeFeatures,
  };
  
  // Update plan metadata (always allowed)
  if (input.name || input.description || input.isPublic !== undefined || 
      input.trialDays !== undefined || input.sortOrder !== undefined) {
    await db.update(subscriptionPlans)
      .set({
        name: input.name ?? plan.name,
        description: input.description ?? plan.description,
        isActive: input.isPublic ?? plan.isActive,
        trialDays: input.trialDays ?? plan.trialDays,
        displayOrder: input.sortOrder ?? plan.displayOrder,
      })
      .where(eq(subscriptionPlans.id, planId));
  }
  
  let newVersion = currentVersion;
  let newFeatures = beforeFeatures;
  
  if (requiresNewVersion) {
    // Mark current version as not current
    await db.update(planVersions)
      .set({
        isCurrent: false,
        effectiveUntil: new Date(),
      })
      .where(eq(planVersions.id, currentVersion.id));
    
    // Create new version
    const newVersionId = randomUUID();
    const [created] = await db.insert(planVersions).values({
      id: newVersionId,
      planId: planId,
      version: currentVersion.version + 1,
      price: input.basePrice ?? currentVersion.price,
      billingCycle: input.billingCycle ?? currentVersion.billingCycle ?? 'MONTHLY',
      gstRate: input.gstRate ?? currentVersion.gstRate ?? 18.00,
      effectiveFrom: new Date(),
      isCurrent: true,
      changeNotes: input.changeNotes ?? 'Version update',
      createdBy: input.updatedBy,
    }).returning();
    
    newVersion = created;
    
    // Copy or update features
    if (input.features) {
      await createPlanFeatures(newVersionId, input.features);
    } else {
      // Copy features from previous version
      for (const f of beforeFeatures) {
        await db.insert(planFeatures).values({
          id: randomUUID(),
          planVersionId: newVersionId,
          featureId: f.feature.id,
          value: f.value,
          isEnabled: f.isEnabled,
        });
      }
    }
    
    newFeatures = await getPlanFeatures(newVersionId);
  }
  
  // Get updated plan
  const [updatedPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  
  const afterState = {
    plan: updatedPlan,
    version: newVersion,
    features: newFeatures,
  };
  
  // Audit log
  await db.insert(planAuditLogs).values({
    id: randomUUID(),
    planId: planId,
    planVersionId: requiresNewVersion ? newVersion.id : undefined,
    action: requiresNewVersion ? 'VERSION_CREATE' : 'UPDATE',
    beforeSnapshot: beforeState,
    afterSnapshot: afterState,
    actorId: input.updatedBy,
  });
  
  return {
    plan: updatedPlan,
    currentVersion: newVersion,
    features: newFeatures,
  };
}

/**
 * Archive a plan (soft delete)
 */
export async function archivePlan(planId: string, actorId?: string): Promise<void> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  
  await db.update(subscriptionPlans)
    .set({ isActive: false })
    .where(eq(subscriptionPlans.id, planId));
  
  // Audit log
  await db.insert(planAuditLogs).values({
    id: randomUUID(),
    planId: planId,
    action: 'ARCHIVE',
    beforeSnapshot: { plan },
    afterSnapshot: { plan: { ...plan, isActive: false } },
    actorId: actorId,
  });
}

/**
 * Reactivate an archived plan
 */
export async function reactivatePlan(planId: string, actorId?: string): Promise<void> {
  await db.update(subscriptionPlans)
    .set({ isActive: true })
    .where(eq(subscriptionPlans.id, planId));
  
  await db.insert(planAuditLogs).values({
    id: randomUUID(),
    planId: planId,
    action: 'REACTIVATE',
    afterSnapshot: { status: 'ACTIVE' },
    actorId: actorId,
  });
}

// ========== PLAN QUERIES ==========

/**
 * Get all active plans with current versions
 */
export async function getActivePlans(): Promise<PlanWithVersion[]> {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.displayOrder);
  
  const result: PlanWithVersion[] = [];
  
  for (const plan of plans) {
    const [version] = await db
      .select()
      .from(planVersions)
      .where(and(
        eq(planVersions.planId, plan.id),
        eq(planVersions.isCurrent, true)
      ))
      .limit(1);
    
    if (version) {
      const features = await getPlanFeatures(version.id);
      result.push({ plan, currentVersion: version, features });
    }
  }
  
  return result;
}

/**
 * Get a single plan with current version
 */
export async function getPlan(planId: string): Promise<PlanWithVersion | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  
  if (!plan) return null;
  
  const [version] = await db
    .select()
    .from(planVersions)
    .where(and(
      eq(planVersions.planId, planId),
      eq(planVersions.isCurrent, true)
    ))
    .limit(1);
  
  if (!version) return null;
  
  const features = await getPlanFeatures(version.id);
  
  return { plan, currentVersion: version, features };
}

/**
 * Get plan by code
 */
export async function getPlanByCode(code: string): Promise<PlanWithVersion | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, code.toLowerCase()))
    .limit(1);
  
  if (!plan) return null;
  
  return getPlan(plan.id);
}

/**
 * Get version history for a plan
 */
export async function getPlanVersionHistory(planId: string) {
  return db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.version));
}

/**
 * Get a specific plan version
 */
export async function getPlanVersion(versionId: string): Promise<{
  version: typeof planVersions.$inferSelect;
  features: Array<{
    feature: typeof subscriptionFeatures.$inferSelect;
    value: string;
    isEnabled: boolean;
  }>;
} | null> {
  const [version] = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.id, versionId))
    .limit(1);
  
  if (!version) return null;
  
  const features = await getPlanFeatures(versionId);
  
  return { version, features };
}

// ========== FEATURES ==========

/**
 * Get all available features
 */
export async function getAllFeatures() {
  return db
    .select()
    .from(subscriptionFeatures)
    .where(eq(subscriptionFeatures.isActive, true))
    .orderBy(subscriptionFeatures.sortOrder);
}

/**
 * Get features for a specific plan version
 */
export async function getPlanFeatures(planVersionId: string): Promise<Array<{
  feature: typeof subscriptionFeatures.$inferSelect;
  value: string;
  isEnabled: boolean;
}>> {
  const features = await db
    .select({
      planFeature: planFeatures,
      feature: subscriptionFeatures,
    })
    .from(planFeatures)
    .innerJoin(subscriptionFeatures, eq(planFeatures.featureId, subscriptionFeatures.id))
    .where(eq(planFeatures.planVersionId, planVersionId));
  
  return features.map(f => ({
    feature: f.feature,
    value: f.planFeature.value,
    isEnabled: f.planFeature.isEnabled ?? true,
  }));
}

/**
 * Create plan features for a version
 */
async function createPlanFeatures(
  planVersionId: string, 
  features: Record<string, string | number | boolean>
): Promise<void> {
  const allFeatures = await getAllFeatures();
  
  for (const [code, value] of Object.entries(features)) {
    const feature = allFeatures.find(f => f.code === code);
    if (!feature) {
      console.warn(`Feature not found: ${code}`);
      continue;
    }
    
    await db.insert(planFeatures).values({
      id: randomUUID(),
      planVersionId: planVersionId,
      featureId: feature.id,
      value: String(value),
      isEnabled: typeof value === 'boolean' ? value : true,
    });
  }
}

/**
 * Create a new feature definition
 */
export async function createFeature(input: {
  code: string;
  name: string;
  description?: string;
  valueType: 'BOOLEAN' | 'NUMBER' | 'TEXT';
  defaultValue?: string;
  category?: string;
  sortOrder?: number;
}) {
  const [feature] = await db.insert(subscriptionFeatures).values({
    id: randomUUID(),
    code: input.code,
    name: input.name,
    description: input.description,
    valueType: input.valueType,
    defaultValue: input.defaultValue,
    category: input.category,
    sortOrder: input.sortOrder ?? 0,
    isActive: true,
  }).returning();
  
  return feature;
}

// ========== GST CALCULATION ==========

/**
 * Calculate GST for a plan price
 */
export function calculatePlanGST(
  basePrice: number,
  gstRate: number,
  customerState: string,
  companyState: string = 'Maharashtra'
): {
  baseAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  isIgst: boolean;
  totalAmount: number;
} {
  const isIgst = customerState.toLowerCase() !== companyState.toLowerCase();
  const gstAmount = basePrice * (gstRate / 100);
  
  if (isIgst) {
    return {
      baseAmount: basePrice,
      gstAmount,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: gstAmount,
      isIgst: true,
      totalAmount: basePrice + gstAmount,
    };
  }
  
  const halfGst = gstAmount / 2;
  return {
    baseAmount: basePrice,
    gstAmount,
    cgstAmount: halfGst,
    sgstAmount: halfGst,
    igstAmount: 0,
    isIgst: false,
    totalAmount: basePrice + gstAmount,
  };
}

// ========== AUDIT ==========

/**
 * Get audit history for a plan
 */
export async function getPlanAuditHistory(planId: string) {
  return db
    .select()
    .from(planAuditLogs)
    .where(eq(planAuditLogs.planId, planId))
    .orderBy(desc(planAuditLogs.createdAt));
}

export default {
  createPlan,
  updatePlan,
  archivePlan,
  reactivatePlan,
  getActivePlans,
  getPlan,
  getPlanByCode,
  getPlanVersionHistory,
  getPlanVersion,
  getAllFeatures,
  getPlanFeatures,
  createFeature,
  calculatePlanGST,
  getPlanAuditHistory,
};

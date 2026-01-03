/**
 * SUBSCRIPTION MANAGEMENT API ROUTES
 * 
 * Enterprise-grade subscription and plan management endpoints:
 * - Plan CRUD with versioning (Admin only)
 * - Subscription lifecycle (User and Admin)
 * - Payment processing
 * - Invoice management
 * - Coupon management
 * 
 * All routes require authentication. Admin routes require SUPER_ADMIN role.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { verifyAdminAuth, enforcePermission } from "../middleware/adminRbac";
import { requireActiveSubscription, requireFeature, requirePlan } from "../middleware/featureEnforcement";
import {
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
} from "../services/planManagement";
import {
  createSubscription,
  activateSubscription,
  renewSubscription,
  cancelSubscription,
  suspendSubscription,
  reactivateSubscription,
  getSubscription,
  getActiveSubscription,
  getUserSubscriptions,
  getSubscriptionStats,
  getExpiringSubscriptions,
  upgradeSubscription,
} from "../services/subscriptionManagement";
import {
  createPaymentOrder,
  verifyAndCompletePayment,
  handlePaymentFailure,
  validateCoupon,
  getInvoice,
  getInvoiceByNumber,
  getUserInvoices,
  getTenantInvoices,
  getSubscriptionPayments,
  createCreditNote,
  createCoupon,
  deactivateCoupon,
  getActiveCoupons,
  getCouponUsageAnalytics,
  getRevenueStats,
} from "../services/billingService";

const router = Router();

// ========== INPUT VALIDATION SCHEMAS ==========

const CreatePlanSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  price: z.number().min(0),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  gstRate: z.number().min(0).max(100).default(18),
  isPublic: z.boolean().default(true),
  features: z.array(z.object({
    featureId: z.string(),
    value: z.string(),
  })).optional(),
  trialDays: z.number().min(0).optional(),
});

const UpdatePlanSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  isPublic: z.boolean().optional(),
  features: z.array(z.object({
    featureId: z.string(),
    value: z.string(),
  })).optional(),
  changeNotes: z.string().optional(),
});

const CreateFeatureSchema = z.object({
  code: z.string().min(2).max(100),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  valueType: z.enum(['BOOLEAN', 'NUMBER', 'TEXT']),
  defaultValue: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.number().optional(),
});

const CreateSubscriptionSchema = z.object({
  planId: z.string(),
  planVersionId: z.string().optional(),
  startTrial: z.boolean().default(false),
  trialDays: z.number().optional(),
});

const CreatePaymentOrderSchema = z.object({
  subscriptionId: z.string(),
  planVersionId: z.string(),
  couponCode: z.string().optional(),
  billingState: z.string().optional(),
  billingGstin: z.string().optional(),
});

const VerifyPaymentSchema = z.object({
  paymentId: z.string(),
  gatewayPaymentId: z.string(),
  gatewayOrderId: z.string(),
  gatewaySignature: z.string(),
});

const CancelSubscriptionSchema = z.object({
  cancelImmediately: z.boolean().default(false),
  reason: z.string().optional(),
});

const UpgradeSubscriptionSchema = z.object({
  newPlanId: z.string(),
  newPlanVersionId: z.string().optional(),
});

const CreateCouponSchema = z.object({
  code: z.string().min(3).max(30),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z.number().min(0),
  maxDiscountAmount: z.number().optional(),
  maxUses: z.number().optional(),
  maxUsesPerUser: z.number().default(1),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  applicablePlans: z.array(z.string()).optional(),
  minAmount: z.number().optional(),
  firstSubscriptionOnly: z.boolean().default(false),
});

const CreditNoteSchema = z.object({
  invoiceId: z.string(),
  reason: z.string().min(10),
  amount: z.number().optional(),
});

// ========== HELPER FUNCTIONS ==========

function getRequestContext(req: Request): { userId: string; tenantId: string; isAdmin: boolean } {
  const userId = (req as any).auth?.userId || '';
  const tenantId = (req as any).user?.tenantId || (req as any).tenantId || '';
  const isAdmin = !!(req as any).adminUser;
  return { userId, tenantId, isAdmin };
}

// ========== PLAN ROUTES (ADMIN ONLY) ==========

/**
 * GET /api/subscription/plans
 * Get all public plans (for pricing page)
 */
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = await getActivePlans();
    // Filter to public plans only
    const publicPlans = plans.filter(p => p.plan.isActive);
    res.json({ success: true, data: publicPlans });
  } catch (error: any) {
    console.error('[API] Get plans error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/all
 * Get all plans including non-public (Admin only)
 */
router.get("/plans/all", verifyAdminAuth, enforcePermission("view_audit_logs"), async (req: Request, res: Response) => {
  try {
    const plans = await getActivePlans();
    res.json({ success: true, data: plans });
  } catch (error: any) {
    console.error('[API] Get all plans error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/:id
 * Get plan details
 */
router.get("/plans/:id", async (req: Request, res: Response) => {
  try {
    const plan = await getPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('[API] Get plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/:id/versions
 * Get plan version history (Admin only)
 */
router.get("/plans/:id/versions", verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const versions = await getPlanVersionHistory(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error: any) {
    console.error('[API] Get plan versions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/:id/features
 * Get features for current plan version
 */
router.get("/plans/:id/features", async (req: Request, res: Response) => {
  try {
    const features = await getPlanFeatures(req.params.id);
    res.json({ success: true, data: features });
  } catch (error: any) {
    console.error('[API] Get plan features error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/:id/gst
 * Calculate GST for a plan
 */
router.get("/plans/:id/gst", async (req: Request, res: Response) => {
  try {
    const buyerState = req.query.buyerState as string | undefined;
    const plan = await getPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    // Use the gstCalculation service directly
    const { calculateGST } = await import('../services/gstCalculation');
    const sellerState = '27'; // Maharashtra - company state
    const gst = calculateGST(plan.currentVersion.price, sellerState, buyerState ?? null, 0);
    res.json({ success: true, data: gst });
  } catch (error: any) {
    console.error('[API] Calculate GST error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/plans/:id/audit
 * Get plan audit history (Admin only)
 */
router.get("/plans/:id/audit", verifyAdminAuth, enforcePermission("view_audit_logs"), async (req: Request, res: Response) => {
  try {
    const audit = await getPlanAuditHistory(req.params.id);
    res.json({ success: true, data: audit });
  } catch (error: any) {
    console.error('[API] Get plan audit error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/plans
 * Create a new plan (Admin only)
 */
router.post("/plans", verifyAdminAuth, enforcePermission("configure_roles"), async (req: Request, res: Response) => {
  try {
    const validatedInput = CreatePlanSchema.parse(req.body);
    const { userId } = getRequestContext(req);

    // Convert features array to Record format
    const featuresRecord: Record<string, string | number | boolean> = {};
    if (validatedInput.features) {
      for (const f of validatedInput.features) {
        featuresRecord[f.featureId] = f.value;
      }
    }

    const result = await createPlan({
      code: validatedInput.code,
      name: validatedInput.name,
      description: validatedInput.description,
      basePrice: validatedInput.price,
      billingCycle: validatedInput.billingCycle,
      gstRate: validatedInput.gstRate,
      isPublic: validatedInput.isPublic,
      features: Object.keys(featuresRecord).length > 0 ? featuresRecord : undefined,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: { planId: result.plan.id, versionId: result.currentVersion.id } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/subscription/plans/:id
 * Update a plan (creates new version - Admin only)
 */
router.patch("/plans/:id", verifyAdminAuth, enforcePermission("configure_roles"), async (req: Request, res: Response) => {
  try {
    const validatedInput = UpdatePlanSchema.parse(req.body);
    const { userId } = getRequestContext(req);

    // Convert features array to Record format if present
    let featuresRecord: Record<string, string | number | boolean> | undefined;
    if (validatedInput.features) {
      featuresRecord = {};
      for (const f of validatedInput.features) {
        featuresRecord[f.featureId] = f.value;
      }
    }

    const result = await updatePlan(req.params.id, {
      name: validatedInput.name,
      description: validatedInput.description,
      basePrice: validatedInput.price,
      billingCycle: validatedInput.billingCycle,
      gstRate: validatedInput.gstRate,
      isPublic: validatedInput.isPublic,
      features: featuresRecord,
      changeNotes: validatedInput.changeNotes,
      updatedBy: userId,
    });

    res.json({ 
      success: true, 
      data: { 
        planId: req.params.id, 
        newVersionId: result.currentVersion.id,
        newVersion: result.currentVersion.version,
      } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Update plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/plans/:id/archive
 * Archive a plan (Admin only)
 */
router.post("/plans/:id/archive", verifyAdminAuth, enforcePermission("configure_roles"), async (req: Request, res: Response) => {
  try {
    const { userId } = getRequestContext(req);
    await archivePlan(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Archive plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/plans/:id/reactivate
 * Reactivate an archived plan (Admin only)
 */
router.post("/plans/:id/reactivate", verifyAdminAuth, enforcePermission("configure_roles"), async (req: Request, res: Response) => {
  try {
    const { userId } = getRequestContext(req);
    await reactivatePlan(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Reactivate plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== FEATURE ROUTES (ADMIN ONLY) ==========

/**
 * GET /api/subscription/features
 * Get all system features
 */
router.get("/features", verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const features = await getAllFeatures();
    res.json({ success: true, data: features });
  } catch (error: any) {
    console.error('[API] Get features error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/features
 * Create a new system feature (Admin only)
 */
router.post("/features", verifyAdminAuth, enforcePermission("configure_roles"), async (req: Request, res: Response) => {
  try {
    const validatedInput = CreateFeatureSchema.parse(req.body);

    const result = await createFeature(validatedInput);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, data: { featureId: result.featureId } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create feature error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SUBSCRIPTION ROUTES (USER) ==========

/**
 * GET /api/subscription/my
 * Get current user's active subscription
 */
router.get("/my", async (req: Request, res: Response) => {
  try {
    const { userId, tenantId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const subscription = await getActiveSubscription(userId, tenantId);
    res.json({ success: true, data: subscription || null });
  } catch (error: any) {
    console.error('[API] Get my subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/my/history
 * Get current user's subscription history
 */
router.get("/my/history", async (req: Request, res: Response) => {
  try {
    const { userId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const subscriptions = await getUserSubscriptions(userId);
    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    console.error('[API] Get subscription history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/create
 * Create a new subscription (starts as pending or trial)
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const validatedInput = CreateSubscriptionSchema.parse(req.body);
    const { userId, tenantId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const result = await createSubscription({
      userId,
      tenantId,
      planId: validatedInput.planId,
      planVersionId: validatedInput.planVersionId,
      startTrial: validatedInput.startTrial,
      trialDays: validatedInput.trialDays,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, data: { subscriptionId: result.subscriptionId } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/:id/cancel
 * Cancel a subscription
 */
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const validatedInput = CancelSubscriptionSchema.parse(req.body);
    const { userId } = getRequestContext(req);
    
    const result = await cancelSubscription(
      req.params.id,
      validatedInput.cancelImmediately,
      validatedInput.reason,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { effectiveDate: result.effectiveDate } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Cancel subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/:id/upgrade
 * Upgrade to a new plan
 */
router.post("/:id/upgrade", async (req: Request, res: Response) => {
  try {
    const validatedInput = UpgradeSubscriptionSchema.parse(req.body);
    const { userId } = getRequestContext(req);
    
    const result = await upgradeSubscription(
      req.params.id,
      validatedInput.newPlanId,
      validatedInput.newPlanVersionId,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ 
      success: true, 
      data: { 
        newSubscriptionId: result.newSubscriptionId,
        proratedAmount: result.proratedAmount,
      } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Upgrade subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ADMIN SUBSCRIPTION ROUTES ==========

/**
 * GET /api/subscription/admin/:id
 * Get subscription details (Admin only)
 */
router.get("/admin/:id", verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const subscription = await getSubscription(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    res.json({ success: true, data: subscription });
  } catch (error: any) {
    console.error('[API] Get subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/admin/:id/suspend
 * Suspend a subscription (Admin only)
 */
router.post("/admin/:id/suspend", verifyAdminAuth, enforcePermission("process_refund"), async (req: Request, res: Response) => {
  try {
    const reason = req.body.reason as string;
    const { userId } = getRequestContext(req);
    
    const result = await suspendSubscription(req.params.id, reason, userId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Suspend subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/admin/:id/reactivate
 * Reactivate a suspended subscription (Admin only)
 */
router.post("/admin/:id/reactivate", verifyAdminAuth, enforcePermission("process_refund"), async (req: Request, res: Response) => {
  try {
    const { userId } = getRequestContext(req);
    
    const result = await reactivateSubscription(req.params.id, userId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Reactivate subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/admin/stats
 * Get subscription statistics (Admin only)
 */
router.get("/admin/stats", verifyAdminAuth, enforcePermission("view_revenue_analytics"), async (req: Request, res: Response) => {
  try {
    const stats = await getSubscriptionStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[API] Get subscription stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/admin/expiring
 * Get subscriptions expiring soon (Admin only)
 */
router.get("/admin/expiring", verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const subscriptions = await getExpiringSubscriptions(days);
    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    console.error('[API] Get expiring subscriptions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== PAYMENT ROUTES ==========

/**
 * POST /api/subscription/payment/create-order
 * Create a payment order for subscription
 */
router.post("/payment/create-order", async (req: Request, res: Response) => {
  try {
    const validatedInput = CreatePaymentOrderSchema.parse(req.body);
    const { userId, tenantId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const result = await createPaymentOrder({
      subscriptionId: validatedInput.subscriptionId,
      userId,
      tenantId,
      planVersionId: validatedInput.planVersionId,
      couponCode: validatedInput.couponCode,
      billingState: validatedInput.billingState,
      billingGstin: validatedInput.billingGstin,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create payment order error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/payment/verify
 * Verify and complete a payment
 */
router.post("/payment/verify", async (req: Request, res: Response) => {
  try {
    const validatedInput = VerifyPaymentSchema.parse(req.body);

    const result = await verifyAndCompletePayment({
      paymentId: validatedInput.paymentId,
      gatewayPaymentId: validatedInput.gatewayPaymentId,
      gatewayOrderId: validatedInput.gatewayOrderId,
      gatewaySignature: validatedInput.gatewaySignature,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { invoiceId: result.invoiceId } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Verify payment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/payment/webhook
 * Handle payment gateway webhooks
 */
router.post("/payment/webhook", async (req: Request, res: Response) => {
  try {
    const event = req.body;
    
    // Razorpay webhook handling
    if (event.event) {
      switch (event.event) {
        case 'payment.captured':
          // Payment successful - handled by verify endpoint
          break;
        case 'payment.failed':
          if (event.payload?.payment?.entity?.notes?.paymentId) {
            await handlePaymentFailure(
              event.payload.payment.entity.notes.paymentId,
              event.payload.payment.entity.error_description || 'Payment failed',
              true
            );
          }
          break;
        default:
          console.log('[Webhook] Unhandled event:', event.event);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/payment/:subscriptionId
 * Get payment history for a subscription
 */
router.get("/payment/:subscriptionId", async (req: Request, res: Response) => {
  try {
    const payments = await getSubscriptionPayments(req.params.subscriptionId);
    res.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[API] Get payments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== COUPON ROUTES ==========

/**
 * POST /api/subscription/coupon/validate
 * Validate a coupon code
 */
router.post("/coupon/validate", async (req: Request, res: Response) => {
  try {
    const { code, planId, amount } = req.body;
    const { userId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const result = await validateCoupon(code, userId, planId, amount);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API] Validate coupon error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/coupon/active
 * Get active coupons (Admin only)
 */
router.get("/coupon/active", verifyAdminAuth, enforcePermission("list_coupons"), async (req: Request, res: Response) => {
  try {
    const coupons = await getActiveCoupons();
    res.json({ success: true, data: coupons });
  } catch (error: any) {
    console.error('[API] Get coupons error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/coupon
 * Create a new coupon (Admin only)
 */
router.post("/coupon", verifyAdminAuth, enforcePermission("create_coupon"), async (req: Request, res: Response) => {
  try {
    const validatedInput = CreateCouponSchema.parse(req.body);
    const { userId } = getRequestContext(req);

    const result = await createCoupon({
      ...validatedInput,
      validFrom: validatedInput.validFrom ? new Date(validatedInput.validFrom) : undefined,
      validUntil: validatedInput.validUntil ? new Date(validatedInput.validUntil) : undefined,
      createdBy: userId,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, data: { couponId: result.couponId } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create coupon error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/coupon/:id/deactivate
 * Deactivate a coupon (Admin only)
 */
router.post("/coupon/:id/deactivate", verifyAdminAuth, enforcePermission("delete_coupon"), async (req: Request, res: Response) => {
  try {
    await deactivateCoupon(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Deactivate coupon error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/coupon/:id/analytics
 * Get coupon usage analytics (Admin only)
 */
router.get("/coupon/:id/analytics", verifyAdminAuth, enforcePermission("view_coupon_analytics"), async (req: Request, res: Response) => {
  try {
    const analytics = await getCouponUsageAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    console.error('[API] Get coupon analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== INVOICE ROUTES ==========

/**
 * GET /api/subscription/invoice/my
 * Get current user's invoices
 */
router.get("/invoice/my", async (req: Request, res: Response) => {
  try {
    const { userId } = getRequestContext(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const invoices = await getUserInvoices(userId);
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    console.error('[API] Get invoices error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/invoice/:id
 * Get invoice by ID
 */
router.get("/invoice/:id", async (req: Request, res: Response) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    console.error('[API] Get invoice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/invoice/number/:number
 * Get invoice by number
 */
router.get("/invoice/number/:number", async (req: Request, res: Response) => {
  try {
    const invoice = await getInvoiceByNumber(req.params.number);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    console.error('[API] Get invoice by number error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscription/invoice/credit-note
 * Create a credit note (Admin only)
 */
router.post("/invoice/credit-note", verifyAdminAuth, enforcePermission("create_credit_note"), async (req: Request, res: Response) => {
  try {
    const validatedInput = CreditNoteSchema.parse(req.body);
    const { userId } = getRequestContext(req);

    const result = await createCreditNote(
      validatedInput.invoiceId,
      validatedInput.reason,
      validatedInput.amount,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, data: { creditNoteId: result.creditNoteId } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('[API] Create credit note error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscription/invoice/tenant/:tenantId
 * Get tenant invoices (Admin only)
 */
router.get("/invoice/tenant/:tenantId", verifyAdminAuth, enforcePermission("view_payments"), async (req: Request, res: Response) => {
  try {
    const invoices = await getTenantInvoices(req.params.tenantId);
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    console.error('[API] Get tenant invoices error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== REVENUE ROUTES (ADMIN) ==========

/**
 * GET /api/subscription/revenue/stats
 * Get revenue statistics (Admin only)
 */
router.get("/revenue/stats", verifyAdminAuth, enforcePermission("view_revenue_analytics"), async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date();

    const stats = await getRevenueStats(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[API] Get revenue stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

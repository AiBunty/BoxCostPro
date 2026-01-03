/**
 * ENTERPRISE BILLING & PAYMENT SERVICE
 * 
 * Gateway-agnostic payment processing with:
 * - Multi-gateway support (Razorpay primary, extensible to Stripe, etc.)
 * - GST-compliant invoice generation
 * - Coupon validation and application
 * - Payment retry with exponential backoff
 * - Webhook handling for payment confirmation
 * 
 * Design Principles:
 * 1. Gateway is COLLECTION ONLY - database is source of truth
 * 2. All financial calculations happen in backend (never trust frontend)
 * 3. GST computed at payment time based on latest tax rules
 * 4. Audit trail for all financial transactions
 */

import { db } from "../db";
import { 
  subscriptionPayments, 
  subscriptionInvoices, 
  subscriptionCoupons,
  couponUsages,
  userSubscriptions,
  planVersions,
  subscriptionPlans,
  subscriptionAuditLogs,
} from "@shared/schema";
import { eq, and, sql, isNull, lte, gte, gt, or, desc } from "drizzle-orm";
import { 
  createRazorpayOrder, 
  verifyRazorpaySignature, 
  fetchPaymentDetails,
  rupeesToPaise,
  paiseToRupees,
  isRazorpayInitialized 
} from "./razorpayService";
import { calculateGST, type GSTBreakdown } from "./gstCalculation";
import { activateSubscription, renewSubscription, markPastDue } from "./subscriptionManagement";

// ========== TYPES ==========

export type PaymentGateway = 'RAZORPAY' | 'STRIPE' | 'PAYPAL' | 'MANUAL';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID' | 'CREDIT_NOTE';

export interface CreatePaymentOrderOptions {
  subscriptionId: string;
  userId: string;
  tenantId: string;
  planVersionId: string;
  gateway?: PaymentGateway;
  couponCode?: string;
  billingState?: string;
  billingGstin?: string;
  metadata?: Record<string, any>;
}

export interface PaymentOrderResult {
  success: boolean;
  orderId?: string;
  gatewayOrderId?: string;
  paymentId?: string;
  amount: number;
  baseAmount: number;
  discountAmount: number;
  gstBreakdown: GSTBreakdown;
  couponApplied?: string;
  gatewayConfig?: {
    keyId: string;
    amount: number;
    currency: string;
    orderId: string;
    name: string;
    description: string;
    prefill?: Record<string, string>;
    notes?: Record<string, string>;
  };
  error?: string;
}

export interface PaymentVerifyOptions {
  paymentId: string;
  gatewayPaymentId: string;
  gatewayOrderId: string;
  gatewaySignature: string;
  gateway?: PaymentGateway;
}

export interface CouponValidation {
  valid: boolean;
  couponId?: string;
  code?: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  maxDiscountAmount?: number;
  calculatedDiscount?: number;
  error?: string;
}

// ========== COMPANY CONFIGURATION ==========

// These should come from database/config in production
const COMPANY_CONFIG = {
  name: 'BoxCostPro',
  gstin: '27XXXXX0000X1ZX', // Maharashtra GSTIN
  stateCode: '27', // Maharashtra
  address: 'Mumbai, Maharashtra, India',
  sacCode: '998314', // SaaS HSN/SAC code
};

const INVOICE_PREFIX = 'INV';
const CREDIT_NOTE_PREFIX = 'CN';

// ========== COUPON FUNCTIONS ==========

/**
 * Validate a coupon code for a specific user and plan
 */
export async function validateCoupon(
  code: string,
  userId: string,
  planId: string,
  amount: number
): Promise<CouponValidation> {
  try {
    const now = new Date();
    
    // Find the coupon
    const [coupon] = await db
      .select()
      .from(subscriptionCoupons)
      .where(
        and(
          eq(subscriptionCoupons.code, code.toUpperCase()),
          eq(subscriptionCoupons.status, 'ACTIVE')
        )
      )
      .limit(1);

    if (!coupon) {
      return { valid: false, error: 'Coupon not found or inactive' };
    }

    // Check validity period
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check max uses
    if (coupon.maxUses && (coupon.currentUses ?? 0) >= coupon.maxUses) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // Check per-user limit
    if (coupon.maxUsesPerUser) {
      const userUsageCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsages)
        .where(
          and(
            eq(couponUsages.couponId, coupon.id),
            eq(couponUsages.userId, userId)
          )
        );
      
      if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
        return { valid: false, error: 'You have already used this coupon' };
      }
    }

    // Check minimum amount
    if (coupon.minAmount && amount < coupon.minAmount) {
      return { valid: false, error: `Minimum order amount is ₹${coupon.minAmount}` };
    }

    // Check applicable plans
    if (coupon.applicablePlans) {
      const applicablePlans = coupon.applicablePlans as string[];
      if (Array.isArray(applicablePlans) && applicablePlans.length > 0) {
        if (!applicablePlans.includes(planId)) {
          return { valid: false, error: 'Coupon not applicable to this plan' };
        }
      }
    }

    // Check first subscription only
    if (coupon.firstSubscriptionOnly) {
      const existingSubscription = await db
        .select({ id: userSubscriptions.id })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
      
      if (existingSubscription.length > 0) {
        return { valid: false, error: 'Coupon is for first subscription only' };
      }
    }

    // Calculate discount
    let calculatedDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscount = (amount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
      }
    } else {
      calculatedDiscount = coupon.discountValue;
    }
    calculatedDiscount = Math.min(calculatedDiscount, amount);
    calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT',
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount ?? undefined,
      calculatedDiscount,
    };
  } catch (error) {
    console.error('[Billing] Coupon validation error:', error);
    return { valid: false, error: 'Failed to validate coupon' };
  }
}

/**
 * Record coupon usage after successful payment
 */
async function recordCouponUsage(
  couponId: string,
  userId: string,
  subscriptionId: string,
  paymentId: string,
  discountApplied: number
): Promise<void> {
  await db.insert(couponUsages).values({
    couponId,
    userId,
    subscriptionId,
    paymentId,
    discountApplied,
  });

  // Increment coupon usage counter
  await db
    .update(subscriptionCoupons)
    .set({
      currentUses: sql`COALESCE(current_uses, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionCoupons.id, couponId));
}

// ========== PAYMENT ORDER FUNCTIONS ==========

/**
 * Create a payment order for subscription payment
 */
export async function createPaymentOrder(
  options: CreatePaymentOrderOptions
): Promise<PaymentOrderResult> {
  const { 
    subscriptionId, 
    userId, 
    tenantId, 
    planVersionId, 
    gateway = 'RAZORPAY',
    couponCode,
    billingState,
    billingGstin,
    metadata = {},
  } = options;

  try {
    // Get plan version details
    const [planVersion] = await db
      .select({
        id: planVersions.id,
        planId: planVersions.planId,
        price: planVersions.price,
        billingCycle: planVersions.billingCycle,
        gstRate: planVersions.gstRate,
      })
      .from(planVersions)
      .where(eq(planVersions.id, planVersionId))
      .limit(1);

    if (!planVersion) {
      return { success: false, error: 'Plan version not found', amount: 0, baseAmount: 0, discountAmount: 0, gstBreakdown: {} as GSTBreakdown };
    }

    // Get plan details
    const [plan] = await db
      .select({ name: subscriptionPlans.name, code: subscriptionPlans.code })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planVersion.planId))
      .limit(1);

    if (!plan) {
      return { success: false, error: 'Plan not found', amount: 0, baseAmount: 0, discountAmount: 0, gstBreakdown: {} as GSTBreakdown };
    }

    const baseAmount = planVersion.price;
    let discountAmount = 0;
    let couponApplied: string | undefined;
    let couponId: string | undefined;

    // Validate coupon if provided
    if (couponCode) {
      const couponValidation = await validateCoupon(couponCode, userId, planVersion.planId, baseAmount);
      if (!couponValidation.valid) {
        return { 
          success: false, 
          error: couponValidation.error, 
          amount: 0, 
          baseAmount, 
          discountAmount: 0, 
          gstBreakdown: {} as GSTBreakdown 
        };
      }
      discountAmount = couponValidation.calculatedDiscount ?? 0;
      couponApplied = couponValidation.code;
      couponId = couponValidation.couponId;
    }

    // Extract state code from GSTIN if provided, or use provided billing state
    let buyerStateCode = billingState ?? null;
    if (billingGstin && billingGstin.length >= 2) {
      buyerStateCode = billingGstin.substring(0, 2);
    }

    // Calculate GST
    const gstBreakdown = calculateGST(
      baseAmount,
      COMPANY_CONFIG.stateCode,
      buyerStateCode,
      discountAmount
    );

    const totalAmount = gstBreakdown.grandTotal;

    // Create payment record
    const [payment] = await db
      .insert(subscriptionPayments)
      .values({
        subscriptionId,
        tenantId,
        userId,
        amount: totalAmount,
        baseAmount,
        gstAmount: gstBreakdown.totalTax,
        gstRate: gstBreakdown.igstRate > 0 ? gstBreakdown.igstRate : gstBreakdown.cgstRate + gstBreakdown.sgstRate,
        currency: 'INR',
        status: 'PENDING',
        paymentType: 'SUBSCRIPTION',
        gateway: gateway.toLowerCase(),
      })
      .returning({ id: subscriptionPayments.id });

    if (!payment) {
      return { success: false, error: 'Failed to create payment record', amount: 0, baseAmount, discountAmount, gstBreakdown };
    }

    // Create gateway-specific order
    if (gateway === 'RAZORPAY') {
      if (!isRazorpayInitialized()) {
        return { success: false, error: 'Payment gateway not configured', amount: 0, baseAmount, discountAmount, gstBreakdown };
      }

      try {
        const razorpayOrder = await createRazorpayOrder(
          rupeesToPaise(totalAmount),
          'INR',
          `sub_${subscriptionId}_${Date.now()}`,
          {
            subscriptionId,
            paymentId: payment.id,
            planCode: plan.code,
            userId,
            ...(couponId && { couponId }),
          }
        );

        // Update payment with gateway order ID
        await db
          .update(subscriptionPayments)
          .set({
            gatewayOrderId: razorpayOrder.id,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, payment.id));

        return {
          success: true,
          orderId: razorpayOrder.id,
          gatewayOrderId: razorpayOrder.id,
          paymentId: payment.id,
          amount: totalAmount,
          baseAmount,
          discountAmount,
          gstBreakdown,
          couponApplied,
          gatewayConfig: {
            keyId: process.env.RAZORPAY_KEY_ID || '',
            amount: rupeesToPaise(totalAmount),
            currency: 'INR',
            orderId: razorpayOrder.id,
            name: COMPANY_CONFIG.name,
            description: `${plan.name} - ${planVersion.billingCycle}`,
            notes: {
              subscriptionId,
              paymentId: payment.id,
              planCode: plan.code,
            },
          },
        };
      } catch (gatewayError: any) {
        // Update payment as failed
        await db
          .update(subscriptionPayments)
          .set({
            status: 'FAILED',
            failureReason: gatewayError.message,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, payment.id));

        return { 
          success: false, 
          error: `Gateway error: ${gatewayError.message}`, 
          amount: 0, 
          baseAmount, 
          discountAmount, 
          gstBreakdown 
        };
      }
    }

    // For other gateways, return payment details for manual handling
    return {
      success: true,
      paymentId: payment.id,
      amount: totalAmount,
      baseAmount,
      discountAmount,
      gstBreakdown,
      couponApplied,
    };
  } catch (error: any) {
    console.error('[Billing] Payment order creation error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create payment order', 
      amount: 0, 
      baseAmount: 0, 
      discountAmount: 0, 
      gstBreakdown: {} as GSTBreakdown 
    };
  }
}

/**
 * Verify and complete a payment
 */
export async function verifyAndCompletePayment(
  options: PaymentVerifyOptions
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const { paymentId, gatewayPaymentId, gatewayOrderId, gatewaySignature, gateway = 'RAZORPAY' } = options;

  try {
    // Get payment record
    const [payment] = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return { success: false, error: 'Payment record not found' };
    }

    if (payment.status === 'COMPLETED') {
      return { success: true, invoiceId: payment.invoiceId ?? undefined };
    }

    // Verify gateway signature
    if (gateway === 'RAZORPAY') {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return { success: false, error: 'Gateway configuration error' };
      }

      const isValid = verifyRazorpaySignature(
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        keySecret
      );

      if (!isValid) {
        // Update payment as failed
        await db
          .update(subscriptionPayments)
          .set({
            status: 'FAILED',
            failureReason: 'Signature verification failed',
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, paymentId));

        return { success: false, error: 'Payment verification failed - invalid signature' };
      }

      // Fetch payment details from gateway
      try {
        const gatewayPayment = await fetchPaymentDetails(gatewayPaymentId);
        
        // Update payment with gateway response
        await db
          .update(subscriptionPayments)
          .set({
            gatewayPaymentId,
            gatewayOrderId,
            gatewaySignature,
            gatewayResponse: gatewayPayment,
            status: 'COMPLETED',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, paymentId));
      } catch (fetchError) {
        console.warn('[Billing] Could not fetch gateway payment details:', fetchError);
        
        // Still mark as complete since signature is valid
        await db
          .update(subscriptionPayments)
          .set({
            gatewayPaymentId,
            gatewayOrderId,
            gatewaySignature,
            status: 'COMPLETED',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPayments.id, paymentId));
      }
    }

    // Generate invoice
    const invoiceResult = await generateInvoice(paymentId);
    
    // Activate subscription if pending
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, payment.subscriptionId))
      .limit(1);

    if (subscription && subscription.status === 'PENDING_PAYMENT') {
      await activateSubscription(
        payment.subscriptionId,
        gatewayPaymentId,
        undefined,
        'SYSTEM'
      );
    } else if (subscription && subscription.status === 'ACTIVE') {
      // This might be a renewal payment
      const [planVersion] = await db
        .select({ billingCycle: planVersions.billingCycle })
        .from(planVersions)
        .where(eq(planVersions.id, subscription.planVersionId ?? ''))
        .limit(1);

      if (planVersion) {
        await renewSubscription(
          payment.subscriptionId,
          planVersion.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
          paymentId,
          'SYSTEM'
        );
      }
    }

    // Log audit
    await db.insert(subscriptionAuditLogs).values({
      subscriptionId: payment.subscriptionId,
      action: 'PAYMENT_COMPLETED',
      afterSnapshot: {
        paymentId,
        gatewayPaymentId,
        amount: payment.amount,
        invoiceId: invoiceResult.invoiceId,
      },
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
    });

    return { 
      success: true, 
      invoiceId: invoiceResult.invoiceId 
    };
  } catch (error: any) {
    console.error('[Billing] Payment verification error:', error);
    return { success: false, error: error.message || 'Payment verification failed' };
  }
}

/**
 * Handle payment failure
 */
export async function handlePaymentFailure(
  paymentId: string,
  reason: string,
  shouldRetry: boolean = true
): Promise<void> {
  const [payment] = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.id, paymentId))
    .limit(1);

  if (!payment) return;

  const retryCount = (payment.retryCount ?? 0) + 1;
  const maxRetries = 3;
  
  // Calculate next retry time with exponential backoff
  // 1st retry: 1 hour, 2nd: 4 hours, 3rd: 24 hours
  const retryDelayHours = Math.pow(2, retryCount) * 0.5;
  const nextRetryAt = shouldRetry && retryCount < maxRetries 
    ? new Date(Date.now() + retryDelayHours * 60 * 60 * 1000)
    : null;

  await db
    .update(subscriptionPayments)
    .set({
      status: 'FAILED',
      failureReason: reason,
      retryCount,
      nextRetryAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionPayments.id, paymentId));

  // Mark subscription as past due after max retries
  if (retryCount >= maxRetries) {
    await markPastDue(payment.subscriptionId, 'SYSTEM');
  }

  // Log audit
  await db.insert(subscriptionAuditLogs).values({
    subscriptionId: payment.subscriptionId,
    action: 'PAYMENT_FAILED',
    afterSnapshot: {
      paymentId,
      reason,
      retryCount,
      nextRetryAt,
    },
    actorId: 'SYSTEM',
    actorType: 'SYSTEM',
  });
}

// ========== INVOICE FUNCTIONS ==========

/**
 * Generate next invoice number
 */
async function generateInvoiceNumber(isCredit: boolean = false): Promise<string> {
  const prefix = isCredit ? CREDIT_NOTE_PREFIX : INVOICE_PREFIX;
  const financialYear = getFinancialYear();
  
  // Get last invoice number for this FY
  const [lastInvoice] = await db
    .select({ invoiceNumber: subscriptionInvoices.invoiceNumber })
    .from(subscriptionInvoices)
    .where(sql`invoice_number LIKE ${`${prefix}-${financialYear}-%`}`)
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(1);

  let nextNumber = 1;
  if (lastInvoice?.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    const lastNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}-${financialYear}-${String(nextNumber).padStart(6, '0')}`;
}

function getFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  // Financial year in India is April to March
  if (month >= 3) { // April onwards
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

/**
 * Convert amount to words (Indian numbering system)
 */
function amountToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const convertToWords = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertToWords(n % 100) : '');
    if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
    if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
    return convertToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
  };

  let words = convertToWords(rupees) + ' Rupees';
  if (paise > 0) {
    words += ' and ' + convertToWords(paise) + ' Paise';
  }
  return words + ' Only';
}

/**
 * Generate invoice for a completed payment
 */
export async function generateInvoice(
  paymentId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    // Get payment details
    const [payment] = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    // Check if invoice already exists
    if (payment.invoiceId) {
      return { success: true, invoiceId: payment.invoiceId };
    }

    // Get subscription details
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, payment.subscriptionId))
      .limit(1);

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Get plan version details
    const [planVersion] = await db
      .select({
        id: planVersions.id,
        planId: planVersions.planId,
        version: planVersions.version,
        billingCycle: planVersions.billingCycle,
      })
      .from(planVersions)
      .where(eq(planVersions.id, subscription.planVersionId ?? ''))
      .limit(1);

    // Get plan details
    let planName = 'Subscription';
    let planCode = 'SUB';
    if (planVersion) {
      const [plan] = await db
        .select({ name: subscriptionPlans.name, code: subscriptionPlans.code })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planVersion.planId))
        .limit(1);
      
      if (plan) {
        planName = plan.name;
        planCode = plan.code;
      }
    }

    // Calculate GST breakdown (reconstruct from payment data)
    const baseAmount = payment.baseAmount;
    const gstAmount = payment.gstAmount ?? 0;
    const gstRate = payment.gstRate ?? 18;
    
    // Determine if IGST or CGST/SGST based on rate
    // This is a simplification - in production, store the breakdown in payment record
    const isIgst = true; // Default to IGST for SaaS
    
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice
    const [invoice] = await db
      .insert(subscriptionInvoices)
      .values({
        invoiceNumber,
        subscriptionId: payment.subscriptionId,
        paymentId: payment.id,
        tenantId: payment.tenantId,
        userId: payment.userId,
        
        // Billing details (should come from user profile in production)
        billingName: 'Customer', // TODO: Get from user profile
        billingEmail: '', // TODO: Get from user profile
        billingCountry: 'India',
        
        // Company details
        companyName: COMPANY_CONFIG.name,
        companyGstin: COMPANY_CONFIG.gstin,
        companyAddress: COMPANY_CONFIG.address,
        companyState: 'Maharashtra',
        
        // Plan details
        planName,
        planCode,
        planVersion: planVersion?.version ?? 1,
        billingCycle: planVersion?.billingCycle ?? 'MONTHLY',
        periodStart: subscription.startDate ?? new Date(),
        periodEnd: subscription.endDate ?? new Date(),
        
        // Amounts
        baseAmount,
        discountAmount: 0, // TODO: Get from coupon usage if any
        taxableAmount: baseAmount,
        
        // GST breakdown
        isIgst,
        cgstRate: isIgst ? null : gstRate / 2,
        cgstAmount: isIgst ? null : gstAmount / 2,
        sgstRate: isIgst ? null : gstRate / 2,
        sgstAmount: isIgst ? null : gstAmount / 2,
        igstRate: isIgst ? gstRate : null,
        igstAmount: isIgst ? gstAmount : null,
        totalGst: gstAmount,
        
        totalAmount: payment.amount,
        amountInWords: amountToWords(payment.amount),
        currency: payment.currency,
        
        status: 'PAID',
        issuedAt: new Date(),
        paidAt: payment.paidAt ?? new Date(),
      })
      .returning({ id: subscriptionInvoices.id });

    if (!invoice) {
      return { success: false, error: 'Failed to create invoice' };
    }

    // Update payment with invoice ID
    await db
      .update(subscriptionPayments)
      .set({
        invoiceId: invoice.id,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPayments.id, paymentId));

    return { success: true, invoiceId: invoice.id };
  } catch (error: any) {
    console.error('[Billing] Invoice generation error:', error);
    return { success: false, error: error.message || 'Failed to generate invoice' };
  }
}

/**
 * Create a credit note for refund
 */
export async function createCreditNote(
  originalInvoiceId: string,
  reason: string,
  amount?: number,
  actorId?: string
): Promise<{ success: boolean; creditNoteId?: string; error?: string }> {
  try {
    // Get original invoice
    const [originalInvoice] = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.id, originalInvoiceId))
      .limit(1);

    if (!originalInvoice) {
      return { success: false, error: 'Original invoice not found' };
    }

    if (originalInvoice.status === 'VOID') {
      return { success: false, error: 'Cannot create credit note for voided invoice' };
    }

    const creditAmount = amount ?? originalInvoice.totalAmount;
    if (creditAmount > originalInvoice.totalAmount) {
      return { success: false, error: 'Credit amount exceeds invoice amount' };
    }

    // Calculate proportional GST
    const ratio = creditAmount / originalInvoice.totalAmount;
    
    const creditNoteNumber = await generateInvoiceNumber(true);

    const [creditNote] = await db
      .insert(subscriptionInvoices)
      .values({
        invoiceNumber: creditNoteNumber,
        subscriptionId: originalInvoice.subscriptionId,
        paymentId: originalInvoice.paymentId,
        tenantId: originalInvoice.tenantId,
        userId: originalInvoice.userId,
        
        billingName: originalInvoice.billingName,
        billingEmail: originalInvoice.billingEmail,
        billingAddress: originalInvoice.billingAddress,
        billingCity: originalInvoice.billingCity,
        billingState: originalInvoice.billingState,
        billingCountry: originalInvoice.billingCountry,
        billingPincode: originalInvoice.billingPincode,
        billingGstin: originalInvoice.billingGstin,
        
        companyName: originalInvoice.companyName,
        companyGstin: originalInvoice.companyGstin,
        companyAddress: originalInvoice.companyAddress,
        companyState: originalInvoice.companyState,
        
        planName: originalInvoice.planName,
        planCode: originalInvoice.planCode,
        planVersion: originalInvoice.planVersion,
        billingCycle: originalInvoice.billingCycle,
        periodStart: originalInvoice.periodStart,
        periodEnd: originalInvoice.periodEnd,
        
        baseAmount: originalInvoice.baseAmount * ratio * -1,
        discountAmount: (originalInvoice.discountAmount ?? 0) * ratio,
        taxableAmount: originalInvoice.taxableAmount * ratio * -1,
        
        isIgst: originalInvoice.isIgst,
        cgstRate: originalInvoice.cgstRate,
        cgstAmount: originalInvoice.cgstAmount ? originalInvoice.cgstAmount * ratio * -1 : null,
        sgstRate: originalInvoice.sgstRate,
        sgstAmount: originalInvoice.sgstAmount ? originalInvoice.sgstAmount * ratio * -1 : null,
        igstRate: originalInvoice.igstRate,
        igstAmount: originalInvoice.igstAmount ? originalInvoice.igstAmount * ratio * -1 : null,
        totalGst: originalInvoice.totalGst * ratio * -1,
        
        totalAmount: creditAmount * -1,
        amountInWords: amountToWords(creditAmount) + ' (Credit)',
        currency: originalInvoice.currency,
        
        status: 'CREDIT_NOTE',
        issuedAt: new Date(),
        
        originalInvoiceId,
        creditNoteReason: reason,
      })
      .returning({ id: subscriptionInvoices.id });

    if (!creditNote) {
      return { success: false, error: 'Failed to create credit note' };
    }

    // Log audit
    await db.insert(subscriptionAuditLogs).values({
      subscriptionId: originalInvoice.subscriptionId,
      action: 'CREDIT_NOTE_ISSUED',
      afterSnapshot: {
        creditNoteId: creditNote.id,
        creditNoteNumber,
        originalInvoiceId,
        amount: creditAmount,
        reason,
      },
      actorId,
      actorType: actorId ? 'USER' : 'SYSTEM',
    });

    return { success: true, creditNoteId: creditNote.id };
  } catch (error: any) {
    console.error('[Billing] Credit note creation error:', error);
    return { success: false, error: error.message || 'Failed to create credit note' };
  }
}

// ========== QUERY FUNCTIONS ==========

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.id, invoiceId))
    .limit(1);
  
  return invoice;
}

/**
 * Get invoice by number
 */
export async function getInvoiceByNumber(invoiceNumber: string) {
  const [invoice] = await db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.invoiceNumber, invoiceNumber))
    .limit(1);
  
  return invoice;
}

/**
 * Get user invoices
 */
export async function getUserInvoices(userId: string, limit: number = 50) {
  return db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.userId, userId))
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(limit);
}

/**
 * Get tenant invoices
 */
export async function getTenantInvoices(tenantId: string, limit: number = 50) {
  return db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.tenantId, tenantId))
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(limit);
}

/**
 * Get payment by ID
 */
export async function getPayment(paymentId: string) {
  const [payment] = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.id, paymentId))
    .limit(1);
  
  return payment;
}

/**
 * Get subscription payments
 */
export async function getSubscriptionPayments(subscriptionId: string) {
  return db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionPayments.createdAt));
}

/**
 * Get payments due for retry
 */
export async function getPaymentsDueForRetry() {
  const now = new Date();
  
  return db
    .select()
    .from(subscriptionPayments)
    .where(
      and(
        eq(subscriptionPayments.status, 'FAILED'),
        lte(subscriptionPayments.nextRetryAt, now)
      )
    )
    .orderBy(subscriptionPayments.nextRetryAt);
}

/**
 * Get revenue stats for a period
 */
export async function getRevenueStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalRevenue: number;
  totalGst: number;
  invoiceCount: number;
  averageOrderValue: number;
  byPlan: Array<{ planCode: string; revenue: number; count: number }>;
}> {
  const invoices = await db
    .select()
    .from(subscriptionInvoices)
    .where(
      and(
        gte(subscriptionInvoices.paidAt, startDate),
        lte(subscriptionInvoices.paidAt, endDate),
        eq(subscriptionInvoices.status, 'PAID')
      )
    );

  const byPlanMap = new Map<string, { revenue: number; count: number }>();
  let totalRevenue = 0;
  let totalGst = 0;

  for (const invoice of invoices) {
    totalRevenue += invoice.totalAmount;
    totalGst += invoice.totalGst;

    const existing = byPlanMap.get(invoice.planCode) || { revenue: 0, count: 0 };
    existing.revenue += invoice.totalAmount;
    existing.count += 1;
    byPlanMap.set(invoice.planCode, existing);
  }

  return {
    totalRevenue,
    totalGst,
    invoiceCount: invoices.length,
    averageOrderValue: invoices.length > 0 ? totalRevenue / invoices.length : 0,
    byPlan: Array.from(byPlanMap.entries()).map(([planCode, data]) => ({
      planCode,
      ...data,
    })),
  };
}

// ========== COUPON MANAGEMENT ==========

/**
 * Create a new coupon
 */
export async function createCoupon(data: {
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  maxUsesPerUser?: number;
  validFrom?: Date;
  validUntil?: Date;
  applicablePlans?: string[];
  minAmount?: number;
  firstSubscriptionOnly?: boolean;
  createdBy?: string;
}): Promise<{ success: boolean; couponId?: string; error?: string }> {
  try {
    // Check if code already exists
    const existing = await db
      .select({ id: subscriptionCoupons.id })
      .from(subscriptionCoupons)
      .where(eq(subscriptionCoupons.code, data.code.toUpperCase()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Coupon code already exists' };
    }

    const [coupon] = await db
      .insert(subscriptionCoupons)
      .values({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.maxDiscountAmount,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser ?? 1,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        applicablePlans: data.applicablePlans,
        minAmount: data.minAmount,
        firstSubscriptionOnly: data.firstSubscriptionOnly ?? false,
        status: 'ACTIVE',
        createdBy: data.createdBy,
      })
      .returning({ id: subscriptionCoupons.id });

    return { success: true, couponId: coupon?.id };
  } catch (error: any) {
    console.error('[Billing] Coupon creation error:', error);
    return { success: false, error: error.message || 'Failed to create coupon' };
  }
}

/**
 * Deactivate a coupon
 */
export async function deactivateCoupon(couponId: string): Promise<void> {
  await db
    .update(subscriptionCoupons)
    .set({
      status: 'INACTIVE',
      updatedAt: new Date(),
    })
    .where(eq(subscriptionCoupons.id, couponId));
}

/**
 * Get active coupons
 */
export async function getActiveCoupons() {
  const now = new Date();
  
  return db
    .select()
    .from(subscriptionCoupons)
    .where(
      and(
        eq(subscriptionCoupons.status, 'ACTIVE'),
        or(
          isNull(subscriptionCoupons.validFrom),
          lte(subscriptionCoupons.validFrom, now)
        ),
        or(
          isNull(subscriptionCoupons.validUntil),
          gte(subscriptionCoupons.validUntil, now)
        )
      )
    );
}

/**
 * Get coupon usage analytics
 */
export async function getCouponUsageAnalytics(couponId: string) {
  const usages = await db
    .select()
    .from(couponUsages)
    .where(eq(couponUsages.couponId, couponId));

  const totalDiscountGiven = usages.reduce((sum, u) => sum + u.discountApplied, 0);
  const uniqueUsers = new Set(usages.map(u => u.userId)).size;

  return {
    totalUsages: usages.length,
    uniqueUsers,
    totalDiscountGiven,
    averageDiscount: usages.length > 0 ? totalDiscountGiven / usages.length : 0,
  };
}

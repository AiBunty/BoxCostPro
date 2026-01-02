/**
 * Razorpay Payment Gateway Integration Service
 *
 * Handles payment order creation, signature verification, and payment fetching
 *
 * Documentation: https://razorpay.com/docs/api/
 *
 * Setup:
 * 1. Create Razorpay account: https://dashboard.razorpay.com/signup
 * 2. Get API credentials from Settings → API Keys
 * 3. Add to .env:
 *    RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
 *    RAZORPAY_KEY_SECRET=xxxxxxxxxxxxx
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;

/**
 * Initialize Razorpay SDK with API credentials
 *
 * @param keyId - Razorpay Key ID (starts with rzp_test_ or rzp_live_)
 * @param keySecret - Razorpay Key Secret
 */
export function initializeRazorpay(keyId: string, keySecret: string): void {
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Create a Razorpay order for payment
 *
 * @param amount - Amount in paise (₹999 = 99900 paise)
 * @param currency - Currency code (default: INR)
 * @param receipt - Unique receipt ID for tracking
 * @param notes - Additional metadata (max 15 key-value pairs)
 * @returns Razorpay order object
 *
 * @example
 * const order = await createRazorpayOrder(99900, 'INR', 'signup_xyz_123', {
 *   planId: 'plan_abc',
 *   billingCycle: 'monthly',
 *   sessionToken: 'token_xyz',
 * });
 * // Returns: { id: 'order_abc', amount: 99900, currency: 'INR', ... }
 */
export async function createRazorpayOrder(
  amount: number,
  currency: string = 'INR',
  receipt: string,
  notes: Record<string, string> = {}
): Promise<any> {
  if (!razorpayInstance) {
    throw new Error('Razorpay not initialized. Call initializeRazorpay() first.');
  }

  const options = {
    amount, // Amount in paise
    currency,
    receipt,
    notes,
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error: any) {
    console.error('Razorpay order creation failed:', error);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
}

/**
 * Verify Razorpay payment signature (CRITICAL - prevents payment spoofing)
 *
 * Uses HMAC SHA256 to verify payment authenticity
 *
 * @param orderId - Razorpay order ID
 * @param paymentId - Razorpay payment ID
 * @param signature - Signature received from Razorpay webhook/frontend
 * @param keySecret - Razorpay Key Secret
 * @returns True if signature is valid
 *
 * @example
 * const isValid = verifyRazorpaySignature(
 *   'order_abc',
 *   'pay_xyz',
 *   'signature_from_razorpay',
 *   process.env.RAZORPAY_KEY_SECRET
 * );
 * if (!isValid) throw new Error('Payment verification failed');
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 *
 * @param paymentId - Razorpay payment ID
 * @returns Payment object with status, amount, method, etc.
 *
 * @example
 * const payment = await fetchPaymentDetails('pay_xyz');
 * console.log(payment.status); // 'captured', 'failed', 'pending'
 * console.log(payment.method); // 'card', 'upi', 'netbanking', etc.
 */
export async function fetchPaymentDetails(paymentId: string): Promise<any> {
  if (!razorpayInstance) {
    throw new Error('Razorpay not initialized. Call initializeRazorpay() first.');
  }

  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error: any) {
    console.error('Failed to fetch payment details:', error);
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
}

/**
 * Fetch order details from Razorpay
 *
 * @param orderId - Razorpay order ID
 * @returns Order object with status, amount, payments, etc.
 */
export async function fetchOrderDetails(orderId: string): Promise<any> {
  if (!razorpayInstance) {
    throw new Error('Razorpay not initialized. Call initializeRazorpay() first.');
  }

  try {
    const order = await razorpayInstance.orders.fetch(orderId);
    return order;
  } catch (error: any) {
    console.error('Failed to fetch order details:', error);
    throw new Error(`Failed to fetch order details: ${error.message}`);
  }
}

/**
 * Convert rupees to paise (Razorpay expects amounts in paise)
 *
 * @param rupees - Amount in rupees (e.g., 999)
 * @returns Amount in paise (e.g., 99900)
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise to rupees
 *
 * @param paise - Amount in paise (e.g., 99900)
 * @returns Amount in rupees (e.g., 999)
 */
export function paiseToRupees(paise: number): number {
  return Math.round((paise / 100) * 100) / 100;
}

/**
 * Check if Razorpay is initialized
 *
 * @returns True if Razorpay SDK is initialized
 */
export function isRazorpayInitialized(): boolean {
  return razorpayInstance !== null;
}

/**
 * Get Razorpay instance (for advanced usage)
 *
 * @returns Razorpay instance or null
 */
export function getRazorpayInstance(): Razorpay | null {
  return razorpayInstance;
}

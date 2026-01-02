/**
 * Payment Gateway Interface
 * Abstraction layer for multiple payment gateways
 */

export interface PaymentOrderRequest {
  amount: number;
  currency: string;
  userId: string;
  metadata?: {
    planId?: string;
    billingCycle?: string;
    couponCode?: string;
    email?: string;
    phone?: string;
    [key: string]: any;
  };
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  gatewayOrderId?: string;
  gatewayData?: any; // Gateway-specific data for frontend
  expiresAt?: Date;
}

export interface PaymentVerificationRequest {
  orderId: string;
  paymentId: string;
  signature?: string;
  gatewayResponse?: any;
}

export interface PaymentVerificationResponse {
  success: boolean;
  paymentId: string;
  orderId: string;
  amount?: number;
  status: 'success' | 'failed' | 'pending';
  gatewayStatus?: string;
  errorMessage?: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  orderId: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amount: number;
  currency: string;
  method?: string;
  createdAt: Date;
  capturedAt?: Date;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event: string;
  paymentId?: string;
  orderId?: string;
  status?: string;
  data?: any;
}

export interface GatewayConfig {
  keyId?: string;
  keySecret?: string;
  merchantId?: string;
  merchantKey?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  environment?: 'test' | 'production';
  [key: string]: any;
}

/**
 * Payment Gateway Interface
 * All payment gateway adapters must implement this interface
 */
export interface IPaymentGateway {
  readonly gatewayName: string;
  readonly gatewayType: 'razorpay' | 'phonepe' | 'payu' | 'cashfree' | 'ccavenue';
  readonly supportsUPI: boolean;
  readonly supportsInternational: boolean;
  readonly supportedCurrencies: string[];

  /**
   * Initialize gateway with configuration
   */
  initialize(config: GatewayConfig): Promise<void>;

  /**
   * Create a payment order
   */
  createOrder(request: PaymentOrderRequest): Promise<PaymentOrderResponse>;

  /**
   * Verify payment signature/callback
   */
  verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse>;

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Get order status
   */
  getOrderStatus(orderId: string): Promise<PaymentStatusResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: any, signature: string): Promise<WebhookVerificationResult>;

  /**
   * Refund a payment
   */
  refundPayment?(paymentId: string, amount?: number): Promise<{ refundId: string; status: string }>;

  /**
   * Test connection to gateway
   */
  testConnection(): Promise<{ success: boolean; message: string }>;
}

/**
 * Payment Gateway Health Status
 */
export interface GatewayHealthStatus {
  gatewayType: string;
  isHealthy: boolean;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  averageResponseTime?: number;
  errorMessage?: string;
}

/**
 * Gateway Selection Criteria
 */
export interface GatewaySelectionCriteria {
  preferUPI?: boolean;
  requireInternational?: boolean;
  currency?: string;
  amount?: number;
  excludeGateways?: string[];
}

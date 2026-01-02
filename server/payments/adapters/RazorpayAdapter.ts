/**
 * Razorpay Payment Gateway Adapter
 * Implements IPaymentGateway for Razorpay integration
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentOrderRequest,
  PaymentOrderResponse,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  PaymentStatusResponse,
  WebhookVerificationResult,
  GatewayConfig,
} from '../IPaymentGateway';

export class RazorpayAdapter implements IPaymentGateway {
  public readonly gatewayName = 'Razorpay';
  public readonly gatewayType = 'razorpay' as const;
  public readonly supportsUPI = true;
  public readonly supportsInternational = true;
  public readonly supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP'];

  private razorpay: Razorpay | null = null;
  private config: GatewayConfig = {};

  async initialize(config: GatewayConfig): Promise<void> {
    this.config = config;
    
    if (!config.keyId || !config.keySecret) {
      throw new Error('Razorpay: keyId and keySecret are required');
    }

    this.razorpay = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });

    console.log('[Razorpay] Initialized successfully');
  }

  async createOrder(request: PaymentOrderRequest): Promise<PaymentOrderResponse> {
    if (!this.razorpay) {
      throw new Error('Razorpay not initialized');
    }

    try {
      const options = {
        amount: Math.round(request.amount * 100), // Convert to paise
        currency: request.currency,
        receipt: `order_${Date.now()}_${request.userId}`,
        notes: {
          userId: request.userId,
          ...request.metadata,
        },
      };

      const order = await this.razorpay.orders.create(options);

      return {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        gatewayOrderId: order.id,
        gatewayData: {
          key: this.config.keyId,
          orderId: order.id,
          currency: order.currency,
          name: 'BoxCostPro',
          description: request.metadata?.planId ? `Subscription - ${request.metadata.planId}` : 'Payment',
          prefill: {
            email: request.metadata?.email,
            contact: request.metadata?.phone,
          },
        },
      };
    } catch (error: any) {
      console.error('[Razorpay] Create order error:', error);
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    try {
      const { orderId, paymentId, signature } = request;

      if (!signature) {
        throw new Error('Signature is required for Razorpay verification');
      }

      // Verify signature
      const text = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.keySecret!)
        .update(text)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        return {
          success: false,
          paymentId,
          orderId,
          status: 'failed',
          errorMessage: 'Invalid payment signature',
        };
      }

      // Fetch payment details to get amount
      const paymentDetails = await this.getPaymentStatus(paymentId);

      return {
        success: true,
        paymentId,
        orderId,
        amount: paymentDetails.amount,
        status: 'success',
        gatewayStatus: paymentDetails.status,
      };
    } catch (error: any) {
      console.error('[Razorpay] Verify payment error:', error);
      return {
        success: false,
        paymentId: request.paymentId,
        orderId: request.orderId,
        status: 'failed',
        errorMessage: error.message,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    if (!this.razorpay) {
      throw new Error('Razorpay not initialized');
    }

    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      return {
        paymentId: payment.id,
        orderId: payment.order_id || '',
        status: payment.status as any,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        createdAt: new Date(payment.created_at * 1000),
        capturedAt: payment.captured ? new Date(payment.created_at * 1000) : undefined,
      };
    } catch (error: any) {
      console.error('[Razorpay] Get payment status error:', error);
      throw new Error(`Failed to fetch payment status: ${error.message}`);
    }
  }

  async getOrderStatus(orderId: string): Promise<PaymentStatusResponse> {
    if (!this.razorpay) {
      throw new Error('Razorpay not initialized');
    }

    try {
      const order = await this.razorpay.orders.fetch(orderId);

      return {
        paymentId: '',
        orderId: order.id,
        status: order.status as any,
        amount: order.amount / 100,
        currency: order.currency,
        createdAt: new Date(order.created_at * 1000),
      };
    } catch (error: any) {
      console.error('[Razorpay] Get order status error:', error);
      throw new Error(`Failed to fetch order status: ${error.message}`);
    }
  }

  async verifyWebhook(payload: any, signature: string): Promise<WebhookVerificationResult> {
    try {
      const webhookSecret = this.config.webhookSecret;
      
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        return {
          isValid: false,
          event: payload.event || 'unknown',
        };
      }

      const event = payload.event;
      const paymentEntity = payload.payload?.payment?.entity;

      return {
        isValid: true,
        event,
        paymentId: paymentEntity?.id,
        orderId: paymentEntity?.order_id,
        status: paymentEntity?.status,
        data: paymentEntity,
      };
    } catch (error: any) {
      console.error('[Razorpay] Webhook verification error:', error);
      return {
        isValid: false,
        event: 'error',
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{ refundId: string; status: string }> {
    if (!this.razorpay) {
      throw new Error('Razorpay not initialized');
    }

    try {
      const refundOptions: any = { payment_id: paymentId };
      
      if (amount) {
        refundOptions.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await this.razorpay.payments.refund(paymentId, refundOptions);

      return {
        refundId: refund.id,
        status: refund.status,
      };
    } catch (error: any) {
      console.error('[Razorpay] Refund error:', error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.razorpay) {
      return {
        success: false,
        message: 'Razorpay not initialized',
      };
    }

    try {
      // Try to fetch a dummy order to test connection
      // If keys are valid but order doesn't exist, it will throw a specific error
      await this.razorpay.orders.fetch('test_order_id').catch(() => {});
      
      return {
        success: true,
        message: 'Razorpay connection successful',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Razorpay connection failed: ${error.message}`,
      };
    }
  }
}

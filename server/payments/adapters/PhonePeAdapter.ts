/**
 * PhonePe Payment Gateway Adapter
 * Implements IPaymentGateway for PhonePe PG integration
 * https://developer.phonepe.com/v1/docs/
 */

import crypto from 'crypto';
import axios from 'axios';
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

export class PhonePeAdapter implements IPaymentGateway {
  public readonly gatewayName = 'PhonePe';
  public readonly gatewayType = 'phonepe' as const;
  public readonly supportsUPI = true; // PhonePe has excellent UPI support
  public readonly supportsInternational = false;
  public readonly supportedCurrencies = ['INR'];

  private config: GatewayConfig = {};
  private apiUrl: string = '';

  async initialize(config: GatewayConfig): Promise<void> {
    this.config = config;

    if (!config.merchantId || !config.merchantKey) {
      throw new Error('PhonePe: merchantId and merchantKey are required');
    }

    // Set API URL based on environment
    this.apiUrl = config.environment === 'production'
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    console.log('[PhonePe] Initialized successfully');
  }

  async createOrder(request: PaymentOrderRequest): Promise<PaymentOrderResponse> {
    try {
      const transactionId = `TXN_${Date.now()}_${request.userId.substring(0, 8)}`;
      const orderId = `order_${Date.now()}`;

      const payload = {
        merchantId: this.config.merchantId,
        merchantTransactionId: transactionId,
        merchantUserId: request.userId,
        amount: Math.round(request.amount * 100), // Convert to paise
        redirectUrl: `${process.env.APP_URL || 'http://localhost:5000'}/api/payments/phonepe/callback`,
        redirectMode: 'POST',
        callbackUrl: `${process.env.APP_URL || 'http://localhost:5000'}/api/payments/phonepe/webhook`,
        mobileNumber: request.metadata?.phone,
        paymentInstrument: {
          type: 'PAY_PAGE', // Shows all payment options including UPI
        },
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const checksum = this.generateChecksum(base64Payload);

      const response = await axios.post(
        `${this.apiUrl}/pg/v1/pay`,
        {
          request: base64Payload,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'PhonePe order creation failed');
      }

      return {
        orderId,
        amount: request.amount,
        currency: request.currency,
        gatewayOrderId: transactionId,
        gatewayData: {
          merchantId: this.config.merchantId,
          transactionId,
          redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
          paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
        },
      };
    } catch (error: any) {
      console.error('[PhonePe] Create order error:', error);
      throw new Error(`PhonePe order creation failed: ${error.message}`);
    }
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    try {
      const { gatewayResponse } = request;
      
      if (!gatewayResponse) {
        throw new Error('Gateway response is required for PhonePe verification');
      }

      // PhonePe sends base64 encoded response
      const base64Response = gatewayResponse.response;
      const checksum = gatewayResponse.checksum;

      // Verify checksum
      const expectedChecksum = this.generateChecksum(base64Response);
      if (expectedChecksum !== checksum) {
        return {
          success: false,
          paymentId: '',
          orderId: request.orderId,
          status: 'failed',
          errorMessage: 'Invalid checksum',
        };
      }

      // Decode response
      const decodedResponse = JSON.parse(
        Buffer.from(base64Response, 'base64').toString('utf-8')
      );

      const isSuccess = decodedResponse.code === 'PAYMENT_SUCCESS';

      return {
        success: isSuccess,
        paymentId: decodedResponse.data.transactionId,
        orderId: request.orderId,
        amount: decodedResponse.data.amount / 100,
        status: isSuccess ? 'success' : 'failed',
        gatewayStatus: decodedResponse.code,
      };
    } catch (error: any) {
      console.error('[PhonePe] Verify payment error:', error);
      return {
        success: false,
        paymentId: request.paymentId,
        orderId: request.orderId,
        status: 'failed',
        errorMessage: error.message,
      };
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const checksum = this.generateChecksum(`/pg/v1/status/${this.config.merchantId}/${transactionId}`);

      const response = await axios.get(
        `${this.apiUrl}/pg/v1/status/${this.config.merchantId}/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': this.config.merchantId,
          },
        }
      );

      const data = response.data.data;

      return {
        paymentId: data.transactionId,
        orderId: data.merchantTransactionId,
        status: this.mapPhonePeStatus(data.state),
        amount: data.amount / 100,
        currency: 'INR',
        method: data.paymentInstrument?.type,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error('[PhonePe] Get payment status error:', error);
      throw new Error(`Failed to fetch payment status: ${error.message}`);
    }
  }

  async getOrderStatus(orderId: string): Promise<PaymentStatusResponse> {
    // PhonePe uses transaction ID, so this is similar to getPaymentStatus
    return this.getPaymentStatus(orderId);
  }

  async verifyWebhook(payload: any, signature: string): Promise<WebhookVerificationResult> {
    try {
      const base64Payload = payload.response;
      const expectedChecksum = this.generateChecksum(base64Payload);

      const isValid = expectedChecksum === signature;

      if (!isValid) {
        return {
          isValid: false,
          event: 'webhook_verification_failed',
        };
      }

      const decodedPayload = JSON.parse(
        Buffer.from(base64Payload, 'base64').toString('utf-8')
      );

      return {
        isValid: true,
        event: decodedPayload.code,
        paymentId: decodedPayload.data.transactionId,
        orderId: decodedPayload.data.merchantTransactionId,
        status: this.mapPhonePeStatus(decodedPayload.data.state),
        data: decodedPayload.data,
      };
    } catch (error: any) {
      console.error('[PhonePe] Webhook verification error:', error);
      return {
        isValid: false,
        event: 'error',
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test with a dummy status check
      const testTransactionId = 'test_' + Date.now();
      const checksum = this.generateChecksum(`/pg/v1/status/${this.config.merchantId}/${testTransactionId}`);

      await axios.get(
        `${this.apiUrl}/pg/v1/status/${this.config.merchantId}/${testTransactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': this.config.merchantId,
          },
        }
      ).catch(() => {
        // Expected to fail for test transaction, but validates auth
      });

      return {
        success: true,
        message: 'PhonePe connection successful',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `PhonePe connection failed: ${error.message}`,
      };
    }
  }

  private generateChecksum(data: string): string {
    const string = data + '/pg/v1/pay' + this.config.merchantKey;
    return crypto.createHash('sha256').update(string).digest('hex') + '###1';
  }

  private mapPhonePeStatus(state: string): 'created' | 'authorized' | 'captured' | 'refunded' | 'failed' {
    const statusMap: Record<string, any> = {
      'COMPLETED': 'captured',
      'PENDING': 'created',
      'FAILED': 'failed',
      'EXPIRED': 'failed',
    };

    return statusMap[state] || 'failed';
  }
}

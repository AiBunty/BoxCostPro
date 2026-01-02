/**
 * Payment Gateway Factory
 * Manages multiple payment gateways with auto-failover and priority-based selection
 */

import { IPaymentGateway, GatewaySelectionCriteria, PaymentOrderRequest, PaymentOrderResponse } from './IPaymentGateway';
import { RazorpayAdapter } from './adapters/RazorpayAdapter';
import { PhonePeAdapter } from './adapters/PhonePeAdapter';
import { storage } from '../storage';
import { captureException, addBreadcrumb, Sentry } from '../sentry';

export interface PaymentGatewayRecord {
  id: string;
  gatewayType: 'razorpay' | 'phonepe' | 'payu' | 'cashfree' | 'ccavenue';
  isActive: boolean;
  priority: number; // Lower number = higher priority
  credentials: any;
  webhookSecret?: string;
  environment: 'test' | 'production';
  consecutiveFailures: number;
  lastHealthCheck?: Date;
  lastFailureAt?: Date;
}

export class PaymentGatewayFactory {
  private gateways: Map<string, IPaymentGateway> = new Map();
  private gatewayConfigs: Map<string, PaymentGatewayRecord> = new Map();
  private initialized = false;

  /**
   * Initialize all active payment gateways from database
   */
  async initialize(): Promise<void> {
    try {
      console.log('[PaymentGatewayFactory] Initializing payment gateways...');

      // Fetch active gateways from database
      const activeGateways = await this.fetchActiveGateways();

      if (activeGateways.length === 0) {
        console.warn('[PaymentGatewayFactory] No active payment gateways configured');
        // Fallback to environment variables for Razorpay
        await this.initializeRazorpayFromEnv();
        return;
      }

      // Initialize each gateway
      for (const gatewayConfig of activeGateways) {
        try {
          await this.initializeGateway(gatewayConfig);
        } catch (error) {
          console.error(`[PaymentGatewayFactory] Failed to initialize ${gatewayConfig.gatewayType}:`, error);
        }
      }

      this.initialized = true;
      console.log(`[PaymentGatewayFactory] Initialized ${this.gateways.size} gateways`);
    } catch (error) {
      console.error('[PaymentGatewayFactory] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize a single gateway
   */
  private async initializeGateway(config: PaymentGatewayRecord): Promise<void> {
    let gateway: IPaymentGateway | null = null;

    switch (config.gatewayType) {
      case 'razorpay':
        gateway = new RazorpayAdapter();
        await gateway.initialize({
          keyId: config.credentials.keyId,
          keySecret: config.credentials.keySecret,
          webhookSecret: config.webhookSecret,
          environment: config.environment,
        });
        break;

      case 'phonepe':
        gateway = new PhonePeAdapter();
        await gateway.initialize({
          merchantId: config.credentials.merchantId,
          merchantKey: config.credentials.merchantKey,
          webhookSecret: config.webhookSecret,
          environment: config.environment,
        });
        break;

      // Add other gateways here
      default:
        console.warn(`[PaymentGatewayFactory] Unsupported gateway type: ${config.gatewayType}`);
        return;
    }

    if (gateway) {
      this.gateways.set(config.id, gateway);
      this.gatewayConfigs.set(config.id, config);
      console.log(`[PaymentGatewayFactory] ✓ ${config.gatewayType} initialized (priority: ${config.priority})`);
    }
  }

  /**
   * Fallback: Initialize Razorpay from environment variables
   */
  private async initializeRazorpayFromEnv(): Promise<void> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.warn('[PaymentGatewayFactory] No Razorpay credentials found in env');
      return;
    }

    const gateway = new RazorpayAdapter();
    await gateway.initialize({
      keyId,
      keySecret,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    });

    const defaultConfig: PaymentGatewayRecord = {
      id: 'razorpay-default',
      gatewayType: 'razorpay',
      isActive: true,
      priority: 1,
      credentials: { keyId, keySecret },
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
      consecutiveFailures: 0,
    };

    this.gateways.set('razorpay-default', gateway);
    this.gatewayConfigs.set('razorpay-default', defaultConfig);
    console.log('[PaymentGatewayFactory] ✓ Razorpay initialized from env (fallback mode)');
  }

  /**
   * Select best gateway based on criteria with auto-failover
   */
  async selectGateway(criteria: GatewaySelectionCriteria = {}): Promise<{
    gateway: IPaymentGateway;
    gatewayId: string;
    gatewayType: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.gateways.size === 0) {
      throw new Error('No payment gateways available');
    }

    // Sort gateways by priority
    const sortedGateways = Array.from(this.gatewayConfigs.entries())
      .filter(([id, config]) => {
        // Filter out unhealthy gateways (5+ consecutive failures)
        if (config.consecutiveFailures >= 5) {
          return false;
        }

        // Filter by criteria
        const gateway = this.gateways.get(id);
        if (!gateway) return false;

        if (criteria.preferUPI && !gateway.supportsUPI) {
          return false;
        }

        if (criteria.requireInternational && !gateway.supportsInternational) {
          return false;
        }

        if (criteria.currency && !gateway.supportedCurrencies.includes(criteria.currency)) {
          return false;
        }

        if (criteria.excludeGateways?.includes(config.gatewayType)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by priority (lower = higher priority)
        const priorityDiff = a[1].priority - b[1].priority;
        if (priorityDiff !== 0) return priorityDiff;

        // If UPI preference, prioritize PhonePe
        if (criteria.preferUPI) {
          const aGateway = this.gateways.get(a[0])!;
          const bGateway = this.gateways.get(b[0])!;
          
          if (aGateway.gatewayType === 'phonepe' && bGateway.gatewayType !== 'phonepe') {
            return -1;
          }
          if (bGateway.gatewayType === 'phonepe' && aGateway.gatewayType !== 'phonepe') {
            return 1;
          }
        }

        return 0;
      });

    if (sortedGateways.length === 0) {
      throw new Error('No suitable payment gateway found for criteria');
    }

    const [gatewayId, config] = sortedGateways[0];
    const gateway = this.gateways.get(gatewayId)!;

    console.log(`[PaymentGatewayFactory] Selected gateway: ${config.gatewayType} (priority: ${config.priority})`);

    return {
      gateway,
      gatewayId,
      gatewayType: config.gatewayType,
    };
  }

  /**
   * Create order with auto-failover
   */
  async createOrderWithFailover(
    request: PaymentOrderRequest,
    criteria: GatewaySelectionCriteria = {}
  ): Promise<PaymentOrderResponse & { gatewayId: string; gatewayType: string }> {
    const maxAttempts = 3;
    const excludedGateways: string[] = criteria.excludeGateways || [];

    // Add Sentry breadcrumb for payment attempt
    addBreadcrumb('Payment order creation started', 'payment', {
      amount: request.amount,
      currency: request.currency,
      orderId: request.orderId,
      preferUPI: criteria.preferUPI,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { gateway, gatewayId, gatewayType } = await this.selectGateway({
          ...criteria,
          excludeGateways: excludedGateways,
        });

        console.log(`[PaymentGatewayFactory] Attempt ${attempt}: Using ${gatewayType}`);

        // Track payment attempt in Sentry
        Sentry.withScope((scope) => {
          scope.setContext('payment', {
            attempt,
            gatewayType,
            gatewayId,
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId,
          });

          const orderResponse = await gateway.createOrder(request);

          // Reset failure count on success
          this.recordSuccess(gatewayId);

          addBreadcrumb('Payment order created successfully', 'payment', {
            gatewayType,
            paymentId: orderResponse.paymentId,
          });

          return {
            ...orderResponse,
            gatewayId,
            gatewayType,
          };
        });
      } catch (error: any) {
        console.error(`[PaymentGatewayFactory] Attempt ${attempt} failed:`, error.message);

        // Capture error in Sentry
        captureException(error, {
          payment: {
            attempt,
            amount: request.amount,
            currency: request.currency,
            orderId: request.orderId,
            errorMessage: error.message,
          },
        });

        // Get current gateway info before excluding
        const currentSelection = await this.selectGateway({
          ...criteria,
          excludeGateways: excludedGateways,
        }).catch(() => null);

        if (currentSelection) {
          // Record failure
          await this.recordFailure(currentSelection.gatewayId, error.message);

          // Add to excluded list for next attempt
          excludedGateways.push(currentSelection.gatewayType);

          // Send alert to admin
          await this.sendGatewayFailureAlert(currentSelection.gatewayType, error.message);
        }

        // If last attempt, throw error
        if (attempt === maxAttempts) {
          throw new Error(`All payment gateways failed. Last error: ${error.message}`);
        }
      }
    }

    throw new Error('Failed to create payment order after all attempts');
  }

  /**
   * Get gateway by ID
   */
  getGateway(gatewayId: string): IPaymentGateway | undefined {
    return this.gateways.get(gatewayId);
  }

  /**
   * Get all active gateways
   */
  getAllGateways(): Array<{ id: string; gateway: IPaymentGateway; config: PaymentGatewayRecord }> {
    return Array.from(this.gateways.entries()).map(([id, gateway]) => ({
      id,
      gateway,
      config: this.gatewayConfigs.get(id)!,
    }));
  }

  /**
   * Record successful transaction
   */
  private async recordSuccess(gatewayId: string): Promise<void> {
    const config = this.gatewayConfigs.get(gatewayId);
    if (config) {
      config.consecutiveFailures = 0;
      config.lastHealthCheck = new Date();
      // Update database
      await storage.updatePaymentGatewayHealth(config.id, true);
    }
  }

  /**
   * Record failed transaction
   */
  private async recordFailure(gatewayId: string, errorMessage: string): Promise<void> {
    const config = this.gatewayConfigs.get(gatewayId);
    if (config) {
      config.consecutiveFailures++;
      config.lastFailureAt = new Date();
      // Update database
      await storage.updatePaymentGatewayHealth(config.id, false, errorMessage);
    }
  }

  /**
   * Fetch active gateways from database
   */
  private async fetchActiveGateways(): Promise<PaymentGatewayRecord[]> {
    try {
      const gateways = await storage.getActivePaymentGateways();
      return gateways.map(g => ({
        id: g.id,
        gatewayType: g.gatewayType as any,
        isActive: g.isActive || false,
        priority: g.priority || 100,
        credentials: g.credentials as any,
        webhookSecret: g.webhookSecret || undefined,
        environment: (g.environment || 'test') as 'test' | 'production',
        consecutiveFailures: g.consecutiveFailures || 0,
        lastHealthCheck: g.lastHealthCheck || undefined,
        lastFailureAt: g.lastFailureAt || undefined,
      }));
    } catch (error) {
      console.error('[PaymentGatewayFactory] Failed to fetch gateways from database:', error);
      return [];
    }
  }

  /**
   * Send alert to admin about gateway failure
   */
  private async sendGatewayFailureAlert(gatewayType: string, errorMessage: string): Promise<void> {
    // TODO: Implement admin notification (email/Slack/webhook)
    console.error(`[ALERT] Payment gateway ${gatewayType} failed: ${errorMessage}`);
  }
}

// Singleton instance
export const paymentGatewayFactory = new PaymentGatewayFactory();

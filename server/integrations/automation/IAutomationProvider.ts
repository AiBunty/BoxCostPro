/**
 * Automation Provider Interface
 * 
 * Defines the contract for automation/workflow platforms (n8n, Zapier, etc.)
 * Supports webhook publishing, trigger registration, and execution tracking
 */

/**
 * Automation provider codes
 */
export type AutomationProviderCode = 'n8n' | 'zapier' | 'make' | 'pabbly';

/**
 * Event types that can trigger automations
 */
export type AutomationEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.escalated'
  | 'ticket.resolved'
  | 'ticket.sla_breached'
  | 'message.received'
  | 'message.sent'
  | 'payment.completed'
  | 'payment.failed'
  | 'invoice.created'
  | 'invoice.sent'
  | 'user.registered'
  | 'user.subscription_changed'
  | 'ai.draft_generated'
  | 'ai.escalation_recommended';

/**
 * Webhook delivery request
 */
export interface WebhookDeliveryRequest {
  webhookUrl: string;
  event: AutomationEventType;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  duration: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  id: string;
  name: string;
  event: AutomationEventType;
  webhookUrl: string;
  isActive: boolean;
  headers?: Record<string, string>;
  filters?: Record<string, any>;
  createdAt: Date;
}

/**
 * Automation health check result
 */
export interface AutomationHealthCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, any>;
}

/**
 * Provider configuration
 */
export interface AutomationProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
  webhookSecret?: string;
  tenantId?: number;
}

/**
 * Automation Provider Interface
 */
export interface IAutomationProvider {
  readonly providerCode: AutomationProviderCode;
  readonly providerName: string;
  
  /**
   * Initialize the provider with configuration
   */
  initialize(config: AutomationProviderConfig): Promise<void>;
  
  /**
   * Deliver a webhook payload
   */
  deliverWebhook(request: WebhookDeliveryRequest): Promise<WebhookDeliveryResult>;
  
  /**
   * Register a new workflow trigger
   */
  registerTrigger(trigger: Omit<WorkflowTrigger, 'id' | 'createdAt'>): Promise<WorkflowTrigger>;
  
  /**
   * Deactivate a workflow trigger
   */
  deactivateTrigger(triggerId: string): Promise<boolean>;
  
  /**
   * Test connectivity to the automation platform
   */
  testConnection(): Promise<AutomationHealthCheckResult>;
}

/**
 * Base class with common functionality
 */
export abstract class BaseAutomationProvider implements IAutomationProvider {
  abstract readonly providerCode: AutomationProviderCode;
  abstract readonly providerName: string;
  
  protected config: AutomationProviderConfig | null = null;
  protected isHealthy: boolean = true;
  protected lastHealthCheck: Date | null = null;
  
  abstract initialize(config: AutomationProviderConfig): Promise<void>;
  abstract registerTrigger(trigger: Omit<WorkflowTrigger, 'id' | 'createdAt'>): Promise<WorkflowTrigger>;
  abstract deactivateTrigger(triggerId: string): Promise<boolean>;
  abstract testConnection(): Promise<AutomationHealthCheckResult>;
  
  /**
   * Generic webhook delivery with retry logic
   */
  async deliverWebhook(request: WebhookDeliveryRequest): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const timeout = request.timeout || 30000;
    const maxRetries = request.retryCount || 3;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'BoxCostPro/1.0',
          'X-Webhook-Event': request.event,
          'X-Webhook-Timestamp': new Date().toISOString(),
          ...(request.headers || {}),
        };
        
        // Add signature if we have a secret
        if (this.config?.webhookSecret) {
          const crypto = await import('crypto');
          const signature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(JSON.stringify(request.payload))
            .digest('hex');
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }
        
        const response = await fetch(request.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(request.payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        let responseBody: any = null;
        
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text().catch(() => null);
        }
        
        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            responseBody,
            duration,
          };
        }
        
        // Non-retryable HTTP errors
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            success: false,
            statusCode: response.status,
            responseBody,
            duration,
            error: {
              code: `HTTP_${response.status}`,
              message: response.statusText,
              retryable: false,
            },
          };
        }
        
        // Retryable error - wait and retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Timeout or network error - retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error: {
        code: 'DELIVERY_FAILED',
        message: lastError?.message || 'Unknown error after max retries',
        retryable: true,
      },
    };
  }
  
  protected markHealthy(): void {
    this.isHealthy = true;
    this.lastHealthCheck = new Date();
  }
  
  protected markUnhealthy(): void {
    this.isHealthy = false;
    this.lastHealthCheck = new Date();
  }
}

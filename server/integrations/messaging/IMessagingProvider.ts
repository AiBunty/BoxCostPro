/**
 * Messaging Provider Interface
 * 
 * Enterprise-grade interface for WhatsApp and messaging provider adapters.
 * Supports: WABA (Meta Cloud API), WATI, Twilio WhatsApp
 * 
 * Use cases:
 * - Support ticket messages
 * - Payment confirmations
 * - SLA escalation alerts
 * - Admin notifications
 */

export type MessagingProviderCode = 'waba' | 'wati' | 'twilio-whatsapp' | 'interakt';

export interface MessagingProviderConfig {
  apiKey?: string;
  accessToken?: string;
  accountSid?: string;
  authToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  baseUrl?: string;
  webhookSecret?: string;
  timeout?: number;
}

export interface MessageRecipient {
  phoneNumber: string; // E.164 format: +919876543210
  name?: string;
}

export interface TextMessageRequest {
  recipient: MessageRecipient;
  text: string;
  previewUrl?: boolean;
}

export interface TemplateMessageRequest {
  recipient: MessageRecipient;
  templateName: string;
  templateLanguage?: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface MessageSendResult {
  success: boolean;
  messageId?: string;
  timestamp?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface WebhookPayload {
  provider: MessagingProviderCode;
  rawPayload: any;
  signature?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: 'message_received' | 'message_delivered' | 'message_read' | 'message_failed';
  messageId?: string;
  fromPhone?: string;
  toPhone?: string;
  text?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface MessagingHealthCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, any>;
}

export interface IMessagingProvider {
  readonly providerCode: MessagingProviderCode;
  readonly providerName: string;
  readonly supportsTemplates: boolean;
  readonly supportsMedia: boolean;
  
  initialize(config: MessagingProviderConfig): Promise<void>;
  sendTextMessage(request: TextMessageRequest): Promise<MessageSendResult>;
  sendTemplateMessage(request: TemplateMessageRequest): Promise<MessageSendResult>;
  verifyWebhook(payload: WebhookPayload): Promise<WebhookVerificationResult>;
  testConnection(): Promise<MessagingHealthCheckResult>;
  isHealthy(): boolean;
}

/**
 * Base class for messaging providers
 */
export abstract class BaseMessagingProvider implements IMessagingProvider {
  abstract readonly providerCode: MessagingProviderCode;
  abstract readonly providerName: string;
  abstract readonly supportsTemplates: boolean;
  abstract readonly supportsMedia: boolean;
  
  protected config: MessagingProviderConfig | null = null;
  protected _isHealthy: boolean = true;
  protected consecutiveFailures: number = 0;
  
  abstract initialize(config: MessagingProviderConfig): Promise<void>;
  abstract sendTextMessage(request: TextMessageRequest): Promise<MessageSendResult>;
  abstract sendTemplateMessage(request: TemplateMessageRequest): Promise<MessageSendResult>;
  abstract verifyWebhook(payload: WebhookPayload): Promise<WebhookVerificationResult>;
  abstract testConnection(): Promise<MessagingHealthCheckResult>;
  
  isHealthy(): boolean {
    return this._isHealthy;
  }
  
  protected markHealthy(): void {
    this._isHealthy = true;
    this.consecutiveFailures = 0;
  }
  
  protected markUnhealthy(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 3) {
      this._isHealthy = false;
    }
  }
  
  /**
   * Format phone number to E.164
   */
  protected formatPhoneNumber(phone: string, defaultCountryCode = '+91'): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // If no country code, add default
    if (!cleaned.startsWith('+')) {
      // Check if it already has country code without +
      if (cleaned.length > 10 && cleaned.startsWith('91')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = defaultCountryCode + cleaned;
      }
    }
    
    return cleaned;
  }
}

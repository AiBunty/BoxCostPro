/**
 * WhatsApp Business API (WABA) Cloud API Adapter
 * 
 * Implements IMessagingProvider for Meta's WhatsApp Business Cloud API
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import crypto from 'crypto';
import {
  BaseMessagingProvider,
  MessagingProviderConfig,
  TextMessageRequest,
  TemplateMessageRequest,
  MessageSendResult,
  WebhookPayload,
  WebhookVerificationResult,
  MessagingHealthCheckResult,
  MessagingProviderCode,
} from '../IMessagingProvider';

export class WABACloudAdapter extends BaseMessagingProvider {
  readonly providerCode: MessagingProviderCode = 'waba';
  readonly providerName = 'WhatsApp Business API (Cloud)';
  readonly supportsTemplates = true;
  readonly supportsMedia = true;
  
  private baseUrl = 'https://graph.facebook.com';
  private apiVersion = 'v18.0';
  private phoneNumberId: string = '';
  
  async initialize(config: MessagingProviderConfig): Promise<void> {
    if (!config.accessToken) {
      throw new Error('WABA access token is required');
    }
    if (!config.phoneNumberId) {
      throw new Error('WABA phone number ID is required');
    }
    
    this.config = config;
    this.phoneNumberId = config.phoneNumberId;
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`WABA initialization failed: ${health.message}`);
    }
  }
  
  async sendTextMessage(request: TextMessageRequest): Promise<MessageSendResult> {
    if (!this.config) {
      return {
        success: false,
        error: { code: 'NOT_INITIALIZED', message: 'Provider not initialized', retryable: false },
      };
    }
    
    try {
      const formattedPhone = this.formatPhoneNumber(request.recipient.phoneNumber);
      
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone.replace('+', ''),
            type: 'text',
            text: {
              preview_url: request.previewUrl ?? false,
              body: request.text,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          error: {
            code: errorData.error?.code?.toString() || `HTTP_${response.status}`,
            message: errorData.error?.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      this.markUnhealthy();
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }
  
  async sendTemplateMessage(request: TemplateMessageRequest): Promise<MessageSendResult> {
    if (!this.config) {
      return {
        success: false,
        error: { code: 'NOT_INITIALIZED', message: 'Provider not initialized', retryable: false },
      };
    }
    
    try {
      const formattedPhone = this.formatPhoneNumber(request.recipient.phoneNumber);
      
      const templatePayload: any = {
        name: request.templateName,
        language: {
          code: request.templateLanguage || 'en',
        },
      };
      
      if (request.components && request.components.length > 0) {
        templatePayload.components = request.components;
      }
      
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone.replace('+', ''),
            type: 'template',
            template: templatePayload,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          error: {
            code: errorData.error?.code?.toString() || `HTTP_${response.status}`,
            message: errorData.error?.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      this.markUnhealthy();
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }
  
  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerificationResult> {
    if (!this.config?.webhookSecret) {
      return { isValid: false };
    }
    
    try {
      // Verify signature
      if (payload.signature) {
        const expectedSignature = crypto
          .createHmac('sha256', this.config.webhookSecret)
          .update(JSON.stringify(payload.rawPayload))
          .digest('hex');
        
        const providedSignature = payload.signature.replace('sha256=', '');
        
        if (expectedSignature !== providedSignature) {
          return { isValid: false };
        }
      }
      
      // Parse webhook payload
      const data = payload.rawPayload;
      
      // Check for message received
      const entry = data.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      
      if (!value) {
        return { isValid: true }; // Valid but no actionable data
      }
      
      // Handle incoming message
      const message = value.messages?.[0];
      if (message) {
        return {
          isValid: true,
          event: 'message_received',
          messageId: message.id,
          fromPhone: '+' + message.from,
          text: message.text?.body || message.button?.text,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          metadata: {
            type: message.type,
            context: message.context, // Reply context
          },
        };
      }
      
      // Handle status updates
      const status = value.statuses?.[0];
      if (status) {
        let event: 'message_delivered' | 'message_read' | 'message_failed' = 'message_delivered';
        if (status.status === 'read') event = 'message_read';
        if (status.status === 'failed') event = 'message_failed';
        
        return {
          isValid: true,
          event,
          messageId: status.id,
          toPhone: '+' + status.recipient_id,
          timestamp: new Date(parseInt(status.timestamp) * 1000),
        };
      }
      
      return { isValid: true };
      
    } catch (error) {
      console.error('[WABACloudAdapter] Webhook verification error:', error);
      return { isValid: false };
    }
  }
  
  async testConnection(): Promise<MessagingHealthCheckResult> {
    if (!this.config) {
      return {
        isHealthy: false,
        latencyMs: 0,
        message: 'Provider not initialized',
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Get phone number details to verify credentials
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        this.markUnhealthy();
        return {
          isHealthy: false,
          latencyMs,
          message: `API returned ${response.status}: ${response.statusText}`,
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      return {
        isHealthy: true,
        latencyMs,
        message: 'WABA API is reachable',
        details: {
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating,
        },
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.markUnhealthy();
      
      return {
        isHealthy: false,
        latencyMs,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

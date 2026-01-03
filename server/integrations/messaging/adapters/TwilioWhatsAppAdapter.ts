/**
 * Twilio WhatsApp Adapter
 * 
 * Implements IMessagingProvider for Twilio's WhatsApp API
 * Docs: https://www.twilio.com/docs/whatsapp
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

export class TwilioWhatsAppAdapter extends BaseMessagingProvider {
  readonly providerCode: MessagingProviderCode = 'twilio-whatsapp';
  readonly providerName = 'Twilio WhatsApp';
  readonly supportsTemplates = true;
  readonly supportsMedia = true;
  
  private baseUrl = 'https://api.twilio.com';
  private accountSid: string = '';
  private authToken: string = '';
  private whatsappNumber: string = '';
  
  async initialize(config: MessagingProviderConfig): Promise<void> {
    if (!config.accountSid) {
      throw new Error('Twilio Account SID is required');
    }
    if (!config.authToken) {
      throw new Error('Twilio Auth Token is required');
    }
    if (!config.phoneNumber) {
      throw new Error('Twilio WhatsApp number is required');
    }
    
    this.config = config;
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.whatsappNumber = config.phoneNumber;
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`Twilio initialization failed: ${health.message}`);
    }
  }
  
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return `Basic ${credentials}`;
  }
  
  private formatWhatsAppNumber(phone: string): string {
    const formatted = this.formatPhoneNumber(phone);
    // Twilio WhatsApp numbers need "whatsapp:" prefix
    if (!formatted.startsWith('whatsapp:')) {
      return `whatsapp:${formatted}`;
    }
    return formatted;
  }
  
  async sendTextMessage(request: TextMessageRequest): Promise<MessageSendResult> {
    if (!this.config) {
      return {
        success: false,
        error: { code: 'NOT_INITIALIZED', message: 'Provider not initialized', retryable: false },
      };
    }
    
    try {
      const toNumber = this.formatWhatsAppNumber(request.recipient.phoneNumber);
      const fromNumber = this.formatWhatsAppNumber(this.whatsappNumber);
      
      const formData = new URLSearchParams();
      formData.append('To', toNumber);
      formData.append('From', fromNumber);
      formData.append('Body', request.text);
      
      const response = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': this.getAuthHeader(),
          },
          body: formData.toString(),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          error: {
            code: errorData.code?.toString() || `HTTP_${response.status}`,
            message: errorData.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      return {
        success: true,
        messageId: data.sid,
        timestamp: data.date_created || new Date().toISOString(),
        deliveryStatus: data.status,
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
      const toNumber = this.formatWhatsAppNumber(request.recipient.phoneNumber);
      const fromNumber = this.formatWhatsAppNumber(this.whatsappNumber);
      
      // Twilio uses ContentSid for templates
      const formData = new URLSearchParams();
      formData.append('To', toNumber);
      formData.append('From', fromNumber);
      
      if (request.contentSid) {
        // Using Twilio Content API
        formData.append('ContentSid', request.contentSid);
        
        // Add content variables if provided
        if (request.components) {
          const variables: Record<string, string> = {};
          let varIndex = 1;
          
          for (const component of request.components) {
            if (component.parameters) {
              for (const param of component.parameters) {
                if (param.text || param.value) {
                  variables[varIndex.toString()] = param.text || param.value;
                  varIndex++;
                }
              }
            }
          }
          
          if (Object.keys(variables).length > 0) {
            formData.append('ContentVariables', JSON.stringify(variables));
          }
        }
      } else {
        // Fallback to body text for non-Content API templates
        // Note: This may not work outside the 24h session window
        let body = `Template: ${request.templateName}`;
        if (request.components) {
          const bodyComponent = request.components.find(c => c.type === 'body');
          if (bodyComponent?.parameters) {
            const params = bodyComponent.parameters.map((p: any) => p.text || p.value).join(', ');
            body += ` | Params: ${params}`;
          }
        }
        formData.append('Body', body);
      }
      
      const response = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': this.getAuthHeader(),
          },
          body: formData.toString(),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          error: {
            code: errorData.code?.toString() || `HTTP_${response.status}`,
            message: errorData.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      return {
        success: true,
        messageId: data.sid,
        timestamp: data.date_created || new Date().toISOString(),
        deliveryStatus: data.status,
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
      // No signature validation, just parse
      return this.parseWebhookPayload(payload);
    }
    
    try {
      // Twilio signature validation
      // The signature is based on the full URL + POST body
      if (payload.signature && payload.url) {
        const params = payload.rawPayload;
        const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
          acc += key + params[key];
          return acc;
        }, payload.url);
        
        const expectedSignature = crypto
          .createHmac('sha1', this.config.webhookSecret)
          .update(sortedParams)
          .digest('base64');
        
        if (expectedSignature !== payload.signature) {
          return { isValid: false };
        }
      }
      
      return this.parseWebhookPayload(payload);
      
    } catch (error) {
      console.error('[TwilioWhatsAppAdapter] Webhook verification error:', error);
      return { isValid: false };
    }
  }
  
  private parseWebhookPayload(payload: WebhookPayload): WebhookVerificationResult {
    const data = payload.rawPayload;
    
    // Handle incoming message
    if (data.SmsMessageSid || data.MessageSid) {
      const fromPhone = (data.From || '').replace('whatsapp:', '');
      const toPhone = (data.To || '').replace('whatsapp:', '');
      
      // Check if it's a status callback
      if (data.SmsStatus || data.MessageStatus) {
        let event: 'message_delivered' | 'message_read' | 'message_failed' = 'message_delivered';
        const status = data.SmsStatus || data.MessageStatus;
        
        if (status === 'read') event = 'message_read';
        if (['failed', 'undelivered'].includes(status)) event = 'message_failed';
        
        return {
          isValid: true,
          event,
          messageId: data.MessageSid || data.SmsMessageSid,
          toPhone,
          timestamp: new Date(),
        };
      }
      
      // Incoming message
      return {
        isValid: true,
        event: 'message_received',
        messageId: data.MessageSid || data.SmsMessageSid,
        fromPhone,
        text: data.Body,
        timestamp: new Date(),
        metadata: {
          numMedia: parseInt(data.NumMedia || '0', 10),
          mediaUrls: this.extractMediaUrls(data),
        },
      };
    }
    
    return { isValid: true };
  }
  
  private extractMediaUrls(data: any): string[] {
    const urls: string[] = [];
    const numMedia = parseInt(data.NumMedia || '0', 10);
    
    for (let i = 0; i < numMedia; i++) {
      if (data[`MediaUrl${i}`]) {
        urls.push(data[`MediaUrl${i}`]);
      }
    }
    
    return urls;
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
      // Get account info to verify credentials
      const response = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(),
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
        isHealthy: data.status === 'active',
        latencyMs,
        message: data.status === 'active' ? 'Twilio API is reachable' : `Account status: ${data.status}`,
        details: {
          accountName: data.friendly_name,
          accountStatus: data.status,
          accountType: data.type,
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

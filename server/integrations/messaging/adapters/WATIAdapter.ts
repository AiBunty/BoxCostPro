/**
 * WATI (WhatsApp Team Inbox) Adapter
 * 
 * Implements IMessagingProvider for WATI API
 * Docs: https://docs.wati.io/
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

export class WATIAdapter extends BaseMessagingProvider {
  readonly providerCode: MessagingProviderCode = 'wati';
  readonly providerName = 'WATI';
  readonly supportsTemplates = true;
  readonly supportsMedia = true;
  
  private baseUrl = '';
  
  async initialize(config: MessagingProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('WATI API key is required');
    }
    if (!config.baseUrl) {
      throw new Error('WATI API endpoint is required (e.g., https://live-server-xxxxx.wati.io)');
    }
    
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`WATI initialization failed: ${health.message}`);
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
      // WATI expects phone without + prefix
      const phoneWithoutPlus = formattedPhone.replace('+', '');
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/sendSessionMessage/${phoneWithoutPlus}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            messageText: request.text,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        // Check if session expired (24h window)
        if (errorData.result === false && errorData.info?.includes('session')) {
          return {
            success: false,
            error: {
              code: 'SESSION_EXPIRED',
              message: 'WhatsApp session expired. Use template message instead.',
              retryable: false,
            },
          };
        }
        
        return {
          success: false,
          error: {
            code: errorData.result === false ? 'WATI_ERROR' : `HTTP_${response.status}`,
            message: errorData.info || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      if (data.result !== true) {
        return {
          success: false,
          error: {
            code: 'SEND_FAILED',
            message: data.info || 'Failed to send message',
            retryable: false,
          },
        };
      }
      
      return {
        success: true,
        messageId: data.data?.id,
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
      const phoneWithoutPlus = formattedPhone.replace('+', '');
      
      // WATI template format
      const templatePayload: any = {
        template_name: request.templateName,
        broadcast_name: request.broadcastName || `api_${Date.now()}`,
      };
      
      // Extract parameters from components
      if (request.components) {
        const bodyComponent = request.components.find(c => c.type === 'body');
        if (bodyComponent?.parameters) {
          templatePayload.parameters = bodyComponent.parameters.map((p: any) => ({
            name: p.name || 'param',
            value: p.text || p.value,
          }));
        }
        
        // Handle header component
        const headerComponent = request.components.find(c => c.type === 'header');
        if (headerComponent?.parameters?.[0]) {
          const headerParam = headerComponent.parameters[0];
          if (headerParam.type === 'image') {
            templatePayload.header_image_url = headerParam.image?.link;
          } else if (headerParam.type === 'document') {
            templatePayload.header_document_url = headerParam.document?.link;
          }
        }
      }
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${phoneWithoutPlus}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(templatePayload),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          error: {
            code: errorData.result === false ? 'WATI_ERROR' : `HTTP_${response.status}`,
            message: errorData.info || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      if (data.result !== true) {
        return {
          success: false,
          error: {
            code: 'SEND_FAILED',
            message: data.info || 'Failed to send template message',
            retryable: false,
          },
        };
      }
      
      return {
        success: true,
        messageId: data.data?.id,
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
    try {
      const data = payload.rawPayload;
      
      // WATI webhook structure
      if (!data.waId && !data.id) {
        return { isValid: true }; // Valid but no actionable data
      }
      
      // Handle incoming message
      if (data.type === 'message') {
        return {
          isValid: true,
          event: 'message_received',
          messageId: data.id,
          fromPhone: '+' + data.waId,
          text: data.text || data.data?.text,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          metadata: {
            type: data.type,
            mediaUrl: data.data?.media?.url,
          },
        };
      }
      
      // Handle status updates
      if (data.event === 'message_status') {
        let event: 'message_delivered' | 'message_read' | 'message_failed' = 'message_delivered';
        if (data.status === 'read') event = 'message_read';
        if (data.status === 'failed') event = 'message_failed';
        
        return {
          isValid: true,
          event,
          messageId: data.messageId,
          toPhone: '+' + data.waId,
          timestamp: new Date(),
        };
      }
      
      return { isValid: true };
      
    } catch (error) {
      console.error('[WATIAdapter] Webhook verification error:', error);
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
      // Get account info to verify credentials
      const response = await fetch(
        `${this.baseUrl}/api/v1/getContacts`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
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
        isHealthy: data.result === true,
        latencyMs,
        message: data.result === true ? 'WATI API is reachable' : 'API check failed',
        details: {
          contactCount: data.contact_list?.length || 0,
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
  
  /**
   * WATI-specific: Get list of available templates
   */
  async getTemplates(): Promise<{ templates: any[]; error?: string }> {
    if (!this.config) {
      return { templates: [], error: 'Provider not initialized' };
    }
    
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/getMessageTemplates`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );
      
      if (!response.ok) {
        return { templates: [], error: `API returned ${response.status}` };
      }
      
      const data = await response.json();
      
      return {
        templates: data.messageTemplates || [],
      };
      
    } catch (error) {
      return {
        templates: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

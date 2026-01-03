/**
 * Messaging Integration Module Exports
 * 
 * Provides unified access to WhatsApp/messaging providers
 */

// Interface and types
export {
  IMessagingProvider,
  BaseMessagingProvider,
  MessagingProviderConfig,
  MessagingProviderCode,
  TextMessageRequest,
  TemplateMessageRequest,
  MessageSendResult,
  WebhookPayload,
  WebhookVerificationResult,
  MessagingHealthCheckResult,
} from './IMessagingProvider';

// Adapters
export { WABACloudAdapter } from './adapters/WABACloudAdapter';
export { WATIAdapter } from './adapters/WATIAdapter';
export { TwilioWhatsAppAdapter } from './adapters/TwilioWhatsAppAdapter';

// Factory
export {
  messagingFactory,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  getMessagingHealth,
} from './MessagingProviderFactory';

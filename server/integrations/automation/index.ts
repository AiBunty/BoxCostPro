/**
 * Automation Integration Module Exports
 */

// Interface and types
export type {
  IAutomationProvider,
  AutomationProviderConfig,
  AutomationProviderCode,
  AutomationEventType,
  WebhookDeliveryRequest,
  WebhookDeliveryResult,
  WorkflowTrigger,
  AutomationHealthCheckResult,
} from './IAutomationProvider';

export { BaseAutomationProvider } from './IAutomationProvider';

// Adapters
export { N8nAdapter } from './adapters/N8nAdapter';

// Event Publisher
export {
  publishEvent,
  publishEventSync,
  getDeadLetterQueue,
  retryDeadLetter,
  clearDeadLetterQueue,
  clearSubscriptionCache,
  getQueueStatus,
} from './eventPublisher';

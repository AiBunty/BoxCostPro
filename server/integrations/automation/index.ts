/**
 * Automation Integration Module Exports
 */

// Interface and types
export {
  IAutomationProvider,
  BaseAutomationProvider,
  AutomationProviderConfig,
  AutomationProviderCode,
  AutomationEventType,
  WebhookDeliveryRequest,
  WebhookDeliveryResult,
  WorkflowTrigger,
  AutomationHealthCheckResult,
} from './IAutomationProvider';

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

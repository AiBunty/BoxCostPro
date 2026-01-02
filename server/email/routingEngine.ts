/**
 * Email Routing Engine with Failover Logic
 * 
 * - Task-based provider routing
 * - Automatic failover with retry
 * - Rate limiting enforcement
 * - Health monitoring
 * - Consent checking
 */

import type { Storage } from '../storage';
import { 
  EmailProvider,
  EmailTaskRouting,
  EmailMessage,
  EmailTaskType,
  FailoverResult
} from './providerAbstraction';
import { ProviderAdapterFactory } from './providerAdapters';
import { logEmailSend } from '../utils/emailLogger';

export class EmailRoutingEngine {
  constructor(private storage: Storage) {}
  
  /**
   * Send email with task-based routing and automatic failover
   */
  async sendWithRouting(
    taskType: EmailTaskType,
    message: EmailMessage,
    options?: {
      userId?: string;
      emailId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<FailoverResult> {
    // 1. Check user consent for task type
    if (options?.userId) {
      const hasConsent = await this.checkUserConsent(options.userId, taskType);
      if (!hasConsent) {
        return {
          success: false,
          providerId: 'none',
          providerName: 'none',
          attemptNumber: 0,
          totalAttempts: 0,
          failoverOccurred: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message: `User has not consented to ${taskType}`,
          },
        };
      }
    }
    
    // 2. Get routing configuration for task type
    const routing = await this.getTaskRouting(taskType);
    if (!routing || !routing.isEnabled) {
      return {
        success: false,
        providerId: 'none',
        providerName: 'none',
        attemptNumber: 0,
        totalAttempts: 0,
        failoverOccurred: false,
        error: {
          code: 'ROUTING_NOT_CONFIGURED',
          message: `No routing configured for task type: ${taskType}`,
        },
      };
    }
    
    // 3. Build provider chain: [force] || [primary, ...fallbacks]
    const providerChain = await this.buildProviderChain(routing);
    if (providerChain.length === 0) {
      return {
        success: false,
        providerId: 'none',
        providerName: 'none',
        attemptNumber: 0,
        totalAttempts: 0,
        failoverOccurred: false,
        error: {
          code: 'NO_PROVIDERS_AVAILABLE',
          message: 'No active providers available for this task',
        },
      };
    }
    
    // 4. Attempt to send with retry and failover
    let totalAttempts = 0;
    let failoverOccurred = false;
    let failoverFromProviderId: string | undefined;
    let failoverReason: string | undefined;
    
    for (const provider of providerChain) {
      // Check if we've exceeded max attempts
      if (totalAttempts >= routing.maxSendAttempts) {
        break;
      }
      
      // Retry logic for current provider
      for (let retry = 0; retry < routing.retryAttempts; retry++) {
        totalAttempts++;
        
        // Check rate limits
        if (!this.checkRateLimits(provider)) {
          console.log(`[Email Router] Provider ${provider.providerName} rate limit exceeded`);
          failoverReason = 'Rate limit exceeded';
          break; // Move to next provider
        }
        
        // Attempt send
        const result = await this.sendWithProvider(provider, message, totalAttempts);
        
        // Log attempt
        await this.logEmailAttempt({
          taskType,
          providerId: provider.id,
          providerName: provider.providerName,
          message,
          result,
          attemptNumber: totalAttempts,
          userId: options?.userId,
          emailId: options?.emailId,
          metadata: options?.metadata,
        });
        
        // Update provider health
        await this.updateProviderHealth(provider.id, result.success);
        
        // Success!
        if (result.success) {
          return {
            ...result,
            totalAttempts,
            failoverOccurred,
            failoverFromProviderId,
            failoverReason,
          };
        }
        
        // Wait before retry (if not last retry)
        if (retry < routing.retryAttempts - 1) {
          await this.sleep(routing.retryDelaySeconds * 1000);
        }
      }
      
      // If we get here, provider failed after all retries
      // Set failover flags and try next provider
      if (!failoverOccurred) {
        failoverOccurred = true;
        failoverFromProviderId = provider.id;
        failoverReason = 'Provider failed after retries';
      }
    }
    
    // All providers failed
    return {
      success: false,
      providerId: providerChain[providerChain.length - 1]?.id || 'none',
      providerName: providerChain[providerChain.length - 1]?.providerName || 'none',
      attemptNumber: totalAttempts,
      totalAttempts,
      failoverOccurred,
      failoverFromProviderId,
      failoverReason: failoverReason || 'All providers failed',
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: `Failed to send email after ${totalAttempts} attempts across ${providerChain.length} providers`,
      },
    };
  }
  
  /**
   * Send email using specific provider (bypasses routing)
   */
  async sendWithProvider(
    provider: EmailProvider,
    message: EmailMessage,
    attemptNumber: number = 1
  ): Promise<FailoverResult> {
    try {
      // Create adapter for provider
      const adapter = ProviderAdapterFactory.createAdapter(provider);
      
      // Check if provider can send
      if (!adapter.canSend()) {
        return {
          success: false,
          providerId: provider.id,
          providerName: provider.providerName,
          attemptNumber,
          totalAttempts: attemptNumber,
          failoverOccurred: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `Provider ${provider.providerName} is currently unavailable`,
          },
        };
      }
      
      // Send email
      const result = await adapter.send(message);
      
      // Increment rate limit counters if successful
      if (result.success) {
        await this.incrementRateLimitCounters(provider.id);
      }
      
      return {
        ...result,
        totalAttempts: attemptNumber,
        failoverOccurred: false,
      };
    } catch (error: any) {
      console.error(`[Email Router] Error sending with provider ${provider.providerName}:`, error);
      return {
        success: false,
        providerId: provider.id,
        providerName: provider.providerName,
        attemptNumber,
        totalAttempts: attemptNumber,
        failoverOccurred: false,
        error: {
          code: 'SEND_ERROR',
          message: error.message || 'Unknown error occurred',
          details: error,
        },
      };
    }
  }
  
  /**
   * Build provider chain for routing with fallback
   */
  private async buildProviderChain(routing: EmailTaskRouting): Promise<EmailProvider[]> {
    const providers: EmailProvider[] = [];
    
    // If force provider is set, use only that
    if (routing.forceProviderId) {
      const provider = await this.getProvider(routing.forceProviderId);
      if (provider && provider.isActive) {
        providers.push(provider);
      }
      return providers;
    }
    
    // Add primary provider
    if (routing.primaryProviderId) {
      const primary = await this.getProvider(routing.primaryProviderId);
      if (primary && primary.isActive && primary.consecutiveFailures < 10) {
        providers.push(primary);
      }
    }
    
    // Add fallback providers in order
    for (const fallbackId of routing.fallbackProviderIds) {
      const fallback = await this.getProvider(fallbackId);
      if (fallback && fallback.isActive && fallback.consecutiveFailures < 10) {
        providers.push(fallback);
      }
    }
    
    return providers;
  }
  
  /**
   * Get task routing configuration
   */
  private async getTaskRouting(taskType: EmailTaskType): Promise<EmailTaskRouting | null> {
    // TODO: Implement storage method
    // For now, return mock data
    return {
      id: '1',
      taskType,
      retryAttempts: 1,
      retryDelaySeconds: 5,
      maxSendAttempts: 3,
      fallbackProviderIds: [],
      isEnabled: true,
    };
  }
  
  /**
   * Get provider by ID
   */
  private async getProvider(providerId: string): Promise<EmailProvider | null> {
    // TODO: Implement storage method
    return null;
  }
  
  /**
   * Check user consent for email task type
   */
  private async checkUserConsent(userId: string, taskType: EmailTaskType): Promise<boolean> {
    // AUTH and TRANSACTIONAL emails are always allowed
    if (taskType === 'AUTH_EMAILS' || taskType === 'TRANSACTIONAL_EMAILS') {
      return true;
    }
    
    // TODO: Check user_email_preferences table
    // For now, allow all except marketing
    return taskType !== 'MARKETING_EMAILS';
  }
  
  /**
   * Check provider rate limits
   */
  private checkRateLimits(provider: EmailProvider): boolean {
    const now = new Date();
    
    // Check hourly limit
    if (provider.maxEmailsPerHour && 
        provider.currentHourlyCount >= provider.maxEmailsPerHour) {
      return false;
    }
    
    // Check daily limit
    if (provider.maxEmailsPerDay && 
        provider.currentDailyCount >= provider.maxEmailsPerDay) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Increment rate limit counters
   */
  private async incrementRateLimitCounters(providerId: string): Promise<void> {
    // TODO: Implement atomic increment in storage
    console.log(`[Email Router] Incrementing rate limit counters for provider ${providerId}`);
  }
  
  /**
   * Update provider health metrics
   */
  private async updateProviderHealth(providerId: string, success: boolean): Promise<void> {
    // TODO: Call storage method to update health
    console.log(`[Email Router] Updating health for provider ${providerId}: ${success ? 'success' : 'failure'}`);
  }
  
  /**
   * Log email attempt
   */
  private async logEmailAttempt(params: {
    taskType: EmailTaskType;
    providerId: string;
    providerName: string;
    message: EmailMessage;
    result: any;
    attemptNumber: number;
    userId?: string;
    emailId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const recipients = Array.isArray(params.message.to) 
      ? params.message.to 
      : [params.message.to];
    
    logEmailSend(
      params.result.success,
      params.providerName,
      recipients.length,
      params.result.error?.message
    );
    
    // TODO: Write to email_send_logs table
    console.log(`[Email Router] Logged attempt ${params.attemptNumber} for ${params.taskType} via ${params.providerName}: ${params.result.success ? 'SUCCESS' : 'FAILED'}`);
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

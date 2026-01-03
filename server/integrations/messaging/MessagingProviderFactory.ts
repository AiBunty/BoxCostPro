/**
 * Messaging Provider Factory
 * 
 * Creates and manages messaging providers (WhatsApp, SMS) with:
 * - Priority-based routing (primary/secondary providers)
 * - Automatic failover on errors
 * - Health monitoring and circuit breaker pattern
 * - Configuration from database with env var fallback
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../../utils/encryption';
import {
  IMessagingProvider,
  MessagingProviderConfig,
  MessagingProviderCode,
  TextMessageRequest,
  TemplateMessageRequest,
  MessageSendResult,
} from './IMessagingProvider';
import { WABACloudAdapter } from './adapters/WABACloudAdapter';
import { WATIAdapter } from './adapters/WATIAdapter';
import { TwilioWhatsAppAdapter } from './adapters/TwilioWhatsAppAdapter';

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 60000; // 1 minute

interface ProviderState {
  provider: IMessagingProvider;
  failures: number;
  lastFailure: Date | null;
  circuitOpen: boolean;
}

interface ProviderRoute {
  code: MessagingProviderCode;
  priority: number;
  config: MessagingProviderConfig;
}

class MessagingProviderFactory {
  private static instance: MessagingProviderFactory;
  private providers: Map<MessagingProviderCode, ProviderState> = new Map();
  private routeCache: Map<number, ProviderRoute[]> = new Map(); // tenantId -> routes
  private routeCacheExpiry: Map<number, number> = new Map();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  
  private constructor() {}
  
  static getInstance(): MessagingProviderFactory {
    if (!MessagingProviderFactory.instance) {
      MessagingProviderFactory.instance = new MessagingProviderFactory();
    }
    return MessagingProviderFactory.instance;
  }
  
  /**
   * Create a messaging provider instance
   */
  private createProvider(code: MessagingProviderCode): IMessagingProvider {
    switch (code) {
      case 'waba':
        return new WABACloudAdapter();
      case 'wati':
        return new WATIAdapter();
      case 'twilio-whatsapp':
        return new TwilioWhatsAppAdapter();
      case 'interakt':
        // Interakt adapter would go here
        throw new Error(`Interakt adapter not yet implemented`);
      default:
        throw new Error(`Unknown messaging provider: ${code}`);
    }
  }
  
  /**
   * Get or create a provider instance
   */
  private async getProviderInstance(
    code: MessagingProviderCode,
    config: MessagingProviderConfig
  ): Promise<ProviderState | null> {
    const cacheKey = `${code}_${config.tenantId || 'global'}`;
    
    // Check if we have a cached provider
    let state = this.providers.get(code);
    
    if (state) {
      // Check circuit breaker
      if (state.circuitOpen) {
        const timeSinceFailure = state.lastFailure 
          ? Date.now() - state.lastFailure.getTime() 
          : Infinity;
        
        if (timeSinceFailure < RECOVERY_TIME_MS) {
          console.log(`[MessagingFactory] Circuit open for ${code}, skipping`);
          return null;
        }
        
        // Try to recover
        console.log(`[MessagingFactory] Attempting recovery for ${code}`);
        state.circuitOpen = false;
        state.failures = 0;
      }
      
      return state;
    }
    
    // Create new provider
    try {
      const provider = this.createProvider(code);
      await provider.initialize(config);
      
      state = {
        provider,
        failures: 0,
        lastFailure: null,
        circuitOpen: false,
      };
      
      this.providers.set(code, state);
      return state;
      
    } catch (error) {
      console.error(`[MessagingFactory] Failed to initialize ${code}:`, error);
      return null;
    }
  }
  
  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(code: MessagingProviderCode): void {
    const state = this.providers.get(code);
    if (!state) return;
    
    state.failures++;
    state.lastFailure = new Date();
    
    if (state.failures >= FAILURE_THRESHOLD) {
      state.circuitOpen = true;
      console.warn(`[MessagingFactory] Circuit breaker OPEN for ${code} after ${state.failures} failures`);
    }
  }
  
  /**
   * Record a success - resets failure count
   */
  private recordSuccess(code: MessagingProviderCode): void {
    const state = this.providers.get(code);
    if (!state) return;
    
    state.failures = 0;
    state.lastFailure = null;
    state.circuitOpen = false;
  }
  
  /**
   * Load provider routes from database
   */
  private async loadRoutes(tenantId: number): Promise<ProviderRoute[]> {
    // Check cache
    const cacheExpiry = this.routeCacheExpiry.get(tenantId);
    if (cacheExpiry && Date.now() < cacheExpiry) {
      const cached = this.routeCache.get(tenantId);
      if (cached) return cached;
    }
    
    try {
      // In a real implementation, this would query the integration_routes table
      // For now, fall back to environment variables
      const routes = await this.loadRoutesFromEnv();
      
      this.routeCache.set(tenantId, routes);
      this.routeCacheExpiry.set(tenantId, Date.now() + this.CACHE_TTL_MS);
      
      return routes;
      
    } catch (error) {
      console.error('[MessagingFactory] Failed to load routes:', error);
      return this.loadRoutesFromEnv();
    }
  }
  
  /**
   * Load routes from environment variables (fallback)
   */
  private loadRoutesFromEnv(): ProviderRoute[] {
    const routes: ProviderRoute[] = [];
    
    // WABA (Meta Cloud API)
    if (process.env.WABA_ACCESS_TOKEN && process.env.WABA_PHONE_NUMBER_ID) {
      routes.push({
        code: 'waba',
        priority: 1,
        config: {
          accessToken: process.env.WABA_ACCESS_TOKEN,
          phoneNumberId: process.env.WABA_PHONE_NUMBER_ID,
          webhookSecret: process.env.WABA_WEBHOOK_SECRET,
        },
      });
    }
    
    // WATI
    if (process.env.WATI_API_KEY && process.env.WATI_API_ENDPOINT) {
      routes.push({
        code: 'wati',
        priority: 2,
        config: {
          apiKey: process.env.WATI_API_KEY,
          baseUrl: process.env.WATI_API_ENDPOINT,
        },
      });
    }
    
    // Twilio WhatsApp
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
      routes.push({
        code: 'twilio-whatsapp',
        priority: 3,
        config: {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER,
          webhookSecret: process.env.TWILIO_WEBHOOK_SECRET,
        },
      });
    }
    
    return routes.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Send a text message with automatic failover
   */
  async sendTextMessage(
    request: TextMessageRequest,
    tenantId: number = 0
  ): Promise<MessageSendResult & { providerUsed?: MessagingProviderCode }> {
    const routes = await this.loadRoutes(tenantId);
    
    if (routes.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_PROVIDERS',
          message: 'No messaging providers configured',
          retryable: false,
        },
      };
    }
    
    const errors: string[] = [];
    
    for (const route of routes) {
      const state = await this.getProviderInstance(route.code, {
        ...route.config,
        tenantId,
      });
      
      if (!state) {
        errors.push(`${route.code}: Circuit breaker open or initialization failed`);
        continue;
      }
      
      try {
        const result = await state.provider.sendTextMessage(request);
        
        if (result.success) {
          this.recordSuccess(route.code);
          return {
            ...result,
            providerUsed: route.code,
          };
        }
        
        // Retryable error - try next provider
        if (result.error?.retryable) {
          this.recordFailure(route.code);
          errors.push(`${route.code}: ${result.error.message}`);
          continue;
        }
        
        // Non-retryable error - return immediately
        return {
          ...result,
          providerUsed: route.code,
        };
        
      } catch (error) {
        this.recordFailure(route.code);
        errors.push(`${route.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: `All providers failed: ${errors.join('; ')}`,
        retryable: true,
      },
    };
  }
  
  /**
   * Send a template message with automatic failover
   */
  async sendTemplateMessage(
    request: TemplateMessageRequest,
    tenantId: number = 0
  ): Promise<MessageSendResult & { providerUsed?: MessagingProviderCode }> {
    const routes = await this.loadRoutes(tenantId);
    
    if (routes.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_PROVIDERS',
          message: 'No messaging providers configured',
          retryable: false,
        },
      };
    }
    
    const errors: string[] = [];
    
    for (const route of routes) {
      const state = await this.getProviderInstance(route.code, {
        ...route.config,
        tenantId,
      });
      
      if (!state) {
        errors.push(`${route.code}: Circuit breaker open or initialization failed`);
        continue;
      }
      
      // Skip if provider doesn't support templates
      if (!state.provider.supportsTemplates) {
        errors.push(`${route.code}: Templates not supported`);
        continue;
      }
      
      try {
        const result = await state.provider.sendTemplateMessage(request);
        
        if (result.success) {
          this.recordSuccess(route.code);
          return {
            ...result,
            providerUsed: route.code,
          };
        }
        
        // Retryable error - try next provider
        if (result.error?.retryable) {
          this.recordFailure(route.code);
          errors.push(`${route.code}: ${result.error.message}`);
          continue;
        }
        
        // Non-retryable error - return immediately
        return {
          ...result,
          providerUsed: route.code,
        };
        
      } catch (error) {
        this.recordFailure(route.code);
        errors.push(`${route.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: `All providers failed: ${errors.join('; ')}`,
        retryable: true,
      },
    };
  }
  
  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const [code, state] of this.providers) {
      const health = await state.provider.testConnection();
      status[code] = {
        ...health,
        circuitOpen: state.circuitOpen,
        failures: state.failures,
        lastFailure: state.lastFailure,
      };
    }
    
    return status;
  }
  
  /**
   * Clear cache and reset providers
   */
  reset(): void {
    this.providers.clear();
    this.routeCache.clear();
    this.routeCacheExpiry.clear();
  }
  
  /**
   * Get a specific provider for direct operations
   */
  async getProvider(
    code: MessagingProviderCode,
    config: MessagingProviderConfig
  ): Promise<IMessagingProvider | null> {
    const state = await this.getProviderInstance(code, config);
    return state?.provider || null;
  }
}

// Export singleton instance
export const messagingFactory = MessagingProviderFactory.getInstance();

// Export convenience functions
export async function sendWhatsAppText(
  request: TextMessageRequest,
  tenantId?: number
): Promise<MessageSendResult & { providerUsed?: MessagingProviderCode }> {
  return messagingFactory.sendTextMessage(request, tenantId);
}

export async function sendWhatsAppTemplate(
  request: TemplateMessageRequest,
  tenantId?: number
): Promise<MessageSendResult & { providerUsed?: MessagingProviderCode }> {
  return messagingFactory.sendTemplateMessage(request, tenantId);
}

export async function getMessagingHealth(): Promise<Record<string, any>> {
  return messagingFactory.getHealthStatus();
}

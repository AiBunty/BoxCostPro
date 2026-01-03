/**
 * LLM Provider Factory
 * 
 * Creates and manages LLM provider instances with:
 * - Priority-based routing
 * - Automatic failover
 * - Health monitoring
 * - Circuit breaker pattern
 * 
 * SECURITY: This is the ONLY entry point for LLM access.
 * All LLM requests MUST go through this factory.
 */

import type { ILLMProvider, LLMProviderCode, LLMProviderConfig, LLMCompletionRequest, LLMCompletionResponse } from './ILLMProvider';
import { OpenAIAdapter } from './adapters/OpenAIAdapter';
import { ClaudeAdapter } from './adapters/ClaudeAdapter';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { decrypt } from '../../utils/encryption';

// Provider configuration from database
export interface ProviderDbConfig {
  id: string;
  code: LLMProviderCode;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  region: string;
  baseUrl?: string;
  apiVersion?: string;
  credentials: Map<string, string>; // Decrypted credentials
}

// Factory configuration
export interface LLMFactoryConfig {
  maxRetries: number;
  retryDelayMs: number;
  failoverThreshold: number; // Consecutive failures before failover
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: LLMFactoryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  failoverThreshold: 3,
  healthCheckIntervalMs: 60000,
};

/**
 * LLM Provider Factory - Singleton
 */
class LLMProviderFactoryClass {
  private providers: Map<LLMProviderCode, ILLMProvider> = new Map();
  private providerConfigs: Map<LLMProviderCode, ProviderDbConfig> = new Map();
  private primaryProvider: LLMProviderCode | null = null;
  private secondaryProvider: LLMProviderCode | null = null;
  private config: LLMFactoryConfig = DEFAULT_CONFIG;
  private consecutiveFailures: Map<LLMProviderCode, number> = new Map();
  private isInitialized = false;
  
  /**
   * Initialize the factory with provider configurations from database
   */
  async initialize(
    providerConfigs: ProviderDbConfig[],
    factoryConfig?: Partial<LLMFactoryConfig>
  ): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...factoryConfig };
    
    // Clear existing providers
    this.providers.clear();
    this.providerConfigs.clear();
    this.consecutiveFailures.clear();
    
    // Sort by primary first
    const sortedConfigs = providerConfigs
      .filter(p => p.isActive)
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    
    for (const config of sortedConfigs) {
      try {
        const provider = this.createProviderInstance(config.code);
        if (!provider) continue;
        
        // Build provider config from database config
        const providerConfig: LLMProviderConfig = {
          apiKey: config.credentials.get('api_key') || '',
          baseUrl: config.baseUrl,
          apiVersion: config.apiVersion,
          organizationId: config.credentials.get('organization_id'),
          timeout: 60000,
          maxRetries: this.config.maxRetries,
        };
        
        await provider.initialize(providerConfig);
        
        this.providers.set(config.code, provider);
        this.providerConfigs.set(config.code, config);
        this.consecutiveFailures.set(config.code, 0);
        
        if (config.isPrimary && !this.primaryProvider) {
          this.primaryProvider = config.code;
        } else if (!this.secondaryProvider && !config.isPrimary) {
          this.secondaryProvider = config.code;
        }
        
        console.log(`[LLMFactory] Initialized provider: ${config.name} (${config.code})`);
        
      } catch (error) {
        console.error(`[LLMFactory] Failed to initialize ${config.code}:`, error);
      }
    }
    
    if (!this.primaryProvider && this.providers.size > 0) {
      // Use first available provider as primary
      this.primaryProvider = this.providers.keys().next().value!;
    }
    
    this.isInitialized = true;
    console.log(`[LLMFactory] Initialized with primary: ${this.primaryProvider}, secondary: ${this.secondaryProvider}`);
  }
  
  /**
   * Initialize from environment variables (fallback for simple setups)
   */
  async initializeFromEnv(): Promise<void> {
    const configs: ProviderDbConfig[] = [];
    
    // Check for Claude
    if (process.env.ANTHROPIC_API_KEY) {
      configs.push({
        id: 'env-claude',
        code: 'claude',
        name: 'Anthropic Claude',
        isActive: true,
        isPrimary: process.env.AI_PROVIDER === 'claude',
        region: 'GLOBAL',
        credentials: new Map([['api_key', process.env.ANTHROPIC_API_KEY]]),
      });
    }
    
    // Check for OpenAI
    if (process.env.OPENAI_API_KEY) {
      configs.push({
        id: 'env-openai',
        code: 'openai',
        name: 'OpenAI',
        isActive: true,
        isPrimary: process.env.AI_PROVIDER === 'openai' || !process.env.AI_PROVIDER,
        region: 'GLOBAL',
        credentials: new Map([['api_key', process.env.OPENAI_API_KEY]]),
      });
    }
    
    // Check for Gemini
    if (process.env.GOOGLE_API_KEY) {
      configs.push({
        id: 'env-gemini',
        code: 'gemini',
        name: 'Google Gemini',
        isActive: true,
        isPrimary: process.env.AI_PROVIDER === 'gemini',
        region: 'GLOBAL',
        credentials: new Map([['api_key', process.env.GOOGLE_API_KEY]]),
      });
    }
    
    if (configs.length === 0) {
      console.warn('[LLMFactory] No LLM API keys found in environment');
      return;
    }
    
    await this.initialize(configs);
  }
  
  /**
   * Get a completion with automatic failover
   */
  async complete(
    request: LLMCompletionRequest,
    preferredProvider?: LLMProviderCode
  ): Promise<LLMCompletionResponse & { usedProvider: LLMProviderCode; wasFailover: boolean }> {
    if (!this.isInitialized || this.providers.size === 0) {
      return {
        success: false,
        content: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: '',
        finishReason: 'error',
        latencyMs: 0,
        usedProvider: 'openai',
        wasFailover: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'LLM Factory not initialized or no providers available',
          retryable: false,
        },
      };
    }
    
    // Determine provider order
    const providerOrder = this.getProviderOrder(preferredProvider);
    
    let lastError: LLMCompletionResponse | null = null;
    let wasFailover = false;
    
    for (let i = 0; i < providerOrder.length; i++) {
      const providerCode = providerOrder[i];
      const provider = this.providers.get(providerCode);
      
      if (!provider || !provider.isHealthy()) {
        continue;
      }
      
      wasFailover = i > 0;
      
      // Attempt with retries
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        const response = await provider.complete(request);
        
        if (response.success) {
          // Reset failure count on success
          this.consecutiveFailures.set(providerCode, 0);
          
          return {
            ...response,
            usedProvider: providerCode,
            wasFailover,
          };
        }
        
        lastError = response;
        
        // Check if error is retryable
        if (!response.error?.retryable) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt - 1));
        }
      }
      
      // Increment failure count
      const failures = (this.consecutiveFailures.get(providerCode) || 0) + 1;
      this.consecutiveFailures.set(providerCode, failures);
      
      console.warn(`[LLMFactory] Provider ${providerCode} failed. Consecutive failures: ${failures}`);
    }
    
    // All providers failed
    return {
      ...(lastError || {
        success: false,
        content: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: '',
        finishReason: 'error',
        latencyMs: 0,
        error: {
          code: 'ALL_PROVIDERS_FAILED',
          message: 'All LLM providers failed',
          retryable: false,
        },
      }),
      usedProvider: providerOrder[0] || 'openai',
      wasFailover: true,
    };
  }
  
  /**
   * Get the primary provider
   */
  getPrimaryProvider(): ILLMProvider | null {
    if (!this.primaryProvider) return null;
    return this.providers.get(this.primaryProvider) || null;
  }
  
  /**
   * Get a specific provider
   */
  getProvider(code: LLMProviderCode): ILLMProvider | null {
    return this.providers.get(code) || null;
  }
  
  /**
   * Get all healthy providers
   */
  getHealthyProviders(): LLMProviderCode[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isHealthy())
      .map(([code]) => code);
  }
  
  /**
   * Get provider health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    providers: Array<{
      code: LLMProviderCode;
      name: string;
      isHealthy: boolean;
      isPrimary: boolean;
      consecutiveFailures: number;
    }>;
  }> {
    const providerStatuses = [];
    
    for (const [code, provider] of this.providers) {
      const config = this.providerConfigs.get(code);
      providerStatuses.push({
        code,
        name: config?.name || code,
        isHealthy: provider.isHealthy(),
        isPrimary: code === this.primaryProvider,
        consecutiveFailures: this.consecutiveFailures.get(code) || 0,
      });
    }
    
    return {
      isHealthy: providerStatuses.some(p => p.isHealthy),
      providers: providerStatuses,
    };
  }
  
  /**
   * Run health checks on all providers
   */
  async runHealthChecks(): Promise<void> {
    for (const [code, provider] of this.providers) {
      try {
        await provider.testConnection();
      } catch (error) {
        console.error(`[LLMFactory] Health check failed for ${code}:`, error);
      }
    }
  }
  
  // Private methods
  
  private createProviderInstance(code: LLMProviderCode): ILLMProvider | null {
    switch (code) {
      case 'openai':
        return new OpenAIAdapter();
      case 'claude':
        return new ClaudeAdapter();
      case 'gemini':
        return new GeminiAdapter();
      case 'azure-openai':
        // TODO: Implement AzureOpenAIAdapter
        console.warn('[LLMFactory] Azure OpenAI adapter not yet implemented');
        return null;
      case 'local':
        // TODO: Implement local LLM adapter
        console.warn('[LLMFactory] Local LLM adapter not yet implemented');
        return null;
      default:
        console.warn(`[LLMFactory] Unknown provider: ${code}`);
        return null;
    }
  }
  
  private getProviderOrder(preferred?: LLMProviderCode): LLMProviderCode[] {
    const order: LLMProviderCode[] = [];
    
    // Preferred provider first
    if (preferred && this.providers.has(preferred)) {
      order.push(preferred);
    }
    
    // Primary provider
    if (this.primaryProvider && !order.includes(this.primaryProvider)) {
      order.push(this.primaryProvider);
    }
    
    // Secondary provider
    if (this.secondaryProvider && !order.includes(this.secondaryProvider)) {
      order.push(this.secondaryProvider);
    }
    
    // All other providers
    for (const code of this.providers.keys()) {
      if (!order.includes(code)) {
        order.push(code);
      }
    }
    
    return order;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const LLMProviderFactory = new LLMProviderFactoryClass();

/**
 * Helper function to load provider configurations from database
 */
export async function loadProvidersFromDatabase(db: any): Promise<ProviderDbConfig[]> {
  try {
    // Query active LLM providers
    const providers = await db.query.integrationProviders.findMany({
      where: (p: any, { eq, and }: any) => and(
        eq(p.type, 'LLM'),
        eq(p.isActive, true)
      ),
    });
    
    const configs: ProviderDbConfig[] = [];
    
    for (const provider of providers) {
      // Get credentials for this provider
      const credentials = await db.query.integrationCredentials.findMany({
        where: (c: any, { eq }: any) => eq(c.providerId, provider.id),
      });
      
      const credMap = new Map<string, string>();
      for (const cred of credentials) {
        try {
          credMap.set(cred.keyName, decrypt(cred.encryptedValue));
        } catch (e) {
          console.error(`[LLMFactory] Failed to decrypt credential ${cred.keyName} for ${provider.code}`);
        }
      }
      
      configs.push({
        id: provider.id,
        code: provider.code as LLMProviderCode,
        name: provider.name,
        isActive: provider.isActive,
        isPrimary: provider.isPrimary,
        region: provider.region,
        baseUrl: provider.baseUrl || undefined,
        apiVersion: provider.apiVersion || undefined,
        credentials: credMap,
      });
    }
    
    return configs;
    
  } catch (error) {
    console.error('[LLMFactory] Failed to load providers from database:', error);
    return [];
  }
}

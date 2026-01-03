/**
 * LLM Provider Interface
 * 
 * Enterprise-grade interface for LLM provider adapters.
 * Supports multiple providers: Claude, OpenAI, Gemini, Azure OpenAI
 * 
 * SECURITY RULES:
 * - LLM NEVER accesses database directly
 * - LLM NEVER calls internal APIs
 * - LLM NEVER modifies system data
 * - LLM NEVER auto-sends messages
 * - All outputs require human approval
 */

export type LLMProviderCode = 'claude' | 'openai' | 'gemini' | 'azure-openai' | 'local';

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  organizationId?: string;
  projectId?: string;
  region?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json';
}

export interface LLMCompletionResponse {
  success: boolean;
  content: string;
  parsedJson?: Record<string, unknown>;
  
  // Token usage
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  
  // Metadata
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  latencyMs: number;
  
  // Error handling
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface LLMEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface LLMEmbeddingResponse {
  success: boolean;
  embeddings: number[][];
  model: string;
  totalTokens: number;
  latencyMs: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface LLMHealthCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  message: string;
  details?: {
    model?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export interface ILLMProvider {
  /**
   * Provider identification
   */
  readonly providerCode: LLMProviderCode;
  readonly providerName: string;
  readonly defaultModel: string;
  readonly supportedModels: string[];
  
  /**
   * Provider capabilities
   */
  readonly supportsStreaming: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsEmbeddings: boolean;
  readonly maxContextTokens: number;
  
  /**
   * Initialize the provider with configuration
   */
  initialize(config: LLMProviderConfig): Promise<void>;
  
  /**
   * Generate a completion from the LLM
   */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  
  /**
   * Generate embeddings for text
   */
  embed(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse>;
  
  /**
   * Test connection to the provider
   */
  testConnection(): Promise<LLMHealthCheckResult>;
  
  /**
   * Check if provider is currently healthy
   */
  isHealthy(): boolean;
  
  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestsRemaining: number;
    tokensRemaining: number;
    resetsAt: Date | null;
  };
}

/**
 * Base class for LLM providers with common functionality
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  abstract readonly providerCode: LLMProviderCode;
  abstract readonly providerName: string;
  abstract readonly defaultModel: string;
  abstract readonly supportedModels: string[];
  abstract readonly supportsStreaming: boolean;
  abstract readonly supportsJsonMode: boolean;
  abstract readonly supportsEmbeddings: boolean;
  abstract readonly maxContextTokens: number;
  
  protected config: LLMProviderConfig | null = null;
  protected _isHealthy: boolean = true;
  protected consecutiveFailures: number = 0;
  protected lastHealthCheck: Date | null = null;
  
  protected rateLimitState = {
    requestsRemaining: Infinity,
    tokensRemaining: Infinity,
    resetsAt: null as Date | null,
  };
  
  abstract initialize(config: LLMProviderConfig): Promise<void>;
  abstract complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  abstract embed(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse>;
  abstract testConnection(): Promise<LLMHealthCheckResult>;
  
  isHealthy(): boolean {
    return this._isHealthy;
  }
  
  getRateLimitStatus() {
    return { ...this.rateLimitState };
  }
  
  protected markHealthy(): void {
    this._isHealthy = true;
    this.consecutiveFailures = 0;
    this.lastHealthCheck = new Date();
  }
  
  protected markUnhealthy(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 3) {
      this._isHealthy = false;
    }
    this.lastHealthCheck = new Date();
  }
  
  protected updateRateLimits(headers: Record<string, string | undefined>): void {
    const remaining = headers['x-ratelimit-remaining-requests'];
    const tokensRemaining = headers['x-ratelimit-remaining-tokens'];
    const resetAt = headers['x-ratelimit-reset-requests'];
    
    if (remaining) this.rateLimitState.requestsRemaining = parseInt(remaining, 10);
    if (tokensRemaining) this.rateLimitState.tokensRemaining = parseInt(tokensRemaining, 10);
    if (resetAt) this.rateLimitState.resetsAt = new Date(resetAt);
  }
  
  /**
   * Sanitize request to ensure no sensitive data leaks
   */
  protected sanitizeRequest(request: LLMCompletionRequest): LLMCompletionRequest {
    // Remove any potential PII patterns from messages
    const sanitizedMessages = request.messages.map(msg => ({
      ...msg,
      content: this.redactSensitivePatterns(msg.content),
    }));
    
    return {
      ...request,
      messages: sanitizedMessages,
    };
  }
  
  /**
   * Redact sensitive patterns from text
   */
  protected redactSensitivePatterns(text: string): string {
    // Redact email addresses (but keep structure)
    let sanitized = text.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );
    
    // Redact phone numbers (Indian and international)
    sanitized = sanitized.replace(
      /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      '[PHONE_REDACTED]'
    );
    
    // Redact credit card numbers
    sanitized = sanitized.replace(
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      '[CARD_REDACTED]'
    );
    
    // Redact PAN numbers (Indian)
    sanitized = sanitized.replace(
      /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
      '[PAN_REDACTED]'
    );
    
    // Redact GST numbers (Indian)
    sanitized = sanitized.replace(
      /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][Z][A-Z\d]\b/g,
      '[GST_REDACTED]'
    );
    
    return sanitized;
  }
  
  /**
   * Parse JSON response safely
   */
  protected parseJsonResponse(content: string): Record<string, unknown> | null {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      
      // Try direct parse
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

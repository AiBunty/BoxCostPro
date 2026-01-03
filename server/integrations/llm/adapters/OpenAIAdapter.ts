/**
 * OpenAI LLM Provider Adapter
 * 
 * Implements ILLMProvider for OpenAI GPT models
 * Supports: GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo
 */

import {
  BaseLLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMEmbeddingRequest,
  LLMEmbeddingResponse,
  LLMHealthCheckResult,
  LLMProviderCode,
} from '../ILLMProvider';

export class OpenAIAdapter extends BaseLLMProvider {
  readonly providerCode: LLMProviderCode = 'openai';
  readonly providerName = 'OpenAI';
  readonly defaultModel = 'gpt-4o';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ];
  readonly supportsStreaming = true;
  readonly supportsJsonMode = true;
  readonly supportsEmbeddings = true;
  readonly maxContextTokens = 128000;
  
  private baseUrl = 'https://api.openai.com/v1';
  
  async initialize(config: LLMProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.config = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`OpenAI initialization failed: ${health.message}`);
    }
  }
  
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.config) {
      throw new Error('OpenAI provider not initialized');
    }
    
    const startTime = Date.now();
    const sanitizedRequest = this.sanitizeRequest(request);
    
    try {
      const model = request.model || this.defaultModel;
      
      const body: Record<string, unknown> = {
        model,
        messages: sanitizedRequest.messages,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      };
      
      if (request.topP !== undefined) {
        body.top_p = request.topP;
      }
      
      if (request.stopSequences?.length) {
        body.stop = request.stopSequences;
      }
      
      if (request.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId }),
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
        body: JSON.stringify(body),
      });
      
      const latencyMs = Date.now() - startTime;
      
      // Update rate limits from headers
      this.updateRateLimits({
        'x-ratelimit-remaining-requests': response.headers.get('x-ratelimit-remaining-requests') || undefined,
        'x-ratelimit-remaining-tokens': response.headers.get('x-ratelimit-remaining-tokens') || undefined,
        'x-ratelimit-reset-requests': response.headers.get('x-ratelimit-reset-requests') || undefined,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        return {
          success: false,
          content: '',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          model,
          finishReason: 'error',
          latencyMs,
          error: {
            code: errorData.error?.code || `HTTP_${response.status}`,
            message: errorData.error?.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      
      return {
        success: true,
        content,
        parsedJson: request.responseFormat === 'json' ? this.parseJsonResponse(content) || undefined : undefined,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        model: data.model || model,
        finishReason: this.mapFinishReason(choice?.finish_reason),
        latencyMs,
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.markUnhealthy();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('aborted');
      
      return {
        success: false,
        content: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: request.model || this.defaultModel,
        finishReason: 'error',
        latencyMs,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'REQUEST_FAILED',
          message: errorMessage,
          retryable: true,
        },
      };
    }
  }
  
  async embed(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse> {
    if (!this.config) {
      throw new Error('OpenAI provider not initialized');
    }
    
    const startTime = Date.now();
    const model = request.model || 'text-embedding-3-small';
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: request.input,
        }),
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          embeddings: [],
          model,
          totalTokens: 0,
          latencyMs,
          error: {
            code: errorData.error?.code || `HTTP_${response.status}`,
            message: errorData.error?.message || response.statusText,
          },
        };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
        model: data.model,
        totalTokens: data.usage?.total_tokens || 0,
        latencyMs,
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        embeddings: [],
        model,
        totalTokens: 0,
        latencyMs,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
  
  async testConnection(): Promise<LLMHealthCheckResult> {
    if (!this.config) {
      return {
        isHealthy: false,
        latencyMs: 0,
        message: 'Provider not initialized',
      };
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        this.markUnhealthy();
        return {
          isHealthy: false,
          latencyMs,
          message: `API returned ${response.status}: ${response.statusText}`,
        };
      }
      
      this.markHealthy();
      
      return {
        isHealthy: true,
        latencyMs,
        message: 'OpenAI API is reachable',
        details: {
          rateLimitRemaining: this.rateLimitState.requestsRemaining,
          rateLimitReset: this.rateLimitState.resetsAt || undefined,
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
  
  private mapFinishReason(reason: string): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'error';
    }
  }
}

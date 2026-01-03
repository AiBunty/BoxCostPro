/**
 * Anthropic Claude LLM Provider Adapter
 * 
 * Implements ILLMProvider for Anthropic Claude models
 * Supports: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
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

export class ClaudeAdapter extends BaseLLMProvider {
  readonly providerCode: LLMProviderCode = 'claude';
  readonly providerName = 'Anthropic Claude';
  readonly defaultModel = 'claude-sonnet-4-20250514';
  readonly supportedModels = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];
  readonly supportsStreaming = true;
  readonly supportsJsonMode = false; // Claude uses system prompts for JSON
  readonly supportsEmbeddings = false; // Claude doesn't have embeddings API
  readonly maxContextTokens = 200000;
  
  private baseUrl = 'https://api.anthropic.com';
  private apiVersion = '2023-06-01';
  
  async initialize(config: LLMProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    this.config = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    if (config.apiVersion) {
      this.apiVersion = config.apiVersion;
    }
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`Claude initialization failed: ${health.message}`);
    }
  }
  
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.config) {
      throw new Error('Claude provider not initialized');
    }
    
    const startTime = Date.now();
    const sanitizedRequest = this.sanitizeRequest(request);
    
    try {
      const model = request.model || this.defaultModel;
      
      // Separate system message from other messages (Claude API format)
      const systemMessage = sanitizedRequest.messages.find(m => m.role === 'system');
      const otherMessages = sanitizedRequest.messages.filter(m => m.role !== 'system');
      
      // Convert to Claude message format
      const claudeMessages = otherMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
      
      const body: Record<string, unknown> = {
        model,
        messages: claudeMessages,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      };
      
      if (systemMessage) {
        body.system = systemMessage.content;
      }
      
      if (request.topP !== undefined) {
        body.top_p = request.topP;
      }
      
      if (request.stopSequences?.length) {
        body.stop_sequences = request.stopSequences;
      }
      
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.apiVersion,
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
        body: JSON.stringify(body),
      });
      
      const latencyMs = Date.now() - startTime;
      
      // Update rate limits from headers
      this.updateRateLimits({
        'x-ratelimit-remaining-requests': response.headers.get('x-ratelimit-limit-requests') || undefined,
        'x-ratelimit-remaining-tokens': response.headers.get('x-ratelimit-limit-tokens') || undefined,
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
            code: errorData.error?.type || `HTTP_${response.status}`,
            message: errorData.error?.message || response.statusText,
            retryable: response.status >= 500 || response.status === 429 || response.status === 529,
          },
        };
      }
      
      const data = await response.json();
      this.markHealthy();
      
      // Extract text content from Claude's response format
      const content = data.content
        ?.filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('') || '';
      
      return {
        success: true,
        content,
        parsedJson: request.responseFormat === 'json' ? this.parseJsonResponse(content) || undefined : undefined,
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        model: data.model || model,
        finishReason: this.mapFinishReason(data.stop_reason),
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
  
  async embed(_request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse> {
    // Claude doesn't support embeddings natively
    // For embeddings, use OpenAI or a dedicated embedding service
    return {
      success: false,
      embeddings: [],
      model: 'n/a',
      totalTokens: 0,
      latencyMs: 0,
      error: {
        code: 'NOT_SUPPORTED',
        message: 'Claude does not support embeddings. Use OpenAI or another provider for embeddings.',
      },
    };
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
      // Claude doesn't have a dedicated health endpoint, so we make a minimal API call
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.apiVersion,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307', // Use cheapest model for health check
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.markUnhealthy();
        
        // 401 means bad API key, 529 means overloaded
        if (response.status === 401) {
          return {
            isHealthy: false,
            latencyMs,
            message: 'Invalid API key',
          };
        }
        
        return {
          isHealthy: false,
          latencyMs,
          message: errorData.error?.message || `API returned ${response.status}`,
        };
      }
      
      this.markHealthy();
      
      return {
        isHealthy: true,
        latencyMs,
        message: 'Claude API is reachable',
        details: {
          model: this.defaultModel,
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
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
  }
}

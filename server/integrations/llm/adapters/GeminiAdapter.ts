/**
 * Google Gemini LLM Provider Adapter
 * 
 * Implements ILLMProvider for Google Gemini models
 * Supports: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro
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

export class GeminiAdapter extends BaseLLMProvider {
  readonly providerCode: LLMProviderCode = 'gemini';
  readonly providerName = 'Google Gemini';
  readonly defaultModel = 'gemini-1.5-pro';
  readonly supportedModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-pro',
  ];
  readonly supportsStreaming = true;
  readonly supportsJsonMode = true;
  readonly supportsEmbeddings = true;
  readonly maxContextTokens = 1000000; // Gemini 1.5 Pro has 1M context
  
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  
  async initialize(config: LLMProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Google API key is required');
    }
    
    this.config = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`Gemini initialization failed: ${health.message}`);
    }
  }
  
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.config) {
      throw new Error('Gemini provider not initialized');
    }
    
    const startTime = Date.now();
    const sanitizedRequest = this.sanitizeRequest(request);
    
    try {
      const model = request.model || this.defaultModel;
      
      // Separate system instruction from messages
      const systemMessage = sanitizedRequest.messages.find(m => m.role === 'system');
      const otherMessages = sanitizedRequest.messages.filter(m => m.role !== 'system');
      
      // Convert to Gemini content format
      const contents = otherMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
      
      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          ...(request.topP !== undefined && { topP: request.topP }),
          ...(request.stopSequences?.length && { stopSequences: request.stopSequences }),
          ...(request.responseFormat === 'json' && { responseMimeType: 'application/json' }),
        },
      };
      
      if (systemMessage) {
        body.systemInstruction = {
          parts: [{ text: systemMessage.content }],
        };
      }
      
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout || 60000),
        body: JSON.stringify(body),
      });
      
      const latencyMs = Date.now() - startTime;
      
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
      
      // Extract content from Gemini's response format
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('') || '';
      
      const usageMetadata = data.usageMetadata || {};
      
      return {
        success: true,
        content,
        parsedJson: request.responseFormat === 'json' ? this.parseJsonResponse(content) || undefined : undefined,
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
        model,
        finishReason: this.mapFinishReason(candidate?.finishReason),
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
      throw new Error('Gemini provider not initialized');
    }
    
    const startTime = Date.now();
    const model = request.model || 'text-embedding-004';
    
    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];
      
      const url = `${this.baseUrl}/models/${model}:batchEmbedContents?key=${this.config.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: inputs.map(text => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          })),
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
        embeddings: data.embeddings?.map((e: { values: number[] }) => e.values) || [],
        model,
        totalTokens: 0, // Gemini doesn't return token count for embeddings
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
      // List models to verify API key works
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.config.apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
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
      
      this.markHealthy();
      
      return {
        isHealthy: true,
        latencyMs,
        message: 'Gemini API is reachable',
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
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'error';
    }
  }
}

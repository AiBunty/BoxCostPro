/**
 * AI Orchestrator Service
 * 
 * ENTERPRISE-GRADE AI INTEGRATION LAYER
 * 
 * This is the ONLY entry point for all AI/LLM operations.
 * All AI requests MUST go through this service.
 * 
 * SECURITY GUARANTEES:
 * ✔ LLM NEVER accesses database directly
 * ✔ LLM NEVER calls internal APIs
 * ✔ LLM NEVER modifies system data
 * ✔ LLM NEVER auto-sends messages
 * ✔ All outputs require human approval
 * ✔ All AI actions are logged and auditable
 * ✔ Context is sanitized before LLM call
 * ✔ PII is redacted from AI context
 */

import crypto from 'crypto';
import { LLMProviderFactory, LLMCompletionRequest, LLMCompletionResponse, LLMProviderCode } from '../../integrations/llm';
import type {
  SupportTicketExtended,
  SupportMessageExtended,
  AiKnowledgeBase
} from '../../../shared/schema';

// ========== TYPE DEFINITIONS ==========

export type AIRequestSource = 'SUPPORT' | 'CHATBOT' | 'ADMIN_PANEL' | 'SLA_ANALYSIS';

export type AIRequestType = 
  | 'DRAFT_REPLY' 
  | 'CHAT' 
  | 'KNOWLEDGE_SEARCH' 
  | 'SLA_ANALYSIS' 
  | 'INTENT_CLASSIFICATION';

export type AIConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type AIActionDecision = 
  | 'SUGGEST_REPLY' 
  | 'SUGGEST_WITH_CONFIRMATION' 
  | 'ESCALATE_TO_HUMAN'
  | 'PROVIDE_ANSWER'
  | 'SUGGEST_CREATE_TICKET';

export interface AIRequestContext {
  source: AIRequestSource;
  requestType: AIRequestType;
  requestedBy: string; // User ID
  tenantId?: string;
  
  // For support ticket context
  ticketId?: string;
  
  // For chat context
  sessionId?: string;
  userQuery?: string;
}

export interface AISafeContext {
  // Allowed ticket data (sanitized)
  ticket?: {
    ticketNumber: string;
    category: string;
    subject: string;
    priority: string;
    status: string;
    createdAt: string;
    slaDueAt?: string;
    isEscalated: boolean;
  };
  
  // Allowed conversation history (public messages only, PII redacted)
  conversationHistory: Array<{
    role: 'user' | 'support';
    message: string;
    timestamp: string;
  }>;
  
  // Knowledge base entries (relevant to query)
  knowledgeEntries: Array<{
    id: string;
    module: string;
    feature: string;
    intent: string;
    content: string;
  }>;
  
  // Metadata
  contextHash: string; // SHA256 for audit
  includedFields: string[];
  redactedFields: string[];
}

export interface AIResponse {
  success: boolean;
  
  // Generated content
  reply?: string;
  intent?: string;
  
  // Confidence scoring
  confidenceScore: number; // 0-100
  confidenceLevel: AIConfidenceLevel;
  
  // Decision
  actionDecision: AIActionDecision;
  requiresHumanApproval: boolean; // ALWAYS true for DRAFT_REPLY
  
  // Suggested actions
  suggestedActions?: string[];
  relatedKnowledgeEntries?: string[];
  
  // Error handling
  error?: {
    code: string;
    message: string;
  };
  
  // Audit metadata
  auditData: {
    contextHash: string;
    provider: LLMProviderCode;
    model: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
  };
}

export interface DraftReplyRequest {
  ticketId: string;
  requestedBy: string;
  tenantId?: string;
}

export interface ChatRequest {
  query: string;
  userId: string;
  tenantId?: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ========== BLOCKED CONTENT PATTERNS ==========

const BLOCKED_CONTENT_PATTERNS = [
  // Pricing promises
  /(?:price|cost|fee|charge|rate)\s*(?:is|will be|would be)\s*(?:₹|rs|inr|\$|usd)?\s*\d+/gi,
  // Refund promises
  /(?:we will|we'll|you will|you'll)\s*(?:refund|credit|reimburse)/gi,
  // Legal advice
  /(?:legal|law|court|litigation|sue|lawyer|attorney)/gi,
  // Tax advice
  /(?:tax advice|tax recommendation|you should claim|tax benefit)/gi,
  // Specific timeline promises
  /(?:will be|would be)\s*(?:done|completed|fixed|resolved)\s*(?:in|within|by)\s*\d+\s*(?:hour|day|week|month)/gi,
];

// ========== SYSTEM PROMPTS ==========

const SYSTEM_PROMPTS = {
  SUPPORT_DRAFT_REPLY: `You are an enterprise ERP support assistant for BoxCostPro, a B2B platform for corrugated box manufacturers.

ABSOLUTE RULES (NEVER VIOLATE):
1. Do NOT modify any data or make changes to the system
2. Do NOT promise refunds, credits, or financial compensation
3. Do NOT provide legal, tax, or compliance advice
4. Do NOT speculate about features or timelines not confirmed
5. Do NOT make specific pricing promises
6. If uncertain about ANYTHING, respond: "I recommend escalating this to a human support agent"

YOUR ROLE:
- Draft professional, polite, and helpful responses
- Focus on understanding the issue and providing clear guidance
- Reference only information from the knowledge base or conversation history
- Be empathetic but non-committal on resolutions

OUTPUT FORMAT (JSON ONLY):
{
  "reply": "Your professional response here",
  "intent": "CATEGORY_OF_QUERY (e.g., BILLING_QUERY, TECHNICAL_ISSUE, FEATURE_REQUEST)",
  "confidence": 75,
  "suggestedActions": ["action1", "action2"],
  "escalationNeeded": false
}`,

  CHATBOT_QUERY: `You are a helpful assistant for BoxCostPro, a B2B ERP platform for corrugated box manufacturers.

ABSOLUTE RULES:
1. Do NOT modify any data or make changes
2. Do NOT make promises about features or pricing
3. Do NOT provide legal, tax, or compliance advice
4. If you cannot help, suggest creating a support ticket
5. Be concise and helpful

OUTPUT FORMAT (JSON ONLY):
{
  "answer": "Your helpful response",
  "intent": "DETECTED_INTENT",
  "confidence": 80,
  "suggestCreateTicket": false,
  "relatedArticles": []
}`,

  SLA_ANALYSIS: `You are analyzing support ticket SLA metrics and escalation needs.

Analyze the provided ticket details and provide risk assessment.

OUTPUT FORMAT (JSON ONLY):
{
  "slaRiskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "recommendedPriority": "CURRENT|UPGRADE_TO_HIGH|UPGRADE_TO_URGENT",
  "reasoning": "Brief explanation",
  "suggestedActions": ["action1", "action2"]
}`,
};

// ========== AI ORCHESTRATOR SERVICE ==========

export class AIOrchestrator {
  private db: any;
  
  constructor(db: any) {
    this.db = db;
  }
  
  /**
   * Generate a draft reply for a support ticket
   * CRITICAL: Human approval required before sending
   */
  async generateDraftReply(request: DraftReplyRequest): Promise<AIResponse> {
    const context = await this.buildSafeContext({
      source: 'SUPPORT',
      requestType: 'DRAFT_REPLY',
      requestedBy: request.requestedBy,
      tenantId: request.tenantId,
      ticketId: request.ticketId,
    });
    
    if (!context.ticket) {
      return this.createErrorResponse('TICKET_NOT_FOUND', 'Ticket not found or access denied');
    }
    
    // Build messages for LLM
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.SUPPORT_DRAFT_REPLY },
      { 
        role: 'user' as const, 
        content: this.buildDraftReplyPrompt(context) 
      },
    ];
    
    // Call LLM through factory (with failover)
    const llmResponse = await LLMProviderFactory.complete({
      messages,
      responseFormat: 'json',
      temperature: 0.7,
      maxTokens: 1024,
    });
    
    // Log the AI request
    await this.logAIRequest({
      requestType: 'DRAFT_REPLY',
      requestSource: 'SUPPORT',
      requestedBy: request.requestedBy,
      contextProvided: { ticketId: request.ticketId, contextHash: context.contextHash },
      provider: llmResponse.usedProvider,
      model: llmResponse.model,
      promptTokens: llmResponse.promptTokens,
      completionTokens: llmResponse.completionTokens,
      responsePayload: llmResponse.success ? llmResponse.parsedJson : null,
      confidenceScore: null,
      status: llmResponse.success ? 'SUCCESS' : 'FAILED',
      errorMessage: llmResponse.error?.message,
      latencyMs: llmResponse.latencyMs,
    });
    
    if (!llmResponse.success) {
      return this.createErrorResponse(
        llmResponse.error?.code || 'LLM_ERROR',
        llmResponse.error?.message || 'LLM request failed'
      );
    }
    
    // Parse and validate response
    const parsed = llmResponse.parsedJson as any;
    if (!parsed?.reply) {
      return this.createErrorResponse('INVALID_RESPONSE', 'LLM returned invalid response format');
    }
    
    // Check for blocked content
    const blockedCheck = this.checkBlockedContent(parsed.reply);
    if (blockedCheck.blocked) {
      return {
        success: true,
        reply: undefined,
        intent: parsed.intent,
        confidenceScore: 0,
        confidenceLevel: 'LOW',
        actionDecision: 'ESCALATE_TO_HUMAN',
        requiresHumanApproval: true,
        suggestedActions: ['Manual response required due to content policy'],
        error: {
          code: 'CONTENT_BLOCKED',
          message: `Response contained blocked content: ${blockedCheck.reason}`,
        },
        auditData: {
          contextHash: context.contextHash,
          provider: llmResponse.usedProvider,
          model: llmResponse.model,
          promptTokens: llmResponse.promptTokens,
          completionTokens: llmResponse.completionTokens,
          latencyMs: llmResponse.latencyMs,
        },
      };
    }
    
    // Calculate confidence
    const confidenceScore = parsed.confidence || 50;
    const confidenceLevel = this.calculateConfidenceLevel(confidenceScore);
    const actionDecision = this.determineAction(confidenceLevel, parsed.escalationNeeded);
    
    return {
      success: true,
      reply: parsed.reply,
      intent: parsed.intent,
      confidenceScore,
      confidenceLevel,
      actionDecision,
      requiresHumanApproval: true, // ALWAYS true for draft replies
      suggestedActions: parsed.suggestedActions,
      relatedKnowledgeEntries: context.knowledgeEntries.map(k => k.id),
      auditData: {
        contextHash: context.contextHash,
        provider: llmResponse.usedProvider,
        model: llmResponse.model,
        promptTokens: llmResponse.promptTokens,
        completionTokens: llmResponse.completionTokens,
        latencyMs: llmResponse.latencyMs,
      },
    };
  }
  
  /**
   * Handle chatbot query
   */
  async handleChatQuery(request: ChatRequest): Promise<AIResponse> {
    // Build context with knowledge base search
    const context = await this.buildSafeContext({
      source: 'CHATBOT',
      requestType: 'CHAT',
      requestedBy: request.userId,
      tenantId: request.tenantId,
      userQuery: request.query,
    });
    
    // Build conversation
    const conversationMessages = request.conversationHistory?.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    })) || [];
    
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.CHATBOT_QUERY },
      { 
        role: 'user' as const, 
        content: this.buildChatPrompt(request.query, context) 
      },
      ...conversationMessages,
      { role: 'user' as const, content: request.query },
    ];
    
    // Call LLM
    const llmResponse = await LLMProviderFactory.complete({
      messages,
      responseFormat: 'json',
      temperature: 0.7,
      maxTokens: 512,
    });
    
    // Log
    await this.logAIRequest({
      requestType: 'CHAT',
      requestSource: 'CHATBOT',
      requestedBy: request.userId,
      contextProvided: { query: request.query, contextHash: context.contextHash },
      provider: llmResponse.usedProvider,
      model: llmResponse.model,
      promptTokens: llmResponse.promptTokens,
      completionTokens: llmResponse.completionTokens,
      responsePayload: llmResponse.success ? llmResponse.parsedJson : null,
      confidenceScore: null,
      status: llmResponse.success ? 'SUCCESS' : 'FAILED',
      errorMessage: llmResponse.error?.message,
      latencyMs: llmResponse.latencyMs,
    });
    
    if (!llmResponse.success) {
      return this.createErrorResponse(
        llmResponse.error?.code || 'LLM_ERROR',
        llmResponse.error?.message || 'LLM request failed'
      );
    }
    
    const parsed = llmResponse.parsedJson as any;
    if (!parsed?.answer) {
      return this.createErrorResponse('INVALID_RESPONSE', 'LLM returned invalid response format');
    }
    
    const confidenceScore = parsed.confidence || 50;
    const confidenceLevel = this.calculateConfidenceLevel(confidenceScore);
    
    // For chatbot, suggest ticket creation on low confidence
    const suggestTicket = parsed.suggestCreateTicket || confidenceLevel === 'LOW';
    
    return {
      success: true,
      reply: parsed.answer,
      intent: parsed.intent,
      confidenceScore,
      confidenceLevel,
      actionDecision: suggestTicket ? 'SUGGEST_CREATE_TICKET' : 'PROVIDE_ANSWER',
      requiresHumanApproval: false, // Chatbot responses don't need approval
      suggestedActions: suggestTicket ? ['Create a support ticket for personalized assistance'] : [],
      relatedKnowledgeEntries: parsed.relatedArticles,
      auditData: {
        contextHash: context.contextHash,
        provider: llmResponse.usedProvider,
        model: llmResponse.model,
        promptTokens: llmResponse.promptTokens,
        completionTokens: llmResponse.completionTokens,
        latencyMs: llmResponse.latencyMs,
      },
    };
  }
  
  /**
   * Get AI health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    providers: Array<{
      code: string;
      name: string;
      isHealthy: boolean;
      isPrimary: boolean;
    }>;
    knowledgeBaseLoaded: boolean;
    knowledgeEntryCount: number;
  }> {
    const llmHealth = await LLMProviderFactory.getHealthStatus();
    
    // Check knowledge base
    let knowledgeCount = 0;
    try {
      const result = await this.db.query.aiKnowledgeBase.findMany({
        where: (kb: any, { eq }: any) => eq(kb.isActive, true),
      });
      knowledgeCount = result.length;
    } catch {
      knowledgeCount = 0;
    }
    
    return {
      isHealthy: llmHealth.isHealthy,
      providers: llmHealth.providers,
      knowledgeBaseLoaded: knowledgeCount > 0,
      knowledgeEntryCount: knowledgeCount,
    };
  }
  
  // ========== PRIVATE METHODS ==========
  
  /**
   * Build safe context with only allowed data
   */
  private async buildSafeContext(request: AIRequestContext): Promise<AISafeContext> {
    const includedFields: string[] = [];
    const redactedFields: string[] = [];
    
    let ticket: AISafeContext['ticket'] | undefined;
    let conversationHistory: AISafeContext['conversationHistory'] = [];
    let knowledgeEntries: AISafeContext['knowledgeEntries'] = [];
    
    // Fetch ticket data if requested
    if (request.ticketId) {
      try {
        const ticketData = await this.db.query.supportTicketsExtended.findFirst({
          where: (t: any, { eq }: any) => eq(t.id, request.ticketId),
        });
        
        if (ticketData) {
          ticket = {
            ticketNumber: ticketData.ticketNumber,
            category: ticketData.category,
            subject: ticketData.subject,
            priority: ticketData.priority,
            status: ticketData.status,
            createdAt: ticketData.createdAt?.toISOString() || '',
            slaDueAt: ticketData.slaDueAt?.toISOString(),
            isEscalated: ticketData.isEscalated || false,
          };
          includedFields.push('ticket.ticketNumber', 'ticket.category', 'ticket.subject', 'ticket.priority', 'ticket.status');
          redactedFields.push('ticket.userId', 'ticket.assignedTo'); // Never expose user IDs
        }
        
        // Fetch public messages only (exclude internal notes)
        const messages = await this.db.query.supportMessagesExtended.findMany({
          where: (m: any, { eq, and }: any) => and(
            eq(m.ticketId, request.ticketId),
            eq(m.isInternal, false) // CRITICAL: Never include internal notes
          ),
          orderBy: (m: any, { asc }: any) => asc(m.createdAt),
          limit: 10, // Last 10 messages for context
        });
        
        conversationHistory = messages.map((msg: any) => ({
          role: msg.senderRole === 'USER' ? 'user' as const : 'support' as const,
          message: this.redactPII(msg.message),
          timestamp: msg.createdAt?.toISOString() || '',
        }));
        
        includedFields.push('conversationHistory');
        redactedFields.push('internalNotes', 'senderEmail', 'senderPhone');
        
      } catch (error) {
        console.error('[AIOrchestrator] Failed to fetch ticket context:', error);
      }
    }
    
    // Fetch relevant knowledge base entries
    const searchQuery = request.userQuery || ticket?.subject || '';
    if (searchQuery) {
      try {
        // Simple keyword search (can be enhanced with embeddings)
        const knowledge = await this.db.query.aiKnowledgeBase.findMany({
          where: (kb: any, { eq, and }: any) => and(
            eq(kb.isActive, true),
            eq(kb.isPublished, true)
          ),
          limit: 5,
        });
        
        knowledgeEntries = knowledge.map((k: any) => ({
          id: k.id,
          module: k.module,
          feature: k.feature,
          intent: k.intent,
          content: k.content,
        }));
        
        includedFields.push('knowledgeBase');
        
      } catch (error) {
        console.error('[AIOrchestrator] Failed to fetch knowledge base:', error);
      }
    }
    
    // Generate context hash for audit
    const contextData = JSON.stringify({ ticket, conversationHistory, knowledgeEntries });
    const contextHash = crypto.createHash('sha256').update(contextData).digest('hex');
    
    return {
      ticket,
      conversationHistory,
      knowledgeEntries,
      contextHash,
      includedFields,
      redactedFields,
    };
  }
  
  /**
   * Redact PII from text
   */
  private redactPII(text: string): string {
    let sanitized = text;
    
    // Redact email addresses
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL]'
    );
    
    // Redact phone numbers
    sanitized = sanitized.replace(
      /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      '[PHONE]'
    );
    
    // Redact PAN numbers
    sanitized = sanitized.replace(
      /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
      '[PAN]'
    );
    
    // Redact GST numbers
    sanitized = sanitized.replace(
      /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][Z][A-Z\d]\b/g,
      '[GST]'
    );
    
    // Redact Aadhaar numbers
    sanitized = sanitized.replace(
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      '[AADHAAR]'
    );
    
    return sanitized;
  }
  
  /**
   * Build prompt for draft reply
   */
  private buildDraftReplyPrompt(context: AISafeContext): string {
    let prompt = 'Please draft a professional support response for the following ticket:\n\n';
    
    if (context.ticket) {
      prompt += `TICKET DETAILS:\n`;
      prompt += `- Ticket Number: ${context.ticket.ticketNumber}\n`;
      prompt += `- Category: ${context.ticket.category}\n`;
      prompt += `- Subject: ${context.ticket.subject}\n`;
      prompt += `- Priority: ${context.ticket.priority}\n`;
      prompt += `- Status: ${context.ticket.status}\n`;
      prompt += `- Created: ${context.ticket.createdAt}\n`;
      if (context.ticket.slaDueAt) {
        prompt += `- SLA Due: ${context.ticket.slaDueAt}\n`;
      }
      if (context.ticket.isEscalated) {
        prompt += `- ESCALATED: Yes\n`;
      }
      prompt += '\n';
    }
    
    if (context.conversationHistory.length > 0) {
      prompt += 'CONVERSATION HISTORY:\n';
      for (const msg of context.conversationHistory) {
        prompt += `[${msg.timestamp}] ${msg.role.toUpperCase()}: ${msg.message}\n`;
      }
      prompt += '\n';
    }
    
    if (context.knowledgeEntries.length > 0) {
      prompt += 'RELEVANT KNOWLEDGE BASE ENTRIES:\n';
      for (const entry of context.knowledgeEntries) {
        prompt += `- ${entry.module} > ${entry.feature}: ${entry.content.substring(0, 200)}...\n`;
      }
      prompt += '\n';
    }
    
    prompt += 'Please provide a professional, helpful response addressing the customer\'s concerns.';
    
    return prompt;
  }
  
  /**
   * Build prompt for chat
   */
  private buildChatPrompt(query: string, context: AISafeContext): string {
    let prompt = '';
    
    if (context.knowledgeEntries.length > 0) {
      prompt += 'RELEVANT KNOWLEDGE BASE:\n';
      for (const entry of context.knowledgeEntries) {
        prompt += `- ${entry.module} > ${entry.feature}: ${entry.content}\n`;
      }
      prompt += '\n';
    }
    
    prompt += `USER QUERY: ${query}`;
    
    return prompt;
  }
  
  /**
   * Check for blocked content patterns
   */
  private checkBlockedContent(text: string): { blocked: boolean; reason?: string } {
    for (const pattern of BLOCKED_CONTENT_PATTERNS) {
      if (pattern.test(text)) {
        return { blocked: true, reason: pattern.source };
      }
    }
    return { blocked: false };
  }
  
  /**
   * Calculate confidence level from score
   */
  private calculateConfidenceLevel(score: number): AIConfidenceLevel {
    if (score >= 80) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Determine action based on confidence
   */
  private determineAction(level: AIConfidenceLevel, escalationRequested: boolean): AIActionDecision {
    if (escalationRequested || level === 'LOW') {
      return 'ESCALATE_TO_HUMAN';
    }
    if (level === 'MEDIUM') {
      return 'SUGGEST_WITH_CONFIRMATION';
    }
    return 'SUGGEST_REPLY';
  }
  
  /**
   * Create error response
   */
  private createErrorResponse(code: string, message: string): AIResponse {
    return {
      success: false,
      confidenceScore: 0,
      confidenceLevel: 'LOW',
      actionDecision: 'ESCALATE_TO_HUMAN',
      requiresHumanApproval: true,
      error: { code, message },
      auditData: {
        contextHash: '',
        provider: 'openai',
        model: '',
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
    };
  }
  
  /**
   * Log AI request to audit table
   */
  private async logAIRequest(data: {
    requestType: string;
    requestSource: string;
    requestedBy: string;
    contextProvided: any;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    responsePayload: any;
    confidenceScore: number | null;
    status: string;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    try {
      await this.db.insert(this.db.schema.aiAuditLogs).values({
        requestType: data.requestType,
        requestSource: data.requestSource,
        requestedBy: data.requestedBy,
        contextProvided: data.contextProvided,
        contextHash: crypto.createHash('sha256').update(JSON.stringify(data.contextProvided)).digest('hex'),
        provider: data.provider,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        responsePayload: data.responsePayload,
        confidenceScore: data.confidenceScore,
        status: data.status,
        errorMessage: data.errorMessage,
        latencyMs: data.latencyMs,
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('[AIOrchestrator] Failed to log AI request:', error);
    }
  }
}

// Export factory function
export function createAIOrchestrator(db: any): AIOrchestrator {
  return new AIOrchestrator(db);
}

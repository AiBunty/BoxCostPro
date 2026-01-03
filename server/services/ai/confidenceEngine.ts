/**
 * AI Confidence & Decision Engine
 * 
 * Handles confidence scoring, decision logic, and
 * stores AI response confidence records for audit.
 */

import type { AiResponseConfidence, InsertAiResponseConfidence } from '../../../shared/schema';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionTaken = 'AUTO_REPLY' | 'SUGGEST_TICKET' | 'ESCALATE_TO_HUMAN' | 'DRAFT_CREATED';

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  actionTaken: ActionTaken;
  reasoning: string;
}

export interface ConfidenceFactors {
  // From AI response
  aiReportedConfidence: number;
  
  // From knowledge base matching
  knowledgeMatchScore?: number;
  knowledgeEntriesUsed: string[];
  
  // From intent classification
  intentClarity?: number;
  
  // From conversation context
  conversationLength?: number;
  hasEscalationKeywords?: boolean;
}

/**
 * Calculate confidence level from score
 */
export function calculateConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate overall confidence score from multiple factors
 */
export function calculateConfidenceScore(factors: ConfidenceFactors): ConfidenceResult {
  let score = factors.aiReportedConfidence;
  let reasoning = `Base AI confidence: ${factors.aiReportedConfidence}%`;
  
  // Adjust based on knowledge base matching
  if (factors.knowledgeMatchScore !== undefined) {
    const kbBoost = factors.knowledgeMatchScore > 0.8 ? 10 : 
                    factors.knowledgeMatchScore > 0.5 ? 5 : 0;
    score += kbBoost;
    if (kbBoost > 0) {
      reasoning += `. KB match boost: +${kbBoost}%`;
    }
  }
  
  // Boost for using knowledge entries
  if (factors.knowledgeEntriesUsed.length > 0) {
    const entryBoost = Math.min(factors.knowledgeEntriesUsed.length * 3, 10);
    score += entryBoost;
    reasoning += `. Used ${factors.knowledgeEntriesUsed.length} KB entries: +${entryBoost}%`;
  }
  
  // Penalize for escalation keywords
  if (factors.hasEscalationKeywords) {
    score -= 20;
    reasoning += `. Escalation keywords detected: -20%`;
  }
  
  // Penalize for very short conversations (might lack context)
  if (factors.conversationLength !== undefined && factors.conversationLength < 2) {
    score -= 5;
    reasoning += `. Limited conversation context: -5%`;
  }
  
  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));
  
  const level = calculateConfidenceLevel(score);
  const actionTaken = determineAction(level, factors.hasEscalationKeywords || false);
  
  return {
    score,
    level,
    actionTaken,
    reasoning,
  };
}

/**
 * Determine action based on confidence level
 */
export function determineAction(level: ConfidenceLevel, escalationRequested: boolean): ActionTaken {
  if (escalationRequested) {
    return 'ESCALATE_TO_HUMAN';
  }
  
  switch (level) {
    case 'HIGH':
      return 'DRAFT_CREATED'; // Suggest reply with high confidence
    case 'MEDIUM':
      return 'DRAFT_CREATED'; // Suggest reply but emphasize review
    case 'LOW':
      return 'ESCALATE_TO_HUMAN'; // Must escalate
  }
}

/**
 * Check for escalation keywords in text
 */
export function hasEscalationKeywords(text: string): boolean {
  const escalationPatterns = [
    /\burgent\b/i,
    /\bescalate\b/i,
    /\bmanager\b/i,
    /\bsupervisor\b/i,
    /\blegal\b/i,
    /\blawyer\b/i,
    /\bcourt\b/i,
    /\bfraud\b/i,
    /\bscam\b/i,
    /\bpolice\b/i,
    /\bcomplaint\b/i,
    /\bdissatisfied\b/i,
    /\bunacceptable\b/i,
    /\brefund\b.*\bimmediately\b/i,
    /\bcancel\b.*\bsubscription\b/i,
  ];
  
  return escalationPatterns.some(pattern => pattern.test(text));
}

/**
 * Service for storing and retrieving confidence records
 */
export class ConfidenceService {
  constructor(private db: any) {}
  
  /**
   * Store AI response confidence record
   */
  async storeConfidence(data: {
    ticketId?: string;
    messageId?: string;
    aiIntent?: string;
    confidenceScore: number;
    confidenceLevel: ConfidenceLevel;
    actionTaken: ActionTaken;
    aiDraftResponse?: string;
    knowledgeEntriesUsed: string[];
  }): Promise<string> {
    const result = await this.db.insert(this.db.schema.aiResponseConfidence).values({
      ticketId: data.ticketId,
      messageId: data.messageId,
      aiIntent: data.aiIntent,
      confidenceScore: data.confidenceScore,
      confidenceLevel: data.confidenceLevel,
      actionTaken: data.actionTaken,
      aiDraftResponse: data.aiDraftResponse,
      knowledgeEntriesUsed: data.knowledgeEntriesUsed,
      humanReviewed: false,
    }).returning({ id: this.db.schema.aiResponseConfidence.id });
    
    return result[0].id;
  }
  
  /**
   * Record human review of AI response
   */
  async recordHumanReview(
    confidenceId: string,
    reviewedBy: string,
    approved: boolean,
    modifiedResponse?: string
  ): Promise<void> {
    await this.db.update(this.db.schema.aiResponseConfidence)
      .set({
        humanReviewed: true,
        humanReviewedBy: reviewedBy,
        humanReviewedAt: new Date(),
        humanApproved: approved,
        humanModifiedResponse: modifiedResponse,
      })
      .where(this.db.eq(this.db.schema.aiResponseConfidence.id, confidenceId));
  }
  
  /**
   * Get confidence records for a ticket
   */
  async getConfidenceByTicket(ticketId: string): Promise<AiResponseConfidence[]> {
    return this.db.query.aiResponseConfidence.findMany({
      where: (c: any, { eq }: any) => eq(c.ticketId, ticketId),
      orderBy: (c: any, { desc }: any) => desc(c.createdAt),
    });
  }
  
  /**
   * Get AI performance metrics
   */
  async getPerformanceMetrics(dateFrom?: Date, dateTo?: Date): Promise<{
    totalRequests: number;
    avgConfidenceScore: number;
    confidenceDistribution: { HIGH: number; MEDIUM: number; LOW: number };
    humanApprovalRate: number;
    escalationRate: number;
  }> {
    // This would be a complex aggregation query
    // Simplified version for now
    const records = await this.db.query.aiResponseConfidence.findMany({
      limit: 1000,
      orderBy: (c: any, { desc }: any) => desc(c.createdAt),
    });
    
    if (records.length === 0) {
      return {
        totalRequests: 0,
        avgConfidenceScore: 0,
        confidenceDistribution: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        humanApprovalRate: 0,
        escalationRate: 0,
      };
    }
    
    const totalRequests = records.length;
    const avgConfidenceScore = records.reduce((sum: number, r: any) => sum + r.confidenceScore, 0) / totalRequests;
    
    const confidenceDistribution = {
      HIGH: records.filter((r: any) => r.confidenceLevel === 'HIGH').length,
      MEDIUM: records.filter((r: any) => r.confidenceLevel === 'MEDIUM').length,
      LOW: records.filter((r: any) => r.confidenceLevel === 'LOW').length,
    };
    
    const reviewed = records.filter((r: any) => r.humanReviewed);
    const approved = reviewed.filter((r: any) => r.humanApproved);
    const humanApprovalRate = reviewed.length > 0 ? (approved.length / reviewed.length) * 100 : 0;
    
    const escalations = records.filter((r: any) => r.actionTaken === 'ESCALATE_TO_HUMAN');
    const escalationRate = (escalations.length / totalRequests) * 100;
    
    return {
      totalRequests,
      avgConfidenceScore,
      confidenceDistribution,
      humanApprovalRate,
      escalationRate,
    };
  }
}

export function createConfidenceService(db: any): ConfidenceService {
  return new ConfidenceService(db);
}

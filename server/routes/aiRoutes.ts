/**
 * AI Services API Routes
 * 
 * REST endpoints for:
 * - AI-assisted reply drafting (human approval required)
 * - Chatbot queries
 * - Knowledge base management
 * - AI configuration and prompts
 * - Confidence scoring and metrics
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { 
  generateDraftReply, 
  handleChatQuery,
  generateSLAAnalysis,
} from '../services/ai/aiOrchestrator';
import {
  calculateConfidence,
  shouldEscalateToHuman,
  getConfidenceMetrics,
} from '../services/ai/confidenceEngine';
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  publishKnowledgeEntry,
  rollbackKnowledgeEntry,
  getKnowledgeEntry,
  listKnowledgeEntries,
  searchKnowledgeBase,
  getRelatedKnowledge,
} from '../services/ai/knowledgeBaseService';

const router = Router();

// All AI routes require authentication
router.use(requireAuth);

// ============================================
// AI Draft Reply (Support Agents)
// ============================================

/**
 * POST /api/ai/draft-reply
 * Generate a draft reply for a support ticket
 * Returns draft for human review - NEVER auto-sends
 */
router.post('/draft-reply', requireRole(['support_agent', 'support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { ticketId, recentMessages, userContext } = req.body;
    const userId = (req as any).userId;
    
    if (!ticketId) {
      return res.status(400).json({
        success: false,
        error: 'ticketId is required',
      });
    }
    
    const result = await generateDraftReply({
      ticketId,
      recentMessages: recentMessages || [],
      userContext,
      requestedBy: {
        userId,
        role: (req as any).userRole || 'support_agent',
      },
    });
    
    res.json({
      success: true,
      data: {
        draftReply: result.draftReply,
        confidence: result.confidence,
        suggestedCategory: result.suggestedCategory,
        requiresEscalation: result.requiresEscalation,
        escalationReason: result.escalationReason,
        knowledgeUsed: result.knowledgeUsed,
        // Important: This is a DRAFT - agent must review and approve
        status: 'DRAFT_PENDING_APPROVAL',
      },
    });
  } catch (error) {
    console.error('[AI API] Draft reply failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate draft',
    });
  }
});

// ============================================
// AI Chatbot (User-Facing)
// ============================================

/**
 * POST /api/ai/chat
 * Handle a user chatbot query
 * May suggest creating a ticket if can't resolve
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { query, sessionId, context } = req.body;
    const userId = (req as any).userId;
    const tenantId = (req as any).tenantId;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required',
      });
    }
    
    const result = await handleChatQuery({
      query,
      userId,
      tenantId,
      sessionId,
      context,
    });
    
    res.json({
      success: true,
      data: {
        response: result.response,
        confidence: result.confidence,
        suggestCreateTicket: result.suggestCreateTicket,
        suggestedTicketCategory: result.suggestedTicketCategory,
        relatedArticles: result.relatedArticles,
      },
    });
  } catch (error) {
    console.error('[AI API] Chat query failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
    });
  }
});

// ============================================
// SLA Analysis
// ============================================

/**
 * POST /api/ai/sla-analysis
 * Get AI analysis of SLA situation for a ticket
 */
router.post('/sla-analysis', requireRole(['support_agent', 'support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { ticketId, slaData } = req.body;
    const userId = (req as any).userId;
    
    if (!ticketId || !slaData) {
      return res.status(400).json({
        success: false,
        error: 'ticketId and slaData are required',
      });
    }
    
    const result = await generateSLAAnalysis({
      ticketId,
      slaData,
      requestedBy: {
        userId,
        role: (req as any).userRole || 'support_agent',
      },
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[AI API] SLA analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA analysis',
    });
  }
});

// ============================================
// Knowledge Base Management (Admin)
// ============================================

/**
 * GET /api/ai/knowledge
 * List knowledge base entries
 */
router.get('/knowledge', requireRole(['support_agent', 'support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { category, status, search, limit, offset } = req.query;
    
    const entries = await listKnowledgeEntries({
      category: category as string,
      status: status as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    
    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error('[AI API] Knowledge list failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list knowledge entries',
    });
  }
});

/**
 * GET /api/ai/knowledge/:id
 * Get a specific knowledge entry
 */
router.get('/knowledge/:id', requireRole(['support_agent', 'support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getKnowledgeEntry(id);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry not found',
      });
    }
    
    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[AI API] Knowledge fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get knowledge entry',
    });
  }
});

/**
 * POST /api/ai/knowledge
 * Create a new knowledge entry
 */
router.post('/knowledge', requireRole(['support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { title, category, content, keywords, intents } = req.body;
    const userId = (req as any).userId;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'title and content are required',
      });
    }
    
    const entry = await createKnowledgeEntry({
      title,
      category,
      content,
      keywords: keywords || [],
      intents: intents || [],
      createdBy: userId,
    });
    
    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[AI API] Knowledge create failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create knowledge entry',
    });
  }
});

/**
 * PUT /api/ai/knowledge/:id
 * Update a knowledge entry
 */
router.put('/knowledge/:id', requireRole(['support_manager', 'admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, category, content, keywords, intents } = req.body;
    const userId = (req as any).userId;
    
    const entry = await updateKnowledgeEntry(id, {
      title,
      category,
      content,
      keywords,
      intents,
      updatedBy: userId,
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry not found',
      });
    }
    
    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[AI API] Knowledge update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge entry',
    });
  }
});

/**
 * POST /api/ai/knowledge/:id/publish
 * Publish a knowledge entry
 */
router.post('/knowledge/:id/publish', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = (req as any).userId;
    
    const entry = await publishKnowledgeEntry(id, userId);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry not found',
      });
    }
    
    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[AI API] Knowledge publish failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish knowledge entry',
    });
  }
});

/**
 * POST /api/ai/knowledge/:id/rollback
 * Rollback a knowledge entry to previous version
 */
router.post('/knowledge/:id/rollback', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { toVersion } = req.body;
    const userId = (req as any).userId;
    
    if (!toVersion) {
      return res.status(400).json({
        success: false,
        error: 'toVersion is required',
      });
    }
    
    const entry = await rollbackKnowledgeEntry(id, toVersion, userId);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry or version not found',
      });
    }
    
    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('[AI API] Knowledge rollback failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback knowledge entry',
    });
  }
});

/**
 * GET /api/ai/knowledge/search
 * Search knowledge base
 */
router.get('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }
    
    const results = await searchKnowledgeBase(
      q as string,
      category as string,
      limit ? parseInt(limit as string, 10) : 10
    );
    
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[AI API] Knowledge search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge base',
    });
  }
});

/**
 * GET /api/ai/knowledge/:id/related
 * Get related knowledge entries
 */
router.get('/knowledge/:id/related', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { limit } = req.query;
    
    const related = await getRelatedKnowledge(
      id,
      limit ? parseInt(limit as string, 10) : 5
    );
    
    res.json({
      success: true,
      data: related,
    });
  } catch (error) {
    console.error('[AI API] Related knowledge failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get related knowledge',
    });
  }
});

// ============================================
// AI Confidence & Metrics
// ============================================

/**
 * GET /api/ai/metrics
 * Get AI performance metrics
 */
router.get('/metrics', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const metrics = await getConfidenceMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[AI API] Metrics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI metrics',
    });
  }
});

/**
 * POST /api/ai/evaluate-confidence
 * Evaluate confidence for a response (for testing)
 */
router.post('/evaluate-confidence', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { response, category, knowledgeMatches } = req.body;
    
    const confidence = calculateConfidence({
      response,
      category,
      knowledgeMatches: knowledgeMatches || [],
    });
    
    const shouldEscalate = shouldEscalateToHuman(confidence, response);
    
    res.json({
      success: true,
      data: {
        confidence,
        shouldEscalate,
      },
    });
  } catch (error) {
    console.error('[AI API] Confidence eval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate confidence',
    });
  }
});

export default router;

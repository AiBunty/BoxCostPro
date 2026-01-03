/**
 * Integration Hub API Routes
 * 
 * REST endpoints for managing:
 * - LLM providers (Claude, OpenAI, Gemini)
 * - Messaging providers (WhatsApp via WABA, WATI, Twilio)
 * - Automation providers (n8n, webhooks)
 * - Provider health and routing
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { llmFactory, getLLMHealth, resetLLMFactory } from '../integrations/llm';
import { messagingFactory, getMessagingHealth, sendWhatsAppText, sendWhatsAppTemplate } from '../integrations/messaging';
import { 
  publishEvent, 
  getQueueStatus, 
  getDeadLetterQueue, 
  retryDeadLetter, 
  clearDeadLetterQueue 
} from '../integrations/automation';

const router = Router();

// All integration routes require authentication
router.use(requireAuth);

// ============================================
// LLM Provider Management
// ============================================

/**
 * GET /api/integrations/llm/health
 * Get health status of all LLM providers
 */
router.get('/llm/health', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const health = await getLLMHealth();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('[IntegrationAPI] LLM health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check LLM health',
    });
  }
});

/**
 * POST /api/integrations/llm/reset
 * Reset LLM provider connections
 */
router.post('/llm/reset', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    resetLLMFactory();
    res.json({
      success: true,
      message: 'LLM provider connections reset',
    });
  } catch (error) {
    console.error('[IntegrationAPI] LLM reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset LLM providers',
    });
  }
});

/**
 * POST /api/integrations/llm/test
 * Test LLM with a sample prompt
 */
router.post('/llm/test', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { prompt, providerCode } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }
    
    const result = await llmFactory.complete({
      prompt,
      systemPrompt: 'You are a helpful assistant. Keep responses brief.',
      maxTokens: 100,
      temperature: 0.7,
    });
    
    res.json({
      success: true,
      data: {
        response: result.content,
        model: result.model,
        usage: result.usage,
        providerUsed: result.providerUsed,
      },
    });
  } catch (error) {
    console.error('[IntegrationAPI] LLM test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'LLM test failed',
    });
  }
});

// ============================================
// Messaging (WhatsApp) Provider Management
// ============================================

/**
 * GET /api/integrations/messaging/health
 * Get health status of all messaging providers
 */
router.get('/messaging/health', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const health = await getMessagingHealth();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Messaging health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check messaging health',
    });
  }
});

/**
 * POST /api/integrations/messaging/test
 * Test messaging with a sample message
 */
router.post('/messaging/test', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and message are required',
      });
    }
    
    const result = await sendWhatsAppText({
      recipient: { phoneNumber },
      text: message,
    });
    
    res.json({
      success: result.success,
      data: result.success ? {
        messageId: result.messageId,
        timestamp: result.timestamp,
        providerUsed: (result as any).providerUsed,
      } : null,
      error: result.error,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Messaging test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Messaging test failed',
    });
  }
});

/**
 * POST /api/integrations/messaging/template
 * Send a template message (for testing)
 */
router.post('/messaging/template', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { phoneNumber, templateName, templateLanguage, components } = req.body;
    
    if (!phoneNumber || !templateName) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and templateName are required',
      });
    }
    
    const result = await sendWhatsAppTemplate({
      recipient: { phoneNumber },
      templateName,
      templateLanguage: templateLanguage || 'en',
      components,
    });
    
    res.json({
      success: result.success,
      data: result.success ? {
        messageId: result.messageId,
        timestamp: result.timestamp,
        providerUsed: (result as any).providerUsed,
      } : null,
      error: result.error,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Template send failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Template send failed',
    });
  }
});

// ============================================
// Automation & Webhooks
// ============================================

/**
 * GET /api/integrations/automation/status
 * Get automation/webhook queue status
 */
router.get('/automation/status', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const status = getQueueStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Automation status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get automation status',
    });
  }
});

/**
 * GET /api/integrations/automation/dead-letters
 * Get dead letter queue (failed webhook deliveries)
 */
router.get('/automation/dead-letters', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const deadLetters = getDeadLetterQueue();
    res.json({
      success: true,
      data: deadLetters,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Dead letter fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dead letters',
    });
  }
});

/**
 * POST /api/integrations/automation/dead-letters/:index/retry
 * Retry a failed webhook delivery
 */
router.post('/automation/dead-letters/:index/retry', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const index = parseInt(req.params.index, 10);
    const result = await retryDeadLetter(index);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Dead letter not found',
      });
    }
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Dead letter retry failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry dead letter',
    });
  }
});

/**
 * DELETE /api/integrations/automation/dead-letters
 * Clear all dead letters
 */
router.delete('/automation/dead-letters', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    clearDeadLetterQueue();
    res.json({
      success: true,
      message: 'Dead letter queue cleared',
    });
  } catch (error) {
    console.error('[IntegrationAPI] Dead letter clear failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear dead letters',
    });
  }
});

/**
 * POST /api/integrations/automation/test-event
 * Publish a test event (for testing webhooks)
 */
router.post('/automation/test-event', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required',
      });
    }
    
    publishEvent(event, data || { test: true, timestamp: new Date().toISOString() });
    
    res.json({
      success: true,
      message: `Event "${event}" published to queue`,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Test event failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish test event',
    });
  }
});

// ============================================
// Provider Configuration (CRUD)
// ============================================

/**
 * GET /api/integrations/providers
 * List all configured providers
 */
router.get('/providers', requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    // In production, query integration_providers table
    // For now, return configuration status from env
    const providers = [
      {
        type: 'llm',
        code: 'claude',
        name: 'Anthropic Claude',
        isConfigured: !!process.env.ANTHROPIC_API_KEY,
        isActive: true,
      },
      {
        type: 'llm',
        code: 'openai',
        name: 'OpenAI',
        isConfigured: !!process.env.OPENAI_API_KEY,
        isActive: true,
      },
      {
        type: 'llm',
        code: 'gemini',
        name: 'Google Gemini',
        isConfigured: !!process.env.GOOGLE_AI_API_KEY,
        isActive: true,
      },
      {
        type: 'messaging',
        code: 'waba',
        name: 'WhatsApp Business API',
        isConfigured: !!(process.env.WABA_ACCESS_TOKEN && process.env.WABA_PHONE_NUMBER_ID),
        isActive: true,
      },
      {
        type: 'messaging',
        code: 'wati',
        name: 'WATI',
        isConfigured: !!(process.env.WATI_API_KEY && process.env.WATI_API_ENDPOINT),
        isActive: true,
      },
      {
        type: 'messaging',
        code: 'twilio-whatsapp',
        name: 'Twilio WhatsApp',
        isConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_NUMBER),
        isActive: true,
      },
      {
        type: 'automation',
        code: 'n8n',
        name: 'n8n',
        isConfigured: !!(process.env.N8N_API_KEY && process.env.N8N_BASE_URL),
        isActive: true,
      },
    ];
    
    res.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    console.error('[IntegrationAPI] Provider list failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list providers',
    });
  }
});

/**
 * POST /api/integrations/providers
 * Add or update a provider configuration
 * (In production, this would update the database)
 */
router.post('/providers', requireRole(['super_admin']), async (req: Request, res: Response) => {
  try {
    const { type, code, credentials } = req.body;
    
    if (!type || !code || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'type, code, and credentials are required',
      });
    }
    
    // In production:
    // 1. Validate credentials format
    // 2. Encrypt credentials using encryption module
    // 3. Store in integration_credentials table
    // 4. Update integration_providers table
    
    res.json({
      success: true,
      message: 'Provider configuration saved',
    });
  } catch (error) {
    console.error('[IntegrationAPI] Provider save failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save provider',
    });
  }
});

export default router;

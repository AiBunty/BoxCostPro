-- ============================================================
-- ENTERPRISE SUPPORT + SLA + AI + INTEGRATION HUB MIGRATION
-- Created: 2026-01-03
-- Description: Complete enterprise-grade support system with
--              AI orchestration, multi-provider integrations,
--              SLA automation, and full audit compliance
-- ============================================================

-- ============================================================
-- PART 1: EXTENDED SUPPORT TICKET SYSTEM
-- ============================================================

-- Extended Support Tickets - Enterprise-grade with SLA tracking
CREATE TABLE IF NOT EXISTS support_tickets_extended (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    ticket_number VARCHAR NOT NULL UNIQUE, -- e.g. SUP-2025-000123
    user_id VARCHAR NOT NULL REFERENCES users(id),
    
    -- Ticket Details
    category VARCHAR NOT NULL, -- SOFTWARE_ISSUE, SOFTWARE_BUG, BILLING, TRAINING, FEATURE_REQUEST, CALLBACK_REQUEST, GENERAL_QUERY
    subject TEXT NOT NULL,
    description TEXT,
    priority VARCHAR NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status VARCHAR NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, AWAITING_USER, ESCALATED, RESOLVED, CLOSED
    
    -- SLA Tracking
    sla_due_at TIMESTAMP,
    first_response_at TIMESTAMP,
    first_response_due_at TIMESTAMP,
    
    -- Escalation
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP,
    escalated_to VARCHAR REFERENCES users(id),
    escalation_reason TEXT,
    
    -- Assignment
    assigned_to VARCHAR REFERENCES users(id),
    assigned_at TIMESTAMP,
    
    -- Resolution
    resolution_note TEXT,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR REFERENCES users(id),
    closed_at TIMESTAMP,
    closed_by VARCHAR REFERENCES users(id),
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_user ON support_tickets_extended(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_status ON support_tickets_extended(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_priority ON support_tickets_extended(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_category ON support_tickets_extended(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_assigned ON support_tickets_extended(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ext_sla ON support_tickets_extended(sla_due_at);

-- Extended Support Messages - with sender role and attachments
CREATE TABLE IF NOT EXISTS support_messages_extended (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR NOT NULL REFERENCES support_tickets_extended(id),
    
    -- Sender Information
    sender_role VARCHAR NOT NULL, -- USER, ADMIN, SYSTEM, WHATSAPP, AI
    sender_id VARCHAR REFERENCES users(id),
    sender_name VARCHAR,
    
    -- Message Content
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Admin internal notes
    
    -- Attachments
    attachments JSONB DEFAULT '[]', -- [{filename, url, size, mimeType}]
    
    -- AI-specific fields
    ai_confidence_score REAL,
    ai_draft_approved BOOLEAN,
    ai_draft_approved_by VARCHAR REFERENCES users(id),
    
    -- Channel tracking
    source_channel VARCHAR DEFAULT 'WEB', -- WEB, EMAIL, WHATSAPP, API
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ext_ticket ON support_messages_extended(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ext_sender ON support_messages_extended(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ext_internal ON support_messages_extended(is_internal);

-- Support SLA Rules
CREATE TABLE IF NOT EXISTS support_sla_rules (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    
    priority VARCHAR NOT NULL, -- LOW, MEDIUM, HIGH, URGENT
    first_response_minutes INTEGER NOT NULL,
    resolution_minutes INTEGER NOT NULL,
    auto_escalate BOOLEAN DEFAULT TRUE,
    escalate_after_minutes INTEGER,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_sla_rules_priority ON support_sla_rules(priority);
CREATE INDEX IF NOT EXISTS idx_support_sla_rules_tenant ON support_sla_rules(tenant_id);

-- Support Ticket Audit Logs (Immutable)
CREATE TABLE IF NOT EXISTS support_ticket_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR NOT NULL REFERENCES support_tickets_extended(id),
    
    action VARCHAR NOT NULL, -- CREATED, USER_REPLY, ADMIN_REPLY, STATUS_CHANGED, ASSIGNED, ESCALATED, RESOLVED, CLOSED
    
    before_snapshot JSONB,
    after_snapshot JSONB,
    
    actor_id VARCHAR REFERENCES users(id),
    actor_role VARCHAR,
    actor_email VARCHAR,
    
    ip_address VARCHAR,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_audit_ticket ON support_ticket_audit_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_action ON support_ticket_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_support_audit_actor ON support_ticket_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_created ON support_ticket_audit_logs(created_at);

-- WhatsApp Ticket Links
CREATE TABLE IF NOT EXISTS whatsapp_ticket_links (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR NOT NULL REFERENCES support_tickets_extended(id),
    phone_number VARCHAR NOT NULL,
    country_code VARCHAR DEFAULT '+91',
    is_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_ticket ON whatsapp_ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_links_phone ON whatsapp_ticket_links(phone_number);

-- Support Agents
CREATE TABLE IF NOT EXISTS support_agents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id),
    
    role VARCHAR NOT NULL DEFAULT 'AGENT', -- AGENT, MANAGER
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    
    current_ticket_count INTEGER DEFAULT 0,
    max_ticket_capacity INTEGER DEFAULT 20,
    
    expertise JSONB DEFAULT '[]',
    
    total_tickets_resolved INTEGER DEFAULT 0,
    avg_resolution_time_minutes REAL,
    avg_first_response_time_minutes REAL,
    customer_satisfaction_score REAL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_agents_user ON support_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_support_agents_active ON support_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_support_agents_available ON support_agents(is_available);
CREATE INDEX IF NOT EXISTS idx_support_agents_workload ON support_agents(current_ticket_count);

-- Ticket Assignments
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR NOT NULL REFERENCES support_tickets_extended(id),
    agent_id VARCHAR NOT NULL REFERENCES support_agents(id),
    
    assigned_by VARCHAR NOT NULL, -- SYSTEM, ADMIN
    assigned_by_user_id VARCHAR REFERENCES users(id),
    
    reason VARCHAR,
    previous_agent_id VARCHAR REFERENCES support_agents(id),
    
    assigned_at TIMESTAMP DEFAULT NOW(),
    unassigned_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_agent ON ticket_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_assigned_at ON ticket_assignments(assigned_at);

-- ============================================================
-- PART 2: AI BRAIN & KNOWLEDGE SYSTEM
-- ============================================================

-- AI Knowledge Base
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    
    module VARCHAR NOT NULL,
    feature VARCHAR NOT NULL,
    intent VARCHAR NOT NULL,
    
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    keywords JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    published_by VARCHAR REFERENCES users(id),
    
    version INTEGER DEFAULT 1,
    previous_version_id VARCHAR,
    
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_module ON ai_knowledge_base(module);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_feature ON ai_knowledge_base(feature);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_intent ON ai_knowledge_base(intent);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON ai_knowledge_base(is_active);

-- AI Knowledge Audit
CREATE TABLE IF NOT EXISTS ai_knowledge_audit (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_entry_id VARCHAR NOT NULL REFERENCES ai_knowledge_base(id),
    
    action VARCHAR NOT NULL,
    
    before_content TEXT,
    after_content TEXT,
    change_details JSONB,
    
    actor_id VARCHAR REFERENCES users(id),
    actor_email VARCHAR,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_audit_entry ON ai_knowledge_audit(knowledge_entry_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_audit_action ON ai_knowledge_audit(action);

-- AI Intent Logs
CREATE TABLE IF NOT EXISTS ai_intent_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR REFERENCES users(id),
    
    intent VARCHAR NOT NULL,
    source VARCHAR NOT NULL,
    user_query TEXT,
    
    was_resolved BOOLEAN DEFAULT FALSE,
    knowledge_entry_used VARCHAR REFERENCES ai_knowledge_base(id),
    
    user_feedback VARCHAR,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_intent ON ai_intent_logs(intent);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_source ON ai_intent_logs(source);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_resolved ON ai_intent_logs(was_resolved);
CREATE INDEX IF NOT EXISTS idx_ai_intent_logs_created ON ai_intent_logs(created_at);

-- AI Response Confidence
CREATE TABLE IF NOT EXISTS ai_response_confidence (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    
    ticket_id VARCHAR REFERENCES support_tickets_extended(id),
    message_id VARCHAR REFERENCES support_messages_extended(id),
    
    ai_intent VARCHAR,
    confidence_score REAL NOT NULL,
    confidence_level VARCHAR NOT NULL,
    
    action_taken VARCHAR NOT NULL,
    
    ai_draft_response TEXT,
    knowledge_entries_used JSONB DEFAULT '[]',
    
    human_reviewed BOOLEAN DEFAULT FALSE,
    human_reviewed_by VARCHAR REFERENCES users(id),
    human_reviewed_at TIMESTAMP,
    human_approved BOOLEAN,
    human_modified_response TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_confidence_ticket ON ai_response_confidence(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_confidence_level ON ai_response_confidence(confidence_level);
CREATE INDEX IF NOT EXISTS idx_ai_confidence_action ON ai_response_confidence(action_taken);
CREATE INDEX IF NOT EXISTS idx_ai_confidence_reviewed ON ai_response_confidence(human_reviewed);

-- AI System Prompts
CREATE TABLE IF NOT EXISTS ai_system_prompts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR NOT NULL,
    description TEXT,
    
    system_prompt TEXT NOT NULL,
    
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_name ON ai_system_prompts(name);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_system_prompts(is_active);

-- AI Audit Logs
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    
    request_type VARCHAR NOT NULL,
    request_source VARCHAR NOT NULL,
    requested_by VARCHAR REFERENCES users(id),
    
    context_provided JSONB NOT NULL,
    context_hash VARCHAR,
    
    provider VARCHAR NOT NULL,
    model VARCHAR NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    
    response_payload JSONB,
    confidence_score REAL,
    
    status VARCHAR NOT NULL,
    error_message TEXT,
    latency_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_type ON ai_audit_logs(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_provider ON ai_audit_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_audit_status ON ai_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_logs(created_at);

-- ============================================================
-- PART 3: ENTERPRISE INTEGRATION HUB
-- ============================================================

-- Integration Providers
CREATE TABLE IF NOT EXISTS integration_providers (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    
    type VARCHAR NOT NULL, -- LLM, WHATSAPP, AUTOMATION
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL UNIQUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    
    region VARCHAR DEFAULT 'GLOBAL',
    
    base_url VARCHAR,
    api_version VARCHAR,
    
    is_healthy BOOLEAN DEFAULT TRUE,
    last_health_check_at TIMESTAMP,
    consecutive_failures INTEGER DEFAULT 0,
    
    requests_per_minute INTEGER,
    requests_per_day INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_providers_type ON integration_providers(type);
CREATE INDEX IF NOT EXISTS idx_integration_providers_code ON integration_providers(code);
CREATE INDEX IF NOT EXISTS idx_integration_providers_active ON integration_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_integration_providers_primary ON integration_providers(is_primary);

-- Integration Credentials (Encrypted)
CREATE TABLE IF NOT EXISTS integration_credentials (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR NOT NULL REFERENCES integration_providers(id),
    
    key_name VARCHAR NOT NULL,
    encrypted_value TEXT NOT NULL,
    
    last_rotated_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_creds_provider ON integration_credentials(provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_creds_key ON integration_credentials(key_name);

-- Integration Routes
CREATE TABLE IF NOT EXISTS integration_routes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    
    integration_type VARCHAR NOT NULL,
    task_type VARCHAR,
    
    primary_provider_id VARCHAR NOT NULL REFERENCES integration_providers(id),
    secondary_provider_id VARCHAR REFERENCES integration_providers(id),
    
    failover_enabled BOOLEAN DEFAULT TRUE,
    failover_threshold INTEGER DEFAULT 3,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_routes_type ON integration_routes(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_routes_tenant ON integration_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_routes_active ON integration_routes(is_active);

-- Integration Audit Logs
CREATE TABLE IF NOT EXISTS integration_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR NOT NULL REFERENCES integration_providers(id),
    tenant_id VARCHAR REFERENCES tenants(id),
    
    action VARCHAR NOT NULL,
    request_payload JSONB,
    
    response_payload JSONB,
    status VARCHAR NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    
    latency_ms INTEGER,
    
    was_failover BOOLEAN DEFAULT FALSE,
    failover_from_provider_id VARCHAR,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_provider ON integration_audit_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_status ON integration_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_audit_action ON integration_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_integration_audit_created ON integration_audit_logs(created_at);

-- Integration Webhooks
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id),
    
    name VARCHAR NOT NULL,
    webhook_url TEXT NOT NULL,
    secret_key TEXT,
    
    event_types JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 1000,
    
    last_triggered_at TIMESTAMP,
    last_success_at TIMESTAMP,
    consecutive_failures INTEGER DEFAULT 0,
    
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_tenant ON integration_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_active ON integration_webhooks(is_active);

-- Integration Webhook Deliveries
CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id VARCHAR NOT NULL REFERENCES integration_webhooks(id),
    
    event_type VARCHAR NOT NULL,
    event_payload JSONB NOT NULL,
    
    status VARCHAR NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    attempt_number INTEGER DEFAULT 1,
    next_retry_at TIMESTAMP,
    
    latency_ms INTEGER,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON integration_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON integration_webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON integration_webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON integration_webhook_deliveries(created_at);

-- Integration Usage Quotas
CREATE TABLE IF NOT EXISTS integration_usage_quotas (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
    
    integration_type VARCHAR NOT NULL,
    
    daily_limit INTEGER,
    monthly_limit INTEGER,
    
    daily_used INTEGER DEFAULT 0,
    monthly_used INTEGER DEFAULT 0,
    
    daily_reset_at TIMESTAMP,
    monthly_reset_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_quotas_tenant ON integration_usage_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_quotas_type ON integration_usage_quotas(integration_type);

-- ============================================================
-- PART 4: SEED DEFAULT DATA
-- ============================================================

-- Insert default SLA rules
INSERT INTO support_sla_rules (id, tenant_id, priority, first_response_minutes, resolution_minutes, auto_escalate, escalate_after_minutes, is_active)
VALUES 
    (gen_random_uuid(), NULL, 'LOW', 480, 2880, TRUE, 2400, TRUE),      -- 8h response, 48h resolution
    (gen_random_uuid(), NULL, 'MEDIUM', 240, 1440, TRUE, 1200, TRUE),   -- 4h response, 24h resolution
    (gen_random_uuid(), NULL, 'HIGH', 60, 720, TRUE, 600, TRUE),        -- 1h response, 12h resolution
    (gen_random_uuid(), NULL, 'URGENT', 15, 240, TRUE, 180, TRUE)       -- 15m response, 4h resolution
ON CONFLICT DO NOTHING;

-- Insert default AI system prompts
INSERT INTO ai_system_prompts (id, name, description, system_prompt, version, is_active)
VALUES 
    (gen_random_uuid(), 'SUPPORT_DRAFT_REPLY', 'System prompt for drafting support ticket replies', 
    'You are an enterprise ERP support assistant for BoxCostPro.

STRICT RULES:
- Do NOT modify any data or make changes to the system
- Do NOT promise refunds, credits, or financial compensation
- Do NOT provide legal, tax, or compliance advice
- Do NOT speculate about features or timelines not confirmed
- If you are uncertain about anything, respond with "I recommend escalating this to a human support agent"
- Always be professional, polite, and helpful
- Focus on understanding the issue and providing clear guidance
- Reference only information from the knowledge base or conversation history

OUTPUT FORMAT:
Respond with valid JSON only:
{
  "reply": "Your professional response here",
  "intent": "CATEGORY_OF_QUERY",
  "confidence": 75,
  "suggestedActions": ["action1", "action2"],
  "escalationNeeded": false
}', 1, TRUE),

    (gen_random_uuid(), 'CHATBOT_QUERY', 'System prompt for user-facing chatbot',
    'You are a helpful assistant for BoxCostPro, a B2B ERP platform for corrugated box manufacturers.

STRICT RULES:
- Do NOT modify any data or make changes
- Do NOT make promises about features or pricing
- Do NOT provide legal, tax, or compliance advice
- If you cannot help, suggest creating a support ticket
- Be concise and helpful
- Only answer based on the knowledge base provided

OUTPUT FORMAT:
{
  "answer": "Your helpful response",
  "intent": "DETECTED_INTENT",
  "confidence": 80,
  "suggestCreateTicket": false,
  "relatedArticles": []
}', 1, TRUE),

    (gen_random_uuid(), 'SLA_ANALYSIS', 'System prompt for SLA breach analysis',
    'You are analyzing support ticket SLA metrics and escalation needs.

Analyze the ticket details and provide:
1. Risk assessment for SLA breach
2. Recommended priority adjustment if needed
3. Suggested next actions

OUTPUT FORMAT:
{
  "slaRiskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "recommendedPriority": "CURRENT|UPGRADE_TO_HIGH|UPGRADE_TO_URGENT",
  "reasoning": "Brief explanation",
  "suggestedActions": ["action1", "action2"]
}', 1, TRUE)
ON CONFLICT DO NOTHING;

-- Insert default integration providers
INSERT INTO integration_providers (id, type, name, code, is_active, is_primary, region, base_url, api_version)
VALUES 
    -- LLM Providers
    (gen_random_uuid(), 'LLM', 'Anthropic Claude', 'claude', TRUE, TRUE, 'GLOBAL', 'https://api.anthropic.com', 'v1'),
    (gen_random_uuid(), 'LLM', 'OpenAI GPT', 'openai', TRUE, FALSE, 'GLOBAL', 'https://api.openai.com', 'v1'),
    (gen_random_uuid(), 'LLM', 'Google Gemini', 'gemini', FALSE, FALSE, 'GLOBAL', 'https://generativelanguage.googleapis.com', 'v1'),
    (gen_random_uuid(), 'LLM', 'Azure OpenAI', 'azure-openai', FALSE, FALSE, 'GLOBAL', NULL, '2024-02-15-preview'),
    
    -- WhatsApp Providers
    (gen_random_uuid(), 'WHATSAPP', 'WhatsApp Business API', 'waba', TRUE, TRUE, 'GLOBAL', 'https://graph.facebook.com', 'v18.0'),
    (gen_random_uuid(), 'WHATSAPP', 'WATI', 'wati', FALSE, FALSE, 'IN', 'https://live-server.wati.io', 'v1'),
    (gen_random_uuid(), 'WHATSAPP', 'Twilio WhatsApp', 'twilio-whatsapp', FALSE, FALSE, 'GLOBAL', 'https://api.twilio.com', '2010-04-01'),
    
    -- Automation Providers
    (gen_random_uuid(), 'AUTOMATION', 'n8n', 'n8n', TRUE, TRUE, 'GLOBAL', NULL, NULL),
    (gen_random_uuid(), 'AUTOMATION', 'Pabbly Connect', 'pabbly', FALSE, FALSE, 'GLOBAL', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

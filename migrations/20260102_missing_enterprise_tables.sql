-- =============================================================================
-- ENTERPRISE SYSTEM - MISSING TABLES ONLY
-- =============================================================================
-- Date: 2026-01-02
-- Purpose: Create only the missing enterprise tables
-- =============================================================================

-- =============================================================================
-- 1) WHATSAPP TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    template_category VARCHAR(50) NOT NULL DEFAULT 'QUOTATION',
    message_body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2) EMAIL TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    template_key VARCHAR(100) NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3) TEMPLATE AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS template_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR REFERENCES tenants(id),
    template_type VARCHAR(50) NOT NULL,
    template_id VARCHAR NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR,
    actor_email VARCHAR,
    before_content JSONB,
    after_content JSONB,
    change_description TEXT,
    version_before INTEGER,
    version_after INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 4) SUPPORT TICKET MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL DEFAULT 'USER',
    sender_id VARCHAR,
    sender_name VARCHAR(255),
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_internal_note BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5) USER APPROVALS
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_approvals (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR NOT NULL,
    approval_type VARCHAR(50) NOT NULL DEFAULT 'BUSINESS_PROFILE',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    business_profile_snapshot JSONB,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note TEXT,
    rejection_reason TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6) PDF GENERATION LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS pdf_generation_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR REFERENCES tenants(id),
    document_type VARCHAR(50) NOT NULL,
    document_id VARCHAR NOT NULL,
    template_id VARCHAR,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    file_path VARCHAR,
    file_size_bytes INTEGER,
    generation_time_ms INTEGER,
    engine_used VARCHAR(50),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    requested_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(template_category);

CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_template_audit_tenant ON template_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_audit_template ON template_audit_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_audit_actor ON template_audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON support_ticket_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_user_approvals_status ON user_approvals(status);
CREATE INDEX IF NOT EXISTS idx_user_approvals_user ON user_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_approvals_tenant ON user_approvals(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pdf_logs_document ON pdf_generation_logs(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_logs_status ON pdf_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_logs_tenant ON pdf_generation_logs(tenant_id);

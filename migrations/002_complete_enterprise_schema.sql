-- ============================================================
-- COMPLETE ENTERPRISE SCHEMA MIGRATION
-- Version: 2.0.0
-- Date: 2026-01-02
-- Description: Invoice templates, WhatsApp templates, Quotations,
--              Ticket messages, Approval history, Audit logs
-- ============================================================

-- ============================================================
-- A) INVOICE TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('INVOICE', 'QUOTATION')),
    html_content TEXT NOT NULL,
    css_content TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_type ON invoice_templates(type);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_active ON invoice_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(is_default, type);

-- Ensure only one default per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_templates_unique_default 
ON invoice_templates(type) WHERE is_default = TRUE;

-- ============================================================
-- B) WHATSAPP TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_default ON whatsapp_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user ON whatsapp_templates(created_by);

-- ============================================================
-- C) TEMPLATE AUDIT LOGS (IMMUTABLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS template_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE', 'DELETE', 'SET_DEFAULT')),
    before_snapshot JSONB,
    after_snapshot JSONB,
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_audit_logs_template ON template_audit_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_audit_logs_actor ON template_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_template_audit_logs_action ON template_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_template_audit_logs_created ON template_audit_logs(created_at DESC);

-- ============================================================
-- D) QUOTATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    customer_gstin VARCHAR(15),
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    valid_until DATE,
    terms_and_conditions TEXT,
    notes TEXT,
    sent_via VARCHAR(20) CHECK (sent_via IN ('EMAIL', 'WHATSAPP', 'BOTH')),
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_user ON quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_created ON quotations(created_at DESC);

-- ============================================================
-- E) QUOTATION ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    is_selected BOOLEAN DEFAULT TRUE,
    item_name TEXT NOT NULL,
    description TEXT,
    hsn_code VARCHAR(20),
    quantity DECIMAL(10, 3) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'PCS',
    rate DECIMAL(12, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    tax_percent DECIMAL(5, 2) DEFAULT 0,
    tax_type VARCHAR(10) CHECK (tax_type IN ('CGST_SGST', 'IGST', 'NONE')),
    amount DECIMAL(12, 2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_selected ON quotation_items(is_selected);

-- ============================================================
-- F) TICKET MESSAGES (for support ticket thread)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('USER', 'ADMIN', 'SYSTEM')),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender ON ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON ticket_messages(created_at);

-- ============================================================
-- G) APPROVAL STATUS HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_user ON approval_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_created ON approval_status_history(created_at DESC);

-- ============================================================
-- H) EMAIL LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

-- ============================================================
-- I) PDF GENERATION LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS pdf_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('INVOICE', 'QUOTATION', 'CREDIT_NOTE', 'RECEIPT')),
    document_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATING', 'SUCCESS', 'FAILED')),
    file_path TEXT,
    file_size INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    generation_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdf_logs_document ON pdf_generation_logs(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_logs_status ON pdf_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_logs_created ON pdf_generation_logs(created_at DESC);

-- ============================================================
-- J) GENERAL AUDIT LOGS (for all system actions)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(50),
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_entity ON system_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_actor ON system_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_action ON system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_created ON system_audit_logs(created_at DESC);

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE invoice_templates IS 'Stores HTML templates for invoices and quotations with versioning';
COMMENT ON TABLE whatsapp_templates IS 'User-defined WhatsApp message templates with dynamic variables';
COMMENT ON TABLE template_audit_logs IS 'Immutable audit trail for all template changes';
COMMENT ON TABLE quotations IS 'Dynamic quotations created by users with item selection';
COMMENT ON TABLE quotation_items IS 'Line items for quotations with selection state';
COMMENT ON TABLE ticket_messages IS 'Message thread for support tickets';
COMMENT ON TABLE approval_status_history IS 'History of user approval status changes';
COMMENT ON TABLE email_logs IS 'Log of all system emails with delivery status';
COMMENT ON TABLE pdf_generation_logs IS 'Log of PDF generation attempts with retry tracking';
COMMENT ON TABLE system_audit_logs IS 'Comprehensive audit log for all system actions';

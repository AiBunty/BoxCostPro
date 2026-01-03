-- =============================================================================
-- ENTERPRISE COMPLETE SYSTEM MIGRATION
-- =============================================================================
-- Date: 2026-01-02
-- Purpose: Complete enterprise-grade invoicing, quotation, support, and audit system
-- 
-- This migration creates:
-- A) invoice_templates - Store invoice HTML templates in DB
-- B) whatsapp_templates - Store WhatsApp message templates
-- C) email_templates - Store email notification templates
-- D) template_audit_logs - Track all template changes
-- E) support_tickets - User support system
-- F) support_ticket_messages - Ticket conversation thread
-- G) user_approvals - Business profile approval workflow
-- H) system_notifications - Email notification queue
-- I) pdf_generation_logs - Track PDF generation attempts
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- A) INVOICE TEMPLATES
-- =============================================================================
-- Stores HTML invoice templates with versioning and audit trail
-- Templates use Handlebars-style placeholders: {{invoice_no}}, {{buyer_name}}

CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('INVOICE', 'QUOTATION', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE')),
    html_content TEXT NOT NULL,
    css_content TEXT,
    header_html TEXT,
    footer_html TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one default template per type per tenant
    CONSTRAINT unique_default_per_type_tenant UNIQUE (tenant_id, template_type, is_default) 
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_invoice_templates_tenant ON invoice_templates(tenant_id);
CREATE INDEX idx_invoice_templates_type ON invoice_templates(template_type);
CREATE INDEX idx_invoice_templates_active ON invoice_templates(is_active);

COMMENT ON TABLE invoice_templates IS 'Database-backed invoice/quotation HTML templates with versioning';
COMMENT ON COLUMN invoice_templates.html_content IS 'Handlebars-compatible HTML template with placeholders like {{invoice_no}}';

-- =============================================================================
-- B) WHATSAPP TEMPLATES
-- =============================================================================
-- Stores WhatsApp message templates with dynamic variable support
-- Templates use placeholders: {{party_name}}, {{quote_total}}, {{items_list}}

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    template_category VARCHAR(50) NOT NULL CHECK (template_category IN ('QUOTATION', 'FOLLOWUP', 'PAYMENT_REMINDER', 'THANK_YOU', 'CUSTOM')),
    message_body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(template_category);

COMMENT ON TABLE whatsapp_templates IS 'WhatsApp message templates with dynamic variable support';
COMMENT ON COLUMN whatsapp_templates.variables IS 'JSON array of available variables: [{"name": "party_name", "type": "string"}]';

-- =============================================================================
-- C) EMAIL TEMPLATES
-- =============================================================================
-- Stores email notification templates for all user↔admin interactions
-- MANDATORY: Every interaction triggers email

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id), -- NULL = system-wide template
    name VARCHAR(255) NOT NULL,
    template_key VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'USER_SIGNUP', 'APPROVAL_APPROVED'
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT, -- Plain text fallback
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);

COMMENT ON TABLE email_templates IS 'Email notification templates for all user↔admin interactions';
COMMENT ON COLUMN email_templates.template_key IS 'Unique identifier for template lookup: USER_SIGNUP, APPROVAL_SUBMITTED, etc.';

-- =============================================================================
-- D) TEMPLATE AUDIT LOGS (Append-Only, Immutable)
-- =============================================================================
-- Tracks ALL template changes with before/after snapshots
-- CRITICAL: This table is append-only, no UPDATE or DELETE allowed

CREATE TABLE IF NOT EXISTS template_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('INVOICE', 'WHATSAPP', 'EMAIL', 'QUOTATION')),
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE', 'DELETE', 'SET_DEFAULT')),
    before_snapshot JSONB,
    after_snapshot JSONB,
    change_summary TEXT,
    actor_id UUID REFERENCES users(id),
    actor_email VARCHAR(255),
    actor_role VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent UPDATE and DELETE on audit logs (immutable)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are not allowed.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable_trigger
    BEFORE UPDATE OR DELETE ON template_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

CREATE INDEX idx_template_audit_logs_template ON template_audit_logs(template_id);
CREATE INDEX idx_template_audit_logs_actor ON template_audit_logs(actor_id);
CREATE INDEX idx_template_audit_logs_created ON template_audit_logs(created_at DESC);
CREATE INDEX idx_template_audit_logs_type ON template_audit_logs(template_type);

COMMENT ON TABLE template_audit_logs IS 'Immutable audit trail for all template modifications';

-- =============================================================================
-- E) SUPPORT TICKETS
-- =============================================================================
-- Complete support ticket system with status tracking

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR REFERENCES users(id) NOT NULL,
    ticket_number VARCHAR(50) NOT NULL UNIQUE, -- e.g., TKT-2026-0001
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('BILLING', 'TECHNICAL', 'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT', 'OTHER')),
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'WAITING_ON_ADMIN', 'RESOLVED', 'CLOSED')),
    assigned_to UUID REFERENCES users(id),
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users(id),
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    satisfaction_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'TKT-\d{4}-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM support_tickets
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    NEW.ticket_number := 'TKT-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ticket_number
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION generate_ticket_number();

COMMENT ON TABLE support_tickets IS 'User support ticket system with status tracking';

-- =============================================================================
-- F) SUPPORT TICKET MESSAGES (Conversation Thread)
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id VARCHAR REFERENCES users(id) NOT NULL,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('USER', 'ADMIN', 'SYSTEM')),
    message_content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_internal_note BOOLEAN DEFAULT false, -- Admin-only notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created ON support_ticket_messages(created_at);

COMMENT ON TABLE support_ticket_messages IS 'Conversation thread for support tickets';
COMMENT ON COLUMN support_ticket_messages.is_internal_note IS 'If true, only visible to admins';

-- =============================================================================
-- G) USER APPROVALS (Business Profile Approval Workflow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR REFERENCES users(id) NOT NULL UNIQUE,
    tenant_id VARCHAR REFERENCES tenants(id),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMITTED')),
    business_profile_snapshot JSONB NOT NULL, -- Snapshot at submission time
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    rejection_details JSONB, -- Specific fields that need correction
    resubmission_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_approvals_status ON user_approvals(status);
CREATE INDEX idx_user_approvals_user ON user_approvals(user_id);
CREATE INDEX idx_user_approvals_tenant ON user_approvals(tenant_id);
CREATE INDEX idx_user_approvals_submitted ON user_approvals(submitted_at DESC);

COMMENT ON TABLE user_approvals IS 'Business profile approval workflow with audit trail';
COMMENT ON COLUMN user_approvals.business_profile_snapshot IS 'Complete snapshot of business profile at submission time';

-- =============================================================================
-- H) SYSTEM NOTIFICATIONS (Email Queue)
-- =============================================================================
-- Queue for all system emails with retry support

CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    notification_type VARCHAR(100) NOT NULL, -- e.g., 'USER_SIGNUP', 'APPROVAL_APPROVED'
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    recipient_user_id VARCHAR REFERENCES users(id),
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables JSONB, -- Variables used in template
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'BOUNCED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    error_details JSONB,
    message_id VARCHAR(255), -- Provider message ID
    related_entity_type VARCHAR(100), -- 'INVOICE', 'QUOTE', 'TICKET', etc.
    related_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_notifications_status ON system_notifications(status);
CREATE INDEX idx_system_notifications_recipient ON system_notifications(recipient_email);
CREATE INDEX idx_system_notifications_type ON system_notifications(notification_type);
CREATE INDEX idx_system_notifications_pending ON system_notifications(status, scheduled_for) WHERE status = 'PENDING';
CREATE INDEX idx_system_notifications_created ON system_notifications(created_at DESC);

COMMENT ON TABLE system_notifications IS 'Email notification queue with retry support';
COMMENT ON COLUMN system_notifications.attempts IS 'Number of send attempts (max 3)';

-- =============================================================================
-- I) PDF GENERATION LOGS
-- =============================================================================
-- Track all PDF generation attempts with error handling

CREATE TABLE IF NOT EXISTS pdf_generation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR REFERENCES users(id),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('INVOICE', 'QUOTATION', 'PROFORMA', 'REPORT')),
    document_id UUID NOT NULL,
    template_id UUID REFERENCES invoice_templates(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATING', 'SUCCESS', 'FAILED')),
    file_path TEXT,
    file_size_bytes BIGINT,
    generation_time_ms INTEGER,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    error_stack TEXT,
    renderer VARCHAR(50), -- 'puppeteer', 'playwright', 'wkhtmltopdf'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_pdf_logs_document ON pdf_generation_logs(document_type, document_id);
CREATE INDEX idx_pdf_logs_status ON pdf_generation_logs(status);
CREATE INDEX idx_pdf_logs_tenant ON pdf_generation_logs(tenant_id);
CREATE INDEX idx_pdf_logs_created ON pdf_generation_logs(created_at DESC);

COMMENT ON TABLE pdf_generation_logs IS 'Track PDF generation attempts with error handling and retry';

-- =============================================================================
-- J) GENERAL AUDIT LOGS (System-Wide)
-- =============================================================================
-- Append-only audit trail for all critical actions

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR,
    user_id VARCHAR,
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    before_state JSONB,
    after_state JSONB,
    change_summary TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent modifications
CREATE TRIGGER system_audit_log_immutable_trigger
    BEFORE UPDATE OR DELETE ON system_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

CREATE INDEX idx_system_audit_entity ON system_audit_logs(entity_type, entity_id);
CREATE INDEX idx_system_audit_user ON system_audit_logs(user_id);
CREATE INDEX idx_system_audit_action ON system_audit_logs(action);
CREATE INDEX idx_system_audit_created ON system_audit_logs(created_at DESC);

COMMENT ON TABLE system_audit_logs IS 'Immutable system-wide audit trail for all critical actions';

-- =============================================================================
-- SEED DEFAULT EMAIL TEMPLATES
-- =============================================================================
-- These are system-wide templates for mandatory email notifications

INSERT INTO email_templates (template_key, name, subject, html_body, variables) VALUES

-- 1. User Signup
('USER_SIGNUP', 'New User Account Created', 'Welcome to {{app_name}} - Your Account is Ready!',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>Welcome to {{app_name}}!</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Your account has been successfully created. Here are your details:</p>
    <ul>
      <li><strong>Email:</strong> {{user_email}}</li>
      <li><strong>Account Type:</strong> {{account_type}}</li>
      <li><strong>Created On:</strong> {{created_date}}</li>
    </ul>
    <p>To complete your setup, please verify your email and complete your business profile.</p>
    <a href="{{login_url}}" class="btn">Login to Your Account</a>
    <p>If you have any questions, please contact our support team.</p>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"user_email","type":"string"},{"name":"account_type","type":"string"},{"name":"created_date","type":"date"},{"name":"login_url","type":"url"}]'::jsonb),

-- 2. Admin Notified of New Signup
('ADMIN_NEW_USER_SIGNUP', 'Admin Alert: New User Registration', '[Action Required] New User Registration - {{user_email}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#dc2626;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.info-box{background:white;padding:15px;border-radius:6px;margin:15px 0}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>🆕 New User Registration</h1></div>
  <div class="content">
    <p>A new user has registered on {{app_name}}:</p>
    <div class="info-box">
      <p><strong>Name:</strong> {{user_name}}</p>
      <p><strong>Email:</strong> {{user_email}}</p>
      <p><strong>Company:</strong> {{company_name}}</p>
      <p><strong>Phone:</strong> {{phone}}</p>
      <p><strong>Registered:</strong> {{created_date}}</p>
    </div>
    <p>The user will need to complete their business profile and submit for approval.</p>
    <a href="{{admin_url}}" class="btn">View in Admin Panel</a>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"user_email","type":"string"},{"name":"company_name","type":"string"},{"name":"phone","type":"string"},{"name":"created_date","type":"date"},{"name":"admin_url","type":"url"}]'::jsonb),

-- 3. User Submitted for Approval
('APPROVAL_SUBMITTED', 'Account Submitted for Approval', 'Your {{app_name}} Account is Under Review',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#f59e0b;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.status-box{background:#fef3c7;padding:15px;border-radius:6px;margin:15px 0;border-left:4px solid #f59e0b}</style></head>
<body>
<div class="container">
  <div class="header"><h1>⏳ Account Under Review</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Thank you for submitting your business profile for verification. Your account is now under review.</p>
    <div class="status-box">
      <p><strong>Status:</strong> Under Review</p>
      <p><strong>Submitted:</strong> {{submitted_date}}</p>
      <p><strong>Expected Response:</strong> Within 24-48 hours</p>
    </div>
    <p>Our team will review your business details and notify you once the verification is complete.</p>
    <p>If you need to make any changes, please contact our support team.</p>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"submitted_date","type":"date"}]'::jsonb),

-- 4. Admin Notified of Approval Submission
('ADMIN_APPROVAL_SUBMITTED', 'Admin Alert: Business Profile Submitted', '[Review Required] Business Profile Submitted - {{company_name}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#f59e0b;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.info-box{background:white;padding:15px;border-radius:6px;margin:15px 0}.btn{display:inline-block;background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:10px 5px 10px 0}.btn-reject{background:#dc2626}</style></head>
<body>
<div class="container">
  <div class="header"><h1>📋 Business Profile Review Required</h1></div>
  <div class="content">
    <p>A user has submitted their business profile for approval:</p>
    <div class="info-box">
      <p><strong>Company:</strong> {{company_name}}</p>
      <p><strong>Owner:</strong> {{user_name}}</p>
      <p><strong>Email:</strong> {{user_email}}</p>
      <p><strong>GST Number:</strong> {{gst_number}}</p>
      <p><strong>Submitted:</strong> {{submitted_date}}</p>
    </div>
    <p>Please review the business profile and take appropriate action:</p>
    <a href="{{approve_url}}" class="btn">✓ Approve</a>
    <a href="{{reject_url}}" class="btn btn-reject">✗ Reject</a>
    <a href="{{admin_url}}" class="btn" style="background:#6b7280">View Details</a>
  </div>
</div>
</body>
</html>',
'[{"name":"company_name","type":"string"},{"name":"user_name","type":"string"},{"name":"user_email","type":"string"},{"name":"gst_number","type":"string"},{"name":"submitted_date","type":"date"},{"name":"approve_url","type":"url"},{"name":"reject_url","type":"url"},{"name":"admin_url","type":"url"}]'::jsonb),

-- 5. Account Approved
('APPROVAL_APPROVED', 'Account Approved', '🎉 Congratulations! Your {{app_name}} Account is Approved',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#16a34a;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.success-box{background:#dcfce7;padding:15px;border-radius:6px;margin:15px 0;border-left:4px solid #16a34a}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>🎉 Account Approved!</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Great news! Your business profile has been verified and your account is now fully approved.</p>
    <div class="success-box">
      <p><strong>✓ Status:</strong> Approved</p>
      <p><strong>✓ Company:</strong> {{company_name}}</p>
      <p><strong>✓ Approved On:</strong> {{approved_date}}</p>
    </div>
    <p>You now have full access to all features:</p>
    <ul>
      <li>Create and send quotations</li>
      <li>Generate GST-compliant invoices</li>
      <li>Manage customers and parties</li>
      <li>Access detailed reports</li>
    </ul>
    <a href="{{dashboard_url}}" class="btn">Go to Dashboard</a>
    <p>Welcome aboard!<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"company_name","type":"string"},{"name":"approved_date","type":"date"},{"name":"dashboard_url","type":"url"}]'::jsonb),

-- 6. Account Rejected
('APPROVAL_REJECTED', 'Account Verification Update', 'Action Required: Your {{app_name}} Account Needs Updates',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#dc2626;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.error-box{background:#fee2e2;padding:15px;border-radius:6px;margin:15px 0;border-left:4px solid #dc2626}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>⚠️ Action Required</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Your business profile for <strong>{{company_name}}</strong> requires some updates before it can be approved.</p>
    <div class="error-box">
      <p><strong>Reason:</strong></p>
      <p>{{rejection_reason}}</p>
    </div>
    <p>Please update your business profile with the correct information and resubmit for verification.</p>
    <a href="{{profile_url}}" class="btn">Update Business Profile</a>
    <p>If you have any questions, please contact our support team.</p>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"company_name","type":"string"},{"name":"rejection_reason","type":"string"},{"name":"profile_url","type":"url"}]'::jsonb),

-- 7. Payment Received
('PAYMENT_RECEIVED', 'Payment Confirmation', '✓ Payment Received - {{app_name}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#16a34a;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.receipt-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border:1px solid #e2e8f0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>✓ Payment Received</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Thank you! We have received your payment.</p>
    <div class="receipt-box">
      <h3 style="margin-top:0">Payment Details</h3>
      <table style="width:100%">
        <tr><td><strong>Transaction ID:</strong></td><td>{{transaction_id}}</td></tr>
        <tr><td><strong>Amount:</strong></td><td>₹{{amount}}</td></tr>
        <tr><td><strong>Plan:</strong></td><td>{{plan_name}}</td></tr>
        <tr><td><strong>Valid Until:</strong></td><td>{{valid_until}}</td></tr>
        <tr><td><strong>Payment Date:</strong></td><td>{{payment_date}}</td></tr>
      </table>
    </div>
    <p>Your subscription is now active. Enjoy all premium features!</p>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"transaction_id","type":"string"},{"name":"amount","type":"number"},{"name":"plan_name","type":"string"},{"name":"valid_until","type":"date"},{"name":"payment_date","type":"date"}]'::jsonb),

-- 8. Invoice Generated
('INVOICE_GENERATED', 'Invoice Generated', 'Invoice #{{invoice_no}} Generated - {{app_name}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.invoice-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border:1px solid #e2e8f0}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>📄 Invoice Generated</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Your invoice has been generated successfully.</p>
    <div class="invoice-box">
      <h3 style="margin-top:0">Invoice Details</h3>
      <table style="width:100%">
        <tr><td><strong>Invoice No:</strong></td><td>{{invoice_no}}</td></tr>
        <tr><td><strong>Date:</strong></td><td>{{invoice_date}}</td></tr>
        <tr><td><strong>Customer:</strong></td><td>{{customer_name}}</td></tr>
        <tr><td><strong>Amount:</strong></td><td>₹{{total_amount}}</td></tr>
        <tr><td><strong>GST:</strong></td><td>₹{{gst_amount}}</td></tr>
        <tr><td><strong>Grand Total:</strong></td><td>₹{{grand_total}}</td></tr>
      </table>
    </div>
    <a href="{{invoice_url}}" class="btn">View Invoice</a>
    <a href="{{download_url}}" class="btn" style="background:#16a34a">Download PDF</a>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"invoice_no","type":"string"},{"name":"invoice_date","type":"date"},{"name":"customer_name","type":"string"},{"name":"total_amount","type":"number"},{"name":"gst_amount","type":"number"},{"name":"grand_total","type":"number"},{"name":"invoice_url","type":"url"},{"name":"download_url","type":"url"}]'::jsonb),

-- 9. Support Ticket Created
('TICKET_CREATED', 'Support Ticket Created', '[Ticket #{{ticket_number}}] We Received Your Request',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#8b5cf6;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.ticket-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border:1px solid #e2e8f0}.btn{display:inline-block;background:#8b5cf6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>🎫 Support Ticket Created</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>We have received your support request. Our team will respond as soon as possible.</p>
    <div class="ticket-box">
      <h3 style="margin-top:0">Ticket Details</h3>
      <table style="width:100%">
        <tr><td><strong>Ticket #:</strong></td><td>{{ticket_number}}</td></tr>
        <tr><td><strong>Subject:</strong></td><td>{{subject}}</td></tr>
        <tr><td><strong>Category:</strong></td><td>{{category}}</td></tr>
        <tr><td><strong>Priority:</strong></td><td>{{priority}}</td></tr>
        <tr><td><strong>Created:</strong></td><td>{{created_date}}</td></tr>
      </table>
    </div>
    <p><strong>Your Message:</strong></p>
    <p style="background:#f1f5f9;padding:15px;border-radius:6px">{{message}}</p>
    <a href="{{ticket_url}}" class="btn">View Ticket</a>
    <p>Best regards,<br>The {{app_name}} Support Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"ticket_number","type":"string"},{"name":"subject","type":"string"},{"name":"category","type":"string"},{"name":"priority","type":"string"},{"name":"created_date","type":"date"},{"name":"message","type":"string"},{"name":"ticket_url","type":"url"}]'::jsonb),

-- 10. Admin Notified of New Ticket
('ADMIN_TICKET_CREATED', 'Admin Alert: New Support Ticket', '[New Ticket] #{{ticket_number}} - {{subject}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#8b5cf6;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.ticket-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border:1px solid #e2e8f0}.priority-high{color:#dc2626;font-weight:bold}.priority-urgent{color:#dc2626;font-weight:bold;background:#fee2e2;padding:2px 8px;border-radius:4px}.btn{display:inline-block;background:#8b5cf6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>🎫 New Support Ticket</h1></div>
  <div class="content">
    <p>A new support ticket has been created:</p>
    <div class="ticket-box">
      <table style="width:100%">
        <tr><td><strong>Ticket #:</strong></td><td>{{ticket_number}}</td></tr>
        <tr><td><strong>From:</strong></td><td>{{user_name}} ({{user_email}})</td></tr>
        <tr><td><strong>Company:</strong></td><td>{{company_name}}</td></tr>
        <tr><td><strong>Subject:</strong></td><td>{{subject}}</td></tr>
        <tr><td><strong>Category:</strong></td><td>{{category}}</td></tr>
        <tr><td><strong>Priority:</strong></td><td><span class="priority-{{priority_class}}">{{priority}}</span></td></tr>
      </table>
    </div>
    <p><strong>Message:</strong></p>
    <p style="background:#f1f5f9;padding:15px;border-radius:6px">{{message}}</p>
    <a href="{{admin_ticket_url}}" class="btn">Respond to Ticket</a>
  </div>
</div>
</body>
</html>',
'[{"name":"ticket_number","type":"string"},{"name":"user_name","type":"string"},{"name":"user_email","type":"string"},{"name":"company_name","type":"string"},{"name":"subject","type":"string"},{"name":"category","type":"string"},{"name":"priority","type":"string"},{"name":"priority_class","type":"string"},{"name":"message","type":"string"},{"name":"admin_ticket_url","type":"url"}]'::jsonb),

-- 11. Ticket Updated
('TICKET_UPDATED', 'Support Ticket Updated', '[Ticket #{{ticket_number}}] New Update on Your Request',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#8b5cf6;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.message-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border-left:4px solid #8b5cf6}.btn{display:inline-block;background:#8b5cf6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>💬 Ticket Update</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>There is a new update on your support ticket <strong>#{{ticket_number}}</strong>:</p>
    <div class="message-box">
      <p><strong>From:</strong> {{responder_name}} ({{responder_role}})</p>
      <p><strong>Status:</strong> {{status}}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:15px 0">
      <p>{{response_message}}</p>
    </div>
    <a href="{{ticket_url}}" class="btn">View Full Conversation</a>
    <p>Best regards,<br>The {{app_name}} Support Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"ticket_number","type":"string"},{"name":"responder_name","type":"string"},{"name":"responder_role","type":"string"},{"name":"status","type":"string"},{"name":"response_message","type":"string"},{"name":"ticket_url","type":"url"}]'::jsonb),

-- 12. Ticket Closed
('TICKET_CLOSED', 'Support Ticket Closed', '[Ticket #{{ticket_number}}] Your Request Has Been Resolved',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#16a34a;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.success-box{background:#dcfce7;padding:20px;border-radius:6px;margin:15px 0;border-left:4px solid #16a34a}.rating-box{background:white;padding:20px;border-radius:6px;margin:15px 0;text-align:center}.star{font-size:24px;color:#fbbf24;cursor:pointer}</style></head>
<body>
<div class="container">
  <div class="header"><h1>✓ Ticket Resolved</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <div class="success-box">
      <p>Your support ticket <strong>#{{ticket_number}}</strong> has been resolved and closed.</p>
      <p><strong>Subject:</strong> {{subject}}</p>
      <p><strong>Resolution:</strong> {{resolution_notes}}</p>
    </div>
    <div class="rating-box">
      <p><strong>How was your experience?</strong></p>
      <p>Please rate our support:</p>
      <a href="{{rating_url}}?rating=1" class="star">⭐</a>
      <a href="{{rating_url}}?rating=2" class="star">⭐</a>
      <a href="{{rating_url}}?rating=3" class="star">⭐</a>
      <a href="{{rating_url}}?rating=4" class="star">⭐</a>
      <a href="{{rating_url}}?rating=5" class="star">⭐</a>
    </div>
    <p>If you need further assistance, you can always open a new ticket.</p>
    <p>Best regards,<br>The {{app_name}} Support Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"ticket_number","type":"string"},{"name":"subject","type":"string"},{"name":"resolution_notes","type":"string"},{"name":"rating_url","type":"url"}]'::jsonb),

-- 13. Quotation Sent
('QUOTATION_SENT', 'Quotation Sent', 'Quotation #{{quote_no}} Sent to {{customer_name}}',
'<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background:#f8fafc;padding:30px;border:1px solid #e2e8f0}.quote-box{background:white;padding:20px;border-radius:6px;margin:15px 0;border:1px solid #e2e8f0}.btn{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0}</style></head>
<body>
<div class="container">
  <div class="header"><h1>📨 Quotation Sent</h1></div>
  <div class="content">
    <p>Dear {{user_name}},</p>
    <p>Your quotation has been sent successfully.</p>
    <div class="quote-box">
      <h3 style="margin-top:0">Quotation Details</h3>
      <table style="width:100%">
        <tr><td><strong>Quote No:</strong></td><td>{{quote_no}}</td></tr>
        <tr><td><strong>Customer:</strong></td><td>{{customer_name}}</td></tr>
        <tr><td><strong>Email:</strong></td><td>{{customer_email}}</td></tr>
        <tr><td><strong>Items:</strong></td><td>{{item_count}} items</td></tr>
        <tr><td><strong>Total:</strong></td><td>₹{{total_amount}}</td></tr>
        <tr><td><strong>Sent Via:</strong></td><td>{{sent_via}}</td></tr>
      </table>
    </div>
    <a href="{{quote_url}}" class="btn">View Quotation</a>
    <p>Best regards,<br>The {{app_name}} Team</p>
  </div>
</div>
</body>
</html>',
'[{"name":"app_name","type":"string"},{"name":"user_name","type":"string"},{"name":"quote_no","type":"string"},{"name":"customer_name","type":"string"},{"name":"customer_email","type":"string"},{"name":"item_count","type":"number"},{"name":"total_amount","type":"number"},{"name":"sent_via","type":"string"},{"name":"quote_url","type":"url"}]'::jsonb)

ON CONFLICT (template_key) DO NOTHING;

-- =============================================================================
-- COMPLETION NOTICE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ENTERPRISE COMPLETE SYSTEM MIGRATION FINISHED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - invoice_templates (HTML invoice templates)';
    RAISE NOTICE '  - whatsapp_templates (WhatsApp message templates)';
    RAISE NOTICE '  - email_templates (Email notification templates)';
    RAISE NOTICE '  - template_audit_logs (Immutable audit trail)';
    RAISE NOTICE '  - support_tickets (Support ticket system)';
    RAISE NOTICE '  - support_ticket_messages (Ticket conversations)';
    RAISE NOTICE '  - user_approvals (Business profile approvals)';
    RAISE NOTICE '  - system_notifications (Email queue with retry)';
    RAISE NOTICE '  - pdf_generation_logs (PDF generation tracking)';
    RAISE NOTICE '  - system_audit_logs (System-wide audit)';
    RAISE NOTICE '';
    RAISE NOTICE 'Seeded 13 email templates for mandatory notifications';
    RAISE NOTICE '============================================================';
END $$;

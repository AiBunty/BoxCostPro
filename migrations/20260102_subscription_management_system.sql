-- =============================================================================
-- SUBSCRIPTION PRICING & MANAGEMENT SYSTEM
-- =============================================================================
-- Date: 2026-01-02
-- Purpose: Enterprise-grade subscription management with versioned plans,
--          feature enforcement, GST compliance, and audit-safe subscriptions
--
-- RULES:
-- 1. Plans are ADMIN-DEFINED and SYSTEM-CONTROLLED
-- 2. Payment gateways are COLLECTION ONLY (not source of truth)
-- 3. Plans MUST be versioned (immutable once used)
-- 4. Subscriptions MUST be audit-safe (no delete ever)
-- 5. Feature access MUST be enforced at runtime
-- 6. GST must be calculated correctly
-- 7. No hard-coded pricing or features
-- 8. No silent failures
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- A) SUBSCRIPTION PLANS (Master Plan Definition)
-- =============================================================================
-- Admin-defined plans with immutable codes. Editing creates new versions.

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,                    -- Internal immutable code (e.g., 'starter', 'pro', 'enterprise')
    name TEXT NOT NULL,                           -- Display name
    description TEXT,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    currency TEXT NOT NULL DEFAULT 'INR',
    base_price NUMERIC(10, 2) NOT NULL,           -- Base price before GST
    gst_applicable BOOLEAN NOT NULL DEFAULT true,
    gst_rate NUMERIC(5, 2) DEFAULT 18.00,         -- GST rate (18% default in India)
    is_public BOOLEAN NOT NULL DEFAULT true,      -- Visible to users for self-signup
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DRAFT')),
    sort_order INTEGER DEFAULT 0,                 -- For display ordering
    trial_days INTEGER DEFAULT 0,                 -- Free trial period
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_plans_code ON subscription_plans(code);
CREATE INDEX idx_subscription_plans_status ON subscription_plans(status);
CREATE INDEX idx_subscription_plans_public ON subscription_plans(is_public);

COMMENT ON TABLE subscription_plans IS 'Master subscription plan definitions. Editing creates new versions.';
COMMENT ON COLUMN subscription_plans.code IS 'Immutable internal code. Never changes once set.';

-- =============================================================================
-- B) PLAN VERSIONS (Immutable Price/Feature Snapshots)
-- =============================================================================
-- Every edit to a plan creates a NEW version. Old versions are NEVER modified.
-- Existing subscriptions remain on their original version.

CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    gst_rate NUMERIC(5, 2) DEFAULT 18.00,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,     -- NULL = currently active version
    is_current BOOLEAN DEFAULT true,              -- Only one version is current per plan
    change_notes TEXT,                            -- What changed in this version
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_plan_version UNIQUE (plan_id, version)
);

CREATE INDEX idx_plan_versions_plan ON plan_versions(plan_id);
CREATE INDEX idx_plan_versions_current ON plan_versions(plan_id, is_current) WHERE is_current = true;
CREATE INDEX idx_plan_versions_effective ON plan_versions(effective_from, effective_until);

COMMENT ON TABLE plan_versions IS 'Immutable plan version snapshots. Never modify existing versions.';
COMMENT ON COLUMN plan_versions.is_current IS 'Only one version per plan should be current (true)';

-- =============================================================================
-- C) FEATURES (System-wide Feature Definitions)
-- =============================================================================
-- Admin-defined features that can be attached to plans

CREATE TABLE IF NOT EXISTS subscription_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,                    -- e.g., 'whatsapp', 'invoice_templates', 'users_limit'
    name TEXT NOT NULL,                           -- Display name
    description TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('BOOLEAN', 'NUMBER', 'TEXT')),
    default_value TEXT,                           -- Default value if not specified
    category TEXT,                                -- For grouping in UI (e.g., 'communication', 'limits', 'reports')
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_features_code ON subscription_features(code);
CREATE INDEX idx_subscription_features_category ON subscription_features(category);

COMMENT ON TABLE subscription_features IS 'System-wide feature definitions for plan-based access control';
COMMENT ON COLUMN subscription_features.value_type IS 'BOOLEAN=on/off, NUMBER=limit, TEXT=custom value';

-- =============================================================================
-- D) PLAN FEATURES (Feature Mapping per Plan Version)
-- =============================================================================
-- Maps features to specific plan versions with their values

CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE RESTRICT,
    feature_id UUID NOT NULL REFERENCES subscription_features(id) ON DELETE RESTRICT,
    value TEXT NOT NULL,                          -- Feature value (depends on value_type)
    is_enabled BOOLEAN DEFAULT true,              -- Quick toggle for boolean features
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_plan_version_feature UNIQUE (plan_version_id, feature_id)
);

CREATE INDEX idx_plan_features_version ON plan_features(plan_version_id);
CREATE INDEX idx_plan_features_feature ON plan_features(feature_id);

COMMENT ON TABLE plan_features IS 'Feature limits/flags for each plan version';

-- =============================================================================
-- E) SUBSCRIPTIONS (User Subscription State)
-- =============================================================================
-- User subscriptions. NEVER DELETE. Status transitions only.

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR NOT NULL,
    plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN (
        'PENDING_PAYMENT',    -- Awaiting first payment
        'TRIAL',              -- In trial period
        'ACTIVE',             -- Paid and active
        'PAST_DUE',           -- Payment failed, grace period
        'CANCELLED',          -- User cancelled
        'EXPIRED',            -- Subscription ended
        'SUSPENDED'           -- Admin suspended
    )),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT true,
    cancel_at_period_end BOOLEAN DEFAULT false,   -- Cancel at end of current period
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_reason TEXT,
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspended_reason TEXT,
    payment_method_id TEXT,                       -- Reference to payment method
    gateway_subscription_id TEXT,                 -- External gateway reference (if applicable)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tenant ON user_subscriptions(tenant_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_plan_version ON user_subscriptions(plan_version_id);
CREATE INDEX idx_user_subscriptions_end_date ON user_subscriptions(end_date);
CREATE INDEX idx_user_subscriptions_active ON user_subscriptions(user_id, status) WHERE status IN ('ACTIVE', 'TRIAL');

COMMENT ON TABLE user_subscriptions IS 'User subscription state. NEVER DELETE - status transitions only.';
COMMENT ON COLUMN user_subscriptions.status IS 'Lifecycle: PENDING_PAYMENT -> TRIAL/ACTIVE -> PAST_DUE -> CANCELLED/EXPIRED';

-- =============================================================================
-- F) SUBSCRIPTION AUDIT LOGS (Immutable Audit Trail)
-- =============================================================================
-- Complete audit trail for all subscription changes. APPEND-ONLY.

CREATE TABLE IF NOT EXISTS subscription_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,                         -- CREATE, STATUS_CHANGE, RENEW, CANCEL, UPGRADE, DOWNGRADE, SUSPEND, REACTIVATE
    before_snapshot JSONB,                        -- State before change
    after_snapshot JSONB NOT NULL,                -- State after change
    change_details JSONB,                         -- Additional change context
    actor_id VARCHAR,                             -- Who made the change
    actor_type TEXT CHECK (actor_type IN ('USER', 'ADMIN', 'SYSTEM', 'WEBHOOK')),
    actor_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_audit_subscription ON subscription_audit_logs(subscription_id);
CREATE INDEX idx_subscription_audit_action ON subscription_audit_logs(action);
CREATE INDEX idx_subscription_audit_actor ON subscription_audit_logs(actor_id);
CREATE INDEX idx_subscription_audit_created ON subscription_audit_logs(created_at);

-- Prevent modification of audit logs
CREATE OR REPLACE FUNCTION prevent_subscription_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Subscription audit logs are immutable. Modification is not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_audit_log_immutable
    BEFORE UPDATE OR DELETE ON subscription_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_subscription_audit_modification();

COMMENT ON TABLE subscription_audit_logs IS 'Immutable audit trail. UPDATE/DELETE blocked by trigger.';

-- =============================================================================
-- G) SUBSCRIPTION PAYMENTS (Payment History)
-- =============================================================================
-- All payment attempts and results. Gateway is NOT source of truth.

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,               -- Total amount charged
    base_amount NUMERIC(10, 2) NOT NULL,          -- Amount before GST
    gst_amount NUMERIC(10, 2) DEFAULT 0,          -- GST amount
    gst_rate NUMERIC(5, 2),                       -- GST rate applied
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',            -- Payment initiated
        'PROCESSING',         -- Payment in progress
        'SUCCEEDED',          -- Payment successful
        'FAILED',             -- Payment failed
        'REFUNDED',           -- Payment refunded
        'PARTIALLY_REFUNDED', -- Partial refund
        'DISPUTED'            -- Payment disputed
    )),
    payment_type TEXT CHECK (payment_type IN ('INITIAL', 'RENEWAL', 'UPGRADE', 'ADDON')),
    gateway TEXT NOT NULL,                        -- razorpay, stripe, etc.
    gateway_payment_id TEXT,                      -- External payment ID
    gateway_order_id TEXT,                        -- External order ID
    gateway_signature TEXT,                       -- For verification
    gateway_response JSONB,                       -- Full gateway response
    invoice_id UUID,                              -- Reference to generated invoice
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_user ON subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX idx_subscription_payments_gateway ON subscription_payments(gateway, gateway_payment_id);
CREATE INDEX idx_subscription_payments_invoice ON subscription_payments(invoice_id);

COMMENT ON TABLE subscription_payments IS 'Payment history. Gateway is collection only, not source of truth.';

-- =============================================================================
-- H) SUBSCRIPTION INVOICES (GST-Compliant Invoices)
-- =============================================================================
-- Invoices generated for payments. IMMUTABLE once generated.

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,          -- Sequential invoice number
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES subscription_payments(id),
    tenant_id VARCHAR REFERENCES tenants(id),
    user_id VARCHAR NOT NULL,
    
    -- Billing details (snapshotted at invoice time)
    billing_name TEXT NOT NULL,
    billing_email TEXT NOT NULL,
    billing_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_country TEXT DEFAULT 'India',
    billing_pincode TEXT,
    billing_gstin TEXT,                           -- Customer GSTIN if registered
    
    -- Our company details (snapshotted)
    company_name TEXT NOT NULL,
    company_gstin TEXT NOT NULL,
    company_address TEXT,
    company_state TEXT,
    
    -- Plan details (snapshotted from plan_version)
    plan_name TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    billing_cycle TEXT NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Amounts
    base_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    discount_description TEXT,
    coupon_code TEXT,
    taxable_amount NUMERIC(10, 2) NOT NULL,       -- base_amount - discount
    
    -- GST Breakdown
    is_igst BOOLEAN DEFAULT false,                -- true = inter-state, false = intra-state
    cgst_rate NUMERIC(5, 2),
    cgst_amount NUMERIC(10, 2),
    sgst_rate NUMERIC(5, 2),
    sgst_amount NUMERIC(10, 2),
    igst_rate NUMERIC(5, 2),
    igst_amount NUMERIC(10, 2),
    total_gst NUMERIC(10, 2) NOT NULL,
    
    total_amount NUMERIC(10, 2) NOT NULL,         -- Final amount
    amount_in_words TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',              -- Being prepared
        'ISSUED',             -- Finalized and sent
        'PAID',               -- Payment received
        'VOID',               -- Cancelled (not deleted)
        'CREDIT_NOTE'         -- Refund/credit note
    )),
    issued_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    
    -- For credit notes
    original_invoice_id UUID REFERENCES subscription_invoices(id),
    credit_note_reason TEXT,
    
    -- E-invoice fields (for India GST compliance)
    irn TEXT,                                     -- Invoice Reference Number
    ack_number TEXT,
    ack_date TIMESTAMP WITH TIME ZONE,
    signed_invoice TEXT,                          -- Signed QR code data
    signed_qr_code TEXT,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_invoices_number ON subscription_invoices(invoice_number);
CREATE INDEX idx_subscription_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX idx_subscription_invoices_user ON subscription_invoices(user_id);
CREATE INDEX idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_issued ON subscription_invoices(issued_at);

COMMENT ON TABLE subscription_invoices IS 'GST-compliant invoices. IMMUTABLE once issued.';

-- =============================================================================
-- I) COUPONS (Discount Codes)
-- =============================================================================
-- Admin-managed discount coupons

CREATE TABLE IF NOT EXISTS subscription_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value NUMERIC(10, 2) NOT NULL,       -- Percentage or fixed amount
    max_discount_amount NUMERIC(10, 2),           -- Cap for percentage discounts
    currency TEXT DEFAULT 'INR',
    
    -- Usage limits
    max_uses INTEGER,                             -- Total uses allowed (NULL = unlimited)
    max_uses_per_user INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    
    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Restrictions
    applicable_plans UUID[],                      -- NULL = all plans
    min_amount NUMERIC(10, 2),                    -- Minimum order amount
    first_subscription_only BOOLEAN DEFAULT false,
    
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_coupons_code ON subscription_coupons(code);
CREATE INDEX idx_subscription_coupons_status ON subscription_coupons(status);
CREATE INDEX idx_subscription_coupons_valid ON subscription_coupons(valid_from, valid_until);

COMMENT ON TABLE subscription_coupons IS 'Admin-managed discount coupons';

-- =============================================================================
-- J) COUPON USAGE (Track Coupon Redemptions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS coupon_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES subscription_coupons(id),
    user_id VARCHAR NOT NULL,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id),
    payment_id UUID REFERENCES subscription_payments(id),
    discount_applied NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);

-- =============================================================================
-- K) PLAN AUDIT LOGS (Track Plan Changes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    plan_version_id UUID REFERENCES plan_versions(id),
    action TEXT NOT NULL,                         -- CREATE, UPDATE, ARCHIVE, VERSION_CREATE
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    actor_id VARCHAR,
    actor_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_plan_audit_logs_plan ON plan_audit_logs(plan_id);
CREATE INDEX idx_plan_audit_logs_action ON plan_audit_logs(action);

-- Prevent modification
CREATE TRIGGER plan_audit_log_immutable
    BEFORE UPDATE OR DELETE ON plan_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_subscription_audit_modification();

-- =============================================================================
-- L) SEED DEFAULT FEATURES
-- =============================================================================

INSERT INTO subscription_features (code, name, description, value_type, category, sort_order) VALUES
    ('users_limit', 'User Limit', 'Maximum number of users allowed', 'NUMBER', 'limits', 1),
    ('quotes_per_month', 'Quotes per Month', 'Maximum quotes allowed per month', 'NUMBER', 'limits', 2),
    ('invoices_per_month', 'Invoices per Month', 'Maximum invoices allowed per month', 'NUMBER', 'limits', 3),
    ('parties_limit', 'Parties Limit', 'Maximum party profiles allowed', 'NUMBER', 'limits', 4),
    ('storage_gb', 'Storage (GB)', 'Cloud storage allocation in GB', 'NUMBER', 'limits', 5),
    ('whatsapp_enabled', 'WhatsApp Integration', 'Send quotes/invoices via WhatsApp', 'BOOLEAN', 'communication', 10),
    ('email_enabled', 'Email Integration', 'Send quotes/invoices via Email', 'BOOLEAN', 'communication', 11),
    ('sms_enabled', 'SMS Integration', 'Send notifications via SMS', 'BOOLEAN', 'communication', 12),
    ('invoice_templates', 'Invoice Templates', 'Number of invoice template designs', 'NUMBER', 'templates', 20),
    ('quote_templates', 'Quote Templates', 'Number of quotation template designs', 'NUMBER', 'templates', 21),
    ('custom_branding', 'Custom Branding', 'Use your own logo and colors', 'BOOLEAN', 'branding', 30),
    ('white_label', 'White Label', 'Remove BoxCostPro branding', 'BOOLEAN', 'branding', 31),
    ('api_access', 'API Access', 'Access to REST API', 'BOOLEAN', 'integration', 40),
    ('export_excel', 'Excel Export', 'Export data to Excel', 'BOOLEAN', 'reports', 50),
    ('export_pdf', 'PDF Export', 'Export reports to PDF', 'BOOLEAN', 'reports', 51),
    ('advanced_reports', 'Advanced Reports', 'Access to advanced analytics', 'BOOLEAN', 'reports', 52),
    ('priority_support', 'Priority Support', 'Priority customer support', 'BOOLEAN', 'support', 60),
    ('dedicated_manager', 'Dedicated Manager', 'Dedicated account manager', 'BOOLEAN', 'support', 61),
    ('multi_branch', 'Multi-Branch', 'Support for multiple branches', 'BOOLEAN', 'enterprise', 70),
    ('audit_logs', 'Audit Logs', 'Access to audit logs', 'BOOLEAN', 'enterprise', 71)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- M) SEED DEFAULT PLANS (Examples)
-- =============================================================================

INSERT INTO subscription_plans (code, name, description, billing_cycle, base_price, gst_applicable, gst_rate, is_public, status, sort_order, trial_days) VALUES
    ('free', 'Free', 'Get started with basic features', 'MONTHLY', 0, false, 0, true, 'ACTIVE', 1, 0),
    ('starter', 'Starter', 'Perfect for small businesses', 'MONTHLY', 499, true, 18.00, true, 'ACTIVE', 2, 14),
    ('pro', 'Professional', 'For growing businesses', 'MONTHLY', 999, true, 18.00, true, 'ACTIVE', 3, 14),
    ('enterprise', 'Enterprise', 'For large organizations', 'MONTHLY', 2499, true, 18.00, false, 'ACTIVE', 4, 30)
ON CONFLICT (code) DO NOTHING;

-- Create initial versions for seeded plans
INSERT INTO plan_versions (plan_id, version, price, billing_cycle, gst_rate, is_current, change_notes)
SELECT 
    id, 
    1, 
    base_price, 
    billing_cycle, 
    gst_rate, 
    true,
    'Initial version'
FROM subscription_plans
WHERE code IN ('free', 'starter', 'pro', 'enterprise')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- N) INVOICE NUMBER SEQUENCE
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS subscription_invoice_seq START 1001;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_subscription_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    fy_prefix TEXT;
    current_month INTEGER;
BEGIN
    -- Get current financial year prefix (April to March in India)
    current_month := EXTRACT(MONTH FROM NOW());
    IF current_month >= 4 THEN
        fy_prefix := TO_CHAR(NOW(), 'YY') || TO_CHAR(NOW() + INTERVAL '1 year', 'YY');
    ELSE
        fy_prefix := TO_CHAR(NOW() - INTERVAL '1 year', 'YY') || TO_CHAR(NOW(), 'YY');
    END IF;
    
    next_val := nextval('subscription_invoice_seq');
    
    RETURN 'SUB-' || fy_prefix || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_subscription_invoice_number() IS 'Generates sequential invoice numbers like SUB-2526-001001';

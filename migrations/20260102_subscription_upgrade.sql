-- =============================================================================
-- SUBSCRIPTION SYSTEM UPGRADE - ADDS MISSING TABLES & COLUMNS
-- =============================================================================
-- Date: 2026-01-02
-- Purpose: Add versioning, audit, payment, and invoice tables for enterprise subscriptions
-- =============================================================================

-- =============================================================================
-- A) UPGRADE subscription_plans - Add missing columns
-- =============================================================================

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Make code unique and set default values for existing rows
UPDATE subscription_plans SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;
ALTER TABLE subscription_plans ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code ON subscription_plans(code);

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'MONTHLY';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2);
UPDATE subscription_plans SET base_price = price_monthly WHERE base_price IS NULL;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS gst_applicable BOOLEAN DEFAULT true;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) DEFAULT 18.00;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE subscription_plans SET sort_order = display_order WHERE sort_order = 0 AND display_order IS NOT NULL;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS created_by VARCHAR;

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subscription_plans_status ON subscription_plans(status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_public ON subscription_plans(is_public);

-- =============================================================================
-- B) PLAN VERSIONS (Immutable Price/Feature Snapshots)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_versions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    gst_rate NUMERIC(5, 2) DEFAULT 18.00,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    is_current BOOLEAN DEFAULT true,
    change_notes TEXT,
    created_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_plan_version UNIQUE (plan_id, version)
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_current ON plan_versions(is_current) WHERE is_current = true;

-- Create initial versions for existing plans
INSERT INTO plan_versions (plan_id, version, price, billing_cycle, is_current, change_notes)
SELECT 
    id, 
    1, 
    COALESCE(base_price, price_monthly, 0), 
    COALESCE(billing_cycle, 'MONTHLY'), 
    true,
    'Initial version - auto-created'
FROM subscription_plans
WHERE NOT EXISTS (
    SELECT 1 FROM plan_versions pv WHERE pv.plan_id = subscription_plans.id
);

-- =============================================================================
-- C) UPGRADE user_subscriptions - Add missing columns
-- =============================================================================

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS plan_version_id VARCHAR;

-- Link to plan_versions
UPDATE user_subscriptions 
SET plan_version_id = (
    SELECT pv.id FROM plan_versions pv WHERE pv.plan_id = user_subscriptions.plan_id AND pv.is_current = true LIMIT 1
)
WHERE plan_version_id IS NULL AND plan_id IS NOT NULL;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
UPDATE user_subscriptions SET start_date = current_period_start WHERE start_date IS NULL;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
UPDATE user_subscriptions SET end_date = current_period_end WHERE end_date IS NULL;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS gateway_subscription_id TEXT;
UPDATE user_subscriptions SET gateway_subscription_id = razorpay_subscription_id WHERE gateway_subscription_id IS NULL;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tenant ON user_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_version ON user_subscriptions(plan_version_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions(end_date);

-- =============================================================================
-- D) PLAN FEATURES (Feature Mapping per Plan Version)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_features (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    plan_version_id VARCHAR NOT NULL REFERENCES plan_versions(id) ON DELETE RESTRICT,
    feature_id VARCHAR NOT NULL REFERENCES subscription_features(id) ON DELETE RESTRICT,
    value TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_plan_version_feature UNIQUE (plan_version_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_version ON plan_features(plan_version_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature ON plan_features(feature_id);

-- =============================================================================
-- E) SUBSCRIPTION AUDIT LOGS (Immutable Audit Trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subscription_id VARCHAR NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    change_details JSONB,
    actor_id VARCHAR,
    actor_type TEXT,
    actor_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_subscription ON subscription_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_action ON subscription_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_actor ON subscription_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_created ON subscription_audit_logs(created_at);

-- =============================================================================
-- F) SUBSCRIPTION PAYMENTS (Payment History)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subscription_id VARCHAR NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    tenant_id VARCHAR,
    user_id VARCHAR NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    base_amount NUMERIC(10, 2) NOT NULL,
    gst_amount NUMERIC(10, 2) DEFAULT 0,
    gst_rate NUMERIC(5, 2),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_type TEXT,
    gateway TEXT NOT NULL,
    gateway_payment_id TEXT,
    gateway_order_id TEXT,
    gateway_signature TEXT,
    gateway_response JSONB,
    invoice_id VARCHAR,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user ON subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_gateway ON subscription_payments(gateway, gateway_payment_id);

-- =============================================================================
-- G) SUBSCRIPTION INVOICES (GST-Compliant Invoices)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    subscription_id VARCHAR NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
    payment_id VARCHAR REFERENCES subscription_payments(id),
    tenant_id VARCHAR,
    user_id VARCHAR NOT NULL,
    
    -- Billing details
    billing_name TEXT NOT NULL,
    billing_email TEXT NOT NULL,
    billing_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_country TEXT DEFAULT 'India',
    billing_pincode TEXT,
    billing_gstin TEXT,
    
    -- Our company details
    company_name TEXT NOT NULL,
    company_gstin TEXT NOT NULL,
    company_address TEXT,
    company_state TEXT,
    
    -- Plan details
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
    taxable_amount NUMERIC(10, 2) NOT NULL,
    
    -- GST Breakdown
    is_igst BOOLEAN DEFAULT false,
    cgst_rate NUMERIC(5, 2),
    cgst_amount NUMERIC(10, 2),
    sgst_rate NUMERIC(5, 2),
    sgst_amount NUMERIC(10, 2),
    igst_rate NUMERIC(5, 2),
    igst_amount NUMERIC(10, 2),
    total_gst NUMERIC(10, 2) NOT NULL,
    
    total_amount NUMERIC(10, 2) NOT NULL,
    amount_in_words TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    
    status TEXT NOT NULL DEFAULT 'DRAFT',
    issued_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    
    original_invoice_id VARCHAR REFERENCES subscription_invoices(id),
    credit_note_reason TEXT,
    
    irn TEXT,
    ack_number TEXT,
    ack_date TIMESTAMP WITH TIME ZONE,
    signed_invoice TEXT,
    signed_qr_code TEXT,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_number ON subscription_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_user ON subscription_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);

-- =============================================================================
-- H) COUPON USAGES (Track Coupon Redemptions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS coupon_usages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    coupon_id VARCHAR NOT NULL REFERENCES subscription_coupons(id),
    user_id VARCHAR NOT NULL,
    subscription_id VARCHAR NOT NULL REFERENCES user_subscriptions(id),
    payment_id VARCHAR REFERENCES subscription_payments(id),
    discount_applied NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(user_id);

-- =============================================================================
-- I) PLAN AUDIT LOGS (Track Plan Changes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id),
    plan_version_id VARCHAR REFERENCES plan_versions(id),
    action TEXT NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    actor_id VARCHAR,
    actor_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_audit_logs_plan ON plan_audit_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_audit_logs_action ON plan_audit_logs(action);

-- =============================================================================
-- J) INVOICE NUMBER SEQUENCE
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS subscription_invoice_seq START 1001;

CREATE OR REPLACE FUNCTION generate_subscription_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_val INTEGER;
    fy_prefix TEXT;
    current_month INTEGER;
BEGIN
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

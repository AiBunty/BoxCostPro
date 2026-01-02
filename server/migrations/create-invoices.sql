/**
 * Migration: Create Invoices Table
 *
 * Purpose: Store GST-compliant tax invoices for subscriptions
 * Compliance: Indian GST regulations (CGST Act 2017)
 *
 * Run with: psql $DATABASE_URL -f server/migrations/create-invoices.sql
 */

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Invoice Identity
  invoice_number VARCHAR UNIQUE NOT NULL,
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  financial_year VARCHAR(9) NOT NULL, -- "2024-2025"

  -- Seller (Your Company) Details
  seller_company_name TEXT NOT NULL,
  seller_gstin TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  seller_state_code VARCHAR(2) NOT NULL,
  seller_state_name TEXT NOT NULL,

  -- Buyer (Customer) Details
  buyer_company_name TEXT NOT NULL,
  buyer_gstin TEXT,
  buyer_address TEXT NOT NULL,
  buyer_state_code VARCHAR(2),
  buyer_state_name TEXT,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,

  -- Subscription Details
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  subscription_id VARCHAR, -- REFERENCES user_subscriptions(id) - add constraint after table exists
  plan_name TEXT NOT NULL,
  billing_cycle VARCHAR NOT NULL, -- 'monthly', 'yearly'

  -- Line Items (JSONB for flexibility)
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Example: [{ description: "BoxCostPro Pro Plan - Monthly", hsn_sac: "998314", quantity: 1, unit_price: 999, taxable_value: 999 }]

  -- Pricing Breakdown
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  taxable_value REAL NOT NULL,

  -- GST Calculation (CGST+SGST for intra-state, IGST for inter-state)
  cgst_rate REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_rate REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_rate REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,

  total_tax REAL NOT NULL,
  grand_total REAL NOT NULL,

  -- Payment Reference
  payment_transaction_id VARCHAR, -- REFERENCES payment_transactions(id) - add constraint if table exists
  razorpay_payment_id VARCHAR,
  razorpay_order_id VARCHAR,
  coupon_code VARCHAR,
  coupon_discount REAL DEFAULT 0,

  -- Invoice Metadata
  invoice_template_id VARCHAR, -- REFERENCES invoice_templates(id) - add constraint after template table created
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP,

  -- Email Delivery
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,

  -- Status
  status VARCHAR DEFAULT 'generated', -- 'generated', 'sent', 'paid', 'cancelled'
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user
  ON invoices(user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_number
  ON invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription
  ON invoices(subscription_id);

CREATE INDEX IF NOT EXISTS idx_invoices_date
  ON invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_financial_year
  ON invoices(financial_year);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(status);

-- Comments for documentation
COMMENT ON TABLE invoices IS 'GST-compliant tax invoices for subscription payments. Immutable after generation.';
COMMENT ON COLUMN invoices.invoice_number IS 'Sequential number in format INV/FY2024-25/0001';
COMMENT ON COLUMN invoices.financial_year IS 'Indian financial year (April 1 - March 31) in format YYYY-YYYY';
COMMENT ON COLUMN invoices.line_items IS 'JSONB array of invoice line items with HSN/SAC codes';
COMMENT ON COLUMN invoices.cgst_rate IS 'Central GST rate (9% for intra-state SaaS services)';
COMMENT ON COLUMN invoices.sgst_rate IS 'State GST rate (9% for intra-state SaaS services)';
COMMENT ON COLUMN invoices.igst_rate IS 'Integrated GST rate (18% for inter-state SaaS services)';
COMMENT ON COLUMN invoices.pdf_url IS 'Local filesystem path or S3 URL for generated PDF invoice';

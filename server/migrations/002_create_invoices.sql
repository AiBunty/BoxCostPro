-- Migration: Create invoices table
-- Purpose: Store GST-compliant tax invoices for subscription payments
-- Compliance: ICAI & GSTN regulations for Indian businesses

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Invoice Identity
  invoice_number VARCHAR UNIQUE NOT NULL, -- Format: INV/FY2024-25/0001
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  financial_year VARCHAR(9) NOT NULL, -- "2024-2025"

  -- Seller (YOUR Company) Details
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
  user_id VARCHAR REFERENCES users(id),
  subscription_id VARCHAR REFERENCES user_subscriptions(id),
  plan_name TEXT NOT NULL,
  billing_cycle VARCHAR NOT NULL, -- 'monthly', 'yearly'

  -- Line Items (JSONB for flexibility)
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Example: [{ description: "BoxCostPro Pro Plan - Monthly", hsn_sac: "998314", quantity: 1, unit_price: 999, taxable_value: 999 }]

  -- Pricing Breakdown
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  taxable_value REAL NOT NULL,

  -- GST Calculation (Intra-state: CGST+SGST, Inter-state: IGST)
  cgst_rate REAL DEFAULT 0, -- 9% for intra-state
  cgst_amount REAL DEFAULT 0,
  sgst_rate REAL DEFAULT 0, -- 9% for intra-state
  sgst_amount REAL DEFAULT 0,
  igst_rate REAL DEFAULT 0, -- 18% for inter-state
  igst_amount REAL DEFAULT 0,

  total_tax REAL NOT NULL,
  grand_total REAL NOT NULL,

  -- Payment Reference
  payment_transaction_id VARCHAR REFERENCES payment_transactions(id),
  razorpay_payment_id VARCHAR,
  razorpay_order_id VARCHAR,
  coupon_code VARCHAR,
  coupon_discount REAL DEFAULT 0,

  -- Invoice Metadata
  invoice_template_id VARCHAR, -- References invoice_templates(id) - will be added after template table creation
  pdf_url TEXT, -- S3/cloud storage URL or local path
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
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_financial_year ON invoices(financial_year);

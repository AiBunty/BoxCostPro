/**
 * Migration: Create Invoice Templates Table
 *
 * Purpose: Support multiple invoice designs for PDF generation
 * Templates: Classic, Modern SaaS, Minimal Professional, Brand-Focused
 *
 * Run with: psql $DATABASE_URL -f server/migrations/create-invoice-templates.sql
 */

CREATE TABLE IF NOT EXISTS invoice_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,

  name VARCHAR NOT NULL UNIQUE,
  description TEXT,

  -- Template Design
  layout VARCHAR DEFAULT 'classic', -- 'classic', 'modern', 'minimal', 'brand'
  primary_color VARCHAR(7) DEFAULT '#000000',
  secondary_color VARCHAR(7) DEFAULT '#666666',
  font_family VARCHAR DEFAULT 'Helvetica',

  -- Layout Options
  show_logo BOOLEAN DEFAULT TRUE,
  logo_position VARCHAR DEFAULT 'left', -- 'left', 'center', 'right'
  show_watermark BOOLEAN DEFAULT FALSE,
  watermark_text TEXT,

  -- Footer Content
  footer_note TEXT DEFAULT 'This is a system-generated invoice. No signature required.',
  show_support_email BOOLEAN DEFAULT TRUE,
  support_email TEXT,

  -- Template HTML (mustache/handlebars syntax)
  html_template TEXT NOT NULL,
  css_styles TEXT,

  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default
  ON invoice_templates(is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_invoice_templates_active
  ON invoice_templates(is_active) WHERE is_active = TRUE;

-- Ensure only one default template
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_templates_single_default
  ON invoice_templates(is_default) WHERE is_default = TRUE;

-- Comments
COMMENT ON TABLE invoice_templates IS 'HTML templates for generating PDF invoices with customizable designs';
COMMENT ON COLUMN invoice_templates.html_template IS 'HTML template with Mustache/Handlebars placeholders (e.g., {{invoiceNumber}}, {{buyer.companyName}})';
COMMENT ON COLUMN invoice_templates.is_default IS 'Only one template can be default. Used for new invoices if no template specified.';

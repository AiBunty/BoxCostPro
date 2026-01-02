-- Migration 008: Invoice Templates System
-- Creates GST-compliant invoice template management system

-- Create invoice_templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_templates_template_key ON invoice_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_default ON invoice_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_invoice_templates_status ON invoice_templates(status);

-- Add invoice template tracking columns to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS invoice_template_id VARCHAR REFERENCES invoice_templates(id),
ADD COLUMN IF NOT EXISTS pdf_path TEXT,
ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_pdf_generated BOOLEAN DEFAULT false;

-- Create index for PDF generation tracking
CREATE INDEX IF NOT EXISTS idx_quotes_is_pdf_generated ON quotes(is_pdf_generated);
CREATE INDEX IF NOT EXISTS idx_quotes_invoice_template_id ON quotes(invoice_template_id);

-- Seed default invoice templates
-- Note: HTML content will be loaded from template files in production
-- This seed data contains placeholder HTML that will be replaced

INSERT INTO invoice_templates (name, template_key, description, html_content, is_default, status) VALUES
(
  'Classic GST Invoice',
  'classic-gst',
  'Traditional black & white GST invoice template. CA-friendly, table-based layout optimized for printing and audit purposes.',
  '<!-- HTML template will be loaded from server/templates/invoices/classic-gst.html -->',
  true,
  'active'
),
(
  'Modern SaaS Invoice',
  'modern-saas',
  'Contemporary invoice template with brand header and logo support. Optimized for subscription-based SaaS businesses.',
  '<!-- HTML template will be loaded from server/templates/invoices/modern-saas.html -->',
  false,
  'active'
),
(
  'Minimal Print-Friendly',
  'minimal-print',
  'Minimalist invoice template without colors or shadows. Optimized for printing and PDF generation.',
  '<!-- HTML template will be loaded from server/templates/invoices/minimal-print.html -->',
  false,
  'active'
);

-- Migration complete
COMMENT ON TABLE invoice_templates IS 'Stores GST-compliant invoice HTML templates. Templates are immutable after invoice PDF generation.';
COMMENT ON COLUMN quotes.invoice_template_id IS 'FK to invoice_templates. Captures which template was used for PDF generation (immutable).';
COMMENT ON COLUMN quotes.pdf_path IS 'File system path to generated PDF invoice.';
COMMENT ON COLUMN quotes.pdf_generated_at IS 'Timestamp when PDF was first generated (immutable).';
COMMENT ON COLUMN quotes.is_pdf_generated IS 'Flag indicating if PDF has been generated for this quote/invoice.';

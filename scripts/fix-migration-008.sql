-- Fix Migration 008: Clean up and recreate invoice templates
-- Run this in Neon SQL Editor if migration 008 failed partway

-- Step 1: Drop the table if it exists (this will cascade to quotes columns)
DROP TABLE IF EXISTS invoice_templates CASCADE;

-- Step 2: Remove columns from quotes table if they exist
ALTER TABLE quotes DROP COLUMN IF EXISTS invoice_template_id;
ALTER TABLE quotes DROP COLUMN IF EXISTS pdf_path;
ALTER TABLE quotes DROP COLUMN IF EXISTS pdf_generated_at;
ALTER TABLE quotes DROP COLUMN IF EXISTS is_pdf_generated;

-- Step 3: Now run the full migration fresh
-- Create invoice_templates table
CREATE TABLE invoice_templates (
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

-- Create indexes
CREATE INDEX idx_invoice_templates_template_key ON invoice_templates(template_key);
CREATE INDEX idx_invoice_templates_is_default ON invoice_templates(is_default) WHERE is_default = true;
CREATE INDEX idx_invoice_templates_status ON invoice_templates(status);

-- Add columns to quotes table
ALTER TABLE quotes
  ADD COLUMN invoice_template_id VARCHAR REFERENCES invoice_templates(id),
  ADD COLUMN pdf_path TEXT,
  ADD COLUMN pdf_generated_at TIMESTAMP,
  ADD COLUMN is_pdf_generated BOOLEAN DEFAULT false;

-- Create quotes indexes
CREATE INDEX idx_quotes_is_pdf_generated ON quotes(is_pdf_generated);
CREATE INDEX idx_quotes_invoice_template_id ON quotes(invoice_template_id);

-- Seed default templates
INSERT INTO invoice_templates (name, template_key, description, html_content, is_default, status) VALUES
('Classic GST Invoice', 'classic-gst', 'Traditional black & white GST invoice template. CA-friendly, table-based layout optimized for printing and audit purposes.', '<!-- HTML template will be loaded from server/templates/invoices/classic-gst.html -->', true, 'active'),
('Modern SaaS Invoice', 'modern-saas', 'Contemporary invoice template with brand header and logo support. Optimized for subscription-based SaaS businesses.', '<!-- HTML template will be loaded from server/templates/invoices/modern-saas.html -->', false, 'active'),
('Minimal Print-Friendly', 'minimal-print', 'Minimalist invoice template without colors or shadows. Optimized for printing and PDF generation.', '<!-- HTML template will be loaded from server/templates/invoices/minimal-print.html -->', false, 'active');

-- Add comments
COMMENT ON TABLE invoice_templates IS 'Stores GST-compliant invoice HTML templates. Templates are immutable after invoice PDF generation.';
COMMENT ON COLUMN quotes.invoice_template_id IS 'FK to invoice_templates. Captures which template was used for PDF generation (immutable).';
COMMENT ON COLUMN quotes.pdf_path IS 'File system path to generated PDF invoice.';
COMMENT ON COLUMN quotes.pdf_generated_at IS 'Timestamp when PDF was first generated (immutable).';
COMMENT ON COLUMN quotes.is_pdf_generated IS 'Flag indicating if PDF has been generated for this quote/invoice.';

-- Verify
SELECT 'Migration 008 completed successfully!' as status;
SELECT COUNT(*) as template_count FROM invoice_templates;

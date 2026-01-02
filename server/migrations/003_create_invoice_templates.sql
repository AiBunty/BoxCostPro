-- Migration: Create invoice_templates table
-- Purpose: Support multiple invoice designs with customizable layouts
-- Templates: Classic, Modern SaaS, Minimal Professional, Brand-Focused

CREATE TABLE IF NOT EXISTS invoice_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_active ON invoice_templates(is_active);

-- Add foreign key constraint to invoices table (now that invoice_templates exists)
ALTER TABLE invoices
ADD CONSTRAINT fk_invoice_template
FOREIGN KEY (invoice_template_id) REFERENCES invoice_templates(id);

-- Migration: Add Community Template Marketplace Features
-- Description: Adds fields for community template sharing and removes template limits
-- Date: 2024-12-31

-- Add community fields to quote_templates
ALTER TABLE quote_templates 
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_community_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Add indexes for quote_templates
CREATE INDEX IF NOT EXISTS idx_quote_templates_public ON quote_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_quote_templates_community ON quote_templates(is_community_template);
CREATE INDEX IF NOT EXISTS idx_quote_templates_system ON quote_templates(is_system_template);

-- Add community fields to invoice_templates
ALTER TABLE invoice_templates
  DROP CONSTRAINT IF EXISTS invoice_templates_name_key, -- Remove unique constraint on name
  ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_community_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Add indexes for invoice_templates
CREATE INDEX IF NOT EXISTS idx_invoice_templates_public ON invoice_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_community ON invoice_templates(is_community_template);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_system ON invoice_templates(is_system_template);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_user ON invoice_templates(user_id);

-- Update existing system templates
UPDATE quote_templates SET is_system_template = true WHERE user_id IS NULL;
UPDATE invoice_templates SET is_system_template = true WHERE user_id IS NULL;

-- Add template_ratings table for user feedback
CREATE TABLE IF NOT EXISTS template_ratings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR NOT NULL,
  template_type VARCHAR(20) NOT NULL, -- 'quote' or 'invoice'
  user_id VARCHAR NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(template_id, template_type, user_id) -- One rating per user per template
);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_ratings(template_id, template_type);
CREATE INDEX IF NOT EXISTS idx_template_ratings_user ON template_ratings(user_id);

-- Migration complete

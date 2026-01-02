-- Migration: Alter user_subscriptions table to add invoice reference
-- Purpose: Link subscription to its initial payment invoice

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS initial_invoice_id VARCHAR REFERENCES invoices(id);

-- Index for quick invoice lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_invoice ON user_subscriptions(initial_invoice_id);

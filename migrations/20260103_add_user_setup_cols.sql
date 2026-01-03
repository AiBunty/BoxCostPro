-- Migration: add setup_progress and approval columns to users

ALTER TABLE users
ADD COLUMN IF NOT EXISTS setup_progress INTEGER DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved_by TEXT NULL;

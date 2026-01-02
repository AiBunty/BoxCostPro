-- Add missing column last_reminder_sent_at to onboarding_status
ALTER TABLE onboarding_status
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;

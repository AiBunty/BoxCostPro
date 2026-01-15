-- Add submitted_for_verification_at column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'submitted_for_verification_at'
  ) THEN
    ALTER TABLE users ADD COLUMN submitted_for_verification_at timestamp;
  END IF;
END $$;

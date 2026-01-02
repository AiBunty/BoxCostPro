-- Check if table exists
SELECT to_regclass('public.invoice_templates');

-- If it doesn't exist, the migration will create it

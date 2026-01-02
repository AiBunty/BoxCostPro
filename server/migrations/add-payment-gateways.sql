-- Migration: Add Payment Gateways Table
-- Description: Creates payment_gateways table for multi-gateway payment system with UPI priority
-- Date: 2024

-- Create payment_gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_type VARCHAR(50) NOT NULL UNIQUE,
  gateway_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
  credentials JSONB NOT NULL, -- Encrypted gateway credentials
  webhook_secret VARCHAR(500),
  environment VARCHAR(20) DEFAULT 'test', -- 'test', 'production'
  
  -- Health monitoring
  consecutive_failures INTEGER DEFAULT 0,
  last_health_check TIMESTAMP,
  last_failure_at TIMESTAMP,
  last_failure_reason TEXT,
  total_transactions INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON payment_gateways(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_priority ON payment_gateways(priority);

-- Insert default payment gateways if they don't exist
-- Note: Credentials should be set via admin UI or environment variables
INSERT INTO payment_gateways (gateway_type, gateway_name, is_active, priority, credentials, environment)
SELECT 'razorpay', 'Razorpay', true, 10, 
  jsonb_build_object(
    'keyId', COALESCE(current_setting('env.RAZORPAY_KEY_ID', true), ''),
    'keySecret', COALESCE(current_setting('env.RAZORPAY_KEY_SECRET', true), '')
  ), 
  'test'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE gateway_type = 'razorpay');

INSERT INTO payment_gateways (gateway_type, gateway_name, is_active, priority, credentials, environment)
SELECT 'phonepe', 'PhonePe', true, 5, -- Higher priority for UPI
  jsonb_build_object(
    'merchantId', COALESCE(current_setting('env.PHONEPE_MERCHANT_ID', true), ''),
    'merchantKey', COALESCE(current_setting('env.PHONEPE_MERCHANT_KEY', true), ''),
    'saltIndex', COALESCE(current_setting('env.PHONEPE_SALT_INDEX', true), '1')
  ),
  'test'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE gateway_type = 'phonepe');

INSERT INTO payment_gateways (gateway_type, gateway_name, is_active, priority, credentials, environment)
SELECT 'payu', 'PayU', false, 20, -- Disabled by default, lower priority
  jsonb_build_object(
    'merchantKey', '',
    'merchantSalt', ''
  ),
  'test'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE gateway_type = 'payu');

INSERT INTO payment_gateways (gateway_type, gateway_name, is_active, priority, credentials, environment)
SELECT 'cashfree', 'Cashfree', false, 15, -- Disabled by default
  jsonb_build_object(
    'appId', '',
    'secretKey', ''
  ),
  'test'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE gateway_type = 'cashfree');

INSERT INTO payment_gateways (gateway_type, gateway_name, is_active, priority, credentials, environment)
SELECT 'ccavenue', 'CCAvenue', false, 25, -- Disabled by default, lowest priority
  jsonb_build_object(
    'merchantId', '',
    'accessCode', '',
    'workingKey', ''
  ),
  'test'
WHERE NOT EXISTS (SELECT 1 FROM payment_gateways WHERE gateway_type = 'ccavenue');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_gateways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_gateways_updated_at ON payment_gateways;
CREATE TRIGGER trigger_update_payment_gateways_updated_at
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateways_updated_at();

-- Migration complete

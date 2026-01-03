-- =============================================================================
-- FIX FOREIGN KEY CONSTRAINTS - UUID/VARCHAR MISMATCH
-- =============================================================================

-- Drop and recreate plan_features with correct types
DROP TABLE IF EXISTS plan_features CASCADE;

CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_version_id VARCHAR NOT NULL,
    feature_id UUID NOT NULL REFERENCES subscription_features(id) ON DELETE RESTRICT,
    value TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_plan_version_feature UNIQUE (plan_version_id, feature_id)
);

CREATE INDEX idx_plan_features_version ON plan_features(plan_version_id);
CREATE INDEX idx_plan_features_feature ON plan_features(feature_id);

-- Drop and recreate coupon_usages with correct types
DROP TABLE IF EXISTS coupon_usages CASCADE;

CREATE TABLE coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES subscription_coupons(id),
    user_id VARCHAR NOT NULL,
    subscription_id VARCHAR NOT NULL,
    payment_id VARCHAR,
    discount_applied NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);
CREATE INDEX idx_coupon_usages_subscription ON coupon_usages(subscription_id);

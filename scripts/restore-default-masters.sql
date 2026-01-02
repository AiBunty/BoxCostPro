-- Restore default paper shades, pricing rules, and flute settings (safe, idempotent)
-- Usage (Replit Shell):
--   psql $DATABASE_URL -f scripts/restore-default-masters.sql

BEGIN;

-- 1) Restore default paper shades (global master)
INSERT INTO paper_shades (shade_name, abbreviation, description, is_fluting, sort_order)
VALUES
  ('Kraft/Natural', 'Kra', 'Standard kraft paper', false, 1),
  ('Testliner', 'TL', 'Recycled testliner', false, 2),
  ('Virgin Kraft Liner', 'VKL', 'Premium virgin kraft liner', false, 3),
  ('White Kraft Liner', 'WKL', 'White coated kraft liner', false, 4),
  ('White Top Testliner', 'WTT', 'White top coated testliner', false, 5),
  ('Duplex Grey Back (LWC)', 'LWC', 'Light weight coated duplex', false, 6),
  ('Duplex Grey Back (HWC)', 'HWC', 'Heavy weight coated duplex', false, 7),
  ('Semi Chemical Fluting', 'SCF', 'Semi chemical fluting medium', true, 8),
  ('Recycled Fluting', 'RF', 'Recycled fluting medium', true, 9),
  ('Bagasse (Agro based)', 'BAG', 'Agricultural waste based paper', false, 10),
  ('Golden Kraft', 'GOL', 'Premium golden kraft paper', false, 11)
ON CONFLICT (shade_name) DO NOTHING;

-- 2) Restore paper pricing rules per tenant (defaults)
INSERT INTO paper_pricing_rules (
  tenant_id, user_id,
  low_gsm_limit, low_gsm_adjustment,
  high_gsm_limit, high_gsm_adjustment,
  market_adjustment, paper_setup_completed,
  created_at, updated_at
)
SELECT t.id, NULL,
       101, 1,
       201, 1,
       0, false,
       NOW(), NOW()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM paper_pricing_rules p WHERE p.tenant_id = t.id
);

-- 3) Restore default flute settings per tenant (A, B, C, E, F)
-- Note: Values below use commonly accepted take-up factors and heights; adjust per plant standards if needed
WITH tenants_list AS (
  SELECT id FROM tenants
), defaults AS (
  SELECT * FROM (
    VALUES
      ('A', 1.54, 4.7),
      ('B', 1.36, 2.8),
      ('C', 1.46, 3.8),
      ('E', 1.27, 1.5),
      ('F', 1.16, 0.8)
  ) AS v(flute_type, fluting_factor, flute_height_mm)
)
INSERT INTO flute_settings (
  tenant_id, user_id, flute_type, fluting_factor, flute_height_mm, created_at, updated_at
)
SELECT t.id, NULL, d.flute_type, d.fluting_factor, d.flute_height_mm, NOW(), NOW()
FROM tenants_list t
CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM flute_settings fs
  WHERE fs.tenant_id = t.id AND fs.flute_type = d.flute_type
);

-- 4) Optional: ensure common BF entries exist with placeholder prices (0) for editing later
WITH tenants_list AS (
  SELECT id FROM tenants
), bfs AS (
  SELECT unnest(ARRAY[18,20,22,25]) AS bf
)
INSERT INTO paper_bf_prices (tenant_id, user_id, bf, base_price, created_at, updated_at)
SELECT t.id, NULL, bfs.bf, 0, NOW(), NOW()
FROM tenants_list t
CROSS JOIN bfs
WHERE NOT EXISTS (
  SELECT 1 FROM paper_bf_prices pb
  WHERE pb.tenant_id = t.id AND pb.bf = bfs.bf
);

COMMIT;

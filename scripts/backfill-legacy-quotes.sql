-- Backfill legacy quotes into versioned tables (safe, idempotent)
-- Usage (Replit Shell):
--   psql $DATABASE_URL -f scripts/backfill-legacy-quotes.sql

BEGIN;

-- Process only quotes without an active version yet
WITH qs AS (
  SELECT q.*, 
         COALESCE(bd.default_gst_percent, 5) AS gst_percent,
         COALESCE(bd.round_off_enabled, true) AS round_off_enabled
  FROM quotes q
  LEFT JOIN business_defaults bd ON bd.tenant_id = q.tenant_id
  WHERE q.active_version_id IS NULL
), calc AS (
  SELECT qs.*, 
         COALESCE((
           SELECT SUM(
             COALESCE((item->>'totalCostPerBox')::real, (item->>'costPerBox')::real, 0)
             * COALESCE((item->>'quantity')::int, 0)
           )
           FROM jsonb_array_elements(qs.items) AS item
         ), 0) AS subtotal
  FROM qs
), inserted_versions AS (
  INSERT INTO quote_versions (
    id,
    quote_id,
    version_no,
    payment_terms,
    delivery_days,
    transport_charge,
    transport_remark,
    subtotal,
    gst_percent,
    gst_amount,
    round_off_enabled,
    round_off_value,
    final_total,
    is_negotiated,
    negotiation_type,
    negotiation_value,
    is_locked,
    board_thickness_mm,
    terms_snapshot,
    paper_prices_snapshot,
    transport_snapshot,
    created_at,
    created_by
  )
  SELECT
    gen_random_uuid(),
    calc.id,
    1,
    calc.payment_terms,
    calc.delivery_days,
    calc.transport_charge,
    calc.transport_remark,
    calc.subtotal,
    calc.gst_percent,
    ROUND(calc.subtotal * calc.gst_percent / 100.0, 2) AS gst_amount,
    calc.round_off_enabled,
    CASE WHEN calc.round_off_enabled THEN
      ROUND(calc.subtotal + ROUND(calc.subtotal * calc.gst_percent / 100.0, 2) + COALESCE(calc.transport_charge, 0))
      - (calc.subtotal + ROUND(calc.subtotal * calc.gst_percent / 100.0, 2) + COALESCE(calc.transport_charge, 0))
    ELSE 0 END AS round_off_value,
    CASE WHEN calc.round_off_enabled THEN
      ROUND(calc.subtotal + ROUND(calc.subtotal * calc.gst_percent / 100.0, 2) + COALESCE(calc.transport_charge, 0))
    ELSE
      (calc.subtotal + ROUND(calc.subtotal * calc.gst_percent / 100.0, 2) + COALESCE(calc.transport_charge, 0))
    END AS final_total,
    false,
    NULL,
    NULL,
    false,
    NULL,
    calc.terms_snapshot,
    calc.paper_prices_snapshot,
    calc.transport_snapshot,
    NOW(),
    calc.user_id
  RETURNING id, quote_id, final_total
)
-- Create item versions from legacy items
INSERT INTO quote_item_versions (
  id,
  quote_version_id,
  item_index,
  item_type,
  box_name,
  box_description,
  ply,
  length,
  width,
  height,
  quantity,
  sheet_length,
  sheet_width,
  sheet_weight,
  original_cost_per_box,
  negotiated_cost_per_box,
  final_cost_per_box,
  original_total_cost,
  negotiated_total_cost,
  final_total_cost,
  item_data_snapshot,
  created_at
)
SELECT
  gen_random_uuid(),
  v.id AS quote_version_id,
  idx - 1 AS item_index,
  COALESCE(item->>'itemType', 'rsc') AS item_type,
  NULLIF(item->>'boxName', '') AS box_name,
  NULLIF(item->>'boxDescription', '') AS box_description,
  COALESCE(item->>'ply', '5') AS ply,
  NULLIF(item->>'length', '')::real AS length,
  NULLIF(item->>'width', '')::real AS width,
  NULLIF(item->>'height', '')::real AS height,
  COALESCE(NULLIF(item->>'quantity', '')::int, 0) AS quantity,
  NULLIF(item->>'sheetLength', '')::real AS sheet_length,
  NULLIF(item->>'sheetWidth', '')::real AS sheet_width,
  NULLIF(item->>'sheetWeight', '')::real AS sheet_weight,
  COALESCE(NULLIF(item->>'totalCostPerBox', '')::real, NULLIF(item->>'costPerBox', '')::real, 0) AS original_cost_per_box,
  NULLIF(item->>'negotiatedPrice', '')::real AS negotiated_cost_per_box,
  COALESCE(NULLIF(item->>'negotiatedPrice', '')::real, NULLIF(item->>'totalCostPerBox', '')::real, NULLIF(item->>'costPerBox', '')::real, 0) AS final_cost_per_box,
  COALESCE(NULLIF(item->>'totalCostPerBox', '')::real, NULLIF(item->>'costPerBox', '')::real, 0) * COALESCE(NULLIF(item->>'quantity', '')::int, 0) AS original_total_cost,
  CASE WHEN item ? 'negotiatedPrice' THEN NULLIF(item->>'negotiatedPrice', '')::real * COALESCE(NULLIF(item->>'quantity', '')::int, 0) ELSE NULL END AS negotiated_total_cost,
  COALESCE(NULLIF(item->>'negotiatedPrice', '')::real, NULLIF(item->>'totalCostPerBox', '')::real, NULLIF(item->>'costPerBox', '')::real, 0) * COALESCE(NULLIF(item->>'quantity', '')::int, 0) AS final_total_cost,
  item AS item_data_snapshot,
  NOW()
FROM inserted_versions v
JOIN quotes q ON q.id = v.quote_id
CROSS JOIN LATERAL (
  SELECT i.item, i.idx
  FROM (
    SELECT item, row_number() OVER () AS idx
    FROM jsonb_array_elements(COALESCE(q.items, '[]'::jsonb)) AS item
  ) i
) t
WHERE q.items IS NOT NULL AND jsonb_array_length(q.items) > 0;

-- Update quotes with active_version_id and total_value based on inserted version
UPDATE quotes q
SET active_version_id = v.id,
    total_value = v.final_total,
    updated_at = NOW()
FROM inserted_versions v
WHERE q.id = v.quote_id;

COMMIT;

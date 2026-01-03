-- Migration: Update Paper Shades with Canonical Abbreviations and Categories
-- Date: 2026-01-02
-- Purpose: 
--   1. Add 'category' column to paper_shades table
--   2. Update abbreviations to canonical format (KRA, TST, RCF, etc.)
--   3. Update descriptions to be more descriptive
-- 
-- CRITICAL: These abbreviations are used everywhere:
--   - Paper Spec Generation (e.g., KRA120/32)
--   - Calculator displays
--   - Reports
--   - Excel exports
--   - Paper pricing settings

-- Step 1: Add 'category' column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'paper_shades' AND column_name = 'category'
    ) THEN
        ALTER TABLE paper_shades ADD COLUMN category VARCHAR(20) DEFAULT 'kraft';
        COMMENT ON COLUMN paper_shades.category IS 'Paper category: kraft, liner, duplex, or flute';
    END IF;
END $$;

-- Step 2: Update existing paper shades with canonical abbreviations and categories
-- CANONICAL ABBREVIATIONS (per enterprise requirements):
--   Kraft/Natural           → KRA (was: Kra)
--   Testliner               → TST (was: TL)  
--   Recycled Fluting        → RCF (was: RF)
--   All others remain the same

-- Update Kraft/Natural
UPDATE paper_shades 
SET abbreviation = 'KRA', 
    category = 'kraft',
    description = 'Standard kraft paper'
WHERE LOWER(shade_name) IN ('kraft/natural', 'kraft', 'natural');

-- Update Testliner (was TL, now TST)
UPDATE paper_shades 
SET abbreviation = 'TST', 
    category = 'liner',
    description = 'Recycled testliner'
WHERE LOWER(shade_name) = 'testliner';

-- Update Virgin Kraft Liner
UPDATE paper_shades 
SET category = 'liner',
    description = 'Premium virgin kraft liner'
WHERE LOWER(shade_name) = 'virgin kraft liner';

-- Update White Kraft Liner  
UPDATE paper_shades 
SET category = 'liner',
    description = 'White coated kraft liner'
WHERE LOWER(shade_name) = 'white kraft liner';

-- Update White Top Testliner
UPDATE paper_shades 
SET category = 'liner',
    description = 'White top coated testliner'
WHERE LOWER(shade_name) = 'white top testliner';

-- Update Duplex Grey Back (LWC)
UPDATE paper_shades 
SET category = 'duplex',
    description = 'Light Weight Coating duplex'
WHERE LOWER(shade_name) = 'duplex grey back (lwc)';

-- Update Duplex Grey Back (HWC)
UPDATE paper_shades 
SET category = 'duplex',
    description = 'Heavy Weight Coating duplex'
WHERE LOWER(shade_name) = 'duplex grey back (hwc)';

-- Update Semi Chemical Fluting
UPDATE paper_shades 
SET category = 'flute',
    description = 'Semi chemical fluting medium'
WHERE LOWER(shade_name) = 'semi chemical fluting';

-- Update Recycled Fluting (was RF, now RCF)
UPDATE paper_shades 
SET abbreviation = 'RCF', 
    category = 'flute',
    description = 'Recycled fluting medium'
WHERE LOWER(shade_name) = 'recycled fluting';

-- Update Bagasse (Agro based)
UPDATE paper_shades 
SET category = 'kraft',
    description = 'Agricultural waste based paper'
WHERE LOWER(shade_name) LIKE '%bagasse%';

-- Update Golden Kraft
UPDATE paper_shades 
SET category = 'kraft',
    description = 'Premium golden kraft paper'
WHERE LOWER(shade_name) = 'golden kraft';

-- Step 3: Insert any missing canonical shades
INSERT INTO paper_shades (shade_name, abbreviation, category, description, is_fluting, sort_order, is_active)
VALUES 
    ('Kraft/Natural', 'KRA', 'kraft', 'Standard kraft paper', false, 1, true),
    ('Testliner', 'TST', 'liner', 'Recycled testliner', false, 2, true),
    ('Virgin Kraft Liner', 'VKL', 'liner', 'Premium virgin kraft liner', false, 3, true),
    ('White Kraft Liner', 'WKL', 'liner', 'White coated kraft liner', false, 4, true),
    ('White Top Testliner', 'WTT', 'liner', 'White top coated testliner', false, 5, true),
    ('Duplex Grey Back (LWC)', 'LWC', 'duplex', 'Light Weight Coating duplex', false, 6, true),
    ('Duplex Grey Back (HWC)', 'HWC', 'duplex', 'Heavy Weight Coating duplex', false, 7, true),
    ('Semi Chemical Fluting', 'SCF', 'flute', 'Semi chemical fluting medium', true, 8, true),
    ('Recycled Fluting', 'RCF', 'flute', 'Recycled fluting medium', true, 9, true),
    ('Bagasse (Agro based)', 'BAG', 'kraft', 'Agricultural waste based paper', false, 10, true),
    ('Golden Kraft', 'GOL', 'kraft', 'Premium golden kraft paper', false, 11, true)
ON CONFLICT (shade_name) DO NOTHING;

-- Step 4: Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Paper shades updated with canonical abbreviations';
    RAISE NOTICE 'Abbreviation changes: Kra→KRA, TL→TST, RF→RCF';
    RAISE NOTICE 'Added category column for: kraft, liner, duplex, flute';
END $$;

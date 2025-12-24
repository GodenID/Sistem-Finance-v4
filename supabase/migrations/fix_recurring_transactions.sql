-- ============================================
-- FIX RECURRING_TRANSACTIONS TABLE SCHEMA
-- Fix start_date NOT NULL constraint
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Allow start_date to be NULL (it's not used by the frontend)
ALTER TABLE recurring_transactions 
ALTER COLUMN start_date DROP NOT NULL;

-- 2. Or set default value for start_date
ALTER TABLE recurring_transactions 
ALTER COLUMN start_date SET DEFAULT CURRENT_DATE;

-- 3. Add last_run_date column if not exists
ALTER TABLE recurring_transactions 
ADD COLUMN IF NOT EXISTS last_run_date DATE;

-- Verify columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'recurring_transactions'
ORDER BY ordinal_position;

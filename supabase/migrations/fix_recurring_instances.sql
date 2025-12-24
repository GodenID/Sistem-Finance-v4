-- ============================================
-- FIX RECURRING_INSTANCES TABLE
-- Add missing columns for invoice and transfer
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Add invoice columns
ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS invoice_url TEXT;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS invoice_uploaded_by UUID;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS invoice_uploaded_by_name VARCHAR(255);

-- 2. Add bukti transfer columns (jika belum ada)
ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS bukti_transfer TEXT;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS transferred_by UUID;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS transferred_by_name VARCHAR(255);

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE recurring_instances 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- 3. Rename column jika masih pakai nama lama
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recurring_instances' 
        AND column_name = 'recurring_transaction_id'
    ) THEN
        ALTER TABLE recurring_instances 
        RENAME COLUMN recurring_transaction_id TO recurring_id;
    END IF;
END $$;

-- 4. Fix status constraint untuk mendukung 'transferred'
ALTER TABLE recurring_instances 
DROP CONSTRAINT IF EXISTS recurring_instances_status_check;

ALTER TABLE recurring_instances 
ADD CONSTRAINT recurring_instances_status_check 
CHECK (status IN ('pending', 'transferred', 'skipped', 'executed', 'failed'));

-- 5. Disable RLS
ALTER TABLE recurring_instances DISABLE ROW LEVEL SECURITY;

-- 6. Verifikasi kolom
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'recurring_instances'
ORDER BY ordinal_position;

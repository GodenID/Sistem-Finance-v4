-- ============================================
-- ADD is_confidential COLUMN
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom is_confidential ke payment_requests
ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- 2. Tambah kolom is_confidential ke klaim
ALTER TABLE klaim 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- 3. Tambah kolom is_confidential ke kasbon (jika diperlukan)
ALTER TABLE kasbon 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- 4. Verifikasi kolom sudah ada
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('payment_requests', 'klaim', 'kasbon') 
AND column_name = 'is_confidential';

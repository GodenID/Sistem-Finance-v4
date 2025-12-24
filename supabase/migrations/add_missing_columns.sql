-- ============================================
-- FIX KASBON, KLAIM, PAYMENT_REQUESTS TABLE
-- Add missing columns
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom nama_karyawan ke kasbon
ALTER TABLE kasbon 
ADD COLUMN IF NOT EXISTS nama_karyawan VARCHAR(255);

-- 2. Tambah kolom nama_approver ke kasbon
ALTER TABLE kasbon 
ADD COLUMN IF NOT EXISTS nama_approver VARCHAR(255);

-- 3. Tambah kolom nama_karyawan ke klaim
ALTER TABLE klaim 
ADD COLUMN IF NOT EXISTS nama_karyawan VARCHAR(255);

-- 4. Tambah kolom nama_approver ke klaim  
ALTER TABLE klaim 
ADD COLUMN IF NOT EXISTS nama_approver VARCHAR(255);

-- 5. Tambah kolom is_confidential ke payment_requests (untuk BOD)
ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- 6. Tambah kolom is_confidential ke klaim (untuk BOD)
ALTER TABLE klaim 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- 7. Tambah kolom is_confidential ke kasbon (untuk BOD)
ALTER TABLE kasbon 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- Verifikasi kolom
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('kasbon', 'klaim', 'payment_requests')
AND column_name IN ('nama_karyawan', 'nama_approver', 'is_confidential')
ORDER BY table_name, column_name;

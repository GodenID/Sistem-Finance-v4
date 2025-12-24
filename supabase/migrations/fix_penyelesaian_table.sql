-- ============================================
-- FIX PENYELESAIAN TABLE SCHEMA
-- Add missing columns that frontend expects
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tambah kolom nomor_kasbon
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS nomor_kasbon VARCHAR(50);

-- 2. Tambah kolom nomor_ql
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS nomor_ql VARCHAR(50);

-- 3. Tambah kolom kasbon_nominal
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS kasbon_nominal DECIMAL(15, 2);

-- 4. Tambah kolom nama_karyawan
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS nama_karyawan VARCHAR(255);

-- 5. Tambah kolom detail_pengeluaran (JSONB untuk array)
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS detail_pengeluaran JSONB;

-- 6. Tambah kolom total_pengeluaran
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS total_pengeluaran DECIMAL(15, 2);

-- 7. Tambah kolom selisih
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS selisih DECIMAL(15, 2);

-- 8. Tambah kolom status_selisih
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS status_selisih VARCHAR(50);

-- 9. Tambah kolom metode_pengembalian
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS metode_pengembalian VARCHAR(50);

-- 10. Tambah kolom lampiran
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS lampiran TEXT;

-- 11. Tambah kolom status_approval
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS status_approval VARCHAR(20) DEFAULT 'Pending';

-- 12. Tambah kolom disetujui_oleh (UUID untuk user reference)
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS disetujui_oleh UUID;

-- 13. Tambah kolom nama_approver
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS nama_approver VARCHAR(255);

-- 14. Tambah kolom status_penyelesaian
ALTER TABLE penyelesaian 
ADD COLUMN IF NOT EXISTS status_penyelesaian VARCHAR(50) DEFAULT 'Belum Selesai';

-- 15. Alter total_nominal to allow null (jika belum)
ALTER TABLE penyelesaian 
ALTER COLUMN total_nominal DROP NOT NULL;

-- Verifikasi kolom
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'penyelesaian'
ORDER BY ordinal_position;

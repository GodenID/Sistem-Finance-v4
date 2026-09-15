-- Migration: Add bukti_kekurangan column to penyelesaian
-- Fitur: Finance team bisa upload bukti transfer kekurangan jika status_selisih = 'Kekurangan'

ALTER TABLE penyelesaian
ADD COLUMN IF NOT EXISTS bukti_kekurangan TEXT;

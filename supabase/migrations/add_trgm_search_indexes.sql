-- FIX: indeks trigram untuk pencarian `%teks%` (ilike dengan wildcard di depan
-- tidak bisa memakai btree index -> selalu sequential scan seiring data tumbuh).
-- Jalankan file ini sekali di Supabase SQL Editor (Database -> SQL Editor).
--
-- Catatan: remote DB (db-finance.prasastigroup.id) adalah self-hosted Supabase;
-- pastikan extension pg_trgm tersedia (umumnya sudah terinstal, tinggal enable).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- payment_requests (kolom yang dipakai SEARCH_COLUMNS + filter status)
CREATE INDEX IF NOT EXISTS idx_trgm_pr_nomor_pr ON payment_requests USING gin (nomor_pr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_pr_nomor_ql ON payment_requests USING gin (nomor_ql gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_pr_nama_karyawan ON payment_requests USING gin (nama_karyawan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_pr_nama_event ON payment_requests USING gin (nama_event gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pr_status_created ON payment_requests (status_approval, status_transfer, created_at DESC);

-- kasbon
CREATE INDEX IF NOT EXISTS idx_trgm_kb_nomor_kasbon ON kasbon USING gin (nomor_kasbon gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kb_nomor_ql ON kasbon USING gin (nomor_ql gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kb_nama_karyawan ON kasbon USING gin (nama_karyawan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kb_nama_event ON kasbon USING gin (nama_event gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kb_status_created ON kasbon (status_approval, status_transfer, created_at DESC);

-- klaim
CREATE INDEX IF NOT EXISTS idx_trgm_kl_nomor_klaim ON klaim USING gin (nomor_klaim gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kl_nomor_ql ON klaim USING gin (nomor_ql gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kl_nama_karyawan ON klaim USING gin (nama_karyawan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_kl_nama_event ON klaim USING gin (nama_event gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kl_status_created ON klaim (status_approval, status_transfer, created_at DESC);

-- penyelesaian
CREATE INDEX IF NOT EXISTS idx_trgm_py_nomor_penyelesaian ON penyelesaian USING gin (nomor_penyelesaian gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_py_nomor_kasbon ON penyelesaian USING gin (nomor_kasbon gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_py_nomor_ql ON penyelesaian USING gin (nomor_ql gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_py_nama_karyawan ON penyelesaian USING gin (nama_karyawan gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_py_status_created ON penyelesaian (status_approval, status_penyelesaian, created_at DESC);

-- vendors (kecil, tapi search dipakai di dropdown)
CREATE INDEX IF NOT EXISTS idx_trgm_vendors_nama ON vendors USING gin (nama gin_trgm_ops);

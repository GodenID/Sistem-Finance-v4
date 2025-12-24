-- ============================================
-- RLS Policies untuk Supabase Self-Hosted
-- Jalankan di Supabase SQL Editor
-- ============================================

-- PENTING: Disable RLS untuk development atau gunakan service_role key
-- Karena kita menggunakan custom auth (bukan Supabase Auth),
-- RLS dengan auth.uid() tidak akan berfungsi.

-- Opsi 1: Disable RLS (untuk development/internal app)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE kasbon DISABLE ROW LEVEL SECURITY;
ALTER TABLE klaim DISABLE ROW LEVEL SECURITY;
ALTER TABLE penyelesaian DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- Opsi 2: Jika ingin menggunakan RLS dengan anon key,
-- buat policy yang mengizinkan semua operasi untuk anon role:

-- DROP POLICY IF EXISTS "Allow all for anon" ON users;
-- CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON vendors;
-- CREATE POLICY "Allow all for anon" ON vendors FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON payment_requests;
-- CREATE POLICY "Allow all for anon" ON payment_requests FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON kasbon;
-- CREATE POLICY "Allow all for anon" ON kasbon FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON klaim;
-- CREATE POLICY "Allow all for anon" ON klaim FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON penyelesaian;
-- CREATE POLICY "Allow all for anon" ON penyelesaian FOR ALL USING (true) WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for anon" ON activity_logs;
-- CREATE POLICY "Allow all for anon" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Pastikan extension pgcrypto tersedia untuk bcrypt
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Tambahkan recurring_transactions dan recurring_instances jika belum ada
-- ============================================
-- (Lihat file supabase/migrations/recurring_transactions.sql)

-- ============================================
-- QUICK FIX SQL - Plain Text Password
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tambah table changelog jika belum ada
CREATE TABLE IF NOT EXISTS changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'feature',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Disable RLS untuk changelog
ALTER TABLE changelog DISABLE ROW LEVEL SECURITY;

-- 3. Hapus user goden yang lama (jika ada)
DELETE FROM users WHERE username = 'goden';

-- 4. Insert user goden dengan PLAIN TEXT password
INSERT INTO users (id, username, password, name, role, created_at)
VALUES (
    gen_random_uuid(),
    'goden',
    'lebahganteng',
    'Goden Admin',
    'administrator',
    NOW()
);

-- 5. Verifikasi user
SELECT id, username, password, name, role FROM users WHERE username = 'goden';

-- ============================================
-- FIX CHANGELOG TABLE
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Hapus tabel lama
DROP TABLE IF EXISTS changelog CASCADE;

-- Buat tabel changelog dengan struktur yang benar
CREATE TABLE changelog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(20) NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('new', 'improved', 'fix', 'removed')),
    description TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE changelog DISABLE ROW LEVEL SECURITY;

-- Insert sample data
INSERT INTO changelog (version, change_type, description, date) VALUES
('1.5.0', 'new', 'Integrasi dengan Supabase Self-Hosted', '2025-12-20'),
('1.5.0', 'improved', 'Upload file menggunakan Cloudflare R2', '2025-12-20'),
('1.5.0', 'fix', 'Perbaikan autentikasi menggunakan plain text password', '2025-12-20');

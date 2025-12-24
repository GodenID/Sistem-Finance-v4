-- Seed data dengan password yang benar
-- Password untuk semua user adalah: password123

-- Hapus data lama (opsional)
-- DELETE FROM users WHERE username IN ('admin', 'finance', 'bod', 'staff', 'manager');

-- Insert users dengan bcrypt hash untuk 'password123'
-- Hash ini di-generate dengan bcrypt rounds=10
INSERT INTO users (id, username, password, name, role, created_at)
VALUES 
    (uuid_generate_v4(), 'admin', '$2a$10$8K1p1dZ.W1yJDY5L5rC9H.L3g1KeZ6xzL.kG5I9J5h5LG0V0mFvHO', 'Administrator Prasasti', 'administrator', NOW()),
    (uuid_generate_v4(), 'finance', '$2a$10$8K1p1dZ.W1yJDY5L5rC9H.L3g1KeZ6xzL.kG5I9J5h5LG0V0mFvHO', 'Tim Finance', 'team_finance', NOW()),
    (uuid_generate_v4(), 'bod', '$2a$10$8K1p1dZ.W1yJDY5L5rC9H.L3g1KeZ6xzL.kG5I9J5h5LG0V0mFvHO', 'Direktur Utama', 'bod', NOW()),
    (uuid_generate_v4(), 'manager', '$2a$10$8K1p1dZ.W1yJDY5L5rC9H.L3g1KeZ6xzL.kG5I9J5h5LG0V0mFvHO', 'Manager Operasional', 'manager', NOW()),
    (uuid_generate_v4(), 'staff', '$2a$10$8K1p1dZ.W1yJDY5L5rC9H.L3g1KeZ6xzL.kG5I9J5h5LG0V0mFvHO', 'Staff Karyawan', 'staff', NOW())
ON CONFLICT (username) DO UPDATE SET 
    password = EXCLUDED.password,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- Insert sample vendors
INSERT INTO vendors (id, nama, kategori, kontak, alamat, nama_bank, nomor_rekening, nama_pemilik_rekening, status, created_at)
VALUES
    (uuid_generate_v4(), 'PT Supplier Utama', 'Supplier', '021-1234567', 'Jl. Sudirman No. 123, Jakarta', 'BCA', '1234567890', 'PT Supplier Utama', 'active', NOW()),
    (uuid_generate_v4(), 'CV Jasa Kreatif', 'Jasa', '021-9876543', 'Jl. Gatot Subroto No. 456, Jakarta', 'Mandiri', '0987654321', 'CV Jasa Kreatif', 'active', NOW()),
    (uuid_generate_v4(), 'PT Media Partner', 'Media', '021-5555555', 'Jl. Thamrin No. 789, Jakarta', 'BNI', '5555555555', 'PT Media Partner', 'active', NOW())
ON CONFLICT DO NOTHING;

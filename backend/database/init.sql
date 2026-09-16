-- PostgreSQL Database Schema untuk Finance Prasasti Group
-- Jalankan script ini di PostgreSQL untuk inisialisasi database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    email_notifications_enabled BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    role VARCHAR(50) NOT NULL CHECK (role IN ('administrator', 'team_finance', 'bod', 'hrd', 'staff', 'manager', 'guest')),
    permissions JSONB DEFAULT NULL, -- override permission per-user oleh Administrator (NULL = default role)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: vendors
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    kontak VARCHAR(100),
    alamat TEXT,
    nama_bank VARCHAR(100),
    nomor_rekening VARCHAR(50),
    nama_pemilik_rekening VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: payment_requests
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_pr VARCHAR(20) UNIQUE NOT NULL,
    nomor_ql VARCHAR(50),
    tipe VARCHAR(100),
    id_perusahaan VARCHAR(10),
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    nominal DECIMAL(15, 2) NOT NULL,
    keterangan TEXT,
    lampiran TEXT,
    bukti_transfer TEXT,
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer', 'Reject')),
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Approved', 'Rejected')),
    disetujui_oleh VARCHAR(255),
    nama_karyawan VARCHAR(255),
    is_confidential BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: kasbon
CREATE TABLE IF NOT EXISTS kasbon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_kasbon VARCHAR(20) UNIQUE NOT NULL,
    nomor_ql VARCHAR(50),
    tipe VARCHAR(100),
    id_perusahaan VARCHAR(10),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    nominal DECIMAL(15, 2) NOT NULL,
    metode_pembayaran VARCHAR(50),
    nama_bank VARCHAR(100),
    nomor_rekening VARCHAR(50),
    nama_pemilik_rekening VARCHAR(255),
    keterangan TEXT,
    bukti_transfer TEXT,
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Approved', 'Rejected')),
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer', 'Reject')),
    disetujui_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: klaim
CREATE TABLE IF NOT EXISTS klaim (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_klaim VARCHAR(20) UNIQUE NOT NULL,
    nomor_ql VARCHAR(50),
    tipe VARCHAR(100),
    id_perusahaan VARCHAR(10),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    nominal DECIMAL(15, 2) NOT NULL,
    metode_pembayaran VARCHAR(50),
    nama_bank VARCHAR(100),
    nomor_rekening VARCHAR(50),
    nama_pemilik_rekening VARCHAR(255),
    lampiran TEXT,
    keterangan TEXT,
    bukti_transfer TEXT,
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Approved', 'Rejected')),
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer', 'Reject')),
    disetujui_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: penyelesaian
CREATE TABLE IF NOT EXISTS penyelesaian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_penyelesaian VARCHAR(20) UNIQUE NOT NULL,
    nomor_referensi VARCHAR(50),
    tipe VARCHAR(100),
    id_perusahaan VARCHAR(10),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    total_nominal DECIMAL(15, 2) NOT NULL,
    breakdown JSONB,
    keterangan TEXT,
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Table: activity_logs (Audit Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    record_number VARCHAR(50),
    action VARCHAR(20) NOT NULL,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_payment_requests_vendor ON payment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_by ON payment_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status_approval ON payment_requests(status_approval);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status_transfer ON payment_requests(status_transfer);

CREATE INDEX IF NOT EXISTS idx_kasbon_user ON kasbon(user_id);
CREATE INDEX IF NOT EXISTS idx_kasbon_created_at ON kasbon(created_at);
CREATE INDEX IF NOT EXISTS idx_kasbon_status_approval ON kasbon(status_approval);
CREATE INDEX IF NOT EXISTS idx_kasbon_status_transfer ON kasbon(status_transfer);

CREATE INDEX IF NOT EXISTS idx_klaim_user ON klaim(user_id);
CREATE INDEX IF NOT EXISTS idx_klaim_created_at ON klaim(created_at);
CREATE INDEX IF NOT EXISTS idx_klaim_status_approval ON klaim(status_approval);
CREATE INDEX IF NOT EXISTS idx_klaim_status_transfer ON klaim(status_transfer);

CREATE INDEX IF NOT EXISTS idx_penyelesaian_user ON penyelesaian(user_id);
CREATE INDEX IF NOT EXISTS idx_penyelesaian_created_at ON penyelesaian(created_at);
CREATE INDEX IF NOT EXISTS idx_penyelesaian_nomor_referensi ON penyelesaian(nomor_referensi);

CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_table_name ON activity_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_record_id ON activity_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_at ON activity_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_by ON activity_logs(changed_by);

-- Function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers untuk auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON payment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kasbon_updated_at ON kasbon;
CREATE TRIGGER update_kasbon_updated_at BEFORE UPDATE ON kasbon
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_klaim_updated_at ON klaim;
CREATE TRIGGER update_klaim_updated_at BEFORE UPDATE ON klaim
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_penyelesaian_updated_at ON penyelesaian;
CREATE TRIGGER update_penyelesaian_updated_at BEFORE UPDATE ON penyelesaian
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (id, username, password, name, role, created_at)
VALUES (
    uuid_generate_v4(),
    'admin',
    '$2a$10$rQnM1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN',
    'Administrator',
    'administrator',
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- Sample data for testing (optional)
-- Insert more users
INSERT INTO users (id, username, password, name, role, created_at)
VALUES 
    (uuid_generate_v4(), 'finance', '$2a$10$rQnM1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN', 'Team Finance', 'team_finance', NOW()),
    (uuid_generate_v4(), 'bod', '$2a$10$rQnM1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN', 'Board of Directors', 'bod', NOW()),
    (uuid_generate_v4(), 'staff', '$2a$10$rQnM1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN', 'Staff User', 'staff', NOW())
ON CONFLICT (username) DO NOTHING;

COMMIT;

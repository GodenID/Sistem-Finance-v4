-- ============================================
-- FINANCE PRASASTI GROUP V3 - COMPLETE SQL SETUP
-- Untuk Supabase Self-Hosted
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- DROP EXISTING TABLES (untuk fresh install)
-- ============================================
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS penyelesaian CASCADE;
DROP TABLE IF EXISTS klaim CASCADE;
DROP TABLE IF EXISTS kasbon CASCADE;
DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS recurring_instances CASCADE;
DROP TABLE IF EXISTS recurring_transactions CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('administrator', 'team_finance', 'bod', 'staff', 'manager', 'guest')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLE: vendors
-- ============================================
CREATE TABLE vendors (
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

-- ============================================
-- TABLE: payment_requests
-- ============================================
CREATE TABLE payment_requests (
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

-- ============================================
-- TABLE: kasbon
-- ============================================
CREATE TABLE kasbon (
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
    nama_approver VARCHAR(255),
    nama_karyawan VARCHAR(255),
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLE: klaim
-- ============================================
CREATE TABLE klaim (
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
    nama_approver VARCHAR(255),
    nama_karyawan VARCHAR(255),
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLE: penyelesaian
-- ============================================
CREATE TABLE penyelesaian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_penyelesaian VARCHAR(20) UNIQUE NOT NULL,
    nomor_kasbon VARCHAR(50),
    nomor_ql VARCHAR(50),
    kasbon_nominal DECIMAL(15, 2),
    nama_karyawan VARCHAR(255),
    detail_pengeluaran JSONB,
    total_pengeluaran DECIMAL(15, 2),
    total_nominal DECIMAL(15, 2),
    selisih DECIMAL(15, 2),
    status_selisih VARCHAR(50),
    metode_pengembalian VARCHAR(50),
    lampiran TEXT,
    keterangan TEXT,
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Approved', 'Rejected')),
    disetujui_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    nama_approver VARCHAR(255),
    status_penyelesaian VARCHAR(50) DEFAULT 'Belum Selesai',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLE: recurring_transactions
-- ============================================
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('payment_request', 'kasbon', 'klaim')),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    month_of_year INTEGER CHECK (month_of_year >= 1 AND month_of_year <= 12),
    start_date DATE NOT NULL,
    end_date DATE,
    next_run_date DATE,
    is_active BOOLEAN DEFAULT true,
    template_data JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- TABLE: recurring_instances
-- ============================================
CREATE TABLE recurring_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_transaction_id UUID REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'skipped', 'failed')),
    result_id UUID,
    result_type VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE: changelog (untuk version tracking)
-- ============================================
CREATE TABLE changelog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'feature' CHECK (type IN ('feature', 'bugfix', 'improvement', 'breaking')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE: activity_logs
-- ============================================
CREATE TABLE activity_logs (
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

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_payment_requests_vendor ON payment_requests(vendor_id);
CREATE INDEX idx_payment_requests_created_by ON payment_requests(created_by);
CREATE INDEX idx_payment_requests_created_at ON payment_requests(created_at);
CREATE INDEX idx_payment_requests_status_approval ON payment_requests(status_approval);
CREATE INDEX idx_payment_requests_status_transfer ON payment_requests(status_transfer);

CREATE INDEX idx_kasbon_user ON kasbon(user_id);
CREATE INDEX idx_kasbon_created_at ON kasbon(created_at);
CREATE INDEX idx_kasbon_status_approval ON kasbon(status_approval);
CREATE INDEX idx_kasbon_status_transfer ON kasbon(status_transfer);

CREATE INDEX idx_klaim_user ON klaim(user_id);
CREATE INDEX idx_klaim_created_at ON klaim(created_at);
CREATE INDEX idx_klaim_status_approval ON klaim(status_approval);
CREATE INDEX idx_klaim_status_transfer ON klaim(status_transfer);

CREATE INDEX idx_penyelesaian_user ON penyelesaian(user_id);
CREATE INDEX idx_penyelesaian_created_at ON penyelesaian(created_at);
CREATE INDEX idx_penyelesaian_nomor_referensi ON penyelesaian(nomor_referensi);

CREATE INDEX idx_vendors_status ON vendors(status);

CREATE INDEX idx_recurring_transactions_next_run ON recurring_transactions(next_run_date);
CREATE INDEX idx_recurring_transactions_active ON recurring_transactions(is_active);
CREATE INDEX idx_recurring_instances_recurring_id ON recurring_instances(recurring_transaction_id);
CREATE INDEX idx_recurring_instances_status ON recurring_instances(status);

CREATE INDEX idx_activity_logs_table_name ON activity_logs(table_name);
CREATE INDEX idx_activity_logs_record_id ON activity_logs(record_id);
CREATE INDEX idx_activity_logs_changed_at ON activity_logs(changed_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_changed_by ON activity_logs(changed_by);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON payment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kasbon_updated_at BEFORE UPDATE ON kasbon
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_klaim_updated_at BEFORE UPDATE ON klaim
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_penyelesaian_updated_at BEFORE UPDATE ON penyelesaian
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DISABLE ROW LEVEL SECURITY (untuk custom auth)
-- ============================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE kasbon DISABLE ROW LEVEL SECURITY;
ALTER TABLE klaim DISABLE ROW LEVEL SECURITY;
ALTER TABLE penyelesaian DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- INSERT DEFAULT USER
-- Username: goden
-- Password: lebahganteng
-- Role: administrator
-- ============================================
INSERT INTO users (id, username, password, name, role, created_at)
VALUES (
    uuid_generate_v4(),
    'goden',
    '$2b$10$nT3j7cPk5UMBoX7qZ2kkHOsbW3sFVeutjEgKQqaCIZeBey/VvKFs',
    'Goden Admin',
    'administrator',
    NOW()
);

-- ============================================
-- DONE! Database is ready to use.
-- ============================================

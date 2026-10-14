-- Supabase Database Schema untuk Finance Prasasti Group
-- Jalankan script ini di Supabase SQL Editor

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
    role VARCHAR(50) NOT NULL CHECK (role IN ('administrator', 'team_finance', 'head_finance', 'bod', 'hrd', 'staff', 'manager', 'guest')),
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
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    nominal DECIMAL(15, 2) NOT NULL,
    keterangan TEXT,
    lampiran TEXT, -- Menyimpan R2 URL
    bukti_transfer TEXT, -- URL bukti transfer dari R2
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer')),
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Manager Approved', 'Approved', 'Rejected')),
    disetujui_oleh VARCHAR(255), -- Nama user yang approve
    manager_approved_by TEXT,
    manager_approved_at TIMESTAMP WITH TIME ZONE,
    head_finance_approved_by TEXT,
    head_finance_approved_at TIMESTAMP WITH TIME ZONE,
    transferred_at TIMESTAMP WITH TIME ZONE,
    rejected_by TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
    nama_karyawan VARCHAR(255), -- Nama karyawan yang membuat PR
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
    bukti_transfer TEXT, -- URL bukti transfer dari R2 (wajib jika metode = Transfer)
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Manager Approved', 'Approved', 'Rejected')),
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer')),
    disetujui_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    manager_approved_by TEXT,
    manager_approved_at TIMESTAMP WITH TIME ZONE,
    head_finance_approved_by TEXT,
    head_finance_approved_at TIMESTAMP WITH TIME ZONE,
    transferred_at TIMESTAMP WITH TIME ZONE,
    rejected_by TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
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
    lampiran TEXT, -- Menyimpan R2 URL
    keterangan TEXT,
    bukti_transfer TEXT, -- URL bukti transfer dari R2 (wajib jika metode = Transfer)
    status_approval VARCHAR(20) DEFAULT 'Pending' CHECK (status_approval IN ('Pending', 'Manager Approved', 'Approved', 'Rejected')),
    status_transfer VARCHAR(20) DEFAULT 'Belum Transfer' CHECK (status_transfer IN ('Belum Transfer', 'Sudah Transfer')),
    disetujui_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    manager_approved_by TEXT,
    manager_approved_at TIMESTAMP WITH TIME ZONE,
    head_finance_approved_by TEXT,
    head_finance_approved_at TIMESTAMP WITH TIME ZONE,
    transferred_at TIMESTAMP WITH TIME ZONE,
    rejected_by TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
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

-- Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_payment_requests_vendor ON payment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_by ON payment_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_kasbon_user ON kasbon(user_id);
CREATE INDEX IF NOT EXISTS idx_kasbon_created_at ON kasbon(created_at);
CREATE INDEX IF NOT EXISTS idx_klaim_user ON klaim(user_id);
CREATE INDEX IF NOT EXISTS idx_klaim_created_at ON klaim(created_at);
CREATE INDEX IF NOT EXISTS idx_penyelesaian_user ON penyelesaian(user_id);
CREATE INDEX IF NOT EXISTS idx_penyelesaian_created_at ON penyelesaian(created_at);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email_notifications_enabled ON users(email_notifications_enabled);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasbon ENABLE ROW LEVEL SECURITY;
ALTER TABLE klaim ENABLE ROW LEVEL SECURITY;
ALTER TABLE penyelesaian ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Policy: All authenticated users can read vendors
CREATE POLICY "Authenticated users can read vendors" ON vendors
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: All authenticated users can manage vendors (adjust based on role)
CREATE POLICY "Authenticated users can manage vendors" ON vendors
    FOR ALL USING (auth.role() = 'authenticated');

-- Policy: Users can read all payment requests
CREATE POLICY "Authenticated users can read payment requests" ON payment_requests
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can create payment requests
CREATE POLICY "Authenticated users can create payment requests" ON payment_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update their own payment requests or if they are admin/finance
CREATE POLICY "Users can update payment requests" ON payment_requests
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND role IN ('administrator', 'team_finance')
            )
        )
    );

-- Similar policies for kasbon, klaim, penyelesaian
CREATE POLICY "Authenticated users can read kasbon" ON kasbon
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create kasbon" ON kasbon
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own kasbon" ON kasbon
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND role IN ('administrator', 'team_finance', 'bod')
            )
        )
    );

CREATE POLICY "Authenticated users can read klaim" ON klaim
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create klaim" ON klaim
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own klaim" ON klaim
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND role IN ('administrator', 'team_finance', 'bod')
            )
        )
    );

CREATE POLICY "Authenticated users can read penyelesaian" ON penyelesaian
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create penyelesaian" ON penyelesaian
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own penyelesaian" ON penyelesaian
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND role IN ('administrator', 'team_finance')
            )
        )
    );

-- Function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers untuk auto-update updated_at
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

-- =====================================================
-- Table: activity_logs (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,           -- 'payment_requests', 'kasbon', 'klaim', 'penyelesaian'
    record_id UUID NOT NULL,                    -- ID record yang diubah
    record_number VARCHAR(50),                  -- Nomor PR/Kasbon/Klaim untuk display
    action VARCHAR(20) NOT NULL,                -- 'create', 'update', 'delete', 'approve', 'reject', 'transfer'
    field_changed VARCHAR(100),                 -- Field yang diubah (untuk update)
    old_value TEXT,                             -- Nilai lama
    new_value TEXT,                             -- Nilai baru
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name VARCHAR(255),               -- Nama user untuk display cepat
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Index untuk activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_table_name ON activity_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_record_id ON activity_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_at ON activity_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_by ON activity_logs(changed_by);

-- RLS untuk activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Semua authenticated users bisa read activity logs
CREATE POLICY "Authenticated users can read activity logs" ON activity_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Semua authenticated users bisa create activity logs
CREATE POLICY "Authenticated users can create activity logs" ON activity_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Trigger untuk activity_logs (tidak perlu updated_at karena log bersifat immutable)


-- Migration: Activity Logs Table
-- Run this SQL in your Supabase SQL Editor to add audit trail functionality

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

-- Note: Activity logs are immutable - no update/delete policies needed

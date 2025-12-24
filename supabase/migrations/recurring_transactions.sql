-- Migration: Create recurring_transactions table
-- Date: 2024-12-09
-- Updated: 2024-12-09 - Added bank information support in template_data

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: recurring_transactions
-- template_data JSONB structure:
-- {
--   "tipe": "Operasional/Marketing/...",
--   "id_perusahaan": "PT-XXX",
--   "nominal": 1000000,
--   "keterangan": "Description",
--   "nama_karyawan": "Employee Name",
--   "nama_bank": "BCA/Mandiri/BNI/...",
--   "nomor_rekening": "1234567890",
--   "nama_pemilik_rekening": "Account Holder Name"
-- }
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('payment_request', 'kasbon', 'klaim')),
    template_data JSONB NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    next_run_date DATE NOT NULL,
    last_run_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_type ON recurring_transactions(type);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_run ON recurring_transactions(next_run_date);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active ON recurring_transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_created_by ON recurring_transactions(created_by);

-- Enable RLS
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for anon key since app uses custom auth)
-- If using Supabase Auth, replace with more restrictive policies
CREATE POLICY "Allow all operations on recurring_transactions" ON recurring_transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Function for updated_at trigger (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_recurring_transactions_updated_at ON recurring_transactions;
CREATE TRIGGER update_recurring_transactions_updated_at 
    BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: recurring_logs (history of executed recurring transactions)
CREATE TABLE IF NOT EXISTS recurring_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_id UUID REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_record_id UUID,
    created_record_number VARCHAR(50),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_recurring_logs_recurring_id ON recurring_logs(recurring_id);
CREATE INDEX IF NOT EXISTS idx_recurring_logs_executed_at ON recurring_logs(executed_at);

-- Enable RLS for logs
ALTER TABLE recurring_logs ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for anon key since app uses custom auth)
CREATE POLICY "Allow all operations on recurring_logs" ON recurring_logs
    FOR ALL USING (true) WITH CHECK (true);

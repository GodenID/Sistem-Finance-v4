-- Migration: Create recurring_instances table
-- Date: 2024-12-09
-- Description: Tabel untuk menyimpan instance pembayaran berulang dengan bukti transfer

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: recurring_instances
-- Menyimpan setiap instance pembayaran dari recurring_transactions
CREATE TABLE IF NOT EXISTS recurring_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_id UUID NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,                    -- Tanggal jatuh tempo pembayaran
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'transferred', 'skipped')),
    bukti_transfer TEXT,                             -- URL bukti transfer dari R2
    transferred_at TIMESTAMP WITH TIME ZONE,         -- Waktu transfer dilakukan
    transferred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transferred_by_name VARCHAR(255),                -- Nama user untuk display
    notes TEXT,                                      -- Catatan tambahan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_instances_recurring_id ON recurring_instances(recurring_id);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_scheduled_date ON recurring_instances(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_status ON recurring_instances(status);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_transferred_by ON recurring_instances(transferred_by);

-- Disable RLS (karena menggunakan custom auth dengan anon key)
ALTER TABLE recurring_instances DISABLE ROW LEVEL SECURITY;

-- Policies (tidak diperlukan karena RLS disabled)
-- CREATE POLICY "Allow all operations on recurring_instances" ON recurring_instances
--     FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_recurring_instances_updated_at ON recurring_instances;
CREATE TRIGGER update_recurring_instances_updated_at 
    BEFORE UPDATE ON recurring_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-create first instance when recurring_transaction is created
CREATE OR REPLACE FUNCTION create_initial_recurring_instance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create instance for active recurring transactions
    IF NEW.is_active = true AND NEW.next_run_date IS NOT NULL THEN
        INSERT INTO recurring_instances (recurring_id, scheduled_date, status)
        VALUES (NEW.id, NEW.next_run_date, 'pending')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create initial instance when recurring_transaction is created
DROP TRIGGER IF EXISTS trigger_create_initial_instance ON recurring_transactions;
CREATE TRIGGER trigger_create_initial_instance
    AFTER INSERT ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION create_initial_recurring_instance();

-- Create instances for existing recurring_transactions (if any)
INSERT INTO recurring_instances (recurring_id, scheduled_date, status)
SELECT id, next_run_date, 'pending'
FROM recurring_transactions
WHERE is_active = true AND next_run_date IS NOT NULL
ON CONFLICT DO NOTHING;

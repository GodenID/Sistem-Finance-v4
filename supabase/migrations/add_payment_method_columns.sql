-- Add payment method columns to payment_requests table
-- This allows users to choose between Transfer Rekening (with vendor) or Virtual Account

ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS metode_pembayaran VARCHAR(50) DEFAULT 'Transfer Rekening',
ADD COLUMN IF NOT EXISTS virtual_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS virtual_account_name VARCHAR(255);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_metode_pembayaran ON payment_requests(metode_pembayaran);

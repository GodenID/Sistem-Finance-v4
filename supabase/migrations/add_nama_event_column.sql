-- Migration: Add nama_event column for tracking Event/Project
-- Run this in Supabase SQL Editor

-- Add nama_event to payment_requests
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS nama_event VARCHAR(255);

-- Add nama_event to klaim
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS nama_event VARCHAR(255);

-- Add nama_event to kasbon
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS nama_event VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_nama_event ON payment_requests(nama_event);
CREATE INDEX IF NOT EXISTS idx_klaim_nama_event ON klaim(nama_event);
CREATE INDEX IF NOT EXISTS idx_kasbon_nama_event ON kasbon(nama_event);

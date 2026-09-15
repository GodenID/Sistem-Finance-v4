-- ============================================
-- No.8: Tabel token reset password (sekali pakai, kedaluwarsa)
-- Jalankan di Supabase SQL Editor (sekali saja)
-- ============================================

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,          -- hash SHA-256 dari token (token asli hanya ada di email)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,         -- NULL = belum dipakai
    requested_ip VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Bersih-bersih otomatis: hapus token kedaluwarsa / sudah dipakai yang berumur > 7 hari.
-- (Jalankan berkala via cron/pg_cron bila tersedia.)
-- DELETE FROM password_resets WHERE used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days';
-- DELETE FROM password_resets WHERE used_at IS NULL AND expires_at < NOW() - INTERVAL '7 days';

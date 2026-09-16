-- Permission per-user (override dari default role).
-- Administrator mengatur dari halaman Karyawan > tombol "Permission".
-- NULL = mengikuti default role. JSON object = override per permission key,
-- contoh: {"edit_kasbon": true, "delete_kasbon": false}.
-- Daftar key valid (lihat frontend/src/lib/permissions.js):
--   edit_payment_request, edit_kasbon, edit_klaim, edit_penyelesaian, edit_vendor,
--   delete_payment_request, delete_kasbon, delete_klaim, delete_penyelesaian,
--   approve, transfer, view_laporan, view_confidential, manage_recurring

ALTER TABLE users
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

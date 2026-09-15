-- FIX: 1 RPC untuk seluruh angka Dashboard (menggantikan 16x count exact).
-- Sebelumnya Dashboard memanggil getStatusCounts() per tabel (4 query each),
-- total 16 round-trip + antrean koneksi browser. RPC ini mengerjakannya
-- server-side dalam 1 round-trip memakai indeks status yang sudah ada
-- (idx_*_status_created dari add_trgm_search_indexes.sql).
--
-- Jalankan file ini sekali di Supabase SQL Editor (Database -> SQL Editor).
-- Frontend otomatis memakai RPC bila ada, dan fallback ke cara lama bila belum.

CREATE OR REPLACE FUNCTION get_dashboard_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'payment_requests', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM payment_requests
    ),
    'kasbon', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM kasbon
    ),
    'klaim', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM klaim
    ),
    'penyelesaian', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM penyelesaian
    )
  );
$$;

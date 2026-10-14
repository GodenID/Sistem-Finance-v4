-- ============================================
-- Alur approval 3 tahap: Manager -> Head Finance -> Finance (transfer)
-- + timestamp & durasi SLA per tahap
-- Berlaku untuk: payment_requests, kasbon, klaim, penyelesaian
-- ============================================

-- 1) Role baru: head_finance (dipilih admin di menu Karyawan)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('administrator','team_finance','head_finance','bod','hrd','staff','manager','guest'));

-- 2) Status approval baru: 'Manager Approved' (menunggu Head Finance)
-- Pending = menunggu Manager | Manager Approved = menunggu Head Finance
-- Approved = lolos Head Finance, siap transfer | Rejected = ditolak
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_approval_check;
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_status_approval_check
  CHECK (status_approval IN ('Pending','Manager Approved','Approved','Rejected'));

ALTER TABLE kasbon DROP CONSTRAINT IF EXISTS kasbon_status_approval_check;
ALTER TABLE kasbon ADD CONSTRAINT kasbon_status_approval_check
  CHECK (status_approval IN ('Pending','Manager Approved','Approved','Rejected'));

ALTER TABLE klaim DROP CONSTRAINT IF EXISTS klaim_status_approval_check;
ALTER TABLE klaim ADD CONSTRAINT klaim_status_approval_check
  CHECK (status_approval IN ('Pending','Manager Approved','Approved','Rejected'));

ALTER TABLE penyelesaian DROP CONSTRAINT IF EXISTS penyelesaian_status_approval_check;
ALTER TABLE penyelesaian ADD CONSTRAINT penyelesaian_status_approval_check
  CHECK (status_approval IN ('Pending','Manager Approved','Approved','Rejected'));

-- 3) Kolom timestamp SLA (dibuat IF NOT EXISTS agar aman di-run ulang)
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS head_finance_approved_by TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS head_finance_approved_at TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS head_finance_approved_by TEXT;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS head_finance_approved_at TIMESTAMPTZ;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE kasbon ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE klaim ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS head_finance_approved_by TEXT;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS head_finance_approved_at TIMESTAMPTZ;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE klaim ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS head_finance_approved_by TEXT;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS head_finance_approved_at TIMESTAMPTZ;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE penyelesaian ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 4) Backfill ringan: yang sudah Approved tapi timestamp kosong,
-- isi manager/head timestamps dari updated_at agar durasi tetap terhitung.
UPDATE payment_requests
SET manager_approved_at = COALESCE(manager_approved_at, updated_at, created_at),
    head_finance_approved_at = COALESCE(head_finance_approved_at, updated_at, created_at)
WHERE status_approval = 'Approved' AND (manager_approved_at IS NULL OR head_finance_approved_at IS NULL);

UPDATE kasbon
SET manager_approved_at = COALESCE(manager_approved_at, updated_at, created_at),
    head_finance_approved_at = COALESCE(head_finance_approved_at, updated_at, created_at)
WHERE status_approval = 'Approved' AND (manager_approved_at IS NULL OR head_finance_approved_at IS NULL);

UPDATE klaim
SET manager_approved_at = COALESCE(manager_approved_at, updated_at, created_at),
    head_finance_approved_at = COALESCE(head_finance_approved_at, updated_at, created_at)
WHERE status_approval = 'Approved' AND (manager_approved_at IS NULL OR head_finance_approved_at IS NULL);

UPDATE penyelesaian
SET manager_approved_at = COALESCE(manager_approved_at, updated_at, created_at),
    head_finance_approved_at = COALESCE(head_finance_approved_at, updated_at, created_at)
WHERE status_approval = 'Approved' AND (manager_approved_at IS NULL OR head_finance_approved_at IS NULL);

-- Yang sudah transfer tapi transferred_at kosong -> isi dari updated_at
UPDATE payment_requests SET transferred_at = COALESCE(transferred_at, updated_at)
WHERE status_transfer = 'Sudah Transfer' AND transferred_at IS NULL;
UPDATE kasbon SET transferred_at = COALESCE(transferred_at, updated_at)
WHERE status_transfer = 'Sudah Transfer' AND transferred_at IS NULL;
UPDATE klaim SET transferred_at = COALESCE(transferred_at, updated_at)
WHERE status_transfer = 'Sudah Transfer' AND transferred_at IS NULL;

-- 6) RPC Dashboard: sertakan manager_approved (menunggu Head Finance)
-- agar status baru tidak hilang dari angka (fallback lama tetap jalan bila RPC belum di-run).
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
        'manager_approved', COUNT(*) FILTER (WHERE status_approval = 'Manager Approved'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM payment_requests
    ),
    'kasbon', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'manager_approved', COUNT(*) FILTER (WHERE status_approval = 'Manager Approved'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM kasbon
    ),
    'klaim', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'manager_approved', COUNT(*) FILTER (WHERE status_approval = 'Manager Approved'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM klaim
    ),
    'penyelesaian', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'manager_approved', COUNT(*) FILTER (WHERE status_approval = 'Manager Approved'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
      ) FROM penyelesaian
    )
  );
$$;

-- 5) Index untuk antrean notifikasi per tahap
CREATE INDEX IF NOT EXISTS idx_pr_manager_queue ON payment_requests(status_approval, created_at) WHERE status_approval = 'Pending';
CREATE INDEX IF NOT EXISTS idx_pr_head_queue ON payment_requests(status_approval, created_at) WHERE status_approval = 'Manager Approved';
CREATE INDEX IF NOT EXISTS idx_pr_transfer_queue ON payment_requests(status_approval, status_transfer) WHERE status_approval = 'Approved';
CREATE INDEX IF NOT EXISTS idx_kasbon_manager_queue ON kasbon(status_approval, created_at) WHERE status_approval = 'Pending';
CREATE INDEX IF NOT EXISTS idx_kasbon_head_queue ON kasbon(status_approval, created_at) WHERE status_approval = 'Manager Approved';
CREATE INDEX IF NOT EXISTS idx_kasbon_transfer_queue ON kasbon(status_approval, status_transfer) WHERE status_approval = 'Approved';
CREATE INDEX IF NOT EXISTS idx_klaim_manager_queue ON klaim(status_approval, created_at) WHERE status_approval = 'Pending';
CREATE INDEX IF NOT EXISTS idx_klaim_head_queue ON klaim(status_approval, created_at) WHERE status_approval = 'Manager Approved';
CREATE INDEX IF NOT EXISTS idx_klaim_transfer_queue ON klaim(status_approval, status_transfer) WHERE status_approval = 'Approved';
CREATE INDEX IF NOT EXISTS idx_penyelesaian_manager_queue ON penyelesaian(status_approval, created_at) WHERE status_approval = 'Pending';
CREATE INDEX IF NOT EXISTS idx_penyelesaian_head_queue ON penyelesaian(status_approval, created_at) WHERE status_approval = 'Manager Approved';

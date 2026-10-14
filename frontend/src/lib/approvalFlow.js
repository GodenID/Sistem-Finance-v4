/**
 * Alur approval 3 tahap + SLA waktu:
 * Pengajuan (created_at) -> Manager Approved -> Head Finance Approved (Approved) -> Sudah Transfer
 *
 * Status:
 * - Pending = menunggu Manager
 * - Manager Approved = menunggu Head Finance
 * - Approved = lolos Head Finance, siap transfer Finance
 * - Rejected = ditolak (di tahap mana pun)
 */

export const STAGE = {
  PENDING: 'Pending',
  MANAGER_APPROVED: 'Manager Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const STAGE_LABEL = {
  Pending: 'Menunggu Manager',
  'Manager Approved': 'Menunggu Head Finance',
  Approved: 'Disetujui Head Finance',
  Rejected: 'Ditolak',
};

/** Tanggal + jam ID, mis. "Senin, 14 Okt 2026 • 14.30". */
export const formatTanggalJam = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const tgl = d.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    return `${tgl} • ${jam}`;
  } catch {
    return '-';
  }
};

/** Tanggal pendek + jam untuk tabel, mis. "14/10/2026 14.30". */
export const formatTanggalJamPendek = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    return `${tgl} ${jam}`;
  } catch {
    return '-';
  }
};

/** Ubah selisih ms jadi "2h 15m", "3h 40m", "2 hari 3 jam", dst. */
export const formatDurasi = (ms) => {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '-';
  const menit = Math.floor(ms / 60000);
  if (menit < 1) return '< 1 menit';
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam < 24) return sisaMenit === 0 ? `${jam} jam` : `${jam} jam ${sisaMenit} mnt`;
  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
};

const toMs = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Hitung 3 durasi SLA:
 * - manager: pengajuan -> approve manager (atau reject tahap manager / berjalan)
 * - headFinance: approve manager -> approve head finance
 * - transfer: approve head finance -> transfer
 */
export const calcDurations = (record = {}) => {
  const created = toMs(record.created_at);
  const mgr = toMs(record.manager_approved_at);
  const head = toMs(record.head_finance_approved_at);
  const trf = toMs(record.transferred_at || record.completed_at);
  const rej = toMs(record.rejected_at);
  const now = Date.now();

  // Durasi manager: selesai saat manager approve, atau saat reject (jika belum ada manager_approved_at)
  let managerMs = null;
  if (created != null) {
    if (mgr != null) managerMs = mgr - created;
    else if (rej != null && (record.status_approval === 'Rejected')) managerMs = rej - created;
    else if (record.status_approval === 'Pending') managerMs = now - created; // berjalan
  }

  // Durasi head finance: dari manager approve ke head approve / reject / berjalan
  let headFinanceMs = null;
  if (mgr != null) {
    if (head != null) headFinanceMs = head - mgr;
    else if (rej != null && record.status_approval === 'Rejected') headFinanceMs = rej - mgr;
    else if (record.status_approval === 'Manager Approved') headFinanceMs = now - mgr; // berjalan
  }

  // Durasi transfer: dari head approve ke transfer / berjalan
  let transferMs = null;
  if (head != null) {
    if (trf != null) transferMs = trf - head;
    else if ((record.status_transfer === 'Belum Transfer' || record.status_penyelesaian === 'Belum Selesai') && record.status_approval === 'Approved') {
      transferMs = now - head; // berjalan
    }
  }

  return {
    managerMs,
    headFinanceMs,
    transferMs,
    manager: formatDurasi(managerMs),
    headFinance: formatDurasi(headFinanceMs),
    transfer: formatDurasi(transferMs),
  };
};

/** Tahap aktif untuk timeline (0=pengajuan,1=manager,2=head,3=transfer). */
export const getActiveStage = (record = {}) => {
  if (record.status_approval === 'Rejected') return -1;
  if (record.status_transfer === 'Sudah Transfer' || record.status_penyelesaian === 'Selesai' || record.transferred_at || record.completed_at) return 3;
  if (record.status_approval === 'Approved') return 2;
  if (record.status_approval === 'Manager Approved') return 1;
  return 0;
};

/** Apakah role boleh approve tahap manager? */
export const canApproveManager = (user, record = {}) => {
  if (!user || !record) return false;
  if (record.status_approval !== 'Pending') return false;
  const role = user.role || user.userRole || '';
  if (['administrator', 'bod', 'manager'].includes(role)) return true;
  // fallback permission per-user
  if (typeof user.hasPermission === 'function') {
    return user.hasPermission('approve_manager') || user.hasPermission('approve');
  }
  return !!user.approve_manager || !!user.approve;
};

/** Apakah role boleh approve tahap head finance? */
export const canApproveHeadFinance = (user, record = {}) => {
  if (!user || !record) return false;
  if (record.status_approval !== 'Manager Approved') return false;
  const role = user.role || user.userRole || '';
  if (['administrator', 'head_finance'].includes(role)) return true;
  if (typeof user.hasPermission === 'function') {
    return user.hasPermission('approve_head_finance') || user.hasPermission('approve');
  }
  return !!user.approve_head_finance || !!user.approve;
};

/** Apakah boleh transfer? Hanya setelah Approved final. */
export const canTransferRecord = (user, record = {}) => {
  if (!user || !record) return false;
  if (record.status_approval !== 'Approved') return false;
  if (record.status_transfer && record.status_transfer !== 'Belum Transfer') return false;
  const role = user.role || user.userRole || '';
  if (['administrator', 'team_finance'].includes(role)) return true;
  if (typeof user.hasPermission === 'function') return user.hasPermission('transfer');
  return !!user.transfer;
};

export const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-700';
    case 'Manager Approved':
      return 'bg-blue-100 text-blue-700';
    case 'Rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-yellow-100 text-yellow-700';
  }
};

/**
 * Permission system terpusat — role defaults + override per-user.
 *
 * Konsep:
 * - Setiap role punya permission default (ROLE_DEFAULTS).
 * - Administrator bisa mengatur permission per-user dari halaman Karyawan.
 * - Permission per-user disimpan di kolom `users.permissions` (JSONB, nullable).
 * - Effective permission = role defaults, ditimpa (override) oleh key yang ada
 *   di `user.permissions`. Jadi user tanpa override berperilaku persis seperti dulu.
 */

export const PERMISSION_GROUPS = [
  {
    key: 'edit',
    label: 'Edit Data',
    permissions: [
      { key: 'edit_payment_request', label: 'Edit Payment Request', desc: 'Ubah data Payment Request' },
      { key: 'edit_kasbon', label: 'Edit Kasbon', desc: 'Ubah data Kasbon' },
      { key: 'edit_klaim', label: 'Edit Klaim', desc: 'Ubah data Klaim' },
      { key: 'edit_penyelesaian', label: 'Edit Penyelesaian', desc: 'Ubah data Penyelesaian' },
      { key: 'edit_vendor', label: 'Edit Vendor', desc: 'Tambah/ubah/hapus data Vendor' },
    ],
  },
  {
    key: 'delete',
    label: 'Hapus Data',
    permissions: [
      { key: 'delete_payment_request', label: 'Hapus Payment Request', desc: 'Hapus data Payment Request' },
      { key: 'delete_kasbon', label: 'Hapus Kasbon', desc: 'Hapus data Kasbon' },
      { key: 'delete_klaim', label: 'Hapus Klaim', desc: 'Hapus data Klaim' },
      { key: 'delete_penyelesaian', label: 'Hapus Penyelesaian', desc: 'Hapus data Penyelesaian' },
    ],
  },
  {
    key: 'approval',
    label: 'Persetujuan & Transfer',
    permissions: [
      { key: 'approve', label: 'Approve / Reject', desc: 'Setujui atau tolak pengajuan' },
      { key: 'transfer', label: 'Transfer / Bukti Transfer', desc: 'Input bukti transfer & tandai Sudah Transfer' },
    ],
  },
  {
    key: 'access',
    label: 'Akses Menu & Data',
    permissions: [
      { key: 'view_laporan', label: 'Akses Laporan', desc: 'Lihat menu & data Laporan' },
      { key: 'view_confidential', label: 'Lihat Data Konfidensial', desc: 'Lihat data bertanda konfidensial' },
      { key: 'manage_recurring', label: 'Transaksi Berulang', desc: 'Kelola Transaksi Berulang' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

const ALL_TRUE = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true]));
const ALL_FALSE = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false]));

/**
 * Default permission per role — disalin dari pengecekan role yang tersebar
 * di codebase sebelumnya, supaya user tanpa override berperilaku sama persis.
 */
export const ROLE_DEFAULTS = {
  administrator: { ...ALL_TRUE },
  bod: {
    ...ALL_FALSE,
    edit_payment_request: true,
    edit_kasbon: true,
    edit_klaim: true,
    edit_penyelesaian: true,
    edit_vendor: true,
    delete_payment_request: true,
    delete_kasbon: true,
    delete_klaim: true,
    delete_penyelesaian: false,
    approve: true,
    transfer: false,
    view_laporan: true,
    view_confidential: true,
    manage_recurring: false,
  },
  team_finance: {
    ...ALL_FALSE,
    edit_payment_request: true,
    edit_kasbon: true,
    edit_klaim: true,
    edit_penyelesaian: true,
    edit_vendor: true,
    approve: false,
    transfer: true,
    view_laporan: true,
    view_confidential: true,
    manage_recurring: true,
  },
  manager: {
    ...ALL_FALSE,
    edit_vendor: true,
    delete_penyelesaian: true,
    approve: true,
  },
  hrd: {
    ...ALL_FALSE,
    edit_vendor: true,
    view_confidential: true,
  },
  staff: {
    ...ALL_FALSE,
    edit_vendor: true,
  },
  guest: {
    ...ALL_FALSE,
    edit_vendor: true,
  },
};

/** Normalisasi kolom permissions dari DB (bisa null / string JSON / object). */
export const normalizePermissions = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Hitung effective permissions untuk seorang user.
 * @param {{ role?: string, permissions?: object|string|null }} user
 * @returns {Record<string, boolean>}
 */
export const getEffectivePermissions = (user) => {
  const role = user?.role || 'staff';
  const defaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff;
  const override = normalizePermissions(user?.permissions);
  if (!override) return { ...defaults };
  const effective = { ...defaults };
  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof override[key] === 'boolean') effective[key] = override[key];
  }
  return effective;
};

/** Cek satu permission untuk user (role + override). */
export const can = (user, key) => {
  if (!key || !ALL_PERMISSION_KEYS.includes(key)) return false;
  return !!getEffectivePermissions(user)[key];
};

/** True jika user punya override per-user (pernah diatur custom oleh admin). */
export const hasCustomPermissions = (user) => !!normalizePermissions(user?.permissions);

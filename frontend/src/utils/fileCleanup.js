/**
 * Helper pembersih file R2 — dipakai saat hapus/ganti data agar tidak
 * meninggalkan file yatim di storage.
 */
import { deleteR2Files } from './r2Upload';

// Re-export agar halaman cukup import dari satu modul.
export { deleteR2Files };

// Prefix folder yang dipakai aplikasi saat upload (lihat documentType di
// tiap pemanggilan uploadFile/uploadFileToR2). Hanya URL dengan prefix ini
// yang dianggap file R2 milik aplikasi — URL asing (mis. link referensi di
// keterangan) tidak boleh ikut terhapus.
const KNOWN_PREFIXES = [
  'payment-requests',
  'klaim',
  'kasbon',
  'penyelesaian',
  'recurring',
  'uploads',
];

const isFileUrl = (v) => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (!/\.(pdf|jpe?g|png|gif|webp|doc|docx|xls|xlsx)(\?|#|$)/i.test(s)) return false;
  try {
    const segs = new URL(s).pathname.replace(/^\/+/, '').split('/');
    return segs.length >= 2 && KNOWN_PREFIXES.includes(segs[0].toLowerCase());
  } catch {
    return false;
  }
};

/**
 * Kumpulkan semua URL file dari sebuah record (mendukung string URL,
 * array URL, dan JSON string berisi URL — mis. kolom lampiran multi-file).
 * @param {object} record
 * @returns {string[]} daftar URL unik
 */
export const collectFileUrls = (record) => {
  const found = new Set();
  if (!record || typeof record !== 'object') return [];

  const scan = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      const s = value.trim();
      if (isFileUrl(s)) {
        found.add(s);
        return;
      }
      // Coba parse JSON (lampiran multi-file tersimpan sebagai string JSON)
      if ((s.startsWith('[') || s.startsWith('{')) && s.length < 20000) {
        try {
          scan(JSON.parse(s));
          return;
        } catch {
          /* bukan JSON — abaikan */
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  };

  scan(record);
  return [...found];
};

/**
 * Hapus file-file R2 milik record-record yang dihapus (best-effort).
 * @param {Array<object>} records
 * @returns {Promise<{deleted: string[], failed: string[]}>}
 */
export const deleteFilesOfRecords = async (records) => {
  const urls = (records || []).flatMap(collectFileUrls);
  if (urls.length === 0) return { deleted: [], failed: [] };
  return deleteR2Files(urls);
};

/**
 * Upload file lalu simpan record — bila SIMPAN gagal, file yang baru
 * diupload ikut dihapus agar tidak jadi yatim. Bila simpan sukses,
 * file tetap (sudah terreferensi).
 * @param {() => Promise<{url: string}>} uploadFn - mengembalikan hasil upload
 * @param {(uploadResult) => Promise<any>} saveFn - simpan DB memakai hasil upload
 * @returns {Promise<{result: object, saved: any}>}
 */
export const uploadThenSave = async (uploadFn, saveFn) => {
  const result = await uploadFn();
  try {
    const saved = await saveFn(result);
    return { result, saved };
  } catch (err) {
    await deleteR2Files(result?.url ? [result.url] : []);
    throw err;
  }
};

/**
 * URL lama yang tidak dipakai lagi setelah edit — hapus dari R2.
 * @param {string|string[]|null} oldUrls - URL sebelum edit
 * @param {string|string[]|null} newUrls - URL sesudah edit
 */
export const deleteReplacedFiles = async (oldUrls, newUrls) => {
  const normalize = (v) => {
    const out = new Set();
    collectFileUrls({ v }).forEach((u) => out.add(u));
    return out;
  };
  const before = normalize(oldUrls);
  const after = normalize(newUrls);
  const removed = [...before].filter((u) => !after.has(u));
  if (removed.length === 0) return { deleted: [], failed: [] };
  return deleteR2Files(removed);
};

/**
 * Utility untuk upload file ke Cloudflare R2
 * Menggunakan Cloudflare Worker sebagai proxy
 * Dengan auto-compress untuk gambar
 */

import { compressImage, isImageFile, formatBytes } from './imageCompress';

// Get Worker URL from environment variable
const WORKER_URL = import.meta.env.VITE_R2_WORKER_URL;

if (!WORKER_URL || WORKER_URL.includes('your-account')) {
  console.error('❌ VITE_R2_WORKER_URL belum di-set atau masih menggunakan placeholder!');
  console.error('💡 Silakan set VITE_R2_WORKER_URL di file .env dengan URL Worker Anda');
  console.error('💡 Contoh: VITE_R2_WORKER_URL=https://r2-upload-worker.your-account.workers.dev');
}

// Kunci hapus file (opsional — samakan dengan DELETE_SECRET di env worker).
// Bila kosong, worker tetap mengizinkan hapus (mode dev) sambil log peringatan.
const DELETE_KEY = import.meta.env.VITE_R2_DELETE_KEY || '';

/**
 * Ambil object key R2 dari URL publik file.
 * Contoh: https://files.prasastigroup.id/klaim/2025/.../x.jpg
 *   → klaim/2025/.../x.jpg
 * Bila input bukan URL (sudah berupa key), dikembalikan apa adanya.
 */
export function extractR2Key(fileUrlOrKey) {
  if (!fileUrlOrKey || typeof fileUrlOrKey !== 'string') return null;
  const trimmed = fileUrlOrKey.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^\/+/, '') || null;
  try {
    const key = new URL(trimmed).pathname.replace(/^\/+/, '');
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Hapus satu file di R2 via Worker (best-effort: gagal = return false, tidak throw).
 * @param {string} fileUrlOrKey - URL publik atau object key
 * @returns {Promise<boolean>} true bila terhapus (atau worker OK)
 */
export async function deleteR2File(fileUrlOrKey) {
  try {
    if (!WORKER_URL || WORKER_URL.includes('your-account')) return false;
    const key = extractR2Key(fileUrlOrKey);
    if (!key) return false;

    const response = await fetch(`${WORKER_URL}?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: DELETE_KEY ? { 'X-Delete-Key': DELETE_KEY } : {},
    });
    if (!response.ok) {
      console.warn('⚠️ Gagal menghapus file R2:', key, response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('⚠️ Gagal menghapus file R2:', error?.message);
    return false;
  }
}

/**
 * Hapus banyak file sekaligus (best-effort, tidak throw).
 * @param {Array<string>} urls - daftar URL/key
 * @returns {Promise<{deleted: string[], failed: string[]}>}
 */
export async function deleteR2Files(urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  const deleted = [];
  const failed = [];
  // Batasi konkurensi agar tidak membanjiri worker
  const CONCURRENCY = 5;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((u) => deleteR2File(u)));
    batch.forEach((u, idx) => (results[idx] ? deleted.push(u) : failed.push(u)));
  }
  return { deleted, failed };
}

/**
 * Daftar isi bucket via worker (untuk sweeper file yatim).
 * @param {{prefix?: string, cursor?: string|null, limit?: number}} opts
 * @returns {Promise<{objects: Array<{key:string,size:number,uploaded:string}>, truncated: boolean, cursor: string|null}>}
 */
export async function listR2Objects({ prefix = '', cursor = null, limit = 500 } = {}) {
  if (!WORKER_URL || WORKER_URL.includes('your-account')) {
    throw new Error('Worker URL belum dikonfigurasi');
  }
  const params = new URLSearchParams();
  if (prefix) params.set('prefix', prefix);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const response = await fetch(`${WORKER_URL}__list?${params.toString()}`);
  if (!response.ok) throw new Error(`Gagal membaca isi storage (${response.status})`);
  return response.json();
}

/**
 * Upload file ke R2 melalui Cloudflare Worker
 * Images will be auto-compressed before upload
 * @param {File} file - File yang akan diupload
 * @param {string} documentType - Jenis dokumen (payment-requests, klaim, penyelesaian, kasbon)
 * @param {string} documentId - ID dokumen (optional, e.g., 'PR-0001', 'KLM-0001')
 * @param {string} userName - Nama user yang upload (optional)
 * @param {object} opts - Opsi tambahan: { timeoutMs } (default 90000)
 * @returns {Promise<{url: string, filePath: string, fileName: string, size: number, type: string, originalSize?: number, wasCompressed?: boolean}>}
 */
export async function uploadFileToR2(file, documentType = 'uploads', documentId = null, userName = null, opts = {}) {
  // Dukungan pemanggilan lama: argumen ke-5 bisa berupa angka timeout langsung
  const timeoutMs = typeof opts === 'number' ? opts : (opts?.timeoutMs ?? 90000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Check if Worker URL is configured
    if (!WORKER_URL || WORKER_URL.includes('your-account')) {
      throw new Error(
        'Worker URL belum dikonfigurasi! Silakan set VITE_R2_WORKER_URL di file .env dengan URL Worker Anda yang sebenarnya.'
      );
    }

    // Validate file size (10MB max for original file)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File terlalu besar. Maksimal 10MB');
    }

    // Validate file type (fallback ke ekstensi bila MIME kosong —
    // beberapa file dari WA / screenshot paste punya type === '')
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx'];

    const ext = (file.name?.split('.').pop() || '').toLowerCase();
    const typeOk = file.type ? allowedTypes.includes(file.type) : false;
    const extOk = allowedExtensions.includes(ext);
    if (!typeOk && !extOk) {
      throw new Error('File type not allowed. Allowed types: PDF, Images (JPG/PNG/GIF/WebP), Word, Excel');
    }

    // Auto-compress images before upload
    let fileToUpload = file;
    let compressionInfo = { wasCompressed: false, originalSize: file.size };

    if (isImageFile(file)) {
      try {
        const result = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.75,
          maxSizeKB: 500
        });
        fileToUpload = result.file;
        compressionInfo = {
          wasCompressed: result.wasCompressed,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize
        };

        if (result.wasCompressed) {
          console.log(`📸 Image auto-compressed: ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)}`);
        }
      } catch (compressError) {
        console.warn('⚠️ Image compression failed, uploading original:', compressError);
        // Continue with original file if compression fails
      }
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('documentType', documentType);
    if (documentId) {
      formData.append('documentId', documentId);
    }
    if (userName) {
      formData.append('userName', userName);
    }


    // Upload file via worker (dengan timeout agar tidak ngestuck selamanya)
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      // Provide helpful error messages
      if (response.status === 404) {
        throw new Error(
          `Worker tidak ditemukan (404). Pastikan:\n` +
          `1. Worker sudah di-deploy di Cloudflare\n` +
          `2. URL Worker di .env sudah benar: ${WORKER_URL}\n` +
          `3. Worker name sesuai dengan URL yang digunakan`
        );
      } else if (response.status === 0 || response.status === 'failed') {
        throw new Error(
          `Tidak dapat terhubung ke Worker. Pastikan:\n` +
          `1. Worker sudah di-deploy\n` +
          `2. CORS sudah dikonfigurasi di Worker\n` +
          `3. URL Worker benar: ${WORKER_URL}`
        );
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Verifikasi URL lengkap
    if (!data.url || !data.url.startsWith('http')) {
      console.error('❌ URL tidak lengkap!', data.url);
      throw new Error('URL yang dikembalikan Worker tidak lengkap. Pastikan R2_PUBLIC_URL sudah di-set di Worker environment variables.');
    }

    return {
      url: data.url,
      filePath: data.filePath,
      fileName: data.fileName,
      size: data.size,
      type: data.type,
      // Compression info
      originalSize: compressionInfo.originalSize,
      compressedSize: compressionInfo.compressedSize,
      wasCompressed: compressionInfo.wasCompressed,
    };
  } catch (error) {
    clearTimeout(timer);
    console.error('❌ Error uploading file to R2:', error);

    // Timeout: fetch di-abort — jangan biarkan user menunggu tanpa kepastian
    if (error?.name === 'AbortError') {
      throw new Error(
        `Upload timeout (${Math.round(timeoutMs / 1000)} detik): "${file?.name || 'file'}". ` +
        `Kemungkinan koneksi lambat atau file besar. Coba lagi dengan file lebih kecil / koneksi lebih stabil.`
      );
    }

    // Provide more helpful error message
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(
        `Gagal terhubung ke Worker. Pastikan:\n` +
        `1. Worker URL sudah benar di .env: VITE_R2_WORKER_URL\n` +
        `2. Worker sudah di-deploy di Cloudflare\n` +
        `3. CORS sudah dikonfigurasi di Worker\n` +
        `4. Koneksi internet stabil`
      );
    }

    throw error;
  }
}


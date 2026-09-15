/**
 * turnstile.js — Helper untuk Turnstile gate kunjungan (sekali saja).
 *
 * Alur (data-action="turnstile-spin-v1" untuk telemetri Spin):
 *   browser → Worker siteverify → Cloudflare siteverify
 * Secret TIDAK PERNAH ada di browser — hanya di Worker sebagai secret.
 *
 * Status gate disimpan di localStorage:
 *   turnstile_gate_verified = timestamp (ms) saat verifikasi sukses
 * TTL default 30 hari (VITE_TURNSTILE_GATE_TTL_DAYS) — dalam masa itu user
 * tidak diminta verifikasi lagi ("ga setiap ngunjungi").
 */

export const SITEKEY = import.meta.env?.VITE_TURNSTILE_SITEKEY || '';
export const VERIFY_URL = (import.meta.env?.VITE_TURNSTILE_VERIFY_URL || '').replace(/\/$/, '');
export const GATE_TTL_DAYS = parseFloat(import.meta.env?.VITE_TURNSTILE_GATE_TTL_DAYS || '30');

const LS_KEY = 'turnstile_gate_verified';

export const isTurnstileConfigured = () => !!SITEKEY;

export function getGateVerifiedAt() {
  try {
    return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function isGateVerified() {
  const at = getGateVerifiedAt();
  if (!at) return false;
  const ttlMs = GATE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - at < ttlMs;
}

export function markGateVerified() {
  try {
    localStorage.setItem(LS_KEY, String(Date.now()));
  } catch {
    /* abaikan */
  }
}

export function clearGateVerified() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* abaikan */
  }
}

/**
 * Verifikasi token Turnstile via Worker siteverify (Spin template).
 * @param {string} token - cf-turnstile-response dari widget
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyViaWorker(token) {
  if (!token) return { success: false, error: 'Token Turnstile kosong.' };
  // Tanpa VERIFY_URL (mis. sebelum worker di-deploy / sitekey belum diisi):
  // fail-open agar tidak mengunci diri sendiri — log warning saja.
  // Setelah widget + worker terpasang, isi kedua env dan verifikasi jadi ketat.
  if (!VERIFY_URL) {
    console.warn('[turnstile] VITE_TURNSTILE_VERIFY_URL belum diset — verifikasi dilewati (fail-open dev).');
    return { success: true, devBypass: true };
  }
  try {
    const res = await fetch(`${VERIFY_URL}/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) return { success: true };
    const codes = Array.isArray(data['error-codes']) ? data['error-codes'].join(', ') : '';
    return { success: false, error: codes || 'Verifikasi Turnstile gagal.' };
  } catch (err) {
    return { success: false, error: 'Worker verifikasi tidak dapat dihubungi. Coba lagi.' };
  }
}

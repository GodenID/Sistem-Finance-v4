/**
 * guard.js — Lapisan anti-spam / anti-bruteforce untuk login.
 *
 * Arsitektur (sesuai docs https://prasasti-guard.pages.dev/#integrasi):
 *   1. Pengguna menyelesaikan widget <PrasastiGuard/> → dapat `verifyToken`
 *      (HMAC-SHA256, kedaluwarsa ±2 menit, sekali pakai).
 *   2. Token HARUS divalidasi dari SERVER (jangan dari browser):
 *        POST {guard}/api/validate  { "verifyToken": "<token>" }
 *      - Kalau backend Express dipakai: token dikirim bersama /api/auth/login
 *        dan diverifikasi oleh middleware `prasastiGuard` (server-side, aman).
 *      - Kalau login langsung ke Supabase (tanpa backend): token diverifikasi
 *        via backend `/api/auth/verify-guard` bila VITE_BACKEND_URL diset;
 *        fallback terakhir: validasi langsung dari browser (mengorbankan
 *        secrecy, tapi token sekali-pakai + rate-limit tetap menaikkan biaya
 *        serangan dibanding tanpa proteksi sama sekali).
 *   3. Rate-limit client-side (localStorage) sebagai lapisan tambahan agar
 *      bruteforce dari browser yang sama cepat terkunci.
 */

export const GUARD_API_URL =
  import.meta.env?.VITE_PRASASTI_API_URL || 'https://guard.prasastigroup.id';

export const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || '';

/** Token guard kedaluwarsa ±2 menit di server — tolak token >100 dtk di client. */
export const GUARD_TOKEN_MAX_AGE_MS = 100 * 1000;

// ---- Rate limit client-side ----
const LS_PREFIX = 'pg_login_guard:';
const MAX_ATTEMPTS = 5; // percobaan gagal sebelum dikunci
const WINDOW_MS = 15 * 60 * 1000; // jendela hitung 15 menit
const LOCK_MS = 5 * 60 * 1000; // kunci 5 menit (naik ke 15 mnt bila berulang)

const now = () => Date.now();

function loadState(username) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + username.toLowerCase().trim());
    return raw ? JSON.parse(raw) : { failCount: 0, firstFailAt: 0, lockedUntil: 0 };
  } catch {
    return { failCount: 0, firstFailAt: 0, lockedUntil: 0 };
  }
}

function saveState(username, state) {
  try {
    localStorage.setItem(LS_PREFIX + username.toLowerCase().trim(), JSON.stringify(state));
  } catch {
    /* storage penuh / privat — abaikan, server-side limiter tetap jalan */
  }
}

export function checkLoginAllowed(username) {
  const key = (username || '').toLowerCase().trim() || '(kosong)';
  const s = loadState(key);
  const t = now();
  if (s.lockedUntil && t < s.lockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((s.lockedUntil - t) / 1000), remaining: 0 };
  }
  // Reset jendela bila sudah lewat
  if (s.firstFailAt && t - s.firstFailAt > WINDOW_MS) {
    const fresh = { failCount: 0, firstFailAt: 0, lockedUntil: 0 };
    saveState(key, fresh);
    return { allowed: true, retryAfterSec: 0, remaining: MAX_ATTEMPTS };
  }
  return { allowed: true, retryAfterSec: 0, remaining: Math.max(0, MAX_ATTEMPTS - s.failCount) };
}

export function recordLoginFailure(username) {
  const key = (username || '').toLowerCase().trim() || '(kosong)';
  const s = loadState(key);
  const t = now();
  if (!s.firstFailAt || t - s.firstFailAt > WINDOW_MS) {
    s.failCount = 1;
    s.firstFailAt = t;
  } else {
    s.failCount += 1;
  }
  if (s.failCount >= MAX_ATTEMPTS * 2) {
    s.lockedUntil = t + 15 * 60 * 1000; // pelaku berulang: kunci 15 menit
  } else if (s.failCount >= MAX_ATTEMPTS) {
    s.lockedUntil = t + LOCK_MS; // kunci 5 menit
  }
  saveState(key, s);
  return checkLoginAllowed(username);
}

export function recordLoginSuccess(username) {
  const key = (username || '').toLowerCase().trim() || '(kosong)';
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* abaikan */
  }
}

// ---- Verifikasi token ----

/**
 * Verifikasi verifyToken SEBELUM percobaan login (mode Supabase-direct).
 * Prioritas: backend sendiri (server-side) → fallback langsung ke Guard.
 * @returns {Promise<{valid: boolean, score?: number, method?: string, error?: string}>}
 */
export async function verifyGuardToken(verifyToken) {
  if (!verifyToken) return { valid: false, error: 'Token verifikasi manusia belum ada.' };

  // 1. Via backend sendiri — token dicek server-to-server (sesuai anjuran docs)
  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/auth/verify-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardToken: verifyToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) return { valid: true, score: data.score, method: data.method };
      return { valid: false, error: data.error || 'Verifikasi Prasasti Guard gagal.' };
    } catch {
      return { valid: false, error: 'Backend verifikasi tidak dapat dihubungi. Coba lagi.' };
    }
  }

  // 2. Fallback langsung (hanya bila tanpa backend — lihat catatan di atas)
  try {
    const res = await fetch(`${GUARD_API_URL}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifyToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.valid) return { valid: true, score: data.score, method: data.method };
    return { valid: false, error: data.error || 'Token verifikasi tidak valid / kedaluwarsa.' };
  } catch {
    return { valid: false, error: 'Server Prasasti Guard tidak dapat dihubungi. Coba lagi.' };
  }
}

export function isGuardTokenFresh(verifiedAt) {
  return !!verifiedAt && now() - verifiedAt < GUARD_TOKEN_MAX_AGE_MS;
}

export function formatRetry(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
}

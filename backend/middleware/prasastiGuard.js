/**
 * prasastiGuard.js — Middleware verifikasi Prasasti Guard (server-side).
 *
 * Sesuai docs https://prasasti-guard.pages.dev/#integrasi :
 *   validasi token HARUS dari backend (server-to-server), jangan dari browser:
 *     POST {GUARD_API_URL}/api/validate   { "verifyToken": "<token>" }
 *     → { "valid": true, "score": 85, "method": "invisible" }
 *
 * Token bersifat HMAC-SHA256, kedaluwarsa ±2 menit, sekali pakai (anti-replay).
 * Membutuhkan Node.js 18+ (global fetch).
 *
 * Env:
 *   GUARD_API_URL    (default https://guard.prasastigroup.id)
 *   GUARD_ENABLED    'false' untuk menonaktifkan (mis. dev offline). Default aktif.
 *   GUARD_TIMEOUT_MS (default 10000)
 *   GUARD_MIN_SCORE  tolak token dengan skor di bawah ini (default 0 = terima semua yg valid)
 */

const GUARD_API_URL = (process.env.GUARD_API_URL || 'https://guard.prasastigroup.id').replace(/\/$/, '');
const GUARD_ENABLED = process.env.GUARD_ENABLED !== 'false';
const GUARD_TIMEOUT_MS = parseInt(process.env.GUARD_TIMEOUT_MS || '10000', 10);
const GUARD_MIN_SCORE = parseInt(process.env.GUARD_MIN_SCORE || '0', 10);

/**
 * Validasi verifyToken ke server Guard (server-to-server).
 * @returns {Promise<{valid: boolean, score?: number, method?: string, error?: string}>}
 */
async function validateGuardToken(verifyToken) {
    if (!verifyToken || typeof verifyToken !== 'string') {
        return { valid: false, error: 'Token verifikasi tidak valid.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GUARD_TIMEOUT_MS);
    try {
        const res = await fetch(`${GUARD_API_URL}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verifyToken }),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));

        if (!data.valid) {
            return { valid: false, error: data.error || 'Token verifikasi tidak valid atau kedaluwarsa.' };
        }
        if (GUARD_MIN_SCORE > 0 && typeof data.score === 'number' && data.score < GUARD_MIN_SCORE) {
            return { valid: false, error: `Skor verifikasi ${data.score} di bawah minimum ${GUARD_MIN_SCORE}.` };
        }
        return { valid: true, score: data.score, method: data.method };
    } catch (err) {
        if (err && err.name === 'AbortError') {
            return { valid: false, error: 'Verifikasi keamanan timeout. Coba lagi.' };
        }
        console.error('[prasasti-guard] validate error:', err.message);
        return { valid: false, error: 'Layanan verifikasi tidak dapat dihubungi. Coba lagi.' };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Middleware: wajibkan token Prasasti Guard yang valid sebelum lanjut.
 * Token dibaca dari body.guardToken atau header x-guard-token.
 * Hasil verifikasi tersedia di req.guard = { score, method }.
 */
function requirePrasastiGuard(req, res, next) {
    if (!GUARD_ENABLED) return next();

    const token = (req.body && req.body.guardToken) || req.headers['x-guard-token'];
    if (!token) {
        return res.status(403).json({
            error: 'Verifikasi manusia diperlukan. Selesaikan verifikasi "Saya bukan robot" terlebih dahulu.',
            code: 'GUARD_REQUIRED',
        });
    }

    validateGuardToken(String(token))
        .then((result) => {
            if (!result.valid) {
                try {
                    const { logAuthEvent } = require('../lib/authAudit');
                    logAuthEvent({
                        userName: (req.body && req.body.username) || '',
                        action: 'guard_failed',
                        detail: { error: result.error, path: req.path },
                        ip: req.ip || '',
                        userAgent: req.headers['user-agent'],
                    });
                } catch { /* best-effort */ }
                return res.status(403).json({ error: result.error, code: 'GUARD_INVALID' });
            }
            req.guard = { score: result.score, method: result.method };
            next();
        })
        .catch((err) => {
            console.error('[prasasti-guard] middleware error:', err);
            res.status(503).json({ error: 'Layanan verifikasi tidak tersedia.', code: 'GUARD_UNAVAILABLE' });
        });
}

// No.10: ambang skor minimum untuk AKSI SENSITIF (ganti password, dsb).
// Default 0 = hanya wajib bukti manusia yang FRESH (token sekali pakai),
// tanpa menolak berdasarkan skor. Naikkan (mis. 60) setelah melihat
// distribusi skor di activity_logs.
const GUARD_MIN_SCORE_SENSITIVE = parseInt(process.env.GUARD_MIN_SCORE_SENSITIVE || '0', 10);

/**
 * Middleware untuk aksi sensitif: mewajibkan verifikasi manusia yang BARU
 * (token sekali pakai — token bekas login tidak bisa dipakai ulang) dan
 * opsional skor minimum. Dipakai di change-password agar pembajakan sesi
 * saja tidak cukup untuk mengambil alih akun.
 */
function requireFreshGuard(req, res, next) {
    requirePrasastiGuard(req, res, () => {
        if (
            GUARD_MIN_SCORE_SENSITIVE > 0 &&
            typeof req.guard?.score === 'number' &&
            req.guard.score < GUARD_MIN_SCORE_SENSITIVE
        ) {
            return res.status(403).json({
                error: `Skor verifikasi ${req.guard.score} di bawah minimum ${GUARD_MIN_SCORE_SENSITIVE} untuk aksi ini. Coba lagi.`,
                code: 'GUARD_SCORE_LOW',
            });
        }
        next();
    });
}

module.exports = {
    requirePrasastiGuard,
    requireFreshGuard,
    validateGuardToken,
    GUARD_ENABLED,
};

/**
 * loginRateLimit.js — Rate limiter anti-bruteforce untuk endpoint login.
 *
 * Dua lapis kunci (in-memory, per proses):
 *   1. Per IP + username : MAX gagal dalam WINDOW → kunci sementara.
 *   2. Per IP saja       : MAX gagal agregat dalam WINDOW → kunci IP (tangkap
 *      serangan password-spraying yang gonta-ganti username).
 *
 * Middleware mencatat hasil secara otomatis dengan membungkus res.json:
 *   - respons 401 → hitung 1 kegagalan
 *   - respons 200 → bersihkan catatan (login sukses)
 *
 * Catatan: untuk multi-instance / produksi serius, ganti store in-memory ini
 * dengan Redis. Untuk deploy single-instance saat ini sudah memadai.
 *
 * Env:
 *   LOGIN_MAX_ATTEMPTS      gagal/IP+username sebelum dikunci (default 5)
 *   LOGIN_USER_LOCK_MS      durasi kunci per user (default 15 menit)
 *   LOGIN_MAX_ATTEMPTS_IP   gagal/IP sebelum IP dikunci (default 20)
 *   LOGIN_IP_LOCK_MS        durasi kunci per IP (default 30 menit)
 *   LOGIN_RATE_WINDOW_MS    jendela hitung (default 15 menit)
 */

const WINDOW_MS = parseInt(process.env.LOGIN_RATE_WINDOW_MS || String(15 * 60 * 1000), 10);
const MAX_FAILS_USER = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const USER_LOCK_MS = parseInt(process.env.LOGIN_USER_LOCK_MS || String(15 * 60 * 1000), 10);
const MAX_FAILS_IP = parseInt(process.env.LOGIN_MAX_ATTEMPTS_IP || '20', 10);
const IP_LOCK_MS = parseInt(process.env.LOGIN_IP_LOCK_MS || String(30 * 60 * 1000), 10);

// key -> { fails: number[], lockedUntil: number }
const store = new Map();

function getEntry(key) {
    let e = store.get(key);
    if (!e) {
        e = { fails: [], lockedUntil: 0 };
        store.set(key, e);
    }
    return e;
}

function prune(entry, now) {
    entry.fails = entry.fails.filter((t) => now - t < WINDOW_MS);
}

function formatWait(ms) {
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
}

// Bersihkan entry basi agar Map tidak tumbuh tanpa batas
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        prune(entry, now);
        if (entry.fails.length === 0 && entry.lockedUntil < now) store.delete(key);
    }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function loginRateLimit(req, res, next) {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    // No.8: forgot-password memakai {email} — samakan kunci limiter-nya
    const username = String((req.body && (req.body.username || req.body.email)) || '').toLowerCase().trim();
    const userKey = `login:user:${ip}:${username}`;
    const ipKey = `login:ip:${ip}`;
    const now = Date.now();

    const userEntry = getEntry(userKey);
    const ipEntry = getEntry(ipKey);
    prune(userEntry, now);
    prune(ipEntry, now);

    // No.6: pemblokiran juga diaudit (deteksi pola serangan)
    const auditBlocked = (scope) => {
        try {
            const { logAuthEvent } = require('../lib/authAudit');
            logAuthEvent({
                userName: username, action: 'login_blocked',
                detail: { reason: 'rate_limit', scope },
                ip, userAgent: req.headers['user-agent'],
            });
        } catch { /* best-effort */ }
    };

    if (userEntry.lockedUntil > now) {
        auditBlocked('user');
        return res.status(429).json({
            error: `Terlalu banyak percobaan gagal untuk akun ini. Coba lagi dalam ${formatWait(userEntry.lockedUntil - now)}.`,
            code: 'RATE_LIMITED',
            retryAfterSec: Math.ceil((userEntry.lockedUntil - now) / 1000),
        });
    }
    if (ipEntry.lockedUntil > now) {
        auditBlocked('ip');
        return res.status(429).json({
            error: `Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam ${formatWait(ipEntry.lockedUntil - now)}.`,
            code: 'RATE_LIMITED_IP',
            retryAfterSec: Math.ceil((ipEntry.lockedUntil - now) / 1000),
        });
    }

    // Catat hasil setelah controller merespons
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const at = Date.now();
        if (res.statusCode === 401) {
            userEntry.fails.push(at);
            ipEntry.fails.push(at);
            prune(userEntry, at);
            prune(ipEntry, at);
            if (userEntry.fails.length >= MAX_FAILS_USER) userEntry.lockedUntil = at + USER_LOCK_MS;
            if (ipEntry.fails.length >= MAX_FAILS_IP) ipEntry.lockedUntil = at + IP_LOCK_MS;
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
            store.delete(userKey);
            // IP entry dipertahankan (melindungi dari spray), tapi tidak dihapus
        }
        return originalJson(body);
    };

    next();
}

module.exports = loginRateLimit;

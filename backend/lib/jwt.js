/**
 * jwt.js — Penerbit & verifikator JWT terpusat (No.9: hardening secret).
 *
 * - Secret WAJIB kuat: di production, startup gagal (fail-fast) bila
 *   JWT_SECRET kosong, masih bernilai default contoh, atau < 32 karakter.
 * - Rotasi tanpa memutus sesi: JWT_PREVIOUS_SECRETS berisi daftar secret lama
 *   dipisah koma. Token lama tetap valid selama masa tenggang sampai kedaluwarsa.
 * - Setiap token membawa `jti` (JWT ID) unik untuk pelacakan/revokasi kelak.
 *
 * Env:
 *   JWT_SECRET            (wajib di production)
 *   JWT_PREVIOUS_SECRETS  (opsional, dipisah koma)
 *   JWT_EXPIRES_IN        (default '365d' — sesi persistent, logout hanya eksplisit)
 *   JWT_ISSUER            (default 'finance-prasasti')
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const WEAK_MARKERS = [
    'your-super-secret-jwt-key-change-in-production',
    'change-me',
    'secret',
    'password',
    '12345',
];

function getSecrets() {
    const current = process.env.JWT_SECRET || '';
    const previous = String(process.env.JWT_PREVIOUS_SECRETS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return { current, previous };
}

function isWeak(secret) {
    if (!secret || secret.length < 32) return true;
    const lower = secret.toLowerCase();
    return WEAK_MARKERS.some((m) => lower.includes(m));
}

/**
 * Dipanggil saat startup (atau sebelum sign/verify pertama).
 * - Production: gagal bila secret kosong/lemah (fail-fast).
 * - Non-production + secret kosong: pakai secret ephemeral acak per proses
 *   (sesi hangus saat restart — acceptable untuk dev) + warning.
 * - Non-production + secret lemah: warning saja.
 * @returns {string} secret aktif yang dipakai proses ini
 */
function assertJwtSecret() {
    const { current } = getSecrets();
    const isProd = process.env.NODE_ENV === 'production';
    if (!current) {
        if (isProd) {
            throw new Error('[jwt] JWT_SECRET belum diset. Set JWT_SECRET yang kuat (min. 32 karakter acak).');
        }
        process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
        console.warn('[jwt] JWT_SECRET kosong — memakai secret ephemeral (sesi hangus saat restart). Set JWT_SECRET untuk dev yang stabil.');
        return process.env.JWT_SECRET;
    }
    if (isWeak(current)) {
        const msg = '[jwt] JWT_SECRET terlalu lemah/default. Generate baru, mis. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`.';
        if (isProd) throw new Error(msg);
        console.warn(msg + ' (diizinkan karena NODE_ENV bukan production)');
    }
    return current;
}

function signToken(payload, options = {}) {
    assertJwtSecret();
    const { current } = getSecrets();
    return jwt.sign(
        { ...payload, jti: crypto.randomUUID(), iss: process.env.JWT_ISSUER || 'finance-prasasti' },
        current,
        { expiresIn: process.env.JWT_EXPIRES_IN || '365d', ...options }
    );
}

/**
 * Verifikasi dengan dukungan rotasi: coba secret aktif dulu, lalu secret lama.
 * @returns {object} decoded payload
 */
function verifyToken(token) {
    const { current, previous } = getSecrets();
    const secrets = [current, ...previous].filter(Boolean);
    let lastError = null;
    for (const secret of secrets) {
        try {
            return jwt.verify(token, secret);
        } catch (err) {
            lastError = err;
            // Token kedaluwarsa tidak perlu dicoba ke secret lain
            if (err && err.name === 'TokenExpiredError') throw err;
        }
    }
    throw lastError || new Error('Invalid token');
}

module.exports = {
    assertJwtSecret,
    signToken,
    verifyToken,
};

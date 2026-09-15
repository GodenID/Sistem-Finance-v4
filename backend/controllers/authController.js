const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { signToken } = require('../lib/jwt');
const { logAuthEvent } = require('../lib/authAudit');

const PASSWORD_MIN_LENGTH = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
const RESET_TOKEN_TTL_MS = parseInt(process.env.RESET_TOKEN_TTL_MS || String(60 * 60 * 1000), 10); // 1 jam

const getClientIp = (req) => req.ip || (req.connection && req.connection.remoteAddress) || '';

/**
 * Verifikasi password dua mode (transisi menuju hashing penuh):
 * - hash bcrypt ($2a/$2b/$2y) → bcrypt.compare
 * - selain itu (data lawas plain-text) → perbandingan timing-safe
 * CATATAN: migrasi ke bcrypt untuk seluruh akun tetap sangat disarankan.
 */
async function verifyPassword(input, stored) {
    if (typeof stored === 'string' && /^\$2[aby]\$/.test(stored)) {
        return bcrypt.compare(String(input), stored);
    }
    const a = Buffer.from(String(input));
    const b = Buffer.from(String(stored));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Login
const login = async (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIp(req);

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password harus diisi' });
        }

        // Find user by username
        const result = await db.query(
            'SELECT id, username, password, name, role, email, status FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            await logAuthEvent({
                userName: username, action: 'login_failed',
                detail: { reason: 'user_not_found', guardScore: req.guard?.score ?? null },
                ip, userAgent: req.headers['user-agent'],
            });
            return res.status(401).json({ error: 'Username atau password salah' });
        }

        const user = result.rows[0];

        if ((user.status || 'active') === 'suspended') {
            await logAuthEvent({
                userId: user.id, userName: user.username, action: 'login_blocked',
                detail: { reason: 'suspended' }, ip, userAgent: req.headers['user-agent'],
            });
            return res.status(403).json({ error: 'Akun Anda sedang suspended. Hubungi administrator.' });
        }

        // Verify password
        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
            await logAuthEvent({
                userId: user.id, userName: user.username, action: 'login_failed',
                detail: { reason: 'wrong_password', guardScore: req.guard?.score ?? null },
                ip, userAgent: req.headers['user-agent'],
            });
            return res.status(401).json({ error: 'Username atau password salah' });
        }

        // Generate JWT token (No.9: via helper terpusat; No.10: bawa skor guard)
        const token = signToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            guardScore: req.guard?.score ?? null,
            guardMethod: req.guard?.method ?? null,
        });

        await logAuthEvent({
            userId: user.id, userName: user.username, action: 'login_success',
            detail: { guardScore: req.guard?.score ?? null, guardMethod: req.guard?.method ?? null },
            ip, userAgent: req.headers['user-agent'],
        });

        // Return user data without password
        const { password: _, ...userData } = user;

        res.json({
            message: 'Login berhasil',
            token,
            user: userData
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get current user
const me = async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Logout (just for client-side token removal acknowledgment)
const logout = async (req, res) => {
    res.json({ message: 'Logout berhasil' });
};

// Change password
const changePassword = async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Password lama dan baru harus diisi' });
        }

        if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
            return res.status(400).json({ error: `Password baru minimal ${PASSWORD_MIN_LENGTH} karakter` });
        }

        // Get current password hash
        const result = await db.query('SELECT password, username FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // Verify current password
        const isValidPassword = await verifyPassword(currentPassword, result.rows[0].password);
        if (!isValidPassword) {
            await logAuthEvent({
                userId, userName: result.rows[0].username, action: 'login_failed',
                detail: { reason: 'wrong_current_password', context: 'change_password' },
                ip, userAgent: req.headers['user-agent'],
            });
            return res.status(401).json({ error: 'Password lama salah' });
        }

        // Simpan dengan format yang sama seperti sebelumnya (transisi hashing
        // penuh menunggu migrasi password; lihat verifyPassword).
        const stored = /^\$2[aby]\$/.test(result.rows[0].password)
            ? await bcrypt.hash(newPassword, 10)
            : newPassword;

        // Update password
        await db.query(
            'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
            [stored, userId]
        );

        await logAuthEvent({
            userId, userName: result.rows[0].username, action: 'pwd_changed',
            detail: { guardScore: req.guard?.score ?? null }, ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Kirim email reset password via Resend langsung (server-to-server).
async function sendResetEmail(to, name, resetLink) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || 'Finance Prasasti <onboarding@resend.dev>';
    if (!apiKey) {
        console.error('[auth] RESEND_API_KEY belum diset — email reset tidak terkirim.');
        return { sent: false, reason: 'email-not-configured' };
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from,
            to: [to],
            subject: 'Reset password Finance Prasasti',
            html: `<p>Halo ${name || 'User'},</p>
<p>Kami menerima permintaan reset password untuk akun Finance Prasasti Anda.</p>
<p><a href="${resetLink}">Klik di sini untuk membuat password baru</a></p>
<p>Tautan berlaku 1 jam dan hanya bisa dipakai sekali. Abaikan email ini jika Anda tidak memintanya.</p>`,
            text: `Halo ${name || 'User'},\n\nBuat password baru lewat tautan berikut (berlaku 1 jam, sekali pakai):\n${resetLink}\n\nAbaikan email ini jika Anda tidak memintanya.`,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend error: ${res.status} ${body}`.slice(0, 300));
    }
    return { sent: true };
}

// Minta tautan reset password (No.8).
// Selalu kembalikan respons generik agar tidak bisa dipakai enumerasi akun.
const forgotPassword = async (req, res) => {
    const GENERIC = { message: 'Jika akun terdaftar, tautan reset telah dikirim ke email.' };
    const ip = getClientIp(req);
    try {
        const identifier = String(req.body?.username || req.body?.email || '').trim();
        if (!identifier) return res.status(400).json({ error: 'Username atau email harus diisi' });

        const result = await db.query(
            'SELECT id, username, name, email FROM users WHERE username = $1 OR email = $1',
            [identifier]
        );
        if (result.rows.length === 0 || !result.rows[0].email) {
            await logAuthEvent({
                userName: identifier, action: 'pwd_reset_req',
                detail: { result: 'no_account_or_no_email' }, ip, userAgent: req.headers['user-agent'],
            });
            return res.json(GENERIC);
        }
        const user = result.rows[0];

        // Token acak 256-bit; yang disimpan hanya hash SHA-256-nya
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await db.query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
             VALUES ($1, $2, $3, $4)`,
            [user.id, tokenHash, expiresAt.toISOString(), ip.slice(0, 50)]
        );

        const appBase = (process.env.APP_BASE_URL || 'https://finance.prasastigroup.id').replace(/\/$/, '');
        const resetLink = `${appBase}/reset-password?token=${rawToken}`;

        try {
            await sendResetEmail(user.email, user.name, resetLink);
        } catch (mailErr) {
            console.error('[auth] gagal kirim email reset:', mailErr.message);
        }

        await logAuthEvent({
            userId: user.id, userName: user.username, action: 'pwd_reset_req',
            detail: { result: 'email_queued' }, ip, userAgent: req.headers['user-agent'],
        });
        return res.json(GENERIC);
    } catch (error) {
        console.error('Forgot password error:', error);
        // Tetap generik (termasuk saat tabel belum dimigrasi)
        return res.json(GENERIC);
    }
};

// Eksekusi reset password dengan token sekali pakai (No.8).
const resetPassword = async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token dan password baru harus diisi' });
        }
        if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
            return res.status(400).json({ error: `Password baru minimal ${PASSWORD_MIN_LENGTH} karakter` });
        }

        const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
        const found = await db.query(
            `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.username, u.password
             FROM password_resets pr JOIN users u ON u.id = pr.user_id
             WHERE pr.token_hash = $1`,
            [tokenHash]
        );
        if (found.rows.length === 0) {
            return res.status(400).json({ error: 'Tautan reset tidak valid.' });
        }
        const row = found.rows[0];
        if (row.used_at) {
            return res.status(400).json({ error: 'Tautan reset sudah dipakai.' });
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            return res.status(400).json({ error: 'Tautan reset kedaluwarsa. Minta yang baru.' });
        }

        const stored = /^\$2[aby]\$/.test(row.password)
            ? await bcrypt.hash(String(newPassword), 10)
            : String(newPassword);

        await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [stored, row.user_id]);
        await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [row.id]);

        await logAuthEvent({
            userId: row.user_id, userName: row.username, action: 'pwd_reset_done',
            detail: {}, ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Password berhasil direset. Silakan login dengan password baru.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    login,
    me,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
};

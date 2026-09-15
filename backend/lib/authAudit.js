/**
 * authAudit.js — Audit keamanan untuk event autentikasi (No.6).
 *
 * Mencatat ke tabel activity_logs (best-effort: kegagalan tulis log
 * TIDAK PERNAH menggagalkan alur login).
 *
 * Konvensi kolom:
 *   table_name = 'auth'            (bukan tabel transaksional)
 *   record_id  = id user (UUID) atau NIL UUID bila user tidak dikenal
 *   action     = login_success | login_failed | login_blocked |
 *                guard_failed | pwd_reset_req | pwd_reset_done | pwd_changed
 *   new_value  = ringkasan JSON (ip, guard score/method, alasan)
 */
const db = require('../config/database');

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

async function logAuthEvent({ userId = null, userName = '', action, detail = {}, ip = '', userAgent = '' }) {
    try {
        await db.query(
            `INSERT INTO activity_logs
                (table_name, record_id, record_number, action, changed_by, changed_by_name, new_value, ip_address, user_agent)
             VALUES ('auth', $1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId || NIL_UUID,
                userName || null,
                action,
                userId || null,
                userName || null,
                JSON.stringify(detail).slice(0, 4000),
                String(ip || '').slice(0, 50),
                String(userAgent || '').slice(0, 500),
            ]
        );
    } catch (err) {
        // Best-effort: jangan ganggu alur utama (mis. tabel belum dimigrasi)
        console.error('[auth-audit] gagal menulis log:', err.message);
    }
}

module.exports = { logAuthEvent, NIL_UUID };

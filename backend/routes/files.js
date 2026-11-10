const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const WORKER_URL = (process.env.UPLOAD_WORKER_URL || '').replace(/\/+$/, '');
// DELETE_SECRET hanya boleh hidup di server. Kalau ikut di-build ke frontend,
// nilainya terbaca siapa pun yang membuka bundle.
const DELETE_SECRET = (process.env.DELETE_SECRET || '').trim();

const MAX_KEYS = 20;

// Hapus objek di bucket lewat worker upload (satu-satunya pemegang kredensial S3).
router.post('/delete', async (req, res) => {
    if (!WORKER_URL || !DELETE_SECRET) {
        return res.status(503).json({ error: 'Hapus file belum dikonfigurasi di server' });
    }

    const keys = (Array.isArray(req.body?.keys) ? req.body.keys : [])
        .map((key) => String(key || '').trim().replace(/^\/+/, ''))
        .filter(Boolean);

    if (keys.length === 0) return res.status(400).json({ error: 'Daftar file kosong' });
    if (keys.length > MAX_KEYS) {
        return res.status(400).json({ error: `Maksimal ${MAX_KEYS} file per permintaan` });
    }

    const deleted = [];
    const failed = [];
    for (const key of keys) {
        try {
            const response = await fetch(`${WORKER_URL}?key=${encodeURIComponent(key)}`, {
                method: 'DELETE',
                headers: { 'X-Delete-Key': DELETE_SECRET },
            });
            if (response.ok) deleted.push(key);
            else failed.push(key);
        } catch (error) {
            console.error('[files] gagal hapus', key, error.message);
            failed.push(key);
        }
    }

    return res.json({ deleted, failed });
});

module.exports = router;

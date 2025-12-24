const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all payment requests
const getAll = async (req, res) => {
    try {
        const { status_approval, status_transfer, id_perusahaan, tipe } = req.query;

        let query = 'SELECT * FROM payment_requests WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (status_approval) {
            query += ` AND status_approval = $${paramIndex++}`;
            params.push(status_approval);
        }
        if (status_transfer) {
            query += ` AND status_transfer = $${paramIndex++}`;
            params.push(status_transfer);
        }
        if (id_perusahaan) {
            query += ` AND id_perusahaan = $${paramIndex++}`;
            params.push(id_perusahaan);
        }
        if (tipe) {
            query += ` AND tipe = $${paramIndex++}`;
            params.push(tipe);
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all payment requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get payment request by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM payment_requests WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment request tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get payment request by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Generate nomor PR
const generateNomorPR = async () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const result = await db.query(
        `SELECT nomor_pr FROM payment_requests 
     WHERE nomor_pr LIKE $1 
     ORDER BY nomor_pr DESC LIMIT 1`,
        [`PR-${year}${month}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
        const lastNumber = result.rows[0].nomor_pr;
        const lastSequence = parseInt(lastNumber.split('-')[2]) || 0;
        sequence = lastSequence + 1;
    }

    return `PR-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Create payment request
const create = async (req, res) => {
    try {
        const {
            nomor_ql,
            tipe,
            id_perusahaan,
            vendor_id,
            nominal,
            keterangan,
            lampiran,
            nama_karyawan
        } = req.body;

        const nomor_pr = await generateNomorPR();

        const result = await db.query(
            `INSERT INTO payment_requests 
       (id, nomor_pr, nomor_ql, tipe, id_perusahaan, vendor_id, nominal, keterangan, lampiran, nama_karyawan, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
            [uuidv4(), nomor_pr, nomor_ql, tipe, id_perusahaan, vendor_id, nominal, keterangan, lampiran, nama_karyawan, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create payment request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update payment request
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nomor_ql,
            tipe,
            id_perusahaan,
            vendor_id,
            nominal,
            keterangan,
            lampiran,
            nama_karyawan
        } = req.body;

        const result = await db.query(
            `UPDATE payment_requests 
       SET nomor_ql = $1, tipe = $2, id_perusahaan = $3, vendor_id = $4, 
           nominal = $5, keterangan = $6, lampiran = $7, nama_karyawan = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
            [nomor_ql, tipe, id_perusahaan, vendor_id, nominal, keterangan, lampiran, nama_karyawan, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment request tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update payment request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update approval status
const updateApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { status_approval } = req.body;

        if (!['Pending', 'Approved', 'Rejected'].includes(status_approval)) {
            return res.status(400).json({ error: 'Status approval tidak valid' });
        }

        const result = await db.query(
            `UPDATE payment_requests 
       SET status_approval = $1, disetujui_oleh = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_approval, req.user.name, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment request tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update approval error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update transfer status
const updateTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { status_transfer, bukti_transfer } = req.body;

        if (!['Belum Transfer', 'Sudah Transfer', 'Reject'].includes(status_transfer)) {
            return res.status(400).json({ error: 'Status transfer tidak valid' });
        }

        const result = await db.query(
            `UPDATE payment_requests 
       SET status_transfer = $1, bukti_transfer = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_transfer, bukti_transfer, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment request tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete payment request
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM payment_requests WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment request tidak ditemukan' });
        }

        res.json({ message: 'Payment request berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete payment request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Bulk delete
const bulkDelete = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs harus berupa array dan tidak boleh kosong' });
        }

        const result = await db.query(
            'DELETE FROM payment_requests WHERE id = ANY($1) RETURNING *',
            [ids]
        );

        res.json({
            message: `${result.rows.length} payment request berhasil dihapus`,
            deleted: result.rows
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    updateApproval,
    updateTransfer,
    remove,
    bulkDelete
};

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all klaim
const getAll = async (req, res) => {
    try {
        const { status_approval, status_transfer, id_perusahaan, tipe } = req.query;

        let query = 'SELECT * FROM klaim WHERE 1=1';
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
        console.error('Get all klaim error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get klaim by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM klaim WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klaim tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get klaim by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Generate nomor klaim
const generateNomorKlaim = async () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const result = await db.query(
        `SELECT nomor_klaim FROM klaim 
     WHERE nomor_klaim LIKE $1 
     ORDER BY nomor_klaim DESC LIMIT 1`,
        [`KL-${year}${month}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
        const lastNumber = result.rows[0].nomor_klaim;
        const lastSequence = parseInt(lastNumber.split('-')[2]) || 0;
        sequence = lastSequence + 1;
    }

    return `KL-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Create klaim
const create = async (req, res) => {
    try {
        const {
            nomor_ql,
            tipe,
            id_perusahaan,
            nominal,
            metode_pembayaran,
            nama_bank,
            nomor_rekening,
            nama_pemilik_rekening,
            lampiran,
            keterangan,
            nama_karyawan
        } = req.body;

        const nomor_klaim = await generateNomorKlaim();

        const result = await db.query(
            `INSERT INTO klaim 
       (id, nomor_klaim, nomor_ql, tipe, id_perusahaan, user_id, nominal, metode_pembayaran, 
        nama_bank, nomor_rekening, nama_pemilik_rekening, lampiran, keterangan, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING *`,
            [uuidv4(), nomor_klaim, nomor_ql, tipe, id_perusahaan, req.user.id, nominal,
                metode_pembayaran, nama_bank, nomor_rekening, nama_pemilik_rekening, lampiran, keterangan]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create klaim error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update klaim
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nomor_ql,
            tipe,
            id_perusahaan,
            nominal,
            metode_pembayaran,
            nama_bank,
            nomor_rekening,
            nama_pemilik_rekening,
            lampiran,
            keterangan
        } = req.body;

        const result = await db.query(
            `UPDATE klaim 
       SET nomor_ql = $1, tipe = $2, id_perusahaan = $3, nominal = $4, 
           metode_pembayaran = $5, nama_bank = $6, nomor_rekening = $7,
           nama_pemilik_rekening = $8, lampiran = $9, keterangan = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
            [nomor_ql, tipe, id_perusahaan, nominal, metode_pembayaran, nama_bank,
                nomor_rekening, nama_pemilik_rekening, lampiran, keterangan, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klaim tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update klaim error:', error);
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
            `UPDATE klaim 
       SET status_approval = $1, disetujui_oleh = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_approval, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klaim tidak ditemukan' });
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
            `UPDATE klaim 
       SET status_transfer = $1, bukti_transfer = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_transfer, bukti_transfer, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klaim tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete klaim
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM klaim WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klaim tidak ditemukan' });
        }

        res.json({ message: 'Klaim berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete klaim error:', error);
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
            'DELETE FROM klaim WHERE id = ANY($1) RETURNING *',
            [ids]
        );

        res.json({
            message: `${result.rows.length} klaim berhasil dihapus`,
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

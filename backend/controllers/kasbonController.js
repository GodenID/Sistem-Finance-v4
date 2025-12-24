const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all kasbon
const getAll = async (req, res) => {
    try {
        const { status_approval, status_transfer, id_perusahaan, tipe } = req.query;

        let query = 'SELECT * FROM kasbon WHERE 1=1';
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
        console.error('Get all kasbon error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get kasbon by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM kasbon WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get kasbon by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get kasbon by nomor_kasbon
const getByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await db.query('SELECT * FROM kasbon WHERE nomor_kasbon = $1', [nomor]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get kasbon by nomor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Generate nomor kasbon
const generateNomorKasbon = async () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const result = await db.query(
        `SELECT nomor_kasbon FROM kasbon 
     WHERE nomor_kasbon LIKE $1 
     ORDER BY nomor_kasbon DESC LIMIT 1`,
        [`KB-${year}${month}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
        const lastNumber = result.rows[0].nomor_kasbon;
        const lastSequence = parseInt(lastNumber.split('-')[2]) || 0;
        sequence = lastSequence + 1;
    }

    return `KB-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Create kasbon
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
            keterangan,
            nama_karyawan
        } = req.body;

        const nomor_kasbon = await generateNomorKasbon();

        const result = await db.query(
            `INSERT INTO kasbon 
       (id, nomor_kasbon, nomor_ql, tipe, id_perusahaan, user_id, nominal, metode_pembayaran, 
        nama_bank, nomor_rekening, nama_pemilik_rekening, keterangan, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       RETURNING *`,
            [uuidv4(), nomor_kasbon, nomor_ql, tipe, id_perusahaan, req.user.id, nominal,
                metode_pembayaran, nama_bank, nomor_rekening, nama_pemilik_rekening, keterangan]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create kasbon error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update kasbon
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
            keterangan
        } = req.body;

        const result = await db.query(
            `UPDATE kasbon 
       SET nomor_ql = $1, tipe = $2, id_perusahaan = $3, nominal = $4, 
           metode_pembayaran = $5, nama_bank = $6, nomor_rekening = $7,
           nama_pemilik_rekening = $8, keterangan = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
            [nomor_ql, tipe, id_perusahaan, nominal, metode_pembayaran, nama_bank,
                nomor_rekening, nama_pemilik_rekening, keterangan, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update kasbon error:', error);
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
            `UPDATE kasbon 
       SET status_approval = $1, disetujui_oleh = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_approval, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
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
            `UPDATE kasbon 
       SET status_transfer = $1, bukti_transfer = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [status_transfer, bukti_transfer, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete kasbon
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM kasbon WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kasbon tidak ditemukan' });
        }

        res.json({ message: 'Kasbon berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete kasbon error:', error);
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
            'DELETE FROM kasbon WHERE id = ANY($1) RETURNING *',
            [ids]
        );

        res.json({
            message: `${result.rows.length} kasbon berhasil dihapus`,
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
    getByNomor,
    create,
    update,
    updateApproval,
    updateTransfer,
    remove,
    bulkDelete
};

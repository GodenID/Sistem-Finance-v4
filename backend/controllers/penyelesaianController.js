const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all penyelesaian
const getAll = async (req, res) => {
    try {
        const { id_perusahaan, tipe } = req.query;

        let query = 'SELECT * FROM penyelesaian WHERE 1=1';
        const params = [];
        let paramIndex = 1;

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
        console.error('Get all penyelesaian error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get penyelesaian by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM penyelesaian WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penyelesaian tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get penyelesaian by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Check if kasbon already has penyelesaian
const checkKasbonPenyelesaian = async (req, res) => {
    try {
        const { nomor_kasbon } = req.params;
        const result = await db.query(
            'SELECT * FROM penyelesaian WHERE nomor_referensi = $1',
            [nomor_kasbon]
        );

        res.json({
            exists: result.rows.length > 0,
            data: result.rows[0] || null
        });
    } catch (error) {
        console.error('Check kasbon penyelesaian error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Generate nomor penyelesaian
const generateNomorPenyelesaian = async () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const result = await db.query(
        `SELECT nomor_penyelesaian FROM penyelesaian 
     WHERE nomor_penyelesaian LIKE $1 
     ORDER BY nomor_penyelesaian DESC LIMIT 1`,
        [`PY-${year}${month}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
        const lastNumber = result.rows[0].nomor_penyelesaian;
        const lastSequence = parseInt(lastNumber.split('-')[2]) || 0;
        sequence = lastSequence + 1;
    }

    return `PY-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Create penyelesaian
const create = async (req, res) => {
    try {
        const {
            nomor_referensi,
            tipe,
            id_perusahaan,
            total_nominal,
            breakdown,
            keterangan
        } = req.body;

        const nomor_penyelesaian = await generateNomorPenyelesaian();

        const result = await db.query(
            `INSERT INTO penyelesaian 
       (id, nomor_penyelesaian, nomor_referensi, tipe, id_perusahaan, user_id, 
        total_nominal, breakdown, keterangan, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
            [uuidv4(), nomor_penyelesaian, nomor_referensi, tipe, id_perusahaan,
            req.user.id, total_nominal, JSON.stringify(breakdown), keterangan]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create penyelesaian error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update penyelesaian
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nomor_referensi,
            tipe,
            id_perusahaan,
            total_nominal,
            breakdown,
            keterangan
        } = req.body;

        const result = await db.query(
            `UPDATE penyelesaian 
       SET nomor_referensi = $1, tipe = $2, id_perusahaan = $3, 
           total_nominal = $4, breakdown = $5, keterangan = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
            [nomor_referensi, tipe, id_perusahaan, total_nominal, JSON.stringify(breakdown), keterangan, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penyelesaian tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update penyelesaian error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete penyelesaian
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM penyelesaian WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Penyelesaian tidak ditemukan' });
        }

        res.json({ message: 'Penyelesaian berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete penyelesaian error:', error);
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
            'DELETE FROM penyelesaian WHERE id = ANY($1) RETURNING *',
            [ids]
        );

        res.json({
            message: `${result.rows.length} penyelesaian berhasil dihapus`,
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
    checkKasbonPenyelesaian,
    create,
    update,
    remove,
    bulkDelete
};

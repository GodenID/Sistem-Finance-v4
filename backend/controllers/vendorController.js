const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all vendors
const getAll = async (req, res) => {
    try {
        const { status, kategori } = req.query;

        let query = 'SELECT * FROM vendors WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (kategori) {
            query += ` AND kategori = $${paramIndex++}`;
            params.push(kategori);
        }

        query += ' ORDER BY nama ASC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all vendors error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get vendor by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM vendors WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get vendor by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create vendor
const create = async (req, res) => {
    try {
        const {
            nama,
            kategori,
            kontak,
            alamat,
            nama_bank,
            nomor_rekening,
            nama_pemilik_rekening,
            status = 'active'
        } = req.body;

        const result = await db.query(
            `INSERT INTO vendors 
       (id, nama, kategori, kontak, alamat, nama_bank, nomor_rekening, nama_pemilik_rekening, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
            [uuidv4(), nama, kategori, kontak, alamat, nama_bank, nomor_rekening, nama_pemilik_rekening, status]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create vendor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update vendor
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nama,
            kategori,
            kontak,
            alamat,
            nama_bank,
            nomor_rekening,
            nama_pemilik_rekening,
            status
        } = req.body;

        const result = await db.query(
            `UPDATE vendors 
       SET nama = $1, kategori = $2, kontak = $3, alamat = $4, 
           nama_bank = $5, nomor_rekening = $6, nama_pemilik_rekening = $7,
           status = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
            [nama, kategori, kontak, alamat, nama_bank, nomor_rekening, nama_pemilik_rekening, status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update vendor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete vendor
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM vendors WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor tidak ditemukan' });
        }

        res.json({ message: 'Vendor berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete vendor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};

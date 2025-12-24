const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all users
const getAll = async (req, res) => {
    try {
        const { role } = req.query;

        let query = 'SELECT id, username, name, role, created_at, updated_at FROM users WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND role = $${paramIndex++}`;
            params.push(role);
        }

        query += ' ORDER BY name ASC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get user by ID
const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'SELECT id, username, name, role, created_at, updated_at FROM users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create user
const create = async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        if (!username || !password || !name || !role) {
            return res.status(400).json({ error: 'Semua field harus diisi' });
        }

        // Check if username already exists
        const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (id, username, password, name, role, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, username, name, role, created_at`,
            [uuidv4(), username, hashedPassword, name, role]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update user
const update = async (req, res) => {
    try {
        const { id } = req.params;
        // Check permission: Admin or Own Profile
        if (req.user.role !== 'administrator' && req.user.id !== id) {
            return res.status(403).json({ error: 'Tidak memiliki izin untuk mengupdate user ini' });
        }

        // Prevent non-admin from changing role
        if (req.user.role !== 'administrator' && role && role !== req.user.role) {
            return res.status(403).json({ error: 'Hanya administrator yang dapat mengubah role' });
        }

        // Prevent non-admin from changing username (optional, if you want to restrict)
        // if (req.user.role !== 'administrator' && username && username !== req.user.username) { ... }

        const { username, name, role, password } = req.body;

        // Check if username already exists (for different user)
        if (username) {
            const existingUser = await db.query(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [username, id]
            );
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Username sudah digunakan' });
            }
        }

        let query, params;

        if (password) {
            // Update with new password
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `UPDATE users 
               SET username = $1, name = $2, role = $3, password = $4, updated_at = NOW()
               WHERE id = $5
               RETURNING id, username, name, role, created_at, updated_at`;
            params = [username, name, role, hashedPassword, id];
        } else {
            // Update without password
            query = `UPDATE users 
               SET username = $1, name = $2, role = $3, updated_at = NOW()
               WHERE id = $4
               RETURNING id, username, name, role, created_at, updated_at`;
            params = [username, name, role, id];
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete user
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting own account
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
        }

        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, username, name',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json({ message: 'User berhasil dihapus', data: result.rows[0] });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get user stats
const getStats = async (req, res) => {
    try {
        const { id } = req.params;

        // Get user name for name matching
        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        const userName = userResult.rows[0].name;

        // Parallel queries for stats
        const [pr, kasbon, klaim, penyelesaian, activities] = await Promise.all([
            db.query(
                `SELECT COUNT(*) FROM payment_requests 
                 WHERE (created_by = $1) 
                 OR (nama_karyawan ILIKE '%' || $2 || '%')`,
                [id, userName]
            ),
            db.query(
                `SELECT COUNT(*) FROM kasbon 
                 WHERE (user_id = $1) 
                 OR (nama_karyawan ILIKE '%' || $2 || '%')`,
                [id, userName]
            ),
            db.query(
                `SELECT COUNT(*) FROM klaim 
                 WHERE (user_id = $1) 
                 OR (nama_karyawan ILIKE '%' || $2 || '%')`,
                [id, userName]
            ),
            db.query(
                `SELECT COUNT(*) FROM penyelesaian 
                 WHERE (user_id = $1) 
                 OR (nama_karyawan ILIKE '%' || $2 || '%')`,
                [id, userName]
            ),
            db.query(
                'SELECT COUNT(*) FROM activity_logs WHERE changed_by = $1',
                [id]
            )
        ]);

        res.json({
            paymentRequests: parseInt(pr.rows[0].count),
            kasbon: parseInt(kasbon.rows[0].count),
            klaim: parseInt(klaim.rows[0].count),
            penyelesaian: parseInt(penyelesaian.rows[0].count),
            totalActivities: parseInt(activities.rows[0].count)
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    getStats
};

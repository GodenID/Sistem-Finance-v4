const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all users
const getAll = async (req, res) => {
    try {
        const { role } = req.query;

        let query = 'SELECT id, username, name, role, email, email_notifications_enabled, status, permissions, created_at, updated_at FROM users WHERE 1=1';
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
            'SELECT id, username, name, role, email, email_notifications_enabled, status, permissions, created_at, updated_at FROM users WHERE id = $1',
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
        const { username, password, name, role, email, email_notifications_enabled, status, permissions } = req.body;

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
            `INSERT INTO users (id, username, password, name, role, email, email_notifications_enabled, status, permissions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, username, name, role, email, email_notifications_enabled, status, permissions, created_at`,
            [uuidv4(), username, hashedPassword, name, role,
                email || null,
                email_notifications_enabled !== false,
                status || 'active',
                permissions ? JSON.stringify(permissions) : null]
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
        const { username, name, role, password, email, email_notifications_enabled, status, permissions } = req.body;
        // Check permission: Admin or Own Profile
        if (req.user.role !== 'administrator' && req.user.id !== id) {
            return res.status(403).json({ error: 'Tidak memiliki izin untuk mengupdate user ini' });
        }

        // Prevent non-admin from changing role
        if (req.user.role !== 'administrator' && role && role !== req.user.role) {
            return res.status(403).json({ error: 'Hanya administrator yang dapat mengubah role' });
        }

        // Prevent non-admin from changing permissions (hanya administrator yang
        // boleh mengatur permission per-user)
        if (req.user.role !== 'administrator' && permissions !== undefined) {
            return res.status(403).json({ error: 'Hanya administrator yang dapat mengubah permission' });
        }

        // Prevent non-admin from changing username (optional, if you want to restrict)
        // if (req.user.role !== 'administrator' && username && username !== req.user.username) { ... }

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

        // Ambil data saat ini agar field yang tidak dikirim tidak ikut terhapus
        const current = await db.query(
            'SELECT username, name, role, email, email_notifications_enabled, status, permissions FROM users WHERE id = $1',
            [id]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        const cur = current.rows[0];

        const nextUsername = username !== undefined ? username : cur.username;
        const nextName = name !== undefined ? name : cur.name;
        const nextRole = role !== undefined ? role : cur.role;
        const nextEmail = email !== undefined ? email : cur.email;
        const nextEmailNotif = email_notifications_enabled !== undefined
            ? email_notifications_enabled
            : cur.email_notifications_enabled;
        const nextStatus = status !== undefined ? status : cur.status;
        const nextPermissions = permissions !== undefined
            ? (permissions === null ? null : JSON.stringify(permissions))
            : cur.permissions;

        let query, params;

        if (password) {
            // Update with new password
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `UPDATE users
               SET username = $1, name = $2, role = $3, password = $4, email = $5,
                   email_notifications_enabled = $6, status = $7, permissions = $8, updated_at = NOW()
               WHERE id = $9
               RETURNING id, username, name, role, email, email_notifications_enabled, status, permissions, created_at, updated_at`;
            params = [nextUsername, nextName, nextRole, hashedPassword,
                nextEmail, nextEmailNotif, nextStatus, nextPermissions, id];
        } else {
            // Update without password
            query = `UPDATE users
               SET username = $1, name = $2, role = $3, email = $4,
                   email_notifications_enabled = $5, status = $6, permissions = $7, updated_at = NOW()
               WHERE id = $8
               RETURNING id, username, name, role, email, email_notifications_enabled, status, permissions, created_at, updated_at`;
            params = [nextUsername, nextName, nextRole,
                nextEmail, nextEmailNotif, nextStatus, nextPermissions, id];
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

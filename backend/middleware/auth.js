const { verifyToken } = require('../lib/jwt');
const db = require('../config/database');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        // No.9: verifikasi mendukung rotasi secret (aktif + secret lama)
        const decoded = verifyToken(token);

        // Fetch user from database to ensure they still exist and get latest role
        const result = await db.query(
            'SELECT id, username, name, role, email, status, permissions FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        // No.3: sesi terbunuh server-side saat akun di-suspend
        if ((result.rows[0].status || 'active') === 'suspended') {
            return res.status(403).json({ error: 'Akun Anda sedang suspended. Hubungi administrator.' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
        }
        console.error('Auth middleware error:', error.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check specific roles
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Middleware for admin only
const requireAdmin = requireRole('administrator');

// Middleware for finance team
const requireFinance = requireRole('administrator', 'team_finance');

// Middleware for BOD approval
const requireBOD = requireRole('administrator', 'bod');

// Middleware for manager-stage approval (tahap 1: Pending -> Manager Approved)
const requireManager = requireRole('administrator', 'bod', 'manager');

// Middleware for head finance final approval (tahap 2: Manager Approved -> Approved)
const requireHeadFinance = requireRole('administrator', 'head_finance');

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    requireFinance,
    requireBOD,
    requireManager,
    requireHeadFinance
};

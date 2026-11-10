require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// FRONTEND_URL boleh berisi beberapa origin dipisah koma (mis. domain produksi
// dan domain preview Cloudflare Pages). Satu segmen host boleh ditulis '*' untuk
// mencocokkan subdomain apa pun, mis. https://*.finance-v3-e0e.pages.dev.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((origin) => {
        const pattern = origin
            .split('*')
            .map((part) => escapeRegex(part))
            .join('[^.]+');
        return { plain: origin, matcher: new RegExp(`^${pattern}$`) };
    });

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, '');
        const allowed = allowedOrigins.some((entry) =>
            entry.plain === normalized || entry.matcher.test(normalized)
        );
        return allowed ? callback(null, true) : callback(null, false);
    },
    credentials: true,
    // Cache hasil preflight 10 menit. Tanpa ini setiap panggilan API membayar
    // dua round-trip (OPTIONS lalu GET) — paling terasa di jaringan lambat.
    maxAge: 600
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment-requests', require('./routes/paymentRequests'));
app.use('/api/kasbon', require('./routes/kasbon'));
app.use('/api/klaim', require('./routes/klaim'));
app.use('/api/penyelesaian', require('./routes/penyelesaian'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/users', require('./routes/users'));
app.use('/api/activity-logs', require('./routes/activityLogs'));
app.use('/api/files', require('./routes/files'));
app.use('/api/data', require('./routes/data'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// No.9: fail-fast bila JWT_SECRET lemah — sesi tidak boleh ditandatangani asal-asalan
try {
    require('./lib/jwt').assertJwtSecret();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
});

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/upload', require('./routes/upload'));
app.use('/api/recurring-transactions', require('./routes/recurringTransactions'));
app.use('/api/recurring-instances', require('./routes/recurringInstances'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File terlalu besar. Maksimal 10MB.' });
        }
        return res.status(400).json({ error: err.message });
    }

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

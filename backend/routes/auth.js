const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const loginRateLimit = require('../middleware/loginRateLimit');

// Public routes — dilindungi rate-limit anti-bruteforce.
// (Prasasti Guard dilepas: proteksi bot kini via Turnstile gate kunjungan di
// frontend + Worker siteverify, bukan captcha di form login.)
router.post('/login', loginRateLimit, authController.login);

// No.8: lupa & reset password (respons selalu generik anti-enumerasi)
router.post('/forgot-password', loginRateLimit, authController.forgotPassword);
router.post('/reset-password', loginRateLimit, authController.resetPassword);

// Endpoint legacy — dipertahankan agar frontend lama tidak 404, tapi tidak
// lagi memvalidasi guard. Selalu balas valid:true.
router.post('/verify-guard', loginRateLimit, (req, res) => {
    res.json({ valid: true, legacy: true });
});

// Protected routes
router.get('/me', authenticateToken, authController.me);
router.post('/logout', authenticateToken, authController.logout);
// Ganti password kini tanpa captcha per-form (sudah di balik site gate)
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
